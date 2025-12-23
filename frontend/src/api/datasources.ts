import { api } from './client'
import { Datasource, TableSchema, DatasourceView } from '../types'

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
        api.get<{ records: any[]; total: number; timestamp_utc?: string }>(`/api/datasources/${id}/tables/${table}/data`, {
            params: { limit, filters: filters ? JSON.stringify(filters) : undefined }
        }),
    refreshTableSchema: (id: string | number, table: string) =>
        api.get<TableSchema>(`/api/datasources/${id}/tables/${table}/schema`, { params: { refresh: true } }),
    searchDatasource: (id: string | number, q: string) =>
        api.get<any[]>(`/api/datasources/${id}/search`, { params: { q } }),
    searchAll: (q: string) =>
        api.get<any[]>('/api/datasources/search-all', { params: { q } }),
    saveSession: (id: string | number, table: string, data: any) =>
        api.post(`/api/datasources/${id}/tables/${table}/session`, data),
    getSession: (id: string | number, table: string) =>
        api.get<any>(`/api/datasources/${id}/tables/${table}/session`),
    clearSession: (id: string | number, table: string) =>
        api.delete(`/api/datasources/${id}/tables/${table}/session`),
}

export const viewsApi = {
    list: (datasourceId: string | number) => api.get<DatasourceView[]>(`/api/datasources/${datasourceId}/views`),
    create: (datasourceId: string | number, data: Partial<DatasourceView>) => api.post<DatasourceView>(`/api/datasources/${datasourceId}/views`, data),
    update: (id: string, data: Partial<DatasourceView>) => api.patch<DatasourceView>(`/api/views/${id}`, data),
    delete: (id: string) => api.delete(`/api/views/${id}`),
    patchRecord: (viewId: string, record: any, keyColumn: string = 'id') =>
        api.patch(`/api/views/${viewId}/records`, record, { params: { key_column: keyColumn } }),
    trigger: (viewId: string, payload: any) =>
        api.post<{ success: boolean; message: string; data: any }>(`/api/views/${viewId}/trigger`, payload),
}
