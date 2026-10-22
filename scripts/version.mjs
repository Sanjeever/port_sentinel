import {existsSync, readFileSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const packagePath = resolve(root, 'frontend/package.json');
const configPath = resolve(root, 'wails.json');
const pkg = JSON.parse(readFileSync(packagePath, 'utf8'));
const config = JSON.parse(readFileSync(configPath, 'utf8'));
const versionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
function checkNotes(version) {
  const path = resolve(root, 'docs/releases', `${version}.md`);
  if (!existsSync(path)) throw new Error(`缺少更新日志，请先编写 docs/releases/${version}.md`);
  if (!readFileSync(path, 'utf8').trim()) throw new Error(`更新日志不能为空：docs/releases/${version}.md`);
}
const [command, value] = process.argv.slice(2);
if (command === 'bump') {
  if (!versionPattern.test(value ?? '')) throw new Error('请输入正式版本，例如 1.0.0');
  checkNotes(value);
  pkg.version = value;
  config.info = {...config.info, productVersion: value};
  writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n');
  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
  console.log(`版本已更新为 ${value}，请将版本文件与 docs/releases/${value}.md 放入同一个提交。`);
} else if (command === 'check') {
  if (!versionPattern.test(pkg.version) || value !== `v${pkg.version}` || config.info?.productVersion !== pkg.version) throw new Error('tag、package.json 与 wails.json 版本不一致');
  checkNotes(pkg.version);
} else throw new Error('用法：version.mjs bump <version> 或 check <tag>');
