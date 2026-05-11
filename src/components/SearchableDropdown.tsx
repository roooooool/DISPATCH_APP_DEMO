import React, { useState, useRef, useEffect } from 'react';
import { Search, X, ChevronDown } from 'lucide-react';
import './comp_css/SearchableDropdown.css';


export interface CardRow {
  label: string;
  value: string | number;
  color?: string; // For conditional formatting (e.g., Red for 'Absent')
  proportion?: number; // flex-grow value
  record?: any; // To hold the original record for later use when an option is selected
}

export interface DropdownOption {
  value: string;
  label: string;
  type?: 'single' | 'multi' | 'card';
  subtext?: string; //legacy
  cardConfig?: CardRow[][];
  record?: any; // To hold the original record for later use when an option is selected
} 

interface SearchableDropdownProps {
  options?: DropdownOption[];
  value: string | string[] | undefined;
  onChange: (value: string | string[]) => void;
  placeholder?: string;
  allowSearch?: boolean;
  allowMultiple?: boolean;
  label?: string;
  disabled?: boolean;
  className?: string;
  styleOverrides?: {
    textColor?: string;
    bgColor?: string;
    menuBgColor?: string;
    optionTextColor?: string;
    [key: string]: any;
  };
}

const SearchableDropdown: React.FC<SearchableDropdownProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  allowSearch = true,
  allowMultiple = false,
  label,
  disabled = false,
  className = '',
  styleOverrides = {},
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  const OptionCard = ({ config }: { config: CardRow[][] }) => {
    return (
      <div className="option-card-container">
        {config.map((row, rowIndex) => (
          <div key={rowIndex} className="card-row">
            {row.map((cell, cellIndex) => (
              <div 
                key={cellIndex} 
                className="card-cell" 
                style={{ flex: cell.proportion || 1 }}
              >
                <span className="cell-label">{cell.label}</span>
                <span className="cell-value" style={{ color: cell.color }}>
                  {cell.value}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isOpen && wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const computedOptions = React.useMemo((): DropdownOption[] => {
    // 1. Create a local variable for the base options
    // If the passed options are empty, use the hardcoded defaults
      const baseOptions = (options && options.length > 0) ? options : [
          { value: 'Apple', label: 'Apple', type: 'multi', subtext: 'ID: F-001 | Available (12)' },
          { value: 'Banana', label: 'Banana', type: 'multi', subtext: 'ID: F-002 | Available (23)' },
          { value: 'Cherry', label: 'Cherry', type: 'multi', subtext: 'ID: F-003 | Out of Stock' },
      ] as DropdownOption[];

      // 2. Use baseOptions instead of 'options' in the rest of the function
      if (value === undefined || value === null || value === '') return baseOptions;

      if (allowMultiple && Array.isArray(value)) {
          const missingValues = value.filter(v => !baseOptions.find(opt => opt.value === v));
          if (missingValues.length === 0) return baseOptions;
          
          const tempOptions: DropdownOption[] = missingValues.map(v => ({
              value: v,
              label: v,
              subtext: '(Historical Record)', 
              type: 'multi'
          }));
          return [...baseOptions, ...tempOptions];
      }

      if (typeof value === 'string' && value !== '') {
          const exists = baseOptions.find(opt => opt.value === value);
          if (!exists) {
              const tempOption: DropdownOption = { 
                  value: value, 
                  label: value, 
                  subtext: 'NOT ON LIST', 
                  type: 'multi'
              };
              return [...baseOptions, tempOption];
          }
      }

      return baseOptions;
  }, [options, value, allowMultiple]);

  const filteredOptions = allowSearch && search
    ? computedOptions.filter(opt => opt.label.toLowerCase().includes(search.toLowerCase()))
    : computedOptions;

  const isSelected = (val: string) =>
    allowMultiple && Array.isArray(value)
      ? value.includes(val)
      : value === val;

  const handleSelect = (val: string) => {
    if (allowMultiple && Array.isArray(value)) {
      if (value.includes(val)) {
        onChange(value.filter(v => v !== val));
      } else {
        onChange([...value, val]);
      }
    } else {
      onChange(val);
      setIsOpen(false);
    }
  };

  let displayValue = '';
  if (allowMultiple && Array.isArray(value)) {
      displayValue = value.length > 0 
          ? computedOptions.filter(opt => value.includes(opt.value)).map(opt => opt.label).join(', ')
          : '';
  } else if (typeof value === 'string') {
      displayValue = computedOptions.find(opt => opt.value === value)?.label || '';
  } else if (value === undefined) {
      displayValue = ''; // Explicitly handle undefined for the display
  }



  return (
    <div className={`searchable-dropdown-wrapper ${className}`} ref={wrapperRef}>
      {label && <label className="dropdown-label">{label}</label>}
      
      {/* Gradient Border Wrapper */}
      <div className={`gradient-input-wrapper ${isOpen ? 'active' : ''}`}>
        <div
          className={`searchable-dropdown-inner ${disabled ? 'disabled' : ''}`}
          onClick={() => !disabled && setIsOpen(v => !v)}
          style={{
            color: styleOverrides.textColor,
            background: styleOverrides.bgColor,
            ...styleOverrides.dropdownInner,
          }}
        >
          <span
            className={`dropdown-value-text ${!displayValue ? 'placeholder' : ''}`}
            style={styleOverrides.textColor ? { color: styleOverrides.textColor } : {}}
          >
            {displayValue || placeholder}
          </span>
          <ChevronDown size={18} className={`dropdown-arrow ${isOpen ? 'rotate' : ''}`} />
        </div>
      </div>

      {isOpen && (
        <div
          className="searchable-dropdown-menu"
          style={{ background: styleOverrides.menuBgColor, ...styleOverrides.dropdownMenu }}
        >
          {allowSearch && (
            <div className="dropdown-search-container">
              <Search size={14} className="search-icon" />
              <input
                type="text"
                className="dropdown-search-field"
                placeholder="Search..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                autoFocus
              />
              {search && <X size={14} className="clear-search" onClick={() => setSearch('')} />}
            </div>
          )}
          
          <div className="dropdown-options-list">
            {filteredOptions.length === 0 ? (
              <div className="dropdown-no-options">No results found</div>
            ) : (
              filteredOptions.map(opt => (
                <div 
                  key={opt.value} 
                  className={`dropdown-option-row ${isSelected(opt.value) ? 'selected' : ''}`}
                  onClick={() => handleSelect(opt.value)}
                  style={styleOverrides.optionRow}
                >
                  {allowMultiple && (
                    <input
                      type="checkbox"
                      className="option-checkbox"
                      checked={isSelected(opt.value)}
                      readOnly
                    />
                  )}
                  <span
                    className={`option-label ${
                      (opt.type === 'multi' || opt.type === 'card') ? 'option-label-multiline' : ''
                    }`}
                    style={styleOverrides.optionTextColor ? { color: styleOverrides.optionTextColor } : {}}
                  >

                    <span className="option-main-title">{opt.label}</span>


                    {opt.type === 'card' && opt.cardConfig ? (
                      <OptionCard config={opt.cardConfig} />
                    ) : (

                      opt.type === 'multi' && opt.subtext && (
                        <span className="option-subtext">{opt.subtext}</span>
                      )
                    )}
                  </span>
                </div>
              ))
            )}
          </div>

          <button
            className="dropdown-clear-btn"
            onClick={e => {
              e.stopPropagation();
              if (allowMultiple && Array.isArray(value)) {
                onChange([]);
              } else {
                onChange('');
              }
            }}
            disabled={allowMultiple ? Array.isArray(value) && value.length === 0 : !value}
          >
            {allowMultiple ? 'Clear All' : 'Clear'}
          </button>
        </div>
      )}
    </div>
  );
};

export default SearchableDropdown;