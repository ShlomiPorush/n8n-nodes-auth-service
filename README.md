# n8n-nodes-auth-service

Custom [n8n](https://n8n.io/) community nodes for integrating with an **Auth Service** instance.

This package provides **two nodes**:

| Node | Type | Description |
|---|---|---|
| **Auth Service** | Action | Full API access — validate tokens, manage zones & tokens |
| **Auth Webhook** | Trigger | Webhook with built-in token validation |

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

## Setup

Add an **Auth Service API** credential in n8n:
- **Base URL** — your Auth Service address (e.g. `http://auth:8080`)
- **API Key** — an API key from the Auth Service dashboard or the `ADMIN_API_KEY` env var

The credential is automatically tested on save.

---

## Auth Service Node

Full API access to your Auth Service instance.

### Operations

| Operation | Description | Required Scope |
|---|---|---|
| **Validate Token** | Check if a token is valid for a zone + permission level | _(public)_ |
| **List Zones** | Get all zones | `zones:read` |
| **Create Zone** | Create a new zone | `zones:write` |
| **List Tokens** | Get all tokens | `tokens:read` |
| **Create Token** | Create a new token with zone grants | `tokens:write` |
| **Edit Token** | Update name, grants, active status, or expiration | `tokens:write` |
| **Delete Token** | Delete a token | `tokens:write` |

### Example

**Validate a token:**
```
Webhook → Auth Service (Validate Token) → IF (result == true) → Continue
```

**Output:**
```json
{ "result": true }
```

---

## Auth Webhook Node

A webhook trigger that **automatically validates tokens** before executing the workflow. Replaces the common pattern of:

```
Webhook → Auth Service → IF → Continue / 403
```

With a single node:

```
Auth Webhook → Continue (already validated)
```

### Configuration

| Setting | Description |
|---|---|
| **HTTP Method** | GET, POST, PUT, PATCH, DELETE |
| **Path** | Webhook URL path |
| **Response Mode** | On Received / Using Respond to Webhook Node |
| **Auth Zone** | Zone to validate against (dynamic dropdown) |
| **Auth Level** | Read / Write / Delete / All |
| **Token Source** | Authorization Header (Bearer) or Custom Header / Field |

### Behavior

- **Valid token** → workflow executes, receives `{ headers, params, query, body }`
- **Invalid token** → responds `403 Forbidden`, workflow does NOT execute
- **No token** → responds `403 Forbidden`

---

## API Key Scopes

| Scope | Description |
|---|---|
| `validate` | Validate tokens |
| `tokens:read` | List tokens and zones |
| `tokens:write` | Create, edit, delete tokens |
| `zones:read` | List zones |
| `zones:write` | Create zones |

The `ADMIN_API_KEY` environment variable always has full access.

## License

MIT
