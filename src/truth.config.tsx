export const APP_VERSION = "3.29.11"; // Update this with each release for better error tracking and user support


//react helper for truths
import {
  PersonnelCell,
  renderRepairIcon,
  StatusSelect,
  openFleetModal,
  type ModalOptions,
  fetchTractorDetails as _wew,
  handleUpdateStatus,
  handleUpdateAttendanceStatus,
  renderFuelRequestIcon,
  renderDDRemarksInput,
  renderDDRemarksStatusDropdown,
} from './truth_react_helper.tsx'

import { HighlightText } from './components/ewul_TableFlex';



// SINGLE SOURCE OF TRUTH FOR CONFIGURATIONS
export type UserInfo = {
  FirstName: string;
  MiddleName: string;
  LastName: string;
  BusinessUnit: string;
  Position: string;
  CurrentNav: string;
  id: string; // Unique identifier for the user, can be used for more robust localStorage handling
  lastNotificationCheck?: string; // ISO string for the last check time
  lastToastTimestamp?: string; // ISO string for the last toast notification time
  showCustomCursor?: boolean; // track custom cursor preference
  lastTripFilter?: string; // track last trip filter for persistence
  FullName?: string;
  lastActiveModule?: string;
  attendanceSheetZoom?: number;
  lastLogout?: string; // for the logout modal
};

export const mandatoryLogout = "2026-08-13 16:54:03"

export const TRIP_GROUPS = [
  { id: 'Trading_bulk', label: 'Trading - Bulk', color: '#092162' },
  { id: 'Hauling_bulk', label: 'Hauling - Bulk', color: '#fbbf24' },
  { id: 'Hauling_FB', label: 'Hauling - FB', color: '#f97316' },
  { id: 'Mobilization', label: 'Mobilization', color: '#e53935' },
  { id: 'Republic', label: 'Republic', color: '#4caf50' },
  { id: 'Trading_FB', label: 'Trading - FB', color: '#8e44ad' },
  { id: 'Preload', label: 'Preload', color: '#2c3e50' },
  { id: 'Others', label: 'Others', color: '#95a5a6' },
] as const;

export const STATUS_COLORS = {
  assigned: '#092162',    // Navy (Primary)
  source: '#fbbf24',      // Gold
  destination: '#f97316', // Orange
  done: '#2e7d32',        // Professional Green (Success)
};


export const GPS_STATUS_EMOJIS: Record<string, string> = {
  'Online': '🟢',      // Green
  'Delayed': '🟡',     // Yellow
  'Offline': '🔴',     // Red
  'Deactivated': '⚫'  // Black
};

/**
 * GSDC Fleet Status Theme
 * Neon-inspired palette for high visibility on dark/navy maps.
 */
export const GPS_STATUS_COLOR = {
  Online: {
    color: '#2cd80e',
    label: 'Online',
    // Neon green glow
    shadow: '0 0 10px rgba(33, 192, 5, 0.6)',
  },
  Delayed: {
    color: '#FFD700',
    label: 'Delayed',
    // Gold/Yellow glow
    shadow: '0 0 10px rgba(161, 137, 4, 0.6)',
  },
  Offline: {
    color: '#ff0000',
    label: 'Offline',
    // Red glow
    shadow: '0 0 10px rgba(151, 3, 3, 0.5)',
  },
  Deactivated: {
    color: '#1e1e1e',
    label: 'Deactivated',
    // Subtle dark shadow for black icons
    shadow: '0 2px 10px rgba(154, 153, 153, 0.2)',
  },
  Default: {
    color: '#3a4efc',
    label: 'Unknown',
    // Navy blue glow
    shadow: '0 0 10px rgba(33, 45, 153, 0.6)',
  }
} as const;

export const ATTENDANCE_STATUS_COLORS = {
  "SERVED": {
    bg: '#000066', // Navy Primary
    text: '#ffffff',
    label: 'Served',
    withTrip: 'never'
  },
  "ON TRIP": {
    bg: '#3a4efc', // Primary 2nd Blue
    text: '#ffffff',
    label: 'On-Trip',
    withTrip: 'yes'
  },
  "REST DAY": {
    bg: '#f1f5f9',
    text: '#94a3b8',
    border: '#e2e8f0',
    label: 'Rest Day',
    withTrip: 'no'
  },
  "PRESENT": {
    bg: '#10b981', // Green
    text: '#ffffff',
    label: 'Present',
    withTrip: 'any'
  },
  "ABSENT": {
    bg: '#ff0000', // Red Accent
    text: '#ffffff',
    label: 'Absent',
    withTrip: 'no'
  },
  "IN TRANSIT": {
    bg: '#f59e0b', // Amber
    text: '#ffffff',
    label: 'In Transit',
    withTrip: 'yes'
  },
  "TUKOD": {
    bg: '#f50b0b', // Bright Red
    text: '#ffffff',
    label: 'Tukod',
    withTrip: 'yes'
  },
  "LEAVE": {
    bg: '#6366f1', // Indigo
    text: '#ffffff',
    label: 'Leave',
    withTrip: 'no'
  },
  "AWOL": {
    bg: '#1f1f1f', // Dark/Black
    text: '#ffffff',
    label: 'AWOL',
    withTrip: 'no'
  }
} as const;

