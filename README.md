# home-portal

Auth-protected workplace portal for OpenDesk Edu.

## Architecture

- **portal** (nginx:stable-alpine) — static HTML "Workplace Services" page
- **oauth2-proxy-home** — OAuth2 Proxy (OIDC) protecting `home.opendesk-edu.org`
- **oauth2-proxy-admin** — OAuth2 Proxy (OIDC) protecting `admin.home.opendesk-edu.org`
- **Ingress** — haproxy, TLS `opendesk-certificates-tls`

## Keycloak

- Realm: `opendesk` on `https://id.home.opendesk-edu.org`
- Clients: `home-portal`, `admin-home-portal` (confidential, OIDC)
- OIDC discovery: `https://id.home.opendesk-edu.org/realms/opendesk/.well-known/openid-configuration`
- Keycloak 26 uses `/realms/{realm}/` (no `/auth/` prefix)

## Secrets

Client and cookie secrets are SOPS-encrypted with age:
- `k8s/oauth2-proxy-secrets.enc.yaml` — encrypted with age key (ADR-001)
- Apply with: `sops -d k8s/oauth2-proxy-secrets.enc.yaml | kubectl apply -f -`
- `.sops.yaml` — SOPS config (encrypted_regex covers all secret fields)

## Deploy

```bash
# Apply secrets (SOPS-encrypted)
sops -d k8s/oauth2-proxy-secrets.enc.yaml | kubectl apply -f -

# Apply everything else
kubectl apply -k k8s/
```

## Image

`quay.io/oauth2-proxy/oauth2-proxy` pinned to digest (latest tag was removed from quay.io).
