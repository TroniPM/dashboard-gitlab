import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { GitLabProject, GitLabPipeline, GitLabJob, CachedData } from '@/types/gitlab'
import {
  createGitLabClient,
  fetchProjects,
  fetchPipelinesForProject,
  fetchJobsBatched
} from '@/api/gitlab'
import { useSettingsStore } from './settings'

const LS_DATA_KEY = 'gl_dashboard_data'

export interface LoadingProgress {
  phase: 'idle' | 'projects' | 'pipelines' | 'jobs' | 'done'
  message: string
  current: number
  total: number
}

export const useGitLabStore = defineStore('gitlab', () => {
  const settings = useSettingsStore()

  const projects = ref<GitLabProject[]>([])
  const pipelines = ref<Record<number, GitLabPipeline[]>>({})
  const jobs = ref<Record<number, GitLabJob[]>>({})
  const lastFetched = ref<string | null>(null)
  const isLoading = ref(false)
  const loadingError = ref<string | null>(null)
  const loadingProgress = ref<LoadingProgress>({
    phase: 'idle',
    message: '',
    current: 0,
    total: 0
  })

  let abortController: AbortController | null = null

  // ─── Cache Persistence ───────────────────────────────────────────────────

  function loadFromCache(): boolean {
    try {
      const raw = localStorage.getItem(LS_DATA_KEY)
      if (!raw) return false
      const data = JSON.parse(raw) as CachedData
      projects.value = data.projects ?? []
      pipelines.value = data.pipelines ?? {}
      jobs.value = data.jobs ?? {}
      lastFetched.value = data.lastFetched ?? null
      return true
    } catch {
      return false
    }
  }

  function saveToCache() {
    const data: CachedData = {
      projects: projects.value,
      pipelines: pipelines.value,
      jobs: jobs.value,
      lastFetched: new Date().toISOString(),
      dateRangeStart: settings.dateRangeStart,
      dateRangeEnd: settings.dateRangeEnd
    }
    try {
      const json = JSON.stringify(data)
      const sizeMB = (json.length / 1024 / 1024).toFixed(2)
      localStorage.setItem(LS_DATA_KEY, json)
      lastFetched.value = data.lastFetched
      console.info(`[GitLab Dashboard] Cache salvo: ${sizeMB} MB`)
    } catch {
      loadingError.value =
        'Cache excedeu limite do localStorage. Exporte os dados e reduza o intervalo de datas.'
    }
  }

  // ─── Export / Import ─────────────────────────────────────────────────────

  function exportData(): string {
    const data: CachedData = {
      projects: projects.value,
      pipelines: pipelines.value,
      jobs: jobs.value,
      lastFetched: lastFetched.value ?? new Date().toISOString(),
      dateRangeStart: settings.dateRangeStart,
      dateRangeEnd: settings.dateRangeEnd
    }
    return JSON.stringify(data, null, 2)
  }

  function importData(raw: string): { ok: boolean; error?: string } {
    try {
      const data = JSON.parse(raw) as CachedData
      if (!Array.isArray(data.projects)) throw new Error('Formato inválido')
      projects.value = data.projects
      pipelines.value = data.pipelines ?? {}
      jobs.value = data.jobs ?? {}
      lastFetched.value = data.lastFetched ?? null
      if (data.dateRangeStart) settings.dateRangeStart = data.dateRangeStart
      if (data.dateRangeEnd) settings.dateRangeEnd = data.dateRangeEnd
      saveToCache()
      return { ok: true }
    } catch (err: unknown) {
      return { ok: false, error: (err as Error).message }
    }
  }

  function clearData() {
    projects.value = []
    pipelines.value = {}
    jobs.value = {}
    lastFetched.value = null
    localStorage.removeItem(LS_DATA_KEY)
  }

  // ─── Main Load ───────────────────────────────────────────────────────────

  async function loadData() {
    if (!settings.isConfigured || isLoading.value) return

    abortController?.abort()
    abortController = new AbortController()
    const signal = abortController.signal

    isLoading.value = true
    loadingError.value = null

    try {
      const client = createGitLabClient(settings.gitlabUrl, settings.token)

      // PHASE 1 – Projects
      loadingProgress.value = { phase: 'projects', message: 'Carregando projetos...', current: 0, total: 0 }
      let projectList = await fetchProjects(
        client,
        n => { loadingProgress.value.current = n },
        signal
      )

      if (settings.selectedProjectIds.length > 0) {
        projectList = projectList.filter(p => settings.selectedProjectIds.includes(p.id))
      }
      projects.value = projectList

      if (signal.aborted) return

      // PHASE 2 – Pipelines
      const startIso = new Date(settings.dateRangeStart).toISOString()
      const endIso = new Date(`${settings.dateRangeEnd}T23:59:59`).toISOString()
      const newPipelines: Record<number, GitLabPipeline[]> = {}

      loadingProgress.value = {
        phase: 'pipelines',
        message: 'Carregando pipelines...',
        current: 0,
        total: projectList.length
      }

      for (let i = 0; i < projectList.length; i++) {
        if (signal.aborted) return
        const project = projectList[i]
        loadingProgress.value.current = i + 1
        loadingProgress.value.message = `Pipelines: ${project.name} (${i + 1}/${projectList.length})`
        try {
          newPipelines[project.id] = await fetchPipelinesForProject(
            client, project.id, startIso, endIso, signal
          )
        } catch {
          newPipelines[project.id] = []
        }
      }
      pipelines.value = newPipelines

      if (signal.aborted) return

      // PHASE 3 – Jobs
      const allPipelines: GitLabPipeline[] = []
      for (const pList of Object.values(newPipelines)) {
        allPipelines.push(...pList)
      }

      const pipelinesForJobs = settings.loadJobsForAllPipelines
        ? allPipelines
        : allPipelines.filter(p => p.status === 'failed')

      const capped = pipelinesForJobs.slice(0, settings.maxPipelinesForJobs)

      loadingProgress.value = {
        phase: 'jobs',
        message: 'Carregando jobs...',
        current: 0,
        total: capped.length
      }

      jobs.value = await fetchJobsBatched(
        client,
        capped,
        5,
        250,
        (done, total, label) => {
          loadingProgress.value.current = done
          loadingProgress.value.total = total
          loadingProgress.value.message = `Jobs: ${label}`
        },
        signal
      )

      if (!signal.aborted) {
        loadingProgress.value = { phase: 'done', message: 'Concluído!', current: 1, total: 1 }
        saveToCache()
      }
    } catch (err: unknown) {
      if ((err as { name?: string }).name === 'CanceledError') return
      const axiosErr = err as { response?: { data?: { message?: string } }; message?: string }
      loadingError.value = axiosErr.response?.data?.message ?? axiosErr.message ?? 'Erro desconhecido'
    } finally {
      isLoading.value = false
    }
  }

  function cancelLoad() {
    abortController?.abort()
  }

  // ─── Fetch projects only (step 2 of wizard) ──────────────────────────────

  const isLoadingProjects = ref(false)
  const loadProjectsError = ref<string | null>(null)

  async function fetchProjectsOnly(): Promise<boolean> {
    if (!settings.isConfigured) return false
    isLoadingProjects.value = true
    loadProjectsError.value = null
    try {
      const client = createGitLabClient(settings.gitlabUrl, settings.token)
      projects.value = await fetchProjects(client)
      return true
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } }; message?: string }
      loadProjectsError.value = axiosErr.response?.data?.message ?? axiosErr.message ?? 'Erro ao carregar projetos'
      return false
    } finally {
      isLoadingProjects.value = false
    }
  }

  // Init from cache on store creation
  loadFromCache()

  return {
    projects,
    pipelines,
    jobs,
    lastFetched,
    isLoading,
    loadingError,
    loadingProgress,
    isLoadingProjects,
    loadProjectsError,
    loadData,
    cancelLoad,
    fetchProjectsOnly,
    exportData,
    importData,
    clearData
  }
})
