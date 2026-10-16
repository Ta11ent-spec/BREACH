import copy,json,sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from impact import derive

def round_data(events,winner=0):
    names=[f'p{i}' for i in range(10)]
    died={e.get('target') if e['type']=='Kill' else e['username'] for e in events if e['type'] in ('Kill','Death')}
    return {'matchType':{'name':'Ranked'},'gamemode':{'name':'Bomb'},'players':[{'username':n,'teamIndex':i//5} for i,n in enumerate(names)],'teams':[{'won':i==winner} for i in (0,1)],'stats':[{'username':n,'kills':sum(e['type']=='Kill' and e['username']==n for e in events),'died':n in died} for n in names],'matchFeedback':events}
def kill(a,b):return {'type':'Kill','username':a,'target':b}
class ImpactTests(unittest.TestCase):
    def test_friendly_opening_is_separate_from_enemy_duel(self):
        r=round_data([kill('p0','p1'),kill('p5','p2')]);v,reason=derive(r)
        self.assertIsNone(reason);self.assertEqual(v['p0']['openingTeamkills'],1);self.assertEqual(v['p1']['openingTeamkillDeaths'],1)
        self.assertEqual(v['p0']['openingKills'],0);self.assertEqual(v['p5']['openingKills'],1);self.assertEqual(v['p2']['openingDeaths'],1)
    def test_standalone_opening_death_not_lost_or_enemy_credit(self):
        v,reason=derive(round_data([{'type':'Death','username':'p0'},kill('p1','p5')]))
        self.assertIsNone(reason);self.assertEqual(v['p0']['openingOtherDeaths'],1);self.assertEqual(v['p0']['openingDeaths'],0);self.assertEqual(v['p1']['openingKills'],1)
    def test_real_anonymized_posthumous_regressions(self):
        for f in json.loads((Path(__file__).parent/'fixtures/impact-regressions.json').read_text()):
            original=copy.deepcopy(f['round']);v,reason=derive(original);self.assertIsNone(reason)
            self.assertEqual({n:s['clutches'] for n,s in v.items() if any(s['clutches'])},f['expected']);self.assertEqual(original,f['round'])
    def test_every_clutch_size_and_objective_win(self):
        for size in range(1,6):
            events=[kill('p0',f'p{i}') for i in range(5,10-size)]+[kill('p9',f'p{i}') for i in range(1,5)]
            v,reason=derive(round_data(events));self.assertIsNone(reason);self.assertEqual(v['p0']['clutches'][size-1],1)
            v,_=derive(round_data(events,winner=1));self.assertEqual(sum(v['p0']['clutches']),0)
    def test_objective_win_after_last_winner_dies(self):
        events=[kill('p9',f'p{i}') for i in range(1,5)]+[kill('p9','p0')]
        v,reason=derive(round_data(events));self.assertIsNone(reason);self.assertEqual(v['p0']['clutches'],[0,0,0,0,1])
    def test_duplicate_unknown_disconnect_and_stat_mismatch_are_unknown(self):
        variants=[round_data([kill('p0','p5'),kill('p0','p5')]),round_data([kill('unknown','p5')]),round_data([{'type':'PlayerLeave','username':'p0'}])]
        r=round_data([kill('p0','p5')]);r['stats'][0]['kills']=2;variants.append(r)
        r=round_data([]);r['players'].pop();variants.append(r)
        for r in variants:
            v,reason=derive(r);self.assertIsNotNone(reason);self.assertTrue(all(s['openingKills'] is None and s['clutches']==[None]*5 for s in v.values()))
    def test_no_kill_round_is_measured_zero(self):
        v,reason=derive(round_data([]));self.assertIsNone(reason);self.assertTrue(all(s['openingKills']==0 and s['clutches']==[0]*5 for s in v.values()))
    def test_unverified_playlists_remain_unknown(self):
        for mode in ('Standard','Unranked','Casual','QuickMatch','MatchType(7)'):
            r=round_data([]);r['matchType']['name']=mode;v,reason=derive(r);self.assertIsNotNone(reason);self.assertIsNone(v['p0']['openingKills'])
if __name__=='__main__':unittest.main()
