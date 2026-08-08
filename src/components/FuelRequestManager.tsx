import React, { useState, useEffect, useMemo, useRef } from 'react';
import { type FctFinal } from '../generated/models/FctFinalModel';
import { Fct2Service } from '../generated/services/Fct2Service';
import { type Live_LatestFuelRequests } from '../generated/models/Live_LatestFuelRequestsModel';
import { UpsertTripTaskTrackerService } from '../generated/services/UpsertTripTaskTrackerService';
import SearchableDropdown, { type DropdownOption } from './SearchableDropdown';
import CustomFileAttachment, { type CustomFileAttachmentRef } from './DropFile';
import TableView, { type ColumnConfig } from './ewul_TableFlex';
import { Truck, MapPin, ClipboardList, PlusCircle, List, FilePlus, Fuel, Loader2 } from 'lucide-react';
import './comp_css/FuelRequestManager.css';

import GradientRadioGroup, { type GradientRadioOption } from './GradientRadioOption';


// truth config
import {
    FR_REQUEST_CATEGORY,
    FR_OE_STATUS,
    UPLOAD_ATTACHMENTS_ENDPOINT,
    frStatuses,
    GPS_STATUS_COLOR,
} from '../truth.config';

import { ewulFetchAll, fetchSharepointAttachments, formatDate, formatToLocalISO } from '../utils/Ewul_GSDC_Utils';
import type { LiveDMSView_CEM } from '../generated/models/LiveDMSView_CEMModel';



const requestCategoryOptions: DropdownOption[] = FR_REQUEST_CATEGORY.map(category => ({
    value: category.value ?? '',
    label: category.label ?? '',
    subtext: '',
    type: 'single',
    record: category
}));


const yesnoOptions: GradientRadioOption[] = [
    { label: 'Yes', value: 'Yes' },
    { label: 'No', value: 'No' }
];



// Helper function to map Live_LatestFuelRequests to FctFinal
const mapLiveRequestToFctFinal = (liveRequest: Partial<Live_LatestFuelRequests>): Partial<FctFinal> => {
    let mappedRequest: Partial<FctFinal> = { ...liveRequest }; // Start with the base data

    if (liveRequest.Frstatus === 'New') {
        const oeRef = liveRequest.Orderentryref?.toLowerCase() || '';

        if (oeRef.includes('pld')) { mappedRequest.Orderentrystatus = 'PRELOAD'; }
        else if (oeRef.includes('mob')) { mappedRequest.Orderentrystatus = 'MOBILIZATION'; }
        else { mappedRequest.Orderentrystatus = 'OE REFERENCE'; }
    }

    if (mappedRequest.Ts1) mappedRequest.Ts1 = new Date(mappedRequest.Ts1).toISOString().replace('Z', '');
    if (mappedRequest.Created) mappedRequest.Created = new Date(mappedRequest.Created).toISOString().replace('Z', '');



    return mappedRequest;
};

export type FormUserInfo = {
    BusinessUnit: string;
    Position: string;
    id: string; // Unique identifier for the user, can be used for more robust localStorage handling
    FullName?: string;
};

// Props for the new combined component
interface FuelRequestManagerProps {
    // TableView Props
    truckOE: string; // ID
    fuelRequests: any[];
    vehicleLists: any[]; // For potential use in dropdowns or mapping
    lastFuelRequestOE: string | null;
    tableConfig: ColumnConfig[];
    storageKey: string;
    searchableCols: string[];
    isLoading: boolean;
    onRefresh: (signal?: boolean) => void;
    onRowClick?: (record: any) => void;

    // Form Props
    initialFormData?: Partial<FctFinal>;
    tripData?: LiveDMSView_CEM | null; // For pre-filling form data based on the trip
    onFormSubmit?: (data: FctFinal, attachmentSPID?: string, tripID?: string) => void;

    // Component control
    defaultTab?: 'list' | 'form';

    stationOptions?: DropdownOption[]; // For the station depot dropdown in the form
    sourceOptions?: DropdownOption[]; // For the source dropdown in the form
    destinationOptions?: DropdownOption[]; // For the destination dropdowns in the form

    user: FormUserInfo | null;
}


