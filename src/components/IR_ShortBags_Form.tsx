import React, { useState } from 'react';
import { Printer, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react'; // Clear, modern utility icons
import '../components/comp_css/IR_ShortBags_Form.css';

interface IR_ShortBags_Props {
  initialUser?: string;
  onClose?: () => void;
  onSubmit?: (data: any) => void;
}

export const IR_ShortBags_Form: React.FC<IR_ShortBags_Props> = ({ initialUser, onClose}) => {
  const [zoom, setZoom] = useState<number>(1.0); // 1.0 = 100% original scale
  const [formData, setFormData] = useState({
    irReferenceNo: '',
    date: '',
    empName: '',
    empPosition: '',
    businessUnit: '',
    buHead: '',
    unitHawak: '',
    lokasyon: '',
    petsa: '',
    oras: '',
    detalyeNgInsidente: '',
    yarda: '',
    yardaOthers: '',
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
    setFormData(prev => ({ ...prev, yarda: yardName }));
  };

  const handlePrint = () => {
    // 1. Locate the exact document container element
    const printContent = document.querySelector('.ir-sb-document');
    if (!printContent) return;

    // 2. Create a temporary hidden iframe element
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.width = '0px';
    iframe.style.height = '0px';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentWindow?.document;
    if (!iframeDoc) return;

    // 3. Write a pristine HTML shell into the iframe, cloning your styles and form markup
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
              margin: 0; /* Removes browser-added title, date, and URL */
            }

            body {
              margin: 0;
              padding: 1.5cm; /* Controls the actual margin of your content on paper */
              background: #ffffff;
              -webkit-print-color-adjust: exact; /* Ensures gradients/colors print */
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
            }

            /* Hide 'mm/dd/yyyy' placeholder for empty date/time inputs during print */
            input[type="date"]:invalid::-webkit-datetime-edit,
            input[type="date"]:not([value])::-webkit-datetime-edit,
            input[type="time"]:invalid::-webkit-datetime-edit,
            input[type="time"]:not([value])::-webkit-datetime-edit {
                color: transparent !important;
            }

            /* Ensure that if a value IS present, it shows up black */
            input[type="date"]::-webkit-datetime-edit-month-field,
            input[type="date"]::-webkit-datetime-edit-day-field,
            input[type="date"]::-webkit-datetime-edit-year-field,
            input[type="time"]::-webkit-datetime-edit-hour-field,
            input[type="time"]::-webkit-datetime-edit-minute-field,
            input[type="time"]::-webkit-datetime-edit-ampm-field {
                color: inherit;
            }

            .is-empty-print::-webkit-datetime-edit {
                color: transparent !important;
            }

            .is-empty-print::-webkit-datetime-edit-text,
            .is-empty-print::-webkit-datetime-edit-month-field,
            .is-empty-print::-webkit-datetime-edit-day-field,
            .is-empty-print::-webkit-datetime-edit-year-field {
            color: transparent !important;
            }
          </style>
        </head>
        <body>
          <div class="ir-sb-document">
            ${printContent.innerHTML}
          </div>
        </body>
      </html>
    `);
    iframeDoc.close();

    // 4. Ensure input values are transferred over (innerHTML doesn't copy current live state text values)
    const sourceInputs = printContent.querySelectorAll('input, textarea, select');
    const iframeInputs = iframeDoc.querySelectorAll('input, textarea, select');
    
    sourceInputs.forEach((input: any, index: number) => {
      if (input.type === 'checkbox' || input.type === 'radio') {
        (iframeInputs[index] as any).checked = input.checked;
      } else {
        (iframeInputs[index] as any).value = input.value;
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


  const handleNewLine  = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const lineCount = (formData.detalyeNgInsidente.match(/\n/g) || []).length + 1;
    if (e.key === 'Enter') {
      if (lineCount >= 5) {
        e.preventDefault();
      }
    }
  };

  // Zoom Handler functions
  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.1, 1.5));  // Cap zoom maximum at 150%
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.1, 0.7)); // Cap zoom minimum at 70%
  const handleResetZoom = () => setZoom(1.0);

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
        {onClose && (
          <button type="button" onClick={onClose} className="ir-sb-btn ir-sb-close-btn">
            Cancel
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
              <h1>INCIDENT REPORT (SHORT BAGS)</h1>
            </div>
            <div className="ir-sb-header-spacer" aria-hidden="true"/> 
          </div>

          {/* Reference and Date[cite: 3] */}
          <div className="ir-sb-meta-row">
            <div className="ir-sb-input-group flex-2">
              <span className="ir-sb-label">IR Reference No:</span>
              <input type="text" name="irReferenceNo" value={formData.irReferenceNo} onChange={handleChange} className="ir-sb-line-input" />
            </div>
            <div className="ir-sb-input-group flex-1">
              <span className="ir-sb-label">Date:</span>
              <input type="date" name="date" value={formData.date} onChange={handleChange} className={`ir-sb-line-input ${!formData.date ? 'is-empty-print' : ''}`} />
            </div>
          </div>

          {/* Section: Impormasyon ng Empleado[cite: 3] */}
          <h3 className="ir-sb-section-head">IMPORMASIYON NG EMPLEYADO</h3>
          <div className="ir-sb-grid col-2">
            <div className="ir-sb-input-group">
              <span className="ir-sb-label">Pangalan:</span>
              <input type="text" name="empName" value={formData.empName} onChange={handleChange} className="ir-sb-line-input" />
            </div>
            <div className="ir-sb-input-group">
              <span className="ir-sb-label">Posisyon:</span>
              <input type="text" name="empPosition" value={formData.empPosition} onChange={handleChange} className="ir-sb-line-input" />
            </div>
            <div className="ir-sb-input-group">
              <span className="ir-sb-label">Business Unit:</span>
              <input type="text" name="businessUnit" value={formData.businessUnit} onChange={handleChange} className="ir-sb-line-input" />
            </div>
            <div className="ir-sb-input-group">
              <span className="ir-sb-label">BU Head:</span>
              <input type="text" name="buHead" value={formData.buHead} onChange={handleChange} className="ir-sb-line-input" />
            </div>
            <div className="ir-sb-input-group span-2">
              <span className="ir-sb-label">Unit na Hawak:</span>
              <input type="text" name="unitHawak" value={formData.unitHawak} onChange={handleChange} className="ir-sb-line-input" />
            </div>
          </div>

          {/* Section: Diskripsyon ng Insidente[cite: 3] */}
          <h3 className="ir-sb-section-head">DISKRIPSYON NG INSIDENTE</h3>
          <div className="ir-sb-grid col-3">
            <div className="ir-sb-input-group"><span className="ir-sb-label">Lokasyon:</span><input type="text" name="lokasyon" onChange={handleChange} className="ir-sb-line-input" /></div>
            <div className="ir-sb-input-group"><span className="ir-sb-label">Petsa:</span><input type="date" name="petsa" onChange={handleChange} className="ir-sb-line-input" /></div>
            <div className="ir-sb-input-group"><span className="ir-sb-label">Oras:</span><input type="time" name="oras" onChange={handleChange} className="ir-sb-line-input" /></div>
          </div>

          <div className="ir-sb-input-group full-width">
            <span className="ir-sb-label block">DETALYE NG INSIDENTE:</span>
            <textarea
              name="detalyeNgInsidente" 
              value={formData.detalyeNgInsidente} 
              onChange={handleChange} 
              onKeyDown={handleNewLine}
              rows={5} 
              className="ir-sb-textarea" 
            />
          </div>

          {/* Section: Karagdagang Detalye[cite: 3] */}
          <h3 className="ir-sb-section-head">KARAGDAGANG DETALYE</h3>
          <div className="ir-sb-yard-selector">
            <span className="ir-sb-label">Yarda :</span>
            <div className="ir-sb-checkbox-grid">
              {['Alphabase', 'Vasquez', 'Intercity', 'Lingunan', 'Geomax'].map(yard => (
                <label key={yard} className="ir-sb-check-item">
                  <input type="checkbox" checked={formData.yarda === yard} onChange={() => handleCheckbox(yard)} /> {yard}
                </label>
              ))}
              <div className="ir-sb-check-item span-all">
                <input type="checkbox" checked={formData.yarda === 'Others'} onChange={() => handleCheckbox('Others')} /> Others: 
                <input type="text" name="yardaOthers" value={formData.yardaOthers} onChange={handleChange} disabled={formData.yarda !== 'Others'} className="ir-sb-line-input inline" />
              </div>
            </div>
          </div>

          {/* Section: Detalye ng Nag Report[cite: 3] */}
          <h3 className="ir-sb-section-head">DETALYE NG NAG REPORT</h3>
          <div className="ir-sb-grid col-2">
            <div className="ir-sb-input-group"><span className="ir-sb-label">Petsa:</span><input type="date" name="reportDate" onChange={handleChange} className="ir-sb-line-input" /></div>
            <div className="ir-sb-input-group"><span className="ir-sb-label">Pangalan:</span><input type="text" name="reportName" value={formData.reportName} onChange={handleChange} className="ir-sb-line-input" /></div>
            <div className="ir-sb-signature-box"><span className="ir-sb-label">Pirma:</span><div className="line"></div></div>
            <div className="ir-sb-input-group"><span className="ir-sb-label">Posisyon:</span><input type="text" name="reportPosition" onChange={handleChange} className="ir-sb-line-input" /></div>
          </div>
        </div>
      </div>
    </div>
  );
};