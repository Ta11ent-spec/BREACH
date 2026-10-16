import type { V3Player } from '../data/overviewAnalytics';
import type { TrackingScopeState } from '../data/useTrackingScope';
import { OverviewScopeBar } from '../pages/overview/OverviewScopeBar';

/** Database status and the same perspective picker across real-data pages. */
export function TrackingScope({ scope, players }: { scope: TrackingScopeState; players: V3Player[] }) {
  return <>
    {scope.mode==='team'&&<p className="workspace-muted">Team view includes only matches where every selected teammate played on the same side.</p>}
    <div className="squad-storage-status" aria-live="polite">
      <span>{scope.squadLoading ? 'Loading saved squads…' : scope.squadBusy ? 'Saving squad…' : scope.squadReady ? 'Squads saved in your database' : 'Squad storage unavailable'}</span>
      <button className="scope-edit" disabled={scope.squadBusy || scope.squadLoading} onClick={() => void scope.reloadSquads()}>Reload squads</button>
      {scope.squadError && <p role="alert">{scope.squadError} Your last loaded roster is still shown.</p>}
      {scope.legacySquads.length > 0 && <div><span>{scope.legacySquads.length} browser-saved squad{scope.legacySquads.length === 1 ? '' : 's'} available to import. Existing database squads will be kept.</span><button className="scope-edit" disabled={!scope.squadReady || scope.squadBusy || scope.squadLoading} onClick={() => void scope.onImportSquads()}>Import browser squads</button></div>}
    </div>
    <OverviewScopeBar mode={scope.mode} onMode={scope.onMode} squads={scope.squads}
      onSaveSquad={scope.onSaveSquad} onDeleteSquad={scope.onDeleteSquad}
      busy={scope.squadBusy || scope.squadLoading || !scope.squadReady}
      selectedSquad={scope.selectedSquad} onSelectedSquad={scope.onSelectedSquad}
      selectedPlayer={scope.selectedPlayer} onSelectedPlayer={scope.onSelectedPlayer} players={players} />
  </>;
}
