import React, { useState } from 'react';
import { User, Users, Truck, Train as TrailerIcon, Save, Trash2, RefreshCcw } from 'lucide-react';
import SearchableDropdown, { type DropdownOption } from './SearchableDropdown';
import './comp_css/FleePairManager.css';

interface FleetPairManagerProps {
    initialPairing?: any;
    onSave: (pair: any) => void;
    onDelete?: (id: number) => void;
}

const FleetPairManager: React.FC<FleetPairManagerProps> = ({ initialPairing, onSave, onDelete }) => {
    const [pair, setPair] = useState({
        Driver: initialPairing?.Driver || '',
        Helper: initialPairing?.Helper || '',
        Truck: initialPairing?.Truck || '',
        Trailer: initialPairing?.Trailer || '',
        ID: initialPairing?.ID || null
    });

    // Mock Options - In production, fetch these from your Services
    const driverOptions: DropdownOption[] = [
        { value: 'John Doe', label: 'John Doe', type: 'card', cardConfig: [[{label: 'ID', value: 'EMP-001'}, {label: 'License', value: 'Prof'}]] },
        { value: 'Jane Smith', label: 'Jane Smith', type: 'card', cardConfig: [[{label: 'ID', value: 'EMP-002'}, {label: 'License', value: 'Prof'}]] },
    ];

    const truckOptions: DropdownOption[] = [
        { value: 'T-101', label: 'T-101', type: 'card', cardConfig: [[{label: 'Plate', value: 'ABC-123'}, {label: 'Type', value: '10W'}]] },
        { value: 'T-102', label: 'T-102', type: 'card', cardConfig: [[{label: 'Plate', value: 'XYZ-789'}, {label: 'Type', value: '6W'}]] },
    ];

    const handleChange = (field: string, value: string | string[]) => {
        setPair(prev => ({ ...prev, [field]: value }));
    };

    const isNew = !pair.ID;

    return (
        <div className="pair-manager-container">
            <div className="pair-manager-header">
                <h3>{isNew ? 'Create New Fleet Pair' : 'Edit Fleet Assignment'}</h3>
                {!isNew && <span className="pair-id-badge">ID: {pair.ID}</span>}
            </div>

            <div className="pair-grid">
                {/* Personnel Group */}
                <div className="pair-section">
                    <h4 className="section-title"><Users size={16} /> Personnel</h4>
                    <div className="pair-slot">
                        <label><User size={14} /> Driver</label>
                        <SearchableDropdown 
                            value={pair.Driver} 
                            options={driverOptions}
                            onChange={(val) => handleChange('Driver', val)}
                            placeholder="Select Driver..."
                        />
                    </div>
                    <div className="pair-slot">
                        <label><Users size={14} /> Helper</label>
                        <SearchableDropdown 
                            value={pair.Helper} 
                            options={driverOptions} // Usually same list
                            onChange={(val) => handleChange('Helper', val)}
                            placeholder="Select Helper..."
                        />
                    </div>
                </div>

                {/* Equipment Group */}
                <div className="pair-section">
                    <h4 className="section-title"><Truck size={16} /> Equipment</h4>
                    <div className="pair-slot">
                        <label><Truck size={14} /> Truck (Head)</label>
                        <SearchableDropdown 
                            value={pair.Truck} 
                            options={truckOptions}
                            onChange={(val) => handleChange('Truck', val)}
                            placeholder="Select Truck..."
                        />
                    </div>
                    <div className="pair-slot">
                        <label><TrailerIcon size={14} /> Trailer</label>
                        <SearchableDropdown 
                            value={pair.Trailer} 
                            options={[]} // Add trailer options here
                            onChange={(val) => handleChange('Trailer', val)}
                            placeholder="Select Trailer..."
                        />
                    </div>
                </div>
            </div>

            <div className="pair-manager-footer">
                {!isNew && onDelete && (
                    <button className="btn-danger-outline" onClick={() => onDelete(pair.ID)}>
                        <Trash2 size={18} /> Break Pairing
                    </button>
                )}
                <div className="footer-right">
                    <button className="btn-secondary" onClick={() => setPair({ Driver: '', Helper: '', Truck: '', Trailer: '', ID: null })}>
                        <RefreshCcw size={18} /> Reset
                    </button>
                    <button className="btn-primary-gradient" onClick={() => onSave(pair)}>
                        <Save size={18} /> {isNew ? 'Create Pair' : 'Update Assignment'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default FleetPairManager;