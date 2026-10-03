/* POWER APPS UTILITY FOR GSDC SHENANIGANS  by ewul*/
import { dataSourcesInfo } from '../../.power/schemas/appschemas/dataSourcesInfo.ts';
import type { IOperationResult } from '@microsoft/power-apps/data';
import type { IGetAllOptions } from '../generated/models/CommonModels';
//@ts-ignore
import { DMS_updatedService } from '../generated/services/DMS_updatedService';
import { DMS_ATTACHMENTS_ENDPOINT, type UserInfo } from '../truth.config';
import MD5 from 'crypto-js/md5';
import { DMS_DebugLogsService } from '../generated/services/DMS_DebugLogsService';
import { type DMS_DebugLogs } from '../generated/models/DMS_DebugLogsModel';

import { getApiUrl } from "../api/config";
import { AuthService } from "../api/AuthService.ts";
import { type ExecuteWorkerPayload } from './executeWorker';
import { type FetchWorkerPayload } from './fetchWorker';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL




export interface ODataOptions {
  $filter?: string;
  $select?: string;
  $orderby?: string;
}

export async function fetchODataRows<T>(
  endpoint: string,
  options: ODataOptions = {},
  targetRows: number = 1000
): Promise<T[]> {
  const results: T[] = [];
  const pageSize = 2000;
  let skip = 0;

  while (results.length < targetRows) {
    const remaining = targetRows - results.length;
    const top = Math.min(pageSize, remaining);

    const params = new URLSearchParams();

    params.set("$top", String(top));
    params.set("$skip", String(skip));

    if (options.$filter) params.set("$filter", options.$filter);
    if (options.$select) params.set("$select", options.$select);
    if (options.$orderby) params.set("$orderby", options.$orderby);

    const response = await fetch(`${endpoint}?${params.toString()}`);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `OData request failed (${response.status}): ${errorText}`
      );
    }

    const data: { value?: T[] } = await response.json();
    const rows = data.value ?? [];

    results.push(...rows);

    // Server returned fewer rows than requested,
    // so there is no more data.
    if (rows.length < top) {
      break;
    }

    skip += rows.length;
  }

  return results.slice(0, targetRows);
}




export const getEndpointFromService = (service: any, db?: string, objectType: string = 'table'): string => {
  // 1. Extract raw name (e.g. 'livedmsview_cem' from service.dataSourceName)
  const rawKey: string =
    (typeof service === 'string' ? service : undefined) ||
    service?.dataSourceName ||
    service?.constructor?.dataSourceName ||
    service?.name ||
    service?.constructor?.name ||
    '';

  const database = db ? db : 'DISPATCH_APP_DMS'

  // 2. Normalize key for lookups (e.g. 'LiveDMSView_CEMService' -> 'livedmsview_cem')
  const lookupKey = rawKey.replace(/Service$/, '').toLowerCase();

  // 3. Lookup in dataSourcesInfo to get the real tableId (e.g. "[dbo].[LiveDMSView_CEM]")
  const schemaEntry = (dataSourcesInfo as Record<string, any>)[lookupKey];
  const rawTableId: string = schemaEntry?.tableId || lookupKey;

  // 4. Clean brackets: "[dbo].[LiveDMSView_CEM]" -> "LiveDMSView_CEM"
  const cleanTableName = rawTableId.replace(/^\[.*?\]\./, '').replace(/[\[\]]/g, '');

  // 5. Construct final endpoint
  return getApiUrl(`/api/${database}/${objectType}/${cleanTableName}`);
};


