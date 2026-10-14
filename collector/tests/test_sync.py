import copy
import json
import sys
import tempfile
import threading
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from store import Store
from sync import run, states, SyncError, api_base, retry_blocked
from test_collector import envelope

OWNER='a'*64
OTHER='b'*64
class Auth:
    def token(self):return 'synthetic-token'

class SyncTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.path=Path(self.temp.name)/'queue.db';self.store=Store(self.path)
        self.e=envelope();self.store.enqueue(self.e);self.stop=threading.Event()
    def tearDown(self):self.store.close();self.temp.cleanup()
    def send(self,base,path,token,data=None):
        if path=='/account':return {'authenticated':True,'workspaceId':OWNER}
        return {'acknowledged':True,'workspaceId':OWNER,'messageId':self.e['messageId'],'matchId':self.e['payload']['match']['matchId'],'status':'uploaded'}
    def execute(self,send=None,now=100):return run(self.store,Auth(),'http://127.0.0.1:5087',self.stop,lambda _:None,send=send or self.send,now=lambda:now,jitter=lambda a,b:0)
    def test_ack_retains_original_and_survives_restart(self):
        self.assertEqual(self.execute(),1);self.store.close();self.store=Store(self.path)
        self.assertEqual(states(self.store)[self.e['messageId']]['state'],'uploaded');self.assertEqual(len(self.store.queued()),1);self.assertEqual(self.execute(),0)
    def test_lost_ack_retries_same_message_and_accepts_duplicate(self):
        calls=[]
        def fail(base,path,token,data=None):
            if path=='/account':return self.send(base,path,token)
            calls.append(json.loads(data)['messageId']);raise SyncError()
        self.execute(fail);self.assertEqual(self.execute(fail,101),0);self.assertEqual(len(calls),1)
        def retry(base,path,token,data=None):
            result=self.send(base,path,token,data)
            if data:result['status']='duplicate';calls.append(json.loads(data)['messageId'])
            return result
        self.assertEqual(self.execute(retry,200),1);self.assertEqual(calls,[self.e['messageId']]*2)
    def test_different_account_cannot_take_bound_queue(self):
        def fail(b,p,t,d=None):
            if d:raise SyncError()
            return self.send(b,p,t)
        self.execute(fail)
        def other(b,p,t,d=None):
            self.assertIsNone(d);return {'authenticated':True,'workspaceId':OTHER}
        self.assertEqual(self.execute(other,200),0)
    def test_conflicts_are_not_automatically_retried(self):
        def conflict(b,p,t,d=None):
            if d:raise SyncError(409)
            return self.send(b,p,t)
        self.execute(conflict);self.assertEqual(states(self.store)[self.e['messageId']]['state'],'blocked');self.assertEqual(self.execute(now=500),0)
        retry_blocked(self.store);self.assertEqual(self.execute(now=500),1)
    def test_rate_limit_honors_retry_after(self):
        def limited(b,p,t,d=None):
            if d:raise SyncError(429,600)
            return self.send(b,p,t)
        self.execute(limited);self.assertEqual(states(self.store)[self.e['messageId']]['next_attempt'],700)
    def test_mismatched_receipt_is_never_acknowledged(self):
        def bad(b,p,t,d=None):
            result=self.send(b,p,t,d)
            if d:result['workspaceId']=OTHER
            return result
        self.execute(bad);self.assertEqual(states(self.store)[self.e['messageId']]['state'],'retry')
    def test_stop_keeps_queue(self):
        self.stop.set();self.assertEqual(self.execute(),0);self.assertEqual(len(self.store.queued()),1)
    def test_plain_http_and_embedded_credentials_rejected(self):
        for value in ('http://example.com','https://user:secret@example.com','https://example.com/path','https://example.com?token=x'):
            with self.assertRaises(ValueError):api_base(value)
        self.assertEqual(api_base('https://example.com/'),'https://example.com')

if __name__=='__main__':unittest.main()
