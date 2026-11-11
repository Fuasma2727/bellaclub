import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const exec = promisify(execFile);
const directory = path.dirname(fileURLToPath(import.meta.url));
const rawDirectory = path.join(directory, 'responses');
await mkdir(rawDirectory, { recursive: true });
const followup = process.argv.includes('--followup');
const sourceName = followup ? 'followup-urls.json' : 'gsc-urls.json';
const source = JSON.parse((await readFile(path.join(directory, sourceName), 'utf8')).replace(/^\uFEFF/, ''));
const decode = value => value?.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'");
const attr = (tag, name) => decode(tag.match(new RegExp(`\\b${name}=["']([^"']*)["']`, 'i'))?.[1] || '');

async function fetchUrl(url, key) {
  const headerPath = path.join(rawDirectory, `${key}.headers.txt`);
  const bodyPath = path.join(rawDirectory, `${key}.body`);
  let stdout = '', error = '';
  try {
    ({ stdout } = await exec('curl.exe', ['--silent', '--show-error', '--connect-timeout', '10', '--max-time', '30', '--location', '--max-redirs', '8', '--dump-header', headerPath, '--output', bodyPath, '--write-out', '%{json}', url], { maxBuffer: 1024 * 1024, windowsHide: true }));
  } catch (failure) {
    stdout = failure.stdout || '';
    error = failure.stderr || failure.message;
  }
  let info = {};
  try { info = JSON.parse(stdout); } catch {}
  const headers = await readFile(headerPath, 'utf8').catch(() => '');
  const body = await readFile(bodyPath, 'utf8').catch(() => '');
  const links = body.match(/<link\b[^>]*>/gi) || [];
  const metas = body.match(/<meta\b[^>]*>/gi) || [];
  const chain = headers.split(/\r?\n\r?\n/).filter(block => /^HTTP\//.test(block)).map(block => ({
    status: Number(block.match(/^HTTP\/\S+ (\d+)/)?.[1]),
    location: block.match(/^location:\s*(.*)$/im)?.[1]?.trim() || '',
    robots: block.match(/^x-robots-tag:\s*(.*)$/im)?.[1]?.trim() || '',
    cache: block.match(/^x-nextjs-cache:\s*(.*)$/im)?.[1]?.trim() || '',
    contentType: block.match(/^content-type:\s*(.*)$/im)?.[1]?.trim() || '',
  }));
  return {
    url, status: info.http_code || 0, finalUrl: info.url_effective || url,
    redirects: info.num_redirects || 0, chain,
    canonical: attr(links.find(tag => attr(tag, 'rel') === 'canonical') || '', 'href'),
    metaRobots: metas.filter(tag => /^(robots|googlebot)$/i.test(attr(tag, 'name'))).map(tag => attr(tag, 'content')).join('; '),
    refresh: attr(metas.find(tag => /refresh/i.test(attr(tag, 'http-equiv'))) || '', 'content'),
    nextRedirect: body.match(/NEXT_REDIRECT[^<]{0,350}/)?.[0] || '',
    title: decode(body.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] || ''),
    h1: [...body.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map(match => decode(match[1].replace(/<[^>]+>/g, ''))),
    bytes: info.size_download || 0, seconds: info.time_total || 0, error,
    responseKey: key,
  };
}

const sitemapKey = followup ? 'followup-sitemap' : 'sitemap';
const sitemapFetch = await fetchUrl('https://belaclub.co/sitemap.xml', sitemapKey);
const sitemap = await readFile(path.join(rawDirectory, `${sitemapKey}.body`), 'utf8');
const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => decode(match[1]));
const sitemapSet = new Set(sitemapUrls);
const profilesById = new Map(sitemapUrls.filter(url => url.includes('--')).map(url => [url.split('--').at(-1), url]));
const results = [];
let cursor = 0;
await Promise.all(Array.from({ length: 4 }, async () => {
  while (cursor < source.length) {
    const index = cursor++;
    const row = source[index];
    const result = await fetchUrl(row.url, `${followup ? 'followup-' : ''}${String(index + 1).padStart(2, '0')}`);
    const id = row.url.includes('--') ? row.url.split('--').at(-1) : null;
    const value = { ...row, ...result, inSitemap: sitemapSet.has(row.url), currentProfileForId: profilesById.get(id) || '' };
    results[index] = value;
    console.log(JSON.stringify(value));
  }
}));
await writeFile(path.join(directory, followup ? 'audit-followup.json' : 'audit.json'), JSON.stringify({ checkedAt: new Date().toISOString(), sitemapStatus: sitemapFetch.status, sitemapUrlCount: sitemapUrls.length, sitemapUrls, results }, null, 2));
const columns = ['reason', 'url', 'lastCrawl', 'status', 'finalUrl', 'redirects', 'canonical', 'metaRobots', 'refresh', 'inSitemap', 'currentProfileForId', 'error'];
const csv = '\uFEFF' + columns.join(',') + '\r\n' + results.map(row => columns.map(column => '"' + String(row[column] ?? '').replaceAll('"', '""') + '"').join(',')).join('\r\n');
await writeFile(path.join(directory, followup ? 'revision-complementaria.csv' : 'revision-urls.csv'), csv);
console.log(JSON.stringify({ summary: results.reduce((out, row) => { const key = `${row.reason} => ${row.status}`; out[key] = (out[key] || 0) + 1; return out; }, {}), sitemapUrlCount: sitemapUrls.length }));
