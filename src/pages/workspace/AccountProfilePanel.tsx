import {useEffect,useState} from 'react';
import {Btn} from '../../components';
import {fetchApi} from '../../data/realApi';
import {authHeaders} from '../../auth/apiAuth';
type Profile={revision:number;displayName:string;bio:string;avatar:string};
export function AccountProfilePanel(){
 const [saved,setSaved]=useState<Profile|null>(null),[draft,setDraft]=useState<Profile|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[reload,setReload]=useState(0);
 const dirty=Boolean(saved&&draft&&JSON.stringify(saved)!==JSON.stringify(draft));
 useEffect(()=>{const c=new AbortController();setError('');void fetchApi<Profile>('/account/profile',c.signal).then(p=>{if(!c.signal.aborted){setSaved(p);setDraft(p);}}).catch(()=>{if(!c.signal.aborted)setError('Your profile could not be loaded. Please retry.');});return()=>c.abort();},[reload]);
 useEffect(()=>{const guard=(e:BeforeUnloadEvent)=>{if(dirty){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',guard);return()=>window.removeEventListener('beforeunload',guard);},[dirty]);
 function change(patch:Partial<Profile>){setDraft(p=>p?{...p,...patch}:p);setNotice('');}
 async function picture(file?:File){
  if(!file)return;
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>5*1024*1024){setError('Choose a PNG, JPEG or WebP image smaller than 5 MB.');return;}
  setBusy(true);setError('');
  try{
   const bitmap=await createImageBitmap(file);
   try{
    // Redraw pixels locally: remove metadata and never store a remote tracking URL.
    const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
    const ctx=canvas.getContext('2d');if(!ctx)throw Error();
    const side=Math.min(bitmap.width,bitmap.height);ctx.drawImage(bitmap,(bitmap.width-side)/2,(bitmap.height-side)/2,side,side,0,0,128,128);
    change({avatar:canvas.toDataURL('image/png')});
   }finally{bitmap.close();}
  }catch{setError('This image could not be read. Choose another photo.');}finally{setBusy(false);}
 }
 async function save(){
  if(!draft||busy)return;setBusy(true);setError('');setNotice('');
  try{
   const response=await fetch('/api/account/profile',{method:'PUT',headers:{'Content-Type':'application/json','X-Breach-Request':'profile',...await authHeaders()},body:JSON.stringify(draft)});
   if(!response.ok){const e=await response.json().catch(()=>null);throw Error(e?.message??'Profile could not be saved. Please retry.');}
   const p:Profile=await response.json();setSaved(p);setDraft(p);setNotice('Profile saved to your account.');window.dispatchEvent(new Event('breach-profile-saved'));
  }catch(e){setError(e instanceof Error?e.message:'Save failed.');}finally{setBusy(false);}
 }
 return <section className="panel account-profile"><div className="panel-head"><h3>My account profile</h3><span className="eyebrow">PRIVATE / YOUR WORKSPACE</span></div><div className="workspace-body">
 {error&&<div role="alert" className="workflow-error">{error}<Btn small disabled={busy} onClick={()=>{if(!dirty||window.confirm('Discard unsaved profile edits and reload your saved profile?'))setReload(n=>n+1);}}>RELOAD PROFILE</Btn></div>}
 {!draft&&!error&&<p role="status">Loading your profile…</p>}
 {draft&&<form onSubmit={e=>{e.preventDefault();void save();}}><fieldset disabled={busy}>
 <div className="account-profile-preview">{draft.avatar?<img src={draft.avatar} alt="Your profile preview" width={96} height={96}/>:<div className="account-avatar" aria-label="Default profile picture">{(draft.displayName.trim().slice(0,2)||'BR').toUpperCase()}</div>}<div className="account-picture-details"><h3>{draft.displayName.trim()||'Make this workspace yours.'}</h3><p>Choose a BREACH display name and picture.</p><label className="account-picture">CHOOSE PICTURE<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>{void picture(e.target.files?.[0]);e.target.value='';}}/></label><div className="account-picture-actions">{draft.avatar&&<Btn small onClick={()=>change({avatar:''})}>REMOVE PICTURE</Btn>}<a className="secret-arcade-entry" href="#/arcade" aria-label="Open secret arcade"/></div></div></div>
 <label>DISPLAY NAME<input required maxLength={80} value={draft.displayName} onChange={e=>change({displayName:e.target.value})} placeholder="Your BREACH name" autoComplete="nickname"/></label>
 <label>ABOUT ME (OPTIONAL)<textarea rows={3} maxLength={500} value={draft.bio} onChange={e=>change({bio:e.target.value})} placeholder="A little about you and how you play"/></label>
 <p className="workspace-muted">This profile is private to your account for now. It does not rename recorded players or link a Ubisoft account. Your sign-in email and password remain managed by your sign-in provider.</p>
 <div className="manual-actions"><Btn variant="primary" disabled={busy||!dirty||!draft.displayName.trim()} onClick={()=>void save()}>{busy?'SAVING…':'SAVE PROFILE'}</Btn><Btn disabled={busy||!dirty} onClick={()=>{setDraft(saved);setError('');setNotice('');}}>CANCEL CHANGES</Btn></div>
 </fieldset><p role="status">{notice||(dirty?'Unsaved profile changes — save before leaving this page.':'')}</p></form>}
 </div></section>;
}
