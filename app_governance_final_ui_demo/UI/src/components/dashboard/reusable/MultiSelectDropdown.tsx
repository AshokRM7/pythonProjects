import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, X, Search } from 'lucide-react';

interface MultiSelectDropdownProps {
    label: string;
    options: { value: string; label: string }[];
    selectedValues: string[];
    onChange: (values: string[]) => void;
    placeholder?: string;
}

export const MultiSelectDropdown: React.FC<MultiSelectDropdownProps> = ({
    label,
    options,
    selectedValues,
    onChange,
    placeholder = "Select options",
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
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

    const handleToggle = (value: string) => {
        if (value === 'all') {
            if (selectedValues.includes('all')) {
                onChange([]); // Deselect all
            } else {
                onChange(['all']); // Select all (which usually implies ignoring other specific filters)
            }
            return;
        }

        // If "all" was selected, remove it when selecting a specific item
        let newValues = selectedValues.filter(v => v !== 'all');

        if (newValues.includes(value)) {
            newValues = newValues.filter(v => v !== value);
        } else {
            newValues = [...newValues, value];
        }

        // If nothing selected, maybe default back to all? Or just empty.
        // Let's keep it empty, but the parent logic needs to handle empty = all or empty = none.
        // Usually empty filter means "show all", but to be explicit let's handle "all" logic.
        if (newValues.length === 0) {
            newValues = ['all'];
        }

        onChange(newValues);
    };

    const filteredOptions = options.filter(opt =>
        opt.label.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="relative" ref={dropdownRef}>
            <label className="block text-xs font-medium text-gray-500 mb-1 ml-1">
                {label}
            </label>

            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full bg-white border border-gray-200 text-left px-3 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all flex items-center justify-between min-w-[200px]"
            >
                <div className="truncate pr-2">
                    {selectedValues.includes('all')
                        ? <span className="text-gray-600">All {label}s</span>
                        : <span className="text-gray-900 font-medium">{selectedValues.length} Selected</span>
                    }
                </div>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute z-50 mt-2 w-[400px] bg-white rounded-xl shadow-xl border border-gray-100 p-4 animate-in fade-in zoom-in-95 duration-100 origin-top-left">
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

                    {/* Grid Layout for Options */}
                    <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                        {/* All Option */}
                        {searchTerm === "" && (
                            <div
                                className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${selectedValues.includes('all') ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50 text-gray-700'}`}
                                onClick={() => handleToggle('all')}
                            >
                                <div className={`w-4 h-4 rounded border flex items-center justify-center ${selectedValues.includes('all') ? 'bg-blue-600 border-blue-600' : 'border-gray-300 bg-white'}`}>
                                    {selectedValues.includes('all') && <Check className="w-3 h-3 text-white" />}
                                </div>
                                <span className="text-sm font-medium">All {label}s</span>
                            </div>
                        )}

                        {filteredOptions.filter(o => o.value !== 'all').map(option => (
                            <div
                                key={option.value}
                                className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${selectedValues.includes(option.value) ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50 text-gray-700'}`}
                                onClick={() => handleToggle(option.value)}
                            >
                                <div className={`w-4 h-4 rounded border flex items-center justify-center ${selectedValues.includes(option.value) ? 'bg-blue-600 border-blue-600' : 'border-gray-300 bg-white'}`}>
                                    {selectedValues.includes(option.value) && <Check className="w-3 h-3 text-white" />}
                                </div>
                                <span className="text-sm truncate" title={option.label}>{option.label}</span>
                            </div>
                        ))}
                    </div>

                    <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between text-xs">
                        <button onClick={() => onChange(['all'])} className="text-gray-500 hover:text-blue-600">Select All</button>
                        <div className="text-gray-400">
                            {selectedValues.includes('all') ? options.length - 1 : selectedValues.length} selected
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
