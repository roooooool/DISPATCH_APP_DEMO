import React from 'react';
import './comp_css/LoadingOverlay.css';

import loading_delivery_truck_anim from "../../public/animated/loading_delivery_truck.gif"; // Ensure this path is correct

interface LoadingProps {
  message?: string;
  blur?: number;
  bgColor?: string;
  size?: 'sm' | 'md' | 'lg'; // New Size Parameter
}

const LoadingOverlay: React.FC<LoadingProps> = ({ 
  message = "Loading...", 
  blur = 4, 
  bgColor = "rgba(15, 23, 42, 0.1)",
  size = 'md' 
}) => {
  // Define size mappings
  const dimensions = {
    sm: { img: '40px', text: '10px' },
    md: { img: '80px', text: '13px' },
    lg: { img: '120px', text: '16px' }
  };

  const currentSize = dimensions[size];

  return (
    <div 
      className="dashboard-loading-overlay" 
      style={{ 
        backdropFilter: `blur(${blur}px)`, 
        WebkitBackdropFilter: `blur(${blur}px)`,
        backgroundColor: bgColor 
      }}
    >
      <div className="loading-content-box">
        <img 
          src={loading_delivery_truck_anim}
          alt="Loading Truck" 
          className="loading-truck-gif" 
          style={{ width: currentSize.img }} // Apply dynamic image size
        />
        <p 
          className="loading-text" 
          style={{ fontSize: currentSize.text }} // Apply dynamic font size
        >
          {message}
        </p>
      </div>
    </div>
  );
};

export default LoadingOverlay;