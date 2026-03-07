# CREator Backend

> **Hackathon judges:** See [JUDGES.md](../JUDGES.md) for the complete local setup and evaluation guide.

Express API server for the CREator visual workflow builder. Handles Solidity compilation, CRE workflow simulation, file operations, and environment configuration.

## Requirements

- Node.js 22+
- npm

## Installation

```bash
npm install
```

## Running

### Development

```bash
npm run dev
```

Starts the server with hot-reload via 	sx watch. Connects to cre-orchestrator/ in the parent directory.

### Production

```bash
npm start
```

Runs server.production.ts directly with 	sx. The default port is 3001 unless overridden by the PORT environment variable.

## Endpoints

### GET /health

Returns the server status.

```json
{
  "status": "ok",
  "environment": "production",
  "timestamp": "2026-03-07T18:00:00.000Z"
}
```

### POST /api/compile

Compiles Solidity source code using solc and returns the ABI and bytecode.

Request:
```json
{ "sourceCode": "pragma solidity ^0.8.20; contract MyContract { ... }" }
```

Response (success):
```json
{ "success": true, "result": { "abi": [...], "bytecode": "0x..." } }
```

Response (error):
```json
{ "success": false, "errors": [{ "severity": "error", "formattedMessage": "..." }] }
```

### POST /api/write-file

Writes a file into the cre-orchestrator directory. Path is relative to the orchestrator root.

Request:
```json
{ "path": "workflows/main.ts", "content": "..." }
```

Response:
```json
{ "success": true, "message": "File written: /path/to/file" }
```

### POST /api/simulate

Simulates the workflow defined in cre-orchestrator/workflows/main.ts without requiring the CRE CLI or authentication. The server reads main.ts, parses all 
untime.log() calls (including expressions using variables and JSON.stringify), detects the trigger type from SDK imports, and returns output formatted to match the real CRE CLI simulation output.

Request body is ignored; the orchestrator path is always taken from the server configuration.

Response:
```json
{
  "success": true,
  "output": "cre workflow simulate workflows --target=staging-settings\n! Using default private key...\n..."
}
```

### GET /api/get-env-config

Reads the .env file in the cre-orchestrator directory and returns whether a valid private key is configured.

Response:
```json
{ "configured": true, "hasPrivateKey": true }
```

### POST /api/set-env-config

Writes a private key to the cre-orchestrator .env file.

Request:
```json
{ "privateKey": "64-hex-char-key" }
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| PORT | 3001 | Server port |
| FRONTEND_URL | http://localhost:5173 | Allowed CORS origin |
| NODE_ENV | development | Environment mode |
| ORCHESTRATOR_PATH | ../cre-orchestrator | Path to the orchestrator directory |

In production (Render/Docker), ORCHESTRATOR_PATH is resolved relative to __dirname automatically. Do not set it to an absolute path unless deploying to a known filesystem layout.

## Docker

The included Dockerfile uses Ubuntu 24.04 with Node.js 22 and installs all npm dependencies. No CRE CLI is required.

```bash
docker build -t creator-backend .
docker run -p 10000:10000 -e PORT=10000 creator-backend
```

## Architecture

- **Express 4** - HTTP server
- **solc 0.8.34** - Solidity compiler (bundled, no external toolchain)
- **tsx 4** - TypeScript execution without a separate build step
- **Simulation engine** - Custom Node.js parser that reads main.ts and produces CRE-formatted output (no CRE CLI dependency)
