import { useState, useImperativeHandle, forwardRef, useEffect } from 'react';
import { Save } from 'lucide-react';
import SearchableDropdown, { type DropdownOption } from './SearchableDropdown';

import { 
    IR_REPORT_TYPES,
    IR_ACTION_OPTIONS 
} from '../truth.config';

import '../components/comp_css/OrderDistributionForm.css'; // Reusing for container styles

//power apps
import {OP_IncidentReportsService} from '../generated/services/OP_IncidentReportsService';
import {type OP_IncidentReports} from '../generated/models/OP_IncidentReportsModel';
import {GenerateIRIDService} from '../generated/services/GenerateIRIDService';

//utils
import { useTaskWorker } from '../utils/TaskWorkerContext';


//incident forms model
import {type IR_ShortBags_Form_Model} from './IR_ShortBags_Form';


export interface IncidentFormHandle {
    setFormData: (data: Partial<OP_IncidentReports>) => void;
    submit: () => Promise<OP_IncidentReports | null>;
}

export type CreateIR_EmployeeDetails = {
    EmployeeName: string;
    EmployeeID: string;
    EmployeePosition: string;
    EmployeeBUHead?: string;
    EmployeeTractor?: string;
    EmployeeTrailer?: string;

    flexValue?: any;
}

interface IncidentReportFormProps {
    onClose: () => void;
    onSubmit: (data: Partial<OP_IncidentReports>) => void;
    ReportBy: string | null | undefined;
    ReporterPosition?: string;
    OE?: string; // Optional OE reference to pre-fill the form when creating from a specific trip context
    employeeDetails?: CreateIR_EmployeeDetails;
    preFill?: IR_ShortBags_Form_Model | object;
}



