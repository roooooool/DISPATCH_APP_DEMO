import React, { useState, useEffect } from 'react';
import MaintenancePage from '../pages/MaintenancePage';
import { useUser } from '../utils/useUser'; // Custom hook to get user info, including role
import {GSDC_GITPATService} from '../generated/services/GSDC_GITPATService';
import { ewulFetchAll } from '../utils/Ewul_GSDC_Utils';

interface MaintenanceCheckerProps {
  children: React.ReactNode;
}

const MaintenanceChecker: React.FC<MaintenanceCheckerProps> = ({ children}) => {
  const { user } = useUser();
  const userRole = user?.Position || 'User'; // Default to 'User' if role is not available
  const [maintStatus, setMaintStatus] = useState({ isDown: false, details: null as any });
  const [isLoading, setIsLoading] = useState(true);
  const [activePAT, setActivePAT] = useState<string | null>(null);


  const fetchAndDistributePAT = async () => {
    // Check Local Storage first
    const cachedPAT = localStorage.getItem("GSDC_ACTIVE_PAT");
    if (cachedPAT) {
      console.log("Using cached GITPAT from local storage.");
      return cachedPAT;
    }

    //If not in local storage, fetch all tokens from the service 
    const result = await ewulFetchAll<any>(
      GSDC_GITPATService, 
      {}, 
      100
    ) || [];

    if (result.length === 0) {
      console.error("No GITPATs found in the database.");
      return null;
    }

    // 3. Sort by 'used' count ascending (Lowest first)
    const sortedPats = [...result].sort((a, b) => a.used - b.used);
    const selectedPat = sortedPats[0];
    

    await updateGITPATusedCount(selectedPat.patID, selectedPat.used + 1);

    localStorage.setItem("GSDC_ACTIVE_PAT", selectedPat.gitPAT);
    localStorage.setItem("GSDC_ACTIVE_PAT_ID", selectedPat.patID.toString());

    return selectedPat.gitPAT;
  };

  const updateGITPATusedCount = async (id: number, newCount: number) => {
    try {
      await GSDC_GITPATService.update(id.toString(), { used: newCount });
    } catch (error) {
      console.error("Failed to update GITPAT used count:", error);
    }
  }

  useEffect(() => {
    const fetchPAT = async () => {
      const pat = await fetchAndDistributePAT();
      setActivePAT(pat);
      console.log(`USING PAT ${pat?.substring(0, 20)}...${pat?.substring(pat.length - 20)}`);
    };
    fetchPAT();
  }, []);

  useEffect(() => {
    // 1. Define the check as a standalone function
    const checkMaintenance = async () => {
        try {
        console.log("Checking maintenance status...");
        const token = activePAT;
        const repoPath = import.meta.env.VITE_APP_CONFIG_REPO; 

        if (!repoPath || !token) return;

        const url = `https://api.github.com/repos/${repoPath}/contents/external_trigger/app_config.json?t=${Date.now()}`;

        const res = await fetch(url, {
            method: 'GET',
            headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github.v3.raw',
            'X-GitHub-Api-Version': '2022-11-28'
            }
        });

        

        if (!res.ok) throw new Error(`Config fetch failed: ${res.status}`);
        
        const data = await res.json();
        const config = data?.maintenance;
        console.log("GitHub API response data:", data);
        if (config) {
            const now = new Date();
            const start = new Date(config.startTime);
            const end = new Date(config.endTime);

            if (now >= start && now <= end) {
            setMaintStatus({ isDown: true, details: config });
            } else {
            // If maintenance window passed, set back to live
            setMaintStatus({ isDown: false, details: null });
            }
        }
        } catch (err) {
        console.error("Maintenance check failed:", err);
        } finally {
        setIsLoading(false);
        }
    };

    // 2. Run immediately on mount
    checkMaintenance();

    // 3. Set up the interval (5000ms = 5s)
    const interval = setInterval(checkMaintenance, 60000 * 5); // Check every 5 minutes (adjust as needed)

    // 4. CLEANUP: This is CRITICAL to prevent memory leaks and multiple timers
    return () => clearInterval(interval);
    }, []);
  if (isLoading) return null; // Let the App's LoadingOverlayMask handle the visual

  // Bypass for Ed/ewul (Developer role)
  if (maintStatus.isDown && userRole !== 'Developer') {
    return <MaintenancePage details={maintStatus.details} />;
  }

  return <>{children}</>;
};

export default MaintenanceChecker;