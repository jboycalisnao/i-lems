import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MapPin, ChevronDown, Check, Plus, X } from 'lucide-react';
import {
  fetchRememberedLocations,
  getCachedLocations,
  rememberLocation
} from '../services/locationService';

interface LocationSearchSelectProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  name?: string;
  id?: string;
  className?: string;
  disabled?: boolean;
  label?: string;
}

export const LocationSearchSelect: React.FC<LocationSearchSelectProps> = ({
  value,
  onChange,
  placeholder = 'Search or select location (e.g. Cabinet 1)...',
  required = false,
  name = 'location',
  id,
  className = '',
  disabled = false,
  label
}) => {
  const [locations, setLocations] = useState<string[]>(() => getCachedLocations());
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState(value || '');
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync internal query when external value changes
  useEffect(() => {
    setQuery(value || '');
  }, [value]);

  // Load locations from database on mount & listen for real-time updates
  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const fetched = await fetchRememberedLocations();
        if (mounted) {
          setLocations(fetched);
        }
      } catch (err) {
        console.error('Failed to load locations', err);
      }
    };

    load();

    const handleUpdate = () => {
      load();
    };

    window.addEventListener('ilems:locations-updated', handleUpdate);
    return () => {
      mounted = false;
      window.removeEventListener('ilems:locations-updated', handleUpdate);
    };
  }, []);

  // Filtered location suggestions
  const filteredLocations = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return locations;
    return locations.filter(loc => loc.toLowerCase().includes(q));
  }, [locations, query]);

  // Check if current query is already an exact match in remembered locations
  const isExactMatch = useMemo(() => {
    const q = query.trim().toLowerCase();
    return locations.some(loc => loc.toLowerCase() === q);
  }, [locations, query]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        // If user typed something custom, commit it to parent
        if (query.trim() && query.trim() !== value) {
          handleSelect(query.trim());
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [query, value]);

  const handleSelect = (selected: string) => {
    const trimmed = selected.trim();
    if (!trimmed) return;
    rememberLocation(trimmed);
    onChange(trimmed);
    setQuery(trimmed);
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    onChange(val); // Real-time form state sync
    setIsOpen(true);
    setHighlightedIndex(0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    const totalOptions = filteredLocations.length + (!isExactMatch && query.trim() ? 1 : 0);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev + 1) % (totalOptions || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev - 1 + totalOptions) % (totalOptions || 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < filteredLocations.length) {
        handleSelect(filteredLocations[highlightedIndex]);
      } else if (!isExactMatch && query.trim()) {
        handleSelect(query.trim());
      } else if (query.trim()) {
        handleSelect(query.trim());
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setHighlightedIndex(-1);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setQuery('');
    onChange('');
    setIsOpen(false);
    inputRef.current?.focus();
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <label htmlFor={id} className="block text-xs font-bold text-gray-700 mb-1">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}

      <div className="relative flex items-center">
        <div className="absolute left-3 pointer-events-none text-blue-600 flex items-center">
          <MapPin className="w-4 h-4" />
        </div>

        <input
          ref={inputRef}
          type="text"
          id={id}
          name={name}
          value={query}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          required={required}
          placeholder={placeholder}
          autoComplete="off"
          className="w-full pl-9 pr-16 py-2 text-sm border border-gray-300 rounded-md font-medium text-gray-900 placeholder-gray-400 bg-white shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
        />

        <div className="absolute right-2 flex items-center gap-1 text-gray-400">
          {query && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 hover:text-gray-700 rounded-full hover:bg-gray-100 transition-colors"
              title="Clear input"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            tabIndex={-1}
            onClick={() => {
              if (!disabled) {
                setIsOpen(prev => !prev);
                inputRef.current?.focus();
              }
            }}
            className="p-1 hover:text-gray-700 transition-colors"
            title="Toggle location menu"
          >
            <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180 text-blue-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Searchable Dropdown Menu */}
      {isOpen && !disabled && (
        <div className="absolute z-50 left-0 right-0 mt-1.5 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="p-2 border-b border-gray-100 bg-gray-50 flex items-center justify-between text-[11px] text-gray-500 font-semibold">
            <span>DATABASE REMEMBERED LOCATIONS ({filteredLocations.length})</span>
            <span className="text-[10px] text-blue-600 font-bold">Search & Select</span>
          </div>

          <div className="max-h-56 overflow-y-auto divide-y divide-gray-50 scrollbar-thin">
            {/* Option to add custom location if not matching */}
            {!isExactMatch && query.trim() && (
              <button
                type="button"
                onClick={() => handleSelect(query.trim())}
                className="w-full text-left px-3.5 py-2.5 bg-blue-50/70 hover:bg-blue-100 text-blue-900 flex items-center gap-2.5 transition-colors group border-b border-blue-100"
              >
                <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                  <Plus className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold flex items-center gap-1.5">
                    <span>Use & remember:</span>
                    <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-blue-200 text-blue-800 truncate">
                      "{query.trim()}"
                    </span>
                  </div>
                  <div className="text-[10px] text-blue-600 font-normal">
                    Will be saved in database and remembered for future items
                  </div>
                </div>
              </button>
            )}

            {filteredLocations.length === 0 && isExactMatch && (
              <div className="px-4 py-3 text-xs text-gray-500 text-center">
                No matching locations found.
              </div>
            )}

            {filteredLocations.map((loc, index) => {
              const isSelected = value?.trim().toLowerCase() === loc.toLowerCase();
              const isHighlighted = highlightedIndex === index;
              const isCabinet = /^cabinet\s*\d+/i.test(loc);

              return (
                <button
                  key={loc}
                  type="button"
                  onClick={() => handleSelect(loc)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className={`w-full text-left px-3.5 py-2 flex items-center justify-between gap-2 text-xs transition-colors ${
                    isHighlighted ? 'bg-blue-50 text-blue-900 font-semibold' : 'text-gray-800 hover:bg-gray-50'
                  } ${isSelected ? 'bg-blue-50/50 text-blue-700 font-bold' : ''}`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <MapPin className={`w-3.5 h-3.5 flex-shrink-0 ${isCabinet ? 'text-amber-600' : 'text-blue-500'}`} />
                    <span className="truncate">{loc}</span>
                    {isCabinet && (
                      <span className="text-[10px] font-bold px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded border border-amber-200">
                        LNHS Cabinet
                      </span>
                    )}
                  </div>

                  {isSelected && (
                    <div className="flex items-center gap-1 text-emerald-600 flex-shrink-0">
                      <Check className="w-4 h-4 stroke-[2.5]" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <div className="p-2 border-t border-gray-100 bg-gray-50/80 text-[10px] text-gray-500 flex items-center justify-between">
            <span>Tip: Type to filter or enter a new room/cabinet</span>
            <span className="text-gray-400">Esc to close</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default LocationSearchSelect;
