import {usePlaylist} from '../../data/usePlaylist';
import {matchPlaylist,playlistLabels} from '../../data/playlists';
import {playerTotals} from '../../data/playerAnalytics';
import {compareKd} from '../../data/kdSort';
import {ManualDataToggle,useManualInclusion} from '../../components/ManualDataToggle';
import {useRecordedOverview} from '../../data/useRecordedOverview';
import {loadReportResource} from '../../data/analyticsReportApi';
import {sourceLabel} from '../../data/analyticsSources';
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Btn, Empty, Icon, Monogram, OperatorIcon, Pill, SectionTitle } from '../../components';
import { TrackingScope } from '../../components/TrackingScope';
import { useTrackingScope } from '../../data/useTrackingScope';
import { ApiError, fetchApi, formatPlayedAt, mapLabel } from '../../data/realApi';
import { analyzeOverview, asPercent } from '../../data/overviewAnalytics';
import type { OverviewV3, ResolvedMatch } from '../../data/overviewAnalytics';
import type { MatchReport, ReportEvent } from '../../data/matchReportApi';
import { resolveMatchReport, matchCsv } from '../../data/matchAnalytics';
import { saveFile } from '../../lib/download';

type Period = '7D' | '30D' | 'ALL';
type Outcome = 'WIN' | 'LOSS' | 'UNKNOWN';
type ReportView = ReturnType<typeof resolveMatchReport>;
type PlayerStats = ReportView['selectedStats'][number];
type Round = ReportView['rounds'][number];
const emptyPlayers: OverviewV3['players'] = [];
const stat = (value: number | null | undefined) => value == null ? '—' : value.toLocaleString();
const rate = (wins: number, rounds: number) => rounds ? `${asPercent(wins, rounds)}%` : '—';
const sideLabel = (side: Round['side']) => side === 'ATK' ? 'ATTACK' : side === 'DEF' ? 'DEFENSE' : 'SIDE UNKNOWN';
const matchUrl = (id: string, round?: number) => `/matches/${encodeURIComponent(id)}${round == null ? '' : `/round/${round}`}`;
const initials = (name: string) => name.replace(/[^\p{L}\p{N}]/gu, '').slice(0, 2).toUpperCase() || '?';
const shortDate = (value: string | null) => value && Number.isFinite(Date.parse(value))
  ? new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase() : 'UNDATED';

function useResource<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(path));
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setData(null); setError(null); setLoading(Boolean(path));
    if (path) loadReportResource<T>(path, controller.signal).then(next => {
      if (!controller.signal.aborted) { setData(next); setLoading(false); }
    }).catch(e => {
      if (!controller.signal.aborted) {
        setError(e instanceof ApiError && e.status === 404 ? 'This match record was not found.'
          : e instanceof Error ? e.message : 'Unable to load the recorded match data.');
        setLoading(false);
      }
    });
    return () => controller.abort();
  }, [path, revision]);
  return { data, loading, error, reload: () => setRevision(value => value + 1) };
}