export const ewulDecodeKeys = <T extends Record<string, any>>(
  record: T
): Record<string, any> => {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [
      key.replace(/_x([0-9A-Fa-f]{4})_/g, (_, hex) =>
        String.fromCharCode(parseInt(hex, 16))
      ),
      value,
    ])
  );
};

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
// ewulFetchAll.ts
export const ewulFetchAll = async <T>(
  service:
    | { getAll: (options?: IGetAllOptions) => Promise<IOperationResult<T[]>> }
    | string, // Allow string type
  options: IGetAllOptions,
  targetTop: number = 2000,
  keyField?: keyof T,
  //@ts-ignore
  name?: string,
  decodeKeys: boolean = false,
  db?: string,
  //@ts-ignore
  test: boolean = false
): Promise<T[]> => {
  // if (!test) return [];

  const endpoint = getEndpointFromService(service, db);
  const token = await AuthService.ensureValidToken();

  if (!token) {
    throw new Error("Authentication required");
  }

  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL('./fetchWorker.ts', import.meta.url),
      { type: 'module' }
    );

    worker.onmessage = (event: MessageEvent<{ success: boolean; data?: T[]; error?: string }>) => {
      const { success, data, error } = event.data;
      worker.terminate();

      if (success && data) {
        resolve(data);
      } else {
        reject(new Error(error || 'Worker execution failed'));
      }
    };

    worker.onerror = (err) => {
      worker.terminate();
      reject(err);
    };

    const payload: FetchWorkerPayload = {
      type: "FETCH",
      endpoint,
      options,
      targetTop,
      keyField: keyField ? String(keyField) : undefined,
      accessToken: token,
      decodeKeys: decodeKeys,
    }

    worker.postMessage(payload);
  });
};



export interface EwulResponse<T> { data: T | null; error: any; code: number; }



export interface EwulExecuteOptions {
  params?: Record<string, any>;
  method?: 'GET' | 'POST';
  pagination?: {
    top?: number;
    skip?: number;
  };
}


export type EwulStoredProcedureResult<T> =
  | T[]
  | Record<`Table${number}`, T[]>;

export const ewulExecute = async <T>(
  database: string,
  storedProcedure: string,
  options: any,
): Promise<EwulStoredProcedureResult<T>> => {
  const token = await AuthService.ensureValidToken();

  if (!token) {
    throw new Error("Authentication required");
  }

  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL('./executeWorker.ts', import.meta.url),
      { type: 'module' }
    );

    worker.onmessage = (
      event: MessageEvent<{
        success: boolean;
        data?: T[] | Record<`Table${number}`, T[]>;
        error?: string;
      }>
    ) => {
      const { success, data, error } = event.data;

      worker.terminate();

      if (success && data !== undefined) {
        // Backward compatibility:
        // One result set → return the original T[] format.
        if (
          !Array.isArray(data) &&
          Object.keys(data).length === 1 &&
          'Table1' in data
        ) {
          resolve(data.Table1);
          return;
        }

        // Multiple result sets → keep the named TableN structure.
        resolve(data);
      } else {
        reject(new Error(error || 'Worker execution failed'));
      }
    };

    worker.onerror = (err) => {
      worker.terminate();
      reject(err);
    };

    const payload: ExecuteWorkerPayload = {
      database,
      spName: storedProcedure,
      method: 'GET',
      params: ewulDecodeKeys(options),
      accessToken: token,
    };

    worker.postMessage(payload);
  });
};





