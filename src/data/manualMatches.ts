import type {OverviewV3} from './overviewAnalytics';
export type ManualRound={side:'Attack'|'Defense';operator:string;site:string;won:boolean|null;kills:number|null;died:boolean|null;assists:number|null;headshots:number|null;notes:string};
export type ManualMatch={playerId:string;username:string;platform:'PC'|'PlayStation'|'Xbox';map:string;mode:'Ranked Bomb'|'Custom Bomb';target:number;playedAt:string;notes:string;rounds:ManualRound[]};
export type ManualRecord={id:string;revision:number;status:'draft'|'submitted';payload:ManualMatch;updatedAt?:string};
export const newRound=(side:ManualRound['side']='Attack'):ManualRound=>({side,operator:'',site:'',won:null,kills:null,died:null,assists:null,headshots:null,notes:''});
export function manualTotals(p:ManualMatch){
 const sum=(key:'kills'|'assists'|'headshots')=>p.rounds.length&&p.rounds.every(r=>r[key]!=null)?p.rounds.reduce((n,r)=>n+r[key]!,0):null;
 return {wins:p.rounds.filter(r=>r.won===true).length,losses:p.rounds.filter(r=>r.won===false).length,kills:sum('kills'),assists:sum('assists'),headshots:sum('headshots'),deaths:p.rounds.length&&p.rounds.every(r=>r.died!=null)?p.rounds.filter(r=>r.died).length:null};
}
export function manualErrors(p:ManualMatch):string[]{
 const errors:string[]=[];
 if(!p.playerId||!p.username.trim())errors.push('Select a player or name a manual profile.');
 if(!p.map.trim())errors.push('Enter the map.');
 if(!Number.isFinite(Date.parse(p.playedAt))||Date.parse(p.playedAt)>Date.now()+300000)errors.push('Enter a valid match date, not in the future.');
 let wins=0,losses=0,ended=false;
 for(const [i,r]of p.rounds.entries()){
  if(ended)errors.push(`Round ${i+1} occurs after the match has ended.`);
  if(r.won==null)errors.push(`Round ${i+1}: choose a result.`);
  for(const k of ['kills','assists','headshots'] as const)if(r[k]!=null&&(!Number.isInteger(r[k])||r[k]!<0||r[k]!>5))errors.push(`Round ${i+1}: ${k} must be 0–5.`);
  if(r.headshots!=null&&(r.kills==null||r.headshots>r.kills))errors.push(`Round ${i+1}: headshots cannot exceed kills.`);
  if(r.won===true)wins++;else if(r.won===false)losses++;
  ended=p.mode==='Ranked Bomb'?(Math.max(wins,losses)>=5||(Math.max(wins,losses)>=4&&Math.abs(wins-losses)>=2)):Math.max(wins,losses)>=p.target;
 }
 if(!ended)errors.push('Record all rounds through a match-ending score.');
 return errors;
}
/** Completion is independent of provenance: submitted manual results remain self-reported. */
export function withManualMatches(base:OverviewV3,records:ManualRecord[]):OverviewV3{
 const data:OverviewV3={...base,matches:[...base.matches],rounds:[...base.rounds],appearances:[...base.appearances],players:[...base.players]};
 for(const {id,status,payload:p}of records){
  if(status!=='submitted')continue;
  const matchId='manual:'+id;
  if(data.matches.some(m=>m.matchId===matchId))continue;
  if(!data.players.some(x=>x.playerId===p.playerId))data.players.push({playerId:p.playerId,profileId:null,username:p.username});
  data.matches.push({matchId,playedAt:p.playedAt,mapName:p.map,mapId:null,matchType:p.mode,gameMode:'Bomb',recordingProfileId:null,isCompleteMatch:true,source:'manual',roundCount:p.rounds.length});
  p.rounds.forEach((round,i)=>{
   const roundId=matchId+':'+(i+1);
   data.rounds.push({roundId,matchId,roundNumber:i+1,teamSlot:0,side:round.side,won:round.won,site:round.site||null});
   data.appearances.push({roundId,matchId,playerId:p.playerId,teamIndex:0,kills:round.kills,died:round.died,assists:round.assists,headshots:round.headshots,operatorName:round.operator||null});
  });
 }
 return data;
}
