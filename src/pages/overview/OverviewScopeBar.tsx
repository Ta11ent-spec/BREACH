import { useState } from 'react';
import { Icon } from '../../components/common/Icon';
import { newSquad } from '../../data/localSquads';
import type { Squad } from '../../data/localSquads';
import type { V3Player } from '../../data/overviewAnalytics';
export type ScopeMode = 'team'|'player';

type Props = {
  mode:ScopeMode; onMode:(mode:ScopeMode)=>void;
  squads:Squad[]; onSquads:(squads:Squad[])=>void;
  selectedSquad:string; onSelectedSquad:(id:string)=>void;
  selectedPlayer:string; onSelectedPlayer:(id:string)=>void;
  players:V3Player[];
};
export function OverviewScopeBar({mode,onMode,squads,onSquads,selectedSquad,onSelectedSquad,selectedPlayer,onSelectedPlayer,players}:Props){
  const [editing,setEditing]=useState(false);
  const [newName,setNewName]=useState('');
  const [renameName,setRenameName]=useState('');
  const [search,setSearch]=useState('');
  const [manualId,setManualId]=useState('');
  const active=squads.find(s=>s.id===selectedSquad)??null;
  const names=new Map(players.map(p=>[p.playerId,p.username]));
  const update=(next:Squad)=>onSquads(squads.map(s=>s.id===next.id?next:s));
  const addMember=(id:string)=>{
    if(!active||!id||active.members.includes(id)||active.members.length>=5)return;
    update({...active,members:[...active.members,id]});
    setManualId('');setSearch('');
  };
  const createSquad=()=>{
    const squad=newSquad(newName);
    onSquads([...squads,squad]);onSelectedSquad(squad.id);onMode('team');setEditing(true);setNewName('');
  };
  const filtered=players.filter(p=>!active?.members.includes(p.playerId) &&
    (p.username.toLowerCase().includes(search.trim().toLowerCase()) || p.playerId.toLowerCase().includes(search.trim().toLowerCase()))).slice(0,7);
  return <section className="panel squad-scope">
    <div className="squad-scope-main">
      <div className="scope-heading"><span className="eyebrow">TRACKING PERSPECTIVE</span><strong>Who are we analyzing?</strong></div>
      <div className="scope-toggle" role="group" aria-label="Dashboard scope">
        <button type="button" className={mode==='team'?'active':''} aria-pressed={mode==='team'} onClick={()=>onMode('team')}><Icon name="shield" size={15}/> TEAM</button>
        <button type="button" className={mode==='player'?'active':''} aria-pressed={mode==='player'} onClick={()=>onMode('player')}><Icon name="users" size={15}/> PLAYER</button>
      </div>
      {mode==='team'? <div className="scope-selection"><label htmlFor="squad-select">Selected squad</label><select id="squad-select" value={active?.id??''} onChange={e=>onSelectedSquad(e.target.value)}><option value="">Choose a squad...</option>{squads.map(s=><option key={s.id} value={s.id}>{s.name} ({s.members.length}/5)</option>)}</select><button className="scope-edit" onClick={()=>setEditing(!editing)} aria-expanded={editing}><Icon name="settings" size={14}/>{editing?'Close editor':'Manage squads'}</button></div>
      : <div className="scope-selection"><label htmlFor="player-select">Selected player</label><select id="player-select" value={selectedPlayer} onChange={e=>onSelectedPlayer(e.target.value)}><option value="">Choose a player...</option>{players.map(p=><option key={p.playerId} value={p.playerId}>{p.username} · {p.playerId.slice(-8)}</option>)}</select></div>}
    </div>
    {mode==='team' && <>
      {active&& <div className="squad-members-strip"><span>{active.members.length}/5 SQUAD SLOTS</span>{Array.from({length:5},(_,i)=>{
        const id=active.members[i];return <span className={'squad-member-chip '+(id?'filled':'empty')} key={i} title={id??'Open squad slot'}>{id?names.get(id)??id:'EMPTY'}</span>;
      })}</div>}
      {editing&&<div className="squad-editor">
        <div className="squad-editor-head"><strong>SQUAD BUILDER</strong><span>Saved on this browser only · Maximum five IDs per squad</span></div>
        <div className="squad-new"><input aria-label="New squad name" placeholder="New squad name" maxLength={50} value={newName} onChange={e=>setNewName(e.target.value)}/><button type="button" onClick={createSquad}>+ CREATE SQUAD</button></div>
        {active&&<>
          <div className="squad-new"><input aria-label="Rename squad" placeholder={`Rename ${active.name}`} value={renameName} maxLength={50} onChange={e=>setRenameName(e.target.value)}/><button type="button" disabled={!renameName.trim()} onClick={()=>{update({...active,name:renameName.trim().slice(0,50)});setRenameName('');}}>RENAME SQUAD</button></div>
          <div className="squad-editor-head"><strong>{active.name} · {active.members.length}/5 players</strong><button type="button" className="scope-danger" onClick={()=>{
            if(!window.confirm(`Delete squad "${active.name}"? This only removes its saved roster.`))return;
            const next=squads.filter(s=>s.id!==active.id);onSquads(next);onSelectedSquad(next[0]?.id??'');
          }}>Delete squad</button></div>
          <div className="squad-editor-roster">{active.members.map(id=><div key={id} className="squad-editor-person"><div><strong>{names.get(id)??'Unrecorded ID'}</strong><small>{id}</small></div><button type="button" onClick={()=>update({...active,members:active.members.filter(x=>x!==id)})} aria-label={`Remove ${names.get(id)??id}`}>REMOVE</button></div>)}</div>
          {active.members.length<5&&<>
            <label className="scope-caption" htmlFor="squad-search">Add from imported players (search name or ID)</label>
            <input id="squad-search" placeholder="Find a player..." value={search} onChange={e=>setSearch(e.target.value)}/>
            <div className="squad-search-results">{filtered.map(p=><button key={p.playerId} type="button" onClick={()=>addMember(p.playerId)}><span>{p.username}</span><small>{p.playerId}</small><span>ADD +</span></button>)}</div>
            <div className="squad-new"><input aria-label="Add player ID manually" placeholder="Or paste an exact player ID" maxLength={100} value={manualId} onChange={e=>setManualId(e.target.value)}/><button type="button" disabled={!manualId.trim()} onClick={()=>addMember(manualId.trim())}>ADD ID</button></div>
            <p className="scope-caption">Manually entered IDs will start contributing statistics after a matching player appears in imported replays.</p>
          </>}
        </>}
      </div>}
    </>}
  </section>;
}
