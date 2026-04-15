<template>
  <v-card :color="color" variant="tonal" rounded="lg" class="metric-card">
    <v-card-text class="pa-4">
      <div class="d-flex justify-space-between align-start">
        <div>
          <div class="text-caption text-medium-emphasis text-uppercase font-weight-medium mb-1">
            {{ label }}
          </div>
          <div class="text-h4 font-weight-bold">
            {{ formattedValue }}
          </div>
          <div v-if="subtitle" class="text-caption text-medium-emphasis mt-1">
            {{ subtitle }}
          </div>
        </div>
        <v-icon :icon="icon" :color="color" size="36" class="mt-1" />
      </div>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  label: string
  value: number | string
  icon: string
  color?: string
  subtitle?: string
  format?: 'number' | 'percent' | 'duration' | 'none'
}>()

const formattedValue = computed(() => {
  if (typeof props.value === 'string') return props.value
  if (props.format === 'percent') return `${props.value}%`
  if (props.format === 'duration') return formatDuration(props.value)
  return props.value.toLocaleString('pt-BR')
})

function formatDuration(secs: number): string {
  if (secs < 60) return `${secs}s`
  const m = Math.floor(secs / 60)
  const s = secs % 60
  if (m < 60) return `${m}m ${s}s`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m`
}
</script>

<style scoped>
.metric-card {
  transition: transform 0.15s ease;
}
.metric-card:hover {
  transform: translateY(-2px);
}
</style>
