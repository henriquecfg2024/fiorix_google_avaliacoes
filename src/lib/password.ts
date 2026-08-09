import bcrypt from 'bcryptjs';

const BCRYPT_ROUNDS = 10;

export const MIN_PASSWORD_LENGTH = 6;

export function hashPassword(plainPassword: string) {
  return bcrypt.hash(plainPassword, BCRYPT_ROUNDS);
}

export function verifyPassword(plainPassword: string, passwordHash: string) {
  return bcrypt.compare(plainPassword, passwordHash);
}
