<template>
  <div>
    <div class="text-h6 font-weight-bold mb-1">Configurações</div>
    <div class="text-caption text-disabled mb-5">
      Siga os 3 passos abaixo para configurar e carregar os dados do GitLab.
    </div>

    <v-row>
      <!-- Stepper (left / main column) -->
      <v-col cols="12" md="8">

        <!-- ══ PASSO 1 — Conexão ══ -->
        <StepCard
          step="1"
          title="Conexão com o GitLab"
          subtitle="Informe a URL da instância e o seu Personal Access Token (pode ser gerado na url: GITLAB.../-/user_settings/personal_access_tokens)."
          :done="step1Done"
          :active="true"
        >
          <v-row dense>
            <v-col cols="12">
              <v-text-field
                v-model="settings.gitlabUrl"
                label="URL do GitLab"
                placeholder="http://git.exemplo.com.br"
                prepend-inner-icon="mdi-web"
                variant="outlined"
                density="compact"
                hide-details="auto"
                :rules="[urlRule]"
                :disabled="testingConnection"
                @input="onCredentialChange"
              />
            </v-col>
            <v-col cols="12">
              <v-text-field
                v-model="settings.token"
                label="Personal Access Token (PAT)"
                placeholder="glpat-xxxxxxxxxxxxxxxxxxxx"
                prepend-inner-icon="mdi-key-outline"
                :append-inner-icon="showToken ? 'mdi-eye-off' : 'mdi-eye'"
                :type="showToken ? 'text' : 'password'"
                variant="outlined"
                density="compact"
                hide-details="auto"
                :disabled="testingConnection"
                @click:append-inner="showToken = !showToken"
                @input="onCredentialChange"
              />
            </v-col>
          </v-row>

          <div class="d-flex align-center gap-3 mt-4 flex-wrap">
            <v-btn
              color="primary"
              :loading="testingConnection"
              :disabled="!canTest"
              @click="runTestConnection"
            >
              <v-icon start>mdi-connection</v-icon>
              Testar Conexão
            </v-btn>

            <v-chip
              v-if="step1Done && connectionResult?.user"
              color="success"
              variant="flat"
              prepend-icon="mdi-account-check"
              style="margin-left: 10px">
              {{ connectionResult.user }}
            </v-chip>
          </div>

          <v-alert
            v-if="connectionResult && !connectionResult.success"
            type="error"
            variant="tonal"
            density="compact"
            class="mt-3"
          >
            {{ connectionResult.error }}
          </v-alert>
        </StepCard>

        <!-- ══ PASSO 2 — Selecionar projetos ══ -->
        <StepCard
          step="2"
          title="Selecionar Projetos"
          subtitle="Carregue a lista de projetos e escolha quais serão analisados."
          :done="step2Done"
          :active="step1Done"
          class="mt-4"
        >
          <!-- Load project list -->
          <div v-if="!projectsLoaded" class="d-flex align-center gap-3 flex-wrap">
            <v-btn
              color="primary"
              :loading="store.isLoadingProjects"
              :disabled="!step1Done"
              @click="loadProjectList"
            >
              <v-icon start>mdi-source-repository</v-icon>
              Buscar Projetos
            </v-btn>
            <span class="text-caption text-disabled" style="margin-left: 10px">
              Lista todos os projetos aos quais você tem acesso.
            </span>
          </div>

          <v-alert
            v-if="store.loadProjectsError"
            type="error"
            variant="tonal"
            density="compact"
            class="mt-3"
          >
            {{ store.loadProjectsError }}
          </v-alert>

          <!-- Project selection -->
          <template v-if="projectsLoaded">
            <div class="d-flex align-center justify-space-between mb-2 flex-wrap gap-2">
              <span class="text-body-2 font-weight-medium">
                {{ store.projects.length }} projetos encontrados
              </span>
              <div class="d-flex gap-2">
                <v-btn size="x-small" variant="tonal" @click="selectAll" style="margin-right: 10px">Todos</v-btn>
                <v-btn size="x-small" variant="outlined" @click="selectNone" style="margin-right: 10px">Nenhum</v-btn>
                <v-btn size="x-small" variant="text" color="primary" @click="loadProjectList">
                  <v-icon start size="14">mdi-refresh</v-icon>Recarregar
                </v-btn>
              </div>
            </div>

            <v-text-field
              v-model="projectSearch"
              density="compact"
              variant="outlined"
              placeholder="Filtrar projetos..."
              prepend-inner-icon="mdi-magnify"
              hide-details
              clearable
              class="mb-2"
            />

            <v-card variant="outlined" rounded="lg" class="project-list overflow-y-auto">
              <v-list density="compact" select-strategy="independent" class="d-flex flex-column" style="gap: 5px">
                <v-list-item
                  v-for="project in filteredProjects"
                  :key="project.id"
                  :value="project.id"
                  :active="selectedIds.includes(project.id)"
                  color="primary"
                  rounded="lg"
                  @click="toggleProject(project.id)"
                >
                  <template #prepend>
                    <v-checkbox-btn
                      :model-value="selectedIds.includes(project.id)"
                      color="primary"
                      @click.stop="toggleProject(project.id)"
                    />
                  </template>
                  <v-list-item-title class="text-body-2">{{ project.name }}</v-list-item-title>
                  <v-list-item-subtitle class="text-caption">{{ project.path_with_namespace }}</v-list-item-subtitle>
                </v-list-item>
              </v-list>
            </v-card>

            <div class="d-flex align-center justify-space-between mt-3 flex-wrap gap-2">
              <span class="text-caption text-disabled">
                <template v-if="selectedIds.length === 0">
                  Nenhum selecionado — <strong>todos</strong> serão analisados.
                </template>
                <template v-else>
                  <strong>{{ selectedIds.length }}</strong> projeto(s) selecionado(s).
                </template>
              </span>
              <v-btn color="primary" variant="tonal" @click="confirmProjectSelection">
                Confirmar Seleção
                <v-icon end>mdi-chevron-right</v-icon>
              </v-btn>
            </div>
          </template>
        </StepCard>

        <!-- ══ PASSO 3 — Período e carregamento ══ -->
        <StepCard
          step="3"
          title="Período e Carregamento"
          subtitle="Configure o intervalo de datas e inicie o carregamento."
          :done="store.loadingProgress.phase === 'done'"
          :active="step2Done"
          class="mt-4"
        >
          <div class="d-flex align-center gap-2 mb-3 flex-wrap">
            <span class="text-caption text-disabled">Período rápido:</span>
            <v-btn
              v-for="opt in quickRangeOptions"
              :key="opt.days"
              size="x-small"
              variant="outlined"
              @click="settings.setQuickRange(opt.days)"
            >
              {{ opt.label }}
            </v-btn>
          </div>

          <v-row dense>
            <v-col cols="6">
              <v-text-field
                v-model="settings.dateRangeStart"
                label="Data início"
                type="date"
                variant="outlined"
                density="compact"
                hide-details
              />
            </v-col>
            <v-col cols="6">
              <v-text-field
                v-model="settings.dateRangeEnd"
                label="Data fim"
                type="date"
                variant="outlined"
                density="compact"
                hide-details
              />
            </v-col>
          </v-row>

          <v-divider class="my-4" />

          <!-- Advanced options -->
          <div
            class="d-flex align-center gap-1 cursor-pointer text-caption text-medium-emphasis mb-2"
            @click="advancedOpen = !advancedOpen"
          >
            <v-icon :icon="advancedOpen ? 'mdi-chevron-up' : 'mdi-chevron-down'" size="16" />
            Opções avançadas
          </div>
          <v-expand-transition>
            <div v-show="advancedOpen">
              <v-switch
                v-model="settings.loadJobsForAllPipelines"
                color="primary"
                density="compact"
                hide-details
                class="mb-1"
              >
                <template #label>
                  <span class="text-body-2">
                    Carregar jobs de <strong>todas</strong> as pipelines
                    <span class="text-caption text-disabled d-block">
                      Mais lento, mas detecta retries em pipelines bem-sucedidas.
                      Se desativado, analisa apenas pipelines com falha.
                    </span>
                  </span>
                </template>
              </v-switch>
              <v-text-field
                v-model.number="settings.maxPipelinesForJobs"
                label="Máx. pipelines para análise de jobs"
                type="number"
                min="10"
                max="2000"
                variant="outlined"
                density="compact"
                hide-details
                class="mt-3"
                style="max-width: 240px"
              />
            </div>
          </v-expand-transition>

          <!-- Summary -->
          <v-alert type="info" variant="tonal" density="compact" class="mt-4" icon="mdi-information-outline">
            <template v-if="selectedIds.length === 0">
              Serão carregadas pipelines de <strong>todos os {{ store.projects.length }} projetos</strong>
              de <strong>{{ formatDateBR(settings.dateRangeStart) }}</strong> até <strong>{{ formatDateBR(settings.dateRangeEnd) }}</strong>.
            </template>
            <template v-else>
              Serão carregadas pipelines de <strong>{{ selectedIds.length }} projeto(s)</strong>
              de <strong>{{ formatDateBR(settings.dateRangeStart) }}</strong> até <strong>{{ formatDateBR(settings.dateRangeEnd) }}</strong>.
            </template>
          </v-alert>

          <div class="mt-4">
            <div class="d-flex gap-3 align-center flex-wrap">
              <v-btn
                color="primary"
                size="large"
                :loading="store.isLoading"
                :disabled="!step2Done"
                @click="runLoadData"
                style="margin-right: 10px;"
              >
                <v-icon start>mdi-download-circle-outline</v-icon>
                Carregar Dados
              </v-btn>
              <v-btn
                v-if="store.isLoading"
                color="error"
                variant="outlined"
                @click="store.cancelLoad()"
                style="margin-left: 10px;"
              >
                <v-icon start>mdi-stop-circle-outline</v-icon>
                Cancelar
              </v-btn>
            </div>

            <div v-if="store.isLoading || store.loadingProgress.phase === 'done'" class="mt-3">
              <div class="d-flex justify-space-between text-caption text-medium-emphasis mb-1">
                <span>{{ store.loadingProgress.message }}</span>
                <span>{{ loadPercent }}%</span>
              </div>
              <v-progress-linear
                :model-value="loadPercent"
                :indeterminate="loadPercent === 0 && store.isLoading"
                color="primary"
                height="10"
                rounded
              />
              <div
                v-if="store.loadingProgress.phase === 'done'"
                class="mt-2 text-caption d-flex align-center gap-1"
                style="color: rgb(var(--v-theme-success))"
              >
                <v-icon size="16" color="success">mdi-check-circle</v-icon>
                Dados carregados com sucesso!
                <router-link :to="{ name: 'dashboard' }" class="ml-2">Ver dashboard →</router-link>
              </div>
            </div>

            <v-alert
              v-if="store.loadingError"
              type="error"
              variant="tonal"
              density="compact"
              class="mt-3"
            >
              {{ store.loadingError }}
            </v-alert>
          </div>
        </StepCard>
      </v-col>

      <!-- Right column: Cache + Export/Import -->
      <v-col cols="12" md="4">
        <v-card rounded="lg" class="mb-4">
          <v-card-title class="pa-4 pb-2 text-body-1">
            <v-icon start size="18">mdi-database-outline</v-icon>
            Dados em Cache
          </v-card-title>
          <v-card-text>
            <template v-if="store.lastFetched">
              <v-list density="compact">
                <v-list-item prepend-icon="mdi-clock-outline">
                  <v-list-item-title class="text-caption">Última atualização</v-list-item-title>
                  <v-list-item-subtitle>{{ formatDate(store.lastFetched) }}</v-list-item-subtitle>
                </v-list-item>
                <v-list-item prepend-icon="mdi-source-repository">
                  <v-list-item-title class="text-caption">Projetos</v-list-item-title>
                  <v-list-item-subtitle>{{ store.projects.length }}</v-list-item-subtitle>
                </v-list-item>
                <v-list-item prepend-icon="mdi-pipe">
                  <v-list-item-title class="text-caption">Pipelines</v-list-item-title>
                  <v-list-item-subtitle>{{ totalPipelines }}</v-list-item-subtitle>
                </v-list-item>
                <v-list-item prepend-icon="mdi-hammer-wrench">
                  <v-list-item-title class="text-caption">Jobs carregados</v-list-item-title>
                  <v-list-item-subtitle>{{ totalJobs }}</v-list-item-subtitle>
                </v-list-item>
                <v-list-item prepend-icon="mdi-harddisk">
                  <v-list-item-title class="text-caption">Tamanho</v-list-item-title>
                  <v-list-item-subtitle>{{ cacheSize }}</v-list-item-subtitle>
                </v-list-item>
              </v-list>
            </template>
            <div v-else class="text-center text-disabled py-4 text-caption">
              Nenhum dado carregado ainda.
            </div>
          </v-card-text>
        </v-card>

        <v-card rounded="lg" class="mb-4">
          <v-card-title class="pa-4 pb-2 text-body-1">
            <v-icon start size="18">mdi-swap-vertical</v-icon>
            Exportar / Importar
          </v-card-title>
          <v-card-text>
            <div class="d-flex flex-column gap-2">
              <v-btn
                color="primary"
                variant="tonal"
                block
                :disabled="!store.lastFetched"
                prepend-icon="mdi-download"
                @click="exportData"
              >
                Exportar JSON
              </v-btn>
              <v-btn
                color="secondary"
                variant="tonal"
                block
                prepend-icon="mdi-upload"
                @click="triggerImport"
              >
                Importar JSON
              </v-btn>
              <input ref="fileInput" type="file" accept=".json" class="d-none" @change="handleImport" />
              <v-divider class="my-1" />
              <v-btn
                color="error"
                variant="outlined"
                block
                :disabled="!store.lastFetched"
                prepend-icon="mdi-delete-outline"
                @click="confirmClear = true"
              >
                Limpar Cache
              </v-btn>
            </div>

            <v-alert
              v-if="importResult"
              :type="importResult.ok ? 'success' : 'error'"
              variant="tonal"
              density="compact"
              class="mt-3"
              closable
              @click:close="importResult = null"
            >
              {{ importResult.ok
                ? `Mesclagem concluída! +${importResult.added?.projects ?? 0} projetos, +${importResult.added?.pipelines ?? 0} pipelines, +${importResult.added?.jobs ?? 0} jobs adicionados.`
                : importResult.error }}
            </v-alert>
          </v-card-text>
        </v-card>

        <v-card rounded="lg">
          <v-card-title class="pa-4 pb-2 text-body-1">
            <v-icon start size="18">mdi-eye-outline</v-icon>
            Exibição de Projetos
          </v-card-title>
          <v-card-text>
            <v-switch
              v-model="settings.onlyProjectsWithData"
              color="primary"
              density="compact"
              hide-details
              @update:model-value="settings.save()"
            >
              <template #label>
                <span class="text-body-2">
                  Exibir apenas projetos com dados
                  <span class="text-caption text-disabled d-block">
                    Oculta do menu lateral e do dashboard os projetos sem pipelines carregadas.
                  </span>
                </span>
              </template>
            </v-switch>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Confirm clear dialog -->
    <v-dialog v-model="confirmClear" max-width="420">
      <v-card>
        <v-card-title>Limpar cache?</v-card-title>
        <v-card-text>
          Todos os dados carregados serão removidos. Você precisará recarregar do GitLab.
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="confirmClear = false">Cancelar</v-btn>
          <v-btn color="error" @click="clearData">Limpar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useGitLabStore } from '@/stores/gitlab'
