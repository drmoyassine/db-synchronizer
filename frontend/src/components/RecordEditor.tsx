import React from 'react';
import { ExpressionEditor } from './ExpressionEditor';
import { X, Save, Info, Link as LinkIcon, Plus } from 'lucide-react';
import { TableSchema } from '../types';

interface RecordEditorProps {
    record: any;
    schema?: TableSchema;
    onSave: (fieldMappings: Record<string, string>) => void;
    onCancel: () => void;
    currentMappings?: Record<string, string>;
    datasourceName: string;
    tableName: string;
}

export const RecordEditor: React.FC<RecordEditorProps> = ({
    record,
    schema,
    onSave,
    onCancel,
    currentMappings = {},
    datasourceName,
    tableName
}) => {
    const [mappings, setMappings] = React.useState<Record<string, string>>(currentMappings);

    const fields = React.useMemo(() => {
        if (schema?.columns) {
            return schema.columns.map(col => col.name);
        }
        return Object.keys(record);
    }, [schema, record]);

    const handleSave = () => {
        onSave(mappings);
    };

    return (
        <div className="flex flex-col h-full bg-white dark:bg-gray-800 animate-in slide-in-from-right-4 duration-300">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-700">
                <div>
                    <h4 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <LinkIcon className="w-4 h-4 text-primary-500" />
                        Record Mapper & Transformer
                    </h4>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">
                        {datasourceName} » {tableName}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleSave}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold rounded-lg transition-all"
                    >
                        <Save className="w-3.5 h-3.5" />
                        Save Mappings
                    </button>
                    <button
                        onClick={onCancel}
                        className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                    >
                        <X className="w-4 h-4 text-gray-400" />
                    </button>
                </div>
            </div>

            {/* Sub-header / Tip */}
            <div className="px-4 py-2 bg-primary-50 dark:bg-primary-900/20 border-b border-primary-100 dark:border-primary-800 flex items-center gap-2">
                <Info className="w-3 h-3 text-primary-600" />
                <span className="text-[10px] font-medium text-primary-700 dark:text-primary-300">
                    Map source fields to target sync values. Use <code>{`{{ field }}`}</code> to reference values or <code>@jinja</code> for transformations.
                </span>
            </div>

            {/* Field List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {fields.map(fieldName => (
                    <div key={fieldName} className="group flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                            <label className="text-[11px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-tight flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-primary-400"></span>
                                {fieldName}
                            </label>
                            <span className="text-[10px] font-mono text-gray-400 bg-gray-50 dark:bg-gray-900 px-1.5 py-0.5 rounded">
                                Original: {String(record[fieldName] ?? 'null')}
                            </span>
                        </div>

                        <div className="relative">
                            <ExpressionEditor
                                value={mappings[fieldName] || `{{ ${fieldName} }}`}
                                onChange={(val) => setMappings(prev => ({ ...prev, [fieldName]: val }))}
                                placeholder={`Mapping for ${fieldName}...`}
                                className="min-h-[40px] text-sm"
                                variables={fields.map(f => ({
                                    name: f,
                                    label: f,
                                    type: typeof record[f] === 'number' ? 'number' : 'string'
                                }))}
                            />
                        </div>
                    </div>
                ))}

                <button className="w-full py-3 border-2 border-dashed border-gray-100 dark:border-gray-700 rounded-xl flex items-center justify-center gap-2 text-gray-400 hover:text-primary-500 hover:border-primary-200 transition-all text-xs font-medium">
                    <Plus className="w-4 h-4" />
                    Add Custom Computed Field
                </button>
            </div>
        </div>
    );
};
