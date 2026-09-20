import { useCallback, useEffect, useRef, useState } from 'react';
import { FiMusic, FiPause, FiPlay, FiSkipForward, FiVolume2 } from 'react-icons/fi';
import { loadJukebox, musicUrl, type JukeboxTrack } from '../lib/jukebox';
import '../jukebox-player.css';

export default function QuartermasterJukebox() {
  const [tracks,setTracks] = useState<JukeboxTrack[]>([]);
  const [selected,setSelected] = useState('');
  const selectedRef = useRef('');
  const [src,setSrc] = useState('');
  const source = useRef({id:'',url:'',expires:0});
  const [loading,setLoading] = useState(true);
  const [playing,setPlaying] = useState(false);
  const [error,setError] = useState('');
  const [volume,setVolume] = useState(() => {try {const n=Number(localStorage.getItem('qm-music-volume') ?? '.35'); return Number.isFinite(n)? Math.max(0,Math.min(1,n)):.35;}catch{return .35;}});
  const audio=useRef<HTMLAudioElement>(null);
  const request=useRef(0);
  const playlistRequest=useRef(0);
  const mounted=useRef(true);
  const refresh=useCallback(async()=>{
    const version=++playlistRequest.current;
    try {
      const data=await loadJukebox();
      if(!mounted.current || version!==playlistRequest.current)return;
      setTracks(data);setError('');
      if(!data.some(t=>t.id===selectedRef.current)){
        request.current++;audio.current?.pause();setPlaying(false);setSrc('');
        selectedRef.current=data[0]?.id??'';setSelected(selectedRef.current);
      }
    }catch(error){if(mounted.current && version===playlistRequest.current)setError(error instanceof Error?error.message:'The playlist could not load.');}
    finally{if(mounted.current && version===playlistRequest.current)setLoading(false);}
  },[]);
  useEffect(()=>{
    mounted.current=true;void refresh();
    const poll=window.setInterval(()=>{if(!document.hidden)void refresh();},60_000);
    const visible=()=>{if(!document.hidden)void refresh();};
    document.addEventListener('visibilitychange',visible);
    return()=>{mounted.current=false;request.current++;playlistRequest.current++;clearInterval(poll);document.removeEventListener('visibilitychange',visible);};
  },[refresh]);
  useEffect(()=>{if(audio.current)audio.current.volume=volume;try{localStorage.setItem('qm-music-volume',String(volume));}catch{}},[volume]);
  useEffect(()=>{if(playing && src)void audio.current?.play().catch(()=>{setPlaying(false);setError('Press Play to start this track.');});},[src,playing]);
  const current=tracks.find(t=>t.id===selected);
  async function choose(track:JukeboxTrack,autoplay:boolean){
    const version=++request.current;
    audio.current?.pause();setPlaying(false);setError('');
    selectedRef.current=track.id;setSelected(track.id);
    if(!autoplay){setSrc('');source.current={id:'',url:'',expires:0};return;}
    try{
      const cached=source.current;
      const url=cached.id===track.id && cached.expires>Date.now()?cached.url:await musicUrl(track);
      if(!mounted.current || version!==request.current)return;
      source.current={id:track.id,url,expires:cached.url===url?cached.expires:Date.now()+3_500_000};
      setSrc(url);setPlaying(true);
    }catch(error){if(mounted.current && version===request.current)setError(error instanceof Error?error.message:'Track unavailable.');}
  }
  const toggle=()=>{if(playing){request.current++;audio.current?.pause();setPlaying(false);}else if(current)void choose(current,true);};
  const next=(autoplay:boolean)=>{const index=tracks.findIndex(t=>t.id===selectedRef.current);const track=tracks[(index+1)%tracks.length];if(track)void choose(track,autoplay);};
  return <details className="qm-jukebox"><summary><FiMusic/><span>The mess-room jukebox</span><small>{playing ? current?.title : 'Optional music'}</small></summary>
    <div className="qm-jukebox-controls">
      <div><strong>{current?.title ?? 'Community soundtrack'}</strong><p>{loading?'Loading playlist...':tracks.length?current?.artist || 'Music selected by the admins.':'No music published yet.'}</p></div>
      <button className="qm-button" disabled={!current} onClick={toggle} aria-label={playing?'Pause music':'Play music'}>{playing?<FiPause/>:<FiPlay/>}</button>
      <button className="qm-button" disabled={tracks.length<2} onClick={()=>next(playing)} aria-label="Next track"><FiSkipForward/></button>
      <label><FiVolume2/><span className="sr-only">Music volume</span><input type="range" min="0" max="1" step=".05" value={volume} onChange={e=>setVolume(Number(e.target.value))}/></label>
      {!!tracks.length && <label>Track<select value={selected} onChange={e=>{const track=tracks.find(t=>t.id===e.target.value);if(track)void choose(track,playing);}}>{tracks.map(t=><option key={t.id} value={t.id}>{t.title}{t.artist?` · ${t.artist}`:''}</option>)}</select></label>}
      <button className="qm-button" onClick={()=>void refresh()}>Refresh playlist</button>
    </div>
    <p className="qm-help">Admin-curated music. Press Play to start. Your volume is remembered.</p>
    {error&&<p role="status">{error}</p>}
    <audio ref={audio} src={src || undefined} preload="none" onEnded={()=>{if(tracks.length>1)next(true);else setPlaying(false);}} onError={()=>{source.current={id:'',url:'',expires:0};setPlaying(false);setError('This track could not be played. Refresh the playlist or choose another track.');}}/>
  </details>;
}
