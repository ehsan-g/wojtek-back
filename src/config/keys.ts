// src/config/keys.ts
import * as fs from "fs";

export function loadPrivateKeyFromEnv(): string | undefined {
  const raw = process.env.JWT_PRIVATE_PEM?.trim();
  const b64 = process.env.JWT_PRIVATE_KEY_B64?.trim();
  const file = process.env.JWT_PRIVATE_PEM_FILE;
  if (raw && raw.length) return raw;
  if (b64 && b64.length) return Buffer.from(b64, "base64").toString("utf8");
  if (file && fs.existsSync(file)) return fs.readFileSync(file, "utf8");
  return undefined;
}

export function loadPublicKeyFromEnv(): string | undefined {
  const raw = process.env.JWT_PUBLIC_PEM?.trim();
  const b64 = (
    process.env.JWT_PUBLIC_KEY_B64 ?? process.env.JWT_PUBLIC_PEM_B64
  )?.trim();
  const file = process.env.JWT_PUBLIC_PEM_FILE;
  if (raw && raw.length) return raw;
  if (b64 && b64.length) return Buffer.from(b64, "base64").toString("utf8");
  if (file && fs.existsSync(file)) return fs.readFileSync(file, "utf8");
  return undefined;
}
