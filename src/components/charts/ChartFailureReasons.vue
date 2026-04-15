<template>
  <v-card rounded="lg" variant="tonal" color="surface">
    <v-card-title class="pa-4 pb-0 text-body-1 font-weight-medium">
      <v-icon start size="18">mdi-alert-rhombus-outline</v-icon>
      Motivos de Falha
    </v-card-title>

    <v-card-text v-if="data.length === 0" class="text-center text-disabled py-8">
      Sem dados de jobs disponíveis.
    </v-card-text>

    <v-card-text v-else class="pa-2">
      <apexchart
        type="bar"
        :height="chartHeight"
        :options="chartOptions"
        :series="series"
      />
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useTheme } from 'vuetify'
import { FAILURE_REASON_LABELS } from '@/types/gitlab'

const props = defineProps<{
  data: Array<{ reason: string; count: number }>
}>()

const vuetifyTheme = useTheme()
const isDark = computed(() => vuetifyTheme.global.name.value === 'dark')

const chartHeight = computed(() => Math.max(200, props.data.length * 38 + 60))

const series = computed(() => [
  { name: 'Ocorrências', data: props.data.map(d => d.count) }
])

const chartOptions = computed(() => ({
  chart: {
    type: 'bar',
    background: 'transparent',
    toolbar: { show: false },
    animations: { enabled: true }
  },
  theme: { mode: isDark.value ? 'dark' : 'light' },
  colors: ['#f44336'],
  plotOptions: { bar: { horizontal: true, borderRadius: 4 } },
  dataLabels: { enabled: true, style: { fontSize: '11px' } },
  xaxis: {
    categories: props.data.map(d => FAILURE_REASON_LABELS[d.reason] ?? d.reason),
    labels: { formatter: (v: number) => Math.round(v).toString() }
  },
  yaxis: { labels: { maxWidth: 200 } },
  grid: { borderColor: isDark.value ? '#2a2a3e' : '#e0e0e0' },
  tooltip: { y: { formatter: (v: number) => `${v} jobs` } }
}))
</script>
