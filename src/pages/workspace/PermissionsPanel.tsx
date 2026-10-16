import {useEffect,useState} from 'react';
import {fetchApi} from '../../data/realApi';
import {authHeaders} from '../../auth/apiAuth';
type Access={accountId:string;role:string;canManagePermissions:boolean};
type Account={accountId:string;role:string;revision:number;createdAt:string};
type Audit={id:number;actor:string;target:string;previousRole:string;newRole:string;changedAt:string};
export function PermissionsPanel(){
 const [access,setAccess]=useState<Access|null>(null),[accounts,setAccounts]=useState<Account[]>([]),[history,setHistory]=useState<Audit[]>([]),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[selected,setSelected]=useState(''),[role,setRole]=useState('Player'),[reload,setReload]=useState(0);
 useEffect(()=>{const c=new AbortController();setError('');void (async()=>{
  const a=await fetchApi<Access>('/permissions',c.signal);if(c.signal.aborted)return;setAccess(a);
  if(a.canManagePermissions){const [users,events]=await Promise.all([fetchApi<Account[]>('/permissions/accounts',c.signal),fetchApi<Audit[]>('/permissions/history',c.signal)]);if(!c.signal.aborted){setAccounts(users);setHistory(events);setSelected('');}}
 })().catch(()=>{if(!c.signal.aborted)setError('Could not load permissions. Please reload.');});return()=>c.abort();},[reload]);
 const target=accounts.find(a=>a.accountId===selected);
 async function save(){if(!target||busy)return;setBusy(true);setError('');setNotice('');try{
  const r=await fetch('/api/permissions/accounts/'+target.accountId,{method:'PUT',headers:{'Content-Type':'application/json','X-Breach-Request':'permissions',...await authHeaders()},body:JSON.stringify({role,revision:target.revision})});
  if(!r.ok)throw Error((await r.json().catch(()=>null))?.message??'Could not save permissions.');
  setNotice('Permissions saved. They apply on the account’s next request.');setReload(n=>n+1);
 }catch(e){setError(e instanceof Error?e.message:'Save failed.');}finally{setBusy(false);}}
 return <section className="panel account-profile"><div className="panel-head"><h3>Account permissions</h3><span className="eyebrow">{access?.role??'LOADING'}</span></div><div className="workspace-body">
 {error&&<p role="alert">{error} <button onClick={()=>setReload(n=>n+1)}>Reload permissions</button></p>}
 {access&&<><p>Your role: <strong>{access.role}</strong>. Only the Owner can grant or revoke Admin access.</p><label>Your account ID<input readOnly value={access.accountId} onFocus={e=>e.target.select()}/></label><p className="workspace-muted">Share this ID with the Owner when requesting access. It is an account identifier, not a password.</p>
 <p>Players upload matches and manage their own entries. Admins can also correct shared map and bombsite links. Admin access does not grant access to another player’s private workspace.</p>
 {access.canManagePermissions&&<><h3>Manage access</h3><p>Ask the player for the account ID shown on their My account page, then select that exact ID below. The sole Owner account cannot be reassigned here.</p><fieldset disabled={busy}>
 <label>Account<select value={selected} onChange={e=>{setSelected(e.target.value);setRole(accounts.find(a=>a.accountId===e.target.value)?.role??'Player');setNotice('');}}><option value="">Select an account</option>{accounts.filter(a=>a.role!=='Owner').map(a=><option key={a.accountId} value={a.accountId}>{a.accountId} · {a.role}</option>)}</select></label>
 {target&&<p>Selected account: <code style={{overflowWrap:'anywhere'}}>{target.accountId}</code><br/>Joined {new Date(target.createdAt+'Z').toLocaleDateString()}</p>}
 <label>Role<select value={role} onChange={e=>setRole(e.target.value)}><option>Player</option><option>Admin</option></select></label>
 <button className="btn primary" disabled={!target||target.role===role} onClick={()=>void save()}>{busy?'SAVING…':'SAVE PERMISSIONS'}</button></fieldset>
 <details><summary>Permission change history</summary>{history.length?history.map(h=><p key={h.id}><time>{new Date(h.changedAt+'Z').toLocaleString()}</time> · <code>{h.target.slice(0,12)}</code> · {h.previousRole} → {h.newRole}</p>):<p>No permission changes yet.</p>}</details></>}
 </>}
 <p role="status">{notice}</p></div></section>;
}
