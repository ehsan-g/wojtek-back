#### 1- Generate RSA keypair and base64 them (single-line) — used for device RS256 tokens

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



