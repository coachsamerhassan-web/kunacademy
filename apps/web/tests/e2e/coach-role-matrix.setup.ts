/**
 * Playwright globalSetup: open SSH tunnel to VPS postgres.
 *
 * Opens:  localhost:15432  →  VPS:5432
 * Stores the tunnel child process PID in /tmp/kun-pg-tunnel.pid so
 * globalTeardown can kill it cleanly.
 *
 * The tunnel uses the same key + passphrase as /tmp/kun-ssh.sh.
 */

import { spawn } from 'child_process';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { Client } from 'pg';

const VPS_HOST = '72.61.110.211';
const VPS_PORT = 5432;
const LOCAL_TUNNEL_PORT = parseInt(process.env.TUNNEL_PORT ?? '15432', 10);
const SSH_KEY_PATH = process.env.VPS_SSH_KEY ?? '/Users/samer/Hostinger VPS';
const SSH_PASSPHRASE = 'kun';
const PID_FILE = '/tmp/kun-pg-tunnel.pid';

// How long to wait for the tunnel to be ready (ms)
const TUNNEL_READY_TIMEOUT = 15_000;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForPort(port: number, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  const DB_URL = `postgresql://kunacademy:O2SJHdu9JvDq1XLO6KridOqG8m5nXec1@localhost:${port}/kunacademy`;

  while (Date.now() < deadline) {
    try {
      const client = new Client({ connectionString: DB_URL, connectionTimeoutMillis: 2000 });
      await client.connect();
      await client.end();
      return; // tunnel is up
    } catch {
      await sleep(500);
    }
  }
  throw new Error(`SSH tunnel to localhost:${port} did not become ready within ${timeoutMs}ms`);
}

export default async function globalSetup(): Promise<void> {
  console.log(`\n[tunnel] Opening SSH tunnel: localhost:${LOCAL_TUNNEL_PORT} → ${VPS_HOST}:${VPS_PORT}`);

  // Copy key to a temp path with correct permissions (expect handles passphrase)
  // Use the expect wrapper pattern from /tmp/kun-ssh.sh
  const keyPath = '/tmp/vps-key-tunnel';

  // Ensure key file exists and has correct permissions
  const { execSync } = await import('child_process');
  try {
    execSync(`cp "${SSH_KEY_PATH}" "${keyPath}" && chmod 600 "${keyPath}"`, { stdio: 'pipe' });
  } catch (err) {
    throw new Error(`[tunnel] Failed to copy SSH key from "${SSH_KEY_PATH}": ${err}`);
  }

  // Use expect to handle the passphrase prompt for ssh -L tunnel.
  // IMPORTANT: set timeout -1 (infinite) so expect does NOT time out and kill the
  // SSH process while it is silently holding the tunnel open. The previous timeout
  // of (TUNNEL_READY_TIMEOUT/1000 + 10) seconds caused the tunnel to die mid-run
  // when the test suite ran longer than that window.
  // The passphrase prompt has its own 30s window (exp_continue loops back after send).
  // The outer timeout is set to -1 so the eof wait runs indefinitely.
  const expectScript = `
set timeout 30
spawn ssh -i ${keyPath} \\
  -o StrictHostKeyChecking=no \\
  -o BatchMode=no \\
  -o ServerAliveInterval=30 \\
  -o ServerAliveCountMax=999 \\
  -N \\
  -L ${LOCAL_TUNNEL_PORT}:localhost:${VPS_PORT} \\
  root@${VPS_HOST}
expect {
  "Enter passphrase" { send "${SSH_PASSPHRASE}\\r"; exp_continue }
  eof { exit 0 }
  timeout { set timeout -1; exp_continue }
}
`;

  const tunnel = spawn('expect', ['-c', expectScript], {
    detached: false,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  tunnel.stdout?.on('data', (d: Buffer) => {
    const line = d.toString().trim();
    if (line && !line.includes('spawn ssh') && !line.includes('passphrase')) {
      console.log(`[tunnel] ${line}`);
    }
  });

  tunnel.stderr?.on('data', (d: Buffer) => {
    const line = d.toString().trim();
    if (line) console.error(`[tunnel:err] ${line}`);
  });

  tunnel.on('exit', (code) => {
    if (code !== null && code !== 0) {
      console.error(`[tunnel] SSH process exited with code ${code}`);
    }
  });

  if (tunnel.pid) {
    writeFileSync(PID_FILE, String(tunnel.pid), 'utf8');
    console.log(`[tunnel] PID ${tunnel.pid} written to ${PID_FILE}`);
  }

  // Wait for tunnel to become usable
  try {
    await waitForPort(LOCAL_TUNNEL_PORT, TUNNEL_READY_TIMEOUT);
    console.log(`[tunnel] Ready on localhost:${LOCAL_TUNNEL_PORT}\n`);
  } catch (err) {
    // Kill the tunnel process if it failed to come up
    try { tunnel.kill(); } catch { /* ignore */ }
    throw err;
  }
}
