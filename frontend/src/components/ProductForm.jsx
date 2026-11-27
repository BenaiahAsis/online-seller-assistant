import { Button, Notice, Spinner } from './ui';
import { FEATURES_MAX_LENGTH } from '../lib/product';
import { SAMPLE_PRODUCTS } from '../lib/samples';

export default function ProductForm({
  formData,
  setFormData,
  onLoadSample,
  priceWarning,
  onCreateListings,
  onAnalyzeOnly,
  busy,
  submitting,
  serverState,
}) {
  const set = (field) => (e) => setFormData({ ...formData, [field]: e.target.value });
  const atLimit = formData.features.length >= FEATURES_MAX_LENGTH;

  const serverLine = {
    waking: 'Server is waking up. This can take up to a minute.',
    down: "Can't reach the server right now.",
  }[serverState];

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onCreateListings();
      }}
      className="space-y-5"
    >
      <div>
        <h1 className="text-xl font-semibold tracking-tight">New product</h1>
        <p className="mt-1 text-sm text-muted">
          Rough notes are fine. Paste what your supplier gave you.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 text-[13px]">
        <span className="mr-1 text-muted">Try an example:</span>
        {SAMPLE_PRODUCTS.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => onLoadSample(s)}
            className="rounded border border-line bg-white px-2 py-1 text-ink transition-colors hover:border-stone-400"
          >
            {s.label}
          </button>
        ))}
      </div>

      <div>
        <label htmlFor="product-name" className="field-label">
          Product name <span className="text-red-700">*</span>
        </label>
        <input
          id="product-name"
          type="text"
          required
          maxLength={255}
          placeholder="e.g. Bamboo wireless mechanical keyboard"
          value={formData.name}
          onChange={set('name')}
          className="field"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="product-price" className="field-label">
            Price (₱) <span className="text-red-700">*</span>
          </label>
          <input
            id="product-price"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0.01"
            required
            placeholder="899"
            value={formData.price}
            onChange={set('price')}
            className="field tabular-nums"
          />
        </div>
        <div>
          <label htmlFor="product-quantity" className="field-label">Stock</label>
          <input
            id="product-quantity"
            type="number"
            inputMode="numeric"
            min="1"
            required
            value={formData.quantity}
            onChange={set('quantity')}
            className="field tabular-nums"
          />
        </div>
      </div>

      {priceWarning && <Notice tone="warning">{priceWarning}</Notice>}

      <div>
        <label htmlFor="product-materials" className="field-label">Materials</label>
        <input
          id="product-materials"
          type="text"
          maxLength={500}
          placeholder="e.g. Bamboo case, ABS keycaps, aluminum frame"
          value={formData.materials}
          onChange={set('materials')}
          className="field"
        />
      </div>

      <div>
        <label htmlFor="product-features" className="field-label">Notes from your supplier</label>
        <textarea
          id="product-features"
          rows={7}
          maxLength={FEATURES_MAX_LENGTH}
          aria-describedby="product-features-count"
          placeholder="Specs, dimensions, battery life, what's in the box, warranty..."
          value={formData.features}
          onChange={set('features')}
          className="field resize-y leading-relaxed"
        />
        <p
          id="product-features-count"
          className={`mt-1 text-right text-xs tabular-nums ${atLimit ? 'font-medium text-red-700' : 'text-muted'}`}
        >
          {formData.features.length.toLocaleString()} / {FEATURES_MAX_LENGTH.toLocaleString()}
        </p>
      </div>

      <div className="space-y-2">
        <Button type="submit" variant="primary" size="lg" className="w-full" disabled={busy}>
          {submitting ? (
            <>
              <Spinner />
              Saving…
            </>
          ) : (
            'Create listings'
          )}
        </Button>
        <Button variant="ghost" className="w-full" onClick={onAnalyzeOnly} disabled={busy}>
          Just analyze, no listings yet
        </Button>
        {serverLine && (
          <p role="status" className="text-center text-xs text-muted">
            {serverLine}
          </p>
        )}
      </div>
    </form>
  );
}
