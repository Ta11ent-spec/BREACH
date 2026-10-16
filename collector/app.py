"""BREACH desktop collector. All game processing runs outside the UI thread."""
import argparse
import ctypes
import json
import os
import queue
import sys
import threading
from pathlib import Path
import tkinter as tk
from tkinter import filedialog, messagebox, ttk

from adapter import VERSION, resource, validate
from engine import parser_manifest, scan, suggested_roots, verify_parser
from store import Store
from auth import Auth0, AuthError
import sync
from background import Tray, startup_enabled, set_startup

BG, PANEL, TEXT, MUTED, ACCENT = '#0b0f13', '#151b21', '#eef3ed', '#929da5', '#d0ff59'


class Collector(tk.Tk):
    def __init__(self, data_dir, parser=None, auth_config=None, background=False, show_event=None):
        super().__init__()
        self.title('BREACH / INTEL — PC Collector')
        self.geometry('1100x740'); self.minsize(820, 600); self.configure(bg=BG)
        self.store = Store(data_dir / 'collector.db'); self.store.recover()
        if self.store.get('modeSupportVersion') != VERSION:
            with self.store.db:
                self.store.db.execute("UPDATE jobs SET state='interrupted' WHERE state='held' AND (detail LIKE 'Unsupported mode%' OR detail LIKE 'Unsupported playlist%')")
            self.store.set('modeSupportVersion', VERSION)
        self.parser = parser or resource('siege-dissect.exe')
        self.messages = queue.Queue(); self.stop = threading.Event(); self.worker = None
        self.watching = False; self.closing = False; self.next_scan = 0
        self.show_event = show_event; self.start_hidden = background; self.tray_ready = False
        self.tray = Tray(self.messages)
        self.auto_watch = tk.BooleanVar(value=self.store.get('autoWatch', 'true') == 'true')
        self.keep_background = tk.BooleanVar(value=self.store.get('keepBackground', 'true') == 'true')
        self.start_windows = tk.BooleanVar(value=startup_enabled())
        self.auth = None
        self.api_url = None
        sync_config = resource("sync.json")
        if sync_config.exists():
            try: self.api_url = sync.api_base(json.loads(sync_config.read_text())["apiUrl"])
            except (ValueError, KeyError, OSError): pass
        self.sync_enabled = self.store.get("autoSync", "false") == "true"
        self.next_sync = 0
        self.sync_label = tk.StringVar(value="DISABLE SYNC" if self.sync_enabled else "ENABLE SYNC")
        config_path = auth_config or resource('auth0.json')
        if config_path.exists():
            try: self.auth = Auth0(json.loads(config_path.read_text(encoding='utf-8')), data_dir)
            except (AuthError, ValueError, OSError): pass
        self.folder = tk.StringVar(value=self.store.get('replayFolder', ''))
        self.status = tk.StringVar(value='Ready. Select your replay folder to begin.')
        self.counts = tk.StringVar(); self.watch_label = tk.StringVar(value='START WATCHING')
        self.protocol('WM_DELETE_WINDOW', self.close_app)
        self.style(); self.layout(); self.refresh(); self.after(250, self.tick)
        self.tray.start(); self.after(400, self.resume_automatically)

    def style(self):
        style = ttk.Style(self); style.theme_use('clam')
        style.configure('Treeview', background=PANEL, fieldbackground=PANEL, foreground=TEXT, rowheight=32, borderwidth=0, font=('Segoe UI', 10))
        style.configure('Treeview.Heading', background='#252e35', foreground=ACCENT, font=('Segoe UI', 9, 'bold'), padding=8)
        style.map('Treeview', background=[('selected', '#3f502a')], foreground=[('selected', TEXT)])
        style.configure('TNotebook', background=BG, borderwidth=0)
        style.configure('TNotebook.Tab', background=PANEL, foreground=MUTED, padding=[20, 10])
        style.map('TNotebook.Tab', background=[('selected', '#2d3827')], foreground=[('selected', ACCENT)])

    def label(self, parent, text='', size=10, color=TEXT, **kw):
        return tk.Label(parent, text=text, bg=parent['bg'], fg=color, font=('Segoe UI', size), **kw)

    def button(self, parent, text, command, accent=False, **kw):
        return tk.Button(parent, text=text, command=command, bg=ACCENT if accent else '#252e35', fg=BG if accent else TEXT,
                         activebackground='#bce646', activeforeground=BG, relief='flat', padx=15, pady=10, cursor='hand2', font=('Segoe UI', 9, 'bold'), **kw)

    def layout(self):
        header = tk.Frame(self, bg=PANEL, padx=28, pady=18); header.pack(fill='x')
        self.label(header, 'BREACH / INTEL', 22, ACCENT).pack(side='left')
        self.account_label = tk.StringVar(value='SIGN IN' if not self.auth or not self.auth.session else 'DISCONNECT')
        self.button(header, '', self.account_action, textvariable=self.account_label).pack(side='right')
        body = tk.Frame(self, bg=BG, padx=28, pady=18); body.pack(fill='both', expand=True)
        self.label(body, 'REPLAY COLLECTION / WINDOWS', 9, ACCENT).pack(anchor='w')
        self.label(body, 'Your matches. Ready for analysis.', 23).pack(anchor='w', pady=(5, 3))
        self.label(body, 'Collect finished Ranked, Unranked/Standard and Casual replays. Sync contributes gameplay stats to BREACH’s shared player directory.', 10, MUTED).pack(anchor='w')
        settings = tk.Frame(body, bg=PANEL, padx=16, pady=13); settings.pack(fill='x', pady=15)
        self.label(settings, '01 / REPLAY FOLDER', 9, ACCENT).pack(anchor='w')
        row = tk.Frame(settings, bg=PANEL); row.pack(fill='x', pady=(8, 0))
        tk.Entry(row, textvariable=self.folder, readonlybackground=BG, fg=TEXT, relief='flat', state='readonly', font=('Segoe UI', 10)).pack(side='left', fill='x', expand=True, ipady=11)
        self.button(row, 'BROWSE', self.browse).pack(side='left', padx=(8, 0))
        self.button(row, 'DETECT', self.detect).pack(side='left', padx=(8, 0))
        actions = tk.Frame(body, bg=BG); actions.pack(fill='x')
        self.scan_button = self.button(actions, 'SCAN NOW', lambda: self.start_scan(True), True); self.scan_button.pack(side='left')
        self.button(actions, '', self.toggle_watch, textvariable=self.watch_label).pack(side='left', padx=8)
        self.button(actions, 'PAUSE', self.pause).pack(side='left')
        self.button(actions, '', self.toggle_sync, textvariable=self.sync_label).pack(side='left', padx=8)
        self.button(actions, 'RETRY UPLOADS', self.retry_uploads).pack(side='left')
        self.label(actions, size=10, color=ACCENT, textvariable=self.counts).pack(side='right')
        automatic = tk.Frame(body, bg=BG); automatic.pack(fill='x', pady=(10, 0))
        for label, value, command in [('Watch automatically on launch', self.auto_watch, self.save_background), ('Keep running when window closes', self.keep_background, self.save_background), ('Start with Windows', self.start_windows, self.configure_startup)]:
            tk.Checkbutton(automatic, text=label, variable=value, command=command, bg=BG, fg=TEXT, selectcolor=PANEL, activebackground=BG, activeforeground=TEXT).pack(side='left', padx=(0, 18))
        notebook = ttk.Notebook(body)
        jobs_frame = tk.Frame(notebook, bg=PANEL); ready_frame = tk.Frame(notebook, bg=PANEL)
        notebook.add(jobs_frame, text='COLLECTION ACTIVITY'); notebook.add(ready_frame, text='MATCH QUEUE')
        self.jobs = self.table(jobs_frame, ('folder', 'state', 'detail'), (250, 100, 540))
        self.ready = self.table(ready_frame, ('match', 'created', 'exported', 'upload'), (300, 170, 170, 240))
        footer = tk.Frame(body, bg=BG); footer.pack(side='bottom', fill='x')
        bottom = tk.Frame(footer, bg=BG); bottom.pack(fill='x')
        self.button(bottom, 'EXPORT SELECTED JSON', self.export_selected).pack(side='left')
        self.button(bottom, 'EXPORT DIAGNOSTICS', self.export_diagnostics).pack(side='left', padx=8)
        self.button(bottom, 'ABOUT', self.about).pack(side='right')
        self.label(footer, size=10, color=MUTED, textvariable=self.status, anchor='w', wraplength=1000).pack(fill='x', pady=(12, 0))
        self.label(footer, 'Close to the system tray when background mode is enabled. Use the tray menu to Open, Pause or Quit. Your PC must be awake.', 9, MUTED).pack(anchor='w', pady=(8, 0))
        notebook.pack(fill='both', expand=True, pady=15)

    def table(self, parent, columns, widths):
        tree = ttk.Treeview(parent, columns=columns, show='headings', selectmode='browse')
        for column, width in zip(columns, widths):
            tree.heading(column, text=column.upper()); tree.column(column, width=width, minwidth=70)
        scroll = ttk.Scrollbar(parent, orient='vertical', command=tree.yview); scroll.pack(side='right', fill='y')
        tree.configure(yscrollcommand=scroll.set); tree.pack(fill='both', expand=True)
        tree.bind('<Double-1>', lambda event: self.show_row(tree))
        return tree

    def show_row(self, tree):
        selected = tree.selection()
        if selected:
            messagebox.showinfo('Record details', '\n\n'.join(str(v) for v in tree.item(selected[0], 'values')), parent=self)

    def browse(self):
        folder = filedialog.askdirectory(title='Choose the game MatchReplay folder', parent=self)
        if folder:
            self.stop.set(); self.watching = False; self.folder.set(folder); self.store.set('replayFolder', folder)
            self.resume_automatically()

    def detect(self):
        roots = suggested_roots()
        def select(folder):
            self.stop.set(); self.watching = False; self.folder.set(folder); self.store.set('replayFolder', folder)
            self.status.set('Detected replay folder. Automatic watching uses this saved location.')
            self.resume_automatically()
        if len(roots) == 1: select(roots[0])
        elif roots:
            dialog=tk.Toplevel(self); dialog.title('Choose your Siege replay folder'); dialog.geometry('800x300'); dialog.transient(self)
            tk.Label(dialog,text='Multiple installations found. Select the one you play:').pack(pady=12)
            choices=tk.Listbox(dialog); choices.pack(fill='both',expand=True,padx=12)
            for folder in roots: choices.insert('end',folder)
            choices.selection_set(roots.index(self.folder.get()) if self.folder.get() in roots else 0)
            def apply():
                selected=choices.curselection()
                if selected: select(roots[selected[0]]); dialog.destroy()
            tk.Button(dialog,text='USE SELECTED FOLDER',command=apply).pack(pady=12)
            dialog.grab_set()
        else:
            self.status.set('No MatchReplay folder found in installed-game records or Steam libraries. Use Browse to select it. If it does not exist yet, save a replay in Siege first, then Detect again.')

    def start_scan(self, retry=False):
        if self.worker and self.worker.is_alive():
            return
        root = self.folder.get()
        if not Path(root).is_dir() or not root:
            self.status.set('Choose an existing replay folder first.'); self.watching = False; self.watch_label.set('START WATCHING'); return
        self.stop.clear(); self.scan_button.configure(state='disabled')
        self.status.set('Checking parser and scanning replay folders…')
        def work():
            store = None
            try:
                manifest = parser_manifest(); verify_parser(self.parser, manifest['sha256'])
                store = Store(self.store.path)
                count = scan(store, root, self.parser, manifest['version'], self.stop, self.messages.put, retry)
                self.messages.put(f'Pass complete: {count} folders checked. ' + ('Watching for new replays.' if self.watching else 'Ready for another scan.'))
            except Exception as exc:
                self.messages.put('Scan error: ' + str(exc))
            finally:
                if store: store.close()
                self.messages.put(None)
        self.worker = threading.Thread(target=work, daemon=False); self.worker.start()

    def toggle_watch(self):
        if self.watching:
            self.pause()
        else:
            self.store.set('watchPaused', 'false')
            self.watching = True; self.watch_label.set('STOP WATCHING'); self.start_scan()

    def save_background(self):
        self.store.set('autoWatch', str(self.auto_watch.get()).lower())
        self.store.set('keepBackground', str(self.keep_background.get()).lower())
        if self.auto_watch.get():
            self.store.set('watchPaused', 'false'); self.resume_automatically()

    def configure_startup(self):
        try: set_startup(self.start_windows.get())
        except OSError as exc:
            self.start_windows.set(startup_enabled()); self.status.set(str(exc))

    def resume_automatically(self):
        if self.closing: return
        if self.auto_watch.get() and self.store.get('watchPaused', 'false') != 'true':
            if self.folder.get() and Path(self.folder.get()).is_dir():
                self.watching = True; self.watch_label.set('STOP WATCHING'); self.next_scan = 0
                self.status.set('Watching automatically. Sync uses your saved setting; enable it once to upload.')
            else:
                self.status.set('Select a replay folder once. Automatic watching will begin after setup.'); self.show_window()

    def show_window(self):
        self.deiconify(); self.lift()

    def tray_action(self, action):
        if self.closing: return
        if action == 'ready':
            self.tray_ready = True
            if self.start_hidden and self.folder.get() and Path(self.folder.get()).is_dir() and self.auth and self.auth.session:
                self.withdraw()
        elif action == 'show': self.show_window()
        elif action == 'auto': self.resume_automatically()
        elif action == 'pause': self.pause()
        elif action == 'resume':
            if not self.watching: self.toggle_watch()
        elif action == 'quit': self.quit_app()
        elif action == 'failed':
            self.tray_ready = False; self.show_window(); self.status.set('Tray unavailable. Keep this window minimized to collect; closing it will quit.')

    def account_action(self):
        if self.worker and self.worker.is_alive():
            self.status.set('Pause collection and wait for the current operation before changing sign-in.'); return
        if not self.auth:
            self.status.set('Auth0 collector configuration is missing. Install the configured collector build.'); return
        self.watching = False; self.watch_label.set('START WATCHING')
        self.sync_enabled = False; self.store.set('autoSync', 'false'); self.sync_label.set('ENABLE SYNC')
        self.stop.clear(); self.scan_button.configure(state='disabled')
        disconnect = bool(self.auth.session)
        def work():
            try:
                if disconnect:
                    self.auth.disconnect(); self.messages.put('Disconnected from Auth0. Local match records are retained.')
                else:
                    device = self.auth.start()
                    self.messages.put(('pairing', device['user_code'], device['verification_uri_complete']))
                    self.auth.finish(device, self.stop, self.messages.put)
                    self.messages.put(('tray', 'auto'))
            except AuthError as exc: self.messages.put(str(exc))
            except Exception: self.messages.put('Sign-in could not be completed. Try again.')
            finally: self.messages.put(None)
        self.worker = threading.Thread(target=work, daemon=False); self.worker.start()

    def toggle_sync(self):
        self.sync_enabled = not self.sync_enabled
        self.store.set('autoSync', str(self.sync_enabled).lower())
        self.sync_label.set('DISABLE SYNC' if self.sync_enabled else 'ENABLE SYNC')
        if self.sync_enabled:
            self.store.set('watchPaused', 'false'); self.resume_automatically()
            self.next_sync = 0
            self.status.set('Sync enabled. Gameplay statistics are shared; account details and notes remain private.')
        else:
            self.stop.set()
            self.status.set('Sync disabled. A request already accepted by the API may finish; queued files are retained.')

    def retry_uploads(self):
        if self.worker and self.worker.is_alive(): return
        sync.retry_blocked(self.store); self.refresh(); self.next_sync = 0
        if not self.sync_enabled: self.status.set('Retry prepared. Enable sync to upload.')

    def start_sync(self):
        import time
        self.next_sync = time.monotonic() + 60
        if not self.api_url:
            self.status.set('This build has no upload server configured. Install a configured release.'); return
        if not self.auth or not self.auth.session:
            self.status.set('Sign in to enable authenticated uploads.'); return
        if self.worker and self.worker.is_alive(): return
        self.stop.clear(); self.scan_button.configure(state='disabled')
        def work():
            store = Store(self.store.path)
            try: sync.run(store, self.auth, self.api_url, self.stop, self.messages.put)
            except AuthError: self.messages.put('Sign-in needs attention. Reconnect your account before retrying uploads.')
            except Exception: self.messages.put('Upload service unavailable. Sync will retry automatically.')
            finally: store.close(); self.messages.put(None)
        self.worker = threading.Thread(target=work, daemon=False); self.worker.start()

    def pause(self):
        self.store.set('watchPaused', 'true')
        self.watching = False; self.stop.set(); self.watch_label.set('START WATCHING')
        self.sync_enabled = False; self.store.set('autoSync', 'false'); self.sync_label.set('ENABLE SYNC')
        self.status.set('Paused collection and uploads. Queue records are saved.')

    def refresh(self):
        for tree in (self.jobs, self.ready):
            selected = tree.selection()
            old = selected[0] if selected else None
            tree.delete(*tree.get_children())
            if tree is self.jobs:
                for j in self.store.jobs(): tree.insert('', 'end', iid=j['folder'], values=(Path(j['folder']).name, j['state'].upper(), j['detail']))
            else:
                upload_states = sync.states(self.store)
                for q in self.store.queued():
                    record = upload_states.get(q['message_id'], {})
                    tree.insert('', 'end', iid=q['message_id'], values=(q['match_id'], q['created_at'], q['exported_at'] or 'Not exported', record.get('outcome') or record.get('detail') or record.get('state') or 'Not synced'))
            if old and tree.exists(old): tree.selection_set(old)
        self.counts.set(f'{len(self.store.queued())} MATCHES READY  ·  ' + ('SIGNED IN' if self.auth and self.auth.session else 'OFFLINE'))
        self.account_label.set('DISCONNECT' if self.auth and self.auth.session else 'SIGN IN')

    def tick(self):
        import time
        while not self.messages.empty():
            value = self.messages.get_nowait()
            if value is None:
                self.refresh(); self.scan_button.configure(state='normal'); self.next_scan = time.monotonic() + 30
            elif isinstance(value, tuple) and value[0] == 'tray': self.tray_action(value[1])
            elif isinstance(value, tuple) and value[0] == 'pairing':
                import webbrowser
                self.status.set(f'Approve code {value[1]} in your browser. Pause cancels sign-in.')
                webbrowser.open(value[2])
            else: self.status.set(value)
        alive = self.worker and self.worker.is_alive()
        if self.show_event:
            kernel = ctypes.WinDLL('kernel32', use_last_error=True)
            kernel.WaitForSingleObject.argtypes = [ctypes.c_void_p, ctypes.c_ulong]
            if kernel.WaitForSingleObject(self.show_event, 0) == 0: self.show_window()
        if self.closing and not alive:
            self.tray.stop(); self.store.close(); self.destroy(); return
        if self.sync_enabled and not self.closing and not alive and time.monotonic() >= self.next_sync:
            self.start_sync(); alive = self.worker and self.worker.is_alive()
        if self.watching and not self.closing and not alive and time.monotonic() >= self.next_scan:
            self.start_scan()
        self.after(250, self.tick)

    def export_selected(self):
        selected = self.ready.selection()
        if not selected:
            self.status.set('Open MATCH QUEUE and select a match first.'); return
        path = filedialog.asksaveasfilename(parent=self, title='Export collector JSON', defaultextension='.json', initialfile=f'breach-{selected[0]}.json', filetypes=[('JSON', '*.json')])
        if path:
            try:
                self.store.export(selected[0], path); self.refresh(); self.status.set('JSON exported. Queue record retained. Export does not change upload status.')
            except Exception as exc: messagebox.showerror('Export failed', str(exc), parent=self)

    def export_diagnostics(self):
        path = filedialog.asksaveasfilename(parent=self, title='Save local diagnostics', defaultextension='.json', initialfile='breach-diagnostics.json')
        if path:
            try:
                # Only local export; never automatically sent anywhere.
                data = {'version': VERSION, 'jobs': self.store.jobs(), 'queued': self.store.queued(), 'notice': 'May contain local folder paths and parser diagnostics. Review before sharing.'}
                Path(path).write_text(json.dumps(data, indent=2), encoding='utf-8')
                self.status.set('Diagnostics saved locally. Review folder paths before sharing.')
            except Exception as exc: messagebox.showerror('Export failed', str(exc), parent=self)

    def about(self):
        messagebox.showinfo('BREACH / INTEL', f'Collector {VERSION} · beta\n\nIncludes siege-dissect (MIT license). License files ship beside the app.\n\nSupports complete Ranked, Unranked/Standard and Casual matches. Unsupported formats and incomplete recordings remain held.\n\nAuth0 sign-in uses your browser. Saved tokens are protected by Windows. Uploads use your signed-in account. Automatic watching uses your saved replay folder. Enable Start with Windows for passive startup. Closing to the tray keeps collection running; use the tray menu to Quit. Sync must be enabled once, and your PC must be awake.', parent=self)

    def close_app(self):
        if self.keep_background.get() and self.tray_ready:
            self.withdraw()
        else: self.quit_app()

    def quit_app(self):
        # Preserve saved sync/watch preferences; only an explicit Pause disables them.
        self.watching = False; self.stop.set(); self.closing = True
        self.status.set('Finishing shutdown and saving queue state…')


