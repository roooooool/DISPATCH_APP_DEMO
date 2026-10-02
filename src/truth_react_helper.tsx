import React, { useState, useImperativeHandle, forwardRef, useRef, useEffect, useMemo } from 'react';
import { Wrench, Fuel, Pencil, Lock } from 'lucide-react';
import { createPortal } from "react-dom";
import { HighlightText, encodeColumnName as enc } from './components/ewul_TableFlex';

//
import { ATTENDANCE_STATUS_COLORS } from './truth.config';

//@ts-ignore
import { ewulFetchAll, ewulCreate, ewulUpdate, ewulDelete, ewulExecute, ewulSharePointAPI, } from './utils/Ewul_GSDC_Utils';


import { LiveVehicleAssignmentLIstViewService } from './generated/services/LiveVehicleAssignmentLIstViewService';
//@ts-ignore
import { DMS_CEMService } from './generated/services/DMS_CEMService';
//@ts-ignore
import { UpsertAttendanceLogService } from './generated/services/UpsertAttendanceLogService';
//@ts-ignore
import { UpsertNewTripRemarksService } from './generated/services/UpsertNewTripRemarksService';
//@ts-ignore
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
  emitSignal?: (signal: string, record: any) => void; // <--- Signal emitter function
  signalKey?: string;
}

export const PersonnelCell: React.FC<PersonnelProps> = ({
  employeeName,
  row,
  statusRaw,
  searchTerm,
  onAttendanceChange,
  emitSignal,
  signalKey,
}) => {
  const [localstatusRaw, setLocalstatusRaw] = useState(statusRaw);

  useEffect(() => {
    setLocalstatusRaw(statusRaw);
  }, [statusRaw]);

  const isEditLocked = Boolean(row.OE); // Only edit action is locked if row.OE exists

  const status = (localstatusRaw in ATTENDANCE_STATUS_COLORS
    ? localstatusRaw
    : "ABSENT") as keyof typeof ATTENDANCE_STATUS_COLORS;
  const attendance_initial = status.charAt(0);
  const statusConfig = ATTENDANCE_STATUS_COLORS[status];

  return employeeName ? (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        position: 'relative',
        paddingRight: 20
      }}
      title={status}
    >
      {/* Attendance Dropdown - Unaffected */}
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
          setLocalstatusRaw(newStatus);
          onAttendanceChange(newStatus, row);
        }}
      >
        {attendance_initial}
      </DropdownSpan>

      {/* Fleet Modal Trigger - Unaffected */}
      <span
        onClick={() => {
          emitSignal?.('VIEW_FLEET_MODAL', row);
        }}
        className='fleetmonpage-redhover stop-propagation'
        style={{
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          textAlign: 'left',
          color: 'var(--color-primary)',
          cursor: 'pointer'
        }}
        title={`View: ${employeeName}`}
      >
        <HighlightText text={employeeName} highlight={searchTerm} isSearchable={true} />
      </span>

      {/* Edit Button: Locked/Disabled if row.OE exists */}
      {isEditLocked ? (
        <span
          title="System Detected Pair"
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            color: '#d97706',
            cursor: 'not-allowed',
            padding: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: 0.6
          }}
        >
          <Lock size={12} />
        </span>
      ) : (
        <button
          type="button"
          className="stop-propagation"
          onClick={(e) => {
            e.stopPropagation();
            emitSignal?.(`EDIT_PERSONNEL_${signalKey}`, row);
          }}
          title={`Edit Pair`}
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: 2,
            color: 'var(--color-primary)',
            opacity: 0.7,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Pencil size={13} />
        </button>
      )}
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
    const result = await ewulUpdate('DISPATCH_APP_DMS', 'DMS_CEM', ID, { [enc("Trip Status")]: newValue })
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
    ewulExecute('DISPATCH_APP_DMS', 'UpsertAttendanceLog', {
      EmployeeName: empName,
      EmployeeID: empId,
      AttendanceDate: new Date().toISOString().split('T')[0],
      AttendanceStatus: newAttendance || 'PRESENT',
      OE: OE || '',
    });
    return { success: true };
  } catch (error) {
    console.error("Fetch error:", error);
    return { success: false, error };
  }
};

