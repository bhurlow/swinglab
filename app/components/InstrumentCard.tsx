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
    <div className="card bg-base-100 shadow-xl">
      <figure className="px-4 pt-4">
        <div className="w-full h-32 bg-base-300 rounded-lg flex items-center justify-center">
          <span className="text-4xl">🥁</span>
        </div>
      </figure>
      <div className="card-body">
        <h2 className="card-title text-base-content">{label}</h2>
        <div className="space-y-4">
          <div className="space-y-2">
            <label
              htmlFor={`swing-${label}`}
              className="block text-sm font-medium text-base-content"
            >
              Swing: {swingAmount}%
            </label>
            <input
              type="range"
              id={`swing-${label}`}
              min="0"
              max="100"
              value={swingAmount}
              onChange={(e) => onSwingChange(parseInt(e.target.value))}
              className="range range-secondary"
            />
          </div>
        </div>
        <div className="card-actions justify-end mt-4">
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
      </div>
    </div>
  );
};

export default InstrumentCard; 