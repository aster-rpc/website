import { spawnSync } from 'node:child_process';
import { readdir, readFile, writeFile, mkdir, rm, copyFile, rename } from 'node:fs/promises';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const docs = resolve(process.env.ASTER_DOCS_DIR || resolve(root, '../docs'));
const staging = resolve(root, '.build/combined');
const landing = resolve(root, '.build/landing');
const output = resolve(root, 'dist');
const origin = 'https://sdk.getaster.now';

function run(args, cwd) {
  const result = spawnSync('npm', args, { cwd, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`npm ${args.join(' ')} failed in ${cwd}`);
}

async function* files(directory, prefix = '') {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) yield* files(resolve(directory, entry.name), path);
    else if (entry.isFile()) yield path;
    else throw new Error(`Unsupported build entry: ${path}`);
  }
}

const sources = new Map();
async function merge(directory, kind) {
  for await (const path of files(directory)) {
    // Deployment controls and search indexing must describe the combined site.
    if (path === 'CNAME' || path === 'robots.txt' || path === 'sitemap-index.xml' || path.endsWith('.DS_Store')) continue;
    if (kind === 'docs' && path === 'index.html') throw new Error('Docs must emit its home at /docs/, not /');
    const target = /^sitemap-\d+\.xml$/.test(path) ? `${kind}-${path}` : path;
    const source = resolve(directory, path);
    if (sources.has(target)) {
      if (!(await readFile(source)).equals(await readFile(sources.get(target)))) {
        throw new Error(`Conflicting output ${target}: ${sources.get(target)} and ${source}`);
      }
      continue;
    }
    sources.set(target, source);
    await mkdir(dirname(resolve(staging, target)), { recursive: true });
    await copyFile(source, resolve(staging, target));
  }
}

await rm(staging, { recursive: true, force: true });
await rm(landing, { recursive: true, force: true });
await mkdir(staging, { recursive: true });
run(['run', 'build'], docs);
run(['run', 'build', '--', '--outDir', relative(root, landing)], root);
await merge(landing, 'landing');
await merge(resolve(docs, 'dist'), 'docs');
for (const required of ['index.html', 'docs/index.html', 'go/index.html', 'api/python/aster/public.html', 'api/typescript/index.html', 'pagefind/pagefind.js']) {
  if (!sources.has(required)) throw new Error(`Missing required combined output: ${required}`);
}
const sitemaps = [...sources.keys()].filter(path => /^(landing|docs)-sitemap-\d+\.xml$/.test(path)).sort();
if (sitemaps.length < 2) throw new Error('Both builds must provide sitemaps');
await writeFile(resolve(staging, 'sitemap-index.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${sitemaps.map(path => `<sitemap><loc>${origin}/${path}</loc></sitemap>`).join('')}</sitemapindex>\n`);
await writeFile(resolve(staging, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap-index.xml\n`);
// Publish the assembled directory only after all collision and route checks pass.
await rm(output, { recursive: true, force: true });
await rename(staging, output);
console.log(`Combined SDK site: ${output} (${sources.size} files)`);
