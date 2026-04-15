import axios, { type AxiosInstance } from 'axios'
import type { GitLabProject, GitLabPipeline, GitLabJob } from '@/types/gitlab'

// ─── Client Factory ───────────────────────────────────────────────────────────

export function createGitLabClient(baseUrl: string, token: string): AxiosInstance {
  return axios.create({
    baseURL: `${baseUrl.replace(/\/+$/, '')}/api/v4`,
    headers: { 'PRIVATE-TOKEN': token },
    timeout: 30_000
  })
}

// ─── Pagination Helper ────────────────────────────────────────────────────────

async function fetchAllPages<T>(
  client: AxiosInstance,
  url: string,
  params: Record<string, unknown> = {},
  onProgress?: (fetched: number) => void,
  signal?: AbortSignal
): Promise<T[]> {
  const results: T[] = []
  let page = 1

  while (true) {
    if (signal?.aborted) break

    const response = await client.get<T[]>(url, {
      params: { ...params, page, per_page: 100 },
      signal
    })

    results.push(...response.data)
    onProgress?.(results.length)

    const nextPage = response.headers['x-next-page']
    if (!nextPage || response.data.length === 0) break
    page = Number(nextPage)

    // Minimal delay to reduce rate-limit risk
    await sleep(80)
  }

  return results
}

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}

// ─── API Functions ────────────────────────────────────────────────────────────

export async function testConnection(
  baseUrl: string,
  token: string
): Promise<{ success: boolean; user?: string; error?: string }> {
  try {
    const response = await axios.get<{ name: string }>(
      `${baseUrl.replace(/\/+$/, '')}/api/v4/user`,
      { headers: { 'PRIVATE-TOKEN': token }, timeout: 10_000 }
    )
    return { success: true, user: response.data.name }
  } catch (err: unknown) {
    const axiosErr = err as { response?: { data?: { message?: string } }; message?: string }
    return {
      success: false,
      error: axiosErr.response?.data?.message ?? axiosErr.message ?? 'Erro desconhecido'
    }
  }
}

export async function fetchProjects(
  client: AxiosInstance,
  onProgress?: (count: number) => void,
  signal?: AbortSignal
): Promise<GitLabProject[]> {
  return fetchAllPages<GitLabProject>(
    client,
    '/projects',
    { membership: true, order_by: 'name', sort: 'asc', simple: false },
    onProgress,
    signal
  )
}

export async function fetchPipelinesForProject(
  client: AxiosInstance,
  projectId: number,
  startDate: string,
  endDate: string,
  signal?: AbortSignal
): Promise<GitLabPipeline[]> {
  const pipelines = await fetchAllPages<GitLabPipeline>(
    client,
    `/projects/${projectId}/pipelines`,
    { updated_after: startDate, updated_before: endDate, order_by: 'updated_at', sort: 'desc' },
    undefined,
    signal
  )
  // Ensure project_id is always populated
  return pipelines.map(p => ({ ...p, project_id: p.project_id ?? projectId }))
}

export async function fetchJobsForPipeline(
  client: AxiosInstance,
  projectId: number,
  pipelineId: number,
  signal?: AbortSignal
): Promise<GitLabJob[]> {
  try {
    const response = await client.get<GitLabJob[]>(
      `/projects/${projectId}/pipelines/${pipelineId}/jobs`,
      { params: { per_page: 100, include_retried: true }, signal }
    )
    return response.data
  } catch {
    return []
  }
}

// ─── Batch Job Fetcher ────────────────────────────────────────────────────────

export async function fetchJobsBatched(
  client: AxiosInstance,
  pipelines: GitLabPipeline[],
  batchSize = 5,
  delayMs = 250,
  onProgress?: (done: number, total: number, name: string) => void,
  signal?: AbortSignal
): Promise<Record<number, GitLabJob[]>> {
  const result: Record<number, GitLabJob[]> = {}

  for (let i = 0; i < pipelines.length; i += batchSize) {
    if (signal?.aborted) break
    const batch = pipelines.slice(i, i + batchSize)

    await Promise.all(
      batch.map(async pipeline => {
        result[pipeline.id] = await fetchJobsForPipeline(
          client,
          pipeline.project_id,
          pipeline.id,
          signal
        )
      })
    )

    const done = Math.min(i + batchSize, pipelines.length)
    onProgress?.(done, pipelines.length, `${done}/${pipelines.length} pipelines`)

    if (i + batchSize < pipelines.length) await sleep(delayMs)
  }

  return result
}
