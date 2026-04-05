# Aster website

Public-facing Astro website for Aster.

## Purpose

This repository contains the narrative/product site for Aster, not the documentation site.

- Website: brand, worldview, architecture framing, trust model, examples, status
- Docs: quickstart, guides, concepts, reference, bindings

The site should explain Aster as an identity-first distributed systems substrate with:

- identity-first connectivity
- content-addressed contracts
- high-performance cross-language serialization
- explicit trust and capability structure

## Routes

- `/`
- `/why`
- `/architecture`
- `/trust`
- `/examples`
- `/about`

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
