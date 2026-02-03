import React from 'react';

interface ResourceBarProps {
  label: string;
  used: number;
  total: number;
  className?: string;
}

export const ResourceBar: React.FC<ResourceBarProps> = ({ label, used, total, className = '' }) => {
  const percentage = Math.round((used / total) * 100);

  const getBarColor = (percent: number): string => {
    if (percent >= 80) return 'bg-red-500';
    if (percent >= 60) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <div className={`w-full ${className}`}>
      <div className="flex justify-between mb-1">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <span className="text-sm text-gray-600">
          {used.toFixed(1)} / {total.toFixed(1)} GB
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all ${getBarColor(percentage)}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <p className="text-xs text-gray-500 mt-1">{percentage}% used</p>
    </div>
  );
};
