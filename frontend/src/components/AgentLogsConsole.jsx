import { useEffect, useRef, useState } from 'react';
import Icon from './Icon';
import { Button } from './ui';
import { STAGE_LABEL, logStage } from '../lib/product';

const FILTERS = ['all', 'understanding', 'strategy', 'writing'];

// Collapsed "Show what's happening" panel with the execution logs from all steps.
export default function AgentLogsConsole({ logs = [], isExecuting = false, onClearLogs }) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('all');
  const listRef = useRef(null);

  // Open automatically while something is running so progress stays visible.
  useEffect(() => {
    if (isExecuting) setOpen(true);
  }, [isExecuting]);

  useEffect(() => {
    if (open && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [logs, open]);

  const visible = filter === 'all' ? logs : logs.filter((l) => logStage(l.agent) === filter);

  const copyLogs = () => {
    const text = visible
      .map((l) => `[${new Date(l.timestamp).toLocaleTimeString()}] [${l.agent}] [${l.stage}] ${l.message}`)
      .join('\n');
    navigator.clipboard?.writeText(text);
  };

  const levelColor = (level) =>
    level === 'ERROR' ? 'text-red-700' : level === 'WARN' ? 'text-amber-800' : 'text-ink';

  return (
    <section className="border-t border-line pt-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between text-left text-[13px] text-muted hover:text-ink"
      >
        <span className="flex items-center gap-1.5">
          <Icon name="chevronDown" className={`h-4 w-4 transition-transform ${open ? '' : '-rotate-90'}`} />
          {open ? 'Hide what happened' : 'Show what happened'}
        </span>
        {logs.length > 0 && <span className="tabular-nums">{logs.length} steps</span>}
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-1">
              {FILTERS.map((f) => (
                <button
                  key={f}
                  type="button"
                  aria-pressed={filter === f}
                  onClick={() => setFilter(f)}
                  className={`rounded px-2 py-1 text-xs ${
                    filter === f ? 'bg-stone-100 font-medium text-ink' : 'text-muted hover:text-ink'
                  }`}
                >
                  {f === 'all' ? 'All' : STAGE_LABEL[f]}
                </button>
              ))}
            </div>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={copyLogs} disabled={visible.length === 0}>
                Copy
              </Button>
              <Button size="sm" variant="ghost" onClick={onClearLogs} disabled={logs.length === 0}>
                Clear
              </Button>
            </div>
          </div>

          <ol ref={listRef} className="max-h-72 overflow-y-auto rounded-md border border-line bg-white" aria-live="polite">
            {visible.length === 0 ? (
              <li className="px-3 py-4 text-[13px] text-muted">Nothing yet. Steps appear here while listings are created.</li>
            ) : (
              visible.map((entry, i) => (
                <li key={i} className="grid grid-cols-[4.5rem_6.5rem_1fr] gap-2 border-b border-line px-3 py-1.5 text-xs last:border-b-0">
                  <span className="tabular-nums text-muted">
                    {entry.timestamp
                      ? new Date(entry.timestamp).toLocaleTimeString([], { hour12: false })
                      : '--:--:--'}
                  </span>
                  <span className="text-muted">{STAGE_LABEL[logStage(entry.agent)]}</span>
                  <span className={`break-words ${levelColor(entry.level)}`}>{entry.message}</span>
                </li>
              ))
            )}
            {isExecuting && (
              <li className="px-3 py-1.5 text-xs text-muted">Working…</li>
            )}
          </ol>
        </div>
      )}
    </section>
  );
}
