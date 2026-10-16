import {usePlaylist} from '../../data/usePlaylist';
import {ManualDataToggle,useManualInclusion} from '../../components/ManualDataToggle';
import {loadOverview} from '../../data/manualOverview';
import {sourceLabel} from '../../data/analyticsSources';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { Btn, Empty, Icon, OperatorIcon, Pill, Progress, SectionTitle, StatCard } from '../../components';
import { TrackingScope } from '../../components/TrackingScope';
import { fetchApi, formatPlayedAt, mapLabel } from '../../data/realApi';
import { useTrackingScope } from '../../data/useTrackingScope';
import type { OverviewV3 } from '../../data/overviewAnalytics';
import { analyzeOperators, sortOperators } from '../../data/operatorAnalytics';
import type { OperatorRecord, OperatorSide, OperatorSort } from '../../data/operatorAnalytics';

const emptyPlayers: OverviewV3['players'] = [];
const emptyMatches: OverviewV3['matches'] = [];
const stat = (value: number | string | null | undefined) => value == null ? '—' : typeof value === 'number' ? value.toLocaleString() : value;
const rate = (value: number | null) => value == null ? '—' : `${value}%`;
const sideName = (side: OperatorSide) => side === 'ATK' ? 'ATTACK' : side === 'DEF' ? 'DEFENSE' : 'UNKNOWN SIDE';

