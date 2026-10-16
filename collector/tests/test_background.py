import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch, MagicMock

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app import Collector
from store import Store
from background import startup_command, set_startup, RUN_NAME


class BackgroundTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.replays = self.root / 'MatchReplay'; self.replays.mkdir()
        store = Store(self.root / 'collector.db')
        store.set('replayFolder', str(self.replays)); store.set('autoSync', 'true'); store.close()
        self.tray_patch = patch('app.Tray'); self.tray_patch.start()
        self.app = Collector(self.root); self.app.withdraw()

    def tearDown(self):
        self.app.store.close(); self.app.destroy(); self.tray_patch.stop(); self.temp.cleanup()

    def test_saved_folder_watches_without_a_button(self):
        self.app.resume_automatically()
        self.assertTrue(self.app.watching)
        self.assertEqual(self.app.watch_label.get(), 'STOP WATCHING')

    def test_pause_survives_restart_but_can_resume(self):
        self.app.pause(); self.app.resume_automatically()
        self.assertFalse(self.app.watching)
        self.assertEqual(self.app.store.get('watchPaused'), 'true')
        self.app.start_scan = MagicMock()
        self.app.toggle_watch()
        self.assertTrue(self.app.watching)
        self.assertEqual(self.app.store.get('watchPaused'), 'false')

    def test_quit_preserves_sync_for_next_launch(self):
        self.app.quit_app()
        self.assertEqual(self.app.store.get('autoSync'), 'true')
        self.assertTrue(self.app.closing)
        self.assertTrue(self.app.stop.is_set())

    def test_close_to_tray_keeps_work_running(self):
        self.app.tray_ready = True; self.app.resume_automatically(); self.app.close_app()
        self.assertFalse(self.app.closing)
        self.assertTrue(self.app.watching)
        self.assertTrue(self.app.sync_enabled)

    def test_no_tray_does_not_leave_an_invisible_process(self):
        self.app.tray_ready = False; self.app.close_app()
        self.assertTrue(self.app.closing)

    def test_missing_folder_stays_visible_for_setup(self):
        self.app.folder.set(''); self.app.resume_automatically()
        self.assertFalse(self.app.watching)
        self.assertIn('Select a replay folder', self.app.status.get())

    def test_disabling_auto_watch_is_respected(self):
        self.app.auto_watch.set(False); self.app.save_background(); self.app.resume_automatically()
        self.assertFalse(self.app.watching)
        self.assertEqual(self.app.store.get('autoWatch'), 'false')

    def test_upgrade_retries_only_unsupported_holds_once(self):
        from adapter import VERSION
        directory=self.root/'upgrade';directory.mkdir()
        store=Store(directory/'collector.db')
        store.set('modeSupportVersion','0.3.5')
        for folder,state,detail in [('unsupported','held','Unsupported mode or regulation length; retained for review'),('uploaded','queued','Uploaded'),('broken','failed','Parser failed'),('unfinished','held','Final score does not confirm a finished match')]:
            store.record(folder,'signature',state,detail)
        store.close()
        app=Collector(directory);app.withdraw()
        self.assertEqual(app.store.job('unsupported')['state'],'interrupted')
        self.assertEqual(app.store.job('uploaded')['state'],'queued')
        self.assertEqual(app.store.job('broken')['state'],'failed')
        self.assertEqual(app.store.job('unfinished')['state'],'held')
        app.store.record('unsupported','signature','held','Unsupported playlist')
        self.assertEqual(app.store.get('modeSupportVersion'),VERSION)
        app.store.close();app.destroy()
        app=Collector(directory);app.withdraw()
        self.assertEqual(app.store.job('unsupported')['state'],'held')
        app.store.close();app.destroy()

    def test_windows_startup_quotes_executable_and_is_per_user(self):
        self.assertIn('"', startup_command(r'C:\Program Files\BREACH Collector\BreachCollector.exe'))
        self.assertTrue(startup_command().endswith(' --background'))
        import winreg
        with patch('sys.frozen', True, create=True), patch.object(winreg, 'CreateKey') as key, patch.object(winreg, 'SetValueEx') as write:
            set_startup(True)
            self.assertEqual(key.call_args.args[0], winreg.HKEY_CURRENT_USER)
            self.assertEqual(write.call_args.args[1], RUN_NAME)
            self.assertEqual(write.call_args.args[-1], startup_command())

if __name__ == '__main__': unittest.main()
