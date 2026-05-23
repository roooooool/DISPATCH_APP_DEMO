import React, { useState, useEffect, createContext, useContext } from 'react';
import MaintenancePage from '../pages/MaintenancePage';
import { useUser } from '../utils/useUser'; // Custom hook to get user info, including role
import {GSDC_GITPATService} from '../generated/services/GSDC_GITPATService';
import { ewulFetchAll } from '../utils/Ewul_GSDC_Utils';

interface ConfigContextType {
  config: any;
  refreshConfig: () => Promise<void>;
  activePAT: string | null;
}

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

export const useAppConfig = () => {
  const context = useContext(ConfigContext);
  if (!context) throw new Error("useAppConfig must be used within MaintenanceChecker");
  return context;
};

interface MaintenanceCheckerProps {
  children: React.ReactNode;
}

const MaintenanceChecker: React.FC<MaintenanceCheckerProps> = ({ children}) => {
  const { user } = useUser();
  const userRole = user?.Position || 'User'; // Default to 'User' if role is not available
  const [fullConfig, setFullConfig] = useState<any>(null);
  const [maintStatus, setMaintStatus] = useState({ isDown: false, details: null as any });
  const [_isLoading, setIsLoading] = useState(true);
  const [activePAT, setActivePAT] = useState<string | null>(null);


  const fetchAndDistributePAT = async () => {
    // Check Local Storage first
    const cachedPAT = localStorage.getItem("GSDC_ACTIVE_PAT");
    if (cachedPAT) {
      // console.log("Using cached GITPAT from local storage.");
      return cachedPAT;
    }

    //If not in local storage, fetch all tokens from the service 
    const result = await ewulFetchAll<any>(
      GSDC_GITPATService, 
      {}, 
      100
    ) || [];

    if (result.length === 0) {
      // console.error("No GITPATs found in the database.");
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
      // console.error("Failed to update GITPAT used count:", error);
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

  const checkMaintenance = async () => {
        try {
          console.log("Checking maintenance status...");
          const token = await fetchAndDistributePAT();
          const repoPath = import.meta.env.VITE_APP_CONFIG_REPO; 
          const configPath = import.meta.env.VITE_CONFIG_PATH;

          if (!repoPath || !token) return;

          const url = `https://api.github.com/repos/${repoPath}/contents/${configPath}?t=${Date.now()}`;

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
          setFullConfig(data); // Store full config for context
          const maintConfig = data?.maintenance;


          if (maintConfig) {
              const now = new Date();
              const start = new Date(maintConfig.startTime);
              const end = new Date(maintConfig.endTime);

              if (now >= start && now <= end) {
              setMaintStatus({ isDown: true, details: maintConfig });
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

  useEffect(() => {

    // 2. Run immediately on mount
    checkMaintenance();

    // 3. Set up the interval (5000ms = 5s)
    const interval = setInterval(checkMaintenance, 60000 * 5); // Check every 5 minutes (adjust as needed)

    // 4. CLEANUP: This is CRITICAL to prevent memory leaks and multiple timers
    return () => clearInterval(interval);
  }, []);

  // if (isLoading) return null; // Let the App's LoadingOverlayMask handle the visual

  // 1. Identify the bypass first
  const isDeveloper = userRole === 'Developer';
  const forceMaintenanceForDev = fullConfig?.maintenance?.ignoreDev;

  // 2. Determine if THIS specific user should see the maintenance page
  const showMaintenance = maintStatus.isDown && (!isDeveloper || forceMaintenanceForDev);

  if (showMaintenance) {
    return <MaintenancePage details={maintStatus.details} />;
  }

  return (
    <ConfigContext.Provider value={{ config: fullConfig, refreshConfig: checkMaintenance, activePAT }}>
      {children}
    </ConfigContext.Provider>
  );
};

export default MaintenanceChecker;