export const ewulCreate = async <T = any>(
  database: string,
  tableName: string,
  record: Record<string, any>,
): Promise<EwulResponse<T>> => {
  const token = await AuthService.ensureValidToken();

  if (!token) {
    throw new Error("Authentication required");
  }

  const url = `${API_BASE_URL}/api/${encodeURIComponent(database)}/table/${encodeURIComponent(tableName)}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify(ewulDecodeKeys(record)),
  });

  const result = await response.json().catch(() => null);

  if (!response.ok) {
    const message = result?.error?.message || result?.error || `Create request failed (${response.status})`;
    throw new Error(message);
  }

  console.log('db: ', database, 'tb: ', tableName, ' res:', result);

  return {
    data: (result?.data?.value ?? result?.data ?? result?.value ?? result) as T,
    error: result?.error,
    code: response.status,
  };
};

export const ewulUpdate = async <T = any>(
  database: string,
  tableName: string,
  recordId: string,
  changes: Record<string, any>,
): Promise<EwulResponse<T>> => {
  const token = await AuthService.ensureValidToken();

  if (!token) {
    throw new Error("Authentication required");
  }

  const url = `${API_BASE_URL}/api/${encodeURIComponent(database)}/table/${encodeURIComponent(tableName)}/${encodeURIComponent(recordId)}`;

  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify(ewulDecodeKeys(changes)),
  });

  const result = await response.json().catch(() => null);

  if (!response.ok) {
    const message = result?.error?.message || result?.error || `Update request failed (${response.status})`;
    throw new Error(message);
  }

  return {
    data: (result?.data?.value ?? result?.data ?? result?.value ?? result) as T,
    error: result?.error,
    code: response.status,
  };
};

export const ewulDelete = async (
  database: string,
  tableName: string,
  recordId: string,
): Promise<EwulResponse<boolean>> => {
  const token = await AuthService.ensureValidToken();

  if (!token) {
    throw new Error("Authentication required");
  }

  const url = `${API_BASE_URL}/api/${encodeURIComponent(database)}/table/${encodeURIComponent(tableName)}/${encodeURIComponent(recordId)}`;

  const response = await fetch(url, {
    method: "DELETE",
    headers: {
      "Authorization": `Bearer ${token}`,
    },
  });

  const result = await response.json().catch(() => null);

  if (!response.ok) {
    const message = result?.error?.message || result?.error || `Delete request failed (${response.status})`;
    throw new Error(message);
  }

  return {
    data: true,
    error: result?.error,
    code: response.status,
  };
};





export interface SharePointAPIOptions { //ODATA format
  filter?: string;
  top?: number;
  orderBy?: string;
  select?: string;
}

export const ewulSharePointAPI = async <T>(
  site: string,
  list: string,
  operation: "get" | "query" | "create" | "update" | "delete",
  options?: SharePointAPIOptions,
  data?: Partial<T>,
  id?: number,
): Promise<T[]> => {
  const FLOW_URL = import.meta.env.VITE_SHAREPOINT_API_URL;

  const payload = {
    operation,
    site,
    list,
    id,
    data,
    filter: options?.filter,
    top: options?.top,
    orderby: options?.orderBy,
    select: options?.select,
  };

  const response = await fetch(FLOW_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `SharePoint API failed (${response.status}): ${errorText}`
    );
  }

  const result = await response.json();

  if (!result.success) {
    throw new Error(
      result.error?.message || "SharePoint API request failed"
    );
  }

  if (operation === "query") {
    return result.data ?? [];
  }

  if (result.data) {
    return [result.data];
  }

  return [];
};




export const ewulFetchAllPowerAppsCLI = async <T>(

  service: { getAll: (options?: IGetAllOptions) => Promise<IOperationResult<T[]>> },

  options: IGetAllOptions,

  targetTop: number = 5000,

  keyField?: keyof T, // parameter for deduplication

  name?: string,

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



      // // Find and log inside the async scope where `result` exists

      // const targetRecord = batchData?.find((record: any) => record.OE === 'SOC26-09-0428');

      // console.log('target record: ', targetRecord, 'date filter: ', 'skip: ', currentSkip, ' top: ', batchSize, 'result length: ', result.length, ' opt:', options);





      if (batchData.length === 0) break;



      result = [...result, ...batchData];

      // currentSkip += batchData.length;

      currentSkip += batchData.length;



      console.log('name: ', name, ' skip: ', currentSkip, ' acc length: ', result.length);



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

export interface FormatDateOptions {
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
    await ewulExecute('DISPATCH_APP_DMS', 'DMS_updated', {
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
 * @description
 * fetches the attachment metadata and file contents from Power Automate.
 * @param metadataRecords - Array of SharePoint attachment metadata records, fetched using SharepointAPI().
 * @param listName - The name of the SharePoint list.
 * @param siteAddress - The address of the SharePoint site.
 * @param onUpdate - Callback function to update the attachments state.
 * @param onStatusChange - Callback function to update the loading status.
 * @param onFinish - Callback function to update the final attachments state.
 */
export const fetchSharepointAttachments = async ({
  metadataRecords,
  listName,
  siteAddress,
  onUpdate,
  onStatusChange,
  //@ts-ignore
  onFinish,
}: {
  metadataRecords: any[];
  listName: string;
  siteAddress: string;
  onUpdate: (updater: (prev: any[]) => any[]) => void;
  onStatusChange?: (isLoading: boolean) => void;
  //@ts-ignore
  onFinish?: () => void;
}) => {
  try {
    onStatusChange?.(true);

    const recordMetadata = Array.isArray(metadataRecords) ? metadataRecords : [];
    console.log("Fetched %d metadata records", recordMetadata.length);

    //no records exit na
    if (recordMetadata.length === 0) {
      onUpdate(() => []);
      return [];
    }

    // Helper function to extract attachment_type safely from any SP column format
    const resolveAttachmentType = (item: any): string => {
      return (
        item?.attachment_type ||
        item?.AttachmentType ||
        item?.Attachment_x0020_Type ||
        item?.Attachment_Type ||
        ''
      );
    };

    //mapping metadata
    const initialFiles = recordMetadata.map(item => {
      const fName = item.Filename || item['{FilenameWithExtension}'] || "Untitled File";
      const isPdf = fName.toLowerCase().endsWith('.pdf');
      return {
        id: item.ID,
        name: fName,
        type: isPdf ? 'application/pdf' : 'image/jpeg',
        attachment_type: resolveAttachmentType(item),
        isRemote: true,
        isImage: !isPdf,
        previewUrl: null,
        raw: item
      };
    });


    let currentAttachments = [...initialFiles];


    onUpdate(() => currentAttachments);

    //kuha laman in Base64 
    await Promise.allSettled(
      initialFiles.map(async (file) => {
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
                attachment_type: file.attachment_type,
                isRemote: true,
                isImage: !isPdf,
                previewUrl: `data:${mimeType};base64,${fileData.base64data}`,
                raw: file.raw,
                fileIdentifier: fileData.fileIdentifier || null
              };
            });

            // Synchronous update of local variable
            currentAttachments = [
              ...currentAttachments.filter(attr => attr.id !== file.id),
              ...newAttachmentsFromFlow
            ];

            // Update React state
            onUpdate(() => currentAttachments);
          }
        } catch (error) {
          console.error(`Flow fetch failed for Record ${file.id}:`, error);
        }
      })
    );

    onFinish?.()

    return currentAttachments;

  } catch (error) {
    console.error("Attachment processing error:", error);
    throw error;
  } finally {
    onStatusChange?.(false);
    // onFinish?.()
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


export const convertFormDataToHtmlTable = (data: Record<string, any>): string => {
  const rows = Object.entries(data)
    // Filter out internal objects, arrays, or empty values to keep it clean
    .filter(([_, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => {
      // Format keys nicely (e.g., "tripStatus" -> "Trip Status")
      const formattedKey = key
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, (str) => str.toUpperCase())
        .trim();

      return `
        <tr>
          <td style="padding: 6px; font-weight: bold; width: 40%; vertical-align: top;">${formattedKey}</td>
          <td style="padding: 6px; width: 60%; vertical-align: top;">${String(value)}</td>
        </tr>
      `;
    })
    .join('');

  return `
    <table style="width: 100%; border-collapse: collapse; font-family: sans-serif;">
      <thead>
        <tr style="text-align: left;">
          <th style="padding: 6px; width: 40%;">Field</th>
          <th style="padding: 6px; width: 60%;">Value</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
};


