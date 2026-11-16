"""POSIX-only, opt-in real OpenCode 2.2.5/2.2.7 regression harness (stdlib only)."""
import argparse
from ipaddress import IPv4Address
import json
import os
from pathlib import Path
import re
import select
import signal
import struct
import subprocess
import tempfile
import time

from server import Fixture

MARKER = 'provider-colors-native:2.2.5'
PROJECT = 'Long synthetic project with enough characters to exercise native project fade'
HERE = Path(__file__).resolve().parent
PATHS = {'HOME': 'home', 'TMPDIR': 'tmp', 'XDG_CONFIG_HOME': 'config',
         'XDG_DATA_HOME': 'data', 'XDG_CACHE_HOME': 'cache', 'XDG_STATE_HOME': 'state',
         'OPENCODE_CONFIG_DIR': 'config/opencode'}


def environment(root):
    # Read only explicitly allowlisted public variables, never copy the parent env.
    return {'PATH': os.environ.get('PATH', os.defpath), 'TERM': 'xterm-256color',
            'COLORTERM': 'truecolor', 'LANG': 'en_US.UTF-8',
            **{key: str(root / suffix) for key, suffix in PATHS.items()},
            'OPENCODE_CONFIG_PROJECT_DISABLE': 'true',
            'OPENCODE_DISABLE_CLAUDE_CODE': 'true',
            'OPENCODE_DISABLE_MODELS_FETCH': 'true'}


def isolation(root, env):
    if not root.is_absolute() or root.resolve() != root or root.is_symlink():
        raise RuntimeError('noncanonical run root')
    if (root / 'allowed').read_text() != MARKER:
        raise RuntimeError('missing isolation sentinel')
    for key, suffix in PATHS.items():
        target = root / suffix
        if env.get(key) != str(target) or target.resolve() != target or not target.is_dir():
            raise RuntimeError('isolation failed: ' + key)
    if (root / PROJECT).resolve() != root / PROJECT:
        raise RuntimeError('noncanonical working directory')


def system_config_guard():
    # Fail closed for system-wide settings which HOME/XDG cannot isolate.
    targets = [Path('/etc/opencode'), Path('/Library/Application Support/opencode')]
    managed = Path('/Library/Managed Preferences')
    if managed.exists():
        targets.extend(managed.glob('**/ai.opencode.managed.plist'))
    if any(p.exists() or p.is_symlink() for p in targets):
        raise RuntimeError('system-wide OpenCode configuration present; use an isolated OS/container')


def provider_config(port):
    providers = {}
    for key, name in [('openai', 'Fixture Red'), ('fixture-green', 'Fixture Green'), ('fixture-unknown', 'Fixture Unknown')]:
        providers[key] = {'name': name, 'env': [], 'package': '@opencode/ai/providers/openai-compatible',
            'settings': {'baseURL': f'http://{IPv4Address(0x7f000001)}:{port}/v1', 'timeout': 2000, 'encoding': 'none'},
            'models': {model: {'name': 'Fixture model', 'limit': {'context': 131072, 'output': 128}}
                       for model in ['pc-fixture', 'pc-fixture-2']}}
    return {'model': 'openai/pc-fixture', 'update': 'disable', 'share': 'disabled',
            'enabled_providers': list(providers), 'providers': providers, 'compaction': {'auto': False}}


def process_group(pid):
    output = subprocess.run(['ps', '-axo', 'pid=,pgid=,stat='], check=True,
                            capture_output=True, text=True, env={'PATH': os.defpath}).stdout
    members = []
    for line in output.splitlines():
        fields = line.split()
        if len(fields) == 3 and int(fields[1]) == pid and not fields[2].startswith('Z'):
            members.append(int(fields[0]))
    return members