import { useSettingsStore } from '@/stores/settings'
import { testConnection as apiTestConnection } from '@/api/gitlab'
import StepCard from '@/components/common/StepCard.vue'

const store = useGitLabStore()
const settings = useSettingsStore()

// ─── Step state ───────────────────────────────────────────────────────────────
const step1Done = ref(false)
const step2Done = ref(false)

// ─── Step 1: Connection ───────────────────────────────────────────────────────
const showToken = ref(false)
const testingConnection = ref(false)
const connectionResult = ref<{ success: boolean; user?: string; error?: string } | null>(null)

const canTest = computed(() => !!(settings.gitlabUrl.trim() && settings.token.trim()))

function onCredentialChange() {
  step1Done.value = false
  step2Done.value = false
  connectionResult.value = null
}

async function runTestConnection() {
  testingConnection.value = true
  connectionResult.value = null
  step1Done.value = false
  const result = await apiTestConnection(settings.gitlabUrl, settings.token)
  connectionResult.value = result
  if (result.success) {
    step1Done.value = true
    settings.save()
  }
  testingConnection.value = false
}

// ─── Step 2: Projects ─────────────────────────────────────────────────────────
const projectsLoaded = ref(store.projects.length > 0)
const projectSearch = ref('')
const selectedIds = ref<number[]>([...settings.selectedProjectIds])

