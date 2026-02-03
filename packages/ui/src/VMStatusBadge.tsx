import React from 'react';

export type VMStatus = 'stopped' | 'running' | 'paused' | 'error';

interface VMStatusBadgeProps {
  status: VMStatus;
  className?: string;
}

const statusColors: Record<VMStatus, string> = {
  stopped: 'bg-gray-100 text-gray-800',
  running: 'bg-green-100 text-green-800',
  paused: 'bg-yellow-100 text-yellow-800',
  error: 'bg-red-100 text-red-800',
};

const statusDotColors: Record<VMStatus, string> = {
  stopped: 'bg-gray-400',
  running: 'bg-green-500',
  paused: 'bg-yellow-500',
  error: 'bg-red-500',
};

export const VMStatusBadge: React.FC<VMStatusBadgeProps> = ({ status, className = '' }) => {
  const capitalStatus = status.charAt(0).toUpperCase() + status.slice(1);

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${statusColors[status]} ${className}`}>
      <div className={`w-2 h-2 rounded-full ${statusDotColors[status]}`} />
      {capitalStatus}
    </div>
  );
};
