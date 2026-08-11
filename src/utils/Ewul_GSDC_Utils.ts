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
 * @description
 * fetches the attachment metadata and file contents from Power Automate.
 * @param metadataRecords - Array of SharePoint attachment metadata records.
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

    // 🛑 Exit early and skip onFinish if there are no records
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

    // 1. Map metadata to initial placeholder objects
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

    // Track running state locally
    let currentAttachments = [...initialFiles];

    // Seed state with initial placeholders
    onUpdate(() => currentAttachments);

    // 2. Fetch Base64 data concurrently
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

            // Synchronously update tracking array
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

    // // 3. Fire onFinish ONLY if attachments were found and processed
    // if (currentAttachments.length > 0) {
    //   onFinish?.(currentAttachments);
    // }
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
  return name.replace(/[^a-zA-Z0-9_]|_(?=[xX])/g, (char) => {
    const hex = char.charCodeAt(0).toString(16).padStart(4, '0');
    return `_x${hex}_`;
  });
};
