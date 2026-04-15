<template>
  <v-card rounded="lg" variant="tonal" color="surface">
    <v-card-title class="pa-4 pb-0 text-body-1 font-weight-medium text-high-emphasis">
      <v-icon start size="18">mdi-layers-outline</v-icon>
      Falhas por Stage
    </v-card-title>

    <v-card-text v-if="data.length === 0" class="text-center text-disabled py-8">
      Sem dados de jobs disponíveis.
      <div class="text-caption mt-1">Ative o carregamento de jobs nas Configurações.</div>
    </v-card-text>

    <v-card-text v-else class="pa-2">
      <apexchart
        :key="isDark ? 'dark' : 'light'"
        type="donut"
        height="280"
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
  data: Array<{ stage: string; count: number }>
}>()

const vuetifyTheme = useTheme()
const isDark = computed(() => vuetifyTheme.global.name.value === 'dark')

const COLORS = ['#f44336', '#ff9800', '#2196f3', '#9c27b0', '#00bcd4', '#4caf50', '#795548', '#607d8b']

const series = computed(() => props.data.map(d => d.count))

const labelColor = computed(() => isDark.value ? '#b0b0c8' : '#444444')

const chartOptions = computed(() => ({
  chart: { background: 'transparent', animations: { enabled: true }, foreColor: labelColor.value },
  theme: { mode: isDark.value ? 'dark' : 'light' },
  colors: COLORS,
  labels: props.data.map(d => d.stage),
  legend: { position: 'bottom' as const, labels: { colors: labelColor.value } },
  dataLabels: {
    enabled: true,
    style: { colors: ['#ffffff'] },
    formatter: (val: number, opts: { seriesIndex: number }) => {
      return `${props.data[opts.seriesIndex]?.stage}: ${props.data[opts.seriesIndex]?.count}`
    }
  },
  tooltip: { y: { formatter: (v: number) => `${v} falhas` } },
  plotOptions: { pie: { donut: { size: '60%' } } }
}))
</script>
