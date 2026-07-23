import React from 'react';

export interface GradientRadioOption {
    label: string;
    value: string;
    disabled?: boolean; // Option-level control
}

interface GradientRadioGroupProps {
    name: string;
    options: GradientRadioOption[];
    value: string;
    onChange: (value: string) => void;
    className?: string;
    style?: React.CSSProperties;
    disabled?: boolean; // Group-level control
}

const GradientRadioGroup: React.FC<GradientRadioGroupProps> = ({
    name,
    options,
    value,
    onChange,
    className = '',
    style = {},
    disabled = false, // Defaults to enabled
}) => {
    return (
        <div style={{ display: 'flex', gap: '1rem', ...style }} className={`${className} ${disabled ? 'group-disabled' : ''}`}>
            {options.map((option) => {
                // An option is disabled if either the group is disabled or the option itself is marked disabled
                const isDisabled = disabled || option.disabled;

                return (
                    <label 
                        className={`gradient-radio-container ${isDisabled ? 'disabled' : ''}`} 
                        key={option.value}
                    >
                        <input
                            type="radio"
                            name={name}
                            value={option.value}
                            checked={value === option.value}
                            disabled={isDisabled} // Passes native disabled attribute to the input
                            onChange={() => !isDisabled && onChange(option.value)} // Safe fallback guard
                        />
                        <div className="radio-gradient-outline">
                            <div className="radio-inner-circle"></div>
                        </div>
                        <span>{option.label}</span>
                    </label>
                );
            })}
        </div>
    );
};

export default GradientRadioGroup;