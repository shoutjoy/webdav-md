const SOURCE_CODE_EXTENSIONS = new Set([
  'bash', 'c', 'conf', 'cpp', 'cs', 'css', 'env', 'go', 'h', 'hpp', 'ini',
  'java', 'js', 'jsx', 'json', 'php', 'py', 'rb', 'rs', 'sh', 'sql', 'toml',
  'ts', 'tsx', 'xml', 'yaml', 'yml',
]);

export function getFileNameExtension(fileName) {
  const match = String(fileName || '').toLowerCase().match(/\.([^.\\/]+)$/);
  return match ? match[1] : '';
}

export function isSourceCodeFile(fileName) {
  return SOURCE_CODE_EXTENSIONS.has(getFileNameExtension(fileName));
}

export function getCodeMirrorMode(fileName) {
  const extension = getFileNameExtension(fileName);
  if (extension === 'css') return 'css';
  if (extension === 'js' || extension === 'jsx') return 'javascript';
  if (extension === 'ts' || extension === 'tsx') return { name: 'javascript', typescript: true };
  if (extension === 'json') return { name: 'javascript', json: true };
  if (extension === 'xml') return 'xml';
  if (extension === 'py') return 'python';
  if (extension === 'sh' || extension === 'bash') return 'shell';
  if (extension === 'sql') return 'text/x-sql';
  if (extension === 'yaml' || extension === 'yml') return 'yaml';
  if (extension === 'toml' || extension === 'ini' || extension === 'conf' || extension === 'env') return 'properties';
  if (extension === 'go') return 'text/x-go';
  if (extension === 'rs') return 'text/x-rustsrc';
  if (extension === 'java') return 'text/x-java';
  if (extension === 'c' || extension === 'h') return 'text/x-csrc';
  if (extension === 'cpp' || extension === 'hpp') return 'text/x-c++src';
  if (extension === 'cs') return 'text/x-csharp';
  if (extension === 'php') return 'application/x-httpd-php';
  if (extension === 'rb') return 'ruby';
  return null;
}
