import type {Impact} from './impact';
import {resolveMap,resolveSite} from './mapCatalog';
import {fetchApi} from './realApi';

/** Raw round-level replay data. A null field means it was not recorded. */
export type ReportMatch = {
  summaryScore?:{wins:number;losses:number};
  source?: 'replay'|'manual';
  matchId: string; mapId: number | string | null; mapName: string | null;
  gameVersion: string | null; codeVersion: string | null;
  matchType: string | null; gameMode: string | null;
  recordingProfileId: string | null; playedAt: string | null;
  lastRecordedAt: string | null; isCompleteMatch: boolean | null;
  roundCount: number;
};

export type ReportRound = {
  roundId: string; matchId: string; roundNumber: number;
  site: string | null; recordedAt: string | null;
};

export type ReportTeam = {
  roundId: string; teamSlot: number; sourceLabel: string | null;
  side: string | null; won: boolean | null;
  scoreBefore: number | null; scoreAfter: number | null;
  winCondition: string | null;
};

export type ReportAppearance = {
  roundsRepresented?:number; deaths?:number|null;
  roundId: string; matchId: string; roundNumber: number;
  playerId: string; username: string | null; teamIndex: number | null;
  operatorId: number | string | null; operatorName: string | null; spawn: string | null;
  scoreSnapshot: number | null; kills: number | null; died: boolean | null;
  assists: number | null; headshots: number | null; headshotPercentage: number | null;
  damageDealt: number | null; damageTaken: number | null;
  secondsAlive: number | null; deathTime: number | null;
  entryKill: boolean | null; entryDeath: boolean | null;
  tradeKill: boolean | null; tradedDeath: boolean | null;
  untradedDeath: boolean | null; clutch1vX: number | null;
  extraStatsJson: string | null; impact?:Impact|null;
};

export type ReportEvent = {
  eventId: string; roundId: string; roundNumber: number;
  eventSequence: number; eventType: string | null;
  actorUsername: string | null; targetUsername: string | null;
  actorPlayerId: string | null; targetPlayerId: string | null;
  timeRemainingSeconds: number | null; isHeadshot: boolean | null;
  weaponId: number | string | null;
};

export type MatchReport = {
  match: ReportMatch; rounds: ReportRound[]; teams: ReportTeam[];
  appearances: ReportAppearance[]; events: ReportEvent[];
};

export type ApiMatchReport = MatchReport;

export async function fetchMatchReport(id: string, signal?: AbortSignal): Promise<MatchReport> {
  const data=await fetchApi<MatchReport>(`/matches/${encodeURIComponent(id)}/report`, signal);
  const map=resolveMap(data.match.mapName,data.match.mapId);
  return {...data,rounds:data.rounds.map(r=>({...r,site:resolveSite(map.name,r.site)}))};
}
