import {execFileSync} from 'node:child_process';
import {readFileSync, readdirSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {platformGoEnv} from './go-env.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const env = platformGoEnv();

function run(command, args) {
  execFileSync(command, args, {cwd: root, env, stdio: 'inherit'});
}

function check() {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const frontend = JSON.parse(readFileSync(join(root, 'frontend/package.json'), 'utf8'));
  if (pkg.packageManager !== frontend.packageManager) {
    throw new Error('根目录与前端 package.json 的 packageManager 版本必须一致');
  }

  run(process.execPath, ['--test', 'scripts/version.test.mjs']);
  run(process.execPath, ['scripts/version.mjs', 'check', `v${frontend.version}`]);

  const rootFiles = readdirSync(root, {withFileTypes: true})
    .filter((entry) => entry.isFile() && entry.name.endsWith('.go'))
    .map((entry) => entry.name);
  const unformatted = execFileSync('gofmt', ['-l', ...rootFiles, 'internal'], {
    cwd: root, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'],
  }).trim();
  if (unformatted) throw new Error(`以下 Go 文件需要 gofmt：\n${unformatted}`);

  run('go', ['test', './...']);
  run('go', ['vet', './...']);
}

try {
  check();
} catch (error) {
  console.error(error.message);
  process.exitCode = error.status ?? 1;
}
