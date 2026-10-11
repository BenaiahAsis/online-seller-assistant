import { useState, useEffect, useCallback } from 'react';

export default function App() {
  const [healthData, setHealthData] = useState(null);
  const [statusCode, setStatusCode] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastChecked, setLastChecked] = useState(null);

  const rawApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
  const apiUrl = rawApiUrl.replace(/\/+$/, '');
  const healthEndpoint = `${apiUrl}/health`;

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(healthEndpoint, {
        headers: {
          'Accept': 'application/json',
        },
      });
      setStatusCode(response.status);
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setHealthData(data);
        setError(data?.error || `Backend responded with HTTP status ${response.status}`);
      } else {
        setHealthData(data);
        setError(null);
      }
    } catch (err) {
      setStatusCode(null);
      setHealthData(null);
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to connect to backend service. Check network or server status.'
      );
    } finally {
      setLoading(false);
      setLastChecked(new Date().toLocaleTimeString());
    }
  }, [healthEndpoint]);

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  const isHealthy = statusCode === 200 && healthData?.status === 'healthy';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 font-sans">
      <div className="w-full max-w-3xl space-y-6">
        {/* Header */}
        <header className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></span>
            Online Seller Assistant
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
            System Health Monitor
          </h1>
          <p className="text-sm text-slate-400">
            Vite + React frontend monitoring FastAPI backend & PostgreSQL health
          </p>
        </header>

        {/* Configuration Card */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 sm:p-5 shadow-lg backdrop-blur">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs sm:text-sm">
            <div>
              <span className="text-slate-400 font-medium">Target Health URL:</span>{' '}
              <code className="text-indigo-300 bg-slate-950 px-2 py-1 rounded border border-slate-800 break-all">
                {healthEndpoint}
              </code>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Last checked:</span>
              <span className="text-slate-200 font-mono">
                {lastChecked || 'Never'}
              </span>
            </div>
          </div>
        </div>

        {/* Status Highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Service Status */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-1">
            <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
              Backend Status
            </p>
            <div className="flex items-center gap-2 pt-1">
              <span
                className={`w-3 h-3 rounded-full ${
                  loading
                    ? 'bg-amber-400 animate-ping'
                    : isHealthy
                    ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]'
                    : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]'
                }`}
              />
              <span className="text-base font-semibold text-white">
                {loading
                  ? 'Checking...'
                  : isHealthy
                  ? 'Healthy (200 OK)'
                  : statusCode
                  ? `Error (${statusCode})`
                  : 'Offline'}
              </span>
            </div>
          </div>

          {/* Database Status */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-1">
            <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
              PostgreSQL (SELECT 1)
            </p>
            <div className="flex items-center gap-2 pt-1">
              <span
                className={`w-3 h-3 rounded-full ${
                  loading
                    ? 'bg-amber-400'
                    : healthData?.database === 'connected'
                    ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]'
                    : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]'
                }`}
              />
              <span className="text-base font-semibold text-white">
                {loading
                  ? 'Verifying...'
                  : healthData?.database === 'connected'
                  ? 'Connected'
                  : 'Disconnected'}
              </span>
            </div>
          </div>

          {/* Refresh Action */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-center">
            <button
              onClick={fetchHealth}
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-md shadow-indigo-600/20"
            >
              {loading ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-1 h-4 w-4 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Checking...
                </>
              ) : (
                <>
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  Re-check Health
                </>
              )}
            </button>
          </div>
        </div>

        {/* Error Alert Box */}
        {error && (
          <div className="bg-rose-950/40 border border-rose-800/60 rounded-xl p-4 text-rose-200 text-sm space-y-1">
            <div className="flex items-center gap-2 font-semibold text-rose-300">
              <svg
                className="w-5 h-5 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <span>Connection Warning</span>
            </div>
            <p className="font-mono text-xs text-rose-300/90 break-words pl-7">
              {error}
            </p>
          </div>
        )}

        {/* Detailed Response Payload */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
              Raw Response Payload
            </span>
            {statusCode && (
              <span
                className={`text-xs px-2 py-0.5 rounded font-mono font-medium ${
                  statusCode === 200
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                }`}
              >
                HTTP {statusCode}
              </span>
            )}
          </div>
          <pre className="bg-slate-950 rounded-lg p-4 font-mono text-xs sm:text-sm text-slate-300 overflow-x-auto border border-slate-800/80">
            {healthData
              ? JSON.stringify(healthData, null, 2)
              : error
              ? JSON.stringify({ error, target: healthEndpoint }, null, 2)
              : '// Waiting for response...'}
          </pre>
        </div>

        {/* Quick Troubleshooting Footer */}
        <footer className="text-center text-xs text-slate-500 space-y-1">
          <p>
            Ensure backend is running (<code className="text-slate-400 font-mono">uvicorn app.main:app --reload</code>)
            and <code className="text-slate-400 font-mono">DATABASE_URL</code> is reachable.
          </p>
          <p>DevOps University Project &bull; Online Seller Assistant</p>
        </footer>
      </div>
    </div>
  );
}
