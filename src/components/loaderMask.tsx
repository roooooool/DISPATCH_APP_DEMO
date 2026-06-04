import React, { useEffect, useState } from 'react';
import '../pages/css/LoadingPage.css'; // Create this for styling
import gsdcLogo from "../../public/gsdc_logo.png";
import { APP_VERSION } from '../truth.config'; // Import the app version for display

const LOADING_STEPS = [
  "Authenticating session...",
  "Fetching user preferences...",
  "Loading theme configurations...",
  "Checking last visited page...",
  "Synchronizing fleet data...",
  "Finalizing workspace..."
];


interface LoadingOverlayMaskProps {
  onProgressChange?: (progress: number) => void;
}

const LoadingOverlayMask: React.FC<LoadingOverlayMaskProps> = ({ onProgressChange }) => {

  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState(LOADING_STEPS[0]);

  useEffect(() => {
    // Calculate the next delay to slow down as progress increases
    // Starts fast (~50ms), ends slow (~170ms)
    const baseDelay = 50;
    const slowdownFactor = Math.pow(progress / 100, 2) * 120;
    const nextDelay = baseDelay + slowdownFactor;

    const timer = setTimeout(() => {
      setProgress((prev) => {
        // Larger jumps at the start, smaller at the end
        const remaining = 100 - prev;
        const jump = Math.max(1, Math.floor(Math.random() * (remaining / 5)) + 2);
        const next = Math.min(100, prev + jump);

        // Update text status based on the step index
        const stepIndex = Math.min(
          Math.floor((next / 100) * LOADING_STEPS.length),
          LOADING_STEPS.length - 1
        );
        setStatusText(LOADING_STEPS[stepIndex]);

        // Notify parent of progress change
        if (onProgressChange) {
          onProgressChange(next);
        }

        return next;
      });
    }, nextDelay);

    return () => clearTimeout(timer);
  }, [progress, onProgressChange]);

  return (
    <div className="loading-page-container">
      <div className="loading-content">
        {/* Navy Blue Logo/Icon Placeholder */}
        <img
          src={gsdcLogo}
          alt="GSDC Logo"
          className="loading-logo"
        />
        <div className="loader-logo">GSDC DISPATCH APP</div>
        <span>v{APP_VERSION}</span>
        <h2 className="loading-status-text">{statusText}</h2>

        <div className="progress-container">
          {/* Gradient bar: Navy to Red */}
          <div 
            className="progress-bar-fill" 
            style={{ width: `${progress}%` }}
          ></div>
        </div>
        
        <span className="progress-percentage">{progress}%</span>
      </div>
    </div>
  );
};

export default LoadingOverlayMask;