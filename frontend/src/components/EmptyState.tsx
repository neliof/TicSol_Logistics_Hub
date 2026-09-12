import React from 'react';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  compact?: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  action,
  compact = false,
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center ${
        compact ? 'py-8' : 'py-16'
      } px-4 text-center`}
    >
      <Icon
        className={`${
          compact ? 'w-12 h-12' : 'w-16 h-16'
        } text-slate-300 mb-4 opacity-60`}
      />
      <h3 className={`${compact ? 'text-sm' : 'text-lg'} font-semibold text-slate-700`}>
        {title}
      </h3>
      {description && (
        <p className={`${compact ? 'text-xs' : 'text-sm'} text-slate-500 mt-2 max-w-xs`}>
          {description}
        </p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className={`mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors ${
            compact ? 'text-xs py-1 px-3' : 'text-sm'
          }`}
        >
          {action.label}
        </button>
      )}
    </div>
  );
};
