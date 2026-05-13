import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { AxiosInstance } from 'axios'
import type { GitLabCommit } from '@/types/gitlab'
import { createGitLabClient, fetchLastCommitForPath } from '@/api/gitlab'
import { useSettingsStore } from './settings'

const LS_KEY = 'gl_blame_settings'
const LS_BRANCH_KEY = 'gl_blame_branches'
const LS_PREV_KEY = 'gl_blame_prev_commits'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BlameEntry {
  projectId: number
  projectName: string
  projectWebUrl: string
  branch: string
  path: string
  commit: GitLabCommit | null
  /** true when the commit hash changed since the previous load */
  isNew: boolean
  fileHistoryUrl: string
}

// ─── Persistence helpers ──────────────────────────────────────────────────────

function loadPersistedPaths(): Record<number, string[]> {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? '{}')
  } catch {
    return {}
  }
}

function savePersistedPaths(data: Record<number, string[]>) {
  localStorage.setItem(LS_KEY, JSON.stringify(data))
}

function loadPersistedBranches(): Record<number, string> {
  try {
    return JSON.parse(localStorage.getItem(LS_BRANCH_KEY) ?? '{}')
  } catch {
    return {}
  }
}

function savePersistedBranches(data: Record<number, string>) {
  localStorage.setItem(LS_BRANCH_KEY, JSON.stringify(data))
}

/** Persisted snapshot: commit id (full) per `${projectId}::${path}` key */
function loadPersistedPrevCommits(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(LS_PREV_KEY) ?? '{}')
  } catch {
    return {}
  }
}

