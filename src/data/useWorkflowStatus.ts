import { useEffect,useState } from 'react';
import { getWorkflowStatus } from './workflowApi';
import type {WorkflowStatus} from './workflowApi';
export function useWorkflowStatus(){
  const [data,setData]=useState<WorkflowStatus|null>(null),[error,setError]=useState<string|null>(null),[revision,setRevision]=useState(0),[loading,setLoading]=useState(true);
  useEffect(()=>{const controller=new AbortController();setLoading(true);setError(null);getWorkflowStatus(controller.signal).then(next=>{if(!controller.signal.aborted){setData(next);setLoading(false);}}).catch(e=>{if(!controller.signal.aborted){setError(e instanceof Error?e.message:'Status unavailable');setLoading(false);}});return()=>controller.abort();},[revision]);
  return {data,error,loading,reload:()=>setRevision(v=>v+1)};
}
