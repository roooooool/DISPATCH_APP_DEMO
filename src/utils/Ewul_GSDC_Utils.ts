/* POWER APPS UTILITY FOR GSDC SHENANIGANS  by ewul*/
import type { IOperationResult } from '@microsoft/power-apps/data';
import type { IGetAllOptions } from '../generated/models/CommonModels';
import { DMS_updatedService } from '../generated/services/DMS_updatedService';
import { DMS_ATTACHMENTS_ENDPOINT } from '../truth.config';

/**
 * Bypasses the standard 2,000-row delegation limit of Power Apps/OData services 
 * by executing sequential batch requests.
 * * @description
 * This utility uses a "skip" and "top" strategy to crawl through datasets larger than 2,000 rows. 
 * It will automatically stop if the server returns no more data or if the 'targetTop' is reached.
 * * @template T - The type of the record being fetched.
 * * @param service - The API service object containing a `getAll` method.
 * @param options - Standard OData options (filter, orderBy, etc.).
 * @param targetTop - The total number of records you wish to retrieve (default: 5000).
 * @param keyField - (Optional) The unique property name (e.g., 'ID') used to de-duplicate 
 * records that might appear twice if the database updates during the batching process.
 * * @returns A promise resolving to a de-duplicated array of type T.
 * * @example
 * // Basic usage for fetching 5000 trips de-duplicated by 'ID'
 * const allTrips = await ewulFetchAll(
 * LiveDMSView_CEMService, 
 * { filter: "Status eq 'Active'" }, 
 * 5000, 
 * 'ID'
 * );
 */
export const ewulFetchAll = async <T>(
  service: { getAll: (options?: IGetAllOptions) => Promise<IOperationResult<T[]>> },
  options: IGetAllOptions,
  targetTop: number = 5000,
  keyField?: keyof T // parameter for deduplication
): Promise<T[]> => {
  const MAX_BATCH_SIZE = 2000;
  let result: T[] = [];
  let currentSkip = options.skip || 0;

  while (result.length < targetTop) {
    const remainingToFetch = targetTop - result.length;
    const batchSize = Math.min(MAX_BATCH_SIZE, remainingToFetch);

    const batchOptions: IGetAllOptions = {
      ...options,
      top: batchSize,
      skip: currentSkip,
    };

    try {
      const response = await service.getAll(batchOptions);
      const batchData = response?.data || [];

      if (batchData.length === 0) break;

      result = [...result, ...batchData];
      currentSkip += batchData.length;

      if (batchData.length < batchSize) break;
    } catch (error) {
      console.error("Batch Fetch Error:", error);
      throw error;
    }
  }

  // --- DYNAMIC DE-DUPLICATION ---
  if (!keyField) return result;

  const uniqueMap = new Map();
  result.forEach((item) => {
    const val = item[keyField];
    // Only add to map if we haven't seen this specific ID/OE yet
    if (val !== undefined && val !== null && !uniqueMap.has(val)) {
      uniqueMap.set(val, item);
    }
  });

  return Array.from(uniqueMap.values());
};



/** Formats a date string or Date object into a human-readable format.
 * @param dateString - The date string or Date object to format.
 * @param options - Formatting options.
 * @returns A formatted date string.
 */

interface FormatDateOptions {
  mode?: 'date' | 'datetime' | 'duration';
  compareTo?: string | Date; // For duration mode, defaults to now
  format?: Intl.DateTimeFormatOptions;
  alreadyLocal?: boolean;
}

export const formatDate = (dateString: string | Date | number, options: FormatDateOptions = {}) => {
  if (!dateString) return "---";
  
  const { mode = 'date', compareTo = new Date(), format, alreadyLocal = false } = options;

  let processedDateString = dateString;
  if (alreadyLocal && typeof dateString === 'string' && dateString.endsWith('Z')) {
    processedDateString = dateString.slice(0, -1);
  }

  const date = new Date(processedDateString);

  if (isNaN(date.getTime())) return "Invalid Date";
  
  // 1. DURATION MODE: Calculate time elapsed (e.g., "2h 15m ago")
  if (mode === 'duration') {
    const start = date.getTime();
    const end = new Date(compareTo).getTime();
    const diffInSeconds = Math.floor((end - start) / 1000);
    const absDiff = Math.abs(diffInSeconds);
    const suffix = diffInSeconds >= 0 ? "ago" : "from now";

    if (absDiff < 60) return `${absDiff}s ${suffix}`;
    if (absDiff < 3600) return `${Math.floor(absDiff / 60)}m ${suffix}`;
    if (absDiff < 86400) {
      const h = Math.floor(absDiff / 3600);
      const m = Math.floor((absDiff % 3600) / 60);
      return `${h}h ${m}m ${suffix}`;
    }
    return `${Math.floor(absDiff / 86400)}d ${suffix}`;
  }

  // 2. DATETIME MODE: Full details (Month Day, Year - HH:MM:SS AM/PM)
  if (mode === 'datetime') {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      timeZone: alreadyLocal ? undefined : 'UTC'
    }).format(date);
  }

  const defaultOptions: Intl.DateTimeFormatOptions = mode === ('datetime' as string)
  ? { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit', 
      hour12: true 
    }
  : { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    };

  // 3. DEFAULT DATE MODE: "Feb 8, 2023"
  return new Intl.DateTimeFormat('en-US', { 
    ...(format || defaultOptions), 
    timeZone: alreadyLocal ? undefined : 'UTC' 
  }).format(date);
};



