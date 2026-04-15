<template>
  <v-card rounded="lg" variant="tonal" color="surface">
    <v-card-title class="pa-4 pb-0 text-body-1 font-weight-medium text-high-emphasis">
      <v-icon start size="18">mdi-source-repository</v-icon>
      Falhas por Projeto
    </v-card-title>

    <v-card-text v-if="data.length === 0" class="text-center text-disabled py-8">
      Sem dados para exibir.
    </v-card-text>

    <v-card-text v-else class="pa-2">
      <apexchart
        :key="isDark ? 'dark' : 'light'"
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

const props = defineProps<{
  data: Array<{ name: string; failed: number; total: number }>
  maxItems?: number
}>()

const vuetifyTheme = useTheme()
const isDark = computed(() => vuetifyTheme.global.name.value === 'dark')

const displayData = computed(() => props.data.slice(0, props.maxItems ?? 15))
const chartHeight = computed(() => Math.max(200, displayData.value.length * 36 + 60))

const series = computed(() => [
  { name: 'Falhas', data: displayData.value.map(d => d.failed) },
  { name: 'Sucesso', data: displayData.value.map(d => d.total - d.failed) }
])

const labelColor = computed(() => isDark.value ? '#b0b0c8' : '#444444')
const gridColor = computed(() => isDark.value ? '#2a2a3e' : '#d0d0d0')

const chartOptions = computed(() => ({
  chart: {
    type: 'bar',
    background: 'transparent',
    toolbar: { show: false },
    stacked: true,
    animations: { enabled: true },
    foreColor: labelColor.value
  },
  theme: { mode: isDark.value ? 'dark' : 'light' },
  colors: ['#f44336', '#4caf50'],
  plotOptions: {
    bar: { horizontal: true, borderRadius: 4, dataLabels: { total: { enabled: false } } }
  },
  dataLabels: { enabled: false },
  xaxis: {
    categories: displayData.value.map(d => d.name),
    labels: { formatter: (v: number) => Math.round(v).toString(), style: { colors: labelColor.value } },
    axisBorder: { color: gridColor.value },
    axisTicks: { color: gridColor.value }
  },
  yaxis: { labels: { maxWidth: 160, style: { colors: labelColor.value } } },
  legend: { position: 'top' as const, labels: { colors: labelColor.value } },
  tooltip: { shared: true, intersect: false },
  grid: { borderColor: gridColor.value }
}))
</script>
