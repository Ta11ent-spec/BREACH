import { navHeaders } from '../../app/navigation';
import { matches, players } from '../../data/demoData';
import { Icon } from '../common/Icon';

export function Topbar({app}:any){
  const path=app.state.route;
  const base='/'+path.split('/')[1];
  const labels=navHeaders[base]||['OPERATIONS',''];
  const results=app.state.query.trim()?[
    ...players.filter(p=>(p.name+' '+p.tag).toLowerCase().includes(app.state.query.toLowerCase())).map(p=>({name:p.name,meta:'PLAYER · '+p.role,route:'/players/'+p.id})),
    ...matches.filter(m=>(m.map+' '+m.opponent+' '+m.id).toLowerCase().includes(app.state.query.toLowerCase())).slice(0,5).map(m=>({name:m.map+' vs '+m.opponent,meta:'MATCH · '+m.id,route:'/matches/'+m.id}))
  ].slice(0,8):[];
  return <header className="topbar">
    <div className="top-left"><button className="mobile-menu" onClick={()=>app.setState({mobileOpen:true})}><Icon name="menu"/></button><span className="top-breadcrumb">WORKSPACE</span><Icon name="chevron" size={14}/><strong>{labels[0]}</strong></div>
    <div className="top-actions">
      <div className="real-mode-switch" role="group" aria-label="Data source">
        <button className={app.state.dataMode==='real'?'active':''} onClick={()=>app.setDataMode('real')}>REAL DATA</button>
        <button className={app.state.dataMode==='demo'?'active':''} onClick={()=>app.setDataMode('demo')}>DEMO</button>
      </div>
      {app.state.dataMode==='demo' && <div className="global-search">
        <Icon name="search" size={16}/><input ref={(el:any)=>app.searchInput=el} aria-label="Search players and matches" placeholder="Search players, matches..." value={app.state.query} onChange={(e:any)=>app.setState({query:e.target.value,showSearch:true})} onFocus={()=>app.setState({showSearch:true})}/><kbd>⌘ K</kbd>
        {app.state.showSearch&&app.state.query&&<div className="search-results">{results.length?results.map((r:any,i:number)=><button key={i} onClick={()=>{app.go(r.route);app.setState({query:'',showSearch:false})}}><Icon name="search" size={14}/><span><strong>{r.name}</strong><small>{r.meta}</small></span><Icon name="chevron" size={14}/></button>):<div className="search-empty">No matching records</div>}</div>}
      </div>}
      <div className="top-sep"/>
      <div className="season-chip"><Icon name="calendar" size={16}/><span>{app.state.dataMode==='real'?'LOCAL DB':'Y10S4'}</span></div>
      <button className="top-alert" title="View system status" onClick={()=>app.toast(app.state.dataMode==='real'?'Local API status: check /api/health':'Demo systems are simulated')}><Icon name="activity" size={18}/><i/></button>
      <div className="top-avatar">AD</div>
    </div>
  </header>;
}