export type StatusKey = keyof typeof ATTENDANCE_STATUS_COLORS;
export const ATTENDANCE_SERVED_COUNTS_INITIAL = ["N", "Y", "X", "Z", "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "O", "P", "Q", "R", "S", "T", "U", "V", "W"];

export const SPECIAL_POSITIONS = ['Developer', 'Admin', 'Execom', "Manager", "IT SUPPORT"]; // Positions that bypass whitelist
export const NAV_DESTINATIONS = [
  {
    label: "Dashboard",
    path: "/dash",
    whiteList: ["Admin", "Manager", "OD", "Coor", 'DCC', 'LCC'],
    noSpecialAccess: false,
    hidden: false
  },
  {
    label: "Order Distribution",
    path: "/order-dist",
    whiteList: ["OD", 'DCC', 'LCC'],
    hidden: false
  },
  {
    label: "Trip Dispatch",
    path: "/order",
    whiteList: ["OD", "Coor", 'DCC', 'LCC', "Supervisor"],
    hidden: false
  },
  {
    label: "Fleet Monitoring",
    path: "/fleet",
    whiteList: ["Driver", "OD", "Coor", 'DCC', 'LCC', "Supervisor"],
    noSpecialAccess: false,
    hidden: false
  },
  {
    label: "Incident Reports",
    path: "/incidents",
    whiteList: ["Admin", "Manager", "OD", "Coor", 'DCC', 'LCC', 'Inspection', 'Supervisor'],
    noSpecialAccess: false,
    hidden: false
  },
  // { 
  //   label: "Command Center", 
  //   path: "/comcenter", 
  //   whiteList: ["Developer"],
  //   noSpecialAccess: false,
  //   hidden: false 
  // },
  // { 
  //   label: "Tickets", 
  //   path: "/tickets", 
  //   whiteList: ["Developer"],
  //   noSpecialAccess: true,
  //   hidden: false 
  // },


  {
    label: "Update Req",
    path: "/update-required",
    noSpecialAccess: true,
    whiteList: ["Developer"],
    hidden: true
  },
  {
    label: "Sys Maint",
    path: "/maintenance",
    whiteList: ["Developer"],
    noSpecialAccess: true, // Cannot be accessed by special positions unless whitelisted
    hidden: true
  },

];


// BU LIST

export const BUSINESS_UNITS = [
  {
    Title: "SBUO-1A",
    Assignment: "Vasquez",
    Business_Type: "CEMENT"
  },
  {
    Title: "SBUO-1B",
    Assignment: "Vasquez",
    Business_Type: "CEMENT"
  },
  {
    Title: "SBUO-1C",
    Assignment: "Intercity",
    Business_Type: "CEMENT"
  },
  {
    Title: "SBUO-1D",
    Assignment: "Vasquez",
    Business_Type: "CEMENT"
  },
  {
    Title: "SBUO-2A",
    Assignment: "Vasquez",
    Business_Type: "CEMENT"
  },
  {
    Title: "SBUO-2B",
    Assignment: "Vasquez",
    Business_Type: "CEMENT"
  },
  {
    Title: "SBUO-3A",
    Assignment: "Antipolo",
    Business_Type: "CEMENT"
  },
  {
    Title: "SBUO-4A",
    Assignment: "Vasquez",
    Business_Type: "CEMENT"
  },
  {
    Title: "THIRD PARTY",
    Assignment: "",
    Business_Type: ""
  },
];



// TRIP PROGRESS
export const TRIP_PROGRESS = [
  { idx: 0, Progress: "New Trip", label: "", color: 'var(--progress-newtrip)', selected: true, exclude: false },
  { idx: 1, Progress: "Assigned", label: "Assigned", color: 'var(--progress-assigned)', selected: true },
  { idx: 1, Progress: "Planned", label: "", color: 'var(--color-muted)', selected: true },
  { idx: 2, Progress: "Dispatched To Source", label: "To Source", color: 'var(--progress-source)', selected: true },
  { idx: 3, Progress: "Dispatched To Destination", label: "To Destination", color: 'var(--progress-destination)', selected: true },
  { idx: 4, Progress: "Done", label: "Done", color: 'var(--progress-done)', selected: false },
  //{idx: 4, Progress: "PLD Done", label: "PLD Done", color: 'var(--progress-done)', exclude: true},
]




// TRIP STATUSES
export const TRIP_STATUSES = [
  {
    Status: "AssignedTrips",
    _actual_dmsstat: "",
    Alias: "ASS",
    Progress: [TRIP_PROGRESS.find(item => item.idx === 1)],
    frDispatchStatus: "Empty",
  },
  {
    Status: "EMS",
    Alias: "",
    Progress: [TRIP_PROGRESS.find(item => item.idx === 2)],
    frDispatchStatus: "Empty",
  },
  {
    Status: "ITS",
    Alias: "",
    Progress: [TRIP_PROGRESS.find(item => item.idx === 2)],
    frDispatchStatus: "Empty",
  },
  {
    Status: "WTL",
    Alias: "",
    Progress: [TRIP_PROGRESS.find(item => item.idx === 2)],
    frDispatchStatus: "Empty",
  },
  {
    Status: "LDN",
    Alias: "",
    Progress: [TRIP_PROGRESS.find(item => item.idx === 2)],
    frDispatchStatus: "Loaded",
  },
  {
    Status: "LDS",
    Alias: "",
    Progress: [TRIP_PROGRESS.find(item => item.idx === 2)],
    frDispatchStatus: "Loaded",
  },
  {
    Status: "LDG",
    Alias: "",
    Progress: [TRIP_PROGRESS.find(item => item.idx === 2), TRIP_PROGRESS.find(item => item.idx === 3)],
    frDispatchStatus: "Loaded",
  },
  {
    Status: "Preloaded",
    Alias: "PLD",
    Progress: [TRIP_PROGRESS.find(item => item.idx === 2), TRIP_PROGRESS.find(item => item.idx === 3)],
    frDispatchStatus: "Empty",
  },

  {
    Status: "ITD",
    Alias: "",
    Progress: [TRIP_PROGRESS.find(item => item.idx === 3)],
    frDispatchStatus: "Loaded",
  },
  {
    Status: "LDD",
    Alias: "",
    Progress: [TRIP_PROGRESS.find(item => item.idx === 3)],
    frDispatchStatus: "Loaded",
  },
  {
    Status: "WTU",
    Alias: "",
    Progress: [TRIP_PROGRESS.find(item => item.idx === 3)],
    frDispatchStatus: "Loaded",
  },
  {
    Status: "ULD",
    Alias: "",
    Progress: [TRIP_PROGRESS.find(item => item.idx === 3)],
    frDispatchStatus: "Empty",
  },
  {
    Status: "ITG",
    Alias: "",
    Progress: [TRIP_PROGRESS.find(item => item.idx === 3)],
    frDispatchStatus: "Empty",
  },
  {
    Status: "ITR",
    Alias: "",
    Progress: [TRIP_PROGRESS.find(item => item.idx === 3)],
    frDispatchStatus: "Empty",
  },

  {
    Status: "ITG",
    Alias: "",
    Progress: [TRIP_PROGRESS.find(item => item.idx === 4)],
    frDispatchStatus: "Empty",
  },
  {
    Status: "Served",
    Alias: "SRV",
    Progress: [TRIP_PROGRESS.find(item => item.idx === 4)],
    frDispatchStatus: "Empty",
  },
  {
    Status: "Cancelled",
    Alias: "CNC",
    Progress: [TRIP_PROGRESS.find(item => item.idx === 4)],
    frDispatchStatus: "Empty",
  }
];


// Attendance Statuses
export const ATTENDANCE_STATUSES = [

  //ANY
  { seq: 0.0, Status: 'ABSENT', Alias: 'ABSENT', onduty: false, sort: 1.0 }, // ABSENT
  { seq: 1.1, Status: "PRESENT", Alias: "PRESENT", onduty: true, sort: 0.0 },


  //if has OE
  { seq: 2.1, Status: "ON TRIP", Alias: "ON TRIP", onduty: true, sort: 2.0 },
  { seq: 2.2, Status: "IN TRANSIT", Alias: "IN TRANSIT", onduty: true, sort: 2.1 },
  { seq: 2.3, Status: "TUKOD", Alias: "TUKOD", onduty: true, sort: 2.2 },
  { seq: 2.4, Status: "SERVED", Alias: "SERVED", onduty: true, sort: 0.1 },

  //if NO TRIP
  { seq: 3.1, Status: "REST DAY", Alias: "REST DAY", onduty: false, sort: 996 },
  { seq: 3.2, Status: "LEAVE", Alias: "LEAVE", onduty: false, sort: 997 },
  { seq: 3.3, Status: "AWOL", Alias: "AWOL", onduty: false, sort: 998 },
  { seq: 3.4, Status: "SUSPENDED", Alias: "SUSPENDED", onduty: false, sort: 999 },

]

export const SP_ATTENDANCE_STATUS_KEY_MAP: Record<string, string> = {
  [ATTENDANCE_STATUSES.find(s => s.Alias === 'ABSENT')!.Status]: "Absent",
  // Apprentice has no matching status in ATTENDANCE_STATUSES
  [ATTENDANCE_STATUSES.find(s => s.Alias === 'LEAVE')!.Status]: "Leave",
  [ATTENDANCE_STATUSES.find(s => s.Alias === 'ON TRIP')!.Status]: "On trip",
  [ATTENDANCE_STATUSES.find(s => s.Alias === 'IN TRANSIT')!.Status]: "On trip-Intransit",
  [ATTENDANCE_STATUSES.find(s => s.Alias === 'PRESENT')!.Status]: "Present",
  // Present-Awaiting Trip, Present-No Trip, Present-UR have no matching status in ATTENDANCE_STATUSES
  [ATTENDANCE_STATUSES.find(s => s.Alias === 'REST DAY')!.Status]: "Rest day",
  [ATTENDANCE_STATUSES.find(s => s.Alias === 'SUSPENDED')!.Status]: "Suspended",
};


// IR Types
export const IR_TYPES = [
  { label: "Short Bags", value: "Short Bags" },
  { label: "Idling", value: "Idling" },
  { label: "Overspeeding", value: "Overspeeding" },
]



// fetch loading key

export const FETCH_LOADING_KEYS = {
  newOrders: 'fetchNewOrders',
  trips: 'fetchTrips',
  lsList: 'fetchLSList',
  truckList: 'fetchTruckList',
  driverHelperList: 'fetchDriverHelperList',
  generatedTripID: 'fetchGeneratedTripID',
  generateAddOE: 'fetchGenerateAddOE',
  fleetPairing: 'fetchFleetPairing',
  sourceList: 'fetchSourceList',
  fuelRequests: 'fetchFuelRequests',
  fetchTripTaskLists: 'fetchTripTaskLists',
  fetchAttendanceServedCounts: 'fetchAttendanceServedCounts',
  cifmeOrders: 'fetchCIFMEOrders',
}

export const GSDC_NAVIGATE_TO_TRIP_key = '4557554c504f4749';
export const GSDC_SEND_TO_CHAT_key = '4557554c4d414c414b4554495445';



export const FR_REQUEST_CATEGORY = [
  { label: "New Trip", value: "New Trip", onlyFirstTime: true },
  { label: "Additional", value: "Additional Diesel request", onlyFirstTime: false },
  { label: "Diverted", value: "Diverted", onlyFirstTime: false },
  { label: "Rescue", value: "Rescue", onlyFirstTime: false },
  { label: "Service", value: "Service", onlyFirstTime: false },
  { label: "Mobilization", value: "Mobilization", onlyFirstTime: false },
  { label: "Maintenance", value: "Maintenance use", onlyFirstTime: false },
]

export const FR_OE_STATUS = [
  { label: "OE REFERENCE", value: "OE REFERENCE", for: 'oe' },
  { label: "BACK-UP OE REFERENCE", value: "BACK-UP OE", for: null },
  { label: "RESCUE", value: "RESCUE", for: 'mob' },
  { label: "MOBILIZATION", value: "MOBILIZATION", for: 'mob' },
  { label: "MAINTENANCE", value: "MAINTENANCE", for: null },
  { label: "PRELOAD", value: "PRELOAD", for: 'pld' },
  { label: "SERVICE VEHICLE", value: "SERVICE VEHICLE", for: null },
  { label: "ADBLUE", value: "ADBLUE", for: null }
]



// ------------------------------------------------------------------------------------------------------------- //

//UTILS
import { formatDate, ISOtoInt as _ } from './utils/Ewul_GSDC_Utils';

// CONFIG TABLES
import { encodeColumnName as enc, type TableModuleConfig } from './components/ewul_TableFlex';
import { type CardFieldConfig } from './components/ewul_CardGallery';
//import { validateStyleMin } from 'maplibre-gl';
//import { format } from 'maplibre-gl';



const statusOptions = TRIP_STATUSES.map(item => ({
  value: item.Status,
  label: (item.Alias && item.Alias.trim() !== "") ? item.Alias : item.Status
}));

/*const buOptions = BUSINESS_UNITS.map(item => ({
    value: item.Title
}));*/

const tripgroupOptions = TRIP_GROUPS.map(item => {

  let formattedLabel = item.label;
  if (item.label === 'Others') {
    formattedLabel = item.label.toUpperCase() as any;
  } else if (item.label.includes(' - ')) {
    formattedLabel = item.label.split(' - ')[0] + ' - ' + item.label.split(' - ')[1].toLowerCase();
  }

  return {
    value: formattedLabel // Now "Trading - bulk", "Hauling - fb", etc. and "OTHERS"
  };
});

export const loaderTypeOptions = [
  {
    value: "Loader Only",
    label: "Loader Only",
    type: "multi",
    subtext: "0.25 Trip Count | 0.25 Index | 0.25 KM",
    record: {
      tcMult: .25,
      tiMult: .25,
      kmMult: .25,
      empPos: ['Driver', 'Helper'],
      multicase: false,
    },
  },
  {
    value: "Unloader Only",
    label: "Unloader Only",
    type: "multi",
    subtext: "0.25 Trip Count | 0.25 Index | 0.25 KM",
    record: {
      tcMult: .25,
      tiMult: .25,
      kmMult: .25,
      empPos: ['Driver', 'Helper'],
      multicase: false,
    },
  },
  {
    value: "Short Trip Loader",
    label: "Short Trip",
    type: "multi",
    subtext: "0.25 Trip Count | 0.25 Index | 0.25 KM",
    record: {
      tcMult: .25,
      tiMult: .25,
      kmMult: .25,
      empPos: ['Driver', 'Helper'],
      multicase: true,
    },
  },
  {
    value: "Half Trip Loader",
    label: "Half Trip",
    type: "multi",
    subtext: "0.50 Trip Count | 0.50 Index | 0.50 KM",
    record: {
      tcMult: .50,
      tiMult: .50,
      kmMult: .50,
      empPos: ['Driver', 'Helper'],
      multicase: true,
    },
  },
  {
    value: "Long Trip Loader",
    label: "Long Trip",
    type: "multi",
    subtext: "0.75 Trip Count | 0.75 Index | 0.75 KM",
    record: {
      tcMult: .75,
      tiMult: .75,
      kmMult: .75,
      empPos: ['Driver', 'Helper'],
      multicase: true,
    },
  },
  {
    value: "No Loader",
    label: "No Loader",
    type: "multi",
    subtext: "0 Trip Count | 0 Index | 0 KM",
    record: {
      tcMult: 0,
      tiMult: 0,
      kmMult: 0,
      empPos: ['Driver', 'Helper'],
      multicase: false,
    },
  },
  {
    value: "No Unloader",
    label: "No Unloader",
    type: "multi",
    subtext: "0 Trip Count | 0 Index | 0 KM",
    record: {
      tcMult: 0,
      tiMult: 0,
      kmMult: 0,
      empPos: ['Helper'],
      multicase: false,
    },
  },
  {
    value: "Convoy",
    label: "Convoy",
    type: "multi",
    subtext: "0 Trip Count | 0 Index | 0 KM",
    record: {
      tcMult: 0,
      tiMult: 0,
      kmMult: 0,
      empPos: ['Helper'],
      multicase: true,
    },
  },
  {
    value: "Convoy Loader & Unloader",
    label: "Convoy Loader & Unloader",
    type: "multi",
    subtext: "1 Trip Count | 1 Index | 0 KM",
    record: {
      tcMult: 1,
      tiMult: 1,
      kmMult: 0,
      empPos: ['Driver', 'Helper'],
      multicase: true,
    },
  },
  {
    value: "Full Trip",
    label: "Full Trip",
    type: "multi",
    subtext: "1 Trip Count | 1 Index | 1 KM",
    record: {
      tcMult: 1,
      tiMult: 1,
      kmMult: 1,
      empPos: ['Driver', 'Helper'],
      multicase: false,
    },
  }
]




export const LIVE_DMS_TABLE_CONFIG: TableModuleConfig = {

  table_config: [
    { col: "OE", alias: "OE #", sticky: true, cellStyle: () => { return { fontWeight: 'bold' } } },
    { col: "Trip Status", alias: "Status", filter: { type: "dropdown-multiple", options: statusOptions }, cellStyle: () => { return { fontWeight: 'bold' } } },
    { col: "Loading Sequence", defaultSort: 'asc', orderSort: 3, alias: "LS", hidden: true },
    { col: "OE Date", alias: "Date", calculate: (row: any) => formatDate(row[enc("OE Date")]) },
    // { col: "Ordered Date", alias: "Date", calculate: (row: any) => formatDate(row[enc("Ordered Date")]) },
    { col: "Needed Date", alias: "Needed Date", calculate: (row: any) => formatDate(row[enc("Needed Date")]) },
    {
      col: "Buisness Unit", alias: "BU",
      filter: {
        type: "dropdown-multiple",
        options: [
          { value: 'SBUO-1A' },
          { value: 'SBUO-1B' },
        ]
      }
    },
    { col: "Driver", cellStyle: () => { return { textAlign: 'left' } } },
    { col: "Helper", cellStyle: () => { return { textAlign: 'left' } } },
    { col: "Vehicle", alias: "Truck" },
    { col: "BO", alias: "Trailer" },
    {
      col: 'HasFuelRequest', alias: 'FR',
      render(_val, row, _searchTerm, _addTask, fontSize) {
        return (renderFuelRequestIcon(row.HasFuelRequest, row.HasFuelPO, row.HasFuelDisapproved, fontSize));
      },
    },
    {
      col: "TripProgress",
      alias: "Progress",
      filter: {
        type: "dropdown-multiple",
        options: [...TRIP_PROGRESS.map(item => ({ value: item.Progress, label: item.label })), { value: 'Verified', label: 'Verified' }],
        default: TRIP_PROGRESS.filter(item => item.selected).map(item => item.Progress),
        useCalculatedValue: true
      },
      cellStyle: (row: any) => {
        let font_color: React.CSSProperties = { color: '#666' };
        font_color = TRIP_PROGRESS.find(item => item.Progress === row["TripProgress"])?.color ? { color: TRIP_PROGRESS.find(item => item.Progress === row["TripProgress"])!.color } : font_color;
        if (row.TripProgress === 'Done' && !!row.Verified_x0020_By && !!row.Documented_x0020_Date) font_color = { color: 'var(--progress-newtrip)' };
        return { textAlign: 'left', fontWeight: 'bold', ...font_color }
      },
      calculate(row) {
        if (row.TripProgress === 'Done' && !!row.Verified_x0020_By && !!row.Documented_x0020_Date) return 'Verified'
        return row.TripProgress
      },
    },
    {
      col: "_tp_count",
      alias: "_tp_count",
      useCalculatedSort: true,
      calculate: (row: any) => {
        const value = row["TripProgress"];
        const sortMapping: Record<string, number> = {
          'Planned': 0,
          'Assigned': 1,
          'Dispatched To Source': 2,
          'Dispatched To Destination': 3,
          'Done': 4,
          'Verified': 5,
        };

        // Return the numerical weight (or a fallback weight if the value is missing)
        return value in sortMapping ? sortMapping[value] : -1;
      },
      defaultSort: 'asc', orderSort: 2, hidden: true,
    },
    { col: "Customer", cellStyle: () => { return { textAlign: 'left' } } },
    { col: "Source", defaultSort: 'asc', orderSort: 1, preventNoSort: true, cellStyle: () => { return { textAlign: 'left' } } },
    { col: "Destination", cellStyle: () => { return { textAlign: 'left' } } },
    { col: "_tripGroup", alias: "Group", filter: { type: "dropdown-multiple", options: tripgroupOptions } },
    { col: "cementType", alias: "Type" },

    { col: "ATW/LO#", alias: "ATW/LO#" },
    { col: "Plant DR", alias: "PLANT DR" },
    { col: "SO#", alias: "SO#" },
    { col: "GSDC DR", alias: "GSDC DR" },
    {
      col: "Planning", alias: "Dispatcher Remarks",
    },

    //Disp to Source
    { col: "Dispatched to Source", alias: "Dispatched to Source", calculate: (row: any) => formatDate(row[enc("Dispatched to Source")], { mode: "datetime", alreadyLocal: true }) },
    { col: "Source in", alias: "Source In", calculate: (row: any) => formatDate(row[enc("Source in")], { mode: "datetime", alreadyLocal: true }) },
    { col: "Source out", alias: "Source Out", calculate: (row: any) => formatDate(row[enc("Source out")], { mode: "datetime", alreadyLocal: true }) },
    { col: "QTYWithdrawn", alias: "QTY Withdrawn" },
    { col: "Driver Loader", alias: "Driver Loader" },
    { col: "Helper Loader", alias: "Helper Loader" },

    //Disp to Destination
    { col: "Dispatched to Destination", alias: "Dispatched to Destination", calculate: (row: any) => formatDate(row[enc("Dispatched to Destination")], { mode: "datetime", alreadyLocal: true }) },
    { col: "Destination in", alias: "Destination In", calculate: (row: any) => formatDate(row[enc("Destination in")], { mode: "datetime", alreadyLocal: true }) },
    { col: "Destination out", alias: "Destination Out", calculate: (row: any) => formatDate(row[enc("Destination out")], { mode: "datetime", alreadyLocal: true }) },
    { col: "QTYDelivered", alias: "QTY Delivered" },
    { col: "Driver Unloader", alias: "Driver Unloader" },
    { col: "Helper Unloader", alias: "Helper Unloader" },
    {
      col: 'wew', alias: "Discrepancy", calculate: (row: any) => {
        const discrepancy = row.QTYDelivered != null && row.QTYWithdrawn != null ? row.QTYDelivered - row.QTYWithdrawn : 0;
        const actualDiscrepancy = row.QTYDelivered_Actual != null && row.QTYWithdrawn_Actual != null ? row.QTYDelivered_Actual - row.QTYWithdrawn_Actual : 0;
        return actualDiscrepancy ? actualDiscrepancy : (discrepancy || 0);
      }, useCalculatedSort: true
    },


    // Completed
    { col: "Completed Date", alias: "Served Date", calculate: (row: any) => formatDate(row[enc("Completed Date")], { mode: "datetime", alreadyLocal: true }) },
    { col: "Tagged Date", alias: "Tagged Date", calculate: (row: any) => formatDate(row[enc("Tagged Date")], { mode: "datetime", alreadyLocal: true }) },


    { col: "Modified", alias: "Modified", calculate: (row: any) => formatDate(row[enc("Modified")], { mode: "datetime", alreadyLocal: true }) },
    { col: "LastModifiedBy", alias: "Modified By" },

    { col: "Verified By", alias: "Verified By" },
    { col: "Documented Date", alias: "Documented Date", calculate: (row: any) => formatDate(row[enc("Documented Date")], { mode: "datetime", alreadyLocal: true }) },

    { col: "ServedDate", alias: "Credited Date", calculate: (row: any) => formatDate(row[enc("Completed Date")], { mode: "date", alreadyLocal: true }) },

    {
      col: "_tp_count",
      alias: "_tp_count",
      useCalculatedSort: true,
      calculate: (row: any) => {
        const value = row["TripProgress"];
        const sortMapping: Record<string, number> = {
          'Planned': 0,
          'Assigned': 0,
          'Dispatched To Source': 2,
          'Dispatched To Destination': 3,
          'Done': 4,
          'Verified': 5,
        };

        // Return the numerical weight (or a fallback weight if the value is missing)
        return value in sortMapping ? sortMapping[value] : -1;
      },
      defaultSort: 'asc', orderSort: 2, hidden: true,
    },

  ],




  rowStyle: (row: any) => ({
    backgroundColor: row._idx % 2 === 0 ? 'color-mix(in srgb, var(--color-bg-blue) 70%, var(--color-bg) 100%)' : 'var(--color-bg)'
  }),

  searchable_cols: ["OE", "Driver", "Helper", "Vehicle", "BO", "Source", "Destination", "ATW/LO#", "Plant DR", "SO#", "GSDC DR"] as const,

  accordion: {
    enabled: true,
    groupByCol: "Source"
  }
};



const taggedDurationFormatting = {
  ok: 60,
  notok: 60 * 24
}

export const LIVE_DMS_ASSIGNED_TABLE_CONFIG: TableModuleConfig = {

  table_config: [
    { col: "OE", alias: "OE #", sticky: true, cellStyle: () => { return { fontWeight: 'bold' } } },
    { col: "OE Date", alias: "Date", calculate: (row: any) => formatDate(row[enc("OE Date")]) },
    // { col: "Ordered Date", alias: "Date", calculate: (row: any) => formatDate(row[enc("Ordered Date")]) },
    { col: "Needed Date", alias: "Needed Date", calculate: (row: any) => formatDate(row[enc("Needed Date")]) },
    { col: "Trip Status", alias: "Status", filter: { type: "dropdown-multiple", options: statusOptions }, cellStyle: () => { return { fontWeight: 'bold' } } },
    {
      col: "TripProgress",
      alias: "Progress",
      filter: {
        type: "dropdown-multiple",
        options: [...TRIP_PROGRESS.map(item => ({ value: item.Progress, label: item.label })), { value: 'Verified', label: 'Verified' }],
        default: TRIP_PROGRESS.filter(item => item.selected).map(item => item.Progress),
        useCalculatedValue: true
      },
      cellStyle: (row: any) => {
        let font_color: React.CSSProperties = { color: '#666' };
        font_color = TRIP_PROGRESS.find(item => item.Progress === row["TripProgress"])?.color ? { color: TRIP_PROGRESS.find(item => item.Progress === row["TripProgress"])!.color } : font_color;
        if (row.TripProgress === 'Done' && !!row.Verified_x0020_By && !!row.Documented_x0020_Date) font_color = { color: 'var(--progress-newtrip)' };
        return { textAlign: 'left', fontWeight: 'bold', ...font_color }
      },
      calculate: (row: any) => {
        if (row.TripProgress === 'Done' && !!row.Verified_x0020_By && !!row.Documented_x0020_Date) return 'Verified'
        return row.TripProgress
      },
    },
    {
      col: "_tp_count",
      alias: "_tp_count",
      useCalculatedSort: true,
      calculate: (row: any) => {
        const value = row["TripProgress"];
        const sortMapping: Record<string, number> = {
          'Planned': 0,
          'Assigned': 1,
          'Dispatched To Source': 2,
          'Dispatched To Destination': 3,
          'Done': 4,
          'Verified': 5,
        };

        // Return the numerical weight (or a fallback weight if the value is missing)
        return value in sortMapping ? sortMapping[value] : -1;
      },
      defaultSort: 'asc', orderSort: 2, hidden: true,
    },
    { col: "Loading Sequence", alias: "LS", defaultSort: 'asc', orderSort: 3, hidden: true },

    { col: "Driver", cellStyle: () => { return { textAlign: 'left' } } },
    { col: "Helper", cellStyle: () => { return { textAlign: 'left' } } },
    { col: "Vehicle", alias: "Truck" },
    { col: "BO", alias: "Trailer" },


    { col: "Customer", cellStyle: () => { return { textAlign: 'left' } } },
    { col: "Source", defaultSort: 'asc', orderSort: 1, preventNoSort: true, cellStyle: () => { return { textAlign: 'left' } } },
    { col: "Destination", cellStyle: () => { return { textAlign: 'left' } } },
    { col: "_tripGroup", alias: "Group", filter: { type: "dropdown-multiple", options: tripgroupOptions } },
    { col: "cementType", alias: "Type" },

    {
      col: 'HasFuelRequest', alias: 'FR',
      render(_val, row, _searchTerm, _addTask, fontSize) {
        return (renderFuelRequestIcon(row.HasFuelRequest, row.HasFuelPO, row.HasFuelDisapproved, fontSize));
      },
    },

    {
      col: "Planning", alias: "ODM Remarks",
      //@ts-ignore
      render: (val: any, row: any, searchTerm: string, addTask: any, fontSize: any, onRecordChange: any) => {
        return renderDDRemarksInput(onRecordChange, row, 'Planning')
      },

    },

    { col: "Tagged Date", alias: "Plotted Date", calculate: (row: any) => formatDate(row[enc("Tagged Date")], { mode: 'datetime', alreadyLocal: true }), cellStyle: (_row: any) => { return { fontWeight: 'bold' } } },
    {
      col: "", alias: "Age",
      calculate: (row: any) => formatDate(row[enc("Tagged Date")], { mode: "duration", alreadyLocal: true }).replace("from now", "ago"),
      cellStyle: (row: any) => {
        let backgroundColor = 'transparent';
        let textColor = 'var(--color-primary-2)';

        let modifiedVal = row[enc("Tagged Date")];
        if (modifiedVal) {
          // 1. Normalize trailing 'Z' if treating string as local execution space
          if (typeof modifiedVal === 'string' && modifiedVal.endsWith('Z')) {
            modifiedVal = modifiedVal.slice(0, -1);
          }

          const now = Date.now();
          let modifiedTime = new Date(modifiedVal).getTime();

          // 2. Append 'Z' fallback if it's an un-offsetted database ISO sequence to force standard parsing alignment
          if (
            typeof row[enc("Tagged Date")] === 'string' &&
            !row[enc("Tagged Date")].includes('Z') &&
            !row[enc("Tagged Date")].includes('+')
          ) {
            modifiedTime = new Date(`${modifiedVal}Z`).getTime();
          }

          // 3. Complete calculation in minutes
          const diffMins = (now - modifiedTime) / 60000;

          // 4. Evaluate aging brackets safely matching your visual tints
          if (diffMins >= 0 && diffMins < taggedDurationFormatting.ok) {
            backgroundColor = 'rgba(76, 175, 80, 0.15)'; // Subtle Green Tint
            textColor = '#4caf50';
          } else if (diffMins >= taggedDurationFormatting.ok && diffMins < taggedDurationFormatting.notok) {
            backgroundColor = 'rgba(251, 191, 36, 0.15)'; // Subtle Yellow Tint
            textColor = '#fbbf24';
          } else if (diffMins >= taggedDurationFormatting.notok) {
            backgroundColor = 'rgba(229, 57, 53, 0.15)'; // Subtle Red Tint
            textColor = '#e53935'; // Red System Accent
          }
        }

        return {
          backgroundColor,
          color: textColor,
          fontWeight: 'bold',
          borderRadius: '4px', /* Gentle design layout preference */
          padding: '4px 8px'
        };
      }

    },


    { col: "Modified", alias: "Modified", calculate: (row: any) => formatDate(row[enc("Modified")], { mode: "datetime", alreadyLocal: true }) },
    { col: "LastModifiedBy", alias: "Modified By" },

    { col: "Buisness Unit", alias: "BU", filter: { type: "dropdown-multiple" } },



  ],

  rowStyle: (row: any) => ({
    backgroundColor: row._idx % 2 === 0 ? 'color-mix(in srgb, var(--color-bg-blue) 70%, var(--color-bg) 100%)' : 'var(--color-bg)'
  }),

  searchable_cols: ["OE", "Driver", "Helper", "Vehicle", "BO", "Source", "Destination"] as const,

  accordion: {
    enabled: true,
    groupByCol: "Source",
    counts: [
      {
        label: "BAL",
        countCondition: (row: any) => row["OE"] !== null && row["TripProgress"] === "Assigned",
        color: 'yellow',
      },
      {
        label: 'PLA',
        countCondition: (row: any) => row["OE"] !== null && row["TripProgress"] === "Planned",
        color: 'muted',
      },
      {
        label: "ASS",
        countCondition: (row: any) => row["OE"] !== null && row["TripProgress"] !== "Assigned",
        color: 'green',
      },

      {
        label: "TOT",
        countCondition: (row: any) => row["OE"] !== null,
        color: 'blue',
      },
    ]
  }

};




export const orderStatuses = [
  { value: "Approved" },
  { value: "Incomplete" },
  { value: "Manual" },
  { value: "Disapproved" },
  { value: "Completed" },
  { value: "Pending" },
  { value: "Tagged" }
];

export const cementTypeOptions = [
  { label: 'Type 1', value: 'Type 1' },
  { label: 'Type 1L', value: 'Type 1L' },
  { label: 'Fly-Ash', value: 'Fly-Ash' },
  { label: 'Slag', value: 'Slag' },
  { label: 'Type 1T', value: 'Type 1T' },
  { label: 'Limestone', value: 'Limestone' },
  { label: 'Type 1P', value: 'Type 1P' }
];

export const NEW_TRIPS_UNFILTERED_TABLE_CONFIG: TableModuleConfig = {

  table_config: [

    /*{ col: "OrderedDate", alias: "Order Date", calculate: (row: any) => formatDate(row["OrderedDate"]) },*/
    {
      col: "_odmddremarks", alias: "Remarks", portion: 1,
      //@ts-ignore
      render: (val: any, row: any, searchTerm: string, addTask: any, fontSize: any, onRecordChange: any) => {
        return renderDDRemarksStatusDropdown(onRecordChange, row, fontSize);
      },
      calculate: (row: any) => {
        const val = row['ODMRemarks']
        let sortVal = null
        switch (val) {
          case "Advance order":
            sortVal = 0;
            break;
          case "Buffer OE":
            sortVal = 1;
            break;
          case "Waiting for advice":
            sortVal = 2;
            break;
          case "For cancellation":
            sortVal = 3;
            break;
        }
        return sortVal
      },
      useCalculatedSort: true,
    },
    { col: "OE Date", alias: "OE Date", portion: 1, calculate: (row: any) => formatDate(row[enc("OE Date")]) },
    { col: "NeededDate", alias: "Need Date", portion: 1, calculate: (row: any) => formatDate(row["NeededDate"]) },
    { col: "OE", alias: "OE #", portion: 1 },
    { col: "SourceName", alias: "Source", portion: 1.5 },
    { col: "DestiName", alias: "Destination", portion: 1.5 },
    { col: "_tripGroup", alias: "Group", portion: 1, filter: { type: "dropdown-multiple", options: tripgroupOptions } },
    { col: "CementTypeName", alias: "Type", portion: 1, filter: { type: "dropdown-multiple", options: cementTypeOptions } },
    {
      col: "SAPStatus", alias: "Status", portion: 1,
      filter: { type: "dropdown-multiple", options: orderStatuses, default: ["Approved"] },
      cellStyle: (row: any) => {
        let style: React.CSSProperties = { color: '#666' };

        const isApproved = row["SAPStatus"] === "Approved";

        if (isApproved) style = { color: '#2ea107' };
        if (row["SAPStatus"] === "Disapproved") style = { color: '#680000' };
        if (row["SAPStatus"] === "Tagged") style = { color: '#2c02ff' };
        if (row["SAPStatus"] === "Manual") style = { color: '#ff00d9' };
        if (row["SAPStatus"] === "Incomplete") style = { color: '#eaa709' };
        if (row["SAPStatus"] === "Completed") style = { color: '#08d7bc' };

        style.fontWeight = 'bold';
        style.textTransform = 'uppercase';
        style.letterSpacing = '0.5px';

        // Drag-prevention styling for non-Approved rows
        if (!isApproved) {
          style.cursor = 'not-allowed';
          style.userSelect = 'none';
          style.opacity = 0.7; // Optional: visual cue for non-draggable items
        } else {
          style.cursor = 'grab';
        }

        return style;
      }
    },
    { col: "TaggedBU", alias: "BU", portion: 0.5 },



  ],

  rowStyle: (row: any) => ({
    backgroundColor: row._idx % 2 === 0 ? 'color-mix(in srgb, var(--color-primary) 10%, var(--color-bg) 100%)' : 'var(--color-bg-blue)'
  }),

  searchable_cols: ["OE", "SourceName", "DestiName"] as const,

  accordion: {
    enabled: true,
    groupByCol: "SourceName"
  }

}


const pairing_type_options = [
  { value: "DMS", label: "Paired" },
  { value: "Employee-D", label: "Driver (No Pair)" },
  { value: "Employee-H", label: "Helper (No Pair)" },
  { value: "Vehicle", label: "Tractor" },
  { value: "Vehicle-T", label: "Trailer (No Pair)" },
];

const vehicleInfoModal = (data: any, vehicle: string): ModalOptions => ({
  data: data,
  renderCustomContent: (data: any) => {
    return (
      <div style={{ padding: '16px' }}>
        <h5>Unit Information</h5>
        <p>Truck: {data.TruckFull}</p>
        <p>Paired Trailer: {data.Trailer}</p>

      </div>
    );
  },
  title: `${vehicle} Information`,
});


export const PAIRING_LIST_TABLE_CONFIG: TableModuleConfig = {

  table_config: [
    {
      col: "TruckFull",
      alias: "Truck",
      portion: 0.5,
      render: (val: any, row: any, searchTerm: string) => {
        if (!val) return '---';

        return (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
              width: '100%'
            }}
          >
            <p
              title={`View: ${val}`}
              onClick={(e) => { e.stopPropagation(); openFleetModal(vehicleInfoModal(row, 'Truck')); }}
              className='fleetmonpage-redhover stop-propagation'
              style={{
                margin: 0,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                color: 'var(--color-primary)',
                fontSize: '13px',
              }}
            >
              <HighlightText text={`${GPS_STATUS_EMOJIS[row[enc("GPS Status")]] || ''} ${row.TruckFull}`} highlight={searchTerm} isSearchable={true} />
            </p>

            {/* Call the helper function here */}
            {renderRepairIcon(row, enc("JR_Truck"), 'TractorJRStatus')}
          </div>
        );
      }
    },
    {
      col: "Trailer",
      portion: 0.5,
      // We use render instead of just cellStyle to allow for the icon placement
      render: (val: any, row: any, searchTerm: string) => {
        if (!val) return '---';

        return (
          <div
            title={`View: ${val}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '2px',
              width: '100%'
            }}
          >
            <span
              onClick={(e) => { e.stopPropagation(); openFleetModal(vehicleInfoModal(row, 'Trailer')); }}
              style={{
                color: 'var(--color-primary)', // Moved from cellStyle to here
                textAlign: 'center',
              }}
              className='fleetmonpage-redhover stop-propagation'
              onMouseEnter={(e) => { e.stopPropagation(); }}
              onMouseLeave={(e) => { e.stopPropagation(); }}
            >
              <HighlightText text={val} highlight={searchTerm} isSearchable={true} />
            </span>

            {/* Use the helper function with the Trailer-specific keys */}
            {renderRepairIcon(row, 'JR_Trailer', 'TrailerJRStatus')}
          </div>
        );
      }
    },
    {
      col: "Driver", portion: 1.5,
      render: (val: any, row: any, searchTerm: string, addTask?: any) => {
        return <PersonnelCell
          employeeName={val}
          row={row}
          statusRaw={row.AttendanceD}
          searchTerm={searchTerm}
          onAttendanceChange={(newStatus, row) => {
            if (addTask) {
              addTask({
                id: `monitoringpage-attendance-update-${row.D_UserID}`,
                name: `Update ${row.Driver}'s Attendance Status`,
                execute: () => handleUpdateAttendanceStatus(newStatus, row.D_UserID, row.Driver, row.OE),
                checkSuccess: (result: { success: boolean }) => result.success,
                message: `Setting attendance for ${row.Driver}...`,
                message_success: `${row.Driver} tagged '${newStatus || 'PRESENT'}' successfully!`,
                message_failure: `${row.Driver} failed to be tagged '${newStatus || 'PRESENT'}'.`
              });
            } else {
              console.log("Updating Driver Attendance Status to:", newStatus, "for row:", row);
              handleUpdateAttendanceStatus(newStatus, row.D_UserID, row.Driver, row.OE);
            }
          }}
        />;
      },
    },
    {
      col: "Helper", portion: 1.5,
      render: (val: any, row: any, searchTerm: string, addTask?: any) => {
        return <PersonnelCell
          employeeName={val}
          row={row}
          statusRaw={row.AttendanceH}
          searchTerm={searchTerm}
          onAttendanceChange={(newStatus, row) => {
            if (addTask) {
              addTask({
                id: `monitoringpage-update-attendance-${row.H_UserID}`,
                name: `Update ${row.Helper}'s Attendance Status`,
                execute: () => handleUpdateAttendanceStatus(newStatus, row.H_UserID, row.Helper, row.OE),
                checkSuccess: (result: { success: boolean }) => result.success,
                message: `Setting attendance for ${row.Helper}...`,
                message_success: `${row.Helper} tagged '${newStatus || 'PRESENT'}' successfully!`,
                message_failure: `${row.Helper} failed to be tagged '${newStatus || 'PRESENT'}'.`
              });
            } else {
              console.log("Updating Helper Attendance Status to:", newStatus, "for row:", row);
              handleUpdateAttendanceStatus(newStatus, row.H_UserID, row.Helper, row.OE);
            }
          }}
        />;
      },
    },
    {
      col: "Trip Status", alias: "Status", portion: 0.5,
      render: (val: any, row: any, _searchTerm: string, addTask?: any) => {


        return row.OE ? (
          <StatusSelect
            val={val}
            row={row}
            enc={enc}
            TRIP_STATUSES={TRIP_STATUSES}
            onStatusChange={(newVal, targetRow) => {
              if (addTask) {
                addTask({
                  id: `monitoringpage-update-status-${targetRow.OE}`,
                  name: `Update OE# ${targetRow.OE}`,
                  execute: () => handleUpdateStatus(newVal, targetRow),
                  checkSuccess: (result: { success: boolean }) => result.success,
                  message: `Updating status to ${newVal} for OE# ${targetRow.OE}...`,
                  message_success: `Successfully updated OE# ${targetRow.OE} to ${newVal}.`,
                  message_failure: `Failed to update status for OE# ${targetRow.OE}.`,
                });
              } else {
                console.log("Selected status:", newVal, "for row:", targetRow);
                handleUpdateStatus(newVal, targetRow);
              }
            }}
          />
        ) : '---';
      },
    },
    {
      col: "OE",
      portion: 1,
      cellStyle: (row: any) => {
        // Default color
        let color = 'var(--color-primary-2)';
        const modifiedVal = row[enc("Modified")];
        if (modifiedVal) {
          const now = Date.now();
          const modifiedTime = new Date(modifiedVal).getTime();
          const diffMs = now - modifiedTime;
          const diffMins = diffMs / 60000;
          if (diffMins < 15) {
            color = 'var(--color-border-success)';
          } else if (diffMins < 60) {
            color = 'var(--color-border-warning)';
          } else if (diffMins >= 60) {
            color = 'var(--color-border-danger)';
          }
        }
        return { color, fontWeight: 'bold' };
      }
    },
    { col: "Source", portion: 2, cellStyle: () => ({ textAlign: 'left', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }) },
    { col: "Destination", portion: 2, cellStyle: () => ({ textAlign: 'left', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }) },
    {
      col: "GPS Address", alias: "Location", portion: 1.5, cellStyle: () => ({ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }),
      render: (val: any, row: any) => {
        const mapUrl = `https://www.google.com/maps/search/?api=1&query=${row.Latitude},${row.Longitude}`;

        return (
          <a href={mapUrl} target="_blank" rel="noopener noreferrer" title='View on Google Maps'>{val}</a>
        );

      }
    },

    {
      col: "", alias: "Arrival", portion: 0.5, calculate: (row: any) => {
        const arrivalTime = row[enc("Destination in")] || row[enc("Source in")];
        return formatDate(arrivalTime, { mode: "datetime" });
      }
    },

    {
      col: "", alias: "Duration", portion: 0.5, calculate: (row: any) => {
        const arrivalTime = row[enc("Destination in")] || row[enc("Source in")];
        if (arrivalTime) {
          const arrivalDate = new Date(arrivalTime);
          return formatDate(arrivalDate, { mode: "duration" });
        } else {
          return "---";
        }
      }
    },

    { col: "Remarks", portion: 2, render: (val: any) => <input type="text" value={val} /> },
    { col: "Modified", alias: "Last Modified", portion: 0.5, calculate: (row: any) => formatDate(row[enc("Modified")], { mode: "datetime" }) },
    { col: "Modified By", alias: "Modified By", portion: 1, },
  ],

  rowStyle: (row: any) => ({
    backgroundColor: row._idx % 2 === 0
      ? 'color-mix(in srgb, var(--color-primary) 10%, var(--color-bg) 100%)'
      : 'var(--color-bg-blue)'
  }),

  searchable_cols: ["OE", "Driver", "Helper", "Truck", "Trailer", "TruckFull"] as const
}




