// Minimal outline icon set (Lucide-style paths, 24x24, 2px stroke).
const ICONS = {
  plus: ['M12 5v14', 'M5 12h14'],
  search: [{ circle: [11, 11, 7] }, 'm20 20-3.5-3.5'],
  copy: [
    { rect: [9, 9, 12, 12, 2] },
    'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1',
  ],
  refresh: ['M21 12a9 9 0 1 1-3-6.7L21 8', 'M21 3v5h-5'],
  trash: [
    'M3 6h18',
    'M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6',
    'M10 11v6',
    'M14 11v6',
    'M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2',
  ],
  chevronDown: ['m6 9 6 6 6-6'],
  menu: ['M4 6h16', 'M4 12h16', 'M4 18h16'],
  x: ['M18 6 6 18', 'M6 6l12 12'],
  check: ['M20 6 9 17l-5-5'],
  pencil: ['M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z'],
  alert: [
    'M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
    'M12 9v4',
    'M12 17h.01',
  ],
  info: [{ circle: [12, 12, 9] }, 'M12 16v-4', 'M12 8h.01'],
};

export default function Icon({ name, className = 'h-4 w-4' }) {
  const parts = ICONS[name] || [];
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
      aria-hidden="true"
    >
      {parts.map((part, i) => {
        if (typeof part === 'string') return <path key={i} d={part} />;
        if (part.circle) {
          const [cx, cy, r] = part.circle;
          return <circle key={i} cx={cx} cy={cy} r={r} />;
        }
        const [x, y, w, h, rx] = part.rect;
        return <rect key={i} x={x} y={y} width={w} height={h} rx={rx} />;
      })}
    </svg>
  );
}
