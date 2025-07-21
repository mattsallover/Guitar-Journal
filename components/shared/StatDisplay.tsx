import React from 'react';

interface StatProps {
  value: string | number;
  label: string;
  color?: 'primary' | 'green' | 'yellow' | 'red';
  size?: 'sm' | 'md' | 'lg';
}

export const Stat: React.FC<StatProps> = ({
  value,
  label,
  color = 'primary',
  size = 'md'
}) => {
  const colorClasses = {
    primary: 'text-primary',
    green: 'text-green-400',
    yellow: 'text-yellow-400',
    red: 'text-red-400'
  };

  const sizeClasses = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-3xl'
  };

  return (
    <div className="text-center">
      <div className={`${sizeClasses[size]} font-bold ${colorClasses[color]}`}>
        {value}
      </div>
      <div className="text-sm text-text-secondary">{label}</div>
    </div>
  );
};

interface StatGridProps {
  children: React.ReactNode;
  columns?: 2 | 3 | 4;
}

export const StatGrid: React.FC<StatGridProps> = ({ children, columns = 4 }) => {
  const gridClasses = {
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-2 md:grid-cols-4'
  };

  return (
    <div className={`grid ${gridClasses[columns]} gap-4`}>
      {children}
    </div>
  );
};