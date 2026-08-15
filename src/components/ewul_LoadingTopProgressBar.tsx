import React from 'react';
import './comp_css/ewul_LoadingTopProgressBar.css'; // Adjust path as needed

interface TopProgressBarProps {
  loading: boolean;
}

export const TopProgressBar: React.FC<TopProgressBarProps> = ({ loading }) => {
  if (!loading) return null;

  return (
    <div className="top-progress-container">
      <div className="top-progress-bar" />
    </div>
  );
};