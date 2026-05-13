<template>
  <div>
    <div class="text-h6 font-weight-bold mb-1">BLAME — Watchlist de Arquivos Críticos</div>
    <div class="text-caption text-disabled mb-5">
      Monitore arquivos e pastas de interesse e visualize quem os alterou por último.
    </div>

    <!-- ══════════════════════════════════════════════════════════
         SETUP FLOW (sem configuração salva)
    ══════════════════════════════════════════════════════════ -->
    <template v-if="!blameStore.isConfigured">
      <v-card variant="outlined" class="pa-4">
        <div class="text-subtitle-1 font-weight-medium mb-4">
          <v-icon start color="primary">mdi-cog-outline</v-icon>
          Configurar Watchlist
        </div>

        <!-- 1 — Selecionar projeto e branch -->
        <v-row dense>
          <v-col cols="12" md="5">
            <v-select
              v-model="setupProjectId"
              :items="syncedProjects"
              item-title="name_with_namespace"
              item-value="id"
              label="Selecione um projeto"
              prepend-inner-icon="mdi-source-repository"
              variant="outlined"
              density="compact"
              hide-details
              clearable
              @update:model-value="onProjectSelected"
            />
          </v-col>
          <v-col cols="12" md="3">
            <v-select
              v-model="setupBranch"
              :items="branches"
              :loading="loadingBranches"
              :disabled="!setupProjectId || loadingBranches"
              label="Branch"
              prepend-inner-icon="mdi-source-branch"
              variant="outlined"
              density="compact"
              hide-details
              clearable
            />
          </v-col>
          <v-col cols="12" md="3" class="d-flex align-center">
            <v-btn
              color="primary"
              :disabled="!setupProjectId || !setupBranch"
              :loading="loadingTree"
              @click="fetchTree"
            >
              <v-icon start>mdi-file-tree</v-icon>
              Buscar estrutura do projeto
            </v-btn>
          </v-col>
        </v-row>

        <v-alert v-if="treeError" type="error" variant="tonal" density="compact" class="mt-3">
          {{ treeError }}
        </v-alert>

        <!-- 2 — Treeview de arquivos -->
        <template v-if="treeItems.length > 0">
          <v-divider class="my-4" />
          <div class="text-caption text-disabled mb-2">
            Selecione os arquivos ou pastas que deseja monitorar:
          </div>

          <div class="tree-search mb-2">
            <v-text-field
              v-model="treeSearch"
              density="compact"
              variant="outlined"
              placeholder="Filtrar caminhos..."
              prepend-inner-icon="mdi-magnify"
              hide-details
              clearable
            />
          </div>

          <v-card variant="tonal" class="pa-2" style="max-height: 400px; overflow-y: auto">
            <v-list density="compact" nav>
              <v-list-item
                v-for="item in filteredTreeItems"
                :key="item.path"
                :value="item.path"
                :class="{ 'v-list-item--active': selectedPaths.includes(item.path) }"
                @click="togglePath(item.path)"
              >
                <template #prepend>
                  <v-checkbox-btn
                    :model-value="selectedPaths.includes(item.path)"
                    density="compact"
                    hide-details
                    @click.stop="togglePath(item.path)"
                  />
                  <v-icon size="18" :color="item.type === 'tree' ? 'amber' : 'blue-grey'">
                    {{ item.type === 'tree' ? 'mdi-folder' : 'mdi-file-outline' }}
                  </v-icon>
                </template>
                <v-list-item-title class="text-caption font-mono">{{ item.path }}</v-list-item-title>
              </v-list-item>
            </v-list>
          </v-card>

          <div class="d-flex align-center gap-3 mt-4">
            <v-btn
              color="success"
              :disabled="selectedPaths.length === 0"
              @click="confirmSetup"
            >
              <v-icon start>mdi-check</v-icon>
              Confirmar Configuração ({{ selectedPaths.length }} selecionados)
            </v-btn>
            <v-btn variant="text" @click="clearSetup">Cancelar</v-btn>
          </div>
        </template>
      </v-card>
    </template>

    <!-- ══════════════════════════════════════════════════════════
         CONFIGURED STATE
    ══════════════════════════════════════════════════════════ -->
    <template v-else>

      <!-- Toolbar row -->
      <v-row dense class="mb-3 align-center">
        <v-col cols="12" md="auto">
          <v-btn
            color="primary"
            :loading="blameStore.isLoading"
            :disabled="blameStore.isLoading"
            @click="loadAll"
          >
            <v-icon start>mdi-refresh</v-icon>
            Carregar todos os projetos configurados
          </v-btn>
        </v-col>

        <v-col cols="12" md="auto" class="ml-md-2">
          <v-btn
            variant="text"
            size="small"
            color="secondary"
            @click="showAddProject = !showAddProject"
          >
            <v-icon start>mdi-plus</v-icon>
            Adicionar projeto
          </v-btn>
        </v-col>

        <v-spacer />

        <!-- View toggle -->
        <v-col cols="auto">
          <v-btn-toggle v-model="blame.view" mandatory density="compact" variant="outlined">
            <v-btn value="byProject">
              <v-icon start>mdi-view-list</v-icon>
              Por Projeto
            </v-btn>
            <v-btn value="timeline">
              <v-icon start>mdi-timeline-clock</v-icon>
              Timeline Global
            </v-btn>
          </v-btn-toggle>
        </v-col>
      </v-row>

      <!-- Loading progress -->
      <v-progress-linear
        v-if="blameStore.isLoading"
        :model-value="loadPercent"
        color="primary"
        height="3"
        class="mb-2"
        rounded
      />
      <div v-if="blameStore.isLoading" class="text-caption text-disabled mb-2">
        {{ blameStore.loadingProgress.message }} ({{ blameStore.loadingProgress.current }}/{{ blameStore.loadingProgress.total }})
        <v-btn size="x-small" variant="text" color="error" class="ml-2" @click="blameStore.cancelLoad()">Cancelar</v-btn>
      </div>

      <!-- Add project panel -->
      <v-expand-transition>
        <v-card v-if="showAddProject" variant="outlined" class="pa-4 mb-4">
          <div class="text-subtitle-2 font-weight-medium mb-3">Adicionar novo projeto à watchlist</div>
          <v-row dense>
            <v-col cols="12" md="4">
              <v-select
                v-model="setupProjectId"
                :items="syncedProjectsNotYetConfigured"
                item-title="name_with_namespace"
                item-value="id"
                label="Projeto"
                variant="outlined"
                density="compact"
                hide-details
                clearable
                @update:model-value="onProjectSelected"
              />
            </v-col>
            <v-col cols="12" md="3">
              <v-select
                v-model="setupBranch"
                :items="branches"
                :loading="loadingBranches"
                :disabled="!setupProjectId || loadingBranches"
                label="Branch"
                prepend-inner-icon="mdi-source-branch"
                variant="outlined"
                density="compact"
                hide-details
                clearable
              />
            </v-col>
            <v-col cols="12" md="3" class="d-flex align-center">
              <v-btn
                color="primary"
                :disabled="!setupProjectId || !setupBranch"
                :loading="loadingTree"
                size="small"
                @click="fetchTree"
              >
                Buscar estrutura
              </v-btn>
            </v-col>
          </v-row>

          <template v-if="treeItems.length > 0">
            <div class="tree-search mb-2 mt-3">
              <v-text-field
                v-model="treeSearch"
                density="compact"
                variant="outlined"
                placeholder="Filtrar caminhos..."
                prepend-inner-icon="mdi-magnify"
                hide-details
                clearable
              />
            </div>
            <v-card variant="tonal" class="pa-2" style="max-height: 320px; overflow-y: auto">
              <v-list density="compact" nav>
                <v-list-item
                  v-for="item in filteredTreeItems"
                  :key="item.path"
                  @click="togglePath(item.path)"
                >
                  <template #prepend>
                    <v-checkbox-btn
                      :model-value="selectedPaths.includes(item.path)"
                      density="compact"
                      hide-details
                      @click.stop="togglePath(item.path)"
                    />
                    <v-icon size="18" :color="item.type === 'tree' ? 'amber' : 'blue-grey'">
                      {{ item.type === 'tree' ? 'mdi-folder' : 'mdi-file-outline' }}
                    </v-icon>
                  </template>
                  <v-list-item-title class="text-caption font-mono">{{ item.path }}</v-list-item-title>
                </v-list-item>
              </v-list>
            </v-card>
            <div class="d-flex gap-3 mt-3">
              <v-btn color="success" :disabled="selectedPaths.length === 0" size="small" @click="confirmSetup">
                <v-icon start>mdi-check</v-icon>
                Confirmar ({{ selectedPaths.length }} selecionados)
              </v-btn>
              <v-btn variant="text" size="small" @click="clearSetup">Cancelar</v-btn>
            </div>
          </template>
        </v-card>
      </v-expand-transition>

      <!-- Date + project filters -->
      <v-row dense class="mb-3">
        <v-col cols="12" md="3">
          <v-text-field
            v-model="blame.dateStart"
            type="date"
            label="Data inicial"
            density="compact"
            variant="outlined"
            hide-details
            clearable
          />
        </v-col>
        <v-col cols="12" md="3">
          <v-text-field
            v-model="blame.dateEnd"
            type="date"
            label="Data final"
            density="compact"
            variant="outlined"
            hide-details
            clearable
          />
        </v-col>
        <v-col v-if="blame.view === 'timeline'" cols="12" md="3">
          <v-select
            v-model="blame.filterProjectId"
            :items="[{ id: null, name: 'Todos os projetos' }, ...configuredProjects]"
            item-title="name"
            item-value="id"
            label="Filtrar por projeto"
            density="compact"
            variant="outlined"
            hide-details
          />
        </v-col>
      </v-row>

      <!-- No data yet -->
      <v-alert
        v-if="!blameStore.isLoading && blameStore.allEntries.length === 0"
        type="info"
        variant="tonal"
        density="compact"
        class="mb-4"
      >
        Nenhum dado carregado ainda. Clique em <strong>Carregar todos os projetos configurados</strong> ou no botão de recarregar em cada projeto.
      </v-alert>

      <!-- ── VIEW: BY PROJECT ── -->
      <template v-if="blame.view === 'byProject'">
        <div
          v-for="projectId in configuredProjectIds"
          :key="projectId"
          class="mb-4"
        >
          <v-card variant="outlined">
            <v-card-title
              class="d-flex align-center cursor-pointer"
              @click="toggleProjectExpand(projectId)"
            >
              <v-icon start color="amber">mdi-source-repository</v-icon>
              {{ projectName(projectId) }}
              <v-chip class="ml-2" size="x-small" color="primary" variant="flat">
                {{ (blameStore.watchedPaths[projectId] ?? []).length }} paths
              </v-chip>
              <v-chip
                v-if="(blame.byProject[projectId] ?? []).some(e => e.isNew)"
                class="ml-1"
                size="x-small"
                color="error"
                variant="flat"
              >
                NOVO
              </v-chip>
              <v-chip
                class="ml-1"
                size="x-small"
                color="secondary"
                variant="tonal"
                prepend-icon="mdi-source-branch"
              >
                {{ blameStore.watchedBranches[projectId] ?? 'HEAD' }}
              </v-chip>
              <v-spacer />
              <v-btn
                icon
                size="small"
                variant="text"
                color="primary"
                :loading="reloadingProjectId === projectId"
                :disabled="blameStore.isLoading"
                @click.stop="reloadProject(projectId)"
              >
                <v-icon>mdi-refresh</v-icon>
                <v-tooltip activator="parent">Recarregar este projeto</v-tooltip>
              </v-btn>
              <v-btn
                icon
                size="small"
                variant="text"
                color="error"
                @click.stop="askRemoveProject(projectId)"
              >
                <v-icon>mdi-trash-can-outline</v-icon>
                <v-tooltip activator="parent">Remover projeto da watchlist</v-tooltip>
              </v-btn>
              <v-icon>{{ expandedProjects.has(projectId) ? 'mdi-chevron-up' : 'mdi-chevron-down' }}</v-icon>
            </v-card-title>

            <v-expand-transition>
              <div v-if="expandedProjects.has(projectId)">
                <v-divider />
                <template v-if="(blame.byProject[projectId] ?? []).length > 0">
                  <BlameTable :entries="blame.byProject[projectId]" />
                </template>
                <div v-else class="pa-4 text-caption text-disabled text-center">
                  Sem resultados carregados para este projeto. Clique em
                  <v-icon size="14">mdi-refresh</v-icon> para carregar.
                </div>
              </div>
            </v-expand-transition>
          </v-card>
        </div>
      </template>

      <!-- ── VIEW: TIMELINE ── -->
      <template v-else>
        <v-card variant="outlined">
          <v-card-title>
            <v-icon start color="primary">mdi-timeline-clock</v-icon>
            Timeline Global
            <v-chip class="ml-2" size="x-small" color="primary" variant="flat">
              {{ blame.timelineSorted.length }} registros
            </v-chip>
          </v-card-title>
          <BlameTable :entries="blame.timelineSorted" show-project />
        </v-card>
      </template>

    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, watch } from 'vue'
