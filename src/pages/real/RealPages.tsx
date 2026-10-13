import {useEffect,useState} from 'react';
import type {ReactNode} from 'react';
import {Icon} from '../../components/common/Icon';
import {ApiError,fetchApi,formatPlayedAt,mapLabel,nullableStat} from '../../data/realApi';
import type {ApiMatch,ApiMatchDetail,ApiRoundDetail,ApiPlayer,ApiPlayerDetail} from '../../data/realApi';

type LoadState<T>={loading:boolean;data:T|null;error:string|null};
function useResource<T>(path:string):LoadState<T>{
  const [state,setState]=useState<LoadState<T>>({loading:true,data:null,error:null});
  useEffect(()=>{
    const controller=new AbortController();
    setState({loading:true,data:null,error:null});
    fetchApi<T>(path,controller.signal).then(data=>setState({loading:false,data,error:null})).catch(err=>{
      if(controller.signal.aborted)return;
      setState({loading:false,data:null,error:err instanceof ApiError ? err.message : 'Could not connect to the local API. Start the backend on port 5087.'});
    });
    return ()=>controller.abort();
  },[path]);
  return state;
}
function Nav({to,children}:{to:string;children:ReactNode}){
  return <a className="real-link" href={'#'+to}>{children}</a>;
}
function Frame({title,eyebrow,description,children}:{title:string;eyebrow:string;description?:string;children:ReactNode}){
  return <div className="page real-view"><div className="page-head"><div><div className="eyebrow with-line">{eyebrow} / SQL SERVER</div><h1>{title}<span className="period">.</span></h1>{description&&<p>{description}</p>}</div><span className="real-source"><span className="real-pulse"/> LOCAL DATABASE</span></div>{children}</div>;
}
function LoadPanel<T>({state,children}:{state:LoadState<T>;children:(data:T)=>React.ReactNode}){
  if(state.loading)return <section className="panel real-notice"><Icon name="activity"/> Loading real match data from SQL Server...</section>;
  if(state.error)return <section className="panel real-notice"><h3>Local API unavailable</h3><p>{state.error}</p><p>In a separate terminal run <code>dotnet run --project backend/Breach.Intel.Api</code>, then refresh the page. Your demo mode remains available.</p><Nav to="/settings">Check settings</Nav></section>;
  if(state.data===null)return <section className="panel real-notice">No data received.</section>;
  return <>{children(state.data)}</>;
}
function Tile({label,value}:{label:string;value:string|number}){
  return <div className="real-kpi"><small>{label}</small><strong>{value}</strong></div>;
}
function Outcome({won}:{won:boolean|null|undefined}){
  return <span className={'real-outcome '+(won===true?'win':won===false?'loss':'unknown')}>{won===true?'WON':won===false?'LOST':'UNKNOWN'}</span>;
}
function safeNumber(n:number|null|undefined){return n==null?'—':n.toLocaleString();}
function ratio(k:number,d:number){return d===0?(k===0?'0.00':'—'):(k/d).toFixed(2);}
function safeDate(value:string|null){return value?formatPlayedAt(value):'Unknown';}
function labelSide(side:string|null|undefined){return side?.toUpperCase()??'UNKNOWN';}

export function RealOverviewPage(){
  const state=useResource<ApiMatch[]>('/matches');
  return <Frame title="Command overview" eyebrow="REAL DATA" description="Imported Rainbow Six Siege match data. Statistics are based only on your local database.">
    <LoadPanel state={state}>{matches=><><div className="real-kpis"><Tile label="IMPORTED MATCHES" value={matches.length}/><Tile label="ROUNDS ON RECORD" value={matches.reduce((v,m)=>v+m.roundCount,0)}/><Tile label="RECORDED ROUND WINS" value={matches.reduce((v,m)=>v+m.roundsWon,0)}/><Tile label="RECORDED ROUND LOSSES" value={matches.reduce((v,m)=>v+m.roundsLost,0)}/></div><section className="panel real-section"><div className="real-section-header"><div className="eyebrow">01 / VERIFIED RECORDS</div><h3>Recent imported matches</h3></div><div className="real-rows">{matches.length===0?<p>No imported matches yet.</p>:matches.slice(0,8).map(m=><div className="real-record" key={m.matchId}><div><strong>{mapLabel(m.mapName,m.mapId)}</strong><span>{m.matchType??'Unknown mode'} · {safeDate(m.playedAt)}</span></div><div className="real-record-right"><b>{m.roundsWon} : {m.roundsLost}</b><Nav to={'/matches/'+m.matchId}>OPEN →</Nav></div></div>)}</div></section><section className="real-callout">These are local imported records, not real-time telemetry. Rank, season trends, movement, and utility metrics are not available from this dataset.</section></>}</LoadPanel>
  </Frame>;
}

