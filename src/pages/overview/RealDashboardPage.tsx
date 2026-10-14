import { useEffect, useMemo, useState } from 'react';
import { Icon, Pill, Progress, SectionTitle, Btn, StatCard, Monogram, OperatorIcon } from '../../components';
import { ApiError, fetchApi, mapLabel } from '../../data/realApi';
import { analyzeOverview, asPercent } from '../../data/overviewAnalytics';
import type { OverviewV3, ResolvedMatch } from '../../data/overviewAnalytics';
import { useTrackingScope } from '../../data/useTrackingScope';
import { TrackingScope } from '../../components/TrackingScope';

type Period='7D'|'30D'|'ALL';
const initials=(name:string)=>name.split(/[\s_-]+/).map(part=>part.slice(0,1)).join('').slice(0,2).toUpperCase()||'??';
function colorFor(name:string){const palette=['#a3d88d','#72c7c0','#dfbb79','#85a6e6','#da9fae'];let sum=0;for(const ch of name)sum=(sum+ch.charCodeAt(0))%palette.length;return palette[sum];}
function labelDate(value:string|null){if(!value)return 'DATE UNKNOWN';const d=new Date(value);return Number.isFinite(d.getTime())?d.toLocaleDateString('en-US',{month:'short',day:'numeric'}).toUpperCase():'DATE UNKNOWN';}
function mapName(m:ResolvedMatch){return mapLabel(m.mapName,m.mapId);}
const asRate=(n:number,d:number)=>asPercent(n,d)===null?'—':`${asPercent(n,d)}%`;
function EmptyPanel({message}:{message:string}){return <p className="real-dashboard-empty">{message}</p>;}
function Badge({outcome}:{outcome:ResolvedMatch['outcome']}){return <span className={'result '+(outcome==='WIN'?'win':outcome==='LOSS'?'loss':'unknown')}>{outcome}</span>;}

/** One ring = one statistic: overall round win rate, not an attack-only label. */
function RoundWinRing({wins,total}:{wins:number;total:number}){
  const value=asPercent(wins,total);
  const circumference=2*Math.PI*56;
  return <div className="ring-wrap" style={{width:152,height:152}} role="img" aria-label={total?`Overall round win rate ${value}% (${wins} wins in ${total} rounds)`:'No known round results'}>
    <svg viewBox="0 0 140 140" width="152" height="152" aria-hidden="true">
      <circle cx="70" cy="70" r="56" fill="none" stroke="#28333c" strokeWidth="14"/>
      <circle cx="70" cy="70" r="56" fill="none" stroke="#d0ff61" strokeWidth="14" strokeDasharray={`${circumference*(value??0)/100} ${circumference}`} transform="rotate(-90 70 70)"/>
    </svg><div className="ring-center"><strong>{value===null?'—':`${value}%`}</strong><span>OVERALL ROUND W/R</span></div>
  </div>;
}
function SideWinBars({aWins,aRounds,dWins,dRounds}:{aWins:number;aRounds:number;dWins:number;dRounds:number}){
  return <div className="side-split scope-side-split">
    {[{label:'ATTACK',wins:aWins,rounds:aRounds,color:'var(--accent)',cls:'lime'},
      {label:'DEFENSE',wins:dWins,rounds:dRounds,color:'var(--blue)',cls:'blue'}].map(s=>{
      const rate=asPercent(s.wins,s.rounds);
      return <div key={s.label}><div className="side-row"><span><i className={'small-square '+s.cls}/>{s.label} · {s.wins}/{s.rounds} WON</span><strong>{rate===null?'—':rate+'%'}</strong></div>
        <Progress value={rate??0} color={s.color}/></div>;
    })}
  </div>;
}
/** Accurate 0-100% plot scale, chronological cumulative percentages. */
function VerifiedWinChart({matches}:{matches:ResolvedMatch[]}){
  const ordered=[...matches].sort((a,b)=>(Date.parse(a.playedAt??'')||0)-(Date.parse(b.playedAt??'')||0));
  let running=0;
  const points=ordered.map((m,i)=>{
    if(m.outcome==='WIN')running++;
    const rate=100*running/(i+1);
    return {x:46+i*524/Math.max(ordered.length-1,1),y:30+(100-rate)*1.48,rate,date:labelDate(m.playedAt),index:i};
  });
  const line=points.map((p,i)=>`${i?'L':'M'} ${p.x} ${p.y}`).join(' ');
  return <div className="linechart"><svg viewBox="0 0 620 220" preserveAspectRatio="none" role="img" aria-label="Cumulative match win rate, with axis from 0 to 100 percent">
    {[100,75,50,25,0].map(v=>{const y=30+(100-v)*1.48;return <g key={v}><line x1="46" x2="584" y1={y} y2={y} stroke="#27323a" strokeDasharray="4 6"/><text x="4" y={y+4} fontSize="11" fontFamily="monospace" fill="#8c9d9a">{v}%</text></g>;})}
    <path d={line} stroke="#d0ff61" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    {points.map(p=><circle key={p.index} cx={p.x} cy={p.y} r={p.index===points.length-1?4.5:2.5} fill="#d0ff61"><title>{`${p.date}: cumulative ${p.rate.toFixed(1)}% (${p.index+1} matches)`}</title></circle>)}
    {[0,Math.floor((points.length-1)/2),points.length-1].filter((v,i,a)=>v>=0&&a.indexOf(v)===i).map(i=><text key={i} x={points[i].x} y="213" textAnchor="middle" fontSize="10" fontFamily="monospace" fill="#8c9d9a">{points[i].date}</text>)}
  </svg></div>;
}