import { useBlameStore } from '@/stores/blame'
import { useGitLabStore } from '@/stores/gitlab'
import { useSettingsStore } from '@/stores/settings'
import { useBlame } from '@/composables/useBlame'
import { createGitLabClient, fetchRepositoryTree, fetchBranches } from '@/api/gitlab'
import type { GitLabTreeItem } from '@/types/gitlab'
import BlameTable from '@/components/blame/BlameTable.vue'

const blameStore = useBlameStore()
const gitlabStore = useGitLabStore()
const settings = useSettingsStore()

const blame = reactive(useBlame(() => blameStore.allEntries))

// ─── Setup flow state ─────────────────────────────────────────────────────────

const setupProjectId = ref<number | null>(null)
const setupBranch = ref<string | null>(null)
const branches = ref<string[]>([])
const loadingBranches = ref(false)
const treeItems = ref<GitLabTreeItem[]>([])
const treeSearch = ref('')
const selectedPaths = ref<string[]>([])
const loadingTree = ref(false)
const treeError = ref<string | null>(null)
const showAddProject = ref(false)

// ─── Computed ─────────────────────────────────────────────────────────────────

/** Projects already in the settings store (synced) */
const syncedProjects = computed(() => gitlabStore.projects)

/** Projects not yet in the blame watchlist */
const syncedProjectsNotYetConfigured = computed(() =>
  syncedProjects.value.filter(p => {
    const paths = blameStore.watchedPaths[p.id]
    return !paths || paths.length === 0
  })
)

