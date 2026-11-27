import { useCallback, useEffect, useRef, useState } from 'react';
import useSellerAssistant from './hooks/useSellerAssistant';
import Sidebar from './components/Sidebar';
import ProductForm from './components/ProductForm';
import EmptyListingPreview from './components/EmptyListingPreview';
import ProductWorkspace from './components/ProductWorkspace';
import StatusPage from './components/StatusPage';
import Toast from './components/Toast';
import Icon from './components/Icon';

export default function App() {
  const app = useSellerAssistant();
  const [view, setView] = useState('workspace'); // 'workspace' | 'status'
  const [drawerOpen, setDrawerOpen] = useState(false);
  const menuButtonRef = useRef(null);
  const closeButtonRef = useRef(null);
  const drawerWasOpen = useRef(false);

  // Phone drawer: focus moves into it on open, Escape closes it, and focus
  // returns to the menu button on close (it is a modal dialog).
  useEffect(() => {
    if (!drawerOpen) {
      if (drawerWasOpen.current) menuButtonRef.current?.focus();
      drawerWasOpen.current = false;
      return undefined;
    }
    drawerWasOpen.current = true;
    closeButtonRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setDrawerOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [drawerOpen]);

  const { selectedProduct, setNotification } = app;
  const dismissToast = useCallback(() => setNotification(null), [setNotification]);

  const serverState = app.isServerWakingUp
    ? 'waking'
    : app.healthLoading
    ? 'checking'
    : app.healthData
    ? 'ready'
    : 'down';

  const go = (fn) => (...args) => {
    fn(...args);
    setView('workspace');
    setDrawerOpen(false);
    window.scrollTo({ top: 0 });
  };

  const sidebar = (
    <Sidebar
      products={app.products}
      productsLoaded={app.productsLoaded}
      productsLoading={app.productsLoading}
      productsError={app.productsError}
      onRetry={app.fetchProducts}
      selectedId={selectedProduct?.id}
      isNewProduct={!selectedProduct}
      onSelect={go(app.selectProduct)}
      onNew={go(app.startNewProduct)}
      onDelete={app.handleDeleteProduct}
      view={view}
      onOpenStatus={() => {
        setView('status');
        setDrawerOpen(false);
        app.fetchHealth();
      }}
      serverState={serverState}
    />
  );

  return (
    <div className="min-h-screen lg:flex">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-line bg-white lg:block">
        <div className="sticky top-0 h-screen">{sidebar}</div>
      </aside>

      {/* Mobile top bar + drawer */}
      <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-white px-4 lg:hidden">
        <span className="text-[15px] font-semibold tracking-tight">Online Seller Assistant</span>
        <button
          ref={menuButtonRef}
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="rounded p-1.5 text-muted hover:bg-stone-100 hover:text-ink"
          aria-label="Open saved products"
        >
          <Icon name="menu" className="h-5 w-5" />
        </button>
      </div>
      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Saved products">
          <div className="absolute inset-0 bg-black/30" onClick={() => setDrawerOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85%] bg-white shadow-xl">
            <button
              ref={closeButtonRef}
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="absolute right-2 top-3 rounded p-1.5 text-muted hover:bg-stone-100"
              aria-label="Close"
            >
              <Icon name="x" className="h-4 w-4" />
            </button>
            {sidebar}
          </div>
        </div>
      )}

      <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 lg:py-8">
        {view === 'status' ? (
          <StatusPage
            healthData={app.healthData}
            healthLoading={app.healthLoading}
            healthError={app.healthError}
            isHealthy={app.isHealthy}
            isServerWakingUp={app.isServerWakingUp}
            lastChecked={app.lastChecked}
            onCheck={app.fetchHealth}
          />
        ) : selectedProduct ? (
          <div className="mx-auto max-w-3xl">
            <ProductWorkspace
              key={selectedProduct.id}
              product={selectedProduct}
              apiUrl={app.apiUrl}
              isEditing={app.editingProductId === selectedProduct.id}
              onStartEdit={() => app.setEditingProductId(selectedProduct.id)}
              onCancelEdit={() => app.setEditingProductId(null)}
              onSaved={app.handleProductSaved}
              onListingUpdated={app.fetchProducts}
              onRunPipeline={app.handleRunFullPipeline}
              onRunAnalysis={app.handleRunAnalysis}
              onRunMarket={app.handleRunMarketAnalysis}
              isRunningPipeline={app.runningPipelineId === selectedProduct.id}
              isAnalyzing={app.analyzingId === selectedProduct.id}
              isRunningMarket={app.runningMarketId === selectedProduct.id}
              busy={app.isBusy}
              logs={app.agentLogs}
              isExecutingLogs={app.isExecutingLogs}
              onClearLogs={app.clearLogs}
              onNotify={setNotification}
            />
          </div>
        ) : (
          <div className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
            <ProductForm
              formData={app.formData}
              setFormData={app.setFormData}
              onLoadSample={app.loadSample}
              priceWarning={app.priceSanityWarning}
              onCreateListings={app.handleCreateAndRunFullPipeline}
              onAnalyzeOnly={app.handleCreateAndAnalyze}
              busy={app.isBusy}
              submitting={app.submitting}
              serverState={serverState}
            />
            <div className="hidden lg:block lg:pt-14">
              <EmptyListingPreview />
            </div>
          </div>
        )}
      </main>

      <Toast notification={app.notification} onDismiss={dismissToast} />
    </div>
  );
}
