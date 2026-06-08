import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Printer, ZoomIn, ZoomOut, RotateCcw, FileImage } from 'lucide-react'; // Clear, modern utility icons
import '../components/comp_css/IR_ShortBags_Form.css';
import { type OP_IncidentReports } from '../generated/models/OP_IncidentReportsModel';
import {  OP_IncidentReportsService } from '../generated/services/OP_IncidentReportsService';
import Modal from './ewul_Modal';

//utils
import { useTaskWorker } from '../utils/TaskWorkerContext';

// truth
import { 
    type UserInfo,
 } from '../truth.config';

export type IR_ShortBags_Form_Model = {
  // IR details
  irReferenceNo: string;
  tripReferenceNo: string;
  irType: string;
  irAction: string;
  dateResolved: string;
  date: string;


  // FORM details

  // reported detailes
  empName: string;
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
  CementType: string;
  ServedDate: string;

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


  attachedImages?: {
    src: string;        // Holds the Base64/Blob url data string
    fileName: string;
    description: string; // Dynamic input value field
  }[];

};

interface IR_ShortBags_Props {
  initialUser?: UserInfo;
  incidentReportItem: Partial<OP_IncidentReports>;
  onClose?: () => void;
  onSubmit?: (data: Partial<IR_ShortBags_Form_Model>) => void; // Updated type
  onSave?: (data: Partial<IR_ShortBags_Form_Model>) => void; // Added for save functionality
}

