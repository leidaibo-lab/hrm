/** 在运行中的本机预览中验证页面与同源API/数据库链路，不写业务数据。 */
import assert from 'node:assert/strict';

const base = process.env.HRM_BASE_URL ?? 'http://127.0.0.1:3100';
const page = await fetch(base, {signal: AbortSignal.timeout(10000)});
assert.equal(page.status, 200);
assert.match(await page.text(), /环境就绪检查/);
const readiness = await fetch(new URL('/api/health/ready', base), {signal: AbortSignal.timeout(10000)});
assert.equal(readiness.status, 200);
assert.deepEqual(await readiness.json(), {status: 'ok', database: 'ok'});
console.log('页面与API/数据库就绪检查通过');