export const formatToLocalISO = (utcString: string): string => {
  if (!utcString) return "";

  const date = new Date(utcString); // Automatically converts UTC to your local time (GMT+8)

  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');

  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');

  // Combines them with the "T" separator
  return `${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}`;
};




import { useState, useRef, useEffect, useCallback } from 'react';

interface UseAntiSpamOptions {
  baseCooldown?: number;      // Base lock time in seconds
  timePenalty?: number;       // Seconds added per spam click streak
  maxPenaltySeconds?: number; // Cap for the dynamic penalty calculation
  baseTrapWindowMs?: number;  // Initial duration to wait before resetting streak
  bannerDurationMs?: number;  // How long the warning banner stays visible
}


/**
 * @file useAntiSpam.ts
 * @description A reusable React hook utility designed to protect expensive or critical functions 
 * from rapid click spamming and server request floods.
 * 
 * @mechanism
 * 1. Cooldown Block: Prevents function execution while an action is actively loading or when 
 *    the countdown timer (`cooldown`) is greater than 0.
 * 2. Escalating Penalty: Each consecutive click within the active "Trap Window" increments 
 *    a tracking streak (`clickStreakRef`). The layout cooldown duration scales dynamically:
 *    Formula: Base Cooldown + ((Streak - 1) * Time Penalty)
 * 3. Dynamic Trap Window: The duration the system remembers the spam streak also stretches 
 *    with aggressive clicking, up to a configured maximum threshold (`maxPenaltySeconds`).
 * 
 * @usage
 * const { cooldown, bannerMessage, executeProtectedAction } = useAntiSpam(
 *   fetchDataFunction,
 *   () => isLoading,
 *   { bannerDurationMs: 2000 }
 * );
 */

