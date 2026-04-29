# TTS Reader

TTS Reader for visually impaired or blind users who need audio access to PDFs and text that do not yet have audiobook or braille offerings.

## What It Does

- Local-first web app + local backend (no cloud app server)
- Upload PDF, detect chapters, estimate cost, and generate speech audio
- Read generated audio in-app with resume support and downloads

## Prerequisites

- Node.js + npm
- OpenAI API key with access to audio generation

## Quick Start

```bash
npm install
export OPENAI_API_KEY="sk-..."
```

Start backend:

```bash
./scripts/start-backend.sh
```

Start frontend in another terminal:

```bash
./scripts/start-frontend.sh
```

- Frontend runs on `http://127.0.0.1:5173`
- Backend runs on `http://127.0.0.1:4310`

## Run Scripts

- `./scripts/start-backend.sh` - runs backend dev server
- `./scripts/start-frontend.sh` - runs frontend dev server

## Workspace Scripts

From repo root:

- `npm run lint`
- `npm run format`
- `npm run test`
- `npm run typecheck`
- `npm run build`
