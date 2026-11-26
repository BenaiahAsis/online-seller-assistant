import { useState } from 'react';
import Icon from './Icon';
import { Button, CopyButton, Notice, SectionHeading, SegmentedControl, Spinner } from './ui';
import { PLATFORMS } from '../lib/product';

const TITLE_MAX = 255;
const DESCRIPTION_MAX = 3000;

// "Listings" tab: Agent 3 output, one listing per platform.
export default function ListingPreview({
  product,
  apiUrl,
  onRunFullPipeline,
  isRunningPipeline = false,
  busy,
  onListingUpdated,
  onNotify,
}) {
  const [platform, setPlatform] = useState('shopee');
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const listings = product.listings || [];
  const listing = listings.find((l) => l.platform?.toLowerCase() === platform);

  if (listings.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-line px-6 py-10 text-center">
        <p className="text-sm font-medium">No listings yet</p>
        <p className="mt-1 text-[13px] text-muted">
          We'll write one version each for Shopee, TikTok Shop and Lazada from your product details.
        </p>
        <Button variant="primary" className="mt-4" onClick={() => onRunFullPipeline(product.id)} disabled={busy}>
          {isRunningPipeline && <Spinner />}
          {isRunningPipeline ? 'Creating listings…' : 'Create listings'}
        </Button>
      </div>
    );
  }

  const copy = async (text, label) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      onNotify({ type: 'success', message: `${label} copied.` });
    } catch {
      onNotify({ type: 'error', message: 'Copy failed. Select the text and copy it manually.' });
    }
  };

  const fullText = listing
    ? [
        listing.title,
        listing.bullet_points?.length ? listing.bullet_points.map((p) => `• ${p}`).join('\n') : null,
        listing.description,
        listing.call_to_action,
        listing.hashtags?.length ? listing.hashtags.join(' ') : null,
      ]
        .filter(Boolean)
        .join('\n\n')
    : '';

  const startEditing = () => {
    setEditTitle(listing.title);
    setEditDesc(listing.description);
    setSaveError(null);
    setIsEditing(true);
  };

  const saveEdit = async () => {
    if (!editTitle.trim() || !editDesc.trim()) {
      setSaveError('Title and description cannot be empty.');
      return;
    }
    setSavingEdit(true);
    setSaveError(null);
    try {
      const res = await fetch(`${apiUrl}/api/listings/${listing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ title: editTitle.trim(), description: editDesc.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const detail = Array.isArray(body?.detail) ? body.detail.map((d) => d.msg).join('; ') : body?.detail;
        setSaveError(`Your changes were not saved${detail ? `: ${detail}` : ` (HTTP ${res.status})`}. Try again.`);
        return;
      }
      setIsEditing(false);
      onNotify({ type: 'success', message: 'Listing saved.' });
      onListingUpdated();
    } catch {
      setSaveError('Your changes were not saved: could not reach the server. Try again.');
    } finally {
      setSavingEdit(false);
    }
  };

  const insights = product.analysis?.market_insights;
  const usedTemplate =
    insights?.source === 'heuristic' ||
    (product.analysis?.execution_logs || []).some(
      (l) =>
        (l.agent?.includes('Agent 3') && (l.stage === 'ENGINE_NOTICE' || l.source === 'heuristic')) ||
        l.details?.fallback_used
    );

  const options = PLATFORMS.map((p) => ({ id: p.id, label: p.label }));
  const hint = PLATFORMS.find((p) => p.id === platform)?.hint;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <SegmentedControl
            label="Platform"
            options={options}
            value={platform}
            onChange={(id) => {
              setIsEditing(false);
              setPlatform(id);
            }}
          />
          <span className="hidden text-xs text-muted sm:inline">{hint}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="ghost" onClick={() => onRunFullPipeline(product.id)} disabled={busy}>
            <Icon name="refresh" className={`h-3.5 w-3.5 ${isRunningPipeline ? 'animate-spin' : ''}`} />
            Regenerate
          </Button>
          {listing && (
            <>
              <Button size="sm" variant="ghost" onClick={isEditing ? () => setIsEditing(false) : startEditing}>
                <Icon name={isEditing ? 'x' : 'pencil'} className="h-3.5 w-3.5" />
                {isEditing ? 'Cancel edit' : 'Edit'}
              </Button>
              <Button size="sm" variant="primary" onClick={() => copy(fullText, 'Listing')} disabled={isEditing}>
                <Icon name="copy" className="h-3.5 w-3.5" />
                Copy all
              </Button>
            </>
          )}
        </div>
      </div>

      {usedTemplate && (
        <Notice tone="warning">
          Written from a standard template because the AI service was unavailable. Regenerate later for better copy.
        </Notice>
      )}

      {!listing ? (
        <p className="text-sm text-muted">No listing for this platform. Regenerate to create one.</p>
      ) : (
        <div className="divide-y divide-line">
          <section className="pb-6">
            <SectionHeading action={!isEditing && <CopyButton onClick={() => copy(listing.title, 'Title')} />}>
              Title{' '}
              <span className="ml-1 text-xs font-normal tabular-nums text-muted">
                {(isEditing ? editTitle : listing.title).length}/{TITLE_MAX}
              </span>
            </SectionHeading>
            {isEditing ? (
              <input
                type="text"
                aria-label="Listing title"
                value={editTitle}
                maxLength={TITLE_MAX}
                onChange={(e) => setEditTitle(e.target.value)}
                className="field"
              />
            ) : (
              <p className="text-base font-medium leading-snug">{listing.title}</p>
            )}
          </section>

          {listing.bullet_points?.length > 0 && (
            <section className="py-6">
              <SectionHeading
                action={!isEditing && (
                  <CopyButton onClick={() => copy(listing.bullet_points.map((p) => `• ${p}`).join('\n'), 'Highlights')} />
                )}
              >
                Highlights
              </SectionHeading>
              <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed marker:text-muted">
                {listing.bullet_points.map((pt, i) => (
                  <li key={i}>{pt}</li>
                ))}
              </ul>
            </section>
          )}

          <section className="py-6">
            <SectionHeading action={!isEditing && <CopyButton onClick={() => copy(listing.description, 'Description')} />}>
              Description
            </SectionHeading>
            {isEditing ? (
              <>
                <textarea
                  rows={10}
                  maxLength={DESCRIPTION_MAX}
                  aria-label="Listing description"
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="field leading-relaxed"
                />
                {saveError && (
                  <div className="mt-2">
                    <Notice tone="error" role="alert">{saveError}</Notice>
                  </div>
                )}
                <div className="mt-3 flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => setIsEditing(false)}>Cancel</Button>
                  <Button variant="primary" onClick={saveEdit} disabled={savingEdit}>
                    {savingEdit && <Spinner />}
                    {savingEdit ? 'Saving…' : 'Save changes'}
                  </Button>
                </div>
              </>
            ) : (
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{listing.description}</p>
            )}
          </section>

          {listing.call_to_action && (
            <section className="py-6">
              <SectionHeading action={<CopyButton onClick={() => copy(listing.call_to_action, 'Call to action')} />}>
                Call to action
              </SectionHeading>
              <p className="text-sm">{listing.call_to_action}</p>
            </section>
          )}

          {listing.hashtags?.length > 0 && (
            <section className="pt-6">
              <SectionHeading action={<CopyButton onClick={() => copy(listing.hashtags.join(' '), 'Hashtags')} />}>
                Hashtags
              </SectionHeading>
              <div className="flex flex-wrap gap-1.5">
                {listing.hashtags.map((tag) => (
                  <span key={tag} className="rounded bg-stone-100 px-2 py-1 text-[13px] text-stone-800">
                    {tag.startsWith('#') ? tag : `#${tag}`}
                  </span>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
