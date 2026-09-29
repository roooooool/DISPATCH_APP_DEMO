import React, { forwardRef, useEffect, useState, useImperativeHandle, useMemo } from 'react';
import { createPortal } from 'react-dom';
//@ts-ignore
import { Printer, ZoomIn, ZoomOut, RotateCcw, FileImage, Maximize2, ChevronLeft, ChevronRight, ThumbsDown, Sun, Moon, DeleteIcon, CheckCheck, CheckCircle, XCircle } from 'lucide-react'; // Clear, modern utility icons
import '../components/comp_css/IR_ShortBags_Form.css';
import { type OP_IncidentReports } from '../generated/models/OP_IncidentReportsModel';
import { OP_IncidentReportsService } from '../generated/services/OP_IncidentReportsService';
import Modal from './ewul_Modal';
import gsdcLogo from "../../public/logo/logo-trimmed.png";

//utils
import { useTaskWorker } from '../utils/TaskWorkerContext';


// truth
import {
  type UserInfo,
  IR_ACTION_OPTIONS
} from '../truth.config';

export type FormUserInfo = {
  BusinessUnit: string;
  Position: string;
  id: string;
  FullName?: string;
};

export type ActionEntry = {
  name: string;
  action: string;
  date: string;
  bags?: number | string;
};

export type IR_Actions_Model = {
  operations: ActionEntry;
  supervisor: ActionEntry;
  inspection: ActionEntry;
  yard: ActionEntry;
  warehouse: ActionEntry;
};

export type IR_ShortBags_Form_Model = {
  // IR details
  irReferenceNo: string;
  tripReferenceNo: string;
  irType: string;
  irAction: string;
  irApproval?: string;
  actions?: IR_Actions_Model;
  dateResolved: string;
  date: string;


  // FORM details

  // reported detailes
  empName: string;
  empId: string;
  empPosition: string;
  businessUnit: string;
  buHead: string;
  truck_full: string;
  trailer_full: string;

  // incident details
  Customer: string;
  Source: string;
  Destination: string;
  TripGroup: string;
  QtyWithdrawn: number;
  QtyDelivered: number;
  ShortBags: number;
  ActualQtyWithdrawn: number;
  ActualQtyDelivered: number;
  ActualShortBags: number;
  RetrievedBags: number;
  CementType: string;
  ServedDate: string;

  ServedBy: string;
  VerifiedBy: string;

  incident_date: string;
  incident_time: string;
  incident_details: string;



  // other details
  yard: string;
  yardOthers: string;

  // reporter details
  reportDate: string;
  reportName: string;
  reportPosition: string;
  reportDept: string;

  resolvedBy: string;


  attachedImages?: {
    src: string;        // Holds the Base64/Blob url data string
    fileName: string;
    description: string; // Dynamic input value field
  }[];

};

export interface StatusValidationState {
  valid: boolean;
  msg: string;
  final?: boolean;
  status: 'Closed' | 'Open';
}

export interface IR_ShortBags_FormRef {
  save: () => Promise<Partial<IR_ShortBags_Form_Model>>;
  submit: () => Promise<Partial<IR_ShortBags_Form_Model>>;
  validate: (
    externalData?: Partial<IR_ShortBags_Form_Model> | OP_IncidentReports
  ) => StatusValidationState | null;
}

interface IR_ShortBags_Props {
  initialUser?: FormUserInfo | UserInfo;
  incidentReportItem: Partial<OP_IncidentReports>;
  hideCloseBtn?: boolean;
  onClose?: (skip?: boolean) => void;
  onSubmit?: (data: Partial<IR_ShortBags_Form_Model>) => void; // Updated type
  onSave?: (data: Partial<IR_ShortBags_Form_Model>) => void; // Added for save functionality
  onDelete?: (data: Partial<IR_ShortBags_Form_Model>) => void;
  onValidateReady?: (result: StatusValidationState | null) => void;
}

export const mapIncidentReportToFormModel = (
  incidentReportItem?: Partial<OP_IncidentReports> | null
): Partial<IR_ShortBags_Form_Model> => {
  // Safe fallback if incidentReportItem is null/undefined
  if (!incidentReportItem) {
    return {};
  }

  // Safely parse reportJSON string
  let jsonDetails: any = {};
  try {
    jsonDetails = incidentReportItem.reportJSON
      ? JSON.parse(incidentReportItem.reportJSON)
      : {};
  } catch (e) {
    console.error("Failed to parse reportJSON in validator mapper", e);
  }

  const actions = jsonDetails.actions;

  return {
    irReferenceNo: incidentReportItem.IRID || '',
    tripReferenceNo: incidentReportItem.OE_Reference || jsonDetails.tripReferenceNo || '',
    irType: incidentReportItem.IncidentType || '',
    irAction: incidentReportItem.ActionStatus || '',
    dateResolved: incidentReportItem.IRStatus === 'Resolved' && incidentReportItem.ResolvedDate
      ? new Date(incidentReportItem.ResolvedDate).toISOString().slice(0, 10)
      : '',
    date: incidentReportItem.CreatedDateTime
      ? new Date(incidentReportItem.CreatedDateTime).toISOString().slice(0, 10)
      : '',

    empName: incidentReportItem.EmployeeName || '',
    empId: incidentReportItem.EmployeeID || '',
    empPosition: incidentReportItem.EmployeePosition || '',
    businessUnit: incidentReportItem.EmployeeBU || '',
    buHead: incidentReportItem.EmployeeBUHead || '',
    truck_full: incidentReportItem.EmployeeTractor || '',
    trailer_full: incidentReportItem.EmployeeTrailer || '',

    Customer: jsonDetails.Customer || '',
    Source: jsonDetails.Source || '',
    Destination: jsonDetails.Destination || '',
    TripGroup: jsonDetails.TripGroup || '',
    QtyWithdrawn: jsonDetails.QtyWithdrawn || 0,
    QtyDelivered: jsonDetails.QtyDelivered || 0,
    ShortBags: jsonDetails.ShortBags || (jsonDetails.QtyWithdrawn ? (jsonDetails.QtyDelivered || 0) - jsonDetails.QtyWithdrawn : 0),
    ActualQtyDelivered: jsonDetails.ActualQtyDelivered || 0,
    ActualQtyWithdrawn: jsonDetails.ActualQtyWithdrawn || 0,
    ActualShortBags: jsonDetails.ActualShortBags || 0,
    ServedBy: jsonDetails.ServedBy || '',
    VerifiedBy: jsonDetails.VerifiedBy || '',
    RetrievedBags: jsonDetails.RetrievedBags,
    CementType: jsonDetails.CementType || '',
    ServedDate: jsonDetails.ServedDate ? new Date(jsonDetails.ServedDate).toISOString().slice(0, 10) : '',
    incident_date: jsonDetails?.incident_date
      ? new Date(jsonDetails.incident_date).toISOString().slice(0, 10)
      : jsonDetails?.ServedDate
        ? new Date(jsonDetails.ServedDate).toISOString().slice(0, 10)
        : '',
    incident_time: jsonDetails.incident_time || '',
    incident_details: jsonDetails.incident_details || '',
    yard: jsonDetails.yard || '',
    yardOthers: jsonDetails.yardOthers || '',
    reportDate: jsonDetails.reportDate || '',
    reportName: incidentReportItem.ReportedBy || '',
    reportPosition: incidentReportItem.ReporterPosition,
    reportDept: '',
    resolvedBy: incidentReportItem.ResolvedBy,

    attachedImages: jsonDetails.attachedImages || [],

    actions: actions || {
      operations: {
        name: incidentReportItem.ReportedBy || '',
        action: actions?.operations?.action || '',
        date: incidentReportItem.CreatedDateTime ? new Date(incidentReportItem.CreatedDateTime).toISOString().slice(0, 10) : ''
      },
      supervisor: { name: '', action: '', date: '' },
      inspection: { name: '', action: '', date: '' },
      yard: { name: '', action: '', bags: '', date: '' },
      warehouse: { name: '', action: '', bags: '', date: '' },
    },

    irApproval: jsonDetails.irApproval
  };
};

