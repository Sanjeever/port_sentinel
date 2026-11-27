import {execFileSync, spawn} from 'node:child_process';
import {existsSync, mkdirSync} from 'node:fs';
import {constants} from 'node:os';
import {delimiter, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const windows = process.platform === 'win32';
const tools = join(root, '.tools');
const wailsModule = 'github.com/wailsapp/wails/v2';
const wails = join(tools, windows ? 'wails.exe' : 'wails');

function readCommand(command, args, env) {
  return execFileSync(command, args, {
    cwd: root, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'],
  }).trim();
}

function installWails(env) {
  const version = readCommand('go', ['list', '-m', '-f', '{{.Version}}', wailsModule], env);
  if (existsSync(wails)) {
    const metadata = readCommand('go', ['version', '-m', wails], env);
    const matches = metadata.split('\n').some((line) => {
      const [kind, module, installedVersion] = line.trim().split(/\s+/);
      return kind === 'mod' && module === wailsModule && installedVersion === version;
    });
    if (matches) return;
  }

  mkdirSync(tools, {recursive: true});
  console.log(`正在安装 Wails CLI ${version} 到 .tools/`);
  execFileSync('go', ['install', `${wailsModule}/cmd/wails@${version}`], {
    cwd: root, env: {...env, GOBIN: tools}, stdio: 'inherit',
  });
}

function run() {
  const [action, ...args] = process.argv.slice(2);
  const env = {...process.env};
  const pathKey = Object.keys(env).find((key) => key.toLowerCase() === 'path') ?? 'PATH';
  env[pathKey] = `${tools}${delimiter}${env[pathKey] ?? ''}`;

  const tags = [];
  const linkFlags = [];
  if (process.platform === 'darwin') {
    env.MACOSX_DEPLOYMENT_TARGET = '12.0';
    env.CGO_CFLAGS = `${env.CGO_CFLAGS ?? ''} -mmacosx-version-min=12.0`.trim();
    env.CGO_LDFLAGS = `${env.CGO_LDFLAGS ?? ''} -mmacosx-version-min=12.0`.trim();
    env.GOFLAGS = `${env.GOFLAGS ?? ''} -ldflags=-linkmode=external`.trim();
    linkFlags.push('-linkmode=external');
  } else if (process.platform === 'linux') {
    env.GOFLAGS = `${env.GOFLAGS ?? ''} -tags=webkit2_41`.trim();
    tags.push('-tags', 'webkit2_41');
  }

  let command;
  switch (action) {
    case 'dev':
    case 'build': {
      const commit = readCommand('git', ['rev-parse', 'HEAD'], env);
      const releaseBuild = env.PORT_SENTINEL_RELEASE_BUILD || 'false';
      linkFlags.push(`-X main.releaseBuild=${releaseBuild}`, `-X main.buildCommit=${commit}`);
      command = [action, '-nosyncgomod', ...args, ...tags, '-ldflags', linkFlags.join(' ')];
      break;
    }
    case 'generate':
      command = ['generate', 'module', ...args];
      break;
    case 'doctor':
      command = ['doctor', ...args];
      break;
    default:
      throw new Error('用法：desktop.mjs dev|build|generate|doctor [Wails 参数]');
  }

  installWails(env);
  const child = spawn(wails, command, {cwd: root, env, stdio: 'inherit'});
  // Windows 控制台会向同一控制台内的进程分发 Ctrl+C。
  const interrupt = () => {
    if (!windows) child.kill('SIGINT');
  };
  const terminate = () => child.kill('SIGTERM');
  process.on('SIGINT', interrupt);
  process.on('SIGTERM', terminate);
  child.on('error', (error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
  child.on('close', (code, signal) => {
    process.off('SIGINT', interrupt);
    process.off('SIGTERM', terminate);
    if (process.exitCode !== 1) process.exitCode = code ?? (128 + constants.signals[signal]);
  });
}

try {
  run();
} catch (error) {
  console.error(error.message);
  process.exitCode = error.status ?? 1;
}
