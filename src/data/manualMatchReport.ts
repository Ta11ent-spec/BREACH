import {resolveSite} from './mapCatalog';
import {withManualMatches} from './manualMatches';
import type {ManualRecord} from './manualMatches';
import type {MatchReport} from './matchReportApi';
export function manualMatchReport(record:ManualRecord):MatchReport{
 if(record.status!=='submitted')throw Error('Draft matches do not appear in analytics.');
 const p=record.payload,matchId='manual:'+record.id;
 const report:MatchReport={match:{source:'manual',matchId,mapId:null,mapName:p.map,gameVersion:null,codeVersion:null,matchType:p.mode,gameMode:'Bomb',recordingProfileId:null,playedAt:p.playedAt,lastRecordedAt:null,isCompleteMatch:true,roundCount:p.rounds.length},rounds:[],teams:[],appearances:[],events:[]};
 if(p.summary){
  const data=withManualMatches({matches:[],rounds:[],appearances:[],players:[],perspective:'',rosterStorage:''},[record]);
  report.match={...report.match,roundCount:p.summary.wins+p.summary.losses,summaryScore:{wins:p.summary.wins,losses:p.summary.losses}};
  report.appearances=data.appearances.map(a=>({...a,roundNumber:0,username:p.roster?.find(r=>r.playerId===a.playerId)?.username??'',operatorId:null,spawn:null,scoreSnapshot:null,headshotPercentage:null,damageDealt:null,damageTaken:null,secondsAlive:null,deathTime:null,entryKill:null,entryDeath:null,tradeKill:null,tradedDeath:null,untradedDeath:null,clutch1vX:null,extraStatsJson:null}));
  return report;
 }
 let wins=0,losses=0;
 p.rounds.forEach((r,i)=>{
  const roundId=matchId+':'+(i+1);
  report.rounds.push({roundId,matchId,roundNumber:i+1,site:r.site?resolveSite(p.map,r.site):null,recordedAt:null});
  report.teams.push({roundId,teamSlot:0,sourceLabel:p.roster?'Team A':'Manual player team',side:r.side,won:r.won,scoreBefore:wins,scoreAfter:wins+(r.won===true?1:0),winCondition:null});
  report.teams.push({roundId,teamSlot:1,sourceLabel:p.roster?'Team B':'Opponent (score only)',side:r.side==='Attack'?'Defense':'Attack',won:r.won==null?null:!r.won,scoreBefore:losses,scoreAfter:losses+(r.won===false?1:0),winCondition:null});
  if(r.won===true)wins++;if(r.won===false)losses++;
  for(const player of p.roster??[{playerId:p.playerId,username:p.username,teamIndex:0}]){
  const stats=p.roster?r.players?.find(s=>s.playerId===player.playerId):r;
  report.appearances.push({roundId,matchId,roundNumber:i+1,playerId:player.playerId,username:player.username,teamIndex:player.teamIndex,operatorId:null,operatorName:stats?.operator||null,spawn:null,scoreSnapshot:null,kills:stats?.kills??null,died:stats?.died??null,assists:stats?.assists??null,headshots:stats?.headshots??null,headshotPercentage:null,damageDealt:null,damageTaken:null,secondsAlive:null,deathTime:null,entryKill:null,entryDeath:null,tradeKill:null,tradedDeath:null,untradedDeath:null,clutch1vX:null,extraStatsJson:null});
  }
 });
 return report;
}
