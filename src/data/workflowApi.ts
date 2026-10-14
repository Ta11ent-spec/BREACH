import { fetchApi } from './realApi';
import {authHeaders} from '../auth/apiAuth';
export type ReviewNote = { id:string;matchId:string;roundNumber:number|null;playerId:string|null;category:string;value:string;source:string;notes:string;author:string;createdAt:string;retractedAt:string|null };
export type ReviewDraft = Omit<ReviewNote,'author'|'createdAt'|'retractedAt'>;
export type WorkflowStatus = {
  summary:{databaseName:string;matches:number;rounds:number;players:number;events:number;issues:number;lastSuccessfulImport:string|null};
  batches:{id:number;importerVersion:string;status:string;finishedAt:string|null;notes:string|null}[];
  issues:{batchId:number|null;matchId:string|null;severity:string;code:string;message:string}[];
  collector:{state:'not_connected'|'connected';lastSeen:string|null;version:string|null;ingestionAvailable:boolean;contractVersion:string};
  checkedAt:string;capabilities:{postMatchReplay:boolean;liveTelemetry:boolean;authenticatedSync:boolean;heldJobsVisible:boolean;noteStorage:string};
};
export const getWorkflowStatus = (signal?:AbortSignal) => fetchApi<WorkflowStatus>('/workflows/status',signal);
export const listReviewNotes = (signal?:AbortSignal) => fetchApi<ReviewNote[]>('/workflows/notes',signal);
async function mutate<T>(path:string,method:string,body?:unknown):Promise<T>{
  const response=await fetch('/api/workflows'+path,{method,headers:{'Content-Type':'application/json','X-Breach-Request':'workflows',...await authHeaders()},body:body==null?undefined:JSON.stringify(body)});
  if(!response.ok){const error=await response.json().catch(()=>null);throw new Error(error?.message??error?.detail??`Workflow request failed (${response.status}).`);}
  return response.status===204?undefined as T:response.json();
}
export const saveReviewNote=(draft:ReviewDraft)=>mutate<ReviewNote>('/notes','POST',draft);
export const retractReviewNote=(id:string)=>mutate<void>('/notes/'+encodeURIComponent(id),'DELETE');
