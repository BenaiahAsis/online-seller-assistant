import { useState, useEffect, useRef } from 'react';

export default function AgentLogsConsole({
  logs = [],
  isExecuting = false,
  executingAgent = null, // 'Agent 1' | 'Agent 2' | 'Agent 3' | 'Pipeline'
  onClearLogs,
}) {
  const [filter, setFilter] = useState('ALL'); // 'ALL' | 'AGENT1' | 'AGENT2' | 'AGENT3'
  const [copied, setCopied] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);
  const scrollRef = useRef(null);

  // Auto-scroll to bottom as new logs arrive
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll, isExecuting]);

  const filteredLogs = logs.filter((log) => {
    if (filter === 'ALL') return true;
    const agent = log.agent || '';
    if (filter === 'AGENT1') return agent.includes('Agent 1');
    if (filter === 'AGENT2') return agent.includes('Agent 2');
    if (filter === 'AGENT3') return agent.includes('Agent 3');
    return true;
  });

  const agent1Count = logs.filter((l) => (l.agent || '').includes('Agent 1')).length;
  const agent2Count = logs.filter((l) => (l.agent || '').includes('Agent 2')).length;
  const agent3Count = logs.filter((l) => (l.agent || '').includes('Agent 3')).length;

  const handleCopyLogs = () => {
    const text = filteredLogs
      .map(
        (l) =>
          `[${new Date(l.timestamp).toLocaleTimeString()}] [${l.agent}] [${l.stage}] ${l.message}`
      )
      .join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getAgentBadge = (agent = '') => {
    if (agent.includes('Agent 1')) {
      return {
        bg: 'bg-purple-950/70 border-purple-700/60 text-purple-300',
        label: 'Agent 1 • Analyzer',
      };
    }
    if (agent.includes('Agent 2')) {
      return {
        bg: 'bg-amber-950/70 border-amber-700/60 text-amber-300',
        label: 'Agent 2 • Strategist',
      };
    }
    if (agent.includes('Agent 3')) {
      return {
        bg: 'bg-emerald-950/70 border-emerald-700/60 text-emerald-300',
        label: 'Agent 3 • Copywriter',
      };
    }
    return {
      bg: 'bg-slate-800 border-slate-700 text-slate-300',
      label: agent,
    };
  };

  const getStageBadge = (stage = '', level = 'INFO') => {
    if (level === 'SUCCESS' || stage === 'COMPLETE') {
      return 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
    }
    if (level === 'WARN') {
      return 'bg-amber-500/20 text-amber-300 border border-amber-500/30';
    }
    if (level === 'ERROR') {
      return 'bg-rose-500/20 text-rose-300 border border-rose-500/30';
    }
    if (stage.includes('PRICE')) {
      return 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30';
    }
    if (stage.includes('STRATEGY')) {
      return 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30';
    }
    if (stage.includes('GENERATE')) {
      return 'bg-teal-500/20 text-teal-300 border border-teal-500/30';
    }
    return 'bg-slate-800 text-slate-300 border border-slate-700';
  };

  return (
    <div className="bg-slate-950 border border-slate-200 rounded-2xl shadow-sm overflow-hidden font-mono transition-all">
      {/* Console Header Bar */}
      <div className="bg-slate-900/90 border-b border-slate-800 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block"></span>
            <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block"></span>
            <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block"></span>
          </div>
          <span className="text-xs font-bold text-slate-200 tracking-wide uppercase flex items-center gap-2">
            <span>Terminal</span>
            <span className="text-slate-500">&bull;</span>
            <span className="text-indigo-400">Autonomous Agent Execution Logs</span>
          </span>

          {isExecuting && (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              {executingAgent ? `Processing ${executingAgent}...` : 'Processing pipeline...'}
            </span>
          )}
        </div>

        {/* Console Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAutoScroll(!autoScroll)}
            aria-pressed={autoScroll}
            className={`px-2 py-1 rounded text-[11px] transition-colors ${
              autoScroll
                ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Auto-scroll on incoming logs"
          >
            Auto-scroll {autoScroll ? 'ON' : 'OFF'}
          </button>

          <button
            type="button"
            onClick={handleCopyLogs}
            disabled={filteredLogs.length === 0}
            className="px-2.5 py-1 rounded text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors disabled:opacity-40"
          >
            {copied ? '✓ Copied!' : '📋 Copy'}
          </button>

          {onClearLogs && (
            <button
              type="button"
              onClick={onClearLogs}
              disabled={logs.length === 0}
              className="px-2.5 py-1 rounded text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-rose-300 border border-slate-700 transition-colors disabled:opacity-40"
            >
              Clear
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsMinimized(!isMinimized)}
            aria-expanded={!isMinimized}
            className="px-2 py-1 rounded text-[11px] text-slate-400 hover:text-white"
          >
            {isMinimized ? 'Expand ▼' : 'Minimize ▲'}
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Agent Filter Tabs Bar */}
          <div className="bg-slate-900/50 border-b border-slate-800/80 px-4 py-2 flex items-center gap-2 overflow-x-auto text-xs">
            <span className="text-[11px] text-slate-500 font-semibold mr-1">Filter:</span>
            <button
              type="button"
              onClick={() => setFilter('ALL')}
              aria-pressed={filter === 'ALL'}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                filter === 'ALL'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 bg-slate-900 border border-slate-800'
              }`}
            >
              All Agents ({logs.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('AGENT1')}
              aria-pressed={filter === 'AGENT1'}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                filter === 'AGENT1'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-purple-300 bg-slate-900 border border-slate-800'
              }`}
            >
              Agent 1: Product Analyzer ({agent1Count})
            </button>
            <button
              type="button"
              onClick={() => setFilter('AGENT2')}
              aria-pressed={filter === 'AGENT2'}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                filter === 'AGENT2'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-amber-300 bg-slate-900 border border-slate-800'
              }`}
            >
              Agent 2: Market Strategist ({agent2Count})
            </button>
            <button
              type="button"
              onClick={() => setFilter('AGENT3')}
              aria-pressed={filter === 'AGENT3'}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                filter === 'AGENT3'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-emerald-300 bg-slate-900 border border-slate-800'
              }`}
            >
              Agent 3: Copywriter ({agent3Count})
            </button>
          </div>

          {/* Terminal Logs Output Stream */}
          <div
            ref={scrollRef}
            role="log"
            aria-live="polite"
            aria-label="Agent execution logs"
            className="p-4 h-64 overflow-y-auto space-y-2 text-xs leading-relaxed select-text"
          >
            {filteredLogs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 py-8 space-y-2">
                <span className="text-xl">⚡</span>
                <p>No execution logs yet.</p>
                <p className="text-[11px] text-slate-600">
                  Trigger Agent 1, Agent 2, Agent 3, or the Full Pipeline above to inspect live step-by-step processing.
                </p>
              </div>
            ) : (
              filteredLogs.map((entry, idx) => {
                const timeStr = entry.timestamp
                  ? new Date(entry.timestamp).toLocaleTimeString([], {
                      hour12: false,
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })
                  : '--:--:--';
                const agentBadge = getAgentBadge(entry.agent);
                const stageBadge = getStageBadge(entry.stage, entry.level);

                return (
                  <div
                    key={idx}
                    className="flex flex-col sm:flex-row sm:items-start gap-1.5 sm:gap-2.5 py-1 px-2 rounded hover:bg-slate-900/60 transition-colors"
                  >
                    {/* Timestamp */}
                    <span className="text-slate-500 text-[11px] whitespace-nowrap select-none font-mono">
                      {timeStr}
                    </span>

                    {/* Agent Pill */}
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded border whitespace-nowrap select-none ${agentBadge.bg}`}
                    >
                      {agentBadge.label}
                    </span>

                    {/* Stage Pill */}
                    <span
                      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase whitespace-nowrap select-none ${stageBadge}`}
                    >
                      {entry.stage}
                    </span>

                    {/* Log Message */}
                    <span
                      className={`flex-1 break-words ${
                        entry.level === 'SUCCESS'
                          ? 'text-emerald-300 font-medium'
                          : entry.level === 'WARN'
                          ? 'text-amber-300'
                          : entry.level === 'ERROR'
                          ? 'text-rose-400 font-semibold'
                          : 'text-slate-300'
                      }`}
                    >
                      {entry.message}
                    </span>
                  </div>
                );
              })
            )}

            {isExecuting && (
              <div className="flex items-center gap-2 py-1 px-2 text-indigo-400 animate-pulse text-xs">
                <span>&gt;&gt;</span>
                <span>Active agent computation in progress...</span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
