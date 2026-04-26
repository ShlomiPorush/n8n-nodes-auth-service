# n8n-nodes-auth-service

Custom [n8n](https://n8n.io/) community nodes for integrating with [**Auth Service**](https://github.com/ShlomiPorush/auth-master) — a self-hosted token authentication and authorization service.

## What is Auth Service?

[Auth Service](https://github.com/ShlomiPorush/auth-master) is a self-hosted microservice that manages API tokens and authorization. It provides:

- **Token management** — create, edit, revoke tokens with granular per-zone permissions
- **Zone-based authorization** — define zones (e.g. `orders`, `billing`) with `read`/`write`/`delete`/`all` access levels
- **Fast validation** — validate tokens via a simple REST API (`POST /validate`)
- **Admin dashboard** — modern web UI with MFA protection
- **Docker deployment** — runs as a Docker container with Redis + SQLite/PostgreSQL

### Quick Setup

```yaml
# docker-compose.yml
services:
  redis:
    image: redis:7-alpine
    command: redis-server --requirepass changeme

  auth-service:
    image: ghcr.io/shlomiporush/auth-service:latest
    ports:
      - "8080:8080"
    environment:
      REDIS_URL: redis://:changeme@redis:6379
      ADMIN_API_KEY: your-secret-api-key
    depends_on:
      - redis
```

Start with `docker compose up -d`, then open `http://localhost:8080` to set up your admin account.

For full documentation, see the [Auth Service repository](https://github.com/ShlomiPorush/auth-master).

---

## Nodes in this Package

| Node | Type | Description |
|---|---|---|
| **Auth Service** | Action | Full API access — validate tokens, manage zones & tokens |
| **Auth Webhook** | Trigger | Webhook with built-in token validation (replaces Webhook + IF) |

## Installation

### Community Nodes (Recommended)

1. Go to **Settings → Community Nodes** in your n8n instance
2. Click **Install a community node**
3. Enter `n8n-nodes-auth-service`
4. Click **Install**

### Manual Installation

```bash
cd ~/.n8n
npm install n8n-nodes-auth-service
# Restart n8n
```

## Credentials

Add an **Auth Service API** credential in n8n:

| Field | Description |
|---|---|
| **Base URL** | Your Auth Service address (e.g. `http://auth:8080`) |
| **API Key** | An API key from the Auth Service dashboard, or the `ADMIN_API_KEY` env var |

The credential is automatically tested on save by calling `GET /tokens/ping`.

---

## Auth Service Node

Full API access to your Auth Service instance.

### Operations

| Operation | Description | Required Scope |
|---|---|---|
| **Validate Token** | Check if a token is valid for a zone + permission level | _(public endpoint)_ |
| **List Zones** | Get all zones | `zones:read` |
| **Create Zone** | Create a new zone | `zones:write` |
| **List Tokens** | Get all tokens with their grants, status, and metadata | `tokens:read` |
| **Create Token** | Create a new token with zone/level grants | `tokens:write` |
| **Edit Token** | Update name, grants, active status, or expiration | `tokens:write` |
| **Delete Token** | Delete a token permanently | `tokens:write` |

### Example: Validate a token

```
Webhook → Auth Service (Validate Token) → IF (result == true) → Continue / Respond 403
```

**Output:**
```json
{ "result": true }
```

### Example: Automated setup

```
Trigger → Auth Service (Create Zone) → Auth Service (Create Token)
```

---

## Auth Webhook Node

A webhook trigger that **automatically validates tokens** before executing the workflow.

Instead of building this:
```
Webhook → Auth Service (Validate) → IF (result) → Continue
                                  → IF (!result) → Respond 403
```

Use a single node:
```
Auth Webhook → Continue (token already validated)
```

### Configuration

| Setting | Description |
|---|---|
| **HTTP Method** | GET, POST, PUT, PATCH, DELETE, HEAD |
| **Path** | The full URL path after `/webhook/` |
| **Auth Zone** | Zone to validate against (dynamic dropdown) |
| **Auth Level** | Read / Write / Delete / All |
| **Token Source** | Authorization Header (Bearer) or Custom Header |
| **Custom Header Name** | Header name when using Custom Header (e.g. `X-Auth-Token`) |
| **Respond** | Immediately / When Last Node Finishes |
| **Response Code** | HTTP status code to return on success (default: 200) |

### How it works

1. A request comes in to the webhook URL
2. The node extracts the token from the configured source (Authorization header or custom header)
3. The token is validated against Auth Service (`POST /validate` with the configured zone + level)
4. **Valid token** → workflow executes, next node receives `{ headers, params, query, body }`
5. **Invalid/missing token** → responds `403 Forbidden`, workflow does **NOT** execute

### Example: calling the webhook

```bash
curl -X POST https://your-n8n.com/webhook/my-api \
  -H "Authorization: Bearer tok_abc123" \
  -H "Content-Type: application/json" \
  -d '{"order_id": 42}'
```

---

## API Key Scopes

API keys can be created in the Auth Service dashboard with granular scopes:

| Scope | Description |
|---|---|
| `validate` | Validate tokens via the API |
| `tokens:read` | List tokens and zones |
| `tokens:write` | Create, edit, delete tokens |
| `zones:read` | List zones |
| `zones:write` | Create zones |

The `ADMIN_API_KEY` environment variable always has full access to all scopes.

## API Endpoints Used

| Endpoint | Method | Auth | Used By |
|---|---|---|---|
| `/tokens/ping` | `GET` | API Key | Credential test (no scope required) |
| `/tokens/zones` | `GET` | API Key | Auth Service (List Zones), Auth Webhook (zone dropdown) |
| `/tokens/zones` | `POST` | API Key | Auth Service (Create Zone) |
| `/tokens` | `GET` | API Key | Auth Service (List Tokens) |
| `/tokens` | `POST` | API Key | Auth Service (Create Token) |
| `/tokens/{id}` | `PATCH` | API Key | Auth Service (Edit Token) |
| `/tokens/{id}` | `DELETE` | API Key | Auth Service (Delete Token) |
| `/validate` | `POST` | None | Auth Service (Validate), Auth Webhook |

## License

MIT
