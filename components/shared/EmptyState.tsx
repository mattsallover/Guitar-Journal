import React from 'react';
import { Button } from './Button';

interface EmptyStateProps {
  icon: string;
  title: string;
  description: string;
  primaryAction?: {
    label: string;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  primaryAction,
  secondaryAction
}) => {
  return (
    <div className="bg-surface p-12 rounded-lg text-center border-2 border-dashed border-border">
      <div className="text-6xl mb-6">{icon}</div>
      <h2 className="text-2xl font-bold text-text-primary mb-3">{title}</h2>
      <p className="text-text-secondary text-lg mb-6 max-w-md mx-auto">
        {description}
      </p>
      {(primaryAction || secondaryAction) && (
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {primaryAction && (
            <Button onClick={primaryAction.onClick}>
              {primaryAction.label}
            </Button>
          )}
          {secondaryAction && (
            <Button variant="secondary" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
};