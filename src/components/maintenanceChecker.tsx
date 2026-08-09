import React, { useState, useEffect, createContext, useContext } from 'react';
// import { Navigate } from 'react-router-dom'; // 1. Import Navigate
import MaintenancePage from '../pages/MaintenancePage';
import { useUser } from '../utils/useUser';
import { GSDC_GITPATService } from '../generated/services/GSDC_GITPATService';
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

const MaintenanceChecker: React.FC<MaintenanceCheckerProps> = ({ children }) => {
  const { user } = useUser();
  const userRole = user?.Position || 'User';
  const [fullConfig, setFullConfig] = useState<any>(null);
  const [maintStatus, setMaintStatus] = useState({ isDown: false, details: null as any });
  const [_isLoading, setIsLoading] = useState(true);
  const [activePAT, setActivePAT] = useState<string | null>(null);

  const fetchAndDistributePAT = async () => {
    const cachedPAT = localStorage.getItem("GSDC_ACTIVE_PAT");
    if (cachedPAT) return cachedPAT;

    const result = await ewulFetchAll<any>(GSDC_GITPATService, {}, 100) || [];
    if (result.length === 0) return null;

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
  };

  useEffect(() => {
    const fetchPAT = async () => {
      const pat = await fetchAndDistributePAT();
      setActivePAT(pat);
    };
    fetchPAT();
  }, []);

  const checkMaintenance = async () => {
    try {
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
      setFullConfig(data);
      const maintConfig = data?.maintenance;

      if (maintConfig) {
        const now = new Date();
        const start = new Date(maintConfig.startTime);
        const end = new Date(maintConfig.endTime);

        if (now >= start && now <= end) {
          setMaintStatus({ isDown: true, details: maintConfig });
        } else {
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
    checkMaintenance();
    const interval = setInterval(checkMaintenance, 60000 * 5);
    return () => clearInterval(interval);
  }, []);

  // 2. Check if the gsdc_user session token exists in localStorage
  const hasUserSession = !!localStorage.getItem("gsdc_user");

  // // If no user session is found, navigate to login page
  // if (!hasUserSession) {
  //   return <Navigate to="/login" replace />;
  // }

  // 3. User session exists -> evaluate developer bypass and maintenance page
  const isDeveloper = userRole === 'Developer';
  const forceMaintenanceForDev = fullConfig?.maintenance?.ignoreDev;

  const showMaintenance = maintStatus.isDown && (!isDeveloper || forceMaintenanceForDev);

  if (showMaintenance && hasUserSession) {
    return <MaintenancePage details={maintStatus.details} />;
  }

  return (
    <ConfigContext.Provider value={{ config: fullConfig, refreshConfig: checkMaintenance, activePAT }}>
      {children}
    </ConfigContext.Provider>
  );
};

export default MaintenanceChecker;