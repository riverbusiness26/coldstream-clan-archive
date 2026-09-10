interface EventTypeIconProps { type?: string | null; }

export function eventTypeSlug(type?: string | null) {
  const value = (type ?? '').toLowerCase();
  return value.includes('public') || value.includes('server')
    ? 'public'
    : value.includes('competitive')
      ? 'competitive'
      : value.includes('linebattle') || value.includes('line battle')
        ? 'linebattle'
        : 'fallback';
}

export default function EventTypeIcon({ type }: EventTypeIconProps) {
  const kind = eventTypeSlug(type);
  return kind !== 'fallback'
    ? <span className={`event-type-icon event-type-icon--${kind}`} aria-hidden="true" />
    : <span className="event-type-icon event-type-icon--fallback" aria-hidden="true" />;
}
