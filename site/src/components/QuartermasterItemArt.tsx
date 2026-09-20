import { FiPackage } from 'react-icons/fi';

const art: Record<string,string> = {
  lantern: 'shop/lantern-v1',
  grog: 'shop/grog-v1',
  caltrops: 'shop/caltrops-v1',
  warrant: 'shop/warrant-v1',
  snuff: 'shop/snuff-v1',
  hard_tack: 'shop/hard_tack-v1',
  pack_cards: 'shop/pack_cards-v1',
  title_mess: 'shop/title_mess-v1',
  title_forager: 'shop/title_forager-v1',
  title_steady: 'shop/title_steady-v1',
  frame_silver: 'shop/frame_silver-v1',
  name_plate: 'shop/name_plate-v1',
  frame_laurel: 'shop/frame_laurel-v1',
  plate_brass: 'shop/plate_brass-v1',
  cloth_crimson: 'shop/cloth_crimson-v1',
  case_campaign: 'shop/case_campaign-v1',
  cloth_rifle: 'shop/cloth_rifle-v1',
  effect_mist: 'shop/effect_mist-v1',
  effect_candle: 'shop/effect_candle-v1',
  campaign_telescope: 'shop/campaign_telescope-v1',
  sentry_keepsake: 'shop/sentry_keepsake-v1',
  sealed_dispatch: 'shop/sealed_dispatch-v1',
};
export function QuartermasterItemArt({slug,className=''}:{slug:string;className?:string}) {
  const image = art[slug];
  return <div className={`qm-item-art qm-art-${slug} ${className}`} aria-hidden="true">{image ? <img src={`${import.meta.env.BASE_URL}quartermaster/${image}.webp`} width="960" height="960" alt="" loading="lazy" decoding="async" /> : <FiPackage/>}</div>;
}
