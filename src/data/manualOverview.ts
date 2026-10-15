import {fetchApi} from './realApi';
import type {OverviewV3} from './overviewAnalytics';
import {listManualMatches} from './manualApi';
import {selectSources} from './analyticsSources';
import type {AnalyticsSource} from './analyticsSources';
export async function loadOverview(source:AnalyticsSource|boolean='replay',signal?:AbortSignal){
 const mode=typeof source==='boolean'?(source?'combined':'replay'):source;
 const [base,manual]=await Promise.all([mode==='manual'?Promise.resolve<OverviewV3>({matches:[],players:[],rounds:[],appearances:[],perspective:'selected player',rosterStorage:'workspace'}):fetchApi<OverviewV3>('/overview/v3',signal),mode!=='replay'?listManualMatches(signal):Promise.resolve([])]);
 return selectSources(base,manual,mode);
}