export const cardFields: CardFieldConfig[] = [
  { label: 'OE', key: 'OE', isTitle: true, row: 1, render: (val) => (val && String(val).trim() !== "") ? val : "NO TRIP" },


  { label: 'Driver', key: 'Driver', row: 2 },
  { label: 'Helper', key: 'Helper', row: 2 },
  { label: 'Truck', key: 'TruckFull', row: 3 },
  { label: 'Trailer', key: 'Trailer', row: 3 },
  { label: 'Modified', key: "Modified", row: 4, render: (val) => formatDate(val, { mode: 'duration' }) },
  { label: 'By', key: enc("Modified By"), row: 4 },
  { label: 'Location', key: enc("GPS Address"), row: 5 },

  {
    label: 'Status', key: enc("Trip Status"), isStatus: true,
    statusElement: (row: any) => {
      return row.OE ? (
        <select
          defaultValue={row[enc("Trip Status")]}
          onChange={e => {
            console.log("Selected status:", e.target.value, "for row:", row);
          }}
        >
          {TRIP_STATUSES
            .filter(status =>
              Array.isArray(status.Progress) &&
              status.Progress.some(progress => progress && progress.Progress === row[enc("Trip Progress")])
            )
            .map(status => (
              <option key={status.Status} value={status.Status}>
                {status.Alias && status.Alias.trim() !== "" ? status.Alias : status.Status}
              </option>
            ))}
        </select>
      ) : null
    },

    filter: { type: "dropdown-multiple", options: statusOptions },
  },
  { label: 'Pair', key: "FromList", filter: { type: "dropdown-multiple", options: pairing_type_options } },

];

