import React, { useState, useImperativeHandle, forwardRef, useRef, useEffect } from 'react';
import { Wrench, Fuel } from 'lucide-react';
import { createPortal } from "react-dom";
import { HighlightText, encodeColumnName as enc } from './components/ewul_TableFlex';

//
import { ATTENDANCE_STATUS_COLORS } from './truth.config';

//
import { ewulFetchAll } from './utils/Ewul_GSDC_Utils';


import { LiveVehicleAssignmentLIstViewService } from './generated/services/LiveVehicleAssignmentLIstViewService';
import { DMS_CEMService } from './generated/services/DMS_CEMService';
import { UpsertAttendanceLogService } from './generated/services/UpsertAttendanceLogService';
import { UpsertNewTripRemarksService } from './generated/services/UpsertNewTripRemarksService';
import { DMS_NewTrip_RemarksService } from './generated/services/DMS_NewTrip_RemarksService';


import './components/comp_css/DDRemarksInput.css';
import './components/comp_css/DDRemarksStatusDropdown.css';


// This is the global controller
export type ModalOptions = {
  data: any;
  renderCustomContent?: (data: any) => React.ReactNode;
  title?: string;
};

export let openFleetModal: (options: ModalOptions) => void = () => { };

export const GlobalFleetModal = forwardRef((_props, ref) => {
  const [isOpen, setIsOpen] = useState(false);
  const [modalOptions, setModalOptions] = useState<ModalOptions | null>(null);

  const open = (options: ModalOptions) => {
    setModalOptions(options);
    setIsOpen(true);
  };

  useImperativeHandle(ref, () => ({ open }));
  openFleetModal = open;

  if (!isOpen || !modalOptions) return null;

  const { data, renderCustomContent, title } = modalOptions;

  return (
    <div className="fleetmon-modal-overlay" onClick={() => setIsOpen(false)}>
      <div
        className="fleetmon-modal-content stop-propagation"
        onClick={e => e.stopPropagation()}
        style={{ borderRadius: 8, border: '2px solid transparent', backgroundImage: 'linear-gradient(white, white), linear-gradient(to right, #3a4efc, #ff0000)', backgroundOrigin: 'border-box', backgroundClip: 'content-box, border-box' }}
      >
        <h3 style={{ color: 'var(--color-text-2)' }}>{title || `Details: ${data?.TruckFull}`}</h3>
        <hr />

        {/* If a custom renderer is provided, use it. Otherwise, fallback to default. */}
        <div className="fleetmon-modal-body">
          {renderCustomContent ? (
            renderCustomContent(data)
          ) : (
            <pre>{JSON.stringify(data, null, 2)}</pre>
          )}
        </div>

        <button onClick={() => setIsOpen(false)}>Close</button>
      </div>
    </div>
  );
});



/////////////////////////// FOR DROPDOWN IN PERSONNEL CELL ///////////////////////////


