import { useEffect } from 'react';

type ToastProps = {
  message: string;
  type?: 'success' | 'error' | 'info';
  onClose: () => void;
};

export function Toast({ message, type = 'success', onClose }: ToastProps) {
  useEffect(() => {
    const timer = window.setTimeout(onClose, 4200);
    return () => window.clearTimeout(timer);
  }, [message, onClose]);

  return (
    <div className={`toast toast-${type}`} role={type === 'error' ? 'alert' : 'status'}>
      <span>{message}</span>
      <button className="toast-close" type="button" onClick={onClose} aria-label="إغلاق التنبيه">
        ×
      </button>
    </div>
  );
}
