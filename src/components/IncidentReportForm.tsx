import { useState, useImperativeHandle, forwardRef, useRef } from 'react';
import { Save, ClipboardList, AlertCircle, ChevronDown, Clock, Image as ImageIcon } from 'lucide-react';

// YOUR CUSTOM COMPONENTS
import SearchableDropdown, { type DropdownOption } from './SearchableDropdown';
import CustomDateTimePicker from './ModernTimestampInput';
import CustomFileAttachment, { type CustomFileAttachmentRef } from './DropFile';

// SHARED CSS
import '../components/comp_css/OrderDistributionForm.css';

export interface IncidentFormHandle {
    setFormData: (data: any) => void;
}

interface IncidentReportFormProps {
    onClose: () => void;
    onSubmit: (data: any) => void;
}

// Options for the SearchableDropdown
const INCIDENT_TYPES: DropdownOption[] = [
    { value: 'Mechanical', label: 'Mechanical Breakdown' },
    { value: 'Accident', label: 'Road Accident' },
    { value: 'Delay', label: 'Operational Delay' },
    { value: 'Other', label: 'Other / Miscellaneous' }
];

const ACTION_VERDICTS: DropdownOption[] = [
    { value: 'Pending', label: 'Pending' },
    { value: 'Inspection', label: 'Inspection Required'},
    { value: 'Proceed', label: 'Proceed Next Trip' },
    { value: 'Retrieval', label: 'Vehicle Retrieval'}
];

const IncidentReportForm = forwardRef<IncidentFormHandle, IncidentReportFormProps>(({ onClose, onSubmit }, ref) => {
    const [isActionOpen, setIsActionOpen] = useState(true);
    const fileAttachRef = useRef<CustomFileAttachmentRef>(null);
    const [tempAttachments, setTempAttachments] = useState<File[]>([]);
    const [existingAttachments, setExistingAttachments] = useState<any[]>([]);

    const [formData, setFormData] = useState({
        OE: '',
        Type: 'Mechanical',
        IncidentTime: new Date(),
        Remarks: '',
        Description: '',
        Action: 'Pending',
        Resolution: ''
    });

    // Allows the Table to push data into the form when a row is clicked
    useImperativeHandle(ref, () => ({
        setFormData: (data) => {
            setFormData({
                ...data,
                IncidentTime: data.IncidentTime ? new Date(data.IncidentTime) : new Date()
            });
            // If the record already has files from the DB:
            if (data.attachments) setExistingAttachments(data.attachments);
        }
    }));

    const updateField = (name: string, value: any) => {
        setFormData(prev => ({ ...prev, [name]: value }));
    };


    return (
        <div className="order-dist-container">
            <div className="scrollable-body">
                
                {/* SECTION 1: CORE TRIP & INCIDENT DETAILS */}
                <div className="input-group-group">
                    <div className="group-header">
                        <div className="group-header-title">
                            <ClipboardList size={18} /> Incident Details
                        </div>
                    </div>
                    
                    <div className="form-row" style={{ padding: '14px' }}>
                        {/* 1. OE Reference (Plain Gradient Input) */}
                        <div className="input-group">
                            <label>OE Reference (Trip)</label>
                            <div className="share-gradient-wrapper">
                                <input 
                                    className="share-textarea" 
                                    style={{ height: '40px' }}
                                    value={formData.OE} 
                                    onChange={(e) => updateField('OE', e.target.value)} 
                                    placeholder="OE-XXXXX" 
                                />
                            </div>
                        </div>

                        {/* 2. Incident Type (Searchable Dropdown) */}
                        <div className="input-group">
                            <label>Incident Type</label>
                            <SearchableDropdown 
                                options={INCIDENT_TYPES}
                                value={formData.Type}
                                onChange={(val) => updateField('Type', val)}
                                placeholder="Select Type..."
                            />
                        </div>
                    </div>

                    <div className="form-row" style={{ padding: '0 14px 14px 14px' }}>
                        {/* 3. Time of Incident (Modern Timestamp Input) */}
                        <div className="input-group">
                            <label><Clock size={14} /> Reported Time of Occurrence</label>
                            <CustomDateTimePicker 
                                value={formData.IncidentTime}
                                onChange={(date: Date) => updateField('IncidentTime', date)}
                            />
                        </div>
                    </div>

                    <div className="input-group" style={{ padding: '0 14px 14px 14px' }}>
                        <label>Incident Description (Detailed)</label>
                        <div className="share-gradient-wrapper">
                            <textarea 
                                className="share-textarea" 
                                value={formData.Description} 
                                onChange={(e) => updateField('Description', e.target.value)}
                                rows={3}
                                placeholder="Describe the situation in detail..."
                            />
                        </div>
                    </div>
                </div>

                {/* SECTION 2: EVIDENCE ATTACHMENTS (Photos/Docs) */}
                <div className="input-group-group" style={{ marginTop: '10px' }}>
                    <div className="group-header">
                        <div className="group-header-title">
                            <ImageIcon size={18} /> Evidence & Attachments
                        </div>
                    </div>
                    <div style={{ padding: '14px' }}>
                        <CustomFileAttachment 
                            ref={fileAttachRef}
                            // Pass existing files + new local files
                            files={[...existingAttachments, ...tempAttachments]} 
                            onFilesChange={(mergedList: any[]) => {
                                // Filter to keep only the actual File objects for the local state
                                const onlyNewFiles = mergedList.filter(f => f instanceof File);
                                setTempAttachments(onlyNewFiles);
                            }}
                            label="Incident Photos / Evidence"
                        />
                    </div>
                </div>

                {/* SECTION 3: DOCUMENTATOR ACTION (Collapsible) */}
                <div className="input-group-group" style={{ marginTop: '10px' }}>
                    <div className="group-header" onClick={() => setIsActionOpen(!isActionOpen)}>
                        <div className="group-header-title">
                            <AlertCircle size={18} /> Documentator Resolution
                        </div>
                        <ChevronDown className={`toggle-icon ${!isActionOpen ? 'is-collapsed' : ''}`} />
                    </div>
                    <div className={`group-content-wrapper ${isActionOpen ? 'is-open' : ''}`}>
                        <div className="group-content-inner">
                            <div className="input-group">
                                <label>Action Verdict</label>
                                <SearchableDropdown 
                                    options={ACTION_VERDICTS}
                                    value={formData.Action}
                                    onChange={(val) => updateField('Action', val)}
                                    placeholder="Select Action..."
                                />
                            </div>
                            <div className="input-group" style={{ marginTop: '10px' }}>
                                <label>Final Resolution Notes</label>
                                <div className="share-gradient-wrapper">
                                    <textarea 
                                        className="share-textarea" 
                                        value={formData.Resolution} 
                                        onChange={(e) => updateField('Resolution', e.target.value)}
                                        rows={2} 
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* STICKY FOOTER */}
            <div className="sticky-footer order-dist-footer">
                <button className="btn-cancel" onClick={onClose}>Cancel</button>
                <button className="btn-proceed" onClick={() => onSubmit(formData)}>
                    <Save size={18} /> Submit Incident
                </button>
            </div>
        </div>
    );
});

export default IncidentReportForm;