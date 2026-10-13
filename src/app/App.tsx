// @ts-nocheck — Legacy prototype state controller. Pages now live in separate files.
import React from 'react';
import { matches } from '../data/demoData';
import { csvEscape } from '../lib/format';
import { saveFile } from '../lib/download';
import { Icon } from '../components/common/Icon';
import { Sidebar } from '../components/layout/Sidebar';
import { Topbar } from '../components/layout/Topbar';
import { RouteView } from './RouteView';

export class App extends React.Component<any,any>{
  constructor(props:any){super(props);
   let entries:any[]=[],prefs:any={sound:false,compact:false,notifications:true,advanced:true};
   try {entries=JSON.parse(localStorage.getItem('breach_entries')||'[]');prefs={...prefs,...JSON.parse(localStorage.getItem('breach_settings')||'{}')}} catch(e){}
   this.state={route:window.location.hash.slice(1)||'/overview',period:'30D',query:'',showSearch:false,mobileOpen:false,toast:'',matchFilter:'ALL',matchQuery:'',matchMode:'ALL',matchTab:'scoreboard',roundTab:'events',profileTab:'overview',operatorSide:'ALL',operatorSort:'pick',selectedMap:'ALL',compareA:'vex',compareB:'ghost',entries,prefs,entryMatch:matches[0].id,entryRound:'1',entryPlayer:'vex',entryCategory:'Kill correction',entryValue:'1',entryNotes:'',entrySource:'Manual review',liveStep:3,livePaused:false};
   this.handleHash=this.handleHash.bind(this);this.handleKey=this.handleKey.bind(this);
  }
  componentDidMount(){window.addEventListener('hashchange',this.handleHash);window.addEventListener('keydown',this.handleKey);if(!window.location.hash)window.location.hash='#/overview';}
  componentWillUnmount(){window.removeEventListener('hashchange',this.handleHash);window.removeEventListener('keydown',this.handleKey);}
  handleHash(){this.setState({route:window.location.hash.slice(1)||'/overview',showSearch:false,mobileOpen:false});window.scrollTo(0,0);}
  handleKey(e:any){if((e.ctrlKey||e.metaKey)&&String(e.key).toLowerCase()==='k'){e.preventDefault();if(this.searchInput)this.searchInput.focus();this.setState({showSearch:true});}if(e.key==='Escape')this.setState({showSearch:false,mobileOpen:false});}
  go(route:string){window.location.hash='#'+route; if(window.location.hash.slice(1)===this.state.route)this.setState({mobileOpen:false,showSearch:false});}
  toast(message:string){this.setState({toast:message});setTimeout(()=>this.setState({toast:''}),3100);}
  exportCsv(){const rows=[['Match ID','Date','Map','Opponent','Mode','Result','Our rounds','Their rounds'],...matches.map(m=>[m.id,m.date,m.map,m.opponent,m.mode,m.result,m.us,m.them])];saveFile('breach-intel-demo-matches.csv',rows.map(r=>r.map(csvEscape).join(',')).join('\n'),'text/csv');this.toast('CSV report exported');}
  exportJson(){saveFile('breach-intel-manual-entries.json',JSON.stringify(this.state.entries,null,2),'application/json');this.toast('Manual entries exported');}
  addEntry(ev:any){ev.preventDefault();const entry={id:'ENTRY-'+Date.now(),match:this.state.entryMatch,round:Number(this.state.entryRound),player:this.state.entryPlayer,category:this.state.entryCategory,value:this.state.entryValue,notes:this.state.entryNotes.trim(),source:this.state.entrySource,created:new Date().toISOString()};const entries=[entry,...this.state.entries];localStorage.setItem('breach_entries',JSON.stringify(entries));this.setState({entries,entryNotes:''});this.toast('Record saved locally • demo only');}
  removeEntry(id:string){const entries=this.state.entries.filter((e:any)=>e.id!==id);localStorage.setItem('breach_entries',JSON.stringify(entries));this.setState({entries});this.toast('Manual record removed');}
  setPref(key:string,value:boolean){const prefs={...this.state.prefs,[key]:value};localStorage.setItem('breach_settings',JSON.stringify(prefs));this.setState({prefs});}
  resetDemo(){localStorage.removeItem('breach_entries');localStorage.removeItem('breach_settings');this.setState({entries:[],prefs:{sound:false,compact:false,notifications:true,advanced:true},liveStep:3});this.toast('Local demo data reset');}
  nav(route:string){const selected=this.state.route===route||this.state.route.startsWith(route+'/');return this.go.bind(this,route);}
  headline(eyebrow:string,title:string,desc:string,actions?:any){return <div className="page-head"><div><div className="eyebrow with-line">{eyebrow}</div><h1>{title}</h1><p>{desc}</p></div>{actions&&<div className="page-head-actions">{actions}</div>}</div>}
  render(){
    return (
      <div className={'app-shell '+(this.state.prefs.compact?'compact-mode':'')}>
        <Sidebar app={this}/>
        <div className="main-shell">
          <Topbar app={this}/>
          <main className="main-content">
            <RouteView app={this}/>
            <footer className="main-footer">
              <span><span className="footer-cross">+</span> BREACH / INTEL <i>·</i> INDEPENDENT CONCEPT UI</span>
              <span>FICTIONAL DATA <i>·</i> NO LIVE GAME CONNECTION <i>·</i> BUILD 01.04</span>
            </footer>
          </main>
        </div>
        {this.state.mobileOpen&&<div className="mobile-backdrop" onClick={()=>this.setState({mobileOpen:false})}/>}
        <div className="demo-label"><span className="live-bullet"/> INTERACTIVE DEMO <span>•</span> SAMPLE DATA</div>
        {this.state.toast&&<div className="toast"><Icon name="check" size={17}/>{this.state.toast}</div>}
      </div>
    );
  }
}
export default App;
