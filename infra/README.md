- Place your device CA chain at infra/traefik/certs/device-ca-chain.crt
- Mount intermediate CA key/cert into signer only at infra/ca/
- Do NOT commit CA keys to git
- Use Vault/ACM PCA in prod; signer container is example only

