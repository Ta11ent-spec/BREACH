import {RealPlayersPage,RealPlayerPage,RealUnavailablePage} from '../pages/real/RealPages';
import { RealMatchCenter } from '../pages/matches/RealMatchCenter';
import { OverviewPage } from '../pages/overview/OverviewPage';
import { RealDashboardPage } from '../pages/overview/RealDashboardPage';
import { LivePage } from '../pages/live/LivePage';
import { MatchCenterPage, MatchDetailPage, RoundDetailPage } from '../pages/matches/MatchesPage';
import { PlayerDirectoryPage, PlayerDetailPage } from '../pages/players/PlayersPage';
import { OperatorsPage } from '../pages/operators/OperatorsPage';
import { MapIntelPage, MapDetailPage } from '../pages/maps/MapsPage';
import { InsightsPage } from '../pages/insights/InsightsPage';
import { ComparePage } from '../pages/compare/ComparePage';
import { ManualEntryPage } from '../pages/manual/ManualEntryPage';
import { SettingsPage } from '../pages/settings/SettingsPage';

const navTitle=(base:string)=>({'live':'Live operations','operators':'Operator intel','maps':'Map intelligence','insights':'Insights & reports','compare':'Compare players','entry':'Manual entry'} as Record<string,string>)[base]??'Feature';

/** Keep the existing hash URLs working; no new routing dependency required. */
export function RouteView({app}: any){
  const parts = app.state.route.split('/').filter(Boolean);
  const base = parts[0] || 'overview';
  if(app.state.dataMode==='real') {
    switch(base) {
      case 'overview': return <RealDashboardPage app={app}/>;
      case 'matches': return <RealMatchCenter app={app} id={parts[1]} number={parts[2]==='round'?Number(parts[3]):undefined}/>;
      case 'players': return parts[1] ? <RealPlayerPage id={parts[1]}/> : <RealPlayersPage/>;
      case 'settings': return <SettingsPage app={app}/>;
      default: return <RealUnavailablePage feature={navTitle(base)}/>;
    }
  }
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
