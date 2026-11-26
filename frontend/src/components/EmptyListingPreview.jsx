// Faded outline of a finished listing, shown before any product exists.
function Bar({ w }) {
  return <div className={`h-2.5 rounded bg-stone-200/80 ${w}`} />;
}

export default function EmptyListingPreview() {
  return (
    <div className="rounded-lg border border-dashed border-line p-6">
      <p className="text-sm font-medium text-ink">Your listings will appear here</p>
      <p className="mt-1 text-[13px] text-muted">
        One version each for Shopee, TikTok Shop and Lazada, written only from the details you give.
      </p>

      <div aria-hidden="true" className="mt-6 space-y-6 opacity-70">
        <div className="flex gap-2">
          {['w-16', 'w-20', 'w-14'].map((w) => (
            <div key={w} className={`h-7 rounded bg-stone-100 ${w}`} />
          ))}
        </div>
        <div className="space-y-2">
          <p className="text-xs text-muted">Title</p>
          <Bar w="w-4/5" />
        </div>
        <div className="space-y-2">
          <p className="text-xs text-muted">Highlights</p>
          <Bar w="w-3/5" />
          <Bar w="w-2/3" />
          <Bar w="w-1/2" />
        </div>
        <div className="space-y-2">
          <p className="text-xs text-muted">Description</p>
          <Bar w="w-full" />
          <Bar w="w-full" />
          <Bar w="w-11/12" />
          <Bar w="w-3/4" />
        </div>
        <div className="space-y-2">
          <p className="text-xs text-muted">Hashtags</p>
          <div className="flex gap-2">
            {['w-20', 'w-24', 'w-16'].map((w) => (
              <div key={w} className={`h-6 rounded bg-stone-100 ${w}`} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
