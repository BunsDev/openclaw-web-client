# OpenClaw Client

A web-based chat interface for [OpenClaw](https://openclaw.ai) AI agents. Create multiple agents, manage conversations, upload files, and stream AI responses in real time — all through a clean, modern UI.

https://github.com/user-attachments/assets/500f4f44-13e8-4e08-8bfc-9b2458c22ae1

## Features

- **Multi-agent support** — Create and manage multiple OpenClaw agents, each with their own model, identity, and conversation history.
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

### Platform notes

- **macOS / Linux** — works out of the box.
- **Windows 10/11** — supported. Additionally requires:
  - **Git for Windows** (the auto-update flow uses `git`)
  - **Visual Studio Build Tools** (for native modules `better-sqlite3` and `node-pty`).
    Install with `npm install --global --production windows-build-tools` _or_ install the
    "Desktop development with C++" workload from the Visual Studio installer.
  - The legacy Python PTY fallback (`pty-bridge.py`) is POSIX-only and is automatically
    skipped on Windows — `node-pty` uses ConPTY there instead.
  - Run **PowerShell as Administrator** the first time you execute `npm start` so that
    `npm link` can create the global `openclaw_client` shim, and so that auto-start can
    be installed.

## Quick Start

```bash
git clone https://github.com/lotsoftick/openclaw_client.git
cd openclaw_client
npm start
```

`npm start` builds everything, deploys to `~/.openclaw_client`, installs an OS-appropriate auto-start (macOS **LaunchAgent**, Windows **Startup folder** shortcut), and installs the global **`openclaw_client`** command.

| Service  | URL                             |
| -------- | ------------------------------- |
| Client   | http://localhost:18800          |
| API      | http://localhost:18802          |
| API Docs | http://localhost:18802/api/docs |

> **Note:** API Docs (Swagger) are only available in development mode (`npm run dev`).

## Default Login

On first startup, a default admin user is created:

- **Email:** `admin@admin.com`
- **Password:** `123456`

## Service Commands

After `npm start`, the **`openclaw_client`** command works from any directory:

| Command                             | What it does                                                            |
| ----------------------------------- | ----------------------------------------------------------------------- |
| `openclaw_client start`             | Start servers from `~/.openclaw_client` (no build)                      |
| `openclaw_client stop`              | Stop servers                                                            |
| `openclaw_client restart`           | Stop + start                                                            |
| `openclaw_client status`            | Show service status                                                     |
| `openclaw_client uninstall`         | Remove auto-start, global CLI, api & client artifacts (keeps database)  |
| `openclaw_client uninstall --purge` | Also delete database (asks for confirmation)                            |

To rebuild after code changes, run **`npm start`** from the repo again.

## npm Scripts

| Command         | Description                                                    |
| --------------- | -------------------------------------------------------------- |
| `npm start`     | Build, deploy to `~/.openclaw_client`, LaunchAgent, global CLI |
| `npm run stop`  | Stop servers                                                   |
| `npm run dev`   | API (nodemon) + Client (Vite) in dev mode with hot reload      |
| `npm run setup` | Generate `api/.env` only                                       |

## Configuration

### Ports (`~/.openclaw_client/.env`)

Port configuration lives in a single user-level file at **`~/.openclaw_client/.env`**. It is created automatically on first run with sensible defaults.

| Variable      | Default | Description             |
| ------------- | ------- | ----------------------- |
| `API_PORT`    | `18802` | Port the API listens on |
| `CLIENT_PORT` | `18800` | Port the web UI uses    |

After changing a value, apply it with:

```bash
openclaw_client restart     # production (installed via `npm start`)
npm run dev                 # development
```

`api/.env`, the Vite dev/preview server, the built `serve.mjs`, `ALLOWED_DOMAIN`, `API_PUBLIC_URL`, and the bundled client's `VITE_API_BASE_URL` are all derived from this file, so both dev and production stay consistent.

### Environment Variables

Generated automatically on first run in `api/.env` (see `api/.env.example` for reference):

| Variable         | Default                  | Description                                       |
| ---------------- | ------------------------ | ------------------------------------------------- |
| `NODE_ENV`       | `development`            | Environment mode                                  |
| `JWT_SECRET`     | _(random)_               | Secret for JWT signing                            |
| `DB_PATH`        | `./data/openclaw.sqlite` | Path to SQLite database file                      |
| `PORT`           | _(API_PORT)_             | API listen port (driven by `~/.openclaw_client/.env`)    |
| `ALLOWED_DOMAIN` | _(CLIENT origin)_        | CORS allowed origin(s), comma-separated           |
| `API_PUBLIC_URL` | _(API origin)_           | Public base URL used for generated workspace URLs |

The client reads `VITE_API_BASE_URL` at build time; it is set automatically to match `API_PORT`. Override by setting it in `client/.env` only if you deploy behind a custom host.

To regenerate secrets, delete `api/.env` and run `npm run dev` or `npm run setup` again.

### Production Layout

When running `npm start`, built artifacts are deployed to `~/.openclaw_client/`:

```
~/.openclaw_client/
├── api/
│   ├── build/          # Compiled API (JavaScript)
│   ├── node_modules/   # Production dependencies only
│   └── .env            # Auto-generated on first deploy
├── client/
│   ├── dist/           # Built static frontend
│   └── serve.mjs       # Lightweight static file server
├── data/
│   └── openclaw.sqlite # SQLite database
└── openclaw.log        # Combined log output
```

The source directory is only needed for building. Production processes run entirely from `~/.openclaw_client/`.
