import React, { useState, useImperativeHandle, forwardRef, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { SaveIcon, Plus, Milestone, Fuel, Printer, Replace, Ban, CheckCheck, Menu, ArrowRight, AtSign, Loader, Calendar, Loader2, Send, ClipboardList, FileSpreadsheet, Undo2 } from 'lucide-react';
import Modal from './ewul_Modal';

// POWER APPS SERVICES
import { type LiveDMSView_CEM } from '../generated/models/LiveDMSView_CEMModel';
//@ts-ignore
import { DMS_AttachmentsService } from '../generated/services/DMS_AttachmentsService'
//@ts-ignore
import { DMS_CEMService } from '../generated/services/DMS_CEMService';
//@ts-ignore
import { GenerateAdditionalOE_IDService } from '../generated/services/GenerateAdditionalOE_IDService';
//@ts-ignore
import { GenerateNewTripTicketService } from '../generated/services/GenerateNewTripTicketService';
//@ts-ignore
import { UpsertAttendanceLogService } from '../generated/services/UpsertAttendanceLogService';
//@ts-ignore
import { GSDC_AttendanceService } from '../generated/services/GSDC_AttendanceService';
import { type GSDC_AttendanceBase } from '../generated/models/GSDC_AttendanceModel';
import type { UpsertTripTaskTrackerRequest } from '../generated/models/UpsertTripTaskTrackerModel';
//@ts-ignore
import { UpsertTripTaskTrackerService } from '../generated/services/UpsertTripTaskTrackerService';
//@ts-ignore
import { CheckIfOEExistsService } from '../generated/services/CheckIfOEExistsService';
import { Action_Logs_HistoryService } from '../generated/services/Action_Logs_HistoryService';
import { type OP_IncidentReports } from '../generated/models/OP_IncidentReportsModel';
//@ts-ignore
import { GetEmployeeServedCountService } from '../generated/services/GetEmployeeServedCountService';
import { OP_IncidentReportsService } from '../generated/services/OP_IncidentReportsService';
//@ts-ignore
import { Upsert_DispatchedAssetPairingService } from '../generated/services/Upsert_DispatchedAssetPairingService';
import { type DMS_CancellationRequests } from '../generated/models/DMS_CancellationRequestsModel';

//CSS
import './comp_css/OrderDistributionForm.css';

// TRUTH SOURCE
import {
  PRINT_DMS_ENDPOINT,
  TRIP_STATUSES, TRIP_PROGRESS,
  ATTENDANCE_STATUSES,
  UPLOAD_ATTACHMENTS_ENDPOINT,
  cementTypeOptions,
  GSDC_SEND_TO_CHAT_key,
  ATTENDANCE_SERVED_COUNTS_INITIAL,
  loaderTypeOptions,
  // IR_TYPES,
  SHORT_BAGS_LIMIT,
  SPECIAL_POSITIONS,
  GSDC_ANNOUNCEMENT_ENDPOINT,
  BUSINESS_UNITS,
  ORDER_DIST_FORM_ALLOWED
} from '../truth.config';


// COMPONENTS
import SearchableDropdown, { type DropdownOption } from './SearchableDropdown';
import CustomDateTimePicker from './ModernTimestampInput';
import CustomFileAttachment, { type CustomFileAttachmentRef } from './DropFile';
import { Assi_icon, DispSrc_icon, DispDst_icon, Done_icon, CheckCircleSolidIcon, XCircleIcon } from './ewul_Icons';
import { MapPin } from 'lucide-react';
import IncidentReportForm, { type IncidentFormHandle, type CreateIR_EmployeeDetails } from '../components/CreateIncidentReportForm';
import TripTimeline from './TripTimeline';
import { type IR_ShortBags_Form_Model, IR_ShortBags_Form, type IR_ShortBags_FormRef } from './IR_ShortBags_Form';
import AutoDismissBanner from '../components/ewul_Banner';


//Utils
import {
  //@ts-ignore
  ewulFetchAll, ewulCreate, ewulUpdate, ewulDelete, ewulExecute, ewulSharePointAPI,
  formatDate,
  logDmsUpdate,
  fetchSharepointAttachments,
  convertFormDataToHtmlTable,
  logDebug, type DebugLogParams,
} from '../utils/Ewul_GSDC_Utils';
import { useTaskWorker } from '../utils/TaskWorkerContext';
import { DMS_CancellationRequestsService } from '@/generated';


// SINGLE SOURCE OF TRUTH FOR CONFIGURATIONS
export type FormUserInfo = {
  BusinessUnit: string;
  Position: string;
  id: string;
  FullName?: string;
};


interface OrderDistributionProps {
  orderId: string;
  initialData?: Partial<LiveDMSView_CEM>; // Use the actual Model type

  onClose: () => void;
  onFormDataChange?: (newData: LiveDMSView_CEM, editedColumn: keyof LiveDMSView_CEM, isValid: boolean) => void;
  onProceed?: (record: LiveDMSView_CEM, deselect: boolean) => void;
  onOEInputClick?: () => void;
  onNavigateToTrip?: (oe: string) => void;
  onCancelTrip?: (id: number) => void;

  onRefreshTrips?: () => void; // New prop to trigger trip list refresh in parent
  onRefreshDriverHelpers?: () => void;
  onRefreshTrucksTrailers?: () => void;
  onUpdateDriverHelperAttendance?: (Name: string, Attendance: string, position: 'Driver' | 'Helper') => void;
  onUpdateTruckTrailers?: (item: any) => void;

  onClearSelectedTrip?: () => void;

  onShowFuelRequest?: (tripData: LiveDMSView_CEM) => void;
  onRequestChangeTrip?: (tripData: LiveDMSView_CEM, action: 'Divert' | 'Change') => void;

  onCIFMESelect?: (soNumber: string) => void;

  maxHeight?: string | number;

  driverOptions?: DropdownOption[];
  helperOptions?: DropdownOption[];
  truckOptions?: DropdownOption[];
  trailerOptions?: DropdownOption[];
  sourceOptions?: DropdownOption[];
  allTrips?: LiveDMSView_CEM[]; // Add this to receive all trips for validation
  lsList?: any[];
  driverHelperList?: any[];


  editingUser?: FormUserInfo | null;

  canChangeTrip?: boolean;
  fuelFetching?: boolean;
}

export interface OrderDistributionFormRef {
  getFormData: () => LiveDMSView_CEM;
  showUnsavedChangesModal: () => Promise<boolean>;
  runValidation: (data: LiveDMSView_CEM) => { isValid: boolean; message: string };
  buildPayloadWithOE: (oe: any, action?: 'UPSERT' | 'DELETE') => ReturnType<typeof buildAssetPairingPayload>;
}

/**
 * Builds the payload for DispatchedAssetPairingState compatible with SP: [dbo].[Upsert_DispatchedAssetPairing]
 */
export const buildAssetPairingPayload = (
  formData: LiveDMSView_CEM,
  driverOptions?: DropdownOption[],
  helperOptions?: DropdownOption[],
  truckOptions?: DropdownOption[],
  trailerOptions?: DropdownOption[],
  updatedBy?: string,
  action: 'UPSERT' | 'DELETE' = 'UPSERT'
) => {
  // Extract driver details (Check opt.value or opt.label depending on your dropdown setup)
  const driverRecord = driverOptions?.find(opt => opt.value === formData.Driver || opt.label === formData.Driver)?.record;
  const driverID = driverRecord?.Id ? String(driverRecord.Id) : undefined;

  // Extract helper details
  const helperRecord = helperOptions?.find(opt => opt.value === formData.Helper || opt.label === formData.Helper)?.record;
  const helperID = helperRecord?.Id ? String(helperRecord.Id) : undefined;

  // Extract truck details & plate
  const truckRecord = truckOptions?.find(opt => opt.value === formData.Vehicle || opt.record?.Head === formData.Vehicle)?.record;
  const truckPlate = truckRecord?.PlateNo || truckRecord?.Plate || undefined;

  // Extract trailer details & plate
  const trailerRecord = trailerOptions?.find(opt => opt.value === formData.BO || opt.record?.PairedTrailer === formData.BO)?.record;
  const trailerPlate = trailerRecord?.TPlateNo || trailerRecord?.Plate || undefined;

  console.log('found truck record: ', truckRecord);

  return {
    OE: formData.OE || null,
    Truck: formData.Vehicle || null,
    TruckPlate: truckPlate || null,
    Trailer: formData.BO || null,
    TrailerPlate: trailerPlate || null,
    Driver: formData.Driver || null,
    DriverID: driverID || null,
    Helper: formData.Helper || null,
    HelperID: helperID || null,
    PairingStatus: 'ACTIVE', // Status stored in DB record
    Action: action,         // Control action for the SP ('UPSERT' | 'DELETE')
    UpdatedBy: updatedBy || 'System'
  };
};


// Mapping initialFormData to match the LiveDMSView_CEM model properties
const initialFormData: LiveDMSView_CEM = {
  ID: 0,
  OE: undefined,
  Loading_x0020_Sequence: 1,
  Buisness_x0020_Unit: '',
  Planning: '',
  Driver: '',
  Helper: '',
  Vehicle: '', // Truck
  BO: '',      // Trailer
  ATW_x002f_LO_x0023_: '', // ATW/LO#
  SO_x0023_: '',           // SO#
  Plant_x0020_DR: '',
  GSDC_x0020_DR: '',
  Source: '',
  Destination: '',
  _tripGroup: '',
  cementType: '',
  TripProgress: 'Assigned',
};



const OrderDistributionForm = forwardRef<OrderDistributionFormRef, OrderDistributionProps & { style?: React.CSSProperties }>(
  ({
    orderId,
    initialData,
    onClose,
    onFormDataChange,
    onProceed,
    onOEInputClick,
    onNavigateToTrip,
    onCancelTrip,
    onShowFuelRequest,
    onRefreshTrips,
    onRefreshDriverHelpers,
    onClearSelectedTrip,
    onRequestChangeTrip,
    onUpdateDriverHelperAttendance,
    onUpdateTruckTrailers,
    onCIFMESelect,
    style,
    maxHeight,
    driverOptions,
    helperOptions,
    truckOptions,
    trailerOptions,
    sourceOptions,
    allTrips: _wew = [],
    // @ts-ignore
    lsList = [],
    editingUser,
    canChangeTrip = false,
    fuelFetching = false,
    driverHelperList
  }, ref) => {


    const { addTask } = useTaskWorker();
    const [isMoreOptionsOpen, setMoreOptionsOpen] = useState(false);
    const [showIncidentPrompt, setShowIncidentPrompt] = useState(false);
    const [isIncidentModalOpen, setIsIncidentModalOpen] = useState(false);
    const incidentFormRef = useRef<IncidentFormHandle>(null);
    const irShortBagsForm = useRef<IR_ShortBags_FormRef>(null);
    const [showTruckConflictModal, setShowTruckConflictModal] = useState(false);
    const [truckConflictInfo, setTruckConflictInfo] = useState<string[]>([]);
    const [showCancelConfirmModal, setShowCancelConfirmModal] = useState(false);
    //@ts-ignore
    const [cancelCountdown, setCancelCountdown] = useState(3);
    //@ts-ignore
    const [isCancelDisabled, setIsCancelDisabled] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [validation, setValidation] = useState<{ isValid: boolean; message: string }>({ isValid: true, message: '' });
    const [personnelValidationModal, setPersonnelValidationModal] = useState<{
      isOpen: boolean;
      type: 'attendance' | 'trip';
      personnelName: string;
      personnelID: string | number;
      personnelType: string;
      tripOE?: string | null;
      enablePlanTrip?: boolean;
    } | null>(null);
    const [showUnsavedChangesModal, setShowUnsavedChangesModal] = useState(false);
    const [showCannotChangeTripModal, setShowCannotChangeTripModal] = useState<{
      isOpen: boolean;
      message: string;
      what: string;
    } | null>(null);
    const [pendingResolve, setPendingResolve] = useState<((val: boolean) => void) | null>(null);
    const [originalFormData, setOriginalFormData] = useState<LiveDMSView_CEM | null>(null);
    const [validationStatus, setValidationStatus] = useState<{
      new_trip: boolean | undefined;
      assigned: boolean | undefined;
      dispatchedToSource: boolean | undefined;
      dispatchedToDestination: boolean | undefined;
      done: boolean | undefined;
    }>({
      new_trip: undefined,
      assigned: undefined,
      dispatchedToSource: undefined,
      dispatchedToDestination: undefined,
      done: undefined,
    });

    const [showShareModal, setShowShareModal] = useState(false);
    const [shareOE, setShareOE] = useState<string>("");
    const [shareComment, setShareComment] = useState("");

    const isReadOnly = !editingUser?.Position || !ORDER_DIST_FORM_ALLOWED.includes(editingUser.Position);

    const mappedBusinessUnits: DropdownOption[] = BUSINESS_UNITS.map((unit) => ({
      value: unit.Title, // Unique identifier used when selected
      label: unit.Title, // Main text displayed in the option row and input box
      type: 'single',     // Turns on multi-line text mode for advanced layout display
      // subtext: unit.Assignment 
      //   ? `Assignment: ${unit.Assignment} | Type: ${unit.Business_Type}`
      //   : "No Assignment", // Gracefully fall back for entries like THIRD PARTY
      record: unit       // Attaches the full raw record for future extraction if needed
    }));

    // State for the assignment confirmation modal
    const [showAssignmentConfirmModal, setShowAssignmentConfirmModal] = useState(false);
    const [assignmentChanges, setAssignmentChanges] = useState<{
      newDriver?: { name: string; status: string; lastStatus: string | null };
      oldDriver?: { name: string; newStatus: 'ABSENT' | 'PRESENT'; lastStatus: string | null };
      newHelper?: { name: string; status: string; lastStatus: string | null };
      oldHelper?: { name: string; newStatus: 'ABSENT' | 'PRESENT'; lastStatus: string | null };
      newVehicle?: string;
      oldVehicle?: string;
      newBO?: string;
      oldBO?: string;
      attendancePayload?: GSDC_AttendanceBase[];
    } | null>(null);

    const [pendingAssignmentConfirmation, setPendingAssignmentConfirmation] = useState<((value: GSDC_AttendanceBase[] | null) => void) | null>(null);
    const [servedDate, setServedDate] = useState<Date>(new Date());

    const [tempPlantDrAttachments, setTempPlantDrAttachments] = useState<File[]>([]);
    const [tempWsAttachments, setTempWsAttachments] = useState<File[]>([]);

    const [wsAttachmentItemID, setWsAttachmentItemID] = useState<string | undefined>(undefined);
    const [plantDrAttachmentItemID, setPlantDrAttachmentItemID] = useState<string | undefined>(undefined);


    const [isTimelineOpen, setIsTimelineOpen] = useState(false);
    const [selectedTimelineOE, setTimelineSelectedOE] = useState<string | null>(null);
    const [tripLogs, setTripLogs] = useState<any[]>([]);
    const [isLoadingLogs, setIsLoadingLogs] = useState(false);

    const [showOngoingRequestWarning, setShowOngoingRequestWarning] = useState(false);
    const [ongoingRequestDetails, setOngoingRequestDetails] = useState<any>(null);

    // State initialization using the model structure
    const [formData, setFormData] = useState<LiveDMSView_CEM>(() => {
      const isNewTrip = !initialData || !initialData.ID;
      const isVerifying = initialFormData.TripProgress === 'Done' && !initialFormData.Verified_x0020_By;

      let finalData = {
        ...initialFormData,
        ...initialData,
      };

      if (isVerifying) {
        finalData.Verified_x0020_By = editingUser?.FullName || '';
      }

      if (isNewTrip) {
        finalData.DispatchedBy = editingUser?.FullName || '';
      }

      return finalData;
    });

    const NAOption: DropdownOption = {
      value: 'N/A',
      label: 'N/A',
      type: 'single',
      record: { Id: 'na', FullName: 'N/A', DMS_Attendance: 'N/A' }
    };

    useEffect(() => {
      const isNewTrip = !initialData || !initialData.ID;
      const newInitialData = {
        ...initialFormData,
        ...initialData,
      };

      if (isNewTrip) {
        newInitialData.DispatchedBy = editingUser?.FullName || '';
      }

      setFormData(newInitialData);
      setOriginalFormData(newInitialData);
      setTempPlantDrAttachments([]);
      setTempWsAttachments([]);
      if (initialData?.OE) {
        fetchAttachments(initialData?.tripID || initialData?.ID || 0, initialData); // Fetch attachments for the current trip
      }

      // Initial validation run
      const initialValidation = runValidation(newInitialData);
      setValidation(initialValidation);
    }, [orderId, initialData, editingUser]);

    const validateAfterAttachmentFetch = (initialData?: any) => {

      // console.log('wada :', initialData);
      const validation = runValidation(initialData);
      setValidation(validation)


    };


    //@ts-ignore
    const [attachmentsLoading, setAttachmentsLoading] = useState(false);
    const [attachments, setAttachments] = useState<any[]>([]);
    //@ts-ignore
    const fetchAttachments = async (tripID: number, initialData?: any) => {

      try {
        const options = {
          filter: `dmsID eq ${tripID}`,
          orderBy: 'Created desc',
          top: 50
        }
        const records = await ewulSharePointAPI<any>(
          "Projects & Developments",
          "DMS_Attachments",
          "query",
          options
        );

        await fetchSharepointAttachments({
          metadataRecords: records,
          listName: 'DMS_Attachments',
          siteAddress: "https://gsdcph.sharepoint.com/sites/ProjectsDevelopments",
          onUpdate: setAttachments,
          onStatusChange: setAttachmentsLoading,
          // onFinish: () => validateAfterAttachmentFetch(initialData),
        });

        console.log('fetched attachments: ', records);

        if (records) {
          setWsAttachmentItemID(
            records.find(
              (item: any) => item.attachment_type === 'WS'
            )?.ID?.toString()
          );

          setPlantDrAttachmentItemID(
            records.find(
              (item: any) => item.attachment_type === 'PLANT DR'
            )?.ID?.toString()
          );


        }

        // validateAfterAttachmentFetch();

      } catch (error) {
        console.error('Error fetching attachments:', error);
        handleLogError(error, `attachments.fetch`, 'Trip - Fetch Attachments', {});
      }
    };

    useEffect(() => {
      validateAfterAttachmentFetch(formData);
    }, [attachments]);

    const hasPlantDrAttachments =
      attachments.some(attr => attr.attachment_type === 'PLANT DR' || attr.raw?.attachment_type === 'PLANT DR') ||
      tempPlantDrAttachments.length > 0;

    const hasWSAttachments =
      attachments.some(attr => attr.attachment_type === 'WS' || attr.raw?.attachment_type === 'WS') ||
      tempWsAttachments.length > 0;





    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    useEffect(() => {
      const hasPendingFiles = tempPlantDrAttachments.length > 0 || tempWsAttachments.length > 0;
      const formDataChanged = originalFormData ? JSON.stringify(formData) !== JSON.stringify(originalFormData) : false;
      setHasUnsavedChanges(formDataChanged || hasPendingFiles);

      const currentProgressIndex = TRIP_PROGRESS.find(p => p.Progress === formData.TripProgress)?.idx ?? 0;
      console.log("curr prog: ", currentProgressIndex, "validation prog: ", getProgIdxByProgress("New Trip"));
      setValidationStatus({
        new_trip: currentProgressIndex >= getProgIdxByProgress("New Trip") ? validateLoadingSequence(formData).isValid : undefined,
        assigned: currentProgressIndex >= getProgIdxByProgress("Assigned") ? validateAssigned(formData).isValid : undefined,
        dispatchedToSource: currentProgressIndex >= getProgIdxByProgress("Dispatched To Source") ? validateDispatchedToSource(formData).isValid : undefined,
        dispatchedToDestination: currentProgressIndex >= getProgIdxByProgress("Dispatched To Destination") ? validateDispatchedToDestination(formData).isValid : undefined,
        done: currentProgressIndex >= getProgIdxByProgress("Done") ? validateDone(formData).isValid : undefined,
      });

    }, [formData, originalFormData, tempPlantDrAttachments, tempWsAttachments, attachmentsLoading]);


    const convNaive = (datetime: string | undefined) => {
      return datetime ? datetime.replace('Z', '') : ''
    }

    const validateOE = (data: LiveDMSView_CEM) => {
      const oe = data.OE;

      if (oe === undefined || oe === '' || oe === null) {
        return { isValid: false, message: 'No Trip Selected.' };
      }

      return { isValid: true, message: 'Order Reference is valid.' };
    }

    const validateLoadingSequence = (data: LiveDMSView_CEM) => {
      // const seq = data.Loading_x0020_Sequence;
      // const currentSource = data.Source;

      const oeValidation = validateOE(data);
      if (!oeValidation.isValid) return oeValidation;

      // if (seq === undefined || seq === null) {
      //   return { isValid: false, message: 'Loading Sequence is required.' };
      // }

      // if (seq < 1 || seq > 999.99) {
      //   return { isValid: false, message: 'Sequence must be between 1 and 999.99.' };
      // }

      // const isDuplicate = (lsList || []).some(trip =>
      //   trip.OE !== data.OE && // Exclude the current order from the check
      //   trip.Source === currentSource && // Only check within the same source
      //   Number(trip.Loading_x0020_Sequence) === Number(seq)
      // );

      // if (isDuplicate) {
      //   const duplicateTrips = (lsList || []).filter(trip =>
      //     trip.OE !== data.OE && // Exclude the current order from the check
      //     Number(trip.Loading_x0020_Sequence) === Number(seq)
      //   ).map(trip => trip.OE).join(', ');
      //   return { isValid: false, message: `Duplicate sequence ${seq} detected! Used by [${duplicateTrips}]` };
      // }

      if ((data._tripGroup === 'Preload') && !data.Source) {
        return { isValid: false, message: 'Please select a source.' };
      }

      if ((data._tripGroup === 'Preload') && !data.cementType) {
        return { isValid: false, message: 'Please select a cement type.' };
      }

      return { isValid: true, message: 'Trip details are valid.' };
    };

    // =================================================================================
    // NEW VALIDATION STRUCTURE
    // =================================================================================

    const validateAssigned = (data: LiveDMSView_CEM) => {
      // Contains all validations for the 'Assigned' stage
      const loadingSeqValidation = validateLoadingSequence(data);
      if (!loadingSeqValidation.isValid) return loadingSeqValidation;


      // Helper function to keep the logic clean
      const isAssetAvailable = (assetValue: any, optionsArray: DropdownOption[] | undefined) => {
        if (!assetValue) return false;

        const record = optionsArray?.find(opt => opt.value === assetValue)?.record;
        if (!record) return false;

        // Returns true as long as there is no active OE
        return !record.OE;
      };

      const canTripPlanProceed =
        isAssetAvailable(data.Driver, driverOptions) &&
        isAssetAvailable(data.Helper, helperOptions);

      if ((data.TripProgress == 'Planned') && !canTripPlanProceed) {
        return { isValid: false, message: "This is a Planned Trip. Make sure the assigned Driver | Helper | Truck | Trailer doesn't have an on going trip." };
      }


      if (!data.Driver) {
        return { isValid: false, message: 'Driver must be assigned.' };
      }
      if (!data.Vehicle) {
        return { isValid: false, message: 'Truck must be assigned.' };
      }
      if (!data.BO && data._tripGroup !== 'Mobilization') {
        return { isValid: false, message: 'Trailer must be assigned.' };
      }

      /*if (!data.MonitoredBy && data.TripProgress === 'Assigned') {
        return { isValid: false, message: 'Monitored By is required.' };
      }
      if (!data.DispatchedBy && data.TripProgress === 'Assigned') {
        return { isValid: false, message: 'Dispatched By is required.' };
      }*/

      // You can add more 'Assigned' specific validations here
      // e.g., check if Driver/Helper are assigned

      return { isValid: true, message: 'Assignment details are valid.' };
    };

    const validateDispatchedToSource = (data: LiveDMSView_CEM) => {

      const assignedValidation = validateAssigned(data);
      if (!assignedValidation.isValid) return assignedValidation;

      // For CIFME
      // if (!data.CIFME_OE && editingUser?.Position === 'Developer') {return { isValid: false, message: 'Please select a CIFME order before proceeding with this trip.' };}

      if ((data._tripGroup === 'Preload') && (TRIP_PROGRESS.find(p => p.Progress === data.TripProgress)?.idx ?? 0) >= 2) {
        return { isValid: false, message: 'Preload must be divert to an actual trip before proceeding.' };
      }

      if (!data.ATW_x002f_LO_x0023_) {
        return { isValid: false, message: 'please input ATW.' };
      }

      if (!data.SO_x0023_) {
        return { isValid: false, message: 'please input SO.' };
      }


      if (!data.Driver_x0020_Loader) {
        return { isValid: false, message: 'Driver Loader must be specified or N/A if none.' };
      }

      if (!data.Helper_x0020_Loader) {
        return { isValid: false, message: 'Helper Loader must be specified or N/A if none.' };
      }

      if (data.Driver_x0020_Loader && !data.DriverLoaderType) {
        return { isValid: false, message: 'Please specify a Driver Loader type.' };
      }
      if (data.Helper_x0020_Loader && !data.HelperLoaderType) {
        return { isValid: false, message: 'Please specify a Helper Loader type.' };
      }




      // Add 'Dispatched To Source' specific validations here in the future

      return { isValid: true, message: 'Source details are valid.' };
    };

    const validateLoaderUnloader = (data: LiveDMSView_CEM) => {

      if (data.Driver_x0020_Loader && !data.DriverLoaderType) {
        return { isValid: false, message: 'Please specify a Driver Loader type.' };
      }
      if (data.Helper_x0020_Loader && !data.HelperLoaderType) {
        return { isValid: false, message: 'Please specify a Helper Loader type.' };
      }
      if (data.Driver_x0020_Unloader && !data.DriverUnloaderType) {
        return { isValid: false, message: 'Please specify a Driver Unloader type.' };
      }
      if (data.Helper_x0020_Unloader && !data.HelperUnloaderType) {
        return { isValid: false, message: 'Please specify a Helper Unloader type.' };
      }


      if (data.Driver_x0020_Loader && !data.Driver_x0020_Unloader) {
        return { isValid: false, message: 'Driver Unloader must be assigned if Driver Loader is assigned.' };
      }
      if (!data.Driver_x0020_Loader && data.Driver_x0020_Unloader) {
        return { isValid: false, message: 'Please specify a Driver Loader, either the assigned Driver or another valid driver.' };
      }


      if ('N/A' === data.Helper_x0020_Loader && data.HelperLoaderType !== 'No Loader') {
        return { isValid: false, message: 'Driver loader type must be "No Loader" if Helper Loader is "N/A".' };
      }
      if ('N/A' === data.Helper_x0020_Unloader && data.HelperUnloaderType !== 'No Unloader') {
        return { isValid: false, message: 'Driver unloader type must be "No Unloader" if Helper Unloader is "N/A".' };
      }

      return { isValid: true, message: 'Loader/Unloader details are valid.' };
    };


    const validateDispatchedToDestination = (data: LiveDMSView_CEM) => {
      const sourceValidation = validateDispatchedToSource(data);
      if (!sourceValidation.isValid) return sourceValidation;

      if (data.Driver || data.Helper) {
        const loaderUnloaderValidation = validateLoaderUnloader(data);
        if (!loaderUnloaderValidation.isValid) return loaderUnloaderValidation;
      }



      if ((!data.QTYWithdrawn || data.QTYWithdrawn < 1) && data._tripGroup !== 'Mobilization') {
        return { isValid: false, message: 'QTY Withdrawn must be greater than 0.' };
      }

      if (!data.Driver_x0020_Unloader) {
        return { isValid: false, message: 'Driver Unloader must be specified or N/A if none.' };
      }

      if (!data.Helper_x0020_Unloader) {
        return { isValid: false, message: 'Helper Unloader must be specified or N/A if none.' };
      }


      console.log('wew :', attachments);
      console.log('wew2 :', tempPlantDrAttachments);
      console.log('wew3 :', attachments.filter(attr => attr.attachment_type === 'PLANT DR' || attr.raw?.attachment_type === 'PLANT DR'));
      console.log('attachmentsLoading :', attachmentsLoading);

      // if (!attachmentsLoading) {
      //   return {
      //     isValid: false,
      //     message: 'Checking attachments...'
      //   };
      // }

      if (!hasPlantDrAttachments) {
        return {
          isValid: false,
          message: 'Plant DR attachment is needed.'
        };
      }

      /*if (!data.Driver_x0020_Loader && data.Driver_x0020_Unloader) {
        return { isValid: false, message: 'Test' };
      }*/


      // Add 'Dispatched To Destination' specific validations here in the future    

      return { isValid: true, message: 'Destination details are valid.' };
    };

    const validateDone = (data: LiveDMSView_CEM) => {
      const destinationValidation = validateDispatchedToDestination(data);
      if (!destinationValidation.isValid) return destinationValidation;


      if ((!data.QTYDelivered || data.QTYDelivered < 1) && data._tripGroup !== 'Mobilization') {
        return { isValid: false, message: 'QTY Delivered must be greater than 0.' };
      }

      // if (!attachmentsLoading) {
      //   return {
      //     isValid: false,
      //     message: 'Checking attachments...'
      //   };
      // }


      if (!hasWSAttachments) {
        return { isValid: false, message: 'Weight Scale attachment is needed.' };
      }




      const sourceIn = data.Source_x0020_in ? new Date(convNaive(data.Source_x0020_in)) : null;
      const sourceOut = data.Source_x0020_out ? new Date(convNaive(data.Source_x0020_out)) : null;
      const destIn = data.Destination_x0020_in ? new Date(convNaive(data.Destination_x0020_in)) : null;
      const destOut = data.Destination_x0020_out ? new Date(convNaive(data.Destination_x0020_out)) : null;

      if (!sourceIn || isNaN(sourceIn.getTime())) {
        return { isValid: false, message: 'Source In time is not valid.' };
      }

      if (!sourceOut || isNaN(sourceOut.getTime())) {
        return { isValid: false, message: 'Source Out time is not valid.' };
      }

      if (sourceIn >= sourceOut) {
        return { isValid: false, message: 'Source Out must be after Source In.' };
      }

      if (sourceIn.getTime() > Date.now()) {
        return { isValid: false, message: 'Source In cannot be in the future.' };
      }

      if (sourceOut.getTime() > Date.now()) {
        return { isValid: false, message: 'Source Out cannot be in the future.' };
      }


      if (!destIn || isNaN(destIn.getTime())) {
        return { isValid: false, message: 'Destination In time is not valid.' };
      }
      if (!destOut || isNaN(destOut.getTime())) {
        return { isValid: false, message: 'Destination Out time is not valid.' };
      }
      if (destIn >= destOut) {
        return { isValid: false, message: 'Destination Out must be after Destination In.' };
      }
      if (sourceOut && destIn <= sourceOut) {
        return { isValid: false, message: 'Destination In must be after Source Out.' };
      }
      if (destIn.getTime() > Date.now()) {
        return { isValid: false, message: 'Destination In cannot be in the future.' };
      }
      if (destOut.getTime() > Date.now()) {
        return { isValid: false, message: 'Destination Out cannot be in the future.' };
      }






      //const dateDocumented = data.Documented_x0020_Date ? new Date(convNaive(data.Documented_x0020_Date)) : null;
      const dateReceived = data.Receive_x0020_Date ? new Date(convNaive(data.Receive_x0020_Date)) : null;
      const dateTransmitted = data.Transimtted_x0020_Date ? new Date(convNaive(data.Transimtted_x0020_Date)) : null;

      /*if (!dateDocumented) return { isValid: false, message: 'Date Documented is required.' };
      if (dateDocumented && destOut && destOut >= dateDocumented) {
        return { isValid: false, message: 'Date Documented must be atleast after Destination Out.' };
      }*/

      if (!dateReceived) return { isValid: false, message: 'Date Received is required.' };
      if (dateReceived && destOut && destOut >= dateReceived) {
        return { isValid: false, message: 'Date Received must be atleast after Destination Out.' };
      }

      if (!dateTransmitted) return { isValid: false, message: 'Date Transmitted is required.' };
      if (dateTransmitted && destOut && destOut >= dateTransmitted) {
        return { isValid: false, message: 'Date Transmitted must be atleast after Destination Out.' };
      }


      if ((data.QTYDelivered_Actual || 0) <= 0) return { isValid: false, message: 'Actual Delivered cannot be less than or equal to 0.' };
      if ((data.QTYWithdrawn_Actual || 0) <= 0) return { isValid: false, message: 'Actual Withdrawn cannot be less than or equal to 0.' };



      return { isValid: true, message: 'Documentation details are valid.' };
    };

    const validate_list = [validateLoadingSequence, validateAssigned, validateDispatchedToSource, validateDispatchedToDestination, validateDone];

    const runValidation = (data: LiveDMSView_CEM) => {
      const progress_idx = TRIP_PROGRESS.find(item => item.Progress === data.TripProgress);
      let validate_next = progress_idx ? validate_list[progress_idx.idx < 1 ? 0 : progress_idx.idx /* start with progress 1 (Assigned) validaiton */] : null;

      return validate_next ? validate_next(data) : { isValid: true, message: '' };
    };

    const showValidationIcon = (validationStatusName: keyof typeof validationStatus) => {
      const status = validationStatus[validationStatusName];
      const size = 20;

      if (status === undefined) return null;

      if (status === true) {
        return <CheckCircleSolidIcon size={size} color="var(--color-border-success)" />;
      }
      if (status === false) {
        return <XCircleIcon size={size} color="var(--color-border-danger)" />;
      }
      return null; // Return nothing if the status is undefined
    };


    const LOADER_TYPE_OPTIONS = loaderTypeOptions as DropdownOption[];



    const handlePersonnelValidationModalClose = () => {
      if (pendingPersonnelValidationResolve) pendingPersonnelValidationResolve(false);
      setPersonnelValidationModal(null);
      setPendingPersonnelValidationResolve(null);
    };



    useImperativeHandle(ref, () => ({
      getFormData: () => formData,
      showUnsavedChangesModal: () => {
        if (!hasUnsavedChanges) return Promise.resolve(true);

        setShowUnsavedChangesModal(true);
        return new Promise<boolean>((resolve) => {
          // 2. Wrap the resolve function in another function 
          // This tells React: "Store this specific function, don't execute it"
          setPendingResolve(() => resolve);
        });
      },
      runValidation: (data: LiveDMSView_CEM) => runValidation(data),

      buildPayloadWithOE: (oe: any, action: 'UPSERT' | 'DELETE' = 'UPSERT') => {
        // If your form data needs the OE attached before generating payload:
        const updatedFormData = {
          ...formData,
          OE: oe, // Attach or override the OE parameter
        };

        return buildAssetPairingPayload(
          updatedFormData,
          driverOptions,
          helperOptions,
          truckOptions,
          trailerOptions,
          editingUser?.FullName || 'Unknown User',
          action
        );
      },


    }), [formData, hasUnsavedChanges, runValidation]);

    const [pendingPersonnelValidationResolve, setPendingPersonnelValidationResolve] = useState<((val: boolean | 'planTrip') => void) | null>(null);
    const showPersonnelValidationModal = (modalProps: any) => {
      setPersonnelValidationModal({
        ...modalProps,
        isOpen: true,
      });
      return new Promise<boolean | 'planTrip'>((resolve) => {
        setPendingPersonnelValidationResolve(() => resolve);
      });
    };

    const updateEmployeeTypes = (
      data: any,
      empPos: 'Driver' | 'Helper'
    ) => {
      const employee = data[empPos];

      const loader = data[`${empPos}_x0020_Loader`];
      const unloader = data[`${empPos}_x0020_Unloader`];

      const bothAssigned =
        loader === employee &&
        unloader === employee;

      data[`${empPos}LoaderType`] =
        loader === 'N/A'
          ? 'No Loader'
          : bothAssigned
            ? 'Full Trip'
            : loader === employee
              ? 'Loader Only'
              : undefined;

      data[`${empPos}UnloaderType`] =
        unloader === 'N/A'
          ? 'No Unloader'
          : bothAssigned
            ? 'Full Trip'
            : unloader === employee
              ? 'Unloader Only'
              : undefined;

      return data;
    };



    // Helper function to check the specific "Planned" condition
    const checkNeedsPlannedTag = (personnelValue: any, optionsArray: DropdownOption[] | undefined) => {
      if (!personnelValue) return false;
      const record = optionsArray?.find(opt => opt.value === personnelValue)?.record;

      // Returns true if they have an OE but plannedTrip is null (or undefined)
      return !!record?.OE && record?.plannedTrip == null;
    };

    // This variable will be true if EITHER the driver or helper meets the condition
    const shouldTagAsPlanned =
      (
        checkNeedsPlannedTag(formData?.Driver, driverOptions) ||
        checkNeedsPlannedTag(formData?.Helper, helperOptions)
      ) && formData.TripProgress == 'Assigned';

    const handleFieldChange = async (key: keyof LiveDMSView_CEM, value: any) => {
      if (!formData || !formData.OE) {
        onOEInputClick?.(); // Prompt user to select an OE
        return; // Stop the field change
      }

      const selectedOption = (key === 'Driver' ? driverOptions : helperOptions)?.find(opt => opt.value === value);
      const record = selectedOption?.record;
      const attendance_to_warn = ATTENDANCE_STATUSES.filter(status => !status.onduty).map(status => status.Status);

      if (key === 'Driver' || key === 'Helper') {
        if (record) {

          // Regular OE conflict where plannedTrip is already set
          if (record.OE && record.plannedTrip != null) {
            await showPersonnelValidationModal({
              type: 'trip',
              personnelName: record.FullName || 'the selected person',
              personnelID: record.Id,
              personnelType: key === 'Driver' ? 'Driver' : 'Helper',
              tripOE: record.OE,
            });
            return; // Stop the update no matter what
          }

          // Check if person has an OE but the plannedTrip is null
          if (record.OE && record.plannedTrip == null) {
            const userResponse = await showPersonnelValidationModal({
              type: 'trip',
              personnelName: record.FullName || 'the selected person',
              personnelID: record.Id,
              personnelType: key === 'Driver' ? 'Driver' : 'Helper',
              tripOE: record.OE,
              enablePlanTrip: true,
            });

            // If the user cancels or does not explicitly click Plan Trip, stop the update
            if (userResponse !== true && (userResponse as any) !== 'planTrip') {
              return;
            }
            // If they proceed, do nothing here and let the function continue to the state update
          }

          // Attendance warnings check
          if (attendance_to_warn.some(status => status === record.DMS_Attendance)) {
            const userResponse = await showPersonnelValidationModal({
              type: 'attendance',
              personnelName: record.FullName || 'the selected person',
              personnelID: record.Id,
              personnelType: key === 'Driver' ? 'Driver' : 'Helper',
            });
            console.log('User response from attendance modal:', userResponse, ' input: ', value, ' key:', key);

            // If they cancel out of the attendance modal, stop the update
            if (!userResponse) {
              return;
            }
          }
        }
      }


      setFormData(prevData => {
        let newData = { ...prevData, [key]: value };
        const match = key.match(/^(Driver|Helper)_x0020_(Loader|Unloader)$/);

        if (match) {
          const [, empPos] = match;

          newData = updateEmployeeTypes(
            newData,
            empPos as 'Driver' | 'Helper'
          );
        }

        console.log('Updated formData:', newData);

        const validationResult = runValidation(newData);
        setValidation(validationResult);

        if (onFormDataChange) {
          onFormDataChange(newData, key, validationResult.isValid);
        }

        return newData;
      });

    };

    const getEmployeeOptions = (
      formData: any,
      empPos: 'Driver' | 'Helper',
      type: 'Loader' | 'Unloader'
    ) => {
      const filteredOptions = LOADER_TYPE_OPTIONS.filter(l => l.record.empPos.includes(empPos));

      const field = formData[`${empPos}_x0020_${type}`];
      const otherField = formData[`${empPos}_x0020_${type === 'Loader' ? 'Unloader' : 'Loader'}`];
      const employee = formData[empPos];

      if (field === employee && field === otherField) {
        return filteredOptions.filter(l => l.value === 'Full Trip');
      }

      if (field === employee) {
        return filteredOptions.filter(l => l.value === `${type} Only`);
      }

      if (field === "N/A") {
        return filteredOptions.filter(l => l.value === `No ${type}`);
      }

      return filteredOptions.filter(l => l.record.multicase);
    };

    const getLoaderOptions = (formData: any, empPos: 'Driver' | 'Helper') =>
      getEmployeeOptions(formData, empPos, 'Loader');

    const getUnloaderOptions = (formData: any, empPos: 'Driver' | 'Helper') =>
      getEmployeeOptions(formData, empPos, 'Unloader');

    const [processTruckIR, setProcessTruckIR] = useState<{ irid: string, conflict?: string } | null>(null);
    const handleTruckChange = (truckValue: string | number) => {
      if (!formData || !formData.OE) {
        onOEInputClick?.(); // Prompt user to select an OE
        return; // Stop the field change
      };

      //FOR TESTING
      if (truckValue == 'Apple') {
        handleFieldChange('BO', 'Berry');
        handleFieldChange('Vehicle', 'Apple');
        return;
      }

      const selectedTruckOption = truckOptions?.find(opt => opt.record?.Head === truckValue);
      const item = selectedTruckOption?.record;

      console.log('truck truck: ', selectedTruckOption);

      if (!item) return;

      const conflicts: string[] = [];

      // console.log("1")

      // Validation checks
      if (item.OE != null) {
        conflicts.push(`Is already assigned to trip: ${item.OE}.`);
      }
      if (item.PairedTrailer == null && formData._tripGroup !== 'Mobilization') {
        conflicts.push('Does not have a paired trailer.');
      }
      if (item.TractorJrNumber != null || item.JR_Truck_approve != null || item._TractorDivertJR != null || item._TractorRescueJR != null) {
        conflicts.push(`The tractor has an active job request [${item.TractorJrNumber}].`);
      }
      if (item.TrailerJrNumber != null || item.JR_Trailer_approve != null || item._TrailerDivertJR != null || item._TrailerRescueJR != null) {
        conflicts.push(`The paired trailer has an active job request [${item.TrailerJrNumber}].`);
      }

      if (item.TractorIRID != null) {
        setProcessTruckIR({
          irid: item.TractorIRID,
          conflict: 'The selected Truck has an open Incident Report.'
        });
        return;
      }

      if (item.IRID != null) {
        setProcessTruckIR({
          irid: item.IRID,
          conflict: 'The selected Trailer has an open Incident Report.'
        });
        return;
      }

      if (conflicts.length > 0) {
        setTruckConflictInfo(conflicts);
        setShowTruckConflictModal(true);
        return; // Stop the update
      }


      const pairedTrailer = item.PairedTrailer || '';

      setFormData(prevData => {
        const newData = {
          ...prevData,
          Vehicle: String(truckValue),
          BO: String(pairedTrailer)
        };
        const validationResult = runValidation(newData);
        setValidation(validationResult);

        // Notify parent about both changes
        if (onFormDataChange) {
          onFormDataChange(newData, 'BO', validationResult.isValid);
          onFormDataChange(newData, 'Vehicle', validationResult.isValid);
        }

        return newData;
      });
    };

    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        // If click occurs outside the ref element, close the dropdown
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
          setMoreOptionsOpen(false);
        }
      };

      if (isMoreOptionsOpen) {
        document.addEventListener('mousedown', handleClickOutside);
      }

      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }, [isMoreOptionsOpen]);



    type InputGroupState = {
      oeRef: boolean;
      oeDetails: boolean;
      assignmentDetails: boolean;
      sourceDetails: boolean;
      destinationDetails: boolean;
      doneVerification: boolean;
    };

    const createCollapsedState = (expandedGroups: Array<keyof InputGroupState> = []) => {
      const baseState: InputGroupState = {
        oeRef: false,
        oeDetails: true,
        assignmentDetails: true,
        sourceDetails: true,
        destinationDetails: true,
        doneVerification: true,
      };

      expandedGroups.forEach(group => {
        baseState[group] = false;
      });

      return baseState;
    };

    const inputGroup = createCollapsedState();

    const [collapsed, setCollapsed] = useState(inputGroup);

    const toggleGroup = (key: keyof typeof collapsed) => {
      setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const expandAll = () => {
      const allExpanded = Object.keys(inputGroup).reduce((acc, key) => {
        acc[key as keyof typeof inputGroup] = false;
        return acc;
      }, {} as typeof inputGroup);

      setCollapsed(allExpanded);
    };

    const collapseAll = () => {
      setCollapsed(createCollapsedState());
    };

    const getProgressGroupKey = (progress?: string): keyof typeof collapsed | null => {
      switch (progress) {
        case 'New Trip':
        case 'Plotted':
          return 'oeDetails';
        case 'Assigned':
          return 'assignmentDetails';
        case 'Dispatched To Source':
          return 'sourceDetails';
        case 'Dispatched To Destination':
          return 'destinationDetails';
        case 'Done':
          return 'doneVerification';
        default:
          return null;
      }
    };

    const getValidationGroupKeys = (): Array<keyof typeof collapsed> => {
      const groups: Array<keyof typeof collapsed> = [];

      if (validationStatus.new_trip === false) groups.push('oeDetails');
      if (validationStatus.assigned === false) groups.push('assignmentDetails');
      if (validationStatus.dispatchedToSource === false) groups.push('sourceDetails');
      if (validationStatus.dispatchedToDestination === false) groups.push('destinationDetails');
      if (validationStatus.done === false) groups.push('doneVerification');

      return groups;
    };

    useEffect(() => {
      const progressGroup = getProgressGroupKey(formData.TripProgress);
      const validationGroups = getValidationGroupKeys();
      const groupsToExpand = [progressGroup, ...validationGroups].filter(
        (group): group is keyof typeof collapsed => group !== null
      );

      setCollapsed(createCollapsedState(groupsToExpand));
    }, [formData.TripProgress, formData.ID]);








    const [bannerMessage, setBannerMessage] = useState<string | null>(null);





    //const buOptions: DropdownOption[] = BUSINESS_UNITS.map(bu => ({ label: bu.Title, value: bu.Title, subtext: `${bu.Business_Type} | ${bu.Assignment}`, type: 'multi' }));
    const tripStatusOptions: DropdownOption[] = TRIP_STATUSES
      .filter(status => status.Progress.some(p => p?.Progress === formData.TripProgress))
      .map(status => ({
        label: status.Status,
        value: status.Status,
        type: 'multi',
      }));
    if (tripStatusOptions.length === 0) {
      tripStatusOptions.push({ label: '', value: '', type: 'single' });
    }

    //auto scroll to relevant fields based on trip progress
    const newtripsDetailsRef = useRef<HTMLDivElement>(null);
    const assignmentDetailsRef = useRef<HTMLDivElement>(null);
    const dispatchedToSourceRef = useRef<HTMLDivElement>(null);
    const dispatchedToDestinationRef = useRef<HTMLDivElement>(null);
    const doneRef = useRef<HTMLDivElement>(null);


    const refs = [newtripsDetailsRef, assignmentDetailsRef, dispatchedToSourceRef, dispatchedToDestinationRef, doneRef];
    const icons = [
      <Plus size={'var(--font-size-vlg)'} color='var(--color-text-2)' />,
      <Assi_icon color='var(--color-text-2)' />,
      <DispSrc_icon size={32} color='var(--color-text-2)' />,
      <DispDst_icon size={32} color='var(--color-text-2)' />,
      <Done_icon color='var(--color-text-2)' />,
    ];
    const trip_progress = TRIP_PROGRESS.filter(item => !item.exclude).map(item => ({
      ...item,
      ref: refs[item.idx],   // Uses your logical idx (0-4) instead of array position
      icon: icons[item.idx]
    }));
    const maxprogress = Math.max(...TRIP_PROGRESS.map(item => item.idx));

    const progress_idx = () => TRIP_PROGRESS.find(item => item.Progress === formData.TripProgress)?.idx ?? 0;

    // const prog_completed = 'Done'
    // let prog_idx = progress_idx();
    // let prog_next = trip_progress[0].Progress;
    // let prog_icon = trip_progress[0]?.icon;
    // if (prog_idx !== undefined) {
    //   let next = trip_progress[prog_idx < maxprogress - 1 ? prog_idx + 1 : prog_idx];
    //   prog_next = prog_idx < maxprogress - 1 ? next?.Progress : prog_completed;
    //   prog_icon = prog_idx < maxprogress - 1 ? next?.icon || null : <CheckCheck />;
    // }
    // const prog_verified = prog_idx === maxprogress && !!formData.Verified_x0020_By && !!formData.Documented_x0020_Date;

    const prog_completed = 'Done';
    let prog_idx = progress_idx();
    let prog_next = trip_progress[0]?.Progress;
    let prog_icon = trip_progress[0]?.icon;

    if (prog_idx !== undefined) {
      // Find the first progress object with a logical idx greater than the current one
      const next = trip_progress.find((step) => step.idx > prog_idx);

      if (next) {
        // If a next step exists (e.g., jumping from idx 1 straight to idx 2)
        prog_next = next.Progress;
        prog_icon = next.icon || null;
      } else {
        // If no higher idx is found, we've reached the end
        prog_next = prog_completed;
        prog_icon = <CheckCheck />;
      }
    }

    const prog_verified = prog_idx === maxprogress && !!formData.Verified_x0020_By && !!formData.Documented_x0020_Date;

    useEffect(() => {
      // Replace with your actual field for progress
      const progress = initialData?.TripProgress;
      if (!progress) return;
      trip_progress.find(item => item.Progress === progress)?.ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });

      console.log('NEXT TRIP PROGRESS: ', prog_next);

    }, [initialData?.TripProgress, orderId]);



    const generateTripTicketID = async (OE?: string | undefined) => {

      try {
        const res = await ewulExecute('DISPATCH_APP_DMS', 'GenerateNewTripTicket', {
          OE: OE,
        } as any);




        const table1 = res as any[] | undefined;
        console.log('trip ticket: ', table1)
        if (table1 && table1.length > 0) {
          return table1[0].TripTicketID + ' (Preview)' || null;
        } else {
          return null;
        }


      } catch (error) {
        console.error("Error generating trip ticket ID:", error);
        return null;
      } finally {

      }

    };

    const generateAdditionalOE = async (type: 'Preload' | 'Mobilization') => {


      try {
        const res = await ewulExecute('DISPATCH_APP_DMS', 'GenerateAdditionalOE_ID', {
          Type: type,
        } as any);


        const table1 = res as any[] | undefined;
        if (!table1 || table1.length === 0) {
          console.error("No data returned for new OE generation.");
          return;
        }

        if (type === 'Preload') return table1[0].NewID;
        if (type === 'Mobilization') return table1[0].NewID;

      } catch (error) {
        console.error("Fetch error:", error);
      } finally {

      }
    };


    const checkAssignmentChanges = async (newData: LiveDMSView_CEM, noAttPayload: boolean = false): Promise<{ canProceed: boolean; attdate?: string }> => {
      const oldData = originalFormData;
      if (!oldData) return { canProceed: true }; // No original data to compare against

      const changes: any = {};
      let attendanceStatus: string;

      switch (newData.TripProgress) {
        case 'Dispatched To Source': attendanceStatus = 'ON TRIP'; break;
        case 'Dispatched To Destination': attendanceStatus = 'IN TRANSIT'; break;
        case 'Done': attendanceStatus = 'SERVED'; break;
        default: attendanceStatus = 'ON TRIP';
      }

      let coorApps_AttendancePayload = null;
      if (newData.TripProgress === 'Done' && !noAttPayload) {
        console.log('Initial Served date: ', servedDate);
        coorApps_AttendancePayload = await generateAttendancePayload(newData, editingUser?.FullName || 'Unknown User');
      }

      const newDriverLastAttendance = driverOptions?.find(opt => opt.label === newData.Driver)?.record.DMS_Attendance;
      const newHelperLastAttendance = helperOptions?.find(opt => opt.label === newData.Helper)?.record.DMS_Attendance;
      const oldDriverLastAttendance = driverOptions?.find(opt => opt.label === oldData.Driver)?.record.DMS_Attendance;
      const oldHelperLastAttendance = helperOptions?.find(opt => opt.label === oldData.Helper)?.record.DMS_Attendance;

      if (newData.Driver !== oldData.Driver) {
        if (newData.Driver) changes.newDriver = { name: newData.Driver, status: attendanceStatus, lastStatus: newDriverLastAttendance };
        if (oldData.Driver) changes.oldDriver = { name: oldData.Driver, newStatus: 'ABSENT', lastStatus: oldDriverLastAttendance };
      }
      if (newData.Helper !== oldData.Helper) {
        if (newData.Helper) changes.newHelper = { name: newData.Helper, status: attendanceStatus, lastStatus: newHelperLastAttendance };
        if (oldData.Helper) changes.oldHelper = { name: oldData.Helper, newStatus: 'ABSENT', lastStatus: oldHelperLastAttendance };
      }
      if (newData.Vehicle !== oldData.Vehicle) {
        changes.newVehicle = newData.Vehicle;
        changes.oldVehicle = oldData.Vehicle;
      }
      if (newData.BO !== oldData.BO) {
        changes.newBO = newData.BO;
        changes.oldBO = oldData.BO;
      }

      // If no relevant changes were detected, proceed without confirmation.
      if (Object.keys(changes).length === 0 && newData.TripProgress !== 'Done') {
        return { canProceed: true };
      }

      setAssignmentChanges({
        ...changes,
        attendancePayload: coorApps_AttendancePayload
      });
      setShowAssignmentConfirmModal(true);

      const finalPayloadToUpload = await new Promise<any[] | null>((resolve) => {
        setPendingAssignmentConfirmation(() => resolve);
      });

      if (!finalPayloadToUpload) {
        console.log("Assignment changes cancelled by user.");
        return { canProceed: false };
      }

      // User confirmed, now execute the logic
      const action_string = formData.TripProgress === 'New Trip' ? 'Assigned' : 'Changed';
      const _logupdate = (value: string, what: string) => {
        logDmsUpdate({
          userName: editingUser?.FullName || '',
          userID: Number(editingUser?.id) || 0,
          inputOE: formData.OE || '',
          action: `${action_string} ${what}: [${value}] for this trip.`,
          value: value || '',
          context: `Trip - Assignment`,
          role: editingUser?.Position || '',
        });
      };

      const attdate = finalPayloadToUpload.length > 0 ? finalPayloadToUpload[0].Date : undefined


      if (changes.newDriver || changes.oldDriver) {
        if (changes.newDriver) {
          handleUpdateAttendance(changes.newDriver.name, driverOptions?.find(opt => opt.label === changes.newDriver.name)?.record.Id, 'Driver', changes.newDriver.status, false, attdate);
        }
        if (changes.oldDriver) {
          handleUpdateAttendance(changes.oldDriver.name, driverOptions?.find(opt => opt.label === changes.oldDriver.name)?.record.Id, 'Driver', assignmentChanges?.oldDriver?.newStatus, false, attdate);
        }
        _logupdate(newData.Driver || 'None', 'Driver');
      }

      if (changes.newHelper || changes.oldHelper) {
        if (changes.newHelper) {
          handleUpdateAttendance(changes.newHelper.name, helperOptions?.find(opt => opt.label === changes.newHelper.name)?.record.Id, 'Helper', changes.newHelper.status, false, attdate);
        }
        if (changes.oldHelper) {
          handleUpdateAttendance(changes.oldHelper.name, helperOptions?.find(opt => opt.label === changes.oldHelper.name)?.record.Id, 'Helper', assignmentChanges?.oldHelper?.newStatus, false, attdate);
        }
        _logupdate(newData.Helper || 'None', 'Helper');
      }

      if (changes.newVehicle) _logupdate(newData.Vehicle || 'None', 'Truck');
      if (changes.newBO) _logupdate(newData.BO || 'None', 'Trailer');



      // 💡 CHANGE 3: Check only for 'Done' status. Don't use the stale coorApps_AttendancePayload check here
      if (newData.TripProgress === 'Done') {
        console.log("Starting Attendance Log Upload...");

        // 💡 CHANGE 4: Use the fresh records directly returned from the modal promise resolve action
        const recordsToUpload = finalPayloadToUpload;


        // // console.log('served Date:', servedDate);
        // const finalPayload = colTemp.map(item => ({
        //   OE: formData.OE,
        //   TripKM: item.TripKM,
        //   SD: formData.SD,
        //   Date: servedDate ? new Date(servedDate).toISOString() : new Date().toISOString(),
        //   AttendanceDetail: item.TripIndex,
        //   SecondTrip: item.TripCount,
        //   Creator: userName,
        //   TCVC: formData.OE?.startsWith("SOTC") ? "TC" : "VC",
        //   In: servedDate ? new Date(servedDate).toISOString() : new Date().toISOString(),
        //   Position: item.Role,
        //   TransactionType: item.Position,
        //   EmployeeName: item.SName,
        //   hrID: getPersonnelIdByName(item.SName, item.Role)
        // })) as GSDC_AttendanceBase[];

        if (recordsToUpload.length > 0) {
          addTask({
            name: 'Uploading attendance records to Coor Apps.',
            execute: async () => {
              try {
                for (const record of recordsToUpload) {
                  console.log(`Uploading attendance for ${record.EmployeeName} with status ${record.OE}...`);

                  // 2. Sync to SQL via UpsertAttendanceLogService
                  const mappedDate = record.Date || servedDate;
                  const formattedDate = mappedDate
                    ? new Date(mappedDate).toISOString().split('T')[0]
                    : new Date().toISOString().split('T')[0];


                  const fpayload = {
                    EmployeeName: record.EmployeeName || '',
                    EmployeeID: record.hrID || '',
                    AttendanceDate: formattedDate,
                    AttendanceStatus: 'SERVED',
                    OE: record.OE || formData.OE || '',

                    TripKM: Number(record.TripKM) || 0,
                    TripIndex: Number(record.AttendanceDetail) || 0,
                    SD: record.SD || formData?.SD || '',
                    SecondTrip: ATTENDANCE_SERVED_COUNTS_INITIAL[record.SecondTrip ? Math.max(Number(record.SecondTrip), 0) : 0],
                    TransactionType: record.TransactionType || '',
                    Position: record.Position || '',
                    TCVC: record.TCVC || '',

                    ModifiedBy: editingUser?.FullName || 'Unknown User'
                  } as any;

                  const sppayload = {
                    ...record,
                    SecondTrip: ATTENDANCE_SERVED_COUNTS_INITIAL[record.SecondTrip ? Math.max(Number(record.SecondTrip), 0) : 0],
                  }

                  try {
                    // await GSDC_AttendanceService.create(sppayload);
                    console.log('uploading to sharepoint attendance: ', sppayload);
                    await ewulSharePointAPI('Communication site', 'GSDC_Attendance', 'create', undefined, sppayload);
                  } catch (error) {
                    handleLogError(error, `spattendance.served`, 'Trip - SP Attendance', sppayload);
                  }

                  try {
                    await ewulExecute('DISPATCH_APP_DMS', 'UpsertAttendanceLog', fpayload);
                  } catch (error) {
                    handleLogError(error, `attendance.served`, 'Trip - Attendance', fpayload);
                  }


                  console.log(`Successfully logged attendance for: ${record.EmployeeName}`);
                  console.log('wew att: ', fpayload);
                }
              } catch (error) {
                console.error("Failed to upload attendance records:", error);
                handleLogError(error, `attendance.served`, 'Trip - Attendance');
                return { success: false, error };
              } finally {
                console.log("Attendance log upload process completed.");
                return { success: true };
              }
            },
            checkSuccess: (result: { success: boolean }) => result.success,
            onSuccess: () => { null },
            onFailure: () => { null },
            message: `Finalizing trip attendance...`,
            message_failure: () => `Failed to sync attendance logs.`,
            message_success: () => `Attendance records synced successfully.`,
          });
        }
      }

      return { canProceed: true, attdate: attdate };
    };


    const handleUpdateTripTaskTracker = async (wouldbeformData: LiveDMSView_CEM, deleteAnyways?: boolean) => {

      const progress = wouldbeformData.TripProgress;
      if (!progress) return;

      console.log("Syncing TripTaskTracker with data progress:", wouldbeformData.TripProgress, " deleteAnyways flag:", deleteAnyways);

      const deleteIfComplete: boolean = !!((TRIP_PROGRESS ? TRIP_PROGRESS.find(p => p.Progress === progress)?.idx ?? 0 : 0) >= 2 && wouldbeformData.OE);
      const payload: UpsertTripTaskTrackerRequest = {
        OE: wouldbeformData.OE || '',
        TripProgress: progress,
        AssignedDriver: !!wouldbeformData.Driver,
        AssignedUnit: !!wouldbeformData.Vehicle,
        HasATW: !!wouldbeformData.ATW_x002f_LO_x0023_,
        HasSO: !!wouldbeformData.SO_x0023_,

        UpdateOnly: false, // always create or update the record regardless of progress for better tracking of changes

        deleteIfComplete: deleteIfComplete, // Only delete if the trip is progressing to Done (or beyond) and has a valid OE. This prevents premature deletion of the tracker record for trips that are still in progress or don't have an OE assigned yet.
        deleteAnyways: !!deleteAnyways,

        EditorName: editingUser?.FullName || 'Unknown User',

        TripJSON: JSON.stringify({
          SourceName: formData.Source,
          TripGroup: formData._tripGroup,
          CementType: formData.cementType
        })

      };

      try {


        console.log('trip task update: ', payload);

        ewulExecute('DISPATCH_APP_DMS', 'UpsertTripTaskTracker', payload as any);

      } catch (error) {
        console.error("Failed to sync TripTaskTracker:", error);
        handleLogError(error, `synctriptask`, 'Trip - Sync Trip Task', payload);
        // Optional: add a notification task to the worker here
      }
    };



    //PROGRESSING TRIP
    const [ShowOEDuplicateWarningModal, setShowOEDuplicateWarningModal] = useState(false);
    const handleTripProceed = async (progress_next: string) => {
      setIsSubmitting(true);
      let confirmedAttDate: string | undefined = undefined;
      //check for assignment changes
      const doDeselect = progress_next === 'Assigned'; // Deselect if moving back to Assigned

      if (!doDeselect && formData.TripProgress !== 'Done') {
        const { canProceed, attdate } = await checkAssignmentChanges({ ...formData, TripProgress: progress_next });
        if (!canProceed) { setIsSubmitting(false); return; } // Stop if user cancels changes
        confirmedAttDate = attdate;
      };

      let deselectAfterVerified = formData.TripProgress === 'Done' && !!formData.Completed_x0020_Date; // Deselect after verification if moving to Done


      addTask({
        id: `tripproceed-${formData.OE}-${progress_next}`, // Unique ID for this task
        name: `Updating ${formData.OE}`,
        execute: async () => {
          try {

            if (progress_next === 'Assigned') { //check if OE already exists when proceeding, return a warning if yes to prevent duplicates
              const checkResult = await ewulExecute('DISPATCH_APP_DMS', 'CheckIfOEExists', { OE: formData.OE || '' } as any);
              const table1 = checkResult as any[] | undefined;
              if (table1 && table1.length > 0) {
                if (table1[0].DoesExist) {
                  // Handle the case where the OE already exists
                  setShowOEDuplicateWarningModal(true);
                  onClearSelectedTrip?.();
                  throw new Error("OE already exists. Trip progression halted to prevent duplicates."); // Throw an error to stop the process
                }
              }
            };


            //  immediately remove the "unsaved" state
            setOriginalFormData(formData);
            handleAttachmentUpload();


            console.log(`Proceeding trip to ${progress_next}...`);
            const additionalOE = formData._tripGroup === 'Preload' || formData._tripGroup === 'Mobilization' ? await generateAdditionalOE(formData._tripGroup) : undefined;
            const tripTicketID = await generateTripTicketID(formData.OE);
            let attendanceStatus: string | undefined;
            let tripStatus: string | null | undefined;
            let driverLoader: string | undefined;
            let driverUnloader: string | undefined;
            let helperLoader: string | undefined;
            let helperUnloader: string | undefined;
            let fulltrip: string | undefined;

            switch (progress_next) {
              case 'Assigned':
                driverLoader = formData.Driver
                driverUnloader = formData.Driver
                helperLoader = formData.Helper
                helperUnloader = formData.Helper
                fulltrip = "Full Trip"
                attendanceStatus = 'ON TRIP';
                tripStatus = undefined;
                break;
              case 'Planned':
                driverLoader = undefined
                driverUnloader = undefined
                helperLoader = undefined
                helperUnloader = undefined
                fulltrip = undefined
                attendanceStatus = undefined;
                tripStatus = undefined;
                break;
              case 'Dispatched To Source':
                driverLoader = formData.Driver
                driverUnloader = formData.Driver
                helperLoader = formData.Helper
                helperUnloader = formData.Helper
                fulltrip = "Full Trip"
                attendanceStatus = 'ON TRIP';
                tripStatus = 'ITS';
                break;
              case 'Dispatched To Destination':
                attendanceStatus = 'IN TRANSIT';
                tripStatus = 'ITD';
                break;
              case 'Done':
                attendanceStatus = 'SERVED';
                tripStatus = 'Served';
                break;
              default:
                attendanceStatus = 'ON TRIP';
                tripStatus = undefined;
            }

            onClearSelectedTrip?.(); // Clear selected trip in parent to prevent stale data issues
            onProceed?.({ //update optimistically
              ...formData,
              TripProgress: progress_next,
              OE: additionalOE ? additionalOE : formData.OE,
              TripTicketID: tripTicketID || formData.TripTicketID,
            }, doDeselect);

            let updatedData: Partial<LiveDMSView_CEM> = {

              Vehicle: formData.Vehicle,
              Driver: formData.Driver,
              Helper: formData.Helper,

              ATW_x002f_LO_x0023_: formData.ATW_x002f_LO_x0023_,
              SO_x0023_: formData.SO_x0023_,
              Planning: formData.Planning,

              Trip_x0020_Status: tripStatus || formData.Trip_x0020_Status,

              Source_x0020_in: convNaive(formData.Source_x0020_in),
              Source_x0020_out: convNaive(formData.Source_x0020_out),
              Plant_x0020_DR: formData.Plant_x0020_DR,

              Destination_x0020_in: convNaive(formData.Destination_x0020_in),
              Destination_x0020_out: convNaive(formData.Destination_x0020_out),

              Driver_x0020_Loader: driverLoader || formData.Driver_x0020_Loader,
              Driver_x0020_Unloader: driverUnloader || formData.Driver_x0020_Unloader,

              Aissigned_x0020_By_x0020_OD: formData.Aissigned_x0020_By_x0020_OD,
              Loading_x0020_Sequence: formData.Loading_x0020_Sequence,


              QTYWithdrawn: formData.QTYWithdrawn,
              QTYDelivered: formData.QTYDelivered,
              Completed_x0020_Date: formData.Completed_x0020_Date,
              BO: formData.BO,


              Modified: new Date().toISOString(), // Update modified date to current time
              //LastModifiedBy: formData.LastModifiedBy,
              Helper_x0020_Loader: helperLoader || formData.Helper_x0020_Loader,
              Helper_x0020_Unloader: helperUnloader || formData.Helper_x0020_Unloader,
              Baranggay_Fee_Total: formData.Baranggay_Fee_Total,
              FlatTire_Fee_Total: formData.FlatTire_Fee_Total,
              Toll_Fee_Total: formData.Toll_Fee_Total,
              Other_Fee_Total: formData.Other_Fee_Total,
              //Documented_x0020_Date: formData.Documented_x0020_Date,
              Receive_x0020_Date: formData.Receive_x0020_Date,
              Transimtted_x0020_Date: formData.Transimtted_x0020_Date,
              QTYWithdrawn_Actual: formData.QTYWithdrawn_Actual,
              QTYDelivered_Actual: formData.QTYDelivered_Actual,
              GSDC_x0020_DR: formData.GSDC_x0020_DR,

              DriverLoaderType: fulltrip || formData.DriverLoaderType,
              HelperLoaderType: fulltrip || formData.HelperLoaderType,
              DriverUnloaderType: fulltrip || formData.DriverUnloaderType,
              HelperUnloaderType: fulltrip || formData.HelperUnloaderType,

              CIFME_OE: formData.CIFME_OE,
              CIFME_DESTINATION: formData.CIFME_DESTINATION

            } as Partial<LiveDMSView_CEM>;


            if (formData.Completed_x0020_Date) {
              updatedData.Verified_x0020_By = editingUser?.FullName || '';
              updatedData.Documented_x0020_Date = formData.Documented_x0020_Date || new Date().toISOString();
            }; // Set verifier to current user if completed date is set and verifier is not already set

            if (progress_next === 'Done' && !formData.Completed_x0020_Date) {
              updatedData.Completed_x0020_Date = new Date().toISOString(); // Set completed date to now if progressing to Done and completed date is not already set
              updatedData.ServedDate = new Date(servedDate).toISOString();
              updatedData.ServedBy = editingUser?.FullName || "";
            }




            // Create a new record

            const result = await (progress_next === 'Assigned' ? ewulCreate('DISPATCH_APP_DMS', 'DMS_CEM', {
              ...updatedData,

              Ordered_x0020_Date: additionalOE ? new Date().toDateString() : formData.Ordered_x0020_Date,
              Needed_x0020_Date: additionalOE ? new Date().toDateString() : formData.Needed_x0020_Date,
              Tagged_x0020_Date: new Date().toISOString(), // Set to current date/time when progressing
              OE: additionalOE ? additionalOE : formData.OE,
              Customer: formData.Customer,
              Source: formData.Source,
              Destination: formData.Destination,

              Trip_x0020_Status: undefined,
              Buisness_x0020_Unit: 'SBUO-1A',

              _tripGroup: formData._tripGroup,
              cementType: formData.cementType,



              TripProgress: progress_next, //next progress

              OE_x0020_Date: additionalOE ? new Date().toDateString() : formData.OE_x0020_Date,
              //MonitoredBy: formData.MonitoredBy,
              DispatchedBy: formData.DispatchedBy,

            }) : ewulUpdate('DISPATCH_APP_DMS', 'DMS_CEM', formData.ID.toString(), {
              ...updatedData,
              TripProgress: progress_next, //next progress
              Dispatched_x0020_to_x0020_Source: progress_next === 'Dispatched To Source' ? new Date().toISOString() : formData.Dispatched_x0020_to_x0020_Source,
              Dispatched_x0020_to_x0020_Destination: progress_next === 'Dispatched To Destination' ? new Date().toISOString() : formData.Dispatched_x0020_to_x0020_Destination,
            }));




            if (result.error) {
              throw new Error(result.error.message);
            }

            if (progress_next === 'Assigned' && result.data.ID) await ewulUpdate('DISPATCH_APP_DMS', 'DMS_CEM', result.data.ID.toString(), { tripID: result.data.ID });

            if (progress_next == 'Done') {
              console.log('serving trip, attendance already handled');
            } else if ((formData.TripProgress !== 'Done' || !attendanceStatus)) { // dont update attendance when trip is already done or no attendance status inputted
              handleUpdateAttendance(formData.Driver || '', driverOptions?.find(option => option.label === formData.Driver)?.record.Id, 'Driver', attendanceStatus || 'ON TRIP', false, confirmedAttDate);
              handleUpdateAttendance(formData.Helper || '', helperOptions?.find(option => option.label === formData.Helper)?.record.Id, 'Helper', attendanceStatus || 'ON TRIP', false, confirmedAttDate);
            }

            // Assuming the result contains the created record, you might want to use it
            console.log('Trip progressed successfully:', result.data);
            return { success: true, data: result.data };

          } catch (error) {
            console.error('Failed to progress trip:', error);
            handleLogError(error, `tripproceed.${progress_next}`, 'Trip - Trip Progress');
            return { success: false, error };
          }
        },
        checkSuccess: (result: { success: boolean, data?: any, error?: any }) => {
          return result.success;
        },
        onSuccess: async (result) => {
          setIsSubmitting(false);
          console.log('Trip progressed successfully:', result.data); // You can pass the new trip data back to the parent if needed

          let updatedData = {
            ...formData,
            TripProgress: progress_next,
            OE: result.data.OE || formData.OE,
            ID: result.data.ID || formData.ID,
            tripID: result.data.ID || formData.tripID,
            Trip_x0020_Status: result.data.Trip_x0020_Status || formData.Trip_x0020_Status,
          };

          logDmsUpdate({ //log trip update
            userName: editingUser?.FullName || '',
            userID: Number(editingUser?.id) || 0,
            inputOE: formData.OE || '',
            action: `Trip progress to [${progress_next}]`,
            value: progress_next,
            isRecordJSON: true,
            context: `Trip - Progressed`,
            role: editingUser?.Position || '',
          });
          onProceed?.(updatedData, doDeselect || deselectAfterVerified); //update optimistically in UI with new data from response
          onRefreshTrips?.();
          onRefreshDriverHelpers?.();
          handleUpdateTripTaskTracker({ ...formData, TripProgress: progress_next }, !!updatedData.Completed_x0020_Date);

          try {
            const assetPairingPayload = buildAssetPairingPayload(formData, driverOptions, helperOptions, truckOptions, trailerOptions, editingUser?.FullName || 'Unkown User');
            if (progress_next == 'Done') {
              ewulExecute('DISPATCH_APP_DMS', 'Upsert_DispatchedAssetPairing', { ...assetPairingPayload, Action: 'DELETE' } as any)
            } else {
              ewulExecute('DISPATCH_APP_DMS', 'Upsert_DispatchedAssetPairing', assetPairingPayload as any)
            }
          } catch (error) {
            console.error('Failed to update asset pairing:', error);
            handleLogError(error, `updatepair`, 'Trip - Update Pair');
          }



          if (progress_next === 'Done' && discrepancy < SHORT_BAGS_LIMIT && updatedData._tripGroup !== 'Mobilization') {
            setIrFormVisible(false);
            handleTripCreateIR(formData, 'COOR');
          } else if ((progress_next === 'Done' && updatedData.Completed_x0020_Date) && (actualDiscrepancy < SHORT_BAGS_LIMIT || updatedData.IRID) && updatedData._tripGroup !== 'Mobilization') {
            setIrFormVisible(false);
            handleTripCreateIR(formData, 'ODM');
          }


        },
        onFailure: () => { setIsSubmitting(false); onRefreshTrips?.(); },
        message: `${progress_next.replace('ed', 'ing')}...`,
        message_success: `Trip ${progress_next} successfully!`,
        message_failure: (result) => `Trip failed to be ${progress_next}. Reason: ${result.error?.message || 'Unknown error'}`
      });

      // handleUpdateTripTaskTracker({...formData, TripProgress: progress_next}, !!formData.Completed_x0020_Date); // Trigger a sync for the task tracker in case of any assignment changes
    };

    const handleTripSave = async () => {
      console.log('saving....');
      setIsSubmitting(true);
      //check for assignment changes
      if (formData.TripProgress !== 'Done') {
        const canProceed = await checkAssignmentChanges(formData, true); // Pass 'true' to skip generating attendance payload for 'Done' status during save
        if (!canProceed) return; // Stop if user cancels changes
      }

      let ttID: string | null | undefined = undefined;
      if (!formData.TripTicketID) {
        ttID = await generateTripTicketID(formData.OE)
      }

      console.log('saving..: ', formData);

      // If the trip hasn't been saved before, we need to create it first to get an ID for attachments

      setOriginalFormData(formData); //unsave the save state
      handleAttachmentUpload();
      addTask({
        id: `tripsave-${formData.OE}`, // Unique ID for this task
        name: `Saving trip ${formData.OE}`,
        execute: async () => {
          try {

            const result = await ewulUpdate('DISPATCH_APP_DMS', 'DMS_CEM',
              formData.ID.toString(),
              {

                Vehicle: formData.Vehicle,
                Driver: formData.Driver,
                Helper: formData.Helper,

                ATW_x002f_LO_x0023_: formData.ATW_x002f_LO_x0023_,
                SO_x0023_: formData.SO_x0023_,
                Planning: formData.Planning,

                Trip_x0020_Status: formData.Trip_x0020_Status,

                Dispatched_x0020_to_x0020_Source: formData.Dispatched_x0020_to_x0020_Source,
                Source_x0020_in: convNaive(formData.Source_x0020_in),
                Source_x0020_out: convNaive(formData.Source_x0020_out),
                Plant_x0020_DR: formData.Plant_x0020_DR,
                Dispatched_x0020_to_x0020_Destination: formData.Dispatched_x0020_to_x0020_Destination,
                Destination_x0020_in: convNaive(formData.Destination_x0020_in),
                Destination_x0020_out: convNaive(formData.Destination_x0020_out),

                Driver_x0020_Loader: formData.Driver_x0020_Loader || "",
                Driver_x0020_Unloader: formData.Driver_x0020_Unloader || "",


                Aissigned_x0020_By_x0020_OD: formData.Aissigned_x0020_By_x0020_OD,
                Loading_x0020_Sequence: formData.Loading_x0020_Sequence,


                QTYWithdrawn: formData.QTYWithdrawn,
                QTYDelivered: formData.QTYDelivered,
                Completed_x0020_Date: formData.Completed_x0020_Date,
                BO: formData.BO,


                Modified: new Date().toISOString(), // Update modified date to current time
                LastModifiedBy: formData.LastModifiedBy,
                Helper_x0020_Loader: formData.Helper_x0020_Loader || "",
                Helper_x0020_Unloader: formData.Helper_x0020_Unloader || "",
                Baranggay_Fee_Total: formData.Baranggay_Fee_Total,
                FlatTire_Fee_Total: formData.FlatTire_Fee_Total,
                Toll_Fee_Total: formData.Toll_Fee_Total,
                Other_Fee_Total: formData.Other_Fee_Total,
                //Documented_x0020_Date: formData.Documented_x0020_Date,
                Receive_x0020_Date: formData.Receive_x0020_Date,
                Transimtted_x0020_Date: formData.Transimtted_x0020_Date,
                QTYWithdrawn_Actual: formData.QTYWithdrawn_Actual,
                QTYDelivered_Actual: formData.QTYDelivered_Actual,
                //Verified_x0020_By: formData.Verified_x0020_By,
                GSDC_x0020_DR: formData.GSDC_x0020_DR,

                tripID: formData.tripID || formData.ID, // Ensure tripID is set for attachments, use existing tripID or fallback to ID if tripID is not set yet


              }
            );

            if (result.error) {
              throw new Error(result.error.message);
            }



            return { success: true, data: result.data };

          } catch (error) {
            console.error('Failed to save trip:', error);
            handleLogError(error, `tripsave.${formData.TripProgress}`, 'Trip - Trip Save');
            return { success: false, error };
          }
        },
        checkSuccess: (result: { success: boolean }) => result.success,
        onSuccess: () => {
          setIsSubmitting(false);
          onRefreshTrips?.();
          onProceed?.({ //update optimistically
            ...formData, TripTicketID: ttID || formData.TripTicketID,
          }, false);
          handleUpdateTripTaskTracker(formData, !!formData.Completed_x0020_Date); // Trigger a sync for the task tracker in case of any assignment changes
          logDmsUpdate({ //log trip update
            userName: editingUser?.FullName || '',
            userID: Number(editingUser?.id) || 0,
            inputOE: formData.OE || '',
            action: `Trip details saved`,
            value: formData.OE || '',
            isRecordJSON: true,
            context: `Trip - Saved`,
            role: editingUser?.Position || '',
          });
          try {
            const assetPairingPayload = buildAssetPairingPayload(formData, driverOptions, helperOptions, truckOptions, trailerOptions, editingUser?.FullName || 'Unkown User');
            ewulExecute('DISPATCH_APP_DMS', 'Upsert_DispatchedAssetPairing', assetPairingPayload as any);
          } catch (error) {
            console.error('Failed to update asset pairing:', error);
          }

        },
        onFailure: () => { setIsSubmitting(false); onRefreshTrips?.(); },

        message: `Saving changes for trip ${formData.OE}...`,
        message_success: `Trip ${formData.OE} saved successfully!`,
        message_failure: (result) => `Failed to save trip ${formData.OE}. Reason: ${result.error?.message || 'Unknown error'}`
      });
    };

    const [skipBroadcast, setSkipBroadcast] = useState(false);
    const [cancelRemarks, setCancelRemarks] = useState<string>("");
    const [attachedCancellationImage, setAttachedCancellationImage] = useState<{ name: string; base64: string } | null>(null);
    //@ts-ignore
    const handleCancellatioFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        // Strip the prefix (e.g. "data:image/png;base64,") to get the raw content
        const rawBase64 = base64String.split(',')[1];

        setAttachedCancellationImage({
          name: file.name,
          base64: rawBase64
        });
      };
      reader.readAsDataURL(file);
    };

    useEffect(() => {
      if (showCancelConfirmModal && cancelRemarks?.trim()) {
        setIsCancelDisabled(true);
        setCancelCountdown(3);

        const timer = setInterval(() => {
          setCancelCountdown(prev => {
            if (prev <= 1) {
              clearInterval(timer);
              setIsCancelDisabled(false);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);

        return () => clearInterval(timer);
      }
    }, [showCancelConfirmModal, cancelRemarks]);

    const [requestType, setRequestType] = useState<'CANCEL' | 'REVERT'>('CANCEL');


    //@ts-ignore
    const handleCancelTrip = (remarks?: string, broadcast?: boolean) => {
      if (!formData.ID) {
        console.log("Cannot cancel a trip that has not been saved.");
        onClose(); // Or show a message
        return;
      }

      console.log(remarks);

      addTask({
        id: `tripcancel-${formData.OE}`,
        name: `Cancelling trip ${formData.OE}`,
        execute: async () => {
          onCancelTrip?.(formData.ID); // Optimistically update the UI
          try {
            await ewulDelete('DISPATCH_APP_DMS', 'DMS_CEM', formData.ID.toString());

            ewulExecute('DISPATCH_APP_DMS', 'UpsertTripTaskTracker', { //delete task of cancelled OE
              OE: formData.OE || '',
              TripProgress: formData.TripProgress || '',
              AssignedDriver: !!formData.Driver,
              AssignedUnit: !!formData.Vehicle,
              HasATW: !!formData.ATW_x002f_LO_x0023_,
              HasSO: !!formData.SO_x0023_,
              UpdateOnly: false,
              deleteIfComplete: true, //delete
              deleteAnyways: true,
              EditorName: editingUser?.FullName || 'Unknown User',
            } as any);

            logDmsUpdate({ //log trip update
              userName: editingUser?.FullName || '',
              userID: Number(editingUser?.id) || 0,
              inputOE: formData.OE || '',
              action: `Trip Cancelled`,
              value: formData.OE || '',
              isRecordJSON: true,
              context: `Trip - Cancelled`,
              role: editingUser?.Position || '',
            });


            return { success: true };
          } catch (error) {
            console.error('Failed to cancel trip:', error);
            handleLogError(error, `tripcancel`, 'Trip - Cancel');
            return { success: false, error };
          }
        },
        checkSuccess: (result: { success: boolean }) => result.success,
        onSuccess: () => {
          onRefreshTrips?.();
          if (formData.OE) {
            handleUpdateTripTaskTracker(formData, true);
            if (broadcast) {
              handleTripAnnounce(
                `TRIP CANCELLATION`,
                `
                    <p>The trip <strong>[${formData.TripTicketID}]</strong> was cancelled and all of its dispatch data was cleared from DMS. If you did not intend this please raise a concern.</p>
                    <br>
                    <p>Reason: ${remarks}</p> 
                    ${convertFormDataToHtmlTable(formData)}
                  `
                || '',
                false,
                true,
                attachedCancellationImage?.name,
                attachedCancellationImage?.base64
              )
            };
          }
        },
        onFailure: () => { onRefreshTrips?.(); },
        message: `Cancelling trip ${formData.OE}...`,
        message_success: `Trip ${formData.OE} has been cancelled successfully.`,
        message_failure: (result) => `Failed to cancel trip ${formData.OE}. Reason: ${result.error?.message || 'Unknown error'}`
      });

    };



    const handleTripRevert = async () => {
      setIsSubmitting(true);

      console.log("Reverting trip with data:", formData);

      let ttID: string | null | undefined = undefined;
      if (!formData.TripTicketID) {
        ttID = await generateTripTicketID(formData.OE)
      }

      // If the trip hasn't been saved before, we need to create it first to get an ID for attachments

      setOriginalFormData(formData); //unsave the save state

      addTask({
        id: `triprevert-${formData.OE}-${Date.now()}`, // Unique ID for this task
        name: `Reverting trip ${formData.OE}`,
        execute: async () => {
          try {

            const result = await ewulUpdate('DISPATCH_APP_DMS', 'DMS_CEM',
              formData.ID.toString(),
              {
                Trip_x0020_Status: 'ITD',
                TripProgress: 'Dispatched To Destination',
                Completed_x0020_Date: null,
                Documented_x0020_Date: null, // Clear documented date when reverting
                Verified_x0020_By: null, // Clear verifier when reverting
              } as any
            );

            if (result.error) {
              console.log("Error reverting trip:", result.error);
              throw new Error(result.error.message);
            }

            return { success: true, data: result.data };

          } catch (error) {
            console.error('Failed to revert trip:', error);
            handleLogError(error, `triprevert`, 'Trip - Revert');
            return { success: false, error };
          }
        },
        checkSuccess: (result: { success: boolean }) => result.success,
        onSuccess: () => {
          setIsSubmitting(false);
          onRefreshTrips?.();
          onProceed?.({ //update optimistically
            ...formData, TripTicketID: ttID || formData.TripTicketID,
            Documented_x0020_Date: undefined,
            Verified_x0020_By: undefined,
          }, false);
          logDmsUpdate({ //log trip update
            userName: editingUser?.FullName || '',
            userID: Number(editingUser?.id) || 0,
            inputOE: formData.OE || '',
            action: `Trip reverted for resubmission.`,
            value: formData.OE || '',
            isRecordJSON: true,
            context: `Trip - Reverted`,
            role: editingUser?.Position || '',
          });
          handleTripAnnounce(
            'TRIP REVERSION',
            'The trip was reverted back to [Dispatch To Destination] status for Correction / Resubmission. All ASSIGNMENT changes will be made must be coordinated with the Team.',
            true
          );
        },
        onFailure: () => { setIsSubmitting(false); onRefreshTrips?.(); },

        message: `Reverting trip ${formData.OE}...`,
        message_success: `Trip ${formData.OE} reverted successfully!`,
        message_failure: (result) => `Failed to revert trip ${formData.OE}. Reason: ${result.error?.message || 'Unknown error'}`
      });
    };

    //@ts-ignore
    const handleImagePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
      const items = e.clipboardData?.items;

      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();

          if (file) {
            // 1. Generate a file name for the pasted snippet
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const fileName = `Pasted_Image_${timestamp}.png`;

            // 2. Use FileReader to convert the snippet into a base64 string
            const reader = new FileReader();
            reader.onloadend = () => {
              const result = reader.result as string;

              // Strip out the data URL prefix (e.g., "data:image/png;base64,") 
              // if your Power Automate flow expects JUST the raw base64 string.
              const base64String = result.split(',')[1] || result;

              // 3. Match your exact state signature
              setAttachedCancellationImage({
                name: fileName,
                base64: base64String
              });
            };

            reader.readAsDataURL(file);

            e.preventDefault();
            break;
          }
        }
      }
    };

    const handleTripAnnounce = async (title: string, message: string, hasDeepLink?: boolean, composeMessage?: boolean, imageName?: string, imageData?: string) => {
      const chat = 'dispapp';
      const now = Date.now();
      const appID = import.meta.env.VITE_APP_ID;
      const tenantID = import.meta.env.VITE_TENANT_ID;
      const sourceTime = now; // e.g., 1777457556546

      const liveUrl = `https://apps.powerapps.com/play/e/${appID}?tenantId=${tenantID}&sourcetime=${sourceTime}&oe=${encodeURIComponent(formData.OE || '')}`;

      const deepLink = liveUrl;

      console.log(`Broadcasting announcement for Trip [${formData.OE}]...`);

      const formatted = new Date(now).toLocaleTimeString('en-US', {
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      }).replace(' at ', ' at '); // Returns "September 17 at 5:27 AM"

      try {
        // 2. Perform the direct native fetch call
        const response = await fetch(GSDC_ANNOUNCEMENT_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chat: chat,
            messageTitle: `${title} - ${formData.OE} - ${formatted}`,
            message: message,
            messagedBy: editingUser?.FullName,
            referenceLink: hasDeepLink ? deepLink : '',
            referenceMessage: hasDeepLink ? `View Trip Details here` : '',
            imageName: imageName || '',
            imageData: imageData || '',
            compose: composeMessage || false
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        console.log(`Announcement for [${formData.OE}] successfully posted to ${chat}!`);

      } catch (error) {
        console.error(`Failed to broadcast announcement for [${formData.OE}]:`, error);
      }
    };



    const [shouldAutoSave, setShouldAutoSave] = useState(false);
    const [createdIR, setCreatedIR] = useState<OP_IncidentReports | null | undefined>(null);
    const [isCreatingIR, setIsCreatingIR] = useState<boolean>(false);
    const [irFormVisible, setIrFormVisible] = useState<boolean>(false);
    const [isExistingIR, setIsExistingIR] = useState<boolean>(false);
    const [validationIR, setValidationIR] = useState<{
      valid: boolean;
      msg: string;
      final?: boolean;
      status: 'Closed' | 'Open';
    } | null>(null);
    const handleTripCreateIR = async (currentFormData: LiveDMSView_CEM, isVerifying?: 'COOR' | 'ODM' | 'MANUAL') => {
      if (incidentFormRef.current) {
        try {
          console.log("Pre-Creating IR...");
          setIsCreatingIR(true);
          setIrFormVisible(false);


          //check if IR already exist on this OE first
          const exisistingIR = await ewulFetchAll<any>(
            OP_IncidentReportsService,
            { filter: `OE_Reference eq '${currentFormData.OE}'` },
            1,
            'IncidentID'
          );

          console.log('exisistingIR: ', exisistingIR);

          let raw_data = null

          // console.log('Existing IR: ', exisistingIR);
          if (exisistingIR?.length > 0) {
            console.log('IR Already Exist');
            raw_data = exisistingIR[0];
            setIsExistingIR(true);
          } else {
            raw_data = await incidentFormRef.current.submit();
            setIsExistingIR(false);
          }


          const employee_details = driverOptions?.find((item) => item.label === currentFormData.Driver)?.record

          let data = {
            ...raw_data,
            OE_Reference: currentFormData.OE,
            EmployeeName: currentFormData.Driver,
            EmployeeID: employee_details.Id || '',
            EmployeeBU: employee_details.BU || 'Unknown BU',
            EmployeeTractor: currentFormData.Head_Full,
            EmployeeTrailer: currentFormData.BO_Full,
            flexValue: (actualDiscrepancy || discrepancy).toString(),
          } as OP_IncidentReports

          // fill in missing details
          data.reportJSON = JSON.stringify({
            ...JSON.parse(raw_data?.reportJSON || '{}'),
            Customer: currentFormData.Customer,
            Source: currentFormData.Source,
            Destination: currentFormData.Destination,
            CementType: currentFormData.cementType,
            TripGroup: currentFormData._tripGroup,
          });

          const parsedJSON = JSON.parse(data?.reportJSON || '{}');


          console.log('current IR: ', data);

          // console.log('creating IR progress: ', prog_next, 'ver:? ', prog_verified, ' actdis?: ', actualDiscrepancy, ' disc?: ', discrepancy, ' isVerifying: ', isVerifying, 'data: ', data);

          if ((discrepancy > -5 && discrepancy < 0) && isVerifying == 'COOR') {
            // Safe JSON parse fallback


            // Properly merge actions into the parsed JSON payload
            data.reportJSON = JSON.stringify({
              ...parsedJSON,
              actions: {
                ...parsedJSON.actions,
                operations: {
                  ...parsedJSON.actions?.operations,
                  name: editingUser?.FullName || '',
                  action: 'PROCEED TO NEXT TRIP',
                  date: new Date().toISOString().slice(0, 10)
                },
              },
            });

            console.log('auto closed: ', data.reportJSON);

          }

          // WHEN VERIFIED
          if ((actualDiscrepancy < 0) && isVerifying == 'ODM') {
            // Safe JSON parse fallback


            data.reportJSON = JSON.stringify({
              ...parsedJSON,
              ActualQtyDelivered: currentFormData.QTYDelivered_Actual,
              ActualQtyWithdrawn: currentFormData.QTYWithdrawn_Actual,
              ActualShortBags: actualDiscrepancy,
              VerifiedBy: editingUser?.FullName || 'Unknown User',
              ServedBy: currentFormData.ServedBy || '',

              // Spread actions conditionally only if discrepancy < 0

              actions: {
                ...parsedJSON.actions,
                operations: {
                  ...parsedJSON.actions?.operations,
                  name: currentFormData.ServedBy || '',
                  action: 'NO REPORTED SB',
                  date: new Date().toISOString().slice(0, 10),
                },
              },

            });
          }

          console.log('Created IR:  Verifying: ', isVerifying);

          // FOR CLEANING
          if ((actualDiscrepancy === 0 && discrepancy === 0) && isVerifying == 'MANUAL') {
            // Safe JSON parse fallback

            data.reportJSON = JSON.stringify({
              ...parsedJSON,
              ActualQtyDelivered: currentFormData.QTYDelivered_Actual,
              ActualQtyWithdrawn: currentFormData.QTYWithdrawn_Actual,
              ActualShortBags: actualDiscrepancy,
              VerifiedBy: editingUser?.FullName || 'Unknown User',
              ServedBy: currentFormData.ServedBy || '',

              // Spread actions conditionally only if discrepancy < 0

              actions: {
                ...parsedJSON.actions,
                operations: {
                  ...parsedJSON.actions?.operations,
                  name: editingUser?.FullName || '',
                  action: 'FOR CLEANING',
                  date: new Date().toISOString().slice(0, 10),
                },
              },

            });
          }






          console.log('Created IR: ', JSON.parse(data.reportJSON || ''));

          setCreatedIR(data);


          // setShowIncidentPrompt(true);
          setIsIncidentModalOpen(true);
          setIsCreatingIR(false);

          setShowIncidentPrompt(false);
          setIrFormVisible(true);

          setShouldAutoSave(true);

          // irShortBagsForm.current?.validate();
          // const wew = await irShortBagsForm?.current?.save()
          // console.log('saved wew: ', wew)




        } catch (e) {
          setIsIncidentModalOpen(false);
          setCreatedIR(null);
          console.error(e);
        } finally {
          setIsCreatingIR(false); // Turn off loading spinner regardless of success/fail
          handleTripAnnounce(
            'TRIP INCIDENT REPORT',
            `
              <p>A [Short-Bags] Incident report has been created for trip <strong>[${currentFormData.OE}]</strong> with the following details:</p>
              <br />
              <ul style="list-style-type: none; padding-left: 0; margin: 0; font-family: sans-serif; line-height: 1.6;">
                <li style="margin-bottom: 6px;">
                  <strong>OE:</strong> ${currentFormData.OE || '---'}
                </li>
                <li style="margin-bottom: 6px;">
                  <strong>Employee:</strong> ${currentFormData.Driver || '---'}
                </li>
                <li style="margin-bottom: 6px;">
                  <strong>Unit:</strong> ${currentFormData.Vehicle || '---'} / ${currentFormData.BO || '---'}
                </li>
                <li style="margin-bottom: 6px;">
                  <strong>Short-Bags:</strong> ${actualDiscrepancy || discrepancy || '0'}
                </li>
              </ul>
              <br>
              <em>Note: Units involved on an active IR will not be available for dispatch. Please process and complete the IR first to prevent delay on operations.</em>
            `,
            true,
            true
          );
        }
      }
    };

    useEffect(() => {
      if (shouldAutoSave && irShortBagsForm.current) {
        setShouldAutoSave(false); // Reset flag so it only runs once

        irShortBagsForm.current.validate();
        irShortBagsForm.current.save().then((wew) => {
          console.log('[AUTOSAVED] IR SB: ', wew);
        });
      }
    }, [shouldAutoSave]);

    const [isConfirmIRCloseOpen, setIsConfirmIRCloseOpen] = useState<boolean>(false);

    // This function now just raises our secondary modal instead of halting thread execution
    const handleConfirmIRClose = (skip?: boolean) => {
      if (skip) {
        setIsConfirmIRCloseOpen(false);
        setIsIncidentModalOpen(false);
        setIrFormVisible(false);
        setShowIncidentPrompt(false);
        setCreatedIR(null);
        return;
      }
      setIsConfirmIRCloseOpen(true);
    };

    // This function handles the absolute wipeout execution when they confirm "Yes"
    const handleForceDiscardIR = async () => {
      if (irShortBagsForm.current?.save) {
        //@ts-ignore
        const raw_data = await irShortBagsForm.current.save();
        // console.log('forced saved: ', raw_data);
      }
      setIsConfirmIRCloseOpen(false);
      setCreatedIR(null);
      setIsIncidentModalOpen(false);
      setIrFormVisible(false);
    };

    const handleForceCloseIR = () => {
      setIsConfirmIRCloseOpen(false);
      setCreatedIR(null);
      setIsIncidentModalOpen(false);
      setIrFormVisible(false);
    };

    const handleDeleteIR = () => {
      setIsConfirmIRCloseOpen(false);
      setIsIncidentModalOpen(false);
      setIrFormVisible(false);
      setShowIncidentPrompt(false);
      setCreatedIR(null);
    }




    const plantDrAttachmentRef = useRef<CustomFileAttachmentRef>(null);
    const wsAttachmentRef = useRef<CustomFileAttachmentRef>(null);

    const handleAttachmentUpload = () => {
      const plantDrFiles = plantDrAttachmentRef.current?.getFilesToUpload() || [];
      const wsFiles = wsAttachmentRef.current?.getFilesToUpload() || [];

      // Only proceed if there are files to upload
      if (plantDrFiles.length === 0 && wsFiles.length === 0) {
        console.log("No new attachments to upload.");
        return;
      }

      addTask({
        id: `uploadAttachments-${formData.OE}`, // Unique ID for this task
        name: `Uploading Attachments for ${formData.OE}`,
        execute: async () => {
          console.log("Uploading attachments...");

          const toBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
              const result = reader.result as string;
              const base64String = result.split(',')[1];
              resolve(base64String);
            };
            reader.onerror = error => reject(error);
          });


          const uploadAttachments = async (files: File[], type: 'PLANT DR' | 'WS', itemID: string | undefined) => {
            if (files.length === 0) {
              return { success: true, type, message: `No new ${type} files to upload.` };
            }

            try {
              const fileContents = await Promise.all(
                files.map(async (file) => ({
                  name: file.name,
                  contentBytes: await toBase64(file),
                }))
              );

              const body = {
                siteAddress: "https://gsdcph.sharepoint.com/sites/ProjectsDevelopments",
                ListName: "DMS_Attachments",
                ListItemID: itemID || null, // This should be the ID of an existing attachment item if updating, or empty for new
                itemRecord: {
                  dmsID: formData.tripID,
                  attachment_type: type,
                  Filename: `${formData.OE}_${type.replace(' ', '_')}`,
                  UserUploaded: editingUser?.FullName || ''
                },
                FileContent: fileContents,
              };

              console.log(`Sending POST request for ${type} with body:`, body);

              const response = await fetch(UPLOAD_ATTACHMENTS_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
              });

              const responseData = await response.json();
              console.log(`Response for ${type} upload:`, responseData);

              if (response.ok && responseData.statusCode === "200") {
                console.log(`Upload successful for ${type}:`, responseData);
                return { success: true, type, data: responseData };
              } else {
                const errorText = responseData.body || `HTTP error! status: ${response.status}`;
                throw new Error(errorText);
              }

            } catch (error) {
              console.error(`Error during ${type} upload:`, error);
              return { success: false, type, error };
            }
          };

          const uploadPromises = [];
          if (plantDrFiles.length > 0) {
            uploadPromises.push(uploadAttachments(plantDrFiles, 'PLANT DR', plantDrAttachmentItemID));
          }
          if (wsFiles.length > 0) {
            uploadPromises.push(uploadAttachments(wsFiles, 'WS', wsAttachmentItemID));
          }

          try {
            const results = await Promise.all(uploadPromises);

            const failures = results.filter(r => !r.success);

            if (failures.length > 0) {
              const errorMessages = failures.map(f => `${f.type}: ${f.error || 'Unknown error'}`).join('\n');
              throw new Error(`Some uploads failed:\n${errorMessages}`);
            }

            return { success: true, data: results };

          } catch (error) {
            console.error("An error occurred during the upload process:", error);
            handleLogError(error, `attachment.upload`, 'Trip - Attachment', { ...plantDrFiles, ...wsFiles });
            throw error;
          }
        },
        checkSuccess: (result: { success: boolean, data?: any[] }) => {
          if (!result.success) return false;
          // Ensure every result in the data array also indicates success
          return result.data?.every(res => res.success) ?? false;
        },
        onSuccess: () => {
          fetchAttachments(formData.tripID || formData.ID || 0, formData); // Refresh attachments on success
        },
        message: `Uploading attachments for trip ${formData.OE}...`,
        message_success: `Attachments for ${formData.OE} uploaded successfully!`,
        message_failure: (result) => {
          return `Attachment upload failed. Reason: ${result.error?.message || 'Unknown error'}`;
        }
      });
    };

    const handleOnClose = () => {
      if (hasUnsavedChanges) {
        setShowUnsavedChangesModal(true);
      } else {
        onClose();
      }
    };

    const handleViewTripHistory = async (OE: string) => {
      setTimelineSelectedOE(OE);
      setIsTimelineOpen(true);
      setIsLoadingLogs(true);

      try {
        const result = await ewulFetchAll<any>(
          Action_Logs_HistoryService,
          { filter: `OE eq '${OE}' or tripID eq '${formData.tripID}'` },
          500,
          'ID'
        );

        setTripLogs(result); // Use real data when available, fallback to sample data
      } catch (error) {
        console.error("Failed to fetch trip logs:", error);
        handleLogError(error, `actionlogsview`, 'Trip - Action Logs', { filter: `OE eq '${OE}' or tripID eq '${formData.tripID}'` });
      } finally {
        setIsLoadingLogs(false);
      }
    };

    const getPersonnelIdByName = (name: string, role: string) => {
      if (!driverHelperList) return null;

      const person = driverHelperList.find(p => p.FullName === name && p.Position === role);
      return person?.Id || null;
    };

    const getOrdinalServedCount = (n: number): string => {
      const s = ["th", "st", "nd", "rd"];
      const v = n % 100;
      return n + (s[(v - 20) % 10] || s[v] || s[0]);
    };

    const [isFetchingServedCounts, setIsFetchingServedCounts] = useState<boolean>(false);
    const fetchServedCounts = async (names: string[], date: any) => {
      setIsFetchingServedCounts(true);
      let table1 = [];
      try {
        const result = await ewulExecute('DISPATCH_APP_DMS', 'GetEmployeeServedCount', {
          EmployeeNames: names.join('|'),
          TargetDate: new Date(date).toISOString().split('T')[0],
        } as any);

        const table = result as any[];
        if (table && table.length > 0) {
          table1 = table
        }
      } catch (e) {
        console.log('Failed to fetch served counts: ', e)
      } finally {
        setIsFetchingServedCounts(false);
      }
      return table1;
    }

    const generateAttendancePayload = async (formData: LiveDMSView_CEM, userName: string): Promise<GSDC_AttendanceBase[]> => {
      console.log('SD :', formData.SD);
      const colTemp: any[] = [];
      const tripKM = Number(formData.TripKM || 0);
      const tripIndex = Number(formData.TripIndex || 0);

      const getTypeMultipliers = (typeName: string | null | undefined, fallback: number) => {
        const selected = LOADER_TYPE_OPTIONS.find(option => option.value === typeName);
        const kmMult = selected?.record?.kmMult;
        const tiMult = selected?.record?.tiMult;

        return {
          kmMult: typeof kmMult === 'number' ? kmMult : fallback,
          tiMult: typeof tiMult === 'number' ? tiMult : fallback,
        };
      };

      const notNA = (value: any) => { //return value if not null, undefined, N/A or empty string, else return null
        const isNA = value === 'N/A'
        return isNA ? null : value;
      };

      // RESOLVE VALUES (Mirroring the 'With' block)
      const drvU = (notNA(formData.Driver_x0020_Unloader) || "").trim();
      const drvL = (notNA(formData.Driver_x0020_Loader) || "").trim();
      const drv = (formData.Driver || "").trim();

      const hlpU = (notNA(formData.Helper_x0020_Unloader) || "").trim();
      const hlpL = (notNA(formData.Helper_x0020_Loader) || "").trim();
      const hlp = (formData.Helper || "").trim();

      // Extract and compile all distinct names configured for this trip payload
      const rawNamesList = [drvU, drvL, drv, hlpU, hlpL, hlp].filter(name => name.length > 0);
      const uniqueNames = Array.from(new Set(rawNamesList));

      // BATCH FETCH EXECUTION
      const activeServedCounts = await fetchServedCounts(uniqueNames, servedDate);

      // Helper function to push to our temp collection
      const addToTemp = (
        role: "Driver" | "Helper",
        name: string,
        pos: string,
        multipliers: { kmMult: number; tiMult: number }
      ) => {
        if (!name) return;

        //Cross reference the batch dataset using the columns returned by your SQL view (Name / Count)
        const servedCountsRecord = activeServedCounts?.find(
          (att: any) => (att.Name || att.EmployeeName) === name
        );

        colTemp.push({
          Role: role,
          SName: name,
          Position: pos === 'Full Trip' ? '' : pos,
          TripKM: Math.round(tripKM * multipliers.kmMult * 100) / 100,
          TripIndex: tripIndex * multipliers.tiMult,
          // Map the view's item counter value; fall back to 0 if they haven't run previous log dispatches
          TripCount: servedCountsRecord ? Number(servedCountsRecord.Count || servedCountsRecord.TotalServedDates || 0) : 0,
        });
      };

      let tobeAddedtoTemps: { role: "Driver" | "Helper"; name: string; type: string; mult: { kmMult: number; tiMult: number } }[] = [];
      tobeAddedtoTemps.push({ role: "Driver", name: drvL, type: formData.DriverLoaderType || "", mult: getTypeMultipliers(formData.DriverLoaderType, 0.25) });
      tobeAddedtoTemps.push({ role: "Driver", name: drvU, type: formData.DriverUnloaderType || "", mult: getTypeMultipliers(formData.DriverUnloaderType, 0.75) });
      tobeAddedtoTemps.push({ role: "Helper", name: hlpL, type: formData.HelperLoaderType || "", mult: getTypeMultipliers(formData.HelperLoaderType, 0.25) });
      tobeAddedtoTemps.push({ role: "Helper", name: hlpU, type: formData.HelperUnloaderType || "", mult: getTypeMultipliers(formData.HelperUnloaderType, 0.75) });

      const uniqueToBeAdded = [
        ...new Map(tobeAddedtoTemps.map(item => [item.name, item])).values()
      ];

      uniqueToBeAdded.forEach(item => {
        if (item.name) {
          addToTemp(item.role, item.name, item.type, item.mult);
        }
      });

      // console.log("helper loader:", notNA(formData.Helper_x0020_Loader), " credit:", {role: "Helper", name: hlpL, type: formData.HelperLoaderType || "", mult: getTypeMultipliers(formData.HelperLoaderType, 0.25)})

      // // DRIVER COLLECTION
      // if (drvU && drvL) {
      //     if (drvU === drvL) {
      //       addToTemp("Driver", drvU, "", { kmMult: 1, tiMult: 1 });
      //     } else {
      //       const driverUnloaderType = formData.DriverUnloaderType || 'Long Trip Unloader';
      //       const driverLoaderType = formData.DriverLoaderType || 'Loader Only';
      //       addToTemp("Driver", drvU, driverUnloaderType, getTypeMultipliers(formData.DriverUnloaderType, 0.75));
      //       addToTemp("Driver", drvL, driverLoaderType, getTypeMultipliers(formData.DriverLoaderType, 0.25));
      //     }
      // } else if (!drvU && drvL) {
      //     addToTemp("Driver", drvL, "", { kmMult: 1, tiMult: 1 });
      // } else if (drvU && !drvL) {
      //     addToTemp("Driver", drvU, "", { kmMult: 1, tiMult: 1 });
      // } else if (drv) {
      //     addToTemp("Driver", drv, "", { kmMult: 1, tiMult: 1 });
      // }

      // // HELPER COLLECTION
      // if (hlpU && hlpL) {
      //     if (hlpU === hlpL) {
      //       addToTemp("Helper", hlpU, "", { kmMult: 1, tiMult: 1 });
      //     } else {
      //       console.log('Hey!');
      //       const helperUnloaderType = formData.HelperUnloaderType || 'Long Trip Unloader';
      //       const helperLoaderType = formData.HelperLoaderType || 'Loader Only';
      //       addToTemp("Helper", hlpU, helperUnloaderType, getTypeMultipliers(formData.HelperUnloaderType, 0.75));
      //       addToTemp("Helper", hlpL, helperLoaderType, getTypeMultipliers(formData.HelperLoaderType, 0.25));
      //     }
      // } else if (!hlpU && hlpL) {
      //     addToTemp("Helper", hlpL, "", { kmMult: 1, tiMult: 1 });
      // } else if (hlpU && !hlpL) {
      //     addToTemp("Helper", hlpU, "", { kmMult: 1, tiMult: 1 });
      // } else if (hlp) {
      //     addToTemp("Helper", hlp, "", { kmMult: 1, tiMult: 1 });
      // }

      // console.log('served Date:', servedDate);
      const finalPayload = colTemp.map(item => ({
        OE: formData.OE,
        TripKM: item.TripKM,
        SD: formData.SD,
        Date: servedDate ? new Date(servedDate).toISOString() : new Date().toISOString(),
        AttendanceDetail: item.TripIndex,
        SecondTrip: item.TripCount,
        Creator: userName,
        TCVC: formData.OE?.startsWith("SOTC") ? "TC" : "VC",
        In: servedDate ? new Date(servedDate).toISOString() : new Date().toISOString(),
        Position: item.Role,
        TransactionType: item.Position,
        EmployeeName: item.SName,
        hrID: getPersonnelIdByName(item.SName, item.Role)
      })) as GSDC_AttendanceBase[];

      //test:
      // console.log("--- GENERATED ATTENDANCE PAYLOAD ---");
      // console.log(finalPayload); // Renders as an easily readable tabular grid sheet

      return finalPayload;

    };


    const handleLogError = (error: unknown, action: string, context: string, jsonDetails?: any) => {

      const err: DebugLogParams = {
        contextType: context,
        user: editingUser?.FullName,
        nav: `ordrdistform.${action}`,
        error: error,
        details: jsonDetails ? jsonDetails : formData as any,
        tripOE: formData.OE,
      }
      logDebug(err);


    }


    const handleUpdateAttendance = (
      name: string,
      empId: string,
      empType: string,
      attendance?: string,
      refresh?: boolean,
      attdate?: string,


      //coor app details
      tripKM?: number,
      SD?: string,
      secondTrip?: number,
      tripIndex?: number, //attendanceDetail
      TransactionType?: string,
      Position?: string,
      TCVC?: string,
    ) => {

      onUpdateDriverHelperAttendance?.(name, attendance || 'PRESENT', empType as 'Driver' | 'Helper');

      addTask({
        id: `attendance-update-${name}`,
        name: `Employee Attendance Update`,
        execute: async () => {

          const upsertAtt = {
            EmployeeName: name,
            EmployeeID: empId,
            AttendanceDate: attdate ? new Date(attdate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            AttendanceStatus: attendance || 'PRESENT',
            OE: formData.OE || '',

            tripKM: tripKM,
            SD: SD,
            SecondTrip: secondTrip,
            AttendanceDetail: tripIndex,
            TransactionType: TransactionType,
            Position: Position,
            TCVC: TCVC,

            ModifiedBy: editingUser?.FullName

          };

          try {


            ewulExecute('DISPATCH_APP_DMS', 'UpsertAttendanceLog', upsertAtt as any);

            return { success: true };
          } catch (error) {
            console.error("Fetch error:", error);
            handleLogError(error, `attendance.${attendance}`, 'Trip - Attendance', upsertAtt);
            return { success: false, error };
          }



        },
        checkSuccess: (result: { success: boolean }) => result.success,
        onSuccess: () => {
          if (refresh) onRefreshTrips?.();

          logDmsUpdate({
            userName: editingUser?.FullName || '',
            userID: Number(editingUser?.id) || 0,
            inputOE: formData.OE || '',
            action: `Set Attendance of ${name} to [${attendance || 'PRESENT'}]`,
            value: attendance || 'PRESENT',
            isRecordJSON: false,
            context: `Attendance`,
            role: editingUser?.Position || '',
          });

        },
        onFailure: () => { empType === 'Driver' ? handleFieldChange('Driver', '') : handleFieldChange('Helper', ''); onUpdateDriverHelperAttendance?.(name, attendance || 'ABSENT', empType as 'Driver' | 'Helper'); },
        message: `Setting attendance for ${name}...`,
        message_success: `${name} tagged '${attendance || 'PRESENT'}' successfully!`,
        message_failure: `${name} failed to be tagged '${attendance || 'PRESENT'}'.`
      });
    };

    useEffect(() => {
      // Only trigger recalculation if the modal is actively open and has an existing payload layout
      if (showAssignmentConfirmModal && assignmentChanges?.attendancePayload) {

        const recalculateAttendanceCount = async () => {
          try {
            console.log("Served Date changed! Recalculating attendance metrics for:", servedDate.toDateString());


            // 2. Await the new async batch count payload execution sequence
            const freshPayload = await generateAttendancePayload(formData, editingUser?.FullName || '');

            // 3. Update the modal's state object tree layout with the updated counts
            setAssignmentChanges(prev => prev ? {
              ...prev,
              attendancePayload: freshPayload
            } : null);

          } catch (error) {
            console.error("Failed to recalculate served count allocations:", error);
            handleLogError(error, `attendance.count`, 'Trip - Attendance Count');
          }
        };

        recalculateAttendanceCount();
      }
    }, [servedDate, showAssignmentConfirmModal])





    const handlePrintDMS = () => {

      if (!formData.tripID) {
        console.log("No trip selected, cannot print DMS.");
        return;
      }

      const filename = `DMS_${formData.OE || 'UnknownOE'}_${editingUser?.FullName || 'UnknownUser'}_${new Date().toISOString()}`;
      const feeTotal = ((formData.FlatTire_Fee_Total || 0) + (formData.Toll_Fee_Total || 0) + (formData.Baranggay_Fee_Total || 0) + (formData.Other_Fee_Total || 0));
      const withdrawn = formData.QTYWithdrawn !== undefined && formData.QTYWithdrawn <= 0 ? null : formData.QTYWithdrawn?.toString() || null;
      const delivered = formData.QTYDelivered !== undefined && formData.QTYDelivered <= 0 ? null : formData.QTYDelivered?.toString() || null;
      const actualWithdrawn = formData.QTYWithdrawn_Actual !== undefined && formData.QTYWithdrawn_Actual <= 0 ? null : formData.QTYWithdrawn_Actual?.toString() || null;
      const actualDelivered = formData.QTYDelivered_Actual !== undefined && formData.QTYDelivered_Actual <= 0 ? null : formData.QTYDelivered_Actual?.toString() || null;

      addTask({
        name: `Generating DMS for ${formData.OE}`,
        execute: async () => {
          try {

            // // Console log all relevant raw date fields BEFORE forming payload
            // console.group("🔍 DMS Date Fields Debugger");
            // console.log("Ordered_x0020_Date:", formData.Ordered_x0020_Date);
            // console.log("Needed_x0020_Date:", formData.Needed_x0020_Date);
            // console.log("Tagged_x0020_Date:", formData.Tagged_x0020_Date);
            // console.log("Dispatched_x0020_to_x0020_Source:", formData.Dispatched_x0020_to_x0020_Source);
            // console.log("Source_x0020_in:", formData.Source_x0020_in);
            // console.log("Source_x0020_out:", formData.Source_x0020_out);
            // console.log("Dispatched_x0020_to_x0020_Destination:", formData.Dispatched_x0020_to_x0020_Destination);
            // console.log("Destination_x0020_in:", formData.Destination_x0020_in);
            // console.log("Destination_x0020_out:", formData.Destination_x0020_out);
            // console.log("Receive_x0020_Date:", formData.Receive_x0020_Date);
            // console.log("Documented_x0020_Date:", formData.Documented_x0020_Date);
            // console.log("Transimtted_x0020_Date:", formData.Transimtted_x0020_Date);
            // console.groupEnd();

            // Helper to safely parse dates regardless of format ('2026-09-30' or '2026-09-30T07:10:55Z')
            const toISODate = (val: string | null | undefined): string | null => {
              if (!val) return null;
              const date = new Date(val);
              return isNaN(date.getTime()) ? null : date.toISOString().split('T')[0];
            };

            //@ts-ignore
            const toTimeString = (val: string | null | undefined): string | null => {
              if (!val) return null;
              const date = new Date(val);
              return isNaN(date.getTime()) ? null : date.toLocaleTimeString();
            };

            const payload = {
              filename: filename,
              trip_ticket: formData.TripTicketID || null,
              issued_date: new Date().toISOString().split('T')[0],
              oe_reference: formData.OE || null,
              // order_date: formData.Ordered_x0020_Date ? new Date(formData.Ordered_x0020_Date.slice(0, -1)).toISOString().split('T')[0] : null,
              // need_date: formData.Needed_x0020_Date ? new Date(formData.Needed_x0020_Date.slice(0, -1)).toISOString().split('T')[0] : null,
              order_date: toISODate(formData.Ordered_x0020_Date),
              need_date: toISODate(formData.Needed_x0020_Date),
              dispatch_site: 'GSDC', // This might need to be dynamic
              issuer: editingUser?.FullName || null,
              business_unit: formData.Buisness_x0020_Unit || null,
              assigned_date: formData.Tagged_x0020_Date ? new Date(formData.Tagged_x0020_Date.slice(0, -1)).toISOString().split('T')[0] : null,
              assigned_time: formData.Tagged_x0020_Date ? new Date(formData.Tagged_x0020_Date.slice(0, -1)).toLocaleTimeString() : null,
              driver_name: formData.Driver || null,
              helper_name: formData.Helper || null,
              truck: formData.Vehicle || null,
              trailer: formData.BO || null,
              source_name: formData.Source || null,
              so_number: formData.SO_x0023_ || null,
              atw_number: formData.ATW_x002f_LO_x0023_ || null,
              destination_name: formData.Destination || null,
              gsdc_dr: formData.GSDC_x0020_DR || null,
              plant_dr: formData.Plant_x0020_DR || null,
              istrading: formData._tripGroup === 'Trading',
              ishauling: formData._tripGroup === 'Hauling',
              isothers: !['Trading', 'Hauling'].includes(formData._tripGroup || ''),
              driver_loader: formData.Driver_x0020_Loader?.trim() || null,
              helper_loader: formData.Helper_x0020_Loader?.trim() || null,
              dispsrc_date: formData.Dispatched_x0020_to_x0020_Source ? new Date(formData.Dispatched_x0020_to_x0020_Source.slice(0, -1)).toISOString().split('T')[0] : '',
              dispsrc_time: formData.Dispatched_x0020_to_x0020_Source ? new Date(formData.Dispatched_x0020_to_x0020_Source.slice(0, -1)).toLocaleTimeString() : '',
              dispsrc_arrival_date: formData.Source_x0020_in ? new Date(formData.Source_x0020_in.slice(0, -1)).toISOString().split('T')[0] : null,
              dispsrc_arrival_time: formData.Source_x0020_in ? new Date(formData.Source_x0020_in.slice(0, -1)).toLocaleTimeString() : null,
              dispsrc_departure_date: formData.Source_x0020_out ? new Date(formData.Source_x0020_out.slice(0, -1)).toISOString().split('T')[0] : null,
              dispsrc_departure_time: formData.Source_x0020_out ? new Date(formData.Source_x0020_out.slice(0, -1)).toLocaleTimeString() : null,
              qty_withdrawn: actualWithdrawn ? actualWithdrawn : withdrawn,
              driver_unloader: formData.Driver_x0020_Unloader?.trim() || null,
              helper_unloader: formData.Helper_x0020_Unloader?.trim() || null,
              dispdst_date: formData.Dispatched_x0020_to_x0020_Destination ? new Date(formData.Dispatched_x0020_to_x0020_Destination.slice(0, -1)).toISOString().split('T')[0] : null,
              dispdst_time: formData.Dispatched_x0020_to_x0020_Destination ? new Date(formData.Dispatched_x0020_to_x0020_Destination.slice(0, -1)).toLocaleTimeString() : null,
              dispdst_arrival_date: formData.Destination_x0020_in ? new Date(formData.Destination_x0020_in.slice(0, -1)).toISOString().split('T')[0] : null,
              dispdst_arrival_time: formData.Destination_x0020_in ? new Date(formData.Destination_x0020_in.slice(0, -1)).toLocaleTimeString() : null,
              dispdst_departure_date: formData.Destination_x0020_out ? new Date(formData.Destination_x0020_out.slice(0, -1)).toISOString().split('T')[0] : null,
              dispdst_departure_time: formData.Destination_x0020_out ? new Date(formData.Destination_x0020_out.slice(0, -1)).toLocaleTimeString() : null,
              qty_delivered: actualDelivered ? actualDelivered : delivered,
              fee_flattire: formData.FlatTire_Fee_Total !== undefined && formData.FlatTire_Fee_Total <= 0 ? null : formData.FlatTire_Fee_Total?.toString() || null,
              fee_tollgate: formData.Toll_Fee_Total !== undefined && formData.Toll_Fee_Total <= 0 ? null : formData.Toll_Fee_Total?.toString() || null,
              fee_barangay: formData.Baranggay_Fee_Total !== undefined && formData.Baranggay_Fee_Total <= 0 ? null : formData.Baranggay_Fee_Total?.toString() || null,
              fee_others: formData.Other_Fee_Total !== undefined && formData.Other_Fee_Total <= 0 ? null : formData.Other_Fee_Total?.toString() || null,
              fee_total: feeTotal <= 0 ? null : feeTotal.toString(),
              date_received: formData.Receive_x0020_Date ? new Date(formData.Receive_x0020_Date.slice(0, -1)).toISOString().split('T')[0] : null,
              date_deocumented: formData.Documented_x0020_Date ? new Date(formData.Documented_x0020_Date.slice(0, -1)).toISOString().split('T')[0] : null,
              date_transmitted: formData.Transimtted_x0020_Date ? new Date(formData.Transimtted_x0020_Date.slice(0, -1)).toISOString().split('T')[0] : null,
              verified_by: formData.Verified_x0020_By || null,
              qty_discrepancy: actualWithdrawn ? (Number(actualWithdrawn) - Number(actualDelivered)) : (formData.QTYWithdrawn !== undefined && formData.QTYDelivered !== undefined ? (Number(formData.QTYWithdrawn) - Number(formData.QTYDelivered)) : null),
            };

            console.log('to be printed: ', payload)

            const response = await fetch(PRINT_DMS_ENDPOINT, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            });

            console.log(response);

            if (!response.ok) {
              const errorText = await response.text();
              throw new Error(`Failed to generate DMS PDF: ${errorText}`);
            }

            const responseData = await response.json();
            const fileUrl = responseData.fileurl;

            if (fileUrl) {
              // window.open(fileUrl, '_blank'); // We'll do this in onSuccess
            } else {
              throw new Error("No file URL found in the response.");
            }

            return { success: true, fileUrl: fileUrl };

          } catch (error) {
            console.error('Failed to print DMS:', error);
            handleLogError(error, `printdms`, 'Trip - Print DMS');
            return { success: false, error };
          }
        },
        onSuccess: (result) => {
          if (result.fileUrl) {
            window.open(result.fileUrl, '_blank');
          }
        },
        onClick: (result) => {
          if (result.fileUrl) {
            console.log("Re-opening DMS from notification for trip:", formData.OE);
            window.open(result.fileUrl, '_blank');
          }
        },
        checkSuccess: (result: { success: boolean, fileUrl?: string }) => result.success,
        message: `Filling up trip details on DMS report ${formData.OE}...`,
        message_success: `DMS for ${formData.OE} generated successfully! Click here to download again.`,
        message_failure: (result) => `Failed to generate DMS. Reason: ${result.error?.message || 'Unknown error'}`
      });
    };

    const handleCannotChangeTrip = () => {
      let message = '';
      if (!canChangeTrip) message = `This trip cannot be ${(progress_idx() > 2 ? 'Divert' : 'Change').replace('e', '').toLowerCase()}ed or canceled because there is an on going fuel request associated with it. Please resolve the fuel request before making changes to the trip.`;
      else message = `This trip cannot be ${(progress_idx() > 2 ? 'Divert' : 'Change').replace('e', '').toLowerCase()}ed or canceled because it has not been assigned a Trip ID yet. Please try again after the trip has been assigned.`;
      setShowCannotChangeTripModal({ isOpen: true, message, what: progress_idx() > 2 ? 'Divert' : 'Change' });
    };

    const handleShareClick = (oe: string) => {
      setShareOE(oe);
      setShowShareModal(true);
    };

    const handleConfirmProcessIR = async (irid: string) => {

      console.log("Fetching incident reports with id:", irid);


      if (incidentFormRef.current) {
        try {
          console.log("Pre-Creating IR...");
          setIsCreatingIR(true);
          setIrFormVisible(false);



          //check if IR already exist on this OE first
          const exisistingIR = await ewulFetchAll<any>(
            OP_IncidentReportsService,
            { filter: `IRID eq '${irid}'` },
            1,
            'IncidentID'
          );

          console.log('exisistingIR: ', exisistingIR);

          let raw_data = null

          if (exisistingIR?.length > 0) {
            raw_data = exisistingIR[0];
            setIsExistingIR(true);
          } else {
            //throw an error
          }



          let data = raw_data as OP_IncidentReports






          console.log('Created IR: ', JSON.parse(data.reportJSON || ''));

          setCreatedIR(data);


          setShowIncidentPrompt(true);
          setIsIncidentModalOpen(true);
          setIsCreatingIR(false);


        } catch (e) {
          setIsIncidentModalOpen(false);
          setCreatedIR(null);
          console.error(e);
        } finally {
          setIsCreatingIR(false); // Turn off loading spinner regardless of success/fail
        }
      }
    };

    const handleUpdateTruckTrailerIRdetails = (createdIR: any) => {
      console.log('updating truck/trailer ir details: ', createdIR);
      try {
        const truckItem = truckOptions?.find((item: any) => item.Head === createdIR?.EmployeeTractor);
        const trailerItem = trailerOptions?.find((item: any) => item.PairedTrailer === createdIR?.EmployeeTrailer);
        if (onUpdateTruckTrailers) {
          if (truckItem) {
            onUpdateTruckTrailers(
              { ...truckItem.record, TractorIRID: createdIR.IRStatus === 'Open' ? createdIR?.IRID : null }
            );
          };
          if (trailerItem && truckItem?.record.Head !== trailerItem.record.Head) {
            onUpdateTruckTrailers(
              { ...trailerItem.record, TractorIRID: createdIR.IRStatus === 'Open' ? createdIR?.IRID : null }
            );
          };
        }
      } catch (e) {
        console.log('failed to update truck/trailer ir details: ', e);
      }
    };


    const getProgIdxByProgress = (progress: string) => {
      return TRIP_PROGRESS.find(p => p.Progress === progress)?.idx ?? 0;
    };


    const disabledDstGrp = prog_verified || prog_idx < getProgIdxByProgress("Dispatched To Destination") || !validateOE(formData).isValid || isReadOnly;
    const disabledSrcGrp = prog_verified || prog_idx < getProgIdxByProgress("Dispatched To Source") || !validateOE(formData).isValid || isReadOnly;
    const disabledAssGrp = prog_verified || prog_idx < getProgIdxByProgress("Assigned") || !validateOE(formData).isValid || isReadOnly;
    const disabledOEDetGrp = prog_verified || !validateOE(formData).isValid || isReadOnly;
    const disabledOEEntGrp = prog_verified || isReadOnly;
    const disabledDoneGrp = prog_verified || prog_idx < getProgIdxByProgress("Done") || !validateOE(formData).isValid || isReadOnly;

    const discrepancy = formData.QTYDelivered == null || formData.QTYWithdrawn == null ? 0 : formData.QTYDelivered - formData.QTYWithdrawn;
    const actualDiscrepancy = formData.QTYDelivered_Actual == null || formData.QTYWithdrawn_Actual == null ? 0 : formData.QTYDelivered_Actual - formData.QTYWithdrawn_Actual;
    return (
      <>
        <div className="order-dist-container animate-pop-in" style={style}>
          <div className="order-dist-header">
            <h3>Delivery Monitoring Sheet {`[${formData.OE}]`}</h3>
            <div className="header-sub-row">
              <p>Enter Trip Details for ID: {formData.ID || '[New Trip]'}</p>

              <div className="header-controls">

                <button type="button" className="control-btn" onClick={expandAll}>
                  Expand All
                </button>

                <span className="control-separator">|</span>

                <button type="button" className="control-btn" onClick={collapseAll}>
                  Collapse All
                </button>

                <span className="control-separator">|</span>

                <div className="more-options-container">
                  <button onClick={() => setMoreOptionsOpen(!isMoreOptionsOpen)} className={`control-btn ${isMoreOptionsOpen ? 'open' : 'close'}`} type="button" title='More Actions'>
                    {`ACTIONS`}
                    <Menu size={16} />
                    {
                      (
                        (((actualDiscrepancy ? actualDiscrepancy : discrepancy) < SHORT_BAGS_LIMIT) && (formData.TripProgress === 'Done')) ||
                        (!canChangeTrip && !fuelFetching)
                      ) && !isMoreOptionsOpen
                      && <span className="odform-unsaved-indicator">!</span>
                    }
                  </button>
                  {isMoreOptionsOpen && (
                    <div
                      ref={dropdownRef}
                      className="more-options-dropdown"
                      /* Automatically closes dropdown on option selection */
                      onClick={() => setMoreOptionsOpen(false)}
                    >
                      <a href="#" className={(!formData.Vehicle || formData.TripProgress === 'New Trip' || isReadOnly) ? 'disabled' : ''} onClick={(e) => { e.preventDefault(); if (!formData.Vehicle || isReadOnly || formData.TripProgress === 'New Trip') return; onShowFuelRequest?.(formData); setMoreOptionsOpen(false); }}><Fuel size={16} /> Fuel Request {!canChangeTrip && !fuelFetching && <span className="odform-unsaved-indicator">!</span>}{fuelFetching && <span className="order-form-fuelfetch-spinner"> <Loader size={18} /> </span>}</a>
                      <a href="#" className={(!formData.Latlong) ? 'disabled' : ''} onClick={(e) => { e.preventDefault(); setMoreOptionsOpen(false); }}><MapPin size={16} /> Check GPS</a>
                      <a href="#" className={(!formData.tripID || isReadOnly) ? 'disabled' : ''} onClick={(e) => { e.preventDefault(); if (!formData.tripID || isReadOnly) return; handlePrintDMS(); setMoreOptionsOpen(false); }}><Printer size={16} /> Print DMS</a>
                      <a href="#" className={(!formData.tripID || !canChangeTrip || isReadOnly) ? 'disabled' : ''} onClick={(e) => { e.preventDefault(); if (isReadOnly) { return; } if (!formData.tripID || !canChangeTrip) { handleCannotChangeTrip(); return; } onRequestChangeTrip?.(formData, progress_idx() > 2 ? 'Divert' : 'Change'); setMoreOptionsOpen(false); }}><Replace size={16} /> {`${progress_idx() > 2 ? 'Divert' : 'Change'} Trip`}</a>
                      <a href="#" className={(!formData.tripID || prog_verified || !canChangeTrip /*|| formData.TripProgress === 'Done'*/ || isReadOnly) && !(['Developer', 'IT SUPPORT'].includes(editingUser?.Position || '')) ? 'disabled' : ''} onClick={(e) => { e.preventDefault(); if ((!formData.tripID || isReadOnly || !canChangeTrip || prog_verified || formData.TripProgress === 'Done') && !(['Developer', 'IT SUPPORT'].includes(editingUser?.Position || ''))) { handleCannotChangeTrip(); return; } setCancelRemarks(""); setAttachedCancellationImage(null); setSkipBroadcast(false); setShowCancelConfirmModal(true); setMoreOptionsOpen(false); setRequestType('CANCEL'); }}><Ban size={16} /> Cancel Trip</a>
                      <a
                        href="#"
                        className={(!formData.OE || isReadOnly || !(formData.TripProgress === 'Done')) ? 'disabled' : ''}
                        onClick={(e) => {
                          e.preventDefault();
                          if (!formData.OE || isReadOnly || !(formData.TripProgress === 'Done')) return;

                          setCancelRemarks('');
                          setAttachedCancellationImage(null);
                          setSkipBroadcast(false);
                          setRequestType('REVERT');
                          setShowCancelConfirmModal(true);
                          setMoreOptionsOpen(false);
                        }}
                      >
                        <Undo2 size={16} /> Revert Trip
                      </a>
                      <a
                        href="#"
                        className={(!formData.OE) ? 'disabled' : ''}
                        onClick={(e) => {
                          e.preventDefault();
                          if (formData.OE) {
                            handleShareClick(formData.OE);
                          }
                          setMoreOptionsOpen(false);
                        }}>
                        <AtSign size={16} />
                        Mention to Chat
                      </a>
                      <a
                        href="#"
                        className={(!formData.OE) ? 'disabled' : ''}
                        onClick={(e) => {
                          e.preventDefault();
                          handleViewTripHistory(formData.OE || '');
                          setMoreOptionsOpen(false);
                        }}>
                        <ClipboardList size={16} />
                        View History
                      </a>
                      <a
                        href="#"
                        className={(!formData.OE || /*((actualDiscrepancy ? actualDiscrepancy : discrepancy) >= SHORT_BAGS_LIMIT) || */ (formData.TripProgress !== 'Done') || isCreatingIR || isReadOnly) ? 'disabled' : ''}
                        onClick={(e) => {
                          e.preventDefault();
                          if (!formData.OE || isReadOnly || /*((actualDiscrepancy ? actualDiscrepancy : discrepancy) >= SHORT_BAGS_LIMIT) ||*/ (formData.TripProgress !== 'Done') || isCreatingIR || isReadOnly) return;
                          handleTripCreateIR(formData, (discrepancy === 0 && actualDiscrepancy === 0) ? 'MANUAL' : (prog_next === 'Done' && !!formData.Completed_x0020_Date) ? 'ODM' : 'COOR');
                          // setIsIncidentModalOpen(false);
                          // setShowIncidentPrompt(true);
                        }}>
                        <FileSpreadsheet size={16} />
                        {formData.IRID ? `View IR` : `Create IR`} {isCreatingIR && <span className="order-form-fuelfetch-spinner"> <Loader size={18} /> </span>}
                        {( /* ((actualDiscrepancy ? actualDiscrepancy : discrepancy) < SHORT_BAGS_LIMIT) &&*/ (formData.TripProgress === 'Done') && (formData.IRStatus != 'Closed')) && <span className="odform-unsaved-indicator">!</span>}
                      </a>
                    </div>
                  )}
                </div>

              </div>
            </div>
          </div>



          <div className="order-dist-body scrollable-body" style={maxHeight ? { maxHeight } : undefined}>

            {/* 1. Order Entry Group */}
            <div className="input-group-group" ref={newtripsDetailsRef}>
              <div className="group-header" onClick={() => toggleGroup('oeRef')}>
                <div className="group-header-title">
                  <span>Trip Details</span>
                  {showValidationIcon('new_trip')}
                </div>
                <span className={`toggle-icon ${collapsed.oeRef ? 'is-collapsed' : ''}`}></span>
              </div>
              <div className={`group-content-wrapper ${!collapsed.oeRef ? 'is-open' : ''}`}>
                <div className="group-content-inner">
                  {/*(prog_verified) && <div className='stopper'></div>*/}
                  <div className="form-row">
                    <div className="input-group" style={{ flex: 2 }}>
                      <label>ORDER REFERENCE # *</label>
                      <div className="gradient-input-wrapper">
                        <input
                          type="text"
                          value={formData.OE || ''}
                          readOnly
                          onClick={onOEInputClick}
                          placeholder='Click to select SAP Orders'
                          disabled={disabledOEEntGrp}
                        />
                      </div>
                    </div>
                    {/* <div className="input-group" style={{ flex: 1 }}>
                      <label>Loading Sequence *</label>
                      <div className={`gradient-input-wrapper `}>
                        <input
                          type="number"
                          step="1"
                          min="0"
                          pattern="^\d+(\.\d{0,2})?$"
                          value={formData.Loading_x0020_Sequence || 1}
                          onChange={e => {
                            let val = e.target.value;
                            if (val === "") { handleFieldChange('Loading_x0020_Sequence', ""); return; }
                            if (/^\d+(\.\d{0,2})?$/.test(val)) { handleFieldChange('Loading_x0020_Sequence', parseFloat(val)); }
                          }}
                          disabled={disabledOEEntGrp}
                        />
                      </div>
                    </div> */}
                  </div>

                  <div className="form-row">
                    <div className="input-group" style={{ flex: 2 }}>
                      <label className="input-label">Trip Ticket #</label>
                      <div className="gradient-input-wrapper">
                        <input type="text" value={formData.TripTicketID || ''} disabled />
                      </div>
                    </div>
                    <div className="input-group" style={{ flex: 1 }}>
                      <label className="input-label">DMS ID</label>
                      <div className="gradient-input-wrapper">
                        <input type="text" value={formData.tripID || ''} disabled />
                      </div>
                    </div>
                  </div>

                  <div className="form-row">
                    <SearchableDropdown label="Business Unit" disabled options={mappedBusinessUnits} value={formData.Buisness_x0020_Unit || ''} onChange={val => handleFieldChange('Buisness_x0020_Unit', String(val))} />
                  </div>

                  <div className="form-row">
                    <SearchableDropdown label="Status" options={tripStatusOptions} value={formData.Trip_x0020_Status || ''} onChange={val => handleFieldChange('Trip_x0020_Status', String(val))} disabled={formData.TripProgress == 'New Trip' || formData.TripProgress == 'Assigned' || disabledOEEntGrp} />
                  </div>


                </div>
              </div>
            </div>

            {/* 2. OE Details Group */}
            <div className="input-group-group">
              <div className="group-header" onClick={() => toggleGroup('oeDetails')}>

                <div className="group-header-title">
                  <span>Order Details</span>
                </div>

                <span className={`toggle-icon ${collapsed.oeDetails ? 'is-collapsed' : ''}`}></span>
              </div>
              <div className={`group-content-wrapper ${!collapsed.oeDetails ? 'is-open' : ''}`}>
                <div className="group-content-inner">
                  {/*(prog_verified || !validateOE(formData).isValid) && <div className='stopper'></div>*/}
                  <div className="form-row">
                    <div className="input-group">
                      <label>SOURCE</label>
                      {
                        (formData._tripGroup === 'Preload' || formData._tripGroup === 'Mobilization') && formData.TripProgress == 'New Trip' ? (
                          <SearchableDropdown disabled={disabledOEDetGrp} label="" allowSearch={true} options={sourceOptions} value={formData.Source || ''} onChange={val => handleFieldChange('Source', String(val))} />
                        ) :
                          (<div className="gradient-input-wrapper">
                            <input type="text" value={formData.Source || ''} disabled />
                          </div>)
                      }
                    </div>
                    <div className="input-group">


                      <label>DESTINATION</label>

                      <div className={`gradient-input-wrapper ${formData._tripGroup === 'Preload' || formData._tripGroup === 'Mobilization' ? 'is-editable' : ''}`}>
                        <input
                          type="text"
                          value={formData.Destination || ''}
                          disabled
                          onChange={e => handleFieldChange('Destination', e.target.value)}
                        />
                      </div>

                    </div>
                  </div>

                  {/* CIFME INPUT */}

                  {editingUser?.Position === 'Developer' && (<div className="form-row">
                    <div className="input-group">
                      <label>CIFME</label>
                      <div className="gradient-input-wrapper">
                        <input type="text" value={formData.CIFME_OE || ''} /*disabled*/ placeholder="Select CIF trip"
                          onClick={
                            () => {
                              if (!onCIFMESelect) return;

                              if (!formData.SO_x0023_ || formData.SO_x0023_ == 'N/A') {
                                setBannerMessage('Please input SO first.');
                                return;
                              }

                              if (!/^\d+$/.test(String(formData.SO_x0023_).trim())) {
                                setBannerMessage('SO number must be a valid integer.');
                                return;
                              }

                              onCIFMESelect(formData.SO_x0023_?.toString() || '')

                            }
                          }
                        />
                      </div>
                    </div>
                    <div className="input-group">
                      <label>DESTINATION</label>
                      <div className="gradient-input-wrapper">
                        <input type="text" value={formData.CIFME_DESTINATION || ''} disabled />
                      </div>
                    </div>
                  </div>
                  )}

                  <div className="form-row">
                    <div className="input-group">
                      <label>CLIENT</label>
                      <div className="gradient-input-wrapper">
                        <input type="text" value={formData.Customer || ''} disabled />
                      </div>
                    </div>
                    <div className="input-group">
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="input-group">
                      <label>GROUP</label>
                      <div className="gradient-input-wrapper">
                        <input type="text" value={formData._tripGroup || ''} disabled />
                      </div>
                    </div>

                    <div className="input-group">
                      <label>TYPE</label>
                      {formData._tripGroup === 'Preload' && formData.TripProgress == 'New Trip' ? ( // The ':' now has a matching '?'
                        <SearchableDropdown
                          label=""
                          allowSearch={true}
                          options={cementTypeOptions}
                          value={formData.cementType || ''}
                          onChange={val => handleFieldChange('cementType', String(val))}
                          disabled={disabledOEDetGrp}
                        />
                      ) : ( // Changed '&&' to '?'
                        <div className="gradient-input-wrapper">
                          <input type="text" value={formData.cementType || ''} disabled />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="input-group">
                      <label>ORDERED DATE</label>
                      <div className="gradient-input-wrapper">
                        <input type="text" value={formatDate(formData.Ordered_x0020_Date || '') || ''} disabled />
                      </div>
                    </div>

                    <div className="input-group">
                      <label>NEEDED DATE</label>
                      <div className="gradient-input-wrapper">
                        <input type="text" value={formatDate(formData.Needed_x0020_Date || '') || ''} disabled />
                      </div>
                    </div>
                  </div>


                </div>
              </div>
            </div>

            {/* 3. Assignment Details Group */}
            <div className="input-group-group" ref={assignmentDetailsRef}>
              <div className="group-header" onClick={() => toggleGroup('assignmentDetails')}>
                <div className="group-header-title">
                  <span>Assignment Details</span>
                  {showValidationIcon('assigned')}
                </div>
                <span className={`toggle-icon ${collapsed.assignmentDetails ? 'is-collapsed' : ''}`}></span>

              </div>
              <div className={`group-content-wrapper ${!collapsed.assignmentDetails ? 'is-open' : ''}`}>
                <div className="group-content-inner">
                  {/*(prog_verified || !validateOE(formData).isValid) && <div className='stopper'></div>*/}

                  <div className="form-row">
                    <SearchableDropdown disabled={disabledAssGrp} label="Driver *" options={driverOptions} value={formData.Driver || ''} onChange={val => handleFieldChange('Driver', String(val))} />
                    <SearchableDropdown disabled={disabledAssGrp} label="Helper" options={helperOptions} value={formData.Helper || ''} onChange={val => handleFieldChange('Helper', String(val))} />
                  </div>

                  <div className="form-row">
                    <SearchableDropdown
                      label="Truck *"
                      options={truckOptions}
                      value={formData.Vehicle || ''}
                      onChange={val => handleTruckChange(String(val))}
                      disabled={disabledAssGrp}
                    />
                    <SearchableDropdown disabled={disabledAssGrp} label="Trailer *" options={trailerOptions} value={formData.BO || ''} onChange={val => handleFieldChange('BO', String(val))} />
                  </div>

                  {/*<div className="form-row">

                <SearchableDropdown label={`Buisness Unit${TRIP_PROGRESS[1].Progress === formData.TripProgress ? ' *' : ''}`} options={buOptions} value={formData.Buisness_x0020_Unit || ''} onChange={val => handleFieldChange('Buisness_x0020_Unit', String(val))} />

              </div>

              <div className="form-row">
                <SearchableDropdown label={`Monitored By${TRIP_PROGRESS[1].Progress === formData.TripProgress ? ' *' : ''}`} options={[] as DropdownOption[]} value={formData.MonitoredBy || ''} onChange={(val) => handleFieldChange('MonitoredBy', String(val))} />
              </div>*/}

                  <div className="form-row">
                    <div className="input-group">
                      <label>ATW/LO# *</label>
                      <div className="gradient-input-wrapper">
                        <input disabled={disabledAssGrp} type="text" value={formData.ATW_x002f_LO_x0023_ || ''} onChange={e => handleFieldChange('ATW_x002f_LO_x0023_', e.target.value)} />
                      </div>
                    </div>
                    <div className="input-group">
                      <label>SO# *</label>
                      <div className="gradient-input-wrapper">
                        <input disabled={disabledAssGrp} type="text" value={formData.SO_x0023_ || ''} onChange={e => handleFieldChange('SO_x0023_', e.target.value)} />
                      </div>
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="input-group">
                      <label>PLANT DR *</label>
                      <div className="gradient-input-wrapper">
                        <input disabled={disabledAssGrp} type="text" value={formData.Plant_x0020_DR || ''} onChange={e => handleFieldChange('Plant_x0020_DR', e.target.value)} />
                      </div>
                    </div>
                    <div className="input-group">
                      <label>GSDC DR *</label>
                      <div className="gradient-input-wrapper">
                        <input disabled={disabledAssGrp} type="text" value={formData.GSDC_x0020_DR || ''} onChange={e => handleFieldChange('GSDC_x0020_DR', e.target.value)} />
                      </div>
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="input-group">
                      <label>Fuel Request</label>
                      <div className="gradient-input-wrapper">
                        <input disabled={true} type="text" value={''} />
                      </div>
                    </div>
                    <div className="input-group">
                      <label>FR Status</label>
                      <div className="gradient-input-wrapper">
                        <input disabled={true} type="text" value={''} />
                      </div>
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="input-group">
                      <label>Dispatched By</label>
                      <div className="gradient-input-wrapper">
                        <input disabled={disabledAssGrp} type="text" value={formData.DispatchedBy || ''} onChange={e => handleFieldChange('DispatchedBy', e.target.value)} />
                      </div>
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="input-group">
                      <label>Dispatcher Remarks</label>
                      <div className="gradient-input-wrapper textarea-wrapper">
                        <textarea disabled rows={5} value={formData.Planning || ''} onChange={(e) => handleFieldChange('Planning', e.target.value)} placeholder='Remarks & Planning...' />
                      </div>
                    </div>
                  </div>


                </div>
              </div>
            </div>

            {/* 3. Source Details Group */}
            <div className="input-group-group" ref={dispatchedToSourceRef}>
              <div className="group-header" onClick={() => toggleGroup('sourceDetails')}>

                <div className="group-header-title">
                  <span>Dispatched to Source</span>
                  {showValidationIcon('dispatchedToSource')}
                </div>
                <span className={`toggle-icon ${collapsed.sourceDetails ? 'is-collapsed' : ''}`}></span>
              </div>
              <div className={`group-content-wrapper ${!collapsed.sourceDetails ? 'is-open' : ''}`}>
                <div className="group-content-inner">
                  {/*(prog_verified || prog_idx < 2 || !validateOE(formData).isValid) && <div className='stopper'></div>*/}


                  <div className="form-row">
                    <SearchableDropdown disabled={disabledSrcGrp} label="Loader Driver" options={driverOptions} value={formData.Driver_x0020_Loader || ''} onChange={val => handleFieldChange('Driver_x0020_Loader', String(val))} noClear />
                    <SearchableDropdown disabled={disabledSrcGrp} label="Loader Helper" options={[NAOption, ...(helperOptions ?? [])]} value={formData.Helper_x0020_Loader || ''} onChange={val => handleFieldChange('Helper_x0020_Loader', String(val))} noClear />
                  </div>


                  <div className="form-row">

                    <SearchableDropdown
                      disabled={disabledSrcGrp}
                      label="Loader Driver Type *"
                      options={getLoaderOptions(formData, 'Driver')}
                      value={formData.DriverLoaderType}
                      onChange={val => handleFieldChange('DriverLoaderType', String(val))}
                      noClear
                    />

                    <SearchableDropdown
                      disabled={disabledSrcGrp}
                      label="Loader Helper Type *"
                      options={getLoaderOptions(formData, 'Helper')}
                      value={formData.HelperLoaderType}
                      onChange={val => handleFieldChange('HelperLoaderType', String(val))}
                      noClear
                    />

                  </div>


                  <div className='form-row'>
                    <div className="input-group">
                      <label>Source In *</label>
                      <CustomDateTimePicker
                        alreadyLocal={true}
                        value={formData.Source_x0020_in}
                        onChange={(newDate: string) => { console.log("selected date:", newDate); handleFieldChange('Source_x0020_in', newDate); }}
                        columnKey="Source_x0020_in"
                        disabled={disabledSrcGrp}
                      />
                    </div>
                    <div className="input-group">
                      <label>Source Out *</label>
                      <CustomDateTimePicker
                        alreadyLocal={true}
                        value={formData.Source_x0020_out}
                        onChange={(newDate: string) => handleFieldChange('Source_x0020_out', newDate)}
                        columnKey="Source_x0020_out"
                        disabled={disabledSrcGrp}
                      />
                    </div>
                  </div>



                  <div className='form-row'>
                    <div className="input-group">
                      <label>QTY Withdrawn *</label>
                      <div className="gradient-input-wrapper">
                        <input disabled={disabledSrcGrp || formData._tripGroup === 'Mobilization'} type="number" value={formData.QTYWithdrawn || 0} onChange={e => handleFieldChange('QTYWithdrawn', Number(e.target.value))} />
                      </div>
                    </div>
                    <div className="input-group"></div>
                  </div>







                  <div className='form-row'>
                    <div className="input-group full-width">
                      <CustomFileAttachment
                        ref={plantDrAttachmentRef}
                        files={[
                          ...attachments.filter(attr => attr.raw?.attachment_type === 'PLANT DR'),
                          ...tempPlantDrAttachments
                        ]}
                        onFilesChange={(mergedList: any[]) => {
                          const onlyNewFiles = mergedList.filter(f => f instanceof File);
                          setTempPlantDrAttachments(onlyNewFiles);
                        }}
                        disabled={disabledSrcGrp}

                        label={`DR Attachments | ID: ${plantDrAttachmentItemID || 'NONE'}`}
                      />
                    </div>
                  </div>


                </div>
              </div>
            </div>

            {/* 4. Destination Details Group */}
            <div className="input-group-group" ref={dispatchedToDestinationRef}>
              <div className="group-header" onClick={() => toggleGroup('destinationDetails')}>
                <div className="group-header-title">
                  <span>Dispatched to Destination</span>
                  {showValidationIcon('dispatchedToDestination')}
                </div>
                <span className={`toggle-icon ${collapsed.destinationDetails ? 'is-collapsed' : ''}`}></span>
              </div>
              <div className={`group-content-wrapper ${!collapsed.destinationDetails ? 'is-open' : ''}`}>
                <div className={`group-content-inner`}>
                  {/*(prog_verified || prog_idx < 3 || !validateOE(formData).isValid) && <div className='stopper'></div>*/}

                  <div className="form-row">
                    <SearchableDropdown disabled={disabledDstGrp} label="Unloader Driver" options={driverOptions} value={formData.Driver_x0020_Unloader || ''} onChange={val => handleFieldChange('Driver_x0020_Unloader', String(val))} noClear />
                    <SearchableDropdown disabled={disabledDstGrp} label="Unloader Helper" options={[NAOption, ...(helperOptions ?? [])]} value={formData.Helper_x0020_Unloader || ''} onChange={val => handleFieldChange('Helper_x0020_Unloader', String(val))} noClear />
                  </div>


                  <div className="form-row">

                    <SearchableDropdown
                      disabled={disabledDstGrp}
                      label="Unloader Driver Type *"
                      options={getUnloaderOptions(formData, 'Driver')}
                      value={formData.DriverUnloaderType}
                      onChange={val => handleFieldChange('DriverUnloaderType', String(val))}
                      noClear
                    />

                    <SearchableDropdown
                      disabled={disabledDstGrp}
                      label="Unloader Helper Type *"
                      options={getUnloaderOptions(formData, 'Helper')}
                      value={formData.HelperUnloaderType}
                      onChange={val => handleFieldChange('HelperUnloaderType', String(val))}
                      noClear
                    />

                  </div>

                  <div className='form-row'>
                    <div className="input-group">
                      <label>Destination In *</label>
                      <CustomDateTimePicker
                        alreadyLocal={true}
                        value={formData.Destination_x0020_in}
                        onChange={(newDate: string) => handleFieldChange('Destination_x0020_in', newDate)}
                        columnKey="Destination_x0020_in"
                        disabled={disabledDstGrp}
                      />
                    </div>
                    <div className="input-group">
                      <label>Destination Out *</label>
                      <CustomDateTimePicker
                        alreadyLocal={true}
                        value={formData.Destination_x0020_out}
                        onChange={(newDate: string) => handleFieldChange('Destination_x0020_out', newDate)}
                        columnKey="Destination_x0020_out"
                        disabled={disabledDstGrp}
                      />
                    </div>
                  </div>



                  <div className='form-row'>
                    <div className="input-group">
                      <label>QTY Delivered *</label>
                      <div className="gradient-input-wrapper">
                        <input disabled={disabledDstGrp || formData._tripGroup === 'Mobilization'} type="number" value={formData.QTYDelivered || 0} onChange={e => handleFieldChange('QTYDelivered', Number(e.target.value))} />
                      </div>
                    </div>
                    <div className="input-group">
                      <label>Discrepancy</label>
                      <div className="gradient-input-wrapper">
                        <input
                          disabled
                          type="number"
                          value={discrepancy}
                          className={`discrepancy ${discrepancy < 0 ? 'negative' : 'positive'}`}
                        />
                      </div>
                    </div>
                  </div>

                  <div className='form-row'>
                    <div className="input-group full-width">
                      <CustomFileAttachment
                        ref={wsAttachmentRef}
                        files={[
                          ...attachments.filter(attr => attr.raw?.attachment_type === 'WS'),
                          ...tempWsAttachments
                        ]}
                        onFilesChange={(mergedList: any[]) => {
                          const onlyNewFiles = mergedList.filter(f => f instanceof File);
                          setTempWsAttachments(onlyNewFiles);
                        }}
                        disabled={disabledDstGrp}
                        label={`WS Attachments | ID: ${wsAttachmentItemID || 'NONE'}`}
                      />
                    </div>
                  </div>



                </div>
              </div>
            </div>


            {/* 4. Done/Verification Group */}
            <div className="input-group-group" ref={doneRef}>
              <div className="group-header" onClick={() => toggleGroup('doneVerification')}>
                <div className="group-header-title">
                  <span>Documentation</span>
                  {showValidationIcon('done')}
                </div>
                <span className={`toggle-icon ${collapsed.doneVerification ? 'is-collapsed' : ''}`}></span>
              </div>
              <div className={`group-content-wrapper ${!collapsed.doneVerification ? 'is-open' : ''}`}>
                <div className="group-content-inner">
                  {/*(prog_verified || prog_idx < 4 || !validateOE(formData).isValid) && <div className='stopper'></div>*/}



                  <div className="form-row">

                    <div className="input-group">
                      <label>Verified By</label>
                      <div className="gradient-input-wrapper">
                        <input disabled type="text" value={prog_verified ? formData.Verified_x0020_By : (prog_idx === getProgIdxByProgress("Done") ? (editingUser?.FullName || '') : '')} onChange={e => handleFieldChange('Verified_x0020_By', e.target.value)} />
                      </div>
                    </div>

                    <div className="input-group">
                      <label>Documented Date</label>
                      <CustomDateTimePicker
                        alreadyLocal={true}
                        value={formData.TripProgress === 'Done' ? (formData.Documented_x0020_Date || new Date().toISOString()) : undefined}
                        onChange={(newDate: string) => handleFieldChange('Documented_x0020_Date', newDate)}
                        columnKey="Documented_x0020_Date"
                        disabled={true}
                      />
                    </div>

                  </div>

                  <div className="form-row">

                    <div className="input-group">
                      <label>Received Date *</label>
                      <CustomDateTimePicker
                        alreadyLocal={true}
                        value={formData.Receive_x0020_Date}
                        onChange={(newDate: string) => handleFieldChange('Receive_x0020_Date', newDate)}
                        columnKey="Receive_x0020_Date"
                        disabled={disabledDoneGrp}
                      />
                    </div>


                    <div className="input-group">
                      <label>Transmitted Date *</label>
                      <CustomDateTimePicker
                        alreadyLocal={true}
                        value={formData.Transimtted_x0020_Date}
                        onChange={(newDate: string) => handleFieldChange('Transimtted_x0020_Date', newDate)}
                        columnKey="Transimtted_x0020_Date"
                        disabled={disabledDoneGrp}
                      />
                    </div>

                  </div>

                  <div className="form-row">

                    <div className="input-group">
                      <label>Baranggay Fee</label>
                      <div className="gradient-input-wrapper">
                        <input disabled={disabledDoneGrp} type="number" value={formData.Baranggay_Fee_Total || 0} onChange={e => handleFieldChange('Baranggay_Fee_Total', Number(e.target.value))} />
                      </div>
                    </div>


                    <div className="input-group">
                      <label>Toll Fee</label>
                      <div className="gradient-input-wrapper">
                        <input disabled={disabledDoneGrp} type="number" value={formData.Toll_Fee_Total || 0} onChange={e => handleFieldChange('Toll_Fee_Total', Number(e.target.value))} />
                      </div>
                    </div>

                  </div>
                  <div className="form-row">

                    <div className="input-group">
                      <label>Flat Tire Fee</label>
                      <div className="gradient-input-wrapper">
                        <input disabled={disabledDoneGrp} type="number" value={formData.FlatTire_Fee_Total || 0} onChange={e => handleFieldChange('FlatTire_Fee_Total', Number(e.target.value))} />
                      </div>
                    </div>


                    <div className="input-group">
                      <label>Other Fee</label>
                      <div className="gradient-input-wrapper">
                        <input disabled={disabledDoneGrp} type="number" value={formData.Other_Fee_Total || 0} onChange={e => handleFieldChange('Other_Fee_Total', Number(e.target.value))} />
                      </div>
                    </div>

                  </div>

                  <div className="form-row">

                    <div className="input-group">
                      <label>Actual Withdrawn *</label>
                      <div className="gradient-input-wrapper">
                        <input disabled={disabledDoneGrp} type="number" value={formData.QTYWithdrawn_Actual || 0} onChange={e => handleFieldChange('QTYWithdrawn_Actual', Number(e.target.value))} />
                      </div>
                    </div>


                    <div className="input-group">
                      <label>Actual Delivered *</label>
                      <div className="gradient-input-wrapper">
                        <input disabled={disabledDoneGrp} type="number" value={formData.QTYDelivered_Actual || 0} onChange={e => handleFieldChange('QTYDelivered_Actual', Number(e.target.value))} />
                      </div>
                    </div>


                    <div className="input-group">
                      <label>Actual Discrepancy</label>
                      <div className="gradient-input-wrapper">
                        <input disabled type="number" value={actualDiscrepancy} />
                      </div>
                    </div>

                  </div>


                  <div className="form-row">
                    <div className="input-group">
                      <label>POD Remarks</label>
                      <div className="gradient-input-wrapper textarea-wrapper">
                        <textarea disabled={disabledDoneGrp} rows={5} value={formData.Sales_x0020_Remarks || ''} onChange={(e) => handleFieldChange('Sales_x0020_Remarks', e.target.value)} placeholder='Verification Notes & Corrections...' />
                      </div>
                    </div>
                  </div>





                </div>
              </div>
            </div>



          </div>


          <div className="order-dist-footer sticky-footer">
            <div className={`footer-validation-message ${!validation.isValid ? 'invalid' : 'valid'}`}>
              {prog_verified ? 'This trip has been concluded.' : `${validation.message}`}
            </div>
            <button className="btn-cancel" onClick={() => { handleOnClose() /*setShowIncidentPrompt(true)*/ }}>Close</button>
            {(prog_verified || (['Developer', 'IT SUPPORT'].includes(editingUser?.Position || '') && formData.TripProgress === 'Done')) ?

              (<button className="btn-cancel" onClick={() => { if (isSubmitting) return; handleTripRevert(); }} disabled={isSubmitting || !['POD', 'DCC', ...SPECIAL_POSITIONS].includes(editingUser?.Position || 'wew')}>
                <Undo2 size={'var(--font-size-vlg)'} />
                Revert
              </button>) : (null)
            }

            {!prog_verified && (
              <>
                <button className="btn-save" onClick={() => { if (isSubmitting || isReadOnly) return; handleTripSave(); }} disabled={isSubmitting || prog_verified || isReadOnly}>
                  {hasUnsavedChanges && <span className="odform-unsaved-indicator">!</span>}
                  <SaveIcon size={'var(--font-size-vlg)'} />
                  Save
                </button>
                <button
                  className="btn-proceed"
                  onClick={() => {
                    if (isSubmitting || isReadOnly) return;
                    handleTripProceed(shouldTagAsPlanned ? 'Planned' : prog_next);
                  }}
                  disabled={!validation.isValid || isSubmitting || prog_verified || isReadOnly}
                >
                  {shouldTagAsPlanned ? <Milestone size={16} /> : prog_icon}
                  {shouldTagAsPlanned ? 'Plan Trip' : prog_verified ? 'Verified' : prog_next.replace('ed', '')}
                </button>
              </>
            )
            }
            {isSubmitting && (<Loader2 style={{ animation: 'spin 1s linear infinite' }} size={'var(--font-size-vlg)'} />)}
          </div>



          {personnelValidationModal?.isOpen && createPortal(
            <Modal onClose={handlePersonnelValidationModalClose} width={'35%'} height={'30%'}>
              <div className="personnel-validation-modal">
                <h3>Validation Issue</h3>
                {personnelValidationModal.type === 'attendance' ? (
                  <>
                    <p>{personnelValidationModal.personnelName} is currently not on duty. Would you like to update the attendance?</p>
                    <div className="modal-actions">
                      <button className="btn-cancel" onClick={() => {
                        if (pendingPersonnelValidationResolve) pendingPersonnelValidationResolve(false);
                        setPersonnelValidationModal(null);
                        setPendingPersonnelValidationResolve(null);
                      }}>Cancel</button>
                      <button className="btn-proceed" onClick={() => {
                        if (pendingPersonnelValidationResolve) pendingPersonnelValidationResolve(true);
                        handleUpdateAttendance(personnelValidationModal.personnelName, personnelValidationModal.personnelID.toString(), personnelValidationModal.personnelType, 'PRESENT', false);
                        setPersonnelValidationModal(null);
                        setPendingPersonnelValidationResolve(null);
                      }}>TAGGED AS PRESENT</button>
                    </div>
                  </>
                ) : (
                  <>
                    <p>{personnelValidationModal.personnelName} is already assigned to trip {personnelValidationModal.tripOE}. Check the trip details for more information.</p>
                    <div className="modal-actions">
                      <button className="btn-cancel" onClick={() => {
                        if (pendingPersonnelValidationResolve) pendingPersonnelValidationResolve(false);
                        setPersonnelValidationModal(null);
                        setPendingPersonnelValidationResolve(null);
                      }}>Cancel</button>

                      {/* Conditionally render Plan Trip action */}

                      <button className="btn-proceed" onClick={() => {
                        if (pendingPersonnelValidationResolve) pendingPersonnelValidationResolve(false);
                        if (onNavigateToTrip && personnelValidationModal.tripOE) {
                          onNavigateToTrip(personnelValidationModal.tripOE);
                        }
                        setPersonnelValidationModal(null);
                        setPendingPersonnelValidationResolve(null);
                      }}>Go to Trip</button>

                      <button disabled={!personnelValidationModal.enablePlanTrip} className="btn-save" onClick={() => {
                        if (pendingPersonnelValidationResolve) pendingPersonnelValidationResolve('planTrip');
                        setPersonnelValidationModal(null);
                        setPendingPersonnelValidationResolve(null);
                      }}>Proceed as Planned Trip</button>

                    </div>
                  </>
                )}
              </div>
            </Modal>,
            document.body
          )}

          {showTruckConflictModal && createPortal(
            <Modal onClose={() => setShowTruckConflictModal(false)} width={'35%'} height={'auto'}>
              <div className="personnel-validation-modal">
                <h3>Unit cannot be assigned</h3>
                <p>The selected truck or paired trailer cannot be assigned due to the following reasons:</p>
                <ul className="conflict-list">
                  {truckConflictInfo.map((info, index) => (
                    <li key={index}>{info}</li>
                  ))}
                </ul>
                <div className="modal-actions">
                  <button className="btn-proceed" onClick={() => setShowTruckConflictModal(false)}>OK</button>
                </div>
              </div>
            </Modal>,
            document.body
          )}

          {ShowOEDuplicateWarningModal && createPortal(
            <Modal onClose={() => setShowOEDuplicateWarningModal(false)} width={'35%'} height={'auto'}>
              <div className="personnel-validation-modal">
                <h3>OE Already Exists</h3>
                <p>The OE {formData.OE} already exists in the system. Please choose a different OE.</p>
                <div className="modal-actions">
                  <button className="btn-proceed" onClick={() => {
                    if (onNavigateToTrip && formData.OE) {
                      onNavigateToTrip(formData.OE);
                    }
                    setShowOEDuplicateWarningModal(false)
                  }}>Go to Trip</button>
                </div>
              </div>
            </Modal>,
            document.body
          )}

          {processTruckIR && createPortal(
            <Modal onClose={() => { setProcessTruckIR(null); setIsCreatingIR(false); }} width={'35%'} height={'auto'}>
              <div className="personnel-validation-modal">
                <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'bold' }}>Do you want to process this Incident Report [{processTruckIR.irid}] now? </h2>
                <p style={{ fontSize: 'var(--font-size-lg)', color: 'var(--color-accent)' }}>{processTruckIR.conflict}</p>
                <div className="modal-actions">
                  <button className="btn-proceed" onClick={() => { handleConfirmProcessIR(processTruckIR.irid); setProcessTruckIR(null); setIsCreatingIR(true); }}>OK</button>
                  <button className="btn-cancel" onClick={() => { setProcessTruckIR(null); setIsCreatingIR(false); }}>NOT NOW</button>
                </div>
              </div>
            </Modal>,
            document.body
          )}

          {showCannotChangeTripModal && createPortal(
            <Modal onClose={() => setShowCannotChangeTripModal(null)} width={'35%'} height={'auto'}>
              <div className="personnel-validation-modal">
                <h2 style={{ fontSize: 'var(--font-size-vlg)', fontWeight: 'bold' }}>Cannot {showCannotChangeTripModal.what} Trip</h2>
                <p style={{ fontSize: 'var(--font-size-lg)', color: 'var(--color-accent)' }}>{showCannotChangeTripModal.message}</p>
                <div className="modal-actions">
                  <button className="btn-proceed" onClick={() => setShowCannotChangeTripModal(null)}>OK</button>
                </div>
              </div>
            </Modal>,
            document.body
          )}

          {showCancelConfirmModal && createPortal(
            <Modal onClose={() => { setShowCancelConfirmModal(false); setCancelRemarks(""); setSkipBroadcast(false); }} width={'25%'} height={'auto'}>
              <div className="personnel-validation-modal">
                <h3 className="modal-title">
                  {requestType === 'REVERT' ? 'Request Trip Revert' : 'Request Trip Cancellation'}
                </h3>
                <p>
                  Are you sure you want to request a trip {requestType === 'REVERT' ? 'revert' : 'cancellation'} for{' '}
                  <strong>{formData.OE}</strong>?
                </p>



                {/* --- Cancellation Remarks Field --- */}
                <div className="remarks-field-container">
                  <label className="field-label">
                    {requestType === 'REVERT' ? 'Revert Reason' : 'Cancellation Reason'}{' '}
                    <span className="required-asterisk">*</span>
                  </label>


                  <div className="gradient-input-wrapper">
                    <textarea
                      rows={3}
                      placeholder={`Please specify the reason for ${requestType === 'REVERT' ? 'reverting' : 'cancellation'}...`}
                      value={cancelRemarks}
                      onChange={(e) => setCancelRemarks(e.target.value)}
                      className="modal-textarea"
                    />
                  </div>

                  {!cancelRemarks.trim() && (
                    <p className="ordr-dist-validation-message">
                      Please specify your reason for {requestType === 'REVERT' ? 'trip revert' : 'trip cancellation'}.
                    </p>
                  )}
                </div>


                {/* --- Image Attachment Field --- */}
                {/* <div className="image-field-container">
                  <label className="field-label">
                    Reference Image <span className="optional-tag">(Optional)</span>
                  </label>

                  <div className="gradient-input-wrapper">
                    <div
                      className="image-input-container-box"
                      onPaste={handleImagePaste}
                      tabIndex={0} // Allows the box to accept focus for pasting
                      style={{ outline: 'none' }} // Prevents default browser focus rings if undesirable
                    >
                      {attachedCancellationImage ? (
                        <div className="attached-image-info">
                          <span className="image-filename">
                            📎 {attachedCancellationImage.name}
                          </span>
                          <button
                            onClick={() => setAttachedCancellationImage(null)}
                            className="btn-remove-image"
                            title="Remove Image"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <label className="file-upload-label" style={{ cursor: 'pointer' }}>
                          Choose Image or Paste (Ctrl + V)...
                          <input
                            type="file"
                            accept="image/png, image/jpeg, image/jpg"
                            onChange={handleCancellatioFileChange}
                            className="hidden-file-input"
                          />
                        </label>
                      )}
                    </div>
                  </div>
                </div> */}

                {/* --- TEST --- */}

                {/* --- Developer Broadcast Bypass Field --- */}
                {['Developer', 'IT SUPPORT'].includes(editingUser?.Position || '') && (
                  <div className="broadcast-bypass-container" style={{ margin: '15px 0 5px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="checkbox"
                      id="bypassTeamsBroadcast"
                      checked={skipBroadcast}
                      onChange={(e) => setSkipBroadcast(e.target.checked)}
                      style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                    />
                    <label htmlFor="bypassTeamsBroadcast" style={{ fontSize: '13px', fontWeight: '500', color: '#ff3b3b', cursor: 'pointer', userSelect: 'none' }}>
                      Do not broadcast to Teams
                    </label>
                  </div>
                )}

                {/* --- Modal Actions --- */}
                <div className="modal-actions">
                  <button className="btn-proceed" onClick={() => { setShowCancelConfirmModal(false); setSkipBroadcast(false); }}>GO BACK</button>

                  <button
                    className={`btn-cancel-wait ${!cancelRemarks.trim() ? 'disabled' : 'enabled'}`}
                    onClick={async () => {
                      if (!cancelRemarks.trim()) return;

                      const shouldBroadcast = !skipBroadcast;
                      const isRevert = requestType === 'REVERT';
                      const requesterName = editingUser?.FullName || 'Unknown User';
                      const actionName = isRevert ? 'reversion' : 'cancellation';
                      const ActionTitle = isRevert ? 'REVERSION' : 'CANCELLATION';
                      const currentOE = formData.OE || '';

                      try {
                        const existingRequests = await ewulFetchAll<any>(
                          DMS_CancellationRequestsService,
                          { filter: `oldOE eq '${currentOE}' and status eq 'Pending'` }
                        );

                        if (existingRequests && existingRequests.length > 0) {
                          // Close the confirmation modal and open the warning modal instead
                          setShowCancelConfirmModal(false);
                          setOngoingRequestDetails(existingRequests[0]);
                          setShowOngoingRequestWarning(true);
                          return;
                        }
                      } catch (error) {
                        console.error('Failed to check for ongoing requests:', error);
                      }

                      addTask({
                        id: `trip-${actionName}-${formData.OE}`,
                        name: `${isRevert ? 'Requesting revert' : 'Cancelling'} trip ${formData.OE}`,
                        execute: async () => {




                          // Optimistically update the UI if handler exists
                          onCancelTrip?.(formData.ID);

                          try {
                            await ewulCreate('DISPATCH_APP_DMS', 'DMS_CancellationRequests', {
                              oldOE: formData.OE || '',
                              tripID: formData.ID || '',
                              reason: cancelRemarks.trim(),
                              status: 'Pending',
                              CreatedBy: requesterName,
                              requestType,
                              broadcastToTeams: shouldBroadcast,
                              BU: editingUser?.BusinessUnit,
                            } as DMS_CancellationRequests);

                            return { success: true };
                          } catch (error) {
                            console.error(`Failed to submit trip ${actionName}:`, error);
                            handleLogError(error, `trip${actionName}`, `Trip - ${ActionTitle}`);
                            return { success: false, error };
                          }
                        },
                        checkSuccess: (result: { success: boolean }) => result.success,
                        onSuccess: () => {
                          onRefreshTrips?.();
                          if (shouldBroadcast) {
                            handleTripAnnounce(
                              `TRIP ${ActionTitle} REQUEST`,
                              `<p>A request to ${isRevert ? 'revert' : 'cancel'} the trip <strong>[${formData.OE || ''}]</strong> has been submitted by <strong>${requesterName}</strong>. Please process this as soon as possible.</p><br><p><strong>Reason:</strong> ${cancelRemarks.trim()}.</p> `,
                              true,
                              false
                            );
                          }
                        },
                        onFailure: () => {
                          onRefreshTrips?.();
                        },
                        message: `${isRevert ? 'Requesting revert' : 'Submitting cancellation'} for trip ${formData.OE}...`,
                        message_success: `Trip ${formData.OE} ${actionName} request submitted successfully.`,
                        message_failure: (result) => `Failed to submit trip ${actionName} for ${formData.OE}. Reason: ${result.error?.message || 'Unknown error'}`
                      });

                      setShowCancelConfirmModal(false);
                      setCancelRemarks('');
                      setSkipBroadcast(false);
                    }}
                    disabled={!cancelRemarks.trim()}
                  >
                    {requestType === 'REVERT' ? 'REQUEST REVERT' : 'REQUEST CANCEL'}
                  </button>

                </div>
              </div>
            </Modal>,
            document.body
          )}

          {showOngoingRequestWarning && createPortal(
            <Modal onClose={() => setShowOngoingRequestWarning(false)} width={'35%'} height={'auto'}>
              <div className="personnel-validation-modal">
                <h3>Ongoing Request Exists</h3>
                <p>
                  Trip <strong>{formData.OE}</strong> already has an ongoing <strong>{ongoingRequestDetails?.requestType || 'cancellation'}</strong> request submitted by <strong>{ongoingRequestDetails?.CreatedBy || 'someone'}</strong>. It needs to be processed first before creating a new one.
                </p>
                <div className="modal-actions">
                  <button className="btn-proceed" onClick={() => setShowOngoingRequestWarning(false)}>
                    OK
                  </button>
                </div>
              </div>
            </Modal>,
            document.body
          )}


          {showUnsavedChangesModal && createPortal(
            <Modal onClose={() => setShowUnsavedChangesModal(false)} width={'35%'} height={'30%'}>
              <div className="personnel-validation-modal">
                <h3>Unsaved Changes</h3>
                <p>You have unsaved changes that will be lost. Are you sure you want to continue?</p>
                <div className="modal-actions">
                  <button className="btn-proceed" onClick={() => { if (pendingResolve) pendingResolve(false); setShowUnsavedChangesModal(false); }}>GO BACK</button>
                  <button className="btn-cancel" onClick={() => {
                    if (pendingResolve) pendingResolve(true);
                    onClose();
                    setShowUnsavedChangesModal(false);
                  }}>CONTINUE WITHOUT SAVING</button>
                </div>
              </div>
            </Modal>,
            document.body
          )}

          {showShareModal && createPortal(
            <Modal onClose={() => setShowShareModal(false)} width={'35%'} height={'40%'}>
              <div className="personnel-validation-modal">
                <h4>@Mention Trip {shareOE}</h4>
                <p style={{ marginBottom: '10px' }}>Leave a note to let them know!</p>

                {/* Your signature gradient outline pattern */}
                <div className="share-gradient-wrapper">
                  <textarea
                    className="share-textarea"
                    value={shareComment}
                    onChange={(e) => setShareComment(e.target.value)}
                    placeholder="e.g., Please prioritize this load..."
                    rows={4}
                  />
                </div>

                <div className="modal-actions" style={{ marginTop: '20px' }}>
                  <button className="btn-cancel" onClick={() => setShowShareModal(false)}>
                    CANCEL
                  </button>
                  <button className="btn-proceed" onClick={() => {
                    const finalText = `[TRIP:${shareOE}] ${shareComment}`.trim();

                    // Dispatch to your ChatBox event listener
                    window.dispatchEvent(new CustomEvent(GSDC_SEND_TO_CHAT_key, {
                      detail: { text: finalText, channel: 'Dispatch' }
                    }));

                    setShareComment("");
                    setShowShareModal(false);
                  }}
                    style={{ display: 'flex', flexDirection: 'row', gap: '5px' }}
                  >
                    SEND TO CHAT <Send size={16} />
                  </button>
                </div>
              </div>
            </Modal>,
            document.body
          )}



          {showAssignmentConfirmModal && assignmentChanges && createPortal(
            <Modal
              onClose={() => {
                setShowAssignmentConfirmModal(false);
                pendingAssignmentConfirmation?.(null); // Resolves the promise with 'false' on close
                setIsSubmitting(false);
              }}
              width={'35%'} height={'auto'}
            >
              <div className="assignment-changes-preview" style={{ overflowY: 'auto', maxHeight: '70vh', padding: '20px' }}>
                <h4>Trip Assignment Changes: {`[${formData.OE}]`}</h4>
                <p>Please review and confirm the following changes: </p>
                <ul>
                  {assignmentChanges.newDriver && (
                    <li>
                      <span className="assignment-label-new"><strong>New Driver:</strong></span> {assignmentChanges.newDriver.name}. <span className="status-change"><span className="status-old">{assignmentChanges.newDriver.lastStatus}</span>  <ArrowRight size={16} />  <span className="status-new">{assignmentChanges.newDriver.status}</span></span>
                    </li>
                  )}
                  {assignmentChanges.oldDriver && (
                    <li>
                      <span className="assignment-label-old"><strong>Old Driver:</strong></span> {assignmentChanges.oldDriver.name}. <span className="status-change"><span className="status-old">{assignmentChanges.oldDriver.lastStatus}</span> <ArrowRight size={16} />
                        <select
                          className="status-new"
                          value={assignmentChanges.oldDriver.newStatus}
                          onChange={(e) =>
                            setAssignmentChanges(prev => prev ? { ...prev, oldDriver: { ...prev.oldDriver!, newStatus: e.target.value as 'ABSENT' | 'PRESENT' } } : null)
                          }
                        >
                          <option value="ABSENT">ABSENT</option>
                          <option value="PRESENT">PRESENT</option>
                        </select>
                      </span>
                    </li>
                  )}
                  {assignmentChanges.newHelper && (
                    <li>
                      <span className="assignment-label-new"><strong>New Helper:</strong></span> {assignmentChanges.newHelper.name}. <span className="status-change"><span className="status-old">{assignmentChanges.newHelper.lastStatus}</span> <ArrowRight size={16} /> <span className="status-new">{assignmentChanges.newHelper.status}</span></span>
                    </li>
                  )}
                  {assignmentChanges.oldHelper && (
                    <li>
                      <span className="assignment-label-old"><strong>Old Helper:</strong></span> {assignmentChanges.oldHelper.name}. <span className="status-change"><span className="status-old">{assignmentChanges.oldHelper.lastStatus}</span> <ArrowRight size={16} />
                        <select
                          className="status-new"
                          value={assignmentChanges.oldHelper.newStatus}
                          onChange={(e) =>
                            setAssignmentChanges(prev => prev ? { ...prev, oldHelper: { ...prev.oldHelper!, newStatus: e.target.value as 'ABSENT' | 'PRESENT' } } : null)
                          }
                        >
                          <option value="ABSENT">ABSENT</option>
                          <option value="PRESENT">PRESENT</option>
                        </select>
                      </span>
                    </li>
                  )}
                  {assignmentChanges.newVehicle && <li className="assignment-change-item"><strong>Truck:</strong> <span className="status-old">{assignmentChanges.oldVehicle}</span> <ArrowRight size={16} /> {assignmentChanges.newVehicle} </li>}
                  {assignmentChanges.newBO && <li className="assignment-change-item"><strong>Trailer:</strong> <span className="status-old">{assignmentChanges.oldBO}</span> <ArrowRight size={16} /> {assignmentChanges.newBO} </li>}
                </ul>
                {/* Insert this inside the .assignment-changes-preview div, after the <ul> */}
                {assignmentChanges.attendancePayload && assignmentChanges.attendancePayload.length > 0 && (
                  <div className="attendance-payload-preview">
                    <h5 style={{ color: 'var(--color-orange)', marginTop: '15px', borderTop: '1px solid var(--color-bg)', paddingTop: '10px', flexDirection: 'row', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Calendar size={16} /> Attendance Credit Preview
                    </h5>
                    <div className="payload-table-wrapper">

                      <div className="payload-header-wrapper">
                        <div className="payload-label">Base KM:</div>
                        <div className="payload-value">{formData.TripKM}</div>

                        <div className="payload-label">Base index:</div>
                        <div className="payload-value">{formData.TripIndex}</div>

                        <div className="payload-label">SRC-DST:</div>
                        <div className="payload-value">{formData.SD}</div>
                      </div>

                      <table className="payload-mini-table">
                        <thead>
                          <tr>
                            <th>Name</th>
                            <th>Role</th>
                            <th>KM</th>
                            <th>Index</th>
                            <th>Credit</th>
                            <th>Type</th>
                            <th>Trip #</th>
                          </tr>
                        </thead>
                        <tbody>
                          {assignmentChanges.attendancePayload.map((record, idx) => (
                            <tr key={idx}>
                              <td style={{ color: 'var(--color-darkslategray)' }}>{record.EmployeeName}</td>
                              <td style={{ color: record.Position === 'Driver' ? 'var(--color-orange)' : 'var(--color-primary)', fontWeight: 'bold' }}>{record.Position}</td>
                              <td style={{ fontWeight: 'bold' }}>{record.TripKM}</td>
                              <td style={{ fontWeight: 'bold' }}>{record.AttendanceDetail}</td>
                              <td>
                                x{Math.round((Number(record.TripKM) / Number(formData?.TripKM || 1)) * 100) / 100}
                              </td>
                              <td style={{ fontSize: '0.8rem', color: record.TransactionType !== 'Full Trip' ? 'var(--color-accent)' : 'var(--color-muted)' }}>
                                {record.TransactionType || 'Full Trip'}
                              </td>
                              <td style={{ fontWeight: 'bold', position: 'relative', minWidth: '60px' }}>
                                {isFetchingServedCounts ? (
                                  /* --- INLINE CELL LOADING STATE --- */
                                  <div className="payload-cell-spinner-wrapper">
                                    <div className="payload-cell-mini-spinner" />
                                  </div>
                                ) : (
                                  /* --- RENDER ORDINAL COUNT ONCE RESOLVED --- */
                                  getOrdinalServedCount(record.SecondTrip === null ? 1 : Number(record.SecondTrip) + 1)
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}




              </div>
              <div className="assignment-changes-modal-actions">

                {/* Label and Date Picker Container */}
                {prog_next == 'Done' && (<div className="served-date-container">
                  <label className="served-date-label">
                    Served Date:
                  </label>

                  <div className="served-date-gradient-input-wrapper">
                    <div className="served-date-input-inner-container">
                      <input
                        type="date"
                        className="served-date-custom-date-input"
                        value={servedDate.toISOString().split('T')[0]}
                        disabled={isFetchingServedCounts as boolean} // Disable input while executing active requests
                        onChange={(e) => {
                          if (e.target.value) {
                            setServedDate(new Date(e.target.value));
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>)}



                <button
                  className="btn-cancel"
                  onClick={() => {
                    setShowAssignmentConfirmModal(false);
                    pendingAssignmentConfirmation?.(null);
                    setIsSubmitting(false);
                  }}
                >
                  Cancel
                </button>
                <button
                  className="btn-proceed"
                  onClick={() => {
                    setShowAssignmentConfirmModal(false);
                    pendingAssignmentConfirmation?.(assignmentChanges.attendancePayload || []);
                    setIsSubmitting(false);
                  }}
                  disabled={isFetchingServedCounts}
                  style={{ flexDirection: 'row', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  {assignmentChanges.attendancePayload && assignmentChanges.attendancePayload.length > 0 && (<CheckCheck />)}
                  {isFetchingServedCounts ? 'Calculating...' : assignmentChanges.attendancePayload && assignmentChanges.attendancePayload.length > 0 ? 'Trip Complete' : 'Confirm Changes'}
                </button>
              </div>
            </Modal>,
            document.body
          )}

          {showIncidentPrompt && (
            <Modal
              onClose={() => { setIsIncidentModalOpen(false); setShowIncidentPrompt(false); }}
              width={'38%'}
              height={'auto'}
              preventClickOutside={true}
            >
              <div className="incident-report-prompt-modal">
                <h3>
                  {/* Dynamic Header */}
                  {isExistingIR ? 'Ongoing Incident Report' : 'Short-bags Incident Report Created'}
                  {createdIR?.IRID && <span className="ir-id-badge"> ( {createdIR.IRID} )</span>}
                </h3>

                {/* Dynamic Main Body Text */}
                <p>
                  {isExistingIR ? (
                    <>
                      An Open Short-Bags Incident Report <strong>({createdIR?.IRID})</strong> already exists for this trip ({formData.OE}). Would you like to review or process it now?
                    </>
                  ) : (
                    <>
                      The selected trip has been detected with short-bags and an IR has been created. Would you like to process the incident report now?
                    </>
                  )}
                </p>

                {/* Overview Card: Final Status & Pending Requirements */}
                <div
                  className="ir-summary-card"
                  style={{
                    margin: '12px 0',
                    padding: '12px 14px',
                    backgroundColor: '#f8f9fa',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}
                >
                  {/* Target/Final Status Display */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 500 }}>
                      Final Status:
                    </span>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        backgroundColor: validationIR?.status === 'Closed' ? '#e6f4ea' : '#e8ebd0',
                        color: validationIR?.status === 'Closed' ? '#137333' : '#3a4efc'
                      }}
                    >
                      {validationIR?.status || 'Open'}
                    </span>
                  </div>

                  {/* To Do / Pending Validation Requirements */}
                  {validationIR && (
                    <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '8px', marginTop: '2px' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1e293b' }}>
                        To do:
                      </span>
                      <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: validationIR.valid ? '#16a34a' : '#d97706' }}>
                        {validationIR.valid
                          ? '✓ All required fields and attachments are complete.'
                          : (validationIR.msg || 'Complete missing fields/attachments before submitting.')
                        }
                      </p>
                    </div>
                  )}

                  {/* Parse & Display reportJSON Details + Nested Actions */}
                  {(() => {
                    let parsedData: any = null;
                    if (createdIR?.reportJSON) {
                      try {
                        parsedData = typeof createdIR.reportJSON === 'string'
                          ? JSON.parse(createdIR.reportJSON)
                          : createdIR.reportJSON;
                      } catch (err) {
                        console.error('Failed to parse reportJSON:', err);
                      }
                    }

                    if (!parsedData) return null;

                    // Extract actions array safely from actions.operations or actions array
                    let actionList: any[] = [];
                    if (parsedData.actions) {
                      if (Array.isArray(parsedData.actions.operations)) {
                        actionList = parsedData.actions.operations;
                      } else if (parsedData.actions.operations && typeof parsedData.actions.operations === 'object') {
                        actionList = [parsedData.actions.operations];
                      } else if (Array.isArray(parsedData.actions)) {
                        actionList = parsedData.actions;
                      }
                    }

                    return (
                      <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '8px', marginTop: '4px' }}>


                        {/* Actions History List */}
                        {actionList.length > 0 && (
                          <>
                            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#000080' }}>
                              Actions:
                            </span>
                            <div
                              style={{
                                maxHeight: '120px',
                                overflowY: 'auto',
                                marginTop: '6px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '6px'
                              }}
                            >
                              {actionList.map((act: any, idx: number) => (
                                <div
                                  key={idx}
                                  style={{
                                    fontSize: '0.8rem',
                                    padding: '6px 8px',
                                    backgroundColor: '#ffffff',
                                    borderLeft: '3px solid #3a4efc',
                                    borderRadius: '4px',
                                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                  }}
                                >
                                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                                    <strong style={{ color: '#000080' }}>
                                      {act.action || act.Action || 'Action Recorded'}
                                    </strong>
                                    <span style={{ color: '#64748b', fontSize: '0.75rem' }}>
                                      {act.date || act.timestamp || act.Timestamp || ''}
                                    </span>
                                  </div>
                                  {(act.name || act.user || act.By) && (
                                    <div style={{ color: '#64748b', fontSize: '0.72rem', fontStyle: 'italic' }}>
                                      By: {act.name || act.user || act.By}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {validationIR?.status === 'Closed' && (
                  <span className="modal-hint-text">
                    * You can still file this report anytime via the trip's action history or details panel.
                  </span>
                )}

                <div className="incident-report-prompt-modal-actions">
                  <button
                    className="btn-create-now"
                    onClick={() => {
                      setIsIncidentModalOpen(true);
                      setShowIncidentPrompt(false);
                      setIrFormVisible(true);
                      irShortBagsForm.current?.validate();
                    }}
                  >
                    {validationIR?.status === 'Closed' ? `View Report` : `Process Now`}
                  </button>
                </div>
              </div>
            </Modal>
          )}

          <div style={{ display: 'None' }}>
            <IncidentReportForm
              OE={formData.OE}
              ref={incidentFormRef}
              onClose={() => setIsIncidentModalOpen(false)}
              onSubmit={async (data) => {
                console.log("Saving incident:", data);
                setIsIncidentModalOpen(false)
              }}
              ReportBy={editingUser?.FullName || 'Unknown User'}
              ReporterPosition={editingUser?.Position}
              employeeDetails={{
                EmployeeName: formData.Driver,
                EmployeeID: '123',
                EmployeePosition: 'Driver',
                EmployeeBUHead: '',
                EmployeeTractor: formData.Head_Full,
                EmployeeTrailer: formData.BO_Full,
                flexValue: actualDiscrepancy ? actualDiscrepancy : discrepancy,
              } as CreateIR_EmployeeDetails}
              preFill={{
                tripReferenceNo: formData.OE,
                Customer: formData.Customer,
                TripGroup: formData._tripGroup,
                CementType: formData.cementType,
                Source: formData.Source,
                Destination: formData.Destination,
                ServedDate: new Date(servedDate).toISOString(),
                QtyDelivered: formData.QTYDelivered,
                QtyWithdrawn: formData.QTYWithdrawn,
                ShortBags: discrepancy,
                ActualQtyWithdrawn: formData.QTYWithdrawn_Actual,
                ActualQtyDelivered: formData.QTYDelivered_Actual,
                ActualShortBags: actualDiscrepancy,
                ServedBy: editingUser?.FullName,
                VerifiedBy: formData.Verified_x0020_By,
              } as IR_ShortBags_Form_Model}
            />
          </div>




          {/* ==========================================================================
          PRIMARY WORKSPACE WORKFLOW MODAL
          ========================================================================== */}
          {isIncidentModalOpen && (

            <Modal
              onClose={handleConfirmIRClose}
              height="100%"
              overlayBlur={4}
              overlayColor="rgba(11, 19, 43, 0.4)"
              hideX={true}
              hidden={!irFormVisible}
              preventClickOutside={true}
            >
              {isCreatingIR ? (
                <div className="ir-modal-loading-container">
                  <div className="ir-modal-loading-spinner" />
                  <p className="ir-modal-loading-text">Generating Incident Report, please wait...</p>
                </div>
              ) : (
                <IR_ShortBags_Form
                  ref={irShortBagsForm}
                  incidentReportItem={createdIR as Partial<OP_IncidentReports>}
                  initialUser={editingUser ?? undefined}
                  hideCloseBtn={true}
                  onClose={(skip?: boolean) => {
                    if (createdIR?.ResolvedDate) handleConfirmIRClose(true);
                    else handleConfirmIRClose(skip)
                  }}
                  onSubmit={(data: any) => {
                    console.log("Submitted successfully");
                    handleForceCloseIR();
                    handleUpdateTruckTrailerIRdetails({ data });
                  }}
                  onSave={(data: any, closeAfter: boolean = true) => {
                    console.log("Saved successfully");
                    if (closeAfter !== false) {
                      handleForceCloseIR();
                    }
                    handleUpdateTruckTrailerIRdetails(data);
                  }}
                  onDelete={() => { handleDeleteIR(); }}
                  onValidateReady={(validationResult) => { setValidationIR(validationResult); }}
                  hidden={!irFormVisible}
                />
              )}

            </Modal>

          )}

          {isConfirmIRCloseOpen && (
            <Modal
              onClose={() => setIsConfirmIRCloseOpen(false)} // Clicking backdrop turns off the warning layer
              height="auto"
              overlayBlur={6} // Slightly high blur depth emphasizes structural focal priority
              overlayColor="rgba(11, 19, 43, 0.6)" // Darker navy overlay focus tint
              hideX={true}
              width={'35%'}
            >
              <div className="ir-confirm-prompt-box">
                <h3 className="ir-confirm-title">Are you done editing?</h3>
                <p className="ir-confirm-body">
                  Are you sure you want to exit? Any unsaved changes will be lost.
                </p>
                <p className="ir-confirm-body-hint">
                  You may still edit this later on Incident Reports Page.
                </p>

                <div className="ir-confirm-actions">
                  <button
                    type="button"
                    className="ir-confirm-btn btn-keep"
                    onClick={() => setIsConfirmIRCloseOpen(false)}
                  >
                    Continue Editing
                  </button>
                  <button
                    type="button"
                    className="ir-confirm-btn btn-discard"
                    onClick={handleForceDiscardIR}
                  >
                    I'm Done
                  </button>
                </div>
              </div>
            </Modal>
          )}




          {/* TRIP HISTORY TIMELINE MODAL */}
          {isTimelineOpen && (
            <Modal
              onClose={() => setIsTimelineOpen(false)}
              width="35%" // Slightly wider than the IR form to accommodate the timeline layout
            >
              <div className="odform-create-ir-modal-header">
                Trip Logs History: {selectedTimelineOE}
              </div>

              <div style={{
                padding: '5px',
                height: '70vh', // Fixed height for the modal content area
                display: 'flex',
                flexDirection: 'column'
              }}>
                {isLoadingLogs ? (
                  <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '10px' }}>
                    <Loader2 className="animate-spin" size={32} color="#000080" />
                    <span style={{ color: '#000080', fontWeight: 600 }}>Retrieving Trip History...</span>
                  </div>
                ) : (
                  <TripTimeline
                    logs={tripLogs}
                    oeReference={selectedTimelineOE}
                  />
                )}
              </div>

              <div className="sticky-footer order-dist-footer">
                <button className="btn-cancel" style={{ width: '100%' }} onClick={() => setIsTimelineOpen(false)}>
                  Close History
                </button>
              </div>
            </Modal>
          )}

          {bannerMessage && (
            <AutoDismissBanner
              message={bannerMessage}
              onClose={() => setBannerMessage(null)}
            />
          )}



        </div >

      </>


    );
  }
);

export default OrderDistributionForm;