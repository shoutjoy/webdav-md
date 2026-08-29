import assert from 'node:assert/strict';
import { shouldFallbackToCopyDelete } from '../src/webdavMove.js';

assert.equal(shouldFallbackToCopyDelete(new TypeError('Failed to fetch')), true);
assert.equal(shouldFallbackToCopyDelete({ status: 400 }), true);
assert.equal(shouldFallbackToCopyDelete({ status: 403 }), true);
assert.equal(shouldFallbackToCopyDelete({ response: { status: 405 } }), true);
assert.equal(shouldFallbackToCopyDelete({ status: 501 }), true);
assert.equal(shouldFallbackToCopyDelete({ status: 401 }), false);
assert.equal(shouldFallbackToCopyDelete({ status: 404 }), false);
assert.equal(shouldFallbackToCopyDelete({ status: 412 }), false);

console.log('webdav move: copy/delete fallback status policy passed');
