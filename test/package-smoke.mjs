// Full run only after the build/package-writer gate. Installs into a disposable
// consumer using the public registry; never publishes or changes the repository.
import assert from 'node:assert/strict';
import {builtinModules} from 'node:module';
import {mkdir, mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, posix} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const allowed = /^(?:package\.json|LICENSE|README(?:\.ru)?\.md|CONTRIBUTING\.md|SECURITY\.md|CHANGELOG\.md|docs\/[\w./-]+\.md|dist\/[\w/-]+\.m?js|dist\/tui\.d\.ts)$/;
assert(allowed.test('dist/tui.d.ts'));
assert(!allowed.test('dist/runtime.d.ts'));
assert(!allowed.test('dist/events.d.mts'));
const forbidden = /(?:\/Users\/|\/home\/[^/\s]+\/|file:\/\/|\.local\/share\/|fixtureRoot|fixtureHook|provider-colors-event-fixture|AIPX_|BEGIN [A-Z ]*PRIVATE KEY)/i;
const negativeControls = ['/Users/example/plugin.js', '/home/example/plugin.js',
  'file:///plugin.js', '.local/share/plugin',
  'fixtureRoot', 'fixtureHook', 'provider-colors-event-fixture', 'AIPX_TEST',
  'BEGIN RSA PRIVATE KEY'];
for (const value of negativeControls) {
  assert(forbidden.test(value));
  assert(forbidden.test(`example-provider ${value}`));
}
const arguments_ = process.argv.slice(2);
assert(arguments_.length === 0 || (arguments_.length === 1 && arguments_[0] === '--validators-only'),
  'usage: node test/package-smoke.mjs [--validators-only]');
const leaves = value => typeof value === 'string' ? [value] :
  Array.isArray(value) ? value.flatMap(leaves) : value && typeof value === 'object' ? Object.values(value).flatMap(leaves) : [];
