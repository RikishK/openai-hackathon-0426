# TTS Reader

Local-first text-to-speech reader for users who need audio access to text content.

## Bootstrap Foundation

This branch provides PR-01 scaffolding:

- npm workspace with frontend, backend, and shared contracts packages
- TypeScript baseline configuration across packages
- Local API server shell with core route placeholders
- React + Vite frontend shell with ingest, library, reader, and settings pages
- Lint, format, test, and typecheck scripts for each package

## Quick Start

```bash
npm install
npm run dev:backend
```

In another terminal:

```bash
npm run dev:frontend
```

- Frontend runs on `http://localhost:5173`
- Backend runs on `http://127.0.0.1:4310`

## Workspace Scripts

From repo root:

- `npm run lint`
- `npm run format`
- `npm run test`
- `npm run typecheck`
- `npm run build`
