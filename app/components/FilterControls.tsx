import React from 'react';

interface FilterControlsProps {
  cutoff: number;
  onCutoffChange: (value: number) => void;
}

const FilterControls: React.FC<FilterControlsProps> = ({ cutoff, onCutoffChange }) => {
  return (
    <div className="flex flex-col gap-2 p-4 bg-base-200 rounded-lg">
      <div className="flex justify-between items-center">
        <label className="text-sm font-medium">Filter Cutoff</label>
        <span className="text-sm text-base-content/70">{Math.round(cutoff)} Hz</span>
      </div>
      <input
        type="range"
        min="20"
        max="20000"
        value={cutoff}
        onChange={(e) => onCutoffChange(Number(e.target.value))}
        className="range range-primary"
        step="1"
      />
      <div className="flex justify-between text-xs text-base-content/50">
        <span>20 Hz</span>
        <span>20 kHz</span>
      </div>
    </div>
  );
};

export default FilterControls; 