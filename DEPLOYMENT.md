# SDK site publishing

Verified 10 October 2026: GitHub Actions builds the SDK landing page and
Astro/Starlight documentation, then publishes one combined static site to
Cloudflare Workers Static Assets at https://sdk.getaster.now.

## Ownership and routes

| Item | Owner or location |
| --- | --- |
| Publisher | `aster-rpc/website`, `.github/workflows/deploy.yml`, **Publish SDK site to Cloudflare** |
| Documentation source | `aster-rpc/docs`; its workflow validates the build only |
| Cloudflare Worker | `aster-sdk` |
| Custom domain | `sdk.getaster.now` in the active `getaster.now` Cloudflare zone |
| Landing and blog | `/`, `/blog/` |
| Documentation | `/docs/`, preserving existing `/docs/...` paths |
| API reference | `/api/python/`, `/api/typescript/` |
| Search | `/pagefind/`; docs assets and fonts use `/_docs/` and `/docs-fonts/` |
| Go discovery | `/go?go-get=1`, module identity `sdk.getaster.now/go` |
| Build receipt | `/deployment.json`, containing exact `website` and `docs` commit SHAs |

Porkbun remains the registrar; Cloudflare is authoritative DNS. The Worker
custom-domain binding manages its DNS and HTTPS certificate. `workers.dev`
and preview URLs are disabled. `getaster.now` is reserved for the commercial
Portal sites; this SDK deployment does not publish that root site.

## Publish and verify

A website `main` push publishes immediately. Scheduled website runs check docs
`main` at minutes 7, 22, 37 and 52 each hour and skip unchanged source pairs.
GitHub scheduling can delay runs. Docs pushes do not directly trigger the
publisher; run it manually when immediate publication is needed:

```sh
gh workflow run deploy.yml --repo aster-rpc/website --ref main
gh run list --repo aster-rpc/website --workflow deploy.yml --limit 3
# Substitute the run ID printed/listed above.
gh run watch <run-id> --repo aster-rpc/website --exit-status
curl -fsS https://sdk.getaster.now/deployment.json
curl -fsSL 'https://sdk.getaster.now/go?go-get=1'
```

The single serialized workflow checks out website main and a resolved docs main
SHA, installs both lockfiles with `npm ci` on Node 24, runs
`npm run build:combined`, writes the receipt, and deploys with pinned Wrangler
4.147.0. The combined build rejects conflicting assets and missing required
routes, combines sitemaps, and removes CNAME files. Each successful deployment
checks the live receipt, landing, docs, API references, search and Go metadata.
Never deploy one repository's standalone output over the combined Worker.

## Credentials

In **aster-rpc/website → Settings → Secrets and variables → Actions**:

- Repository secret: `CLOUDFLARE_API_TOKEN`.
- Repository variable: `CLOUDFLARE_ACCOUNT_ID`, already configured for
  `8f4983afe90539d1b77f6d889e0d80f6`.

The token must grant Workers Editor access covering `aster-sdk` in that account
(legacy name: Account → Workers Scripts → Edit), plus Workers Routes read/edit
access for `getaster.now`. Routes permission alone cannot upload the Worker and
causes **No access to the specified service**. These permissions were corrected
and the complete CI deployment subsequently passed.

Create or edit the persistent token in the Cloudflare dashboard's API Tokens
page. The local `cf` OAuth session can deploy interactively but was denied API
token-management access; do not copy that expiring session token into GitHub.
After creating/replacing a token, store it without putting it in shell arguments:

```sh
gh secret set CLOUDFLARE_API_TOKEN --repo aster-rpc/website
```

Editing an existing token's policy does not require replacing its saved value.
After a permissions fix, rerun the failed job with
`gh run rerun <run-id> --repo aster-rpc/website --failed` and inspect its result.
Do not put credentials in source, runbooks or chat.

## Local build and recovery

Use current website and docs checkouts. Install dependencies with `npm ci` in
each, then run `npm run build:combined` in website. `ASTER_DOCS_DIR` overrides
the default sibling `../docs` path. `npm run build` alone builds only the
landing/blog and must not be used as the production deployment directory.

If a deployment fails, inspect `gh run view <run-id> --repo aster-rpc/website
--log-failed`; verify the live receipt before deciding whether content changed.
For recovery, select a known-good deployment in the Cloudflare `aster-sdk`
Worker's Versions & Deployments screen. Coordinate rollback with the website
workflow: its next push/manual run or changed-source scheduled check can
republish current main. Revert the faulty source change for a lasting fix.

## Verification and remaining work

Successful end-to-end CI run:
https://github.com/aster-rpc/website/actions/runs/38079993092 (successful retry).
Its receipt records website `36effc6938260546d784e6840b715d8e5bc32e83` and docs
`1baf201d615c12da3033cd7e92f3020f18627f9c`. Later successful deployments update
that receipt normally.

GitHub Pages is no longer the publisher. The old `aster.site` and
`docs.aster.site` sites may still serve their previous snapshots; redirects and
retirement of those hosts have not been verified. Use SDK URLs in new links.

Live Go discovery does not establish module publication. The SDK source checkout
still uses the earlier `getaster.now/aster-rpc/go` identity in go.mod and the
release preparer. Migrate imports, tests, release validation and the old discovery
payload to `sdk.getaster.now/go` before releasing. Filtered Go tags, matching
anonymous native artifacts and clean public installs remain separate gates.
SDK binary/release CI stays on Forgejo; the two public website repositories use
GitHub Actions. Neither pipeline's hosting policy should be applied to the other.

## Analytics

The combined build adds the shared Aster Umami tracker after assembling the landing site, manual and API reference. The configuration and helper live in `scripts/analytics/`, vendored from `getaster.now/analytics/`; update them using that repository’s `analytics/sync.mjs`. The shared website ID aggregates the Aster hosts, while `data-domains` excludes local previews. Publication rejects HTML that cannot receive exactly one configured tracker.

Analytics was published by [run 41605859970](https://github.com/aster-rpc/website/actions/runs/41605859970). Browser page views from the landing page and Python quickstart returned HTTP 200 from the Umami collector.
