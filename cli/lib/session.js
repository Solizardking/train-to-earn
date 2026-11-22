/**
 * session.js — local login session store.
 *
 * The session is { token, wallet, expiresAt } saved at
 * ~/.config/traintoearn/session.json (override the directory with the
 * TRAINTOEARN_CONFIG_DIR env var). The file is always written with 0600
 * permissions inside a 0700 directory: the token is a bearer credential.
 * No secret key material is ever stored here — only the API token the
 * server issued after a signature check.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export function sessionDir(explicitDir) {
  if (explicitDir) return explicitDir;
  if (process.env.TRAINTOEARN_CONFIG_DIR) return process.env.TRAINTOEARN_CONFIG_DIR;
  return path.join(os.homedir(), ".config", "traintoearn");
}

export function sessionPath(explicitDir) {
  return path.join(sessionDir(explicitDir), "session.json");
}

/** Save a session atomically with 0600 perms. Returns the file path. */
export function saveSession(session, explicitDir) {
  const dir = sessionDir(explicitDir);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  try {
    fs.chmodSync(dir, 0o700);
  } catch {
    /* best effort on exotic filesystems */
  }
  const file = sessionPath(explicitDir);
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, JSON.stringify(session, null, 2) + "\n", { mode: 0o600 });
  fs.renameSync(tmp, file);
  // rename() preserves the tmp file's mode, but enforce 0600 explicitly in
  // case the file previously existed with looser permissions.
  fs.chmodSync(file, 0o600);
  return file;
}

/** Load the session, or null when logged out / unreadable. */
export function loadSession(explicitDir) {
  try {
    const raw = fs.readFileSync(sessionPath(explicitDir), "utf8");
    const session = JSON.parse(raw);
    if (!session || typeof session.token !== "string" || typeof session.wallet !== "string") {
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

/** Delete the session file. Returns true when a file was removed. */
export function clearSession(explicitDir) {
  try {
    fs.unlinkSync(sessionPath(explicitDir));
    return true;
  } catch {
    return false;
  }
}

/** True when the session has an expiresAt in the past. */
export function sessionExpired(session, now = Date.now()) {
  if (!session?.expiresAt) return false;
  const t = Date.parse(session.expiresAt);
  return Number.isFinite(t) && t <= now;
}
