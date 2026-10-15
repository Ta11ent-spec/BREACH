import type {ManualRecord} from './manualMatches';
import type {MatchReport} from './matchReportApi';
export function manualMatchReport(record:ManualRecord):MatchReport{
 if(record.status!=='submitted')throw Error('Draft matches do not appear in analytics.');
 const p=record.payload,matchId='manual:'+record.id;
 const report:MatchReport={match:{source:'manual',matchId,mapId:null,mapName:p.map,gameVersion:null,codeVersion:null,matchType:p.mode,gameMode:'Bomb',recordingProfileId:null,playedAt:p.playedAt,lastRecordedAt:null,isCompleteMatch:true,roundCount:p.rounds.length},rounds:[],teams:[],appearances:[],events:[]};
 let wins=0,losses=0;
 p.rounds.forEach((r,i)=>{
  const roundId=matchId+':'+(i+1);
  report.rounds.push({roundId,matchId,roundNumber:i+1,site:r.site||null,recordedAt:null});
  report.teams.push({roundId,teamSlot:0,sourceLabel:'Manual player team',side:r.side,won:r.won,scoreBefore:wins,scoreAfter:wins+(r.won===true?1:0),winCondition:null});
  report.teams.push({roundId,teamSlot:1,sourceLabel:'Opponent (score only)',side:r.side==='Attack'?'Defense':'Attack',won:r.won==null?null:!r.won,scoreBefore:losses,scoreAfter:losses+(r.won===false?1:0),winCondition:null});
  if(r.won===true)wins++;if(r.won===false)losses++;
  report.appearances.push({roundId,matchId,roundNumber:i+1,playerId:p.playerId,username:p.username,teamIndex:0,operatorId:null,operatorName:r.operator||null,spawn:null,scoreSnapshot:null,kills:r.kills,died:r.died,assists:r.assists,headshots:r.headshots,headshotPercentage:null,damageDealt:null,damageTaken:null,secondsAlive:null,deathTime:null,entryKill:null,entryDeath:null,tradeKill:null,tradedDeath:null,untradedDeath:null,clutch1vX:null,extraStatsJson:null});
 });
 return report;
}
