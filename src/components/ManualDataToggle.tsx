import {useState} from 'react';
export function useManualInclusion(){
 const key='breach-manual-inclusion:'+sessionStorage.getItem('breach_workspace');
 const [included,setIncluded]=useState(()=>sessionStorage.getItem(key)==='true');
 return [included,(value:boolean)=>{sessionStorage.setItem(key,String(value));setIncluded(value);}] as const;
}
export function ManualDataToggle({included,onChange}:{included:boolean;onChange:(v:boolean)=>void}){
 return <div className="manual-source-toggle"><label><input type="checkbox" checked={included} onChange={e=>onChange(e.target.checked)}/> INCLUDE MY MANUAL MATCHES</label><span>{included?'Includes private, unverified stats. Replay win rates stay separate. A game entered manually and imported as a replay can count twice.':'Replay data only. Manual matches are excluded.'}</span></div>;
}
