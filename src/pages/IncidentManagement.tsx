import React, { useState, useRef, useCallback, useEffect } from 'react';
import PageTemplate from './template';
import TableView, {type scrollToConfig} from '../components/ewul_TableFlex';
import Modal from '../components/ewul_Modal';
import IncidentReportForm, { type IncidentFormHandle } from '../components/CreateIncidentReportForm';
import {IR_ShortBags_Form} from '../components/IR_ShortBags_Form';
import { RefreshCcw, Plus } from 'lucide-react';
import DateRangePicker from '../components/ewul_DateRangePicker';

import { 
    INCIDENT_TABLE_MODULE
} from '../truth.config';
import { useUser } from '../utils/useUser';
import {
    ewulFetchAll,
    ISOtoInt,
    ewul_canFetch as canFetch,
    ewul_isAnythingLoading as isAnythingLoading,
    ewul_setLoadingFor as setLoadingFor,
    // ewul_loadingList as loadingList,
    // logDmsUpdate,
} from '../utils/Ewul_GSDC_Utils';


//power apps
import { OP_IncidentReportsService } from '../generated/services/OP_IncidentReportsService';
import { type OP_IncidentReports } from '../generated/models/OP_IncidentReportsModel';

// Define a loading key for incident reports
const FETCH_LOADING_KEYS = {
    incidentReports: 'incidentReports',
    // Add other loading keys here as needed for other fetches
};