const IncidentReportForm = forwardRef<IncidentFormHandle, IncidentReportFormProps>(({ onClose, onSubmit, ReportBy, ReporterPosition, OE, preFill, employeeDetails }, ref) => {
    const { addTask } = useTaskWorker();

    const [isSubmitting, setIsSubmitting] = useState(false);


    const ACTION_OPTIONS: DropdownOption[] = IR_ACTION_OPTIONS.map(option => ({
        value: option.value,
        label: option.label
    }));

    const REPORT_TYPES: DropdownOption[] = IR_REPORT_TYPES.map(option => ({
        value: option.value,
        label: option.label
    }));

    const [formData, setFormData] = useState<Partial<OP_IncidentReports>>({
        OE_Reference: OE || '', // Pre-fill with OE if provided
        IncidentType: REPORT_TYPES[0].value,
        ActionStatus: ACTION_OPTIONS[0].value,
        ReportedBy: ReportBy || '',
        ReporterPosition: ReporterPosition || '',
        Remarks: '',
        IRStatus: 'Open',
        ...{ ...employeeDetails, flexValue: employeeDetails?.flexValue.toString() }
    });



    useEffect(() => {
        // Update ReportedBy if user object changes and it's not already set
        if (ReportBy && !formData.ReportedBy) {
            setFormData(prev => ({ ...prev, ReportedBy: ReportBy }));
        } else if (!ReportBy && formData.ReportedBy) {
            // Clear if user logs out
            setFormData(prev => ({ ...prev, ReportedBy: '' }));
        }
    }, [ReportBy, formData.ReportedBy]);

    const updateField = (field: string, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    // 1. Rewrite handleSubmit to return a Promise containing the record data or null
    const handleSubmit = (data: Partial<OP_IncidentReports>): Promise<OP_IncidentReports | null> => {
        const submittedData = data as Omit<OP_IncidentReports, "IncidentID">;

        // Return a new Promise so the parent component can cleanly "await" the result
        return new Promise((resolve) => {
            addTask({
                id: `createreport-${data.OE_Reference}`,
                name: `Creating Incident Report for ${data.OE_Reference}`,
                execute: async () => {
                    let result = null;
                    try {
                        console.log("Submitting incident report");

                        const resIRID = await GenerateIRIDService.GenerateIRID({
                            IncidentType: submittedData.IncidentType
                        } as any);

                        const table1 = resIRID.data?.ResultSets?.Table1 as any[] | undefined;
                        if (!table1 || table1.length <= 0) {
                            throw new Error("Failed to generate ID: ");
                        }

                        result = await OP_IncidentReportsService.create({
                            ...submittedData, 
                            IRID: table1[0].NewIRID || 'NA', 
                            reportJSON: JSON.stringify(preFill)
                        });

                        if (result.error) {
                            throw new Error(result.error.message);
                        }

                        if (!result || !result.data) {
                            throw new Error("Unexpected response from server: " + JSON.stringify(result));
                        }

                        // Return success and include the newly generated record data payload
                        return { success: true, data: result.data };
                    } catch (error) {
                        console.error("Failed to upload attendance records:", error);
                        return { success: false, error };
                    }
                },
                checkSuccess: (result: { success: boolean, data?: any, error?: any }) => {
                    return result.success;
                },
                onSuccess: async (result: any) => {
                    // Extracts the raw record payload coming back from OP_IncidentReportsService
                    const createdItem = result.data?.data;
                    onSubmit(createdItem);
                    resolve(createdItem); // Resolves the parent call promise with the new object
                },
                onFailure: async (result: any) => {
                    console.log(result);
                    resolve(null); // Resolves as null so the parent wrapper knows it failed
                },
                message: `Please wait while we create an Incident Report....`,
                message_success: `Incident Report created successfully for ${formData.OE_Reference}`,
                message_failure: `Failed to create Incident Report for ${formData.OE_Reference}`,
            });

            setIsSubmitting(false);
            onClose();
        });
    };

    const handleExternalSubmit = async (data: Partial<OP_IncidentReports>): Promise<OP_IncidentReports | null> => {
        const submittedData = data as Omit<OP_IncidentReports, "IncidentID">;
        setIsSubmitting(true); // Set loading state before making network requests

        try {
            console.log("Submitting incident report");

            console.log("2")

            // 1. Await the ID Generator Service
            const resIRID = await GenerateIRIDService.GenerateIRID({
                IncidentType: submittedData.IncidentType
            } as any);

            console.log("1")

            const table1 = resIRID.data?.ResultSets?.Table1 as any[] | undefined;
            if (!table1 || table1.length <= 0) {
                throw new Error("Failed to generate ID: ");
            }
            console.log("prefill: ", preFill)
            // 2. Await the Creation Service
            const result = await OP_IncidentReportsService.create({
                ...submittedData, 
                IRID: table1[0].NewIRID || 'NA',
                reportJSON: JSON.stringify(preFill)
            });

            if (result.error) {
                throw new Error(result.error.message);
            }

            if (!result || !result.data) {
                throw new Error("Unexpected response from server: " + JSON.stringify(result));
            }

            // Return the clean data model block straight to the await caller
            return result.data;

        } catch (error) {
            console.error("Failed to upload attendance records:", error);
            return null; // Gracefully pass back null if things break down
            
        } finally {
            // 3. Clean up interaction states after operations conclude
            setIsSubmitting(false);
        }
    };

    useImperativeHandle(ref, () => ({
        setFormData: (data: Partial<OP_IncidentReports>) => {
            setFormData({
                OE_Reference: data.OE_Reference || '',
                IncidentType: data.IncidentType || REPORT_TYPES[0].value,
                ActionStatus: data.ActionStatus || ACTION_OPTIONS[0].value,
                ReportedBy: data.ReportedBy || ReportBy || '',
                ReporterPosition: data.ReporterPosition || '',
                Remarks: data.Remarks || ''
            });
        },
        // Parent can now trigger this manually via ref.current.submit()
        submit: () => {
            return handleExternalSubmit(formData);
        }
    }));

    return (
        <div className="wew" style={{ display: 'flex', flexDirection: 'column', height: '100%'}}>
            <div className="order-dist-container create-incident-container">
                <div className="scrollable-body">
                    
                    <div className="input-group-group">
                        <div className="form-row" style={{ padding: '14px' }}>
                            <div className="input-group">
                                <label>OE Reference (Trip)</label>
                                <div className="share-gradient-wrapper">
                                    <input 
                                        className="share-textarea" 
                                        style={{ height: '40px' }}
                                        value={formData.OE_Reference} 
                                        onChange={(e) => updateField('OE_Reference', e.target.value)} 
                                        placeholder="OE-XXXXX" 
                                    />
                                </div>
                            </div>

                            <div className="input-group">
                                <label>Report Type</label>
                                <SearchableDropdown
                                    options={REPORT_TYPES}
                                    value={formData.IncidentType}
                                    onChange={(val) => updateField('IncidentType', val)}
                                    placeholder="Select Type..."
                                />
                            </div>
                        </div>

                        <div className="form-row" style={{ padding: '14px' }}>
                            <div className="input-group">
                                <label>Action</label>
                                <SearchableDropdown
                                    options={ACTION_OPTIONS}
                                    value={formData.ActionStatus}
                                    onChange={(val) => updateField('ActionStatus', val)}
                                    placeholder="Select Action..."
                                />
                            </div>

                            <div className="input-group">
                                <label>Created By</label>
                            <div className="share-gradient-wrapper">
                                    <input
                                        className="share-textarea"
                                        style={{ height: '40px' }}
                                        value={formData.ReportedBy}
                                        placeholder="Your Name"
                                        readOnly // Made read-only as it's auto-filled
                                />
                            </div>
                        </div>
                    </div>

                        <div className="input-group" style={{ padding: '0 14px 14px 14px' }}>
                            <label>Quick Remarks</label>
                            <div className="share-gradient-wrapper">
                                <textarea
                                    className="share-textarea"
                                    value={formData.Remarks}
                                    onChange={(e) => updateField('Remarks', e.target.value)}
                                    rows={5}
                                />
                    </div>
                </div>
            </div>
            </div>
                <div className="sticky-footer order-dist-footer create-incident-footer">
                    <button disabled={isSubmitting} className="btn-cancel" onClick={onClose}>Cancel</button>
                    <button disabled={isSubmitting} className="btn-proceed" onClick={() => {handleSubmit(formData); setIsSubmitting(true);}}>
                        <Save size={18} /> Create Incident Report
                    </button>
                </div>
            </div>
        </div>
    );
});

export default IncidentReportForm;
