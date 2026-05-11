import React, { useState, useEffect, useCallback} from 'react';
import { Calendar } from 'lucide-react';

export type DateRangeType = 'Today' | 'Yesterday' | 'Weekly' | 'Last Week' | 'Last Month' | 'Monthly' | 'Yearly' | 'Custom';

// CSS
import './comp_css/ewul_DateRangePicker.css';


interface DateRangeResult {
  from: string; // "YYYY-MM-DD"
  to: string;   // "YYYY-MM-DD"
}

interface DateRangePickerProps {
  allowedTypes?: DateRangeType[];
  initialType?: DateRangeType;
  // Now returns the raw date strings
  onFilterChange: (range: DateRangeResult) => void;
  opacity?: number, blur?: number;
  bgColor?: string;      // New: e.g. "9, 33, 98" (RGB format)
  hoverColor?: string;   // New: e.g. "rgba(255, 255, 255, 0.2)"

  disabled?: boolean; // Optional prop to disable the entire component
}

const DateRangePicker: React.FC<DateRangePickerProps> = ({ 
  allowedTypes, 
  onFilterChange,
  initialType = 'Monthly',
  opacity = 0.75, 
  blur = 10,
  bgColor = "var(--color-primary)", // Default Navy
  hoverColor = "rgba(255, 255, 255, 0.15)", // Default light glass
  disabled,
}) => {
  const [dateType, setDateType] = useState<string>(initialType);
  // For Monthly: subValue = month (1-12), for Weekly: subValue = week (1-5)
  const [subValue, setSubValue] = useState<number>(() => {
    const now = new Date();
    if (initialType === 'Monthly') return now.getMonth() + 1;
    if (initialType === 'Weekly') return Math.ceil(now.getDate() / 7);
    return 1;
  });
  // For Weekly: monthValue = month (1-12)
  const [monthValue, setMonthValue] = useState<number>(() => {
    const now = new Date();
    if (initialType === 'Weekly') return now.getMonth() + 1;
    if (initialType === 'Monthly') return now.getMonth() + 1;
    return now.getMonth() + 1;
  });
  const [yearValue, setYearValue] = useState<number>(new Date().getFullYear());
  const [customDates, setCustomDates] = useState({ 
    from: new Date().toISOString().split('T')[0], 
    to: new Date().toISOString().split('T')[0] 
  });

  const types = allowedTypes || ['Today', 'Yesterday', 'Weekly', 'Monthly', 'Yearly', 'Custom'];

  const calculateRange = useCallback((): DateRangeResult => {   
    const now = new Date();
    let from = '';
    let to = '';
    const formatDate = (d: Date) => d.toLocaleDateString('en-CA');

    switch (dateType) {
      case 'Today': 
        from = to = formatDate(now); break;
      case 'Yesterday': {
        const yest = new Date();
        yest.setDate(now.getDate() - 1);
        from = to = formatDate(yest);
        break;
      }
      case 'Weekly': {
        // subValue: week number (1-5), monthValue: month (1-12), yearValue: year
        // Find first day of selected month
        const firstDayOfMonth = new Date(yearValue, monthValue - 1, 1);
        // Find the first day of the week 1 (could be 1st or the first Monday/Sunday, but here we use 1st)
        const weekStart = new Date(firstDayOfMonth);
        weekStart.setDate(firstDayOfMonth.getDate() + (subValue - 1) * 7);
        // Clamp weekStart to not exceed month
        if (weekStart.getMonth() !== monthValue - 1) {
          from = '';
          to = '';
          break;
        }
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        // Clamp weekEnd to end of month
        const lastDayOfMonth = new Date(yearValue, monthValue, 0);
        if (weekEnd > lastDayOfMonth) weekEnd.setDate(lastDayOfMonth.getDate());
        from = formatDate(weekStart);
        to = formatDate(weekEnd);
        break;
      }
      case 'Last Week': {
        // Get last week's Monday and Sunday
        const today = new Date();
        const day = today.getDay();
        // 0 (Sun) -> 7
        const diffToMonday = day === 0 ? 6 : day - 1;
        const lastMonday = new Date(today);
        lastMonday.setDate(today.getDate() - diffToMonday - 7);
        const lastSunday = new Date(lastMonday);
        lastSunday.setDate(lastMonday.getDate() + 6);
        from = formatDate(lastMonday);
        to = formatDate(lastSunday);
        break;
      }
      case 'Last Month': {
        const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
        from = formatDate(prevMonth);
        to = formatDate(prevMonthEnd);
        break;
      }
      case 'Monthly':
        from = formatDate(new Date(yearValue, subValue - 1, 1));
        to = formatDate(new Date(yearValue, subValue, 0));
        break;
      case 'Yearly':
        from = `${yearValue}-01-01`; 
        to = `${yearValue}-12-31`;
        break;
      case 'Custom':
        from = customDates.from; 
        to = customDates.to;
        break;
      default:
        from = to = formatDate(now);
    }
    return { from, to };
  }, [dateType, subValue, yearValue, customDates, monthValue]);
  
  // Emit the object whenever selections change
  useEffect(() => {
    const range = calculateRange();
    onFilterChange(range);
  }, [dateType, subValue, yearValue, customDates, monthValue, onFilterChange]);


  const handleDateTypeChange = (newType: string) => {
    const now = new Date();
    setDateType(newType);

    if (newType === 'Weekly') {
      setMonthValue(now.getMonth() + 1);
      setSubValue(Math.ceil(now.getDate() / 7));
      setYearValue(now.getFullYear());
    } else if (newType === 'Monthly') {
      // When switching to monthly, subValue becomes the month
      setSubValue(now.getMonth() + 1);
      setYearValue(now.getFullYear());
    } else if (newType === 'Yearly') {
      setYearValue(now.getFullYear());
    }
    // For other types, no sub-state needs to be reset immediately
    // as they don't depend on subValue, monthValue, or yearValue
  };


  const effectiveHover = hoverColor || bgColor;

  return (
    <div 
      className="date-filter-group" 
      style={{ 
        ["--local-bg" as any]: (
          bgColor.startsWith('var') || 
          bgColor.startsWith('#') || 
          bgColor === 'transparent'
        ) 
          ? bgColor 
          : `rgba(${bgColor}, ${opacity})`,

        // 2. Use effectiveHover here instead of hoverColor
        ["--local-hover" as any]: (
          effectiveHover.startsWith('var') || 
          effectiveHover.startsWith('#') || 
          effectiveHover === 'transparent'
        )
          ? effectiveHover
          : `rgba(${effectiveHover}, ${opacity > 0.8 ? 0.9 : opacity + 0.15})`,

        backdropFilter: `blur(${blur}px)`,
        WebkitBackdropFilter: `blur(${blur}px)`,
        opacity: 1
      }}
    >
      <div className="datepicker-filter-item">
        <Calendar size={14} color="var(--color-bg)" />
        <select disabled={disabled} value={dateType} onChange={(e) => handleDateTypeChange(e.target.value)} className="date-select">
          {types.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>


      {dateType === 'Weekly' && (
        <div className="animate-in datepicker-filter-item">
          <select disabled={disabled} value={monthValue} onChange={e => setMonthValue(Number(e.target.value))} className="date-select">
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {new Date(0, i).toLocaleString('default', { month: 'long' })}
              </option>
            ))}
          </select>
          <select disabled={disabled} value={subValue} onChange={e => setSubValue(Number(e.target.value))} className="date-select">
            {[1,2,3,4,5].map(week => (
              <option key={week} value={week}>{`Week ${week}`}</option>
            ))}
          </select>
          <input disabled={disabled} type="number" value={yearValue} onChange={e => setYearValue(Number(e.target.value))} className="year-input-inline" />
        </div>
      )}

      {dateType === 'Monthly' && (
        <div className="animate-in datepicker-filter-item">
          <select disabled={disabled} value={subValue} onChange={(e) => setSubValue(Number(e.target.value))} className="date-select">
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {new Date(0, i).toLocaleString('default', { month: 'long' })}
              </option>
            ))}
          </select>
          <input disabled={disabled} type="number" value={yearValue} onChange={(e) => setYearValue(Number(e.target.value))} className="year-input-inline" />
        </div>
      )}

      {dateType === 'Yearly' && (
        <div className="animate-in datepicker-filter-item">
          <input disabled={disabled} type="number" value={yearValue} onChange={(e) => setYearValue(Number(e.target.value))} className="year-input-inline" />
        </div>
      )}

      {dateType === 'Custom' && (
        <div className="animate-in custom-date-inputs">
          <input disabled={disabled} type="date" value={customDates.from} onChange={(e) => setCustomDates({ ...customDates, from: e.target.value })} />
          <span>to</span>
          <input disabled={disabled} type="date" value={customDates.to} onChange={(e) => setCustomDates({ ...customDates, to: e.target.value })} />
        </div>
      )}
    </div>
  );
};

export default DateRangePicker;