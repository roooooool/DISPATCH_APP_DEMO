import React from 'react';

export interface GradientRadioOption {
    label: string;
    value: string;
}

interface GradientRadioGroupProps {
    name: string;
    options: GradientRadioOption[];
    value: string;
    onChange: (value: string) => void;
    className?: string;
    style?: React.CSSProperties;
}

const GradientRadioGroup: React.FC<GradientRadioGroupProps> = ({
    name,
    options,
    value,
    onChange,
    className = '',
    style = {},
}) => {
    return (
        <div style={{ display: 'flex', gap: '1rem', ...style }} className={className}>
            {options.map((option) => (
                <label className="gradient-radio-container" key={option.value}>
                    <input
                        type="radio"
                        name={name}
                        value={option.value}
                        checked={value === option.value}
                        onChange={() => onChange(option.value)}
                    />
                    <div className="radio-gradient-outline">
                        <div className="radio-inner-circle"></div>
                    </div>
                    <span>{option.label}</span>
                </label>
            ))}
        </div>
    );
};

export default GradientRadioGroup;