const IncidentManagement: React.FC = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedReport, setSelectedReport] = useState<OP_IncidentReports | null>(null);
    const formRef = useRef<IncidentFormHandle>(null);
    const { user } = useUser();
    const [scrollTo, setScrollTo] = useState<scrollToConfig | null>(null);

    const [incidentReports, setIncidentReports] = useState<any[]>([]);
    const [selectedDateRange, setSelectedDateRange] = useState<{ from: string; to: string }>({ from: '', to: '' });

    const fetchIncidentReports = useCallback(async () => {
        if (!selectedDateRange.from || !selectedDateRange.to) {
            console.log("No valid date range selected for incident reports fetch, skipping.");
            return;
        }
        setLoadingFor(FETCH_LOADING_KEYS.incidentReports, true);
        if (!canFetch(FETCH_LOADING_KEYS.incidentReports,2000)) {setLoadingFor(FETCH_LOADING_KEYS.incidentReports, false); return;}

        console.log("Fetching incident reports with date range:", selectedDateRange);

        const fromInt = ISOtoInt(selectedDateRange.from);
        const toInt = ISOtoInt(selectedDateRange.to);
        const dateFilter = `IncidentDateAsInt ge ${fromInt} and IncidentDateAsInt le ${toInt}`;

        const options = {
            filter: dateFilter,
            orderBy: ["IncidentDateAsInt desc"],
        };

        
        try {
            const result = await ewulFetchAll<any>(
                OP_IncidentReportsService,
                options,
                5000
            );

            if (result && result.length > 0) {
                setIncidentReports(result);
            } else {
                setIncidentReports([]);
            }
        } catch (err) {
            console.error("Fetch Error fetching incident reports:", err);
            setIncidentReports([]);
        } finally {
            setLoadingFor(FETCH_LOADING_KEYS.incidentReports, false);
            // console.log("Fetch incident reports completed."); // Removed count as state update is async
        }
    }, [selectedDateRange]);

    useEffect(() => {
        fetchIncidentReports();
    }, [fetchIncidentReports]); // Re-fetch whenever the memoized fetchIncidentReports function changes (i.e., selectedDateRange changes)

    useEffect(() => {
        if (!isModalOpen) {
            setScrollTo({ search_col: 'wew', key: 'wew', highlight: 'success' });
        }
    }, [isModalOpen]);


    const handleDateRangeChange = useCallback((range: { from: string; to: string }) => {
        setSelectedDateRange(range);
        console.log("Selected Date Range:", range);
        // fetchIncidentReports will be triggered by the useEffect due to selectedDateRange change
    }, []);

    const handleRowClick = (row: any) => {
        setSelectedReport(row);
        // setIsModalOpen(true);
        setScrollTo({ search_col: 'IncidentID', key: row.IncidentID, highlight: 'success' });
        setTimeout(() => formRef.current?.setFormData(row), 50);
    };

    const headerActions = (
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <DateRangePicker
                allowedTypes={['Weekly', 'Monthly', 'Yearly', 'Custom']}
                onFilterChange={handleDateRangeChange}
                opacity={1}
                bgColor='var(--color-primary)'
                hoverColor='var(--color-primary)'
            />
            <button
                className="header-action-btn"
                onClick={fetchIncidentReports}
                disabled={isAnythingLoading()}
            >
                <RefreshCcw size={18} /> Refresh
            </button>
            { user?.Position === 'Developer' && (<button className="header-action-btn primary" onClick={() => {
                setSelectedReport(null);
                setIsModalOpen(true);
            }}>
                <Plus size={18} /> New Report
            </button>)}
        </div>
    );

    const handleSubmit = (data: any) => {
        setSelectedReport(null); setScrollTo({ search_col: 'wew', key: 'wew', highlight: 'success' });
        console.log(data.length);

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
        
    }

    const handleSave = (data: any) => {
        setSelectedReport(null); setScrollTo({ search_col: 'wew', key: 'wew', highlight: 'success' });
        console.log(data.length);

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
    }

    const handleDelete = (data: any) => { // Assuming data is of type OP_IncidentReports for better typing
        setSelectedReport(null);
        setScrollTo({ search_col: 'wew', key: 'wew', highlight: 'success' }); // Reset scroll highlight
        console.log("incident to be deleted: ",data );
        setIncidentReports(prev => {
            // Filter out the report with the matching IncidentID
            return prev.filter(report => report.IncidentID !== data.IncidentID);
        });
    }




    return (
        <PageTemplate title="Incident Management" actions={headerActions}>

            <div style={{ height: '100%', width: '100%' }}>
                <TableView
                    data={incidentReports}
                    config={INCIDENT_TABLE_MODULE.table_config}
                    rowStyle={INCIDENT_TABLE_MODULE.rowStyle}
                    onRowClick={handleRowClick}
                    isLoading={isAnythingLoading()}
                    loadingNoPreventAction={true}
                    theme="var(--color-primary)"
                    showNumbering={true}
                    highlightSelected={true}
                    scrollTo={scrollTo}
                    onRefresh={fetchIncidentReports}
                    overflowX={true}
                    overflowY={true}
                    showRowCount={50}
                />
            </div>

            {isModalOpen && (
                <Modal onClose={() => setIsModalOpen(false)} width="30%">
                    <div className="modal-header">
                        <h2>{selectedReport ? `Incident Report: ${selectedReport.OE_Reference}` : 'Create Incident Report'}</h2>
                    </div>
                    <div style={{ padding: '20px' }}>
                        <IncidentReportForm
                            ref={formRef}
                            onClose={() => setIsModalOpen(false)}
                            onSubmit={async (data) => {
                                console.log("Saving incident:", data);
                                // Optimistic Update
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
                                // Refresh
                                fetchIncidentReports();
                            }}
                            ReportBy={user?.FullName}
                            ReporterPosition={user?.Position}
                        />
                    </div>
                </Modal>
            )}


            {selectedReport && (
                <Modal 
                    onClose={() => setSelectedReport(null)} 
                    height="100%"
                    overlayBlur={4}
                    overlayColor="rgba(11, 19, 43, 0.4)" /* Deep custom navy overlay tint */
                    hideX={true} /* Hide the default close button since we have a custom cancel button in the form */
                >
                    {(() => {
                    switch (selectedReport.IncidentType) {
                        case 'Short Bags':
                        return (
                            <IR_ShortBags_Form 
                                incidentReportItem={selectedReport}
                                initialUser={user ?? undefined}
                                onClose={() => {setSelectedReport(null); setScrollTo({ search_col: 'wew', key: 'wew', highlight: 'success' });}}
                                onSubmit={handleSubmit}
                                onSave={handleSave}
                                onDelete={handleDelete}
                            />
                        );
                        default:
                        return (<div>{selectedReport.IRID || ''}</div>);
                    }
                    })()}
                </Modal>
            )}
        </PageTemplate>
    );
};

export default IncidentManagement;