import {fetchApi} from './realApi';
import type {OverviewV3} from './overviewAnalytics';
import {listManualMatches} from './manualApi';
import {withManualMatches} from './manualMatches';
export async function loadOverview(includeManual:boolean,signal?:AbortSignal){
 const [base,manual]=await Promise.all([fetchApi<OverviewV3>('/overview/v3',signal),includeManual?listManualMatches(signal):Promise.resolve([])]);
 return includeManual?withManualMatches(base,manual):base;
}