/**
 * Converts an ISO Date string (e.g., "2026-02-28T14:30:05Z") into a YYYYMMDD or YYYYMMDDHHMMSS integer.
 * Optimized with UTC safety to prevent local timezone shifts.
 * @param dateStr - The ISO date string to convert.
 * @param includeTime - If true, returns YYYYMMDDHHMMSS. If false, returns YYYYMMDD.
 * @returns A number in the requested format, or 0 if the input is invalid.
 */
export const ISOtoInt = (
  dateStr: string | null | undefined, 
  includeTime: boolean = false
): number => {
  if (!dateStr) return 0;

  const d = new Date(dateStr);
  
  if (isNaN(d.getTime())) return 0;

  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + 1;
  const day = d.getUTCDate();

  if (!includeTime) {
    // Standard format: YYYYMMDD
    return (year * 10000) + (month * 100) + day;
  }

  // Max Precision format: YYYYMMDDHHMMSS
  const hours = d.getUTCHours();
  const minutes = d.getUTCMinutes();
  const seconds = d.getUTCSeconds();

  // Calculation:
  // (YYYYMMDD * 1000000) + (HH * 10000) + (MM * 100) + SS
  return (
    ((year * 10000 + month * 100 + day) * 1000000) + 
    (hours * 10000) + 
    (minutes * 100) + 
    seconds
  );
};




/**
 * Global cache for tracking the last successful execution of named fetch operations.
 * Used by {@link ewul_canFetch} to prevent redundant API calls to Power Platform services.
 */
export const ewul_lastFetchTimestamps: { [key: string]: number } = {};

/**
 * Global registry for tracking active loading states across the application.
 * Used by {@link ewul_setLoadingFor} and {@link ewul_isAnythingLoading}.
 */
export const ewul_loadingList: { [key: string]: boolean } = {};

/**
 * Validates if a specific fetch operation is allowed to proceed based on a cooldown timer.
 * * @description
 * Prevents "spamming" the server by checking the time elapsed since the last call.
 * If allowed, it automatically updates the timestamp to the current time.
 * * @param fetchName - Unique identifier for the operation (e.g., 'fetchTrips').
 * @param cooldown - Minimum time in milliseconds between calls (default: 5000ms).
 * @returns {boolean} - True if the fetch can proceed; False if it is on cooldown.
 * * @example
 * if (ewul_canFetch('fetchTrips', 10000)) {
 * // Execute your API logic here
 * }
 */
export const ewul_canFetch = (fetchName: string, cooldown: number = 5000): boolean => {
    const now = Date.now();
    const lastFetch = ewul_lastFetchTimestamps[fetchName] || 0;
    
    if (now - lastFetch < cooldown) {
        console.log(`Fetch for ${fetchName} is on cooldown.`);
        return false;
    }
    
    ewul_lastFetchTimestamps[fetchName] = now;
    return true;
};

/**
 * Checks if any registered operation in the application is currently in a loading state.
 * * @description
 * Useful for displaying a global progress bar or preventing navigation during data sync.
 * @returns {boolean} - True if at least one item in the list is 'true'.
 */
export const ewul_isAnythingLoading = (): boolean => {
    return Object.values(ewul_loadingList).some(value => value === true);
};

/**
 * Updates the loading status for a specific operation with a built-in jitter reduction.
 * * @description
 * Setting a value to 'true' happens instantly for UI responsiveness. 
 * Setting a value to 'false' is delayed by 500ms to provide a "gentle" visual 
 * transition and prevent flickering for near-instant API responses.
 * * @param fetchName - Unique identifier for the operation.
 * @param value - The loading state (true = loading, false = idle).
 */
