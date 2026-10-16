"""Versioned replay impact metrics. Raw events stay intact; uncertainty stays null.
Opening duel = first opponent kill/victim, irrespective of earlier friendly fire.
Opening incidents = first elimination only, kept separately from duel totals.
Clutch X = opponents alive on first becoming sole teammate; winning is required.
"""
FIELDS = ('openingKills', 'openingDeaths', 'openingTeamkills', 'openingTeamkillDeaths', 'openingOtherDeaths')
def empty():
    return {'version': 1, **{k: None for k in FIELDS}, 'clutches': [None]*5}
def derive(r):
    players=r.get('players', []); names=[p.get('username') for p in players]
    result={n:empty() for n in names if n}
    def unknown(reason): return result, reason
    if len(players)!=10 or len(set(names))!=10 or not all(names): return unknown('Incomplete or ambiguous roster')
    teams={p['username']:p.get('teamIndex') for p in players}
    if any(type(t)!=int for t in teams.values()) or sorted(teams.values(),key=str)!=[0]*5+[1]*5:return unknown('Unresolved teams')
    stats={s.get('username'):s for s in r.get('stats',[])}
    if len(r.get('stats',[]))!=10 or len(stats)!=10 or set(stats)!=set(names):return unknown('Incomplete statistics')
    outcomes=[t.get('won') for t in r.get('teams',[])]
    if len(outcomes)!=2 or any(type(v)!=bool for v in outcomes) or sum(outcomes)!=1:return unknown('Unresolved winner')
    # Only the verified Ranked Bomb extraction is enabled initially. Other playlists
    # keep normal uploads and raw events, but cannot silently acquire unverified zeros.
    if (r.get('matchType') or {}).get('name')!='Ranked' or (r.get('gamemode') or {}).get('name')!='Bomb':return unknown('Playlist not yet verified for impact metrics')
    values={n:{'version':1,**{k:0 for k in FIELDS},'clutches':[0]*5} for n in names}
    alive=set(names); deaths=set(); kills={n:0 for n in names}; candidates={}; first=False; duel=False
    for e in r.get('matchFeedback',[]):
        kind=e.get('type');kind=kind.get('name') if isinstance(kind,dict) else kind
        if kind in ('PlayerLeave','PlayerJoin'):return unknown('Roster changed during round')
        if kind not in ('Kill','Death'):continue
        actor=e.get('username');victim=e.get('target') if kind=='Kill' else actor
        if victim not in alive or actor not in teams:return unknown('Duplicate death or unresolved identity')
        if kind=='Kill' and actor==victim:return unknown('Ambiguous self kill')
        if kind=='Kill':
            kills[actor]+=1
            friendly=teams[actor]==teams[victim]
            if not friendly and not duel:
                values[actor]['openingKills']=1;values[victim]['openingDeaths']=1;duel=True
            if friendly and not first:
                values[actor]['openingTeamkills']=1;values[victim]['openingTeamkillDeaths']=1
        elif not first:values[victim]['openingOtherDeaths']=1
        first=True;alive.remove(victim);deaths.add(victim)
        # A dead actor can legitimately score a delayed gadget kill. Do not remove
        # them twice or shrink X after the last-standing situation begins.
        for team in (0,1):
            own=[n for n in alive if teams[n]==team];other=[n for n in alive if teams[n]!=team]
            if len(own)==1 and other and own[0] not in candidates:candidates[own[0]]=len(other)
    for n in names:
        if type(stats[n].get('died'))!=bool or stats[n]['died']!=(n in deaths) or type(stats[n].get('kills'))!=int or stats[n]['kills']!=kills[n]:return unknown('Event and scoreboard disagreement')
    winner=outcomes.index(True)
    for n,x in candidates.items():
        if teams[n]==winner:values[n]['clutches'][x-1]=1
    return values,None