export const frStatuses = [
  { value: 'New', noedit: false, isOpen: false, color: 'var(--progress-newtrip)' },
  { value: 'FR Unliquidated', noedit: true, isOpen: false },
  { value: 'Issuance Cancelled', noedit: true, isOpen: false, color: 'var(--color-border-warning)' },
  { value: 'Liquidation Cancelled', noedit: true, isOpen: false },
  { value: 'Request', noedit: true, isOpen: true, color: 'var(--progress-newtrip)' },
  { value: 'Response', noedit: true, isOpen: false },
  { value: 'FR Disapproved', noedit: false, isOpen: true, color: 'var(--color-border-danger)' },
  { value: 'Liquidation Disapproved', noedit: true, isOpen: false },
  { value: 'Cancelled', noedit: true, isOpen: false },
  { value: 'Liquidated', noedit: true, isOpen: false, color: 'var(--color-border-success)' },
  { value: 'Issuance', noedit: true, isOpen: false },
  { value: 'FR Cancelled', noedit: true, isOpen: false },
  { value: 'Unliquidated', noedit: true, isOpen: false },
  { value: 'Liquidation', noedit: true, isOpen: true, color: 'var(--color-border-info)' }
]


// FUEL REQUESTS TABLE CONFIG
export const FUEL_REQUESTS_TABLE_CONFIG: TableModuleConfig = {

  table_config: [
    { col: "OE", alias: "OE #" },
    { col: "fuelrequestID", alias: "Request ID" },
    { col: "Requestedby", alias: "Requested By" },
    { col: "CreatedDate", alias: "Date Requested", calculate: (row: any) => formatDate(row.CreatedDate, { mode: "datetime" }) },

    {
      col: "Frstatus", alias: "Status",
      filter: { type: "dropdown-multiple", options: frStatuses },
      cellStyle: (row: any) => {
        let style: React.CSSProperties = { color: 'var(--color-muted)' };
        if (row.Frstatus === "Request") style = { color: 'var(--progress-newtrip)' };
        if (row.Frstatus === "FR Disapproved") style = { color: 'var(--color-border-danger)' };
        if (row.Frstatus === "Issuance Cancelled") style = { color: 'var(--color-border-warning)' };
        if (row.Frstatus === "Liquidation") style = { color: 'var(--color-border-info)' };
        if (row.Frstatus === "Liquidated") style = { color: 'var(--color-border-success)' };
        style.fontWeight = 'bold';
        return style;
      }
    },

    { col: "Head", alias: "Truck" },
    { col: "Trailer", alias: "Trailer" },
    { col: "Driversname", alias: "Driver" },

    {
      col: "Remarksissuance", alias: "Remarks",
      render(_val, row, _searchTerm, _addTask) {
        switch (row.Frstatus) {
          case 'FR Disapproved': return row.Frdisapprove;
          case 'Unliquidated': return row.Unliquidateremarks;
          default: return row.Remarksissuance;
        }
      },
    },
    {
      col: "", alias: "Add | Comp", render: (_val: any, row: any) => {
        return `${row.AddBlue ? 'Yes' : 'No'} | ${row.Compressor ? 'Yes' : 'No'}`;
      }
    }
  ],

  rowStyle: (row: any) => ({
    backgroundColor: row._idx % 2 === 0
      ? 'color-mix(in srgb, var(--color-primary) 10%, var(--color-bg) 100%)'
      : 'var(--color-bg-blue)'
  }),

  searchable_cols: ["OE", "fuelrequestID", "Requestedby"] as const

}