// Restore state if already configured + cached
if (store.projects.length > 0 && settings.isConfigured) {
  step1Done.value = true
  step2Done.value = true
}

const filteredProjects = computed(() => {
  if (!projectSearch.value) return store.projects
  const q = projectSearch.value.toLowerCase()
  return store.projects.filter(
    p => p.name.toLowerCase().includes(q) || p.path_with_namespace.toLowerCase().includes(q)
  )
})

async function loadProjectList() {
  projectSearch.value = ''
  await store.fetchProjectsOnly()
  if (!store.loadProjectsError) {
    projectsLoaded.value = true
    selectedIds.value = selectedIds.value.filter(id => store.projects.some(p => p.id === id))
  }
}

function toggleProject(id: number) {
  const idx = selectedIds.value.indexOf(id)
  if (idx >= 0) selectedIds.value.splice(idx, 1)
  else selectedIds.value.push(id)
}

function selectAll() { selectedIds.value = store.projects.map(p => p.id) }
function selectNone() { selectedIds.value = [] }

function confirmProjectSelection() {
  settings.selectedProjectIds = [...selectedIds.value]
  settings.save()
  step2Done.value = true
}

// ─── Step 3: Load ─────────────────────────────────────────────────────────────
const advancedOpen = ref(false)

const quickRangeOptions = [
  { label: '7 dias', days: 7 },
  { label: '14 dias', days: 14 },
  { label: '30 dias', days: 30 },
  { label: '60 dias', days: 60 },
  { label: '90 dias', days: 90 }
]

