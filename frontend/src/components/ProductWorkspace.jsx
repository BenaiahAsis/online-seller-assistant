import { useState } from 'react';
import ListingPreview from './ListingPreview';
import MarketStrategyCard from './MarketStrategyCard';
import ProductProfile from './ProductProfile';
import ProductEditForm from './ProductEditForm';
import AgentLogsConsole from './AgentLogsConsole';
import Icon from './Icon';
import { Button, Spinner, StatusLabel } from './ui';
import { formatPeso, productStatus } from '../lib/product';

const TABS = [
  { id: 'listings', label: 'Listings' },
  { id: 'strategy', label: 'Selling strategy' },
  { id: 'profile', label: 'Product profile' },
];

// Results for one saved product. Mount with key={product.id} so tabs reset per product.
export default function ProductWorkspace({
  product,
  apiUrl,
  isEditing,
  onStartEdit,
  onCancelEdit,
  onSaved,
  onListingUpdated,
  onRunPipeline,
  onRunAnalysis,
  onRunMarket,
  isRunningPipeline,
  isAnalyzing,
  isRunningMarket,
  busy,
  logs,
  isExecutingLogs,
  onClearLogs,
  onNotify,
}) {
  const [tab, setTab] = useState('listings');

  const runningText = isRunningPipeline
    ? 'Creating listings: understanding your product, planning how to sell it, then writing. This can take up to a minute.'
    : isAnalyzing
    ? 'Analyzing your product…'
    : isRunningMarket
    ? 'Planning how to sell…'
    : null;

  return (
    <div className="space-y-6">
      {isEditing ? (
        <ProductEditForm product={product} apiUrl={apiUrl} onSaved={onSaved} onCancel={onCancelEdit} />
      ) : (
        <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold leading-snug tracking-tight">{product.name}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
              <span className="font-medium tabular-nums text-ink">{formatPeso(product.price)}</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">{product.quantity} in stock</span>
              <StatusLabel status={productStatus(product)} />
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button variant="ghost" size="sm" onClick={onStartEdit} disabled={busy}>
              <Icon name="pencil" className="h-3.5 w-3.5" />
              Edit details
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onRunAnalysis(product.id)} disabled={busy}>
              <Icon name="refresh" className="h-3.5 w-3.5" />
              Re-analyze
            </Button>
          </div>
        </header>
      )}

      {runningText && (
        <div role="status" className="flex items-center gap-2.5 rounded-md bg-stone-100 px-3 py-2.5 text-[13px] text-ink">
          <Spinner className="h-4 w-4 text-accent" />
          {runningText}
        </div>
      )}

      <div>
        <div role="tablist" aria-label="Product results" className="flex gap-6 border-b border-line">
          {TABS.map((t) => {
            const active = t.id === tab;
            return (
              <button
                key={t.id}
                id={`tab-${t.id}`}
                type="button"
                role="tab"
                aria-selected={active}
                aria-controls={`panel-${t.id}`}
                onClick={() => setTab(t.id)}
                className={`-mb-px border-b-2 pb-2.5 text-sm font-medium transition-colors ${
                  active ? 'border-accent text-ink' : 'border-transparent text-muted hover:text-ink'
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        <div id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`} className="pt-6">
          {tab === 'listings' && (
            <ListingPreview
              product={product}
              apiUrl={apiUrl}
              onRunFullPipeline={onRunPipeline}
              isRunningPipeline={isRunningPipeline}
              busy={busy}
              onListingUpdated={onListingUpdated}
              onNotify={onNotify}
            />
          )}
          {tab === 'strategy' && (
            <MarketStrategyCard product={product} onRunMarketAnalysis={onRunMarket} isRunning={isRunningMarket} busy={busy} />
          )}
          {tab === 'profile' && (
            <ProductProfile product={product} onRunAnalysis={onRunAnalysis} isAnalyzing={isAnalyzing} busy={busy} onNotify={onNotify} />
          )}
        </div>
      </div>

      <AgentLogsConsole logs={logs} isExecuting={isExecutingLogs} onClearLogs={onClearLogs} />
    </div>
  );
}