// INCIDENT REPORTS PAGE

export const IR_REPORT_TYPES = [
  { value: 'Short Bags', label: 'Short Bags' },
  { value: 'Road Accident', label: 'Road Accident' },
  { value: 'Unauthorized Stop', label: 'Unauthorized Stop' },
  { value: 'Overspeeding', label: 'Overspeeding' },
  { value: 'Fuel Issue', label: 'Fuel Issue' },
  { value: 'Other', label: 'Other / Miscellaneous' }
];

export const IR_ACTION_OPTIONS = [
  { value: 'PROCEED TO NEXT TRIP', label: 'Proceed Next Trip', color: 'var(--color-border-success)', type: 'Operations', isProceed: true },
  { value: 'FOR BULK INSPECTION', label: 'For BULK Inspection', color: 'var(--color-border-warning)', type: 'Operations', isProceed: false },
  { value: 'NO REPORTED SB', label: 'No Reported SB / Wrong Discrepancy', color: 'var(--color-border-warning)', type: 'Operations', isProceed: true, hide: true },
  { value: 'FOR CLEANING', label: 'For Cleaning', color: 'var(--color-border-warning)', type: 'Operations', isProceed: true, hide: true },
  // { value: 'Empty', label: 'Empty bulk proceed to backload (photo empty bulk)', color: 'var(--color-border-success)', type: 'Operations', isProceed: true },
  // { value: 'LessThanFive', label: 'Proceed Next Trip - Less than five', color: 'var(--color-border-success)', type: 'Operations', isProceed: true },
  // { value: 'NoDriver', label: 'No attachment driver failed to report', color: 'var(--color-border-danger)', type: 'Operations', isProceed: false },

  { value: 'PROCEED TO NEXT TRIP', label: 'Proceed Next Trip', color: 'var(--color-border-success)', type: 'Supervisor', isProceed: true, hide: true },
  { value: 'APPROVED', label: 'Approved', color: 'var(--color-border-success)', type: 'Supervisor', isProceed: false },
  { value: 'DISAPPROVED', label: 'Disapproved', color: 'var(--color-border-danger)', type: 'Supervisor', isProceed: false },
  { value: 'FOR RETRIEVAL', label: 'For Retrieval', color: 'var(--color-border-info)', type: 'Supervisor', isProceed: true },

  { value: 'PENDING', label: 'Pending Inspection', color: 'var(--color-border-warning)', type: 'Inspection', isProceed: false },
  { value: 'FOR RETRIEVAL', label: 'For Retrieval', color: 'var(--color-border-info)', type: 'Inspection', isProceed: false },
  { value: 'CLEARED', label: 'Cleared', color: 'var(--color-border-success)', type: 'Inspection', isProceed: true },

  { value: 'PENDING', label: 'Pending Retrieval', color: 'var(--color-border-warning)', type: 'Yard', isProceed: false },
  { value: 'ONGOING RETRIEVAL', label: 'Ongoing Retrieval', color: 'var(--color-border-info)', type: 'Yard', isProceed: false },
  { value: 'FOR WAREHOUSE TRANSFER', label: 'For Warehouse Transfer', color: 'var(--color-border-success)', type: 'Yard', isProceed: true },
  { value: 'FOR DISPOSAL', label: 'For Disposal', color: 'var(--color-border-success)', type: 'Yard', isProceed: true },

  { value: 'PENDING', label: 'Pending Transfer', color: 'var(--color-border-warning)', type: 'Warehouse', isProceed: true },
  { value: 'RECEIVED', label: 'Received Transfer', color: 'var(--color-border-info)', type: 'Warehouse', isProceed: true },
  { value: 'SOLD', label: 'Sold', color: 'var(--color-border-success)', type: 'Warehouse', isProceed: true },
  { value: 'FOR SELLING', label: 'For Selling', color: 'var(--color-border-warning)', type: 'Warehouse', isProceed: false },
  { value: 'RETURNED TO CUSTOMER', label: 'Returned to Customer', color: 'var(--color-border-success)', type: 'Warehouse', isProceed: true },
  { value: 'DISPOSED', label: 'Disposed', color: 'var(--color-border-success)', type: 'Warehouse', isProceed: true },
];