/** Projects with at least one watched path */
const configuredProjects = computed(() =>
  syncedProjects.value.filter(p => (blameStore.watchedPaths[p.id]?.length ?? 0) > 0)
)

/** IDs of all configured projects (drives by-project cards, regardless of loaded data) */
const configuredProjectIds = computed(() =>
  Object.keys(blameStore.watchedPaths)
    .map(Number)
    .filter(id => (blameStore.watchedPaths[id]?.length ?? 0) > 0)
)

const filteredTreeItems = computed(() => {
  if (!treeSearch.value) return treeItems.value
  const q = treeSearch.value.toLowerCase()
  return treeItems.value.filter(i => i.path.toLowerCase().includes(q))
})

const loadPercent = computed(() => {
  const { current, total } = blameStore.loadingProgress
  return total > 0 ? Math.round((current / total) * 100) : 0
})

// ─── Expanded project map ─────────────────────────────────────────────────────

const expandedProjects = ref(new Set<number>())

const reloadingProjectId = ref<number | null>(null)

function toggleProjectExpand(id: number) {
  if (expandedProjects.value.has(id)) {
    expandedProjects.value.delete(id)
  } else {
    expandedProjects.value.add(id)
  }
  // Force reactivity
  expandedProjects.value = new Set(expandedProjects.value)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function projectName(id: number): string {
  return gitlabStore.projects.find(p => p.id === id)?.name_with_namespace ?? `Projeto #${id}`
}

function projectInfo(id: number) {
  return gitlabStore.projects.find(p => p.id === id)
}

function togglePath(path: string) {
  const idx = selectedPaths.value.indexOf(path)
  if (idx === -1) {
    selectedPaths.value.push(path)
  } else {
    selectedPaths.value.splice(idx, 1)
  }
}

// ─── Actions ──────────────────────────────────────────────────────────────────

async function fetchTree() {
  if (!setupProjectId.value || !setupBranch.value) return
  loadingTree.value = true
  treeError.value = null
  treeItems.value = []
  selectedPaths.value = []
  try {
    const client = createGitLabClient(settings.gitlabUrl, settings.token)
    treeItems.value = await fetchRepositoryTree(client, setupProjectId.value, true, setupBranch.value)
  } catch (err: unknown) {
    treeError.value = (err as { message?: string }).message ?? 'Erro ao buscar estrutura do projeto'
  } finally {
    loadingTree.value = false
  }
}

function confirmSetup() {
  if (!setupProjectId.value || selectedPaths.value.length === 0 || !setupBranch.value) return
  blameStore.setWatchedPaths(setupProjectId.value, [...selectedPaths.value], setupBranch.value)
  clearSetup()
  showAddProject.value = false
}

function clearSetup() {
  setupProjectId.value = null
  setupBranch.value = null
  branches.value = []
  treeItems.value = []
  treeSearch.value = ''
  selectedPaths.value = []
  treeError.value = null
}

async function onProjectSelected(id: number | null) {
  setupBranch.value = null
  branches.value = []
  treeItems.value = []
  selectedPaths.value = []
  if (!id) return
  loadingBranches.value = true
  try {
    const client = createGitLabClient(settings.gitlabUrl, settings.token)
    const result = await fetchBranches(client, id)
    branches.value = result.map(b => b.name)
    // Auto-select default branch
    const defaultBranch = result.find(b => b.default)
    setupBranch.value = defaultBranch?.name ?? result[0]?.name ?? null
  } catch {
    branches.value = []
  } finally {
    loadingBranches.value = false
  }
}

async function loadAll() {
  const projects = configuredProjects.value.map(p => ({
    id: p.id,
    name: p.name,
    web_url: p.web_url
  }))
  await blameStore.loadAll(projects)
  // Auto-expand all projects
  expandedProjects.value = new Set(projects.map(p => p.id))
}

async function reloadProject(id: number) {
  const project = projectInfo(id)
  if (!project) return
  reloadingProjectId.value = id
  await blameStore.loadProject({ id: project.id, name: project.name, web_url: project.web_url })
  reloadingProjectId.value = null
  // Auto-expand the reloaded project
  expandedProjects.value = new Set([...expandedProjects.value, id])
}

function askRemoveProject(id: number) {
  const project = projectInfo(id)
  if (!project) return
  if (confirm(`Tem certeza que deseja remover o projeto "${project.name}" da watchlist?`)) {
    blameStore.removeProject(id)
    expandedProjects.value.delete(id)
    expandedProjects.value = new Set(expandedProjects.value)
  }
}
</script>

<style scoped>
.font-mono {
  font-family: monospace;
}
.cursor-pointer {
  cursor: pointer;
}
</style>
