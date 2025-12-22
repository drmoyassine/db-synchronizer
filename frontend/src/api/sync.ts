import { api } from './client'
import { SyncConfig, SyncJob, Conflict } from '../types'

export const syncConfigsApi = {
    list: () => api.get<SyncConfig[]>('/api/sync-configs'),
    get: (id: string) => api.get<SyncConfig>(`/api/sync-configs/${id}`),
    create: (data: Partial<SyncConfig>) => api.post<SyncConfig>('/api/sync-configs', data),
    update: (id: string, data: Partial<SyncConfig>) => api.put<SyncConfig>(`/api/sync-configs/${id}`, data),
    delete: (id: string) => api.delete(`/api/sync-configs/${id}`),
}

export const syncApi = {
    execute: (configId: string) => api.post<SyncJob>(`/api/sync/${configId}`),
    getStatus: (jobId: string) => api.get<SyncJob>(`/api/sync/${jobId}/status`),
    getConflicts: (configId: string, status?: string) =>
        api.get<Conflict[]>(`/api/sync/${configId}/conflicts`, { params: { status_filter: status } }),
    resolveConflict: (configId: string, conflictId: string, data: { resolution: string; merged_data?: Record<string, unknown> }) =>
        api.post<Conflict>(`/api/sync/${configId}/resolve/${conflictId}`, data),
    listJobs: (configId?: string, limit?: number) =>
        api.get<SyncJob[]>('/api/sync/jobs', { params: { config_id: configId, limit } }),
}
