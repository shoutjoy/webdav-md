import test from 'node:test';
import assert from 'node:assert/strict';
import { imageTimeline, imageAtTime, slotImages } from '../mdpro/Apps/textToAudio/imageTimeline.js';
const images = [{ id: 'a', duration: 2 }, { id: 'b', duration: 3 }, { id: 'c', duration: 1 }];
test('equal image timing covers narration and transitions in list order', () => {
  const timeline = imageTimeline(images, 9);
  assert.deepEqual(timeline.map(item => [item.id, item.start, item.end]), [['a', 0, 3], ['b', 3, 6], ['c', 6, 9]]);
  assert.equal(imageAtTime(timeline, 3).id, 'b');
  assert.equal(imageAtTime(timeline, 9).id, 'c');
  assert.equal(imageTimeline([...images].reverse(), 9)[0].id, 'c');
});
test('custom image timing extends final frame and clips at narration end', () => {
  assert.deepEqual(imageTimeline(images, 10, 'custom').map(item => [item.start, item.end]), [[0, 2], [2, 5], [5, 10]]);
  assert.deepEqual(imageTimeline(images, 4, 'custom').map(item => [item.id, item.start, item.end]), [['a', 0, 2], ['b', 2, 4]]);
  assert.deepEqual(imageTimeline(images, 0), []);
  assert.equal(slotImages({ backgroundImage: 'legacy' })[0].src, 'legacy');
});
