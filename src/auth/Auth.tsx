import {Auth0Provider,useAuth0} from '@auth0/auth0-react';
import {useEffect,useState,type ReactNode} from 'react';
import {setAccessTokenProvider} from './apiAuth';

const env=import.meta.env;
export const authConfigured=Boolean(env.VITE_AUTH0_DOMAIN&&env.VITE_AUTH0_CLIENT_ID&&env.VITE_AUTH0_AUDIENCE);
function SignedInIdentity(){const {user}=useAuth0();return <p>Signed in as <strong>{user?.email??user?.name??'BREACH member'}</strong></p>;}
export function AccountIdentity(){return authConfigured?<SignedInIdentity/>:null;}

function Session({children}:{children:ReactNode}){
  const {isLoading,isAuthenticated,error,loginWithRedirect,logout,getAccessTokenSilently}=useAuth0();
  const [ready,setReady]=useState(false);
  const [access,setAccess]=useState<'checking'|'approved'|'pending'|'error'>('checking');
  const [retry,setRetry]=useState(0);
  const [workspaceId,setWorkspaceId]=useState('');
  useEffect(()=>{
    if(!isAuthenticated)return;
    const abort=new AbortController();setAccess('checking');
    void (async()=>{
      try{
        const token=await getAccessTokenSilently();
        if(!token)throw new Error('Sign-in required');
        const response=await fetch('/api/account',{signal:abort.signal,headers:{Authorization:`Bearer ${token}`}});
        if(!response.ok)throw new Error('Account verification failed');
        const account=await response.json();
        if(!abort.signal.aborted){setWorkspaceId(account.workspaceId);window.sessionStorage.setItem('breach_workspace',account.workspaceId);setAccess(account.workspaceAccess===true?'approved':'pending');}
      }catch{if(!abort.signal.aborted)setAccess('error');}
    })();
    return ()=>abort.abort();
  },[isAuthenticated,getAccessTokenSilently,retry]);
  useEffect(()=>{
    if(!isAuthenticated){setReady(false);return;}
    setAccessTokenProvider(async()=>{const token=await getAccessTokenSilently();if(!token)throw new Error('Sign-in required');return token;});setReady(true);
    return ()=>setAccessTokenProvider(null);
  },[isAuthenticated,getAccessTokenSilently]);
  if(isLoading)return <div className="auth-screen"><p>Checking your session…</p></div>;
  if(!isAuthenticated||!ready)return <div className="auth-screen"><div className="panel auth-card"><div className="eyebrow">BREACH / INTEL</div><h1>Your matches.<br/>Your workspace.</h1><p>Sign in securely to access BREACH. Passwords are managed by Auth0.</p>{error&&<p role="alert">Sign-in could not be completed. Try again.</p>}<button className="btn primary" onClick={()=>void loginWithRedirect()}>SIGN IN</button><button className="btn" onClick={()=>void loginWithRedirect({authorizationParams:{screen_hint:'signup',prompt:'login'}})}>CREATE ACCOUNT</button></div></div>;
  if(access!=='approved')return <div className="auth-screen"><div className="panel auth-card"><div className="eyebrow">BREACH / INTEL</div><h1>{access==='pending'?'Account verified.':'Checking access.'}</h1><p>{access==='pending'?'Access to this private replay workspace is awaiting approval.':access==='error'?'The API could not verify workspace access. Check that the backend is running, then try again.':'Verifying your workspace access…'}</p>{access!=='checking'&&<button className="btn primary" onClick={()=>setRetry(value=>value+1)}>CHECK ACCESS</button>}<button className="btn" onClick={()=>void logout({logoutParams:{returnTo:window.location.origin}})}>SIGN OUT</button></div></div>;
  return <><div key={workspaceId}>{children}</div><button className="auth-signout" onClick={()=>void logout({logoutParams:{returnTo:window.location.origin}})}>SIGN OUT</button></>;
}
export function Authentication({children}:{children:ReactNode}){
  if(!authConfigured)return import.meta.env.DEV?<>{children}</>:<div className="auth-screen"><p>BREACH sign-in needs to be configured before this build can be used.</p></div>;
  return <Auth0Provider domain={env.VITE_AUTH0_DOMAIN} clientId={env.VITE_AUTH0_CLIENT_ID} cacheLocation="memory" authorizationParams={{redirect_uri:window.location.origin,audience:env.VITE_AUTH0_AUDIENCE,scope:'openid profile email'}} onRedirectCallback={()=>{window.history.replaceState({},document.title,window.location.pathname+'#/workspace');}}><Session>{children}</Session></Auth0Provider>;
}
