/** Deterministic, unit-testable V3 analytics. No replay slot-0 assumption. */
import type {Impact} from './impact';
import { displayMapLabel, resolveMap } from './mapCatalog';
export type V3Match = {
  summaryScore?: {wins:number;losses:number};
  source?: 'replay'|'manual';
  matchId: string; playedAt: string | null; mapName: string | null; mapId: number | string | null;
  matchType: string | null; gameMode: string | null;
  recordingProfileId: string | null; isCompleteMatch: boolean | null; roundCount: number;
};
export type V3Round = { roundId: string; matchId: string; roundNumber: number; teamSlot: number; side: string | null; won: boolean | null; site?: string | null };
export type V3Appearance = {
  impact?:Impact|null;
  roundsRepresented?:number; deaths?:number|null;
  roundId: string; matchId: string; playerId: string; teamIndex: number | null;
  kills: number | null; died: boolean | null; assists: number | null;
  headshots: number | null; operatorName: string | null;
};
export type V3Player = { playerId: string; profileId: string | null; username: string };
export type OverviewV3 = {
  matches: V3Match[]; rounds: V3Round[]; appearances: V3Appearance[];
  players: V3Player[]; perspective: string; rosterStorage: string;
};
export type Perspective = { mode: 'team'; members: string[] } | { mode: 'player'; members: string[] };
export type ResolvedMatch = V3Match & {
  slot: number; present: number; wins: number; losses: number;
  outcome: 'WIN' | 'LOSS' | 'UNKNOWN'; scopedRounds: V3Round[];
};
export type Leader = { playerId: string; username: string; kills: number; deaths: number; roundsPlayed: number; kd: string | null };
export type MapStat = { key: string; label: string; played: number; wins: number };
export type OperatorStat = { name: string; side: string; rounds: number };
export type Analysis = {
  matches: ResolvedMatch[]; decided: ResolvedMatch[]; wins: number; losses: number;
  rounds: number; roundWins: number; roundLosses: number;
  attackRounds: number; attackWins: number; defenseRounds: number; defenseWins: number;
  totalKills: number; totalDeaths: number; kd: string | null;
  headshots: number; hsEligibleKills: number; hsTotalKills: number; hs: number | null;
  players: Leader[]; maps: MapStat[]; operators: OperatorStat[];
  latest: ResolvedMatch | null; ambiguousMatches: number;
};
export const asPercent = (num: number, den: number) => den > 0 ? Math.round(100 * num / den) : null;
const isSlot = (slot: number | null): slot is number => slot === 0 || slot === 1;
const asSide = (side: string | null) => {
  const s = (side || '').toLowerCase();
  if (['attack','attacker','atk'].includes(s)) return 'attack';
  if (['defense','defence','defender','def'].includes(s)) return 'defense';
  return null;
};
const percentRange = (at: string | null, period: '7D' | '30D' | 'ALL', now: number) => {
  if (period === 'ALL') return true;
  const time = at ? Date.parse(at) : NaN;
  return Number.isFinite(time) && time <= now && time >= now - (period === '7D' ? 7 : 30) * 86400000;
};

