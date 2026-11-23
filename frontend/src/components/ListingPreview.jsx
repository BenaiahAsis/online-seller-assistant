import { useState } from 'react';

const PLATFORMS = [
  {
    id: 'shopee',
    label: 'Shopee PH',
    badge: 'Search & Spec Optimized',
    icon: '🛍️',
    activeClass: 'bg-orange-700 text-white',
  },
  {
    id: 'tiktok',
    label: 'TikTok Shop',
    badge: 'Viral Hook & Hype',
    icon: '🎵',
    activeClass: 'bg-[#0f172a] text-white',
  },
  {
    id: 'lazada',
    label: 'Lazada LazMall',
    badge: 'Trust & Detail Block',
    icon: '📦',
    activeClass: 'bg-blue-600 text-white',
  },
];

export default function ListingPreview({
  product,
  selectedPlatform = 'shopee',
  onSelectPlatform,
  onRunFullPipeline,
  isRunningPipeline = false,
  copied = false,
  setCopied,
  apiUrl = 'http://localhost:8000',
  onListingUpdated,
}) {
  const [copiedPart, setCopiedPart] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  if (!product) return null;

  const listings = product.listings || [];
  const currentListing = listings.find(
    (item) => item.platform?.toLowerCase() === selectedPlatform?.toLowerCase()
  );

  const startEditing = () => {
    if (!currentListing) return;
    setEditTitle(currentListing.title);
    setEditDesc(currentListing.description);
    setIsEditing(true);
  };

  const handleSaveListing = async () => {
    if (!currentListing) return;
    setSavingEdit(true);
    try {
      const res = await fetch(`${apiUrl}/api/listings/${currentListing.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          title: editTitle.trim(),
          description: editDesc.trim(),
        }),
      });
      if (res.ok) {
        setIsEditing(false);
        if (onListingUpdated) onListingUpdated();
      }
    } catch (err) {
      console.error('Failed to update listing:', err);
    } finally {
      setSavingEdit(false);
    }
  };

  const currentListingText = currentListing
    ? `${currentListing.title}\n\n${currentListing.description}${
        currentListing.bullet_points && currentListing.bullet_points.length > 0
          ? '\n\nKey Highlights:\n' +
            currentListing.bullet_points.map((pt) => `• ${pt}`).join('\n')
          : ''
      }${
        currentListing.call_to_action
          ? `\n\n${currentListing.call_to_action}`
          : ''
      }${
        currentListing.hashtags && currentListing.hashtags.length > 0
          ? '\n\n' + currentListing.hashtags.join(' ')
          : ''
      }`
    : '';

  const handleCopyFull = async () => {
    if (!currentListingText) return;
    try {
      await navigator.clipboard.writeText(currentListingText);
    } catch {
      setCopiedPart('Copy failed: select the text and copy it manually.');
      setTimeout(() => setCopiedPart(null), 4000);
      return;
    }
    if (setCopied) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopySnippet = async (text, label) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedPart(`✓ ${label} copied!`);
    } catch {
      setCopiedPart('Copy failed: select the text and copy it manually.');
    }
    setTimeout(() => setCopiedPart(null), 2500);
  };

  const marketInsights = product.analysis?.market_insights;
  const isFallbackUsed =
    marketInsights?.source === 'heuristic' ||
    Boolean(
      (product.analysis?.execution_logs || []).some(
        (l) =>
          (l.agent?.includes('Agent 3') && l.stage === 'ENGINE_NOTICE') ||
          l.details?.fallback_used ||
          (l.agent?.includes('Agent 3') && l.source === 'heuristic')
      )
    );
  const platformStrategy =
    marketInsights?.platform_strategies &&
    marketInsights.platform_strategies[selectedPlatform?.toLowerCase()];

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm space-y-5">
      {/* Header bar with title and Full Pipeline trigger button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
              Agent 3
            </span>
            {isFallbackUsed && (
              <span
                title="The AI service was unavailable, so these listings were built from a standard template using your product details. Regenerate later for AI-written copy."
                className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1"
              >
                <span aria-hidden="true">⚠️</span> Template version (AI unavailable)
              </span>
            )}
          </div>
          <h3 className="text-lg font-bold text-slate-900 mt-1">
            Your Listings
          </h3>
          <p className="text-xs text-slate-600">
            Ready to copy and paste into Shopee, TikTok Shop, and Lazada.
          </p>
        </div>

        {/* Primary Action: Generate Full Pipeline */}
        <button
          type="button"
          onClick={() => onRunFullPipeline && onRunFullPipeline(product.id)}
          disabled={isRunningPipeline}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
        >
          {isRunningPipeline ? (
            <>
              <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Generating Listings...</span>
            </>
          ) : (
            <>
              <span className="text-sm">⚡</span>
              <span>Regenerate Listings</span>
            </>
          )}
        </button>
      </div>

      {/* Platform Switcher & Quick Copy Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        {/* Platform Selector Tabs */}
        <div className="flex items-center gap-2 flex-wrap">
          {PLATFORMS.map((platform) => {
            const isActive =
              selectedPlatform?.toLowerCase() === platform.id.toLowerCase();
            return (
              <button
                key={platform.id}
                type="button"
                aria-pressed={isActive}
                onClick={() => {
                  setIsEditing(false);
                  if (onSelectPlatform) onSelectPlatform(platform.id);
                }}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                  isActive
                    ? platform.activeClass
                    : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200 hover:border-slate-300'
                }`}
              >
                <span aria-hidden="true">{platform.icon}</span>
                <span>{platform.label}</span>
              </button>
            );
          })}
        </div>

        {/* Copy to Clipboard Actions */}
        {currentListing && (
          <div className="flex items-center gap-2 flex-wrap">
            {copiedPart && (
              <span role="status" className="text-xs text-emerald-800 font-medium">
                {copiedPart}
              </span>
            )}
            <button
              type="button"
              onClick={isEditing ? () => setIsEditing(false) : startEditing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border border-slate-300 transition-all"
            >
              {isEditing ? 'Cancel Edit' : '✏️ Edit Copy'}
            </button>
            <button
              type="button"
              onClick={handleCopyFull}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white transition-all shadow-sm active:scale-95"
            >
              {copied ? '✓ Copied to Clipboard!' : '📋 Copy Entire Listing'}
            </button>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {currentListing ? (
        <div className="space-y-4">
          {/* Agent 2 Strategy Callout */}
          {platformStrategy && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="space-y-0.5">
                <span className="text-[11px] uppercase tracking-wider font-semibold text-amber-700 flex items-center gap-1.5">
                  <span>💡 Channel Angle ({platformStrategy.focus})</span>
                </span>
                <p className="text-xs text-slate-700">{platformStrategy.angle}</p>
              </div>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 whitespace-nowrap self-start sm:self-center">
                Tone: {platformStrategy.tone}
              </span>
            </div>
          )}

          {/* Title Box */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                  Listing Title
                </span>
                <span className="text-[11px] text-slate-500 font-mono">
                  ({(isEditing ? editTitle : currentListing.title).length}/255 chars)
                </span>
              </div>
              {!isEditing && (
                <button
                  type="button"
                  onClick={() => handleCopySnippet(currentListing.title, 'Title')}
                  className="px-2.5 py-1 rounded-md text-xs font-semibold text-indigo-700 hover:bg-indigo-50 border border-indigo-200 transition-colors"
                >
                  Copy Title
                </button>
              )}
            </div>

            {isEditing ? (
              <input
                type="text"
                value={editTitle}
                maxLength={255}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full bg-white border border-indigo-500 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-sans"
              />
            ) : (
              <p className="text-sm sm:text-base font-bold text-slate-900 leading-snug">
                {currentListing.title}
              </p>
            )}
          </div>

          {/* Key Bullet Highlights */}
          {currentListing.bullet_points && currentListing.bullet_points.length > 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
              <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold block">
                Key Selling Highlights
              </span>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs sm:text-sm text-slate-700">
                {currentListing.bullet_points.map((pt, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200"
                  >
                    <span className="text-emerald-700 font-bold mt-0.5">✓</span>
                    <span>{pt}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Full Description Box */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                Formatted Description
              </span>
              {!isEditing && (
                <button
                  type="button"
                  onClick={() => handleCopySnippet(currentListing.description, 'Description')}
                  className="px-2.5 py-1 rounded-md text-xs font-semibold text-indigo-700 hover:bg-indigo-50 border border-indigo-200 transition-colors"
                >
                  Copy Description
                </button>
              )}
            </div>

            {isEditing ? (
              <textarea
                rows={8}
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                className="w-full bg-white border border-indigo-500 rounded-lg p-3 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-sans leading-relaxed"
              />
            ) : (
              <pre className="font-sans text-xs sm:text-sm text-slate-800 whitespace-pre-wrap leading-relaxed bg-slate-50 p-3.5 rounded-lg border border-slate-200 max-h-80 overflow-y-auto">
                {currentListing.description}
              </pre>
            )}

            {isEditing && (
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveListing}
                  disabled={savingEdit}
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow"
                >
                  {savingEdit ? 'Saving...' : 'Save Customized Copy'}
                </button>
              </div>
            )}
          </div>

          {/* Call to Action */}
          {currentListing.call_to_action && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3.5 flex items-center gap-3">
              <span className="text-lg">📢</span>
              <div className="text-xs sm:text-sm">
                <strong className="text-indigo-700 font-semibold">Call to Action:</strong>{' '}
                <span className="text-slate-800">{currentListing.call_to_action}</span>
              </div>
            </div>
          )}

          {/* Hashtags */}
          {currentListing.hashtags && currentListing.hashtags.length > 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
              <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold block">
                Channel Hashtags &amp; SEO Tags
              </span>
              <div className="flex flex-wrap gap-1.5">
                {currentListing.hashtags.map((tag, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleCopySnippet(tag, tag)}
                    className="text-xs font-mono bg-white hover:bg-slate-100 text-indigo-700 hover:text-slate-900 border border-slate-200 hover:border-indigo-400 px-2.5 py-1 rounded-md transition-colors"
                  >
                    {tag.startsWith('#') ? tag : `#${tag}`}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Empty / Pending Listings State */
        <div className="text-center py-10 px-4 space-y-4 bg-slate-50 rounded-xl border border-slate-200 border-dashed">
          <div className="w-12 h-12 mx-auto rounded-full bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 text-xl">
            📦
          </div>
          <div className="space-y-1">
            <h4 className="text-base font-bold text-slate-900">No Listings Generated Yet</h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Run the full 3-agent autonomous pipeline to analyze market angles and generate copy tailored for Shopee, TikTok Shop, and Lazada.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onRunFullPipeline && onRunFullPipeline(product.id)}
            disabled={isRunningPipeline}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all disabled:opacity-50"
          >
            {isRunningPipeline ? (
              <span>Running Pipeline...</span>
            ) : (
              <span>⚡ Generate Full Pipeline (All 3 Agents)</span>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
