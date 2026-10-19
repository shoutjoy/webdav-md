import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
export async function cleanSystemMemory() {
  if (process.platform !== 'win32') throw new Error('Windows 로컬 서버에서 사용할 수 있습니다.');
  const script = `
$ErrorActionPreference='Stop'
Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public static class RamCleaner { [DllImport("kernel32.dll")] public static extern IntPtr OpenProcess(uint access, bool inherit, int id); [DllImport("psapi.dll")] public static extern bool EmptyWorkingSet(IntPtr handle); [DllImport("kernel32.dll")] public static extern bool CloseHandle(IntPtr handle); }'
$session=(Get-Process -Id $PID).SessionId
$count=0
Get-Process | Where-Object { $_.SessionId -eq $session -and $_.Id -ne $PID } | ForEach-Object {
  $handle=[RamCleaner]::OpenProcess(0x1100, $false, $_.Id)
  if ($handle -ne [IntPtr]::Zero) {
    try { if ([RamCleaner]::EmptyWorkingSet($handle)) { $count++ } }
    finally { [void][RamCleaner]::CloseHandle($handle) }
  }
}
@{processed=$count} | ConvertTo-Json -Compress`;
  const { stdout } = await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true, timeout: 20000, maxBuffer: 65536 });
  const result = JSON.parse(stdout.trim());
  if (!result.processed) throw new Error('정리 가능한 프로세스가 없습니다.');
  return result;
}
const snapshot = () => os.cpus().reduce((sum, cpu) => {
  sum.idle += cpu.times.idle;
  sum.total += Object.values(cpu.times).reduce((a, b) => a + b, 0);
  return sum;
}, { idle: 0, total: 0 });
export const percent = value => typeof value === 'number' && Number.isFinite(value)
  ? Math.round(Math.max(0, Math.min(100, value))) : null;

export function createSystemUsageMiddleware({ cleanup = cleanSystemMemory } = {}) {
  let previous = snapshot();
  let cached = null;
  let updated = 0;
  let pending;
  let cleaning = false;
  async function collect() {
    const current = snapshot();
    const elapsed = current.total - previous.total;
    const cpu = elapsed > 0 ? percent(100 * (1 - (current.idle - previous.idle) / elapsed)) : null;
    previous = current;
    const result = { cpu, ram: percent(100 * (1 - os.freemem() / os.totalmem())), gpu: null, npu: null };
    if (process.platform === 'win32') {
      // Missing counters remain unavailable; never substitute a fabricated zero.
      const script = `$ErrorActionPreference='SilentlyContinue'; $r=@{}; foreach ($kind in @('GPU','NPU')) { $s=(Get-Counter ('\\'+$kind+' Engine(*)\\Utilization Percentage') -ErrorAction SilentlyContinue).CounterSamples; if ($s) { $groups=$s | Group-Object { $_.InstanceName -replace '^pid_\\d+_','' }; $totals=$groups | ForEach-Object { ($_.Group | Measure-Object -Property CookedValue -Sum).Sum }; $r[$kind.ToLower()]=($totals | Measure-Object -Maximum).Maximum } }; $r | ConvertTo-Json -Compress`;
      try {
        const { stdout } = await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true, timeout: 6000, maxBuffer: 65536 });
        const counters = JSON.parse(stdout.trim());
        result.gpu = percent(counters.gpu);
        result.npu = percent(counters.npu);
      } catch { /* Driver counters may be absent. CPU and RAM still work. */ }
    }
    cached = result;
    updated = Date.now();
    return result;
  }
  return async (req, res, next) => {
    const path = req.url?.split('?')[0];
    if (!['/api/system-usage', '/api/system-memory-cleanup'].includes(path)) return next();
    const isCleanup = path === '/api/system-memory-cleanup';
    if (req.method !== (isCleanup ? 'POST' : 'GET')) { res.statusCode = 405; res.end(); return; }
    const address = req.socket.remoteAddress;
    if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address)) {
      res.statusCode = 403; res.end(); return;
    }
    if (isCleanup) {
      // Require a same-origin, explicit application request before touching processes.
      const headers = req.headers || {};
      let sameOrigin = false;
      try { sameOrigin = new URL(headers.origin).host === headers.host; } catch { /* Reject missing/invalid Origin. */ }
      if (!sameOrigin || headers['x-memory-cleanup'] !== '1') { res.statusCode = 403; res.end(); return; }
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'no-store');
      if (cleaning) { res.statusCode = 409; res.end(JSON.stringify({ error: 'RAM 정리가 진행 중입니다.' })); return; }
      cleaning = true;
      const before = os.freemem();
      try {
        const result = await cleanup();
        updated = 0;
        res.end(JSON.stringify({ ...result, releasedMB: Math.max(0, Math.round((os.freemem() - before) / 1048576)), ram: percent(100 * (1 - os.freemem() / os.totalmem())) }));
      } catch {
        res.statusCode = 503;
        res.end(JSON.stringify({ error: 'RAM 정리 실패 · Windows 로컬 서버와 프로세스 접근 권한을 확인하세요.' }));
      } finally { cleaning = false; }
      return;
    }
    try {
      if (!cached || Date.now() - updated > 2000) {
        if (!pending) pending = collect().finally(() => { pending = null; });
        await pending;
      }
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'no-store');
      res.end(JSON.stringify(cached));
    } catch { res.statusCode = 503; res.end(); }
  };
}
