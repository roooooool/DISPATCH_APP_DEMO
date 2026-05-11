import React, { useState, useImperativeHandle, forwardRef, useRef, useEffect } from 'react';
import { Wrench, Fuel } from 'lucide-react';
import { createPortal } from "react-dom";
import {HighlightText, encodeColumnName as enc} from './components/ewul_TableFlex';

//
import {ATTENDANCE_STATUS_COLORS} from './truth.config';

//
import {ewulFetchAll} from './utils/Ewul_GSDC_Utils';


import {LiveVehicleAssignmentLIstViewService} from './generated/services/LiveVehicleAssignmentLIstViewService';
import { DMS_CEMService } from './generated/services/DMS_CEMService';
import { UpsertAttendanceLogService } from './generated/services/UpsertAttendanceLogService';


// This is the global controller
export type ModalOptions = {
  data: any;
  renderCustomContent?: (data: any) => React.ReactNode;
  title?: string;
};

export let openFleetModal: (options: ModalOptions) => void = () => {};

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
  const [dropdownPos, setDropdownPos] = useState<{top: number, left: number, width: number}>({top: 0, left: 0, width: 0});
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
        onMouseEnter={() => {setHover(true);}}
        onMouseLeave={() => {setHover(false);}}
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
      onMouseEnter={() => setIsHovered(true) }
      onMouseLeave={() => setIsHovered(false) }
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
    return { success: true};
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
      <Fuel size={(fontSize ? fontSize*1.2 : 1)+'rem'} color={color}/>
    </div>
  );

}