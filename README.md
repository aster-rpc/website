# Aster website

Public-facing Astro website for Aster.

## Purpose

This repository contains the landing and blog source for sdk.getaster.now and assembles the documentation and API reference from the sibling docs repository.

- Website: brand, worldview, architecture framing, trust model, examples, status
- Docs: quickstart, guides, concepts, reference, bindings

The site should explain Aster as an identity-first distributed systems substrate with:

- identity-first connectivity
- content-addressed contracts
- high-performance cross-language serialization
- explicit trust and capability structure

## Routes

- `/` landing
- `/blog/` and authored blog posts
- `/docs/` and existing documentation routes
- `/api/python/` and `/api/typescript/`
- `/go/` Go module discovery

## Stack

- Astro 6
- TypeScript
- Bun for package management / scripts
- Local Geist and IBM Plex Mono font assets

## Development

Install dependencies:

```sh
bun install
```

Start the dev server:

```sh
bun dev
```

Build the site:

```sh
bun build
```

Preview the production build:

```sh
bun preview
```

## Project structure

```text
src/
  components/   Shared UI pieces
  layouts/      Shared Astro layouts
  pages/        Route-level authored pages
  styles/       Global tokens and base styling
public/
  fonts/        Local font assets
_private/       Source IA / spec / brand inputs
```

## Content guidance

- Keep the website distinct from docs/reference
- Stay calm, precise, and infrastructural in tone
- Avoid hype, blockchain cues, and generic SaaS styling
- Prefer authored pages over premature abstraction

## Source of truth

Primary project context lives in:

- `_private/WEBSITE-IA.md`
- `_private/Aster-SPEC.md`
- `_private/brand/aster-brand-pack.md`
- `.clinerules/memory_bank/`

## Combined SDK deployment build

Install dependencies in this repository and the sibling `../docs` repository, then run:

```sh
npm run build:combined
```

Set `ASTER_DOCS_DIR` to use a different docs checkout. The script builds both sites and writes a validated combined `dist/`: landing at `/`, documentation at `/docs/`, API reference at `/api/`, and Go discovery at `/go/`. Existing docs routes and Pagefind assets keep their root paths. The docs home must be emitted at `/docs/`; a docs root index is rejected. Distinct sitemap files are combined into `/sitemap-index.xml`; robots and obsolete CNAME files from either source are replaced or omitted. Identical shared assets are accepted, while differing files at the same path stop the build. The previous output is retained until assembly validation succeeds.

`npm run build` still builds only the landing and blog. Go discovery uses the Go 1.25 four-field `go-import` metadata for the `bindings/go` repository subdirectory.

## Publishing

`.github/workflows/deploy.yml` is the single publisher for the combined site on Cloudflare Workers static assets. Website `main` pushes and manual runs publish immediately. Scheduled runs check the public docs repository at minutes 7, 22, 37, and 52 each hour and skip publication when the live `/deployment.json` already matches both source commits. GitHub schedules can be delayed; use a manual website workflow run for an immediate docs publication. Docs changes do not directly trigger this workflow.

The workflow resolves the docs `main` SHA, checks out that exact revision alongside website `main`, builds both sites with Node 24, and publishes with Wrangler 4.147.0. `/deployment.json` records the exact website and docs commits. Live checks verify that receipt, the main routes, search assets, and Go discovery metadata. The public docs checkout uses the built-in GitHub token and needs no cross-repository secret.

Configure repository secret `CLOUDFLARE_API_TOKEN` and repository variable `CLOUDFLARE_ACCOUNT_ID` before CI publication. The Cloudflare token is passed only to the deploy step; missing configuration fails before dependency installation and building. A local Wrangler OAuth login does not configure the CI token. The token needs permission to deploy Workers and manage the custom domain in the `getaster.now` zone.

`wrangler.jsonc` deploys worker `aster-sdk` on `sdk.getaster.now`, uses `dist/` static assets with the generated 404 page, and disables workers.dev and preview URLs. Concurrent publisher runs are serialized. GitHub Pages is no longer the deployment target.
