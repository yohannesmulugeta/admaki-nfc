const encoder = new TextEncoder();
export const ITERATIONS = 100000; // Cloudflare Web Crypto's deployed per-call ceiling.
export const hex = value => Array.from(new Uint8Array(value), byte => byte.toString(16).padStart(2, '0')).join('');
export const randomToken = () => hex(crypto.getRandomValues(new Uint8Array(32)));
export const sha = async value => hex(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
export async function derive(password, salt, iterations, pepper) {
  if (!pepper || !/^[a-f0-9]{64}$/.test(salt) || !Number.isInteger(iterations) || iterations < 100000 || iterations > 100000) throw Error('Invalid authentication configuration');
  // Keep the pepper in a Worker secret, separately from the password database.
  const pepperKey = await crypto.subtle.importKey('raw', encoder.encode(pepper), {name:'HMAC',hash:'SHA-256'}, false, ['sign']);
  const prehash = await crypto.subtle.sign('HMAC', pepperKey, encoder.encode(password));
  const key = await crypto.subtle.importKey('raw', prehash, 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({name:'PBKDF2',salt:Uint8Array.from(salt.match(/../g),x=>parseInt(x,16)),iterations,hash:'SHA-256'},key,256));
}
export async function equalHash(left, right) {
  if (!/^[a-f0-9]{64}$/.test(left) || !/^[a-f0-9]{64}$/.test(right)) return false;
  // Verify an HMAC instead of comparing secret-derived strings directly.
  const key = await crypto.subtle.importKey('raw', encoder.encode(right), {name:'HMAC',hash:'SHA-256'}, false, ['sign','verify']);
  const message = encoder.encode('ADMAKI password verification');
  const otherKey = await crypto.subtle.importKey('raw',encoder.encode(left),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return crypto.subtle.verify('HMAC',key,await crypto.subtle.sign('HMAC',otherKey,message),message);
}
export function validPassword(value) { return typeof value === 'string' && value.length >= 12 && value.length <= 128 && !/^(.)\1+$/.test(value); }