function Result({ outcome }: { outcome: Outcome }) {
  return <span className={`result ${outcome === 'WIN' ? 'win' : outcome === 'LOSS' ? 'loss' : 'unknown'}`}>{outcome === 'UNKNOWN' ? 'UNVERIFIED' : outcome}</span>;
}
function Notice({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return <section className="panel match-notice" role={error ? 'alert' : 'status'}><Icon name="info" size={18} /><div>{children}</div></section>;
}
function RoundChips({ rounds, onOpen }: { rounds: Round[]; onOpen: (number: number) => void }) {
  return <div className="recorded-round-chips">{rounds.map(round => <button key={round.roundId}
    className={`round-chip ${round.won === true ? 'won' : round.won === false ? 'lost' : 'unknown'}`}
    title={`Round ${round.roundNumber} · ${sideLabel(round.side)} · ${round.outcome}${round.participated ? '' : ' · selected players absent'}`}
    onClick={() => onOpen(round.roundNumber)}>{String(round.roundNumber).padStart(2, '0')}</button>)}</div>;
}

function Scoreboard({ rows, title, onPlayer, round = false }: { rows: PlayerStats[]; title: string; onPlayer: (id: string) => void; round?: boolean }) {
  const [kdOrder,setKdOrder]=useState<'asc'|'desc'|null>(null);
  const sorted=kdOrder?[...rows].sort((a,b)=>compareKd(a.kd,b.kd,kdOrder)):rows;
  return <section className="panel recorded-scoreboard"><SectionTitle eyebrow="PLAYER PERFORMANCE" title={title} right={<Pill tone="quiet">{rows.length} PLAYERS</Pill>} />
    {rows.length ? <div className="table-scroll"><table className="score-table"><thead><tr>
      <th>PLAYER</th><th>{round ? 'OPERATOR' : 'ROUNDS'}</th><th>K</th><th>D</th><th>A</th><th aria-sort={kdOrder===null?'none':kdOrder==='asc'?'ascending':'descending'}><button className="kd-sort" onClick={()=>setKdOrder(kdOrder==='desc'?'asc':'desc')}>K/D {kdOrder==='asc'?'↑':'↓'}</button></th><th>HS</th>{round && <th>DMG*</th>}
    </tr></thead><tbody>{sorted.map((player, index) => <tr key={player.playerId} className={player.selected ? 'tracked-player-row' : ''}>
      <td><button className="table-player" onClick={() => onPlayer(player.playerId)}><span className="table-num">{String(index + 1).padStart(2, '0')}</span>
        <Monogram player={{ initials: initials(player.username), color: player.selected ? '#ff9061' : '#85a6e6' }} size="sm" />
        <span><strong>{player.username}</strong><small>{player.selected ? 'TRACKED PLAYER' : player.playerId.slice(-8)}</small></span></button></td>
      <td>{round ? player.operators.join(', ') || '—' : player.roundsPlayed}</td><td className="strong-value">{stat(player.kills)}</td><td>{stat(player.deaths)}</td>
      <td>{stat(player.assists)}</td><td className="strong-value">{player.kd ?? '—'}</td><td>{stat(player.headshots)}</td>{round && <td>{stat(player.damageDealt)}</td>}
    </tr>)}</tbody></table></div> : <Empty title="No recorded participants" sub="No matching player records are available for this selection." />}
    <p className="muted-note">— indicates missing or incomplete data.{round ? ' * Damage is shown as recorded for this round.' : ' Match totals use round statistics; cumulative score and damage snapshots are excluded.'}</p>
  </section>;
}

function EventFeed({ events, report, view }: { events: ReportEvent[]; report: MatchReport; view: ReportView }) {
  if (!events.length) return <Empty title="No recorded events" sub="No event telemetry was recorded for this selection. Manual entries do not contain a kill-by-kill timeline." />;
  return <div className="timeline-scroll tall recorded-events">{events.map(event => {
    const actor = report.appearances.find(player => player.roundId === event.roundId && player.playerId === event.actorPlayerId);
    const relation = actor && view.resolved ? actor.teamIndex === view.resolved.slot ? 'friendly' : actor.teamIndex === 1 - view.resolved.slot ? 'hostile' : 'neutral' : 'neutral';
    const time = event.timeRemainingSeconds;
    const clock = time == null || time < 0 ? '—' : `${Math.floor(time / 60)}:${String(Math.floor(time % 60)).padStart(2, '0')}`;
    return <div className="event-line" key={event.eventId}><span className="event-clock" title="Replay time remaining">{clock}</span>
      <span className={`event-marker ${relation}`}><Icon name={event.eventType?.toLowerCase().includes('kill') ? 'crosshair' : 'activity'} size={13} /></span>
      <div className="event-description"><strong>{event.actorUsername || 'Actor unrecorded'}</strong><span>{event.targetUsername ? `→ ${event.targetUsername}` : ''}</span>
        <small>R{String(event.roundNumber).padStart(2, '0')} · {event.eventType || 'EVENT'}{event.isHeadshot === true ? ' · HEADSHOT' : ''}{event.weaponId != null ? ` · WEAPON ${event.weaponId}` : ''}</small></div>
    </div>;
  })}</div>;
}

export function RealMatchCenter({ app, id, number }: { app: any; id?: string; number?: number }) {
  try{id=id?decodeURIComponent(id):undefined;}catch{/* retain invalid ID for not-found feedback */}
  const [playlist]=usePlaylist();
  const [includeManual,setIncludeManual]=useManualInclusion();
  const resource=useRecordedOverview(includeManual);
  const overview={...resource,loading:!resource.data&&!resource.error};
  const excluded=id?(id.startsWith('manual:')?includeManual==='replay':includeManual==='manual'):false;
  const report = useResource<MatchReport>(id && !excluded ? `/matches/${encodeURIComponent(id)}/report` : null);
  const playlistExcluded=!!report.data&&matchPlaylist(report.data.match.matchType)!==playlist;
  const scope = useTrackingScope(overview.data?.players ?? emptyPlayers, overview.data?.matches);
  const period: Period = ['7D', '30D', 'ALL'].includes(app.state.period) ? app.state.period : '30D';
  const perspective = useMemo(() => ({ mode: scope.mode, members: scope.chosen }), [scope.mode, JSON.stringify(scope.chosen)]);
  const analysis = useMemo(() => overview.data && scope.chosen.length ? analyzeOverview(overview.data, perspective, period) : null, [overview.data, perspective, period]);
  const view = useMemo(() => report.data ? resolveMatchReport(report.data, perspective) : null, [report.data, perspective]);
  const [query, setQuery] = useState('');
  const [resultFilter, setResultFilter] = useState('ALL');
  const [modeFilter, setModeFilter] = useState('ALL');
  const [sort, setSort] = useState('newest');
  const [tab, setTab] = useState('scoreboard');
  const [eventRound, setEventRound] = useState('ALL');
  const [eventQuery, setEventQuery] = useState('');
  useEffect(()=>setModeFilter('ALL'),[playlist]);
  useEffect(() => { setEventRound('ALL'); setEventQuery(''); }, [id]);
  const kdByMatch=useMemo(()=>new Map((overview.data?.matches??[]).map(m=>[m.matchId,playerTotals(overview.data!.appearances.filter(a=>a.matchId===m.matchId&&scope.chosen.includes(a.playerId))).kd])),[overview.data,JSON.stringify(scope.chosen)]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = (analysis?.matches ?? []).filter(match => (resultFilter === 'ALL' || match.outcome === resultFilter)
      && (modeFilter === 'ALL' || match.matchType === modeFilter)
      && `${match.matchId} ${mapLabel(match.mapName, match.mapId)} ${match.matchType ?? ''} ${match.gameMode ?? ''}`.toLowerCase().includes(needle));
    if(sort==='kd-asc'||sort==='kd-desc')return [...list].sort((a,b)=>compareKd(kdByMatch.get(a.matchId)??null,kdByMatch.get(b.matchId)??null,sort==='kd-asc'?'asc':'desc'));
    return sort === 'oldest' ? [...list].reverse() : list;
  }, [analysis, query, resultFilter, modeFilter, sort,kdByMatch]);
  const summary = useMemo(() => overview.data && analysis ? analyzeOverview({ ...overview.data, matches: filtered }, perspective, 'ALL') : null, [overview.data, analysis, filtered, perspective]);
  const modes = [...new Set((analysis?.matches ?? []).map(match => match.matchType).filter((value): value is string => Boolean(value)))].sort();
  const isRound = number != null;
  const currentRound = view?.rounds.find(round => round.roundNumber === number);
  const hasSelection = scope.chosen.length > 0;
  const exportArchive = () => { saveFile('breach-intel-matches.csv', matchCsv(filtered), 'text/csv;charset=utf-8'); app.toast(`${filtered.length} recorded matches exported`); };
  const exportReport = () => { if (report.data) { saveFile(`breach-match-${id}.json`, JSON.stringify({ perspective, identity: scope.identity, report: report.data }, null, 2), 'application/json'); app.toast('Recorded match report exported'); } };
  const onPlayer = (playerId: string) => app.go(`/players/${encodeURIComponent(playerId)}`);
  const scopeBar = <TrackingScope scope={scope} players={overview.data?.players ?? emptyPlayers} />;
  return <div className="page real-match-center"><ManualDataToggle included={includeManual} onChange={setIncludeManual}/>{excluded&&<Notice>This match is excluded by the selected source. Choose Combined to open it.</Notice>}{id?.startsWith('manual:')&&!excluded&&<Notice><strong>MANUAL / UNVERIFIED</strong> · Self-reported player statistics. Scores come from the submitted match; event telemetry and unentered measurements are unavailable.</Notice>}
    {!id ? <>
      {app.headline(`MATCH ARCHIVE / ${analysis?.matches.length ?? 0} ENGAGEMENTS`, 'Match center.', 'Every engagement, preserved down to the last recorded round.', <Btn icon="download" disabled={!filtered.length} onClick={exportArchive}>EXPORT MATCHES</Btn>)}
      <div className="match-period"><span className="eyebrow">TRACKED MATCH HISTORY</span><div className="period-switch" aria-label="Match time range">{(['7D', '30D', 'ALL'] as Period[]).map(value => <button key={value} className={period === value ? 'active' : ''} onClick={() => app.setState({ period: value })}>{value}</button>)}</div></div>
    </> : <button className="back-link" onClick={() => app.go(isRound ? matchUrl(id) : '/matches')}><Icon name="arrowleft" size={15} />{isRound ? 'BACK TO MATCH REPORT' : 'ALL MATCHES'}</button>}
    {overview.loading && <Notice>Loading recorded matches and players…</Notice>}
    {overview.error && <Notice error>{overview.error} <button className="text-action" onClick={overview.reload}>RETRY</button></Notice>}
    {overview.data && scopeBar}
    {overview.data && !hasSelection && <Notice>Choose a player or a squad with members to see their match history.</Notice>}
    {overview.data && !id && hasSelection && <>
      <div className="match-summary"><div><small>MATCH RECORD</small><strong>{summary?.wins ?? 0}<i> — </i>{summary?.losses ?? 0}</strong><span>RECORDED WINS / LOSSES</span></div>
        <div><small>ROUNDS TRACKED</small><strong>{summary?.rounds ?? 0}</strong><span>ACROSS {filtered.length} MATCHES</span></div>
        <div><small>MATCH WIN RATE</small><strong className="accent">{rate(summary?.wins ?? 0, summary?.decided.length ?? 0)}</strong><span>{summary?.decided.length ?? 0} RECORDED RESULTS</span></div>
        <div><small>{scope.mode === 'team' ? 'SQUAD' : 'PLAYER'} K/D</small><strong>{summary?.kd ?? '—'}</strong><span>{scope.identity.toUpperCase()}</span></div></div>
      <section className="panel match-list-panel"><div className="list-head"><div><div className="eyebrow">01 / BATTLE RECORDS</div><h3>Engagement history <span className="title-count">{filtered.length}</span></h3></div>
        <div className="list-filters"><div className="filter-search"><Icon name="search" size={15} /><input aria-label="Filter matches" placeholder="Map, mode, match ID" value={query} onChange={event => setQuery(event.target.value)} /></div>
          <select aria-label="Match mode" value={modeFilter} onChange={event => setModeFilter(event.target.value)}><option value="ALL">ALL MODES</option>{modes.map(mode => <option key={mode}>{mode}</option>)}</select>
          <select aria-label="Match order" value={sort} onChange={event => setSort(event.target.value)}><option value="newest">NEWEST FIRST</option><option value="oldest">OLDEST FIRST</option><option value="kd-desc">K/D HIGH TO LOW</option><option value="kd-asc">K/D LOW TO HIGH</option></select><button className="kd-sort" aria-label="Toggle K/D sort direction" onClick={()=>setSort(sort==='kd-desc'?'kd-asc':'kd-desc')}>K/D {sort==='kd-asc'?'↑':'↓'}</button>
          <div className="segmented" role="group" aria-label="Match result">{['ALL', 'WIN', 'LOSS', 'UNKNOWN'].map(value => <button key={value} className={resultFilter === value ? 'active' : ''} aria-pressed={resultFilter === value} onClick={() => setResultFilter(value)}>{value === 'UNKNOWN' ? 'UNVERIFIED' : value}</button>)}</div></div></div>
        <div className="list-column-head"><span>RESULT</span><span>MATCH / MAP</span><span>ROUND OUTCOMES</span><span>SCORE</span><span>DATE</span><span /></div>
        {filtered.length ? filtered.map(match => <RecordedMatchRow key={match.matchId} match={match} data={overview.data!} identity={scope.identity} kd={kdByMatch.get(match.matchId)??null} onOpen={() => app.go(matchUrl(match.matchId))} />)
          : <Empty title="No matches found" sub="Adjust the filters, time range or tracking selection to see other engagements." />}
      </section>
      <p className="match-source-note">Showing {filtered.length}/{analysis?.matches.length ?? 0} matches for {scope.identity}. Summary and export follow the current filters. Unverified matches are excluded from match win rate. {analysis?.ambiguousMatches ? `${analysis.ambiguousMatches} matches excluded because selected players have conflicting or unknown team sides.` : ''}</p>
    </>}
    {id && report.loading && <Notice>Loading the complete match report…</Notice>}
    {id && report.error && <Notice error>{report.error} <button className="text-action" onClick={report.reload}>RETRY</button></Notice>}
    {id && playlistExcluded && <Notice>This match belongs to {playlistLabels[matchPlaylist(report.data!.match.matchType)]}. Select that playlist to view its stats.</Notice>}
    {id && !playlistExcluded && !excluded && report.data && view && hasSelection && <>{report.data.match.summaryScore&&<Notice>Final scoreboard entry: match totals and result are available. Round order, bombsites, operators and individual round stats were not recorded.</Notice>}
      {view.reason && <Notice>{view.reason} Choose a participating player or squad to resolve the match perspective.</Notice>}
      {isRound ? currentRound ? <RoundReport app={app} report={report.data} view={view} round={currentRound} identity={scope.identity} onPlayer={onPlayer} />
        : <Empty title="Round unavailable" sub="This round number is not present in the recorded match." />
        : <>
          <div className="match-detail-hero"><div className="match-detail-top"><span className="eyebrow">ENGAGEMENT REPORT / {id}</span><Result outcome={view.resolved?.outcome ?? 'UNKNOWN'} /></div>
            <div className="match-detail-main"><div><div className="match-map-label"><Icon name="map" size={15} />{report.data.match.matchType ?? 'MODE UNKNOWN'} · {report.data.match.gameMode ?? 'GAME MODE UNKNOWN'}</div>
              <h1>{mapLabel(report.data.match.mapName, report.data.match.mapId)}<span className="period">.</span></h1><div className="match-detail-sub">{formatPlayedAt(report.data.match.playedAt)} <i>•</i> {view.rounds.length} recorded rounds <i>•</i> {view.trackedRoundCount} tracked</div></div>
              <div className="match-big-score"><div><small>{scope.identity}</small><strong className="accent">{view.resolved ? view.resolved.wins : '—'}</strong></div><span>:</span><div><small>OPPONENT</small><strong>{view.resolved ? view.resolved.losses : '—'}</strong></div></div></div>
            <div className="match-detail-bottom"><div><span>ATTACK WIN RATE</span><strong>{rate(view.metrics.attackWins, view.metrics.attackRounds)}</strong></div><div><span>DEFENSE WIN RATE</span><strong>{rate(view.metrics.defenseWins, view.metrics.defenseRounds)}</strong></div>
              <div><span>TRACKED KILLS</span><strong>{stat(view.metrics.kills)}</strong></div><div><span>TRACKED K/D</span><strong>{view.metrics.kd ?? '—'}</strong></div></div></div>
          <div className="recorded-report-actions"><span>{sourceLabel(report.data.match)} · {report.data.match.isCompleteMatch === true ? 'COMPLETE RECORD' : 'PARTIAL RECORD'} · GAME {report.data.match.gameVersion ?? 'VERSION UNKNOWN'}</span><Btn icon="download" onClick={exportReport}>EXPORT REPORT</Btn></div>
          <div className="tabbar" role="group" aria-label="Match report section">{['scoreboard', 'rounds', 'timeline'].map(value => <button key={value} className={tab === value ? 'active' : ''} aria-pressed={tab === value} onClick={() => setTab(value)}>{value === 'scoreboard' ? 'PLAYER SCOREBOARD' : value === 'rounds' ? 'ROUND BREAKDOWN' : 'EVENT TIMELINE'}</button>)}</div>
          {tab === 'scoreboard' && <>
            <Scoreboard rows={view.selectedStats} title={scope.mode === 'team' ? `${scope.identity} scoreboard` : 'Tracked player scoreboard'} onPlayer={onPlayer} />
            <div className="two-grid"><section className="panel"><SectionTitle eyebrow="02 / ROUND RESULTS" title="Round-by-round" /><RoundChips rounds={view.rounds} onOpen={round => app.go(matchUrl(id, round))} />
              <div className="legend-row"><span><i className="small-square lime" /> WON</span><span><i className="small-square red" /> LOST</span><span><i className="small-square" /> UNKNOWN</span></div><p className="muted-note">Select a round to open its recorded breakdown.</p></section>
              <section className="panel"><SectionTitle eyebrow="03 / MATCH INTELLIGENCE" title="What the numbers say" /><div className="key-value"><span>TRACKED PARTICIPANTS</span><strong>{view.selectedStats.length}/{scope.chosen.length}</strong></div>
                <div className="key-value"><span>TRACKED ROUND WINS</span><strong>{view.metrics.roundWins}/{view.trackedRoundCount}</strong></div><div className="key-value"><span>HEADSHOT RATE</span><strong>{view.metrics.hs == null ? '—' : `${view.metrics.hs}%`}</strong></div><div className="key-value"><span>RESULT</span><Result outcome={view.resolved?.outcome ?? 'UNKNOWN'} /></div></section></div>
            {view.teammates.some(player => !player.selected) && <Scoreboard rows={view.teammates.filter(player => !player.selected)} title="Other teammates" onPlayer={onPlayer} />}
            {view.opponents.length > 0 && <Scoreboard rows={view.opponents} title="Opponent scoreboard" onPlayer={onPlayer} />}
            {view.unknownPlayers.length > 0 && <Scoreboard rows={view.unknownPlayers} title="Players with unresolved sides" onPlayer={onPlayer} />}
          </>}
          {tab === 'rounds' && <section className="panel"><SectionTitle eyebrow="01 / ROUND EXPLORER" title="Individual round reports" /><div className="round-report-grid">{view.rounds.map(round => <button className="round-report-card" key={round.roundId} onClick={() => app.go(matchUrl(id, round.roundNumber))}>
            <div className="round-report-top"><span>ROUND {String(round.roundNumber).padStart(2, '0')}</span><Result outcome={round.outcome} /></div><strong>{sideLabel(round.side)}</strong><small>{round.site ?? 'Site unrecorded'}</small>
            <small>{round.selectedPresent} TRACKED PLAYERS PRESENT</small><div className="round-report-foot"><span>{round.events.length} RECORDED EVENTS</span><Icon name="arrow" size={16} /></div></button>)}</div></section>}
          {tab === 'timeline' && <section className="panel"><SectionTitle eyebrow="01 / EVENT STREAM" title="Full-match timeline" right={<Pill tone="quiet">{report.data.events.length} EVENTS</Pill>} />
            <div className="list-filters recorded-timeline-filters"><select aria-label="Timeline round" value={eventRound} onChange={event => setEventRound(event.target.value)}><option value="ALL">ALL ROUNDS</option>{view.rounds.map(round => <option key={round.roundId} value={round.roundId}>ROUND {round.roundNumber}</option>)}</select>
              <div className="filter-search"><Icon name="search" size={15} /><input aria-label="Filter events" placeholder="Player or event type" value={eventQuery} onChange={event => setEventQuery(event.target.value)} /></div></div>
            <EventFeed report={report.data} view={view} events={report.data.events.filter(event => (eventRound === 'ALL' || event.roundId === eventRound) && `${event.actorUsername ?? ''} ${event.targetUsername ?? ''} ${event.eventType ?? ''}`.toLowerCase().includes(eventQuery.trim().toLowerCase()))} />
            <p className="muted-note">Events follow replay sequence. Times show the recorded time remaining; missing actors and times stay unrecorded.</p></section>}
        </>}
      <p className="match-source-note">Scores describe the selected side's recorded rounds. Tracked player totals include only participating selected IDs. Missing outcomes remain unverified. Opponent team names and spatial positions are unavailable in these replays.</p>
    </>}
  </div>;
}

