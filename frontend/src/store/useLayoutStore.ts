import { create } from 'zustand';

interface LayoutState {
    pinnedColumns: string[];
    columnOrder: string[];
    visibleColumns: string[];

    // Actions
    setPinnedColumns: (columns: string[]) => void;
    togglePin: (column: string) => void;
    setColumnOrder: (columns: string[]) => void;
    setVisibleColumns: (columns: string[]) => void;
    toggleVisibility: (column: string, allFields: string[]) => void;

    // Initialize from saved view
    initialize: (config: {
        pinnedColumns?: string[];
        columnOrder?: string[];
        visibleColumns?: string[];
    }) => void;

    // Reset
    reset: () => void;
}

export const useLayoutStore = create<LayoutState>((set) => ({
    pinnedColumns: [],
    columnOrder: [],
    visibleColumns: [],

    setPinnedColumns: (pinnedColumns) => set({ pinnedColumns }),

    togglePin: (column) => set((state) => {
        const isPinned = state.pinnedColumns.includes(column);
        const newPinned = isPinned
            ? state.pinnedColumns.filter((c) => c !== column)
            : [...state.pinnedColumns, column];
        return { pinnedColumns: newPinned };
    }),

    setColumnOrder: (columnOrder) => set({ columnOrder }),

    setVisibleColumns: (visibleColumns) => set({ visibleColumns }),

    toggleVisibility: (column, allFields) => set((state) => {
        let newVisible: string[];
        const current = state.visibleColumns;

        if (current.length === 0) {
            // If none specified, it means all are visible. Hiding one means showing all EXCEPT that one.
            newVisible = allFields.filter(f => f !== column);
        } else if (current.includes(column)) {
            newVisible = current.filter(c => c !== column);
            // Don't allow hiding everything
            if (newVisible.length === 0) newVisible = [allFields[0]];
        } else {
            newVisible = [...current, column];
            // If everything is now visible, reset to empty (shorthand for all)
            if (newVisible.length === allFields.length) newVisible = [];
        }

        return { visibleColumns: newVisible };
    }),

    initialize: (config) => set({
        pinnedColumns: config.pinnedColumns || [],
        columnOrder: config.columnOrder || [],
        visibleColumns: config.visibleColumns || [],
    }),

    reset: () => set({
        pinnedColumns: [],
        columnOrder: [],
        visibleColumns: [],
    }),
}));