const DropdownSpan: React.FC<{
  style: React.CSSProperties;
  statusKey: keyof typeof ATTENDANCE_STATUS_COLORS;
  onSelect?: (key: keyof typeof ATTENDANCE_STATUS_COLORS) => void;
  children: React.ReactNode;
  hasOE: boolean;
}> = ({ style, statusKey, onSelect, children, hasOE }) => {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number, left: number, width: number }>({ top: 0, left: 0, width: 0 });
  const [localStatusKey, setlocalStatusKey] = useState(statusKey);
  useEffect(() => {
    setlocalStatusKey(statusKey);
  }, [statusKey]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  useEffect(() => {
    if (open && ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width
      });
    }
  }, [open]);

  useEffect(() => {
    const handleScroll = () => {
      if (open) {
        setOpen(false); // Close immediately when movement is detected
      }
    };

    if (open) {
      // 'true' is critical here to catch scrolls inside the table container
      window.addEventListener("scroll", handleScroll, true);
    }

    return () => {
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [open]);




  const filteredOptions = Object.entries(ATTENDANCE_STATUS_COLORS)
    .filter(([_, config]) => {
      if (hasOE) {
        return config.withTrip === 'yes' || config.withTrip === 'any';
      } else {
        return config.withTrip === 'no' || config.withTrip === 'any';
      }
    })
    .map(([key, val]) => ({
      key,
      label: val.label,
      color: val.bg,
    }));

  return (
    <div
      ref={ref}
      style={{ position: "relative", display: "inline-block" }}
    >
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '4px 10px',
          minWidth: 28,
          minHeight: 28,
          cursor: 'pointer',
          borderRadius: hover ? 6 : 4,
          background: hover ? style.color : undefined,
          transition: 'background 0.15s, color 0.15s',
        }}
        onClick={() => {
          console.log("Dropdown trigger clicked. Current status:", localStatusKey);
          setOpen((v) => !v);
          //setOpen(true); // Always open on click, let outside clicks handle closing
        }}
        onMouseEnter={() => { setHover(true); }}
        onMouseLeave={() => { setHover(false); }}
        className='stop-propagation'
      >
        <span
          style={{
            ...style,
            color: hover ? 'var(--color-text-2)' : style.color,
            background: 'none',
            margin: 0,
            minWidth: 0,
            minHeight: 0,
            borderRadius: 0,
            transition: 'color 0.15s',
          }}
        >
          {children}
        </span>
      </div>
      {open && createPortal(
        <div
          onMouseDown={(e) => e.stopPropagation()} // Stop mousedown from closing the portal
          className="attendance-dropdown-animate-in"
          style={{
            position: "absolute",
            top: dropdownPos.top,
            left: dropdownPos.left,
            background: "var(--color-bg)",
            border: "1px solid var(--color-border)",
            borderRadius: 4,
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            zIndex: 9999,
            minWidth: dropdownPos.width || 100,
          }}
        >
          {filteredOptions.map((opt) => (
            <div
              className='stop-propagation'
              key={opt.key}
              style={{
                padding: "8px 12px", // Increased hit area for "gentle design"
                cursor: "pointer",
                whiteSpace: "nowrap",
                color: opt.key === localStatusKey ? 'var(--color-text-2)' : 'var(--color-primary)',
                background: opt.key === localStatusKey ? "var(--color-primary)" : undefined,
                position: 'relative', // Ensures it's the top layer
                zIndex: 10000,        // Higher than the portal container
              }}
              onClick={() => {
                //e.preventDefault(); // Added to prevent default browser behavior
                console.log("Dropdown Option Clicked:", opt.key); // Debugging log
                setlocalStatusKey(opt.key as keyof typeof ATTENDANCE_STATUS_COLORS);
                onSelect?.(opt.key as keyof typeof ATTENDANCE_STATUS_COLORS);
                setOpen(false);
              }}
            >
              {opt.label}
            </div>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
};

export interface PersonnelProps {
  employeeName: any;
  row: any;
  statusRaw: string;
  searchTerm: string;
  onAttendanceChange: (newValue: string, row: any) => void;
}

export const PersonnelCell: React.FC<PersonnelProps> = ({ employeeName, row, statusRaw, searchTerm, onAttendanceChange }) => {

  const [localstatusRaw, setLocalstatusRaw] = useState(statusRaw);
  useEffect(() => {
    setLocalstatusRaw(statusRaw);
  }, [statusRaw]);
  const status = (localstatusRaw in ATTENDANCE_STATUS_COLORS
    ? localstatusRaw
    : "ABSENT") as keyof typeof ATTENDANCE_STATUS_COLORS;
  const attendance_initial = status.charAt(0);
  const statusConfig = ATTENDANCE_STATUS_COLORS[status];



  //console.log("Rendering Personnel Cell:", { employeeName, employeeType, status, row });




  return employeeName ? (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} title={status}>
      <DropdownSpan
        style={{
          fontWeight: 'bold',
          color: statusConfig.bg,
          fontSize: 13,
          marginRight: 4,
          letterSpacing: 0.5,
          minWidth: 10,
          textTransform: 'uppercase',
        }}
        statusKey={status}
        hasOE={row.OE}
        onSelect={(newStatus) => {
          console.log("Selected new status:", newStatus, "for row:", row);
          setLocalstatusRaw(newStatus);
          onAttendanceChange(newStatus, row);
        }}
      >
        {attendance_initial}
      </DropdownSpan>
      <span
        onClick={() => { openFleetModal(row); }}
        className='fleetmonpage-redhover stop-propagation'
        style={{
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          textAlign: 'left',
          color: 'var(--color-primary)'
        }}
        title={`View: ${employeeName}`}
      >
        <HighlightText text={employeeName} highlight={searchTerm} isSearchable={true} />
      </span>
    </div>
  ) : '---';
};

export interface StatusSelectProps {
  val: string;
  row: any;
  enc: (str: string) => string;
  TRIP_STATUSES: any[];
  onStatusChange: (newValue: string, row: any) => void;
}

export const StatusSelect: React.FC<StatusSelectProps> = ({ val, row, enc, TRIP_STATUSES, onStatusChange }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [localVal, setLocalVal] = useState(val);
  useEffect(() => {
    setLocalVal(val);
  }, [val]);

  // Filter logic based on your existing structure
  const availableStatuses = TRIP_STATUSES.filter(status =>
    Array.isArray(status.Progress) &&
    status.Progress.some((progress: { Progress: string }) =>
      progress && progress.Progress === row[enc("Trip Progress")]
    )
  );



  return (
    <select
      value={localVal}
      onClick={(e) => e.stopPropagation()} // Prevents row selection in OrderManagement
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onChange={(e) => {
        setLocalVal(e.target.value);
        onStatusChange(e.target.value, row);
      }}
      style={{
        padding: '4px 8px',
        borderRadius: '4px', // Gentle design
        outline: 'none',
        // Primary theme colors
        border: `1px solid ${isHovered ? 'var(--color-accent-light)' : 'transparent'}`,
        backgroundColor: isHovered ? 'var(--color-accent)' : 'transparent',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        fontSize: '12px',
        color: isHovered ? 'var(--color-text-2)' : 'var(--color-primary)',
        fontWeight: 'bold',
      }}
      className='stop-propagation'
    >
      {availableStatuses.map(status => (
        <option key={status.Status} value={status.Status}>
          {status.Alias && status.Alias.trim() !== "" ? status.Alias : status.Status}
        </option>
      ))}
    </select>
  );
};


export const handleUpdateStatus = async (newValue: string, row: any) => {


  const ID = row.dmsID;
  try {
    const result = await DMS_CEMService.update(ID, { [enc("Trip Status")]: newValue });
    console.log("Status update result:", result);

    if (result.error) {
      throw new Error(result.error.message);
    }

    return { success: true, data: result.data };

  } catch (error) {
    console.error('Failed to save trip:', error);
    return { success: false, error };
  }


};

export const handleUpdateAttendanceStatus = async (newAttendance: string, empId: string, empName: string, OE: string) => {
  try {
    UpsertAttendanceLogService.UpsertAttendanceLog({
      EmployeeName: empName,
      EmployeeID: empId,
      AttendanceDate: new Date().toISOString().split('T')[0],
      AttendanceStatus: newAttendance || 'PRESENT',
      OE: OE || '',
    } as any);
    return { success: true };
  } catch (error) {
    console.error("Fetch error:", error);
    return { success: false, error };
  }
};

export const renderRepairIcon = (row: any, jrNumberKey: string, jrStatusKey: string) => {
  const jrNumber = row[jrNumberKey];
  const jrStatus = row[jrStatusKey];

  // If there's no Job Request number, don't show the icon
  if (!jrNumber) return null;

  // Determine color based on status
  let wrenchColor = 'var(--color-primary)'; // Fallback to Navy
  if (jrStatus === 'On going') wrenchColor = 'var(--color-orange)';
  if (jrStatus === 'Pending') wrenchColor = 'var(--color-yellow)';

  const isOngoing = jrStatus === 'On going';

  return (
    <span
      title={`Repair Job: ${jrNumber}`}
      style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}
    >
      <Wrench
        size={18}
        strokeWidth={2.5}
        fill={wrenchColor}
        style={{
          color: wrenchColor,
          filter: 'drop-shadow(0px 1px 1px rgba(0,0,0,0.1))'
        }}
        className={isOngoing ? "animate-wrench-pulse" : ""}
      />
    </span>
  );
};


export default {
  GlobalFleetModal,
};


//////// FETCH TRACTOR DETAILS ///


export const fetchTractorDetails = async (head_number: string) => {

  const options = {
    filter: `Head ${head_number}`, // Pass the filter here!
  }

  try {
    const result = await ewulFetchAll<any>(
      LiveVehicleAssignmentLIstViewService,
      options,
      1,
    );
    return result[0]; // return the first matched record, or handle as needed
  } catch (error) {
    console.error("Error fetching tractor details:", error);
    return null;
  }


};


export const renderFuelRequestIcon = (hasFuelRequest: boolean, hasFuelPO: boolean, hasFuelDisapproved: boolean, fontSize?: number) => {
  let color = 'transparent';
  let title = '';

  if (hasFuelRequest) {
    color = 'var(--color-yellow)'
    title = 'Request On Going'
  }
  if (hasFuelPO) {
    color = 'var(--color-green)'
    title = 'Request Liquidated'
  }
  if (hasFuelDisapproved) {
    color = 'var(--color-red)'
    title = 'Request Disapproved'
  }

  return (
    <div
      style={{
        display: 'flex',          // Enables Flexbox
        justifyContent: 'center', // Centers horizontally
        alignItems: 'center',     // Centers vertically
      }}
      title={title}
    >
      <Fuel size={(fontSize ? fontSize * 1.2 : 1) + 'rem'} color={color} />
    </div>
  );

}


interface DDRemarksInputProps {
  initialValue: string;
  onSave: (newValue: string) => void;
  placeholder?: string;
}

export const DDRemarksInputCompact: React.FC<DDRemarksInputProps> = ({
  initialValue,
  onSave,
  placeholder = 'Add remarks...'
}) => {
  // Normalize undefined / null / empty to strictly a string ""
  const cleanInitial = initialValue ?? '';

  const [value, setValue] = useState<string>(cleanInitial);
  const [savedValue, setSavedValue] = useState<string>(cleanInitial);
  const [isFocused, setIsFocused] = useState<boolean>(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync state if initialValue changes externally
  useEffect(() => {
    const freshVal = initialValue ?? '';
    setValue(freshVal);
    setSavedValue(freshVal);
  }, [initialValue]);

  // Strict string comparison ensures "" vs "something" works correctly
  const isEdited = value !== savedValue;

  // Auto-resize logic
  useEffect(() => {
    if (textareaRef.current) {
      if (isFocused) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
      } else {
        textareaRef.current.style.height = '';
      }
    }
  }, [value, isFocused]);

  const handleCancel = () => {
    // 1. Force value back to clean savedValue (even if it's "")
    setValue(savedValue);

    // 2. Delay blur slightly so state updates before collapsing height
    setTimeout(() => {
      textareaRef.current?.blur();
    }, 0);
  };

  const handleSave = () => {
    onSave(value);
    setSavedValue(value);

    setTimeout(() => {
      textareaRef.current?.blur();
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && isEdited) {
      handleSave();
    } else if (e.key === 'Escape' && isEdited) {
      handleCancel();
    }
  };

  return (
    <div className={`dd-compact-wrapper ${isEdited ? 'is-edited' : ''} ${isFocused ? 'is-focused' : ''}`}>
      <textarea
        ref={textareaRef}
        rows={1}
        value={value}
        placeholder={placeholder}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        className="dd-compact-textarea"
      />

      {isEdited && (
        <div className="dd-compact-actions">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()} // Prevents premature blur when clicking check
            onClick={handleSave}
            className="dd-compact-btn dd-compact-check"
            title="Save (Ctrl + Enter)"
            aria-label="Save"
          >
            ✓
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()} // Prevents premature blur when clicking cancel
            onClick={handleCancel}
            className="dd-compact-btn dd-compact-cancel"
            title="Cancel (Esc)"
            aria-label="Cancel"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
};

const saveODMRemarks = async (newRemarks: string, recordID: string) => {
  await DMS_CEMService.update(recordID, { [enc('Planning')]: newRemarks });
};

export const renderDDRemarksInput = (
  value: string,
  id: string
) => {
  const safeValue = value ?? '';

  return (
    <DDRemarksInputCompact
      key={`${id}-${safeValue}`} // Forces React to reset component state if table data changes
      initialValue={safeValue}
      onSave={(newValue) => saveODMRemarks(newValue, id)}
    />
  );
};





// NEW TRIPS DD REMARKS
// NEW TRIPS DD REMARKS
interface DDRemarksStatusDropdownProps {
  id: string;
  value?: string | null;
  placeholder?: string;
  oe?: string;
}

const STATUS_OPTIONS = [
  'None',
  'Advance order',
  'Waiting for advice',
  'Buffer OE',
  'for Cancellation',
];

// Internal change handler
//@ts-ignore
const onRemarksStatusDropdownChange = (val: string, id: string, oe: string) => {
  // if (!id) return;
  // DMS_NewTrip_RemarksService.delete(id);
  console.log('upserting remarks: ', val, ' id: ', id, ' oe: ', oe)
  UpsertNewTripRemarksService.UpsertNewTripRemarks({ OE: oe, Remarks: val } as any);
};

// Internal removal handler
//@ts-ignore
const onRemarksStatusDropdownRemove = (id: string, oe: string) => {
  // Call your API or service to remove/clear the remark
  // UpsertNewTripRemarksService.UpsertNewTripRemarks({ OE: oe, Remarks: "" } as any);
  DMS_NewTrip_RemarksService.delete(id);
  // Or: RemoveNewTripRemarksService.RemoveNewTripRemarks({ OE: oe, ID: id });
};

export const DDRemarksStatusDropdown: React.FC<DDRemarksStatusDropdownProps> = ({
  id,
  value = null,
  placeholder = '+ Add Remarks',
  oe,
}) => {
  // Local optimistic state
  const [selected, setSelected] = useState<string | null>(value ?? null);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);

  // Sync local state when external value prop changes
  useEffect(() => {
    setSelected(value ?? null);
  }, [value]);

  const updatePosition = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + window.scrollY + 6,
        left: rect.left + window.scrollX,
      });
    }
  };

  const toggleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isOpen) {
      updatePosition();
    }
    setIsOpen(!isOpen);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        triggerRef.current &&
        !triggerRef.current.contains(target) &&
        menuRef.current &&
        !menuRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const getStatusClass = (status?: string | null): string => {
    switch (status) {
      case 'Advance order':
        return 'status-light-blue';
      case 'Waiting for advice':
        return 'status-light-gray';
      case 'Buffer OE':
        return 'status-light-green';
      case 'for Cancellation':
        return 'status-light-red';
      case 'None':
        return 'status-light-gray';
      default:
        return 'status-placeholder';
    }
  };

  const handleSelect = (option: string) => {
    console.log('wew ups: ', option, ' id: ', id, ' oe: ', oe);
    setIsOpen(false);

    if (option === 'None') {
      // 1. Reset state to placeholder
      setSelected(null);
      // 2. Trigger removal handler
      onRemarksStatusDropdownRemove(id, oe || '');
    } else {
      // 1. Optimistic UI update
      setSelected(option);
      // 2. Trigger change handler
      onRemarksStatusDropdownChange(option, id, oe || '');
    }
  };

  return (
    <div className="dd-status-wrapper">
      <button
        ref={triggerRef}
        type="button"
        className={`dd-status-pill-trigger ${getStatusClass(selected)} ${isOpen ? 'is-open' : ''}`}
        onClick={toggleOpen}
      >
        <span className="dd-status-label">{selected ?? placeholder}</span>
        <span className={`dd-status-arrow ${isOpen ? 'open' : ''}`}>▼</span>
      </button>

      {isOpen &&
        createPortal(
          <ul
            ref={menuRef}
            onMouseDown={(e) => e.stopPropagation()}
            className="dd-status-menu-portal"
            style={{
              position: 'absolute',
              top: `${coords.top}px`,
              left: `${coords.left}px`,
            }}
          >
            {STATUS_OPTIONS.map((option) => (
              <li key={option}>
                <button
                  type="button"
                  className={`dd-status-option-pill ${getStatusClass(option)} ${selected === option ? 'is-selected' : ''
                    }`}
                  onClick={() => handleSelect(option)}
                >
                  {option}
                </button>
              </li>
            ))}
          </ul>,
          document.body
        )}
    </div>
  );
};

export const renderDDRemarksStatusDropdown = (id: any, value?: any, oe?: string) => {
  const safeId = String(id ?? '');
  const safeValue = value ? String(value) : null;

  return (
    <DDRemarksStatusDropdown
      key={safeId}
      id={safeId}
      value={safeValue}
      oe={oe}
      placeholder={safeValue || '+ Add Remarks'}
    />
  );
};