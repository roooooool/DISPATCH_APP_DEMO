import React, { useState, useRef } from 'react';
import PageTemplate from './template';
import TableView from '../components/ewul_TableFlex';
import Modal from '../components/ewul_Modal';
import IncidentReportForm, { type IncidentFormHandle } from '../components/CreateIncidentReportForm';
import { RefreshCcw, Plus } from 'lucide-react';

//truth
import { 
    // IR_TYPES,
    INCIDENT_TABLE_MODULE
} from '../truth.config'; // Importing IR types for dropdown options


//utils
import {useUser} from '../utils/useUser';


const IncidentManagement: React.FC = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedReport, setSelectedReport] = useState<any>(null);
    const formRef = useRef<IncidentFormHandle>(null);
    const { user } = useUser();

    const [incidentReports, setIncidentReports] = useState<any[]>([]); // Replace with actual data fetching logic


    const handleRowClick = (row: any) => {
        setSelectedReport(row);
        setIsModalOpen(true);
        // Timeout ensures the modal ref is mounted before setting data
        setTimeout(() => formRef.current?.setFormData(row), 50);
    };

    const headerActions = (
        <div style={{ display: 'flex', gap: '10px' }}>
            <button className="header-action-btn" onClick={() => {/* refresh data */}}>
                <RefreshCcw size={18} /> Refresh
            </button>
            <button className="header-action-btn primary" onClick={() => {
                setSelectedReport(null);
                setIsModalOpen(true);
            }}>
                <Plus size={18} /> New Report
            </button>
        </div>
    );

    return (
        <PageTemplate title="Incident Management" actions={headerActions}>
            <div style={{ height: '100%', width: '100%' }}>
                <TableView
                    data={incidentReports} // Your fetched incident data
                    config={INCIDENT_TABLE_MODULE.table_config}
                    onRowClick={handleRowClick}
                />
            </div>

            {isModalOpen && (
                <Modal onClose={() => setIsModalOpen(false)} width="30%">
                    <div className="modal-header">
                        <h2>{selectedReport ? `Incident Report: ${selectedReport.OE}` : 'Create Incident Report'}</h2>
                    </div>
                    <div style={{ padding: '20px' }}>
                        <IncidentReportForm 
                            ref={formRef}
                            onClose={() => setIsModalOpen(false)}
                            onSubmit={(data) => {
                                console.log("Saving incident:", data);
                                setIncidentReports(prev => {
                                    const existingIndex = prev.findIndex(r => r.IncidentID === data.IncidentID);
                                    if (existingIndex !== -1) {
                                        // Update existing report
                                        const updated = [...prev];
                                        updated[existingIndex] = { ...updated[existingIndex], ...data };
                                        return updated;
                                    } else {
                                        // Add new report
                                        return [...prev, { ...data, IncidentID: `temp-${Date.now()}` }]; // Assign temp ID for new reports
                                    }
                                });
                                setIsModalOpen(false);
                            }}
                            user={user}
                        />
                    </div>
                </Modal>
            )}
        </PageTemplate>
    );
};

export default IncidentManagement;