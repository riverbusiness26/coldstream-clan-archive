import { FiCrosshair, FiHeart, FiShield, FiTrendingUp } from 'react-icons/fi';
import { asset } from '../lib/asset';
import { ROLE_NAMES, type Card } from './catalogue';
import './cardArtwork.css';

/** Shared live card text, with River's supplied card used as the temporary portrait. */
export default function CardArtwork({ card, small = false }: { card: Card; small?: boolean }) {
  const stats = [
    { name: 'Health', value: card.health, icon: <FiHeart /> },
    { name: card.company === 'Rifle Company' ? 'Rifle dmg' : 'Musket dmg', value: card.musket, icon: <FiCrosshair /> },
    { name: 'Bayonet dmg', value: card.bayonet, icon: <span aria-hidden="true">⚔</span> },
    { name: 'Morale', value: card.morale, icon: <FiTrendingUp /> },
  ];
  return <span className={`rw-portrait-card ${card.rarity} ${small ? 'small' : ''}`}>
    <img className="rw-pc-reference" src={asset('/regiment-wars/card-reference.png')} alt="" draggable={false} loading="lazy" />
    <span className="rw-pc-picture">
      <span className="rw-pc-company">{card.company}</span>
      <span className="rw-pc-rarity">{card.rarity}</span>
    </span>
    <span className="rw-pc-name"><strong style={{ fontSize: `${card.name.length > 18 ? 4.7 : card.name.length > 13 ? 5.8 : 7}cqw` }}>{card.name}</strong><small>{ROLE_NAMES[card.role]}</small></span>
    <span className="rw-pc-stats">{stats.map(stat => <span key={stat.name} title={`${stat.name}: ${stat.value}`}><span>{stat.icon}<b>{stat.value}</b></span><small>{stat.name}</small></span>)}</span>
    <span className="rw-pc-trait"><span className="rw-pc-trait-icon"><FiShield /></span><span><strong><small>TRAIT: </small>{card.trait}</strong><span title={card.description}>{small ? ROLE_NAMES[card.role] : card.description}</span></span><q>{card.quote}</q></span>
    <span className="rw-pc-motto">{card.company}<small>SECOND TO NONE</small></span>
  </span>;
}
