<template>
  <v-app :theme="currentTheme">
    <!-- Navigation Drawer -->
    <v-navigation-drawer v-model="drawer" :rail="rail" permanent>
      <v-list-item
        prepend-icon="mdi-gitlab"
        title="GitLab Dashboard"
        nav
      >
        <template #append>
          <v-btn
            :icon="rail ? 'mdi-chevron-right' : 'mdi-chevron-left'"
            variant="text"
            size="small"
            @click="rail = !rail"
          />
        </template>
      </v-list-item>

      <v-divider />

      <v-list density="compact" nav>
        <v-list-item
          prepend-icon="mdi-view-dashboard"
          title="Dashboard"
          :to="{ name: 'dashboard' }"
          rounded="lg"
        />
        <v-list-item
          prepend-icon="mdi-cog-outline"
          title="Configurações"
          :to="{ name: 'settings' }"
          rounded="lg"
        />
      </v-list>

      <!-- Project list -->
      <template v-if="!rail && store.projects.length > 0">
        <v-divider class="mt-2" />
        <v-list-subheader>Projetos ({{ store.projects.length }})</v-list-subheader>

        <div v-if="store.projects.length > 6" class="px-2 pb-1">
          <v-text-field
            v-model="projectSearch"
            density="compact"
            variant="outlined"
            placeholder="Filtrar..."
            prepend-inner-icon="mdi-magnify"
            hide-details
            clearable
          />
        </div>

        <v-list density="compact" nav class="project-list overflow-y-auto">
          <v-list-item
            v-for="project in filteredDrawerProjects"
            :key="project.id"
            :title="project.name"
            :to="{ name: 'project', params: { id: project.id } }"
            prepend-icon="mdi-source-repository"
            rounded="lg"
          />
        </v-list>
      </template>
    </v-navigation-drawer>

    <!-- App Bar -->
    <v-app-bar elevation="1">
      <v-app-bar-nav-icon @click="drawer = !drawer" />

      <v-app-bar-title>
        <span class="text-primary font-weight-bold">GL</span>
        {{ ' ' + (route.meta.title as string ?? 'Dashboard') }}
      </v-app-bar-title>

      <template #append>
        <!-- Last fetched badge -->
        <v-chip
          v-if="store.lastFetched"
          size="small"
          color="info"
          variant="tonal"
          class="mr-2"
          prepend-icon="mdi-clock-outline"
        >
          {{ formatRelative(store.lastFetched) }}
        </v-chip>

        <!-- Loading indicator -->
        <v-progress-circular
          v-if="store.isLoading"
          indeterminate
          size="20"
          width="2"
          color="primary"
          class="mr-2"
        />

        <!-- Theme toggle -->
        <v-btn
          :icon="currentTheme === 'dark' ? 'mdi-weather-sunny' : 'mdi-weather-night'"
          variant="text"
          @click="toggleTheme"
        />
      </template>
    </v-app-bar>

    <!-- Loading progress bar -->
    <v-progress-linear
      v-if="store.isLoading"
      :model-value="loadingPercent"
      color="primary"
      height="3"
      style="position: fixed; top: 64px; left: 0; right: 0; z-index: 1000"
    />

    <!-- Main content -->
    <v-main>
      <!-- Not configured banner -->
      <v-banner
        v-if="!settings.isConfigured"
        color="warning"
        icon="mdi-alert-circle-outline"
        class="mb-0"
      >
        <v-banner-text>
          Configure a URL e o token do GitLab antes de usar o dashboard.
        </v-banner-text>
        <template #actions>
          <v-btn variant="tonal" :to="{ name: 'settings' }">Configurar</v-btn>
        </template>
      </v-banner>

      <v-container fluid class="pa-4">
        <router-view />
      </v-container>
    </v-main>

    <!-- Global error snackbar -->
    <v-snackbar
      v-model="showError"
      color="error"
      location="bottom right"
      :timeout="6000"
    >
      <v-icon start>mdi-alert-circle</v-icon>
      {{ store.loadingError }}
      <template #actions>
        <v-btn icon="mdi-close" variant="text" @click="showError = false" />
      </template>
    </v-snackbar>

    <!-- Loading status snackbar -->
    <v-snackbar
      :model-value="store.isLoading"
      location="bottom left"
      :timeout="-1"
      color="surface"
    >
      <div class="d-flex align-center gap-2">
        <v-progress-circular indeterminate size="18" width="2" color="primary" />
        <span class="text-caption">{{ store.loadingProgress.message }}</span>
      </div>
      <template #actions>
        <v-btn size="small" variant="text" @click="store.cancelLoad()">Cancelar</v-btn>
      </template>
    </v-snackbar>
  </v-app>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useGitLabStore } from '@/stores/gitlab'
import { useSettingsStore } from '@/stores/settings'

const route = useRoute()
const store = useGitLabStore()
const settings = useSettingsStore()

const drawer = ref(true)
const rail = ref(false)
const currentTheme = ref('dark')
const projectSearch = ref('')
const showError = ref(false)

watch(() => store.loadingError, val => {
  if (val) showError.value = true
})

const filteredDrawerProjects = computed(() => {
  if (!projectSearch.value) return store.projects
  return store.projects.filter(p =>
    p.name.toLowerCase().includes(projectSearch.value.toLowerCase())
  )
})

const loadingPercent = computed(() => {
  const p = store.loadingProgress
  if (p.total === 0) return 0
  return Math.round((p.current / p.total) * 100)
})

function toggleTheme() {
  currentTheme.value = currentTheme.value === 'dark' ? 'light' : 'dark'
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'agora'
  if (mins < 60) return `há ${mins}min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `há ${hrs}h`
  return `há ${Math.floor(hrs / 24)}d`
}
</script>

<style scoped>
.project-list {
  max-height: 400px;
}
</style>