if (arguments_[0] === '--validators-only') {
  console.log(JSON.stringify({validatorAssertions: 3 + negativeControls.length * 2, status: 'passed'}));
} else {
const temporary = await mkdtemp(join(tmpdir(), 'provider-colors-pack-'));
try {
  const packed = JSON.parse(execFileSync('npm', ['pack', '--json', '--ignore-scripts', '--pack-destination', temporary],
    {cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']}));
  assert.equal(packed.length, 1);
  const paths = new Set(packed[0].files.map(file => file.path));
  for (const path of paths) {
    assert(allowed.test(path) && !path.split('/').includes('..'), `unexpected packed path: ${path}`);
  }
  for (const path of ['package.json', 'LICENSE', 'README.md', 'dist/tui.js', 'dist/tui.d.ts'])
    assert(paths.has(path), `missing packed file: ${path}`);
  const archive = join(temporary, packed[0].filename);
  const members = execFileSync('tar', ['-tzf', archive], {encoding: 'utf8'}).trim().split('\n');
  for (const member of members)
    assert(member.startsWith('package/') && !member.split('/').includes('..'), 'unsafe tar member');
  execFileSync('tar', ['-xzf', archive, '-C', temporary]);
  const unpacked = join(temporary, 'package');
  const manifest = JSON.parse(await readFile(join(unpacked, 'package.json'), 'utf8'));
  assert.equal(manifest.name, 'opencode-provider-colors');
  assert.equal(manifest.type, 'module');
  assert(manifest.exports?.['./tui'], 'missing public ./tui export');
  for (const target of leaves(manifest.exports)) {
    assert(target.startsWith('./dist/') && paths.has(target.slice(2)), `invalid export: ${target}`);
  }
  const dependencies = new Set([...Object.keys(manifest.dependencies ?? {}), ...Object.keys(manifest.peerDependencies ?? {})]);
  const builtins = new Set(builtinModules.map(name => name.replace(/^node:/, '')));
  let imports = 0;
  for (const path of paths) {
    const content = await readFile(join(unpacked, path), 'utf8');
    assert(!forbidden.test(content), `private/local/debug artifact in ${path}`);
    // Both executable and public declaration imports must close over shipped
    // files or consumer dependencies. Development dependencies are never allowed.
    if (!/^dist\/.*\.(?:m?js|d\.ts)$/.test(path)) continue;
    // Static imports, re-exports, literal dynamic imports and require calls.
    const references = [...content.matchAll(/(?:\bfrom\s*|\bimport\s*(?:\(\s*)?|\brequire\s*\(\s*)["']([^"']+)["']/g)].map(match => match[1]);
    assert(!/\b(?:import|require)\s*\(\s*[^\s"']/.test(content), `nonliteral dependency in ${path}`);
    for (const reference of references) {
      imports++;
      if (reference.startsWith('.')) {
        const resolved = posix.normalize(posix.join(posix.dirname(path), reference));
        assert(resolved.startsWith('dist/') && paths.has(resolved), `missing import ${path} -> ${reference}`);
      } else {
        const packageName = reference.startsWith('@') ? reference.split('/').slice(0, 2).join('/') : reference.split('/')[0];
        assert(builtins.has(reference.replace(/^node:/, '')) || dependencies.has(packageName), `undeclared import ${path} -> ${reference}`);
      }
    }
  }
  // No symlinks or NODE_PATH: resolve the packed export through a fresh consumer's
  // own installation, including its public dependencies and automatically installed peers.
  const consumer = join(temporary, 'consumer');
  const home = join(temporary, 'home');
  await mkdir(consumer);
  await mkdir(home);
  const userConfig = join(temporary, 'user.npmrc'), globalConfig = join(temporary, 'global.npmrc');
  await writeFile(userConfig, '');
  await writeFile(globalConfig, '');
  await writeFile(join(consumer, 'package.json'), JSON.stringify({name: 'provider-colors-consumer', private: true, type: 'module'}));
  const env = {
    PATH: process.env.PATH ?? '/usr/bin:/bin', HOME: home, TMPDIR: temporary,
    XDG_CONFIG_HOME: join(home, 'config'), XDG_CACHE_HOME: join(home, 'cache'),
    XDG_DATA_HOME: join(home, 'data'), XDG_STATE_HOME: join(home, 'state'),
    npm_config_userconfig: userConfig, npm_config_globalconfig: globalConfig,
    npm_config_cache: join(temporary, 'npm-cache'), npm_config_registry: 'https://registry.npmjs.org/',
  };
  execFileSync('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund',
    '--registry=https://registry.npmjs.org/', archive],
    {cwd: consumer, env, timeout: 300_000, stdio: ['ignore', 'pipe', 'pipe']});
  const consumerLock = JSON.parse(await readFile(join(consumer, 'package-lock.json'), 'utf8'));
  const consumerPackages = Object.keys(consumerLock.packages).filter(key => key !== '');
  assert(consumerPackages.length > 0);
  assert(!consumerPackages.some(key => /(?:^|\/)node_modules\/@opencode\//.test(key)), 'SDK leaked into consumer installation');
  assert(!consumerPackages.some(key => /(?:^|\/)node_modules\/@opentui\//.test(key)), 'OpenTUI leaked into consumer installation');
  const consumerGraph = JSON.parse(execFileSync('npm', ['ls', '--all', '--json'],
    {cwd: consumer, env, timeout: 30_000, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']}));
  assert(!consumerGraph.problems?.length, 'consumer dependency graph has problems');
  const audit = JSON.parse(execFileSync('npm', ['audit', '--json', '--registry=https://registry.npmjs.org/'],
    {cwd: consumer, env, timeout: 60_000, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']}));
  assert.equal(audit.metadata.vulnerabilities.total, 0, 'consumer audit must be clean at every severity');
  await writeFile(join(consumer, 'consumer.ts'), `import plugin from 'opencode-provider-colors/tui';
const id: string = plugin.id;
const setup: (context: unknown) => (() => void) | undefined = plugin.setup;
void id; void setup;
`);
  await writeFile(join(consumer, 'tsconfig.json'), JSON.stringify({compilerOptions: {
    target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext',
    strict: true, skipLibCheck: false, noEmit: true, types: [],
  }, files: ['consumer.ts']}));
  const typeFiles = execFileSync(process.execPath, [join(root, 'node_modules/typescript/bin/tsc'),
    '--project', join(consumer, 'tsconfig.json'), '--listFiles'],
    {cwd: consumer, env, timeout: 30_000, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']});
  assert(!typeFiles.includes('/node_modules/@opencode/'), 'consumer declaration resolved SDK types');
  assert(typeFiles.includes('/node_modules/opencode-provider-colors/dist/tui.d.ts'), 'consumer did not resolve public declaration');
  const compilerLib = join(root, 'node_modules/typescript/lib') + '/';
  for (const path of typeFiles.trim().split('\n')) {
    assert(path.startsWith(consumer + '/') || (path.startsWith(compilerLib) && /\/lib\.[\w.]+\.d\.ts$/.test(path)),
      'consumer types escaped isolation (only compiler standard libraries may come from the repository)');
  }
  const probe = join(consumer, 'import.mjs');
  await writeFile(probe, `import assert from 'node:assert/strict';
import {realpathSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import plugin from 'opencode-provider-colors/tui';
const resolved = realpathSync(fileURLToPath(import.meta.resolve('opencode-provider-colors/tui')));
assert.equal(resolved, realpathSync(join(process.cwd(), 'node_modules/opencode-provider-colors/dist/tui.js')));
assert.equal(plugin.id, 'opencode-provider-colors');
assert.equal(typeof plugin.setup, 'function');
console.log('packed-consumer-import:passed');
`);
  const output = execFileSync('bun', ['--conditions=browser', probe],
    {cwd: consumer, env, timeout: 30_000, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']});
  assert(output.includes('packed-consumer-import:passed'), 'consumer import did not complete');
  console.log(JSON.stringify({package: manifest.name, version: manifest.version, files: paths.size,
    imports, declarations: [...paths].filter(path => /\.d\.(?:ts|mts)$/.test(path)),
    consumerImport: 'passed', consumerRuntime: 'bun/browser', consumerTypes: 'passed',
    consumerAudit: audit.metadata.vulnerabilities, consumerPackages, status: 'passed'}));
} finally {
  await rm(temporary, {recursive: true, force: true});
}
}
