import {useEffect,useState} from 'react';
import {fetchApi} from '../../data/realApi';
import {authHeaders} from '../../auth/apiAuth';
import {canonicalMaps,resolveMap,setMapLinks,setMapEvidence} from '../../data/mapCatalog';
import type {MapLinks} from '../../data/mapCatalog';
import type {OverviewV3} from '../../data/overviewAnalytics';
import {manualSites} from '../../data/manualSites';

type Links=MapLinks&{canEdit:boolean};
type LinkAudit={revision:number;actor:string;payload:string;changedAt:string};
export function MapLinking({onSaved}:{onSaved:()=>void}){
 const [showAll,setShowAll]=useState(false);
 const [links,setLinks]=useState<Links|null>(null),[data,setData]=useState<OverviewV3|null>(null);
 const [error,setError]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const [collector,setCollector]=useState(''),[map,setMap]=useState(''),[siteMap,setSiteMap]=useState(''),[alias,setAlias]=useState(''),[site,setSite]=useState('');
 const [revision,setRevision]=useState(0);
 const [history,setHistory]=useState<LinkAudit[]>([]),[showHistory,setShowHistory]=useState(false);
 async function loadHistory(){try{setHistory(await fetchApi<LinkAudit[]>('/catalog-links/history'));setShowHistory(true);}catch{setError('Could not load correction history.');}}
 useEffect(()=>{const c=new AbortController();setError('');Promise.all([fetchApi<Links>('/catalog-links',c.signal),fetchApi<OverviewV3>('/overview/v3',c.signal)]).then(([l,d])=>{if(!c.signal.aborted){setLinks(l);setMapLinks(l);setMapEvidence(d);setData(d);}}).catch(()=>{if(!c.signal.aborted)setError('Could not load map links. Reload to retry.');});return()=>c.abort();},[revision]);
 async function save(next:MapLinks){
  if(busy)return;setBusy(true);setError('');setNotice('');
  try{const r=await fetch('/api/catalog-links',{method:'PUT',headers:{'Content-Type':'application/json','X-Breach-Request':'catalog-links',...await authHeaders()},body:JSON.stringify(next)});
   if(!r.ok)throw Error((await r.json().catch(()=>null))?.message??'Unable to save links.');
   const saved:Links=await r.json();setLinks(saved);setMapLinks(saved);if(data)setMapEvidence(data);setNotice('Links saved for everyone. Original match records and stats are unchanged.');setShowHistory(false);onSaved();
  }catch(e){setError(e instanceof Error?e.message:'Unable to save links.');}finally{setBusy(false);}
 }
 if(links&&!links.canEdit)return null;
 const ids=[...new Set((data?.matches??[]).flatMap(m=>m.mapId==null?[]:[String(m.mapId)]))].sort();
 const matches=(data?.matches??[]).filter(m=>String(m.mapId)===collector);
 const siteMatches=new Set((data?.matches??[]).filter(m=>resolveMap(m.mapName,m.mapId).name===siteMap).map(m=>m.matchId));
 const aliases=[...new Set((data?.rounds??[]).filter(r=>siteMatches.has(r.matchId)&&r.site).map(r=>r.site!))].sort();
 return <details className="panel map-linking"><summary>Manage map &amp; bombsite links · Admin</summary><div className="workspace-body">
  <p>Links apply to everyone's existing matches and future imports. Original replay IDs, versions, sites and stats stay stored unchanged. Remove a link to restore the original identification.</p>
  {error&&<p role="alert">{error} <button type="button" onClick={()=>setRevision(n=>n+1)}>Reload links</button></p>}
  {!links||!data?<p>Loading links…</p>:<fieldset disabled={busy}>
   <h3>Link a collector map</h3><p>Maps with unique bombsite evidence are identified automatically. Only unresolved IDs are listed by default. Manual links override automatic identification.</p><label><input type="checkbox" checked={showAll} onChange={e=>{setShowAll(e.target.checked);setCollector('');}}/> Show all collector maps to review or override</label>
   <label>Collector map ID<select value={collector} onChange={e=>setCollector(e.target.value)}><option value="">Select a collector map</option>{ids.filter(id=>showAll||data.matches.some(m=>String(m.mapId)===id&&resolveMap(m.mapName,m.mapId).source==='unknown')).map(id=>{const m=data.matches.find(m=>String(m.mapId)===id)!;return <option key={id} value={id}>{id} · {resolveMap(m.mapName,m.mapId).label}</option>;})}</select></label>
   {collector&&<p>{matches.length} matches · Original names: {[...new Set(matches.map(m=>m.mapName??'Unrecorded'))].join(', ')}<br/>Recorded sites: {[...new Set(data.rounds.filter(r=>matches.some(m=>m.matchId===r.matchId)).map(r=>r.site).filter(Boolean))].join(' · ')||'None'}</p>}
   <label>Correct map<select value={map} onChange={e=>setMap(e.target.value)}><option value="">Choose the actual map</option>{canonicalMaps.map(n=><option key={n}>{n}</option>)}</select></label>
   <button className="btn" disabled={!collector||!map} onClick={()=>void save({...links,maps:[...links.maps.filter(m=>m.collectorId!==collector),{collectorId:collector,map}]})}>Save map link</button>
   {links.maps.map(m=><p key={m.collectorId}>{m.collectorId} → {m.map} <button onClick={()=>void save({...links,maps:links.maps.filter(x=>x.collectorId!==m.collectorId)})}>Remove link</button></p>)}
   <h3>Link a bombsite label</h3>
   <label>Map<select value={siteMap} onChange={e=>{setSiteMap(e.target.value);setAlias('');setSite('');}}><option value="">Choose a map</option>{canonicalMaps.map(n=><option key={n}>{n}</option>)}</select></label>
   <label>Original site label<input list="recorded-site-aliases" maxLength={150} value={alias} onChange={e=>setAlias(e.target.value)} placeholder="Select or enter the original label"/></label>
   <datalist id="recorded-site-aliases">{aliases.map(n=><option key={n} value={n}/>)}</datalist>
   <label>Correct bombsite<input list="canonical-site-labels" maxLength={150} value={site} onChange={e=>setSite(e.target.value)} placeholder="Select or enter the correct bombsite"/></label>
   <datalist id="canonical-site-labels">{(manualSites[siteMap]??[]).map(n=><option key={n} value={n}/>)}</datalist>
   <button className="btn" disabled={!siteMap||!alias.trim()||!site.trim()} onClick={()=>void save({...links,sites:[...links.sites.filter(s=>!(s.map===siteMap&&s.alias.toLowerCase()===alias.trim().toLowerCase())),{map:siteMap,alias:alias.trim(),site:site.trim()}]})}>Save bombsite link</button>
   {links.sites.map((s,i)=><p key={s.map+s.alias}>{s.map}: {s.alias} → {s.site} <button onClick={()=>void save({...links,sites:links.sites.filter((_,j)=>i!==j)})}>Remove link</button></p>)}
   <h3>Correction history</h3><button className="btn" onClick={()=>void loadHistory()}>Load correction history</button>
   {showHistory&&(history.length?history.map(h=><p key={h.revision}>Revision {h.revision} · {new Date(h.changedAt+'Z').toLocaleString()} · account {h.actor.slice(0,12)} <button disabled={h.revision===links.revision} onClick={()=>{const old=JSON.parse(h.payload) as MapLinks;if(window.confirm('Restore all map and bombsite links to revision '+h.revision+'? This affects everyone’s map grouping and preserves all match stats.'))void save({...old,revision:links.revision});}}>Restore these links</button></p>):<p>No corrections recorded since history was enabled. Existing links can still be removed individually.</p>)}
  </fieldset>}
  <p role="status">{notice}</p>
 </div></details>;
}