def launch(binary, root, env, timeout):
    import fcntl
    import pty
    import termios
    isolation(root, env)
    pid, master = pty.fork()
    if pid == 0:
        try:
            fcntl.ioctl(0, termios.TIOCSWINSZ, struct.pack('HHHH', 45, 140, 0, 0))
            os.chdir(root / PROJECT)
            os.execve(str(binary), [str(binary), '--standalone'], env)
        finally:
            os._exit(127)
    seq, total = 0, 0
    try:
        end = time.monotonic() + timeout
        while time.monotonic() < end and total < 8 * 1024 * 1024:
            if select.select([master], [], [], .1)[0]:
                try:
                    chunk = os.read(master, 65536)
                except OSError:
                    break
                if not chunk:
                    break
                total += len(chunk)  # Never log terminal contents.
            request = root / 'request.json'
            if request.exists():
                data = json.loads(request.read_text())
                if data.get('seq') != seq:
                    if (set(data) != {'seq', 'kind', 'x', 'y'} or data['kind'] not in ['hover', 'down', 'drag', 'up', 'right']
                        or any(type(data[key]) is not int for key in ['seq', 'x', 'y'])
                        or data['seq'] <= seq or not 1 <= data['x'] <= 140 or not 1 <= data['y'] <= 45):
                        raise RuntimeError('invalid mouse request')
                    code, suffix = {'hover': (35, 'M'), 'down': (0, 'M'), 'drag': (32, 'M'), 'up': (0, 'm'), 'right': (2, 'M')}[data['kind']]
                    os.write(master, f"\x1b[<{code};{data['x']};{data['y']}{suffix}".encode())
                    seq = data['seq']
                    (root / 'ack.json.tmp').write_text(json.dumps({'seq': seq}))
                    (root / 'ack.json.tmp').replace(root / 'ack.json')
            if (root / 'result.json').exists():
                break
    finally:
        # pty.fork creates a dedicated session/group; retain its leader until reaped.
        for sig in [signal.SIGTERM, signal.SIGKILL]:
            try:
                if os.getpgid(pid) != pid or os.getsid(pid) != pid:
                    raise RuntimeError('child lost owned process group')
                os.killpg(pid, sig)
            except ProcessLookupError:
                pass
            time.sleep(.3)
        os.close(master)
        os.waitpid(pid, 0)
        remaining = process_group(pid)
        (root / 'process-cleanup.json').write_text(json.dumps({'pid': pid, 'remaining': remaining}))
    return pid, remaining


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--opencode', required=True, type=Path, help='explicit OpenCode 2.2.5 or 2.2.7 executable (not a shell launcher)')
    parser.add_argument('--temp-parent', type=Path, help='existing parent for a private temporary run directory')
    parser.add_argument('--mode', choices=['null', 'alpha', 'text', 'drag'], default='null')
    parser.add_argument('--animations', action='store_true')
    parser.add_argument('--theme', action='store_true', help='exercise system theme changes in alpha/text mode')
    parser.add_argument('--timeout', type=int, default=120)
    args = parser.parse_args()
    if os.name != 'posix':
        parser.error('requires POSIX PTY and process groups')
    binary = args.opencode.resolve(strict=True)
    if not binary.is_file() or not os.access(binary, os.X_OK):
        parser.error('--opencode must be an executable file')
    if args.timeout < 1 or args.timeout > 600:
        parser.error('--timeout must be 1..600 seconds')
    system_config_guard()
    os.umask(0o077)
    parent = args.temp_parent.resolve(strict=True) if args.temp_parent else None
    root = Path(tempfile.mkdtemp(prefix='provider-colors-native-', dir=parent)).resolve()
    for suffix in [*PATHS.values(), PROJECT]:
        (root / suffix).mkdir(parents=True, exist_ok=True)
    (root / 'allowed').write_text(MARKER)
    env = environment(root)
    isolation(root, env)
    version = subprocess.run([str(binary), '--version'], cwd=root / PROJECT, env=env,
                             check=True, capture_output=True, text=True, timeout=15).stdout.strip()
    if not re.fullmatch(r'(?:opencode\s+)?v?2\.2\.(?:5|7)', version):
        raise RuntimeError('requires OpenCode 2.2.5 or 2.2.7')
    server = Fixture(root)
    remaining, pid = [], None
    try:
        (root / 'config/opencode/opencode.json').write_text(json.dumps(provider_config(server.port)))
        cli = {'theme': {'name': 'opencode' if args.theme else 'nord', 'mode': 'system' if args.theme else 'dark'},
            'animations': args.animations,
            'tabs': {'mode': 'on', 'layout': 'vertical', 'indicators': 'status', 'scope': 'cwd'},
            'session': {'sidebar': 'hide'}, 'attention': {'notifications': False, 'sound': False},
            'plugins': [{'package': str(HERE / 'driver'), 'options': {'fixtureRoot': str(root),
                'mode': args.mode, 'animationsTest': args.animations, 'themeTest': args.theme}}]}
        env['OPENCODE_CLI_CONFIG_CONTENT'] = json.dumps(cli)
        isolation(root, env)
        server.start()
        pid, remaining = launch(binary, root, env, args.timeout)
    finally:
        closed = server.close()
        process_cleanup = root / 'process-cleanup.json'
        if process_cleanup.exists():
            cleanup = json.loads(process_cleanup.read_text())
            pid, remaining = cleanup['pid'], cleanup['remaining']
        (root / 'cleanup.json').write_text(json.dumps({'pid': pid, 'remaining': remaining,
            'listenerClosed': closed, 'requests': server.requests,
            'permissionSent': server.permission_sent, 'permissionRejected': server.permission_rejected}))
        print(root)
    if not (root / 'result.json').exists():
        raise RuntimeError('native fixture produced no result; inspect isolated run directory')
    result = json.loads((root / 'result.json').read_text())
    assertions = result.get('assertions', {})
    print(json.dumps({'mode': args.mode, 'assertions': len(assertions),
                      'failed': [key for key, value in assertions.items() if value is not True]}))
    if result.get('failure') or not assertions or not all(value is True for value in assertions.values()) or remaining or not closed:
        raise RuntimeError('native regression failed; inspect result.json and cleanup.json')


if __name__ == '__main__':
    main()
