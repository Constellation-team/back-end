# CREator Backend

Backend API server for CREator that handles Solidity compilation, file operations, and CRE workflow simulations.

## Features

- 🔨 **Solidity Compilation**: Compile smart contracts using solc compiler
- 📝 **File Operations**: Write generated workflow files to cre-orchestrator directory
- 🎯 **CRE Simulations**: Execute `cre workflow simulate workflows` command (development only)
- ⚡ **Real-time Output**: Return compilation and simulation outputs to frontend

## Installation

```bash
npm install
```

## Running

### Development
```bash
npm run dev
```

### Production
```bash
npm start
```

The server will start on `http://localhost:3001` (development) or the PORT specified by environment variable (production).

## Endpoints

### POST /api/compile
Compiles Solidity source code and returns ABI and bytecode.

**Request Body:**
```json
{
  "sourceCode": "pragma solidity ^0.8.20; contract MyContract { ... }"
}
```

**Response (Success):**
```json
{
  "success": true,
  "result": {
    "abi": [...],
    "bytecode": "0x6080604052..."
  }
}
```

**Response (Error):**
```json
{
  "success": false,
  "errors": [
    {
      "severity": "error",
      "formattedMessage": "ParserError: Expected ';' but got '}'..."
    }
  ]
}
```

### POST /api/write-file
Writes a file to the specified path in the cre-orchestrator directory.

**Request Body:**
```json
{
  "path": "workflows/main.ts",
  "content": "// Your workflow code here"
}
```

**Response:**
```json
{
  "success": true,
  "message": "File written: /path/to/cre-orchestrator/workflows/main.ts"
}
```

### POST /api/simulate
Runs CRE workflow simulation (development/local only).

**Request Body:**
```json
{
  "orchestratorPath": "DEFAULT"
}
```

**Response:**
```json
{
  "success": true,
  "output": "Workflow compiled\n2026-02-16T22:28:05Z [SIMULATION] Simulator Initialized\n..."
}
```

### GET /health
Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "environment": "production",
  "message": "Backend is running",
  "timestamp": "2026-03-06T16:00:00.000Z"
}
```

## Environment Variables

- `PORT`: Server port (default: 3001)
- `FRONTEND_URL`: Frontend URL for CORS (default: http://localhost:5173)
- `NODE_ENV`: Environment mode (development/production)
- `ORCHESTRATOR_PATH`: Path to cre-orchestrator directory (default: ../cre-orchestrator)

## Docker Deployment

The Dockerfile is optimized for production deployment:

```bash
docker build -t creator-backend .
docker run -p 3001:3001 creator-backend
```

**Note**: The production Docker image is lightweight and only includes Node.js and npm dependencies. CRE CLI installation has been removed to avoid GitHub connectivity issues during builds.

## Development

```bash
npm run dev
```

This runs the server with hot-reload using tsx watch mode.

## Architecture

- **Express.js**: Web framework
- **solc**: Solidity compiler
- **tsx**: TypeScript execution
- **CORS**: Enabled for all origins (hackathon mode)
