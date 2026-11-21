// Create a staff account directly in Postgres.
// Usage: node scripts/create-admin.mjs <email> <password> <admin|worker> ["Full Name"]
// Reads DATABASE_URL from the environment or .env.local in the project root.
import { readFileSync } from 'fs';
import { randomBytes, scryptSync } from 'crypto';
import { Client } from 'pg';

function loadEnv() {
  if (process.env.DATABASE_URL || process.env.POSTGRES_URL) return;
  try {
    const text = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
    for (const line of text.split('\n')) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
    }
  } catch {
    // .env.local is optional when environment variables are set externally.
  }
}

function hashPassword(password) {
  const salt = randomBytes(16);
  const derived = scryptSync(String(password), salt, 64);
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`;
}

async function main() {
  const [email, password, role = 'worker', ...nameParts] = process.argv.slice(2);
  const fullName = nameParts.join(' ').trim();

  if (!email || !password || password.length < 12 || !['admin', 'worker'].includes(role)) {
    console.error('Usage: node scripts/create-admin.mjs <email> <password> <admin|worker> ["Full Name"]');
    console.error('Password must be at least 12 characters.');
    process.exit(1);
  }

  loadEnv();
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!connectionString) {
    console.error('No database URL found. Set DATABASE_URL or run `vercel env pull .env.local`.');
    process.exit(1);
  }

  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    const result = await client.query(
      `INSERT INTO admin_users (email, full_name, role, password_hash, is_active)
       VALUES ($1, $2, $3, $4, TRUE)
       RETURNING id, email, role`,
      [email.trim().toLowerCase(), fullName || null, role, hashPassword(password)]
    );
    console.log(`Created ${result.rows[0].role} account: ${result.rows[0].email} (id ${result.rows[0].id})`);
  } catch (error) {
    if (error.code === '23505') {
      console.error('An account with that email already exists. Use the dashboard to reset its password.');
    } else {
      console.error(error.message);
    }
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
