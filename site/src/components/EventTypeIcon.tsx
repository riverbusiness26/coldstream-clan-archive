interface EventTypeIconProps { type?: string | null; }

export default function EventTypeIcon({ type }: EventTypeIconProps) {
  const value = (type ?? '').toLowerCase();
  const kind = value.includes('public') || value.includes('server')
    ? 'public'
    : value.includes('competitive')
      ? 'competitive'
      : value.includes('linebattle') || value.includes('line battle')
        ? 'linebattle'
        : null;
  return kind
    ? <span className={`event-type-icon event-type-icon--${kind}`} aria-hidden="true" />
    : <span className="event-type-icon event-type-icon--fallback" aria-hidden="true" />;
}
