# n8n-nodes-auth-service

Custom [n8n](https://n8n.io/) community node for integrating with an **Auth Service** instance.

## Features

| Operation | Description | Required Scope |
|---|---|---|
| **Validate Token** | Check if a token is valid for a specific zone and permission level | _None (public endpoint)_ |
| **Create Zone** | Create a new zone (area) in the Auth Service | `zones:write` |
| **Create Token** | Create a new API token with specific zone grants | `tokens:write` |

- **Dynamic zone list** — zones are loaded from the Auth Service API automatically (used in Validate and Create Token)
- **Permission levels** — `read`, `write`, `delete`, `all`
- **Credential test** — connection is verified automatically when saving credentials

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

### Development / Local

```bash
git clone https://github.com/ShlomiPorush/n8n-nodes-auth-service.git
cd n8n-nodes-auth-service
npm install
npm run build

# Link to your local n8n
npm link
cd ~/.n8n
npm link n8n-nodes-auth-service
# Restart n8n
```

## Setup

1. Add an **Auth Service API** credential in n8n:
   - **Base URL** — your Auth Service address (e.g. `http://auth:8080`)
   - **API Key** — an API key from the Auth Service dashboard (or the `ADMIN_API_KEY` env var)

2. The credential is automatically tested on save — it will call `GET /tokens/zones` to verify connectivity and permissions.

## Operations

### Validate Token

Checks if a given token has access to a zone at a certain permission level.

| Parameter | Description |
|---|---|
| **Token** | The API token to validate |
| **Zone** | Zone to validate against (loaded dynamically) |
| **Permission Level** | `read`, `write`, `delete`, or `all` |

**Output:**

```json
{ "result": true }
```

> The `/validate` endpoint is public — no API key is required.

### Create Zone

Creates a new zone in the Auth Service.

| Parameter | Description |
|---|---|
| **Zone Name** | Name for the new zone (e.g. `orders`, `billing`) |
| **Description** | Optional description |

**Requires** the API key to have the `zones:write` scope.

### Create Token

Creates a new API token with specific zone/level grants.

| Parameter | Description |
|---|---|
| **Token Name** | Label for the new token |
| **Grants** | Zone + permission level pairs (dynamic zone dropdown) |
| **Expires At** | Optional expiration date (ISO 8601) |

**Requires** the API key to have the `tokens:write` scope.

## Example Workflows

### Token Validation

```
Webhook → Auth Service (Validate) → IF (result == true) → Continue / Respond 403
```

### Automated Zone + Token Setup

```
Trigger → Auth Service (Create Zone) → Auth Service (Create Token)
```

## API Endpoints Used

| Endpoint | Method | Auth | Purpose |
|---|---|---|---|
| `/tokens/zones` | `GET` | API Key (`zones:read`) | Load zone list for dropdowns |
| `/validate` | `POST` | None | Validate a token |
| `/tokens/zones` | `POST` | API Key (`zones:write`) | Create a zone |
| `/tokens` | `POST` | API Key (`tokens:write`) | Create a token |

## API Key Scopes

API keys created in the Auth Service dashboard can have granular scopes:

| Scope | Description |
|---|---|
| `validate` | Validate tokens |
| `tokens:read` | List tokens and zones |
| `tokens:write` | Create, edit, delete tokens |
| `zones:read` | List zones |
| `zones:write` | Create zones |

The `ADMIN_API_KEY` environment variable always has full access to all scopes.

## License

MIT