export function RealDashboardPage({app}:{app:any}){
  const [data,setData]=useState<OverviewV3|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);
  const scope=useTrackingScope(data?.players??[],data?.matches??[]);
  const {mode,chosen,identity}=scope;
  const period:Period=['7D','30D','ALL'].includes(app.state.period)?app.state.period:'30D';
  useEffect(()=>{
    const controller=new AbortController();
    fetchApi<OverviewV3>('/overview/v3',controller.signal)
      .then(d=>{setData(d);setLoading(false);})
      .catch(e=>{if(!controller.signal.aborted){setError(e instanceof ApiError?e.message:'Unable to connect to the local API.');setLoading(false);}});
    return ()=>controller.abort();
  },[]);
  const view=useMemo(()=>data&&chosen.length?analyzeOverview(data,{mode,members:chosen},period):null,[data,mode,period,JSON.stringify(chosen)]);
  const sourceNote=mode==='team'?'Squad metrics include only your selected roster members. Opponents and unselected teammates are excluded.':'Player metrics include only the selected player’s recorded rounds.';
  const roundSideKnown=view?view.attackRounds+view.defenseRounds:0;
  const knownWins=view?view.attackWins+view.defenseWins:0;
  const latest=view?.latest??null;
  const latestRounds=latest?latest.scopedRounds:[];
  const allPlayers=data?.players??[];
  return <div className="page real-dashboard">
    <div className="dashboard-head">
      {app.headline('REPLAY INTELLIGENCE / PERFORMANCE CENTER','Command overview.','Every round. Every decision. Verified perspective.')}
      <div className="period-switch" aria-label="Time range">{(['7D','30D','ALL'] as Period[]).map(p=><button key={p} className={period===p?'active':''} onClick={()=>app.setState({period:p})}>{p}</button>)}</div>
    </div>
    {loading&&<section className="panel real-dashboard-status" role="status"><Icon name="activity" size={18}/> Loading recorded player and match data...</section>}
    {error&&<section className="panel real-dashboard-status" role="alert"><strong>Dashboard unavailable.</strong><span>{error} Restart the ASP.NET Core API and refresh.</span><code>dotnet run --project .\backend\Breach.Intel.Api\Breach.Intel.Api.csproj</code></section>}
    {!loading&&!error&&data&&<>
      <TrackingScope scope={scope} players={allPlayers}/>
      {!view?<section className="panel squad-empty-state"><Icon name="target" size={29}/><h3>{mode==='team'?'Build your first squad':'Select a player'}</h3><p>{mode==='team'?'Choose Manage squads, create a named roster, then add up to five player IDs. You can save multiple squads and swap players at any time.':'Choose a player from your imported replay records to view personal analytics.'}</p></section>:<>
        <div className="hero-grid">
          <div className="hero-card"><div className="hero-top"><Pill tone="outline" dot>{mode==='team'?'SQUAD INTELLIGENCE':'PLAYER INTELLIGENCE'}</Pill><span className="hero-coordinates">LIVE DATABASE / LOCAL REPLAYS</span></div>
            <div className="hero-core"><span className="hero-overline">{identity.toUpperCase()} / COMPETITIVE INTELLIGENCE</span><h2>Built to <em>win.</em><br/>Powered by data.</h2><p>Turn recorded match telemetry into actionable intelligence, without mixing opponents into your stats.</p><Btn variant="primary" icon="arrow" onClick={()=>app.go('/matches')}>EXPLORE MATCH INTEL</Btn></div>
            <div className="hero-bottom"><span><Icon name="shield" size={14}/>{identity.toUpperCase()}</span><span>{view.wins}W <b>/</b> {view.losses}L · {view.matches.length} MATCHES</span></div><div className="hero-deco">R6<span>///</span></div>
          </div>
          <div className="featured-match"><div className="featured-head"><div className="eyebrow">LATEST TRACKED ENGAGEMENT</div>{latest&&<Badge outcome={latest.outcome}/>}</div>
            {latest?<><div className="featured-opponent"><div className="featured-team"><div className="emblem">B<span>•</span></div><strong>{identity}</strong><small>{mode==='team'?`${latest.present}/${chosen.length} MEMBERS PRESENT`:'SELECTED PLAYER'}</small></div>
              <div className="featured-score"><span>{latest.wins}</span><i>:</i><span>{latest.losses}</span><small>RECORDED ROUND SCORE</small></div>
              <div className="featured-team"><div className="emblem opponent">?</div><strong>OPPONENT</strong><small>NAME NOT VERIFIED</small></div></div>
              <div className="featured-map"><Icon name="map" size={14}/>{mapName(latest)} <i>•</i> {latest.gameMode??'Unknown mode'} <i>•</i> {labelDate(latest.playedAt)}</div>
              <div className="round-chip-row">{latestRounds.map(r=><button key={r.roundId} className={'round-chip '+(r.won?'won':'lost')} title={`Round ${r.roundNumber} · ${r.side??'Unknown side'} · ${r.won?'Won':'Lost'}`} onClick={()=>app.go(`/matches/${latest.matchId}/round/${r.roundNumber}`)}>{String(r.roundNumber).padStart(2,'0')}</button>)}</div>
              <button className="featured-link" onClick={()=>app.go(`/matches/${latest.matchId}`)}>VIEW MATCH BREAKDOWN <Icon name="arrow" size={15}/></button></>
            :<EmptyPanel message="No recorded matches for this selection and time range."/>}</div>
        </div>
        <div className="stats-grid">
          <StatCard label="MATCH WIN RATE" value={asRate(view.wins,view.decided.length)} icon="cup" delta="DECIDED MATCHES" sub={`${view.decided.length} verified completed`} highlight/>
          <StatCard label={mode==='team'?'SQUAD K/D RATIO':'PLAYER K/D RATIO'} value={view.kd??'—'} icon="crosshair" delta="SELECTED PLAYERS" sub={view.kd===null?'insufficient death/kill coverage':`${view.totalKills} K / ${view.totalDeaths} D`}/>
          <StatCard label="ROUNDS TRACKED" value={view.rounds.toLocaleString()} icon="target" delta="SAMPLED" sub={`${view.roundWins} won / ${view.roundLosses} lost`}/>
          <StatCard label="HEADSHOT RATE" value={view.hs===null?'—':`${view.hs}%`} icon="bolt" delta="SAMPLED KILLS" sub={`${view.hsEligibleKills}/${view.hsTotalKills} kills with HS data`}/>
        </div>
        <div className="two-thirds">
          <section className="panel large-panel"><SectionTitle eyebrow="01 / PERFORMANCE ANALYTICS" title="Winning momentum" right={<Pill tone="quiet">MATCH WIN RATE</Pill>}/><div className="chart-header"><div><strong>{view.decided.length?asPercent(view.wins,view.decided.length):'—'}<sup>{view.decided.length?'%':''}</sup></strong><span>WIN RATE · {view.decided.length} VERIFIED MATCHES</span></div><div className="chart-key"><i/> CUMULATIVE W/R</div></div>
            {view.decided.length?<VerifiedWinChart matches={view.decided}/>:<EmptyPanel message="No completed, unambiguous matches with results in this period."/>}
          </section>
          <section className="panel large-panel sidepanel"><SectionTitle eyebrow="02 / SIDE ANALYSIS" title="Attack vs. defense"/>
            {roundSideKnown>0?<><RoundWinRing wins={knownWins} total={roundSideKnown}/><SideWinBars aWins={view.attackWins} aRounds={view.attackRounds} dWins={view.defenseWins} dRounds={view.defenseRounds}/><div className="scope-side-detail"><span>ATTACK {view.attackWins}/{view.attackRounds} <b>({asRate(view.attackWins,view.attackRounds)})</b></span><span>DEFENSE {view.defenseWins}/{view.defenseRounds} <b>({asRate(view.defenseWins,view.defenseRounds)})</b></span></div></>:<EmptyPanel message="No known attack or defense round outcomes for this selection."/>}
            <div className="panel-insight"><Icon name="info" size={14}/><span>Ring: {knownWins}/{roundSideKnown} overall round wins. Bars: separate attack and defense win rates. {view.rounds-roundSideKnown} rounds without known side.</span></div>
          </section>
        </div>
        <div className="dashboard-bottom">
          <section className="panel"><SectionTitle eyebrow="03 / SQUAD INTELLIGENCE" title={mode==='team'?'Top squad performers':'Personal performance'} right={<button className="text-action" onClick={()=>app.go('/players')}>PLAYER DIRECTORY <Icon name="arrow" size={14}/></button>}/>
            <div className="leaders">{view.players.length?view.players.slice(0,4).map((p,i)=><button key={p.playerId} className="leader-row" onClick={()=>app.go(`/players/${encodeURIComponent(p.playerId)}`)}><span className="leader-rank">0{i+1}</span><Monogram player={{initials:initials(p.username),color:colorFor(p.username)}} size="sm"/><span className="leader-person"><strong>{p.username}</strong><small>{p.roundsPlayed} TRACKED ROUNDS</small></span><span className="leader-metric"><strong>{p.kd??'—'}</strong><small>K/D</small></span><span className="leader-metric"><strong>{p.kills}</strong><small>KILLS</small></span><Icon name="chevron" size={15}/></button>):<EmptyPanel message="No player statistics in this period."/>}</div>
          </section>
          <section className="panel"><SectionTitle eyebrow="04 / MAP INTELLIGENCE" title="Battleground record" right={<button className="text-action" onClick={()=>app.go('/matches')}>ALL MATCHES <Icon name="arrow" size={14}/></button>}/><div className="map-ranks">{view.maps.length?view.maps.map(m=>{const rate=asPercent(m.wins,m.played)??0;return <div className="map-rank" key={m.key}><div className="map-rank-top"><span><i className="map-symbol" style={{background:colorFor(m.label)}}/>{m.label}</span><strong>{rate}%</strong></div><Progress value={rate} color={rate>=60?'var(--accent)':'var(--blue)'} thin/><small>{m.wins}/{m.played} VERIFIED MATCHES WON</small></div>;}):<EmptyPanel message="No completed matches with map data for this selection."/>}</div></section>
          <section className="panel"><SectionTitle eyebrow="05 / OPERATOR INTELLIGENCE" title="Most fielded" right={<button className="text-action" onClick={()=>app.go('/matches')}>MATCH ARCHIVE <Icon name="arrow" size={14}/></button>}/><div className="operator-compact">{view.operators.length?view.operators.map(o=><div key={`${o.name}|${o.side}`} className="operator-compact-row"><OperatorIcon name={o.name} color={colorFor(o.name)}/><div><strong>{o.name}</strong><small>{o.side.toUpperCase()} · {mode==='team'?'SELECTED SQUAD':'SELECTED PLAYER'}</small></div><div className="op-right"><strong>{o.rounds}</strong><small>ROUNDS PICKED</small></div></div>):<EmptyPanel message="No recorded operator selections in this period."/>}</div></section>
        </div>
        <div className="bottom-actions"><div className="callout"><span className="callout-icon"><Icon name="bolt" size={22}/></span><div><strong>See the numbers behind every decision.</strong><p>{view.matches.length} tracked matches · {view.decided.length} verified outcomes · {identity}</p></div><Btn variant="primary" icon="arrow" onClick={()=>app.go('/matches')}>OPEN MATCHES</Btn></div></div>
        <p className="real-dashboard-disclaimer">SOURCE: IMPORTED LOCAL REPLAYS · {sourceNote} Side and outcome attribution use player IDs and verified replay team indices. {view.ambiguousMatches?`${view.ambiguousMatches} matches excluded because selected players appeared on conflicting or unknown sides. `:''}Only completed, unambiguous matches contribute to match win rate; incomplete matches can contribute known rounds. Headshot coverage may be partial. Squads are saved in the local database. Match Center follows the same player or squad selection.</p>
      </>}
    </>}
  </div>;
}
