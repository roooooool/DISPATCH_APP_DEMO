import React from 'react';
import './comp_css/ewul_HeaderSyncBadge.css';

interface HeaderSyncBadgeProps {
    loading: boolean;
    label?: string;
}

export const HeaderSyncBadge: React.FC<HeaderSyncBadgeProps> = ({
    loading,
    label = "Updating..."
}) => {
    if (!loading) return null;

    return (
        <div className="sync-badge">
            <span className="sync-spinner" />
            <span className="sync-text">{label}</span>
        </div>
    );
};