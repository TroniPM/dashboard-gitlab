// ─── GitLab Raw API Types ───────────────────────────────────────────────────

export interface GitLabProject {
  id: number
  name: string
  name_with_namespace: string
  path_with_namespace: string
  web_url: string
  namespace: {
    id: number
    name: string
    path: string
    kind: string
    full_path: string
  }
}

export type PipelineStatus =
  | 'running'
  | 'pending'
  | 'success'
  | 'failed'
  | 'canceled'
  | 'skipped'
  | 'created'
  | 'manual'
  | 'scheduled'
  | 'waiting_for_resource'
  | 'preparing'

export interface GitLabPipeline {
  id: number
  iid: number
  project_id: number
  status: PipelineStatus
  ref: string
  sha: string
  source: string
  created_at: string
  updated_at: string
  name: string | null
  web_url: string
  // Fields below are NOT returned by the pipeline list endpoint;
  // only available via GET /projects/:id/pipelines/:pipeline_id
  started_at?: string | null
  finished_at?: string | null
  duration?: number | null
}

export type JobStatus =
  | 'created'
  | 'pending'
  | 'running'
  | 'failed'
  | 'success'
  | 'canceled'
  | 'skipped'
  | 'manual'
  | 'waiting_for_resource'
  | 'preparing'

export type FailureReason =
  | 'script_failure'
  | 'runner_system_failure'
  | 'missing_dependency_failure'
  | 'runner_unsupported'
  | 'stale_schedule'
  | 'job_execution_timeout'
  | 'archived_failure'
  | 'unmet_prerequisites'
  | 'scheduler_failure'
  | 'data_integrity_failure'
  | 'forward_deployment_failure'
  | 'user_blocked'
  | 'project_deleted'
  | 'ci_quota_exceeded'
  | 'no_matching_runner'
  | 'trace_size_exceeded'
  | 'builds_disabled'
  | 'unknown_failure'
  | string

export interface GitLabJob {
  id: number
  name: string
  stage: string
  status: JobStatus
  failure_reason: FailureReason | null
  allow_failure: boolean
  created_at: string
  started_at: string | null
  finished_at: string | null
  duration: number | null
  web_url: string
  tag_list: string[]
  ref: string
  pipeline: {
    id: number
    project_id: number
    ref: string
    status: string
    web_url: string
  }
  runner?: {
    id: number
    description: string
    ip_address: string | null
    active: boolean
    paused: boolean
    is_shared: boolean
    runner_type: string
    name: string
    online: boolean
    status: string
  }
}

// ─── Cache ──────────────────────────────────────────────────────────────────

export interface CachedData {
  projects: GitLabProject[]
  pipelines: Record<number, GitLabPipeline[]>  // by project ID
  jobs: Record<number, GitLabJob[]>             // by pipeline ID
  lastFetched: string
  dateRangeStart: string
  dateRangeEnd: string
}

// ─── Derived Metrics ─────────────────────────────────────────────────────────

export interface RetryJobInstance {
  jobId: number
  jobUrl: string
  pipelineId: number
  pipelineIid: number
  pipelineUrl: string
  status: JobStatus
}

export interface RetryStats {
  jobName: string
  projectId: number
  projectName: string
  totalRetries: number
  affectedPipelines: number
  failureReasons: FailureReason[]
  jobInstances: RetryJobInstance[]
}

// ─── Constants ───────────────────────────────────────────────────────────────

export const FAILURE_REASON_LABELS: Record<string, string> = {
  script_failure: 'Falha no Script',
  runner_system_failure: 'Falha do Runner (Sistema)',
  missing_dependency_failure: 'Dependência Ausente',
  runner_unsupported: 'Runner Não Suportado',
  stale_schedule: 'Agendamento Expirado',
  job_execution_timeout: 'Timeout de Execução',
  archived_failure: 'Pipeline Arquivada',
  unmet_prerequisites: 'Pré-requisitos Não Atendidos',
  scheduler_failure: 'Falha no Scheduler',
  data_integrity_failure: 'Falha de Integridade de Dados',
  forward_deployment_failure: 'Falha de Deploy (Ordem)',
  user_blocked: 'Usuário Bloqueado',
  project_deleted: 'Projeto Deletado',
  ci_quota_exceeded: 'Cota de CI Excedida',
  no_matching_runner: 'Nenhum Runner Compatível',
  trace_size_exceeded: 'Log Muito Grande',
  builds_disabled: 'Builds Desabilitadas',
  unknown_failure: 'Falha Desconhecida'
}

export const PIPELINE_STATUS_COLORS: Record<string, string> = {
  success: 'success',
  failed: 'error',
  running: 'info',
  pending: 'warning',
  canceled: 'default',
  skipped: 'default',
  created: 'default',
  manual: 'secondary',
  scheduled: 'secondary',
  waiting_for_resource: 'warning',
  preparing: 'warning'
}

export const PIPELINE_STATUS_LABELS: Record<string, string> = {
  success: 'Sucesso',
  failed: 'Falhou',
  running: 'Em execução',
  pending: 'Pendente',
  canceled: 'Cancelada',
  skipped: 'Ignorada',
  created: 'Criada',
  manual: 'Manual',
  scheduled: 'Agendada',
  waiting_for_resource: 'Aguardando recurso',
  preparing: 'Preparando'
}
