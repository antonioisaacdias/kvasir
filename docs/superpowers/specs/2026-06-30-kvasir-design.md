---
title: Kvasir — design v1
description: serviço companion do Calibre-Web-Automated para buscar e baixar livros de domínio público
kind: spec
status: approved
tags: [spec, kvasir, books, calibre, truenas]
---

# Kvasir — design v1

## Motivação

O usuário roda [Calibre-Web-Automated](../../../../homelab-docs/services/calibre-web-automated.md) (CWA)
no TrueNAS pra catalogar/ler ebooks e papers. O CWA não tem UI de busca/download ("Get Books" é exclusivo
do Calibre desktop com KasmVNC, que o CWA deliberadamente não usa). Investigação prévia descartou:

- Instalar plugin "Get Books" no CWA — não tem onde surtir efeito (sem GUI compatível).
- **Shelfmark** (`calibrain/shelfmark`, companion oficial do CWA) — arquitetura pensada pra
  torrent/usenet/IRC (ecossistema Anna's Archive/LibGen), sem fonte de domínio público pronta;
  exigiria configuração manual cuidadosa pra evitar zona cinzenta legal.
- Fork do CWA/Calibre-Web — carga de manutenção recorrente (rebase a cada release upstream), CWA já
  sinaliza que plugin support é WIP, não é o ponto de extensão pretendido hoje.

**Kvasir** é um serviço companion pequeno e dedicado, só pra fontes de domínio público/abertas
legítimas (Project Gutenberg, Standard Ebooks, extensível por adapter), que dropa os arquivos direto na
pasta de ingest existente do CWA — mesma arquitetura que o Shelfmark usa, mas com escopo restrito.

Nome: na mitologia nórdica, Kvasir é o ser mais sábio, cujo sangue virou o hidromel do conhecimento —
metáfora de destilar livros de fontes públicas numa biblioteca pessoal.

## Arquitetura

Monorepo, mesmo system design validado no projeto Tormod:

- **`apps/server`** — Node/Bun + Hono, TS strict, testado com vitest.
- **`apps/web`** — Vite + React + TS strict + Tailwind, mesmos padrões de componentes/cva do Tormod.
- **Prod same-origin**: build do front vira estático servido pelo próprio Hono (SPA fallback), sem CORS,
  um único processo/porta — mesmo padrão do Tormod em produção.
- **DB**: SQLite via `better-sqlite3`, arquivo próprio do Kvasir (não reaproveita o DB do Tormod).
- **Deploy**: Custom App no TrueNAS (compose puro via `app.update`, mesmo mecanismo já documentado pro
  CWA), do lado do `calibre-web-automated`. LAN-only via wg, sem TLS/exposição pública.
- **Integração com CWA**: write-only na pasta de ingest existente
  (`/mnt/STORAGE/samba/calibre-ingest` → `/cwa-book-ingest` no container do CWA). Kvasir nunca toca em
  `metadata.db`/`calibredb` — o watcher do CWA cataloga sozinho após o drop.

## Repositórios e CI/CD

- **Forgejo é a fonte de verdade** (dev, CI/CD roda lá, deploy dispara de lá) — mesmo padrão do Tormod.
- **GitHub é mirror/portfólio** (conta pessoal `antonioisaacdias`), push nos dois remotes a cada push
  (política adotada no Tormod em 2026-06-13).
- **CI/CD**: reaproveita o runner Forgejo já montado no odin (`forgejo-runner` systemd). Push na branch
  principal builda a imagem Docker multi-stage e atualiza o Custom App no TrueNAS via `app.update`.

## Auth

Reaproveita o *módulo* de auth do Tormod (Argon2id + sessão cookie httpOnly, registro no 1º acesso),
**sem TOTP/2FA** — ferramenta pequena e LAN-only não justifica essa camada. Single-user (não há conceito
de múltiplos usuários no v1).

## Componentes e fluxo de dados

### Source Adapter (interface)

```ts
interface SourceAdapter {
  id: string; // "gutenberg" | "standard-ebooks" | ...
  search(query: string): Promise<SearchResult[]>;
  download(externalId: string): Promise<ReadableStream>;
}
```

Cada fonte implementa a interface. Adicionar fonte nova = novo adapter, zero mudança no resto do
sistema. v1 implementa:

- **`gutenberg`** — via API Gutendex (JSON).
- **`standard-ebooks`** — via catálogo OPDS (Atom feed).

Estrutura pronta pra adapters futuros (outras línguas/fontes de domínio público).

### Busca

`GET /api/search?q=<termo>` → backend faz fan-out em paralelo pros adapters habilitados
(`Promise.allSettled`) → agrega resultados com campo `source` visível. Erro em um adapter não derruba a
busca — resultado parcial com aviso (ex: "Standard Ebooks indisponível").

### Download

Usuário clica "baixar" → backend checa SQLite (`source + external_id` já existe?):

- **Já existe**: avisa "já baixado em `<data>`", não baixa de novo.
- **Novo**: chama `adapter.download()`, grava o arquivo em `/cwa-book-ingest`, registra linha no SQLite
  só após o download completar com sucesso (arquivo corrompido/vazio não vira registro — permite retry,
  não deixa lixo na pasta de ingest).

### Schema SQLite

```sql
CREATE TABLE downloads (
  source        TEXT NOT NULL,
  external_id   TEXT NOT NULL,
  title         TEXT NOT NULL,
  author        TEXT,
  downloaded_at TEXT NOT NULL,
  PRIMARY KEY (source, external_id)
);
```

## Testes

- **Server**: vitest, adapters mockados via `fetch` injetável (mesmo padrão de seam de teste do Tormod).
  Cobre: fan-out com falha parcial, dedup por `(source, external_id)`, não-gravação em download
  corrompido.
- **Front**: sem harness obrigatório no v1 (mesma decisão inicial do Tormod).

## Escopo explícito do v1

**Inclui**: busca + download de Gutenberg e Standard Ebooks, dedup via SQLite, drop write-only no
ingest do CWA, auth single-user enxuta, deploy Custom App TrueNAS, CI/CD Forgejo + mirror GitHub.

**NÃO inclui** (fora de escopo, não implementar no v1):

- Conversão de formato.
- Integração com `calibredb`/coluna customizada `Tipo` do CWA.
- Múltiplos usuários, 2FA/TOTP.
- Exposição pública / TLS (permanece LAN-only via wg).