const loadPercent = computed(() => {
  const p = store.loadingProgress
  return p.total ? Math.round((p.current / p.total) * 100) : 0
})

async function runLoadData() {
  settings.save()
  await store.loadData()
}

// ─── Cache info ───────────────────────────────────────────────────────────────
const totalPipelines = computed(() =>
  Object.values(store.pipelines).reduce((s, pls) => s + pls.length, 0)
)
const totalJobs = computed(() =>
  Object.values(store.jobs).reduce((s, js) => s + js.length, 0)
)
const cacheSize = computed(() => {
  // Use the same serialization as exportData() for an accurate byte count
  try {
    const bytes = new TextEncoder().encode(store.exportData()).length
    const mb = bytes / 1024 / 1024
    return mb < 1 ? `${(mb * 1024).toFixed(0)} KB` : `${mb.toFixed(2)} MB`
  } catch { return '—' }
})

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'medium', timeStyle: 'short' })
}

function formatDateBR(iso: string) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

// ─── Export / Import ──────────────────────────────────────────────────────────
const confirmClear = ref(false)
const importResult = ref<{ ok: boolean; error?: string; added?: { projects: number; pipelines: number; jobs: number } } | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)

function exportData() {
  const blob = new Blob([store.exportData()], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `gitlab-dashboard-${new Date().toISOString().split('T')[0]}.json`
  a.click()
  URL.revokeObjectURL(url)
}

function triggerImport() { fileInput.value?.click() }

async function handleImport(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  importResult.value = await store.importData(await file.text())
  if (importResult.value.ok) {
    projectsLoaded.value = store.projects.length > 0
    step1Done.value = settings.isConfigured
    step2Done.value = store.projects.length > 0 && settings.isConfigured
  }
  target.value = ''
}

function clearData() {
  store.clearData()
  projectsLoaded.value = false
  step2Done.value = false
  confirmClear.value = false
}

const urlRule = (v: string) =>
  !v || v.startsWith('http') ? true : 'URL deve começar com http:// ou https://'
</script>

<style scoped>
.project-list {
  max-height: 320px;
}
</style>
