import {filterPlaylist} from './playlists';
import type {Playlist} from './playlists';
import {setMapLinks} from './mapCatalog';
import {fetchApi} from './realApi';
import type {OverviewV3} from './overviewAnalytics';
import {listSharedManualMatches} from './manualApi';
import {selectSources} from './analyticsSources';
import type {AnalyticsSource} from './analyticsSources';
export async function loadOverview(source:AnalyticsSource|boolean='replay',signal?:AbortSignal,playlist:Playlist='ranked'){
 const mode=typeof source==='boolean'?(source?'combined':'replay'):source;
 const [base,manual]=await Promise.all([mode==='manual'?Promise.resolve<OverviewV3>({matches:[],players:[],rounds:[],appearances:[],perspective:'selected player',rosterStorage:'workspace'}):fetchApi<OverviewV3>('/overview/v3',signal),mode!=='replay'?listSharedManualMatches(signal):Promise.resolve([])]);
 // Load links even for manual-only views before resolving shared identities.
 await fetchApi('/catalog-links',signal).then((links:any)=>setMapLinks(links));
 return filterPlaylist(selectSources(base,manual,mode),playlist);
}
