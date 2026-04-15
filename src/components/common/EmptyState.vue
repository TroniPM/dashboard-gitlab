<template>
  <div class="d-flex flex-column align-center justify-center py-12 text-center">
    <v-icon :icon="icon" size="64" color="grey-darken-1" />
    <div class="text-h6 mt-4 text-medium-emphasis">{{ title }}</div>
    <div class="text-body-2 text-disabled mt-1 mb-4">{{ message }}</div>
    <slot />
  </div>
</template>

<script setup lang="ts">
defineProps<{
  icon?: string
  title: string
  message?: string
}>()
</script>
