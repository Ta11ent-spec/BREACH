/** Local read-only API contracts. Null means missing or unverified, never a measured zero. */
import { displayMapLabel } from './mapCatalog';
import {authHeaders} from '../auth/apiAuth';
export type ApiMatch = {
  matchId: string; mapName: string | null; mapId: number | string | null;
  gameVersion: string | null; matchType: string | null; gameMode: string | null;
  playedAt: string | null; roundCount: number; roundsWon: number; roundsLost: number;
  isCompleteMatch?: boolean | null;
};
export type ApiRound = {
  roundId: string; roundNumber: number; site: string | null; recordedAt?: string | null;
  side: string | null; won: boolean | null; scoreBefore?: number | null;
  scoreAfter: number | null; opponentScoreAfter: number | null; winCondition: string | null;
};
export type ApiPlayer = {
  playerId: string; username: string; roundsPlayed: number;
  kills: number; deaths: number; assists: number;
  headshots?: number; damageDealt?: number | null; damageTaken?: number | null;
  recordedTeam?: number;
  entryKills?: number; entryDeaths?: number; tradeKills?: number;
};
export type ApiRoundPlayer = {
  playerId: string; username: string; teamIndex: number | null;
  operatorName: string | null; spawn: string | null; kills: number | null;
  died: boolean | null; assists: number | null; headshots: number | null;
  damageDealt: number | null; damageTaken: number | null;
  secondsAlive: number | null; entryKill: boolean | null; entryDeath: boolean | null;
  tradeKill: boolean | null; tradedDeath: boolean | null;
  untradedDeath: boolean | null; clutch1vX: number | null;
};
export type ApiEvent = {
  eventSequence: number; eventType: string | null; actorUsername: string | null;
  targetUsername: string | null; timeRemainingSeconds: number | null;
  isHeadshot: boolean | null; weaponId: number | string | null;
};
export type ApiMatchDetail = {match: Omit<ApiMatch,'roundCount'|'roundsWon'|'roundsLost'>; rounds: ApiRound[]; players: ApiPlayer[]};
export type ApiRoundDetail = {round: ApiRound; players: ApiRoundPlayer[]; events: ApiEvent[]};
export type ApiPlayerDetail = {player: ApiPlayer; operators: Array<{operatorName:string|null;roundsPlayed:number;kills:number;deaths:number}>};

export class ApiError extends Error {
  constructor(public readonly status: number, message: string){super(message); this.name='ApiError';}
}
export async function fetchApi<T>(path:string, signal?:AbortSignal):Promise<T>{
  const response=await fetch(`/api${path}`,{signal,headers:{Accept:'application/json',...await authHeaders()}});
  if(!response.ok) throw new ApiError(response.status, response.status===404?'Record not found':`API request failed (${response.status})`);
  return response.json() as Promise<T>;
}
export function mapLabel(name:string|null|undefined,id:number|string|null|undefined){
  return displayMapLabel(name,id);
}
export function formatPlayedAt(value:string|null|undefined){return value?new Date(value).toLocaleString(): 'Date unavailable';}
export function nullableStat(value:number|null|undefined){return value==null?'—':value.toLocaleString();}

/** Read-only, replay-team-slot-0 dashboard data. No invented opponent/team identity. */
export type ApiOverviewMatch = ApiMatch & {
  attackRounds: number; attackWins: number; defenseRounds: number; defenseWins: number;
};
export type ApiOverviewRound = {
  matchId: string; roundNumber: number; side: string | null; won: boolean | null;
};
export type ApiOverviewPlayer = {
  matchId: string; playerId: string; username: string; roundsPlayed: number;
  kills: number; deaths: number; assists: number; headshots: number;
  killsWithHeadshotData: number; deathSampledRounds: number;
};
export type ApiOverviewOperator = {
  matchId: string; operatorName: string | null; side: string | null; roundsPlayed: number;
};
export type ApiOverview = {
  matches: ApiOverviewMatch[]; rounds: ApiOverviewRound[];
  players: ApiOverviewPlayer[]; operators: ApiOverviewOperator[];
  perspective: 'replay-team-slot-0';
};
