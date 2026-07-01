<div align="center">
  <h1>Kvasir</h1>
  <p><em>In Norse myth, Kvasir was born from the truce-spit of two warring clans — the wisest being who ever lived. When he was killed, his blood became the mead of knowledge.</em></p>
</div>

---

[Calibre-Web-Automated](https://github.com/crocodilestick/Calibre-Web-Automated) (CWA) catalogs and serves ebooks beautifully, but it has no search-and-download UI of its own — "Get Books" is a Calibre-desktop feature CWA deliberately doesn't ship. Kvasir is the small companion service that fills that one gap: search legitimate public-domain sources, pick a book, and it lands straight in CWA's ingest folder — CWA's own watcher takes it from there. Kvasir never touches CWA's database or catalog; it only ever writes new files to a shared folder.

> **Scope is the whole point.** Kvasir only talks to curated public-domain catalogs (Project Gutenberg, Standard Ebooks) and, for broader reach, the Internet Archive — with its own license/restriction checks layered on top, since IA's metadata is uploader-declared and not fully trustworthy on its own. No torrents, no IRC, no scene sources.

## Features

- **Multi-source search** — one query fans out in parallel across every enabled adapter (`Promise.allSettled`); a source going down degrades to a partial result with a visible warning instead of failing the whole search.
- **Source adapters, pluggable** — [Project Gutenberg](https://www.gutenberg.org) (via [Gutendex](https://gutendex.com)), [Standard Ebooks](https://standardebooks.org) (via its OPDS catalog), and the [Internet Archive](https://archive.org). Adding a source is a new adapter behind a small interface — zero changes anywhere else.
- **Real download progress** — SSE stream reports actual bytes downloaded / total as the file transfers, with visible retry attempts on transient network errors and clean client-side abort propagation.
- **Download history** — every completed download is deduped by `(source, externalId)` in SQLite; already-downloaded books are flagged in search results and browsable on their own screen.
- **Cover, language, subject metadata** — shown on result cards whenever the source provides them.
- **Single-user auth** — first run registers the owner (Argon2id password hash); after that, a session cookie. No 2FA — small LAN-only tool, doesn't need the extra layer Tormod carries.
- **i18n** — UI defaults to English with a PT-BR toggle (custom dictionary, no i18n framework — the UI is ~30 strings).

## Technologies

**Backend:**
- [Node](https://nodejs.org) + [Hono](https://hono.dev) — HTTP routing and SSE streaming.
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) — download history + users + sessions.
- [@node-rs/argon2](https://github.com/napi-rs/node-rs) — password hashing.
- [fast-xml-parser](https://github.com/NaturalIntelligence/fast-xml-parser) — Standard Ebooks' OPDS (Atom/XML) catalog.
- TypeScript (strict) · [Vitest](https://vitest.dev) — adapters, download service, and auth are covered with real HTTP mocking at the `fetch` seam.

**Frontend:**
- [Vite](https://vitejs.dev) + React 18 + TypeScript (strict) + [Tailwind](https://tailwindcss.com) — search, result cards with progress bars, downloads list, auth screens.

## Status

Kvasir's v1 is complete and deployed: search + download across three sources, download history, real progress streaming, single-user auth, and a production image running as a TrueNAS Custom App next to Calibre-Web-Automated — deployed by CI on every push to `main`. This is a small, scope-limited tool by design; there's no roadmap toward a 1.0 beyond "keep it working and maybe add another public-domain source."

## Setup

Two processes during development — the API server and the Vite dev server (which proxies `/api` to the server, same-origin).

```bash
# Backend — apps/server
cd apps/server
npm install
npm test                  # vitest
npx tsc --noEmit          # typecheck

KVASIR_DATA_DIR=./data KVASIR_INGEST_DIR=./ingest npm run dev
```

```bash
# Frontend — apps/web
cd apps/web
npm install
npm run dev                # Vite on 0.0.0.0:5173, proxies /api -> 127.0.0.1:8790
```

Open `http://<host>:5173`. On first run the app shows a **registration** screen; after that it's a **login** screen. Auth rides in an httpOnly session cookie, no bearer token.

### HTTP API

All routes live under `/api`. Everything except `/api/health` and `/api/auth/*` requires a valid session.

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/health` | liveness check, no auth |
| `POST` | `/api/auth/register` | create the single user (only when none exists) |
| `POST` | `/api/auth/login` | password → session cookie |
| `POST` | `/api/auth/logout` | revoke the session, clear the cookie |
| `GET` | `/api/auth/me` | current user, drives session persistence across reloads |
| `GET` | `/api/search?q=` | fan-out search across all enabled adapters |
| `GET` | `/api/downloads` | download history |
| `POST` | `/api/download` | SSE stream: `progress` (bytes/total), `retrying`, `done`, `already`, `error` |

## Folder structure

```
.
├── apps/
│   ├── server/                 # backend (Node + Hono)
│   │   ├── src/
│   │   │   ├── adapters/       # SourceAdapter interface + gutenberg/standardEbooks/internetArchive
│   │   │   ├── auth/           # users, sessions, password (argon2id)
│   │   │   ├── db/             # downloads table (dedup by source + externalId)
│   │   │   ├── download/       # downloadService — retry, progress tracking, SSE-friendly streaming
│   │   │   ├── search/         # searchService — parallel fan-out across adapters
│   │   │   ├── http/           # Hono app — routes, session-cookie auth, SSE
│   │   │   └── server.ts       # entry point
│   │   └── package.json
│   └── web/                    # frontend (Vite + React + Tailwind)
│       └── src/                # search, downloads list, auth, i18n
├── docs/
│   └── superpowers/
│       ├── specs/               # design spec
│       └── plans/               # implementation plan
├── Dockerfile                    # multi-stage, non-root final image
├── compose.yaml                  # production reference (TrueNAS Custom App)
├── LICENSE                       # PolyForm Noncommercial 1.0.0
└── README.md
```

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `8790` | listening port |
| `KVASIR_DATA_DIR` | `/data` | SQLite database directory |
| `KVASIR_INGEST_DIR` | `/cwa-book-ingest` | shared folder Kvasir writes downloaded books into (CWA watches it) |
| `KVASIR_WEB_DIST` | `../web/dist` | path to the built frontend, served same-origin |

## Deployment

Runs as a non-root Docker container (`user: 568:568`, matching CWA's ingest-folder ownership on the TrueNAS host), same-origin (Hono serves the built React app, no CORS), next to the `calibre-web-automated` app on the same TrueNAS box. LAN-only via WireGuard — no public exposure, no TLS termination needed at this layer.

**Repositories & CI/CD:** Forgejo is the source of truth (dev + CI/CD); GitHub is a portfolio mirror, pushed alongside every Forgejo push. Two Forgejo Actions workflows: `quality.yml` runs the homelab's own code-gates suite (tsc, eslint, dependency-cruiser, vitest, semgrep, gitleaks, osv-scanner, SonarQube) on every push and PR; `deploy.yml` builds the Docker image and updates the TrueNAS Custom App on push to `main`.

## Contributing

**Not open to external contributions at this time.** This is a personal homelab project. Issues and discussion may be welcomed later, but pull requests are not being accepted for now.

## License

Licensed under the **[PolyForm Noncommercial License 1.0.0](LICENSE)**.

You may use, study, modify and share this software for **any noncommercial purpose**. **Commercial use is not permitted.** This is a *source-available* license, not an OSI "open source" license — the difference is precisely the noncommercial restriction.

Copyright © 2026 DIAS LABS SERVICOS DE TI LTDA (CNPJ 65.673.716/0001-03).
