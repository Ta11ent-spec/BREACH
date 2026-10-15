import {useEffect,useState} from 'react';
import type {AnalyticsSource} from '../data/analyticsSources';
export function useManualInclusion(){
 const key='breach-analytics-source:'+sessionStorage.getItem('breach_workspace');
 const read=():AnalyticsSource=>{const value=sessionStorage.getItem(key);return value==='manual'||value==='combined'?value:'replay';};
 const [included,setIncluded]=useState<AnalyticsSource>(read);
 useEffect(()=>{const sync=()=>setIncluded(read());window.addEventListener('breach-source-change',sync);return()=>window.removeEventListener('breach-source-change',sync);},[key]);
 return [included,(value:AnalyticsSource)=>{sessionStorage.setItem(key,value);setIncluded(value);window.dispatchEvent(new Event('breach-source-change'));}] as const;
}
export function ManualDataToggle({included,onChange}:{included:AnalyticsSource;onChange:(v:AnalyticsSource)=>void}){
 return <div className="manual-source-toggle"><div className="segmented" role="group" aria-label="Statistics data source">{(['replay','manual','combined'] as const).map(value=><button key={value} className={included===value?'active':''} aria-pressed={included===value} onClick={()=>onChange(value)}>{value==='combined'?'COMBINED':value==='manual'?'MANUAL ONLY':'REPLAY ONLY'}</button>)}</div><span>{included==='replay'?'Replay records only. Manual matches are excluded.':included==='manual'?'Your submitted manual matches only. Stats and results are self-reported / unverified.':'Replay + your submitted manual matches, including self-reported results. Manual records stay labeled. The same game entered manually and uploaded as a replay can count twice.'}</span></div>;
}
