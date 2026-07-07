import fs from 'fs';
import path from 'path';

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile(path.join(__dirname, '..', '.env'));

export default {
  ADMIN_URL: process.env.ADMIN_URL || 'http://localhost:4200',
  USER_URL: process.env.USER_URL || 'http://localhost:4300',
  API_URL: process.env.API_URL || 'https://10w62wl2-7073.asse.devtunnels.ms',
  ADMIN_USERNAME: process.env.ADMIN_USERNAME,
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
  USER_USERNAME: process.env.USER_USERNAME,
  USER_PASSWORD: process.env.USER_PASSWORD,
  E2E_USER_USERNAME: process.env.E2E_USER_USERNAME,
  E2E_USER_EMAIL: process.env.E2E_USER_EMAIL,
  E2E_USER_PASSWORD: process.env.E2E_USER_PASSWORD,
};
