# GitLab CI Dashboard

Dashboard para análise e monitoramento de pipelines e jobs do GitLab CI, com suporte a filtros, métricas agrupadas e exportação de dados.

---

## Endpoints utilizados

> **Base URL:** `http://<seu-gitlab>/api/v4`  
> Todas as requisições exigem o header `PRIVATE-TOKEN: <seu-token>`

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `GET` | `/user` | Valida as credenciais e obtém o nome do usuário autenticado |
| `GET` | `/projects` | Lista os projetos dos quais o usuário é membro |
| `GET` | `/projects/:id/pipelines` | Lista pipelines de um projeto em um intervalo de datas |
| `GET` | `/projects/:id/pipelines/:pipeline_id/jobs` | Lista os jobs de uma pipeline (incluindo retries) |

### Parâmetros relevantes

**`/projects`**
```
membership=true
order_by=name
sort=asc
per_page=100
page=<N>
```

**`/projects/:id/pipelines`**
```
updated_after=<ISO8601>
updated_before=<ISO8601>
order_by=updated_at
sort=desc
per_page=100
page=<N>
```

**`/projects/:id/pipelines/:pipeline_id/jobs`**
```
per_page=100
include_retried=true
```

---

## Instalação e execução

```bash
npm install

# Desenvolvimento
npm run dev

# Build de produção
npm run build

# Preview do build
npm run preview
```

---

## Como configurar

1. Acesse a página **Configurações** (`/#/settings`).
2. **Passo 1 – Conexão:** informe a URL base da sua instância GitLab (ex.: `http://git.exemplo.com.br`) e um Personal Access Token com escopo `read_api`. Clique em **Testar Conexão** para validar.
3. **Passo 2 – Projetos:** carregue a lista de projetos e selecione quais serão analisados. Deixe em branco para incluir todos.
4. **Passo 3 – Carregar Dados:** defina o intervalo de datas e clique em **Carregar Dados**. O carregamento ocorre em três fases: projetos → pipelines → jobs.

> As configurações (URL, projetos selecionados, intervalo de datas) são salvas no `localStorage`. O token é salvo em um cookie HttpOnly com validade de 365 dias.

---

## Estrutura do projeto

```
src/
├── api/
│   └── gitlab.ts          # Funções de acesso à API do GitLab
├── composables/
│   └── useMetrics.ts      # Computed metrics derivadas dos dados carregados
├── stores/
│   ├── gitlab.ts          # Estado global: projetos, pipelines, jobs, cache
│   └── settings.ts        # Estado de configuração: URL, token, datas, seleções
├── pages/
│   ├── DashboardPage.vue  # Visão geral com filtros e todos os gráficos
│   ├── ProjectPage.vue    # Detalhes de um único projeto
│   └── SettingsPage.vue   # Configuração, conexão e carga de dados
├── components/
│   ├── charts/            # Componentes de gráfico (ApexCharts)
│   └── common/            # EmptyState, MetricCard, StepCard
├── types/
│   └── gitlab.ts          # Interfaces TypeScript para todos os tipos
└── router/
    └── index.ts           # Rotas: /dashboard, /project/:id, /settings
```

---

## API (`src/api/gitlab.ts`)

### `createGitLabClient(baseUrl, token)`

Cria uma instância do Axios configurada com a base URL e o token de autenticação.

```ts
const client = createGitLabClient('http://git.exemplo.com.br', 'glpat-xxx')
```

---

### `testConnection(baseUrl, token)`

Faz uma chamada a `/user` para validar as credenciais. Retorna `{ success, user?, error? }`.

```ts
const result = await testConnection('http://git.exemplo.com.br', 'glpat-xxx')
if (result.success) console.log('Olá,', result.user)
```

---

### `fetchProjects(client, onProgress?, signal?)`

Busca todos os projetos dos quais o usuário é membro, paginando automaticamente.

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `client` | `AxiosInstance` | Cliente criado com `createGitLabClient` |
| `onProgress` | `(count: number) => void` | Callback chamado a cada página carregada |
| `signal` | `AbortSignal` | Permite cancelar a requisição |