export const SHORT_BAGS_LIMIT = 0;

const ir_status_option = [
  { value: "Open", label: "Open", color: 'var(--color-border-info)' },
  { value: "Cancelled", label: "Cancelled", color: 'var(--color-border-warning)' },
  { value: "Closed", label: "Closed", color: 'var(--color-border-success)' },
];

export const INCIDENT_TABLE_MODULE: TableModuleConfig = {
  table_config: [
    { col: "IRID", alias: "IR ID", sticky: true },
    { col: "OE_Reference", alias: "Trip OE#" },
    {
      col: "IRStatus", alias: "Status",
      cellStyle: (row: any) => {
        let style: React.CSSProperties = { color: 'var(--color-muted)' };
        if (row.IRStatus === "Cancelled") style = { color: 'var(--color-border-warning)' };
        if (row.IRStatus === "Open") style = { color: 'var(--color-border-info)' };
        if (row.IRStatus === "Closed") style = { color: 'var(--color-border-success)' };
        style.fontWeight = 'bold';
        return style;
      },
      filter: { type: "dropdown-multiple", options: ir_status_option }
    },
    { col: "IncidentType", alias: "Type", portion: 0.2, filter: { type: "dropdown-multiple", options: IR_REPORT_TYPES } },
    {
      col: "flexValue", alias: "Value", portion: 0.2,
      render: (val, row) => {
        if (val) {

          switch (row.IncidentType) {

            case 'Short Bags': return `${Number(val).toFixed(2)} bags`;



            default: return val;
          }
        }
      },
    },
    // {
    //   col: "IRStatus",
    //   alias: "Action",
    //   // filter: { type: "dropdown-multiple", options: ir_status_option },
    //   render: (val: any) => {
    //     const actionOption = ir_status_option.find(option => option.value === val);
    //     const pillColor = actionOption?.color || 'var(--color-border-info)';

    //     return (
    //       <span style={{
    //         display: 'inline-flex',
    //         alignItems: 'center',
    //         padding: '3px 12px',
    //         borderRadius: '999px', // Perfect pill/capsule shape
    //         fontSize: '12px',
    //         fontWeight: '600',
    //         color: pillColor,
    //         // Mixes the CSS variable color with 12% opacity against a white background
    //         backgroundColor: `color-mix(in srgb, ${pillColor} 12%, white)`,
    //         // Creates a matching slightly darker border line
    //         border: `1px solid color-mix(in srgb, ${pillColor} 30%, white)`,
    //         textTransform: 'uppercase',
    //         letterSpacing: '0.5px',
    //         whiteSpace: 'nowrap'
    //       }}>
    //         {val}
    //       </span>
    //     );
    //   }
    // },
    { col: "Remarks", alias: "Quick Remarks", portion: 2 },
    { col: "ReportedBy", alias: "Reported By", portion: 1.2, filter: { type: "dropdown-multiple" }, },
    { col: "CreatedDateTime", alias: "Reported Date", portion: 1, calculate: (row: any) => formatDate(row.CreatedDateTime, { mode: "datetime" }) },
    { col: "", alias: "Age", portion: 0.5, calculate: (row: any) => formatDate(row.CreatedDateTime, { mode: "duration" }) },

    { col: "ModifiedBy", alias: "Modified By", portion: 1.2 },
    { col: "ModifiedDateTime", alias: "Modified", portion: 1, calculate: (row: any) => formatDate(row.ModifiedDateTime, { mode: "datetime" }) },

    { col: "ResolvedBy", alias: "Resolved By", portion: 1.2 },
    { col: "ResolvedDate", alias: "Resolved", portion: 1, calculate: (row: any) => formatDate(row.ModifiedDateTime, { mode: "date" }) },
  ],

  rowStyle: (row: any) => ({
    backgroundColor: row._idx % 2 === 0
      ? 'color-mix(in srgb, var(--color-primary) 10%, var(--color-bg) 100%)'
      : 'var(--color-bg-blue)'
  }),


  // Include both references so text highlights perfectly across special character variants
  searchable_cols: ["OE_Reference", "IncidentType", "ReportedBy"]
};


