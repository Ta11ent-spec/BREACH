import { OverviewPage } from '../pages/overview/OverviewPage';
import { LivePage } from '../pages/live/LivePage';
import { MatchCenterPage, MatchDetailPage, RoundDetailPage } from '../pages/matches/MatchesPage';
import { PlayerDirectoryPage, PlayerDetailPage } from '../pages/players/PlayersPage';
import { OperatorsPage } from '../pages/operators/OperatorsPage';
import { MapIntelPage, MapDetailPage } from '../pages/maps/MapsPage';
import { InsightsPage } from '../pages/insights/InsightsPage';
import { ComparePage } from '../pages/compare/ComparePage';
import { ManualEntryPage } from '../pages/manual/ManualEntryPage';
import { SettingsPage } from '../pages/settings/SettingsPage';

/** Keep the existing hash URLs working; no new routing dependency required. */
export function RouteView({app}: any){
  const parts = app.state.route.split('/').filter(Boolean);
  const base = parts[0] || 'overview';
  switch (base) {
    case 'overview': return <OverviewPage app={app}/>;
    case 'live': return <LivePage app={app}/>;
    case 'matches':
      return parts[1]
        ? parts[2] === 'round'
          ? <RoundPageById app={app} id={parts[1]} number={Number(parts[3])}/>
          : <MatchDetailPage app={app} id={parts[1]}/>
        : <MatchCenterPage app={app}/>;
    case 'players': return parts[1] ? <PlayerDetailPage app={app} id={parts[1]}/> : <PlayerDirectoryPage app={app}/>;
    case 'operators': return <OperatorsPage app={app}/>;
    case 'maps': return parts[1] ? <MapDetailPage app={app} id={parts[1]}/> : <MapIntelPage app={app}/>;
    case 'insights': return <InsightsPage app={app}/>;
    case 'compare': return <ComparePage app={app}/>;
    case 'entry': return <ManualEntryPage app={app}/>;
    case 'settings': return <SettingsPage app={app}/>;
    default: return <OverviewPage app={app}/>;
  }
}

function RoundPageById({app,id,number}: any){
  // Delegate lookup to the existing match-detail screen to preserve its 404 handling.
  return <MatchDetailPage app={app} id={id} roundNumber={number}/>;
}
