import React, { useState } from 'react';
import { Printer, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react'; // Clear, modern utility icons
import '../components/comp_css/IR_ShortBags_Form.css';
import { type OP_IncidentReports } from '../generated/models/OP_IncidentReportsModel';
import {  OP_IncidentReportsService } from '../generated/services/OP_IncidentReportsService';

//utils
import { useTaskWorker } from '../utils/TaskWorkerContext';

export type IR_ShortBags_Form_Model = {
  // IR details
  irReferenceNo: string;
  tripReferenceNo: string;
  irType: string;
  irAction: string;
  irIsResolved: boolean;
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

};

interface IR_ShortBags_Props {
  initialUser?: string;
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
    irIsResolved: incidentReportItem.IRStatus === 'Resolved',
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
    incident_date: '',
    incident_time: '',
    incident_details: '',
    yard: '',
    yardOthers: '',
    reportDate: '',
    reportName: initialUser || '',
    reportPosition: '',
    reportDept: ''
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
    
    sourceInputs.forEach((input: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | any, index: number) => {
      if (input.type === 'checkbox' || input.type === 'radio') {
        (iframeInputs[index] as HTMLInputElement).checked = input.checked;
      } else {
        (iframeInputs[index] as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value = input.value;
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
      onSave(formData);
    }
  };

  const handleSubmit = () => {
    if (onSubmit) {

      addTask({
        id: `submitir-${formData.tripReferenceNo}`,
        name: `Creating Incident Report for ${formData.tripReferenceNo}`,
        execute: async () => {
            let result = null
            try {
                console.log("Submitting incident report");

                if (incidentReportItem.IncidentID === undefined) return;

                const ir_details = {
                  ResolvedDate: formData.date,
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
            onSubmit(result.data.data);
            console.log(result);
        },
        onFailure: async (result: any) => {
            console.log(result);
        },
        message: `Please wait while we create an Incident Report....`,
        message_success: `Incident Report created successfully for ${formData.tripReferenceNo}`,
        message_failure: `Failed to create Incident Report for ${formData.tripReferenceNo}`,



        })






      onSubmit(formData);
    }
  };

  return (
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
              <input type="text" name="irIsResolved" value={formData.irIsResolved ? 'YES' : ''} onChange={() => null} className={`ir-sb-line-input`} />
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
              <span className="ir-sb-label">Date:</span><input type="date" name="incident_date" onChange={handleChange} className="ir-sb-line-input" />
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
            <div className="ir-sb-input-group"><span className="ir-sb-label">Date:</span><input type="date" name="reportDate" onChange={handleChange} className="ir-sb-line-input" /></div>
            <div className="ir-sb-input-group"><span className="ir-sb-label">Reporter:</span><input type="text" name="reportName" value={formData.reportName} onChange={handleChange} className="ir-sb-line-input" /></div>
            <div className="ir-sb-signature-box"><span className="ir-sb-label">Signature:</span><div className="line"></div></div>
            <div className="ir-sb-input-group"><span className="ir-sb-label">Position:</span><input type="text" name="reportPosition" onChange={handleChange} className="ir-sb-line-input" /></div>
          </div>
        </div>
      </div>
    </div>
  );
};
