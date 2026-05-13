<template>
  <v-data-table
    :headers="headers"
    :items="rows"
    density="compact"
    :items-per-page="25"
    :items-per-page-options="[10, 25, 50, 100]"
    class="blame-table"
  >
    <!-- Caminho -->
    <template #item.path="{ item }">
      <div class="d-flex align-center gap-2">
        <v-badge
          v-if="item.isNew"
          color="error"
          content="NOVO"
          inline
        />
        <span class="text-caption font-mono text-no-wrap">{{ item.path }}</span>
      </div>
    </template>

    <!-- Projeto (optional column) -->
    <template v-if="showProject" #item.projectName="{ item }">
      <span class="text-caption">{{ item.projectName }}</span>
    </template>

    <!-- Data -->
    <template #item.date="{ item }">
      <span class="text-caption text-no-wrap">{{ formatDate(item.date) }}</span>
    </template>

    <!-- Mensagem -->
    <template #item.message="{ item }">
      <span class="text-caption">{{ truncate(item.message) }}</span>
    </template>

    <!-- Hash -->
    <template #item.shortId="{ item }">
      <code class="text-caption">{{ item.shortId }}</code>
    </template>

    <!-- Autor -->
    <template #item.author="{ item }">
      <span class="text-caption">{{ item.author }}</span>
    </template>

    <!-- Ações -->
    <template #item.actions="{ item }">
      <div class="d-flex align-center gap-1">
        <v-btn
          v-if="item.commitUrl"
          icon
          size="x-small"
          variant="text"
          :href="item.commitUrl"
          target="_blank"
          rel="noopener noreferrer"
        >
          <v-icon size="16">mdi-source-commit</v-icon>
          <v-tooltip activator="parent">Ver commit no GitLab</v-tooltip>
        </v-btn>
        <v-btn
          icon
          size="x-small"
          variant="text"
          :href="item.fileHistoryUrl"
          target="_blank"
          rel="noopener noreferrer"
        >
          <v-icon size="16">mdi-history</v-icon>
          <v-tooltip activator="parent">Histórico do arquivo no GitLab</v-tooltip>
        </v-btn>
      </div>
    </template>

    <!-- No data -->
    <template #no-data>
      <div class="text-caption text-disabled pa-4 text-center">
        Nenhum dado disponível para os filtros selecionados.
      </div>
    </template>
  </v-data-table>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { BlameEntry } from '@/stores/blame'
import { formatDate, truncate } from '@/composables/useBlame'

const props = defineProps<{
  entries: BlameEntry[]
  showProject?: boolean
}>()

interface TableRow {
  path: string
  projectName: string
  isNew: boolean
  date: string | null
  message: string
  shortId: string
  author: string
  commitUrl: string | null
  fileHistoryUrl: string
}

const headers = computed(() => {
  const base = [
    { title: 'Caminho', key: 'path', sortable: true },
    { title: 'Data', key: 'date', sortable: true },
    { title: 'Mensagem', key: 'message', sortable: false },
    { title: 'Hash', key: 'shortId', sortable: false },
    { title: 'Autor', key: 'author', sortable: true },
    { title: 'Ações', key: 'actions', sortable: false, align: 'center' as const }
  ]
  if (props.showProject) {
    base.splice(1, 0, { title: 'Projeto', key: 'projectName', sortable: true })
  }
  return base
})

const rows = computed((): TableRow[] =>
  props.entries.map(e => ({
    path: e.path,
    projectName: e.projectName,
    isNew: e.isNew,
    date: e.commit?.committed_date ?? null,
    message: e.commit?.message ?? '—',
    shortId: e.commit?.short_id ?? '—',
    author: e.commit?.author_name ?? '—',
    commitUrl: e.commit?.web_url ?? null,
    fileHistoryUrl: e.fileHistoryUrl
  }))
)
</script>

<style scoped>
.font-mono {
  font-family: monospace;
}
.blame-table :deep(td) {
  vertical-align: middle;
}
</style>
