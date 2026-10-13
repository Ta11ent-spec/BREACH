/** Our future API shapes; currently populated with fictional fixtures. */
export type TeamSide = 'ATK' | 'DEF';
export type RoundOutcome = 'WIN' | 'LOSS';
export type DataOrigin = 'mock' | 'replay' | 'live' | 'manual';

export interface Player {
  id: string;
  name: string;
  tag: string;
  real: string;
  role: string;
  specialty: string;
  initials: string;
  color: string;
  mains: string[];
  number: string;
}

export interface GameEvent {
  id: string;
  type: 'kill' | 'death' | 'round' | 'objective' | 'end';
  time: number;
  actor: string;
  target: string;
  detail: string;
  team: 'us' | 'enemy' | 'neutral';
}

export interface RoundPlayerStats {
  id: string;
  operator: string;
  kills: number;
  deaths: number;
  assists: number;
  damage: number;
  headshots: number;
  entry: number;
  plants: number;
  survived: boolean;
  kost: boolean;
}

export interface MatchRound {
  number: number;
  outcome: RoundOutcome;
  side: TeamSide;
  site: string;
  duration: number;
  stats: RoundPlayerStats[];
  events: GameEvent[];
}

export interface MatchPlayerSummary {
  id: string;
  kills: number;
  deaths: number;
  assists: number;
  damage: number;
  headshots: number;
  kost: number;
  entries: number;
  plants: number;
}

export interface Match {
  id: string;
  date: string;
  map: string;
  opponent: string;
  us: number;
  them: number;
  mode: string;
  result: RoundOutcome;
  rounds: MatchRound[];
  aggregated: MatchPlayerSummary[];
  duration: string;
  ranked: boolean;
}

export interface ManualAnnotation {
  id: string;
  match: string;
  round: number;
  player: string;
  category: string;
  value: string;
  notes: string;
  source: string;
  created: string;
  origin?: DataOrigin;
}

export interface DemoPreferences {
  sound: boolean;
  compact: boolean;
  notifications: boolean;
  advanced: boolean;
}
