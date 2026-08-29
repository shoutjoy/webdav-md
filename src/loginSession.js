export const ACTIVE_LOGIN_SESSION_KEY = 'webdav-viewer-active-session';

export function readLoginSession(storage) {
  try {
    const session = JSON.parse(storage.getItem(ACTIVE_LOGIN_SESSION_KEY) || 'null');
    if (!session || typeof session !== 'object') return null;

    const url = typeof session.url === 'string' ? session.url : '';
    const username = typeof session.username === 'string' ? session.username : '';
    const password = typeof session.password === 'string' ? session.password : '';
    return url && username && password ? { url, username, password } : null;
  } catch {
    storage.removeItem(ACTIVE_LOGIN_SESSION_KEY);
    return null;
  }
}

export function writeLoginSession(storage, credentials) {
  storage.setItem(ACTIVE_LOGIN_SESSION_KEY, JSON.stringify({
    url: credentials.url,
    username: credentials.username,
    password: credentials.password,
  }));
}

export function clearLoginSession(storage) {
  storage.removeItem(ACTIVE_LOGIN_SESSION_KEY);
}
