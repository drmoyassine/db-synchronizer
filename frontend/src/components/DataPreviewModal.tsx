import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { datasourcesApi, viewsApi } from '../api';
import { X, Loader2, AlertCircle, Filter, Plus, Trash2, Save, CheckCircle, Table, Copy, RefreshCw, Database, Edit2, Link as LinkIcon } from 'lucide-react';
import { RecordEditor } from './RecordEditor';

interface DataPreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    datasourceId: string | number;
    table: string;
    datasourceName: string;
    onViewSaved?: () => void;
    initialFilters?: { field: string; operator: string; value: string }[];
    viewId?: string;
    initialFieldMappings?: Record<string, string>;
    initialLinkedViews?: Record<string, any>;
}

const DataPreviewModal: React.FC<DataPreviewModalProps> = ({
    isOpen,
    onClose,
    datasourceId,
    table,
    datasourceName,
    onViewSaved,
    initialFilters,
    viewId,
    initialFieldMappings,
    initialLinkedViews
}) => {
    const queryClient = useQueryClient();
    const [filters, setFilters] = React.useState<{ field: string; operator: string; value: string }[]>([]);
    const [viewName, setViewName] = React.useState('');
    const [isSaving, setIsSaving] = React.useState(false);
    const [showSaveForm, setShowSaveForm] = React.useState(false);
    const [saveSuccess, setSaveSuccess] = React.useState(false);
    const [activeTab, setActiveTab] = React.useState<'data' | 'docs' | 'links' | 'recipe'>('data');
    const [copySuccess, setCopySuccess] = React.useState(false);
    const [selectedTable, setSelectedTable] = React.useState(table);
    const [tableSearch, setTableSearch] = React.useState('');
    const [editingRecord, setEditingRecord] = React.useState<any | null>(null);
    const [hoveredRow, setHoveredRow] = React.useState<number | null>(null);
    const [fieldMappings, setFieldMappings] = React.useState<Record<string, string>>(initialFieldMappings || {});
    const [linkedViews, setLinkedViews] = React.useState<Record<string, any>>(initialLinkedViews || {});

    // Drill-down navigation state: 'tables' -> 'records' -> 'editor'
    const [currentStep, setCurrentStep] = React.useState<'tables' | 'records' | 'editor'>('tables');

    const { data: tables } = useQuery({
        queryKey: ['datasourceTables', datasourceId],
        queryFn: () => datasourcesApi.getTables(datasourceId).then(r => r.data),
        enabled: isOpen && !!datasourceId,
    });

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
    };

    // API Base URL for Swagger Docs
    // @ts-ignore
    const API_DOCS_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace('/api', '') + '/docs/views';
    const SWAGGER_ANCHOR = viewId
        ? `#/Views/create_view_record_api_views__view_id__records_post`
        : `#/Views`;

    React.useEffect(() => {
        if (isOpen) {
            setFilters(initialFilters || []);
            setFieldMappings(initialFieldMappings || {});
            setLinkedViews(initialLinkedViews || {});
            setActiveTab('data');
            setSelectedTable(table);

            if (viewId) {
                setCurrentStep('editor');
            } else if (table) {
                setCurrentStep('records');
            } else {
                setCurrentStep('tables');
            }
        }
    }, [isOpen, initialFilters, initialFieldMappings, initialLinkedViews, table, viewId]);

    const { data: schemaData } = useQuery({
        queryKey: ['tableSchema', datasourceId, selectedTable],
        queryFn: () => datasourcesApi.getTableSchema(datasourceId, selectedTable).then(r => r.data),
        enabled: isOpen && !!datasourceId && !!selectedTable,
    });

    const { data, isLoading, error } = useQuery({
        queryKey: ['tableData', datasourceId, selectedTable, filters],
        queryFn: () => datasourcesApi.getTablesData(datasourceId, selectedTable, 20, filters).then(r => r.data),
        enabled: isOpen && !!datasourceId && !!selectedTable,
    });

    const availableFields = React.useMemo(() => {
        const fieldsSet = new Set<string>();
        filters.forEach(f => { if (f.field) fieldsSet.add(f.field); });
        if (schemaData?.columns) schemaData.columns.forEach(col => fieldsSet.add(col.name));
        if (data?.records?.[0]) Object.keys(data.records[0]).forEach(key => fieldsSet.add(key));
        return Array.from(fieldsSet).sort();
    }, [schemaData, data, filters]);

    const addFilter = () => setFilters([...filters, { field: '', operator: '==', value: '' }]);
    const removeFilter = (index: number) => setFilters(filters.filter((_, i) => i !== index));
    const updateFilter = (index: number, field: string, value: string) => {
        const newFilters = [...filters];
        newFilters[index] = { ...newFilters[index], [field]: value };
        setFilters(newFilters);
    };

    const filteredRecords = React.useMemo(() => {
        if (!data?.records) return [];
        if (filters.length === 0) return data.records;
        return data.records.filter(record => {
            return filters.every(f => {
                const val = record[f.field];
                if (!f.field || f.value === '') return true;
                const recordVal = String(val ?? '').toLowerCase();
                const filterVal = f.value.toLowerCase();
                switch (f.operator) {
                    case '==': return recordVal === filterVal;
                    case '!=': return recordVal !== filterVal;
                    case '>': return Number(val) > Number(f.value);
                    case '<': return Number(val) < Number(f.value);
                    case 'contains': return recordVal.includes(filterVal);
                    default: return true;
                }
            });
        });
    }, [data, filters]);

    const handleSaveView = async () => {
        if (!viewName || !selectedTable) return;
        setIsSaving(true);
        try {
            await viewsApi.create(datasourceId, {
                name: viewName,
                target_table: selectedTable,
                filters: filters,
                field_mappings: fieldMappings,
                linked_views: linkedViews
            });
            setShowSaveForm(false);
            setViewName('');
            setSaveSuccess(true);
            onViewSaved?.();
            setTimeout(() => setSaveSuccess(false), 5000);
        } catch (err) {
            console.error('Error saving view:', err);
        } finally {
            setIsSaving(false);
        }
    };

    const refreshSchemaMutation = useMutation({
        mutationFn: () => datasourcesApi.refreshTableSchema(datasourceId, selectedTable),
        onSuccess: (data) => {
            queryClient.setQueryData(['tableSchema', datasourceId, selectedTable], data.data);
        },
    });

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-7xl h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
                {/* Header with Breadcrumbs */}
                <div className="flex flex-col border-b border-gray-100 dark:border-gray-700">
                    <div className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-3">
                            <div className="flex items-center text-sm font-bold text-gray-400">
                                <span
                                    className="hover:text-primary-600 cursor-pointer transition-colors"
                                    onClick={() => setCurrentStep('tables')}
                                >
                                    {datasourceName}
                                </span>
                                {selectedTable && (
                                    <>
                                        <span className="mx-2 opacity-30">/</span>
                                        <span
                                            className={`transition-colors cursor-pointer ${currentStep === 'records' ? 'text-gray-900 dark:text-white' : 'hover:text-primary-600'}`}
                                            onClick={() => setCurrentStep('records')}
                                        >
                                            {selectedTable}
                                        </span>
                                    </>
                                )}
                                {currentStep === 'editor' && (
                                    <>
                                        <span className="mx-2 opacity-30">/</span>
                                        <span className="text-gray-900 dark:text-white">Record View</span>
                                    </>
                                )}
                            </div>
                            {viewId && (
                                <button
                                    onClick={() => copyToClipboard(viewId)}
                                    className="group relative flex items-center gap-1.5 px-2 py-0.5 bg-primary-50 dark:bg-primary-900/40 border border-primary-100 dark:border-primary-800 rounded text-[10px] font-bold text-primary-600 hover:bg-primary-100 transition-all active:scale-95"
                                    title="Click to copy View ID"
                                >
                                    <Copy size={12} className="group-hover:text-primary-700" />
                                    <span>{viewId}</span>
                                    {copySuccess && (
                                        <span className="absolute -right-6 text-green-500 animate-in fade-in slide-in-from-left-2">
                                            <CheckCircle size={12} />
                                        </span>
                                    )}
                                </button>
                            )}
                        </div>
                        {saveSuccess && (
                            <div className="flex-1 max-w-sm mx-4 px-3 py-2 bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 rounded-lg flex items-center gap-2 animate-in slide-in-from-top-2 duration-300">
                                <CheckCircle className="w-4 h-4 text-green-500" />
                                <span className="text-xs font-medium text-green-700 dark:text-green-300">View saved! Webhooks & API configured.</span>
                            </div>
                        )}
                        <div className="flex items-center gap-2">
                            {currentStep !== 'tables' && (
                                <button
                                    onClick={() => setShowSaveForm(!showSaveForm)}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${filters.length > 0 || currentStep === 'editor'
                                        ? 'bg-primary-50 border-primary-200 text-primary-600 hover:bg-primary-100'
                                        : 'bg-gray-50 border-gray-200 text-gray-500 opacity-50 cursor-not-allowed'
                                        }`}
                                    disabled={filters.length === 0 && currentStep !== 'editor'}
                                >
                                    <Save className="w-3.5 h-3.5" />
                                    Save View
                                </button>
                            )}
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                            >
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-hidden flex flex-col">
                    {currentStep === 'tables' ? (
                        <div className="flex-1 p-6 space-y-4 overflow-y-auto">
                            <div className="flex items-center justify-between mb-4">
                                <h4 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-tight">Select Table / Collection</h4>
                                <div className="relative">
                                    <Database className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder="Search tables..."
                                        value={tableSearch}
                                        onChange={(e) => setTableSearch(e.target.value)}
                                        className="pl-9 pr-4 py-1.5 bg-gray-50 dark:bg-gray-700 border-none rounded-lg text-xs focus:ring-2 focus:ring-primary-500 transition-all w-64"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {tables?.filter((t: any) => t.name.toLowerCase().includes(tableSearch.toLowerCase())).map((t: any) => (
                                    <button
                                        key={t.name}
                                        onClick={() => {
                                            setSelectedTable(t.name);
                                            setFilters([]);
                                            setCurrentStep('records');
                                        }}
                                        className="group flex items-center justify-between p-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl hover:border-primary-500 hover:shadow-lg transition-all text-left"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-lg bg-gray-50 dark:bg-gray-700 flex items-center justify-center text-gray-400 group-hover:text-primary-500 group-hover:bg-primary-50 transition-colors">
                                                <Table size={20} />
                                            </div>
                                            <div>
                                                <div className="text-xs font-bold text-gray-900 dark:text-white">{t.name}</div>
                                                <div className="text-[10px] text-gray-500">{t.count} records</div>
                                            </div>
                                        </div>
                                        <RefreshCw className="w-4 h-4 text-gray-300 group-hover:text-primary-500 group-hover:rotate-180 transition-all duration-500" />
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : currentStep === 'editor' ? (
                        <div className="flex-1 overflow-hidden">
                            <RecordEditor
                                record={editingRecord || (data?.records?.[0]) || {}}
                                schema={schemaData}
                                onSave={(mappings) => setFieldMappings(mappings)}
                                onCancel={() => {
                                    setEditingRecord(null);
                                    setCurrentStep('records');
                                }}
                                currentMappings={fieldMappings}
                                datasourceName={datasourceName}
                                tableName={selectedTable}
                            />
                        </div>
                    ) : (
                        <div className="flex-1 flex min-w-0 overflow-hidden">
                            {/* Sidebar */}
                            <div className="w-64 border-r border-gray-100 dark:border-gray-700 bg-gray-50/30 dark:bg-gray-900/10 flex flex-col overflow-hidden">
                                <div className="p-3 border-b border-gray-100 dark:border-gray-700">
                                    <div className="relative">
                                        <Table className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400" />
                                        <input
                                            type="text"
                                            placeholder="Filter tables..."
                                            value={tableSearch}
                                            onChange={(e) => setTableSearch(e.target.value)}
                                            className="w-full pl-8 pr-3 py-2 text-xs bg-white dark:bg-gray-800 border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-primary-500"
                                        />
                                        <button
                                            onClick={() => refreshSchemaMutation.mutate()}
                                            disabled={!selectedTable || refreshSchemaMutation.isPending}
                                            className="absolute right-2 top-2.5 p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-400 hover:text-primary-500 transition-colors disabled:opacity-50"
                                            title="Refresh current table schema"
                                        >
                                            <RefreshCw className={`w-3 h-3 ${refreshSchemaMutation.isPending ? 'animate-spin' : ''}`} />
                                        </button>
                                    </div>
                                </div>
                                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                                    {tables?.filter((t: any) => t.name.toLowerCase().includes(tableSearch.toLowerCase())).map((t: any) => (
                                        <button
                                            key={t.name}
                                            onClick={() => {
                                                setSelectedTable(t.name);
                                                setFilters([]);
                                            }}
                                            className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-all truncate hover:bg-gray-100 dark:hover:bg-gray-800 ${selectedTable === t.name
                                                ? 'bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400'
                                                : 'text-gray-500 dark:text-gray-400'
                                                }`}
                                        >
                                            {t.name}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Main Records Panel */}
                            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                                <div className="flex items-center px-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/10 dark:bg-gray-900/10">
                                    <button onClick={() => setActiveTab('data')} className={`px-4 py-2 text-xs font-bold border-b-2 ${activeTab === 'data' ? 'text-primary-600 border-primary-600' : 'text-gray-400 border-transparent hover:text-gray-600'}`}>Data Preview</button>
                                    <button onClick={() => setActiveTab('links')} className={`px-4 py-2 text-xs font-bold border-b-2 ${activeTab === 'links' ? 'text-primary-600 border-primary-600' : 'text-gray-400 border-transparent hover:text-gray-600'}`}>Linked Records</button>
                                    <button onClick={() => setActiveTab('recipe')} className={`px-4 py-2 text-xs font-bold border-b-2 ${activeTab === 'recipe' ? 'text-primary-600 border-primary-600' : 'text-gray-400 border-transparent hover:text-gray-600'}`}>Recipes</button>
                                    <button onClick={() => setActiveTab('docs')} className={`px-4 py-2 text-xs font-bold border-b-2 ${activeTab === 'docs' ? 'text-primary-600 border-primary-600' : 'text-gray-400 border-transparent hover:text-gray-600'}`}>API Logic</button>
                                </div>

                                <div className="flex-1 overflow-auto">
                                    {activeTab === 'data' ? (
                                        <div className="flex flex-col h-full overflow-hidden">
                                            <div className="p-4 bg-gray-50/50 dark:bg-gray-900/20 border-b border-gray-100 dark:border-gray-700/50">
                                                <div className="flex flex-wrap items-center gap-3">
                                                    <div className="flex items-center gap-1.5 text-xs font-bold text-gray-400 uppercase tracking-tight"><Filter className="w-3.5 h-3.5" /> Filters</div>
                                                    {filters.map((filter, index) => (
                                                        <div key={index} className="flex items-center gap-1 p-1 bg-white dark:bg-gray-800 border border-gray-200 rounded-lg shadow-sm">
                                                            <select value={filter.field} onChange={(e) => updateFilter(index, 'field', e.target.value)} className="w-32 px-2 py-1 text-xs bg-transparent outline-none font-medium appearance-none cursor-pointer">
                                                                <option value="">Select Field</option>
                                                                {availableFields.map(f => <option key={f} value={f}>{f}</option>)}
                                                            </select>
                                                            <select value={filter.operator} onChange={(e) => updateFilter(index, 'operator', e.target.value)} className="px-1 py-1 text-[10px] font-mono text-primary-600">
                                                                <option value="==">==</option>
                                                                <option value="!=">!=</option>
                                                                <option value=">">&gt;</option>
                                                                <option value="<">&lt;</option>
                                                                <option value="contains">contains</option>
                                                            </select>
                                                            <input type="text" placeholder="value" value={filter.value} onChange={(e) => updateFilter(index, 'value', e.target.value)} className="w-32 px-2 py-1 text-xs bg-transparent outline-none border-l border-gray-100 ml-1" />
                                                            <button onClick={() => removeFilter(index)} className="ml-1 p-1 hover:text-red-500 transition-colors"><Trash2 size={12} /></button>
                                                        </div>
                                                    ))}
                                                    <button onClick={addFilter} className="flex items-center gap-1 px-2 py-1 text-xs font-semibold text-primary-600 hover:bg-primary-50 rounded-lg"><Plus size={14} /> Add Filter</button>
                                                </div>
                                                {showSaveForm && (
                                                    <div className="mt-4 p-4 bg-primary-50 dark:bg-primary-900/20 border border-primary-100 rounded-xl flex items-center gap-4">
                                                        <div className="flex-1">
                                                            <label className="block text-xs font-bold text-primary-700 mb-1">View Name</label>
                                                            <input type="text" value={viewName} onChange={(e) => setViewName(e.target.value)} placeholder="View name..." className="w-full px-3 py-2 text-sm bg-white border border-primary-200 rounded-lg outline-none" />
                                                        </div>
                                                        <div className="flex items-end gap-2 pt-5">
                                                            <button onClick={handleSaveView} disabled={isSaving || !viewName} className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold rounded-lg">{isSaving ? 'Saving...' : 'Confirm Save'}</button>
                                                            <button onClick={() => setShowSaveForm(false)} className="px-4 py-2 bg-gray-100 rounded-lg text-xs font-bold">Cancel</button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-1 overflow-auto p-4">
                                                {isLoading ? (
                                                    <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-2"><Loader2 className="animate-spin" /><p className="text-xs">Loading...</p></div>
                                                ) : error ? (
                                                    <div className="h-full flex flex-col items-center justify-center text-red-500 gap-2"><AlertCircle /><p className="text-xs">Error loading data.</p></div>
                                                ) : (
                                                    <div className="border border-gray-100 dark:border-gray-700 rounded-xl overflow-hidden">
                                                        <table className="w-full text-left border-collapse">
                                                            <thead className="bg-gray-50/50 dark:bg-gray-900/50">
                                                                <tr>
                                                                    {data?.records?.[0] && Object.keys(data.records[0]).map(key => (
                                                                        <th key={key} className="px-4 py-3 text-[10px] font-bold uppercase text-gray-400 border-b border-gray-100 whitespace-nowrap">{key}</th>
                                                                    ))}
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {filteredRecords.map((record, i) => (
                                                                    <tr key={i} onMouseEnter={() => setHoveredRow(i)} onMouseLeave={() => setHoveredRow(null)} className="hover:bg-gray-50/50 dark:hover:bg-gray-900/20 transition-colors relative">
                                                                        {Object.values(record).map((value: any, j) => (
                                                                            <td key={j} className="px-4 py-3 text-xs text-gray-600 dark:text-gray-300 border-b border-gray-50 max-w-xs truncate">
                                                                                {typeof value === 'object' ? JSON.stringify(value) : String(value ?? '')}
                                                                            </td>
                                                                        ))}
                                                                        {hoveredRow === i && (
                                                                            <td className="sticky right-0 top-0 h-full flex items-center pr-4 z-20">
                                                                                <button onClick={() => { setEditingRecord(record); setCurrentStep('editor'); }} className="p-1.5 bg-white border border-gray-200 shadow-lg rounded-lg text-primary-600 hover:scale-110 transition-all"><Edit2 size={14} /></button>
                                                                            </td>
                                                                        )}
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ) : activeTab === 'links' ? (
                                        <div className="p-6">
                                            <h4 className="text-sm font-bold mb-2 uppercase">Linked Records</h4>
                                            <div className="grid gap-3">
                                                {Object.entries(linkedViews).map(([key, config]) => (
                                                    <div key={key} className="p-3 border border-gray-100 rounded-xl flex items-center justify-between">
                                                        <div className="flex items-center gap-3"><LinkIcon size={16} /><div><div className="text-[10px] font-bold">{key}</div><div className="text-[9px] text-gray-400">{config.view_id}</div></div></div>
                                                        <button onClick={() => { const { [key]: _, ...rest } = linkedViews; setLinkedViews(rest); }} className="text-gray-300 hover:text-red-500"><Trash2 size={14} /></button>
                                                    </div>
                                                ))}
                                                <button onClick={() => {
                                                    const k = prompt("Field (e.g. acf):"); if (!k) return;
                                                    const v = prompt("View UUID:"); if (!v) return;
                                                    setLinkedViews(p => ({ ...p, [k]: { view_id: v, join_on: 'id', target_key: 'id' } }));
                                                }} className="p-4 border-2 border-dashed border-gray-100 rounded-xl text-gray-400 text-xs hover:border-primary-500 hover:text-primary-600 transition-all">+ Add Linked Data View</button>
                                            </div>
                                        </div>
                                    ) : activeTab === 'recipe' ? (
                                        <div className="p-6 h-full flex flex-col"><h4 className="text-sm font-bold mb-4 uppercase">Recipes</h4><div className="flex-1 bg-gray-50 rounded-xl p-4 font-mono text-[11px] opacity-50 relative"><div className="absolute top-4 right-4 text-[10px] font-bold text-primary-600 bg-primary-50 px-2 py-1 rounded">COMING SOON</div><pre>query {'{\n  posts {\n    title\n    content\n  }\n}'}</pre></div></div>
                                    ) : (
                                        <div className="h-full flex flex-col">
                                            <div className="p-3 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between"><span className="text-[10px] font-bold text-gray-400">REST API</span><code className="text-[10px] text-primary-600 font-mono italic">endpoint: /api/views/{viewId || '{id}'}/records</code></div>
                                            <iframe src={`${API_DOCS_URL}${viewId ? `?id=${viewId}` : ''}${SWAGGER_ANCHOR}`} className="flex-1 w-full border-none" />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 bg-gray-50 dark:bg-gray-900/40 border-t border-gray-100 dark:border-gray-700 flex justify-end items-center gap-4">
                    <p className="text-[10px] text-gray-400 italic">Advanced sync engine processes mappings securely on the server.</p>
                    <button onClick={onClose} className="px-6 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg text-sm font-bold transition-colors">Close</button>
                </div>
            </div>
        </div>
    );
};

export default DataPreviewModal;