const FuelRequestManager: React.FC<FuelRequestManagerProps> = ({
    truckOE,
    fuelRequests,
    lastFuelRequestOE,
    tableConfig,
    storageKey,
    searchableCols,
    isLoading,
    onRefresh,
    onRowClick = () => { },
    initialFormData,
    tripData,
    onFormSubmit,
    defaultTab = 'list',
    stationOptions = [],
    sourceOptions = [],
    destinationOptions = [],
    user,
}) => {
    const [activeTab, setActiveTab] = useState<'list' | 'form'>(defaultTab);
    const [formData, setFormData] = useState<Partial<FctFinal>>(initialFormData || {});

    const [tempFiles, setTempFiles] = useState<File[]>([]);
    const [attachments, setAttachments] = useState<any[]>([]);
    const fileCount = attachments.length + tempFiles.length;

    const [destCount, setDestCount] = useState(1);
    const [isEditing, setIsEditing] = useState(false);
    const [validationMessage, setValidationMessage] = useState<string>('');
    // Track the original odometer value for validation
    const [originalOdometer, setOriginalOdometer] = useState<number | null>(
        initialFormData && initialFormData.Odometer !== undefined && initialFormData.Odometer !== null && initialFormData.Odometer !== ''
            ? Number(initialFormData.Odometer)
            : null
    );
    const noedit = frStatuses.some(status => status.value === formData.Frstatus && status.noedit);


    const routeTypeOptions: DropdownOption[] = [
        { value: 'Source', label: 'Source', subtext: '', type: 'single', record: null },
        { value: 'Destination', label: 'Destination', subtext: '', type: 'single', record: null },
        { value: 'Station', label: 'Station', subtext: '', type: 'single', record: null },
    ];

    const optionsMap = {
        "Source": sourceOptions,
        "Destination": destinationOptions,
        "Station": stationOptions
    }

    const [selectedRouteTypes, setSelectedRouteTypes] = useState<Record<string, string>>({
        type1: 'Station',
        type2: 'Station',
        type3: 'Station',
        type4: 'Station',
        type5: 'Station',
    });

    const destinationNumbers = [1, 2, 3, 4, 5];

    const oeStatusOptions: DropdownOption[] = useMemo(() => {
        const oeRef = formData.Orderentryref?.toLowerCase() || '';

        // 1. Filter the raw config based on the Reference string
        let filteredRaw;
        if (oeRef.includes('pld')) {
            filteredRaw = FR_OE_STATUS.filter(opt => opt.for === 'pld');
        } else if (oeRef.includes('mob')) {
            filteredRaw = FR_OE_STATUS.filter(opt => opt.for === 'mob');
        } else {
            filteredRaw = FR_OE_STATUS.filter(opt => opt.for === 'oe');
        }

        // 2. Map the filtered results to your DropdownOption structure
        return filteredRaw.map(status => ({
            value: status.value ?? '',
            label: status.label ?? '',
            subtext: '',
            type: 'single',
            record: status
        }));
    }, [formData.Orderentryref]); // Re-calculates only when Orderentryref changes





    // Central validation function
    const validateForm = (data: Partial<FctFinal>, attachments?: any[]): { success: boolean, message: string } => {
        if (noedit) return { success: true, message: '' };

        if (!data.Orderentryref) return { success: false, message: 'No Order Entry Reference Selected.' };

        // Station Depot must not be blank
        if (!data.Stationdepot || data.Stationdepot === '') {
            return { success: false, message: 'No selected Station Depot.' };
        }

        if (!data.Currentlocation) return { success: false, message: 'Location is required.' };

        // Route Details: At least one Destination must be filled
        const destinations = destinationNumbers.map(n => (data as any)[`Destination${n}`]);
        const firstFilled = destinations.findIndex(val => val && val !== '');
        if (firstFilled === -1) {
            return { success: false, message: 'At least one Destination is required.' };
        }
        // No gaps: previous destinations must be filled if a later one is
        for (let i = 1; i < destinations.length; i++) {
            if ((destinations[i] && destinations[i] !== '') && (!destinations[i - 1] || destinations[i - 1] === '')) {
                return { success: false, message: `Destination ${i} must be filled before Destination ${i + 1}.` };
            }
        }



        // Odometer validation
        const odometer = data.Odometer !== undefined && data.Odometer !== null && data.Odometer !== '' ? Number(data.Odometer) : null;
        // Use originalOdometer for validation
        const currentOdometer = originalOdometer;
        if (odometer === null || isNaN(odometer)) {
            return { success: false, message: 'Odometer is required.' };
        }
        if (currentOdometer !== null && !isNaN(currentOdometer)) {
            if (odometer < currentOdometer) {
                return { success: false, message: `Odometer cannot be less than current value (${currentOdometer}).` };
            }
            if (odometer > currentOdometer + 1000) {
                return { success: false, message: `Odometer cannot be more than ${currentOdometer + 1000}.` };
            }

            if (odometer === currentOdometer) {
                return { success: false, message: `Odometer cannot be the same as the last reading: (${currentOdometer}).` };
            }
        }

        if (data.Sukattank === null || isNaN(Number(data.Sukattank))) return { success: false, message: 'Sukat (Tank) must be a valid number.' };
        if ((data.Sukatcompressor === null || isNaN(Number(data.Sukatcompressor))) && data.Compressor === 'Yes') return { success: false, message: 'Sukat (Compressor) must be a valid number.' };

        if (attachments) {
            if (!attachments || attachments.length === 0) return { success: false, message: 'At least one attachment is required.' };
        } else if (!fileCount || fileCount === 0) {
            return { success: false, message: 'At least one attachment is required.' };
        }


        return { success: true, message: '' };
    };






    const handleInitalData = () => {
        // Only update from initialFormData if the user isn't actively editing from a row click
        if (initialFormData) {
            setFormData(initialFormData);
            let count = 1;
            if (initialFormData.Destination1) count = 2;
            if (initialFormData.Destination2) count = 3;
            if (initialFormData.Destination3) count = 4;
            if (initialFormData.Destination4) count = 5;
            if (initialFormData.Destination5) count = 5;
            setDestCount(count);


            // Detect and set the route types based on the loaded values
            const newTypes: Record<string, string> = {};
            const allOptions = [...sourceOptions, ...destinationOptions, ...stationOptions];

            destinationNumbers.forEach(num => {
                const val = (initialFormData as any)[`Destination${num}`];
                const foundType = allOptions.find(opt => opt.value === val)?.subtext || 'Station';
                newTypes[`type${num}`] = foundType;
            });
            setSelectedRouteTypes(newTypes);


            // Set original odometer for new records
            if (initialFormData.Odometer !== undefined && initialFormData.Odometer !== null && initialFormData.Odometer !== '') {
                setOriginalOdometer(Number(initialFormData.Odometer));
            } else {
                setOriginalOdometer(null);
            }
        }
    }

    // inital data setup
    useEffect(() => {
        handleInitalData();
    }, [truckOE, user?.id]);


    // if initalformdata input changes dont overwrite when the user is currently on the form tab
    useEffect(() => {
        if (activeTab === 'form') return;
        handleInitalData();
    }, [initialFormData]);


    const handleInputChange = (field: keyof FctFinal, value: any) => {
        setFormData(prev => {
            const updated = { ...prev, [field]: value };
            // Live validation on every change
            const validation = validateForm(updated);
            setValidationMessage(validation.message);
            return updated;
        });
        if (field.startsWith('Destination') && value) {
            const num = parseInt(field.replace('Destination', ''));
            if (num < 5 && num >= destCount) setDestCount(num + 1);
        }
    };

    const updateTaskTracker = async () => {
        UpsertTripTaskTrackerService.UpsertTripTaskTracker({ OE: formData.Orderentryref, HasFuelRequest: true, EditorName: user?.FullName || 'Unknown User' } as any);
    };

    const [hasSubmitted, setHasSubmitted] = useState(false);

    const handleFormSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
        setHasSubmitted(true);
        e.preventDefault();

        const validation = validateForm(formData);
        if (!validation.success) {
            setValidationMessage(validation.message);
            return;
        }

        //UPLOAD ATTACHMENT TO SP
        const responseData = await uploadAttachments(tempFiles, formData.Id ? String(formData.Id) : undefined);

        const attachmentID = (responseData as any)?.data?.createdID;
        const tripID = tripData?.ID ? tripData.ID.toString() : undefined;

        // ACTUAL RECORD FR
        const cleanedFormData: FctFinal = {

            Category: formData.Category || '',
            Orderentryref: formData.Orderentryref || '',
            Status: formData.Status || '',
            Destination1: formData.Destination1 || '',
            Destination2: formData.Destination2 || '',
            Destination3: formData.Destination3 || '',
            Destination4: formData.Destination4 || '',
            Destination5: formData.Destination5 || '',
            Stationdepot: formData.Stationdepot || '',
            Currentlocation: formData.Currentlocation || '',
            Head: formData.Head || '',
            Headnumber: formData.Headnumber || '',
            Plate: formData.Plate || '',
            Brand: formData.Brand || '',
            Wheelertype: formData.Wheelertype || '',
            Trailer: formData.Trailer || '',
            Platetrailer: formData.Platetrailer || '',
            Type: formData.Type || '',
            Classification: formData.Classification || '',
            Axle: formData.Axle || '',
            Subengine: formData.Subengine || '',
            Compressor: formData.Compressor || '',
            Requestedby: formData.Requestedby || '',
            Businessunit: formData.Businessunit || '',
            Remarks: formData.Remarks || '',
            Frstatus: formData.Frstatus || 'Request',
            Fromdispapp: "Yes V2",
            Driversname: formData.Driversname || '',
            Ts1: /*formData.Ts1?.toString() ||*/ formatToLocalISO(new Date().toISOString()),
            Created: formData.Created?.toString() || formatToLocalISO(new Date().toISOString()),
            Sukattank: formData.Sukattank || '',
            Sukatcompressor: formData.Sukatcompressor || '',
            Karga: formData.Karga || '',
            Addblue: formData.Addblue || '',
            Orderentrystatus: formData.Orderentrystatus || '',
            Odometer: formData.Odometer || '',
            SQLID: formData.SQLID || undefined, // Only include SQLID if it exists (for updates)
            Id: attachmentID
        };

        setValidationMessage('');
        onFormSubmit?.(cleanedFormData, attachmentID, tripID);
        updateTaskTracker();
        // Optionally switch back to the list view after submission
        setActiveTab('list');
        setIsEditing(false); // Reset editing state on submit
        setHasSubmitted(false);
    };

    const handleCancel = () => {
        setActiveTab('list');
        setIsEditing(false); // Reset editing state on cancel
    };

    const handleSave = async () => {
        // Update status from 'New' to 'Pre-Request', otherwise keep current status
        const updatedFormData = {
            ...formData,
            Frstatus: formData.Frstatus === 'New' ? 'Pre-New' : formData.Frstatus
        };

        setFormData(updatedFormData);

        // Prepare the form submission with the updated status
        const responseData = await uploadAttachments(tempFiles, updatedFormData.Id ? String(updatedFormData.Id) : undefined);
        const attachmentID = (responseData as any)?.data?.createdID;
        const tripID = tripData?.ID ? tripData.ID.toString() : undefined;

        const cleanedFormData: FctFinal = {
            Category: updatedFormData.Category || '',
            Orderentryref: updatedFormData.Orderentryref || '',
            Status: updatedFormData.Status || '',
            Destination1: updatedFormData.Destination1 || '',
            Destination2: updatedFormData.Destination2 || '',
            Destination3: updatedFormData.Destination3 || '',
            Destination4: updatedFormData.Destination4 || '',
            Destination5: updatedFormData.Destination5 || '',
            Stationdepot: updatedFormData.Stationdepot || '',
            Currentlocation: updatedFormData.Currentlocation || '',
            Head: updatedFormData.Head || '',
            Headnumber: updatedFormData.Headnumber || '',
            Plate: updatedFormData.Plate || '',
            Brand: updatedFormData.Brand || '',
            Wheelertype: updatedFormData.Wheelertype || '',
            Trailer: updatedFormData.Trailer || '',
            Platetrailer: updatedFormData.Platetrailer || '',
            Type: updatedFormData.Type || '',
            Classification: updatedFormData.Classification || '',
            Axle: updatedFormData.Axle || '',
            Subengine: updatedFormData.Subengine || '',
            Compressor: updatedFormData.Compressor || '',
            Requestedby: updatedFormData.Requestedby || '',
            Businessunit: updatedFormData.Businessunit || '',
            Remarks: updatedFormData.Remarks || '',
            Frstatus: updatedFormData.Frstatus || 'Pre-New',
            Fromdispapp: "Yes V2",
            Driversname: updatedFormData.Driversname || '',
            Ts1: updatedFormData.Ts1 || '',
            Created: updatedFormData.Created || '',
            Sukattank: updatedFormData.Sukattank || '',
            Sukatcompressor: updatedFormData.Sukatcompressor || '',
            Karga: updatedFormData.Karga || '',
            Addblue: updatedFormData.Addblue || '',
            Orderentrystatus: updatedFormData.Orderentrystatus || '',
            Odometer: updatedFormData.Odometer || '',
            SQLID: updatedFormData.SQLID || undefined,
            Id: attachmentID
        };

        setValidationMessage('');
        onFormSubmit?.(cleanedFormData, attachmentID, tripID);
        updateTaskTracker();
        // Stay on the form after saving
        setIsEditing(true);
    };

    const handleNewRequestClick = () => {
        setIsEditing(false); // No longer editing

        // --- CLEAR STALE ATTACHMENTS HERE ---
        setTempFiles([]);
        setAttachments([]);

        const newFormData = initialFormData || {};

        if (fuelRequests.filter((req) => req.Frstatus === 'Liquidated').length > 0) {
            newFormData.Category = 'Additional Diesel request';
        }
        console.log(fuelRequests.filter((req) => req.Frstatus === 'Liquidated'));

        setFormData(newFormData); // Reset form to initial (blank) state
        setActiveTab('form');
        // Run validation immediately when switching to form tab
    };

    const attachmentDropFile = useRef<CustomFileAttachmentRef>(null);
    const fetchAttachments = async (fuelrequestSPID: number) => {
        console.log("Fetching attachments for fuel request ID:", fuelrequestSPID);

        const records = await ewulFetchAll<any>(

            Fct2Service,

            {

                filter: `ID eq ${fuelrequestSPID}`,

                orderBy: ['Created desc'],

            },

            50

        );

        console.log("Fetched attachment records:", records);


        const metadata = await fetchSharepointAttachments({
            metadataRecords: records,
            listName: 'fct2',
            siteAddress: "https://gsdcph.sharepoint.com",
            onUpdate: setAttachments // Passing the state setter directly
        });
        console.log("Fetched attachments metadata:", metadata);
    };

    const uploadAttachments = async (files: File[], itemID: string | undefined) => {
        if (files.length === 0) {
            return { success: true, message: `No new attachment files to upload.` };
        }

        const toBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
                const result = reader.result as string;
                const base64String = result.split(',')[1];
                resolve(base64String);
            };
            reader.onerror = error => reject(error);
        });

        try {
            const fileContents = await Promise.all(
                files.map(async (file) => ({
                    name: file.name,
                    contentBytes: await toBase64(file),
                }))
            );

            const body = {
                siteAddress: "https://gsdcph.sharepoint.com",
                ListName: "fct2",
                ListItemID: itemID || null, // This should be the ID of an existing attachment item if updating, or empty for new
                itemRecord: {
                    orderEntryRef: formData.Orderentryref || '',
                },
                FileContent: fileContents,
            };

            console.log(`Sending POST request for fuelrequest attachments with body:`, body);

            const response = await fetch(UPLOAD_ATTACHMENTS_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            const responseData = await response.json();
            console.log(`Response for fuelrequest upload:`, responseData);

            if (response.ok && responseData.statusCode === "200") {
                console.log(`Upload successful for fuelrequest attachments:`, responseData);
                return { success: true, data: responseData };
            } else {
                const errorText = responseData.body || `HTTP error! status: ${response.status}`;
                throw new Error(errorText);
            }

        } catch (error) {
            console.error(`Error during fuelrequest attachments upload:`, error);
            return { success: false, error };
        }
    };


    const countOnGoingRequests = () => {
        // Get a list of just the 'value' strings for statuses that are open
        const openStatusValues = frStatuses.filter(s => s.isOpen).map(s => s.value);

        // Count how many fuelRequests have a status found in that list
        return fuelRequests.filter(req => openStatusValues.includes(req.Frstatus)).length;
    };

    const requestRemarks = (() => {
        switch (formData.Frstatus) {
            case 'FR Disapproved': return formData.Frdisapprove;
            case 'Unliquidated': return formData.Unliquidateremarks;
            default: return formData.Remarksissuance;
        }
    })();


    useEffect(() => {
        setValidationMessage('');
        const validation = validateForm(formData);
        setValidationMessage(validation.message);
    }, [activeTab]);


    return (
        <>
            <div className="fuel-manager-container">
                <div className="fuel-manager-header">
                    <div className="fuel-manager-utility-tabs">
                        <div className={`fuel-manager-tabs-pill-bg ${activeTab}`}></div>
                        <button
                            className={`fuel-manager-tab-btn ${activeTab === 'list' ? 'active' : ''}`}
                            onClick={() => setActiveTab('list')}
                        >
                            <List size={16} /> Fuel Requests
                        </button>
                        <button
                            className={`fuel-manager-tab-btn ${activeTab === 'form' ? 'active' : ''} ${(isLoading && fuelRequests.length === 0) || countOnGoingRequests() > 0 || (tripData?.TripProgress === 'Done' && tripData.OE !== lastFuelRequestOE) ? 'disabled' : ''}`}
                            onClick={() => {
                                if ((isLoading && fuelRequests.length === 0) || countOnGoingRequests() > 0 || (tripData?.TripProgress === 'Done' && tripData.OE !== lastFuelRequestOE)) return;
                                handleNewRequestClick();
                            }}
                        >
                            <FilePlus size={16} /> {isEditing && activeTab === 'form' ? 'Edit Request' : 'New Request'}
                        </button>
                    </div>
                    <span className="utility-tabs-message">
                        {(isLoading && fuelRequests.length === 0) ? 'Fuel requests are being fetched... Please wait before creating a new request.' : ''}{countOnGoingRequests() > 0 ? `There are still ongoing requests. You will not be able to create a new request until they are completed.` : ''}{tripData?.TripProgress === 'Done' && tripData.OE !== lastFuelRequestOE ? `This trip is already concluded and is no longer the current trip for this vehicle. [${lastFuelRequestOE}]` : ''}
                    </span>
                    {activeTab === 'form' && (<h3 className='fuel-manager-form-status'>Status: <span className='fuel-manager-form-status-value' style={{ color: frStatuses.find((status) => status.value === formData.Frstatus)?.color }}>{formData.Frstatus}</span></h3>)}
                </div>



                <div className="fuel-manager-content">
                    {activeTab === 'list' ? (
                        <div className="fuel-manager-tab-pane">
                            <TableView
                                data={fuelRequests}
                                config={tableConfig}
                                storageKey={storageKey}
                                searchCol={searchableCols}
                                isLoading={isLoading}
                                showRowCount={50}
                                onRefresh={onRefresh}
                                overflowY={true}
                                overflowX={true}
                                maxHeight={600}
                                colMinWidth={120}
                                loadingNoPreventAction={true}
                                showNumbering={true}
                                theme="var(--color-primary)"
                                onRowClick={(record: Partial<Live_LatestFuelRequests>) => {
                                    fetchAttachments(Number(record.Id) || 0);
                                    // When a row is clicked, map the data, switch to the form, and load it
                                    console.log('Row clicked with record:', record);
                                    const mappedData = mapLiveRequestToFctFinal(record);
                                    setFormData(mappedData);

                                    // Set the original odometer for validation
                                    /*if (record.Odometer !== undefined && record.Odometer !== null && record.Odometer !== '') {
                                        setOriginalOdometer(Number(record.Odometer));
                                    } else {
                                        setOriginalOdometer(null);
                                    }*/

                                    setActiveTab('form');
                                    setIsEditing(true); // Mark that we are now editing
                                    onRowClick(record); // also bubble up the original event
                                }}
                            />
                        </div>
                    ) : (
                        <div className="fuel-manager-tab-pane">
                            <div className="fuel-manager-form-container">
                                <form className={`fuel-manager-form ${noedit ? 'noedit' : ''}`} onSubmit={handleFormSubmit}>

                                    {/* --- ISSUEANCE DETAILS --- */}
                                    {frStatuses.filter((status) => !status.isOpen && status.value !== 'New').some(status => status.value === formData.Frstatus) && (<div className="fuel-manager-form-section-group">
                                        <div className="fuel-manager-section-header"><Fuel size={18} /> Fuel Issued</div>

                                        <div className='fuel-manager-form-row'>
                                            <div className="fuel-manager-form-group" style={{ flex: 1 }}>
                                                <label>Changed Depot</label>
                                                <div className="fuel-manager-form-gradient-input-wrapper">
                                                    <input
                                                        disabled
                                                        type="text"
                                                        value={formData.Fctchangedepotstation}
                                                    />
                                                </div>
                                            </div>
                                            <div className="fuel-manager-form-group" style={{ flex: 1 }}>
                                                <label>Mapping</label>
                                                <div className="fuel-manager-form-gradient-input-wrapper">
                                                    <a
                                                        style={{ color: 'var(--color-primary)', overflowY: 'auto' }}
                                                        href={formData.Mapping}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                    >
                                                        {formData.Mapping}
                                                    </a>
                                                </div>
                                            </div>
                                            <div className="fuel-manager-form-group" style={{ flex: 0.5 }}>
                                                <label>KM (Theoretical)</label>
                                                <div className="fuel-manager-form-gradient-input-wrapper">
                                                    <input
                                                        disabled
                                                        type="text"
                                                        value={formData.Theoreticalkm}
                                                    />
                                                </div>
                                            </div>
                                            <div className="fuel-manager-form-group" style={{ flex: 0.5 }}>
                                                <label>Cash Diesel</label>
                                                <div className="fuel-manager-form-gradient-input-wrapper">
                                                    <input
                                                        disabled
                                                        type="text"
                                                        value={formData.Cashdiesel}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="fuel-manager-form-subtitle">Tank</div>
                                        <div className="fuel-manager-form-row">
                                            <div className="fuel-manager-form-group" style={{ flex: 1 }}>
                                                <label>Issued Liters</label>
                                                <div className="fuel-manager-form-gradient-input-wrapper">
                                                    <input
                                                        disabled
                                                        type="text"
                                                        value={formData.Tankissuedliters}
                                                    />
                                                </div>
                                            </div>
                                            <div className="fuel-manager-form-group" style={{ flex: 1 }}>
                                                <label>PO #</label>
                                                <div className="fuel-manager-form-gradient-input-wrapper">
                                                    <input
                                                        disabled
                                                        type="text"
                                                        value={formData.Tankponumber}
                                                    />
                                                </div>
                                            </div>
                                            <div className="fuel-manager-form-group" style={{ flex: 1 }}>
                                                <label>Fuel Code</label>
                                                <div className="fuel-manager-form-gradient-input-wrapper">
                                                    <input
                                                        disabled
                                                        type="text"
                                                        value={formData.Tankfuelcode}
                                                    />
                                                </div>
                                            </div>
                                            <div className="fuel-manager-form-group" style={{ flex: 1 }}>
                                                <label>Pondo</label>
                                                <div className="fuel-manager-form-gradient-input-wrapper">
                                                    <input
                                                        disabled
                                                        type="text"
                                                        value={formData.Issuedpondo}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {formData.Compressor == 'Yes' && (
                                            <>
                                                <div className="fuel-manager-form-subtitle">Compressor</div>
                                                <div className="fuel-manager-form-row">
                                                    <div className="fuel-manager-form-group" style={{ flex: 1 }}>
                                                        <label>Issued Liters</label>
                                                        <div className="fuel-manager-form-gradient-input-wrapper">
                                                            <input
                                                                disabled
                                                                type="text"
                                                                value={formData.Compressorissuedliters}
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="fuel-manager-form-group" style={{ flex: 1 }}>
                                                        <label>PO #</label>
                                                        <div className="fuel-manager-form-gradient-input-wrapper">
                                                            <input
                                                                disabled
                                                                type="text"
                                                                value={formData.Compressorponumber}
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="fuel-manager-form-group" style={{ flex: 1 }}>
                                                        <label>Fuel Code</label>
                                                        <div className="fuel-manager-form-gradient-input-wrapper">
                                                            <input
                                                                disabled
                                                                type="text"
                                                                value={formData.Compressorfuelcode}
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="fuel-manager-form-group" style={{ flex: 1 }}>
                                                    </div>
                                                </div>
                                            </>)}

                                        {formData.Addblue == 'Yes' && (
                                            <>
                                                <div className="fuel-manager-form-subtitle">Add Blue</div>
                                                <div className="fuel-manager-form-row">
                                                    <div className="fuel-manager-form-group" style={{ flex: 1 }}>
                                                        <label>Issued Liters</label>
                                                        <div className="fuel-manager-form-gradient-input-wrapper">
                                                            <input
                                                                disabled
                                                                type="text"
                                                                value={formData.Addblueissuedliters}
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="fuel-manager-form-group" style={{ flex: 1 }}>
                                                        <label>PO #</label>
                                                        <div className="fuel-manager-form-gradient-input-wrapper">
                                                            <input
                                                                disabled
                                                                type="text"
                                                                value={formData.Addblueponumber}
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="fuel-manager-form-group" style={{ flex: 1 }}>
                                                    </div>
                                                    <div className="fuel-manager-form-group" style={{ flex: 1 }}>
                                                    </div>
                                                </div>
                                            </>)}

                                    </div>)}




                                    {/* --- ORDER DETAILS --- */}
                                    <div className="fuel-manager-form-section-group">
                                        <div className="fuel-manager-section-header"><ClipboardList size={18} /> Order Details</div>
                                        <div className="fuel-manager-form-row">
                                            <div className="fuel-manager-form-group" style={{ flex: 0.5 }}>
                                                <label>Category</label>
                                                <SearchableDropdown
                                                    options={fuelRequests.filter((req) => req.Frstatus === 'Liquidated').length > 0 ? requestCategoryOptions.filter((opt) => opt.value !== 'New Trip') : requestCategoryOptions}
                                                    value={formData.Category}
                                                    onChange={(val) => handleInputChange('Category', val)}
                                                    allowSearch={false}
                                                    disabled={noedit}
                                                />
                                            </div>
                                            <div className="fuel-manager-form-group" style={{ flex: 1.5 }}>
                                                <label>Order Reference</label>
                                                <div className="fuel-manager-form-gradient-input-wrapper">
                                                    <input
                                                        disabled
                                                        type="text"
                                                        value={formData.Orderentryref || ''}
                                                        onChange={e => handleInputChange('Orderentryref', e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                            <div className="fuel-manager-form-group" style={{ flex: 1 }}>
                                                <label>OE Status</label>
                                                <SearchableDropdown
                                                    options={oeStatusOptions}
                                                    value={formData.Orderentrystatus}
                                                    onChange={(val) => handleInputChange('Orderentrystatus', val)}
                                                    disabled={noedit}
                                                />
                                            </div>
                                            <div className="fuel-manager-form-group" style={{ flex: 0.5 }}>
                                                <label>Status</label>
                                                <div className="fuel-manager-static-value">{formData.Status || 'Empty'}</div>
                                            </div>
                                        </div>
                                        <div className="fuel-manager-form-row">
                                            <div className="fuel-manager-form-group" style={{ flex: 1 }}>
                                                <label>Station Depot</label>
                                                <SearchableDropdown
                                                    options={[
                                                        /*{
                                                            value: formData.Stationdepot ?? '',
                                                            label: formData.Stationdepot ?? 'Select Station Depot',
                                                            subtext: 'Current Value',
                                                            type: 'multi',
                                                            record: null
                                                        },*/
                                                        ...stationOptions // Ensure current value is always an option
                                                    ]}
                                                    value={formData.Stationdepot}
                                                    onChange={(val) => handleInputChange('Stationdepot', val)}
                                                    allowSearch={true}
                                                    disabled={noedit}
                                                />
                                            </div>
                                            <div className="fuel-manager-form-group" style={{ flex: 1 }}>
                                                <label>Current Location (<span style={{
                                                    color: (GPS_STATUS_COLOR[tripData?.GpsStatus as keyof typeof GPS_STATUS_COLOR] || GPS_STATUS_COLOR.Default).color
                                                }}>
                                                    {tripData?.GpsStatus || 'Unknown'}
                                                </span>)
                                                </label>
                                                <div className="fuel-manager-form-gradient-input-wrapper">
                                                    <input type="text" value={formData.Currentlocation || ''} onChange={e => handleInputChange('Currentlocation', e.target.value)} />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* --- ROUTE DETAILS --- */}
                                    <div className="fuel-manager-form-section-group">
                                        <div className="fuel-manager-section-header"><MapPin size={18} /> Route Details</div>
                                        <div className="fuel-manager-form-row wrap" style={{ gap: '20px' }}>
                                            {(() => {


                                                // 1. Find the highest index that currently has a value
                                                let maxFilledIndex = 0;
                                                destinationNumbers.forEach(num => {
                                                    const val = (formData as any)[`Destination${num}`];
                                                    if (val) {
                                                        maxFilledIndex = num;
                                                    }
                                                });


                                                /**
                                                 * 2. Calculate the display count:
                                                 * - If the max filled index is 0 (all empty), show 1 row.
                                                 * - If the max filled index is less than 5, show maxFilledIndex + 1 (the next empty slot).
                                                 * - If the max filled index is 5, just show 5.
                                                 */
                                                const count = maxFilledIndex === 0 ? 1 : Math.min(5, maxFilledIndex + 1);




                                                return destinationNumbers.slice(0, count).map(num => {
                                                    const fieldName = `Destination${num}` as keyof FctFinal;
                                                    const currentValue = (formData as any)[fieldName];
                                                    const typeKey = `type${num}`;

                                                    // Use the state value
                                                    const currentType = (selectedRouteTypes[typeKey] || 'Destination') as keyof typeof optionsMap;

                                                    return (
                                                        <div className="fuel-manager-destination-pair" key={num} style={{ flex: 1, maxWidth: '49%', minWidth: '49%' }}>
                                                            <label className="input-label-navy">Route {num}</label>
                                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                                <div style={{ flex: 2 }}>
                                                                    <SearchableDropdown
                                                                        options={routeTypeOptions}
                                                                        value={currentType}
                                                                        onChange={(val) => {
                                                                            const newType = Array.isArray(val) ? val[0] : val;

                                                                            // 1. Update the persistent state
                                                                            setSelectedRouteTypes(prev => ({ ...prev, [typeKey]: newType }));

                                                                            let currentSelectedRoute = null;
                                                                            if (val === 'Source') currentSelectedRoute = tripData ? tripData.Source : null;
                                                                            if (val === 'Destination') currentSelectedRoute = tripData ? tripData.Destination : null;
                                                                            console.log('Current Selected Route:', currentSelectedRoute, 'form status: ', formData.Frstatus);
                                                                            // 2. Clear the actual destination value in formData
                                                                            handleInputChange(fieldName, currentSelectedRoute || null); // Clear if new, otherwise reset to original trip value
                                                                        }}
                                                                        disabled={noedit}
                                                                    />
                                                                </div>
                                                                <div style={{ flex: 3 }}>
                                                                    <SearchableDropdown
                                                                        options={optionsMap[currentType]}
                                                                        value={currentValue}
                                                                        onChange={(val) => handleInputChange(fieldName, val)}
                                                                        placeholder={`Select ${currentType}...`}
                                                                        disabled={noedit}
                                                                        allowSearch={true}
                                                                    />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                });
                                            })()}
                                        </div>
                                    </div>

                                    {/* --- VEHICLE DETAILS --- */}
                                    <div className="fuel-manager-form-section-group">
                                        <div className="fuel-manager-section-header"><Truck size={18} /> Vehicle Details</div>
                                        <div className="fuel-manager-form-row" style={{ display: 'flex', gap: '1rem' }}>
                                            {/* Left Column */}
                                            <div className="fuel-manager-form-column" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                                {/* Row 1 Left */}
                                                <div className="fuel-manager-form-row">
                                                    <div className="fuel-manager-form-group" style={{ flex: 1 }}>
                                                        <label>Tractor</label>
                                                        <div className="fuel-manager-form-gradient-input-wrapper">
                                                            <input disabled type="text" value={formData.Head || ''} onChange={e => handleInputChange('Head', e.target.value)} />
                                                        </div>
                                                    </div>
                                                    <div className="fuel-manager-form-group" style={{ flex: 1 }}>
                                                        <label>Plate No</label>
                                                        <div className="fuel-manager-form-gradient-input-wrapper">
                                                            <input disabled type="text" value={formData.Plate || ''} />
                                                        </div>
                                                    </div>
                                                </div>
                                                {/* Row 2 Left */}
                                                <div className="fuel-manager-form-row">
                                                    <div className="fuel-manager-form-group" style={{ flex: 1 }}>
                                                        <label>Trailer</label>
                                                        <div className="fuel-manager-form-gradient-input-wrapper">
                                                            <input disabled type="text" value={formData.Trailer || ''} onChange={e => handleInputChange('Trailer', e.target.value)} />
                                                        </div>
                                                    </div>
                                                    <div className="fuel-manager-form-group" style={{ flex: 1 }}>
                                                        <label>T Plate No</label>
                                                        <div className="fuel-manager-form-gradient-input-wrapper">
                                                            <input disabled type="text" value={formData.Platetrailer || ''} />
                                                        </div>
                                                    </div>
                                                </div>
                                                {/* Row 3 Left */}
                                                <div className="fuel-manager-form-row">
                                                    <div className="fuel-manager-form-group" style={{ flex: 1 }}>
                                                        <label>Compressor</label>
                                                        <GradientRadioGroup
                                                            name="compressor"
                                                            options={yesnoOptions}
                                                            value={formData.Subengine === "No" ? "No" : formData.Compressor || 'No'}
                                                            onChange={(value: any) => handleInputChange('Compressor', value)}
                                                            disabled={formData.Subengine === "No"}
                                                        />

                                                    </div>
                                                    <div className="fuel-manager-form-group" style={{ flex: 1 }}>
                                                        <label>Add Blue</label>
                                                        <GradientRadioGroup
                                                            name="addblue"
                                                            options={yesnoOptions}
                                                            value={formData.Addblue || 'No'}
                                                            onChange={(value: any) => handleInputChange('Addblue', value)}
                                                        />


                                                    </div>
                                                </div>
                                            </div>
                                            {/* Right Column */}
                                            <div className="fuel-manager-form-column" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                                {/* Row 1 Right */}
                                                <div className="fuel-manager-form-row">
                                                    <div className="fuel-manager-form-group" style={{ flex: 1 }}>
                                                        <label>Brand</label>
                                                        <div className="fuel-manager-form-gradient-input-wrapper">
                                                            <input type="text" value={formData.Brand || ''} disabled />
                                                        </div>
                                                    </div>
                                                    <div className="fuel-manager-form-group" style={{ flex: 1 }}>
                                                        <label>Wheeler Type</label>
                                                        <div className="fuel-manager-form-gradient-input-wrapper">
                                                            <input type="text" value={formData.Wheelertype || ''} disabled />
                                                        </div>
                                                    </div>
                                                </div>
                                                {/* Row 2 Right */}
                                                <div className="fuel-manager-form-row wrap">
                                                    <div className="fuel-manager-form-group" style={{ flex: 1 }}>
                                                        <label>Type</label>
                                                        <div className="fuel-manager-form-gradient-input-wrapper">
                                                            <input type="text" value={formData.Type || ''} disabled />
                                                        </div>
                                                    </div>
                                                    <div className="fuel-manager-form-group" style={{ flex: 1 }}>
                                                        <label>Class</label>
                                                        <div className="fuel-manager-form-gradient-input-wrapper">
                                                            <input type="text" value={formData.Classification || ''} disabled />
                                                        </div>
                                                    </div>
                                                    <div className="fuel-manager-form-group" style={{ flex: 1 }}>
                                                        <label>Axle</label>
                                                        <div className="fuel-manager-form-gradient-input-wrapper">
                                                            <input type="text" value={formData.Axle || ''} disabled />
                                                        </div>
                                                    </div>
                                                    <div className="fuel-manager-form-group" style={{ flex: 1 }}>
                                                        <label>Subengine</label>
                                                        <div className="fuel-manager-form-gradient-input-wrapper">
                                                            <input type="text" value={formData.Subengine || ''} disabled />
                                                        </div>
                                                    </div>
                                                </div>
                                                {/* Row 3 Right */}
                                                <div className="fuel-manager-form-row">
                                                    <div className="fuel-manager-form-group" style={{ flex: 1 }}>
                                                        <label>Odometer</label>
                                                        <div className="fuel-manager-form-gradient-input-wrapper">
                                                            <input type="number" value={Number(formData.Odometer) || ''} onChange={e => handleInputChange('Odometer', e.target.value)} />
                                                        </div>
                                                    </div>
                                                    <div className="fuel-manager-form-group" style={{ flex: 1 }}>
                                                        <label>Sukat (Tank)</label>
                                                        <div className="fuel-manager-form-gradient-input-wrapper">
                                                            <input type="text" value={formData.Sukattank || ''} onChange={e => handleInputChange('Sukattank', e.target.value)} />
                                                        </div>
                                                    </div>
                                                    <div className="fuel-manager-form-group" style={{ flex: 1 }}>
                                                        {formData.Compressor === 'Yes' && (
                                                            <>
                                                                <label>Sukat (Comp)</label>
                                                                <div className="fuel-manager-form-gradient-input-wrapper">
                                                                    <input type="text" value={formData.Sukatcompressor || ''} onChange={e => handleInputChange('Sukatcompressor', e.target.value)} />
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="fuel-manager-form-row">
                                            <div className="fuel-manager-form-group" style={{ flex: 1 }}>
                                                <label>{`Attachments ${fileCount ? `(${fileCount})` : ''}`}</label>
                                                <CustomFileAttachment
                                                    ref={attachmentDropFile}
                                                    disabled={noedit}
                                                    files={[
                                                        ...attachments,
                                                        ...tempFiles
                                                    ]}
                                                    onFilesChange={(mergedList: any[]) => {
                                                        const onlyNewFiles = mergedList.filter(f => f instanceof File);
                                                        setTempFiles(onlyNewFiles);
                                                        console.log('Updated attachments list:', mergedList);
                                                        const message = validateForm(formData, [...attachments, ...onlyNewFiles]); // Re-run validation when attachments change
                                                        setValidationMessage(message.message);
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* --- REQUEST DETAILS --- */}
                                    <div className="fuel-manager-form-section-group">
                                        <div className="fuel-manager-section-header"><PlusCircle size={18} /> Request Details</div>

                                        <div className='fuel-manager-form-row'>
                                            <div className="fuel-manager-form-group">
                                                <label>Requested By</label>
                                                <div className="fuel-manager-form-gradient-input-wrapper">
                                                    <input
                                                        disabled
                                                        type="text"
                                                        value={formData.CreatedBy || user?.FullName}
                                                        onChange={e => handleInputChange('CreatedBy', e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                            <div className="fuel-manager-form-group">
                                                <label>Requested Date</label>
                                                <div className="fuel-manager-form-gradient-input-wrapper">
                                                    <input
                                                        disabled
                                                        type="text"
                                                        value={formData.Created ? formatDate(formData.Created, { mode: "date", alreadyLocal: true }) : ''}
                                                        onChange={e => handleInputChange('Created', e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="fuel-manager-form-row">
                                            <div className="fuel-manager-form-group" style={{ flex: 1 }}>
                                                <label>Remarks</label>
                                                <div className="fuel-manager-form-gradient-input-wrapper">
                                                    <textarea
                                                        rows={3}
                                                        value={formData.Remarks || ''}
                                                        onChange={e => handleInputChange('Remarks', e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                    </div>

                                    {/* --- ISSUEANCE DETAILS --- */}
                                    {frStatuses.filter((status) => !status.isOpen || status.value === 'FR Disapproved').some(status => status.value === formData.Frstatus) && formData.Frstatus !== 'New' && (<div className="fuel-manager-form-section-group">
                                        <div className="fuel-manager-section-header"><PlusCircle size={18} /> Issuer Details</div>

                                        <div className='fuel-manager-form-row'>
                                            <div className="fuel-manager-form-group">
                                                <label>Issued By</label>
                                                <div className="fuel-manager-form-gradient-input-wrapper">
                                                    <input
                                                        disabled
                                                        type="text"
                                                        value={formData.Issuedby}
                                                    />
                                                </div>
                                            </div>
                                            <div className="fuel-manager-form-group">
                                                <label>Issued Date</label>
                                                <div className="fuel-manager-form-gradient-input-wrapper">
                                                    <input
                                                        disabled
                                                        type="text"
                                                        value={formData.Modified ? formatDate(formData.Modified) : ''}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="fuel-manager-form-row">
                                            <div className="fuel-manager-form-group" style={{ flex: 1 }}>
                                                <label>Issuer Remarks</label>
                                                <div className="fuel-manager-form-gradient-input-wrapper">
                                                    <textarea
                                                        disabled
                                                        rows={3}
                                                        value={requestRemarks || ''}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                    </div>)}








                                    <div className="fuel-manager-form-footer">
                                        {/* Validation message area */}
                                        <div className="fuel-manager-form-validation-message" style={{
                                            flex: 1,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'flex-end',
                                            textAlign: 'right',
                                            marginLeft: 'auto',
                                            color: 'var(--color-accent)',
                                            fontWeight: 500
                                        }}>
                                            {validationMessage && <span className="validation-error">{validationMessage}</span>}
                                        </div>
                                        <button type="button" className="fuel-manager-form-btn-secondary" onClick={handleCancel}>
                                            {noedit ? 'Go Back' : 'Cancel'}
                                        </button>
                                        {!noedit &&
                                            <>
                                                <button
                                                    type="button"
                                                    className="fuel-manager-form-btn-secondary"
                                                    onClick={handleSave}
                                                    style={{ backgroundColor: '#22c55e', color: 'white' }}
                                                >
                                                    Save
                                                </button>
                                                <button
                                                    type="submit"
                                                    className={`fuel-manager-form-btn-primary`}
                                                    disabled={!!validationMessage || hasSubmitted || !formData.Orderentryref}
                                                    style={{ flexDirection: 'row', display: 'flex', alignItems: 'center', gap: '8px' }}
                                                >
                                                    {isEditing ? 'Update Fuel Request' : 'Submit Fuel Request'}
                                                    {hasSubmitted && (<Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />)}
                                                </button>
                                            </>
                                        }
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}
                </div>
            </div>

        </>
    );
};

export default FuelRequestManager;
