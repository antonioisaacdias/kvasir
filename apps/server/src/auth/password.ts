import { hash, verify } from '@node-rs/argon2';

export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, {
    algorithm: 2 /* Argon2id */,
    memoryCost: 19456 /* 19 MiB, OWASP minimum */,
    timeCost: 2,
    parallelism: 1,
  });
}

export async function verifyPassword(storedHash: string, plain: string): Promise<boolean> {
  return verify(storedHash, plain);
}
