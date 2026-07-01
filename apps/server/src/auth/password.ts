import { hash, verify } from '@node-rs/argon2';

export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, { algorithm: 2 /* Argon2id */ });
}

export async function verifyPassword(storedHash: string, plain: string): Promise<boolean> {
  return verify(storedHash, plain);
}
