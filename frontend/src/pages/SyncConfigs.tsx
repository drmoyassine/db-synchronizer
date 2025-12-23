import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, RefreshCw, Play, Trash2, Loader2, Eye } from 'lucide-react'
import { syncConfigsApi, syncApi, datasourcesApi, viewsApi, DatasourceView } from '../api'
import DataPreviewModal from '../components/DataPreviewModal'
import { formatDistanceToNow } from 'date-fns'
import { ExpressionEditor } from '../components/ExpressionEditor'

const STRATEGY_LABELS: Record<string, string> = {
    source_wins: 'Source Wins',
    target_wins: 'Target Wins',
    manual: 'Manual',
    merge: 'Merge',
    webhook: 'Webhook',
}

export function SyncConfigs() {
    const [showModal, setShowModal] = useState(false)
    const queryClient = useQueryClient()

    const { data: configs, isLoading } = useQuery({
        queryKey: ['sync-configs'],
        queryFn: () => syncConfigsApi.list().then(r => r.data),
    })

    const { data: datasources } = useQuery({
        queryKey: ['datasources'],
        queryFn: () => datasourcesApi.list().then(r => r.data),
    })

    const deleteMutation = useMutation({
        mutationFn: (id: string) => syncConfigsApi.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['sync-configs'] })
        },
    })

    const executeMutation = useMutation({
        mutationFn: (configId: string) => syncApi.execute(configId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['jobs'] })
        },
    })

    const getDatasourceName = (id: string) => {
        return datasources?.find(d => d.id === id)?.name || 'Unknown'
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Sync Configurations</h1>
                    <p className="text-gray-500 dark:text-gray-400">Define how data syncs between databases</p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    New Sync Config
                </button>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                </div>
            ) : configs?.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-xl p-12 text-center border border-gray-200 dark:border-gray-700">
                    <RefreshCw className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                    <h3 className="text-lg font-medium mb-2">No sync configurations</h3>
                    <p className="text-gray-500 mb-4">Create a sync configuration to start syncing data.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {configs?.map((config) => (
                        <div
                            key={config.id}
                            className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700"
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                        <h3 className="font-semibold text-lg">{config.name}</h3>
                                        <span className={`px-2 py-0.5 text-xs rounded-full ${config.is_active ? 'status-success' : 'status-warning'}`}>
                                            {config.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </div>
                                    {config.description && (
                                        <p className="text-sm text-gray-500 mb-3">{config.description}</p>
                                    )}
                                    <div className="flex items-center gap-6 text-sm">
                                        <div>
                                            <span className="text-gray-500">Master:</span>
                                            <span className="ml-1 font-medium">{getDatasourceName(config.master_datasource_id)}</span>
                                            <span className="text-gray-400 ml-1">({config.master_table})</span>
                                        </div>
                                        <span className="text-gray-400">→</span>
                                        <div>
                                            <span className="text-gray-500">Slave:</span>
                                            <span className="ml-1 font-medium">{getDatasourceName(config.slave_datasource_id)}</span>
                                            <span className="text-gray-400 ml-1">({config.slave_table})</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                                        <span>Strategy: {STRATEGY_LABELS[config.conflict_strategy]}</span>
                                        <span>{config.field_mappings.length} field mappings</span>
                                        {config.last_sync_at && (
                                            <span>Last sync: {formatDistanceToNow(new Date(config.last_sync_at), { addSuffix: true })}</span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => executeMutation.mutate(config.id)}
                                        disabled={executeMutation.isPending}
                                        className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                                    >
                                        {executeMutation.isPending && executeMutation.variables === config.id ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <Play className="w-4 h-4" />
                                        )}
                                        Sync Now
                                    </button>
                                    <button
                                        onClick={() => deleteMutation.mutate(config.id)}
                                        className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {showModal && (
                <AddSyncConfigModal
                    onClose={() => setShowModal(false)}
                    datasources={datasources || []}
                />
            )}
        </div>
    )
}

function AddSyncConfigModal({
    onClose,
    datasources
}: {
    onClose: () => void
    datasources: { id: string; name: string }[]
}) {
    const queryClient = useQueryClient()
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        master_datasource_id: '',
        slave_datasource_id: '',
        master_table: '',
        slave_table: '',
        master_view_id: '' as string | null,
        slave_view_id: '' as string | null,
        master_pk_column: 'id',
        slave_pk_column: 'id',
        conflict_strategy: 'source_wins' as 'source_wins' | 'target_wins' | 'manual' | 'merge' | 'webhook',
        webhook_url: '',
        batch_size: 100,
        sync_deletes: false,
        field_mappings: [] as { master_column: string; slave_column: string; transform?: string, is_key_field: boolean }[],
    })

    const [inspectorData, setInspectorData] = useState<{
        isOpen: boolean;
        datasourceId: string | number;
        table: string;
        name: string;
        filters?: any[];
        viewId?: string;
        viewName?: string;
        visibleColumns?: string[];
        pinnedColumns?: string[];
        columnOrder?: string[];
    }>({
        isOpen: false,
        datasourceId: '',
        table: '',
        name: '',
        viewName: '',
        visibleColumns: [],
        pinnedColumns: [],
        columnOrder: []
    });

    const openInspector = (datasourceId: string | number, table: string, filters?: any[], viewId?: string, viewName?: string, visibleColumns?: string[], pinnedColumns?: string[], columnOrder?: string[]) => {
        const ds = datasources.find(d => String(d.id) === String(datasourceId));
        setInspectorData({
            isOpen: true,
            datasourceId,
            table,
            name: ds?.name || 'Datasource',
            filters,
            viewId,
            viewName,
            visibleColumns,
            pinnedColumns,
            columnOrder
        });
    }

    // Table discovery
    const { data: masterTables, isLoading: isLoadingMasterTables } = useQuery({
        queryKey: ['tables', formData.master_datasource_id],
        queryFn: () => datasourcesApi.getTables(formData.master_datasource_id).then(r => r.data),
        enabled: !!formData.master_datasource_id,
    })

    const { data: slaveTables, isLoading: isLoadingSlaveTables } = useQuery({
        queryKey: ['tables', formData.slave_datasource_id],
        queryFn: () => datasourcesApi.getTables(formData.slave_datasource_id).then(r => r.data),
        enabled: !!formData.slave_datasource_id,
    })

    // View discovery
    const { data: masterViews } = useQuery({
        queryKey: ['views', formData.master_datasource_id],
        queryFn: () => viewsApi.list(formData.master_datasource_id).then(r => r.data as DatasourceView[]),
        enabled: !!formData.master_datasource_id,
    })

    const { data: slaveViews } = useQuery({
        queryKey: ['views', formData.slave_datasource_id],
        queryFn: () => viewsApi.list(formData.slave_datasource_id).then(r => r.data as DatasourceView[]),
        enabled: !!formData.slave_datasource_id,
    })

    // Schema discovery
    const { data: masterSchema, isLoading: isLoadingMasterSchema, error: masterSchemaError } = useQuery({
        queryKey: ['schema', formData.master_datasource_id, formData.master_table],
        queryFn: () => datasourcesApi.getTableSchema(formData.master_datasource_id, formData.master_table).then(r => r.data),
        enabled: !!formData.master_datasource_id && !!formData.master_table,
    })

    const { data: slaveSchema, isLoading: isLoadingSlaveSchema, error: slaveSchemaError } = useQuery({
        queryKey: ['schema', formData.slave_datasource_id, formData.slave_table],
        queryFn: () => datasourcesApi.getTableSchema(formData.slave_datasource_id, formData.slave_table).then(r => r.data),
        enabled: !!formData.slave_datasource_id && !!formData.slave_table,
    })

    const createMutation = useMutation({
        mutationFn: (data: typeof formData) => syncConfigsApi.create(data as any),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['sync-configs'] })
            onClose()
        },
    })

    const addMapping = () => {
        setFormData({
            ...formData,
            field_mappings: [
                ...formData.field_mappings,
                { master_column: '', slave_column: '', transform: '', is_key_field: false },
            ],
        })
    }

    const updateMapping = (index: number, field: string, value: string | boolean) => {
        const mappings = [...formData.field_mappings]
        mappings[index] = { ...mappings[index], [field]: value }
        setFormData({ ...formData, field_mappings: mappings })
    }

    const removeMapping = (index: number) => {
        setFormData({
            ...formData,
            field_mappings: formData.field_mappings.filter((_, i) => i !== index),
        })
    }

    const handleAutoMap = () => {
        if (!masterSchema || !slaveSchema) return

        const newMappings = masterSchema.columns.map(mCol => {
            const sCol = slaveSchema.columns.find(sc => sc.name.toLowerCase() === mCol.name.toLowerCase())
            if (sCol) {
                return {
                    master_column: mCol.name,
                    slave_column: sCol.name,
                    is_key_field: mCol.primary_key || sCol.primary_key
                }
            }
            return null
        }).filter(m => m !== null) as any[]

        setFormData({ ...formData, field_mappings: newMappings })
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                    <h2 className="text-xl font-semibold">New Sync Configuration</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 font-bold text-2xl">&times;</button>
                </div>
                <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(formData) }} className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <label className="block text-sm font-medium mb-1">Configuration Name</label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Master Datasource</label>
                            <select
                                value={formData.master_datasource_id}
                                onChange={(e) => setFormData({ ...formData, master_datasource_id: e.target.value, master_table: '' })}
                                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                                required
                            >
                                <option value="">Select...</option>
                                {datasources.map(ds => (
                                    <option key={ds.id} value={ds.id}>{ds.name}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Slave Datasource</label>
                            <select
                                value={formData.slave_datasource_id}
                                onChange={(e) => setFormData({ ...formData, slave_datasource_id: e.target.value, slave_table: '' })}
                                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                                required
                            >
                                <option value="">Select...</option>
                                {datasources.map(ds => (
                                    <option key={ds.id} value={ds.id}>{ds.name}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <label className="block text-sm font-medium">Master Table / Resource</label>
                                {formData.master_table && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const view = masterViews?.find(v => v.id === formData.master_view_id);
                                            openInspector(formData.master_datasource_id, formData.master_table, view?.filters, view?.id, view?.name, view?.visible_columns, view?.pinned_columns, view?.column_order);
                                        }}
                                        className="text-[10px] flex items-center gap-1 text-primary-600 hover:underline"
                                    >
                                        <Eye className="w-3 h-3" /> Inspect Data
                                    </button>
                                )}
                            </div>
                            <div className="relative">
                                <select
                                    value={formData.master_view_id || formData.master_table}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        const view = masterViews?.find(v => v.id === val);
                                        if (view) {
                                            setFormData({ ...formData, master_view_id: view.id, master_table: view.target_table });
                                        } else {
                                            setFormData({ ...formData, master_view_id: null, master_table: val });
                                        }
                                    }}
                                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm"
                                    required
                                    disabled={!formData.master_datasource_id || isLoadingMasterTables}
                                >
                                    <option value="">{isLoadingMasterTables ? 'Loading...' : 'Select source...'}</option>
                                    {masterViews && masterViews.length > 0 && (
                                        <optgroup label="Saved Views">
                                            {masterViews.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                                        </optgroup>
                                    )}
                                    <optgroup label="Tables / Resources">
                                        {masterTables?.map(t => <option key={t} value={t}>{t}</option>)}
                                        <option value="__manual__">+ Custom Resource...</option>
                                    </optgroup>
                                </select>
                            </div>
                            {formData.master_table === '__manual__' && (
                                <input
                                    type="text"
                                    placeholder="Enter resource (e.g. wp/v2/posts)"
                                    onChange={(e) => setFormData({ ...formData, master_table: e.target.value })}
                                    className="mt-2 w-full px-3 py-1.5 text-xs border border-primary-200 dark:border-primary-800 rounded-lg bg-primary-50/50 dark:bg-primary-900/20"
                                />
                            )}
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <label className="block text-sm font-medium">Slave Table / Destination</label>
                                {formData.slave_table && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const view = slaveViews?.find(v => v.id === formData.slave_view_id);
                                            openInspector(formData.slave_datasource_id, formData.slave_table, view?.filters, view?.id, view?.name, view?.visible_columns, view?.pinned_columns, view?.column_order);
                                        }}
                                        className="text-[10px] flex items-center gap-1 text-primary-600 hover:underline"
                                    >
                                        <Eye className="w-3 h-3" /> Inspect Data
                                    </button>
                                )}
                            </div>
                            <div className="relative">
                                <select
                                    value={formData.slave_view_id || formData.slave_table}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        const view = slaveViews?.find(v => v.id === val);
                                        if (view) {
                                            setFormData({ ...formData, slave_view_id: view.id, slave_table: view.target_table });
                                        } else {
                                            setFormData({ ...formData, slave_view_id: null, slave_table: val });
                                        }
                                    }}
                                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm"
                                    required
                                    disabled={!formData.slave_datasource_id || isLoadingSlaveTables}
                                >
                                    <option value="">{isLoadingSlaveTables ? 'Loading...' : 'Select destination...'}</option>
                                    {slaveViews && slaveViews.length > 0 && (
                                        <optgroup label="Saved Views">
                                            {slaveViews.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                                        </optgroup>
                                    )}
                                    <optgroup label="Tables / Resources">
                                        {slaveTables?.map(t => <option key={t} value={t}>{t}</option>)}
                                        <option value="__manual__">+ Custom Resource...</option>
                                    </optgroup>
                                </select>
                            </div>
                            {formData.slave_table === '__manual__' && (
                                <input
                                    type="text"
                                    placeholder="Enter destination (e.g. wp/v2/posts)"
                                    onChange={(e) => setFormData({ ...formData, slave_table: e.target.value })}
                                    className="mt-2 w-full px-3 py-1.5 text-xs border border-primary-200 dark:border-primary-800 rounded-lg bg-primary-50/50 dark:bg-primary-900/20"
                                />
                            )}
                        </div>

                        <div className="col-span-2">
                            <label className="block text-sm font-medium mb-1">Description (Optional)</label>
                            <textarea
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 h-20"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Conflict Strategy</label>
                            <select
                                value={formData.conflict_strategy}
                                onChange={(e) => setFormData({ ...formData, conflict_strategy: e.target.value as any })}
                                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                            >
                                <option value="source_wins">Source Wins</option>
                                <option value="target_wins">Target Wins</option>
                                <option value="manual">Manual Review</option>
                                <option value="merge">Merge</option>
                                <option value="webhook">Webhook</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Batch Size</label>
                            <input
                                type="number"
                                value={formData.batch_size}
                                onChange={(e) => setFormData({ ...formData, batch_size: parseInt(e.target.value) })}
                                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                            />
                        </div>
                    </div>

                    {/* Field Mappings */}
                    <div className="mt-6 border-t border-gray-100 dark:border-gray-700 pt-4">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                    <label className="text-sm font-medium">Field Mappings</label>
                                    {(isLoadingMasterSchema || isLoadingSlaveSchema) && (
                                        <span className="text-[10px] text-gray-400 animate-pulse">Fetching fields...</span>
                                    )}
                                    {masterSchema && slaveSchema && (
                                        <button
                                            type="button"
                                            onClick={handleAutoMap}
                                            className="text-[10px] uppercase tracking-wider font-bold px-2 py-1 bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 rounded hover:bg-primary-100 transition-colors"
                                        >
                                            Auto-map Fields
                                        </button>
                                    )}
                                </div>
                                {(masterSchemaError || slaveSchemaError) && (
                                    <div className="text-[10px] text-red-500 font-medium">
                                        Error fetching fields. Check datasource connection or table permissions.
                                    </div>
                                )}
                                <div className="text-[10px] text-gray-400">
                                    Use <b>Transform</b> for templates: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">{"template:{\"rendered\":\"@value\"}"}</code>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={addMapping}
                                className="text-sm font-medium text-primary-600 hover:text-primary-700"
                            >
                                + Add Field
                            </button>
                        </div>
                        <div className="space-y-3">
                            {formData.field_mappings.map((mapping, index) => (
                                <div key={index} className="flex gap-3 items-center bg-gray-50/50 dark:bg-gray-900/30 p-3 rounded-xl border border-gray-100 dark:border-gray-800">
                                    <div className="flex-1">
                                        <select
                                            value={mapping.master_column}
                                            onChange={(e) => updateMapping(index, 'master_column', e.target.value)}
                                            className="w-full px-2 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                                        >
                                            <option value="">Master field...</option>
                                            {masterSchema?.columns.map(c => <option key={c.name} value={c.name}>{c.name} ({c.type})</option>)}
                                        </select>
                                    </div>
                                    <div className="text-gray-400">→</div>
                                    <div className="flex-1">
                                        <select
                                            value={mapping.slave_column}
                                            onChange={(e) => updateMapping(index, 'slave_column', e.target.value)}
                                            className="w-full px-2 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                                        >
                                            <option value="">Slave field...</option>
                                            {slaveSchema?.columns.map(c => <option key={c.name} value={c.name}>{c.name} ({c.type})</option>)}
                                        </select>
                                    </div>
                                    <div className="flex-[1.5]">
                                        <ExpressionEditor
                                            value={mapping.transform || ''}
                                            onChange={(val: string) => updateMapping(index, 'transform', val)}
                                            variables={masterSchema?.columns.map(c => ({ name: c.name, type: c.type })) || []}
                                            placeholder="Transform (e.g. {{ master.price * 1.2 }})"
                                            className="min-w-[200px]"
                                        />
                                    </div>
                                    <label className="flex items-center gap-1.5 text-xs text-gray-500 whitespace-nowrap bg-white dark:bg-gray-800 px-2 py-1.5 rounded-lg border border-gray-100 dark:border-gray-700">
                                        <input
                                            type="checkbox"
                                            checked={mapping.is_key_field}
                                            onChange={(e) => updateMapping(index, 'is_key_field', e.target.checked)}
                                            className="rounded accent-primary-600"
                                        />
                                        Key
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => removeMapping(index)}
                                        className="text-red-400 hover:text-red-600 p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                        {formData.field_mappings.length === 0 && (
                            <div className="text-center py-8 text-sm text-gray-400 border-2 border-dashed border-gray-100 dark:border-gray-700 rounded-2xl">
                                Select tables above, then map your fields here.
                            </div>
                        )}
                    </div>

                    <div className="flex gap-3 pt-6">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={createMutation.isPending || formData.field_mappings.length === 0}
                            className="flex-1 px-4 py-2.5 bg-primary-600 text-white font-semibold rounded-xl hover:bg-primary-700 transition-colors shadow-lg shadow-primary-600/20 disabled:opacity-50 disabled:shadow-none"
                        >
                            {createMutation.isPending ? 'Saving...' : 'Create Configuration'}
                        </button>
                    </div>
                </form>
                {/* Data Inspector Modal */}
                <DataPreviewModal
                    isOpen={inspectorData.isOpen}
                    onClose={() => setInspectorData({ ...inspectorData, isOpen: false })}
                    datasourceId={inspectorData.datasourceId}
                    table={inspectorData.table}
                    datasourceName={inspectorData.name}
                    initialFilters={inspectorData.filters}
                    viewId={inspectorData.viewId}
                    initialViewName={inspectorData.viewName}
                    initialVisibleColumns={inspectorData.visibleColumns}
                    initialPinnedColumns={inspectorData.pinnedColumns}
                    initialColumnOrder={inspectorData.columnOrder}
                    onViewSaved={(view) => {
                        queryClient.invalidateQueries({ queryKey: ['views'] });
                        queryClient.invalidateQueries({ queryKey: ['datasources'] });
                        // Update inspector state to persist the saved name/ID
                        setInspectorData(curr => ({
                            ...curr,
                            viewId: view.id,
                            viewName: view.name,
                            filters: view.filters,
                            visibleColumns: view.visible_columns,
                            pinnedColumns: view.pinned_columns,
                            columnOrder: view.column_order
                        }));
                    }}
                />
            </div>
        </div>
    )
}
