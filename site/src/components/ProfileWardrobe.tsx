import { useEffect, useState } from 'react';
import DiscordAvatar from './DiscordAvatar';
import { QuartermasterItemArt } from './QuartermasterItemArt';
import '../profile-wardrobe.css';

type Cosmetic = { slot: string; slug: string; name: string };
const known = new Set(['frame_laurel','frame_silver','cloth_crimson','cloth_rifle','plate_brass','case_campaign','effect_candle','effect_mist','campaign_telescope','sentry_keepsake','sealed_dispatch','snuff','pack_cards']);
export default function ProfileWardrobe({discordId,name,avatar,own}:{discordId?:string|null;name:string;avatar?:string|null;own:boolean}) {
  const [items,setItems]=useState<Cosmetic[]|null>(null);
  const [status,setStatus]=useState('loading');
  useEffect(()=>{
    if(!discordId || !/^\d{17,20}$/.test(discordId)) return;
    let active=true;
    setItems(null); setStatus('loading');
    const load=async()=>{try{
      const response=await fetch(`https://panel.coldstreamgaming.com/quartermaster-api/public/regiment-cosmetics/${discordId}`,{signal:AbortSignal.timeout(8000),credentials:'omit'});
      if(response.status===404){if(active)setStatus('hidden');return;}
      if(!response.ok)throw new Error();
      const data=await response.json(); if(!data.ok || !Array.isArray(data.cosmetics))throw new Error();
      if(active){setItems(data.cosmetics.filter((x:Cosmetic)=>known.has(x.slug)&&typeof x.name==='string').slice(0,11));setStatus('ready');}
    }catch{if(active)setStatus('error');}};
    void load();const timer=setInterval(load,60000);return()=>{active=false;clearInterval(timer);};
  },[discordId]);
  if(!discordId || status==='hidden')return null;
  const equipped=Object.fromEntries((items??[]).map(x=>[x.slot,x.slug]));
  const keepsakes=(items??[]).filter(x=>/^display_[1-6]$/.test(x.slot)).sort((a,b)=>a.slot.localeCompare(b.slot));
  return <section className={`pwardrobe ${Object.values(equipped).filter(x=>known.has(x)).join(' ')}`} aria-label="Quartermaster wardrobe">
    <header><div><span>2nd Coldstream Guards</span><h2>Quartermaster wardrobe</h2></div>{own&&<a href="#/stores/profile">Customise in Quartermaster →</a>}</header>
    {status==='loading'?<p role="status">Opening your wardrobe…</p>:status==='error'?<p role="status">Wardrobe could not refresh. Try again shortly.</p>:<>
      <div className="pw-portrait"><DiscordAvatar url={avatar??null} name={name}/><h3>{name}</h3></div>
      <div className="pw-keepsakes">{Array.from({length:6},(_,i)=>{const item=keepsakes.find(x=>x.slot===`display_${i+1}`);return <div key={i}>{item?<><QuartermasterItemArt slug={item.slug}/><span>{item.name}</span></>:<span className="pw-empty">Keepsake {i+1}</span>}</div>;})}</div>
      <p>{items?.length?'Your equipped look, shared with your Discord service record.':'Your standard look. Choose frames, cloth and keepsakes in Quartermaster.'}</p>
    </>}
  </section>;
}
