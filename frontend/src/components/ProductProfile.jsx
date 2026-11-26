import { Button, Notice, SectionHeading, Spinner } from './ui';
import Icon from './Icon';
import { formatSpecValue, humanizeKey } from '../lib/product';

export default function ProductProfile({ product, onRunAnalysis, isAnalyzing, busy, onNotify }) {
  const analysis = product.analysis;

  if (!analysis) {
    return (
      <div className="rounded-lg border border-dashed border-line px-6 py-10 text-center">
        <p className="text-sm font-medium">Not analyzed yet</p>
        <p className="mt-1 text-[13px] text-muted">
          We'll sort your notes into a category, key specs, selling points and keywords.
        </p>
        <Button variant="primary" className="mt-4" onClick={() => onRunAnalysis(product.id)} disabled={busy}>
          {isAnalyzing && <Spinner />}
          {isAnalyzing ? 'Analyzing…' : 'Analyze product'}
        </Button>
      </div>
    );
  }

  const insights = analysis.market_insights || {};
  const claims = insights.unverified_claims || [];
  const questions = insights.suggested_questions || [];
  const specs = Object.entries(analysis.key_specifications || {}).filter(
    ([, v]) => formatSpecValue(v) !== ''
  );
  const points = analysis.selling_points || [];
  const keywords = analysis.suggested_keywords || [];

  const copyKeyword = async (kw) => {
    try {
      await navigator.clipboard.writeText(kw);
      onNotify({ type: 'success', message: `Copied "${kw}".` });
    } catch {
      onNotify({ type: 'error', message: 'Copy failed. Select the text and copy it manually.' });
    }
  };

  return (
    <div className="space-y-8">
      {(claims.length > 0 || questions.length > 0 || insights.price_warning) && (
        <div className="space-y-2">
          {claims.map((c, i) => (
            <Notice key={i} tone="warning">
              We softened a claim: &ldquo;{c.claim}&rdquo; → &ldquo;{c.softened}&rdquo;
            </Notice>
          ))}
          {insights.price_warning && <Notice tone="warning">{insights.price_warning}</Notice>}
          {questions.length > 0 && (
            <Notice tone="info" title="Add these to get better listings:">
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                {questions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </Notice>
          )}
        </div>
      )}

      <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
        <div>
          <dt className="text-[13px] text-muted">Category</dt>
          <dd className="mt-0.5 text-sm">{analysis.category || 'Not identified'}</dd>
        </div>
        <div>
          <dt className="text-[13px] text-muted">Who it's for</dt>
          <dd className="mt-0.5 text-sm">{analysis.target_audience || 'Not identified'}</dd>
        </div>
      </dl>

      {specs.length > 0 && (
        <section>
          <SectionHeading>Key specs</SectionHeading>
          <dl className="divide-y divide-line border-y border-line">
            {specs.map(([k, v]) => (
              <div key={k} className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-4 py-2 text-sm">
                <dt className="text-muted">{humanizeKey(k)}</dt>
                <dd>{formatSpecValue(v)}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {points.length > 0 && (
        <section>
          <SectionHeading>Selling points</SectionHeading>
          <ul className="space-y-1.5">
            {points.map((p, i) => (
              <li key={i} className="flex gap-2 text-sm leading-relaxed">
                <Icon name="check" className="mt-0.5 h-4 w-4 text-emerald-700" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {keywords.length > 0 && (
        <section>
          <SectionHeading>Keywords (click to copy)</SectionHeading>
          <div className="flex flex-wrap gap-1.5">
            {keywords.map((kw, i) => (
              <button
                key={i}
                type="button"
                onClick={() => copyKeyword(kw)}
                className="inline-flex h-8 items-center gap-1.5 rounded border border-line bg-white px-2.5 text-[13px] transition-colors hover:border-stone-400"
              >
                {kw}
                <Icon name="copy" className="h-3 w-3 text-muted" />
              </button>
            ))}
          </div>
        </section>
      )}

      {analysis.raw_summary && (
        <section>
          <SectionHeading>Summary</SectionHeading>
          <p className="text-sm leading-relaxed text-muted">{analysis.raw_summary}</p>
        </section>
      )}
    </div>
  );
}
