import React, { useState, useRef } from 'react';
import PageTemplate from './template';
import TableView from '../components/ewul_TableFlex';
import Modal from '../components/ewul_Modal';
import IncidentReportForm, { type IncidentFormHandle } from '../components/IncidentReportForm';
import { RefreshCcw, Plus } from 'lucide-react';

//truth
import { 
    // IR_TYPES,
    INCIDENT_TABLE_MODULE
} from '../truth.config'; // Importing IR types for dropdown options

const IncidentManagement: React.FC = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedReport, setSelectedReport] = useState<any>(null);
    const formRef = useRef<IncidentFormHandle>(null);


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
                    data={[]} // Your fetched incident data
                    config={INCIDENT_TABLE_MODULE.table_config}
                    onRowClick={handleRowClick}
                />
            </div>

            {isModalOpen && (
                <Modal onClose={() => setIsModalOpen(false)}>
                    <div className="modal-header">
                        <h2>{selectedReport ? `Incident Report: ${selectedReport.OE}` : 'New Incident Report'}</h2>
                    </div>
                    <div style={{ padding: '20px' }}>
                        <IncidentReportForm 
                            ref={formRef}
                            onClose={() => setIsModalOpen(false)}
                            onSubmit={(data) => {
                                console.log("Saving incident:", data);
                                setIsModalOpen(false);
                            }}
                        />
                    </div>
                </Modal>
            )}
        </PageTemplate>
    );
};

export default IncidentManagement;