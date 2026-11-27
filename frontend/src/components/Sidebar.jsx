import { useMemo, useState } from 'react';
import Icon from './Icon';
import { Button, StatusLabel } from './ui';
import { formatPeso, productStatus } from '../lib/product';

export default function Sidebar({
  products,
  productsLoaded,
  productsLoading,
  productsError,
  onRetry,
  selectedId,
  isNewProduct,
  onSelect,
  onNew,
  onDelete,
  view,
  onOpenStatus,
  serverState, // 'ready' | 'waking' | 'down' | 'checking'
}) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.analysis?.category || '').toLowerCase().includes(q)
    );
  }, [products, search]);

  const dotColor = {
    ready: 'bg-emerald-600',
    waking: 'bg-amber-500',
    down: 'bg-red-600',
    checking: 'bg-stone-400',
  }[serverState];

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pb-3 pt-4">
        <p className="text-[15px] font-semibold tracking-tight text-ink">Online Seller Assistant</p>
      </div>

      <div className="space-y-2 px-3">
        <Button
          className={`w-full justify-start ${isNewProduct && view === 'workspace' ? 'border-ink' : ''}`}
          onClick={onNew}
        >
          <Icon name="plus" />
          New product
        </Button>
        <label className="relative block">
          <span className="sr-only">Search saved products</span>
          <Icon name="search" className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products"
            className="field h-9 py-0 pl-8"
          />
        </label>
      </div>

      <div className="mt-4 flex items-center justify-between px-4">
        <h2 className="text-[13px] font-medium text-muted">Saved products</h2>
        <button
          type="button"
          onClick={onRetry}
          disabled={productsLoading}
          className="-mr-1.5 inline-flex h-8 w-8 items-center justify-center rounded text-muted hover:bg-stone-100 hover:text-ink disabled:opacity-50"
          aria-label="Refresh saved products"
        >
          <Icon name="refresh" className={`h-3.5 w-3.5 ${productsLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <nav aria-label="Saved products" className="mt-1 flex-1 overflow-y-auto px-2 pb-3">
        {productsError && !productsLoading ? (
          <div role="alert" className="space-y-2 px-2 py-3 text-[13px] text-red-800">
            <p>{productsError}</p>
            <Button size="sm" onClick={onRetry}>Try again</Button>
          </div>
        ) : !productsLoaded ? (
          <div aria-busy="true" aria-label="Loading saved products" className="space-y-1 px-2 py-1">
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-1.5 py-2.5">
                <div className="h-3.5 w-3/4 animate-pulse rounded bg-stone-200" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-stone-100" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="px-2 py-3 text-[13px] text-muted">
            {search ? `No products match "${search}".` : 'No saved products yet.'}
          </p>
        ) : (
          <ul className="space-y-0.5">
            {filtered.map((p) => {
              const selected = view === 'workspace' && p.id === selectedId;
              return (
                <li key={p.id} className="group relative">
                  <button
                    type="button"
                    onClick={() => onSelect(p)}
                    aria-current={selected ? 'true' : undefined}
                    className={`block w-full rounded-md border-l-2 py-2 pl-2.5 pr-10 text-left transition-colors ${
                      selected ? 'border-ink bg-stone-100' : 'border-transparent hover:bg-stone-50'
                    }`}
                  >
                    <span className="line-clamp-2 text-[13px] font-medium leading-snug text-ink">{p.name}</span>
                    <span className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                      <span className="tabular-nums">{formatPeso(p.price)}</span>
                      {p.analysis?.category && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="truncate">{p.analysis.category}</span>
                        </>
                      )}
                    </span>
                    <span className="mt-1.5 block">
                      <StatusLabel status={productStatus(p)} />
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(p)}
                    aria-label={`Delete ${p.name}`}
                    className="absolute right-1 top-1 inline-flex h-8 w-8 items-center justify-center rounded text-muted opacity-0 transition-opacity hover:bg-red-50 hover:text-red-700 focus:opacity-100 group-hover:opacity-100"
                  >
                    <Icon name="trash" className="h-3.5 w-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </nav>

      <div className="border-t border-line px-3 py-2.5">
        <button
          type="button"
          onClick={onOpenStatus}
          aria-current={view === 'status' ? 'page' : undefined}
          className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[13px] transition-colors ${
            view === 'status' ? 'bg-stone-100 font-medium text-ink' : 'text-muted hover:bg-stone-50 hover:text-ink'
          }`}
        >
          <span className={`h-2 w-2 rounded-full ${dotColor}`} aria-hidden="true" />
          System status
        </button>
      </div>
    </div>
  );
}
