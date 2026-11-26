import { useEffect, useState } from 'react';
import Icon from './Icon';
import { Button } from './ui';

const DOT = { ok: 'bg-emerald-600', warn: 'bg-amber-500', bad: 'bg-red-600', idle: 'bg-stone-400' };

function Row({ label, tone, value }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 text-sm">
      <span>{label}</span>
      <span className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${DOT[tone]}`} aria-hidden="true" />
        {value}
      </span>
    </div>
  );
}

function timeAgo(date, now) {
  if (!date) return 'not yet';
  const s = Math.max(0, Math.round((now - date) / 1000));
  if (s < 10) return 'just now';
  if (s < 60) return `${s} seconds ago`;
  const m = Math.round(s / 60);
  return m === 1 ? '1 minute ago' : `${m} minutes ago`;
}

export default function StatusPage({ healthData, healthLoading, healthError, isHealthy, isServerWakingUp, lastChecked, onCheck }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(id);
  }, []);

  const server = healthLoading
    ? isServerWakingUp
      ? { tone: 'warn', value: 'Waking up' }
      : { tone: 'idle', value: 'Checking…' }
    : healthData
    ? { tone: 'ok', value: 'Ready' } // the server answered, even if the database did not
    : { tone: 'bad', value: 'Unavailable' };

  const database = healthLoading
    ? { tone: 'idle', value: 'Checking…' }
    : healthData?.database === 'connected'
    ? { tone: 'ok', value: 'Connected' }
    : { tone: 'bad', value: 'Unavailable' };

  return (
    <div className="max-w-lg">
      <h1 className="text-xl font-semibold tracking-tight">System status</h1>
      <p className="mt-1 text-sm text-muted">Whether the app can reach its server and database.</p>

      <div className="mt-6 divide-y divide-line rounded-lg border border-line bg-white">
        <Row label="Server" {...server} />
        <Row label="Database" {...database} />
      </div>

      {!healthLoading && !isHealthy && healthError && (
        <p className="mt-3 text-[13px] text-red-800">{healthError}</p>
      )}

      <div className="mt-4 flex items-center justify-between">
        <p className="text-[13px] text-muted">Last checked {timeAgo(lastChecked, now)}</p>
        <Button size="sm" onClick={onCheck} disabled={healthLoading}>
          <Icon name="refresh" className={`h-3.5 w-3.5 ${healthLoading ? 'animate-spin' : ''}`} />
          Check again
        </Button>
      </div>
    </div>
  );
}
