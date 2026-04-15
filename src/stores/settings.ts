import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import Cookies from 'js-cookie'

const LS_KEY = 'gl_dashboard_settings'
const COOKIE_TOKEN = 'gl_token'

interface PersistedSettings {
  gitlabUrl: string
  dateRangeStart: string
  dateRangeEnd: string
  selectedProjectIds: number[]
  loadJobsForAllPipelines: boolean
  maxPipelinesForJobs: number
  onlyProjectsWithData: boolean
}

function defaultDates(): { start: string; end: string } {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - 30)
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0]
  }
}

export const useSettingsStore = defineStore('settings', () => {
  const saved: Partial<PersistedSettings> = (() => {
    try {
      return JSON.parse(localStorage.getItem(LS_KEY) ?? '{}')
    } catch {
      return {}
    }
  })()

  const dates = defaultDates()

  const gitlabUrl = ref(saved.gitlabUrl ?? '')
  const token = ref(Cookies.get(COOKIE_TOKEN) ?? '')
  const dateRangeStart = ref(saved.dateRangeStart ?? dates.start)
  const dateRangeEnd = ref(saved.dateRangeEnd ?? dates.end)
  const selectedProjectIds = ref<number[]>(saved.selectedProjectIds ?? [])
  const loadJobsForAllPipelines = ref(saved.loadJobsForAllPipelines ?? false)
  const maxPipelinesForJobs = ref(saved.maxPipelinesForJobs ?? 500)
  const onlyProjectsWithData = ref(saved.onlyProjectsWithData ?? true)

  const isConfigured = computed(() => !!(gitlabUrl.value.trim() && token.value.trim()))

  function save() {
    const data: PersistedSettings = {
      gitlabUrl: gitlabUrl.value,
      dateRangeStart: dateRangeStart.value,
      dateRangeEnd: dateRangeEnd.value,
      selectedProjectIds: selectedProjectIds.value,
      loadJobsForAllPipelines: loadJobsForAllPipelines.value,
      maxPipelinesForJobs: maxPipelinesForJobs.value,
      onlyProjectsWithData: onlyProjectsWithData.value
    }
    localStorage.setItem(LS_KEY, JSON.stringify(data))
    if (token.value) {
      Cookies.set(COOKIE_TOKEN, token.value, { expires: 365, sameSite: 'strict' })
    } else {
      Cookies.remove(COOKIE_TOKEN)
    }
  }

  function setQuickRange(days: number) {
    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - days)
    dateRangeEnd.value = end.toISOString().split('T')[0]
    dateRangeStart.value = start.toISOString().split('T')[0]
  }

  return {
    gitlabUrl,
    token,
    dateRangeStart,
    dateRangeEnd,
    selectedProjectIds,
    loadJobsForAllPipelines,
    maxPipelinesForJobs,
    onlyProjectsWithData,
    isConfigured,
    save,
    setQuickRange
  }
})