export const ewul_setLoadingFor = (fetchName: string, value: boolean): void => {
    if (value === false) {
        setTimeout(() => {
            ewul_loadingList[fetchName] = false;
        }, 500); // Jitter reduction delay
    } else {
        ewul_loadingList[fetchName] = true;
    }
};


/**
 * Logs an action to the DMS_updated stored procedure.
 * @param params - The parameters for the stored procedure.
 */
export const logDmsUpdate = async (params: {
  userName: string;
  userID: number;
  inputOE: string;
  action: string;
  value: string;
  isRecordJSON?: boolean,
  bu?: string;
  context?: string;
  role?: string;
}) => {
  const {
    userName,
    userID,
    inputOE,
    action,
    value,
    isRecordJSON,
    bu,
    context = 'General',
    role,
  } = params;


  try {
    await DMS_updatedService.DMS_updated({
      UserName: userName,
      UserID: userID,
      InputOE: inputOE,
      Action: action,
      Value: value,
      BU: bu,
      Context: context,
      ActionJSON: isRecordJSON,
      Role: role,
    } as any);
    console.log('DMS_updated log successful:', params);
  } catch (error) {
    console.error('Error logging to DMS_updated:', error);
  }
};







/**
 * Reusable utility to fetch SharePoint attachment metadata and 
 * then stream the actual file contents from Power Automate.
 */
export const fetchSharepointAttachments = async ({
  metadataRecords,
  listName,
  siteAddress,
  onUpdate,
}: {
  metadataRecords: any[];
  listName: string;
  siteAddress: string;
  onUpdate: (updater: (prev: any[]) => any[]) => void;
}) => {
  try {
    
    // 1. Fetch metadata from SharePoint via ewulFetchAll
    const recordMetadata = metadataRecords;

    console.log("Fetched %d metadata records", recordMetadata.length);

    if (recordMetadata && Array.isArray(recordMetadata)) {
      console.log("Record metadata fetched:", recordMetadata);

      // 2. Map metadata to initial "loading" objects
      const initialFiles = recordMetadata.map(item => {
        const fName = item.Filename || item['{FilenameWithExtension}'] || "Untitled File";
        const isPdf = fName.toLowerCase().endsWith('.pdf');
        return {
          id: item.ID,
          name: fName,
          type: isPdf ? 'application/pdf' : 'image/jpeg',
          isRemote: true,
          isImage: !isPdf,
          previewUrl: null, // Content hasn't arrived yet
          raw: item
        };
      });

      // Set the initial list (placeholders)
      onUpdate(() => initialFiles);

      // 3. Process each record individually to get Base64 data from Flow
      initialFiles.forEach(async (file) => {
        try {
          const response = await fetch(DMS_ATTACHMENTS_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                itemID: file.id, 
                listName: listName, 
                siteAddress: siteAddress 
            }),
          });

          const responseText = await response.text();
          const data = responseText ? JSON.parse(responseText) : {};
          const flowFiles = Array.isArray(data) ? data : data.body || [];

          if (flowFiles.length > 0) {
            const newAttachmentsFromFlow = flowFiles.map((fileData: any, index: number) => {
              const fName = fileData.fileName || `${file.name} (${index + 1})`;
              const isPdf = fName.toLowerCase().endsWith('.pdf');
              const mimeType = isPdf ? 'application/pdf' : 'image/jpeg';
              
              return {
                id: `${file.id}-${index}`,
                name: fName,
                type: mimeType,
                isRemote: true,
                isImage: !isPdf,
                previewUrl: `data:${mimeType};base64,${fileData.base64data}`,
                raw: file.raw,
                fileIdentifier: fileData.fileIdentifier || null
              };
            });

            // 4. Use the callback to update the caller's state
            onUpdate(prev => [
              ...prev.filter(attr => attr.id !== file.id), // Remove placeholder
              ...newAttachmentsFromFlow // Add detailed files
            ]);
          }
        } catch (error) {
          console.error(`Flow fetch failed for Record ${file.id}:`, error);
        }
      });
      
      return recordMetadata; // Return metadata in case caller needs it for other IDs
    }
  } catch (error) {
    console.error("Attachment processing error:", error);
    throw error;
  }
};



export const handleNavigateError = (error: string, location: any, navigate: any) => {
  navigate('/error', {
    state: {
      details: error,
      actionText: "Return to Current Page",
      actionPath: location.pathname,
      required: true, // Mark this error as required to report
    }
  });
}


