<template>
  <div>
    <!-- Project not found -->
    <EmptyState
      v-if="!project"
      icon="mdi-alert-circle-outline"
      title="Projeto não encontrado"
      message="Este projeto não está nos dados carregados."
    >
      <v-btn :to="{ name: 'dashboard' }" variant="tonal">Voltar ao Dashboard</v-btn>
    </EmptyState>

    <template v-else>
      <!-- Header -->
      <div class="d-flex align-center gap-3 mb-4">
        <v-btn :to="{ name: 'dashboard' }" variant="text" icon="mdi-arrow-left" />
        <div>
          <div class="text-h6 font-weight-bold">{{ project.name }}</div>
          <div class="text-caption text-disabled">{{ project.path_with_namespace }}</div>
        </div>
        <v-spacer />
        <v-btn
          :href="project.web_url"
          target="_blank"
          rel="noopener noreferrer"
          variant="tonal"
          size="small"
          prepend-icon="mdi-open-in-new"
        >
          Abrir no GitLab
        </v-btn>
      </div>

      <!-- Branch filter -->
      <v-card rounded="lg" class="mb-4" variant="outlined">
        <v-card-text class="pa-3">
          <v-row dense align="center">
            <v-col cols="auto">
              <v-icon size="18">mdi-source-branch</v-icon>
            </v-col>
            <v-col cols="12" sm="4">
              <v-autocomplete
                v-model="selectedBranches"
                :items="availableBranches"
                label="Branch"
                multiple
                chips
                closable-chips
                density="compact"
                variant="outlined"
                hide-details
                clearable
              />
            </v-col>
            <v-col cols="12" sm="3">
              <v-select
                v-model="selectedStatuses"
                :items="statusItems"
                label="Status"
                multiple
                chips
                closable-chips
                density="compact"
                variant="outlined"
                hide-details
                clearable
              />
            </v-col>
            <v-col>
              <v-btn size="small" variant="text" @click="selectedBranches = []; selectedStatuses = []">
                Limpar
              </v-btn>
            </v-col>
          </v-row>
        </v-card-text>
      </v-card>

      <!-- KPIs -->
      <v-row dense class="mb-4">
        <v-col cols="6" sm="3">
          <MetricCard
            label="Total de Pipelines"
            :value="metrics.summaryStats.value.total"
            icon="mdi-pipe"
            color="info"
          />
        </v-col>
        <v-col cols="6" sm="3">
          <MetricCard
            label="Pipelines com Falha"
            :value="metrics.summaryStats.value.failed"
            icon="mdi-close-circle-outline"
            color="error"
          />
        </v-col>
        <v-col cols="6" sm="3">
          <MetricCard
            label="Taxa de Sucesso"
            :value="metrics.summaryStats.value.successRate"
            icon="mdi-check-circle-outline"
            color="success"
            format="percent"
          />
        </v-col>
        <v-col cols="6" sm="3">
          <MetricCard
            label="Duração Média"
            :value="metrics.summaryStats.value.avgDurationSec"
            icon="mdi-timer-outline"
            color="warning"
            format="duration"
          />
        </v-col>
      </v-row>

      <!-- Trend -->
      <v-row dense class="mb-4">
        <v-col cols="12">
          <ChartFailuresTrend :data="metrics.failuresTrend.value" />
        </v-col>
      </v-row>

      <!-- Stage + Reasons -->
      <v-row dense class="mb-4">
        <v-col cols="12" md="5">
          <ChartFailuresByStage :data="metrics.failuresByStage.value" />
        </v-col>
        <v-col cols="12" md="7">
          <ChartFailureReasons :data="metrics.failureReasons.value" />
        </v-col>
      </v-row>

      <!-- Retries -->
      <v-row dense class="mb-4">
        <v-col cols="12">
          <TableRetries :data="metrics.retryStats.value" />
        </v-col>
      </v-row>

      <!-- Pipeline history table -->
      <v-row dense>
        <v-col cols="12">
          <v-card rounded="lg" variant="tonal" color="surface">
            <v-card-title class="pa-4 pb-2 text-body-1 font-weight-medium text-high-emphasis">
              <v-icon start size="18">mdi-history</v-icon>
              Histórico de Pipelines
            </v-card-title>
            <v-card-text class="pa-0">
              <v-data-table
                :headers="pipelineHeaders"
                :items="metrics.allPipelines.value"
                :items-per-page="20"
                density="compact"
                hover
                :sort-by="[{ key: 'created_at', order: 'desc' }]"
              >
                <template #item.status="{ item }">
                  <v-chip
                    :color="statusColor(item.status)"
                    size="x-small"
                    variant="tonal"
                  >
                    {{ statusLabel(item.status) }}
                  </v-chip>
                </template>

                <template #item.ref="{ item }">
                  <v-chip size="x-small" prepend-icon="mdi-source-branch" variant="outlined">
                    {{ item.ref }}
                  </v-chip>
                </template>

                <template #item.created_at="{ item }">
                  <span class="text-caption">{{ formatDate(item.created_at) }}</span>
                </template>

                <template #item.duration="{ item }">
                  <span class="text-caption">{{ pipelineDuration(item) != null ? formatDuration(pipelineDuration(item)!) : '—' }}</span>
                </template>

                <template #item.actions="{ item }">
                  <v-btn
                    :href="item.web_url"
                    target="_blank"
                    rel="noopener noreferrer"
                    icon="mdi-open-in-new"
                    size="x-small"
                    variant="text"
                  />
                </template>
              </v-data-table>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useGitLabStore } from '@/stores/gitlab'
