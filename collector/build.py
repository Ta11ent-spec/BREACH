"""Build a private Windows preview from an explicitly supplied parser binary."""
import argparse
import hashlib
import importlib.metadata
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def copy_file(source, target):
    target = Path(target)
    if target.exists(): target.chmod(0o600)
    shutil.copyfile(source, target)


def main():
    cli = argparse.ArgumentParser()
    cli.add_argument('--parser', required=True, type=Path)
    cli.add_argument('--makensis', required=True, type=Path)
    cli.add_argument('--output', type=Path, default=ROOT / '.tmp/collector-release')
    args = cli.parse_args()
    parser = args.parser.resolve(); compiler = args.makensis.resolve(); out = args.output.resolve()
    if os.name != 'nt': raise SystemExit('Build on Windows x64')
    if not parser.is_file() or not compiler.is_file(): raise SystemExit('Parser or NSIS compiler missing')
    out.mkdir(parents=True, exist_ok=True)
    assets = out / 'staging/assets'; assets.mkdir(parents=True, exist_ok=True)
    for name in ('collector-v1.schema.json', 'collector-v1.example.json'):
        copy_file(ROOT / 'public/contracts' / name, assets / name)
    copy_file(parser, assets / 'siege-dissect.exe')
    copy_file(ROOT / 'collector/assets/siege-dissect-LICENSE.txt', assets / 'siege-dissect-LICENSE.txt')
    digest = hashlib.file_digest(parser.open('rb'), 'sha256').hexdigest()
    manifest = {'name': 'siege-dissect', 'sha256': digest, 'version': 'sha256-' + digest[:32]}
    (assets / 'parser-manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    licenses = assets / 'licenses'; licenses.mkdir(exist_ok=True)
    # Include package license texts, Python/Tcl notices, Go dependency licenses and build identity.
    for dist in importlib.metadata.distributions():
        for file in dist.files or []:
            if any(part.lower().startswith(('license', 'copying', 'notice')) for part in Path(str(file)).parts):
                src = Path(dist.locate_file(file))
                if src.is_file():
                    dest = licenses / dist.metadata['Name'] / str(file).replace('/', '_').replace('\\', '_')
                    dest.parent.mkdir(parents=True, exist_ok=True); copy_file(src, dest)
    for src in [Path(sys.base_prefix) / 'LICENSE.txt', *Path(sys.base_prefix).glob('tcl/**/license.terms')]:
        if src.is_file(): copy_file(src, licenses / (src.parent.name + '-' + src.name))
    build_info = subprocess.check_output(['go', 'version', '-m', str(parser)], text=True)
    (assets / 'parser-build.txt').write_text(build_info, encoding='utf-8')
    cache = Path(subprocess.check_output(['go', 'env', 'GOMODCACHE'], text=True).strip())
    missing = []
    for line in build_info.splitlines():
        parts = line.strip().split()
        if len(parts) >= 3 and parts[0] == 'dep':
            name, version = parts[1:3]; folder = cache / (name + '@' + version)
            found = [p for p in folder.iterdir() if p.is_file() and p.name.lower().startswith(('license', 'copying', 'notice'))] if folder.exists() else []
            if not found: missing.append(name + '@' + version)
            for src in found:
                dest = licenses / ('go-' + name.replace('/', '_')) / src.name
                dest.parent.mkdir(exist_ok=True); copy_file(src, dest)
    go_root = Path(subprocess.check_output(['go', 'env', 'GOROOT'], text=True).strip())
    copy_file(go_root / 'LICENSE', licenses / 'Go-LICENSE.txt')
    if missing: raise SystemExit('Missing cached dependency licenses: ' + ', '.join(missing))
    subprocess.run([sys.executable, '-m', 'PyInstaller', '--noconfirm', '--windowed', '--onedir', '--name', 'BreachCollector',
                    '--distpath', str(out), '--workpath', str(out / 'work'), '--specpath', str(out / 'spec'),
                    '--add-data', str(assets) + ';assets', '--collect-all', 'jsonschema_specifications',
                    str(ROOT / 'collector/app.py')], check=True)
    payload = out / 'BreachCollector'
    # Exact file list for uninstall: never recursively delete an arbitrary install folder.
    lines = []
    for file in payload.rglob('*'):
        if file.is_file(): lines.append('Delete "$INSTDIR\\' + str(file.relative_to(payload)) + '"')
    for folder in sorted((p for p in payload.rglob('*') if p.is_dir()), key=lambda p: len(p.parts), reverse=True):
        lines.append('RMDir "$INSTDIR\\' + str(folder.relative_to(payload)) + '"')
    uninstall = out / 'uninstall-files.nsh'; uninstall.write_text('\n'.join(lines), encoding='utf-8')
    subprocess.run([str(compiler), '/V2', '/DPAYLOAD=' + str(payload), '/DOUTPUT=' + str(out / 'BREACH-Collector-Setup-0.1.0.exe'),
                    '/DUNINSTALL_FILES=' + str(uninstall), str(ROOT / 'collector/installer.nsi')], check=True)
    hashes = {p.name: hashlib.file_digest(p.open('rb'), 'sha256').hexdigest() for p in [out / 'BREACH-Collector-Setup-0.1.0.exe', payload / 'BreachCollector.exe']}
    (out / 'SHA256SUMS.json').write_text(json.dumps(hashes, indent=2), encoding='utf-8')
    print('Built unsigned private preview:', out / 'BREACH-Collector-Setup-0.1.0.exe')


if __name__ == '__main__': main()
