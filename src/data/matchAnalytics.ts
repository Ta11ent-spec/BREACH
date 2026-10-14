import {analyzeOverview,asPercent} from './overviewAnalytics';
import type {OverviewV3,Perspective,ResolvedMatch,V3Appearance} from './overviewAnalytics';
import type {MatchReport,ReportAppearance,ReportEvent,ReportRound,ReportTeam} from './matchReportApi';

type NumericField = 'kills'|'deaths'|'assists'|'headshots'|'damageDealt'|'damageTaken';
export type StatTotals = Record<NumericField,number>;
export type StatCoverage = Record<NumericField,number>;
export type MatchMetrics = Record<NumericField,number|null> & {
  knownTotals:StatTotals; coverage:StatCoverage; sampledRounds:number; kd:string|null; hs:number|null;
  roundWins:number; roundLosses:number; unknownRounds:number;
  attackWins:number; attackRounds:number; defenseWins:number; defenseRounds:number;
};
export type ReportPlayerStats = Record<NumericField,number|null> & {
  playerId:string; username:string; selected:boolean; teamIndex:number|null; roundsPlayed:number;
  operators:string[]; kd:string|null; hs:number|null; knownTotals:StatTotals; coverage:StatCoverage;
};
export type EventAffiliation = 'selected'|'friendly'|'opponent'|'unknown';
export type ResolvedReportEvent = ReportEvent & {
  actorAffiliation:EventAffiliation; targetAffiliation:EventAffiliation;
  kind:'kill'|'death'|'friendly-fire'|'objective'|'other';
};
export type ResolvedReportRound = ReportRound & {
  team:ReportTeam|null; opponent:ReportTeam|null; side:'ATK'|'DEF'|'UNKNOWN';
  won:boolean|null; outcome:'WIN'|'LOSS'|'UNKNOWN'; participated:boolean; selectedPresent:number;
  scoreAfter:number|null; opponentScoreAfter:number|null;
  selectedStats:ReportPlayerStats[]; teammates:ReportPlayerStats[]; opponents:ReportPlayerStats[];
  unknownPlayers:ReportPlayerStats[]; metrics:MatchMetrics; events:ResolvedReportEvent[];
};
export type ResolvedReport = {
  resolved:ResolvedMatch|null; reason:string|null; selectedStats:ReportPlayerStats[];
  teammates:ReportPlayerStats[]; opponents:ReportPlayerStats[]; unknownPlayers:ReportPlayerStats[];
  rounds:ResolvedReportRound[]; metrics:MatchMetrics; trackedRoundCount:number;
};

const isSlot=(value:number|null):value is number=>value===0||value===1;
const numeric=(value:number|null|undefined)=>value!=null&&Number.isFinite(value)&&value>=0?value:null;
const normalizedSide=(side:string|null):'ATK'|'DEF'|'UNKNOWN'=>{
  const value=(side??'').toLowerCase();
  return ['attack','attacker','atk'].includes(value)?'ATK':['defense','defence','defender','def'].includes(value)?'DEF':'UNKNOWN';
};
const ratio=(kills:number|null,deaths:number|null):string|null=>
  kills==null||deaths==null?null:deaths>0?(kills/deaths).toFixed(2):kills>0?'∞':'—';

/** Missing per-round measurements stay missing in totals. Known subtotals and their coverage remain inspectable. */
function stats(rows:ReportAppearance[]){
  const knownTotals:StatTotals={kills:0,deaths:0,assists:0,headshots:0,damageDealt:0,damageTaken:0};
  const coverage:StatCoverage={kills:0,deaths:0,assists:0,headshots:0,damageDealt:0,damageTaken:0};
  for(const row of rows){
    const values={kills:numeric(row.kills),deaths:typeof row.died==='boolean'?Number(row.died):null,
      assists:numeric(row.assists),headshots:numeric(row.headshots),damageDealt:numeric(row.damageDealt),damageTaken:numeric(row.damageTaken)};
    for(const field of Object.keys(values) as NumericField[]){
      const value=values[field];
      if(value!==null){knownTotals[field]+=value;coverage[field]++;}
    }
  }
  const totals=Object.fromEntries((Object.keys(knownTotals) as NumericField[])
    .map(field=>[field,rows.length>0&&coverage[field]===rows.length?knownTotals[field]:null])) as Record<NumericField,number|null>;
  const hsValid=rows.every(row=>row.headshots==null||row.kills==null||row.headshots<=row.kills);
  return {...totals,knownTotals,coverage,sampledRounds:rows.length,kd:ratio(totals.kills,totals.deaths),
    hs:hsValid&&totals.headshots!=null&&totals.kills!=null?asPercent(totals.headshots,totals.kills):null};
}

