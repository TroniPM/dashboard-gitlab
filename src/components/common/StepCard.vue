<template>
  <v-card
    rounded="lg"
    :variant="active ? 'elevated' : 'tonal'"
    :class="{ 'step-inactive': !active }"
  >
    <v-card-text class="pa-5">
      <!-- Header -->
      <div class="d-flex align-start gap-3 mb-4">
        <!-- Step circle -->
        <div class="step-badge" :class="done ? 'step-done' : active ? 'step-active' : 'step-locked'">
          <v-icon v-if="done" size="18" color="white">mdi-check</v-icon>
          <span v-else class="text-caption font-weight-bold">{{ step }}</span>
        </div>

        <div class="flex-grow-1">
          <div class="text-body-1 font-weight-medium d-flex align-center gap-2">
            {{ title }}
            <v-chip v-if="done" color="success" size="x-small" variant="flat" style="margin-left: 10px">Concluído</v-chip>
            <v-chip v-else-if="!active" size="x-small" variant="tonal" color="default" style="margin-left: 10px">
              <v-icon start size="12">mdi-lock-outline</v-icon>
              Aguardando passo anterior
            </v-chip>
          </div>
          <div class="text-caption text-medium-emphasis mt-0-5">{{ subtitle }}</div>
        </div>
      </div>

      <!-- Content (only when active) -->
      <div v-if="active" class="pl-10">
        <slot />
      </div>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
defineProps<{
  step: string
  title: string
  subtitle: string
  done: boolean
  active: boolean
}>()
</script>

<style scoped>
.step-badge {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 13px;
  margin-right: 8px;
  transition: background-color 0.25s, color 0.25s;
}
.step-active {
  background-color: rgb(var(--v-theme-primary));
  color: white;
}
.step-done {
  background-color: rgb(var(--v-theme-success));
  color: white;
}
.step-locked {
  background-color: rgba(var(--v-theme-on-surface), 0.1);
  color: rgba(var(--v-theme-on-surface), 0.4);
}
.step-inactive {
  opacity: 0.65;
  pointer-events: none;
}
</style>
