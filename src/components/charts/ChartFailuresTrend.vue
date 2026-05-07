<template>
  <v-card rounded="lg" variant="tonal" color="surface">
    <v-card-title class="pa-4 pb-0 text-body-1 font-weight-medium text-high-emphasis">
      <v-icon start size="18">mdi-chart-timeline-variant</v-icon>
      Tendência de falhas
    </v-card-title>

    <v-card-text v-if="data.length === 0" class="text-center text-disabled py-8">
      Sem dados suficientes para o gráfico.
    </v-card-text>

    <v-card-text v-else class="pa-2">
      <apexchart
        :key="isDark ? 'dark' : 'light'"
        type="area"
        height="260"
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
  data: Array<{ date: string; failed: number; total: number }>
}>()

const vuetifyTheme = useTheme()
const isDark = computed(() => vuetifyTheme.global.name.value === 'dark')

const series = computed(() => [
  {
    name: 'Total',
    data: props.data.map(d => ({ x: d.date, y: d.total }))
  },
  {
    name: 'Falhas',
    data: props.data.map(d => ({ x: d.date, y: d.failed }))
  }
])

const labelColor = computed(() => isDark.value ? '#b0b0c8' : '#444444')
const gridColor = computed(() => isDark.value ? '#2a2a3e' : '#d0d0d0')

const chartOptions = computed(() => ({
  chart: {
    background: 'transparent',
    toolbar: { show: false },
    zoom: { enabled: false },
    animations: { enabled: true, easing: 'easeinout', speed: 400 },
    foreColor: labelColor.value,
    defaultLocale: 'pt-br',
    locales: [{
      name: 'pt-br',
      options: {
        months: ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'],
        shortMonths: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'],
        days: ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'],
        shortDays: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'],
        toolbar: { download: 'Download SVG', selection: 'Seleção', selectionZoom: 'Zoom', zoomIn: 'Ampliar', zoomOut: 'Reduzir', pan: 'Mover', reset: 'Resetar Zoom' }
      }
    }]
  },
  theme: { mode: isDark.value ? 'dark' : 'light' },
  colors: ['#2196f3', '#f44336'],
  stroke: { curve: 'smooth', width: 2 },
  fill: {
    type: 'gradient',
    gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.05 }
  },
  dataLabels: { enabled: false },
  xaxis: {
    type: 'datetime',
    labels: { datetimeUTC: false, datetimeFormatter: { year: 'yyyy', month: "MMM/yy", day: 'dd MMM', hour: 'HH:mm' }, style: { colors: labelColor.value } },
    axisBorder: { color: gridColor.value },
    axisTicks: { color: gridColor.value }
  },
  yaxis: {
    min: 0,
    labels: { formatter: (v: number) => Math.round(v).toString(), style: { colors: labelColor.value } }
  },
  tooltip: { x: { format: 'dd/MM/yyyy' }, shared: true, intersect: false },
  legend: { position: 'top' as const, labels: { colors: labelColor.value } },
  grid: { borderColor: gridColor.value }
}))
</script>
