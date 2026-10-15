import type {OverviewV3} from './overviewAnalytics';
import type {ManualRecord} from './manualMatches';
import {withManualMatches} from './manualMatches';
export type AnalyticsSource='replay'|'manual'|'combined';
export const isManual=(match:{source?:string;matchId:string})=>match.source==='manual'||match.matchId.startsWith('manual:');
export const sourceLabel=(match:{source?:string;matchId:string})=>isManual(match)?'MANUAL / UNVERIFIED':'REPLAY';
export function selectSources(base:OverviewV3,records:ManualRecord[],source:AnalyticsSource):OverviewV3{
 const full=source==='replay'?base:withManualMatches(base,records);
 const matches=full.matches.filter(m=>source==='combined'||isManual(m)===(source==='manual'));
 const ids=new Set(matches.map(m=>m.matchId));
 const appearances=full.appearances.filter(a=>ids.has(a.matchId));
 const players=new Set(appearances.map(a=>a.playerId));
 return {...full,matches,appearances,rounds:full.rounds.filter(a=>ids.has(a.matchId)),players:source==='manual'?full.players.filter(p=>players.has(p.playerId)):full.players};
}
