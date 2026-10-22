export const AUTOSAVE_INTERVAL_KEY = 'webdav-autosave-minutes';

export function normalizeAutosaveMinutes(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 1 ? Math.min(1440, Math.floor(number)) : 10;
}

// Start the deadline at the first edit; further typing updates the snapshot without postponing it.
export function createWebdavAutosave({ save, onSaved, setTimer = setTimeout, clearTimer = clearTimeout }) {
  let enabled = true;
  let minutes = 10;
  let pending = null;
  let timer = null;
  let busy = false;
  let generation = 0;
  function schedule() {
    if (!enabled || !pending || timer !== null || busy) return;
    timer = setTimer(async () => {
      timer = null;
      const snapshot = pending;
      const version = generation;
      if (!enabled || !snapshot) return;
      busy = true;
      try {
        const saved = await save(snapshot.content, snapshot.path);
        if (saved && version === generation) {
          if (pending === snapshot) pending = null;
          onSaved(snapshot);
        }
      } catch (error) {
        console.warn('WebDAV autosave failed:', error);
      } finally {
        busy = false;
        schedule();
      }
    }, minutes * 60000);
  }
  function cancel() {
    generation += 1;
    if (timer !== null) clearTimer(timer);
    timer = null;
    pending = null;
  }
  return {
    configure(nextEnabled, nextMinutes) {
      if (enabled === !!nextEnabled && minutes === normalizeAutosaveMinutes(nextMinutes)) return;
      enabled = !!nextEnabled;
      minutes = normalizeAutosaveMinutes(nextMinutes);
      if (timer !== null) clearTimer(timer);
      timer = null;
      schedule();
    },
    update(content, path, dirty) {
      if (!path || !dirty) { cancel(); return; }
      if (pending && pending.path !== path) cancel();
      pending = { content, path };
      schedule();
    },
    cancel
  };
}
