#!/usr/bin/env python3
"""Build a deterministic standalone download without the SPCA website."""
import hashlib
import io
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NAME = 'spca-starter-kit'
EXCLUDED = {'.git', 'dist', 'node_modules', '__pycache__', 'work', '.spca-receipts', '.DS_Store'}
ACTIVE_SETTINGS = {'.claude/settings.json', '.claude/settings.local.json', '.codex/hooks.json'}


def package():
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for path in sorted(ROOT.rglob('*')):
            relative = path.relative_to(ROOT)
            if any(part in EXCLUDED for part in relative.parts) or path.suffix == '.pyc' or not path.is_file():
                continue
            if relative.as_posix() in ACTIVE_SETTINGS or path.name == '.env' or path.name.startswith('.env.') and path.name != '.env.example':
                continue
            if path.is_symlink():
                raise ValueError('Do not bundle symlinks: '+str(relative))
            info = zipfile.ZipInfo(NAME+'/'+relative.as_posix(), date_time=(2026,10,28,0,0,0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.create_system = 3
            info.external_attr = 0o100644 << 16
            archive.writestr(info, path.read_bytes())
    output = ROOT/'dist'/(NAME+'.zip')
    output.parent.mkdir(exist_ok=True)
    raw = buffer.getvalue()
    output.write_bytes(raw)
    digest = hashlib.sha256(raw).hexdigest()
    output.with_suffix('.zip.sha256').write_text(digest+'  '+output.name+'\n')
    print(str(output)+' '+digest)
    return output


if __name__ == '__main__':
    package()
