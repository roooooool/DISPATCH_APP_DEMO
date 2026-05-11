import React, { useState, useEffect, useRef } from 'react';
import { Calendar } from 'lucide-react';
import './comp_css/ModernTimestampInput.css';

const CustomDateTimePicker = ({ value, onChange, label, disabled, alreadyLocal}: any) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Helper to process the incoming value based on the new flag
  const getProcessedDate = (val: any) => {
    if (!val) return new Date();
    // If alreadyLocal is true, strip 'Z' so JS treats it as a local clock time
    const cleanValue = alreadyLocal && typeof val === 'string' ? val.replace(/Z$/i, '') : val;
    return new Date(cleanValue);
  };
  
  // Internal state to track pieces of the date
  const [viewMonth, setViewMonth] = useState(getProcessedDate(value).getMonth());
  const [viewYear, setViewYear] = useState(getProcessedDate(value).getFullYear());
  const [hours, setHours] = useState(getProcessedDate(value).getHours() % 12 || 12);
  const [minutes, setMinutes] = useState(getProcessedDate(value).getMinutes());
  const [isPM, setIsPM] = useState(getProcessedDate(value).getHours() >= 12);


  useEffect(() => {
    const d = getProcessedDate(value);

    setHours(d.getHours() % 12 || 12);
    setMinutes(d.getMinutes());
    setIsPM(d.getHours() >= 12);
    if (value) {
      setViewMonth(d.getMonth());
      setViewYear(d.getFullYear());
    }
  }, [value, alreadyLocal]); // Re-run if the flag changes

  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const years = Array.from({ length: 20 }, (_, i) => new Date().getFullYear() - 10 + i);

  const changeMonth = (offset: number) => {
    let newMonth = viewMonth + offset;
    let newYear = viewYear;
    if (newMonth < 0) { newMonth = 11; newYear--; }
    if (newMonth > 11) { newMonth = 0; newYear++; }
    setViewMonth(newMonth);
    setViewYear(newYear);
  };

    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

    // Calculate what day of the week the 1st falls on (0 = Sunday, 1 = Monday, etc.)
    const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay();

    // Check if the "Selected" date actually matches the month/year we are looking at
    // This prevents the "Selected" circle from appearing in every month
    const isViewingSelectedMonth = value && 
      getProcessedDate(value).getMonth() === viewMonth && 
      getProcessedDate(value).getFullYear() === viewYear;




  // Function to sync all pieces and send to Parent (Form)
  const updateParent = (newDate: Date, h: number, m: number, pm: boolean) => {
    const updated = new Date(newDate);
    let finalHour = pm ? (h % 12) + 12 : h % 12;
    updated.setHours(finalHour, m, 0, 0);
    
    if (alreadyLocal) {
      // Send back the string WITHOUT the Z
      const offset = updated.getTimezoneOffset() * 60000;
      const localString = new Date(updated.getTime() - offset).toISOString().slice(0, -1);
      onChange(localString);
    } else {
      onChange(updated.toISOString());
    }
  };

  const handleDateClick = (day: number) => {
    const newDate = new Date(viewYear, viewMonth, day, hours, minutes);
    if (isPM) {
      newDate.setHours((hours % 12) + 12);
    } else {
      newDate.setHours(hours % 12);
    }
    updateParent(newDate, newDate.getHours(), newDate.getMinutes(), isPM);
  };

  const handleTimeChange = (type: 'h' | 'm', val: string) => {
    const num = Math.max(0, parseInt(val) || 0);
    const currentDate = getProcessedDate(value);
    if (type === 'h') {
      const h = Math.min(12, num);
      setHours(h);
      updateParent(currentDate, h, minutes, isPM);
    } else {
      const m = Math.min(59, num);
      setMinutes(m);
      updateParent(currentDate, hours, m, isPM);
    }
  };

  const toggleAMPM = (pm: boolean) => {
    setIsPM(pm);
    updateParent(getProcessedDate(value), hours, minutes, pm);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // If the click is NOT inside the containerRef, close the picker
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(""); // Clears the value in formData
    setIsOpen(false);
  };





  return (
    <div className={`date-time-container ${disabled ? 'disabled' : ''}`} ref={containerRef}>
      {label && <label className="input-label-navy">{label}</label>}
      
      <div className={`gradient-input-wrapper ${isOpen ? 'active-wrap' : ''}`} onClick={() => {if (disabled) return; setIsOpen(!isOpen)}}>
        <div className="input-inner-container">
            <div className="display-values">
                {value ? (
                    <>
                    <span className="val-date">
                      {getProcessedDate(value).toLocaleDateString([], { 
                          month: 'short', 
                          day: 'numeric', 
                          year: 'numeric' 
                      })}
                    </span>
                    <span className="val-divider">|</span>
                    <span className="val-time">
                        {`${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${isPM ? 'PM' : 'AM'}`}
                    </span>
                    </>
                ) : (
                    <span className="val-placeholder" style={{ color: '#94a3b8' }}>Select Timestamp</span>
                )}
            </div>
          <Calendar size={16} className="navy-icon-dim" />
        </div>
      </div>

      {isOpen && (
        <div className="datetime-popover shadow-gentle">
            <div className="popover-controls-row">
                <button 
                  type="button" 
                  onClick={() => { 
                    const now = new Date();
                    if (alreadyLocal) {
                      // Create a "Naive" ISO string: YYYY-MM-DDTHH:mm:ss.sss
                      // We manually construct it or strip the Z from a local-representative string
                      const offset = now.getTimezoneOffset() * 60000;
                      const localISOTime = new Date(now.getTime() - offset).toISOString().slice(0, -1);
                      onChange(localISOTime);
                    } else {
                      onChange(now.toISOString());
                    }
                  }} 
                  className="btn-now-red"
                >
                  NOW
                </button>
                <button type="button" onClick={handleClear} className="btn-clear-gray">CLEAR</button>
            </div>

            <div className="calendar-nav-advanced">
                <button type="button" onClick={() => changeMonth(-1)} className="nav-arrow">{'<'}</button>
                <div className="nav-selectors">
                <select value={viewMonth} onChange={(e) => setViewMonth(parseInt(e.target.value))}>
                    {months.map((m, i) => <option key={m} value={i}>{m}</option>)}
                </select>
                <select value={viewYear} onChange={(e) => setViewYear(parseInt(e.target.value))}>
                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                </div>
                <button type="button" onClick={() => changeMonth(1)} className="nav-arrow">{'>'}</button>
            </div>
          
          <div className="calendar-grid-placeholder">
            <div className="calendar-day-labels">
               <span>S</span><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span>
            </div>
            <div className="calendar-days-mock">
                {[...Array(firstDayOfMonth)].map((_, i) => (
                  <div key={`empty-${i}`} className="day-cell empty"></div>
                ))}
                {[...Array(daysInMonth)].map((_, i) => {
                  const day = i + 1;
                  // Use helper for selection logic
                  const isSelected = isViewingSelectedMonth && getProcessedDate(value).getDate() === day;
                  return (
                      <div 
                        key={day} 
                        className={`day-cell ${isSelected ? 'selected' : ''}`}
                        onClick={() => handleDateClick(day)}
                      >
                        {day}
                      </div>
                  );
                })}
            </div>
          </div>

          <div className="time-control-group">
            <div className="time-input-box">
              <input type="number" value={hours} onChange={(e) => handleTimeChange('h', e.target.value)} />
              <span className="sep">:</span>
              <input type="number" value={minutes} onChange={(e) => handleTimeChange('m', e.target.value)} />
            </div>
            <div className="ampm-switch">
              <button type="button" className={(!isPM ? 'active' : '')} onClick={() => toggleAMPM(false)}>AM</button>
              <button type="button" className={isPM ? 'active' : ''} onClick={() => toggleAMPM(true)}>PM</button>
            </div>
          </div>
          <div className="popover-footer">
            <button type="button" onClick={() => setIsOpen(false)} className="btn-confirm-navy">Done</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomDateTimePicker;