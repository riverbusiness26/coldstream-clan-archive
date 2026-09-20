import { type ReactNode } from 'react';
import { FiAward, FiBookOpen, FiLock, FiPackage, FiStar } from 'react-icons/fi';
import { honourId, honourName, shillings, titleName, type QuartermasterSnapshot, type ActionArgs, type ActionKey } from '../lib/quartermaster';
import { QuartermasterItemArt } from './QuartermasterItemArt';
import QuartermasterActivityLevels from './QuartermasterActivityLevels';

type Props = { snapshot: QuartermasterSnapshot; openInventory: () => void; locked: boolean; run: (action: ActionKey,args?:ActionArgs)=>Promise<boolean>; status: ReactNode };
const slots=[['frame','Portrait frame'],['nameplate','Nameplate'],['cloth','Cloth background'],['decoration','Display trim'],['effect','Atmosphere']] as const;
const games: Record<string,string>={dice:'Lucky Dice',blackjack:'Blackjack',duel:'Duels',split:'Split or Steal',heist:'Heists',lottery:'Lottery'};
export default function QuartermasterBillet({snapshot,openInventory,locked,run,status}:Props) {
  const p=snapshot.profile, equipment=p.equipment??{};
  const initials=p.displayName.split(/\s+/).slice(0,2).map(part=>part[0]).join('').toUpperCase();
  const owned=snapshot.catalogue.filter(item=>snapshot.inventory.some(row=>row.slug===item.slug && row.qty>0));
  const collectibles=owned.filter(item=>['collectible','flavour'].includes(item.effect));
  const equip=(slot:string,itemSlug:string)=>void run('equip',{slot,itemSlug});
  const wins=Object.values(p.gameRecord??{}).reduce((sum,game)=>sum+game.wins,0);
  return <div className={`qm-billet-profile qm-profile-cloth-${equipment.cloth??'default'} qm-profile-effect-${equipment.effect??'none'} qm-profile-trim-${equipment.decoration??'none'}`}>
    <header className="qm-billet-masthead">
      <div className={`qm-billet-portrait qm-equipped-${equipment.frame??'none'}`} aria-hidden="true"><span>{initials}</span>{equipment.frame&&<QuartermasterItemArt slug={equipment.frame}/>}</div>
      <div className={`qm-billet-name qm-nameplate-${equipment.nameplate??'none'}`}><p className="qm-eyebrow">Your Profile</p><h2>{p.displayName}</h2><div className="qm-billet-subtitle"><span>{titleName(p.title)}</span><span>{p.billet?'Wallet protected from forage':'Wallet open to forage'}</span></div><p>Your winnings. Your collection. Your corner of the company.</p></div>
      <div className="qm-billet-worth"><span>Total worth</span><strong>{p.net.toLocaleString()}</strong><small>Shillings</small><div><span><FiLock/> {shillings(p.chest)} secured</span><span>{shillings(p.purse)} ready</span></div></div>
    </header>
    <section className="qm-billet-statline" aria-label="Your Shillings record"><article><FiStar/><span>Lifetime earned</span><strong>{p.lifetimeEarned.toLocaleString()}</strong></article><article><FiAward/><span>Game wins</span><strong>{wins}</strong></article><article><FiBookOpen/><span>Daily streak</span><strong>{p.streak} days</strong></article><article><FiPackage/><span>Unique items</span><strong>{snapshot.inventory.length}</strong></article></section>
    <QuartermasterActivityLevels levels={p.activityLevels} title={p.title} locked={locked} chooseTitle={id => void run('title', { titleId: id })} />
    <section className="qm-profile-customize"><div><p className="qm-eyebrow">Make it yours</p><h3>Dress your profile</h3><p>Permanent cosmetics stay in your collection. Change them whenever you like.</p></div><div className="qm-customize-fields">{slots.map(([slot,label])=><label className="qm-field" key={slot}>{label}<select aria-label={label} disabled={locked} value={equipment[slot]??''} onChange={e=>equip(slot,e.target.value)}><option value="">Standard</option>{owned.filter(item=>item.slot===slot).map(item=><option value={item.slug} key={item.slug}>{item.name}</option>)}</select></label>)}</div>{status}<button className="qm-text-button" onClick={openInventory}>Manage items and titles</button></section>
    <div className="qm-billet-grid">
      <section className="qm-billet-section qm-display-shelf"><div className="qm-billet-section-head"><div><p className="qm-eyebrow">Collected along the way</p><h3>Profile display</h3><p>Six keepsakes, chosen by you.</p></div></div><div className="qm-display-slots">{Array.from({length:6},(_,i)=>{
        const slot=`display_${i+1}`, item=collectibles.find(row=>row.slug===equipment[slot]);
        return <article key={slot} className={item?'filled':''}><span>{i+1}</span>{item?<><QuartermasterItemArt slug={item.slug}/><strong>{item.name}</strong></>:<><FiPackage/><strong>Open position</strong></>}<label className="qm-field"><span className="sr-only">Display position {i+1}</span><select aria-label={`Display position ${i+1}`} disabled={locked} value={item?.slug??''} onChange={e=>equip(slot,e.target.value)}><option value="">Nothing displayed</option>{collectibles.map(row=><option key={row.slug} value={row.slug}>{row.name}</option>)}</select></label></article>;
      })}</div></section>
      <aside className="qm-billet-section qm-billet-honours"><p className="qm-eyebrow">At the tables and in the field</p><h3>Your winning record</h3><div className="qm-win-record">{Object.entries(games).map(([key,name])=><div key={key}><span>{name}</span><strong>{p.gameRecord?.[key]?.wins??0}</strong></div>)}</div><h3>Badges on record</h3>{p.medals.length?p.medals.map(medal=><span className="qm-honour" key={honourId(medal)}><FiAward/>{honourName(medal)}</span>):<p className="qm-muted">No Shillings honours earned yet.</p>}</aside>
    </div>
  </div>;
}
