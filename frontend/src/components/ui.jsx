import Icon from './Icon';
import { STATUS_LABEL } from '../lib/product';

const BUTTON_VARIANTS = {
  primary: 'bg-accent text-white hover:bg-accent-hover',
  secondary: 'border border-line bg-white text-ink hover:bg-stone-50',
  ghost: 'text-muted hover:bg-stone-100 hover:text-ink',
  danger: 'text-red-700 hover:bg-red-50',
};

const BUTTON_SIZES = {
  sm: 'h-8 px-2.5 text-[13px]',
  md: 'h-9 px-3.5 text-sm',
  lg: 'h-11 px-4 text-sm',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  className = '',
  type = 'button',
  ...props
}) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${BUTTON_VARIANTS[variant]} ${BUTTON_SIZES[size]} ${className}`}
      {...props}
    />
  );
}

export function Spinner({ className = 'h-4 w-4' }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

const NOTICE_TONES = {
  warning: { box: 'border-amber-200 bg-amber-50 text-amber-900', icon: 'alert', iconColor: 'text-amber-700' },
  error: { box: 'border-red-200 bg-red-50 text-red-900', icon: 'alert', iconColor: 'text-red-700' },
  info: { box: 'border-line bg-stone-50 text-ink', icon: 'info', iconColor: 'text-muted' },
};

export function Notice({ tone = 'info', title, children, role }) {
  const t = NOTICE_TONES[tone];
  return (
    <div role={role} className={`flex gap-2.5 rounded-md border px-3 py-2.5 text-[13px] leading-relaxed ${t.box}`}>
      <Icon name={t.icon} className={`mt-0.5 h-4 w-4 ${t.iconColor}`} />
      <div className="min-w-0 flex-1">
        {title && <p className="font-medium">{title}</p>}
        {children}
      </div>
    </div>
  );
}

const STATUS_STYLES = {
  ready: 'bg-emerald-50 text-emerald-800',
  analyzed: 'bg-stone-100 text-stone-700',
  draft: 'bg-amber-50 text-amber-800',
};

export function StatusLabel({ status }) {
  if (!status) return null;
  return (
    <span className={`inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

// Light segmented switch for choosing between peer views (e.g. platforms).
export function SegmentedControl({ options, value, onChange, label }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-md border border-line bg-stone-50 p-0.5">
      {options.map((opt) => {
        const active = opt.id === value;
        return (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.id)}
            className={`whitespace-nowrap rounded px-3 py-1.5 text-[13px] font-medium transition-colors ${
              active ? 'bg-white text-ink shadow-[0_0_0_1px_theme(colors.line)]' : 'text-muted hover:text-ink'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export function SectionHeading({ children, action }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-3">
      <h3 className="text-sm font-semibold text-ink">{children}</h3>
      {action}
    </div>
  );
}

export function CopyButton({ onClick, label = 'Copy', ariaLabel }) {
  return (
    <Button variant="ghost" size="sm" onClick={onClick} aria-label={ariaLabel}>
      <Icon name="copy" className="h-3.5 w-3.5" />
      {label}
    </Button>
  );
}