function playerRows(appearances:ReportAppearance[],chosen:Set<string>):ReportPlayerStats[]{
  const byPlayer=new Map<string,ReportAppearance[]>();
  for(const row of appearances){const group=byPlayer.get(row.playerId)??[];group.push(row);byPlayer.set(row.playerId,group);}
  return [...byPlayer].map(([playerId,rows])=>{
    const slots=new Set(rows.map(row=>row.teamIndex));
    const slot=rows[0].teamIndex;
    return {...stats(rows),playerId,username:rows.find(row=>row.username)?.username??playerId,selected:chosen.has(playerId),
      teamIndex:slots.size===1&&isSlot(slot)?slot:null,roundsPlayed:new Set(rows.map(row=>row.roundId)).size,
      operators:[...new Set(rows.map(row=>row.operatorName).filter((name):name is string=>!!name))]};
  }).sort((a,b)=>(b.kills??-1)-(a.kills??-1)||a.username.localeCompare(b.username)||a.playerId.localeCompare(b.playerId));
}
function splitRows(rows:ReportPlayerStats[],slot:number|null){
  return {selectedStats:slot==null?[]:rows.filter(row=>row.selected&&row.teamIndex===slot),
    teammates:slot==null?[]:rows.filter(row=>row.teamIndex===slot),
    opponents:slot==null?[]:rows.filter(row=>row.teamIndex===1-slot),
    unknownPlayers:rows.filter(row=>slot==null||row.teamIndex==null)};
}
function metrics(rows:ReportAppearance[],rounds:Array<{participated:boolean;won:boolean|null;side:'ATK'|'DEF'|'UNKNOWN'}>):MatchMetrics{
  const played=rounds.filter(round=>round.participated);
  const attack=played.filter(round=>round.side==='ATK'&&typeof round.won==='boolean');
  const defense=played.filter(round=>round.side==='DEF'&&typeof round.won==='boolean');
  return {...stats(rows),roundWins:played.filter(round=>round.won===true).length,
    roundLosses:played.filter(round=>round.won===false).length,unknownRounds:played.filter(round=>round.won==null).length,
    attackWins:attack.filter(round=>round.won===true).length,attackRounds:attack.length,
    defenseWins:defense.filter(round=>round.won===true).length,defenseRounds:defense.length};
}

function classifyEvents(events:ReportEvent[],appearances:ReportAppearance[],chosen:Set<string>,slot:number|null):ResolvedReportEvent[]{
  const byPlayer=new Map<string,ReportAppearance[]>();
  for(const row of appearances){const group=byPlayer.get(row.playerId)??[];group.push(row);byPlayer.set(row.playerId,group);}
  const affiliation=(id:string|null):EventAffiliation=>{
    if(!id||slot==null)return 'unknown';
    const rows=byPlayer.get(id);
    if(!rows?.length)return 'unknown';
    const slots=new Set(rows.map(row=>row.teamIndex));
    if(slots.size!==1||!isSlot(rows[0].teamIndex))return 'unknown';
    if(rows[0].teamIndex!==slot)return 'opponent';
    return chosen.has(id)?'selected':'friendly';
  };
  return [...events].sort((a,b)=>a.eventSequence-b.eventSequence||a.eventId.localeCompare(b.eventId)).map(event=>{
    const actorAffiliation=affiliation(event.actorPlayerId),targetAffiliation=affiliation(event.targetPlayerId);
    const actorFriendly=actorAffiliation==='selected'||actorAffiliation==='friendly';
    const targetFriendly=targetAffiliation==='selected'||targetAffiliation==='friendly';
    const kill=/kill|elimination/i.test(event.eventType??'');
    const kind=kill?(actorFriendly&&targetFriendly?'friendly-fire':actorFriendly?'kill':actorAffiliation==='opponent'&&targetFriendly?'death':'other')
      :/plant|defus|objective/i.test(event.eventType??'')?'objective':'other';
    return {...event,actorAffiliation,targetAffiliation,kind};
  });
}

