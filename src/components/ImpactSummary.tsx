import {impactTotals,impactLabels,impactFields,type Impact} from '../data/impact';

export function ImpactSummary({rows}:{rows:{impact?:Impact|null;roundsRepresented?:number}[]}){
 const totals=impactTotals(rows);
 const metrics=[...impactFields.map(f=>({label:impactLabels[f],...totals.fields[f]})),...totals.clutches.map((v,k)=>({label:`1v${k+1} clutch wins`,...v}))];
 const recorded=metrics.filter(v=>v.covered>0);
 const events=recorded.filter(v=>(v.value??0)>0);
 return <section className="panel"><div className="panel-head"><h3>Opening duels &amp; clutch wins</h3></div><div className="workspace-body">
  {events.length>0?<div className="contrib-list">{events.map(v=><div className="contrib-row" key={v.label}><span>{v.label} <small>· {v.covered}/{totals.rounds} player-rounds recorded</small></span><strong>{v.value}</strong></div>)}</div>:<p className="muted-note">{recorded.length?'No opening events or clutch wins in the measured stats for this selection. Unmeasured stats remain unknown.':'Opening and clutch stats were not recorded for this selection.'}</p>}
  <details><summary>{recorded.length?'View coverage and definitions':'Why are these stats unavailable?'}</summary>
   {recorded.length>0&&<div className="contrib-list">{metrics.map(v=><div className="contrib-row" key={v.label}><span>{v.label} <small>· {v.covered}/{totals.rounds} player-rounds recorded</small></span><strong>{v.value??'Unknown'}</strong></div>)}</div>}
   <p className="muted-note">Existing uploads were not backfilled. New uploads from collector v0.3.9 or later can include these stats for complete, consistent Ranked Bomb rounds. Other modes or rounds that cannot be verified remain unknown. Manual entries include only the optional stats you enter. Missing data is not zero.</p>
   <p className="muted-note">Counts describe the selected players only. Enemy opening duels exclude teamkills. Separate opening incidents describe the first elimination. A clutch win records opponents alive when the winner first became the last teammate standing; later gadget kills by dead teammates do not reduce that count.</p>
  </details>
 </div></section>;
}
