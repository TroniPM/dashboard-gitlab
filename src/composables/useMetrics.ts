import { computed, type Ref } from 'vue'
import { useGitLabStore } from '@/stores/gitlab'
import type { GitLabJob, GitLabPipeline, GitLabProject, RetryStats } from '@/types/gitlab'

export interface MetricsFilters {
  projectIds?: number[]
  branches?: string[]
  statuses?: string[]
}

export function useMetrics(filters?: Ref<MetricsFilters>) {
  const store = useGitLabStore()

  // ─── Scoped projects ───────────────────────────────────────────────────────

  const scopedProjects = computed((): GitLabProject[] => {
    const ids = filters?.value.projectIds
    if (!ids || ids.length === 0) return store.projects
    return store.projects.filter(p => ids.includes(p.id))
  })

  // ─── All pipelines (respecting scope + branch/status filters) ─────────────

  const allPipelines = computed((): GitLabPipeline[] => {
    const branches = filters?.value.branches
    const statuses = filters?.value.statuses
    const result: GitLabPipeline[] = []
    for (const p of scopedProjects.value) {
      let plines = store.pipelines[p.id] ?? []
      if (branches && branches.length > 0) plines = plines.filter(pl => branches.includes(pl.ref))
      if (statuses && statuses.length > 0) plines = plines.filter(pl => statuses.includes(pl.status))
      result.push(...plines)
    }
    return result
  })

  const failedPipelines = computed(() => allPipelines.value.filter(p => p.status === 'failed'))

  // ─── All jobs (from cached pipelines that have jobs loaded) ───────────────

  const allLoadedJobs = computed((): GitLabJob[] => {
    const result: GitLabJob[] = []
    for (const pl of allPipelines.value) {
      const pjobs = store.jobs[pl.id]
      if (pjobs) result.push(...pjobs)
    }
    return result
  })

  const failedJobs = computed(() =>
    allLoadedJobs.value.filter(j => j.status === 'failed' && !j.allow_failure)
  )

  // ─── Summary KPIs ────────────────────────────────────────────────────────

  const summaryStats = computed(() => {
    const plines = allPipelines.value
    const total = plines.length
    const failed = plines.filter(p => p.status === 'failed').length
    const succeeded = plines.filter(p => p.status === 'success').length
    const running = plines.filter(p => ['running', 'pending', 'preparing', 'waiting_for_resource'].includes(p.status)).length
    const canceled = plines.filter(p => p.status === 'canceled').length

    // The pipeline list endpoint does not return `duration`; derive it from
    // updated_at - created_at as a reasonable wall-clock approximation.
    const finishedStatuses = ['success', 'failed', 'canceled']
    const durations = plines
      .filter(p => finishedStatuses.includes(p.status))
      .map(p => {
        if (p.duration != null) return p.duration
        const ms = new Date(p.updated_at).getTime() - new Date(p.created_at).getTime()
        return ms > 0 ? ms / 1000 : 0
      })
    const avgDurationSec = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0

    return {
      total,
      failed,
      succeeded,
      running,
      canceled,
      successRate: total > 0 ? Math.round((succeeded / total) * 100) : 0,
      failureRate: total > 0 ? Math.round((failed / total) * 100) : 0,
      avgDurationSec: Math.round(avgDurationSec)
    }
  })

  // ─── Failures by project ─────────────────────────────────────────────────

  const failuresByProject = computed(() =>
    scopedProjects.value.map(p => {
      let plines = store.pipelines[p.id] ?? []
      const branches = filters?.value.branches
      if (branches && branches.length > 0) plines = plines.filter(pl => branches.includes(pl.ref))
      const total = plines.length
      const failed = plines.filter(pl => pl.status === 'failed').length
      return {
        id: p.id,
        name: p.name,
        total,
        failed,
        succeeded: plines.filter(pl => pl.status === 'success').length,
        successRate: total > 0 ? Math.round(((total - failed) / total) * 100) : 100
      }
    }).sort((a, b) => b.failed - a.failed)
  )

  // ─── Failures by stage ────────────────────────────────────────────────────

  const failuresByStage = computed(() => {
    const counts: Record<string, number> = {}
    for (const j of failedJobs.value) {
      counts[j.stage] = (counts[j.stage] ?? 0) + 1
    }
    return Object.entries(counts)
      .map(([stage, count]) => ({ stage, count }))
      .sort((a, b) => b.count - a.count)
  })

  // ─── Failure reasons ─────────────────────────────────────────────────────

  const failureReasons = computed(() => {
    const counts: Record<string, number> = {}
    for (const j of failedJobs.value) {
      const reason = j.failure_reason ?? 'unknown_failure'
      counts[reason] = (counts[reason] ?? 0) + 1
    }
    return Object.entries(counts)
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
  })

  // ─── Retry stats ──────────────────────────────────────────────────────────
  // A job was retried if the same name appears >1 times in a pipeline's job list

  const retryStats = computed((): RetryStats[] => {
    // key = "projectId::jobName"
    const map: Record<string, RetryStats> = {}

    for (const pipeline of allPipelines.value) {
      const pjobs = store.jobs[pipeline.id]
      if (!pjobs || pjobs.length === 0) continue

      const byName: Record<string, GitLabJob[]> = {}
      for (const j of pjobs) {
        ;(byName[j.name] ??= []).push(j)
      }

      for (const [jobName, jobList] of Object.entries(byName)) {
        if (jobList.length <= 1) continue

        const project = store.projects.find(p => p.id === pipeline.project_id)
        const key = `${pipeline.project_id}::${jobName}`
        const retryCount = jobList.length - 1

        const reasons = jobList
          .filter(j => j.status === 'failed' && j.failure_reason)
          .map(j => j.failure_reason!)
          .filter((r, i, arr) => arr.indexOf(r) === i)

        if (!map[key]) {
          map[key] = {
            jobName,
            projectId: pipeline.project_id,
            projectName: project?.name ?? String(pipeline.project_id),
            totalRetries: 0,
            affectedPipelines: 0,
            failureReasons: []
          }
        }

        map[key].totalRetries += retryCount
        map[key].affectedPipelines += 1

        for (const r of reasons) {
          if (!map[key].failureReasons.includes(r)) {
            map[key].failureReasons.push(r)
          }
        }
      }
    }

    return Object.values(map).sort((a, b) => b.totalRetries - a.totalRetries)
  })

  // ─── Failures trend (daily) ───────────────────────────────────────────────

  const failuresTrend = computed(() => {
    const dayMap: Record<string, { failed: number; total: number }> = {}
    for (const p of allPipelines.value) {
      const day = p.created_at.split('T')[0]
      dayMap[day] ??= { failed: 0, total: 0 }
      dayMap[day].total++
      if (p.status === 'failed') dayMap[day].failed++
    }
    return Object.entries(dayMap)
      .map(([date, v]) => ({ date, ...v }))
      .sort((a, b) => a.date.localeCompare(b.date))
  })

  // ─── Available branches ───────────────────────────────────────────────────

  const availableBranches = computed((): string[] => {
    const set = new Set<string>()
    for (const p of scopedProjects.value) {
      for (const pl of store.pipelines[p.id] ?? []) {
        set.add(pl.ref)
      }
    }
    return [...set].sort()
  })

  // ─── Pipeline source distribution ─────────────────────────────────────────

  const sourceDistribution = computed(() => {
    const counts: Record<string, number> = {}
    for (const pl of failedPipelines.value) {
      const src = pl.source ?? 'unknown'
      counts[src] = (counts[src] ?? 0) + 1
    }
    return Object.entries(counts)
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count)
  })

  return {
    scopedProjects,
    allPipelines,
    failedPipelines,
    allLoadedJobs,
    failedJobs,
    summaryStats,
    failuresByProject,
    failuresByStage,
    failureReasons,
    retryStats,
    failuresTrend,
    availableBranches,
    sourceDistribution
  }
}
