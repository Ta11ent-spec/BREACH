import { useMemo, useState } from 'react';
import {ManualDataToggle,useManualInclusion} from '../../components/ManualDataToggle';
import { Btn, Empty, Icon, Monogram, OperatorIcon, Pill, Progress, SectionTitle } from '../../components';
import { useRecordedOverview } from '../../data/useRecordedOverview';
import { analyzePlayers } from '../../data/playerAnalytics';
import { comparePlayers, compareRate, ratioValue } from '../../data/reportAnalytics';
import { loadPreference } from '../../data/localSquads';
import { saveFile } from '../../lib/download';

const number = (n: number | null | undefined) => n == null ? '—' : n.toLocaleString();
const percent = (n: number | null) => n == null ? '—' : `${n}%`;
const avatar = (name: string, color: string) => ({ initials: name.replace(/[^\p{L}\p{N}]/gu, '').slice(0, 2).toUpperCase() || '?', color });
const shades = ['#c9fa62', '#85a6e6'];
export function RealComparePage({ app }: { app: any }) {
  const [includeManual,setIncludeManual]=useManualInclusion();
  const resource = useRecordedOverview(includeManual);
  const [commonOnly, setCommonOnly] = useState(false);
  const period: '7D' | '30D' | 'ALL' = app.state.period ?? 'ALL';
  const profiles = useMemo(() => resource.data ? analyzePlayers(resource.data, period).sort((a, b) => b.rounds - a.rounds || a.username.localeCompare(b.username)) : [], [resource.data, period]);
  const storedPlayer = loadPreference('player');
  const aId = profiles.some(p => p.playerId === app.state.compareA) ? app.state.compareA : profiles.find(p => p.playerId === storedPlayer)?.playerId ?? profiles[0]?.playerId ?? '';
  const bId = profiles.some(p => p.playerId === app.state.compareB) ? app.state.compareB : profiles.find(p => p.playerId !== aId)?.playerId ?? '';
  const comparison = useMemo(() => resource.data ? comparePlayers(resource.data, aId, bId, period, commonOnly) : null, [resource.data, aId, bId, period, commonOnly]);
  const heading = <>{app.headline('PLAYER SCIENCE / RECORDED HEAD-TO-HEAD', 'Player comparison.', 'Compare player histories with visible samples and the same reporting range.')}<ManualDataToggle included={includeManual} onChange={setIncludeManual}/></>;
  if (!resource.data || resource.error) return <div className="page real-compare">{heading}<section className="panel real-notice" role="status"><h3>{resource.error ? 'Comparison data unavailable' : 'Loading player comparison'}</h3><p>{resource.error ?? 'Reading your recorded player histories…'}</p>{resource.error && <Btn onClick={resource.reload}>RETRY</Btn>}</section></div>;
  if (profiles.length < 2) return <div className="page real-compare">{heading}<section className="panel"><Empty title="Two players are needed" sub="Choose a wider date range or include your submitted manual matches to compare more players."/></section></div>;
  const a = comparison?.a ?? profiles.find(p => p.playerId === aId)!;
  const b = comparison?.b ?? profiles.find(p => p.playerId === bId)!;
  const metrics = [
    { label: 'K/D RATIO', a: ratioValue(a.kd), b: ratioValue(b.kd), aText: a.kd ?? '—', bText: b.kd ?? '—', ranked: true },
    { label: 'VERIFIED MATCH WIN RATE', a: a.winRate, b: b.winRate, aText: percent(a.winRate), bText: percent(b.winRate), ranked: true },
    { label: 'HEADSHOT RATE', a: a.hs, b: b.hs, aText: percent(a.hs), bText: percent(b.hs), ranked: true },
    { label: 'ROUND SURVIVAL', a: a.survival, b: b.survival, aText: percent(a.survival), bText: percent(b.survival), ranked: true },
    { label: 'KILLS PER PLAYED ROUND', a: a.kills == null || !a.rounds ? null : a.kills / a.rounds, b: b.kills == null || !b.rounds ? null : b.kills / b.rounds, aText: a.kills == null || !a.rounds ? '—' : (a.kills / a.rounds).toFixed(2), bText: b.kills == null || !b.rounds ? '—' : (b.kills / b.rounds).toFixed(2), ranked: true },
    { label: 'TOTAL KILLS · VOLUME', a: a.kills, b: b.kills, aText: number(a.kills), bText: number(b.kills), ranked: false },
    { label: 'TOTAL ASSISTS · VOLUME', a: a.assists, b: b.assists, aText: number(a.assists), bText: number(b.assists), ranked: false },
    { label: 'PLAYED ROUNDS · SAMPLE', a: a.rounds, b: b.rounds, aText: number(a.rounds), bText: number(b.rounds), ranked: false },
  ];
  return <div className="page real-compare">{heading}<div className="recorded-report-toolbar"><div className="segmented" aria-label="Comparison match scope"><button aria-pressed={!commonOnly} className={!commonOnly ? 'active' : ''} onClick={() => setCommonOnly(false)}>ALL MATCHES IN RANGE</button><button aria-pressed={commonOnly} className={commonOnly ? 'active' : ''} onClick={() => setCommonOnly(true)}>SHARED MATCHES ONLY</button></div><div className="period-switch" aria-label="Comparison date range">{(['7D', '30D', 'ALL'] as const).map(p => <button key={p} aria-pressed={period === p} className={period === p ? 'active' : ''} onClick={() => app.setState({ period: p })}>{p}</button>)}</div></div>
    <div className="compare-selects">{[a, b].map((p, index) => <div className={`compare-player ${index ? 'right' : ''}`} key={index}><Monogram player={avatar(p.username, shades[index])} size="lg"/><div><small>PLAYER {index ? '02' : '01'}</small><select aria-label={`Comparison player ${index ? 'two' : 'one'}`} value={index ? bId : aId} onChange={e => app.setState(index ? { compareB: e.target.value } : { compareA: e.target.value })}>{profiles.map(option => <option key={option.playerId} value={option.playerId} disabled={option.playerId === (index ? aId : bId)}>{option.username} · {option.playerId.slice(0, 8)}</option>)}</select><span>{p.matchCount} MATCHES · {p.rounds} ROUNDS</span></div></div>)}<button className="versus compare-swap" aria-label="Swap comparison players" onClick={() => app.setState({ compareA: bId, compareB: aId })}>VS<small>SWAP</small></button></div>
    {!comparison ? <section className="panel"><Empty title="Choose two different players" sub="A player cannot be compared against themselves."/></section> : commonOnly && !comparison.sharedMatches ? <section className="panel"><Empty title="No shared matches in this range" sub="Choose ALL MATCHES IN RANGE or widen the date range."/></section> : <>
      <div className="comparison-sample-note"><Icon name="info" size={16}/><span>{comparison.sharedMatches} shared matches in this date range. {commonOnly ? 'Both profiles use those matches; their played rounds can still differ.' : 'Each profile uses its own match history in the same date range.'} Same matches may contain teammates or opponents.</span></div>
      <section className="panel"><SectionTitle eyebrow="01 / METRIC-BY-METRIC" title="Comparative performance" right={<Btn small icon="download" onClick={() => saveFile('breach-player-comparison.json', JSON.stringify({ generatedAt: new Date().toISOString(), includesPrivateManualMatches:includeManual, ...comparison }, null, 2), 'application/json')}>EXPORT COMPARISON</Btn>}/><div className="compare-metrics">{metrics.map(metric => {
        const winner = metric.ranked ? compareRate(metric.a, metric.b) : 'equal';
        const max = Math.max(metric.a ?? 0, metric.b ?? 0, 1);
        const width = (n: number | null) => n == null ? 0 : n === Infinity ? 100 : max === Infinity ? 0 : 100 * n / max;
        return <div className="compare-metric" key={metric.label}><div className={`compare-val ${winner === 'a' ? 'winner' : ''}`}>{metric.aText}</div><div className="compare-middle"><span>{metric.label}</span><div className="compare-bars"><div className="compare-left"><i style={{ width: `${width(metric.a)}%`, background: shades[0] }}/></div><div className="compare-right"><i style={{ width: `${width(metric.b)}%`, background: shades[1] }}/></div></div><small>{winner === 'unavailable' ? 'INCOMPLETE OR UNDEFINED METRIC' : metric.ranked ? winner === 'equal' ? 'EQUAL RECORDED RATE' : 'HIGHER RECORDED RATE' : 'DESCRIPTIVE SAMPLE TOTAL'}</small></div><div className={`compare-val ${winner === 'b' ? 'winner' : ''}`}>{metric.bText}</div></div>;
      })}</div></section>
      <div className="two-grid comparison-profiles">{[a, b].map((p, i) => <section className="panel" key={p.playerId}><SectionTitle eyebrow={`02 / PLAYER ${i + 1} DOSSIER`} title={p.username}/><div className="compare-profile-small"><Monogram player={avatar(p.username, shades[i])} size="lg"/><div><strong>{p.wins}–{p.losses}</strong><span>VERIFIED MATCH RECORD</span></div><div><strong>{p.unverified}</strong><span>UNVERIFIED RESULTS</span></div></div><h4>Most played operators</h4><div className="comparison-operators">{p.operators.slice(0, 5).map(o => <div key={o.name}><OperatorIcon name={o.name} color={shades[i]}/><span><strong>{o.name}</strong><small>{o.rounds} PICKS · {o.kd ?? '—'} K/D</small></span><Progress value={p.rounds ? 100 * o.rounds / p.rounds : 0} thin color={shades[i]}/></div>)}{!p.operators.length && <p className="operator-data-note">No operator appearances in this sample.</p>}</div><Btn icon="arrow" onClick={() => app.go('/players/' + encodeURIComponent(p.playerId))}>FULL PLAYER DOSSIER</Btn></section>)}</div>
    </>}
    <p className="recorded-report-footnote">Higher rates are highlighted only when both metrics are available. Totals describe volume rather than player quality. Different roles, opponents and sample sizes affect the comparison. Missing values remain unavailable (—).</p>
  </div>;
}
