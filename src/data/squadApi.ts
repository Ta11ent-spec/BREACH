import { ApiError } from './realApi';
import type { Squad } from './localSquads';

async function request<T>(path:string, method='GET', body?:unknown, signal?:AbortSignal):Promise<T>{
  const response=await fetch(`/api/squads${path}`,{
    method,signal,headers:{Accept:'application/json','Content-Type':'application/json','X-Breach-Request':'squads'},
    ...(body===undefined?{}:{body:JSON.stringify(body)}),
  });
  if(!response.ok){
    const error=await response.json().catch(()=>null);
    throw new ApiError(response.status,error?.message??`Squad request failed (${response.status}). Check the local API.`);
  }
  return response.status===204?undefined as T:response.json() as Promise<T>;
}
export const listSquads=(signal?:AbortSignal)=>request<Squad[]>('','GET',undefined,signal);
export const putSquad=(squad:Squad)=>request<Squad>(`/${encodeURIComponent(squad.id)}`,'PUT',squad);
export const deleteSquad=(squad:Squad)=>request<void>(`/${encodeURIComponent(squad.id)}?version=${squad.version}`,'DELETE');
export const importSquads=(squads:Squad[])=>request<Squad[]>('/import','POST',squads);