function RecordedMatchRow({ match, data, identity,kd, onOpen }: { match: ResolvedMatch; data: OverviewV3; identity: string; kd:string|null; onOpen: () => void }) {
  const rounds = data.rounds.filter(round => round.matchId === match.matchId && round.teamSlot === match.slot).sort((a, b) => a.roundNumber - b.roundNumber);
  return <button className="match-row" onClick={onOpen} aria-label={`Open ${mapLabel(match.mapName, match.mapId)}, ${shortDate(match.playedAt)}, ${match.outcome}, ${match.wins} to ${match.losses}`}>
    <span className={`match-status ${match.outcome.toLowerCase()}`}><Icon name={match.outcome === 'WIN' ? 'check' : match.outcome === 'LOSS' ? 'close' : 'info'} size={17} /></span>
    <span className="match-main"><strong>{mapLabel(match.mapName, match.mapId)}</strong><span>{match.matchType ?? 'Mode unknown'} <i>•</i> {match.gameMode ?? 'Unknown'} <i>•</i> #{match.matchId.slice(0, 8)}</span><span>{sourceLabel(match)} · K/D {kd??'—'} · {identity} · {match.present} TRACKED {match.present === 1 ? 'PLAYER' : 'PLAYERS'}{match.outcome === 'UNKNOWN' ? ' · UNVERIFIED RESULT' : ''}</span></span>
    <span className="match-rounds-mini"><span>{rounds.map(round => <i key={round.roundId} className={round.won === true ? 'win' : round.won === false ? 'loss' : 'unknown'} title={`Round ${round.roundNumber}: ${round.won === true ? 'won' : round.won === false ? 'lost' : 'unknown'}`} />)}</span></span>
    <span className="match-score"><span className={match.outcome === 'WIN' ? 'accent' : ''}>{match.wins}</span><span>:</span><span>{match.losses}</span></span><span className="match-date">{shortDate(match.playedAt)}</span><Icon name="chevron" size={14} />
  </button>;
}

