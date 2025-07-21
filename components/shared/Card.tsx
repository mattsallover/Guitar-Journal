import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({ 
  children, 
  className = '', 
  hover = true, 
  onClick 
}) => {
  return (
    <div 
      className={`
        bg-surface rounded-lg p-4 transition-all duration-300
        ${hover ? 'hover:shadow-lg hover:scale-[1.01] group' : ''}
        ${onClick ? 'cursor-pointer' : ''}
        ${className}
      `}
      onClick={onClick}
    >
      {children}
    </div>
  );
};

interface CardHeaderProps {
  title: string;
  subtitle?: string;
  badge?: string;
  actions?: React.ReactNode;
}

export const CardHeader: React.FC<CardHeaderProps> = ({
  title,
  subtitle,
  badge,
  actions
}) => {
  return (
    <div className="flex justify-between items-start mb-3">
      <div className="flex-1">
        <div className="flex items-center space-x-2 mb-1">
          <h3 className="text-xl font-semibold text-text-primary">{title}</h3>
          {badge && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-primary/20 text-primary">
              {badge}
            </span>
          )}
        </div>
        {subtitle && (
          <p className="text-text-secondary text-base">{subtitle}</p>
        )}
      </div>
      {actions && (
        <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          {actions}
        </div>
      )}
    </div>
  );
};

interface CardProgressProps {
  value: number;
  label?: string;
  color?: 'red' | 'yellow' | 'green';
}

export const CardProgress: React.FC<CardProgressProps> = ({
  value,
  label,
  color
}) => {
  const getColor = () => {
    if (color) {
      return {
        red: 'bg-red-500',
        yellow: 'bg-yellow-500',
        green: 'bg-green-500'
      }[color];
    }
    
    if (value < 33) return 'bg-red-500';
    if (value < 66) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <div className="mt-2">
      <div className="w-full bg-background rounded-full h-2.5">
        <div 
          className={`${getColor()} h-2.5 rounded-full transition-all duration-500`} 
          style={{width: `${value}%`}}
        ></div>
      </div>
      <p className="text-xs text-left mt-1">
        {label || `${value}%`}
      </p>
    </div>
  );
};