const IR_ShortBags_FormRender = forwardRef<IR_ShortBags_FormRef, IR_ShortBags_Props>(
  ({ initialUser, incidentReportItem: item, onClose, onSubmit, onSave, onDelete, onValidateReady, hideCloseBtn }, ref) => {

    const { addTask } = useTaskWorker();




    const incidentReportItem = item || {};



    const [zoom, setZoom] = useState<number>(1.0); // 1.0 = 100% original scale
    const jsonDetails = (incidentReportItem && incidentReportItem.reportJSON)
      ? (JSON.parse(incidentReportItem.reportJSON) as Partial<IR_ShortBags_Form_Model>)
      : ({} as Partial<IR_ShortBags_Form_Model>);

    const actions = jsonDetails.actions;
    useEffect(() => {
      console.log('Mounted - actions:', actions);
    }, []);

    const [formData, setFormData] = useState<Partial<IR_ShortBags_Form_Model>>(
      mapIncidentReportToFormModel(incidentReportItem)
    );


    // 1. Create a reference to store the initial snapshot
    const initialFormDataRef = React.useRef<string>(JSON.stringify(formData));

    // 2. Track whether the form has unsaved changes
    const isDirty = useMemo(() => {
      return JSON.stringify(formData) !== initialFormDataRef.current;
    }, [formData]);

    // 3. State to control the discard confirmation modal
    const [showDiscardModal, setShowDiscardModal] = useState(false);



    // Filter options matching section type OR options without a specific type (accessible to all)
    const getSectionActionOptions = (sectionType: string) => {
      return IR_ACTION_OPTIONS.filter(
        option => !option.type || option.type.toLowerCase() === sectionType.toLowerCase()
      );
    };

    interface errorInterface { valid: boolean, msg: string, final?: boolean };
    const [error, setError] = useState<errorInterface | null>(null);
    const validateForm = (currentData = formData): errorInterface | null => {

      if (!currentData.incident_date) { return { valid: false, msg: "Incident date is required." }; }
      if (currentData.incident_time) {
        // Check Time Format
        const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/;
        if (!timeRegex.test(currentData.incident_time)) {
          return { valid: false, msg: "Please provide a valid 24-hour clock timestamp format (HH:MM AM/PM)." };
        }
        // Chech Time range
        const [hours, minutes] = currentData.incident_time.split(':').map(Number);
        if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
          return { valid: false, msg: "The provided clock hour boundaries are outside permissible ranges." };
        }
      }


      const sb = initialUser?.Position == 'Coor'
        ? (currentData.ShortBags ?? 0)
        : (currentData.ActualShortBags ?? currentData.ShortBags ?? 0);
      const act = currentData.actions?.operations?.action || '';
      const pos = initialUser?.Position || '';
      const att = currentData.attachedImages;

      // OPERATIONS
      if (!act.trim()) return { valid: false, msg: "Operation action is required." };

      if (["Coor"].includes(pos) && (!att || att.length === 0) && sb < -5.0 && act == 'PROCEED TO NEXT TRIP') {
        return { valid: false, msg: "Short bags is greater than 5, You must append at least one asset picture file as documentation evidence." };
      }

      //Supervisor
      if (["Supervisor"].includes(pos) && currentData.actions?.supervisor?.action == null) {
        return { valid: false, msg: "Supervisor action is required" };
      }


      return { valid: true, msg: "You may now save your changes.", final: true }

    };

    useEffect(() => {
      // Validate initial formData once on component mount
      const result = validateForm(formData);
      setError(result);

      const statusResult: StatusValidationState = {
        valid: result?.valid ?? false,
        msg: result?.msg ?? '',
        final: result?.final,
        status: calculateIRStatus(formData),
      };

      onValidateReady?.(statusResult);
    }, []); // Empty dependency array ensures this runs exactly once after mountin

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const { name, value } = e.target;
      const nextState = { ...formData, [name]: value };

      setFormData(nextState);
      setError(validateForm(nextState));

      // console.log('action taken changed: ' , formData);
    };

    const handleActionChange = (
      section: keyof IR_Actions_Model,
      field: keyof ActionEntry,
      value: string | number
    ) => {
      setFormData(prev => {
        // 1. Get current section data
        const currentSection = prev.actions?.[section] || { name: '', action: '', date: '' };

        // 2. Prepare base updates for the current section
        const sectionUpdates: Partial<ActionEntry> = {
          ...currentSection,
          [field]: value
        };

        const todayISO = new Date().toISOString().slice(0, 10);

        // Auto-fill supervisor name & date if action changed
        if (field === 'action' && value) {
          if (!currentSection.name && initialUser?.FullName) {
            sectionUpdates.name = initialUser.FullName;
          }
          if (!currentSection.date) {
            sectionUpdates.date = todayISO;
          }
        }

        // 3. Build updated actions map
        let updatedActions: IR_Actions_Model = {
          ...prev.actions,
          [section]: sectionUpdates
        } as IR_Actions_Model;

        // Check what value getSectionActionOptions('Inspection') actually uses:
        const inspectionRetrievalOption = getSectionActionOptions('Inspection')
          .find(opt => opt.value.toUpperCase().includes('RETRIEVAL'));

        const targetValue = inspectionRetrievalOption ? inspectionRetrievalOption.value : 'FOR RETRIEVAL';

        if (section === 'supervisor' && field === 'action' && value === 'FOR RETRIEVAL') {
          console.log('syncing inspec too!', targetValue);
          const currentInspection = prev.actions?.inspection || { name: '', action: '', date: '' };

          updatedActions = {
            ...updatedActions,
            inspection: {
              ...currentInspection,
              action: targetValue, // Uses the exact value key from Inspection options
              date: currentInspection.date || todayISO,
              name: currentInspection.name || ''
            }
          };
        }

        // Maintain backwards compatibility with irAction if Operations action changes
        const updatedIrAction = section === 'operations' && field === 'action'
          ? String(value)
          : prev.irAction;

        const nextState = {
          ...prev,
          irAction: updatedIrAction,
          actions: updatedActions
        };

        setError(validateForm(nextState));
        return nextState;
      });
    };

    const handleCheckbox = (yardName: string) => {
      const nextState = { ...formData, yard: yardName };

      setFormData(nextState);
      setError(validateForm(nextState));
    };

    const handleRemoveAttachedImage = (idx: number) => {
      const nextState = { ...formData, attachedImages: formData.attachedImages?.filter((_, itemIdx) => itemIdx !== idx) };
      setFormData(nextState);
      setError(validateForm(nextState));
    };

    const handlePrint = () => {
      // 1. Locate the exact document container element
      const printContent = document.querySelector('.ir-sb-document');
      if (!printContent) return;

      // 2. Capture the actual user text value from the state
      const currentDetailsText = formData.incident_details || '';

      // 3. Calculate your dynamic inline height exactly like your React component does
      const calculatedTextareaHeight = `${LINE_COUNT_LIMIT * 30}px`;

      // 4. Create a temporary hidden iframe element
      const iframe = document.createElement('iframe');
      iframe.style.position = 'absolute';
      iframe.style.width = '0px';
      iframe.style.height = '0px';
      iframe.style.border = 'none';
      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentWindow?.document;
      if (!iframeDoc) return;

      iframeDoc.open();
      iframeDoc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Incident Report</title>
          <link rel="stylesheet" type="text/css" href="/src/components/comp_css/IR_ShortBags_Form.css">
          <style>
            /* 1. HIDE HEADERS AND FOOTERS */
            @page {
              margin: 0;
            }

            body {
              margin: 0;
              padding: 1.5cm;
              background: #ffffff;
              -webkit-print-color-adjust: exact;
            }

            /* 2. ENSURE CONTENT FITS */
            .ir-sb-document {
              width: 100% !important;
              max-width: 100% !important;
              box-shadow: none !important;
              border: none !important;
              padding: 0 !important;
              margin: 0 !important;
              transform: none !important;
            }

            /* 3. CLEAN UP FORM ELEMENTS FOR PAPER */
            input, textarea {
              outline: none !important;
              border: none !important;
              border-bottom: 1px solid #000000 !important;
              background: transparent !important;
              font-family: inherit;
              font-size: inherit;
            }

            /* FORCE TEXTAREA STYLING AND EXPANSION IN PRINT */
            textarea.ir-sb-textarea {
              width: 100% !important;
              height: ${calculatedTextareaHeight} !important; /* Dynamically sets total notepad block depth */
              border: none !important;
              outline: none !important;
              padding: 0 0 0 10px !important; /* Flushes padding left for the red margin rule */
              overflow: hidden !important;
              resize: none !important;
              font-family: inherit !important;
              font-size: inherit !important;
              
              /* Match line height parameters precisely */
              line-height: 30px !important; 
              
              /* BAKE NOTEPAD RULES FOR PRINTER ENGINE RENDERING */
              background-image: linear-gradient(#e1e1e1 1px, transparent 1px) !important;
              background-size: 100% 30px !important;
              background-attachment: local !important;
              background-color: transparent !important;
              
              /* RED NOTEPAD MARGIN LINE */
              border-left: 2px solid rgba(255, 0, 0, 0.4) !important; /* Slightly bumped opacity for crisp printing */
              
              /* PREVENTS BROWSER PRINT ENGINE FROM OVERRIDING LIGHT COLOURED LINES */
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              forced-color-adjust: none !important; 
            }

            /* Hide 'mm/dd/yyyy' placeholders */
            input[type="date"]:invalid::-webkit-datetime-edit,
            input[type="date"]:not([value])::-webkit-datetime-edit,
            input[type="time"]:invalid::-webkit-datetime-edit,
            input[type="time"]:not([value])::-webkit-datetime-edit {
                color: transparent !important;
            }

            input[type="date"]::-webkit-datetime-edit-month-field,
            input[type="date"]::-webkit-datetime-edit-day-field,
            input[type="date"]::-webkit-datetime-edit-year-field,
            input[type="time"]::-webkit-datetime-edit-hour-field,
            input[type="time"]::-webkit-datetime-edit-minute-field,
            input[type="time"]::-webkit-datetime-edit-ampm-field {
                color: inherit;
            }

            /* FORCE 2ND PAGE BREAK FOR PRINTER ENGINES */
            .ir-sb-page-break {
              page-break-before: always !important;
              break-before: page !important;
              margin-top: 1.5cm !important; /* Resets structural top spacing on the fresh page */
            }

            /* RE-RENDER HEADER ACCENTS ON 2ND PAGE */
            .ir-sb-print-page-header {
              display: none !important; /* Hidden on desktop screens */
            }

            /* IMAGE FLEX CARDS PRINT CONFIGURATION */
            .ir-sb-print-image-container {
              display: grid !important;
              grid-template-columns: repeat(2, 1fr) !important; /* Clean 2x2 grid layout on physical sheets */
              gap: 15px !important;
              width: 100% !important;
              margin-top: 20px !important;
            }

            .ir-sb-print-img-card {
              border: 1px solid #e1e1e1 !important;
              border-radius: 6px !important;
              padding: 5px !important;
              text-align: center !important;
              page-break-inside: avoid !important; /* Prevents an image from ripping across sheets */
              break-inside: avoid !important;
            }

            .ir-sb-print-img-card img {
              max-width: 100% !important;
              height: auto !important;
              max-height: 8cm !important; /* Prevents massive source images from stretching the page count */
              object-fit: contain !important;
            }

            @media print {
              .ir-sb-print-page-header {
                display: block !important; /* Only shows when translating layout to physical paper matrix */
                margin-bottom: 20px !important;
                border-bottom: 2px solid #3a4efc !important; /* Uses your secondary blue line divider accent */
                padding-bottom: 5px !important;
              }
              
              .ir-sb-print-page-header h2 {
                font-size: 14px !important;
                color: #000080 !important; /* Navy Blue branding primary */
                margin: 0 !important;
              }
            }

            /* Target the webkit datetime internal layout wrapper when your empty class is active */
            input.is-empty-print::-webkit-datetime-edit {
                color: transparent !important;
            }

            /* Fallback protection for specific printing engine variations */
            input.is-empty-print {
                color: transparent !important;
            }

            /* ==========================================================================
              FLEXBOX MATRIX OVERRIDES FOR PRINT ENGINES
              ========================================================================== */
            .ir-sb-meta-row {
              display: flex !important;
              flex-direction: row !important;
              width: 100% !important;
              gap: 20px !important; /* Clean structural spacing on sheets */
              margin-bottom: 12px !important;
            }


            /* Force the 2/3rds ratio layout rule explicitly */
            .ir-sb-meta-row .flex-2 {
              flex: 2 2 66.66% !important;
              width: 66.66% !important;
              max-width: 66.66% !important;
            }

            /* Force the 1/3rd ratio layout rule explicitly */
            .ir-sb-meta-row .flex-1 {
              flex: 1 1 33.33% !important;
              width: 33.33% !important;
              max-width: 33.33% !important;
            }

            /* Ensure underlying inner inputs stretch completely to fill their relative ratio box */
            .ir-sb-input-group .ir-sb-line-input {
              flex: 1 !important;
              width: 100% !important;
            }

          </style>
        </head>
        <body>
          <div class="ir-sb-document">
            ${printContent.innerHTML}
          </div>

          <script>
            // 5. INJECT USER CONTENT DIRECTLY INTO THE IFRAME TEXTAREA ROW AFTER CLONING
            const printedTextarea = document.querySelector('.ir-sb-textarea');
            if (printedTextarea) {
                printedTextarea.value = \`${currentDetailsText.replace(/`/g, '\\`').replace(/\${/g, '\\${')}\`;
            }
          </script>
        </body>
      </html>
    `);
      iframeDoc.close();

      // 4. Ensure input values are transferred over (innerHTML doesn't copy current live state text values)
      const sourceInputs = printContent.querySelectorAll('input, textarea, select');
      const iframeInputs = iframeDoc.querySelectorAll('input, textarea, select');

      sourceInputs.forEach((input: any, index: number) => {
        // CRITICAL FIX: Skip file inputs entirely to prevent security value truncation crash
        if (input.type === 'file') {
          return;
        }

        if (input.type === 'checkbox' || input.type === 'radio') {
          (iframeInputs[index] as HTMLInputElement).checked = input.checked;
        } else {
          if (iframeInputs[index]) {
            (iframeInputs[index] as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value = input.value;
          }
        }
      });

      // 5. Wait for the styles/assets inside the iframe to load fully before opening the print prompt
      iframe.contentWindow?.focus();

      // Give the browser engine a microtask tick to process asset links securely
      setTimeout(() => {
        iframe.contentWindow?.print();
        // 6. Clean up after yourself by destroying the node element from the DOM tree
        document.body.removeChild(iframe);
      }, 250);
    };

    // Image Viewer Modal States
    const [selectedPreviewImg, setSelectedPreviewImg] = useState<{ src: string; fileName: string } | null>(null);
    const [previewZoom, setPreviewZoom] = useState<number>(1);
    const [previewRotation, setPreviewRotation] = useState<number>(0);

    // Helper handlers to constrain or manipulate image bounds cleanly
    const handleModalZoomIn = () => setPreviewZoom(prev => Math.min(prev + 0.25, 3)); // Max 3x zoom
    const handleModalZoomOut = () => setPreviewZoom(prev => Math.max(prev - 0.25, 0.5)); // Min 0.5x zoom
    const handleModalRotate = () => setPreviewRotation(prev => (prev + 90) % 360); // Increments by 90 deg

    const handleImgWheelZoom = (e: React.WheelEvent) => {
      // e.deltaY < 0 means rolling the wheel forward (Zoom In)
      // e.deltaY > 0 means rolling the wheel backward (Zoom Out)
      if (e.deltaY < 0) {
        // Zoom In: Constrain to max 3x
        setPreviewZoom(prev => Math.min(prev + 0.15, 3));
      } else {
        // Zoom Out: Constrain to min 0.5x
        setPreviewZoom(prev => Math.max(prev - 0.15, 0.5));
      }
    };

    const [isDragging, setIsDragging] = useState(false);

    // Workspace Image Panning States
    const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const [isDraggingImage, setIsDraggingImage] = useState<boolean>(false);
    const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

    // Handle mouse down event inside image frame canvas
    const handleImgMouseDown = (e: React.MouseEvent) => {
      e.preventDefault(); // Prevents browser image ghost duplication
      setIsDraggingImage(true);
      // Store the starting mouse coordinates adjusted by previous offsets
      setDragStart({
        x: e.clientX - panOffset.x,
        y: e.clientY - panOffset.y
      });
    };

    // Handle moving the mouse cursor inside image frame canvas
    const handleImgMouseMove = (e: React.MouseEvent) => {
      if (!isDraggingImage) return;
      // Calculate new coordinates relative to start position
      setPanOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    };

    // Handle releasing or exiting the drag boundary action
    const handleImgMouseUpOrLeave = () => {
      setIsDraggingImage(false);
    };

    // Update your existing handleModalReset to clear panning values too!
    const handleModalReset = () => {
      setPreviewZoom(1);
      setPreviewRotation(0);
      setPanOffset({ x: 0, y: 0 }); // Reset position to absolute center
    };

    const LINE_COUNT_LIMIT = 3
    const handleNewLine = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const detalyeNgInsidenteValue = formData.incident_details || '';
      const lineCount = (detalyeNgInsidenteValue.match(/\n/g) || []).length + 1;
      if (e.key === 'Enter') {
        if (lineCount >= LINE_COUNT_LIMIT) {
          e.preventDefault();
        }
      }
    };

    // Zoom Handler functions
    const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.1, 1.5));  // Cap zoom maximum at 150%
    const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.1, 0.7)); // Cap zoom minimum at 70%
    const handleResetZoom = () => setZoom(1.0);

    const [isActionsBarExpanded, setIsActionsBarExpanded] = useState<boolean>(true);
    const [isCanvasDarkMode, setIsCanvasDarkMode] = useState<boolean>(() => {
      // 1. Check if the application uses a data attribute on the html element (e.g., <html data-theme="dark">)
      const htmlTheme = document.documentElement.getAttribute('data-theme');
      if (htmlTheme) {
        return htmlTheme === 'dark';
      }

      // 2. Fallback: Check if the application appends a class to the body or html tag (e.g., <body className="dark-theme">)
      const hasDarkClass = document.documentElement.classList.contains('dark') ||
        document.body.classList.contains('dark') ||
        document.body.classList.contains('dark-theme');
      if (hasDarkClass) {
        return true;
      }

      // 3. Fallback: Check the user's operating system hardware level media query preference
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return true;
      }

      // Default fallback if no theme configuration is detected
      return false;
    });


    // Form is read-only if incidentReportItem already has a ResolvedDate (Completed Date) 
    // or if formData.dateResolved is populated.
    const isReadOnly = Boolean(
      incidentReportItem.ResolvedDate || formData.dateResolved
    );



    const isSectionEditable = (sectionName: string): boolean => {
      if (isReadOnly) return false; // Lock out section editing if form is read-only

      const userPosition = initialUser?.Position || initialUser?.Position || '';

      const permissions: Record<string, string[]> = {
        Operations: ['Coor', 'OD', 'Developer'],
        Supervisor: ['Supervisor', 'OD', 'Developer'],
        Inspection: ['Inspection', ''],
        Yard: ['Yard', ''],
        Warehouse: ['Warehouse', '']
      };

      const allowedPositions = permissions[sectionName] || [];
      return allowedPositions.includes(userPosition);
    };

    const handleSave = () => {
      if (onSave && !isReadOnly) {
        addTask({
          id: `saveir-${incidentReportItem.IRID}`,
          name: `Saving Incident Details for ${incidentReportItem.IRID}`,
          execute: async () => {
            let result = null
            try {
              console.log("Submitting incident report");

              if (incidentReportItem.IncidentID === undefined) return;

              let ir_details = {
                OE_Reference: formData.tripReferenceNo,
                EmployeeName: formData.empName,
                EmployeeID: formData.empId,
                EmployeeBU: formData.businessUnit,
                EmployeeTractor: formData.truck_full,
                EmployeeTrailer: formData.trailer_full,
                flexValue: formData.ShortBags,
                ModifiedBy: initialUser?.FullName,
                ModifiedDateTime: new Date().toISOString(),
              } as Omit<Partial<OP_IncidentReports>, "IncidentID">;

              if (calculatedStatus === 'Closed') {
                ir_details.IRStatus = 'Closed';
                ir_details.ResolvedDate = new Date().toISOString().slice(0, 10);
              }

              console.log(`Saving IR [${incidentReportItem.IncidentID}]: `, { ...ir_details, ActionStatus: formData.irAction, reportJSON: JSON.stringify(formData) });

              result = await OP_IncidentReportsService.update(incidentReportItem.IncidentID.toString(), { ...ir_details, ActionStatus: formData.irAction, reportJSON: JSON.stringify(formData) });
              console.log('Saving result: ', result)


              if (result.error) {
                throw new Error(result.error.message);
              }

              if (!result || !result.data) {
                throw new Error("Unexpected response from server: " + JSON.stringify(result));
              }

            } catch (error) {
              console.error("Failed to upload attendance records:", error);
              return { success: false, error };
            } finally {
              return { success: true, data: result };
            }
          },
          checkSuccess: (result: { success: boolean, data?: any, error?: any }) => {
            return result.success;
          },
          onSuccess: async (result: any) => {
            onSave(result.data.data);
            console.log(result);
          },
          onFailure: async (result: any) => {
            console.log(result);
          },
          message: `Saving...`,
          message_success: `Incident Report saved successfully for ${incidentReportItem.IRID}`,
          message_failure: `Failed to saved Incident Report for ${incidentReportItem.IRID}`,



        })
        if (onClose) onClose();
      }
    };

    const handleReOpen = () => {
      if (onSave) {
        addTask({
          id: `saveir-${incidentReportItem.IRID}`,
          name: `Saving Incident Details for ${incidentReportItem.IRID}`,
          execute: async () => {
            let result = null
            try {
              console.log("Submitting incident report");

              if (incidentReportItem.IncidentID === undefined) return;

              let ir_details = {
                OE_Reference: formData.tripReferenceNo,
                EmployeeName: formData.empName,
                EmployeeID: formData.empId,
                EmployeeBU: formData.businessUnit,
                EmployeeTractor: formData.truck_full,
                EmployeeTrailer: formData.trailer_full,
                flexValue: formData.ShortBags,
                ModifiedBy: initialUser?.FullName,
                ModifiedDateTime: new Date().toISOString(),
              } as Omit<Partial<OP_IncidentReports>, "IncidentID">;

              ir_details.IRStatus = 'Open';
              ir_details.ResolvedDate = '';

              console.log(`Saving IR [${incidentReportItem.IncidentID}]: `, { ...ir_details, ActionStatus: formData.irAction, reportJSON: JSON.stringify(formData) });

              result = await OP_IncidentReportsService.update(incidentReportItem.IncidentID.toString(), { ...ir_details, ActionStatus: formData.irAction, reportJSON: JSON.stringify(formData) });
              console.log('Saving result: ', result)


              if (result.error) {
                throw new Error(result.error.message);
              }

              if (!result || !result.data) {
                throw new Error("Unexpected response from server: " + JSON.stringify(result));
              }

            } catch (error) {
              console.error("Failed to upload attendance records:", error);
              return { success: false, error };
            } finally {
              return { success: true, data: result };
            }
          },
          checkSuccess: (result: { success: boolean, data?: any, error?: any }) => {
            return result.success;
          },
          onSuccess: async (result: any) => {
            onSave(result.data.data);
            console.log(result);
          },
          onFailure: async (result: any) => {
            console.log(result);
          },
          message: `Saving...`,
          message_success: `Incident Report saved successfully for ${incidentReportItem.IRID}`,
          message_failure: `Failed to saved Incident Report for ${incidentReportItem.IRID}`,
        })
        if (onClose) onClose();
      }
    };


    const calculateIRStatus = (formData: Partial<IR_ShortBags_Form_Model>): 'Closed' | 'Open' => {
      const opsAction = formData.actions?.operations?.action;
      const supAction = formData.actions?.supervisor?.action;
      const inspAction = formData.actions?.inspection?.action;
      const yardAction = formData.actions?.yard?.action;

      // Derive discrepancy (ShortBags)
      const withdrawn = formData.QtyWithdrawn || 0;
      const delivered = formData.QtyDelivered || 0;
      const discrepancy = formData.ShortBags ?? (delivered - withdrawn);

      // Check for attachments
      const hasAttachments = Boolean(formData.attachedImages && formData.attachedImages.length > 0);

      // 1. OPERATION WATERFALL RULE
      if (opsAction === 'PROCEED TO NEXT TRIP' && discrepancy < 0 && discrepancy > -5.0) {
        return 'Closed';
      }

      // 2. SUPERVISOR WATERFALL RULE
      if (opsAction === 'PROCEED TO NEXT TRIP' && hasAttachments && supAction === 'APPROVED') {
        return 'Closed';
      }

      // 3. INSPECTION WATERFALL RULE
      if (opsAction === 'FOR BULK INSPECTION' && supAction === 'APPROVED' && inspAction === 'CLEARED') {
        return 'Closed';
      }

      // 4. YARD WATERFALL RULE
      if (
        opsAction === 'FOR BULK INSPECTION' &&
        supAction === 'APPROVED' &&
        inspAction === 'FOR RETRIEVAL' &&
        (yardAction === 'FOR WAREHOUSE TRANSFER' || yardAction === 'FOR DISPOSAL')
      ) {
        return 'Closed';
      }

      if (opsAction == "FOR CLEANING") return 'Closed';

      // Default fallback if no conditions match
      return 'Open';
    };

    const calculatedStatus = useMemo(() => calculateIRStatus(formData), [formData]);



    const handleSubmit = () => {
      if (onSubmit) {

        addTask({
          id: `submitir-${incidentReportItem.IRID}`,
          name: `Submitting Incident Report for ${incidentReportItem.IRID}`,
          execute: async () => {
            let result = null
            try {
              console.log("Submitting incident report");

              if (incidentReportItem.IncidentID === undefined) return;

              const ir_details = {
                OE_Reference: formData.tripReferenceNo,
                EmployeeName: formData.empName,
                EmployeeID: formData.empId,
                EmployeeBU: formData.businessUnit,
                EmployeeTractor: formData.truck_full,
                EmployeeTrailer: formData.trailer_full,
                flexValue: formData.ShortBags,
                ModifiedBy: initialUser?.FullName,
                ModifiedDateTime: new Date().toISOString(),
                ResolvedDate: formData.date,
                ResolvedBy: initialUser?.FullName,
              } as Omit<Partial<OP_IncidentReports>, "IncidentID">;

              result = await OP_IncidentReportsService.update(incidentReportItem.IncidentID.toString(), { ...ir_details, ActionStatus: formData.irAction, IRStatus: 'Closed', reportJSON: JSON.stringify(formData) });

              if (result.error) {
                throw new Error(result.error.message);
              }

              if (!result || !result.data) {
                throw new Error("Unexpected response from server: " + JSON.stringify(result));
              }

            } catch (error) {
              console.error("Failed to upload attendance records:", error);
              return { success: false, error };
            } finally {
              return { success: true, data: result };
            }
          },
          checkSuccess: (result: { success: boolean, data?: any, error?: any }) => {
            return result.success;
          },
          onSuccess: async (result: any) => {
            onSubmit(result.data.data);
            console.log(result);
          },
          onFailure: async (result: any) => {
            console.log(result);
          },
          message: `Submitting...`,
          message_success: `Incident Report submitted successfully for ${incidentReportItem.IRID}`,
          message_failure: `Failed to submit Incident Report for ${incidentReportItem.IRID}`,



        })
        if (onClose) onClose();
      }
    };

    //@ts-ignore
    const handleReject = () => {
      if (onSubmit) {

        addTask({
          id: `rejectir-${incidentReportItem.IRID}`,
          name: `Rejecting Incident Report for ${incidentReportItem.IRID}`,
          execute: async () => {
            let result = null
            try {
              console.log("Submitting incident report");

              if (incidentReportItem.IncidentID === undefined) return;

              const ir_details = {
                OE_Reference: formData.tripReferenceNo,
                EmployeeName: formData.empName,
                EmployeeID: formData.empId,
                EmployeeBU: formData.businessUnit,
                EmployeeTractor: formData.truck_full,
                EmployeeTrailer: formData.trailer_full,
                flexValue: formData.ShortBags,
                ModifiedBy: initialUser?.FullName,
                ModifiedDateTime: new Date().toISOString(),
                ResolvedDate: formData.date,
              } as Omit<Partial<OP_IncidentReports>, "IncidentID">;

              result = await OP_IncidentReportsService.update(incidentReportItem.IncidentID.toString(), { ...ir_details, IRStatus: 'Cancelled', reportJSON: JSON.stringify(formData) });

              if (result.error) {
                throw new Error(result.error.message);
              }

              if (!result || !result.data) {
                throw new Error("Unexpected response from server: " + JSON.stringify(result));
              }

            } catch (error) {
              console.error("Failed to upload attendance records:", error);
              return { success: false, error };
            } finally {
              return { success: true, data: result };
            }
          },
          checkSuccess: (result: { success: boolean, data?: any, error?: any }) => {
            return result.success;
          },
          onSuccess: async (result: any) => {
            onSubmit(result.data.data);
            console.log(result);
          },
          onFailure: async (result: any) => {
            console.log(result);
          },
          message: `Rejecting...`,
          message_success: `Incident Report rejected successfully for ${incidentReportItem.IRID}`,
          message_failure: `Failed to reject Incident Report for ${incidentReportItem.IRID}`,



        })
        if (onClose) onClose();
      }
    };

    const handleDelete = () => {
      if (onDelete) {

        addTask({
          id: `deleteir-${incidentReportItem.IRID}`,
          name: `Deleting Incident Report for ${incidentReportItem.IRID}`,
          execute: async () => {
            try {
              console.log("Submitting incident report");

              if (incidentReportItem.IncidentID === undefined) return;


              await OP_IncidentReportsService.delete(incidentReportItem.IncidentID.toString());

            } catch (error) {
              console.error("Failed to upload attendance records:", error);
              return { success: false, error };
            } finally {
              return { success: true, data: { data: incidentReportItem } };
            }
          },
          checkSuccess: (result: { success: boolean, data?: any, error?: any }) => {
            return result.success;
          },
          onSuccess: async (result: any) => {
            onDelete(result.data.data);

            console.log('success', result.length);
          },
          onFailure: async (result: any) => {
            console.log('failed', result.length);
          },
          message: `Deleting...`,
          message_success: `Incident Report deleted successfully for ${incidentReportItem.IRID}`,
          message_failure: `Failed to delete Incident Report for ${incidentReportItem.IRID}`,

        })
        if (onClose) onClose(true);
      }
    };


    const handleCloseAttempt = () => {
      // If no changes were made or form is read-only, close immediately
      if (!isDirty || isReadOnly) {
        if (onClose) onClose();
      } else {
        // Show discard prompt modal
        setShowDiscardModal(true);
      }
    };

    useImperativeHandle(ref, () => ({
      save: async () => {
        // Return the current form state directly or perform saving logic
        if (onSave) {
          handleSave(); // Triggers the existing TaskWorker save flow
        }
        return formData;
      },
      submit: async () => {
        if (handleSubmit) {
          handleSubmit();
        }
        return formData;
      },
      validate: (externalData?: Partial<IR_ShortBags_Form_Model> | OP_IncidentReports) => {
        let targetData: Partial<IR_ShortBags_Form_Model>;

        if (!externalData) {
          // 1. Fall back to internal state
          targetData = formData;
        } else if ('IRID' in externalData || 'OE_Reference' in externalData || 'reportJSON' in externalData) {
          // 2. If it's OP_IncidentReports, map it to Form Model
          targetData = mapIncidentReportToFormModel(externalData as OP_IncidentReports);
        } else {
          // 3. It's already Partial<IR_ShortBags_Form_Model>
          targetData = externalData as Partial<IR_ShortBags_Form_Model>;
        }

        // Run validation on normalized form data
        const validationResult = validateForm(targetData);

        if (!validationResult) return null;

        return {
          ...validationResult,
          status: calculateIRStatus(targetData),
        };
      }
    }), [formData, onSave, handleSave, handleSubmit, validateForm]);


    useEffect(() => {
      setError(validateForm(formData));
    }, []);

    const getStatusColor = (status: string) => {
      let style: React.CSSProperties = { color: 'var(--color-muted)' };
      if (status === "Cancelled") style = { color: 'var(--color-border-warning)' };
      if (status === "Open") style = { color: 'var(--color-border-info)' };
      if (status === "Closed") style = { color: 'var(--color-border-success)' };
      style.fontWeight = 'bold';
      return { ...style, fontWeight: '800' } as React.CSSProperties;
    }

    return (
      <>
        <div className={`ir-sb-container ${isReadOnly ? 'is-readonly' : ''}`}>

          {isReadOnly && (
            <div className="ir-sb-readonly-banner no-print">
              <span>This report has been marked completed and is in <strong>Read-Only</strong> mode.</span>
            </div>
          )}


          {/* Screen-Only Action Header inside Modal */}
          <div className={`ir-sb-actions-bar no-print ${!isActionsBarExpanded ? 'collapsed' : ''}`}>
            {/* The Toggle Handle Button */}
            <button
              type="button"
              className="ir-sb-actions-toggle-handle"
              onClick={() => setIsActionsBarExpanded(!isActionsBarExpanded)}
              title={isActionsBarExpanded ? "Collapse Controls" : "Expand Controls"}
            >
              {isActionsBarExpanded ? (
                <ChevronRight size={18} strokeWidth={3} color='var(--color-primary)' />
              ) : (
                <ChevronLeft size={18} color='var(--color-text-2)' strokeWidth={3} />
              )}
            </button>

            {/* Wrapped controls inside a dedicated inner container */}
            <div className="ir-sb-actions-inner-content">
              {/* Collapsible Action Group */}
              {isActionsBarExpanded && (
                <>
                  {/* Zoom Control Group */}
                  <div className="ir-sb-zoom-controls">
                    {zoom !== 1.0 && (
                      <button type="button" onClick={handleResetZoom} className="ir-sb-btn ir-sb-zoom-btn reset" title="Reset Zoom">
                        <RotateCcw size={13} />
                      </button>
                    )}
                    <button type="button" onClick={handleZoomOut} className="ir-sb-btn ir-sb-zoom-btn" title="Zoom Out" disabled={zoom <= 0.7}>
                      <ZoomOut size={14} />
                    </button>
                    <span className="ir-sb-zoom-indicator">{Math.round(zoom * 100)}%</span>
                    <button type="button" onClick={handleZoomIn} className="ir-sb-btn ir-sb-zoom-btn" title="Zoom In" disabled={zoom >= 1.5}>
                      <ZoomIn size={14} />
                    </button>
                  </div>

                  <span className="ir-sb-actions-divider">|</span>

                  {/* Action Button Group */}
                  <button type="button" onClick={handlePrint} className="ir-sb-btn ir-sb-print-btn">
                    <Printer size={14} /> Print Report
                  </button>
                  <button disabled={!error?.valid || isReadOnly} type="button" onClick={handleSave} className="ir-sb-btn btn-save">
                    {(error?.valid && !isReadOnly) && <span className='ir-pulse-badge-save-btn no-print'>!</span>}
                    Save
                  </button>

                  {initialUser?.Position === 'Developer' && (
                    <button type="button" onClick={handleDelete} className="ir-sb-btn ir-sb-submit-btn btn-cancel">
                      <DeleteIcon size={14} /> Delete
                    </button>
                  )}

                  {(initialUser?.Position === 'Developer' && isReadOnly) && (
                    <button type="button" onClick={handleReOpen} className="ir-sb-btn ir-sb-submit-btn btn-cancel">
                      Re-Open
                    </button>
                  )}
                </>
              )}

              {/* Close button remains visible regardless of collapse state */}
              {(onClose && (!hideCloseBtn || isReadOnly)) && (
                <button type="button" onClick={handleCloseAttempt} className="ir-sb-btn ir-sb-close-btn">
                  Close
                </button>
              )}
            </div>
          </div>

          {/* Scrollable Document Wrapper[cite: 3] */}
          <div className="ir-sb-document-wrapper">

            <div
              className="ir-sb-document"
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: 'top center', // Ensures scaling stays anchored in the middle top position
                marginBottom: `${(zoom - 1) * 350}px` // Offsets the visual gap scaling creates at bottom layout boundaries
              }}
            >
              <div className="ir-sb-page ir-sb-page-1">
                {/* Header Section[cite: 3] */}
                <div className="ir-sb-header">
                  <div className="ir-sb-logo-container">
                    <img src={gsdcLogo} alt="GSDC Logo" className="ir-sb-logo-img" />
                  </div>

                  <div className="ir-sb-company-info">
                    <h2>GREAT SIERRA DEVELOPMENT CORPORATION</h2>
                    <p>Lot 2, Block 1, Grand Industrial Estate Subdivision Bo. Parulan Plaridel, Bulacan</p>
                    <h1>INCIDENT REPORT</h1>
                  </div>
                  <div className="ir-sb-header-spacer" aria-hidden="true" />

                </div>

                {/* Reference and Date[cite: 3] */}
                <div className="ir-sb-meta-row">
                  <div className="ir-sb-input-group flex-2">
                    <span className="ir-sb-label">IR Reference No:</span>
                    <input type="text" disabled name="irReferenceNo" value={formData.irReferenceNo} onChange={() => null} className="ir-sb-line-input" />
                  </div>
                  <div className="ir-sb-input-group flex-1">
                    <span className="ir-sb-label">Report Date:</span>
                    <input type="date" disabled name="date" value={formData.date} onChange={() => null} className={`ir-sb-line-input ${!formData.date ? 'is-empty-print' : ''}`} />
                  </div>
                </div>

                <div className="ir-sb-meta-row">
                  <div className="ir-sb-input-group flex-2">
                    <span className="ir-sb-label">Completed By:</span><input disabled type="text" name="resolvedBy" value={initialUser?.FullName} onChange={() => null} className="ir-sb-line-input" />
                  </div>
                  <div className="ir-sb-input-group flex-1">
                    <span className="ir-sb-label">Completed Date:</span>
                    <input
                      type="text"
                      disabled
                      name="dateResolved"
                      value={formData.dateResolved || (incidentReportItem.ResolvedDate ? new Date(incidentReportItem.ResolvedDate).toISOString().slice(0, 10) : '')}
                      onChange={() => null}
                      className="ir-sb-line-input"
                    />
                  </div>
                </div>

                <div className="ir-sb-meta-row">
                  <div className="ir-sb-input-group flex-2 equal-split-row">
                    <span className="ir-sb-label">Incident Type:</span>
                    <input type="text" name="irType" value={formData.irType} disabled onChange={() => null} className="ir-sb-line-input" />
                    {/* <span className="ir-sb-label">Action Taken:</span>
                  <div className="ir-sb-select-wrapper">
                    {error && !error.valid && error.final && (<span className='ir-pulse-badge no-print'>!</span>)}
                    <select
                      name="irAction"
                      value={formData.irAction}
                      onChange={handleChange}
                      className={`ir-sb-line-input ir-sb-dropdown ${!formData.irAction ? 'is-empty-print' : ''}`}
                    >
                      <option value="" disabled>-- Select Action --</option>
                      {IR_ACTION_OPTIONS.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div> */}
                  </div>
                  <div className="ir-sb-input-group flex-1 no-print">
                    <span className="ir-sb-label">Status:</span>
                    <input
                      type="text"
                      name=""
                      value={calculatedStatus /*incidentReportItem.IRStatus*/}
                      onChange={() => null}
                      disabled
                      className="ir-sb-line-input"
                      style={getStatusColor(calculatedStatus || '')}
                    />
                  </div>
                </div>


                {/* Section: Impormasyon ng Empleado[cite: 3] */}
                <h3 className="ir-sb-section-head">EMPLOYEE DETAILS</h3>
                <div className="ir-sb-grid col-2">
                  <div className="ir-sb-input-group">
                    <span className="ir-sb-label">Name:</span>
                    <input type="text" disabled name="empName" value={formData.empName} onChange={handleChange} className="ir-sb-line-input" />
                  </div>
                  <div className="ir-sb-input-group">
                    <span className="ir-sb-label">Position:</span>
                    <input type="text" disabled name="empPosition" value={formData.empPosition} onChange={handleChange} className="ir-sb-line-input" />
                    {/* <div className="ir-sb-input-group">
                  <span className="ir-sb-label">Business Unit:</span>
                  <input type="text" name="businessUnit" value={formData.businessUnit} onChange={handleChange} className="ir-sb-line-input" />
                </div> */}
                    <span className="ir-sb-label">BU:</span>
                    <input type="text" disabled name="businessUnit" value={formData.businessUnit} onChange={handleChange} className="ir-sb-line-input" />
                  </div>
                  <div className="ir-sb-input-group span-2">
                    <span className="ir-sb-label">Tractor:</span>
                    <input type="text" disabled name="truck_full" value={formData.truck_full} onChange={handleChange} className="ir-sb-line-input" />
                    <span className="ir-sb-label">Trailer:</span>
                    <input type="text" disabled name="trailer_full" value={formData.trailer_full} onChange={handleChange} className="ir-sb-line-input" />
                  </div>
                </div>

                {/* Section: Actions */}
                <h3 className="ir-sb-section-head">ACTIONS TAKEN</h3>

                <div className="ir-sb-grid col-1" style={{ gap: '12px', marginBottom: '16px' }}>

                  {/* Operations */}
                  <div className="ir-sb-meta-row" style={{ alignItems: 'center', marginBottom: 0, gap: '12px' }}>
                    <div style={{ flex: '1 1 200px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className="ir-sb-label" style={{ fontWeight: 'bold' }}>Operations:</span>
                      <input
                        type="text"
                        placeholder="Name..."
                        value={formData.actions?.operations?.name || ''}
                        // onChange={(e) => handleActionChange('operations', 'name', e.target.value)}
                        disabled={!isSectionEditable('Operations')}
                        className="ir-sb-line-input actions-taken"
                      />
                    </div>

                    <div className="ir-sb-input-group flex-2">
                      <span className="ir-sb-label">Action:</span>
                      <div className="ir-sb-select-wrapper" style={{ flex: 1 }}>
                        {/*error && !error.valid && error.final*/ (isSectionEditable('Operations') && !formData.actions?.operations?.action.trim()) && (<span className='ir-pulse-badge no-print'>!</span>)}
                        <select
                          name="operationsAction"
                          value={formData.actions?.operations?.action || ''}
                          onChange={(e) => handleActionChange('operations', 'action', e.target.value)}
                          disabled={!isSectionEditable('Operations')}
                          className={`ir-sb-line-input actions-taken ir-sb-dropdown ${!formData.actions?.operations?.action ? 'is-empty-print' : ''}`}
                        >
                          <option value="" disabled>-- Select Action --</option>
                          {getSectionActionOptions('Operations').map(option => {
                            // Disabling logic: If ShortBags is 0, only enable 'FOR CLEANING'; otherwise, use option.hide
                            const isOptionDisabled = formData.ShortBags === 0
                              ? option.value !== 'FOR CLEANING'
                              : option.hide;

                            return (
                              <option disabled={isOptionDisabled} key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    </div>

                    <div className="ir-sb-input-group flex-1">
                      <span className="ir-sb-label">Date:</span>
                      <input
                        type="date"
                        value={formData.actions?.operations?.date || ''}
                        // onChange={(e) => handleActionChange('operations', 'date', e.target.value)}
                        disabled={!isSectionEditable('Operations')}
                        className={`ir-sb-line-input actions-taken ${!formData.actions?.operations?.date ? 'is-empty-print' : ''}`}
                      />
                    </div>
                  </div>

                  {/* Supervisor */}
                  <div className="ir-sb-meta-row" style={{ alignItems: 'center', marginBottom: 0, gap: '12px' }}>
                    <div style={{ flex: '1 1 200px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className="ir-sb-label" style={{ fontWeight: 'bold' }}>Supervisor:</span>
                      <input
                        type="text"
                        placeholder="Name..."
                        value={formData.actions?.supervisor?.name || ''}
                        // onChange={(e) => handleActionChange('supervisor', 'name', e.target.value)}
                        disabled={!isSectionEditable('Supervisor')}
                        className="ir-sb-line-input actions-taken"
                      />
                    </div>

                    <div className="ir-sb-input-group flex-2">
                      <span className="ir-sb-label">Action:</span>
                      <div className="ir-sb-select-wrapper" style={{ flex: 1 }}>
                        {(isSectionEditable('Supervisor') && !formData.actions?.supervisor?.action.trim()) && (<span className='ir-pulse-badge no-print'>!</span>)}
                        <select
                          name="supervisorAction"
                          value={formData.actions?.supervisor?.action || ''}
                          onChange={(e) => handleActionChange('supervisor', 'action', e.target.value)}
                          disabled={!isSectionEditable('Supervisor')}
                          className={`ir-sb-line-input actions-taken ir-sb-dropdown ${!formData.actions?.supervisor?.action ? 'is-empty-print' : ''}`}
                        >
                          <option value="" disabled>-- Select Action --</option>
                          {getSectionActionOptions('Supervisor').map(option => (
                            <option disabled={option.hide} key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="ir-sb-input-group flex-1">
                      <span className="ir-sb-label">Date:</span>
                      <input
                        type="date"
                        value={formData.actions?.supervisor?.date || ''}
                        // onChange={(e) => handleActionChange('supervisor', 'date', e.target.value)}
                        disabled={!isSectionEditable('Supervisor')}
                        className={`ir-sb-line-input actions-taken ${!formData.actions?.supervisor?.date ? 'is-empty-print' : ''}`}
                      />
                    </div>
                  </div>

                  {/* Inspection */}
                  <div className="ir-sb-meta-row" style={{ alignItems: 'center', marginBottom: 0, gap: '12px' }}>
                    <div style={{ flex: '1 1 200px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className="ir-sb-label" style={{ fontWeight: 'bold' }}>Inspection:</span>
                      <input
                        type="text"
                        placeholder="Name..."
                        value={formData.actions?.inspection?.name || ''}
                        // onChange={(e) => handleActionChange('inspection', 'name', e.target.value)}
                        disabled={!isSectionEditable('Inspection')}
                        className="ir-sb-line-input actions-taken"
                      />
                    </div>

                    <div className="ir-sb-input-group flex-2">
                      <span className="ir-sb-label">Action:</span>
                      <div className="ir-sb-select-wrapper" style={{ flex: 1 }}>
                        {(isSectionEditable('Inspection') && !formData.actions?.inspection?.action.trim()) && (<span className='ir-pulse-badge no-print'>!</span>)}
                        <select
                          name="inspectionAction"
                          value={formData.actions?.inspection?.action || ''}
                          onChange={(e) => handleActionChange('inspection', 'action', e.target.value)}
                          disabled={!isSectionEditable('Inspection')}
                          className={`ir-sb-line-input actions-taken ir-sb-dropdown ${!formData.actions?.inspection?.action ? 'is-empty-print' : ''}`}
                        >
                          <option value="">-- Select Action --</option>
                          {getSectionActionOptions('Inspection').map(option => (
                            <option disabled={option.hide} key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="ir-sb-input-group flex-1">
                      <span className="ir-sb-label">Date:</span>
                      <input
                        type="date"
                        value={formData.actions?.inspection?.date || ''}
                        // onChange={(e) => handleActionChange('inspection', 'date', e.target.value)}
                        disabled={!isSectionEditable('Inspection')}
                        className={`ir-sb-line-input actions-taken ${!formData.actions?.inspection?.date ? 'is-empty-print' : ''}`}
                      />
                    </div>
                  </div>

                  {/* Yard */}
                  <div className="ir-sb-meta-row" style={{ alignItems: 'center', marginBottom: 0, gap: '12px' }}>
                    <div style={{ flex: '1 1 200px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className="ir-sb-label" style={{ fontWeight: 'bold' }}>Yard:</span>
                      <input
                        type="text"
                        placeholder="Name..."
                        value={formData.actions?.yard?.name || ''}
                        // onChange={(e) => handleActionChange('yard', 'name', e.target.value)}
                        disabled={!isSectionEditable('Yard')}
                        className="ir-sb-line-input actions-taken"
                      />
                    </div>

                    <div className="ir-sb-input-group flex-2" style={{ gap: '10px' }}>
                      <span className="ir-sb-label">Action:</span>
                      <div className="ir-sb-select-wrapper" style={{ flex: 1 }}>
                        {(isSectionEditable('Yard') && !formData.actions?.yard?.action.trim()) && (<span className='ir-pulse-badge no-print'>!</span>)}
                        <select
                          name="yardAction"
                          value={formData.actions?.yard?.action || ''}
                          onChange={(e) => handleActionChange('yard', 'action', e.target.value)}
                          disabled={!isSectionEditable('Yard')}
                          className={`ir-sb-line-input actions-taken ir-sb-dropdown ${!formData.actions?.yard?.action ? 'is-empty-print' : ''}`}
                        >
                          <option value="">-- Select Action --</option>
                          {getSectionActionOptions('Yard').map(option => (
                            <option disabled={option.hide} key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <span className="ir-sb-label">Bags:</span>
                      <input
                        type="number"
                        style={{ width: '60px', flex: 'none' }}
                        value={formData.actions?.yard?.bags || ''}
                        onChange={(e) => handleActionChange('yard', 'bags', e.target.value)}
                        disabled={!isSectionEditable('Yard')}
                        className="ir-sb-line-input actions-taken"
                      />
                    </div>

                    <div className="ir-sb-input-group flex-1">
                      <span className="ir-sb-label">Date:</span>
                      <input
                        type="date"
                        value={formData.actions?.yard?.date || ''}
                        // onChange={(e) => handleActionChange('yard', 'date', e.target.value)}
                        disabled={!isSectionEditable('Yard')}
                        className={`ir-sb-line-input actions-taken ${!formData.actions?.yard?.date ? 'is-empty-print' : ''}`}
                      />
                    </div>
                  </div>

                  {/* Warehouse */}
                  <div className="ir-sb-meta-row" style={{ alignItems: 'center', marginBottom: 0, gap: '12px' }}>
                    <div style={{ flex: '1 1 200px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className="ir-sb-label" style={{ fontWeight: 'bold' }}>Warehouse:</span>
                      <input
                        type="text"
                        placeholder="Name..."
                        value={formData.actions?.warehouse?.name || ''}
                        // onChange={(e) => handleActionChange('warehouse', 'name', e.target.value)}
                        disabled={!isSectionEditable('Warehouse')}
                        className="ir-sb-line-input actions-taken"
                      />
                    </div>

                    <div className="ir-sb-input-group flex-2" style={{ gap: '10px' }}>
                      <span className="ir-sb-label">Action:</span>
                      <div className="ir-sb-select-wrapper" style={{ flex: 1 }}>
                        {(isSectionEditable('Warehouse') && !formData.actions?.warehouse?.action.trim()) && (<span className='ir-pulse-badge no-print'>!</span>)}
                        <select
                          name="warehouseAction"
                          value={formData.actions?.warehouse?.action || ''}
                          onChange={(e) => handleActionChange('warehouse', 'action', e.target.value)}
                          disabled={!isSectionEditable('Warehouse')}
                          className={`ir-sb-line-input actions-taken ir-sb-dropdown ${!formData.actions?.warehouse?.action ? 'is-empty-print' : ''}`}
                        >
                          <option value="">-- Select Action --</option>
                          {getSectionActionOptions('Warehouse').map(option => (
                            <option disabled={option.hide} key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <span className="ir-sb-label">Bags:</span>
                      <input
                        type="number"
                        style={{ width: '60px', flex: 'none' }}
                        value={formData.actions?.warehouse?.bags || ''}
                        onChange={(e) => handleActionChange('warehouse', 'bags', e.target.value)}
                        disabled={!isSectionEditable('Warehouse')}
                        className="ir-sb-line-input actions-taken"
                      />
                    </div>

                    <div className="ir-sb-input-group flex-1">
                      <span className="ir-sb-label">Date:</span>
                      <input
                        type="date"
                        value={formData.actions?.warehouse?.date || ''}
                        // onChange={(e) => handleActionChange('warehouse', 'date', e.target.value)}
                        disabled={!isSectionEditable('Warehouse')}
                        className={`ir-sb-line-input actions-taken ${!formData.actions?.warehouse?.date ? 'is-empty-print' : ''}`}
                      />
                    </div>
                  </div>

                </div>

                {/* Section: Diskripsyon ng Insidente[cite: 3] */}
                <h3 className="ir-sb-section-head">INCIDENT DETAILS ({formData.irType?.toUpperCase()})</h3>

                <div className="ir-sb-grid col-2">
                  <div className="ir-sb-input-group">

                  </div>
                  <div className="ir-sb-input-group">
                    <span className="ir-sb-label"><span className='no-print is-req'>* </span>Incident Date:</span><input disabled={isReadOnly} type="date" value={formData.incident_date} name="incident_date" onChange={handleChange} className={`ir-sb-line-input ${!formData.incident_date ? 'is-empty-print' : ''}`} />
                    {/* <span className="ir-sb-label">Time:</span><input disabled={isReadOnly} type="time" value={formData.incident_time} name="incident_time" onChange={handleChange} className={`ir-sb-line-input ${!formData.incident_time ? 'is-empty-print' : ''}`} /> */}
                  </div>
                </div>

                <div className="ir-sb-spacer"></div>

                <div className="ir-sb-grid col-2">
                  <div className="ir-sb-input-group">
                    <span className="ir-sb-label">Trip Ref No:</span>
                    <input type="text" disabled name="tripReferenceNo" value={formData.tripReferenceNo} onChange={() => null} className="ir-sb-line-input" />
                  </div>
                  <div className="ir-sb-input-group">
                    <span className="ir-sb-label">Served Date:</span><input disabled type="date" name="ServedDate" value={formData.ServedDate} onChange={handleChange} className="ir-sb-line-input" />
                  </div>
                </div>

                <div className="ir-sb-grid col-1">
                  <div className="ir-sb-input-group"><span className="ir-sb-label">Customer:</span><input type="text" disabled name="Customer" value={formData.Customer} onChange={handleChange} className="ir-sb-line-input" /></div>
                </div>


                <div className="ir-sb-grid col-1">
                  <div className="ir-sb-input-group"><span className="ir-sb-label">Source:</span><input type="text" disabled name="Source" value={formData.Source} onChange={handleChange} className="ir-sb-line-input" /></div>          </div>

                <div className="ir-sb-grid col-1">
                  <div className="ir-sb-input-group"><span className="ir-sb-label">Destination:</span><input type="text" disabled name="Destination" value={formData.Destination} onChange={handleChange} className="ir-sb-line-input" /></div>
                </div>

                <div className="ir-sb-grid col-2">
                  <div className="ir-sb-input-group">
                    <span className="ir-sb-label">Cement Type:</span><input type="text" disabled name="CementType" value={formData.CementType} onChange={handleChange} className="ir-sb-line-input" />
                    <span className="ir-sb-label">Trip Group:</span><input type="text" disabled name="TripGroup" value={formData.TripGroup} onChange={handleChange} className="ir-sb-line-input" />
                  </div>
                </div>

                <div className="ir-sb-grid col-1">
                  <div className="ir-sb-input-group">
                    <span className="ir-sb-label">Withdrawn:</span><input type="text" disabled name="QtyWithdrawn" value={formData.QtyWithdrawn} onChange={handleChange} className="ir-sb-line-input" />
                    <span className="ir-sb-label">Delivered:</span><input type="text" disabled name="QtyDelivered" value={formData.QtyDelivered} onChange={handleChange} className="ir-sb-line-input" />
                    <span className="ir-sb-label">Short Bags:</span><input type="text" disabled name="ShortBags" value={formData.ShortBags} onChange={handleChange} className="ir-sb-line-input" /><span> bag/s</span>
                  </div>
                </div>

                <div className="ir-sb-grid col-1">
                  <div className="ir-sb-input-group">
                    <span className="ir-sb-label">Actual Withdrawn:</span><input type="text" disabled name="ActualQtyWithdrawn" value={formData.ActualQtyWithdrawn} onChange={handleChange} className="ir-sb-line-input" />
                    <span className="ir-sb-label">Actual Delivered:</span><input type="text" disabled name="ActualQtyDelivered" value={formData.ActualQtyDelivered} onChange={handleChange} className="ir-sb-line-input" />
                    <span className="ir-sb-label">Actual Short Bags:</span><input type="text" disabled name="ActualShortBags" value={formData.ActualShortBags} onChange={handleChange} className="ir-sb-line-input" /><span> bag/s</span>
                  </div>
                </div>

                <div className="ir-sb-grid col-2">
                  <div className="ir-sb-input-group">
                    <span className="ir-sb-label">Served By:</span><input type="text" disabled name="ServedBy" value={formData.ServedBy} onChange={handleChange} className="ir-sb-line-input" />                  </div>
                  <div className="ir-sb-input-group">
                    <span className="ir-sb-label">Verified By:</span><input type="text" disabled name="VerifiedBy" value={formData.VerifiedBy} onChange={handleChange} className="ir-sb-line-input" />
                  </div>
                </div>


                <div className="ir-sb-grid col-1">
                  <div className="ir-sb-input-group full-width">
                    <span className="ir-sb-label block"><span className='no-print is-req'>* </span>DESCRIPTION</span>
                    <textarea
                      name="incident_details"
                      value={formData.incident_details}
                      onChange={handleChange}
                      onKeyDown={handleNewLine}
                      rows={LINE_COUNT_LIMIT}
                      className="ir-sb-textarea"
                      style={{
                        height: `${LINE_COUNT_LIMIT * 30}px`
                      }}
                      disabled={isReadOnly}
                    />
                  </div>
                </div>

                {/* Section: Karagdagang Detalye[cite: 3] */}
                <h3 className="ir-sb-section-head">OTHER DETAILS</h3>
                <div className="ir-sb-yard-selector">
                  <span className="ir-sb-label">Yarda :</span>
                  <div className="ir-sb-checkbox-grid">
                    {['Alphabase', 'Vasquez', 'Intercity', 'Lingunan', 'Geomax'].map(yard => (
                      <label key={yard} className="ir-sb-check-item">
                        <input disabled={isReadOnly} type="checkbox" checked={formData.yard === yard} onChange={() => handleCheckbox(yard)} /> {yard}
                      </label>
                    ))}
                    <div className="ir-sb-check-item span-all">
                      <input disabled={isReadOnly} type="checkbox" checked={formData.yard === 'Others'} onChange={() => handleCheckbox('Others')} /> Others:
                      <input type="text" name="yardOthers" value={formData.yardOthers} onChange={handleChange} disabled={formData.yard !== 'Others' || isReadOnly} className="ir-sb-line-input inline" />
                    </div>
                  </div>
                </div>

                {/* Section: Detalye ng Nag Report[cite: 3] */}
                <h3 className="ir-sb-section-head">REPORTER DETAILS</h3>
                <div className="ir-sb-grid col-2">
                  <div className="ir-sb-input-group"><span className="ir-sb-label">Reported By:</span><input type="text" disabled name="reportName" value={formData.reportName} onChange={() => null} className="ir-sb-line-input" /></div>
                  <div className="ir-sb-input-group"><span className="ir-sb-label">Position:</span><input type="text" disabled name="reportPosition" value={formData.reportPosition} onChange={() => null} className="ir-sb-line-input" /></div>
                </div>
                <div className="ir-sb-grid col-2">
                  <div className="ir-sb-input-group"><span className="ir-sb-label">Signed Date:</span><input type="date" name="reportDate" onChange={() => null} className="ir-sb-line-input" /></div>
                  <div className="ir-sb-signature-box"><span className="ir-sb-label">Signature:</span><div className="line"></div></div>
                </div>
              </div>


              <div className="ir-sb-page ir-sb-page-break">

                <div className="ir-sb-print-page-header">
                  <h2>GREAT SIERRA DEVELOPMENT CORPORATION — EVIDENCE ATTACHMENTS PAGE</h2>
                  <p style={{ margin: 0, fontSize: '11px', color: '#555' }}>
                    References Document ID: <span style={{ fontWeight: 'bold' }}>{formData.irReferenceNo}</span> | Trip Ref: {formData.tripReferenceNo}
                  </p>
                </div>

                <h3 className="ir-sb-section-head">EVIDENCE & IMAGE ATTACHMENTS</h3>



                {/* Screen Actions Area */}
                <div
                  className={`ir-sb-upload-zone no-print ${isDragging ? 'is-dragging' : ''}`}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                      Array.from(e.dataTransfer.files).forEach(file => {
                        if (!file.type.startsWith('image/')) return;
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          setFormData(prev => ({
                            ...prev,
                            attachedImages: [
                              ...(prev.attachedImages || []),
                              { src: reader.result as string, fileName: file.name, description: '' }
                            ]
                          }));
                        };
                        reader.readAsDataURL(file);
                      });
                    }
                  }}
                >
                  {(isSectionEditable('Operations') && ((!formData.attachedImages || formData.attachedImages.length === 0) && (formData.ShortBags || 0) < -5.0 && formData.actions?.operations?.action == 'PROCEED TO NEXT TRIP')) && (<span className='ir-pulse-badge no-print'>!</span>)}
                  <p className="upload-text">
                    Drag and drop logistics incident evidence images here or <span className="browse-link">click to browse</span>
                  </p>

                  {!isReadOnly && (<input
                    disabled={isReadOnly}
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={async (e) => {
                      if (isReadOnly || !e.target.files || e.target.files.length === 0) return;

                      const filePromises = Array.from(e.target.files).map(file => {
                        return new Promise<{ src: string; fileName: string; description: string }>((resolve) => {
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            resolve({
                              src: reader.result as string,
                              fileName: file.name,
                              description: ''
                            });
                          };
                          reader.readAsDataURL(file);
                        });
                      });

                      const newLoadedImages = await Promise.all(filePromises);

                      const nextState = {
                        ...formData,
                        attachedImages: [
                          ...(formData.attachedImages || []),
                          ...newLoadedImages
                        ]
                      };

                      setFormData(nextState);
                      setError(validateForm(nextState));
                    }}
                  />)}

                  {/* Visual Feedback inside the drop zone */}
                  <div className="ir-sb-upload-content">
                    {isReadOnly ? (
                      <div className="ir-sb-upload-disabled-msg">
                        <span style={{ fontSize: '18px' }}>🔒</span>
                        <span>Image uploading disabled (Read-Only)</span>
                      </div>
                    ) : (
                      <div>
                        {/* <span>Drag & drop images here or <strong>browse</strong></span> */}
                      </div>
                    )}
                  </div>

                </div>

                {/* Rendered Evidence Grid Array */}
                {formData.attachedImages && formData.attachedImages.length > 0 ? (
                  <div className="ir-sb-print-image-container">
                    {formData.attachedImages.map((imgItem, idx) => (
                      <div key={idx} className="ir-sb-print-img-card">

                        {/* Isolated Positioning Frame for the image asset and its floating triggers */}
                        <div className="ir-sb-img-card-media-wrapper">
                          <img
                            src={imgItem.src}
                            alt={`Evidence Asset Tracking Row ${idx + 1}`}
                            className="no-print"
                            style={{ cursor: 'zoom-in' }}
                            onClick={() => {
                              setSelectedPreviewImg({ src: imgItem.src, fileName: imgItem.fileName });
                              handleModalReset();
                            }}
                          />

                          {/* Floating Upper-Right Corner Fullscreen Action Button */}
                          <button
                            type="button"
                            className="ir-sb-img-card-fullscreen-btn no-print"
                            title="Open Image Workspace Viewer"
                            onClick={() => {
                              setSelectedPreviewImg({ src: imgItem.src, fileName: imgItem.fileName });
                              handleModalReset();
                            }}
                          >
                            <Maximize2 className='no-print' size={14} />
                          </button>
                        </div>

                        {/* Individual Dynamic Description Box Area */}
                        <div className="ir-sb-img-desc-box">

                          {/* Screen View: File Name acts as the input field label */}
                          <span
                            className="ir-sb-label no-print ir-sb-filename-label"
                            style={{
                              fontSize: '11px',
                              color: '#3a4efc',
                            }}
                          >
                            <FileImage size={14} className='no-print' />
                            <span className="ir-sb-filename-text no-print" title={imgItem.fileName}>
                              {imgItem.fileName || `Attachment #${idx + 1}`}:
                            </span>
                          </span>

                          {/* Screen Input Field */}
                          <input
                            type="text"
                            className="ir-sb-line-input no-print"
                            placeholder="Add custom descriptive notes for this image..."
                            value={imgItem.description}
                            onChange={(e) => {
                              const updatedDescText = e.target.value;


                              const safeImages = [...(formData.attachedImages || [])];
                              safeImages[idx] = { ...safeImages[idx], description: updatedDescText };
                              const nextState = { ...formData, attachedImages: safeImages };

                              setFormData(nextState);
                              setError(validateForm(nextState)); // validate

                            }}
                            style={{ fontSize: '12px', marginTop: '4px', width: '100%' }}
                          />

                          {/* Print-Only Layout */}
                          <div className="print-only-text" style={{ margin: '8px 0 0 0', fontSize: '11px', textAlign: 'left', lineHeight: '1.4' }}>
                            <p style={{ margin: '0', fontStyle: 'italic', color: '#222' }}>
                              <strong style={{ fontStyle: 'normal', color: '#000080' }}>Notes:</strong> {imgItem.description || 'No descriptive comments logged.'}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          className="no-print"
                          style={{ background: '#ff4d4d', color: '#fff', border: 'none', borderRadius: '4px', padding: '4px 10px', fontSize: '11px', cursor: 'pointer', marginTop: '10px', width: '100%' }}
                          onClick={() => {
                            handleRemoveAttachedImage(idx);
                          }}
                        >
                          Remove Image
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#aaa', border: '1px dashed #ccc', borderRadius: '6px' }}>
                    No incident validation imagery attached to this documentation index.
                  </div>
                )}
              </div>
            </div>


          </div>


          {((!error?.valid || (error?.valid && error?.final)) && !isReadOnly) && (
            <div
              className={`ir-sb-message-footer no-print ${error?.final ? 'to-complete' : ''}`}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <h3>{error?.valid ? (<CheckCircle />) : (<XCircle />)}</h3>
              <p className="ir-sb-message-text" style={{ margin: 0 }}>
                {error?.msg}
              </p>
            </div>
          )}


        </div>

        {selectedPreviewImg && createPortal(
          <Modal
            onClose={() => setSelectedPreviewImg(null)}
            width={'65%'}
            height={'80%'}
            hideX={true}
          >
            <div className="ir-sb-viewer-modal">
              {/* Modal Header */}
              <div className="ir-sb-viewer-header">
                <div className="ir-sb-viewer-meta">
                  <h3>Evidence Workspace View</h3>
                  <p>{selectedPreviewImg.fileName}</p>
                </div>
                <button className="ir-sb-viewer-close-btn" onClick={() => setSelectedPreviewImg(null)}>×</button>
              </div>

              {/* Interactive Image Frame Canvas (Appends the Dynamic Theme Contrast Class) */}
              <div
                className={`ir-sb-viewer-frame ${isCanvasDarkMode ? 'canvas-dark-theme' : 'canvas-light-theme'} ${isDraggingImage ? 'is-dragging-canvas' : ''}`}
                onMouseDown={handleImgMouseDown}
                onMouseMove={handleImgMouseMove}
                onMouseUp={handleImgMouseUpOrLeave}
                onMouseLeave={handleImgMouseUpOrLeave}
                onWheel={handleImgWheelZoom}
              >
                <div
                  className="ir-sb-viewer-transform-container"
                  style={{
                    transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${previewZoom}) rotate(${previewRotation}deg)`,
                    transition: isDraggingImage ? 'none' : 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
                  }}
                >
                  <img src={selectedPreviewImg.src} alt="Inspected Logistics Asset" draggable={false} />
                </div>
              </div>

              {/* Modal Toolbar Actions */}
              <div className="ir-sb-viewer-toolbar">
                <div className="toolbar-group">
                  <button
                    onClick={handleModalZoomOut}
                    title="Zoom Out"
                    disabled={previewZoom <= 0.5}
                    className="ir-sb-btn-icon-inline"
                  >
                    <ZoomOut size={16} /> Zoom Out
                  </button>

                  <span className="zoom-badge">{Math.round(previewZoom * 100)}%</span>

                  <button
                    onClick={handleModalZoomIn}
                    title="Zoom In"
                    disabled={previewZoom >= 3}
                    className="ir-sb-btn-icon-inline"
                  >
                    <ZoomIn size={16} /> Zoom In
                  </button>
                </div>

                <div className="toolbar-divider" />

                <div className="toolbar-group">
                  <button
                    onClick={handleModalRotate}
                    title="Rotate 90°"
                    className="ir-sb-btn-icon-inline"
                  >
                    <RotateCcw size={16} /> Rotate 90°
                  </button>

                  <button
                    onClick={handleModalReset}
                    title="Reset Controls"
                    className="btn-reset ir-sb-btn-icon-inline"
                  >
                    <RotateCcw size={16} style={{ transform: 'scaleX(-1)' }} /> Reset View
                  </button>
                </div>

                <div className="toolbar-divider" />

                {/* THEME BACKGROUND TOGGLE GROUP */}
                <div className="toolbar-group">
                  <button
                    type="button"
                    onClick={() => setIsCanvasDarkMode(!isCanvasDarkMode)}
                    title={isCanvasDarkMode ? "Switch to Light Canvas Background" : "Switch to Dark Canvas Background"}
                    className="ir-sb-btn-icon-inline btn-theme-toggle"
                  >
                    {isCanvasDarkMode ? (
                      <>
                        <Sun size={16} /> Light View
                      </>
                    ) : (
                      <>
                        <Moon size={16} /> Dark View
                      </>
                    )}
                  </button>
                </div>

              </div>
            </div>
          </Modal>,
          document.body
        )}


        {showDiscardModal && createPortal(
          <Modal
            onClose={() => setShowDiscardModal(false)}
            width="420px"
            height="auto"
            hideX={false}
          >
            <div style={{ padding: '20px', textAlign: 'center' }}>
              <h3 style={{ margin: '0 0 10px 0', color: 'var(--color-primary)' }}>
                Discard Unsaved Changes?
              </h3>
              <p style={{ fontSize: '14px', color: '#555', marginBottom: '24px' }}>
                You have unsaved changes in this report. Are you sure you want to discard them?
              </p>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                <button
                  type="button"
                  className="ir-sb-btn"
                  style={{ background: '#f3f4f6', color: '#333' }}
                  onClick={() => setShowDiscardModal(false)}
                >
                  Keep Editing
                </button>

                <button
                  type="button"
                  className="ir-sb-btn"
                  style={{ background: '#ef4444', color: '#fff' }}
                  onClick={() => {
                    setShowDiscardModal(false);
                    if (onClose) onClose();
                  }}
                >
                  Discard Changes
                </button>
              </div>
            </div>
          </Modal>,
          document.body
        )}



      </>
    );
  });



IR_ShortBags_FormRender.displayName = 'IR_ShortBags_Form';

export const IR_ShortBags_Form = IR_ShortBags_FormRender;
export default IR_ShortBags_FormRender;