import { useMetrics } from '@/composables/useMetrics'
import { PIPELINE_STATUS_COLORS, PIPELINE_STATUS_LABELS, type GitLabPipeline } from '@/types/gitlab'
import MetricCard from '@/components/common/MetricCard.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import ChartFailuresTrend from '@/components/charts/ChartFailuresTrend.vue'
import ChartFailuresByStage from '@/components/charts/ChartFailuresByStage.vue'
import ChartFailureReasons from '@/components/charts/ChartFailureReasons.vue'
import TableRetries from '@/components/charts/TableRetries.vue'

const route = useRoute()
const store = useGitLabStore()

const projectId = computed(() => Number(route.params.id))
const project = computed(() => store.projects.find(p => p.id === projectId.value))

const selectedBranches = ref<string[]>([])
const selectedStatuses = ref<string[]>([])

const filtersRef = computed(() => ({
  projectIds: [projectId.value],
  branches: selectedBranches.value,
  statuses: selectedStatuses.value
}))

const metrics = useMetrics(filtersRef)

const availableBranches = computed(() => metrics.availableBranches.value)

const statusItems = [
  { title: 'Falhou', value: 'failed' },
  { title: 'Sucesso', value: 'success' },
  { title: 'Em execução', value: 'running' },
  { title: 'Cancelada', value: 'canceled' }
]

const pipelineHeaders = [
  { title: 'ID', key: 'id', sortable: true },
  { title: 'Status', key: 'status', sortable: true },
  { title: 'Branch', key: 'ref', sortable: true },
  { title: 'Origem', key: 'source', sortable: true },
  { title: 'Criada em', key: 'created_at', sortable: true },
  { title: 'Duração', key: 'duration', sortable: true },
  { title: '', key: 'actions', sortable: false }
]

const FINISHED_STATUSES = ['success', 'failed', 'canceled']
function pipelineDuration(p: GitLabPipeline): number | null {
  const jobs = store.jobs[p.id]
  if (jobs && jobs.length > 0) {
    const sum = jobs.reduce((acc, j) => acc + (j.duration ?? 0), 0)
    if (sum > 0) return Math.round(sum)
  }
  if (p.duration != null) return p.duration
  if (!FINISHED_STATUSES.includes(p.status)) return null
  if (p.finished_at && p.started_at) {
    const ms = new Date(p.finished_at).getTime() - new Date(p.started_at).getTime()
    if (ms > 0) return Math.round(ms / 1000)
  }
  const ms = new Date(p.updated_at).getTime() - new Date(p.created_at).getTime()
  return ms > 0 ? Math.round(ms / 1000) : null
}

function statusColor(s: string): string {
  return PIPELINE_STATUS_COLORS[s] ?? 'default'
}
function statusLabel(s: string): string {
  return PIPELINE_STATUS_LABELS[s] ?? s
}
function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}
function formatDuration(secs: number): string {
  if (secs < 60) return `${secs}s`
  const m = Math.floor(secs / 60)
  return m < 60 ? `${m}m ${secs % 60}s` : `${Math.floor(m / 60)}h ${m % 60}m`
}
</script>
