import { ref, computed } from 'vue'
import type { BlameEntry } from '@/stores/blame'

export type BlameView = 'byProject' | 'timeline'

export function useBlame(entries: () => BlameEntry[]) {
  const view = ref<BlameView>('byProject')
  const dateStart = ref('')
  const dateEnd = ref('')
  const filterProjectId = ref<number | null>(null)

  function setView(v: BlameView) {
    view.value = v
  }

  function toggleView() {
    view.value = view.value === 'byProject' ? 'timeline' : 'byProject'
  }

  const filteredEntries = computed((): BlameEntry[] => {
    let list = entries()

    if (filterProjectId.value !== null) {
      list = list.filter(e => e.projectId === filterProjectId.value)
    }

    if (dateStart.value) {
      list = list.filter(e => {
        const d = e.commit?.committed_date?.slice(0, 10) ?? ''
        return d >= dateStart.value
      })
    }

    if (dateEnd.value) {
      list = list.filter(e => {
        const d = e.commit?.committed_date?.slice(0, 10) ?? ''
        return !d || d <= dateEnd.value
      })
    }

    return list
  })

  /** Timeline: all entries sorted newest-first (entries without commit go last) */
  const timelineSorted = computed((): BlameEntry[] =>
    [...filteredEntries.value].sort((a, b) => {
      const da = a.commit?.committed_date ?? ''
      const db = b.commit?.committed_date ?? ''
      if (!da && !db) return 0
      if (!da) return 1
      if (!db) return -1
      return db.localeCompare(da)
    })
  )

  /** By-project: entries grouped by projectId */
  const byProject = computed((): Record<number, BlameEntry[]> => {
    const groups: Record<number, BlameEntry[]> = {}
    for (const e of filteredEntries.value) {
      if (!groups[e.projectId]) groups[e.projectId] = []
      groups[e.projectId].push(e)
    }
    // Sort each group newest-first
    for (const id in groups) {
      groups[id].sort((a, b) => {
        const da = a.commit?.committed_date ?? ''
        const db = b.commit?.committed_date ?? ''
        return db.localeCompare(da)
      })
    }
    return groups
  })

  /** Distinct project ids present in the current (unfiltered) entries */
  const projectIds = computed((): number[] => {
    const ids = new Set(entries().map(e => e.projectId))
    return Array.from(ids)
  })

  return {
    view,
    dateStart,
    dateEnd,
    filterProjectId,
    setView,
    toggleView,
    filteredEntries,
    timelineSorted,
    byProject,
    projectIds
  }
}

// ─── Formatting helpers (exported for use in template) ───────────────────────

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

export function truncate(str: string, max = 72): string {
  return str.length > max ? str.slice(0, max - 1) + '…' : str
}
