interface DetachmentEmblemProps {
  name?: string | null;
  src?: string | null;
  alt?: string;
}

const positionFor = (name: string | null | undefined) => {
  const value = (name ?? '').toLowerCase();
  if (value.includes('grenadier')) return 'grenadiers';
  if (value.includes('artiller')) return 'artillery';
  if (value.includes('skirmish')) return 'skirmishers';
  if (value.includes('line')) return 'line-infantry';
  return null;
};

export default function DetachmentEmblem({ name, src, alt }: DetachmentEmblemProps) {
  if (src) return <img src={src} alt={alt ?? `${name ?? 'Detachment'} emblem`} />;
  const position = positionFor(name);
  return position
    ? <img className={`detachment-emblem detachment-emblem--${position}`} src={`/detachment-${position}.png`} alt={alt ?? `${name} emblem`} />
    : <span className="detachment-emblem detachment-emblem--placeholder" aria-hidden="true" />;
}
