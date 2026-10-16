import {usePlaylist} from '../data/usePlaylist';
import {playlistLabels} from '../data/playlists';
import type {Playlist} from '../data/playlists';
import {useEffect,useState} from 'react';
import type {AnalyticsSource} from '../data/analyticsSources';
export function useManualInclusion(){
 // Reset the old replay-first preference once; subsequent explicit choices still persist.
 const key='breach-analytics-source-v2:'+sessionStorage.getItem('breach_workspace');
 const read=():AnalyticsSource=>{const value=sessionStorage.getItem(key);return value==='manual'||value==='replay'?value:'combined';};
 const [included,setIncluded]=useState<AnalyticsSource>(read);
 useEffect(()=>{const sync=()=>setIncluded(read());window.addEventListener('breach-source-change',sync);return()=>window.removeEventListener('breach-source-change',sync);},[key]);
 return [included,(value:AnalyticsSource)=>{sessionStorage.setItem(key,value);setIncluded(value);window.dispatchEvent(new Event('breach-source-change'));}] as const;
}
export function ManualDataToggle({included,onChange,period,onPeriodChange}:{included:AnalyticsSource;onChange:(v:AnalyticsSource)=>void;period:string;onPeriodChange:(v:"7D"|"30D"|"ALL")=>void}){
 const [playlist,setPlaylist]=usePlaylist();
 return <div className="manual-source-toggle"><label>PLAYLIST <select aria-label="Statistics playlist" value={playlist} onChange={e=>setPlaylist(e.target.value as Playlist)}>{(Object.keys(playlistLabels) as Playlist[]).map(p=><option key={p} value={p}>{playlistLabels[p]}</option>)}</select></label><div className="segmented" role="group" aria-label="Statistics data source">{(['replay','manual','combined'] as const).map(value=><button key={value} className={included===value?'active':''} aria-pressed={included===value} onClick={()=>onChange(value)}>{value==='combined'?'COMBINED':value==='manual'?'MANUAL ONLY':'REPLAY ONLY'}</button>)}</div><div className="period-switch" role="group" aria-label="Statistics date range">{(['7D','30D','ALL'] as const).map(value=><button type="button" key={value} className={period===value?'active':''} aria-pressed={period===value} onClick={()=>onPeriodChange(value)}>{value}</button>)}</div><span className="manual-source-description">{included==='replay'?'Replay records only. Manual matches are excluded.':included==='manual'?'Shared submitted manual matches only. Stats and results are self-reported / unverified.':'Replay + shared submitted manual matches, including self-reported results. Manual records stay labeled. The same game entered manually and uploaded as a replay can count twice.'}</span></div>;
}
