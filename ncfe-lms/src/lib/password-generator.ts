const LOWERS = 'abcdefghijkmnpqrstuvwxyz';
const UPPERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const DIGITS = '23456789';
const SYMBOLS = '!@#$%^&*-_=+';
const ALL = LOWERS + UPPERS + DIGITS + SYMBOLS;

export const DEFAULT_PASSWORD_LENGTH = 14;

function pick(charset: string): string {
  const buf = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buf);
  return charset[buf[0] % charset.length];
}

export function generatePassword(length: number = DEFAULT_PASSWORD_LENGTH): string {
  if (length < 8) throw new Error('Password length must be at least 8');

  const required = [pick(LOWERS), pick(UPPERS), pick(DIGITS), pick(SYMBOLS)];
  const remaining = Array.from({ length: length - required.length }, () => pick(ALL));
  const chars = [...required, ...remaining];

  for (let i = chars.length - 1; i > 0; i--) {
    const buf = new Uint32Array(1);
    globalThis.crypto.getRandomValues(buf);
    const j = buf[0] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}
