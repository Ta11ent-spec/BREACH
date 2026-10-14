import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { loadPreference, markSquadsImported, pendingSquadImport, savePreference } from './localSquads';
import type { Squad } from './localSquads';
import type { V3Match, V3Player } from './overviewAnalytics';
import { deleteSquad, importSquads, listSquads, putSquad } from './squadApi';

export type ScopeMode = 'team' | 'player';

/** Shared selection and database roster actions for every recorded-data page. */
export function useTrackingScope(players: V3Player[], matches: Pick<V3Match, 'recordingProfileId'>[] = []) {
  const [mode, setMode] = useState<ScopeMode>(() => loadPreference('mode') === 'team' ? 'team' : 'player');
  const [squads, setSquads] = useState<Squad[]>([]);
  const [selectedSquad, setSelectedSquad] = useState(() => loadPreference('squad'));
  const [selectedPlayer, setSelectedPlayer] = useState(() => loadPreference('player'));
  const [squadLoading, setSquadLoading] = useState(true);
  const [squadReady, setSquadReady] = useState(false);
  const [squadBusy, setSquadBusy] = useState(false);
  const [squadError, setSquadError] = useState<string | null>(null);
  const [legacySquads, setLegacySquads] = useState(pendingSquadImport);
  const squadLock = useRef(false);
  const mounted = useRef(false);
  const loadSequence = useRef(0);
  const reloadController = useRef<AbortController | null>(null);

  const acceptSquads = useCallback((next: Squad[]) => {
    setSquads(next);
    setSelectedSquad(previous => {
      const id = next.some(s => s.id === previous) ? previous : next[0]?.id ?? '';
      savePreference('squad', id);
      return id;
    });
  }, []);

  const reloadSquads = useCallback(async () => {
    if (squadLock.current) return;
    reloadController.current?.abort();
    const controller = new AbortController();
    reloadController.current = controller;
    const sequence = ++loadSequence.current;
    setSquadLoading(true);
    setSquadError(null);
    setSquadReady(false);
    const current = () => mounted.current && !controller.signal.aborted && sequence === loadSequence.current;
    try {
      const next = await listSquads(controller.signal);
      if (current()) { acceptSquads(next); setSquadReady(true); }
    } catch (e) {
      if (current()) setSquadError(e instanceof Error ? e.message : 'Unable to load squads.');
    } finally {
      if (current()) setSquadLoading(false);
    }
  }, [acceptSquads]);

  useEffect(() => {
    mounted.current = true;
    void reloadSquads();
    return () => { mounted.current = false; reloadController.current?.abort(); };
  }, [reloadSquads]);

  useEffect(() => {
    if (!players.length || players.some(p => p.playerId === selectedPlayer)) return;
    const recordingIds = new Set(matches.map(m => m.recordingProfileId).filter(Boolean));
    const recorder = players.find(p => p.profileId && recordingIds.has(p.profileId));
    const id = (recorder ?? players[0]).playerId;
    setSelectedPlayer(id);
    savePreference('player', id);
  }, [players, matches, selectedPlayer]);

  const onMode = useCallback((next: ScopeMode) => { setMode(next); savePreference('mode', next); }, []);
  const onSelectedSquad = useCallback((id: string) => { setSelectedSquad(id); savePreference('squad', id); }, []);
  const onSelectedPlayer = useCallback((id: string) => { setSelectedPlayer(id); savePreference('player', id); }, []);

  const changeSquad = useCallback(async (action: () => Promise<void>): Promise<boolean> => {
    if (squadLock.current || !squadReady) return false;
    squadLock.current = true;
    setSquadBusy(true);
    setSquadError(null);
    try { await action(); return true; }
    catch (e) {
      if (mounted.current) setSquadError(e instanceof Error ? e.message : 'Unable to save squad.');
      return false;
    } finally {
      squadLock.current = false;
      if (mounted.current) setSquadBusy(false);
    }
  }, [squadReady]);

  const onSaveSquad = useCallback((squad: Squad) => changeSquad(async () => {
    const saved = await putSquad(squad);
    if (mounted.current) setSquads(previous => previous.some(s => s.id === saved.id)
      ? previous.map(s => s.id === saved.id ? saved : s) : [...previous, saved]);
  }), [changeSquad]);
  const onDeleteSquad = useCallback((squad: Squad) => changeSquad(async () => {
    await deleteSquad(squad);
    if (mounted.current) acceptSquads(squads.filter(s => s.id !== squad.id));
  }), [acceptSquads, changeSquad, squads]);
  const onImportSquads = useCallback(() => changeSquad(async () => {
    const next = await importSquads(legacySquads);
    markSquadsImported();
    if (mounted.current) { acceptSquads(next); setLegacySquads([]); }
  }), [acceptSquads, changeSquad, legacySquads]);

  const activeSquad = squads.find(s => s.id === selectedSquad) ?? null;
  const player = players.find(p => p.playerId === selectedPlayer) ?? null;
  const chosen = useMemo(() => mode === 'team' ? activeSquad?.members ?? [] : player ? [player.playerId] : [], [mode, activeSquad, player]);
  const identity = mode === 'team' ? activeSquad?.name ?? 'No squad selected' : player?.username ?? 'No player selected';

  return { mode, onMode, squads, selectedSquad, onSelectedSquad, selectedPlayer, onSelectedPlayer,
    activeSquad, player, chosen, identity, onSaveSquad, onDeleteSquad, reloadSquads, onImportSquads,
    squadLoading, squadBusy, squadReady, squadError, legacySquads };
}

export type TrackingScopeState = ReturnType<typeof useTrackingScope>;
