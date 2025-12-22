import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { datasourcesApi, viewsApi } from '../api';
import { X, Loader2, AlertCircle, Filter, Plus, Trash2, Save, CheckCircle, Table, BookOpen, Copy, RefreshCw, Database, Edit2, Link as LinkIcon } from 'lucide-react';
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

    // API Base URL for Swagger Docs (Point to refined View Docs)
    // @ts-ignore
    const API_DOCS_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace('/api', '') + '/docs/views';
    const SWAGGER_ANCHOR = viewId
        ? `#/Views/create_view_record_api_views__view_id__records_post`
        : `#/Views`;

    // Sync filters with initialFilters when modal opens
    React.useEffect(() => {
        if (isOpen) {
            setFilters(initialFilters || []);
            setFieldMappings(initialFieldMappings || {});
            setLinkedViews(initialLinkedViews || {});
            setActiveTab('data'); // Reset to data tab on open
            setSelectedTable(table);
        }
    }, [isOpen, initialFilters, initialFieldMappings, initialLinkedViews, table]);

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

        // Always include fields from current filters (ensures saved filters persist)
        filters.forEach(f => {
            if (f.field) fieldsSet.add(f.field);
        });

        // Add schema columns
        if (schemaData?.columns && schemaData.columns.length > 0) {
            schemaData.columns.forEach(col => fieldsSet.add(col.name));
        }

        // Add fields from data records if no schema
        if (data?.records?.[0]) {
            Object.keys(data.records[0]).forEach(key => fieldsSet.add(key));
        }

        return Array.from(fieldsSet).sort();
    }, [schemaData, data, filters]);

    const addFilter = () => {
        setFilters([...filters, { field: '', operator: '==', value: '' }]);
    };

    const removeFilter = (index: number) => {
        setFilters(filters.filter((_, i) => i !== index));
    };

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

    const handleSaveMappings = (mappings: Record<string, string>) => {
        setFieldMappings(mappings);
        setEditingRecord(null);
    };

    const refreshSchemaMutation = useMutation({
        mutationFn: () => datasourcesApi.refreshTableSchema(datasourceId, selectedTable),
        onSuccess: (data) => {
            queryClient.setQueryData(['tableSchema', datasourceId, selectedTable], data.data);
            // Optionally show a toast or small indicator
        },
    });

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="flex flex-col border-b border-gray-100 dark:border-gray-700">
                    <div className="flex items-center justify-between p-4">
                        <div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <span>Data Inspector</span>
                                <span className="text-xs font-normal px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-gray-500">
                                    {datasourceName} {selectedTable && `» ${selectedTable}`}
                                </span>
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
                            </h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                Showing {filteredRecords.length} of {data?.total || 0} total records matching filters.
                            </p>
                        </div>
                        {saveSuccess && (
                            <div className="flex-1 max-w-sm mx-4 px-3 py-2 bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 rounded-lg flex items-center gap-2 animate-in slide-in-from-top-2 duration-300">
                                <CheckCircle className="w-4 h-4 text-green-500" />
                                <span className="text-xs font-medium text-green-700 dark:text-green-300">View saved! You can now use it in Sync Configs.</span>
                            </div>
                        )}
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setShowSaveForm(!showSaveForm)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${filters.length > 0
                                    ? 'bg-primary-50 border-primary-200 text-primary-600 hover:bg-primary-100'
                                    : 'bg-gray-50 border-gray-200 text-gray-500 opacity-50 cursor-not-allowed'
                                    }`}
                                disabled={filters.length === 0}
                            >
                                <Save className="w-3.5 h-3.5" />
                                Save as View
                            </button>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                            >
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>
                    </div>

                    {/* Tab Navigation */}
                    <div className="flex items-center px-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/10 dark:bg-gray-900/10">
                        <button
                            onClick={() => setActiveTab('data')}
                            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold transition-all border-b-2 ${activeTab === 'data'
                                ? 'text-primary-600 border-primary-600'
                                : 'text-gray-400 border-transparent hover:text-gray-600'
                                }`}
                        >
                            <Table className="w-3.5 h-3.5" />
                            Data Preview
                        </button>
                        <button
                            onClick={() => setActiveTab('links')}
                            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold transition-all border-b-2 ${activeTab === 'links'
                                ? 'text-primary-600 border-primary-600'
                                : 'text-gray-400 border-transparent hover:text-gray-600'
                                }`}
                        >
                            <LinkIcon className="w-3.5 h-3.5" />
                            Linked Records
                        </button>
                        <button
                            onClick={() => setActiveTab('recipe')}
                            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold transition-all border-b-2 ${activeTab === 'recipe'
                                ? 'text-primary-600 border-primary-600'
                                : 'text-gray-400 border-transparent hover:text-gray-600'
                                }`}
                        >
                            <RefreshCw className="w-3.5 h-3.5" />
                            Recipes
                        </button>
                        <button
                            onClick={() => setActiveTab('docs')}
                            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold transition-all border-b-2 ${activeTab === 'docs'
                                ? 'text-primary-600 border-primary-600'
                                : 'text-gray-400 border-transparent hover:text-gray-600'
                                }`}
                        >
                            <BookOpen className="w-3.5 h-3.5" />
                            API Documentation
                        </button>
                    </div>

                    {/* Filter Builder Panel - Only show in Data tab */}
                    {activeTab === 'data' && (
                        <div className="bg-gray-50/50 dark:bg-gray-900/20 p-4 pt-0 border-t border-gray-100 dark:border-gray-700/50">
                            <div className="flex flex-wrap items-center gap-3 mt-4">
                                <div className="flex items-center gap-1.5 text-xs font-bold text-gray-400 uppercase tracking-tight">
                                    <Filter className="w-3.5 h-3.5" />
                                    Filters
                                </div>

                                {filters.map((filter, index) => (
                                    <div key={index} className="flex items-center gap-1 p-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm animate-in slide-in-from-left-2 duration-200">
                                        <select
                                            value={filter.field}
                                            onChange={(e) => updateFilter(index, 'field', e.target.value)}
                                            className="w-32 px-2 py-1 text-xs bg-transparent outline-none font-medium appearance-none cursor-pointer"
                                        >
                                            <option value="">Select Field</option>
                                            {availableFields.map(fieldName => (
                                                <option key={fieldName} value={fieldName}>{fieldName}</option>
                                            ))}
                                        </select>

                                        <select
                                            value={filter.operator}
                                            onChange={(e) => updateFilter(index, 'operator', e.target.value)}
                                            className="px-1 py-1 text-[10px] font-mono bg-gray-50 dark:bg-gray-700 rounded outline-none border-none cursor-pointer text-primary-600"
                                        >
                                            <option value="==">==</option>
                                            <option value="!=">!=</option>
                                            <option value=">">&gt;</option>
                                            <option value="<">&lt;</option>
                                            <option value="contains">contains</option>
                                        </select>

                                        <input
                                            type="text"
                                            placeholder="value"
                                            value={filter.value}
                                            onChange={(e) => updateFilter(index, 'value', e.target.value)}
                                            className="w-32 px-2 py-1 text-xs bg-transparent outline-none border-l border-gray-100 dark:border-gray-700 ml-1"
                                        />
                                        <button
                                            onClick={() => removeFilter(index)}
                                            className="ml-1 p-1 hover:text-red-500 transition-colors"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))}

                                <button
                                    onClick={addFilter}
                                    className="flex items-center gap-1 px-2 py-1 text-xs font-semibold text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/30 rounded-lg transition-colors"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    Add Filter
                                </button>
                            </div>

                            {showSaveForm && (
                                <div className="mt-4 p-4 bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800 rounded-xl flex items-center gap-4 animate-in slide-in-from-top-2 duration-300">
                                    <div className="flex-1">
                                        <label className="block text-xs font-bold text-primary-700 dark:text-primary-300 mb-1">View Name</label>
                                        <input
                                            type="text"
                                            value={viewName}
                                            onChange={(e) => setViewName(e.target.value)}
                                            placeholder="e.g. Filtered Institutions"
                                            className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-primary-200 dark:border-primary-700 rounded-lg outline-none focus:ring-2 focus:ring-primary-500"
                                        />
                                    </div>
                                    <div className="flex items-end gap-2 pt-5">
                                        <button
                                            onClick={handleSaveView}
                                            disabled={isSaving || !viewName}
                                            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
                                        >
                                            {isSaving ? 'Saving...' : 'Confirm Save'}
                                        </button>
                                        <button
                                            onClick={() => setShowSaveForm(false)}
                                            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 text-xs font-bold rounded-lg transition-colors"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Content Area */}
                <div className="flex-1 flex overflow-hidden">
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
                                    className="w-full pl-8 pr-3 py-2 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:ring-1 focus:ring-primary-500"
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
                            {tables?.filter(t => t.toLowerCase().includes(tableSearch.toLowerCase())).map(tableName => (
                                <button
                                    key={tableName}
                                    onClick={() => {
                                        setSelectedTable(tableName);
                                        setFilters([]); // Reset filters when switching tables
                                    }}
                                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-all truncate hover:bg-gray-100 dark:hover:bg-gray-800 ${selectedTable === tableName
                                        ? 'bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400'
                                        : 'text-gray-500 dark:text-gray-400'
                                        }`}
                                    title={tableName}
                                >
                                    {tableName}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Main Panel */}
                    <div className="flex-1 overflow-auto p-4 flex flex-col min-h-0">
                        {!selectedTable ? (
                            <div className="flex-1 flex flex-col items-center justify-center h-full gap-4 text-gray-500 text-center">
                                <Database className="w-16 h-16 opacity-10" />
                                <div className="space-y-1">
                                    <p className="text-sm font-bold">No table selected</p>
                                    <p className="text-xs opacity-60">Select a table/resource from the sidebar to inspect data.</p>
                                </div>
                            </div>
                        ) : (
                            <>
                                {activeTab === 'data' ? (
                                    <>
                                        {isLoading ? (
                                            <div className="flex-1 flex flex-col items-center justify-center h-full min-h-[300px] gap-3 text-gray-500">
                                                <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
                                                <p className="text-sm font-medium">Fetching sample data...</p>
                                            </div>
                                        ) : error ? (
                                            <div className="flex-1 flex flex-col items-center justify-center h-full min-h-[300px] gap-3 text-red-500 text-center max-w-md mx-auto">
                                                <AlertCircle className="w-12 h-12" />
                                                <p className="font-bold">Failed to load data</p>
                                                <p className="text-sm opacity-90">{(error as any)?.response?.data?.detail || 'An unexpected error occurred while fetching samples.'}</p>
                                            </div>
                                        ) : !filteredRecords || filteredRecords.length === 0 ? (
                                            <div className="flex-1 flex flex-col items-center justify-center h-full min-h-[300px] gap-3 text-gray-500 text-center">
                                                <Filter className="w-12 h-12 opacity-20 mx-auto" />
                                                <p className="text-sm font-medium">No records match your filters.</p>
                                                <p className="text-xs opacity-60 max-w-xs mx-auto">Try adjusting your filters or search terms to find what you're looking for.</p>
                                            </div>
                                        ) : (
                                            <div className="overflow-x-auto border border-gray-100 dark:border-gray-700 rounded-lg">
                                                <table className="w-full text-left border-collapse">
                                                    <thead className="bg-gray-50 dark:bg-gray-900/50 sticky top-0 z-10">
                                                        <tr>
                                                            {Object.keys(filteredRecords[0]).map(key => (
                                                                <th key={key} className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-gray-500 border-b border-gray-100 dark:border-gray-700 whitespace-nowrap">
                                                                    {key}
                                                                </th>
                                                            ))}
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {filteredRecords.map((record, i) => (
                                                            <tr
                                                                key={i}
                                                                onMouseEnter={() => setHoveredRow(i)}
                                                                onMouseLeave={() => setHoveredRow(null)}
                                                                className="hover:bg-gray-50/50 dark:hover:bg-gray-900/20 transition-colors relative"
                                                            >
                                                                {Object.values(record).map((value: any, j) => (
                                                                    <td key={j} className="px-4 py-3 text-xs text-gray-600 dark:text-gray-300 border-b border-gray-50 dark:border-gray-700/50 max-w-xs truncate">
                                                                        {value === null ? (
                                                                            <span className="text-gray-400 italic">null</span>
                                                                        ) : typeof value === 'object' ? (
                                                                            <span className="text-primary-500 font-medium font-mono text-[10px] truncate block" title={JSON.stringify(value, null, 2)}>
                                                                                {JSON.stringify(value)}
                                                                            </span>
                                                                        ) : (
                                                                            String(value)
                                                                        )}
                                                                    </td>
                                                                ))}
                                                                {hoveredRow === i && (
                                                                    <td className="sticky right-0 top-0 h-full flex items-center pr-4 bg-gradient-to-l from-gray-50 dark:from-gray-900 to-transparent z-20">
                                                                        <button
                                                                            onClick={() => setEditingRecord(record)}
                                                                            className="p-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 shadow-lg rounded-lg text-primary-600 hover:text-primary-700 hover:scale-110 transition-all animate-in fade-in slide-in-from-right-2"
                                                                            title="Edit record mappings"
                                                                        >
                                                                            <Edit2 size={14} />
                                                                        </button>
                                                                    </td>
                                                                )}
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </>
                                ) : activeTab === 'links' ? (
                                    <div className="flex-1 flex flex-col p-6 space-y-4 overflow-y-auto">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h4 className="text-sm font-bold text-gray-900 dark:text-white">Linked Records (joins)</h4>
                                                <p className="text-xs text-gray-500">Cross-source data is automatically merged via the backend.</p>
                                            </div>
                                            <button
                                                className="px-3 py-1.5 bg-primary-600 text-white rounded-lg text-xs font-bold hover:bg-primary-700 flex items-center gap-2"
                                                onClick={() => {
                                                    const key = prompt("Field name for joined data (e.g. acf):");
                                                    if (!key) return;
                                                    const vId = prompt("Linked View UUID:");
                                                    if (!vId) return;
                                                    setLinkedViews(prev => ({
                                                        ...prev,
                                                        [key]: { view_id: vId, join_on: 'id', target_key: 'id' }
                                                    }));
                                                }}
                                            >
                                                <Plus size={14} /> Add Link
                                            </button>
                                        </div>

                                        <div className="grid gap-3">
                                            {Object.entries(linkedViews).map(([key, config]) => (
                                                <div key={key} className="p-3 border border-gray-100 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 shadow-sm flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded bg-primary-50 dark:bg-primary-900/40 flex items-center justify-center text-primary-600">
                                                            <LinkIcon size={16} />
                                                        </div>
                                                        <div>
                                                            <div className="text-[10px] font-bold text-gray-900 dark:text-white uppercase tracking-wider">{key}</div>
                                                            <div className="text-[9px] text-gray-400 font-mono">{config.view_id}</div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-4">
                                                        <div className="text-[10px] text-gray-400 px-2 py-0.5 bg-gray-50 dark:bg-gray-700/50 rounded">
                                                            ID: <span className="font-mono text-primary-600">{config.join_on}</span>
                                                        </div>
                                                        <button
                                                            onClick={() => {
                                                                const { [key]: _, ...rest } = linkedViews;
                                                                setLinkedViews(rest);
                                                            }}
                                                            className="p-1 hover:bg-red-50 text-gray-300 hover:text-red-500 rounded transition-colors"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                            {Object.keys(linkedViews).length === 0 && (
                                                <div className="py-12 text-center border-2 border-dashed border-gray-50 dark:border-gray-800 rounded-2xl">
                                                    <LinkIcon className="mx-auto w-8 h-8 text-gray-200 mb-2" />
                                                    <p className="text-xs text-gray-400">No linked views configured.</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ) : activeTab === 'recipe' ? (
                                    <div className="flex-1 flex flex-col p-6 space-y-4 overflow-y-auto">
                                        <h4 className="text-sm font-bold text-gray-900 dark:text-white">GraphQL Recipes</h4>
                                        <div className="flex-1 bg-gray-50 dark:bg-gray-900 rounded-xl p-4 font-mono text-xs relative">
                                            <div className="absolute top-4 right-4 text-[10px] font-bold text-primary-600 bg-primary-50 px-2 py-1 rounded">COMING SOON</div>
                                            <p className="text-gray-400 italic mb-4"># WordPress GraphQL targets only</p>
                                            <textarea
                                                readOnly
                                                className="w-full h-full bg-transparent border-none focus:ring-0 text-gray-300 resize-none opacity-50"
                                                value={`query {
  posts {
    title
    content
    author {
      name
    }
  }
}`}
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex-1 flex flex-col overflow-hidden">
                                        <div className="bg-white dark:bg-gray-800 p-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                                            <span className="text-xs font-semibold text-gray-500 uppercase tracking-tight">Interactive Swagger UI</span>
                                            <div className="flex items-center gap-2">
                                                <code className="text-[10px] bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded text-primary-600 font-mono">
                                                    POST /api/views/<span className="font-bold underline">{viewId || '{view_id}'}</span>/records
                                                </code>
                                                <button
                                                    onClick={() => viewId && copyToClipboard(viewId)}
                                                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                                                    title="Copy View ID"
                                                >
                                                    <Copy className="w-3 h-3 text-gray-400" />
                                                </button>
                                                <a
                                                    href={`${API_DOCS_URL}${viewId ? `?id=${viewId}` : ''}${SWAGGER_ANCHOR}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-[10px] font-bold text-primary-600 hover:underline border-l border-gray-100 dark:border-gray-700 pl-2 ml-1"
                                                >
                                                    Open Full Page
                                                </a>
                                            </div>
                                        </div>
                                        <iframe
                                            src={`${API_DOCS_URL}${viewId ? `?id=${viewId}` : ''}${SWAGGER_ANCHOR}`}
                                            className="flex-1 w-full border-none h-full"
                                            title="Swagger Documentation"
                                        />
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* Record Editor Overlay Sidebar */}
                    {editingRecord && (
                        <div className="w-[450px] border-l border-gray-100 dark:border-gray-700 shadow-2xl z-30 bg-white dark:bg-gray-800 animate-in slide-in-from-right-8 duration-300 overflow-hidden flex flex-col">
                            <RecordEditor
                                record={editingRecord}
                                schema={schemaData}
                                onSave={handleSaveMappings}
                                onCancel={() => setEditingRecord(null)}
                                currentMappings={fieldMappings}
                                datasourceName={datasourceName}
                                tableName={selectedTable}
                            />
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 bg-gray-50 dark:bg-gray-900/30 border-t border-gray-100 dark:border-gray-700 flex justify-end items-center gap-4">
                    <p className="text-[10px] text-gray-400 italic">
                        Tip: You can use dot-notation (e.g. <code>acf.my_field</code>) to map nested object properties.
                    </p>
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg text-sm font-semibold transition-colors"
                    >
                        Close Inspector
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DataPreviewModal;
