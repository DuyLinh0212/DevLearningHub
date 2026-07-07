import fs from 'fs';
import path from 'path';
import env from './env';

const ENV_PATH = path.join(__dirname, '..', '.env');

export function hasE2eUser(): boolean {
  return Boolean(env.E2E_USER_USERNAME && env.E2E_USER_PASSWORD);
}

export function generateE2eUser(seed: number | string) {
  const suffix = String(seed);
  return {
    username: `e2e_${suffix}`,
    email: `e2e_${suffix}@example.com`,
    password: 'E2eTest123!',
  };
}

export function persistE2eUser({ username, email, password }: { username: string; email: string; password: string }) {
  const block = `\nE2E_USER_USERNAME=${username}\nE2E_USER_EMAIL=${email}\nE2E_USER_PASSWORD=${password}\n`;
  fs.appendFileSync(ENV_PATH, block, 'utf8');
  env.E2E_USER_USERNAME = username;
  env.E2E_USER_EMAIL = email;
  env.E2E_USER_PASSWORD = password;
}

export function getE2eUser() {
  if (!hasE2eUser()) return null;
  return {
    username: env.E2E_USER_USERNAME as string,
    email: env.E2E_USER_EMAIL as string,
    password: env.E2E_USER_PASSWORD as string,
  };
}
