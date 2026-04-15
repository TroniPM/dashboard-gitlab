<template>
  <v-card rounded="lg" variant="tonal" color="surface">
    <v-card-title class="pa-4 pb-2 text-body-1 font-weight-medium">
      <v-icon start size="18">mdi-autorenew</v-icon>
      Jobs com Mais Retries
    </v-card-title>

    <v-card-text v-if="data.length === 0" class="text-center text-disabled py-8">
      Nenhum retry detectado.
      <div class="text-caption mt-1">
        Para detectar retries é necessário carregar jobs de todas as pipelines.
      </div>
    </v-card-text>

    <template v-else>
      <v-card-text class="pa-0">
        <v-data-table
          :headers="headers"
          :items="data"
          :items-per-page="10"
          density="compact"
          hover
        >
          <template #item.jobName="{ item }">
            <span class="font-weight-medium">{{ item.jobName }}</span>
          </template>

          <template #item.totalRetries="{ item }">
            <v-chip color="error" size="small" variant="tonal">
              {{ item.totalRetries }}
            </v-chip>
          </template>

          <template #item.affectedPipelines="{ item }">
            <v-chip color="warning" size="small" variant="tonal">
              {{ item.affectedPipelines }}
            </v-chip>
          </template>

          <template #item.failureReasons="{ item }">
            <div class="d-flex flex-wrap gap-1 py-1">
              <v-chip
                v-for="reason in item.failureReasons"
                :key="reason"
                size="x-small"
                color="surface-variant"
              >
                {{ reasonLabel(reason) }}
              </v-chip>
              <span v-if="item.failureReasons.length === 0" class="text-disabled text-caption">—</span>
            </div>
          </template>
        </v-data-table>
      </v-card-text>
    </template>
  </v-card>
</template>

<script setup lang="ts">
import { FAILURE_REASON_LABELS } from '@/types/gitlab'
import type { RetryStats } from '@/types/gitlab'

defineProps<{
  data: RetryStats[]
  showProject?: boolean
}>()

const headers = [
  { title: 'Job', key: 'jobName', sortable: true },
  { title: 'Projeto', key: 'projectName', sortable: true },
  { title: 'Total Retries', key: 'totalRetries', sortable: true },
  { title: 'Pipelines Afetadas', key: 'affectedPipelines', sortable: true },
  { title: 'Motivos', key: 'failureReasons', sortable: false }
]

function reasonLabel(r: string): string {
  return FAILURE_REASON_LABELS[r] ?? r
}
</script>
