<template>
  <v-card rounded="lg" variant="tonal" color="surface">
    <v-card-title class="pa-4 pb-2 text-body-1 font-weight-medium text-high-emphasis">
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
          :item-value="itemKey"
          density="compact"
          hover
          expand-on-click
          show-expand
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

          <template #expanded-row="{ item, columns }">
            <tr>
              <td :colspan="columns.length" class="pa-0">
                <v-table density="compact" class="retry-expanded-table rounded-0">
                  <thead>
                    <tr>
                      <th class="text-caption font-weight-medium retry-expanded-th">Status</th>
                      <th class="text-caption font-weight-medium retry-expanded-th">Job</th>
                      <th class="text-caption font-weight-medium retry-expanded-th">Pipeline</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="inst in item.jobInstances" :key="inst.jobId" class="retry-expanded-row">
                      <td class="retry-expanded-td">
                        <v-chip :color="jobStatusColor(inst.status)" size="x-small" variant="tonal">
                          {{ inst.status }}
                        </v-chip>
                      </td>
                      <td class="retry-expanded-td">
                        <a
                          :href="inst.jobUrl"
                          target="_blank"
                          rel="noopener noreferrer"
                          class="text-caption text-decoration-none retry-link"
                          @click.stop
                        >
                          #{{ inst.jobId }}
                          <v-icon size="12" class="ml-1">mdi-open-in-new</v-icon>
                        </a>
                      </td>
                      <td class="retry-expanded-td">
                        <a
                          :href="inst.pipelineUrl"
                          target="_blank"
                          rel="noopener noreferrer"
                          class="text-caption text-decoration-none retry-link"
                          @click.stop
                        >
                          Pipeline #{{ inst.pipelineIid }}
                          <v-icon size="12" class="ml-1">mdi-open-in-new</v-icon>
                        </a>
                      </td>
                    </tr>
                  </tbody>
                </v-table>
              </td>
            </tr>
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

function itemKey(item: RetryStats): string {
  return `${item.projectId}::${item.jobName}`
}

function reasonLabel(r: string): string {
  return FAILURE_REASON_LABELS[r] ?? r
}

function jobStatusColor(status: string): string {
  const colors: Record<string, string> = {
    success: 'success',
    failed: 'error',
    running: 'info',
    pending: 'warning',
    canceled: 'default',
    skipped: 'default',
    created: 'default',
    manual: 'secondary',
    waiting_for_resource: 'warning',
    preparing: 'warning'
  }
  return colors[status] ?? 'default'
}
</script>

<style scoped>
/* Expanded sub-table: uses Vuetify CSS vars so it adapts to dark/light mode */
/*.retry-expanded-table {
  background: rgb(var(--v-theme-surface-variant)) !important;
}*/

.retry-expanded-table :deep(table) {
  background: transparent !important;
}

.retry-expanded-th {
  color: rgba(var(--v-theme-on-surface), 0.6) !important;
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)) !important;
}

.retry-expanded-td {
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)) !important;
}

.retry-expanded-row:last-child .retry-expanded-td {
  border-bottom: none !important;
}

.retry-link {
  color: rgb(var(--v-theme-primary)) !important;
}

.retry-link:hover {
  opacity: 0.8;
}

/* Indentation to visually link the expanded content to its parent row */
.retry-expanded-table :deep(thead tr th:first-child),
.retry-expanded-table :deep(tbody tr td:first-child) {
  padding-left: 48px !important;
}
</style>
