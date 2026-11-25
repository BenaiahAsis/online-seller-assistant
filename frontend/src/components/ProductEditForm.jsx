import { useState } from 'react';

// Keep in sync with ProductUpdate in backend/app/schemas.py
const FEATURES_MAX_LENGTH = 2000;

const inputClass =
  'w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500';

export default function ProductEditForm({ product, apiUrl, onSaved, onCancel }) {
  const [form, setForm] = useState({
    name: product.name || '',
    price: String(product.price ?? ''),
    quantity: String(product.quantity ?? '1'),
    materials: product.materials || '',
    features: product.features || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    const price = parseFloat(form.price);
    const quantity = parseInt(form.quantity, 10);
    if (!form.name.trim()) return setError('Product name is required.');
    if (!(price > 0)) return setError('Price must be greater than 0.');
    if (!(quantity >= 1)) return setError('Stock must be at least 1.');

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${apiUrl}/api/products/${product.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          price,
          quantity,
          materials: form.materials.trim(),
          features: form.features.trim(),
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        const detail = Array.isArray(body?.detail)
          ? body.detail.map((d) => d.msg).join('; ')
          : body?.detail;
        setError(`Changes not saved${detail ? `: ${detail}` : ` (HTTP ${res.status})`}.`);
        return;
      }
      onSaved(body);
    } catch {
      setError('Changes not saved: could not reach the server. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      aria-label={`Edit details for ${product.name}`}
      className="bg-white border border-indigo-300 rounded-xl p-4 space-y-3"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900">Edit product details</h3>
        <span className="text-xs text-slate-500 font-mono">ID #{product.id}</span>
      </div>

      <div className="space-y-1">
        <label htmlFor="edit-name" className="text-xs font-semibold text-slate-700 block">
          Product Title / Name <span className="text-rose-600">*</span>
        </label>
        <input id="edit-name" type="text" maxLength={255} required value={form.name} onChange={update('name')} className={inputClass} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label htmlFor="edit-price" className="text-xs font-semibold text-slate-700 block">
            Price (₱) <span className="text-rose-600">*</span>
          </label>
          <input id="edit-price" type="number" step="0.01" min="0.01" required value={form.price} onChange={update('price')} className={`${inputClass} font-mono`} />
        </div>
        <div className="space-y-1">
          <label htmlFor="edit-quantity" className="text-xs font-semibold text-slate-700 block">
            Stock Units
          </label>
          <input id="edit-quantity" type="number" min="1" step="1" value={form.quantity} onChange={update('quantity')} className={`${inputClass} font-mono`} />
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="edit-materials" className="text-xs font-semibold text-slate-700 block">
          Materials / Composition
        </label>
        <input id="edit-materials" type="text" maxLength={500} value={form.materials} onChange={update('materials')} className={inputClass} />
      </div>

      <div className="space-y-1">
        <label htmlFor="edit-features" className="text-xs font-semibold text-slate-700 block">
          Raw Features &amp; Unorganized Notes
        </label>
        <textarea id="edit-features" rows={4} maxLength={FEATURES_MAX_LENGTH} value={form.features} onChange={update('features')} className={inputClass} />
        <p className="text-xs text-right text-slate-500">
          {form.features.length.toLocaleString()} / {FEATURES_MAX_LENGTH.toLocaleString()} characters
        </p>
      </div>

      {error && (
        <p role="alert" className="text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900">
          Cancel
        </button>
        <button type="submit" disabled={saving} className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow disabled:opacity-50">
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
}
