import type {OverviewV3} from './overviewAnalytics';
export type Playlist='ranked'|'unranked'|'casual'|'other';
export const playlistLabels:Record<Playlist,string>={ranked:'RANKED',unranked:'UNRANKED / STANDARD',casual:'CASUAL / QUICK MATCH',other:'OTHER / UNKNOWN'};
export function matchPlaylist(kind:string|null|undefined):Playlist{
 const value=(kind??'').toLowerCase().replace(/[^a-z]/g,'').replace(/bomb$/,'');
 return value==='ranked'?'ranked':['unranked','standard'].includes(value)?'unranked':['casual','quickmatch'].includes(value)?'casual':'other';
}
export function filterPlaylist(data:OverviewV3,playlist:Playlist):OverviewV3{
 const matches=data.matches.filter(m=>matchPlaylist(m.matchType)===playlist),ids=new Set(matches.map(m=>m.matchId));
 return {...data,matches,rounds:data.rounds.filter(r=>ids.has(r.matchId)),appearances:data.appearances.filter(a=>ids.has(a.matchId))};
}
