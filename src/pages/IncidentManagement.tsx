import React, { useState, useRef, useCallback, useEffect, } from 'react';
import PageTemplate from './template';
import TableView, { type scrollToConfig } from '../components/ewul_TableFlex';
import Modal from '../components/ewul_Modal';
import IncidentReportForm, { type IncidentFormHandle } from '../components/CreateIncidentReportForm';
import { IR_ShortBags_Form } from '../components/IR_ShortBags_Form';
import { RefreshCcw, Plus } from 'lucide-react';
import DateRangePicker, { type DateRangeType } from '../components/ewul_DateRangePicker';

import {
    INCIDENT_TABLE_MODULE, STORAGE_KEY_PREFIX
} from '../truth.config';
import { useUser } from '../utils/useUser';
import {
    //@ts-ignore
    ewulFetchAll, ewulCreate, ewulUpdate, ewulDelete, ewulExecute, ewulSharePointAPI,
    ISOtoInt,
    ewul_canFetch as canFetch,
    ewul_isAnythingLoading as isAnythingLoading,
    ewul_setLoadingFor as setLoadingFor,
    // ewul_loadingList as loadingList,
    // logDmsUpdate,
    buFilter,
} from '../utils/Ewul_GSDC_Utils';


//power apps
import { OP_IncidentReportsService } from '../generated/services/OP_IncidentReportsService';
import { type OP_IncidentReports } from '../generated/models/OP_IncidentReportsModel';
import { DMS_CEMService } from '../generated/services/DMS_CEMService';
import { type DMS_CEM } from '../generated/models/DMS_CEMModel';

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


    // const handleDateRangeChange = useCallback((range: { from: string; to: string }) => {
    //     setSelectedDateRange(range);
    //     console.log("Selected Date Range:", range);
    //     // fetchIncidentReports will be triggered by the useEffect due to selectedDateRange change
    // }, []);

    // 1. Initialize state with type support & fallback for legacy entries
    const [selectedDateRange, setSelectedDateRange] = useState<{
        from: string;
        to: string;
        type?: string;
    } | null>(() => {
        if (!user?.id) return null;
        try {
            const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}${user.id}`);
            if (!saved) return null;

            const parsed = JSON.parse(saved);
            return {
                from: parsed.from,
                to: parsed.to,
                type: parsed.type || parsed.dateType || 'Monthly', // Fallback for existing items in storage
            };
        } catch (error) {
            console.error('Failed to parse saved date range from localStorage:', error);
            return null;
        }
    });

    // 2. Memoized handler that updates from, to, and type
    const handleDateRangeChange = useCallback(
        (range: { from: string; to: string; type?: string; dateType?: string }) => {
            setSelectedDateRange(prev => {
                const incomingType = range.type || range.dateType || 'Monthly';

                if (
                    prev?.from === range.from &&
                    prev?.to === range.to &&
                    prev?.type === incomingType
                ) {
                    return prev;
                }

                return {
                    from: range.from,
                    to: range.to,
                    type: incomingType,
                };
            });
        },
        []
    );

    // 3. Persist state to localStorage
    useEffect(() => {
        if (!user?.id) return;

        const storageKey = `${STORAGE_KEY_PREFIX}${user.id}`;
        if (selectedDateRange) {
            localStorage.setItem(storageKey, JSON.stringify(selectedDateRange));
        } else {
            localStorage.removeItem(storageKey);
        }
    }, [selectedDateRange, user?.id]);

    const [isReportLoading, setIsReportLoading] = useState(false);
    const fetchIncidentReports = useCallback(async () => {
        if (!selectedDateRange?.from || !selectedDateRange?.to) {
            console.log("No valid date range selected for incident reports fetch, skipping.");
            return;
        }
        setIsReportLoading(true);
        setLoadingFor(FETCH_LOADING_KEYS.incidentReports, true);
        if (!canFetch(FETCH_LOADING_KEYS.incidentReports, 2000)) { setLoadingFor(FETCH_LOADING_KEYS.incidentReports, false); return; }

        console.log("Fetching incident reports with date range:", selectedDateRange);

        const fromInt = ISOtoInt(selectedDateRange.from);
        const toInt = ISOtoInt(selectedDateRange.to);
        const dateFilter = `IncidentDateAsInt ge ${fromInt} and IncidentDateAsInt le ${toInt} and (OE_Reference ne null and OE_Reference ne '') ${buFilter("EmployeeBU", user)}`;

        const select = [
            "ActionStatus",
            "CreatedDateTime",
            "Description",
            "EmployeeBU",
            "EmployeeBUHead",
            "EmployeeID",
            "EmployeeName",
            "EmployeePosition",
            "EmployeeTractor",
            "EmployeeTrailer",
            "IRID",
            "IRStatus",
            "IncidentDateAsInt",
            "IncidentID",
            "IncidentType",
            "ModifiedBy",
            "ModifiedDateTime",
            "OE_Reference",
            "Remarks",
            "ReportedBy",
            "ReporterPosition",
            "Resolution",
            "ResolvedBy",
            "ResolvedDate",
            "ResolvedDateAsInt",
            "flexValue"
        ];

        const options = {
            filter: dateFilter,
            orderBy: ["IncidentDateAsInt desc"],
            select: select
        };


        try {
            const result = await ewulFetchAll<any>(
                OP_IncidentReportsService,
                options,
                5000
            );

            // const res = await LiveDMSView_CEM2Service.getAll();

            console.log("IR Result: ", result[0], " len: ", result.length);

            if (result && result.length > 0) {
                setIncidentReports(result);
            } else {
                setIncidentReports([]);
            }
        } catch (err) {
            console.error("Fetch Error fetching incident reports:", err);
            setIncidentReports([]);
        } finally {
            setIsReportLoading(false);
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




    const [loadingRowId, setLoadingRowId] = useState<string | number | null>(null);
    const handleRowClick = async (row: any) => {
        // 1. Set the loading indicator for the clicked row
        setLoadingRowId(row.IncidentID);

        try {
            const options = {
                filter: `IncidentID eq ${row.IncidentID}`,
            };

            const result = await ewulFetchAll<any>(
                OP_IncidentReportsService,
                options,
                1
            );

            if (!result?.length) return;

            let data = result[0] as OP_IncidentReports;

            const currentReport = JSON.parse(data?.reportJSON || '{}');

            const isEmpty = (val: any) => val === undefined || val === null || (typeof val === 'string' && val.trim() === '');

            // Check if any required field is missing
            const requiredKeys = ['Customer', 'Source', 'Destination', 'CementType', 'TripGroup'];
            const hasMissingData = requiredKeys.some((key) => isEmpty(currentReport[key]));

            // Fill up missing data
            if (hasMissingData && data.OE_Reference) {
                console.log('Fetching missing OE details for: ', data.OE_Reference);

                const oe_result = await ewulFetchAll<any>(
                    DMS_CEMService,
                    {
                        filter: `OE eq '${data.OE_Reference}'`,
                        select: ['Customer', 'Source', 'Destination', 'cementType', '_tripGroup']
                    },
                    1
                );

                if (oe_result?.length) {
                    const oeDetails = oe_result[0] as DMS_CEM;
                    const updatedReport = {
                        ...currentReport,
                        Customer: isEmpty(currentReport.Customer) ? oeDetails.Customer : currentReport.Customer,
                        Source: isEmpty(currentReport.Source) ? oeDetails.Source : currentReport.Source,
                        Destination: isEmpty(currentReport.Destination) ? oeDetails.Destination : currentReport.Destination,
                        CementType: isEmpty(currentReport.CementType) ? oeDetails.cementType : currentReport.CementType,
                        TripGroup: isEmpty(currentReport.TripGroup) ? oeDetails._tripGroup : currentReport.TripGroup,
                    };
                    data.reportJSON = JSON.stringify(updatedReport);
                }
            }

            setSelectedReport(data);
            setScrollTo({ search_col: 'IncidentID', key: row.IncidentID, highlight: 'success' });
            setTimeout(() => formRef.current?.setFormData(row), 50);

        } catch (error) {
            console.error("Error opening row report:", error);
        } finally {
            // 2. Clear loading indicator once fetching completes or fails
            setLoadingRowId(null);
        }
    };

    const headerActions = (
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <DateRangePicker
                allowedTypes={['Weekly', 'Monthly', 'Yearly', 'Custom']}
                onFilterChange={handleDateRangeChange}
                initialType={(selectedDateRange?.type as DateRangeType) || 'Monthly'}
                initialFrom={selectedDateRange?.from}
                initialTo={selectedDateRange?.to}
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
            {user?.Position === 'Developer' && (<button className="header-action-btn primary" onClick={() => {
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
        console.log("incident to be deleted: ", data);
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
                    isLoading={isReportLoading/*isAnythingLoading()*/}
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
                                        onClose={() => { setSelectedReport(null); setScrollTo({ search_col: 'wew', key: 'wew', highlight: 'success' }); }}
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


            {loadingRowId && (
                <Modal onClose={() => setLoadingRowId(null)} preventClickOutside={true} height="auto" width="250px" overlayBlur={2} hideX={true}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px' }}>
                        <RefreshCcw className="animate-spin" size={24} style={{ animation: 'spin 1s linear infinite' }} />
                        <span>Loading Report...</span>
                    </div>
                </Modal>
            )}

        </PageTemplate>
    );
};

export default IncidentManagement;