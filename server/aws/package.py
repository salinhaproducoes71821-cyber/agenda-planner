"""Build a Lambda ZIP on Windows/Linux without copying secrets or dev dependencies."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import stat
import subprocess
import tempfile
import zipfile

SERVER = Path(__file__).resolve().parents[1]
OUTPUT = SERVER / '.aws-build'


def write_zip(stage, target):
    with zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
        for source in sorted(stage.rglob('*')):
            if source.is_symlink():
                raise ValueError(f'Symlink inesperado: {source.relative_to(stage)}')
            if not source.is_file():
                continue
            name = source.relative_to(stage).as_posix()
            data = source.read_bytes()
            if name == 'run.sh':
                data = data.replace(b'\r\n', b'\n')
            entry = zipfile.ZipInfo(name, (2026, 1, 1, 0, 0, 0))
            entry.create_system = 3
            entry.external_attr = (stat.S_IFREG | (0o755 if name == 'run.sh' else 0o644)) << 16
            entry.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(entry, data)


def verify_zip(target):
    with zipfile.ZipFile(target) as archive:
        names = set(archive.namelist())
        required = {'api.js', 'auth.js', 'database.js', 'validation.js', 'aws-runtime.js',
                    'run.sh', 'package.json', 'package-lock.json', 'node_modules/express/index.js'}
        required.update(p.relative_to(SERVER).as_posix() for p in (SERVER / 'public/music').glob('*.mp3'))
        missing = required - names
        if missing:
            raise ValueError(f'Arquivos ausentes: {sorted(missing)}')
        for name in names:
            parts = Path(name).parts
            if any(p == '.env' or p.startswith('.env.') or p in {'.git', '.aws-build'} for p in parts):
                raise ValueError(f'Arquivo inesperado: {name}')
            if name.startswith(('tests/', 'aws/', 'node_modules/jest/', 'node_modules/nodemon/')):
                raise ValueError(f'Arquivo de desenvolvimento inesperado: {name}')
        if b'\r' in archive.read('run.sh') or ((archive.getinfo('run.sh').external_attr >> 16) & 0o777) != 0o755:
            raise ValueError('Launcher deve ter LF e modo Unix 755.')
        unpacked = sum(item.file_size for item in archive.infolist())
        if unpacked > 220 * 1024 * 1024:
            raise ValueError('Pacote excede 220 MiB; reserve espaço para a layer do Lambda.')
        return {'files': len(names), 'zipBytes': target.stat().st_size, 'unpackedBytes': unpacked}


def main():
    OUTPUT.mkdir(exist_ok=True)
    npm = shutil.which('npm.cmd' if os.name == 'nt' else 'npm')
    if not npm:
        raise RuntimeError('Instale Node/npm antes de empacotar.')
    # Temp directory is created and cleaned strictly under server/.aws-build.
    with tempfile.TemporaryDirectory(prefix='stage-', dir=OUTPUT) as temporary:
        stage = Path(temporary).resolve()
        assert stage.is_relative_to(OUTPUT.resolve())
        for name in ('package.json', 'package-lock.json', '.npmrc'):
            shutil.copy2(SERVER / name, stage / name)
        subprocess.run([npm, 'ci', '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund', '--bin-links=false'], cwd=stage, check=True)
        (stage / '.npmrc').unlink()
        for source in SERVER.glob('*.js'):
            shutil.copy2(source, stage / source.name)
        shutil.copytree(SERVER / 'public/music', stage / 'public/music')
        shutil.copy2(SERVER / 'aws/run.sh', stage / 'run.sh')
        target = OUTPUT / 'agenda-backend.zip'
        write_zip(stage, target)
    report = verify_zip(target)
    report['sha256'] = hashlib.sha256(target.read_bytes()).hexdigest()
    report['file'] = str(target)
    (OUTPUT / 'manifest.json').write_text(json.dumps(report, indent=2), encoding='utf8')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
