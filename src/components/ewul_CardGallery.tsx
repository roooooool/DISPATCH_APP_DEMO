
import React, { useState, useMemo } from 'react';
import { Search, SortAsc, SortDesc, Filter, Truck, User, MoveVertical } from 'lucide-react';
import './comp_css/ewul_CardGallery.css';

//
import { encodeColumnName as _enc} from './ewul_TableFlex';

import type { FilterConfig, FilterOption } from './ewul_TableFlex';
export interface CardFieldConfig {
  label: string;
  key: string;
  isTitle?: boolean;
  isStatus?: boolean;
  statusElement?: (row: any) => React.ReactNode; // Accepts a function for dynamic rendering
  render?: (val: any, row: any) => React.ReactNode;
  row?: number;      // Fields with the same row number stay together
  proportion?: number; // Relative width (e.g., 2 and 1 means 66% and 33%)
  filter?: FilterConfig | null;
}

interface InfoCardGalleryProps {
  data: any[];
  fields: CardFieldConfig[];
  imageKey?: string;
  defaultImage?: string | 'defaultTruck' | 'defaultUser'; 
  onCardClick?: (record: any) => void;
  title: string;
  searchFields: string[];
  filterOptions?: { key: string; label: string; options: string[] }[];
  sortColumn?: string; // New: column name to sort by
  columns?: number;       // Force a specific number of columns (e.g. 2, 3, 4)
  overflowX?: 'auto' | 'hidden' | 'scroll';
  overflowY?: 'auto' | 'hidden' | 'scroll';
  loading?: boolean;
  skeletonCount?: number;
  cardHeight?: string;
}

