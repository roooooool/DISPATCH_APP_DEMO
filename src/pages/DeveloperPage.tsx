import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppConfig } from '../components/maintenanceChecker';
import './css/DeveloperPage.css';

const DeveloperPage = () => {
  const { config, refreshConfig, activePAT } = useAppConfig();
  const [localConfig, setLocalConfig] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const navigate = useNavigate();

  console.log("DeveloperPage rendered with config:", config);

  // Sync global config from context to local editable state
  useEffect(() => {
    if (config) {
      setLocalConfig(config);
    }
  }, [config]);

  const handleUpdate = (field: string, value: any, parent?: string) => {
    setLocalConfig((prev: any) => {
      if (parent) {
        return {
          ...prev,
          [parent]: {
            ...prev[parent],
            [field]: value
          }
        };
      }
      return {
        ...prev,
        [field]: value
      };
    });
  };

  const handleGoBack = () => {
    const savedUser = localStorage.getItem("gsdc_user");
    if (savedUser) {
      const userInfo = JSON.parse(savedUser);
      userInfo.CurrentNav = "/dash";
      localStorage.setItem("gsdc_user", JSON.stringify(userInfo));
      navigate("/dash", { state: { user: userInfo } });
    } else {
      navigate("/dash");
    }
  };


  const handleSaveToGitHub = async () => {
    if (!activePAT) {
      alert("No active session token found.");
      return;
    }

    setIsSaving(true);
    const repoPath = import.meta.env.VITE_APP_CONFIG_REPO;
    const url = `https://api.github.com/repos/${repoPath}/contents/external_trigger/app_config.json`;
    const headers = {
      "Authorization": `token ${activePAT}`,
      "Accept": "application/vnd.github.v3+json",
    };

    try {
      // 1. Get current file SHA to permit update
      const getRes = await fetch(url, { headers });
      const fileData = await getRes.json();

      // 2. Prepare Base64 content
      const contentString = JSON.stringify(localConfig, null, 2);
      const base64Content = btoa(unescape(encodeURIComponent(contentString)));

      // 3. Push update to repository
      const putRes = await fetch(url, {
        method: "PUT",
        headers,
        body: JSON.stringify({
          message: `System Config Update by Developer`,
          content: base64Content,
          sha: fileData.sha,
        }),
      });

      if (putRes.ok) {
        alert("Configuration updated successfully.");
        await refreshConfig(); // Trigger MaintenanceChecker to re-fetch
      } else {
        throw new Error("GitHub update failed.");
      }
    } catch (error) {
      console.error("Save failed:", error);
      alert("Failed to update repository settings.");
    } finally {
      setIsSaving(false);
    }
  };

  // Guard clause to prevent "Cannot read properties of null" errors
  if (!localConfig) {
    return (
      <div className="dev-container">
        <div className="dev-header">
          <h1 className="dev-title">Syncing GSDC Config...</h1>
          {/* Allow user to escape even during sync */}
          <button className="back-link-btn" onClick={handleGoBack}>
            Cancel & Go Back
          </button>
        </div>
        <div className="loading-spinner-container">
           <p>Connecting to GitHub Repository...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dev-container">
      <div className="dev-header">
        <h1 className="dev-title">Control Center</h1>
        <button className="back-link-btn" onClick={handleGoBack}>
          Back to Dashboard
        </button>
      </div>
      
      <div className="dev-section">
        <h3>General Information</h3>
        <div className="gradient-input-wrapper">
          <input 
            value={localConfig.AppName || ''} 
            onChange={(e) => handleUpdate('AppName', e.target.value)}
            placeholder="App Name"
          />
        </div>
      </div>

      <div className="dev-section">
        <h3>Maintenance Settings</h3>
        
        <label className="input-label">Start Time (GMT+8)</label>
        <div className="gradient-input-wrapper">
          <input 
            type="datetime-local"
            value={localConfig.maintenance?.startTime?.split('+')[0] || ''} 
            onChange={(e) => handleUpdate('startTime', e.target.value + "+08:00", 'maintenance')}
          />
        </div>

        <label className="input-label">End Time (GMT+8)</label>
        <div className="gradient-input-wrapper">
          <input 
            type="datetime-local"
            value={localConfig.maintenance?.endTime?.split('+')[0] || ''}
            onChange={(e) => handleUpdate('endTime', e.target.value + "+08:00", 'maintenance')}
          />
        </div>

        <label className="input-label">Maintenance Message</label>
        <div className="gradient-input-wrapper">
          <textarea 
            rows={4}
            value={localConfig.maintenance?.message || ''}
            onChange={(e) => handleUpdate('message', e.target.value, 'maintenance')}
            placeholder="Enter message for dispatchers..."
          />
        </div>
      </div>

      <button 
        className="save-btn" 
        onClick={handleSaveToGitHub}
        disabled={isSaving}
      >
        {isSaving ? 'Updating...' : 'Update GitHub Config'}
      </button>
    </div>
  );
};

export default DeveloperPage;