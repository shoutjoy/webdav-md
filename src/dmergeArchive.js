import JSZip from 'jszip';

const DMERGE_EXTENSION = /\.dmerge$/i;

export const isDmergeFileName = (name = '') => DMERGE_EXTENSION.test(name);

const basename = (path = '') => path.split('/').filter(Boolean).at(-1) || path;

export async function readDmergeArchive(data, archiveRemotePath) {
  const zip = await JSZip.loadAsync(data);
  let manifest = null;

  try {
    const manifestText = await zip.file('manifest.json')?.async('text');
    if (manifestText) manifest = JSON.parse(manifestText);
  } catch {
    // A valid ZIP without a readable manifest can still expose its DOCX files.
  }

  const manifestDocuments = Array.isArray(manifest?.documents) ? manifest.documents : [];
  const candidates = manifestDocuments.length
    ? manifestDocuments.map((document) => ({
        archivePath: String(document.archive_path || ''),
        displayName: String(document.display_name || basename(document.archive_path)),
        included: document.included !== false,
        edited: document.edited === true,
      }))
    : Object.values(zip.files)
        .filter((entry) => !entry.dir && /\.docx$/i.test(entry.name))
        .map((entry) => ({ archivePath: entry.name, displayName: basename(entry.name), included: true, edited: false }));

  const documents = candidates
    .filter((document) => document.archivePath && zip.file(document.archivePath))
    .map((document, index) => {
      const zipEntry = zip.file(document.archivePath);
      return {
        name: document.displayName,
        remotePath: `${archiveRemotePath}::${document.archivePath}`,
        isDirectory: false,
        isArchiveEntry: true,
        archiveRemotePath,
        archivePath: document.archivePath,
        included: document.included,
        edited: document.edited,
        size: zipEntry?._data?.uncompressedSize ?? 0,
        order: index,
      };
    });

  return { zip, manifest, documents };
}
