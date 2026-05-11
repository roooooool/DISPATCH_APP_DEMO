import React, { useEffect } from 'react';
import './comp_css/ewul_Banner.css';

interface AutoDismissBannerProps {
  message: string | null;
  onClose: () => void;
  duration?: number; // Duration in milliseconds
}

const AutoDismissBanner: React.FC<AutoDismissBannerProps> = ({ 
  message, 
  onClose, 
  duration = 3000 
}) => {
  
  useEffect(() => {
    if (!message) return;
    
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [message, onClose, duration]);

  if (!message) return null;

  return (
    <div className="banner-danger animate-pop-in">
      <span>{message}</span>
      <button 
        className="banner-close-btn" 
        onClick={onClose}
        aria-label="Close"
      >
        ✕
      </button>
    </div>
  );
};

export default AutoDismissBanner;