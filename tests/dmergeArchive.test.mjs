import assert from 'node:assert/strict';
import test from 'node:test';
import JSZip from 'jszip';
import { isDmergeFileName, readDmergeArchive } from '../src/dmergeArchive.js';

test('dmerge extension matching is case-insensitive', () => {
  assert.equal(isDmergeFileName('lecture.dmerge'), true);
  assert.equal(isDmergeFileName('LECTURE.DMERGE'), true);
  assert.equal(isDmergeFileName('lecture.docx'), false);
});

test('manifest display names and order become virtual tree documents', async () => {
  const zip = new JSZip();
  zip.file('documents/0000_internal.docx', new Uint8Array([1, 2, 3]));
  zip.file('documents/0001_second.docx', new Uint8Array([4, 5]));
  zip.file('manifest.json', JSON.stringify({ documents: [
    { display_name: '첫 문서.docx', archive_path: 'documents/0000_internal.docx', included: true },
    { display_name: '둘째 문서.docx', archive_path: 'documents/0001_second.docx', included: false, edited: true },
  ] }));
  const data = await zip.generateAsync({ type: 'uint8array' });
  const archive = await readDmergeArchive(data, '/강의/묶음.dmerge');

  assert.deepEqual(archive.documents.map((item) => item.name), ['첫 문서.docx', '둘째 문서.docx']);
  assert.equal(archive.documents[0].remotePath, '/강의/묶음.dmerge::documents/0000_internal.docx');
  assert.equal(archive.documents[1].included, false);
  assert.equal(archive.documents[1].edited, true);
  assert.deepEqual(new Uint8Array(await archive.zip.file(archive.documents[0].archivePath).async('arraybuffer')), new Uint8Array([1, 2, 3]));
});

test('archives without a manifest still list DOCX entries', async () => {
  const zip = new JSZip();
  zip.file('documents/fallback.docx', new Uint8Array([9]));
  zip.file('notes/readme.txt', 'ignored');
  const data = await zip.generateAsync({ type: 'uint8array' });
  const archive = await readDmergeArchive(data, '/fallback.dmerge');
  assert.deepEqual(archive.documents.map((item) => item.name), ['fallback.docx']);
});
