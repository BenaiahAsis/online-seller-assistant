import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import ListingPreview from './components/ListingPreview';
import MarketStrategyCard from './components/MarketStrategyCard';
import AgentLogsConsole from './components/AgentLogsConsole';
import ProductEditForm from './components/ProductEditForm';

// Keep in sync with ProductBase.features max_length in backend/app/schemas.py
const FEATURES_MAX_LENGTH = 2000;

const SAMPLE_PRODUCTS = [
  {
    icon: '⌨️',
    label: 'Bamboo Keyboard',
    name: 'Eco-Friendly Bamboo Wireless Keyboard',
    price: '49.99',
    quantity: '120',
    materials: 'Natural bamboo wood casing, recycled ABS keycaps, aluminum frame',
    features:
      'Dual-mode Bluetooth 5.0 and 2.4GHz wireless connection, 60-hour rechargeable USB-C battery, silent scissor-switch keys, ergonomic 6-degree wrist tilt, multi-device fast switching',
  },
  {
    icon: '🥤',
    label: 'Smart Tumbler',
    name: 'Insulated Stainless Steel Smart Thermal Tumbler',
    price: '29.50',
    quantity: '250',
    materials:
      'Double-wall 18/8 food-grade stainless steel, BPA-free silicone seal lid',
    features:
      'LCD temperature display on touch lid, keeps beverages hot for 12h and iced for 24h, leak-proof design, fits standard car cup holders, 500ml capacity',
  },
  {
    icon: '🪑',
    label: 'Lumbar Cushion',
    name: 'Ergonomic Memory Foam Lumbar Support Cushion',
    price: '34.99',
    quantity: '85',
    materials:
      'High-density memory foam, breathable 3D mesh fabric cover, adjustable elastic strap',
    features:
      'Orthopedic posture correction, dual adjustable straps for office chairs and cars, removable machine-washable cover, relieves lower back strain during long work sessions',
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
  const [isServerWakingUp, setIsServerWakingUp] = useState(false);
  const [firstRequestDone, setFirstRequestDone] = useState(false);

  // Products & Agent State
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsLoaded, setProductsLoaded] = useState(false);
  const [productsError, setProductsError] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const resultsRef = useRef(null);
  const [submitting, setSubmitting] = useState(false);
  const [analyzingId, setAnalyzingId] = useState(null);
  const [runningMarketId, setRunningMarketId] = useState(null);
  const [runningPipelineId, setRunningPipelineId] = useState(null);
  const [notification, setNotification] = useState(null);
  const [copiedKeyword, setCopiedKeyword] = useState(null);

  // Agent Execution Logs State
  const [agentLogs, setAgentLogs] = useState([]);
  const [isExecutingLogs, setIsExecutingLogs] = useState(false);
  const [executingAgentName, setExecutingAgentName] = useState(null);

  // Multi-Platform Listing Preview State
  const [selectedPlatform, setSelectedPlatform] = useState('shopee'); // 'shopee' | 'tiktok' | 'lazada'
  const [copied, setCopied] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [editingProductId, setEditingProductId] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    quantity: '1',
    materials: '',
    features: '',
  });

  const priceSanityWarning = useMemo(() => {
    const name = (formData.name || '').toLowerCase();
    const priceNum = parseFloat(formData.price);
    if (!isNaN(priceNum)) {
      if ((name.includes('smartwatch') || name.includes('watch')) && priceNum < 100) {
        return `Price notice: ₱${priceNum.toFixed(2)} is unusually low for a smartwatch (typical Philippine baseline is ₱350 - ₱3,500). Please verify your price.`;
      }
      if (name.includes('laptop') && priceNum < 1500) {
        return `Price notice: ₱${priceNum.toFixed(2)} is unusually low for a laptop. Please verify your price.`;
      }
      if (name.includes('phone') && priceNum < 800) {
        return `Price notice: ₱${priceNum.toFixed(2)} is unusually low for a smartphone. Please verify your price.`;
      }
    }
    return null;
  }, [formData.name, formData.price]);

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
        setHealthError(
          data?.error || `Backend responded with HTTP status ${response.status}`
        );
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
        const incomingProducts = data.products || [];
        setProducts(incomingProducts);

        // Keep selectedProduct synchronized
        setSelectedProduct((current) => {
          if (!current && incomingProducts.length > 0) {
            return (
              incomingProducts.find((p) => p.listings && p.listings.length > 0) ||
              incomingProducts.find((p) => p.analysis) ||
              incomingProducts[0]
            );
          }
          if (current) {
            const fresh = incomingProducts.find((p) => p.id === current.id);
            if (fresh) return fresh;
          }
          return current;
        });
        setProductsError(null);
        setProductsLoaded(true);
      } else {
        setProductsError(`The server responded with an error (HTTP ${response.status}).`);
      }
    } catch (err) {
      console.warn('Unable to load product list:', err);
      setProductsError('Could not reach the server. Check your connection and try again.');
    } finally {
      setProductsLoading(false);
    }
  }, [productsEndpoint]);

  // Apply a saved product edit everywhere it is shown
  const handleProductSaved = useCallback((updated) => {
    setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    setSelectedProduct((current) => (current?.id === updated.id ? updated : current));
    setEditingProductId(null);
    setNotification({
      type: 'success',
      message: updated.analysis
        ? 'Details saved. Click "Regenerate Listings" so the profile and listings use the new details.'
        : 'Details saved.',
    });
  }, []);

  // Select a product from the catalog and bring its results into view
  const handleSelectFromCatalog = useCallback((product) => {
    setEditingProductId(null);
    setSelectedProduct(product);
    requestAnimationFrame(() => {
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, []);

  const handleDeleteProduct = useCallback(
    async (productId) => {
      if (!window.confirm('Delete this product and all its listings? This cannot be undone.')) return;
      try {
        const res = await fetch(`${productsEndpoint}/${productId}`, { method: 'DELETE' });
        if (!res.ok && res.status !== 204) {
          const err = await res.json().catch(() => null);
          alert(err?.detail || 'Failed to delete product.');
          return;
        }
        setSelectedProduct((current) => (current?.id === productId ? null : current));
        setProducts((prev) => prev.filter((p) => p.id !== productId));
      } catch {
        alert('Network error — could not delete product.');
      }
    },
    [productsEndpoint]
  );

  useEffect(() => {
    let timer = null;
    let finished = false;

    if (!firstRequestDone) {
      timer = setTimeout(() => {
        if (!finished) {
          setIsServerWakingUp(true);
        }
      }, 5000);
    }

    const init = async () => {
      try {
        await Promise.allSettled([fetchHealth(), fetchProducts()]);
      } finally {
        finished = true;
        if (timer) clearTimeout(timer);
        setIsServerWakingUp(false);
        setFirstRequestDone(true);
      }
    };

    init();

    return () => {
      finished = true;
      if (timer) clearTimeout(timer);
    };
  }, [fetchHealth, fetchProducts, firstRequestDone]);

  // Synchronize logs whenever selected product changes
  useEffect(() => {
    if (selectedProduct?.analysis?.execution_logs) {
      setAgentLogs(selectedProduct.analysis.execution_logs);
    } else if (!isExecutingLogs) {
      setAgentLogs([]);
    }
  }, [selectedProduct, isExecutingLogs]);

  // Helper to append simulated progress log during UI automation
  const addProgressLog = (agent, stage, message, level = 'INFO') => {
    const entry = {
      timestamp: new Date().toISOString(),
      agent,
      stage,
      level,
      message,
    };
    setAgentLogs((prev) => [...prev, entry]);
  };

  // Load a demo sample into the input form
  const handleLoadSample = (sampleIndex = 0) => {
    const sample = SAMPLE_PRODUCTS[sampleIndex % SAMPLE_PRODUCTS.length];
    setFormData({
      name: sample.name,
      price: sample.price,
      quantity: sample.quantity,
      materials: sample.materials,
      features: sample.features,
    });
    setNotification({
      type: 'info',
      message: `Loaded sample: "${sample.name}"`,
    });
  };

  // Submit new product and run Agent 1
  const handleCreateAndAnalyze = async (e) => {
    if (e) e.preventDefault();
    if (!formData.name.trim() || !formData.price) {
      setNotification({
        type: 'error',
        message: 'Product title and price are required.',
      });
      return;
    }

    setSubmitting(true);
    setIsExecutingLogs(true);
    setExecutingAgentName('Agent 1 (Product Analyzer)');
    setNotification(null);
    setAgentLogs([]);

    addProgressLog(
      'Agent 1: Product Analyzer',
      'INGEST',
      `Ingesting raw seller parameters for "${formData.name.trim()}"...`
    );

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
        throw new Error(
          errData?.detail || `Failed to create product (${createRes.status})`
        );
      }

      const createdProduct = await createRes.json();
      setSelectedProduct(createdProduct);
      setAnalyzingId(createdProduct.id);

      addProgressLog(
        'Agent 1: Product Analyzer',
        'CLASSIFY',
        'Analyzing product attributes and identifying target consumer demographic...'
      );

      // Step 2: Trigger Agent 1 Analysis
      const analyzeRes = await fetch(
        `${productsEndpoint}/${createdProduct.id}/analyze`,
        {
          method: 'POST',
          headers: { Accept: 'application/json' },
        }
      );

      if (!analyzeRes.ok) {
        const errData = await analyzeRes.json().catch(() => null);
        throw new Error(
          errData?.detail || `Failed running Agent 1 (${analyzeRes.status})`
        );
      }

      const analyzedProduct = await analyzeRes.json();
      setSelectedProduct(analyzedProduct);

      if (analyzedProduct.analysis?.execution_logs) {
        setAgentLogs(analyzedProduct.analysis.execution_logs);
      } else {
        addProgressLog(
          'Agent 1: Product Analyzer',
          'COMPLETE',
          'Product profiling completed successfully.',
          'SUCCESS'
        );
      }

      setNotification({
        type: 'success',
        message: `Agent 1 completed product analysis! Inferred category: "${
          analyzedProduct.analysis?.category || 'Ready'
        }"`,
      });

      // Clear form
      setFormData({
        name: '',
        price: '',
        quantity: '1',
        materials: '',
        features: '',
      });

      await fetchProducts();
    } catch (err) {
      addProgressLog(
        'Agent 1: Product Analyzer',
        'ERROR',
        err instanceof Error ? err.message : 'Analysis failed',
        'ERROR'
      );
      setNotification({
        type: 'error',
        message:
          err instanceof Error ? err.message : 'Failed to submit and analyze product',
      });
    } finally {
      setSubmitting(false);
      setAnalyzingId(null);
      setIsExecutingLogs(false);
      setExecutingAgentName(null);
    }
  };

  // Run Agent 1 individually for an existing product
  const handleRunAnalysis = async (productId) => {
    setAnalyzingId(productId);
    setIsExecutingLogs(true);
    setExecutingAgentName('Agent 1 (Product Analyzer)');
    setNotification(null);

    addProgressLog(
      'Agent 1: Product Analyzer',
      'INGEST',
      'Re-analyzing product specifications and extracting value propositions...'
    );

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
      if (updated.analysis?.execution_logs) {
        setAgentLogs(updated.analysis.execution_logs);
      }
      setNotification({
        type: 'success',
        message: `Agent 1 completed profile analysis for "${updated.name}"!`,
      });
      await fetchProducts();
    } catch (err) {
      addProgressLog(
        'Agent 1: Product Analyzer',
        'ERROR',
        err instanceof Error ? err.message : 'Analysis failed',
        'ERROR'
      );
      setNotification({
        type: 'error',
        message: err instanceof Error ? err.message : 'Analysis failed',
      });
    } finally {
      setAnalyzingId(null);
      setIsExecutingLogs(false);
      setExecutingAgentName(null);
    }
  };

  // Run Agent 2 (Market Analysis)
  const handleRunMarketAnalysis = async (productId) => {
    setRunningMarketId(productId);
    setIsExecutingLogs(true);
    setExecutingAgentName('Agent 2 (Market Strategist)');
    setNotification(null);

    addProgressLog(
      'Agent 2: Market Analyzer',
      'PRICE_TIER',
      'Evaluating price tier positioning and buyer psychology...'
    );

    try {
      const res = await fetch(
        `${productsEndpoint}/${productId}/market-analysis`,
        {
          method: 'POST',
          headers: { Accept: 'application/json' },
        }
      );
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.detail || 'Market analysis request failed');
      }
      const updated = await res.json();
      setSelectedProduct(updated);
      if (updated.analysis?.execution_logs) {
        setAgentLogs(updated.analysis.execution_logs);
      }
      setNotification({
        type: 'success',
        message: `Agent 2 completed market positioning for "${updated.name}"!`,
      });
      await fetchProducts();
    } catch (err) {
      addProgressLog(
        'Agent 2: Market Analyzer',
        'ERROR',
        err instanceof Error ? err.message : 'Market analysis failed',
        'ERROR'
      );
      setNotification({
        type: 'error',
        message: err instanceof Error ? err.message : 'Market analysis failed',
      });
    } finally {
      setRunningMarketId(null);
      setIsExecutingLogs(false);
      setExecutingAgentName(null);
    }
  };

  // Trigger full 3-agent autonomous pipeline (Agent 1 -> Agent 2 -> Agent 3)
  const handleRunFullPipeline = async (productId) => {
    setRunningPipelineId(productId);
    setIsExecutingLogs(true);
    setExecutingAgentName('3-Agent Pipeline');
    setNotification(null);

    addProgressLog(
      'Pipeline Orchestrator',
      'INIT',
      'Initializing sequential 3-agent autonomous workflow...'
    );
    addProgressLog(
      'Agent 1: Product Analyzer',
      'INGEST',
      'Agent 1 reading product features, materials, and price...'
    );

    try {
      const res = await fetch(`${productsEndpoint}/${productId}/full-pipeline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(
          errData?.detail || `Failed to run full pipeline (${res.status})`
        );
      }
      const data = await res.json();
      setSelectedProduct(data.product);

      if (data.logs && data.logs.length > 0) {
        setAgentLogs(data.logs);
      } else if (data.product?.analysis?.execution_logs) {
        setAgentLogs(data.product.analysis.execution_logs);
      } else {
        addProgressLog(
          'Pipeline Orchestrator',
          'COMPLETE',
          'Full 3-agent pipeline successfully executed. Listings ready for Shopee, TikTok, and Lazada.',
          'SUCCESS'
        );
      }

      setNotification({
        type: 'success',
        message:
          'Full 3-agent pipeline completed successfully! Shopee, TikTok Shop, and Lazada listings ready.',
      });
      await fetchProducts();
    } catch (err) {
      addProgressLog(
        'Pipeline Orchestrator',
        'ERROR',
        err instanceof Error ? err.message : 'Pipeline execution failed',
        'ERROR'
      );
      setNotification({
        type: 'error',
        message:
          err instanceof Error ? err.message : 'Failed to run full pipeline',
      });
    } finally {
      setRunningPipelineId(null);
      setIsExecutingLogs(false);
      setExecutingAgentName(null);
    }
  };

  // Submit and immediately trigger full 3-agent pipeline
  const handleCreateAndRunFullPipeline = async (e) => {
    if (e) e.preventDefault();
    if (!formData.name.trim() || !formData.price) {
      setNotification({
        type: 'error',
        message: 'Product title and price are required.',
      });
      return;
    }

    setSubmitting(true);
    setIsExecutingLogs(true);
    setExecutingAgentName('Full 3-Agent Pipeline');
    setNotification(null);
    setAgentLogs([]);

    addProgressLog(
      'Pipeline Orchestrator',
      'INGEST',
      `Creating product "${formData.name.trim()}" in PostgreSQL...`
    );

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
        throw new Error(
          errData?.detail || `Failed to create product (${createRes.status})`
        );
      }

      const createdProduct = await createRes.json();
      setSelectedProduct(createdProduct);

      // Clear form
      setFormData({
        name: '',
        price: '',
        quantity: '1',
        materials: '',
        features: '',
      });

      // Step 2: Trigger Full Pipeline
      await handleRunFullPipeline(createdProduct.id);
    } catch (err) {
      addProgressLog(
        'Pipeline Orchestrator',
        'ERROR',
        err instanceof Error ? err.message : 'Pipeline execution failed',
        'ERROR'
      );
      setNotification({
        type: 'error',
        message:
          err instanceof Error ? err.message : 'Pipeline execution failed',
      });
    } finally {
      setSubmitting(false);
      setIsExecutingLogs(false);
      setExecutingAgentName(null);
    }
  };

  const handleCopyKeyword = (kw) => {
    navigator.clipboard?.writeText(kw);
    setCopiedKeyword(kw);
    setTimeout(() => setCopiedKeyword(null), 2000);
  };

  const isHealthy = statusCode === 200 && healthData?.status === 'healthy';

  const filteredCatalog = useMemo(() => {
    if (!catalogSearch.trim()) return products;
    const q = catalogSearch.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.analysis?.category || '').toLowerCase().includes(q)
    );
  }, [products, catalogSearch]);

  // Stepper state calculation
  const getStepStatus = (stepIndex) => {
    if (!selectedProduct) {
      return stepIndex === 1 ? 'current' : 'pending';
    }
    const hasAnalysis = Boolean(selectedProduct.analysis?.category);
    const hasMarket = Boolean(selectedProduct.analysis?.market_insights);
    const hasListings = Boolean(
      selectedProduct.listings && selectedProduct.listings.length > 0
    );

    if (stepIndex === 1) return 'completed';
    if (stepIndex === 2) {
      if (analyzingId === selectedProduct.id) return 'active';
      return hasAnalysis ? 'completed' : 'pending';
    }
    if (stepIndex === 3) {
      if (runningMarketId === selectedProduct.id) return 'active';
      return hasMarket ? 'completed' : hasAnalysis ? 'ready' : 'pending';
    }
    if (stepIndex === 4) {
      if (runningPipelineId === selectedProduct.id) return 'active';
      return hasListings ? 'completed' : hasMarket ? 'ready' : 'pending';
    }
    return 'pending';
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans selection:bg-indigo-200">
      {/* Top Glassmorphic Navbar */}
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur-md sticky top-0 z-30 shadow-sm ">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center font-black text-white shadow-sm ">
              ⚡
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base sm:text-lg tracking-tight text-slate-900 leading-tight">
                  Online Seller Assistant
                </span>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-200">
                  v3.0
                </span>
              </div>
              <span className="text-xs text-slate-600">
                AI listing writer for Shopee, TikTok Shop &amp; Lazada
              </span>
            </div>
          </div>

          {/* Navigation Controls */}
          <nav aria-label="Main" className="flex items-center gap-2">
            <button
              type="button"
              aria-current={activeTab === 'assistant' ? 'page' : undefined}
              onClick={() => setActiveTab('assistant')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'assistant'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100 border border-transparent hover:border-slate-300'
              }`}
            >
              <span>🤖</span>
              <span>AI Listing Studio</span>
            </button>
            <button
              type="button"
              aria-current={activeTab === 'devops' ? 'page' : undefined}
              onClick={() => setActiveTab('devops')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'devops'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100 border border-transparent hover:border-slate-300'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  healthLoading
                    ? 'bg-amber-500 animate-pulse'
                    : isHealthy
                    ? 'bg-emerald-500'
                    : 'bg-rose-500'
                }`}
              />
              <span>System Status</span>
            </button>
          </nav>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Render Cold-Start Server Wake-Up Notice */}
        {isServerWakingUp && (
          <div
            role="status"
            aria-live="polite"
            className="bg-amber-50 border border-amber-400 text-amber-800 px-4 py-3.5 rounded-2xl flex items-center justify-between shadow-sm backdrop-blur-md animate-pulse"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-3.5 w-3.5 relative shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-amber-500"></span>
              </span>
              <div>
                <p className="font-semibold text-sm text-amber-900">
                  Waking up the server, this can take up to a minute
                </p>
                <p className="text-xs text-amber-700">
                  The backend service is warming up from idle state. Please wait a moment...
                </p>
              </div>
            </div>
            <div className="text-xs px-2.5 py-1 bg-amber-100 border border-amber-300 rounded-lg text-amber-700 font-mono hidden sm:inline-block">
              Free Tier Wake-up
            </div>
          </div>
        )}

        {/* Global Floating Toast / Notification */}
        {notification && (
          <div
            className={`p-3.5 rounded-xl border flex items-center justify-between text-xs sm:text-sm font-medium transition-all shadow-sm backdrop-blur-sm ${
              notification.type === 'success'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                : notification.type === 'info'
                ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                : 'bg-rose-50 border-rose-300 text-rose-800'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-base">
                {notification.type === 'success'
                  ? '✓'
                  : notification.type === 'info'
                  ? 'ℹ'
                  : '⚠'}
              </span>
              <span>{notification.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setNotification(null)}
              className="text-xs text-slate-500 hover:text-slate-900 ml-3 underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {activeTab === 'assistant' ? (
          <div className="space-y-6">
            {/* Top Overview Banner with Stepper */}
            <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm relative overflow-hidden">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-700">
                    <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                    Powered by 3 AI assistants
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                    Turn product notes into ready-to-post listings
                  </h1>
                  <p className="text-sm text-slate-700 max-w-2xl leading-relaxed">
                    Type in what you know about your product. We&apos;ll organize it, plan how to sell it, and write listings for Shopee, TikTok Shop, and Lazada that only use the facts you gave us.
                  </p>
                </div>

                {/* Sample Presets */}
                <div className="space-y-1.5 flex-shrink-0">
                  <span className="text-xs font-semibold text-slate-600 block">
                    New here? Try an example:
                  </span>
                  <div className="flex items-center gap-2 flex-wrap">
                    {SAMPLE_PRODUCTS.map((s, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleLoadSample(idx)}
                        className="inline-flex items-center gap-1.5 text-xs bg-white hover:bg-slate-200 text-slate-800 px-3 py-1.5 rounded-xl border border-slate-300 transition-all active:scale-95 shadow-sm"
                      >
                        <span>{s.icon}</span>
                        <span>{s.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Interactive 4-Step Pipeline Stepper */}
              <div className="mt-6 pt-5 border-t border-slate-200">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {/* Step 1 */}
                  <div
                    className={`p-3 rounded-xl border transition-all ${
                      getStepStatus(1) === 'completed'
                        ? 'bg-indigo-50 border-indigo-400 text-indigo-700'
                        : 'bg-slate-50 border-slate-200 text-slate-500'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center">
                        1
                      </span>
                      <span className="text-xs font-bold text-slate-900">Your product</span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1">
                      Name, price &amp; features
                    </p>
                  </div>

                  {/* Step 2 */}
                  <div
                    className={`p-3 rounded-xl border transition-all ${
                      getStepStatus(2) === 'completed'
                        ? 'bg-purple-50 border-purple-400 text-purple-800'
                        : getStepStatus(2) === 'active'
                        ? 'bg-purple-50 border-purple-400 animate-pulse text-purple-900'
                        : 'bg-slate-50 border-slate-200 text-slate-500'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 text-xs font-bold flex items-center justify-center">
                        2
                      </span>
                      <span className="text-xs font-bold text-slate-900">Understand it</span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1">
                      Category, key specs &amp; keywords
                    </p>
                  </div>

                  {/* Step 3 */}
                  <div
                    className={`p-3 rounded-xl border transition-all ${
                      getStepStatus(3) === 'completed'
                        ? 'bg-amber-50 border-amber-400 text-amber-800'
                        : getStepStatus(3) === 'active'
                        ? 'bg-amber-100 border-amber-400 animate-pulse text-amber-900'
                        : 'bg-slate-50 border-slate-200 text-slate-500'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 text-xs font-bold flex items-center justify-center">
                        3
                      </span>
                      <span className="text-xs font-bold text-slate-900">Plan how to sell</span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1">
                      Price level &amp; buyer concerns
                    </p>
                  </div>

                  {/* Step 4 */}
                  <div
                    className={`p-3 rounded-xl border transition-all ${
                      getStepStatus(4) === 'completed'
                        ? 'bg-emerald-50 border-emerald-400 text-emerald-800'
                        : getStepStatus(4) === 'active'
                        ? 'bg-emerald-50 border-emerald-400 animate-pulse text-emerald-900'
                        : 'bg-slate-50 border-slate-200 text-slate-500'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold flex items-center justify-center">
                        4
                      </span>
                      <span className="text-xs font-bold text-slate-900">Write listings</span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1">
                      Shopee, TikTok Shop &amp; Lazada
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Main Workbench: Two-Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column (5 cols): Input Form + Live Agent Terminal */}
              <div className="lg:col-span-5 space-y-6">
                {/* Input Form Card */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
                  <div className="border-b border-slate-200 pb-3">
                    <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                      <span>📝</span>
                      <span>Product Details</span>
                    </h2>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Messy notes are fine. Paste what your supplier gave you, or try an example above.
                    </p>
                  </div>

                  <form onSubmit={handleCreateAndAnalyze} className="space-y-4">
                    {/* Name */}
                    <div className="space-y-1">
                      <label
                        htmlFor="product-name"
                        className="text-xs font-semibold text-slate-700 block"
                      >
                        Product Title / Name <span className="text-rose-700">*</span>
                      </label>
                      <input
                        id="product-name"
                        type="text"
                        required
                        placeholder="e.g. Ergonomic Bluetooth Mechanical Keyboard"
                        value={formData.name}
                        onChange={(e) =>
                          setFormData({ ...formData, name: e.target.value })
                        }
                        className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                      />
                    </div>

                    {/* Price & Quantity Grid */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label
                          htmlFor="product-price"
                          className="text-xs font-semibold text-slate-700 block"
                        >
                          Price (₱) <span className="text-rose-700">*</span>
                        </label>
                        <input
                          id="product-price"
                          type="number"
                          step="0.01"
                          min="0.01"
                          required
                          placeholder="899.00"
                          value={formData.price}
                          onChange={(e) =>
                            setFormData({ ...formData, price: e.target.value })
                          }
                          className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <label
                          htmlFor="product-quantity"
                          className="text-xs font-semibold text-slate-700 block"
                        >
                          Stock Units
                        </label>
                        <input
                          id="product-quantity"
                          type="number"
                          min="1"
                          required
                          value={formData.quantity}
                          onChange={(e) =>
                            setFormData({ ...formData, quantity: e.target.value })
                          }
                          className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors font-mono"
                        />
                      </div>
                    </div>

                    {/* Price Sanity Warning */}
                    {priceSanityWarning && (
                      <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-xs flex items-start gap-2 shadow-sm">
                        <span className="text-sm flex-shrink-0">⚠️</span>
                        <span className="leading-relaxed">{priceSanityWarning}</span>
                      </div>
                    )}

                    {/* Materials */}
                    <div className="space-y-1">
                      <label
                        htmlFor="product-materials"
                        className="text-xs font-semibold text-slate-700 block"
                      >
                        Materials / Composition
                      </label>
                      <input
                        id="product-materials"
                        type="text"
                        placeholder="e.g. 100% Bamboo wood, recycled ABS, aluminum"
                        value={formData.materials}
                        onChange={(e) =>
                          setFormData({ ...formData, materials: e.target.value })
                        }
                        className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                      />
                    </div>

                    {/* Features / Raw Specs */}
                    <div className="space-y-1">
                      <label
                        htmlFor="product-features"
                        className="text-xs font-semibold text-slate-700 block"
                      >
                        Raw Features &amp; Unorganized Notes
                      </label>
                      <textarea
                        id="product-features"
                        rows={4}
                        maxLength={FEATURES_MAX_LENGTH}
                        aria-describedby="product-features-count"
                        placeholder="Paste unorganized bullet points, supplier specs, dimensions, battery life..."
                        value={formData.features}
                        onChange={(e) =>
                          setFormData({ ...formData, features: e.target.value })
                        }
                        className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                      />
                      <p
                        id="product-features-count"
                        className={`text-xs text-right ${
                          formData.features.length >= FEATURES_MAX_LENGTH
                            ? 'text-rose-700 font-semibold'
                            : 'text-slate-500'
                        }`}
                      >
                        {formData.features.length.toLocaleString()} / {FEATURES_MAX_LENGTH.toLocaleString()} characters
                      </p>
                    </div>

                    {/* Dual Action Buttons */}
                    <div className="space-y-2 pt-1">
                      <button
                        type="button"
                        onClick={handleCreateAndRunFullPipeline}
                        disabled={
                          submitting ||
                          analyzingId !== null ||
                          runningPipelineId !== null
                        }
                        className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-xs sm:text-sm transition-all bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-sm "
                      >
                        {submitting || runningPipelineId !== null ? (
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
                            <span>Writing your listings...</span>
                          </>
                        ) : (
                          <>
                            <span>⚡ Create My Listings</span>
                          </>
                        )}
                      </button>

                      <button
                        type="submit"
                        disabled={
                          submitting ||
                          analyzingId !== null ||
                          runningPipelineId !== null
                        }
                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs transition-all bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border border-slate-300 disabled:opacity-50"
                      >
                        {analyzingId !== null ? (
                          <span>Analyzing your product...</span>
                        ) : (
                          <span>Just analyze the product (no listings yet)</span>
                        )}
                      </button>
                    </div>
                  </form>
                </div>

                {/* Live Multi-Agent Log Console Component */}
                <AgentLogsConsole
                  logs={agentLogs}
                  isExecuting={isExecutingLogs}
                  executingAgent={executingAgentName}
                  onClearLogs={() => setAgentLogs([])}
                />
              </div>

              {/* Right Column (7 cols): Agent 1, Agent 2 & Agent 3 Cards */}
              <div ref={resultsRef} className="lg:col-span-7 space-y-6 scroll-mt-24">
                {/* Agent 1 Card: Structured Product Profile */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm space-y-5">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-purple-500 "></span>
                      <h2 className="text-lg font-bold text-slate-900">
                        Product Profile
                      </h2>
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-purple-50 text-purple-800 border border-purple-200">
                        Agent 1
                      </span>
                    </div>
                    {selectedProduct && (
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                          selectedProduct.status === 'completed'
                            ? 'bg-cyan-50 text-cyan-700 border border-cyan-200'
                            : selectedProduct.status === 'analyzed'
                            ? 'bg-purple-50 text-purple-700 border border-purple-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {selectedProduct.status === 'completed'
                          ? '✓ Listings ready'
                          : selectedProduct.status === 'analyzed'
                          ? 'Analyzed'
                          : 'Draft'}
                      </span>
                    )}
                  </div>

                  {selectedProduct ? (
                    <div className="space-y-4">
                      {/* Product Header */}
                      {editingProductId === selectedProduct.id ? (
                        <ProductEditForm
                          key={selectedProduct.id}
                          product={selectedProduct}
                          apiUrl={apiUrl}
                          onSaved={handleProductSaved}
                          onCancel={() => setEditingProductId(null)}
                        />
                      ) : (
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <span className="text-xs text-slate-500 font-mono">
                            ID #{selectedProduct.id}
                          </span>
                          <h3 className="text-base sm:text-lg font-bold text-slate-900">
                            {selectedProduct.name}
                          </h3>
                          <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                            <span>
                              Price:{' '}
                              <strong className="text-emerald-700 font-mono">
                                ₱{Number(selectedProduct.price).toFixed(2)}
                              </strong>
                            </span>
                            <span>&bull;</span>
                            <span>
                              Stock:{' '}
                              <strong className="text-slate-800 font-mono">
                                {selectedProduct.quantity} units
                              </strong>
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={() => setEditingProductId(selectedProduct.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 transition-all"
                          >
                            ✏️ Edit Details
                          </button>

                          <button
                            type="button"
                            onClick={() => handleRunFullPipeline(selectedProduct.id)}
                            disabled={runningPipelineId === selectedProduct.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow transition-all disabled:opacity-50"
                          >
                            {runningPipelineId === selectedProduct.id
                              ? 'Writing listings...'
                              : '⚡ Regenerate Listings'}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleRunAnalysis(selectedProduct.id)}
                            disabled={analyzingId === selectedProduct.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white shadow transition-all disabled:opacity-50"
                          >
                            {analyzingId === selectedProduct.id
                              ? 'Analyzing...'
                              : 'Re-analyze Product'}
                          </button>
                        </div>
                      </div>
                      )}

                      {/* Structured Analysis Content */}
                      {selectedProduct.analysis ? (
                        <div className="space-y-4">
                          {/* Unverified Claims Guardrail Alert */}
                          {selectedProduct.analysis.market_insights?.unverified_claims &&
                            selectedProduct.analysis.market_insights.unverified_claims.length > 0 && (
                              <div className="space-y-2">
                                {selectedProduct.analysis.market_insights.unverified_claims.map((claim, idx) => (
                                  <div
                                    key={idx}
                                    className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-sm"
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm flex-shrink-0">⚠️</span>
                                      <span>
                                        <strong>Unverified Claim:</strong> &ldquo;{claim.claim}&rdquo; &rarr; softened to &ldquo;<em>{claim.softened}</em>&rdquo;
                                      </span>
                                    </div>
                                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-100 text-amber-700 self-start sm:self-center flex-shrink-0">
                                      Claim Softened
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}

                          {/* Thin Input Suggested Questions */}
                          {selectedProduct.analysis.market_insights?.suggested_questions &&
                            selectedProduct.analysis.market_insights.suggested_questions.length > 0 && (
                              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3.5 text-xs text-indigo-700 space-y-2 shadow-sm">
                                <div className="flex items-center gap-1.5 font-bold text-indigo-700">
                                  <span>💡</span>
                                  <span>Add these details to get better listings:</span>
                                </div>
                                <ul className="list-disc list-inside space-y-1 text-slate-700 pl-1">
                                  {selectedProduct.analysis.market_insights.suggested_questions.map((q, idx) => (
                                    <li key={idx}>{q}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                          {/* Product Price Notice */}
                          {selectedProduct.analysis.market_insights?.price_warning && (
                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 flex items-center gap-2">
                              <span className="text-sm flex-shrink-0">⚠️</span>
                              <span>{selectedProduct.analysis.market_insights.price_warning}</span>
                            </div>
                          )}

                          {/* Category & Audience */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1">
                              <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold block">
                                Inferred Category
                              </span>
                              <span className="inline-block text-sm font-semibold text-purple-700 bg-purple-50 border border-purple-200 px-2.5 py-1 rounded-lg">
                                {selectedProduct.analysis.category ||
                                  'General Merchandise'}
                              </span>
                            </div>

                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1">
                              <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold block">
                                Target Demographic
                              </span>
                              <span className="text-sm text-slate-800">
                                {selectedProduct.analysis.target_audience ||
                                  'Value-conscious shoppers'}
                              </span>
                            </div>
                          </div>

                          {/* Key Selling Points */}
                          {selectedProduct.analysis.selling_points &&
                            selectedProduct.analysis.selling_points.length > 0 && (
                              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
                                <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold block">
                                  Key Value Propositions
                                </span>
                                <ul className="space-y-1.5 text-xs sm:text-sm text-slate-700">
                                  {selectedProduct.analysis.selling_points.map(
                                    (point, idx) => (
                                      <li
                                        key={idx}
                                        className="flex items-start gap-2"
                                      >
                                        <svg
                                          className="w-4 h-4 text-emerald-700 flex-shrink-0 mt-0.5"
                                          fill="none"
                                          stroke="currentColor"
                                          viewBox="0 0 24 24"
                                        >
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth="2.5"
                                            d="M5 13l4 4L19 7"
                                          />
                                        </svg>
                                        <span>{point}</span>
                                      </li>
                                    )
                                  )}
                                </ul>
                              </div>
                            )}

                          {/* SEO Keywords */}
                          {selectedProduct.analysis.suggested_keywords &&
                            selectedProduct.analysis.suggested_keywords.length >
                              0 && (
                              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                                    High-Intent SEO Keywords (Click to copy)
                                  </span>
                                  {copiedKeyword && (
                                    <span className="text-[11px] text-emerald-700 font-medium animate-pulse">
                                      Copied &ldquo;{copiedKeyword}&rdquo;!
                                    </span>
                                  )}
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                  {selectedProduct.analysis.suggested_keywords.map(
                                    (kw, idx) => (
                                      <button
                                        key={idx}
                                        type="button"
                                        onClick={() => handleCopyKeyword(kw)}
                                        className="text-xs bg-white hover:bg-slate-100 text-indigo-700 hover:text-slate-900 border border-slate-200 hover:border-indigo-400 px-2.5 py-1 rounded-md transition-colors font-mono"
                                      >
                                        #{kw}
                                      </button>
                                    )
                                  )}
                                </div>
                              </div>
                            )}

                          {/* Raw Summary */}
                          {selectedProduct.analysis.raw_summary && (
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1">
                              <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold block">
                                Profiling Summary
                              </span>
                              <p className="text-xs text-slate-700 leading-relaxed font-mono">
                                {selectedProduct.analysis.raw_summary}
                              </p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-center py-8 space-y-3 bg-slate-50 rounded-xl border border-slate-200 border-dashed">
                          <p className="text-sm text-slate-500">
                            This product has not been analyzed yet.
                          </p>
                          <button
                            type="button"
                            onClick={() => handleRunAnalysis(selectedProduct.id)}
                            disabled={analyzingId === selectedProduct.id}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow"
                          >
                            Run Agent 1 Analysis Now
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-10 text-slate-500 text-sm">
                      Fill in the product details form, or pick a saved product below, to see its profile here.
                    </div>
                  )}
                </div>

                {/* Agent 2 Card: Market Strategy */}
                {selectedProduct && (
                  <MarketStrategyCard
                    product={selectedProduct}
                    onRunMarketAnalysis={handleRunMarketAnalysis}
                    isRunning={runningMarketId === selectedProduct.id}
                  />
                )}

                {/* Agent 3 Card: Multi-Platform Listings */}
                {selectedProduct && (
                  <ListingPreview
                    product={selectedProduct}
                    selectedPlatform={selectedPlatform}
                    onSelectPlatform={setSelectedPlatform}
                    onRunFullPipeline={handleRunFullPipeline}
                    isRunningPipeline={runningPipelineId === selectedProduct.id}
                    copied={copied}
                    setCopied={setCopied}
                    apiUrl={apiUrl}
                    onListingUpdated={fetchProducts}
                  />
                )}
              </div>
            </div>

            {/* Bottom Saved Products Catalog */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Your Saved Products
                  </h3>
                  <p className="text-xs text-slate-600">
                    {productsLoaded
                      ? `${products.length} product${products.length === 1 ? '' : 's'} saved. Click one to view its listings.`
                      : 'Loading your products...'}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="search"
                    aria-label="Search saved products"
                    placeholder="Search products..."
                    value={catalogSearch}
                    onChange={(e) => setCatalogSearch(e.target.value)}
                    className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 w-44 sm:w-60"
                  />
                  <button
                    type="button"
                    onClick={fetchProducts}
                    disabled={productsLoading}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 transition-colors disabled:opacity-50"
                  >
                    <svg
                      className={`w-3.5 h-3.5 ${
                        productsLoading ? 'animate-spin' : ''
                      }`}
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
                    <span>{productsLoading ? 'Refreshing...' : 'Refresh'}</span>
                  </button>
                </div>
              </div>

              {productsError && !productsLoading ? (
                <div
                  role="alert"
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-rose-50 border border-rose-200 rounded-xl p-4 text-sm text-rose-800"
                >
                  <span>
                    <strong>Couldn&apos;t load your products.</strong> {productsError}
                  </span>
                  <button
                    type="button"
                    onClick={fetchProducts}
                    className="self-start sm:self-center px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-rose-300 text-rose-800 hover:bg-rose-100"
                  >
                    Try again
                  </button>
                </div>
              ) : !productsLoaded ? (
                <div
                  className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3"
                  aria-busy="true"
                  aria-label="Loading saved products"
                >
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="rounded-xl p-4 border border-slate-200 bg-slate-50 space-y-3 animate-pulse"
                    >
                      <div className="h-4 w-2/3 rounded bg-slate-200" />
                      <div className="h-3 w-1/2 rounded bg-slate-200" />
                    </div>
                  ))}
                </div>
              ) : filteredCatalog.length === 0 ? (
                <div className="text-center py-8 text-sm text-slate-600">
                  {catalogSearch
                    ? `No products match "${catalogSearch}".`
                    : 'You have no saved products yet. Fill in the product details form above to create your first listing.'}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredCatalog.map((p) => {
                    const isSelected = selectedProduct?.id === p.id;
                    const hasListings = p.listings && p.listings.length > 0;
                    return (
                      <div
                        key={p.id}
                        className={`relative rounded-xl border transition-all ${
                          isSelected
                            ? 'bg-indigo-50 border-indigo-500 shadow-sm ring-1 ring-indigo-500'
                            : 'bg-slate-50 border-slate-200 hover:border-indigo-300 hover:bg-white'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => handleSelectFromCatalog(p)}
                          aria-current={isSelected ? 'true' : undefined}
                          className="w-full text-left p-4 pr-12 space-y-2 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <h4 className="font-bold text-sm text-slate-900 truncate" title={p.name}>
                              {p.name}
                            </h4>
                            <span
                              className={`text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${
                                p.status === 'completed' || hasListings
                                  ? 'bg-cyan-50 text-cyan-800 border border-cyan-200'
                                  : p.status === 'analyzed'
                                  ? 'bg-purple-50 text-purple-800 border border-purple-200'
                                  : 'bg-amber-50 text-amber-800 border border-amber-200'
                              }`}
                            >
                              {p.status === 'completed' || hasListings
                                ? 'Listings ready'
                                : p.status === 'analyzed'
                                ? 'Analyzed'
                                : 'Draft'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-2 text-xs text-slate-600">
                            <span className="font-mono text-emerald-800 font-semibold">
                              ₱{Number(p.price).toFixed(2)}
                            </span>
                            <span className="font-mono">Qty: {p.quantity}</span>
                            <span className="truncate max-w-[140px]">
                              {p.analysis?.category || 'Uncategorized'}
                            </span>
                          </div>
                        </button>
                        <button
                          type="button"
                          title="Delete product"
                          aria-label={`Delete ${p.name}`}
                          onClick={() => handleDeleteProduct(p.id)}
                          className="absolute top-2.5 right-2.5 p-2 rounded-lg text-slate-500 hover:text-rose-700 hover:bg-rose-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 transition-colors"
                        >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                aria-hidden="true"
                                className="w-4 h-4"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6l-1 14H6L5 6" />
                                <path d="M10 11v6M14 11v6" />
                                <path d="M9 6V4h6v2" />
                              </svg>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ========================================================================= */
          /* DEVOPS: LIVE HEALTH MONITOR                                               */
          /* ========================================================================= */
          <div className="max-w-3xl mx-auto space-y-6">
            <header className="text-center space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-600 border border-indigo-200">
                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
                DevOps &amp; Infrastructure
              </div>
              <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">
                Live System Health Monitor
              </h2>
              <p className="text-sm text-slate-500">
                React Vite frontend monitoring FastAPI backend &amp; Neon PostgreSQL health
              </p>
            </header>

            {/* Configuration Card */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-sm backdrop-blur">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs sm:text-sm">
                <div>
                  <span className="text-slate-500 font-medium">Target Health URL:</span>{' '}
                  <code className="text-indigo-700 bg-white px-2 py-1 rounded border border-slate-200 break-all font-mono">
                    {healthEndpoint}
                  </code>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">Last checked:</span>
                  <span className="font-mono text-slate-800">
                    {lastChecked || 'Not checked yet'}
                  </span>
                </div>
              </div>
            </div>

            {/* Status Metrics Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* HTTP Status */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1">
                <span className="text-xs uppercase tracking-wider text-slate-500 font-semibold block">
                  API Status
                </span>
                <div className="flex items-center gap-2">
                  <span
                    className={`w-3 h-3 rounded-full ${
                      healthLoading
                        ? 'bg-amber-500 animate-pulse'
                        : isHealthy
                        ? 'bg-emerald-500 '
                        : 'bg-rose-500 '
                    }`}
                  />
                  <span className="text-base font-semibold text-slate-900">
                    {healthLoading ? (isServerWakingUp ? 'Waking up server...' : 'Probing...') : isHealthy ? 'Healthy' : 'Degraded'}
                  </span>
                </div>
              </div>

              {/* Database Connection */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1">
                <span className="text-xs uppercase tracking-wider text-slate-500 font-semibold block">
                  Neon PostgreSQL
                </span>
                <div className="flex items-center gap-2">
                  <span
                    className={`w-3 h-3 rounded-full ${
                      healthLoading
                        ? 'bg-amber-500 animate-pulse'
                        : healthData?.database === 'connected'
                        ? 'bg-emerald-500 '
                        : 'bg-rose-500 '
                    }`}
                  />
                  <span className="text-base font-semibold text-slate-900">
                    {healthLoading
                      ? 'Verifying...'
                      : healthData?.database === 'connected'
                      ? 'Connected'
                      : 'Disconnected'}
                  </span>
                </div>
              </div>

              {/* Refresh Action */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-center">
                <button
                  type="button"
                  onClick={fetchHealth}
                  disabled={healthLoading}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-sm "
                >
                  {healthLoading ? (
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
                      <span>Checking...</span>
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
                      <span>Re-check Health</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Error Alert Box */}
            {healthError && (
              <div className="bg-rose-50 border border-rose-300 rounded-xl p-4 text-rose-800 text-sm space-y-1">
                <div className="flex items-center gap-2 font-semibold text-rose-700">
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
                <p className="font-mono text-xs text-rose-700 break-words pl-7">
                  {healthError}
                </p>
              </div>
            )}

            {/* Detailed Response Payload */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider text-slate-500 font-semibold">
                  Raw Health Payload
                </span>
                {statusCode && (
                  <span
                    className={`text-xs px-2 py-0.5 rounded font-mono font-medium ${
                      statusCode === 200
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}
                  >
                    HTTP {statusCode}
                  </span>
                )}
              </div>
              <pre className="bg-white rounded-lg p-4 font-mono text-xs sm:text-sm text-slate-700 overflow-x-auto border border-slate-200">
                {healthData
                  ? JSON.stringify(healthData, null, 2)
                  : healthError
                  ? JSON.stringify(
                      { error: healthError, target: healthEndpoint },
                      null,
                      2
                    )
                  : '// Waiting for response...'}
              </pre>
            </div>
          </div>
        )}
      </main>

      {/* Global Footer */}
      <footer className="border-t border-slate-200 bg-slate-50 py-4 px-4 text-center text-xs text-slate-500 space-y-1">
        <p>
          Online Seller Assistant &bull; Autonomous Multi-Agent AI System &bull; Sprint 3
        </p>
        <p className="text-[11px] text-slate-500 font-mono">
          FastAPI &bull; Neon PostgreSQL &bull; React Vite &bull; Tailwind CSS &bull; Render &bull; Vercel
        </p>
      </footer>
    </div>
  );
}
