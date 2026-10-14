
/** Browser preferences and legacy roster import. SQL Server stores active squads. */

export type Squad = {
  id: string;
  name: string;
  members: string[];
  version?: number;
};

const account = () => {try{return sessionStorage.getItem('breach_workspace') || 'local';}catch{return 'local';}};
const KEY = 'breach_squads_v1';
const SELECTED = 'breach_selected_squad_v1';
const MODE = 'breach_overview_mode_v1';
const PLAYER = 'breach_overview_player_v1';

const validId = (id: unknown): id is string =>
  typeof id === 'string' &&
  id.trim().length > 0 &&
  id.trim().length <= 100;

export function cleanSquads(input: unknown): Squad[] {
  if (!Array.isArray(input)) return [];

  const seen = new Set<string>();

  return input.flatMap((s): Squad[] => {
    if (
      !s ||
      typeof s !== 'object' ||
      !validId(s.id) ||
      seen.has(s.id)
    ) {
      return [];
    }

    seen.add(s.id);

    const memberIds: string[] = Array.isArray(s.members)
      ? (s.members as unknown[])
          .filter(validId)
          .map((id) => id.trim())
      : [];

    const members: string[] = [
      ...new Set<string>(memberIds),
    ].slice(0, 5);

    return [
      {
        id: s.id,
        name:
          typeof s.name === 'string' && s.name.trim()
            ? s.name.trim().slice(0, 50)
            : 'Unnamed Squad',
        members,
      },
    ];
  });
}

export function loadSquads():Squad[]{
  try{return cleanSquads(JSON.parse(localStorage.getItem(account()+':'+KEY)??'[]'));}catch{return [];}
}
export function saveSquads(squads:Squad[]):void{
  try{localStorage.setItem(account()+':'+KEY,JSON.stringify(cleanSquads(squads)));}catch{/* browser storage unavailable */}
}
export function pendingSquadImport():Squad[]{
  try{return localStorage.getItem(account()+':'+'breach_squads_imported_v1')==='true'?[]:loadSquads();}catch{return [];}
}
export function markSquadsImported():void{
  // Keep the original browser roster as a recovery copy.
  try{localStorage.setItem(account()+':'+'breach_squads_imported_v1','true');}catch{/* Import is idempotent if retried. */}
}
export function loadPreference(key:'squad'|'mode'|'player'):string{
  const storageKey=key==='squad'?SELECTED:key==='mode'?MODE:PLAYER;
  try{return localStorage.getItem(account()+':'+storageKey)??'';}catch{return '';}
}
export function savePreference(key:'squad'|'mode'|'player',value:string):void{
  const storageKey=key==='squad'?SELECTED:key==='mode'?MODE:PLAYER;
  try{localStorage.setItem(account()+':'+storageKey,value);}catch{/* browser storage unavailable */}
}
export function newSquad(name:string):Squad{
  return {id:typeof crypto!=='undefined'&&typeof crypto.randomUUID==='function'?crypto.randomUUID():`local-${Date.now()}`,
    name:name.trim().slice(0,50)||'New Squad',members:[]};
}