```ts
const projects = await fetchProjects(client, n => console.log(`${n} projetos`))
```

---

### `fetchPipelinesForProject(client, projectId, startDate, endDate, signal?)`

Busca todas as pipelines de um projeto no intervalo de datas informado (formato ISO 8601).

```ts
const pipelines = await fetchPipelinesForProject(
  client,
  42,
  '2026-03-01T00:00:00.000Z',
  '2026-04-01T23:59:59.000Z'
)
```

---

### `fetchJobsForPipeline(client, projectId, pipelineId, signal?)`

Busca todos os jobs de uma pipeline, incluindo execuções retentadas (`include_retried=true`). Retorna `[]` em caso de erro (ex.: pipeline sem jobs).

```ts
const jobs = await fetchJobsForPipeline(client, 42, 1001)
```

---

### `fetchJobsBatched(client, pipelines, batchSize?, delayMs?, onProgress?, signal?)`

Busca jobs de múltiplas pipelines em lotes paralelos para evitar sobrecarga da API.

| Parâmetro | Padrão | Descrição |
|-----------|--------|-----------|
| `batchSize` | `5` | Número de pipelines processadas em paralelo por lote |
| `delayMs` | `250` | Pausa entre lotes em milissegundos |
| `onProgress` | — | Callback `(done, total, label)` para atualizar progresso |

Retorna `Record<pipelineId, GitLabJob[]>`.

```ts
const jobs = await fetchJobsBatched(client, pipelines, 5, 250, (done, total) => {
  console.log(`${done}/${total} pipelines processadas`)
})
```

---

## Store GitLab (`src/stores/gitlab.ts`)

Gerencia o estado global dos dados e o ciclo de carregamento.

### `loadData()`

Executa o carregamento completo em três fases:

1. **projects** – busca a lista de projetos (filtra pelos selecionados nas configurações).
2. **pipelines** – busca pipelines de cada projeto no intervalo de datas configurado.
3. **jobs** – busca jobs das pipelines com falha (ou de todas, se `loadJobsForAllPipelines` estiver ativo), respeitando o limite `maxPipelinesForJobs`.

Ao finalizar, salva tudo no cache (`localStorage`).

### `cancelLoad()`

Aborta o carregamento em andamento via `AbortController`.

### `loadFromCache()`

Tenta restaurar os dados do `localStorage`. Retorna `true` se bem-sucedido.

### `saveToCache()`

Persiste projetos, pipelines, jobs e o intervalo de datas no `localStorage`.

### `exportData()`

Retorna uma string JSON com todos os dados atuais, pronta para salvar em arquivo.

### `importData(raw)`

Importa dados de uma string JSON previamente exportada e atualiza as configurações de data. Retorna `{ ok: boolean; error?: string }`.

### `clearData()`

Remove todos os dados da memória e do `localStorage`.

### `loadingProgress`

Objeto reativo com o estado atual do carregamento:

```ts
{
  phase: 'idle' | 'projects' | 'pipelines' | 'jobs' | 'done'
  message: string   // texto descritivo exibido na UI
  current: number   // itens processados até agora
  total: number     // total de itens nesta fase
}
```

---

## Store de Configurações (`src/stores/settings.ts`)

| Propriedade | Tipo | Descrição |
|-------------|------|-----------|
| `gitlabUrl` | `string` | URL base da instância GitLab |
| `token` | `string` | Personal Access Token |
| `dateRangeStart` | `string` | Data inicial no formato `YYYY-MM-DD` |
| `dateRangeEnd` | `string` | Data final no formato `YYYY-MM-DD` |
| `selectedProjectIds` | `number[]` | IDs dos projetos selecionados (vazio = todos) |
| `loadJobsForAllPipelines` | `boolean` | Se `true`, carrega jobs de pipelines bem-sucedidas também |
| `maxPipelinesForJobs` | `number` | Limite de pipelines para busca de jobs (padrão: 500) |
| `isConfigured` | `computed<boolean>` | `true` se URL e token estiverem preenchidos |