/** Uses the exact Overview resolver, then attributes every detail through the selected replay team index. */
export function resolveMatchReport(report:MatchReport,perspective:Perspective):ResolvedReport{
  const chosen=new Set(perspective.members.filter(Boolean));
  const roundIndex=new Map(report.rounds.map(round=>[round.roundId,round]));
  const data:OverviewV3={matches:[report.match],rounds:report.teams.flatMap(team=>{
    const round=roundIndex.get(team.roundId);
    return round?[{roundId:team.roundId,matchId:report.match.matchId,roundNumber:round.roundNumber,teamSlot:team.teamSlot,side:team.side,won:team.won}]:[];
  }),appearances:report.appearances as V3Appearance[],players:[],perspective:'selected-player-or-squad',rosterStorage:'local-database'};
  const analysis=analyzeOverview(data,perspective,'ALL');
  const resolved=analysis.matches[0]??null;
  const slot=resolved?.slot??null;
  const present=report.appearances.some(row=>chosen.has(row.playerId));
  const reason=resolved?null:present?'Selected players have conflicting or unknown team indices in this match.':'The selected player or squad did not appear in this match.';
  const selectedAppearances=slot==null?[]:report.appearances.filter(row=>chosen.has(row.playerId)&&row.teamIndex===slot);
  let wins=0,losses=0,allPreviousKnown=true;
  const rounds=[...report.rounds].sort((a,b)=>a.roundNumber-b.roundNumber||a.roundId.localeCompare(b.roundId)).map((round):ResolvedReportRound=>{
    const appearances=report.appearances.filter(row=>row.roundId===round.roundId);
    const selected=slot==null?[]:appearances.filter(row=>chosen.has(row.playerId)&&row.teamIndex===slot);
    const team=slot==null?null:report.teams.find(value=>value.roundId===round.roundId&&value.teamSlot===slot)??null;
    const opponent=slot==null?null:report.teams.find(value=>value.roundId===round.roundId&&value.teamSlot===1-slot)??null;
    const won=typeof team?.won==='boolean'?team.won:null;
    if(won===true)wins++;else if(won===false)losses++;else allPreviousKnown=false;
    const participated=selected.length>0,side=normalizedSide(team?.side??null);
    return {...round,team,opponent,side,won,outcome:won===true?'WIN':won===false?'LOSS':'UNKNOWN',participated,
      selectedPresent:new Set(selected.map(row=>row.playerId)).size,
      scoreAfter:numeric(team?.scoreAfter)??(allPreviousKnown?wins:null),
      opponentScoreAfter:numeric(opponent?.scoreAfter)??(allPreviousKnown?losses:null),
      ...splitRows(playerRows(appearances,chosen),slot),metrics:metrics(selected,[{participated,side,won}]),
      events:classifyEvents(report.events.filter(event=>event.roundId===round.roundId),appearances,chosen,slot)};
  });
  return {resolved,reason,...splitRows(playerRows(report.appearances,chosen),slot),rounds,
    metrics:metrics(selectedAppearances,rounds),trackedRoundCount:rounds.filter(round=>round.participated).length};
}

export function getRoundPerspective(view:ResolvedReport,roundId:string):ResolvedReportRound|null{
  return view.rounds.find(round=>round.roundId===roundId)??null;
}

/** Only receives the filtered, perspective-resolved archive. Scores are labeled as recorded round counts. */
export function matchCsv(matches:ResolvedMatch[]):string{
  const cell=(value:unknown)=>{
    const text=value==null?'':String(value);
    // Spreadsheet formula escaping also applies to imported strings and player-controlled labels.
    const safe=/^[=+\-@\t\r]/.test(text)?"'"+text:text;
    return '"'+safe.replace(/"/g,'""')+'"';
  };
  const header=['Match ID','Played at','Map','Map ID','Match type','Game mode','Result','Recorded round wins','Recorded round losses','Recorded rounds','Selected players present','Resolved replay team index'];
  const rows=matches.map(match=>[match.matchId,match.playedAt,match.mapName,match.mapId,match.matchType,match.gameMode,
    match.outcome,match.wins,match.losses,match.roundCount,match.present,match.slot]);
  return [header,...rows].map(row=>row.map(cell).join(',')).join('\r\n');
}