export const IR_ShortBags_Form: React.FC<IR_ShortBags_Props> = ({ initialUser, incidentReportItem, onClose, onSubmit, onSave }) => {
  const { addTask } = useTaskWorker();
  const [zoom, setZoom] = useState<number>(1.0); // 1.0 = 100% original scale
  const jsonDetails = incidentReportItem.reportJSON ? JSON.parse(incidentReportItem.reportJSON) as Partial<IR_ShortBags_Form_Model> : {} as Partial<IR_ShortBags_Form_Model>;
  const [formData, setFormData] = useState<Partial<IR_ShortBags_Form_Model>>({
    // Prefill
    irReferenceNo: incidentReportItem.IRID || '',
    tripReferenceNo: incidentReportItem.OE_Reference || '',
    irType: incidentReportItem.IncidentType || '', // Ensure it's a string
    irAction: incidentReportItem.ActionStatus || '', // Ensure it's a string
    dateResolved: incidentReportItem.IRStatus === 'Resolved' ? incidentReportItem.ResolvedDate : '',
    date: incidentReportItem.CreatedDateTime ? new Date(incidentReportItem.CreatedDateTime).toISOString().slice(0, 10) : '',

    // Initialize other form fields as empty or default
    empName: incidentReportItem.EmployeeName || '',
    empPosition: incidentReportItem.EmployeePosition || '',
    businessUnit: '',
    buHead: incidentReportItem.EmployeeBUHead || '',
    truck_full: incidentReportItem.EmployeeTractor || '',
    trailer_full: incidentReportItem.EmployeeTrailer || '',

    Customer: jsonDetails.Customer || '',
    Source: jsonDetails.Source || '',
    Destination: jsonDetails.Destination || '',
    TripGroup: jsonDetails.TripGroup || '',
    QtyWithdrawn: jsonDetails.QtyWithdrawn || 0,
    QtyDelivered: jsonDetails.QtyDelivered || 0,
    ShortBags: jsonDetails.QtyWithdrawn ? jsonDetails.QtyWithdrawn - (jsonDetails.QtyDelivered || 0) : 0,
    CementType: jsonDetails.CementType || '',
    ServedDate: jsonDetails.ServedDate || '',
    incident_date: jsonDetails.incident_date || '',
    incident_time: jsonDetails.incident_time || '',
    incident_details: jsonDetails.incident_details || '',
    yard: jsonDetails.yard || '',
    yardOthers: jsonDetails.yardOthers || '',
    reportDate: jsonDetails.reportDate || '',
    reportName: initialUser?.FullName || '',
    reportPosition: '',
    reportDept: '',


    attachedImages: jsonDetails.attachedImages || [],
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCheckbox = (yardName: string) => {
    setFormData(prev => ({ ...prev, yard: yardName }));
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
  const handleNewLine  = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
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

  const handleSave = () => {
    if (onSave) {

      addTask({
        id: `saveir-${incidentReportItem.IRID}`,
        name: `Saving Incident Details for ${incidentReportItem.IRID}`,
        execute: async () => {
            let result = null
            try {
                console.log("Submitting incident report");

                if (incidentReportItem.IncidentID === undefined) return;

                const ir_details = {
                  ModifiedBy: initialUser?.FullName,
                  ModifiedDateTime: new Date().toISOString(),
                  IRStatus: 'Processing',
                } as Omit<Partial<OP_IncidentReports>, "IncidentID">  ;
  
                result = await OP_IncidentReportsService.update(incidentReportItem.IncidentID.toString(), {...ir_details, reportJSON: JSON.stringify(formData)});

                if (result.error) {
                    throw new Error(result.error.message);
                }

                if (!result || !result.data) {
                    throw new Error("Unexpected response from server: " + JSON.stringify(result));
                }

            } catch (error) {
                console.error("Failed to upload attendance records:", error);
                return {success: false, error};
            } finally {
                return {success: true, data: result};
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

    }
  };

  const handleSubmit = () => {
    if (onSubmit) {

      addTask({
        id: `submitir-${incidentReportItem.IRID}`,
        name: `Creating Incident Report for ${incidentReportItem.IRID}`,
        execute: async () => {
            let result = null
            try {
                console.log("Submitting incident report");

                if (incidentReportItem.IncidentID === undefined) return;

                const ir_details = {
                  ModifiedBy: initialUser?.FullName,
                  ModifiedDateTime: new Date().toISOString(),
                  ResolvedDate: formData.date,
                } as Omit<Partial<OP_IncidentReports>, "IncidentID">  ;
  
                result = await OP_IncidentReportsService.update(incidentReportItem.IncidentID.toString(), {...ir_details, IRStatus: 'Resolved' , reportJSON: JSON.stringify(formData)});

                if (result.error) {
                    throw new Error(result.error.message);
                }

                if (!result || !result.data) {
                    throw new Error("Unexpected response from server: " + JSON.stringify(result));
                }

            } catch (error) {
                console.error("Failed to upload attendance records:", error);
                return {success: false, error};
            } finally {
                return {success: true, data: result};
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

    }
  };

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
                  ModifiedBy: initialUser?.FullName,
                  ModifiedDateTime: new Date().toISOString(),
                  ResolvedDate: formData.date,
                } as Omit<Partial<OP_IncidentReports>, "IncidentID">  ;
  
                result = await OP_IncidentReportsService.update(incidentReportItem.IncidentID.toString(), {...ir_details, IRStatus: 'Rejected' , reportJSON: JSON.stringify(formData)});

                if (result.error) {
                    throw new Error(result.error.message);
                }

                if (!result || !result.data) {
                    throw new Error("Unexpected response from server: " + JSON.stringify(result));
                }

            } catch (error) {
                console.error("Failed to upload attendance records:", error);
                return {success: false, error};
            } finally {
                return {success: true, data: result};
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

    }
  };

  return (
    <>
      <div className="ir-sb-container">

        {/* Screen-Only Action Header inside Modal[cite: 3] */}
        <div className="ir-sb-actions-bar">
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

          {/* Action Button Group[cite: 3] */}
          <button type="button" onClick={handlePrint} className="ir-sb-btn ir-sb-print-btn">
            <Printer size={14} /> Print Report
          </button>
          <button type="button" onClick={handleSave} className="ir-sb-btn btn-save">
            Save
          </button>
          <button type="button" onClick={handleSubmit} className="ir-sb-btn ir-sb-submit-btn btn-proceed">
            Submit
          </button>
          <button type="button" onClick={handleReject} className="ir-sb-btn ir-sb-submit-btn btn-cancel">
            Reject
          </button>
          {onClose && (
            <button type="button" onClick={onClose} className="ir-sb-btn ir-sb-close-btn">
              Close
            </button>
          )}
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
            <div className="ir-sb-page">
              {/* Header Section[cite: 3] */}
              <div className="ir-sb-header">
                <div className="ir-sb-logo-container">
                  <img src="/logo/logo-trimmed.png" alt="GSDC Logo" className="ir-sb-logo-img" />
                </div>

                <div className="ir-sb-company-info">
                  <h2>GREAT SIERRA DEVELOPMENT CORPORATION</h2>
                  <p>Lot 2, Block 1, Grand Industrial Estate Subdivision Bo. Parulan Plaridel, Bulacan</p>
                  <h1>INCIDENT REPORT</h1>
                </div>
                <div className="ir-sb-header-spacer" aria-hidden="true"/>
              </div>

              {/* Reference and Date[cite: 3] */}
              <div className="ir-sb-meta-row">
                <div className="ir-sb-input-group flex-2">
                  <span className="ir-sb-label">IR Reference No:</span>
                  <input type="text" name="irReferenceNo" value={formData.irReferenceNo} onChange={() => null} className="ir-sb-line-input" />
                </div>
                <div className="ir-sb-input-group flex-1">
                  <span className="ir-sb-label">Date:</span>
                  <input type="date" name="date" value={formData.date} onChange={() => null} className={`ir-sb-line-input ${!formData.date ? 'is-empty-print' : ''}`} />
                </div>
              </div>

              <div className="ir-sb-meta-row">
                <div className="ir-sb-input-group flex-2">
                  <span className="ir-sb-label">Incident Type:</span>
                  <input type="text" name="irType" value={formData.irType} onChange={() => null} className="ir-sb-line-input" />
                  <span className="ir-sb-label">Action Taken:</span>
                  <input type="text" name="irAction" value={formData.irAction} onChange={() => null} className="ir-sb-line-input" />
                </div>
                <div className="ir-sb-input-group flex-1">
                  <span className="ir-sb-label">Resolved:</span>
                  <input type="text" name="dateResolved" onChange={() => null} className={`ir-sb-line-input`} />
                </div>
              </div>

              {/* Section: Impormasyon ng Empleado[cite: 3] */}
              <h3 className="ir-sb-section-head">EMPLOYEE DETAILS</h3>
              <div className="ir-sb-grid col-2">
                <div className="ir-sb-input-group">
                  <span className="ir-sb-label">Name:</span>
                  <input type="text" name="empName" value={formData.empName} onChange={handleChange} className="ir-sb-line-input" />
                </div>
                <div className="ir-sb-input-group">
                  <span className="ir-sb-label">Position:</span>
                  <input type="text" name="empPosition" value={formData.empPosition} onChange={handleChange} className="ir-sb-line-input" />
                {/* <div className="ir-sb-input-group">
                  <span className="ir-sb-label">Business Unit:</span>
                  <input type="text" name="businessUnit" value={formData.businessUnit} onChange={handleChange} className="ir-sb-line-input" />
                </div> */}
                  <span className="ir-sb-label">BU Head:</span>
                  <input type="text" name="buHead" value={formData.buHead} onChange={handleChange} className="ir-sb-line-input" />
                </div>
                <div className="ir-sb-input-group span-2">
                  <span className="ir-sb-label">Tractor:</span>
                  <input type="text" name="truck_full" value={formData.truck_full} onChange={handleChange} className="ir-sb-line-input" />
                  <span className="ir-sb-label">Trailer:</span>
                  <input type="text" name="trailer_full" value={formData.trailer_full} onChange={handleChange} className="ir-sb-line-input" />
                </div>
              </div>

              {/* Section: Diskripsyon ng Insidente[cite: 3] */}
              <h3 className="ir-sb-section-head">INCIDENT DETAILS ({formData.irType?.toUpperCase()})</h3>
              
              <div className="ir-sb-grid col-2">
                <div className="ir-sb-input-group">
                  
                </div>
                <div className="ir-sb-input-group">
                  <span className="ir-sb-label">Incident Date:</span><input type="date" name="incident_date" onChange={handleChange} className="ir-sb-line-input" />
                  <span className="ir-sb-label">Time:</span><input type="time" name="incident_time" onChange={handleChange} className="ir-sb-line-input" />
                </div>
              </div>
              
              <div className="ir-sb-spacer"></div>

              <div className="ir-sb-grid col-2">
                <div className="ir-sb-input-group">
                  <span className="ir-sb-label">Trip Ref No:</span>
                  <input type="text" name="tripReferenceNo" value={formData.tripReferenceNo} onChange={() => null} className="ir-sb-line-input" />
                </div>
                <div className="ir-sb-input-group">
                  <span className="ir-sb-label">Served Date:</span><input type="date" name="ServedDate" onChange={handleChange} className="ir-sb-line-input" />
                </div>
              </div>

              <div className="ir-sb-grid col-1">
                  <div className="ir-sb-input-group"><span className="ir-sb-label">Customer:</span><input type="text" name="Customer" value={formData.Customer} onChange={handleChange} className="ir-sb-line-input" /></div>
              </div>


              <div className="ir-sb-grid col-1">
                  <div className="ir-sb-input-group"><span className="ir-sb-label">Source:</span><input type="text" name="Source" value={formData.Source} onChange={handleChange} className="ir-sb-line-input" /></div>          </div>

              <div className="ir-sb-grid col-1">
                  <div className="ir-sb-input-group"><span className="ir-sb-label">Destination:</span><input type="text" name="Destination" value={formData.Destination} onChange={handleChange} className="ir-sb-line-input" /></div>
              </div>

              <div className="ir-sb-grid col-2">
                  <div className="ir-sb-input-group">
                    <span className="ir-sb-label">Cement Type:</span><input type="text" name="CementType" value={formData.CementType} onChange={handleChange} className="ir-sb-line-input" />
                    <span className="ir-sb-label">Trip Group:</span><input type="text" name="TripGroup" value={formData.TripGroup} onChange={handleChange} className="ir-sb-line-input" />
                  </div>
                  <div className="ir-sb-input-group">
                    <span className="ir-sb-label">Withdrawn:</span><input type="text" name="QtyWithdrawn" value={formData.QtyWithdrawn} onChange={handleChange} className="ir-sb-line-input" />
                    <span className="ir-sb-label">Delivered:</span><input type="text" name="QtyDelivered" value={formData.QtyDelivered} onChange={handleChange} className="ir-sb-line-input" />
                  </div>
              </div>

              <div className="ir-sb-grid col-2">
                  <div className="ir-sb-input-group">
                    <span className="ir-sb-label">Short Bages:</span><input type="text" name="ShortBags" value={formData.ShortBags} onChange={handleChange} className="ir-sb-line-input" /><span> bag/s</span>
                  </div>
              </div>

              <div className="ir-sb-grid col-1">
                <div className="ir-sb-input-group full-width">
                  <span className="ir-sb-label block">DESCRIPTION</span>
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
                      <input type="checkbox" checked={formData.yard === yard} onChange={() => handleCheckbox(yard)} /> {yard}
                    </label>
                  ))}
                  <div className="ir-sb-check-item span-all">
                    <input type="checkbox" checked={formData.yard === 'Others'} onChange={() => handleCheckbox('Others')} /> Others:
                    <input type="text" name="yardOthers" value={formData.yardOthers} onChange={handleChange} disabled={formData.yard !== 'Others'} className="ir-sb-line-input inline" />
                  </div>
                </div>
              </div>

              {/* Section: Detalye ng Nag Report[cite: 3] */}
              <h3 className="ir-sb-section-head">REPORTER DETAILS</h3>
              <div className="ir-sb-grid col-2">
                <div className="ir-sb-input-group"><span className="ir-sb-label">Date Processed:</span><input type="date" name="reportDate" onChange={() => null} className="ir-sb-line-input" /></div>
                <div className="ir-sb-input-group"><span className="ir-sb-label">Reporter:</span><input type="text" name="reportName" value={formData.reportName} onChange={() => null} className="ir-sb-line-input" /></div>
                <div className="ir-sb-signature-box"><span className="ir-sb-label">Signature:</span><div className="line"></div></div>
                <div className="ir-sb-input-group"><span className="ir-sb-label">Position:</span><input type="text" name="reportPosition"  onChange={() => null} className="ir-sb-line-input" /></div>
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
                <p className="upload-text">
                  Drag and drop logistics incident evidence images here or <span className="browse-link">click to browse</span>
                </p>
                <input 
                  type="file" multiple accept="image/*" 
                  onChange={(e) => {
                    if (e.target.files) {
                      Array.from(e.target.files).forEach(file => {
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
                />
              </div>

              {/* Rendered Evidence Grid Array */}
              {formData.attachedImages && formData.attachedImages.length > 0 ? (
                <div className="ir-sb-print-image-container">
                  {formData.attachedImages.map((imgItem, idx) => (
                    <div key={idx} className="ir-sb-print-img-card">
                      <img 
                        src={imgItem.src} 
                        alt={`Evidence Asset Tracking Row ${idx + 1}`} 
                        className="no-print"
                        style={{ cursor: 'zoom-in' }} 
                        onClick={() => {
                          setSelectedPreviewImg({ src: imgItem.src, fileName: imgItem.fileName });
                          handleModalReset(); // Clears old transforms from previous selections
                        }}
                      />
                      
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
                          <FileImage size={14} className='no-print'/> 
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
                            setFormData(prev => {
                              const safeImages = [...(prev.attachedImages || [])];
                              safeImages[idx] = { ...safeImages[idx], description: updatedDescText };
                              return { ...prev, attachedImages: safeImages };
                            });
                          }}
                          style={{ fontSize: '12px', marginTop: '4px', width: '100%' }}
                        />

                        {/* Print-Only Layout (Combines File Name and Notes nicely on the physical paper sheet) */}
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
                          setFormData(prev => ({
                            ...prev,
                            attachedImages: prev.attachedImages?.filter((_, itemIdx) => itemIdx !== idx)
                          }));
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
                  <p>📁 {selectedPreviewImg.fileName}</p>
                </div>
                <button className="ir-sb-viewer-close-btn" onClick={() => setSelectedPreviewImg(null)}>×</button>
              </div>

              {/* Interactive Image Frame Canvas (Captures Panning Interventions) */}
              <div 
                className={`ir-sb-viewer-frame ${isDraggingImage ? 'is-dragging-canvas' : ''}`}
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
                    // CRITICAL: Disable transitions during manual dragging to ensure perfectly crisp, immediate movement responses
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
              </div>
            </div>
          </Modal>,
          document.body
        )}



    </>
  );
};
