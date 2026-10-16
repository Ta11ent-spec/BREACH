import {createContext,useContext,useEffect,useState,type ReactNode} from 'react';
import {authHeaders} from '../auth/apiAuth';
async function readAccess(signal:AbortSignal):Promise<{role:string}>{
 const response=await fetch('/api/permissions',{signal,headers:await authHeaders()});
 if(!response.ok)throw new Error('Permissions unavailable');
 return response.json();
}
const Access=createContext({allowed:false,loading:true});
export function WorkspaceAccessProvider({children}:{children:ReactNode}){
 const [access,setAccess]=useState({allowed:false,loading:true});
 useEffect(()=>{const c=new AbortController();let generation=0;
  const load=()=>{const request=++generation;void readAccess(c.signal).then(p=>{if(!c.signal.aborted&&request===generation)setAccess({allowed:p.role==='Owner'||p.role==='Admin',loading:false});}).catch(()=>{if(!c.signal.aborted&&request===generation)setAccess({allowed:false,loading:false});});};
  load();const timer=setInterval(load,15000);window.addEventListener('focus',load);
  return()=>{c.abort();clearInterval(timer);window.removeEventListener('focus',load);};
 },[]);
 return <Access.Provider value={access}>{children}</Access.Provider>;
}
export const useWorkspaceAccess=()=>useContext(Access);
