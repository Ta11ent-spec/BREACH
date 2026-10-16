import type {OverviewV3} from './overviewAnalytics';
export type ManualPlayer={playerId:string;username:string;teamIndex:0|1};
export type ManualPlayerStats={playerId:string;operator:string;kills:number|null;died:boolean|null;assists:number|null;headshots:number|null};
export type ManualRound={side:'Attack'|'Defense';operator:string;site:string;won:boolean|null;kills:number|null;died:boolean|null;assists:number|null;headshots:number|null;notes:string;players?:ManualPlayerStats[]};
export type ManualSummary={wins:number;losses:number;players:{playerId:string;kills:number|null;deaths:number|null;assists:number|null;headshots:number|null}[]};
export type ManualMatch={playerId:string;username:string;platform:'PC'|'PlayStation'|'Xbox';map:string;mode:'Ranked Bomb'|'Custom Bomb';target:number;playedAt:string;notes:string;rounds:ManualRound[];roster?:ManualPlayer[];summary?:ManualSummary};
export type ManualRecord={id:string;revision:number;status:'draft'|'submitted';payload:ManualMatch;updatedAt?:string};
export const newRound=(side:ManualRound['side']='Attack',roster?:ManualPlayer[]):ManualRound=>({players:roster?.map(p=>({playerId:p.playerId,operator:'',kills:null,died:null,assists:null,headshots:null})),side,operator:'',site:'',won:null,kills:null,died:null,assists:null,headshots:null,notes:''});
export function manualTotals(p:ManualMatch){
 const sum=(key:'kills'|'assists'|'headshots')=>p.rounds.length&&p.rounds.every(r=>r[key]!=null)?p.rounds.reduce((n,r)=>n+r[key]!,0):null;
 return {wins:p.rounds.filter(r=>r.won===true).length,losses:p.rounds.filter(r=>r.won===false).length,kills:sum('kills'),assists:sum('assists'),headshots:sum('headshots'),deaths:p.rounds.length&&p.rounds.every(r=>r.died!=null)?p.rounds.filter(r=>r.died).length:null};
}
export function manualErrors(p:ManualMatch):string[]{
 const errors:string[]=[];
 if(p.roster){
  if(p.roster.length!==10||[0,1].some(t=>p.roster!.filter(x=>x.teamIndex===t).length!==5))errors.push('Add five players to each team.');
  if(p.roster.some(x=>!x.playerId||!x.username.trim()))errors.push('Name or select all ten players.');
  if(new Set(p.roster.map(x=>x.playerId)).size!==p.roster.length)errors.push('Each player can appear only once.');
 }else if(!p.playerId||!p.username.trim())errors.push('Select a player or name a manual profile.');
 if(!p.map.trim())errors.push('Enter the map.');
 if(!Number.isFinite(Date.parse(p.playedAt))||Date.parse(p.playedAt)>Date.now()+300000)errors.push('Enter a valid match date, not in the future.');
 if(p.summary){
  const {wins,losses,players}=p.summary,n=wins+losses;
  const validScore=p.mode==='Ranked Bomb'?((Math.max(wins,losses)===4&&Math.min(wins,losses)<=2)||(Math.max(wins,losses)===5&&Math.min(wins,losses)>=3&&Math.min(wins,losses)<=4)):Math.max(wins,losses)===p.target&&Math.min(wins,losses)<p.target;
  if(!Number.isInteger(wins)||!Number.isInteger(losses)||wins<0||losses<0||!validScore)errors.push('Enter a complete final score.');
  if(!p.roster||players.length!==10||new Set(players.map(x=>x.playerId)).size!==10||players.some(x=>!p.roster?.some(r=>r.playerId===x.playerId)))errors.push('Enter all ten scoreboard players.');
  for(const row of players){for(const key of ['kills','deaths','assists','headshots'] as const){const v=row[key];if(v!=null&&(!Number.isInteger(v)||v<0||v>(key==='deaths'?n:n*5)))errors.push('Scoreboard stats exceed the match limits.');}if(row.headshots!=null&&(row.kills==null||row.headshots>row.kills))errors.push('Headshots cannot exceed kills.');}
  return errors;
 }
 let wins=0,losses=0,ended=false;
 for(const [i,r]of p.rounds.entries()){
  if(ended)errors.push(`Round ${i+1} occurs after the match has ended.`);
  if(r.won==null)errors.push(`Round ${i+1}: choose a result.`);
  if(p.roster && (r.players?.length!==10||p.roster.some(p=>!r.players?.some(s=>s.playerId===p.playerId))))errors.push(`Round ${i+1}: all ten players are required.`);
  for(const stats of r.players??[r]){
  for(const k of ['kills','assists','headshots'] as const)if(stats[k]!=null&&(!Number.isInteger(stats[k])||stats[k]!<0||stats[k]!>5))errors.push(`Round ${i+1}: ${k} must be 0–5.`);
  if(stats.headshots!=null&&(stats.kills==null||stats.headshots>stats.kills))errors.push(`Round ${i+1}: headshots cannot exceed kills.`);
  }
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
  for(const player of p.roster??[{playerId:p.playerId,username:p.username,teamIndex:0}])if(!data.players.some(x=>x.playerId===player.playerId))data.players.push({...player,profileId:null});
  data.matches.push({matchId,playedAt:p.playedAt,mapName:p.map,mapId:null,matchType:p.mode,gameMode:'Bomb',recordingProfileId:null,isCompleteMatch:true,source:'manual',roundCount:p.summary?p.summary.wins+p.summary.losses:p.rounds.length,summaryScore:p.summary?{wins:p.summary.wins,losses:p.summary.losses}:undefined});
  if(p.summary){for(const player of p.roster??[]){const stats=p.summary.players.find(x=>x.playerId===player.playerId);data.appearances.push({roundId:matchId+':summary',matchId,playerId:player.playerId,teamIndex:player.teamIndex,roundsRepresented:p.summary.wins+p.summary.losses,deaths:stats?.deaths??null,kills:stats?.kills??null,died:null,assists:stats?.assists??null,headshots:stats?.headshots??null,operatorName:null});}continue;}
  p.rounds.forEach((round,i)=>{
   const roundId=matchId+':'+(i+1);
   data.rounds.push({roundId,matchId,roundNumber:i+1,teamSlot:0,side:round.side,won:round.won,site:round.site||null});
   if(p.roster)data.rounds.push({roundId,matchId,roundNumber:i+1,teamSlot:1,side:round.side==='Attack'?'Defense':'Attack',won:round.won==null?null:!round.won,site:round.site||null});
   for(const player of p.roster??[{playerId:p.playerId,username:p.username,teamIndex:0}]){
    const stats=p.roster?round.players?.find(s=>s.playerId===player.playerId):round;
    data.appearances.push({roundId,matchId,playerId:player.playerId,teamIndex:player.teamIndex,kills:stats?.kills??null,died:stats?.died??null,assists:stats?.assists??null,headshots:stats?.headshots??null,operatorName:stats?.operator||null});
   }
  });
 }
 return data;
}
