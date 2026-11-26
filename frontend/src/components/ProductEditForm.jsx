import { useState } from 'react';
import { Button, Notice, Spinner } from './ui';
import { FEATURES_MAX_LENGTH } from '../lib/product';

// Edit a saved product's details (PATCH /api/products/{id}).
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
        const detail = Array.isArray(body?.detail) ? body.detail.map((d) => d.msg).join('; ') : body?.detail;
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
    <form onSubmit={handleSubmit} aria-label={`Edit details for ${product.name}`} className="space-y-4 rounded-lg border border-line bg-white p-5">
      <h2 className="text-base font-semibold">Edit product details</h2>

      <div>
        <label htmlFor="edit-name" className="field-label">
          Product name <span className="text-red-700">*</span>
        </label>
        <input id="edit-name" type="text" maxLength={255} required value={form.name} onChange={update('name')} className="field" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="edit-price" className="field-label">
            Price (₱) <span className="text-red-700">*</span>
          </label>
          <input id="edit-price" type="number" step="0.01" min="0.01" required value={form.price} onChange={update('price')} className="field tabular-nums" />
        </div>
        <div>
          <label htmlFor="edit-quantity" className="field-label">Stock</label>
          <input id="edit-quantity" type="number" min="1" step="1" value={form.quantity} onChange={update('quantity')} className="field tabular-nums" />
        </div>
      </div>

      <div>
        <label htmlFor="edit-materials" className="field-label">Materials</label>
        <input id="edit-materials" type="text" maxLength={500} value={form.materials} onChange={update('materials')} className="field" />
      </div>

      <div>
        <label htmlFor="edit-features" className="field-label">Notes from your supplier</label>
        <textarea id="edit-features" rows={5} maxLength={FEATURES_MAX_LENGTH} value={form.features} onChange={update('features')} className="field leading-relaxed" />
        <p className="mt-1 text-right text-xs tabular-nums text-muted">
          {form.features.length.toLocaleString()} / {FEATURES_MAX_LENGTH.toLocaleString()}
        </p>
      </div>

      {error && <Notice tone="error" role="alert">{error}</Notice>}

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant="primary" disabled={saving}>
          {saving && <Spinner />}
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </form>
  );
}
