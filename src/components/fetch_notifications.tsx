import React, { useEffect, useCallback, useState } from 'react';

// utils
import { ewulFetchAll, ISOtoInt } from '../utils/Ewul_GSDC_Utils'; // Adjust path to your util
import { useUser} from '../utils/useUser';
import {GSDC_NAVIGATE_TO_TRIP_key} from '../truth.config';


// SERVICES
import {LiveActionLogsViewService} from '../generated/services/LiveActionLogsViewService';

//COMPONENT
import type { Notification } from "./NotificationBell";

interface NotificationFetcherProps {
  onDataLoaded: (data: Notification[]) => void;
  setLoading?: (loading: boolean) => void;
  onError?: (error: any) => void;
  stopFetching?: boolean; // Optional prop to stop fetching when needed
}

/**
 * 
      {
        id: `${result.Timestamp}-${result.OE}`,
        title: result.Action,
        message: result.Value,
        timestamp: new Date(result.Timestamp),
        state: 'default',
      }

 */

const NotificationFetcher: React.FC<NotificationFetcherProps> = ({ 
  onDataLoaded, 
  setLoading, 
  onError,
  stopFetching = false, // Default to false if not provided
}) => {
  const { user} = useUser();

  const [latestFetchedTimestamp, setLatestFetchedTimestamp] = useState<string | null>(null);
  
  const fetchMetadata = useCallback(async () => {
    if (!user) return; // Don't fetch if user is not available yet
    console.log('Fetching notifications...', 'Latest Timestamp:', latestFetchedTimestamp, 'User Last Check:', user.lastNotificationCheck);
    const baseDate = latestFetchedTimestamp || user.lastNotificationCheck || null;
    let fromInt = 0;

    if (baseDate) {
        const d = new Date(baseDate);
        // Standardize to GMT+8 for your backend filter logic
        const gmt8Date = new Date(d.getTime() + (8 * 60 * 60 * 1000));
        
        // 15 min buffer only applies on initial load (when latestFetchedTimestamp is null)
        // This prevents missing data due to clock skew on startup
        const buffer = latestFetchedTimestamp ? 500 : (15 * 1000);
        const adjustedDate = new Date(gmt8Date.getTime() - buffer);
        
        fromInt = ISOtoInt(adjustedDate.toISOString(), true);
    }



    const date_filter = `TSInt gt ${fromInt}`;  
    
    if (setLoading) setLoading(true);

    try {
        const result = await ewulFetchAll<any>(
          LiveActionLogsViewService, 
          { 
            filter: date_filter + ` and startswith(ContextType, 'Trip')`,
            orderBy: ['Timestamp desc'],
          }, 
          100
        );

        console.log('Fetched notifications: ', result.length);

        if (result && result.length > 0) {
          // 3. Capture the newest timestamp from this batch (since we ordered by desc, it's the first item)
          const newestRecord = result[0].Timestamp;
          setLatestFetchedTimestamp(newestRecord);

          const notifications: Notification[] = (result as any[]).map((item) => ({      
            id: `${item.Timestamp}-${item.OE}`,
            title: `${item.Action}`,
            message: `[${item.OE}] ${item.ContextType}: ${item.Value}\n by: ${item.Name}`,
            timestamp: new Date(item.Timestamp.replace('Z','+08:00')),
            status: 'auto',
            state: 'default',
            onClick() {
              const event = new CustomEvent(GSDC_NAVIGATE_TO_TRIP_key, { 
                detail: { oe: item.OE } 
              });
              window.dispatchEvent(event);
            },
          }));
          onDataLoaded(notifications);
        }

    } catch (err) {
      console.error("Notification Fetch Error:", err);
      if (onError) onError(err);
    } finally {
      if (setLoading) setLoading(false);
    }
  }, [user, onDataLoaded, setLoading, onError, latestFetchedTimestamp]);

  useEffect(() => {
    if (stopFetching) return;
    fetchMetadata();
    const interval = setInterval(() => {
      fetchMetadata();
    }, 60000); // 60 seconds

    return () => clearInterval(interval);
  }, [fetchMetadata, stopFetching]);

  // This component doesn't render UI, it just manages data flow
  return null;
};

export default NotificationFetcher;