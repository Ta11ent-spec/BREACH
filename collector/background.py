"""Optional per-user startup and tray controls. No service or administrator access."""
import os
import subprocess
import sys
import threading
from pathlib import Path

RUN_KEY = r'Software\Microsoft\Windows\CurrentVersion\Run'
RUN_NAME = 'BREACHCollector'


def startup_command(executable=None):
    return subprocess.list2cmdline([str(Path(executable or sys.executable).resolve()), '--background'])


def startup_enabled():
    if os.name != 'nt': return False
    import winreg
    try:
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, RUN_KEY) as key:
            value, _ = winreg.QueryValueEx(key, RUN_NAME)
            return value == startup_command()
    except FileNotFoundError: return False


def set_startup(enabled):
    if os.name != 'nt' or not getattr(sys, 'frozen', False):
        raise OSError('Start with Windows is available in the installed Windows collector.')
    import winreg
    with winreg.CreateKey(winreg.HKEY_CURRENT_USER, RUN_KEY) as key:
        if enabled: winreg.SetValueEx(key, RUN_NAME, 0, winreg.REG_SZ, startup_command())
        else:
            try:
                value, _ = winreg.QueryValueEx(key, RUN_NAME)
                if value == startup_command(): winreg.DeleteValue(key, RUN_NAME)
            except FileNotFoundError: pass


class Tray:
    def __init__(self, messages):
        self.messages = messages
        self.icon = None
        self.thread = None
        self.stopped = threading.Event()

    def start(self):
        def run():
            try:
                from pystray import Icon, Menu, MenuItem
                from PIL import Image, ImageDraw
                image = Image.new('RGBA', (64, 64), '#111b29')
                draw = ImageDraw.Draw(image)
                draw.rounded_rectangle((5, 5, 58, 58), radius=10, outline='#ff783d', width=5)
                draw.line((22, 22, 42, 42), fill='#ff783d', width=7)
                draw.line((42, 22, 22, 42), fill='#ff783d', width=7)
                def action(name):
                    return lambda icon, item: self.messages.put(('tray', name))
                self.icon = Icon('BREACHCollector', image, 'BREACH Collector', Menu(
                    MenuItem('Open collector', action('show'), default=True),
                    MenuItem('Resume watching', action('resume')),
                    MenuItem('Pause collection and sync', action('pause')),
                    MenuItem('Quit collector', action('quit'))))
                def ready(icon):
                    if self.stopped.is_set(): icon.stop(); return
                    icon.visible = True
                    self.messages.put(('tray', 'ready'))
                self.icon.run(setup=ready)
            except Exception:
                self.messages.put(('tray', 'failed'))
        self.thread = threading.Thread(target=run, daemon=True)
        self.thread.start()

    def stop(self):
        self.stopped.set()
        if self.icon:
            try: self.icon.stop()
            except Exception: pass