function savePersistedPrevCommits(data: Record<string, string>) {
  localStorage.setItem(LS_PREV_KEY, JSON.stringify(data))
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useBlameStore = defineStore('blame', () => {
  const settings = useSettingsStore()

  /** Persisted: paths watched per project id */
  const watchedPaths = ref<Record<number, string[]>>(loadPersistedPaths())

  /** Persisted: branch per project id */
  const watchedBranches = ref<Record<number, string>>(loadPersistedBranches())

  /** Persisted: last-seen commit ids, keyed by `${projectId}::${path}` */
  const previousCommitIds = ref<Record<string, string>>(loadPersistedPrevCommits())

  /** Ephemeral: last loaded commit data, keyed by `${projectId}::${path}` */
  const commitResults = ref<Record<string, BlameEntry>>({})

  const isLoading = ref(false)
  const loadingError = ref<string | null>(null)
  const loadingProgress = ref({ current: 0, total: 0, message: '' })

  let abortController: AbortController | null = null

  // ─── Getters ─────────────────────────────────────────────────────────────

  const isConfigured = computed(() =>
    Object.values(watchedPaths.value).some(paths => paths.length > 0)
  )

  const allEntries = computed((): BlameEntry[] =>
    Object.values(commitResults.value)
  )

  // ─── Mutations ────────────────────────────────────────────────────────────

  function setWatchedPaths(projectId: number, paths: string[], branch: string) {
    watchedPaths.value = { ...watchedPaths.value, [projectId]: paths }
    watchedBranches.value = { ...watchedBranches.value, [projectId]: branch }
    savePersistedPaths(watchedPaths.value)
    savePersistedBranches(watchedBranches.value)
  }

  function removeProject(projectId: number) {
    const copyPaths = { ...watchedPaths.value }
    const copyBranches = { ...watchedBranches.value }
    delete copyPaths[projectId]
    delete copyBranches[projectId]
    watchedPaths.value = copyPaths
    watchedBranches.value = copyBranches
    savePersistedPaths(watchedPaths.value)
    savePersistedBranches(watchedBranches.value)

    // Also remove from ephemeral results
    const filtered: Record<string, BlameEntry> = {}
    for (const [k, v] of Object.entries(commitResults.value)) {
      if (v.projectId !== projectId) filtered[k] = v
    }
    commitResults.value = filtered
  }

  function cancelLoad() {
    abortController?.abort()
  }

  // ─── Internal task runner ─────────────────────────────────────────────────

  async function _buildEntry(
    client: AxiosInstance,
    task: { projectId: number; projectName: string; projectWebUrl: string; branch: string; path: string }
  ): Promise<BlameEntry> {
    const ref = task.branch !== 'HEAD' ? task.branch : undefined
    const commit = await fetchLastCommitForPath(client, task.projectId, task.path, ref)
    const key = `${task.projectId}::${task.path}`
    const encodedPath = encodeURIComponent(task.path).replace(/%2F/g, '/')
    const prevId = previousCommitIds.value[key]
    const currentId = commit?.id ?? ''
    return {
      projectId: task.projectId,
      projectName: task.projectName,
      projectWebUrl: task.projectWebUrl,
      branch: task.branch,
      path: task.path,
      commit,
      isNew: !!prevId && !!currentId && currentId !== prevId,
      fileHistoryUrl: `${task.projectWebUrl}/-/commits/${task.branch}/${encodedPath}`
    }
  }

  // ─── Data loading ─────────────────────────────────────────────────────────

  async function loadAll(projects: Array<{ id: number; name: string; web_url: string }>) {
    if (isLoading.value) return
    loadingError.value = null
    isLoading.value = true
    abortController = new AbortController()

    const client = createGitLabClient(settings.gitlabUrl, settings.token)

    const tasks: Array<{
      projectId: number
      projectName: string
      projectWebUrl: string
      branch: string
      path: string
    }> = []

    for (const project of projects) {
      const paths = watchedPaths.value[project.id] ?? []
      const branch = watchedBranches.value[project.id] ?? 'HEAD'
      for (const path of paths) {
        tasks.push({ projectId: project.id, projectName: project.name, projectWebUrl: project.web_url, branch, path })
      }
    }

    loadingProgress.value = { current: 0, total: tasks.length, message: 'Iniciando...' }

    const newResults: Record<string, BlameEntry> = {}

    for (const task of tasks) {
      if (abortController.signal.aborted) break
      loadingProgress.value.message = `${task.projectName} [${task.branch}]: ${task.path}`
      const entry = await _buildEntry(client, task)
      newResults[`${task.projectId}::${task.path}`] = entry
      loadingProgress.value.current++
    }

    if (!abortController.signal.aborted) {
      const newPrevIds: Record<string, string> = { ...previousCommitIds.value }
      for (const [key, entry] of Object.entries(newResults)) {
        if (entry.commit?.id) newPrevIds[key] = entry.commit.id
      }
      previousCommitIds.value = newPrevIds
      savePersistedPrevCommits(newPrevIds)
      commitResults.value = newResults
    }

    isLoading.value = false
    loadingProgress.value.message = 'Concluído'
  }

  async function loadProject(project: { id: number; name: string; web_url: string }) {
    if (isLoading.value) return
    loadingError.value = null
    isLoading.value = true
    abortController = new AbortController()

    const client = createGitLabClient(settings.gitlabUrl, settings.token)
    const paths = watchedPaths.value[project.id] ?? []
    const branch = watchedBranches.value[project.id] ?? 'HEAD'

    loadingProgress.value = { current: 0, total: paths.length, message: `Carregando ${project.name}...` }

    const updatedResults = { ...commitResults.value }

    for (const path of paths) {
      if (abortController.signal.aborted) break
      loadingProgress.value.message = `${project.name} [${branch}]: ${path}`
      const entry = await _buildEntry(client, { projectId: project.id, projectName: project.name, projectWebUrl: project.web_url, branch, path })
      updatedResults[`${project.id}::${path}`] = entry
      loadingProgress.value.current++
    }

    if (!abortController.signal.aborted) {
      const newPrevIds = { ...previousCommitIds.value }
      for (const path of paths) {
        const key = `${project.id}::${path}`
        const entry = updatedResults[key]
        if (entry?.commit?.id) newPrevIds[key] = entry.commit.id
      }
      previousCommitIds.value = newPrevIds
      savePersistedPrevCommits(newPrevIds)
      commitResults.value = updatedResults
    }

    isLoading.value = false
    loadingProgress.value.message = 'Concluído'
  }

  return {
    watchedPaths,
    watchedBranches,
    previousCommitIds,
    commitResults,
    isLoading,
    loadingError,
    loadingProgress,
    isConfigured,
    allEntries,
    setWatchedPaths,
    removeProject,
    cancelLoad,
    loadAll,
    loadProject
  }
})