export function RealMatchesPage(){
  const state=useResource<ApiMatch[]>('/matches');
  const [filter,setFilter]=useState('');
  return <Frame title="Match center" eyebrow="REAL DATA" description="A searchable archive of matches imported into BREACH / INTEL.">
    <LoadPanel state={state}>{matches=><><div className="real-kpis"><Tile label="MATCHES" value={matches.length}/><Tile label="ROUNDS" value={matches.reduce((v,m)=>v+m.roundCount,0)}/><Tile label="ROUND WINS" value={matches.reduce((v,m)=>v+m.roundsWon,0)}/><Tile label="ROUND LOSSES" value={matches.reduce((v,m)=>v+m.roundsLost,0)}/></div><section className="panel real-section"><div className="real-section-header"><div><div className="eyebrow">01 / REAL MATCH ARCHIVE</div><h3>Battle records</h3></div><input className="real-input" value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Search match ID, map or mode" aria-label="Search real matches"/></div><div className="real-rows">{matches.filter(m=>`${m.matchId} ${m.mapName} ${m.matchType} ${m.gameMode}`.toLowerCase().includes(filter.toLowerCase())).map(m=><div className="real-record" key={m.matchId}><div><strong>{mapLabel(m.mapName,m.mapId)}</strong><span>{m.gameMode} · {m.matchType} · {safeDate(m.playedAt)}</span><small>#{m.matchId.slice(0,8)} · {m.roundCount} rounds</small></div><div className="real-record-right"><b>{m.roundsWon} : {m.roundsLost}</b><Nav to={'/matches/'+m.matchId}>VIEW REPORT →</Nav></div></div>)}</div>{matches.length===0&&<p>No imported matches found. Run the local importer first.</p>}</section></>}</LoadPanel>
  </Frame>;
}

export function RealMatchDetailPage({id}:{id:string}){
  const state=useResource<ApiMatchDetail>('/matches/'+encodeURIComponent(id));
  return <Frame title="Match report" eyebrow="ENGAGEMENT ANALYSIS" description="Actual scores, operators, and player statistics from SQL Server.">
    <div className="real-back"><Nav to="/matches">← ALL MATCHES</Nav></div>
    <LoadPanel state={state}>{data=>{
      const roundsWon=data.rounds.filter(r=>r.won===true).length;
      const roundsLost=data.rounds.filter(r=>r.won===false).length;
      return <><div className="real-hero"><div><div className="eyebrow">RANKED REPLAY / {data.match.gameVersion}</div><h2>{mapLabel(data.match.mapName,data.match.mapId)}</h2><p>{safeDate(data.match.playedAt)} · {data.match.gameMode} · {data.rounds.length} rounds</p></div><strong className="real-score">{roundsWon} <span>:</span> {roundsLost}</strong></div><div className="real-kpis"><Tile label="ROUND WINS" value={roundsWon}/><Tile label="ROUND LOSSES" value={roundsLost}/><Tile label="PLAYER RECORDS" value={data.players.length}/><Tile label="MATCH ID" value={id.slice(0,8)}/></div>
      <section className="panel real-section"><div className="real-section-header"><div className="eyebrow">01 / ROUND EXPLORER</div><h3>Select a round</h3></div><div className="real-round-grid">{data.rounds.map(r=><Nav key={r.roundId} to={`/matches/${id}/round/${r.roundNumber}`}><div className="real-round"><small>ROUND {String(r.roundNumber).padStart(2,'0')}</small><Outcome won={r.won}/><strong>{labelSide(r.side)}</strong><p>{r.site??'Unknown bomb site'}</p><small>{safeNumber(r.scoreAfter)} : {safeNumber(r.opponentScoreAfter)} · {r.winCondition??'Condition unrecorded'}</small></div></Nav>)}</div></section>
      <section className="panel real-section"><div className="real-section-header"><div className="eyebrow">02 / PLAYER TOTALS</div><h3>Match scoreboard</h3></div><div className="real-scroll"><table className="real-table"><thead><tr><th>PLAYER</th><th>SIDE</th><th>K</th><th>D</th><th>A</th><th>HS</th><th>DMG DEALT*</th><th>K/D</th></tr></thead><tbody>{data.players.map(p=><tr key={p.playerId}><td><Nav to={'/players/'+p.playerId}>{p.username}</Nav></td><td>{p.recordedTeam?'RECORDED TEAM':'OPPONENT'}</td><td>{p.kills}</td><td>{p.deaths}</td><td>{p.assists}</td><td>{p.headshots??'—'}</td><td>{nullableStat(p.damageDealt)}</td><td>{ratio(p.kills,p.deaths)}</td></tr>)}</tbody></table></div><p className="real-footnote">* Recorded damage can be incomplete. No missing values were invented. Team classifications follow the parser's recorded team slots.</p></section></>;
    }}</LoadPanel>
  </Frame>;
}

export function RealRoundPage({id,number}:{id:string;number:number}){
  const state=useResource<ApiRoundDetail>(`/matches/${encodeURIComponent(id)}/rounds/${number}`);
  return <Frame title={`Round ${String(number).padStart(2,'0')}`} eyebrow="ROUND INSPECTOR" description="Timeline and operator-by-operator statistics captured in the replay.">
    <div className="real-back"><Nav to={'/matches/'+id}>← BACK TO MATCH</Nav></div>
    <LoadPanel state={state}>{data=><><div className="real-hero"><div><div className="eyebrow">{labelSide(data.round.side)} · {data.round.site??'Site unavailable'}</div><h2>Round {number} <Outcome won={data.round.won}/></h2><p>Win condition: {data.round.winCondition??'Not recorded'} · Score {safeNumber(data.round.scoreAfter)} : {safeNumber(data.round.opponentScoreAfter)}</p></div></div><div className="real-two-cols"><section className="panel real-section"><div className="real-section-header"><div className="eyebrow">01 / KILL TIMELINE</div><h3>{data.events.length} recorded events</h3></div><div className="real-timeline">{data.events.length===0?<p>No recorded events.</p>:data.events.map(e=><div key={e.eventSequence} className="real-event"><span className="real-event-time">{e.timeRemainingSeconds==null?'—':`${Math.floor(e.timeRemainingSeconds/60)}:${String(e.timeRemainingSeconds%60).padStart(2,'0')}`}</span><div><strong>{e.actorUsername??'Unknown actor'}</strong> → {e.targetUsername??'Unknown target'}<small>{e.eventType??'Event'} · {e.isHeadshot?'HEADSHOT · ':''}Weapon ID {e.weaponId??'unknown'}</small></div></div>)}</div><p className="real-footnote">Events at 0:00 and some death times may be inconsistent. Timeline is shown as parsed, not corrected.</p></section><section className="panel real-section"><div className="real-section-header"><div className="eyebrow">02 / PLAYER PERFORMANCE</div><h3>Round scoreboard</h3></div><div className="real-scroll"><table className="real-table"><thead><tr><th>PLAYER</th><th>OPERATOR</th><th>K</th><th>D</th><th>A</th><th>DMG*</th></tr></thead><tbody>{data.players.map(p=><tr key={p.playerId}><td><Nav to={'/players/'+p.playerId}>{p.username}</Nav></td><td>{p.operatorName??'Unknown'}</td><td>{safeNumber(p.kills)}</td><td>{p.died==null?'—':p.died?1:0}</td><td>{safeNumber(p.assists)}</td><td>{nullableStat(p.damageDealt)}</td></tr>)}</tbody></table></div></section></div></>}</LoadPanel>
  </Frame>;
}

export function RealPlayersPage(){
  const state=useResource<ApiPlayer[]>('/players');
  const [search,setSearch]=useState('');
  return <Frame title="Player directory" eyebrow="REAL DATA" description="Players observed in imported replays—not a global Ubisoft player search."><LoadPanel state={state}>{players=><section className="panel real-section"><div className="real-section-header"><div><div className="eyebrow">01 / IMPORTED PLAYERS</div><h3>{players.length} known players</h3></div><input className="real-input" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Filter by username" aria-label="Filter players"/></div><div className="real-scroll"><table className="real-table"><thead><tr><th>PLAYER</th><th>ROUNDS</th><th>KILLS</th><th>DEATHS</th><th>ASSISTS</th><th>K/D</th></tr></thead><tbody>{players.filter(p=>p.username.toLowerCase().includes(search.toLowerCase())).map(p=><tr key={p.playerId}><td><Nav to={'/players/'+p.playerId}>{p.username}</Nav></td><td>{p.roundsPlayed}</td><td>{p.kills}</td><td>{p.deaths}</td><td>{p.assists}</td><td>{ratio(p.kills,p.deaths)}</td></tr>)}</tbody></table></div></section>}</LoadPanel></Frame>;
}

export function RealPlayerPage({id}:{id:string}){
  const state=useResource<ApiPlayerDetail>('/players/'+encodeURIComponent(id)+'/stats');
  return <Frame title="Player intelligence" eyebrow="INDIVIDUAL ANALYSIS" description="Aggregated across matches currently stored in LocalDB."><div className="real-back"><Nav to="/players">← ALL PLAYERS</Nav></div><LoadPanel state={state}>{data=><><div className="real-hero"><div><div className="eyebrow">PLAYER PROFILE</div><h2>{data.player.username}</h2><p>{data.player.roundsPlayed} tracked rounds</p></div></div><div className="real-kpis"><Tile label="KILLS" value={data.player.kills}/><Tile label="DEATHS" value={data.player.deaths}/><Tile label="ASSISTS" value={data.player.assists}/><Tile label="K/D" value={ratio(data.player.kills,data.player.deaths)}/><Tile label="RECORDED DAMAGE*" value={nullableStat(data.player.damageDealt)}/><Tile label="ENTRY KILLS" value={data.player.entryKills??'—'}/><Tile label="ENTRY DEATHS" value={data.player.entryDeaths??'—'}/><Tile label="TRADE KILLS" value={data.player.tradeKills??'—'}/></div><section className="panel real-section"><div className="real-section-header"><div className="eyebrow">01 / OPERATOR HISTORY</div><h3>Operators played</h3></div><div className="real-scroll"><table className="real-table"><thead><tr><th>OPERATOR</th><th>ROUNDS</th><th>KILLS</th><th>DEATHS</th></tr></thead><tbody>{data.operators.map((o,i)=><tr key={`${o.operatorName}-${i}`}><td>{o.operatorName??'Unknown'}</td><td>{o.roundsPlayed}</td><td>{o.kills}</td><td>{o.deaths}</td></tr>)}</tbody></table></div><p className="real-footnote">* Recorded damage may omit some contributions. Rank, KOST and objective actions aren't available in these records.</p></section></>}</LoadPanel></Frame>;
}

export function RealUnavailablePage({feature}:{feature:string}){
  return <Frame title={feature} eyebrow="REAL DATA" description="This feature does not have a verified live-data source yet."><section className="panel real-notice"><h3>Still in development</h3><p>We won't mix fictional stats with your real Siege data. Switch to Investor Demo mode to preview this screen, or explore imported matches and players.</p><div className="real-unavailable-links"><Nav to="/matches">VIEW MATCHES →</Nav><Nav to="/players">VIEW PLAYERS →</Nav></div></section></Frame>;
}