export const useAntiSpam = (
  actionFn: () => Promise<void> | void,
  isAnythingLoading: () => boolean,
  options: UseAntiSpamOptions = {}
) => {
  // Destructure options with defaults matching your original configuration
  const {
    baseCooldown = 3,
    timePenalty = 5,
    maxPenaltySeconds = 30,
    baseTrapWindowMs = 8000,
    bannerDurationMs = 4000,
  } = options;

  const [cooldown, setCooldown] = useState<number>(0);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);

  const clickStreakRef = useRef<number>(0);
  const streakTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bannerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Handle the countdown timer ticking down every second
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // Cleanup all timeouts on unmount
  useEffect(() => {
    return () => {
      if (streakTimeoutRef.current) clearTimeout(streakTimeoutRef.current);
      if (bannerTimeoutRef.current) clearTimeout(bannerTimeoutRef.current);
    };
  }, []);

  const executeProtectedAction = useCallback(async () => {
    // 1. Guard against clicking during active cooldown or active loading state
    if (cooldown > 0 || isAnythingLoading()) {
      if (bannerTimeoutRef.current) clearTimeout(bannerTimeoutRef.current);

      if (clickStreakRef.current > 1) {
        setBannerMessage(`You are clicking too fast! Please wait ${cooldown} sec/s for cooling down.`);
      } else {
        setBannerMessage(`Please wait ${cooldown} sec/s while we fetch data for you.`);
      }

      bannerTimeoutRef.current = setTimeout(() => {
        setBannerMessage(null);
      }, bannerDurationMs);
      return;
    }

    // 2. Clear any existing timeout that resets the spam streak
    if (streakTimeoutRef.current) clearTimeout(streakTimeoutRef.current);

    // 3. Increment the click streak tracking spam
    clickStreakRef.current += 1;

    // 4. Calculate dynamic cooldown
    const penalty = (clickStreakRef.current - 1) * timePenalty;
    const totalCooldown = baseCooldown + penalty;

    // 5. Trigger your actual protected function execution
    await actionFn();

    // 6. Lock the execution trigger
    setCooldown(totalCooldown);

    /* --- THE DYNAMIC TRAP WINDOW --- */
    const trapPenaltyMs = (clickStreakRef.current - 1) * (timePenalty * 1000);
    const dynamicTrapWindow = Math.min(
      baseTrapWindowMs + trapPenaltyMs,
      maxPenaltySeconds * 1000
    );

    // 7. Reset the streak if they manage to stay cool for the duration of the dynamic window
    streakTimeoutRef.current = setTimeout(() => {
      clickStreakRef.current = 0;
    }, dynamicTrapWindow);
  }, [cooldown, isAnythingLoading, actionFn, baseCooldown, timePenalty, maxPenaltySeconds, baseTrapWindowMs, bannerDurationMs]);

  return {
    cooldown,
    bannerMessage,
    executeProtectedAction,
  };
};


