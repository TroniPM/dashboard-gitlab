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

const LS_DATA_KEY = 'gl_dashboard_data' // kept only for one-time migration
const IDB_DB_NAME = 'gl_dashboard'
const IDB_DB_VERSION = 1
const IDB_STORE = 'cache'
const IDB_KEY = 'data'

// ─── IndexedDB Helpers ───────────────────────────────────────────────────────

function _openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_DB_NAME, IDB_DB_VERSION)
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function _idbGet<T>(key: string): Promise<T | undefined> {
  const db = await _openIDB()
  return new Promise((resolve, reject) => {
    const req = db.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE).get(key)
    req.onsuccess = () => resolve(req.result as T | undefined)
    req.onerror = () => reject(req.error)
  })
}

async function _idbSet(key: string, value: unknown): Promise<void> {
  const db = await _openIDB()
  return new Promise((resolve, reject) => {
    const req = db.transaction(IDB_STORE, 'readwrite').objectStore(IDB_STORE).put(value, key)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

async function _idbDelete(key: string): Promise<void> {
  const db = await _openIDB()
  return new Promise((resolve, reject) => {
    const req = db.transaction(IDB_STORE, 'readwrite').objectStore(IDB_STORE).delete(key)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

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

  async function loadFromCache(): Promise<boolean> {
    try {
      // One-time migration from localStorage → IndexedDB
      const oldRaw = localStorage.getItem(LS_DATA_KEY)
      if (oldRaw) {
        try {
          const oldData = JSON.parse(oldRaw) as CachedData
          await _idbSet(IDB_KEY, oldData)
          localStorage.removeItem(LS_DATA_KEY)
          console.info('[GitLab Dashboard] Dados migrados do localStorage para IndexedDB')
        } catch { /* ignore migration errors */ }
      }

      const data = await _idbGet<CachedData>(IDB_KEY)
      if (!data) return false
      projects.value = data.projects ?? []
      pipelines.value = data.pipelines ?? {}
      jobs.value = data.jobs ?? {}
      lastFetched.value = data.lastFetched ?? null
      return true
    } catch {
      return false
    }
  }

  async function saveToCache() {
    const data: CachedData = {
      projects: projects.value,
      pipelines: pipelines.value,
      jobs: jobs.value,
      lastFetched: new Date().toISOString(),
      dateRangeStart: settings.dateRangeStart,
      dateRangeEnd: settings.dateRangeEnd
    }
    try {
      await _idbSet(IDB_KEY, data)
      lastFetched.value = data.lastFetched
      console.info('[GitLab Dashboard] Cache salvo no IndexedDB')
    } catch (err) {
      loadingError.value = 'Erro ao salvar cache no IndexedDB: ' + (err as Error).message
    }
  }

  // ─── Merge Helper ────────────────────────────────────────────────────────

  function mergeData(
    existingPipelines: Record<number, GitLabPipeline[]>,
    existingJobs: Record<number, GitLabJob[]>,
    newPipelines: Record<number, GitLabPipeline[]>,
    newJobs: Record<number, GitLabJob[]>
  ): { mergedPipelines: Record<number, GitLabPipeline[]>; mergedJobs: Record<number, GitLabJob[]> } {
    const mergedPipelines: Record<number, GitLabPipeline[]> = { ...existingPipelines }
    for (const [projectIdStr, pipelineList] of Object.entries(newPipelines)) {
      const projectId = Number(projectIdStr)
      const existing = mergedPipelines[projectId] ?? []
      const existingIds = new Set(existing.map(p => p.id))
      const toAdd = pipelineList.filter(p => !existingIds.has(p.id))
      mergedPipelines[projectId] = [...existing, ...toAdd]
    }

    const mergedJobs: Record<number, GitLabJob[]> = { ...existingJobs }
    for (const [pipelineIdStr, jobList] of Object.entries(newJobs)) {
      const pipelineId = Number(pipelineIdStr)
      const existing = mergedJobs[pipelineId] ?? []
      const existingIds = new Set(existing.map(j => j.id))
      const toAdd = jobList.filter(j => !existingIds.has(j.id))
      mergedJobs[pipelineId] = [...existing, ...toAdd]
    }

    return { mergedPipelines, mergedJobs }
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

  async function importData(raw: string): Promise<{ ok: boolean; error?: string; added?: { projects: number; pipelines: number; jobs: number } }> {
    try {
      const data = JSON.parse(raw) as CachedData
      if (!Array.isArray(data.projects)) throw new Error('Formato inválido')

      // Merge projects (by id, keep existing, add new)
      const existingProjectIds = new Set(projects.value.map(p => p.id))
      const newProjects = data.projects.filter(p => !existingProjectIds.has(p.id))
      projects.value = [...projects.value, ...newProjects]

      // Merge pipelines and jobs without duplicating
      const incomingPipelines = data.pipelines ?? {}
      const incomingJobs = data.jobs ?? {}
      const existingPipelineCount = Object.values(pipelines.value).reduce((s, arr) => s + arr.length, 0)
      const existingJobCount = Object.values(jobs.value).reduce((s, arr) => s + arr.length, 0)

      const { mergedPipelines, mergedJobs } = mergeData(
        pipelines.value, jobs.value, incomingPipelines, incomingJobs
      )
      pipelines.value = mergedPipelines
      jobs.value = mergedJobs

      const addedPipelines = Object.values(mergedPipelines).reduce((s, arr) => s + arr.length, 0) - existingPipelineCount
      const addedJobs = Object.values(mergedJobs).reduce((s, arr) => s + arr.length, 0) - existingJobCount

      // Keep most recent lastFetched
      if (data.lastFetched && (!lastFetched.value || data.lastFetched > lastFetched.value)) {
        lastFetched.value = data.lastFetched
      }

      if (data.dateRangeStart) settings.dateRangeStart = data.dateRangeStart
      if (data.dateRangeEnd) settings.dateRangeEnd = data.dateRangeEnd
      await saveToCache()
      return { ok: true, added: { projects: newProjects.length, pipelines: addedPipelines, jobs: addedJobs } }
    } catch (err: unknown) {
      return { ok: false, error: (err as Error).message }
    }
  }

  function clearData() {
    projects.value = []
    pipelines.value = {}
    jobs.value = {}
    lastFetched.value = null
    _idbDelete(IDB_KEY) // fire-and-forget
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
      // Merge projects (keep existing that aren't in new list, add/update newly fetched)
      const fetchedProjectIds = new Set(projectList.map(p => p.id))
      const keptProjects = projects.value.filter(p => !fetchedProjectIds.has(p.id))
      projects.value = [...keptProjects, ...projectList]

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
      // Merge new pipelines into existing (deduplicate by pipeline id per project)
      const { mergedPipelines } = mergeData(pipelines.value, jobs.value, newPipelines, {})
      pipelines.value = mergedPipelines

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

      const fetchedJobs = await fetchJobsBatched(
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

      // Merge new jobs into existing (deduplicate by job id per pipeline)
      const { mergedJobs } = mergeData({}, jobs.value, {}, fetchedJobs)
      jobs.value = mergedJobs

      if (!signal.aborted) {
        loadingProgress.value = { phase: 'done', message: 'Concluído!', current: 1, total: 1 }
        await saveToCache()
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
      await saveToCache()
      return true
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } }; message?: string }
      loadProjectsError.value = axiosErr.response?.data?.message ?? axiosErr.message ?? 'Erro ao carregar projetos'
      return false
    } finally {
      isLoadingProjects.value = false
    }
  }

  // Init from cache on store creation (async, fire-and-forget)
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