def main():
    args = argparse.ArgumentParser()
    args.add_argument('--data-dir', type=Path)
    args.add_argument('--parser', type=Path)
    args.add_argument('--auth-config', type=Path, help='Public Auth0 collector settings; never a client secret')
    args.add_argument('--self-test', type=Path, help='Write packaged-runtime validation to this file and exit')
    args.add_argument('--background', action='store_true', help='Start in the tray after initial setup')
    options = args.parse_args()
    if options.self_test:
        import tempfile
        with tempfile.TemporaryDirectory() as temp:
            store = Store(Path(temp) / 'test.db'); installation = store.get('installationId'); store.close()
            validate(json.loads(resource('collector-v1.example.json').read_text(encoding='utf-8')))
            manifest = parser_manifest(); verify_parser(options.parser or resource('siege-dissect.exe'), manifest['sha256'])
            root = tk.Tk(); root.withdraw(); root.update_idletasks(); root.destroy()
            import pystray._win32
            from PIL import Image
            Image.new('RGBA', (16, 16), '#ff783d').close()
            from auth import protect
            protected = protect(b'packaged-runtime-check')
            credential_check = protect(protected, decrypt=True) == b'packaged-runtime-check'
            config = resource('auth0.json')
            if config.exists(): Auth0(json.loads(config.read_text(encoding='utf-8')), Path(temp))
            sync_config = resource('sync.json')
            if sync_config.exists(): sync.api_base(json.loads(sync_config.read_text())['apiUrl'])
            options.self_test.write_text(json.dumps({'ok': True, 'version': VERSION, 'sqlite': bool(installation), 'tk': True, 'schema': True, 'parserChecksum': True, 'windowsCredentialProtection': credential_check, 'auth0Configured': config.exists(), 'syncConfigured': sync_config.exists()}), encoding='utf-8')
        return
    data_dir = options.data_dir or Path(os.environ.get('LOCALAPPDATA', str(Path.home()))) / 'BREACH/CollectorData'
    handle = None; show_event = None
    if os.name == 'nt':
        import hashlib
        kernel = ctypes.WinDLL('kernel32', use_last_error=True)
        kernel.CreateMutexW.argtypes = [ctypes.c_void_p, ctypes.c_bool, ctypes.c_wchar_p]
        kernel.CreateMutexW.restype = ctypes.c_void_p
        identity = hashlib.sha256(str(data_dir.resolve()).encode()).hexdigest()
        kernel.CreateEventW.argtypes = [ctypes.c_void_p, ctypes.c_bool, ctypes.c_bool, ctypes.c_wchar_p]
        kernel.CreateEventW.restype = ctypes.c_void_p
        show_event = kernel.CreateEventW(None, False, False, 'Local\\BreachCollectorShow-' + identity)
        handle = kernel.CreateMutexW(None, False, 'Local\\BreachCollector-' + identity)
        if not handle or ctypes.get_last_error() == 183:
            if show_event and not options.background:
                kernel.SetEvent.argtypes = [ctypes.c_void_p]; kernel.SetEvent(show_event)
            kernel.CloseHandle.argtypes = [ctypes.c_void_p]
            if handle: kernel.CloseHandle(handle)
            if show_event: kernel.CloseHandle(show_event)
            return
    try:
        Collector(data_dir, options.parser, options.auth_config, options.background, show_event).mainloop()
    finally:
        if handle:
            kernel.CloseHandle.argtypes = [ctypes.c_void_p]; kernel.CloseHandle(handle)
        if show_event: kernel.CloseHandle(show_event)


if __name__ == '__main__':
    main()