//LOGS
export const TRIP_CONTEXT_TYPES = [
  "Attendance",
  "Pairing - Pair",
  "Trip - Documents",
  "Trip - Fuel Request",
  "Trip - Save",
  "Attach File - Documents",
  "General",
  "Trip - Fuel Request Update",
  "Dispatch",
  "Trip - Preload",
  "Trip - Rejected",
  "Trip - Assignment",
  "Trip - Mobilization",
  "Remarks",
  "Trip - Reject",
  "Trip - Divert/Change",
  "Trip - Status",
  "Trip - Progressed",
  "Remarks - Reply",
  "Trip - Cancelled",
  "Remarks - Add"
];



export const CIFME_UNFILTERED_TABLE_CONFIG: TableModuleConfig = {

  table_config: [

    /*{ col: "OrderedDate", alias: "Order Date", calculate: (row: any) => formatDate(row["OrderedDate"]) },*/
    { col: "OE Date", alias: "OE Date", portion: 1, calculate: (row: any) => formatDate(row[enc("OE Date")]) },
    { col: "NeededDate", alias: "Need Date", portion: 1, calculate: (row: any) => formatDate(row["NeededDate"]) },
    { col: "OE", alias: "OE #", portion: 1 },
    { col: "SourceName", alias: "Source", portion: 1.5 },
    { col: "DestiName", alias: "Destination", portion: 1.5 },
    { col: "_tripGroup", alias: "Group", portion: 1, filter: { type: "dropdown-multiple", options: tripgroupOptions } },
    { col: "CementTypeName", alias: "Type", portion: 1, filter: { type: "dropdown-multiple", options: cementTypeOptions } },
    {
      col: "SAPStatus", alias: "Status", portion: 1,
      filter: { type: "dropdown-multiple", options: orderStatuses, default: ["Approved"] },
      cellStyle: (row: any) => {
        let style: React.CSSProperties = { color: '#666' };
        if (row["SAPStatus"] === "Approved") style = { color: '#2ea107' };
        if (row["SAPStatus"] === "Disapproved") style = { color: '#680000' };
        if (row["SAPStatus"] === "Tagged") style = { color: '#2c02ff' };
        if (row["SAPStatus"] === "Manual") style = { color: '#ff00d9' };
        if (row["SAPStatus"] === "Incomplete") style = { color: '#eaa709' };
        if (row["SAPStatus"] === "Completed") style = { color: '#08d7bc' };

        style.fontWeight = 'bold';
        style.textTransform = 'uppercase';
        style.letterSpacing = '0.5px';

        return style;
      }
    },



  ],

  rowStyle: (row: any) => ({
    backgroundColor: row._idx % 2 === 0 ? 'color-mix(in srgb, var(--color-primary) 10%, var(--color-bg) 100%)' : 'var(--color-bg-blue)'
  }),

  searchable_cols: ["OE", "SourceName", "DestiName"] as const

}


