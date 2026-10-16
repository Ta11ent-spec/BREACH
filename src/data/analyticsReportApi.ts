import {listSharedManualMatches} from './manualApi';
import {manualMatchReport} from './manualMatchReport';
import {fetchApi} from './realApi';
export async function loadReportResource<T>(path:string,signal?:AbortSignal):Promise<T>{
 const part=path.match(/^\/matches\/([^/]+)\/report$/)?.[1];
 const id=part?decodeURIComponent(part):'';
 if(id.startsWith('manual:')){
  const row=(await listSharedManualMatches(signal)).find(r=>'manual:'+r.id===id&&r.status==='submitted');
  if(!row)throw Error('This submitted manual match is not available.');
  return manualMatchReport(row) as T;
 }
 return fetchApi<T>(path,signal);
}
