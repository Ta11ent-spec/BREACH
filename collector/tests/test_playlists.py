import copy
import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from adapter import completion
from test_collector import source,envelope

def rounds(kind,regulation,overtime,winners,objective='Bomb'):
    template=source()[0];score=[0,0];result=[]
    for i,winner in enumerate(winners):
        r=copy.deepcopy(template);score[winner]+=1;r.update(roundNumber=i,roundsPerMatch=regulation,roundsPerMatchOvertime=overtime)
        r['matchType']['name']=kind;r['gamemode']['name']=objective
        for k,t in enumerate(r['teams']):t.update(score=score[k],won=k==winner)
        result.append(r)
    return result

class PlaylistTests(unittest.TestCase):
    def test_supported_playlists_and_overtime(self):
        for kind,reg,ot,winners,objective in [('Ranked',6,3,[0,1,0,1,0,1,0,1,0],'Bomb'),('Unranked',6,3,[0,0,0,0],'Bomb'),('Standard',6,1,[0,1,0,1,0,1,0],'Bomb'),('QuickMatch',4,1,[0,1,0,1,0],'QuickMatchBomb'),('QuickMatch',4,1,[0,0,0],'Hostage'),('QuickMatch',4,1,[0,0,0],'SecureArea')]:
            with self.subTest(kind=kind,objective=objective):
                raw=rounds(kind,reg,ot,winners,objective);self.assertTrue(completion(raw)[0]);out=envelope(raw);self.assertEqual(out['payload']['match']['matchType'],kind);self.assertEqual(out['payload']['match']['roundsPerMatchOvertime'],ot)
                self.assertFalse(completion(raw[:-1])[0])
    def test_no_guessing_missing_format_or_unknown_playlist(self):
        for kind in ['Unranked','Standard','QuickMatch','Custom','Unknown']:
            raw=rounds(kind,6,3,[0,0,0,0]);[r.pop('roundsPerMatchOvertime') for r in raw];self.assertFalse(completion(raw)[0])
    def test_mixed_playlist_and_rounds_after_completion_are_rejected(self):
        raw=rounds('QuickMatch',4,1,[0,0,0,1]);self.assertFalse(completion(raw)[0]);raw=rounds('Unranked',6,3,[0,0,0,0]);raw[-1]['matchType']['name']='Ranked';self.assertFalse(completion(raw)[0])
    def test_ranked_does_not_accept_casual_objective(self):
        self.assertFalse(completion(rounds('Ranked',6,3,[0,0,0,0],'QuickMatchBomb'))[0])

if __name__=='__main__':unittest.main()
