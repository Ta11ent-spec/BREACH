import {useWorkspaceAccess} from '../../data/WorkspaceAccess';
import {ReleaseControls} from './ReleaseControls';
import {useAccountProfile} from '../../data/useAccountProfile';
import { navPrimary, navSecondary } from '../../app/navigation';
import { Icon } from '../common/Icon';

export function Sidebar({app}: any){
 const {allowed}=useWorkspaceAccess();
 const profile=useAccountProfile(app.state.dataMode==='real');
 const link=(n:any)=><a key={n.route} href={'#'+n.route} onClick={()=>app.setState({mobileOpen:false})} className={'nav-link '+((app.state.route===n.route||app.state.route.startsWith(n.route+'/'))?'active':'')}><Icon name={n.icon} size={18}/><span>{n.title}</span>{n.route==='/live'&&app.state.dataMode==='demo'&&<i className="nav-live-dot"/>}</a>;
   return <aside className={'sidebar '+(app.state.mobileOpen?'open':'')}><div className="sidebar-head"><a className="brand" href="#/overview"><span className="brand-logo"><span>+</span></span><span className="brand-label"><strong>BREACH<span>/</span>INTEL</strong><small>TACTICAL DATA SYSTEM</small></span></a><button className="mobile-close" onClick={()=>app.setState({mobileOpen:false})}><Icon name="close"/></button></div>
    <div className="side-scroller"><div className="workspace-chip"><div className="workspace-icon"><Icon name="shield" size={19}/></div><span><strong>{app.state.dataMode==='real'?(allowed?'MY WORKSPACE':'BREACH INTEL'):'NOVA UNIT'}</strong><small>{app.state.dataMode==='real'?(allowed?'PRIVATE ACCOUNT CONTROLS':'SHARED MATCH INTELLIGENCE'):'TEAM WORKSPACE · 05 ONLINE'}</small></span><Icon name="chevrondown" size={15}/></div>
    <div className="nav-group"><div className="nav-caption">WORKSPACE <span>01</span></div>{navPrimary.filter(n=>n.route!=='/workspace'||allowed).map(link)}</div><div className="nav-group"><div className="nav-caption">ANALYTICS & TOOLS <span>02</span></div>{navSecondary.map(link)}</div>
    <div className="sidebar-mini"><div className="mini-heading">{app.state.dataMode==='demo'&&<span className="live-bullet"/>} SYSTEM STATUS</div><strong>{app.state.dataMode==='real'?'Replay intelligence':'Demo mode'}</strong><p>{app.state.dataMode==='real'?'Shared player stats · private workspace':'Data collectors are simulated in this demo.'}</p><div className="mini-mini"><span>{app.state.dataMode==='real'?'DATABASE':'MOCK DATASET'}</span><span>{app.state.dataMode==='real'?'CONNECTED':'16 MATCHES'}</span></div></div></div>
    <ReleaseControls/><a className="side-footer" href="#/account" aria-label="Open my account profile"><div className="avatar foot-avatar">{app.state.dataMode==='real'&&profile?.avatar?<img src={profile.avatar} alt="" style={{width:'100%',height:'100%',objectFit:'cover',borderRadius:'inherit'}}/>:<span>{app.state.dataMode==='real'?(profile?.displayName.trim().slice(0,2).toUpperCase()||'BR'):'AD'}</span>}</div><div><strong>{app.state.dataMode==='real'?(profile?.displayName||'BREACH Member'):'Demo Administrator'}</strong><small>{app.state.dataMode==='real'?'ACCOUNT WORKSPACE':'INVESTOR PREVIEW'}</small></div><Icon name="chevrondown" size={14}/></a>
   </aside>;
  }
