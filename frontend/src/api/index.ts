import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || ''

export const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
})

// Types
export interface ColumnSchema {
    name: string
    type: string
    nullable: boolean
    primary_key: boolean
}

export interface TableSchema {
    columns: ColumnSchema[]
}

export interface Datasource {
    id: string
    name: string
    type: 'supabase' | 'postgres' | 'wordpress' | 'wordpress_rest' | 'wordpress_graphql' | 'neon' | 'mysql'
    host: string
    port: number
    database: string
    username?: string
    api_url?: string
    table_prefix: string
    is_active: boolean
    last_tested_at?: string
    last_test_success?: boolean
    views?: DatasourceView[]
    created_at: string
    updated_at: string
}

export interface FieldMapping {
    id: string
    sync_config_id: string
    master_column: string
    slave_column: string
    transform?: string
    is_key_field: boolean
    skip_sync: boolean
}

export interface SyncConfig {
    id: string
    name: string
    description?: string
    master_datasource_id: string
    slave_datasource_id: string
    master_table: string
    slave_table: string
    master_pk_column: string
    slave_pk_column: string
    conflict_strategy: 'source_wins' | 'target_wins' | 'manual' | 'merge' | 'webhook'
    webhook_url?: string
    sync_deletes: boolean
    batch_size: number
    cron_schedule?: string
    is_active: boolean
    created_at: string
    updated_at: string
    last_sync_at?: string
    field_mappings: FieldMapping[]
}

export interface SyncJob {
    id: string
    sync_config_id: string
    status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
    total_records: number
    processed_records: number
    inserted_records: number
    updated_records: number
    deleted_records: number
    conflict_count: number
    error_count: number
    progress_percent: number
    error_message?: string
    started_at?: string
    completed_at?: string
    duration_seconds?: number
    created_at: string
    triggered_by: string
}

export interface DatasourceView {
    id: string
    name: string
    description?: string
    datasource_id: string
    target_table: string
    filters: any[]
    created_at: string
    updated_at: string
}

export interface Conflict {
    id: string
    sync_config_id: string
    job_id: string
    record_key: string
    master_data: Record<string, unknown>
    slave_data: Record<string, unknown>
    conflicting_fields: string[]
    status: 'pending' | 'resolved_master' | 'resolved_slave' | 'resolved_merged' | 'skipped'
    resolved_data?: Record<string, unknown>
    resolved_by?: string
    resolved_at?: string
    resolution_notes?: string
    created_at: string
}

// API functions
export const datasourcesApi = {
    list: () => api.get<Datasource[]>('/api/datasources'),
    get: (id: string) => api.get<Datasource>(`/api/datasources/${id}`),
    create: (data: Partial<Datasource>) => api.post<Datasource>('/api/datasources', data),
    update: (id: string, data: Partial<Datasource>) => api.put<Datasource>(`/api/datasources/${id}`, data),
    delete: (id: string) => api.delete(`/api/datasources/${id}`),
    test: (id: string) => api.post<{ success: boolean; message: string; tables?: string[]; error?: string; suggestion?: string }>(`/api/datasources/${id}/test`),
    testRaw: (data: any) => api.post<{ success: boolean; message: string; tables?: string[]; error?: string; suggestion?: string }>('/api/datasources/test-raw', data),
    testUpdate: (id: string, data: any) => api.post<{ success: boolean; message: string; tables?: string[]; error?: string; suggestion?: string }>(`/api/datasources/${id}/test-update`, data),
    getTables: (id: string | number) => api.get<string[]>(`/api/datasources/${id}/tables`),
    getTableSchema: (id: string | number, table: string) => api.get<TableSchema>(`/api/datasources/${id}/tables/${table}/schema`),
    getTablesData: (id: string | number, table: string, limit: number = 10, filters?: any[]) =>
        api.get<{ records: any[]; total: number }>(`/api/datasources/${id}/tables/${table}/data`, {
            params: { limit, filters: filters ? JSON.stringify(filters) : undefined }
        }),
    refreshTableSchema: (id: string | number, table: string) =>
        api.get<TableSchema>(`/api/datasources/${id}/tables/${table}/schema`, { params: { refresh: true } }),
}

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

export const viewsApi = {
    list: (datasourceId: string | number) => api.get<DatasourceView[]>(`/api/datasources/${datasourceId}/views`),
    create: (datasourceId: string | number, data: Partial<DatasourceView>) => api.post<DatasourceView>(`/api/datasources/${datasourceId}/views`, data),
    delete: (id: string) => api.delete(`/api/views/${id}`),
}

// Redis Settings Types
export interface RedisSettings {
    redis_url: string | null
    redis_enabled: boolean
    cache_ttl_data: number
    cache_ttl_count: number
}

export interface RedisTestResult {
    success: boolean
    message: string
}

export const settingsApi = {
    getRedis: () => api.get<RedisSettings>('/api/settings/redis'),
    updateRedis: (data: Partial<RedisSettings>) => api.put<RedisSettings>('/api/settings/redis', data),
    testRedis: (data: Partial<RedisSettings>) => api.post<RedisTestResult>('/api/settings/redis/test', data),
}
