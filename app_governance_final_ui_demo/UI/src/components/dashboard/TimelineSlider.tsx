import { useState } from 'react';

interface TimelineSliderProps {
  value: string;
  onChange: (value: string) => void;
}

export function TimelineSlider({ value, onChange }: TimelineSliderProps) {
  const [isDragging, setIsDragging] = useState(false);

  const numValue = parseInt(value) || 7;
  const min = 1;
  const max = 90;

  const percentage = ((numValue - min) / (max - min)) * 100;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  const handleMouseDown = () => {
    setIsDragging(true);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <div className="flex-grow min-w-[230px] max-w-[280px]">
      <div className="flex items-center justify-between mb-2">
        <label className="block text-gray-900 mb-2 text-md">
          Timeline
        </label>
        <span className="text-blue-600 font-semibold text-sm">
          {numValue} {numValue === 1 ? 'Day' : 'Days'}
        </span>
      </div>

      <div className="relative pt-2 px-2">
        {/* Track */}
        <div className="relative h-1.5 bg-gray-200 rounded-full">
          {/* Progress */}
          <div
            className="absolute h-full bg-linear-to-r from-gradient-primary-start to-gradient-primary-end rounded-full transition-all"
            style={{ width: `${percentage}%` }}
          />

          {/* Thumb */}
          <div
            className={`absolute top-1/2 -translate-y-1/2 w-5 h-5 bg-secondary rounded-full shadow-md transition-all cursor-pointer ${isDragging ? 'scale-125 shadow-lg' : 'hover:scale-110'
              }`}
            style={{ left: `calc(${percentage}% - 10px)` }}
          />
        </div>

        {/* Hidden input */}
        <input
          type="range"
          min={min}
          max={max}
          value={numValue}
          onChange={handleChange}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onTouchStart={handleMouseDown}
          onTouchEnd={handleMouseUp}
          className="absolute top-2 left-0 right-0 w-full h-5 opacity-0 cursor-pointer z-10"
        />

        {/* Labels */}
        <div className="flex justify-between mt-3 text-xs text-gray-500">
          <span>1 Day</span>
          {/* <span>45 Days</span> */}
          <span>90 Days</span>
        </div>
      </div>
    </div>
  );
}