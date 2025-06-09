import { FC } from "react";

interface InstrumentCardProps {
  label: string;
  swingAmount: number;
  isRandomizing: boolean;
  isPlaying: boolean;
  onSwingChange: (value: number) => void;
  onRandomize: () => void;
}

const InstrumentCard: FC<InstrumentCardProps> = ({
  label,
  swingAmount,
  isRandomizing,
  isPlaying,
  onSwingChange,
  onRandomize,
}) => {
  return (
    <div className="card bg-base-100 shadow-xl h-full">
      <div className="card-body p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="card-title text-base-content text-lg">{label}</h2>
          <button
            onClick={onRandomize}
            disabled={isPlaying}
            className={`btn btn-sm ${
              isRandomizing ? "btn-primary" : "btn-ghost"
            }`}
          >
            {isRandomizing ? "Randomizing..." : "Randomize"}
          </button>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label
              htmlFor={`swing-${label}`}
              className="text-sm font-medium text-base-content"
            >
              Swing
            </label>
            <span className="text-sm text-base-content/70">{swingAmount}%</span>
          </div>
          <input
            type="range"
            id={`swing-${label}`}
            min="0"
            max="100"
            value={swingAmount}
            onChange={(e) => onSwingChange(parseInt(e.target.value))}
            className="range range-secondary range-sm"
          />
        </div>
      </div>
    </div>
  );
};

export default InstrumentCard; 