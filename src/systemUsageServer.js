import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const snapshot = () => os.cpus().reduce((sum, cpu) => {
  sum.idle += cpu.times.idle;
  sum.total += Object.values(cpu.times).reduce((a, b) => a + b, 0);
  return sum;
}, { idle: 0, total: 0 });
export const percent = value => typeof value === 'number' && Number.isFinite(value)
  ? Math.round(Math.max(0, Math.min(100, value))) : null;

export function createSystemUsageMiddleware() {
  let previous = snapshot();
  let cached = null;
  let updated = 0;
  let pending;
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
    if (req.url?.split('?')[0] !== '/api/system-usage') return next();
    if (req.method !== 'GET') { res.statusCode = 405; res.end(); return; }
    const address = req.socket.remoteAddress;
    if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address)) {
      res.statusCode = 403; res.end(); return;
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
