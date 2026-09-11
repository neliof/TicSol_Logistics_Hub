import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastProps {
  toast: ToastMessage;
  onClose: (id: string) => void;
}

const Toast: React.FC<ToastProps> = ({ toast, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => onClose(toast.id), 4000);
    return () => clearTimeout(timer);
  }, [toast.id, onClose]);

  const bgColor = {
    success: 'bg-emerald-50 border-emerald-200',
    error: 'bg-rose-50 border-rose-200',
    info: 'bg-blue-50 border-blue-200'
  }[toast.type];

  const textColor = {
    success: 'text-emerald-800',
    error: 'text-rose-800',
    info: 'text-blue-800'
  }[toast.type];

  const Icon = {
    success: CheckCircle2,
    error: AlertCircle,
    info: Info
  }[toast.type];

  const iconColor = {
    success: 'text-emerald-600',
    error: 'text-rose-600',
    info: 'text-blue-600'
  }[toast.type];

  return (
    <div className={`${bgColor} ${textColor} border rounded-lg p-4 flex items-start gap-3 shadow-lg animate-in fade-in slide-in-from-right-4 duration-300`}>
      <Icon className={`${iconColor} w-5 h-5 shrink-0 mt-0.5`} />
      <div className="flex-1 text-sm font-medium">{toast.message}</div>
      <button
        onClick={() => onClose(toast.id)}
        className="text-current opacity-50 hover:opacity-100 transition-opacity shrink-0"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

interface ToastContainerProps {
  toasts: ToastMessage[];
  onClose: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onClose }) => {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 pointer-events-none">
      {toasts.map(toast => (
        <div key={toast.id} className="pointer-events-auto">
          <Toast toast={toast} onClose={onClose} />
        </div>
      ))}
    </div>
  );
};