// Helper to highlight search matches
function highlightMatch(text: any, search: string) {
  // If text is null, undefined, or empty, return null 
  // so the caller's "---" fallback can trigger
  if (text === null || text === undefined || text === "") return null;
  if (!search) return text;

  const stringText = String(text);
  const regex = new RegExp(`(${search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  
  return (
    <>
      {stringText.split(regex).map((part, i) =>
        regex.test(part) ? (
          <mark key={i} style={{ background: 'yellow', color: 'inherit', padding: 0 }}>
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
}

export const InfoCardGallery: React.FC<InfoCardGalleryProps> = ({
  data,
  fields,
  imageKey,
  defaultImage = 'defaultTruck',
  onCardClick,
  title,
  searchFields,
  filterOptions = [],
  sortColumn,
  columns, 
  overflowX = 'hidden',
  overflowY = 'auto',
  loading = false,
  skeletonCount = 6,
  cardHeight,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  // Store original data order for neutral sort
  const [originalOrder, setOriginalOrder] = useState<any[]>([]);
  const [sortConfig, setSortConfig] = useState<{ key: string; dir: 'asc' | 'desc' | null } | null>(null);

  console.log('Rendering CardGallery...',filterOptions);

  // On mount or data change, store original order
  React.useEffect(() => {
    setOriginalOrder(data.map((item, idx) => ({ ...item, _originalIdx: idx })));
  }, [data]);
  // Multi-select filter state: key -> array of values
  const [activeFilters, setActiveFilters] = useState<Record<string, any[]>>({});

  // --- LOGIC: Filter, Search, Sort ---
  const processedData = useMemo(() => {
    let filtered = sortConfig && sortConfig.dir === null
      ? [...originalOrder]
      : [...data];
    if (searchTerm) {
      filtered = filtered.filter(item =>
        searchFields.some(f => String(item[f] || '').toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }
    Object.entries(activeFilters).forEach(([key, val]) => {
      if (!val || (Array.isArray(val) && val.length === 0)) return;
      filtered = filtered.filter(item => Array.isArray(val) ? val.includes(item[key]) : item[key] === val);
    });
    if (sortConfig && sortConfig.dir) {
      filtered.sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];
        const aEmpty = aVal === null || aVal === undefined || aVal === '';
        const bEmpty = bVal === null || bVal === undefined || bVal === '';
        if (aEmpty && bEmpty) return 0;
        if (aEmpty) return 1;
        if (bEmpty) return -1;
        if (sortConfig.dir === 'asc') return aVal > bVal ? 1 : -1;
        return aVal < bVal ? 1 : -1;
      });
    }
    return filtered;
  }, [data, searchTerm, activeFilters, sortConfig, originalOrder]);

  const renderVisual = (item: any) => {
    const source = (imageKey && item[imageKey]) ? item[imageKey] : defaultImage;
    if (source === 'defaultTruck') {
      return (
        <div className="placeholder-icon-wrapper">
          <Truck size={40} strokeWidth={1.5} />
        </div>
      );
    }
    if (source === 'defaultUser') {
      return (
        <div className="placeholder-icon-wrapper">
          <User size={40} strokeWidth={1.5} />
        </div>
      );
    }
    return <img src={source} alt="Visual" className="card-main-img" />;
  };

  // Inline style for dynamic grid and overflow
  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gap: '20px',
    padding: '10px',
    overflowX: overflowX,
    overflowY: overflowY,
    // If columns is provided, use it. Otherwise, stay responsive.
    gridTemplateColumns: columns 
        ? `repeat(${columns}, 1fr)` 
        : 'repeat(auto-fill, minmax(320px, 1fr))'
  };

const groupedFields = useMemo(() => {
  const groups: Record<number, CardFieldConfig[]> = {};
  
  fields.forEach(field => {
    // Only include fields that have an explicit row number assigned
    // We check for !== undefined so that row: 0 is still valid
    if (field.row !== undefined && field.row !== null) {
      const rowNum = field.row;
      if (!groups[rowNum]) groups[rowNum] = [];
      groups[rowNum].push(field);
    }
  });

  // Return sorted rows
  return Object.keys(groups)
    .sort((a, b) => Number(a) - Number(b))
    .map(key => groups[Number(key)]);
}, [fields]);

    // Helper Component for Skeleton Card
    const CardSkeleton = () => (
        <div className="gsdc-info-card" style={{ ...cardStyle, cursor: 'default' }}>
        <div className="card-image-section">
            <div className="skeleton-box skeleton-img" />
        </div>
        <div className="card-details-section">
            {groupedFields.map((fieldRow, rowIndex) => (
            <div key={rowIndex} className="details-row" style={{ display: 'flex', width: '100%', gap: '10px', flex: 1 }}>
                {fieldRow.map(field => (
                <div key={field.key} style={{ flex: field.proportion || 1 }} className="detail-item">
                    {!field.isTitle && <div className="skeleton-box skeleton-label" />}
                    <div className={`skeleton-box ${field.isTitle ? 'skeleton-title' : 'skeleton-text'}`} />
                </div>
                ))}
            </div>
            ))}
        </div>
        </div>
    );

    const cardStyle: React.CSSProperties = {
        height: cardHeight || '100%', // Default to current behavior if not passed
    };

  return (
    <div className="info-gallery-container" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="gallery-command-ribbon">

        <div className="ribbon-left">
          { false &&<h3 className="gallery-title">
            {title} <span className="count-badge">{processedData.length}</span>
          </h3> }
          <div className="gallery-search-box">
            <Search size={16} />
            <input 
              placeholder={`Search...`} 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="ribbon-right">
          {/* 1. Filter Dropdowns Group */}
          <div className="gallery-filter-group" style={{ display: 'flex', gap: '8px' }}>
            {fields.filter(f => f.filter).map(field => {
              const filterCfg = field.filter!;
              let options: FilterOption[] = filterCfg.options || [];
              if (!options.length) {
                const uniqueVals = Array.from(new Set(data.map(item => item[field.key]).filter(v => v !== null && v !== undefined && v !== '')));
                options = uniqueVals.map(v => ({ value: v, label: String(v) }));
              }
              const selected = activeFilters[field.key] || [];
              return (
                <div key={field.key} className="gallery-filter-select">
                  <div className="dropdown-multi-filter">
                    <div className="dropdown-multi-trigger" tabIndex={0}>
                      <Filter size={14} style={{ marginRight: '6px' }} />
                      {selected.length > 0 ? `${selected.length} selected` : `All ${field.label}`}
                      <div className="dropdown-multi-list">
                        {options.map(opt => (
                          <label key={opt.value} className="dropdown-multi-item">
                            <input
                              type="checkbox"
                              checked={selected.includes(opt.value)}
                              onChange={() => {
                                setActiveFilters(prev => {
                                  const prevArr = prev[field.key] || [];
                                  const nextArr = prevArr.includes(opt.value)
                                    ? prevArr.filter((v: any) => v !== opt.value)
                                    : [...prevArr, opt.value];
                                  return { ...prev, [field.key]: nextArr };
                                });
                              }}
                            />
                            <span>{opt.label ?? opt.value}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 2. Active Filter Chips (Flexible Center - TableFlex Style) */}
          <div className="active-filters-ribbon">
            {Object.entries(activeFilters).map(([key, value]) => {
              console.log("Checking filter:", key, value);
              if (!value || value.length === 0) return null;
              const field = fields.find(f => f.key === key);
              const displayValue = Array.isArray(value) ? `${value.length} selected` : value;
              const hoverText = Array.isArray(value)
                ? (value.length > 10 ? value.slice(0, 10).join(', ') + '...' : value.join(', '))
                : value;
              return (
                <div key={key} className="filter-chip" onClick={() => setActiveFilters(prev => ({ ...prev, [key]: [] }))}>
                  <span className="chip-label">{field?.label || key}:</span>
                  <span className="chip-value">{displayValue}</span>
                  <button className="chip-remove" onClick={(e) => { e.stopPropagation(); setActiveFilters(prev => ({ ...prev, [key]: [] })); }}>×</button>
                  <div className="chip-tooltip">{hoverText}</div>
                </div>
              );
            })}
            
            {Object.values(activeFilters).some(v => Array.isArray(v) ? v.length > 0 : v) && (
              <button className="clear-all-filters" onClick={() => setActiveFilters({})}>
                Reset
              </button>
            )}
          </div>

          {/* 3. Sort Action (Pinned Right) */}
          <button
            className="gallery-action-btn"
            title={`Sort ${sortColumn || (fields[0] && fields[0].key)}`}
            onClick={() => {
              const col = sortColumn || (fields[0] && fields[0].key);
              setSortConfig(p => {
                if (!p || p.key !== col) return { key: col, dir: 'asc' };
                if (p.dir === 'asc') return { key: col, dir: 'desc' };
                if (p.dir === 'desc') return { key: col, dir: null };
                return { key: col, dir: 'asc' };
              });
            }}
          >
            {sortConfig?.dir === 'desc' ? <SortDesc size={18} /> : sortConfig?.dir === 'asc' ? <SortAsc size={18} /> : <MoveVertical size={18} />}
          </button>
        </div>

        {/* Move it here, at the end of the ribbon div */}
        {loading && (
          <div className="gallery-top-loader">
            <div className="loader-progress-bar"></div>
          </div>
        )}


      </div>

      <div className="gallery-grid" style={gridStyle}>
        {(loading && processedData.length === 0) ? (
          Array.from({ length: skeletonCount }).map((_, i) => <CardSkeleton key={i} />)
        ) : (
          processedData.map((item, idx) => (
            <div 
              key={item.ID || idx} 
              className="gsdc-info-card" 
              onClick={() => onCardClick?.(item)} 
              style={cardStyle} // Respects cardHeight prop
            >
              <div className="card-image-section">
                {renderVisual(item)}
                {fields.find(f => f.isStatus) && (
                  <div className={`status-pill ${String(item[fields.find(f => f.isStatus)!.key]).toLowerCase()}`}>
                    {fields.find(f => f.isStatus)?.statusElement
                      ? fields.find(f => f.isStatus)!.statusElement!(item)
                      : item[fields.find(f => f.isStatus)!.key]}
                  </div>
                )}
              </div>
              <div className="card-details-section" style={{ flex: cardHeight ? 1 : 'unset' }}>
                {groupedFields.map((fieldRow, rowIndex) => (
                  <div key={rowIndex} className="details-row" style={{ display: 'flex', width: '100%', gap: '10px' }}>
                    {fieldRow.map(field => (
                      <div 
                        key={field.key} 
                        className={`detail-item ${field.isTitle ? 'title-field' : ''}`}
                        style={{ flex: field.proportion || 1 }}
                      >
                        {!field.isTitle && <span className="detail-label">{field.label}:</span>}
                        <span className="detail-value">
                          {(() => {
                            // 1. Get the raw value or the rendered result
                            const rawValue = item[field.key];
                            const displayValue = field.render
                              ? field.render(rawValue, item)
                              : (searchTerm && searchFields.includes(field.key))
                                ? highlightMatch(rawValue, searchTerm)
                                : rawValue;

                            // 2. Return fallback if the result is null, undefined, or an empty string
                            return (displayValue === null || displayValue === undefined || displayValue === "") 
                              ? "---" 
                              : displayValue;
                          })()}
                        </span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};