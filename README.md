# CREator Backend

Backend API server for CREator that handles file operations and CRE workflow simulations.

## Features

-  Write generated workflow files to cre-orchestrator directory
-  Execute `cre workflow simulate workflows` command
-  Return real-time simulation output to frontend

## Installation

```bash
npm install
```

## Running

```bash
npm start
```

The server will start on `http://localhost:3001`

## Endpoints

### POST /api/write-file
Writes a file to the specified path.

**Request Body:**
```json
{
  "path": "d:\\path\\to\\file.ts",
  "content": "file content here"
}
```

**Response:**
```json
{
  "success": true,
  "message": "File written: d:\\path\\to\\file.ts"
}
```

### POST /api/simulate
Runs CRE workflow simulation in the specified directory.

**Request Body:**
```json
{
  "orchestratorPath": "d:\\Proyectos\\Hackathon\\Chainlink\\cre-orchestrator"
}
```

**Response:**
```json
{
  "success": true,
  "output": "Workflow compiled\n2026-02-16T22:28:05Z [SIMULATION] Simulator Initialized\n..."
}
```

## Development

```bash
npm run dev
```

This runs the server with hot-reload using tsx watch mode.
