import { useState, useEffect, useCallback, useMemo } from 'react';

// All app state and API calls. Components receive what they need from App.jsx.

const EMPTY_FORM = {
  name: '',
  price: '',
  quantity: '1',
  materials: '',
  features: '',
};

const rawApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
export const apiUrl = rawApiUrl.replace(/\/+$/, '');
const healthEndpoint = `${apiUrl}/health`;
const productsEndpoint = `${apiUrl}/api/products`;

const errorMessage = (err, fallback) => (err instanceof Error ? err.message : fallback);

const RATE_LIMIT_MESSAGE =
  'Too many requests. You can create listings 5 times a minute. Wait a minute and try again.';

async function readError(res, fallback) {
  if (res.status === 429) return new Error(RATE_LIMIT_MESSAGE);
  const body = await res.json().catch(() => null);
  const detail = Array.isArray(body?.detail)
    ? body.detail.map((d) => d.msg).join('; ')
    : body?.detail;
  return new Error(detail || `${fallback} (HTTP ${res.status})`);
}

export default function useSellerAssistant() {
  // Health
  const [healthData, setHealthData] = useState(null);
  const [statusCode, setStatusCode] = useState(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [healthError, setHealthError] = useState(null);
  const [lastChecked, setLastChecked] = useState(null);
  const [isServerWakingUp, setIsServerWakingUp] = useState(false);

  // Products
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsLoaded, setProductsLoaded] = useState(false);
  const [productsError, setProductsError] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [editingProductId, setEditingProductId] = useState(null);

  // Runs
  const [submitting, setSubmitting] = useState(false);
  const [analyzingId, setAnalyzingId] = useState(null);
  const [runningMarketId, setRunningMarketId] = useState(null);
  const [runningPipelineId, setRunningPipelineId] = useState(null);
  const [notification, setNotification] = useState(null);

  // Execution logs
  const [agentLogs, setAgentLogs] = useState([]);
  const [isExecutingLogs, setIsExecutingLogs] = useState(false);

  // Form
  const [formData, setFormData] = useState(EMPTY_FORM);

  const priceSanityWarning = useMemo(() => {
    const name = (formData.name || '').toLowerCase();
    const priceNum = parseFloat(formData.price);
    if (Number.isNaN(priceNum)) return null;
    if ((name.includes('smartwatch') || name.includes('watch')) && priceNum < 100) {
      return `₱${priceNum.toFixed(2)} is unusually low for a smartwatch (typical range in the Philippines is ₱350 to ₱3,500). Check the price.`;
    }
    if (name.includes('laptop') && priceNum < 1500) {
      return `₱${priceNum.toFixed(2)} is unusually low for a laptop. Check the price.`;
    }
    if (name.includes('phone') && priceNum < 800) {
      return `₱${priceNum.toFixed(2)} is unusually low for a smartphone. Check the price.`;
    }
    return null;
  }, [formData.name, formData.price]);

  const fetchHealth = useCallback(async () => {
    setHealthLoading(true);
    setHealthError(null);
    try {
      const response = await fetch(healthEndpoint, { headers: { Accept: 'application/json' } });
      setStatusCode(response.status);
      const data = await response.json().catch(() => null);
      setHealthData(data);
      setHealthError(
        response.ok ? null : data?.error || `The server responded with HTTP ${response.status}.`
      );
    } catch (err) {
      setStatusCode(null);
      setHealthData(null);
      setHealthError(errorMessage(err, 'Could not reach the server.'));
    } finally {
      setHealthLoading(false);
      setLastChecked(new Date());
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    setProductsLoading(true);
    try {
      const response = await fetch(productsEndpoint, { headers: { Accept: 'application/json' } });
      if (!response.ok) {
        setProductsError(`The server responded with an error (HTTP ${response.status}).`);
        return;
      }
      const data = await response.json();
      const incoming = data.products || [];
      setProducts(incoming);
      // Never pick a product automatically: the app starts on the New product form,
      // so a first-time seller isn't dropped into someone else's listing. A refresh
      // keeps whatever the seller already selected.
      setSelectedProduct((current) =>
        current ? incoming.find((p) => p.id === current.id) || current : null
      );
      setProductsError(null);
      setProductsLoaded(true);
    } catch (err) {
      console.warn('Unable to load product list:', err);
      setProductsError('Could not reach the server. Check your connection and try again.');
    } finally {
      setProductsLoading(false);
    }
  }, []);

  // First load: show "waking up" if the server takes longer than 5s (free-tier cold start).
  useEffect(() => {
    let finished = false;
    const timer = setTimeout(() => {
      if (!finished) setIsServerWakingUp(true);
    }, 5000);
    Promise.allSettled([fetchHealth(), fetchProducts()]).finally(() => {
      finished = true;
      clearTimeout(timer);
      setIsServerWakingUp(false);
    });
    return () => {
      finished = true;
      clearTimeout(timer);
    };
  }, [fetchHealth, fetchProducts]);

  // Keep the log panel in sync with the selected product.
  useEffect(() => {
    if (selectedProduct?.analysis?.execution_logs) {
      setAgentLogs(selectedProduct.analysis.execution_logs);
    } else if (!isExecutingLogs) {
      setAgentLogs([]);
    }
  }, [selectedProduct, isExecutingLogs]);

  const addProgressLog = (agent, stage, message, level = 'INFO') => {
    setAgentLogs((prev) => [
      ...prev,
      { timestamp: new Date().toISOString(), agent, stage, level, message },
    ]);
  };

  const applyUpdatedProduct = (updated) => {
    setSelectedProduct(updated);
    if (updated?.analysis?.execution_logs) setAgentLogs(updated.analysis.execution_logs);
  };

  const startNewProduct = useCallback(() => {
    setEditingProductId(null);
    setSelectedProduct(null);
  }, []);

  const selectProduct = useCallback((product) => {
    setEditingProductId(null);
    setSelectedProduct(product);
  }, []);

  const handleProductSaved = useCallback((updated) => {
    setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    setSelectedProduct((current) => (current?.id === updated.id ? updated : current));
    setEditingProductId(null);
    setNotification({
      type: 'success',
      message: updated.analysis
        ? 'Details saved. Regenerate listings so they use the new details.'
        : 'Details saved.',
    });
  }, []);

  const handleDeleteProduct = useCallback(async (product) => {
    if (!window.confirm(`Delete "${product.name}" and all its listings? This cannot be undone.`)) {
      return;
    }
    try {
      const res = await fetch(`${productsEndpoint}/${product.id}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) throw await readError(res, 'Could not delete the product');
      setSelectedProduct((current) => (current?.id === product.id ? null : current));
      setProducts((prev) => prev.filter((p) => p.id !== product.id));
      setNotification({ type: 'success', message: `Deleted "${product.name}".` });
    } catch (err) {
      setNotification({ type: 'error', message: errorMessage(err, 'Could not delete the product.') });
    }
  }, []);

  const loadSample = (sample) => {
    setFormData({
      name: sample.name,
      price: sample.price,
      quantity: sample.quantity,
      materials: sample.materials,
      features: sample.features,
    });
  };

  const validateForm = () => {
    if (!formData.name.trim() || !formData.price) {
      setNotification({ type: 'error', message: 'Product name and price are required.' });
      return false;
    }
    return true;
  };

  const createProduct = async () => {
    const res = await fetch(productsEndpoint, {
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
    if (!res.ok) throw await readError(res, 'Could not save the product');
    return res.json();
  };

  const handleRunAnalysis = async (productId) => {
    setAnalyzingId(productId);
    setIsExecutingLogs(true);
    setNotification(null);
    addProgressLog('Agent 1: Product Analyzer', 'INGEST', 'Reading product details...');
    try {
      const res = await fetch(`${productsEndpoint}/${productId}/analyze`, {
        method: 'POST',
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) throw await readError(res, 'Analysis failed');
      const updated = await res.json();
      applyUpdatedProduct(updated);
      setNotification({ type: 'success', message: 'Product analyzed.' });
      await fetchProducts();
      return updated;
    } catch (err) {
      const msg = errorMessage(err, 'Analysis failed.');
      addProgressLog('Agent 1: Product Analyzer', 'ERROR', msg, 'ERROR');
      setNotification({ type: 'error', message: msg });
      return null;
    } finally {
      setAnalyzingId(null);
      setIsExecutingLogs(false);
    }
  };

  const handleRunMarketAnalysis = async (productId) => {
    setRunningMarketId(productId);
    setIsExecutingLogs(true);
    setNotification(null);
    addProgressLog('Agent 2: Market Analyzer', 'PRICE_TIER', 'Planning how to sell...');
    try {
      const res = await fetch(`${productsEndpoint}/${productId}/market-analysis`, {
        method: 'POST',
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) throw await readError(res, 'Planning the selling strategy failed');
      applyUpdatedProduct(await res.json());
      setNotification({ type: 'success', message: 'Selling strategy ready.' });
      await fetchProducts();
    } catch (err) {
      const msg = errorMessage(err, 'Planning the selling strategy failed.');
      addProgressLog('Agent 2: Market Analyzer', 'ERROR', msg, 'ERROR');
      setNotification({ type: 'error', message: msg });
    } finally {
      setRunningMarketId(null);
      setIsExecutingLogs(false);
    }
  };

  const handleRunFullPipeline = async (productId) => {
    // Same endpoint for a first run and a Regenerate; word errors for what the seller clicked.
    const isRegenerate =
      selectedProduct?.id === productId && (selectedProduct.listings?.length ?? 0) > 0;
    const failedMessage = isRegenerate ? 'Regenerating listings failed' : 'Creating listings failed';
    setRunningPipelineId(productId);
    setIsExecutingLogs(true);
    setNotification(null);
    addProgressLog('Pipeline Orchestrator', 'INIT', 'Starting: understand, plan, write.');
    try {
      const res = await fetch(`${productsEndpoint}/${productId}/full-pipeline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw await readError(res, failedMessage);
      const data = await res.json();
      setSelectedProduct(data.product);
      if (data.logs && data.logs.length > 0) setAgentLogs(data.logs);
      else if (data.product?.analysis?.execution_logs) setAgentLogs(data.product.analysis.execution_logs);
      setNotification({
        type: 'success',
        message: 'Listings ready for Shopee, TikTok Shop and Lazada.',
      });
      await fetchProducts();
    } catch (err) {
      const msg = errorMessage(err, `${failedMessage}.`);
      addProgressLog('Pipeline Orchestrator', 'ERROR', msg, 'ERROR');
      setNotification({ type: 'error', message: msg });
    } finally {
      setRunningPipelineId(null);
      setIsExecutingLogs(false);
    }
  };

  const handleCreateAndAnalyze = async () => {
    if (!validateForm()) return;
    setSubmitting(true);
    setAgentLogs([]);
    try {
      const created = await createProduct();
      setSelectedProduct(created);
      setFormData(EMPTY_FORM);
      await handleRunAnalysis(created.id);
    } catch (err) {
      setNotification({ type: 'error', message: errorMessage(err, 'Could not save the product.') });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateAndRunFullPipeline = async () => {
    if (!validateForm()) return;
    setSubmitting(true);
    setAgentLogs([]);
    try {
      const created = await createProduct();
      setSelectedProduct(created);
      setFormData(EMPTY_FORM);
      await handleRunFullPipeline(created.id);
    } catch (err) {
      setNotification({ type: 'error', message: errorMessage(err, 'Could not save the product.') });
    } finally {
      setSubmitting(false);
    }
  };

  const isHealthy = statusCode === 200 && healthData?.status === 'healthy';
  const isBusy = submitting || analyzingId !== null || runningMarketId !== null || runningPipelineId !== null;

  return {
    apiUrl,
    // health
    healthData,
    healthLoading,
    healthError,
    lastChecked,
    isServerWakingUp,
    isHealthy,
    fetchHealth,
    // products
    products,
    productsLoading,
    productsLoaded,
    productsError,
    fetchProducts,
    selectedProduct,
    selectProduct,
    startNewProduct,
    editingProductId,
    setEditingProductId,
    handleProductSaved,
    handleDeleteProduct,
    // form
    formData,
    setFormData,
    loadSample,
    priceSanityWarning,
    // runs
    submitting,
    analyzingId,
    runningMarketId,
    runningPipelineId,
    isBusy,
    handleCreateAndAnalyze,
    handleCreateAndRunFullPipeline,
    handleRunAnalysis,
    handleRunMarketAnalysis,
    handleRunFullPipeline,
    // logs + notifications
    agentLogs,
    clearLogs: () => setAgentLogs([]),
    isExecutingLogs,
    notification,
    setNotification,
  };
}
