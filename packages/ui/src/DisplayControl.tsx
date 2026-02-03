import React from 'react';
import { Button } from './Button';
import { VMStatus } from '@openutm/shared-types';

interface DisplayControlProps {
  onOpenDisplay: () => void;
  status: VMStatus;
}

export const DisplayControl: React.FC<DisplayControlProps> = ({
  onOpenDisplay,
  status,
}) => {
  const isDisabled = status === VMStatus.Stopped;

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
