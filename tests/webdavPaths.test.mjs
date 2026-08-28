import assert from 'node:assert/strict';
import { normalizeRemotePath } from '../src/webdavPaths.js';

const cases = new Map([
  ['/./생성형인공지능', '/생성형인공지능'],
  ['/./학회연구자료/문서.md', '/학회연구자료/문서.md'],
  ['//mdpro sample문서.md', '/mdpro sample문서.md'],
  ['/__webdav_proxy//./논문심사/../연구지도', '/연구지도'],
  ['/', '/'],
]);

for (const [input, expected] of cases) {
  assert.equal(normalizeRemotePath(input), expected, `${input} should normalize to ${expected}`);
}

console.log(`webdav path normalization: ${cases.size} cases passed`);