/** No opponent stats are included in personal/squad totals. Ambiguous squad sides are excluded. */
export function analyzeOverview(data: OverviewV3, perspective: Perspective, period: '7D' | '30D' | 'ALL', now = Date.now()): Analysis {
  const chosen = new Set(perspective.members.filter(Boolean));
  const names = new Map(data.players.map(p => [p.playerId, p.username]));
  const appearancesByMatch = new Map<string,V3Appearance[]>();
  const roundsByMatch = new Map<string,V3Round[]>();
  for (const a of data.appearances) {
    const bucket = appearancesByMatch.get(a.matchId) ?? [];
    bucket.push(a); appearancesByMatch.set(a.matchId,bucket);
  }
  for (const r of data.rounds) {
    const bucket = roundsByMatch.get(r.matchId) ?? [];
    bucket.push(r); roundsByMatch.set(r.matchId,bucket);
  }
  const matches: ResolvedMatch[] = [];
  const stats: V3Appearance[] = [];
  const playedSides: V3Round[] = [];
  let ambiguousMatches = 0;
  for (const match of data.matches.filter(m=>percentRange(m.playedAt,period,now))) {
    const joined = (appearancesByMatch.get(match.matchId) ?? []).filter(a=>chosen.has(a.playerId));
    if (!joined.length) continue;
    if(perspective.mode==='team' && new Set(joined.map(a=>a.playerId)).size!==chosen.size)continue;
    const slots = new Set(joined.map(a=>a.teamIndex));
    const slot = joined[0].teamIndex;
    if (slots.size !== 1 || !isSlot(slot)) {ambiguousMatches++; continue;}
    const present = new Set(joined.map(a=>a.playerId)).size;
    if(match.summaryScore){const {wins:a,losses:b}=match.summaryScore;const wins=slot===0?a:b,losses=slot===0?b:a;stats.push(...joined);matches.push({...match,slot,present,wins,losses,outcome:wins>losses?'WIN':wins<losses?'LOSS':'UNKNOWN',scopedRounds:[]});continue;}
    const all = (roundsByMatch.get(match.matchId) ?? []).filter(r=>r.teamSlot===slot)
      .sort((a,b)=>a.roundNumber-b.roundNumber);
    // The match score is only verified if every recorded round has a result
    // and the match itself was marked complete by the validated importer.
    const verified = match.isCompleteMatch===true && match.roundCount>0 &&
      all.length===match.roundCount && all.every(r=>typeof r.won==='boolean');
    const wins = all.filter(r=>r.won===true).length;
    const losses = all.filter(r=>r.won===false).length;
    const outcome = !verified || wins===losses ? 'UNKNOWN' : wins>losses ? 'WIN' : 'LOSS';
    const appearancesInSide = joined.filter(a=>a.teamIndex===slot);
    const participated = new Set(appearancesInSide.map(a=>a.roundId));
    const scopedRounds = all.filter(r=>participated.has(r.roundId) && typeof r.won==='boolean');
    playedSides.push(...scopedRounds);
    stats.push(...appearancesInSide);
    matches.push({...match,slot,present,wins,losses,outcome,scopedRounds});
  }
  matches.sort((a,b)=>(Date.parse(b.playedAt??'')||0)-(Date.parse(a.playedAt??'')||0) || a.matchId.localeCompare(b.matchId));
  const decided = matches.filter(m=>m.outcome!=='UNKNOWN');
  const wins = decided.filter(m=>m.outcome==='WIN').length;
  const losses = decided.length-wins;
  let attackRounds=0,attackWins=0,defenseRounds=0,defenseWins=0;
  for(const r of playedSides){
    const side=asSide(r.side);
    if(side==='attack'){attackRounds++;if(r.won)attackWins++;}
    if(side==='defense'){defenseRounds++;if(r.won)defenseWins++;}
  }
  const summaries=matches.filter(m=>m.summaryScore);
  const rounds = new Set(playedSides.map(r=>r.roundId)).size+summaries.reduce((n,m)=>n+m.roundCount,0);
  const roundWins=playedSides.filter(r=>r.won===true).length+summaries.reduce((n,m)=>n+m.wins,0);
  const roundLosses=playedSides.filter(r=>r.won===false).length+summaries.reduce((n,m)=>n+m.losses,0);
  const totalKills=stats.reduce((s,a)=>s+(a.kills??0),0);
  const totalDeaths=stats.reduce((s,a)=>s+(a.deaths??(a.died===true?1:0)),0);
  const kd=stats.length>0 && stats.every(a=>(a.deaths!=null||a.died!==null) && a.kills!==null)
    ? totalDeaths>0 ? (totalKills/totalDeaths).toFixed(2) : totalKills>0?'∞':'—' : null;
  const hsRows=stats.filter(a=>a.headshots!==null && a.kills!==null);
  const hsEligibleKills=hsRows.reduce((s,a)=>s+(a.kills??0),0);
  const headshots=hsRows.reduce((s,a)=>s+(a.headshots??0),0);
  const hsTotalKills=stats.reduce((s,a)=>s+(a.kills??0),0);
  const hs=headshots<=hsEligibleKills ? asPercent(headshots,hsEligibleKills) : null;
  const byPlayer=new Map<string,V3Appearance[]>();
  for(const a of stats){const bucket=byPlayer.get(a.playerId)??[];bucket.push(a);byPlayer.set(a.playerId,bucket);}
  const players=[...byPlayer].map(([playerId,rows]):Leader=>{
    const kills=rows.reduce((s,a)=>s+(a.kills??0),0);
    const deaths=rows.reduce((n,a)=>n+(a.deaths??Number(a.died===true)),0);
    return {playerId,username:names.get(playerId)??playerId,kills,deaths,roundsPlayed:rows.reduce((n,a)=>n+(a.roundsRepresented??1),0),
      kd:rows.every(a=>(a.deaths!=null||a.died!==null) && a.kills!==null)?(deaths>0?(kills/deaths).toFixed(2):kills>0?'∞':'—'):null};
  }).sort((a,b)=>b.kills-a.kills || a.username.localeCompare(b.username));
  const maps=new Map<string,MapStat>();
  for(const m of decided){
    const label = displayMapLabel(m.mapName,m.mapId);
    const key=resolveMap(m.mapName,m.mapId).key;
    const x=maps.get(key)??{key,label,played:0,wins:0};
    x.played++; if(m.outcome==='WIN') x.wins++; maps.set(key,x);
  }
  const ops=new Map<string,OperatorStat>();
  const sidesByRound=new Map(playedSides.map(r=>[r.roundId,asSide(r.side)]));
  for(const a of stats){
    if(!a.operatorName)continue;
    const side=sidesByRound.get(a.roundId)??'unknown';
    const key=`${a.operatorName}|${side}`;
    const x=ops.get(key)??{name:a.operatorName,side,rounds:0};
    x.rounds++;ops.set(key,x);
  }
  return {matches,decided,wins,losses,rounds,roundWins,roundLosses,
    attackRounds,attackWins,defenseRounds,defenseWins,totalKills,totalDeaths,kd,
    headshots,hsEligibleKills,hsTotalKills,hs,
    players,maps:[...maps.values()].sort((a,b)=>(b.wins/b.played-a.wins/a.played)||b.played-a.played).slice(0,5),
    operators:[...ops.values()].sort((a,b)=>b.rounds-a.rounds||a.name.localeCompare(b.name)).slice(0,4),
    latest:matches[0]??null,ambiguousMatches};
}
