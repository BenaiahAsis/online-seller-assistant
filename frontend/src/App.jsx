import { useState, useEffect, useCallback } from 'react';

const SAMPLE_PRODUCTS = [
  {
    name: 'Eco-Friendly Bamboo Wireless Keyboard',
    price: '49.99',
    quantity: '120',
    materials: 'Natural bamboo wood casing, recycled ABS keycaps, aluminum frame',
    features: 'Dual-mode Bluetooth 5.0 and 2.4GHz wireless connection, 60-hour rechargeable USB-C battery, silent scissor-switch keys, ergonomic 6-degree wrist tilt, multi-device fast switching',
  },
  {
    name: 'Insulated Stainless Steel Smart Thermal Tumbler',
    price: '29.50',
    quantity: '250',
    materials: 'Double-wall 18/8 food-grade stainless steel, BPA-free silicone seal lid',
    features: 'LCD temperature display on touch lid, keeps beverages hot for 12h and iced for 24h, leak-proof design, fits standard car cup holders, 500ml capacity',
  },
  {
    name: 'Ergonomic Memory Foam Lumbar Support Cushion',
    price: '34.99',
    quantity: '85',
    materials: 'High-density memory foam, breathable 3D mesh fabric cover, adjustable elastic strap',
    features: 'Orthopedic posture correction, dual adjustable straps for office chairs and cars, removable machine-washable cover, relieves lower back strain during long work sessions',
  },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('assistant'); // 'assistant' | 'devops'

  // DevOps Health State
  const [healthData, setHealthData] = useState(null);
  const [statusCode, setStatusCode] = useState(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [healthError, setHealthError] = useState(null);
  const [lastChecked, setLastChecked] = useState(null);

  // Products & Agent State
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [analyzingId, setAnalyzingId] = useState(null);
  const [notification, setNotification] = useState(null);
  const [copiedKeyword, setCopiedKeyword] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    quantity: '1',
    materials: '',
    features: '',
  });

  const rawApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
  const apiUrl = rawApiUrl.replace(/\/+$/, '');
  const healthEndpoint = `${apiUrl}/health`;
  const productsEndpoint = `${apiUrl}/api/products`;

  // Fetch DevOps Health
  const fetchHealth = useCallback(async () => {
    setHealthLoading(true);
    setHealthError(null);
    try {
      const response = await fetch(healthEndpoint, {
        headers: { Accept: 'application/json' },
      });
      setStatusCode(response.status);
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setHealthData(data);
        setHealthError(data?.error || `Backend responded with HTTP status ${response.status}`);
      } else {
        setHealthData(data);
        setHealthError(null);
      }
    } catch (err) {
      setStatusCode(null);
      setHealthData(null);
      setHealthError(
        err instanceof Error
          ? err.message
          : 'Failed to connect to backend service. Check network or server status.'
      );
    } finally {
      setHealthLoading(false);
      setLastChecked(new Date().toLocaleTimeString());
    }
  }, [healthEndpoint]);

  // Fetch Products Catalog
  const fetchProducts = useCallback(async () => {
    setProductsLoading(true);
    try {
      const response = await fetch(productsEndpoint, {
        headers: { Accept: 'application/json' },
      });
      if (response.ok) {
        const data = await response.json();
        setProducts(data.products || []);
        // If nothing is selected, default to the latest analyzed product
        if (!selectedProduct && data.products && data.products.length > 0) {
          const firstWithAnalysis = data.products.find((p) => p.analysis);
          setSelectedProduct(firstWithAnalysis || data.products[0]);
        }
      }
    } catch (err) {
      console.warn('Unable to load product list:', err);
    } finally {
      setProductsLoading(false);
    }
  }, [productsEndpoint, selectedProduct]);

  useEffect(() => {
    fetchHealth();
    fetchProducts();
  }, [fetchHealth, fetchProducts]);

  // Load a demo sample into the input form
  const handleLoadSample = (sampleIndex = 0) => {
    const sample = SAMPLE_PRODUCTS[sampleIndex % SAMPLE_PRODUCTS.length];
    setFormData({ ...sample });
    setNotification({
      type: 'info',
      message: `Loaded sample: "${sample.name}"`,
    });
  };

  // Submit new product and immediately analyze with Agent 1
  const handleCreateAndAnalyze = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.price) {
      setNotification({
        type: 'error',
        message: 'Product name and price are required.',
      });
      return;
    }

    setSubmitting(true);
    setNotification(null);

    try {
      // Step 1: Create Product
      const createRes = await fetch(productsEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          price: parseFloat(formData.price),
          quantity: parseInt(formData.quantity, 10) || 1,
          materials: formData.materials.trim() || null,
          features: formData.features.trim() || null,
        }),
      });

      if (!createRes.ok) {
        const errData = await createRes.json().catch(() => null);
        throw new Error(errData?.detail || `Failed to create product (${createRes.status})`);
      }

      const createdProduct = await createRes.json();
      setSelectedProduct(createdProduct);

      // Step 2: Trigger Agent 1 Analysis
      setAnalyzingId(createdProduct.id);
      const analyzeRes = await fetch(`${productsEndpoint}/${createdProduct.id}/analyze`, {
        method: 'POST',
        headers: { Accept: 'application/json' },
      });

      if (!analyzeRes.ok) {
        const errData = await analyzeRes.json().catch(() => null);
        throw new Error(errData?.detail || `Failed running Agent 1 (${analyzeRes.status})`);
      }

      const analyzedProduct = await analyzeRes.json();
      setSelectedProduct(analyzedProduct);
      setNotification({
        type: 'success',
        message: `Product "${analyzedProduct.name}" created and analyzed by Agent 1!`,
      });

      // Clear form and refresh catalog
      setFormData({
        name: '',
        price: '',
        quantity: '1',
        materials: '',
        features: '',
      });
      await fetchProducts();
    } catch (err) {
      setNotification({
        type: 'error',
        message: err instanceof Error ? err.message : 'Operation failed.',
      });
    } finally {
      setSubmitting(false);
      setAnalyzingId(null);
    }
  };

  // Trigger analysis for an existing product in the catalog
  const handleRunAnalysis = async (productId) => {
    setAnalyzingId(productId);
    setNotification(null);
    try {
      const res = await fetch(`${productsEndpoint}/${productId}/analyze`, {
        method: 'POST',
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.detail || 'Analysis request failed');
      }
      const updated = await res.json();
      setSelectedProduct(updated);
      setNotification({
        type: 'success',
        message: `Agent 1 completed analysis for "${updated.name}"!`,
      });
      await fetchProducts();
    } catch (err) {
      setNotification({
        type: 'error',
        message: err instanceof Error ? err.message : 'Analysis failed',
      });
    } finally {
      setAnalyzingId(null);
    }
  };

  const handleCopyKeyword = (kw) => {
    navigator.clipboard?.writeText(kw);
    setCopiedKeyword(kw);
    setTimeout(() => setCopiedKeyword(null), 2000);
  };

  const isHealthy = statusCode === 200 && healthData?.status === 'healthy';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Navbar */}
      <nav className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center font-black text-white text-base shadow-md shadow-indigo-500/20">
              AI
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-white text-base tracking-tight">
                  Online Seller Assistant
                </span>
                <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  Sprint 2
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Autonomous AI agents for multi-channel e-commerce sellers
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 bg-slate-950/80 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab('assistant')}
              className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                activeTab === 'assistant'
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Agent 1: Product Analyzer
            </button>
            <button
              onClick={() => setActiveTab('devops')}
              className={`inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                activeTab === 'devops'
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>System Health</span>
              <span
                className={`w-2 h-2 rounded-full ${
                  isHealthy ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]' : 'bg-rose-500'
                }`}
              />
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Notification Toast */}
        {notification && (
          <div
            className={`flex items-center justify-between gap-3 p-3.5 rounded-xl border text-sm transition-all shadow-lg ${
              notification.type === 'success'
                ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-200'
                : notification.type === 'error'
                ? 'bg-rose-950/40 border-rose-800/60 text-rose-200'
                : 'bg-indigo-950/40 border-indigo-800/60 text-indigo-200'
            }`}
          >
            <div className="flex items-center gap-2 font-medium">
              <span>{notification.message}</span>
            </div>
            <button
              onClick={() => setNotification(null)}
              className="text-xs uppercase tracking-wider font-semibold opacity-70 hover:opacity-100"
            >
              Dismiss
            </button>
          </div>
        )}

        {activeTab === 'assistant' ? (
          /* ========================================================================= */
          /* SPRINT 2: PRODUCT ANALYZER AGENT WORKBENCH                                */
          /* ========================================================================= */
          <div className="space-y-6">
            {/* Top Overview Banner */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950/30 to-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-400">
                    <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></span>
                    Autonomous Pipeline &bull; Agent 1
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                    Product Analysis & Structure Agent
                  </h1>
                  <p className="text-sm text-slate-300 max-w-2xl">
                    Input raw product specifications. Agent 1 extracts the target market,
                    key selling points, specifications, and high-impact SEO keywords for downstream marketing agents.
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-slate-400 font-medium">Quick Test:</span>
                  <button
                    type="button"
                    onClick={() => handleLoadSample(0)}
                    className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg border border-slate-700 transition-colors"
                  >
                    Keyboard
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLoadSample(1)}
                    className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg border border-slate-700 transition-colors"
                  >
                    Tumbler
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLoadSample(2)}
                    className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg border border-slate-700 transition-colors"
                  >
                    Cushion
                  </button>
                </div>
              </div>
            </div>

            {/* Two-Column Grid: Form + Analysis Display */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Seller Input Form (5 cols) */}
              <div className="lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-lg flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <span>Seller Input Form</span>
                    </h2>
                    <span className="text-xs font-mono text-slate-500">POST /api/products</span>
                  </div>

                  <form onSubmit={handleCreateAndAnalyze} className="space-y-4">
                    {/* Product Name */}
                    <div>
                      <label htmlFor="product-name" className="block text-xs font-medium uppercase tracking-wider text-slate-400 mb-1">
                        Product Name <span className="text-rose-400">*</span>
                      </label>
                      <input
                        id="product-name"
                        type="text"
                        required
                        placeholder="e.g. Ergonomic Bamboo Wireless Keyboard"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                      />
                    </div>

                    {/* Price & Quantity Grid */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="product-price" className="block text-xs font-medium uppercase tracking-wider text-slate-400 mb-1">
                          Price ($) <span className="text-rose-400">*</span>
                        </label>
                        <input
                          id="product-price"
                          type="number"
                          step="0.01"
                          min="0.01"
                          required
                          placeholder="49.99"
                          value={formData.price}
                          onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                        />
                      </div>
                      <div>
                        <label htmlFor="product-stock" className="block text-xs font-medium uppercase tracking-wider text-slate-400 mb-1">
                          Stock Quantity
                        </label>
                        <input
                          id="product-stock"
                          type="number"
                          min="1"
                          value={formData.quantity}
                          onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                        />
                      </div>
                    </div>

                    {/* Materials */}
                    <div>
                      <label htmlFor="product-materials" className="block text-xs font-medium uppercase tracking-wider text-slate-400 mb-1">
                        Materials & Build
                      </label>
                      <input
                        id="product-materials"
                        type="text"
                        placeholder="e.g. Natural bamboo wood, recycled ABS plastics"
                        value={formData.materials}
                        onChange={(e) => setFormData({ ...formData, materials: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                      />
                    </div>

                    {/* Features / Raw Description */}
                    <div>
                      <label htmlFor="product-features" className="block text-xs font-medium uppercase tracking-wider text-slate-400 mb-1">
                        Raw Features & Notes
                      </label>
                      <textarea
                        id="product-features"
                        rows={4}
                        placeholder="Paste unorganized bullet points, supplier specs, battery life, dimensions..."
                        value={formData.features}
                        onChange={(e) => setFormData({ ...formData, features: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                      />
                    </div>

                    {/* Submit Button */}
                    <button
                      type="submit"
                      disabled={submitting || analyzingId !== null}
                      className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm transition-all bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-lg shadow-indigo-600/30"
                    >
                      {submitting ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          <span>Creating & Analyzing with Agent 1...</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          <span>Submit & Run AI Agent 1</span>
                        </>
                      )}
                    </button>
                  </form>
                </div>
              </div>

              {/* Right Column: AI Analysis Card (7 cols) */}
              <div className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-lg flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"></span>
                      <h2 className="text-lg font-bold text-white">Agent 1: Structured Output</h2>
                    </div>
                    {selectedProduct && (
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                          selectedProduct.status === 'analyzed'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        {selectedProduct.status === 'analyzed' ? 'AI Analyzed' : 'Draft'}
                      </span>
                    )}
                  </div>

                  {selectedProduct ? (
                    <div className="space-y-5">
                      {/* Product Header Info */}
                      <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <span className="text-xs text-slate-400 font-mono">ID #{selectedProduct.id}</span>
                          <h3 className="text-base sm:text-lg font-bold text-white">{selectedProduct.name}</h3>
                          <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                            <span>Price: <strong className="text-emerald-400 font-mono">${Number(selectedProduct.price).toFixed(2)}</strong></span>
                            <span>&bull;</span>
                            <span>Stock: <strong className="text-slate-200 font-mono">{selectedProduct.quantity} units</strong></span>
                          </div>
                        </div>

                        {selectedProduct.status !== 'analyzed' && (
                          <button
                            type="button"
                            onClick={() => handleRunAnalysis(selectedProduct.id)}
                            disabled={analyzingId === selectedProduct.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow transition-all disabled:opacity-50"
                          >
                            {analyzingId === selectedProduct.id ? 'Analyzing...' : 'Run Agent 1 Now'}
                          </button>
                        )}
                      </div>

                      {/* Structured Analysis Content */}
                      {selectedProduct.analysis ? (
                        <div className="space-y-4">
                          {/* Category & Target Audience */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 space-y-1">
                              <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold block">
                                Inferred Category
                              </span>
                              <span className="inline-block text-sm font-semibold text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded-lg">
                                {selectedProduct.analysis.category || 'General Merchandise'}
                              </span>
                            </div>

                            <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 space-y-1">
                              <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold block">
                                Target Audience
                              </span>
                              <span className="text-sm text-slate-200">
                                {selectedProduct.analysis.target_audience || 'Everyday consumers'}
                              </span>
                            </div>
                          </div>

                          {/* Key Selling Points */}
                          {selectedProduct.analysis.selling_points && selectedProduct.analysis.selling_points.length > 0 && (
                            <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 space-y-2">
                              <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold block">
                                Key Selling Points (Value Propositions)
                              </span>
                              <ul className="space-y-1.5 text-xs sm:text-sm text-slate-300">
                                {selectedProduct.analysis.selling_points.map((point, idx) => (
                                  <li key={idx} className="flex items-start gap-2">
                                    <svg className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                                    </svg>
                                    <span>{point}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Suggested SEO Keywords */}
                          {selectedProduct.analysis.suggested_keywords && selectedProduct.analysis.suggested_keywords.length > 0 && (
                            <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                                  Suggested SEO Keywords (Click to copy)
                                </span>
                                {copiedKeyword && (
                                  <span className="text-[11px] text-emerald-400 font-medium">Copied &ldquo;{copiedKeyword}&rdquo;!</span>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {selectedProduct.analysis.suggested_keywords.map((kw, idx) => (
                                  <button
                                    key={idx}
                                    type="button"
                                    onClick={() => handleCopyKeyword(kw)}
                                    className="text-xs bg-slate-900 hover:bg-slate-800 text-indigo-300 hover:text-white border border-slate-800 hover:border-indigo-500/50 px-2.5 py-1 rounded-md transition-colors font-mono"
                                  >
                                    #{kw}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Specifications / Raw Summary */}
                          {selectedProduct.analysis.raw_summary && (
                            <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 space-y-1">
                              <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold block">
                                Agent Synthesis Summary
                              </span>
                              <p className="text-xs text-slate-300 leading-relaxed font-mono">
                                {selectedProduct.analysis.raw_summary}
                              </p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-center py-10 space-y-3 bg-slate-950/40 rounded-xl border border-slate-800 border-dashed">
                          <p className="text-sm text-slate-400">
                            This product has not been analyzed yet.
                          </p>
                          <button
                            type="button"
                            onClick={() => handleRunAnalysis(selectedProduct.id)}
                            disabled={analyzingId === selectedProduct.id}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow"
                          >
                            Run Agent 1 Analysis Now
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Empty State */
                    <div className="text-center py-12 space-y-4 bg-slate-950/30 rounded-xl border border-slate-800/80 border-dashed p-6">
                      <div className="w-12 h-12 mx-auto rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-base font-bold text-white">No Product Selected</h4>
                        <p className="text-xs text-slate-400 max-w-sm mx-auto">
                          Submit a product using the form or select one from the catalog below to inspect Agent 1&apos;s output.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleLoadSample(0)}
                        className="text-xs text-indigo-400 hover:text-indigo-300 font-medium underline underline-offset-4"
                      >
                        Load demo sample into form
                      </button>
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
                  <span>Engine: OpenAI GPT-4o-mini &amp; Deterministic Rule Fallback</span>
                  <span>PostgreSQL (Neon)</span>
                </div>
              </div>
            </div>

            {/* Product Catalog List (Bottom Section) */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-lg space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-base font-bold text-white">Saved Product Catalog</h3>
                  <p className="text-xs text-slate-400">
                    Live records persisted in Neon PostgreSQL ({products.length} products stored)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={fetchProducts}
                  disabled={productsLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors disabled:opacity-50"
                >
                  <svg className={`w-3.5 h-3.5 ${productsLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>{productsLoading ? 'Refreshing...' : 'Refresh Catalog'}</span>
                </button>
              </div>

              {products.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-500">
                  No products in database yet. Use the form above to add your first product.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {products.map((p) => {
                    const isSelected = selectedProduct?.id === p.id;
                    return (
                      <div
                        key={p.id}
                        onClick={() => setSelectedProduct(p)}
                        className={`cursor-pointer rounded-xl p-4 border transition-all text-left space-y-2 ${
                          isSelected
                            ? 'bg-indigo-950/40 border-indigo-500/80 shadow-md shadow-indigo-500/10'
                            : 'bg-slate-950/70 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/60'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-bold text-sm text-white line-clamp-1">{p.name}</h4>
                          <span
                            className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${
                              p.status === 'analyzed'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            }`}
                          >
                            {p.status}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-slate-400">
                          <span className="font-mono text-emerald-400 font-semibold">${Number(p.price).toFixed(2)}</span>
                          <span className="font-mono text-slate-400">Qty: {p.quantity}</span>
                          <span className="text-slate-500 text-[11px]">
                            {p.analysis?.category || 'Uncategorized'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ========================================================================= */
          /* SPRINT 1 DEVOPS: LIVE HEALTH MONITOR                                      */
          /* ========================================================================= */
          <div className="max-w-3xl mx-auto space-y-6">
            <header className="text-center space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></span>
                DevOps &amp; Infrastructure
              </div>
              <h2 className="text-3xl font-extrabold tracking-tight text-white">
                Live System Health Monitor
              </h2>
              <p className="text-sm text-slate-400">
                Vite + React frontend monitoring FastAPI backend &amp; Neon PostgreSQL health
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
                  <span className="text-slate-200 font-mono">{lastChecked || 'Never'}</span>
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
                      healthLoading
                        ? 'bg-amber-400 animate-ping'
                        : isHealthy
                        ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]'
                        : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]'
                    }`}
                  />
                  <span className="text-base font-semibold text-white">
                    {healthLoading
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
                      healthLoading
                        ? 'bg-amber-400'
                        : healthData?.database === 'connected'
                        ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]'
                        : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]'
                    }`}
                  />
                  <span className="text-base font-semibold text-white">
                    {healthLoading
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
                  type="button"
                  onClick={fetchHealth}
                  disabled={healthLoading}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-md shadow-indigo-600/20"
                >
                  {healthLoading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-1 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Checking...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      <span>Re-check Health</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Error Alert Box */}
            {healthError && (
              <div className="bg-rose-950/40 border border-rose-800/60 rounded-xl p-4 text-rose-200 text-sm space-y-1">
                <div className="flex items-center gap-2 font-semibold text-rose-300">
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span>Connection Warning</span>
                </div>
                <p className="font-mono text-xs text-rose-300/90 break-words pl-7">{healthError}</p>
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
                  : healthError
                  ? JSON.stringify({ error: healthError, target: healthEndpoint }, null, 2)
                  : '// Waiting for response...'}
              </pre>
            </div>
          </div>
        )}
      </main>

      {/* Persistent Global Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-900/50 py-4 px-4 text-center text-xs text-slate-500 space-y-1">
        <p>
          Online Seller Assistant &bull; AI Engineering &amp; Autonomous Multi-Agent System &bull; Sprint 2
        </p>
        <p className="text-[11px] text-slate-600 font-mono">
          FastAPI &bull; Neon PostgreSQL &bull; React Vite &bull; Tailwind CSS &bull; Render &bull; Vercel
        </p>
      </footer>
    </div>
  );
}
