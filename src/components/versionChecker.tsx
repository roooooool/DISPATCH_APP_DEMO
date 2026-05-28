import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { APP_VERSION } from '../truth.config';
import { useAppConfig } from './maintenanceChecker';

export const useVersionCheck = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { config } = useAppConfig();

  useEffect(() => {
    // 1. Bail out if config isn't loaded or we are already on the update page
    if (!config?.Version || location.pathname === '/update-required') return;

    // 2. Parse "1.2.3" -> [1, 2, 3]
    const current = APP_VERSION.split('.').map(num => parseInt(num));
    const latest = config.Version.split('.').map((num: string) => parseInt(num));

    const [currentMajor, currentMinor] = current;
    const [latestMajor, latestMinor] = latest;

    // 3. Logic: Trigger if Major is higher OR if Major is same but Minor is higher
    const isMajorUpdate = latestMajor > currentMajor;
    const isMinorUpdate = latestMajor === currentMajor && latestMinor > currentMinor;


    if ((isMajorUpdate || isMinorUpdate) && config.mandatoryUpdate) {
      console.warn(`Outdated Client: ${APP_VERSION} < ${config.Version}`);
      
      // Pass the new version as state so the page can display it
      navigate('/update-required', { 
        state: { 
          newVersion: config.Version,
          isMajor: isMajorUpdate 
        } 
      });
    }
  }, [config, navigate, location.pathname, APP_VERSION]);
};