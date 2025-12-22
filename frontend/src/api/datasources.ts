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
        api.get<{ records: any[]; total: number }>(`/api/datasources/${id}/tables/${table}/data`, {
            params: { limit, filters: filters ? JSON.stringify(filters) : undefined }
        }),
    refreshTableSchema: (id: string | number, table: string) =>
        api.get<TableSchema>(`/api/datasources/${id}/tables/${table}/schema`, { params: { refresh: true } }),
}

export const viewsApi = {
    list: (datasourceId: string | number) => api.get<DatasourceView[]>(`/api/datasources/${datasourceId}/views`),
    create: (datasourceId: string | number, data: Partial<DatasourceView>) => api.post<DatasourceView>(`/api/datasources/${datasourceId}/views`, data),
    delete: (id: string) => api.delete(`/api/views/${id}`),
}
