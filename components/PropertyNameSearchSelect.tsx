import React, { useState, useEffect, useRef, useMemo } from 'react';
import { PropertyItem } from '../types';
import { Search, ChevronDown, Check, Plus, Tag, Layers, MapPin, DollarSign, Sparkles } from 'lucide-react';
import { getCategoryColor, getCategoryIcon } from '../constants';

interface PropertyNameOption {
  name: string;
  count: number;
  templateItem: PropertyItem;
}

interface PropertyNameSearchSelectProps {
  value: string;
  onChange: (name: string, templateItem?: PropertyItem) => void;
  existingItems: PropertyItem[];
  placeholder?: string;
  required?: boolean;
  name?: string;
  id?: string;
  className?: string;
  disabled?: boolean;
}

export const PropertyNameSearchSelect: React.FC<PropertyNameSearchSelectProps> = ({
  value,
  onChange,
  existingItems,
  placeholder = 'Search existing property name or enter new...',
  required = false,
  name = 'name',
  id = 'property-name-select',
  className = '',
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState(value || '');
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Sync internal query when value prop changes
  useEffect(() => {
    setQuery(value || '');
  }, [value]);

  // Aggregate distinct property names with their template item & count
  const propertyNameOptions = useMemo<PropertyNameOption[]>(() => {
    const map = new Map<string, { count: number; templateItem: PropertyItem }>();

    existingItems.forEach(item => {
      const trimmed = (item.name || '').trim();
      if (!trimmed) return;
      const lower = trimmed.toLowerCase();

      if (!map.has(lower)) {
        map.set(lower, { count: 1, templateItem: item });
      } else {
        const curr = map.get(lower)!;
        curr.count += 1;
      }
    });

    const list: PropertyNameOption[] = [];
    map.forEach(({ count, templateItem }) => {
      list.push({
        name: templateItem.name,
        count,
        templateItem
      });
    });

    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [existingItems]);

  // Filtered property name suggestions based on query
  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return propertyNameOptions;
    return propertyNameOptions.filter(opt =>
      opt.name.toLowerCase().includes(q) ||
      (opt.templateItem.category && opt.templateItem.category.toLowerCase().includes(q)) ||
      (opt.templateItem.description && opt.templateItem.description.toLowerCase().includes(q))
    );
  }, [propertyNameOptions, query]);

  // Check if current query is an exact match
  const exactMatch = useMemo(() => {
    const q = query.trim().toLowerCase();
    return propertyNameOptions.find(opt => opt.name.toLowerCase() === q);
  }, [propertyNameOptions, query]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        // Commit text if changed
        if (query.trim() && query.trim() !== value) {
          onChange(query.trim());
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [query, value, onChange]);

  const handleSelect = (optionName: string, template?: PropertyItem) => {
    setQuery(optionName);
    onChange(optionName, template);
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    onChange(val);
    setIsOpen(true);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setHighlightedIndex(0);
      } else {
        const max = filteredOptions.length + (!exactMatch && query.trim() ? 1 : 0);
        setHighlightedIndex(prev => (prev + 1 < max ? prev + 1 : 0));
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (isOpen) {
        const max = filteredOptions.length + (!exactMatch && query.trim() ? 1 : 0);
        setHighlightedIndex(prev => (prev - 1 >= 0 ? prev - 1 : max - 1));
      }
    } else if (e.key === 'Enter') {
      if (isOpen) {
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
          const picked = filteredOptions[highlightedIndex];
          handleSelect(picked.name, picked.templateItem);
        } else if (query.trim()) {
          handleSelect(query.trim());
        }
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setHighlightedIndex(-1);
    }
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          id={id}
          name={name}
          value={query}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          autoComplete="off"
          className="w-full pl-9 pr-8 py-2 text-sm border border-gray-300 rounded-md font-medium text-gray-900 bg-white placeholder-gray-400 focus:ring-2 focus:ring-blue-600 focus:border-blue-600 focus:outline-none transition-colors shadow-2xs"
        />

        {/* Left search icon */}
        <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
          <Search className="w-4 h-4" />
        </div>

        {/* Right dropdown chevron */}
        <button
          type="button"
          tabIndex={-1}
          onClick={() => {
            if (!disabled) {
              setIsOpen(prev => !prev);
              inputRef.current?.focus();
            }
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 rounded transition-colors"
        >
          <ChevronDown className={`w-4 h-4 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Suggestion Dropdown */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white rounded-lg border border-gray-200 shadow-xl overflow-hidden max-h-80 flex flex-col animate-in fade-in zoom-in-95 duration-100">
          <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between text-[11px] font-bold text-gray-500 uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-blue-600" />
              Existing School Property Names
            </span>
            <span className="text-[10px] text-gray-400">
              {filteredOptions.length} match{filteredOptions.length === 1 ? '' : 'es'}
            </span>
          </div>

          <ul ref={listRef} className="overflow-y-auto flex-1 divide-y divide-gray-100 text-xs">
            {filteredOptions.map((opt, idx) => {
              const isSelected = value.trim().toLowerCase() === opt.name.toLowerCase();
              const isHighlighted = highlightedIndex === idx;
              const catColor = getCategoryColor(opt.templateItem.category);

              return (
                <li
                  key={opt.name}
                  onMouseDown={(e) => {
                    e.preventDefault(); // prevent input blur
                    handleSelect(opt.name, opt.templateItem);
                  }}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  className={`p-3 cursor-pointer transition-colors flex items-start justify-between gap-3 ${
                    isHighlighted ? 'bg-blue-50/90 text-blue-900' : 'hover:bg-gray-50 text-gray-900'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-gray-950 truncate">
                        {opt.name}
                      </span>
                      <span
                        className="px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1"
                        style={{
                          backgroundColor: `${catColor}15`,
                          borderColor: `${catColor}40`,
                          color: catColor
                        }}
                      >
                        {getCategoryIcon(opt.templateItem.category)}
                        {opt.templateItem.category}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-700">
                        {opt.count} unit{opt.count === 1 ? '' : 's'} on record
                      </span>
                    </div>

                    {/* Metadata preview */}
                    <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-500 flex-wrap">
                      {opt.templateItem.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-amber-600 flex-shrink-0" />
                          <span className="truncate max-w-[150px]">{opt.templateItem.location}</span>
                        </span>
                      )}
                      {opt.templateItem.unitValue > 0 && (
                        <span className="font-semibold text-emerald-700">
                          ₱ {opt.templateItem.unitValue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </span>
                      )}
                      {opt.templateItem.custodian && (
                        <span className="truncate max-w-[150px]">
                          Custodian: {opt.templateItem.custodian}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0 pt-0.5">
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-[10px] font-bold flex items-center gap-1 hover:bg-blue-200">
                      <Sparkles className="w-3 h-3 text-blue-600" />
                      Copy Info
                    </span>
                    {isSelected && <Check className="w-4 h-4 text-emerald-600" />}
                  </div>
                </li>
              );
            })}

            {/* Custom / New property name option */}
            {!exactMatch && query.trim().length > 0 && (
              <li
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(query.trim());
                }}
                className="p-3 bg-blue-50/50 hover:bg-blue-50 cursor-pointer border-t border-blue-100 text-blue-700 font-bold flex items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded bg-blue-600 text-white">
                    <Plus className="w-3.5 h-3.5" />
                  </div>
                  <span>Use &quot;{query.trim()}&quot; as new property name</span>
                </div>
                <span className="text-[11px] text-blue-600 font-normal">Press Enter</span>
              </li>
            )}

            {filteredOptions.length === 0 && query.trim().length === 0 && (
              <li className="p-4 text-center text-gray-400 italic">
                No existing property names in database yet. Type to enter a new name.
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

export default PropertyNameSearchSelect;
