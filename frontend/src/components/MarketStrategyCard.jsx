import { useState } from 'react';

export default function MarketStrategyCard({ product, onRunMarketAnalysis, isRunning = false }) {
  const [activePlatformTab, setActivePlatformTab] = useState('shopee');

  if (!product) return null;

  const marketInsights = product.analysis?.market_insights;
  const priceTier = marketInsights?.price_tier || 'Pending Evaluation';
  const priceRationale = marketInsights?.price_rationale;
  const priorityPoints = marketInsights?.priority_points || [];
  const buyerObjections = marketInsights?.buyer_objections || [];
  const strategies = marketInsights?.platform_strategies || {};

  const getTierColor = (tier = '') => {
    if (tier.includes('Budget')) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
    if (tier.includes('Mid-Tier')) {
      return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    }
    if (tier.includes('Premium')) {
      return 'bg-amber-50 text-amber-700 border-amber-200';
    }
    return 'bg-slate-100 text-slate-700 border-slate-300';
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
              Agent 2 &bull; Market Strategist
            </span>
            <span className="text-xs text-slate-500">Competitive Intelligence</span>
          </div>
          <h3 className="text-lg font-bold text-slate-900 mt-1">
            Market Positioning &amp; Channel Strategy
          </h3>
          <p className="text-xs text-slate-500">
            Price elasticity assessment, buyer hesitation resolution, and channel angles.
          </p>
        </div>

        {product.analysis && !marketInsights && (
          <button
            type="button"
            onClick={() => onRunMarketAnalysis && onRunMarketAnalysis(product.id)}
            disabled={isRunning}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white shadow transition-all disabled:opacity-50"
          >
            {isRunning ? 'Analyzing Market...' : 'Run Agent 2 Analysis'}
          </button>
        )}
      </div>

      {marketInsights ? (
        <div className="space-y-4">
          {/* Price Tier & Positioning Row */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold block">
                Regional Price Band Assessment
              </span>
              <p className="text-xs sm:text-sm text-slate-800">
                {priceRationale || 'Evaluated against Philippine e-commerce benchmarks.'}
              </p>
            </div>
            <div className="flex-shrink-0">
              <span
                className={`inline-block px-3 py-1 rounded-lg text-xs font-bold border ${getTierColor(
                  priceTier
                )}`}
              >
                🏷️ Tier: {priceTier}
              </span>
            </div>
          </div>

          {/* Priority Value Propositions */}
          {priorityPoints.length > 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
              <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold block">
                Ranked Value Propositions (Persuasive Weight)
              </span>
              <div className="space-y-2">
                {priorityPoints.map((pt, idx) => (
                  <div
                    key={idx}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs"
                  >
                    <div className="flex items-center gap-2 text-slate-800">
                      <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-[10px]">
                        {idx + 1}
                      </span>
                      <span>{pt.point}</span>
                    </div>
                    {pt.platforms && (
                      <div className="flex items-center gap-1">
                        {pt.platforms.map((p, pIdx) => (
                          <span
                            key={pIdx}
                            className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-700"
                          >
                            {p}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Buyer Hesitations & Counter-Angles */}
          {buyerObjections.length > 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
              <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold block">
                Buyer Psychological Hesitations &amp; Resolution Angles
              </span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {buyerObjections.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg bg-white border border-slate-200 space-y-1.5 text-xs"
                  >
                    <div className="flex items-center gap-1.5 text-rose-700 font-semibold">
                      <span>⚠️ Hesitation:</span>
                      <span className="line-clamp-1">{item.objection}</span>
                    </div>
                    <div className="text-slate-700 pl-4 border-l-2 border-indigo-300 leading-relaxed">
                      <span className="text-indigo-700 font-medium">Resolution Angle: </span>
                      {item.response}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Channel Strategy Tabs (Shopee / TikTok / Lazada) */}
          {Object.keys(strategies).length > 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                  Channel Marketing Angles
                </span>
                <div className="flex items-center gap-1.5">
                  {['shopee', 'tiktok', 'lazada'].map((plat) => (
                    <button
                      key={plat}
                      type="button"
                      onClick={() => setActivePlatformTab(plat)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-semibold uppercase transition-all ${
                        activePlatformTab === plat
                          ? 'bg-amber-600 text-white shadow-sm'
                          : 'text-slate-500 hover:text-slate-900 bg-white'
                      }`}
                    >
                      {plat}
                    </button>
                  ))}
                </div>
              </div>

              {strategies[activePlatformTab] && (
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">
                      Core Focus:{' '}
                      <strong className="text-slate-800">
                        {strategies[activePlatformTab].focus}
                      </strong>
                    </span>
                    <span className="text-slate-500">
                      Tone:{' '}
                      <strong className="text-amber-700 font-mono">
                        {strategies[activePlatformTab].tone}
                      </strong>
                    </span>
                  </div>
                  <p className="text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-200 leading-relaxed">
                    {strategies[activePlatformTab].angle}
                  </p>
                  {strategies[activePlatformTab].keyword_emphasis && (
                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                      <span className="text-[11px] text-slate-500">Emphasis Keywords:</span>
                      {strategies[activePlatformTab].keyword_emphasis.map((kw, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-50 text-indigo-700 border border-indigo-200"
                        >
                          #{kw}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-8 space-y-2 bg-slate-50 rounded-xl border border-slate-200 border-dashed">
          <p className="text-xs text-slate-500">
            Market intelligence has not been generated for this product yet.
          </p>
          <p className="text-[11px] text-slate-500">
            Execute the Full Pipeline or trigger Agent 2 to evaluate pricing tier and buyer psychology.
          </p>
        </div>
      )}
    </div>
  );
}