### `save()`

Persiste as configurações no `localStorage` e o token em cookie.

### `setQuickRange(days)`

Define o intervalo de datas para os últimos N dias a partir de hoje.

```ts
settings.setQuickRange(7)  // últimos 7 dias
```

---

## Composable de Métricas (`src/composables/useMetrics.ts`)

```ts
const metrics = useMetrics(filtersRef)
```

Aceita um `Ref<MetricsFilters>` opcional com `{ projectIds?, branches?, statuses? }` para escopo dos dados.

| Computed | Tipo | Descrição |
|----------|------|-----------|
| `scopedProjects` | `GitLabProject[]` | Projetos dentro do filtro ativo |
| `allPipelines` | `GitLabPipeline[]` | Todas as pipelines dos projetos filtrados |
| `failedPipelines` | `GitLabPipeline[]` | Pipelines com `status === 'failed'` |
| `allLoadedJobs` | `GitLabJob[]` | Todos os jobs das pipelines carregadas |
| `failedJobs` | `GitLabJob[]` | Jobs com falha e `allow_failure === false` |
| `summaryStats` | objeto | KPIs gerais: `total`, `failed`, `succeeded`, `running`, `canceled`, `successRate`, `failureRate`, `avgDurationSec` |
| `failuresByProject` | array | Contagem de falhas por projeto, ordenada por `failed` |
| `failuresByStage` | array | Contagem de falhas por stage do pipeline |
| `failureReasons` | array | Contagem por `failure_reason` dos jobs com falha |
| `retryStats` | `RetryStats[]` | Jobs retentados: nome, projeto, total de retries, pipelines afetadas |
| `failuresTrend` | array | Falhas e total diários `{ date, failed, total }` |
| `availableBranches` | `string[]` | Branches disponíveis nos projetos filtrados |
| `sourceDistribution` | array | Distribuição de pipelines com falha por `source` |

---

## Páginas

### `/dashboard` — Dashboard Geral

Exibe todos os gráficos e KPIs. Possui painel de filtros (projeto, branch, status) colapsável. Os gráficos incluem:

- Cards de métricas resumidas
- Falhas por projeto (barra horizontal)
- Falhas por stage (barra)
- Causas de falha / `failure_reason` (pizza)
- Tendência de falhas por dia (linha)
- Tabela de jobs com mais retries

### `/project/:id` — Detalhes do Projeto

Visão focada em um único projeto: métricas, filtros de branch/status e gráficos equivalentes ao dashboard, mas escopo limitado ao projeto selecionado.

### `/settings` — Configurações

Assistente em 3 passos:
1. Configurar URL e token, testar conexão.
2. Carregar lista de projetos e selecionar quais monitorar.
3. Definir intervalo de datas e carregar dados (com barra de progresso por fase).

Inclui ações de **exportar** e **importar** dados JSON e botão para **limpar** o cache.

---

## Exportar e importar dados

O dashboard permite trabalhar offline com dados previamente carregados:

```
Configurações → Exportar Dados → salva um .json
Configurações → Importar Dados → carrega o .json
```

O arquivo importado deve ser um JSON no formato `CachedData`:

```ts
{
  projects: GitLabProject[],
  pipelines: Record<number, GitLabPipeline[]>,  // chave = projectId
  jobs: Record<number, GitLabJob[]>,            // chave = pipelineId
  lastFetched: string,       // ISO 8601
  dateRangeStart: string,    // YYYY-MM-DD
  dateRangeEnd: string       // YYYY-MM-DD
}
```

---

## Tecnologias

| Biblioteca | Uso |
|------------|-----|
| Vue 3 + Composition API | Framework principal |
| Vite | Build e dev server |
| Vuetify 3 | Componentes de UI (Material Design) |
| Pinia | Gerenciamento de estado |
| Axios | Requisições HTTP para a API do GitLab |
| ApexCharts / vue3-apexcharts | Gráficos interativos |
| js-cookie | Persistência segura do token em cookie |
| Vue Router (hash mode) | Navegação entre páginas |
