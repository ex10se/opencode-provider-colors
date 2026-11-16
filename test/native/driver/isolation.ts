import {readFileSync, realpathSync} from 'node:fs';
import {isAbsolute, join} from 'node:path';

// Read-only gate: never create a sentinel to make a failed isolation check pass.
export function assertIsolation(root: unknown) {
  if (typeof root !== 'string' || !isAbsolute(root) || realpathSync(root) !== root)
    throw Error('native fixture requires a canonical absolute run root');
  if (readFileSync(join(root, 'allowed'), 'utf8') !== 'provider-colors-native:2.2.5')
    throw Error('native fixture sentinel missing');
  const paths = {HOME: 'home', XDG_CONFIG_HOME: 'config', XDG_DATA_HOME: 'data',
    XDG_CACHE_HOME: 'cache', XDG_STATE_HOME: 'state', TMPDIR: 'tmp',
    OPENCODE_CONFIG_DIR: 'config/opencode'};
  for (const [key, suffix] of Object.entries(paths)) {
    const expected = join(root, suffix);
    if (process.env[key] !== expected || realpathSync(expected) !== expected)
      throw Error(`native fixture isolation failed: ${key}`);
  }
  if (realpathSync(process.cwd()) !== join(root, 'Long synthetic project with enough characters to exercise native project fade'))
    throw Error('native fixture working directory is not isolated');
  return root;
}
