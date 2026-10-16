import release from '../../public/downloads/collector-release.json';

export function CollectorDownload({compact=false}:{compact?:boolean}){
 return <section className="panel collector-download">
  <div className="eyebrow">LATEST COLLECTOR / WINDOWS x64 / BETA {release.version}</div>
  <h3>Bring your matches into BREACH.</h3>
  <p>Install the collector, sign into your BREACH account, and enable sync. No Python or SQL Server needed.</p>
  <a className="btn primary" href={'/downloads/'+release.file} download>DOWNLOAD LATEST COLLECTOR — v{release.version}</a>
  <p className="workspace-muted">v{release.version} · {(release.bytes/1048576).toFixed(1)} MB · Unsigned beta. Windows may show an unrecognized-app warning. Testing on a second PC is still pending.</p>
  {compact?<a href="#/collector">Setup instructions &amp; release notes →</a>:<>
   <ol><li>Download and install on a 64-bit Windows PC where you play Siege.</li><li>Open BREACH Collector and sign in with the same account you use here.</li><li>Use Detect or Browse to select your Siege MatchReplay folder.</li><li>Enable Sync once. Watching starts automatically with your saved replay folder. Keep Start with Windows selected for passive startup; close the window to the system tray.</li><li>After a completed Ranked Bomb match, check My Workspace for the upload acknowledgement. New replay files must settle for two minutes before collection.</li></ol>
   <p>Incomplete or unsupported matches stay held for review. Original replay files remain on your PC. Uninstalling keeps your local queue and replays. Use the tray menu to Open, Pause or Quit. Your PC must be awake. Updates are installed manually; Quit the collector from its tray before updating.</p>
   <details><summary>Release notes &amp; verification</summary><ul><li>Hosted account sign-in and match synchronization.</li><li>Durable retry queue and duplicate-safe acknowledgements.</li><li>Bundled runtime, replay parser, and third-party licenses.</li><li>v0.3.3 adds automatic watching, Windows startup and system-tray controls. Quit preserves saved sync preferences; explicit Pause stays paused.</li></ul><p>Verified: collector tests, a hosted upload of an existing real replay, lost-response retry and restart recovery. A fresh match insertion and clean second-PC install have not yet been verified against the hosted release.</p><p>SHA-256: <code>{release.sha256}</code></p><a href="/downloads/collector-release.json" download>Download release metadata</a></details>
  </>}
 </section>;
}
