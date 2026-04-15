<template>
  <div>
    <!-- Empty state -->
    <EmptyState
      v-if="!store.projects.length && !store.isLoading"
      icon="mdi-database-off-outline"
      title="Nenhum dado carregado"
      message="Vá até Configurações e clique em &quot;Carregar Dados&quot;."
    >
      <v-btn color="primary" :to="{ name: 'settings' }" prepend-icon="mdi-cog">
        Configurações
      </v-btn>
    </EmptyState>

    <template v-else>
      <!-- Filters -->
      <v-card rounded="lg" class="mb-4" variant="outlined">
        <v-card-title
          class="pa-3 text-body-2 font-weight-medium cursor-pointer d-flex align-center"
          @click="filtersOpen = !filtersOpen"
        >
          <v-icon start size="18">mdi-filter-outline</v-icon>
          Filtros
          <v-spacer />
          <v-icon :icon="filtersOpen ? 'mdi-chevron-up' : 'mdi-chevron-down'" size="18" />
        </v-card-title>
        <v-expand-transition>
          <v-card-text v-show="filtersOpen" class="pt-0">
            <v-row dense>
              <v-col cols="12" md="4">
                <v-autocomplete
                  v-model="filters.projectIds"
                  :items="projectItems"
                  label="Projetos"
                  multiple
                  chips
                  closable-chips
                  density="compact"
                  variant="outlined"
                  hide-details
                  clearable
                />
              </v-col>
              <v-col cols="12" md="3">
                <v-autocomplete
                  v-model="filters.branches"
                  :items="metrics.availableBranches.value"
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
              <v-col cols="12" md="3">
                <v-select
                  v-model="filters.statuses"
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
              <v-col cols="12" md="2" class="d-flex align-center gap-2">
                <v-btn size="small" variant="tonal" @click="resetFilters">
                  <v-icon start>mdi-filter-off</v-icon> Limpar
                </v-btn>
              </v-col>
            </v-row>
          </v-card-text>
        </v-expand-transition>
      </v-card>

      <!-- KPI Row -->
      <v-row dense class="mb-3">
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

      <!-- Additional KPIs -->
      <v-row dense class="mb-4">
        <v-col cols="6" sm="3">
          <MetricCard
            label="Em Execução"
            :value="metrics.summaryStats.value.running"
            icon="mdi-play-circle-outline"
            color="primary"
          />
        </v-col>
        <v-col cols="6" sm="3">
          <MetricCard
            label="Canceladas"
            :value="metrics.summaryStats.value.canceled"
            icon="mdi-cancel"
            color="default"
          />
        </v-col>
        <v-col cols="6" sm="3">
          <MetricCard
            label="Taxa de Falha"
            :value="metrics.summaryStats.value.failureRate"
            icon="mdi-trending-down"
            color="error"
            format="percent"
          />
        </v-col>
        <v-col cols="6" sm="3">
          <MetricCard
            label="Jobs com Retry"
            :value="metrics.retryStats.value.reduce((s, r) => s + r.totalRetries, 0)"
            icon="mdi-autorenew"
            color="warning"
          />
        </v-col>
      </v-row>

      <!-- Trend chart -->
      <v-row dense class="mb-4">
        <v-col cols="12">
          <ChartFailuresTrend :data="metrics.failuresTrend.value" />
        </v-col>
      </v-row>

      <!-- Failures by project + by stage -->
      <v-row dense class="mb-4">
        <v-col cols="12" md="7">
          <ChartFailuresByProject :data="metrics.failuresByProject.value" />
        </v-col>
        <v-col cols="12" md="5">
          <ChartFailuresByStage :data="metrics.failuresByStage.value" />
        </v-col>
      </v-row>

      <!-- Failure reasons + Retries table -->
      <v-row dense class="mb-4">
        <v-col cols="12" md="5">
          <ChartFailureReasons :data="metrics.failureReasons.value" />
        </v-col>
        <v-col cols="12" md="7">
          <TableRetries :data="metrics.retryStats.value" :show-project="true" />
        </v-col>
      </v-row>

      <!-- Pipeline source breakdown -->
      <v-row dense>
        <v-col cols="12">
          <v-card rounded="lg" variant="tonal" color="surface">
            <v-card-title class="pa-4 pb-2 text-body-1 font-weight-medium">
              <v-icon start size="18">mdi-source-fork</v-icon>
              Falhas por Origem de Pipeline
            </v-card-title>
            <v-card-text>
              <div v-if="metrics.sourceDistribution.value.length === 0" class="text-center text-disabled py-4">
                Sem dados.
              </div>
              <div v-else class="d-flex flex-wrap gap-2">
                <v-chip
                  v-for="s in metrics.sourceDistribution.value"
                  :key="s.source"
                  color="error"
                  variant="tonal"
                >
                  {{ sourceLabel(s.source) }}: <strong class="ml-1">{{ s.count }}</strong>
                </v-chip>
              </div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </template>
  </div>
</template>

<script setup lang="ts">
import { reactive, computed, ref } from 'vue'
import { useGitLabStore } from '@/stores/gitlab'
import { useMetrics } from '@/composables/useMetrics'
import MetricCard from '@/components/common/MetricCard.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import ChartFailuresTrend from '@/components/charts/ChartFailuresTrend.vue'
import ChartFailuresByProject from '@/components/charts/ChartFailuresByProject.vue'
import ChartFailuresByStage from '@/components/charts/ChartFailuresByStage.vue'
import ChartFailureReasons from '@/components/charts/ChartFailureReasons.vue'
import TableRetries from '@/components/charts/TableRetries.vue'

const store = useGitLabStore()
const filtersOpen = ref(false)

const filters = reactive({
  projectIds: [] as number[],
  branches: [] as string[],
  statuses: [] as string[]
})

const filtersRef = computed(() => ({
  projectIds: filters.projectIds,
  branches: filters.branches,
  statuses: filters.statuses
}))

const metrics = useMetrics(filtersRef)

const projectItems = computed(() =>
  store.projects.map(p => ({ title: p.name, value: p.id }))
)

const statusItems = [
  { title: 'Falhou', value: 'failed' },
  { title: 'Sucesso', value: 'success' },
  { title: 'Em execução', value: 'running' },
  { title: 'Cancelada', value: 'canceled' },
  { title: 'Ignorada', value: 'skipped' }
]

const SOURCE_LABELS: Record<string, string> = {
  push: 'Push',
  web: 'Web UI',
  trigger: 'Trigger',
  schedule: 'Agendamento',
  api: 'API',
  external: 'Externo',
  pipeline: 'Pipeline (downstream)',
  chat: 'Chat',
  merge_request_event: 'Merge Request',
  external_pull_request_event: 'Pull Request externo',
  parent_pipeline: 'Pipeline pai',
  unknown: 'Desconhecido'
}

function sourceLabel(src: string): string {
  return SOURCE_LABELS[src] ?? src
}

function resetFilters() {
  filters.projectIds = []
  filters.branches = []
  filters.statuses = []
}
</script>
