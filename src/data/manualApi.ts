import {fetchApi} from './realApi';
import {authHeaders} from '../auth/apiAuth';
import type {ManualRecord} from './manualMatches';
type Wire=Omit<ManualRecord,'payload'>&{payload:string};
const decode=(r:Wire):ManualRecord=>({...r,payload:JSON.parse(r.payload)});
export async function listManualMatches(signal?:AbortSignal){return (await fetchApi<Wire[]>('/manual-matches',signal)).map(decode);}
export async function deleteManualDraft(record:ManualRecord){
 const response=await fetch('/api/manual-matches/'+encodeURIComponent(record.id)+'?revision='+record.revision,{method:'DELETE',headers:{'X-Breach-Request':'manual',...await authHeaders()}});
 if(!response.ok&&response.status!==404){const e=await response.json().catch(()=>null);throw new Error(e?.message??'Draft could not be deleted. Please reload and try again.');}
}
export async function saveManualMatch(record:ManualRecord){
 const response=await fetch('/api/manual-matches/'+encodeURIComponent(record.id),{method:'PUT',headers:{'Content-Type':'application/json','X-Breach-Request':'manual',...await authHeaders()},body:JSON.stringify({revision:record.revision,status:record.status,payload:record.payload})});
 if(!response.ok){const e=await response.json().catch(()=>null);throw new Error(e?.message??e?.detail??`Save failed (${response.status}). Your draft is retained.`);}
 return decode(await response.json());
}