function RoundReport({ app, report, view, round, identity, onPlayer }: { app: any; report: MatchReport; view: ReportView; round: Round; identity: string; onPlayer: (id: string) => void }) {
  const index = view.rounds.findIndex(value => value.roundId === round.roundId);
  const previous = view.rounds[index - 1]; const next = view.rounds[index + 1];
  const allPlayers = report.appearances.filter(player => player.roundId === round.roundId);
  return <>
    <div className="round-detail-head"><div><div className="eyebrow">{report.match.matchId.slice(0, 8)} / {mapLabel(report.match.mapName, report.match.mapId)} / RECORDED ROUND</div><h1>Round {String(round.roundNumber).padStart(2, '0')}<span className="period">.</span></h1>
      <div className="round-meta"><Result outcome={round.outcome} /><span>{sideLabel(round.side)}</span><span>{round.site ?? 'SITE UNRECORDED'}</span><span>{round.team?.winCondition ?? 'WIN CONDITION UNRECORDED'}</span></div></div>
      <div className="round-nav"><button aria-label="Previous recorded round" disabled={!previous} onClick={() => app.go(matchUrl(report.match.matchId, previous.roundNumber))}><Icon name="arrowleft" /></button><strong>{stat(round.scoreAfter)} — {stat(round.opponentScoreAfter)}</strong><button aria-label="Next recorded round" disabled={!next} onClick={() => app.go(matchUrl(report.match.matchId, next.roundNumber))}><Icon name="arrow" /></button></div></div>
    <div className="round-layout"><section className="panel"><SectionTitle eyebrow="01 / ROUND DEPLOYMENT" title="Recorded lineup" right={<Pill tone="quiet">{allPlayers.length} PLAYERS</Pill>} />
      <div className="recorded-deployment"><div className="deployment-site"><Icon name="target" size={29} /><span>OBJECTIVE SITE</span><strong>{round.site ?? 'Not recorded'}</strong><small>{round.selectedPresent} tracked players present · {identity}</small></div>
        {[0, 1].map(slot => { const team = report.teams.find(value => value.roundId === round.roundId && value.teamSlot === slot); const players = allPlayers.filter(player => player.teamIndex === slot); return <div className="deployment-team" key={slot}>
          <span className="eyebrow">{team?.side?.toUpperCase() ?? `TEAM SLOT ${slot}`} · {view.resolved ? slot === view.resolved.slot ? 'SELECTED SIDE' : 'OPPONENT SIDE' : 'UNRESOLVED PERSPECTIVE'}</span>
          <div className="deployment-operators">{players.map(player => <button key={player.playerId} onClick={() => onPlayer(player.playerId)} title={`${player.username} · ${player.operatorName ?? 'operator unrecorded'}`}><OperatorIcon name={player.operatorName ?? '?'} color={slot === view.resolved?.slot ? '#ff9061' : '#85a6e6'} /><strong>{player.username}</strong><small>{player.operatorName ?? 'Unknown operator'}</small></button>)}</div></div>; })}
      </div><p className="muted-note">Replay records provide operator lineups and the site. Player movement and map coordinates are unavailable.</p></section>
      <section className="panel"><SectionTitle eyebrow="02 / TEMPORAL INTELLIGENCE" title="Round event feed" right={<Pill tone="quiet">{round.events.length} EVENTS</Pill>} /><EventFeed report={report} view={view} events={round.events} /></section></div>
    <Scoreboard rows={round.selectedStats} title="Tracked round scoreboard" onPlayer={onPlayer} round />
    {round.teammates.some(player => !player.selected) && <Scoreboard rows={round.teammates.filter(player => !player.selected)} title="Other teammates" onPlayer={onPlayer} round />}
    {round.opponents.length > 0 && <Scoreboard rows={round.opponents} title="Opponent round scoreboard" onPlayer={onPlayer} round />}
    {round.unknownPlayers.length > 0 && <Scoreboard rows={round.unknownPlayers} title="Players with unresolved sides" onPlayer={onPlayer} round />}
  </>;
}
