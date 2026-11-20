// Usage: node scripts/provision-user.mjs <username> <display-name> [--admin]
// Reads temporary password from stdin; prints parameterized SQL for D1 import.
// Never commit or log the password or generated SQL. Redirect output to a private file.
import { randomBytes, pbkdf2Sync, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
const [username, displayName, flag] = process.argv.slice(2);
if (!username || !/^[a-z][a-z0-9_-]{2,63}$/.test(username) || !displayName || displayName.length > 120 || (flag && flag !== '--admin')) {
  process.stderr.write('Usage: node scripts/provision-user.mjs <username> <display-name> [--admin]\\n');
  process.exit(1);
}
if (process.stdin.isTTY) {
  process.stderr.write('Pipe a unique temporary password from a secure local input; do not pass it as a command argument.\\n');
  process.exit(1);
}
const password = readFileSync(0, 'utf8').replace(/\\r?\\n$/, '');
if (password.length < 12 || password.length > 128 || password === '12345678') {
  process.stderr.write('A unique password of 12–128 characters is required.\\n');
  process.exit(1);
}
const salt = randomBytes(32).toString('hex');
const hash = pbkdf2Sync(password, Buffer.from(salt, 'hex'), 310000, 32, 'sha256').toString('hex');
const quote = x => "'" + String(x).replaceAll("'", "''") + "'";
process.stdout.write('INSERT INTO users (id,username,display_name,password_hash,password_salt,password_iterations,is_platform_admin) VALUES (' + [randomUUID(),username,displayName,hash,salt,310000,flag==='--admin'?1:0].map(quote).join(',') + ');\\n');
