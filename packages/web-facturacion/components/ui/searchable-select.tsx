'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Plus, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SearchableSelectProps<T> {
  items: T[];
  value: string;
  onChange: (id: string) => void;
  getId: (item: T) => string;
  getLabel: (item: T) => string;
  getSubLabel?: (item: T) => string;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  onAddNew?: () => void;
  addNewLabel?: string;
  disabled?: boolean;
  error?: boolean;
  id?: string;
}

// Select con búsqueda: trigger tipo <Select>, un input de búsqueda arriba del
// listado, y un botón "agregar nuevo" fijo en el pie del popover (siempre
// visible, sin importar si hay resultados o no).
export function SearchableSelect<T>({
  items,
  value,
  onChange,
  getId,
  getLabel,
  getSubLabel,
  placeholder = 'Seleccionar...',
  searchPlaceholder = 'Buscar...',
  emptyMessage = 'No se encontraron resultados',
  onAddNew,
  addNewLabel = 'Agregar nuevo',
  disabled,
  error,
  id,
}: SearchableSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const reactId = useId();
  const triggerId = id ?? reactId;

  const selectedItem = useMemo(
    () => items.find((item) => getId(item) === value),
    [items, value, getId]
  );

  const filteredItems = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter((item) => {
      const label = getLabel(item).toLowerCase();
      const subLabel = getSubLabel?.(item).toLowerCase() ?? '';
      return label.includes(q) || subLabel.includes(q);
    });
  }, [items, query, getLabel, getSubLabel]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery('');
      requestAnimationFrame(() => searchInputRef.current?.focus());
    }
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        id={triggerId}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus:outline-none focus-visible:border-slate-400 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
          open && 'border-slate-400',
          error && 'border-red-500'
        )}
      >
        <span className={cn('truncate text-left', !selectedItem && 'text-muted-foreground')}>
          {selectedItem ? getLabel(selectedItem) : placeholder}
        </span>
        <ChevronDown className="h-4 w-4 opacity-50 flex-shrink-0 ml-2" />
      </button>

      {open && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg flex flex-col max-h-80">
          <div className="relative p-2 border-b flex-shrink-0">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full h-9 rounded-md border border-input bg-background pl-8 pr-3 text-base focus:outline-none focus:border-slate-400 md:text-sm"
            />
          </div>

          <div className="overflow-y-auto flex-1">
            {filteredItems.length > 0 ? (
              filteredItems.map((item) => {
                const itemId = getId(item);
                const isSelected = itemId === value;
                return (
                  <button
                    key={itemId}
                    type="button"
                    onClick={() => {
                      onChange(itemId);
                      setOpen(false);
                    }}
                    className={cn(
                      'w-full px-3 py-2 text-left hover:bg-slate-100 flex items-center justify-between gap-2',
                      isSelected && 'bg-primary/5'
                    )}
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">{getLabel(item)}</div>
                      {getSubLabel && (
                        <div className="text-xs text-slate-500 truncate">{getSubLabel(item)}</div>
                      )}
                    </div>
                    {isSelected && <Check className="h-4 w-4 text-primary flex-shrink-0" />}
                  </button>
                );
              })
            ) : (
              <div className="px-3 py-6 text-center text-sm text-slate-500">{emptyMessage}</div>
            )}
          </div>

          {onAddNew && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onAddNew();
              }}
              className="flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-primary border-t hover:bg-slate-50 flex-shrink-0"
            >
              <Plus className="h-4 w-4" />
              {addNewLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