export const renderRepairIcon = (
  row: any,
  jrNumberKey: string,
  jrStatusKey: string,
  fontSize: number = 1
) => {
  const jrNumber = row[jrNumberKey];
  const jrStatus = row[jrStatusKey];

  if (!jrNumber) return null;

  let wrenchColor = 'var(--color-primary)';
  if (jrStatus === 'On going' || jrStatus === 'Converted to JO') wrenchColor = 'var(--color-orange)';
  if (jrStatus === 'Pending') wrenchColor = 'var(--color-yellow)';

  const isOngoing = jrStatus === 'On going' || jrStatus === 'Converted to JO';
  const computedSize = Math.round(18 * fontSize);

  return (
    <span
      title={`Repair Job: ${jrNumber}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        lineHeight: 0, // Removes extra bottom spacing caused by baseline alignment
        flexShrink: 0,
      }}
    >
      <Wrench
        size={computedSize}
        strokeWidth={2.5}
        fill={wrenchColor}
        style={{
          color: wrenchColor,
          filter: 'drop-shadow(0px 1px 1px rgba(0,0,0,0.1))',
          display: 'block', // Prevents inline SVG extra bottom margin
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



//REMARKS INPUT
// Props matching DDRemarksStatusDropdown structure
interface DDRemarksInputProps {
  row: any;
  value?: string | null;
  placeholder?: string;
  fieldKey?: string; // Target property name (defaults to 'Planning')
  onRecordChange?: (updatedRecord: any) => void;
}

// 1. Optimistic Save Handler (Fire & Forget in background)
const onRemarksInputSave = (
  newVal: string,
  row: any,
  fieldKey: string,
  onRecordChange?: (updatedRecord: any) => void
) => {
  const recordId = row?.ID || row?.id;

  // A. Immediate Optimistic UI Update
  if (onRecordChange) {
    onRecordChange({
      ...row,
      [fieldKey]: newVal,
    });
  }

  // B. Background API Call
  saveODMRemarks(newVal, recordId).catch((error) => {
    console.error('Failed to persist input remarks:', error);
    // Optional: add rollback handler here if needed
  });
};

export const DDRemarksInputCompact: React.FC<DDRemarksInputProps> = ({
  row,
  value = null,
  placeholder = 'Add remarks...',
  fieldKey = 'Planning',
  onRecordChange,
}) => {
  const cleanInitial = value ?? '';

  const [currentVal, setCurrentVal] = useState<string>(cleanInitial);
  const [savedValue, setSavedValue] = useState<string>(cleanInitial);
  const [isFocused, setIsFocused] = useState<boolean>(false);

  const valueRef = useRef<string>(cleanInitial);
  const savedValueRef = useRef<string>(cleanInitial);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  valueRef.current = currentVal;
  savedValueRef.current = savedValue;

  // Sync state with upstream table row updates
  useEffect(() => {
    const freshVal = value ?? '';
    setCurrentVal(freshVal);
    setSavedValue(freshVal);
  }, [value]);

  const isEdited = currentVal !== savedValue;

  // Auto-resize height based on focus state
  useEffect(() => {
    if (textareaRef.current) {
      if (isFocused) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
      } else {
        textareaRef.current.style.height = '';
      }
    }
  }, [currentVal, isFocused]);

  const handleCancel = () => {
    setCurrentVal(savedValue);
    setTimeout(() => {
      textareaRef.current?.blur();
    }, 0);
  };

  const handleSave = (valToSave = currentVal) => {
    if (valToSave !== savedValueRef.current) {
      setSavedValue(valToSave);
      onRemarksInputSave(valToSave, row, fieldKey, onRecordChange);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
      textareaRef.current?.blur();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    if (valueRef.current !== savedValueRef.current) {
      handleSave(valueRef.current);
    }
  };

  return (
    <div className={`dd-compact-wrapper ${isEdited ? 'is-edited' : ''} ${isFocused ? 'is-focused' : ''}`}>
      <textarea
        ref={textareaRef}
        rows={1}
        value={currentVal}
        placeholder={placeholder}
        onChange={(e) => setCurrentVal(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => setIsFocused(true)}
        onBlur={handleBlur}
        className="dd-compact-textarea"
      />

      {isEdited && (
        <div className="dd-compact-actions">
          <span className="dd-compact-unsaved-badge">(Unsaved)</span>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleCancel}
            className="dd-compact-btn dd-compact-undo"
            title="Undo changes (Esc)"
            aria-label="Undo changes"
          >
            ↺
          </button>
        </div>
      )}
    </div>
  );
};

// Standard service caller
const saveODMRemarks = async (newRemarks: string, recordID: string) => {
  return await ewulUpdate('DISPATCH_APP_DMS', 'DMS_CEM', recordID, { [enc('Planning')]: newRemarks });
};

// Renderer accepting (onRecordChange, row) matching DDRemarksStatusDropdown structure
export const renderDDRemarksInput = (
  onRecordChange: ((updatedRecord: any) => void) | undefined,
  row: any,
  fieldKey: string = 'Planning'
) => {
  const value = row[fieldKey];
  const safeValue = value ? String(value) : null;
  const recordId = row?.ID || row?.id || row?._rowId;

  return (
    <DDRemarksInputCompact
      key={`${recordId}-${safeValue}`}
      row={row}
      value={safeValue}
      fieldKey={fieldKey}
      onRecordChange={onRecordChange}
    />
  );
};



// NEW TRIPS Dropdown REMARKS
interface DDRemarksStatusDropdownProps {
  id: string;
  value?: string | null;
  placeholder?: string;
  oe?: string;
  row: any;
  onRecordChange?: (updatedRecord: any) => void;
  fontSize?: number;
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
const onRemarksStatusDropdownChange = (
  val: string,
  id: string,
  oe: string,
  row: any,
  onRecordChange?: (updatedRecord: any) => void
) => {
  console.log('upserting remarks: ', val, ' id: ', id, ' oe: ', oe);

  if (onRecordChange) {
    onRecordChange({
      ...row,
      ODMRemarks: val,
    });
  }

  ewulExecute('DISPATCH_APP_DMS', 'UpsertNewTripRemarks', {
    OE: oe,
    Remarks: val,
  }).catch((error) => {
    console.error('Failed to persist remarks change:', error);
  });

};

// Internal removal handler
//@ts-ignore
const onRemarksStatusDropdownRemove = (
  id: string,
  //@ts-ignore
  oe: string,
  row: any,
  onRecordChange?: (updatedRecord: any) => void
) => {
  // 1. Immediately update parent table state (Optimistic)
  if (onRecordChange) {
    onRecordChange({
      ...row,
      ODMRemarks: null,
      remarksID: null,
    });
  }

  // 2. Fire delete in background
  ewulDelete('DISPATCH_APP_DMS', 'DMS_NewTrip_Remarks', id)
    .catch((error) => {
      console.error('Failed to delete remarks:', error);
      // Optional: Handle error
    });
};

export const DDRemarksStatusDropdown: React.FC<DDRemarksStatusDropdownProps> = ({
  id,
  value = null,
  placeholder = '+ Add Remarks',
  oe,
  row,
  onRecordChange,
  fontSize,
}) => {
  const [selected, setSelected] = useState<string | null>(value ?? null);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);

  // Convert numeric multiplier (e.g. 0.85, 1, 1.2) or px value to valid inline style
  const fontStyle = useMemo(() => {
    if (!fontSize) return undefined;
    // If number is small (e.g. <= 3), treat as rem multiplier; if large (e.g. > 3), treat as px
    const fontSizeValue = typeof fontSize === 'number'
      ? (fontSize <= 3 ? `${fontSize}rem` : `${fontSize}px`)
      : fontSize;

    return { fontSize: fontSizeValue };
  }, [fontSize]);

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
    setIsOpen(false);

    if (option === 'None') {
      setSelected('+ Add Remarks');
      onRemarksStatusDropdownRemove(id, oe || '', row, onRecordChange);
    } else {
      setSelected(option);
      onRemarksStatusDropdownChange(option, id, oe || '', row, onRecordChange);
    }
  };

  return (
    <div className="dd-status-wrapper">
      <button
        ref={triggerRef}
        type="button"
        style={fontStyle}
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
              ...fontStyle,
            }}
          >
            {STATUS_OPTIONS.map((option) => (
              <li key={option}>
                <button
                  type="button"
                  style={fontStyle}
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

export const renderDDRemarksStatusDropdown = (
  onRecordChange: ((updatedRecord: any) => void) | undefined,
  row: any,
  fontSize?: number
) => {
  const id = row['remarksID'];
  const value = row['ODMRemarks'];
  const oe = row['OE'];

  const safeId = String(id ?? '');
  const safeValue = value ? String(value) : null;

  return (
    <DDRemarksStatusDropdown
      key={`${safeId}-${safeValue}`}
      id={safeId}
      value={safeValue}
      oe={oe}
      placeholder={safeValue || '+ Add Remarks'}
      row={row}
      onRecordChange={onRecordChange}
      fontSize={fontSize}
    />
  );
};