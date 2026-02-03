import React from 'react';
import { Button } from './Button';

interface DisplayControlProps {
  onOpenDisplay: () => void;
  status: 'stopped' | 'running' | 'paused';
}

export const DisplayControl: React.FC<DisplayControlProps> = ({
  onOpenDisplay,
  status,
}) => {
  const isDisabled = status === 'stopped';

  return (
    <Button
      onClick={onOpenDisplay}
      disabled={isDisabled}
      variant="primary"
      aria-label="Open Display"
    >
      Open Display
    </Button>
  );
};
