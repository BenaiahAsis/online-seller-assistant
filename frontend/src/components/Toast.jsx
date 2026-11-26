import { useEffect } from 'react';
import Icon from './Icon';

// Bottom-right message. Success/info messages close themselves; errors stay until dismissed.
export default function Toast({ notification, onDismiss }) {
  useEffect(() => {
    if (!notification || notification.type === 'error') return undefined;
    const id = setTimeout(onDismiss, 4000);
    return () => clearTimeout(id);
  }, [notification, onDismiss]);

  if (!notification) return null;
  const isError = notification.type === 'error';

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4 sm:justify-end sm:px-6">
      <div
        role={isError ? 'alert' : 'status'}
        className={`pointer-events-auto flex max-w-md items-start gap-2.5 rounded-md px-3.5 py-2.5 text-[13px] shadow-lg ${
          isError ? 'bg-red-800 text-white' : 'bg-ink text-white'
        }`}
      >
        <Icon name={isError ? 'alert' : 'check'} className="mt-0.5 h-4 w-4" />
        <span className="flex-1">{notification.message}</span>
        <button type="button" onClick={onDismiss} aria-label="Dismiss" className="-mr-1 rounded p-0.5 opacity-70 hover:opacity-100">
          <Icon name="x" className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
