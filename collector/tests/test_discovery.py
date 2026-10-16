import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from engine import suggested_roots

class DiscoveryTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(); self.root=Path(self.tmp.name)
        self.env=patch.dict(os.environ,{'PROGRAMFILES(X86)':str(self.root/'pf86'),'PROGRAMFILES':str(self.root/'pf')});self.env.start()
    def tearDown(self):self.env.stop();self.tmp.cleanup()
    def folder(self,path):path.mkdir(parents=True);return str(path.resolve())
    def test_custom_ubisoft_install(self):
        game=self.root/'other-drive'/'Siege';want=self.folder(game/'MatchReplay')
        with patch('engine.installed_locations',return_value=([],[game])):self.assertEqual(suggested_roots(),[want])
    def test_custom_steam_and_library_manifest_install_name(self):
        steam=self.root/'customSteam';library=self.root/'secondary';apps=library/'steamapps';apps.mkdir(parents=True)
        (steam/'steamapps').mkdir(parents=True)
        (steam/'steamapps/libraryfolders.vdf').write_text('"path" "'+str(library).replace('\\','\\\\')+'"')
        (apps/'appmanifest_1.acf').write_text('"name" "Tom Clancy\'s Rainbow Six Siege X" "installdir" "Siege X Custom"')
        want=self.folder(apps/'common/Siege X Custom/MatchReplay')
        with patch('engine.installed_locations',return_value=([steam],[])):self.assertEqual(suggested_roots(),[want])
    def test_reported_o_drive_library_path(self):
        steam=self.root/'customSteam';(steam/'steamapps').mkdir(parents=True)
        (steam/'steamapps/libraryfolders.vdf').write_text('"path" "O:/SteamLibrary"')
        expected=Path("O:/SteamLibrary/steamapps/common/Tom Clancy's Rainbow Six Siege/MatchReplay")
        with patch('engine.installed_locations',return_value=([steam],[])), patch.object(Path,'is_dir',lambda p: p==expected), patch.object(Path,'glob',return_value=[]):
            self.assertEqual(suggested_roots(),[str(expected.resolve())])
    def test_default_path_and_duplicate_registry_entries(self):
        game=self.root/"pf86/Steam/steamapps/common/Tom Clancy's Rainbow Six Siege";want=self.folder(game/'MatchReplay')
        with patch('engine.installed_locations',return_value=([],[game,game])):self.assertEqual(suggested_roots(),[want])
    def test_missing_folder_does_not_invent_a_path(self):
        with patch('engine.installed_locations',return_value=([self.root/'absent'],[self.root/'missing'])):self.assertEqual(suggested_roots(),[])
    def test_unrelated_manifest_does_not_match(self):
        steam=self.root/'steam';apps=steam/'steamapps';apps.mkdir(parents=True)
        (apps/'appmanifest_2.acf').write_text('"name" "Other Game" "installdir" "Other"');self.folder(apps/'common/Other/MatchReplay')
        with patch('engine.installed_locations',return_value=([steam],[])):self.assertEqual(suggested_roots(),[])
    def test_multiple_installations_return_all_choices(self):
        games=[self.root/'live',self.root/'test'];want=[self.folder(p/'MatchReplay') for p in games]
        with patch('engine.installed_locations',return_value=([],games)):self.assertEqual(suggested_roots(),want)

if __name__=='__main__':unittest.main()
