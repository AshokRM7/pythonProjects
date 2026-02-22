import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Check, Search, ChevronRight } from 'lucide-react';

export interface FilterOption {
    value: string;
    label: string;
    children?: FilterOption[]; // Support hierarchical options
}

interface MultiSelectDropdownProps {
    label: string;
    options: FilterOption[];
    selectedValues: string[];
    onChange: (values: string[]) => void;
}

export const MultiSelectDropdown: React.FC<MultiSelectDropdownProps> = ({
    label,
    options,
    selectedValues,
    onChange,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [expandedCategories, setExpandedCategories] = useState<string[]>([]); // Default all closed
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const findOption = (opts: FilterOption[], value: string): FilterOption | undefined => {
        for (const opt of opts) {
            if (opt.value === value) return opt;
            if (opt.children) {
                const found = findOption(opt.children, value);
                if (found) return found;
            }
        }
        return undefined;
    };

    const getLeafValues = (option: FilterOption): string[] => {
        if (!option.children || option.children.length === 0) {
            return [option.value];
        }
        return option.children.flatMap(getLeafValues);
    };

    const allLeafOptions = useMemo(() => {
        return options.filter(o => o.value !== 'all').flatMap(getLeafValues);
    }, [options]);

    // Derived state for "All" selection
    const { isAllSelected, isIndeterminateAll, totalSelectedCount } = useMemo(() => {
        const allExplicitlySelected = selectedValues.includes('all');
        const allLeafsSelected = allLeafOptions.length > 0 && allLeafOptions.every(v => selectedValues.includes(v));

        const currentIsAllSelected = allExplicitlySelected || allLeafsSelected;

        // Count unique leaf values selected (if 'all' is not there)
        const selectedCount = allExplicitlySelected ? allLeafOptions.length : selectedValues.filter(v => v !== 'all').length;

        const currentIsIndeterminateAll = !currentIsAllSelected && selectedCount > 0;

        return {
            isAllSelected: currentIsAllSelected,
            isIndeterminateAll: currentIsIndeterminateAll,
            totalSelectedCount: selectedCount
        };
    }, [allLeafOptions, selectedValues]);

    const handleToggle = (value: string) => {
        if (value === 'all') {
            if (isAllSelected) {
                onChange([]); // Deselect all
            } else {
                onChange(['all']); // Select all
            }
            return;
        }

        const option = findOption(options, value);
        if (!option) return;

        // If "all" is currently selected, treat it as if all individual leaf values are in the list
        let currentEffectiveValues = selectedValues.includes('all')
            ? [...allLeafOptions]
            : [...selectedValues];

        // Ensure we remove 'all' from the explicit list if it was there
        currentEffectiveValues = currentEffectiveValues.filter(v => v !== 'all');

        const valuesToToggle = getLeafValues(option);
        const allToggledSelected = valuesToToggle.every(v => currentEffectiveValues.includes(v));

        let newValues: string[];
        if (allToggledSelected) {
            // Deselect all leaf values of this option
            newValues = currentEffectiveValues.filter(v => !valuesToToggle.includes(v));
        } else {
            // Select all leaf values of this option
            newValues = Array.from(new Set([...currentEffectiveValues, ...valuesToToggle]));
        }

        // Check if all items are now selected
        const allNowSelected = allLeafOptions.length > 0 && allLeafOptions.every(v => newValues.includes(v));
        if (allNowSelected) {
            newValues = ['all'];
        }

        // If nothing selected, you can either keep it empty or default back to all. 
        // Let's keep it as is. If empty, it's just empty. 
        // But for this specific requirement, if we want it to always have at least one or default to all:
        // if (newValues.length === 0) newValues = ['all'];

        onChange(newValues);
    };

    const toggleExpand = (value: string) => {
        setExpandedCategories(prev =>
            prev.includes(value)
                ? prev.filter(v => v !== value)
                : [...prev, value]
        );
    };

    const matchesSearch = (option: FilterOption, term: string): boolean => {
        if (option.label.toLowerCase().includes(term.toLowerCase())) return true;
        if (option.children) {
            return option.children.some(child => matchesSearch(child, term));
        }
        return false;
    };

    const filteredOptions = options.filter(opt =>
        searchTerm === "" || matchesSearch(opt, searchTerm)
    );

    const renderOption = (option: FilterOption, level: number = 0) => {
        const hasChildren = option.children && option.children.length > 0;
        const isExpanded = expandedCategories.includes(option.value) || searchTerm !== "";

        const leafValues = getLeafValues(option);
        const isSelected = selectedValues.includes('all') || leafValues.every(v => selectedValues.includes(v));
        const isIndeterminate = !isSelected && leafValues.some(v => selectedValues.includes(v));

        if (searchTerm !== "" && !matchesSearch(option, searchTerm)) {
            return null;
        }

        return (
            <div key={option.value} className="flex flex-col gap-1 text-left">
                <div
                    className={`flex items-center gap-2 p-1.5 rounded-lg cursor-pointer transition-colors ${isSelected ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50 text-gray-700'
                        }`}
                    style={{ paddingLeft: `${level * 12 + 6}px` }}
                >
                    {/* Expand/Collapse Icon */}
                    {hasChildren ? (
                        <div
                            className="p-1 hover:bg-gray-200 rounded transition-colors"
                            onClick={(e) => {
                                e.stopPropagation();
                                toggleExpand(option.value);
                            }}
                        >
                            <ChevronRight
                                className={`w-3.5 h-3.5 text-gray-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                            />
                        </div>
                    ) : (
                        <div className="w-5" /> // Alignment placeholder
                    )}

                    {/* Checkbox */}
                    <div
                        className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-blue-600 border-blue-600' :
                            isIndeterminate ? 'bg-blue-400 border-blue-400' :
                                'border-gray-300 bg-white'
                            }`}
                        onClick={() => handleToggle(option.value)}
                    >
                        {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                        {isIndeterminate && <div className="w-1.5 h-0.5 bg-white" />}
                    </div>

                    {/* Label */}
                    <span
                        className={`text-xs flex-1 ${isSelected ? 'font-medium' : ''}`}
                        title={option.label}
                        onClick={() => handleToggle(option.value)}
                    >
                        {option.label}
                    </span>
                </div>

                {/* Render children if expanded */}
                {hasChildren && isExpanded && (
                    <div className="flex flex-col gap-1">
                        {option.children!.map(child => renderOption(child, level + 1))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <label className="block text-xs font-medium text-gray-500 mb-1 ml-1 text-left">
                {label}
            </label>

            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full bg-white border border-gray-200 text-left px-3 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all flex items-center justify-between min-w-[200px]"
            >
                <div className="truncate pr-2">
                    {isAllSelected
                        ? <span className="text-gray-600">All {label}s</span>
                        : <span className="text-gray-900 font-medium">{totalSelectedCount} Selected</span>
                    }
                </div>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute z-50 mt-2 w-[500px] bg-white rounded-xl shadow-xl border border-gray-100 p-4 animate-in fade-in zoom-in-95 duration-100 origin-top-left">
                    {/* Search */}
                    <div className="relative mb-3">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search..."
                            className="w-full pl-9 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    {/* Options List */}
                    <div className="flex flex-col gap-1 max-h-[350px] overflow-y-auto custom-scrollbar pr-1">
                        {/* All Option - Spans full width */}
                        {searchTerm === "" && (
                            <div
                                className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors mb-2 ${isAllSelected ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50 text-gray-700'}`}
                                onClick={() => handleToggle('all')}
                            >
                                <div className="w-5" />
                                <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${isAllSelected ? 'bg-blue-600 border-blue-600' :
                                    isIndeterminateAll ? 'bg-blue-400 border-blue-400' :
                                        'border-gray-300 bg-white'
                                    }`}>
                                    {isAllSelected && <Check className="w-3 h-3 text-white" />}
                                    {isIndeterminateAll && <div className="w-2 h-0.5 bg-white" />}
                                </div>
                                <span className="text-sm font-medium">All {label}s</span>
                            </div>
                        )}

                        {/* Hierarchical Options - Two Columns */}
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-gray-50 pt-3">
                            {filteredOptions.filter(o => o.value !== 'all').map(option =>
                                renderOption(option)
                            )}
                        </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between text-[11px] font-medium uppercase tracking-wider">
                        <button onClick={() => onChange(['all'])} className="text-blue-600 hover:text-blue-800 transition-colors">Select All</button>
                        <div className="text-gray-400">
                            {isAllSelected ? 'All' : `${totalSelectedCount} selected`}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
