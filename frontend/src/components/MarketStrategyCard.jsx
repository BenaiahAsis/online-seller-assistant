import { useState } from 'react';
import { Button, SectionHeading, SegmentedControl, Spinner } from './ui';
import { PLATFORMS, PLATFORM_LABEL, PRICE_TIERS, tierIndex } from '../lib/product';

// "Selling strategy" tab: Agent 2 output (product.analysis.market_insights).
export default function MarketStrategyCard({ product, onRunMarketAnalysis, isRunning = false, busy }) {
  const [platform, setPlatform] = useState('shopee');

  const insights = product.analysis?.market_insights;
  const hasStrategy = Boolean(insights?.price_tier || insights?.platform_strategies);

  if (!hasStrategy) {
    return (
      <div className="rounded-lg border border-dashed border-line px-6 py-10 text-center">
        <p className="text-sm font-medium">Not planned yet</p>
        <p className="mt-1 text-[13px] text-muted">
          Where your price sits, what makes buyers hesitate, and how to pitch on each platform.
        </p>
        <Button variant="primary" className="mt-4" onClick={() => onRunMarketAnalysis(product.id)} disabled={busy}>
          {isRunning && <Spinner />}
          {isRunning ? 'Planning…' : 'Plan selling strategy'}
        </Button>
      </div>
    );
  }

  const tier = tierIndex(insights.price_tier);
  const priorityPoints = insights.priority_points || [];
  const objections = insights.buyer_objections || [];
  const strategies = insights.platform_strategies || {};
  const strategy = strategies[platform];
  const availablePlatforms = PLATFORMS.filter((p) => strategies[p.id]);

  return (
    <div className="space-y-8">
      <section>
        <SectionHeading>Price level</SectionHeading>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-6">
          <div className="flex shrink-0 items-center gap-3" aria-label={`Price level: ${PRICE_TIERS[tier] || insights.price_tier}`}>
            {PRICE_TIERS.map((label, i) => (
              <div key={label} className="flex flex-col items-center gap-1">
                <span className={`h-1.5 w-14 rounded-full ${i === tier ? 'bg-ink' : 'bg-stone-200'}`} />
                <span className={`text-xs ${i === tier ? 'font-medium text-ink' : 'text-muted'}`}>{label}</span>
              </div>
            ))}
          </div>
          {insights.price_rationale && <p className="text-sm leading-relaxed">{insights.price_rationale}</p>}
        </div>
      </section>

      {priorityPoints.length > 0 && (
        <section>
          <SectionHeading>What to highlight</SectionHeading>
          <ol className="divide-y divide-line border-y border-line">
            {priorityPoints.map((pt, i) => (
              <li key={i} className="flex flex-col gap-1.5 py-2.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div className="flex gap-3 text-sm">
                  <span className="w-4 shrink-0 tabular-nums text-muted">{i + 1}</span>
                  <span>{pt.point}</span>
                </div>
                {pt.platforms?.length > 0 && (
                  <div className="flex shrink-0 gap-1 pl-7 sm:pl-0">
                    {pt.platforms.map((p) => (
                      <span key={p} className="rounded bg-stone-100 px-1.5 py-0.5 text-xs text-stone-700">
                        {PLATFORM_LABEL[p?.toLowerCase()] || p}
                      </span>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}

      {objections.length > 0 && (
        <section>
          <SectionHeading>Buyer concerns</SectionHeading>
          <div className="divide-y divide-line border-y border-line">
            {objections.map((o, i) => (
              <div key={i} className="grid gap-1 py-3 text-sm sm:grid-cols-2 sm:gap-6">
                <p>
                  <span className="block text-xs text-muted">Concern</span>
                  {o.objection}
                </p>
                <p>
                  <span className="block text-xs text-muted">How to answer</span>
                  {o.response}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {availablePlatforms.length > 0 && (
        <section>
          <SectionHeading
            action={<SegmentedControl label="Platform" options={availablePlatforms} value={platform} onChange={setPlatform} />}
          >
            Pitch by platform
          </SectionHeading>
          {strategy ? (
            <dl className="mt-3 grid gap-x-8 gap-y-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-[13px] text-muted">Focus</dt>
                <dd className="mt-0.5">{strategy.focus}</dd>
              </div>
              <div>
                <dt className="text-[13px] text-muted">Tone</dt>
                <dd className="mt-0.5">{strategy.tone}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-[13px] text-muted">Angle</dt>
                <dd className="mt-0.5 leading-relaxed">{strategy.angle}</dd>
              </div>
              {strategy.keyword_emphasis?.length > 0 && (
                <div className="sm:col-span-2">
                  <dt className="text-[13px] text-muted">Keywords to emphasize</dt>
                  <dd className="mt-1.5 flex flex-wrap gap-1.5">
                    {strategy.keyword_emphasis.map((kw) => (
                      <span key={kw} className="rounded border border-line bg-white px-2 py-0.5 text-[13px]">
                        {kw}
                      </span>
                    ))}
                  </dd>
                </div>
              )}
            </dl>
          ) : (
            <p className="mt-3 text-sm text-muted">No pitch for this platform.</p>
          )}
        </section>
      )}
    </div>
  );
}