export function RealOperatorsPage({ app }: { app: any }) {
  const [playlist]=usePlaylist();
  const [includeManual,setIncludeManual]=useManualInclusion();
  const [data, setData] = useState<OverviewV3 | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [search, setSearch] = useState('');
  const [side, setSide] = useState<'ALL' | OperatorSide>('ALL');
  const [sort, setSort] = useState<OperatorSort>('pick');
  const [minimum, setMinimum] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [historyLimit, setHistoryLimit] = useState(10);
  const scope = useTrackingScope(data?.players ?? emptyPlayers, data?.matches ?? emptyMatches);
  const period: '7D' | '30D' | 'ALL' = app.state.period ?? 'ALL';
  useEffect(() => {
    const controller = new AbortController();
    setData(null); setError(null);
    loadOverview(includeManual, controller.signal,playlist).then(next => { if (!controller.signal.aborted) setData(next); })
      .catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Unable to read recorded operator data.'); });
    return () => controller.abort();
  }, [revision,includeManual,playlist]);
  useEffect(() => { setExpanded(null); setHistoryLimit(10); }, [scope.mode, scope.selectedPlayer, scope.selectedSquad, period, search, side, minimum]);
  const analysis = useMemo(() => data ? analyzeOperators(data, { mode: scope.mode, members: scope.chosen }, period) : { operators: [], sideSamples: { ATK: 0, DEF: 0, UNKNOWN: 0 }, ambiguousMatches: 0 }, [data, scope.mode, scope.chosen, period]);
  const rows = sortOperators(analysis.operators.filter(o => (side === 'ALL' || o.side === side) && o.picks >= minimum && o.name.toLowerCase().includes(search.trim().toLowerCase())), sort);
  const named = analysis.operators.filter(o => o.name !== 'Unknown operator');
  const attacker = sortOperators(named.filter(o => o.side === 'ATK'), 'pick')[0];
  const defender = sortOperators(named.filter(o => o.side === 'DEF'), 'pick')[0];
  const highest = sortOperators(named.filter(o => o.totals.kd != null && o.totals.kd !== '—'), 'kd')[0];
  const pickTitle = (o: OperatorRecord | undefined) => o ? `${o.picks} PICKS · ${rate(o.pickShare)} SHARE` : 'NO RECORDED PICKS';
  if (error || !data) return <div className="page real-operators"><TrackingScope hideReload scope={scope} players={data?.players??emptyPlayers} advancedSettings={<ManualDataToggle squadScope={scope} included={includeManual} onChange={setIncludeManual} period={period} onPeriodChange={period=>app.setState({period})}/>}/>{app.headline('LOADOUT ANALYSIS / RECORDED REPLAYS', 'Operator intel.', 'Operator performance from your imported matches.')}<section className="panel real-notice" role="status"><h3>{error ? 'Operator data unavailable' : 'Loading operator intelligence'}</h3><p>{error ?? 'Reading your imported replay records…'}</p>{error && <Btn onClick={() => setRevision(v => v + 1)}>RETRY</Btn>}</section></div>;
  return <div className="page real-operators"><TrackingScope hideReload scope={scope} players={data?.players??emptyPlayers} advancedSettings={<ManualDataToggle squadScope={scope} included={includeManual} onChange={setIncludeManual} period={period} onPeriodChange={period=>app.setState({period})}/>}/>{app.headline('LOADOUT ANALYSIS / RECORDED REPLAYS', 'Operator intel.', 'Understand the picks and operators behind your recorded rounds.', <Pill tone="outline">{new Set(named.map(o => o.name)).size} KNOWN OPERATORS</Pill>)}
    <div className="operator-period-row"><span>TRACKED LOADOUT HISTORY</span></div>
    <div className="operator-scope-note"><span>{scope.identity} · {period === 'ALL' ? 'All imported dates' : `Last ${period === '7D' ? '7' : '30'} days`}</span><span>{analysis.ambiguousMatches} matches excluded for unresolved team membership</span></div>
    <div className="stats-grid three"><StatCard label="MOST USED ATTACKER" value={attacker?.name ?? '—'} icon="crosshair" delta={pickTitle(attacker)} sub={attacker ? `${rate(attacker.winRate)} round win rate` : 'within selected replay data'}/><StatCard label="MOST USED DEFENDER" value={defender?.name ?? '—'} icon="shield" delta={pickTitle(defender)} sub={defender ? `${rate(defender.winRate)} round win rate` : 'within selected replay data'}/><StatCard label="HIGHEST RECORDED K/D" value={highest?.name ?? '—'} icon="bolt" delta={highest ? `${stat(highest.totals.kd)} K/D · ${highest.picks} PICKS` : 'NO COMPLETE MEASUREMENTS'} sub={highest ? `${sideName(highest.side).toLowerCase()} · sample sizes matter` : 'within selected replay data'}/></div>
    <section className="panel recorded-operator-panel"><div className="list-head"><div><div className="eyebrow">01 / RECORDED LOADOUTS</div><h3>Operator performance <span className="title-count">{rows.length}</span></h3></div><div className="list-filters"><div className="filter-search"><Icon name="search" size={15}/><input aria-label="Search recorded operators" placeholder="Operator name" value={search} onChange={e => setSearch(e.target.value)}/></div><div className="segmented" aria-label="Operator side filter">{(['ALL', 'ATK', 'DEF', 'UNKNOWN'] as const).map(s => <button key={s} aria-pressed={side === s} className={side === s ? 'active' : ''} onClick={() => setSide(s)}>{s === 'ALL' ? 'ALL' : sideName(s)}</button>)}</div><select aria-label="Sort operators" value={sort} onChange={e => setSort(e.target.value as OperatorSort)}><option value="pick">MOST PICKS</option><option value="win">ROUND WIN RATE</option><option value="kd">K/D</option><option value="kills">KILLS</option><option value="name">NAME A–Z</option></select><select aria-label="Minimum operator picks" value={minimum} onChange={e => setMinimum(Number(e.target.value))}><option value={1}>1+ PICKS</option><option value={5}>5+ PICKS</option><option value={10}>10+ PICKS</option></select></div></div>
      <div className="operator-table-head"><span>OPERATOR / SAMPLE</span><span>SIDE</span><span>PICK SHARE*</span><span>ROUND WIN RATE</span><span>K/D</span></div><div className="operator-list">{rows.map(o => <Fragment key={o.key}><button className={`operator-list-row recorded-operator-row ${expanded === o.key ? 'active' : ''}`} aria-expanded={expanded === o.key} aria-controls={`operator-detail-${encodeURIComponent(o.key)}`} aria-label={`${expanded === o.key ? 'Collapse' : 'Inspect'} ${o.name}, ${sideName(o.side)}`} onClick={() => { setExpanded(expanded === o.key ? null : o.key); setHistoryLimit(10); }}><div className="op-ident"><OperatorIcon name={o.name} color={o.side === 'ATK' ? '#fa9062' : o.side === 'DEF' ? '#85a6e6' : '#9aabb1'}/><div><strong>{o.name}</strong><small>{o.picks} PICKS · {o.rounds} DISTINCT ROUNDS · {o.matches.length} MATCHES</small></div></div><Pill tone={o.side === 'ATK' ? 'info' : o.side === 'DEF' ? 'warning' : 'quiet'}>{sideName(o.side)}</Pill><div className="op-stat-bar"><strong>{rate(o.pickShare)}</strong>{o.pickShare != null && <Progress thin value={o.pickShare}/>}<small>{o.picks}/{analysis.sideSamples[o.side]} player appearances</small></div><div className="op-stat-bar"><strong>{rate(o.winRate)}</strong>{o.winRate != null && <Progress thin value={o.winRate} color="var(--blue)"/>}<small>{o.wins}/{o.wins + o.losses} known rounds won</small></div><strong className="mono">{stat(o.totals.kd)}</strong></button>
        {expanded === o.key && <div className="recorded-operator-detail" id={`operator-detail-${encodeURIComponent(o.key)}`}><SectionTitle eyebrow="02 / OPERATOR DOSSIER" title={`${o.name} · ${sideName(o.side).toLowerCase()}`} right={<Pill tone="quiet">{o.unknown} UNKNOWN ROUND RESULTS</Pill>}/><div className="operator-detail-metrics">{[['KILLS', stat(o.totals.kills)], ['DEATHS', stat(o.totals.deaths)], ['ASSISTS', stat(o.totals.assists)], ['HEADSHOT RATE', rate(o.totals.hs)]].map(([label, value]) => <div key={label}><small>{label}</small><strong>{value}</strong></div>)}</div><div className="two-grid"><section><SectionTitle eyebrow="SELECTED PARTICIPANTS" title="Player contributions"/><div className="real-player-table"><table className="score-table"><thead><tr><th>PLAYER</th><th>PICKS</th><th>K</th><th>D</th><th>A</th><th>K/D</th></tr></thead><tbody>{o.players.map(p => <tr key={p.playerId}><td><button className="operator-player-link" onClick={() => app.go('/players/' + encodeURIComponent(p.playerId))}>{p.username} <Icon name="arrow" size={13}/></button></td><td>{p.rounds}</td><td>{stat(p.kills)}</td><td>{stat(p.deaths)}</td><td>{stat(p.assists)}</td><td>{stat(p.kd)}</td></tr>)}</tbody></table></div></section><section><SectionTitle eyebrow="RECORDED APPEARANCES" title="Match history" right={<Pill tone="quiet">{Math.min(historyLimit, o.matches.length)} / {o.matches.length}</Pill>}/><div className="profile-matches">{o.matches.slice(0, historyLimit).map(m => <button key={m.matchId} onClick={() => app.go('/matches/' + encodeURIComponent(m.matchId))}><span className={`result ${m.outcome === 'WIN' ? 'win' : m.outcome === 'LOSS' ? 'loss' : 'unknown'}`}>{m.outcome === 'UNKNOWN' ? 'UNVERIFIED' : m.outcome}</span><div><strong>{mapLabel(m.mapName, m.mapId)}</strong><small>{sourceLabel(m)} · {formatPlayedAt(m.playedAt)} · #{m.matchId.slice(0, 8)}</small></div><Icon name="chevron" size={15}/></button>)}</div>{historyLimit < o.matches.length && <Btn small onClick={() => setHistoryLimit(v => v + 10)}>LOAD MORE MATCHES</Btn>}</section></div></div>}
      </Fragment>)}</div>{!rows.length && <Empty title="No recorded operators for these filters" sub="Try another player or squad, widen the date range, or reduce the minimum picks."/>}
    </section>
    <div className="small-callout operator-calculation-note"><Icon name="info" size={16}/><span>* Pick share is this operator's picks divided by all selected player appearances on the same recorded side. Round win rate counts each participating squad round once and excludes unknown results. Missing measurements stay unavailable (—). Select a row for its stats and history.</span></div>
    <p className="operator-data-note">These figures describe the selected replay sample. They do not include competitive pick/ban rates, utility efficiency or assumed player roles. Operator sides come from recorded round teams; unknown operators and sides remain explicit.</p>
  </div>;
}
