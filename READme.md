####  Generate RSA keypair and base64 them (single-line) — used for device RS256 tokens

JWT_PRIVATE_PEM holds the raw PEM text (with newlines), while JWT_PRIVATE_KEY_B64 holds the same PEM encoded as a single-line base64 string.

```bash
# 1. generate PEM keypair
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out jwt_private.pem
openssl rsa -pubout -in jwt_private.pem -out jwt_public.pem

# 2. base64 single-line (safe to put into .env)
openssl base64 -A -in jwt_private.pem  > jwt_private.b64
openssl base64 -A -in jwt_public.pem   > jwt_public.b64

# 3. show them (copy the long lines into .env)
cat jwt_private.b64
cat jwt_public.b64

```

In production, use your secret manager to store the raw PEMs (not in .env), and set JWT_PRIVATE_KEY and JWT_PUBLIC_KEY_B64 envs or mount files. The base64-in-env is only a convenience for docker-compose.


# IoT Enrollment & Authentication — README

## Quick summary
Proven flow:  
**Device generates keypair locally → requests nonce → sends CSR + signature of nonce → server verifies PoP and signs CSR → device receives client certificate → Traefik enforces mTLS.**

Optionally: **device exchanges mTLS for a short-lived RS256 JWT** to call other APIs or reduce TLS handshakes.

> **Important:** Protect enrollment in production (bootstrap token, factory network, rate limiting, attestation).

---

## Controllers & Endpoints

### 1. `EnrollController` — `/device/enroll`
- **POST /device/enroll/challenge**
  - **Auth:** none (protect in prod)
  - **Request**
    ```json
    { "deviceId": "DEVICE123" }
    ```
  - **Response**
    ```json
    { "nonce": "uuid-v4-string" }
    ```
  - **Purpose:** create a one-time nonce (store in `device_nonces`, short TTL, unused).

- **POST /device/enroll/verify**
  - **Auth:** none (or mTLS for rotation)
  - **Request**
    ```json
    {
      "deviceId": "DEVICE123",
      "csrPem": "-----BEGIN CERTIFICATE REQUEST-----\n...",
      "nonce": "uuid-v4-string",
      "signatureB64": "BASE64(signature-of-nonce-with-device-private-key)"
    }
    ```
  - **Response**
    ```json
    { "cert": "-----BEGIN CERTIFICATE-----\n..." }
    ```
  - **Purpose:** verify nonce & PoP, mark nonce used, sign CSR, persist cert metadata.

---

### 2. `DeviceController` — `/device`
- **GET /device/ping**
  - **Auth:** mTLS (`DeviceCertGuard`)
  - **Response**
    ```json
    { "ok": true, "deviceId": "DEVICE123", "serial": "CERT_SERIAL" }
    ```
  - **Purpose:** sanity check; proves mTLS and attaches `req.device`.

- **POST /device/token**
  - **Auth:** mTLS (`DeviceCertGuard`)
  - **Response**
    ```json
    { "token": "<RS256 JWT>", "expiresIn": 600, "jti": "uuid-v4" }
    ```
  - **Purpose:** exchange mTLS identity for a short-lived RS256 JWT.

---

### 3. `AuthController` — `/auth` (optional)
- **POST /auth/device/token** — mTLS; same as `/device/token`.
- **POST /auth/login** — user login (username/password) → access + refresh tokens.
- **POST /auth/refresh** — refresh flow.

---

### 4. Admin / Management (examples)
- **POST /admin/device/:id/revoke** — mark device revoked (set `status='suspended'` / bump `tokenVersion`).
- **POST /admin/token/revoke** — blacklist a token JTI in Redis.

---

## Nonce lifecycle
1. Created by `POST /device/enroll/challenge` → stored in DB (`device_nonces`) with `expires_at` and `used=false`. TTL: short (recommended 2 minutes).
2. Consumed by `POST /device/enroll/verify`:
   - Server checks nonce exists, not expired, not used, and belongs to `deviceId`.
   - Server verifies CSR signature (CSR.verify()) and verifies PoP: `signatureB64` must verify using CSR public key over `nonce`.
   - On success: mark nonce `used = true`; sign CSR with CA; persist cert metadata to `device_certs`.
3. Nonce is single-use.

---

## Device-side step-by-step (copy-paste)

### 1. Generate private key and CSR (on device)
```bash
# RSA 4096
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:4096 -out device.key
openssl req -new -key device.key -subj "/CN=DEVICE123/O=MyOrg" -out device.csr