export const encodeColumnName = (name: string): string => {
  // return name
  return name.replace(/[^a-zA-Z0-9_]|_(?=[xX])/g, (char) => {
    const hex = char.charCodeAt(0).toString(16).padStart(4, '0');
    return `_x${hex}_`;
  });
};





export const generateAttendanceID = (
  employeeName: string,
  attendanceDate: string | Date,
  oe?: string | null
): string => {
  // 1. Format date strictly as YYYY-MM-DD (CONVERT(VARCHAR(10), @AttendanceDate, 120))
  const dateObj = typeof attendanceDate === 'string' ? new Date(attendanceDate) : attendanceDate;
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day}`;

  // 2. Normalize OE for NULL safety (ISNULL(@OE, '<NULL>'))
  const oeHash = (oe && oe.trim().length > 0) ? oe.trim() : '<NULL>';

  // 3. Concatenate: EmployeeName + AttendanceDate + OE_Hash
  const rawInput = `${employeeName}${dateStr}${oeHash}`;

  // 4. Compute MD5 Hash & convert to uppercase 32-char hex string
  return MD5(rawInput).toString().toUpperCase();
};







/**
 * Parameters for creating a debug log entry using `logDebug`.
 */
export interface DebugLogParams {
  /** User information object used to automatically resolve user identity and current navigation page. */
  userInfo?: UserInfo | null;
  /** Categorization label or module name for the event (e.g., 'AttendanceModule', 'CheckoutFlow'). */
  contextType?: string;
  /** The error encountered; accepts an Error instance, string, or unknown object. */
  error?: unknown;
  /** Additional structured contextual metadata to be serialized into JSON. */
  details?: Record<string, unknown> | string;
  /** Operational trip identifier if applicable. */
  tripOE?: string;
  /** Overrides `userInfo.CurrentNav` or `window.location.pathname`. */
  nav?: string;
  /** Overrides user identifier resolved from `userInfo`. */
  user?: string;
}

/**
 * Constructs a structured log payload and calls `DMS_DebugLogsService.create` to transmit the debug log.
 *
 * @param params Configuration options and contextual metadata for the debug log.
 * @returns A promise that resolves when the logging API call completes.
 */
export async function logDebug(params: DebugLogParams): Promise<void> {
  console.log("Logging error details...");
  try {
    const { userInfo } = params;

    // 1. Resolve User (prefer explicit user -> FullName -> FirstName/LastName -> id)
    const resolvedUser =
      params.user ??
      userInfo?.FullName ??
      (userInfo?.FirstName ? `${userInfo.FirstName} ${userInfo.LastName}`.trim() : undefined) ??
      userInfo?.id;

    // 2. Resolve Nav (prefer explicit nav -> CurrentNav -> window location fallback)
    const resolvedNav =
      params.nav ??
      userInfo?.CurrentNav ??
      (typeof window !== 'undefined' ? window.location.pathname : undefined);

    // 3. Format ErrorMsg from string or Error object
    let errorMsg: string | undefined;
    if (params.error instanceof Error) {
      errorMsg = `${params.error.name}: ${params.error.message}\n${params.error.stack ?? ''}`;
    } else if (typeof params.error === 'string') {
      errorMsg = params.error;
    } else if (params.error !== undefined) {
      errorMsg = JSON.stringify(params.error);
    }

    // 4. Ensure DetailsJSON is a valid JSON string
    let detailsJson: string | undefined;
    if (typeof params.details === 'object' && params.details !== null) {
      detailsJson = JSON.stringify(params.details);
    } else if (typeof params.details === 'string') {
      detailsJson = params.details;
    }

    // 5. Build payload explicitly typed with Omit<DMS_DebugLogs, 'LogID'>
    const payload: Omit<DMS_DebugLogs, 'LogID'> = {
      TimeOccured: new Date().toISOString(), // Required string in generated model
      Nav: resolvedNav,
      ContextType: params.contextType,
      ErrorMsg: errorMsg,
      DetailsJSON: detailsJson,
      User: resolvedUser,
      TripOE: params.tripOE,
    };

    console.log('error payload: ', payload);

    const result = await DMS_DebugLogsService.create({ ...payload });
    console.log('error log result: ', result);
  } catch (loggingError) {
    console.error('Failed to send debug log payload:', loggingError);
  }
}





interface DispatchEmployee {
  Id: number;
  ExtraID: string;
  LastName: string;
  FirstName: string;
  MiddleName: string;
  Suffix: string;
  PF: string;
  Position: string;
  EmploymentStatus: string;
  Deploystatus: string;
  RestrictionCode: string;
  PhoneNumber: string;
  AreaAssignment: string;
  BU: string;
  Role: string;
  FullName: string;
  Modified: string;
  mod2: string;
}

interface DispatchAttendance {
  ID: number;
  EmployeeName: string;
  AttendanceDate: string;
  AttendanceStatus: string;
  EmployeeID: string;
  OE: string;
  ModifiedAt: string;
  tripKM: number;
  SD: string;
  secondTrip: string;
  tripIndex: number;
  TransactionType: string;
  Position: string;
  TCVC: string;
  Approved: string;
  spID: number;
  ModifiedBy: string;
  ApprovedBy: string;
  ModifiedAt2: string;
}

interface DispatchTrip {
  OE: string;
  "Trip Status": string;
  "Trip_x0020_Status"?: string;
  Modified: string;
  TripProgress: string;
  Vehicle: string;
  BO: string;
  Driver: string;
  Helper: string;
  "OE Date": string;
  "Buisness Unit": string;
  "_tripGroup": string;
  Category: "Ongoing" | "Planned";
}


export async function getDriverHelperList(BU?: string) {
  const result = await ewulExecute(
    'DISPATCH_APP_DMS',
    'GetDriverHelperDispatchData',
    {}
  ) as {
    Table1: DispatchEmployee[];
    Table2: DispatchAttendance[];
    Table3: DispatchTrip[];
  };

  if (Array.isArray(result)) {
    throw new Error(
      'GetDriverHelperDispatchData did not return multiple result sets.'
    );
  }

  const employees = result.Table1 as DispatchEmployee[];
  const attendance = result.Table2 as DispatchAttendance[];
  const trips = result.Table3 as DispatchTrip[];

  // ------------------------------------------
  // Attendance lookup
  // ------------------------------------------

  const attendanceMap = new Map<string, DispatchAttendance>();

  for (const row of attendance) {
    const existing = attendanceMap.get(row.EmployeeName);

    if (
      !existing ||
      new Date(row.AttendanceDate).getTime() >
      new Date(existing.AttendanceDate).getTime() ||
      (
        row.AttendanceDate === existing.AttendanceDate &&
        new Date(row.ModifiedAt).getTime() >
        new Date(existing.ModifiedAt).getTime()
      )
    ) {
      attendanceMap.set(row.EmployeeName, row);
    }
  }

  // ------------------------------------------
  // Trip lookup
  // ------------------------------------------

  const tripMap = new Map<string, DispatchTrip>();

  for (const trip of trips) {


    if (
      trip.Category === "Ongoing" &&
      (
        !trip.Driver ||
        // !trip.Helper || trips can have no helper
        !trip["OE Date"]
      )
    ) {
      continue;
    }

    const updateTrip = (
      employeeName: string,
      position: "Driver" | "Helper"
    ) => {
      const key = `${employeeName}|${position}|${trip.Category}`;
      const existing = tripMap.get(key);

      if (
        !existing ||
        new Date(trip.Modified).getTime() >
        new Date(existing.Modified).getTime()
      ) {
        tripMap.set(key, trip);
      }
    };

    if (trip.Driver) {
      updateTrip(trip.Driver, "Driver");
    }

    if (trip.Helper) {
      updateTrip(trip.Helper, "Helper");
    }
  }

  // ------------------------------------------
  // Build final Driver / Helper list
  // ------------------------------------------

  const driverHelperList = employees
    .filter(employee =>
      employee.Deploystatus?.includes("Deployed") &&
      (
        employee.EmploymentStatus?.includes("Regular") ||
        employee.EmploymentStatus?.includes("Probationary")
      ) &&
      (!BU || employee.BU === BU)
    )
    .map(employee => {

      const attendanceRow =
        attendanceMap.get(employee.FullName);

      const ongoing =
        tripMap.get(
          `${employee.FullName}|${employee.Position}|Ongoing`
        );

      const planned =
        tripMap.get(
          `${employee.FullName}|${employee.Position}|Planned`
        );


      const latestTrip = ongoing;

      const attendanceStatus =
        attendanceRow?.AttendanceStatus ?? "ABSENT";

      let sortAttendance = -1;

      if (employee.BU === "THIRD PARTY") {
        sortAttendance = 1;
      }
      else if (
        [
          "ABSENT",
          "LEAVE",
          "SUSPENDED",
          "REST DAY",
          "APPRENTICE",
          "-"
        ].includes(attendanceStatus)
      ) {
        sortAttendance = -1;
      }
      else if (
        [
          "ON TRIP",
          "IN TRANSIT",
          "TUKOD"
        ].includes(attendanceStatus)
      ) {
        sortAttendance = 0;
      }
      else if (attendanceStatus === "PRESENT") {
        sortAttendance = 1;
      }
      else if (attendanceStatus === "SERVED") {
        sortAttendance = 2;
      }

      // const debugEmployee = "Palermo, Donde Cagalitang";

      // console.table(
      //   trips
      //     .filter(trip =>
      //       trip.Driver === debugEmployee ||
      //       trip.Helper === debugEmployee
      //     )
      //     .sort(
      //       (a, b) =>
      //         new Date(b.Modified).getTime() -
      //         new Date(a.Modified).getTime()
      //     )
      // );

      return {
        Id: employee.Id,
        ExtraID: employee.ExtraID,
        FullName: employee.FullName,
        Role: employee.Role,
        BU: employee.BU,
        PF: employee.PF,
        Position: employee.Position,
        AreaAssignment: employee.AreaAssignment,
        EmploymentStatus: employee.EmploymentStatus,
        Deploystatus: employee.Deploystatus,
        RestrictionCode: employee.RestrictionCode,
        PhoneNumber: employee.PhoneNumber,

        SortAttendance: sortAttendance,


        DMS_OE: latestTrip?.OE ?? null,
        OE: latestTrip?.OE ?? null,
        DMS_TripStatus: latestTrip?.["Trip Status"] ?? latestTrip?.["Trip_x0020_Status"] ?? null,
        DMS_Modified: latestTrip?.Modified ?? null,
        DMS_TripProgress: latestTrip?.TripProgress ?? null,
        DMS_Vehicle: latestTrip?.Vehicle ?? null,
        DMS_BO: latestTrip?.BO ?? null,

        LastRecordedDate:
          attendanceRow?.ModifiedAt ?? null,

        DMS_Attendance:
          employee.BU === "THIRD PARTY"
            ? "PRESENT"
            : attendanceStatus,

        isPaired: null,

        LastName: employee.LastName,
        FirstName: employee.FirstName,
        MiddleName: employee.MiddleName,
        Suffix: employee.Suffix,

        IRID: null,

        plannedTrip: planned?.OE ?? null
      };
    });

  return driverHelperList;
}