const formatDateStr = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/**
 * Change these to control the entire application window structure dynamically.
 */
const CONFIG = {
  cutoffDays: 7,          // 7 = Weekly, 14 = Bi-weekly, 15 = Semi-monthly
  startDayOfWeek: 4,      // 0 = Sunday, 1 = Monday, 2 = Tuesday, etc. (Currently: Monday)
  includePrevCutoffs: 1,  // 0 = Just current cutoff, 1 = Current + 1 previous cutoff cycle
};

// export const ALLOWED_DATE_CLICK = {
//   /**
//    * Calculates the exact date boundary where editing becomes allowed
//    */
//   get startDate(): string {
//     const today = new Date();
//     const currentDay = today.getDay();

//     // 1. Calculate how many days back the CURRENT cutoff started
//     // (Translates your designated start day relative to today's day of week)
//     let daysSinceCutoffStart = currentDay - CONFIG.startDayOfWeek;
//     if (daysSinceCutoffStart < 0) {
//       daysSinceCutoffStart += 7; // Wrap-around handling for week boundaries
//     }

//     // 2. Derive the calendar date where the current cutoff period began
//     const currentCutoffStartDate = new Date(today);
//     currentCutoffStartDate.setDate(today.getDate() - daysSinceCutoffStart);

//     // 3. Roll backward further based on how many historical cutoffs you choose to include
//     // Formula: current_start - (history_multiplier * size_of_cutoff)
//     const historyOffsetDays = CONFIG.includePrevCutoffs * CONFIG.cutoffDays;

//     const allowedStartDate = new Date(currentCutoffStartDate);
//     allowedStartDate.setDate(currentCutoffStartDate.getDate() - historyOffsetDays);

//     return formatDateStr(allowedStartDate);
//   },

//   /**
//    * Closes the active window right at the end of the current active cutoff
//    */
//   get endDate(): string {
//     const today = new Date();
//     const currentDay = today.getDay();

//     // Find the current cutoff start point first
//     let daysSinceCutoffStart = currentDay - CONFIG.startDayOfWeek;
//     if (daysSinceCutoffStart < 0) {
//       daysSinceCutoffStart += 7;
//     }

//     const currentCutoffStartDate = new Date(today);
//     currentCutoffStartDate.setDate(today.getDate() - daysSinceCutoffStart);

//     // The current cutoff closes exactly (cutoffDays - 1) days after its start point
//     const allowedEndDate = new Date(currentCutoffStartDate);
//     allowedEndDate.setDate(currentCutoffStartDate.getDate() + (CONFIG.cutoffDays - 1));

//     return formatDateStr(allowedEndDate);
//   },

//   startDayOfWeek: CONFIG.startDayOfWeek,
// };

// export const ALLOWED_DATE_CLICK = {
//   /**
//    * Calculates the trailing edge of the allowed edit window
//    */
//   get startDate(): string {
//     const today = new Date();
//     const currentDay = today.getDay(); // 0 = Sun, 1 = Mon, 2 = Tue, 3 = Wed, etc.
//     const allowedStartDate = new Date(today);

//     // 🔴 SPECIAL CONDITION: Monday (1)
//     if (currentDay === 1) {
//       allowedStartDate.setDate(today.getDate() - 4);
//     }
//     // 🔴 SPECIAL CONDITION: Tuesday (2)
//     else if (currentDay === 2) {
//       allowedStartDate.setDate(today.getDate() - 5);
//     }
//     // 🟢 DEFAULT: All other days (Wed, Thu, Fri, Sat, Sun)
//     else {
//       allowedStartDate.setDate(today.getDate() - 6);
//     }

//     return formatDateStr(allowedStartDate);
//   },

//   /**
//    * Cells are only editable if they are <= today
//    */
//   get endDate(): string {
//     const today = new Date();
//     return formatDateStr(today);
//   },

//   startDayOfWeek: CONFIG.startDayOfWeek,
// };

export const ALLOWED_DATE_CLICK = {
  /**
   * Calculates the trailing edge of the allowed edit window (2 days ago)
   */
  get startDate(): string {
    const today = new Date();
    const allowedStartDate = new Date(today);

    // Go back 1 day to include yesterday (making a 2-day window including today)
    allowedStartDate.setDate(today.getDate() - 1);

    return formatDateStr(allowedStartDate);
  },

  /**
   * Cells are only editable if they are <= today
   */
  get endDate(): string {
    const today = new Date();
    return formatDateStr(today);
  },

  startDayOfWeek: CONFIG.startDayOfWeek,
};

export const NOT_ALLOWED_STAT_EDIT = [
  "SERVED"
];


export const attendanceRequestStatus = [
  { value: "Approved" },
  { value: "Rejected" },
  { value: "Pending" },
];



export const LATE_ATTENDANCE_REQUESTS: TableModuleConfig = {

  table_config: [

    /*{ col: "OrderedDate", alias: "Order Date", calculate: (row: any) => formatDate(row["OrderedDate"]) },*/
    { col: "created_at", alias: "Created Date", portion: 1, calculate: (row: any) => formatDate(row[enc("created_at")]) },
    {
      col: "request_status", alias: "Status", portion: 1,
      filter: { type: "dropdown-multiple", options: attendanceRequestStatus },
      cellStyle: (row: any) => {
        let style: React.CSSProperties = { color: '#666' };
        if (row["request_status"] === "Approved") style = { color: '#2ea107' };
        if (row["request_status"] === "Rejected") style = { color: '#680000' };
        if (row["request_status"] === "Pending") style = { color: '#eaa709' };

        style.fontWeight = 'bold';
        style.textTransform = 'uppercase';
        style.letterSpacing = '0.5px';

        return style;
      }
    },
    { col: "OE", alias: "Trip", portion: 1 },
    { col: "employee_name", alias: "Employee", portion: 1.5 },
    { col: "request_date", alias: "Attendance Date", portion: 1, calculate: (row: any) => formatDate(row[enc("request_date")]) },
    { col: "attendance_status", alias: "Attendance", portion: 0.5 },
    { col: "attendance_approval", alias: "Approval", portion: 0.5 },
    { col: "cutoff_start", alias: "Cut Off Start", portion: 1, calculate: (row: any) => formatDate(row[enc("cutoff_start")]) },
    { col: "cutoff_end", alias: "Cut Off End", portion: 1, calculate: (row: any) => formatDate(row[enc("cutoff_end")]) },
    { col: "remarks", alias: "Remarks", portion: 2 },
    { col: "request_to_delete", alias: "To Delete", portion: 0.5, calculate: (row: any) => !row[enc("request_to_delete")] ? "No" : "Yes" },



  ],

  rowStyle: (row: any) => ({
    backgroundColor: row._idx % 2 === 0 ? 'color-mix(in srgb, var(--color-primary) 10%, var(--color-bg) 100%)' : 'var(--color-bg-blue)'
  }),

  searchable_cols: ["OE", "employee_name"] as const

}











export const STORAGE_KEY_PREFIX = 'tripdispatchdaterange_';




















// POWER AUTOMATE FETCH ATTACHMENTS URL
export const DMS_ATTACHMENTS_ENDPOINT = "https://b2d2222dc740ef1690861d5bd091f1.8e.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/bdcde19e6c184f789f1f2e1e2ba49696/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=GfcF-5zeMJpQNG1W8bm6ssZD9GYBw5cPj1Rv64gFPlM";
//export const UPLOAD_ATTACHMENTS_ENDPOINT = "https://b2d2222dc740ef1690861d5bd091f1.8e.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/30b49950f80843beae490213beb56715/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=UCME-tdMqefh_d-G8hK78MUSxtVuFWDIvcPOzrMampc";
export const PRINT_DMS_ENDPOINT = "https://b2d2222dc740ef1690861d5bd091f1.8e.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/5c158d3bd1b742c8a929a68cd8bf6ac9/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=aQVY8keLswpB0k_34fv2uAZJK4dO-vt3P6JvQvnAqxU";
export const UPLOAD_ATTACHMENTS_ENDPOINT = "https://b2d2222dc740ef1690861d5bd091f1.8e.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/956d4fbec4db4bd78f0c5f99aae41c6c/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=RB-nyQsBDWEy0aux94IfIhw6CLVTSjGb9M-vixmyn6o";
export const ERROR_EMAIL_ENDPOINT = "https://b2d2222dc740ef1690861d5bd091f1.8e.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/25910ba44d244d92aaa23ab1aaf9d146/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=n3Pva4B7ioglK0TIhBoyv3yGd2xizzVc32Eyt3Ri70E";
export const GSDC_ANNOUNCEMENT_ENDPOINT = "https://b2d2222dc740ef1690861d5bd091f1.8e.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/578d19e838174478a31d68bc3c20b2c9/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=ZhsPaRPlvhhlywgCr7aEoywbQl3jn2fT2Rlrc5IT7s4";


export const DEVBOT_USERID = '-1432';
export const ITDEV_USERID = '251';
