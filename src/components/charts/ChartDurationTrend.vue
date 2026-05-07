<template>
  <v-card rounded="lg" variant="tonal" color="surface">
    <v-card-title class="pa-4 pb-0">
      <div class="d-flex align-center flex-wrap gap-2">
        <v-icon start size="18">mdi-timer-outline</v-icon>
        <span class="text-body-1 font-weight-medium text-high-emphasis">Tempo de execução (média diária)</span>
        <v-spacer />
        <v-select
          v-model="selectedStage"
          :items="stages"
          density="compact"
          variant="outlined"
          hide-details
          clearable
          label="Etapa"
          placeholder="Todas as etapas"
          style="max-width: 200px; min-width: 140px"
        />
      </div>
    </v-card-title>

    <v-card-text v-if="seriesData.length === 0" class="text-center text-disabled py-8">
      Sem dados suficientes para o gráfico.
    </v-card-text>

    <v-card-text v-else class="pa-2">
      <apexchart
        :key="`${isDark ? 'dark' : 'light'}-${selectedStage ?? 'all'}`"
        type="area"
        height="260"
        :options="chartOptions"
        :series="series"
      />
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useTheme } from 'vuetify'

const props = defineProps<{
  data: Array<{ date: string; avgDurationSec: number; byStage: Record<string, number> }>
  stages: string[]
}>()

const vuetifyTheme = useTheme()
const isDark = computed(() => vuetifyTheme.global.name.value === 'dark')

const selectedStage = ref<string | null>(null)

const seriesData = computed(() =>
  props.data
    .map(d => {
      const val = selectedStage.value
        ? (d.byStage[selectedStage.value] ?? null)
        : d.avgDurationSec
      return { x: d.date, y: val }
    })
    .filter(p => p.y !== null && p.y > 0)
)

const series = computed(() => [
  {
    name: selectedStage.value ? `Etapa: ${selectedStage.value}` : 'Duração média',
    data: seriesData.value
  }
])

const labelColor = computed(() => isDark.value ? '#b0b0c8' : '#444444')
const gridColor = computed(() => isDark.value ? '#2a2a3e' : '#d0d0d0')

function formatDurationSec(secs: number): string {
  if (secs < 60) return `${Math.round(secs)}s`
  const m = Math.floor(secs / 60)
  if (m < 60) return `${m}m ${Math.round(secs % 60)}s`
  return `${Math.floor(m / 60)}h ${m % 60}m`
}

const chartOptions = computed(() => ({
  chart: {
    background: 'transparent',
    toolbar: { show: false },
    zoom: { enabled: false },
    animations: { enabled: true, easing: 'easeinout', speed: 400 },
    foreColor: labelColor.value
  },
  theme: { mode: isDark.value ? 'dark' : 'light' },
  colors: ['#ff9800'],
  stroke: { curve: 'smooth', width: 2 },
  fill: {
    type: 'gradient',
    gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.05 }
  },
  dataLabels: { enabled: false },
  xaxis: {
    type: 'datetime',
    labels: { datetimeUTC: false, style: { colors: labelColor.value } },
    axisBorder: { color: gridColor.value },
    axisTicks: { color: gridColor.value }
  },
  yaxis: {
    min: 0,
    labels: {
      formatter: (v: number) => formatDurationSec(v),
      style: { colors: labelColor.value }
    }
  },
  tooltip: {
    x: { format: 'dd/MM/yyyy' },
    y: { formatter: (v: number) => formatDurationSec(v) },
    shared: true,
    intersect: false
  },
  legend: { position: 'top' as const, labels: { colors: labelColor.value } },
  grid: { borderColor: gridColor.value }
}))
</script>
