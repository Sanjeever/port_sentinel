import {strict as assert} from 'node:assert';
import {spawnSync} from 'node:child_process';
import {copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {test} from 'node:test';

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'port-sentinel-version-'));
  t.after(() => rmSync(root, {recursive: true, force: true}));
  for (const dir of ['scripts', 'frontend', 'docs/releases']) mkdirSync(join(root, dir), {recursive: true});
  copyFileSync(new URL('./version.mjs', import.meta.url), join(root, 'scripts/version.mjs'));
  const packagePath = join(root, 'frontend/package.json');
  const configPath = join(root, 'wails.json');
  writeFileSync(packagePath, '{"name":"test","version":"1.3.2"}\n');
  writeFileSync(configPath, '{"name":"test","info":{"productVersion":"1.3.2","companyName":"test"}}\n');
  return {
    packagePath, configPath,
    notes: (version, text) => writeFileSync(join(root, `docs/releases/${version}.md`), text),
    run: (...args) => spawnSync(process.execPath, [join(root, 'scripts/version.mjs'), ...args], {cwd: join(root, 'frontend'), encoding: 'utf8'}),
  };
}

test('缺少或空白日志时 bump 失败，两个版本文件保持原值', t => {
  const f = fixture(t);
  const before = [f.packagePath, f.configPath].map(path => readFileSync(path, 'utf8'));
  const missing = f.run('bump', '1.4.0');
  assert.notEqual(missing.status, 0);
  assert.match(missing.stderr, /缺少更新日志/);
  f.notes('1.4.0', '\n \t\r\n');
  const empty = f.run('bump', '1.4.0');
  assert.notEqual(empty.status, 0);
  assert.match(empty.stderr, /更新日志不能为空/);
  assert.deepEqual([f.packagePath, f.configPath].map(path => readFileSync(path, 'utf8')), before);
});

test('bump 同步版本，保留其他配置，并要求日志随版本提交', t => {
  const f = fixture(t);
  const notes = '## 新增\n\n- 端口详情与连接筛选。\n';
  f.notes('1.4.0', notes);
  const result = f.run('bump', '1.4.0');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /docs\/releases\/1\.4\.0\.md 放入同一个提交/);
  assert.deepEqual(JSON.parse(readFileSync(f.packagePath, 'utf8')), {name: 'test', version: '1.4.0'});
  assert.deepEqual(JSON.parse(readFileSync(f.configPath, 'utf8')), {name: 'test', info: {productVersion: '1.4.0', companyName: 'test'}});
  assert.equal(readFileSync(join(f.packagePath, '../../docs/releases/1.4.0.md'), 'utf8'), notes);
  const check = f.run('check', 'v1.4.0');
  assert.equal(check.status, 0, check.stderr);
});

test('发布检查拒绝日志遗漏、空白日志和版本不匹配', t => {
  const f = fixture(t);
  assert.match(f.run('check', 'v1.3.2').stderr, /缺少更新日志/);
  f.notes('1.3.2', ' \n');
  assert.match(f.run('check', 'v1.3.2').stderr, /更新日志不能为空/);
  f.notes('1.3.2', '- 修复连接刷新。\n');
  assert.equal(f.run('check', 'v1.3.2').status, 0);
  assert.match(f.run('check', 'v1.4.0').stderr, /版本不一致/);
  writeFileSync(f.configPath, '{"info":{"productVersion":"1.3.1"}}');
  assert.match(f.run('check', 'v1.3.2').stderr, /版本不一致/);
});

test('非法版本不写入文件', t => {
  const f = fixture(t);
  const before = readFileSync(f.packagePath, 'utf8');
  for (const value of ['1.4', 'v1.4.0', '1.4.0-rc.1', '../1.4.0']) {
    const result = f.run('bump', value);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /请输入正式版本/);
  }
  assert.equal(readFileSync(f.packagePath, 'utf8'), before);
});
