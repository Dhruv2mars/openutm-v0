import React from 'react';
import { Button } from './Button';
import { VMStatus } from '@openutm/shared-types';

interface DisplayControlProps {
  onOpenDisplay: () => void;
  status: VMStatus;
  disabled?: boolean;
  disabledReason?: string;
}

export const DisplayControl: React.FC<DisplayControlProps> = ({
  onOpenDisplay,
  status,
  disabled = false,
  disabledReason,
}) => {
  const isDisabled = status === VMStatus.Stopped || disabled;

  return (
    <Button
      onClick={onOpenDisplay}
      disabled={isDisabled}
      title={isDisabled ? disabledReason : undefined}
      variant="primary"
      aria-label="Open Display"
    >
      Open Display
    </Button>
  );
};
