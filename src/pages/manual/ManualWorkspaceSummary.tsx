import {useEffect,useState} from 'react';
import {listManualMatches} from '../../data/manualApi';
import type {ManualRecord} from '../../data/manualMatches';
import {Btn} from '../../components';
export function ManualWorkspaceSummary({app,refresh=0}:{app:any;refresh?:number}){
 const [rows,setRows]=useState<ManualRecord[]>([]),[error,setError]=useState('');
 useEffect(()=>{const c=new AbortController();listManualMatches(c.signal).then(r=>{if(!c.signal.aborted){setRows(r);setError('');}}).catch(()=>{if(!c.signal.aborted)setError('Manual matches could not be loaded. Open Manual Entry to retry.');});return()=>c.abort();},[refresh]);
 return <section className="panel"><div className="panel-head"><h3>My manual matches</h3><Btn onClick={()=>app.go('/entry')}>RECORD A MATCH</Btn></div><div className="workspace-body"><p>{error||`${rows.filter(r=>r.status==='draft').length} drafts · ${rows.filter(r=>r.status==='submitted').length} submitted · Private / unverified`}</p><div className="workspace-match-list">{rows.slice(0,8).map(r=><button className="btn" key={r.id} onClick={()=>{sessionStorage.setItem('breach-open-manual',r.id);app.go('/entry');}}>{r.payload.map||'Untitled match'} · {r.payload.username||'No player'} · {r.status.toUpperCase()}</button>)}</div></div></section>;
}
