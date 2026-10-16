import {impactLabels,type ImpactField} from '../../data/impact';
import {roundSelection,setRoundSelection,partialSelection,noneSelection} from '../../data/roundImpact';
import type {ManualPlayer,ManualPlayerStats} from '../../data/manualMatches';
export function RoundImpactEditor({roster,rows,won,onChange}:{roster:ManualPlayer[];rows:ManualPlayerStats[];won:boolean|null;onChange:(rows:ManualPlayerStats[])=>void}){
 const name=(p:ManualPlayer)=>`${p.username||`Player ${roster.indexOf(p)%5+1}`} · Team ${p.teamIndex===0?'A':'B'}`;
 function select(field:ImpactField,opposite?:ImpactField,friendly=false){
  const value=roundSelection(rows,field);const other=roster.find(p=>p.playerId===(opposite?roundSelection(rows,opposite):''));
  const label=field==='openingKills'?'Opening killer':field==='openingDeaths'?'Opening victim':impactLabels[field];
  return <label key={field}>{label}<select aria-label={label} value={value} onChange={e=>onChange(setRoundSelection(rows,field,e.target.value))}>
   <option value="">Unknown / not tracked</option><option value={noneSelection}>Confirmed none</option>{value===partialSelection&&<option value={partialSelection}>Existing partial entries (kept)</option>}
   {roster.map(p=><option key={p.playerId} value={p.playerId} disabled={!!other&&(p.playerId===other.playerId||(p.teamIndex===other.teamIndex)!==friendly)}>{name(p)}</option>)}
  </select></label>;
 }
 const clutch=roundSelection(rows,'clutches');
 return <details className="impact-player-editors"><summary>Add extra stats (optional)</summary><p className="manual-hint">Leave anything you did not track unknown. Selecting a player records 1 for that player and 0 for everyone else for that stat.</p><div className="manual-stat-fields">
  {select('openingKills','openingDeaths')}{select('openingDeaths','openingKills')}
  <label>Clutch winner &amp; size<select aria-label="Clutch winner and size" value={clutch} onChange={e=>onChange(setRoundSelection(rows,'clutches',e.target.value))}><option value="">Unknown / not tracked</option><option value={noneSelection}>No clutch win</option>{clutch===partialSelection&&<option value={partialSelection}>Existing partial entries (kept)</option>}{roster.map(p=><optgroup key={p.playerId} label={name(p)} disabled={won!=null&&won!==(p.teamIndex===0)}>{[1,2,3,4,5].map(x=><option key={x} value={JSON.stringify([p.playerId,x])}>{name(p)} — won 1v{x}</option>)}</optgroup>)}</select></label>
 </div><p className="manual-hint">Opening killer and opening victim must be on opposing teams. Choose the players involved in the first kill against an opponent, even if a teamkill or other death happened earlier. The killer can be on either team; record opening teamkills separately below.</p><p className="manual-hint">Clutch size is the number of enemies alive when the winner first became the last teammate alive, not their eventual kill count. Later kills by dead teammates do not reduce it.</p><details><summary>Opening teamkill / other death (optional)</summary><p className="manual-hint">Only record these if the round’s first elimination was friendly fire or another death. They stay separate from the first enemy duel. Hidden or blank fields remain unknown.</p><div className="manual-stat-fields">{select('openingTeamkills','openingTeamkillDeaths',true)}{select('openingTeamkillDeaths','openingTeamkills',true)}{select('openingOtherDeaths')}</div></details></details>;
}
