import React, { useState, useMemo } from 'react';
import { Clock, CheckCircle2, Truck, Fuel, Users, Activity, Filter, ChevronDown } from 'lucide-react';

// component css
import '../components/comp_css/TripTimeline.css';

// truth config
import { TRIP_CONTEXT_TYPES } from '../truth.config';

interface TripLog {
    ID: number;
    Timestamp: string;
    OE: string;
    Action: string;
    Value: string;
    Name: string;
    ContextType: string;
    json_data?: string; // Add this
}

interface TripTimelineProps {
    logs: TripLog[];
    oeReference?: string | null;
}

const TripTimeline: React.FC<TripTimelineProps> = ({ logs }) => {
    // Dropdown state tracker
    const [selectedContext, setSelectedContext] = useState<string>('ALL');
    const [expandedId, setExpandedId] = useState<number | null>(null);
    
    const getContextIcon = (context: string) => {
        const c = context.toLowerCase();
        if (c.includes('progress')) return <Truck size={16} />;
        if (c.includes('attendance')) return <Users size={16} />;
        if (c.includes('fuel')) return <Fuel size={16} />;
        if (c.includes('done')) return <CheckCircle2 size={16} />;
        return <Activity size={16} />;
    };

    const renderJsonDetails = (jsonString?: string) => {
        if (!jsonString) return null;
        try {
            const data = JSON.parse(jsonString);
            return (
                <div className="json-details-grid">
                    {Object.entries(data).map(([key, val]) => (
                        <div key={key} className="json-detail-item">
                            <span className="json-key">{key}:</span>
                            <span className="json-value">{String(val)}</span>
                        </div>
                    ))}
                </div>
            );
        } catch (e) {
            return <div className="json-error">Error parsing trip data</div>;
        }
    };

    // 1st Step: Standard Chronological Sort
    const chronologicalLogs = useMemo(() => {
        return [...logs].sort((a, b) => 
            new Date(a.Timestamp).getTime() - new Date(b.Timestamp).getTime()
        );
    }, [logs]);

    // 2nd Step: Filter based on selection
    const filteredLogs = useMemo(() => {
        if (selectedContext === 'ALL') return chronologicalLogs;
        return chronologicalLogs.filter(log => log.ContextType === selectedContext);
    }, [chronologicalLogs, selectedContext]);

    /**
     * Calculates a dynamic gap based on time difference.
     */
    const calculateGap = (current: string, next?: string) => {
        if (!next) return 0;
        const diffInHours = (new Date(next).getTime() - new Date(current).getTime()) / (1000 * 60 * 60);
        const baseGap = Math.min(Math.max((diffInHours / 2.66) + 1, 1), 20);
        return baseGap;
    };

    return (
        <div className="trip-timeline-container">
            <div className="timeline-header">
                <div className="header-title-section">
                    {/* <h3>Trip #: {oeReference || chronologicalLogs[0]?.OE || 'N/A'}</h3> */}
                    {selectedContext !== 'ALL' && (
                        <span className="filter-indicator-badge">Filtered</span>
                    )}
                </div>

                {/* Gradient-outlined filter input field wrapper */}
                <div className="filter-dropdown-container">
                    <Filter size={14} className="filter-field-icon" />
                    <select 
                        value={selectedContext}
                        onChange={(e) => setSelectedContext(e.target.value)}
                        className="timeline-context-select"
                    >
                        <option value="ALL">All Contexts ({chronologicalLogs.length})</option>
                        {TRIP_CONTEXT_TYPES.map((type) => {
                            const count = chronologicalLogs.filter(l => l.ContextType === type).length;
                            return (
                                <option key={type} value={type} disabled={count === 0}>
                                    {type} {count > 0 ? `(${count})` : ''}
                                </option>
                            );
                        })}
                    </select>
                    <ChevronDown size={12} className="dropdown-icon" />
                </div>
            </div>
            
            <div className="timeline-body">
                {filteredLogs.map((log, index) => {
                    const nextLog = filteredLogs[index + 1];
                    const gapHeight = calculateGap(log.Timestamp, nextLog?.Timestamp);
                    const isExpanded = expandedId === log.ID;

                    return (
                        <div 
                            key={log.ID} 
                            className={`timeline-item ${isExpanded ? 'item-expanded' : ''}`}
                            style={{ paddingBottom: `${gapHeight * 4}px` }}
                            onClick={() => setExpandedId(isExpanded ? null : log.ID)} // Toggle
                        >
                            <div className="timeline-connector">
                                <div className={`timeline-dot ${log.ContextType.includes('Progressed') ? 'dot-active' : ''}`}>
                                    {getContextIcon(log.ContextType)}
                                </div>
                                {index !== filteredLogs.length - 1 && (
                                    <div className={`timeline-line ${log.ContextType.includes('Progressed') ? 'line-active' : ''}`}></div>
                                )}
                            </div>

                            <div className="timeline-content">
                                <div className="timeline-time-row">
                                    <span className="timeline-timestamp">
                                        <Clock size={12} style={{ marginRight: '4px' }} />
                                        {new Date(log.Timestamp).toLocaleString('en-PH')}
                                    </span>
                                    <span className="timeline-context-tag">{log.ContextType}</span>
                                </div>
                                
                                <div className="timeline-action-text">{log.Action}</div>
                                
                                {/* Always rendered in the DOM, transition managed via class name toggle */}
                                <div 
                                    className={`timeline-expanded-details ${isExpanded ? 'show' : 'hide'}`} 
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <div className="details-header">Snapshot of OE Data during this log:</div>
                                    {renderJsonDetails(log.json_data)}
                                </div>

                                <div className="timeline-footer">Updated by: <strong>{log.Name}</strong></div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default TripTimeline;