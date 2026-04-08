# OpenClaw Client

A web-based chat interface for [OpenClaw](https://openclaw.ai) AI agents. Create multiple agents, manage conversations, upload files, and stream AI responses in real time — all through a clean, modern UI.

![OpenClaw Client](assets/screenshot.png)

## Features

- **Multi-agent support** — Create and manage multiple OpenClaw agents, each with their own identity and conversation history.
- **Streaming chat** — Real-time streamed responses with separate display for thinking process and output.
- **File uploads** — Attach files to messages; files are saved directly to the agent's workspace for context-aware responses.
- **Conversation management** — Multiple conversations per agent, editable titles, searchable sidebar.
- **User authentication** — JWT-based auth with a default admin account created on first run.
- **Theming** — 14 built-in color themes with a sidebar picker.

- **Client** — React 19 + Vite + Material UI + Redux Toolkit Query, organized with [Feature-Sliced Design](https://feature-sliced.design/)
- **API** — Express + TypeScript + TypeORM + SQLite — single server that also handles OpenClaw gateway communication and CLI execution

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [OpenClaw CLI](https://openclaw.ai) installed and authenticated on your machine

Verify OpenClaw is set up:

```bash
openclaw --version
openclaw auth status
```

## Quick Start

```bash
git clone https://github.com/lotsoftick/openclaw_client.git
cd openclaw_client
npm run start
```

On first run it will automatically:

1. Generate `api/.env` with a random JWT secret and default settings
2. Install API and client dependencies
3. Start both services with hot reload (API via nodemon, client via Vite)

Once running:

| Service  | URL                            |
|----------|--------------------------------|
| Client   | http://localhost:18800          |
| API      | http://localhost:18802          |
| API Docs | http://localhost:18802/api/docs |

> **Note:** API Docs (Swagger) are only available in development mode (`npm run dev`).

## Default Login

On first startup, a default admin user is created:

- **Email:** `admin@admin.com`
- **Password:** `123456`

## npm Scripts

| Command         | Description                                                          |
|-----------------|----------------------------------------------------------------------|
| `npm run dev`   | Install deps + start API (nodemon) and Client (Vite) in dev mode     |
| `npm start`     | Install deps + build both + run in production mode                   |
| `npm run stop`  | Kill processes on ports 18800/18802                                  |
| `npm run setup` | Only generate `api/.env` (no start)                                  |

## Stopping

```bash
npm run stop
```

Or press `Ctrl+C` in the terminal running `dev` or `start` — both services shut down together.

## Configuration

### Environment Variables

Generated automatically on first run in `api/.env` (see `api/.env.example` for reference):

| Variable           | Default                        | Description                              |
|--------------------|--------------------------------|------------------------------------------|
| `NODE_ENV`         | `development`                  | Environment mode                         |
| `JWT_SECRET`       | *(random)*                     | Secret for JWT signing                   |
| `DB_PATH`          | `./data/openclaw.sqlite`       | Path to SQLite database file             |
| `ALLOWED_DOMAIN`   | `http://localhost:18800`       | CORS allowed origin(s), comma-separated  |

The client uses `VITE_API_BASE_URL` (defaults to `http://localhost:18802/api`). Set it in `client/.env` if deploying to a different host.

To regenerate secrets, delete `api/.env` and run `npm run dev` or `npm run setup` again.
