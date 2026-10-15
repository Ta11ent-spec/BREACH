import {useEffect,useState} from 'react';
import {fetchApi} from './realApi';
export function useAccountProfile(enabled:boolean){
 const [profile,setProfile]=useState<{displayName:string;avatar:string}|null>(null);
 useEffect(()=>{if(!enabled)return;const c=new AbortController();let generation=0;
  const load=()=>{const request=++generation;void fetchApi<{displayName:string;avatar:string}>('/account/profile',c.signal).then(p=>{if(!c.signal.aborted&&request===generation)setProfile(p);}).catch(()=>{});};load();
  window.addEventListener('breach-profile-saved',load);return()=>{c.abort();window.removeEventListener('breach-profile-saved',load);};
 },[enabled]);
 return profile;
}
