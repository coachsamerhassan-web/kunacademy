/**
 * Playwright globalTeardown: close the SSH tunnel opened in globalSetup.
 */

import { readFileSync, existsSync, unlinkSync } from 'fs';

const PID_FILE = '/tmp/kun-pg-tunnel.pid';

export default async function globalTeardown(): Promise<void> {
  if (!existsSync(PID_FILE)) {
    console.log('[tunnel] No PID file found — tunnel may have already closed.');
    return;
  }

  const pid = parseInt(readFileSync(PID_FILE, 'utf8').trim(), 10);
  if (isNaN(pid)) {
    console.warn('[tunnel] Invalid PID in file, skipping kill.');
    return;
  }

  try {
    process.kill(pid, 'SIGTERM');
    console.log(`[tunnel] Sent SIGTERM to PID ${pid}`);
  } catch (err: any) {
    if (err.code !== 'ESRCH') {
      console.error(`[tunnel] Failed to kill PID ${pid}:`, err.message);
    } else {
      console.log(`[tunnel] PID ${pid} already gone.`);
    }
  }

  try {
    unlinkSync(PID_FILE);
  } catch {
    // ignore
  }
}
