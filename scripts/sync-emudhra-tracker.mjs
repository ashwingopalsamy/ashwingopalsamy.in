#!/usr/bin/env node
// Live tracker for the eMudhra CA key-compromise post. Syncs src/data/emudhra-incident.json from
// https://github.com/galadran/we-have-a-problem.com (index.html, checker.js and the two JSON files) and
// (optionally) rewrites the marker blocks in the post.
//
//   node scripts/sync-emudhra-tracker.mjs                       fetch, validate, write the JSON if it changed
//   node scripts/sync-emudhra-tracker.mjs --check               same, but write nothing; exit 1 if anything would change
//   node scripts/sync-emudhra-tracker.mjs --post <path.md>      also rewrite <!-- tracker:NAME:start/end --> blocks
//                                                               and bump the frontmatter `updated:` (combine with --check)
//   node scripts/sync-emudhra-tracker.mjs --print-blocks        render the blocks from the JSON on disk; no network
//
// stdout carries the change summary (the workflow uses it as the PR body); progress and warnings go to stderr.
// Exit codes: 0 ok / no change, 1 would change (--check only), 2 usage, 3 fetch, validation or I/O failure.
// Any failure happens before the first write, so a failed run leaves the tree untouched.
//
// Needs Node >= 22.18 (or --experimental-strip-types on older 22.x) because it imports src/lib/incident/p384.ts.

import { createHash, X509Certificate } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DATA_PATH = resolve(ROOT, 'src/data/emudhra-incident.json');
const REPO = 'galadran/we-have-a-problem.com';
const SOURCE_URL = `https://github.com/${REPO}`;
const COMMIT_API = `https://api.github.com/repos/${REPO}/commits/main`;
const RAW_BASE = `https://raw.githubusercontent.com/${REPO}`;
const ALLOWED_HOSTS = new Set(['raw.githubusercontent.com', 'api.github.com']);
const TIMEOUT_MS = 10_000;
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 3;

// SHA-256 of the SubjectPublicKeyInfo of the eight compromised intermediates; the same list Go hard-blocks
// (crypto/x509 distrustedSPKIHashes). The sync fails if the upstream set differs, so a ninth key needs a human.
const PINNED_SPKI = [
  'ebed6475c2c2d80fcb199f3fe8dd6e6b3ce60b77eb15d4e42c3dec0c6f5b5105', // EM DV TLS CA - G3B
  '49dd353dc2b919a3770645117d0e60c16115e7d1bc259eefe734b00ea434fe5f', // EM DV TLS CA - G3C
  'e0254c7fcdc265e2f0f8a428dabb75ab4ae039b4872d62f5ee57f0877d5a8a41', // EM EV TLS CA - G3B
  '5c0660a2b164910d8ff589c18e14552e9e0ec237dcefe2cb736d41a4811f81a0', // EM EV TLS CA - G3C
  '43bffa19d6ef651451f6841e019931e96f6f2eaeff28ab4b6f1ce4576de2717b', // EM OV TLS CA - G3B
  '63ecefee431d49523bc1136c4e72d0206a477086caf606cd5cf025686c109cf8', // EM OV TLS CA - G3C
  'ec4ffa1ad0ac88081314b7aaffef6a91f97cd57291bb5ba686c5415f5eb4f6b6', // EM OV CS CA - G3B
  '92c063d67e8f14db71d288e11266ffdaf69cbf115f7bab14f3bc2f68d25e0e30', // EM OV CS CA - G3C
];

const RE_NAME = /^[\w .+\-/:()~]{1,80}$/;
const RE_VERSION = /^(?=.{1,64}$)[\w.+~\-:]+(?: [\w.+~\-:]+)*$/;
const RE_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
const RE_HOST = /^[a-z0-9-]+\.we-have-a-problem\.com$/;
const RE_WORD = /^[a-z_]{1,32}$/;
const RE_HEX64 = /^[0-9a-fA-F]{64}$/;
const BLOCKS = ['strip', 'stats', 'patched', 'roots', 'intermediates', 'hosts', 'changelog'];
const RE_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_CHANGELOG = 20;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const LANES = new Set(['browsers', 'issuer', 'libraries', 'os', 'runtimes', 'firmware']);
const TRUST = new Set(['Included', 'Removed', 'Not Included']);

class SyncError extends Error {}
const fail = (message) => {
  throw new SyncError(message);
};
const log = (message) => console.error(message);

// ---- hand-maintained seed (used only when the data file has no events / go block yet) ----------------------
// Ids and labels follow figure-specs.md section 3 (the incident-timeline marks key on `id`). `t` is a full UTC
// time for precision "minute", a date for "day", and "open" / "never" for the pending and firmware items.
// `end` closes a multi-day band (inclusive last day), `approx` marks dashed items, `status` paints the mark.
const JACKSON = 'https://emudhra.we-have-a-problem.com/';
const BUG = 'https://bugzilla.mozilla.org/show_bug.cgi?id=2083449';
const MOZ_BLOG = 'https://blog.mozilla.org/security/2026/10/20/protecting-firefox-users-following-the-compromise-of-emudhra-intermediate-certificates/';
const CF_BLOG = 'https://blog.cloudflare.com/emudhra-certificate-compromise/';
const HELME = 'https://scotthelme.co.uk/eight-bits-of-trust-emudhras-ca-keys-cracked-in-milliseconds/';
const GO_ISSUE = 'https://github.com/golang/go/issues/82345';
const GO_RELEASE = 'https://go.dev/doc/devel/release#go1.27.3';
const DEBIAN = 'https://lists.debian.org/debian-security-announce/2026/msg00487.html';
const ev = (id, t, precision, lane, label, source, status, extra = {}) => ({ id, t, precision, lane, label, source, status, ...extra });
const SEED_EVENTS = [
  ev('reporter-test', '2026-10-17T16:27:00Z', 'minute', 'issuer', "The reporter's test finds the weakness", BUG, 'info'),
  ev('reporter-emails', '2026-10-17T18:05:00Z', 'minute', 'issuer', 'The reporter emails Apple, Chrome, Microsoft, Mozilla and eMudhra', BUG, 'info'),
  ev('mozilla-receives', '2026-10-17T20:06:00Z', 'minute', 'issuer', 'Mozilla receives the report', MOZ_BLOG, 'info'),
  ev('mozilla-confirms', '2026-10-17T20:08:00Z', 'minute', 'issuer', 'Mozilla confirms the proof of key control', MOZ_BLOG, 'info'),
  ev('emudhra-ack', '2026-10-17T21:28:00Z', 'minute', 'issuer', 'eMudhra acknowledges and disables the affected DV issuer', BUG, 'info'),
  ev('mozilla-recovers', '2026-10-17T21:48:00Z', 'minute', 'issuer', 'Mozilla recovers the keys independently', MOZ_BLOG, 'info'),
  ev('mozilla-onecrl', '2026-10-17T22:59:00Z', 'minute', 'browsers', 'Mozilla distributes the OneCRL block', MOZ_BLOG, 'blocked'),
  ev('chrome-crlset', '2026-10-17', 'day', 'browsers', 'Chrome blocks them with a CRLSet', HELME, 'blocked'),
  ev('emudhra-revokes', '2026-10-18T09:24:00Z', 'minute', 'issuer', 'eMudhra revokes all eight as ca_compromise', BUG, 'blocked'),
  ev('mozilla-bug', '2026-10-18T12:06:00Z', 'minute', 'issuer', 'Mozilla opens bug 2083449', BUG, 'info'),
  ev('apple-block', '2026-10-19', 'day', 'os', 'Apple blocks them', HELME, 'blocked'),
  ev('sectigo-revokes', '2026-10-19', 'day', 'issuer', 'Sectigo revokes its cross-signs', HELME, 'info', { approx: true }),
  ev('go-issue', '2026-10-19', 'day', 'libraries', 'Go opens issue #82345', GO_ISSUE, 'info'),
  ev('cloudflare-aware', '2026-10-19T17:00:00Z', 'minute', 'libraries', 'Cloudflare becomes aware', CF_BLOG, 'info', { approx: true }),
  ev('go-release', '2026-10-19', 'day', 'libraries', 'Go 1.27.3 and 1.26.10 ship', GO_RELEASE, 'patched', { end: '2026-10-20' }),
  ev('cloudflare-warp', '2026-10-20T02:00:00Z', 'minute', 'libraries', 'Cloudflare mitigates WARP clients', CF_BLOG, 'patched'),
  ev('cloudflared', '2026-10-20T09:15:00Z', 'minute', 'libraries', 'cloudflared 2026.10.2', CF_BLOG, 'patched'),
  ev('microsoft-block', '2026-10-20', 'day', 'os', 'Microsoft blocks them', HELME, 'blocked'),
  ev('nss-firefox', '2026-10-20', 'day', 'browsers', 'Firefox 158.0.1, ESR 115.43.1, ESR 153.5.1; NSS 3.131.1', MOZ_BLOG, 'patched'),
  ev('keys-public', '2026-10-20T13:06:00Z', 'minute', 'issuer', 'Bug comment: several people recovered the keys, some publicly', `${BUG}#c18`, 'info'),
  ev('migration-30k', '2026-10-20T14:16:00Z', 'minute', 'issuer', 'Bug comment: about 30,000 certificates to migrate', `${BUG}#c19`, 'info'),
  ev('cloudflare-cdn', '2026-10-20T19:20:00Z', 'minute', 'libraries', 'Cloudflare CDN and Zero Trust mitigations', CF_BLOG, 'patched'),
  ev('debian-dsa', '2026-10-20T21:00:00Z', 'minute', 'os', 'Debian DSA-6572-1 removes the emSign ECC G3 and Comodo AAA roots', DEBIAN, 'patched'),
  ev('tracker-baseline', '2026-10-21T09:00:00Z', 'minute', 'libraries', 'Tracker baseline: 21 of 24 list a fix (Composer still flagged pending)', JACKSON, 'info'),
  ev('pending', 'open', 'open', 'runtimes', 'FreeBSD ca_root_nss, Node.js, Bun pending', JACKSON, 'pending'),
  ev('firmware', 'never', 'never', 'firmware', 'Frozen trust stores keep accepting them until July 2039', HELME, 'never'),
];
const SEED_GO = { fixed: ['1.27.3', '1.26.10'], fixedPatch: { '1.27': 3, '1.26': 10 }, firstFixedMinor: 28, fixCommit: '7f86f95', cve: 'CVE-2026-111943' };

// ---- bounded fetch -----------------------------------------------------------------------------------------
function assertAllowed(url) {
  if (url.protocol !== 'https:') fail(`refusing non-https URL: ${url.protocol}//${url.hostname}`);
  if (!ALLOWED_HOSTS.has(url.hostname)) fail(`refusing host outside the allowlist: ${url.hostname}`);
  if (url.username || url.password || (url.port && url.port !== '443')) fail(`refusing URL with credentials or port: ${url.hostname}`);
}

async function fetchText(target) {
  let url = new URL(target);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    assertAllowed(url);
    const headers = { 'user-agent': 'ashwingopalsamy.in emudhra-tracker', accept: 'text/plain, application/json, text/html' };
    // The Actions token only raises the API rate limit; it never leaves api.github.com.
    if (url.hostname === 'api.github.com' && process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    const response = await fetch(url, { redirect: 'manual', headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) fail(`${url.hostname}: redirect without Location`);
      const next = new URL(location, url);
      if (next.hostname !== url.hostname) fail(`refusing redirect from ${url.hostname} to ${next.hostname}`);
      url = next;
      continue;
    }
    if (!response.ok) fail(`GET ${url.hostname}${url.pathname} -> ${response.status}`);
    const declared = Number(response.headers.get('content-length') ?? 0);
    if (declared > MAX_BYTES) fail(`${url.pathname}: ${declared} bytes exceeds the ${MAX_BYTES} byte cap`);
    const reader = response.body.getReader();
    const chunks = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) {
        await reader.cancel();
        fail(`${url.pathname}: body exceeds the ${MAX_BYTES} byte cap`);
      }
      chunks.push(value);
    }
    return new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks));
  }
  return fail(`too many redirects fetching ${target}`);
}

// ---- validation helpers ------------------------------------------------------------------------------------
function parseJson(text, label) {
  try {
    return JSON.parse(text);
  } catch {
    return fail(`${label}: response is not JSON`);
  }
}
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-fA-F]{1,6}|#\d{1,7}|[a-zA-Z]+);/g, (whole, body) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      if (!(code >= 0x20 && code <= 0x10ffff) || (code >= 0xd800 && code <= 0xdfff)) fail(`bad character reference ${whole}`);
      return String.fromCodePoint(code);
    }
    return ENTITIES[body] ?? fail(`unknown entity ${whole}`);
  });
}
function stripTags(html) {
  let text = '';
  let inTag = false;
  for (const char of html) {
    if (char === '<') {
      inTag = true;
    } else if (char === '>' && inTag) {
      inTag = false;
    } else if (!inTag) {
      text += char;
    }
  }
  return text;
}
const clean = (html) => stripTags(decodeEntities(html)).replace(/\s+/g, ' ').trim();

function str(value, re, label) {
  if (typeof value !== 'string' || !re.test(value)) fail(`${label}: unexpected value ${JSON.stringify(String(value).slice(0, 60))}`);
  return value;
}
function iso(value, label) {
  str(value, RE_ISO, label);
  if (Number.isNaN(Date.parse(value))) fail(`${label}: not a date: ${value}`);
  return value;
}
function httpsUrl(raw, label) {
  if (typeof raw !== 'string' || raw.length > 600 || /[\u0000- \u007f-\u009f"<>\\`]/.test(raw)) fail(`${label}: bad URL`);
  let url;
  try {
    url = new URL(raw);
  } catch {
    fail(`${label}: bad URL`);
  }
  if (url.protocol !== 'https:' || url.username || url.password) fail(`${label}: only plain https URLs are accepted`);
  return url.href;
}

// ---- parsers -----------------------------------------------------------------------------------------------
// Upstream groups the rows into several <table class="patched"> (one per <details> group); rows keep page order.
function parsePatchedTable(html) {
  const opens = [...html.matchAll(/<table\b[^>]*\bclass="patched"[^>]*>/g)];
  if (opens.length < 1 || opens.length > 12) fail(`index.html: expected 1..12 <table class="patched">, found ${opens.length}`);

  const rows = [];
  for (const open of opens) {
    const from = open.index + open[0].length;
    const to = html.indexOf('</table>', from);
    if (to === -1) fail('index.html: unterminated patched table');
    const table = html.slice(from, to);
    if (!/^\s*<thead>\s*<tr>\s*<th>Software<\/th>\s*<th>Patched version<\/th>\s*<\/tr>\s*<\/thead>/.test(table)) fail('index.html: patched table header changed');
    const body = /<tbody>([\s\S]*)<\/tbody>/.exec(table)?.[1];
    if (body === undefined) fail('index.html: patched table has no <tbody>');
    if (body.replace(/<tr>[\s\S]*?<\/tr>/g, '').trim() !== '') fail('index.html: unexpected markup between patched rows');
    for (const [, row] of body.matchAll(/<tr>([\s\S]*?)<\/tr>/g)) rows.push(parsePatchedRow(row));
  }
  if (rows.length < 10 || rows.length > 200) fail(`patched tables have ${rows.length} rows, expected 10..200`);
  if (new Set(rows.map((r) => r.name)).size !== rows.length) fail('patched table has duplicate names');
  if (new Set(rows.map((r) => r.key)).size !== rows.length) fail('patched table has names that slug to the same key');
  return rows;
}

// A name cell, then one or more links separated only by commas, whitespace and <br>. Each link gives its href to
// the versions inside it (comma or <br> separated); any pending link makes the whole row pending.
function parsePatchedRow(row) {
  const cells = /^\s*<td>([\s\S]*?)<\/td>\s*<td>([\s\S]*?)<\/td>\s*$/.exec(row);
  if (!cells) fail(`index.html: patched row does not have the expected two-cell shape: ${clean(row).slice(0, 60)}`);
  const name = str(clean(cells[1]), RE_NAME, 'patched name');
  const links = [...cells[2].matchAll(/(<a\s[^>]*>)([\s\S]*?)<\/a>/g)];
  const between = cells[2].replace(/<a\s[^>]*>[\s\S]*?<\/a>/g, '');
  if (links.length === 0 || links.some((m) => m[2].includes('<a')) || !/^(?:[\s,]|<br\s*\/?>)*$/i.test(between)) {
    fail(`${name}: patched cell is not a list of links: ${clean(cells[2]).slice(0, 60)}`);
  }

  const versions = [];
  const urls = [];
  let first;
  let pending = false;
  for (const [, open, text] of links) {
    const attrs = {};
    const remainder = open.replace(/\s([a-zA-Z][\w-]*)="([^"]*)"/g, (_, key, value) => {
      attrs[key] = value;
      return '';
    });
    if (!/^<a\s*>$/.test(remainder)) fail(`${name}: unparseable link attributes`);
    for (const key of Object.keys(attrs)) if (!['href', 'class', 'rel', 'target'].includes(key)) fail(`${name}: unexpected link attribute ${key}`);
    const url = httpsUrl(decodeEntities(attrs.href ?? ''), `${name} link`);
    first ??= url;
    const classes = (attrs.class ?? '').split(/\s+/).filter(Boolean);
    if (classes.some((c) => c !== 'pending')) fail(`${name}: unexpected link class ${JSON.stringify(attrs.class)}`);
    const linkPending = classes.includes('pending');
    pending ||= linkPending;

    // Commas only: "Oracle JDK 27.0.1.0.3" and "8u511 b33" are single values.
    for (const v of clean(text.replace(/<br\s*\/?>/gi, ',')).split(',').map((s) => s.trim()).filter(Boolean)) {
      if (linkPending && v.toLowerCase() === 'pending') continue;
      str(v, RE_VERSION, `${name} version`);
      if (!linkPending && /\bpending\b/i.test(v)) fail(`${name}: "pending" without the pending class`);
      versions.push(v);
      urls.push(url);
    }
  }
  if (versions.length > 12) fail(`${name}: too many versions`);
  if (versions.length === 0 && !pending) fail(`${name}: no versions and not pending`);
  const key = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return { name, key, versions, url: first, urls, status: pending ? 'pending' : 'patched' };
}

function parseHosts(js) {
  if ((js.match(/const HOSTS = \[/g) ?? []).length !== 1) fail('checker.js: expected exactly one HOSTS array');
  const block = /const HOSTS = \[([\s\S]*?)\n\];/.exec(js)?.[1];
  if (block === undefined) fail('checker.js: could not delimit the HOSTS array');
  const hosts = [...block.matchAll(/\{\s*host:\s*'([^']*)'/g)].map((m) => str(m[1], RE_HOST, 'host'));
  if ((block.match(/\bhost\s*:/g) ?? []).length !== hosts.length) fail('checker.js: HOSTS entries do not all match the expected shape');
  if (hosts.length < 1 || hosts.length > 40) fail(`HOSTS has ${hosts.length} entries`);
  if (new Set(hosts).size !== hosts.length) fail('HOSTS has duplicates');
  if (hosts.length !== 12) log(`warning: upstream lists ${hosts.length} test hosts, the post says 12`);
  return hosts;
}

function certKey(entry, label) {
  const pem = entry.pem;
  if (typeof pem !== 'string' || pem.length > 4096 || !/^-----BEGIN CERTIFICATE-----\n[A-Za-z0-9+/=\n]+\n-----END CERTIFICATE-----\n?$/.test(pem)) fail(`${label}: bad PEM`);
  let cert;
  try {
    cert = new X509Certificate(pem);
  } catch {
    fail(`${label}: PEM does not parse`);
  }
  const key = cert.publicKey;
  if (key.asymmetricKeyType !== 'ec' || key.asymmetricKeyDetails?.namedCurve !== 'secp384r1') fail(`${label}: not a secp384r1 key`);
  const spki = createHash('sha256').update(key.export({ type: 'spki', format: 'der' })).digest('hex');
  return { cert, spki, jwk: key.export({ format: 'jwk' }) };
}

function sameInstant(certDate, isoDate) {
  return Math.abs(Date.parse(certDate) - Date.parse(isoDate)) < 1000;
}

// dv-tls-g3b ... ov-cs-g3c: the join key shared by the figures, the keyspace crack and the chain switcher.
function markIdFor(name, usage, label) {
  const m = /^EM (DV|OV|EV) (TLS|CS) CA - G3([BC])$/.exec(name);
  if (!m || (m[2] === 'TLS') !== (usage === 'tls')) fail(`${label}: cannot derive markId from the name`);
  return `${m[1].toLowerCase()}-${m[2].toLowerCase()}-g3${m[3].toLowerCase()}`;
}

async function mapIntermediates(raw, p384) {
  if (!Array.isArray(raw) || raw.length !== 16) fail(`impacted-intermediates.json: expected 16 certificates, got ${Array.isArray(raw) ? raw.length : typeof raw}`);
  const out = [];
  for (const c of raw) {
    const name = str(c?.name, RE_NAME, 'intermediate name');
    const label = `${name} (${c.issuer_operator})`;
    const usage = c.usage === 'tls' || c.usage === 'code-signing' ? c.usage : fail(`${label}: usage ${JSON.stringify(c.usage)}`);
    const issuerOperator = c.issuer_operator === 'eMudhra' || c.issuer_operator === 'Sectigo' ? c.issuer_operator : fail(`${label}: issuer_operator`);
    const operator = /(?:^|,)\s*O=(eMudhra BV|eMudhra Inc)\s*(?:,|$)/.exec(String(c.subject))?.[1] ?? fail(`${label}: subject operator not recognised`);
    const issuedBy = str(c.issued_by, RE_NAME, `${label} issued_by`);
    const spkiSha256 = str(c.spki_sha256, RE_HEX64, `${label} spki_sha256`).toLowerCase();
    const serialHex = str(c.serial_hex, /^[0-9A-Fa-f]{1,64}$/, `${label} serial_hex`);
    const notBefore = iso(c.not_before, `${label} not_before`);
    const notAfter = iso(c.not_after, `${label} not_after`);
    if (c.key?.curve !== 'secp384r1') fail(`${label}: key.curve is ${JSON.stringify(c.key?.curve)}`);
    const rev = c.revocation ?? {};
    const revocation = {
      status: str(rev.status, RE_WORD, `${label} revocation.status`),
      date: rev.date === null ? null : iso(rev.date, `${label} revocation.date`),
      reason: rev.reason === null ? null : str(rev.reason, RE_WORD, `${label} revocation.reason`),
    };

    // The PEM is the evidence; the metadata around it must agree with it.
    const { cert, spki, jwk } = certKey(c, label);
    if (spki !== spkiSha256) fail(`${label}: spki_sha256 does not match the certificate`);
    if (cert.fingerprint256.replace(/:/g, '').toLowerCase() !== str(c.sha256, RE_HEX64, `${label} sha256`).toLowerCase()) fail(`${label}: sha256 does not match the certificate`);
    if (BigInt(`0x${cert.serialNumber}`) !== BigInt(`0x${serialHex}`)) fail(`${label}: serial_hex does not match the certificate`);
    if (!sameInstant(cert.validFrom, notBefore) || !sameInstant(cert.validTo, notAfter)) fail(`${label}: validity does not match the certificate`);

    const { x, y } = p384.jwkToXY(jwk);
    const found = await p384.recoverKey(x, y);
    const markId = markIdFor(name, usage, label);
    out.push({
      name, markId, usage, operator, issuedBy, issuerOperator, spkiSha256, serialHex, notBefore, notAfter, revocation,
      key: { curve: 'secp384r1', x: p384.bigIntToHex(x), y: p384.bigIntToHex(y) },
      d: found ? found.d : null,
    });
  }
  const unique = [...new Set(out.map((i) => i.spkiSha256))].sort();
  if (unique.length !== PINNED_SPKI.length || unique.some((h, i) => h !== [...PINNED_SPKI].sort()[i])) {
    fail(`intermediate SPKI set differs from the pinned Go block list (got ${unique.length}); review upstream, then update PINNED_SPKI and the post`);
  }
  for (const i of out) {
    const twin = out.find((o) => o.spkiSha256 === i.spkiSha256 && o.d !== i.d);
    if (twin) fail(`${i.name}: same key, different recovered d`);
  }
  return out;
}

function mapRoots(raw) {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 16) fail('roots.json: expected a short array');
  return raw.map((r) => {
    const name = str(r?.name, RE_NAME, 'root name');
    const trust = {};
    for (const store of ['apple', 'chrome', 'microsoft', 'mozilla']) {
      const value = r.root_store_status?.[store];
      trust[store] = TRUST.has(value) ? value : fail(`${name}: root_store_status.${store} is ${JSON.stringify(value)}`);
    }
    return {
      name,
      operator: str(r.operator, RE_NAME, `${name} operator`),
      role: str(r.role, RE_WORD, `${name} role`),
      spkiSha256: str(r.spki_sha256, RE_HEX64, `${name} spki_sha256`).toLowerCase(),
      notBefore: iso(r.not_before, `${name} not_before`),
      notAfter: iso(r.not_after, `${name} not_after`),
      trust,
    };
  });
}

const EVENT_STATUS = new Set(['blocked', 'patched', 'pending', 'never', 'info']);
function validateEvents(events) {
  if (!Array.isArray(events) || events.length > 200) fail('events: expected an array of at most 200');
  const ids = new Set();
  for (const e of events) {
    const id = str(e?.id, /^[a-z0-9-]{1,48}$/, 'event id');
    if (ids.has(id)) fail(`events: duplicate id ${id}`);
    ids.add(id);
    // minute: full UTC time; day: a date; open / never: the pending and firmware items (t repeats the precision).
    if (e.precision === 'minute') iso(e.t, `event ${id} t`);
    else if (e.precision === 'day') str(e.t, RE_DATE, `event ${id} t`);
    else if ((e.precision === 'open' || e.precision === 'never') && e.t === e.precision) { /* fixed words */ }
    else fail(`event ${id}: precision/t ${JSON.stringify(e.precision)}/${JSON.stringify(e.t)}`);
    if (!LANES.has(e.lane)) fail(`event ${id}: lane ${JSON.stringify(e.lane)}`);
    if (typeof e.label !== 'string' || e.label.length < 1 || e.label.length > 200 || /[<>\n]/.test(e.label)) fail(`event ${id}: label`);
    httpsUrl(e.source, `event ${id} source`);
    if (e.end !== undefined && !(typeof e.end === 'string' && (RE_DATE.test(e.end) || RE_ISO.test(e.end)) && !Number.isNaN(Date.parse(e.end)))) fail(`event ${id}: end`);
    if (e.approx !== undefined && typeof e.approx !== 'boolean') fail(`event ${id}: approx`);
    if (e.status !== undefined && !EVENT_STATUS.has(e.status)) fail(`event ${id}: status ${JSON.stringify(e.status)}`);
  }
  return events;
}

const ROW_STATES = new Set(['patched', 'pending']);
function validateChangelog(list) {
  if (!Array.isArray(list) || list.length > MAX_CHANGELOG) fail(`changelog: expected an array of at most ${MAX_CHANGELOG}`);
  for (const c of list) {
    iso(c?.t, 'changelog t');
    str(c.name, RE_NAME, 'changelog name');
    if ((c.from !== null && !ROW_STATES.has(c.from)) || (c.to !== null && !ROW_STATES.has(c.to)) || (c.from === null && c.to === null)) fail('changelog: from/to');
    if (!Array.isArray(c.versions) || c.versions.length > 12) fail('changelog: versions');
    for (const v of c.versions) str(v, RE_VERSION, 'changelog version');
  }
  return list;
}

// Hand-maintained Go facts, seeded once. Values read by go-version.ts and the WebMCP tools.
function validateGo(go) {
  const { fixed, fixedPatch, firstFixedMinor, fixCommit, cve } = go;
  if (!Array.isArray(fixed) || fixed.length === 0 || fixed.some((v) => typeof v !== 'string' || !/^\d+\.\d+\.\d+$/.test(v))) fail('go.fixed: expected a list of versions');
  if (typeof fixedPatch !== 'object' || fixedPatch === null || Object.keys(fixedPatch).length === 0) fail('go.fixedPatch: expected { "1.27": 3, ... }');
  for (const [line, patch] of Object.entries(fixedPatch)) {
    str(line, /^\d+\.\d+$/, 'go.fixedPatch key');
    if (!Number.isInteger(patch) || patch < 0) fail(`go.fixedPatch[${line}]`);
  }
  if (!Number.isInteger(firstFixedMinor) || firstFixedMinor < 1) fail('go.firstFixedMinor');
  str(fixCommit, /^[0-9a-f]{7,40}$/, 'go.fixCommit');
  str(cve, /^CVE-\d{4}-\d{4,}$/, 'go.cve');
  const implied = Object.entries(fixedPatch).map(([line, patch]) => `${line}.${patch}`).sort().join();
  if (implied !== [...fixed].sort().join()) log(`warning: go.fixed (${fixed.join(', ')}) and go.fixedPatch (${implied}) disagree`);
}

// ---- sync --------------------------------------------------------------------------------------------------
async function readData() {
  try {
    return JSON.parse(await readFile(DATA_PATH, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    return fail(`cannot read ${relative(ROOT, DATA_PATH)}: ${error.message}`);
  }
}

async function loadP384() {
  try {
    return await import('../src/lib/incident/p384.ts');
  } catch (error) {
    return fail(`cannot load src/lib/incident/p384.ts (needs Node >= 22.18, or --experimental-strip-types on older 22.x): ${error.message}`);
  }
}

// Rows whose status or versions changed (or that appeared / vanished), as changelog entries stamped `now`.
// Status changes first, then version changes, additions, removals, so the changelog cap keeps the transitions.
function rowChanges(oldRows, newRows, now) {
  const before = new Map(oldRows.map((r) => [r.name, r]));
  const after = new Map(newRows.map((r) => [r.name, r]));
  const entries = [];
  for (const r of newRows) {
    const old = before.get(r.name);
    if (!old) entries.push({ t: now, name: r.name, from: null, to: r.status, versions: r.versions });
    else if (old.status !== r.status || old.versions.join() !== r.versions.join()) entries.push({ t: now, name: r.name, from: old.status, to: r.status, versions: r.versions });
  }
  for (const r of oldRows) if (!after.has(r.name)) entries.push({ t: now, name: r.name, from: r.status, to: null, versions: [] });
  const rank = (e) => (e.from === null ? 2 : e.to === null ? 3 : e.from !== e.to ? 0 : 1);
  return entries.sort((a, b) => rank(a) - rank(b));
}

async function buildData(existing, now) {
  const p384 = await loadP384();
  const commit = parseJson(await fetchText(COMMIT_API), 'commit API');
  const sha = str(commit?.sha, /^[0-9a-f]{40}$/, 'commit sha');
  // Fetch every file at that commit so sourceSha always describes the data, even if upstream moves mid-run.
  const [html, checkerJs, intermediatesText, rootsText] = await Promise.all(
    ['index.html', 'checker.js', 'impacted-intermediates.json', 'roots.json'].map((file) => fetchText(`${RAW_BASE}/${sha}/${file}`)),
  );

  const patched = parsePatchedTable(html);
  const hosts = parseHosts(checkerJs);
  const intermediates = await mapIntermediates(parseJson(intermediatesText, 'impacted-intermediates.json'), p384);
  const roots = mapRoots(parseJson(rootsText, 'roots.json'));

  const events = validateEvents(existing?.events ?? SEED_EVENTS);
  const go = {
    fixed: existing?.go?.fixed ?? SEED_GO.fixed,
    fixedPatch: existing?.go?.fixedPatch ?? SEED_GO.fixedPatch,
    firstFixedMinor: existing?.go?.firstFixedMinor ?? SEED_GO.firstFixedMinor,
    fixCommit: existing?.go?.fixCommit ?? SEED_GO.fixCommit,
    cve: existing?.go?.cve ?? SEED_GO.cve,
  };
  validateGo(go);
  const { fixed: _f, fixedPatch: _p, firstFixedMinor: _m, fixCommit: _c, cve: _v, blockedSpkiSha256: _b, ...goRest } = existing?.go ?? {};
  const goRow = patched.find((r) => r.name === 'Go');
  if (goRow && [...goRow.versions].sort().join() !== [...go.fixed].sort().join()) {
    log(`warning: upstream Go row lists ${goRow.versions.join(', ') || 'no versions'}, go.fixed is ${go.fixed.join(', ')}`);
  }

  // Newest first, capped; kept in the file so the history survives reruns. The first sync has no "before".
  const previous = validateChangelog(existing?.changelog ?? []);
  const changelog = [...(existing ? rowChanges(existing.patched ?? [], patched, now) : []), ...previous].slice(0, MAX_CHANGELOG);

  const pending = patched.filter((r) => r.status === 'pending').length;
  return {
    sourceSha: sha.slice(0, 7),
    sourceUrl: SOURCE_URL,
    counts: { total: patched.length, patched: patched.length - pending, pending },
    patched,
    roots,
    intermediates,
    hosts,
    events,
    go: { ...go, blockedSpkiSha256: [...PINNED_SPKI], ...goRest },
    changelog,
  };
}

// asOf/syncedAt first, then the rest in contract order.
const assemble = (core, syncedAt) => ({ asOf: syncedAt, syncedAt, ...core });
const comparable = (data) => {
  if (!data) return null;
  const { asOf: _a, syncedAt: _s, ...rest } = data;
  return JSON.stringify(rest);
};

// ---- summary -----------------------------------------------------------------------------------------------
function summarize(old, next) {
  if (!old) {
    return [`Initial sync from ${REPO}@${next.sourceSha}: ${next.counts.total} packages, ${next.counts.patched} patched, ${next.counts.pending} pending; ${next.intermediates.length} intermediates, ${next.roots.length} roots, ${next.hosts.length} hosts.`];
  }
  const lines = [];
  if (old.sourceSha !== next.sourceSha) lines.push(`Upstream commit ${old.sourceSha} -> ${next.sourceSha}`);
  const c = (k) => (old.counts?.[k] === next.counts[k] ? null : `${k} ${old.counts?.[k]} -> ${next.counts[k]}`);
  const counts = ['total', 'patched', 'pending'].map(c).filter(Boolean);
  if (counts.length) lines.push(`Counts: ${counts.join(', ')}`);

  // Rows synced before `urls` existed share `url` across all their versions.
  const rowSig = (r) => JSON.stringify([r.versions, r.url, r.urls ?? r.versions.map(() => r.url), r.status]);
  const oldRows = new Map((old.patched ?? []).map((r) => [r.name, r]));
  const newRows = new Map(next.patched.map((r) => [r.name, r]));
  const show = (r) => `${r.versions.join(', ') || 'no version'} [${r.status}]`;
  for (const [name, r] of newRows) {
    const before = oldRows.get(name);
    if (!before) lines.push(`Added: ${name}: ${show(r)}`);
    else if (rowSig(before) !== rowSig(r)) lines.push(`Changed: ${name}: ${show(before)} -> ${show(r)}${before.url === r.url ? '' : ' (link changed)'}`);
  }
  for (const [name, r] of oldRows) if (!newRows.has(name)) lines.push(`Removed: ${name}: ${show(r)}`);

  const oldRoots = new Map((old.roots ?? []).map((r) => [r.name, JSON.stringify(r)]));
  for (const r of next.roots) {
    if (!oldRoots.has(r.name)) lines.push(`Root added: ${r.name}`);
    else if (oldRoots.get(r.name) !== JSON.stringify(r)) lines.push(`Root changed: ${r.name} (${Object.entries(r.trust).map(([k, v]) => `${k}: ${v}`).join(', ')})`);
  }
  const key = (i) => `${i.issuedBy} / ${i.name}`;
  const interSig = (i) => JSON.stringify([i.spkiSha256, i.revocation, i.d, i.notBefore, i.notAfter]);
  const oldInter = new Map((old.intermediates ?? []).map((i) => [key(i), interSig(i)]));
  for (const i of next.intermediates) {
    if (!oldInter.has(key(i))) lines.push(`Intermediate added: ${key(i)}`);
    else if (oldInter.get(key(i)) !== interSig(i)) lines.push(`Intermediate changed: ${key(i)} (revocation ${i.revocation.status}, d ${i.d})`);
  }
  const oldHosts = new Set(old.hosts ?? []);
  for (const h of next.hosts) if (!oldHosts.has(h)) lines.push(`Host added: ${h}`);
  for (const h of oldHosts) if (!next.hosts.includes(h)) lines.push(`Host removed: ${h}`);

  if (lines.length === 0) lines.push('Only fields outside the rendered tables changed.');
  const MAX = 60;
  return lines.length > MAX ? [...lines.slice(0, MAX), `... and ${lines.length - MAX} more`] : lines;
}

// ---- rendering ---------------------------------------------------------------------------------------------
const esc = (s) => s.replace(/[\\`*_[\]<>|~&]/g, '\\$&');
const linkUrl = (u) => u.replace(/[()<>\s\\`]/g, (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')}`);
const stamp = (isoDate) => `${isoDate.slice(0, 10)} ${isoDate.slice(11, 16)}`;
// 21 Oct 2026, 09:00 (the strip's format)
const longStamp = (isoDate) => `${Number(isoDate.slice(8, 10))} ${MONTHS[Number(isoDate.slice(5, 7)) - 1]} ${isoDate.slice(0, 4)}, ${isoDate.slice(11, 16)}`;
const bitLength = (d) => d.toString(2).length;
const USE = { tls: 'TLS', 'code-signing': 'Code signing' };

function renderBlocks(data) {
  const pending = data.patched.filter((r) => r.status === 'pending');
  const done = data.patched.filter((r) => r.status !== 'pending');
  const shortName = (r) => r.name.split(' ')[0];
  const sha = data.sourceSha;
  const stats = `**${data.counts.patched} of ${data.counts.total}** packages patched · **${data.counts.pending}** pending${pending.length ? ` (${pending.map(shortName).join(', ')})` : ''} · synced ${stamp(data.syncedAt)} UTC from [${REPO}@${sha}](${linkUrl(`${data.sourceUrl}/commit/${sha}`)})`;

  const versionCell = (r) => (r.versions.length ? r.versions.map((v, i) => `[${esc(v)}](${linkUrl(r.urls?.[i] ?? r.url)})`).join(', ') : `[tracking](${linkUrl(r.url)})`);
  const patchedTable = [
    '| Software | Patched version | Status |',
    '| --- | --- | --- |',
    ...[...pending, ...done].map((r) => `| ${esc(r.name)} | ${versionCell(r)} | ${r.status === 'pending' ? 'Pending' : 'Patched'} |`),
  ].join('\n');

  const rootsTable = [
    '| Root | Apple | Chrome | Microsoft | Mozilla |',
    '| --- | --- | --- | --- | --- |',
    ...data.roots.map((r) => `| ${esc(r.name)} | ${r.trust.apple} | ${r.trust.chrome} | ${r.trust.microsoft} | ${r.trust.mozilla} |`),
  ].join('\n');

  const interTable = [
    '| Intermediate | Use | Operator | d | Bits | Revoked | SPKI SHA-256 |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...data.intermediates
      .filter((i) => i.issuerOperator === 'eMudhra')
      .map((i) => `| ${esc(i.name)} | ${USE[i.usage] ?? esc(i.usage)} | ${esc(i.operator)} | ${i.d ?? 'not found'} | ${i.d === null ? 'n/a' : bitLength(i.d)} | ${i.revocation.status === 'revoked' && i.revocation.date ? `${stamp(i.revocation.date)} UTC` : 'No'} | \`${i.spkiSha256.slice(0, 12)}\` |`),
  ].join('\n');

  const hosts = data.hosts.map((h) => `- \`${h}\``).join('\n');

  const strip = `**${data.counts.patched}/${data.counts.total}** patched · as of ${longStamp(data.syncedAt)} UTC`;

  // Newest first. Same status with new versions reads as "versions changed"; the spec's "x to y" would read "patched to patched".
  const changelogLine = (c) => {
    const versions = c.versions.length ? ` (${c.versions.map(esc).join(', ')})` : '';
    const name = esc(c.name);
    const what = c.from === null ? `added as ${c.to}${versions}`
      : c.to === null ? 'removed from the table'
        : c.from === c.to ? `${c.to}, versions changed${versions}`
          : `${c.from} to ${c.to}${versions}`;
    return `- ${stamp(c.t)} UTC: ${name} ${what}`;
  };
  const changelog = (data.changelog ?? []).length
    ? data.changelog.slice(0, MAX_CHANGELOG).map(changelogLine).join('\n')
    : 'No tracker changes since publication.';

  return { strip, stats, patched: patchedTable, roots: rootsTable, intermediates: interTable, hosts, changelog };
}

function replaceBlock(text, name, block, warnings) {
  const start = `<!-- tracker:${name}:start -->`;
  const end = `<!-- tracker:${name}:end -->`;
  const si = text.indexOf(start);
  const ei = text.indexOf(end);
  if (si === -1 || ei === -1) {
    warnings.push(`marker ${name}: ${si === -1 ? 'start' : 'end'} marker missing, block skipped`);
    return text;
  }
  if (text.indexOf(start, si + 1) !== -1 || text.indexOf(end, ei + 1) !== -1 || ei < si) {
    warnings.push(`marker ${name}: duplicated or out of order, block skipped`);
    return text;
  }
  // Blank lines on both sides keep a table or list from being swallowed by the HTML comment block (CommonMark).
  return `${text.slice(0, si + start.length)}\n\n${block}\n\n${text.slice(ei)}`;
}

function setUpdated(text, date, warnings) {
  const fm = /^---\n([\s\S]*?)\n---\n/.exec(text);
  if (!fm) {
    warnings.push('post has no frontmatter; updated: not bumped');
    return text;
  }
  const front = fm[1];
  const next = /^updated:.*$/m.test(front)
    ? front.replace(/^updated:.*$/m, `updated: ${date}`)
    : /^date:.*$/m.test(front)
      ? front.replace(/^(date:.*)$/m, `$1\nupdated: ${date}`)
      : null;
  if (next === null) {
    warnings.push('post frontmatter has neither updated: nor date:; updated: not bumped');
    return text;
  }
  return `---\n${next}\n---\n${text.slice(fm[0].length)}`;
}

function rewritePost(text, data) {
  const warnings = [];
  const blocks = renderBlocks(data);
  let next = text;
  for (const name of BLOCKS) next = replaceBlock(next, name, blocks[name], warnings);
  if (next !== text) next = setUpdated(next, data.syncedAt.slice(0, 10), warnings);
  return { text: next, warnings, changedBlocks: BLOCKS.filter((name) => replaceBlock(text, name, blocks[name], []) !== text) };
}

// ---- main --------------------------------------------------------------------------------------------------
function parseArgs(argv) {
  const opts = { check: false, printBlocks: false, post: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--check') opts.check = true;
    else if (arg === '--print-blocks') opts.printBlocks = true;
    else if (arg === '--post') opts.post = argv[++i] ?? null;
    else return { error: `unknown argument: ${arg}` };
  }
  if (argv.includes('--post') && !opts.post) return { error: '--post needs a path' };
  if (opts.printBlocks && (opts.check || opts.post)) return { error: '--print-blocks cannot be combined with --check or --post' };
  return opts;
}

function postPath(arg) {
  const full = resolve(process.cwd(), arg);
  if (relative(ROOT, full).startsWith('..') || !full.endsWith('.md')) fail(`--post must be a .md file inside the repository: ${arg}`);
  return full;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.error) {
    console.error(`${opts.error}\nusage: node scripts/sync-emudhra-tracker.mjs [--check] [--post <path.md>] | [--print-blocks]`);
    return 2;
  }

  if (opts.printBlocks) {
    const data = await readData();
    if (!data) fail(`${relative(ROOT, DATA_PATH)} does not exist yet; run the sync first`);
    const blocks = renderBlocks(data);
    for (const name of BLOCKS) console.log(`<!-- tracker:${name}:start -->\n\n${blocks[name]}\n\n<!-- tracker:${name}:end -->\n`);
    return 0;
  }

  const postFile = opts.post ? postPath(opts.post) : null;
  const postText = postFile ? await readFile(postFile, 'utf8').catch((e) => fail(`cannot read ${opts.post}: ${e.message}`)) : null;

  const existing = await readData();
  const now = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const core = await buildData(existing, now);
  const dataChanged = comparable(existing) !== comparable(core);
  const data = dataChanged ? assemble(core, now) : existing;

  const summary = dataChanged ? summarize(existing, core) : [];
  let post = null;
  if (postFile) {
    post = rewritePost(postText, data);
    for (const w of post.warnings) log(`warning: ${w}`);
    if (post.text !== postText) {
      const date = data.syncedAt.slice(0, 10);
      summary.push(`Post blocks rewritten: ${post.changedBlocks.join(', ') || 'updated: only'}; updated: ${date}`);
    }
  }
  const postChanged = post !== null && post.text !== postText;

  if (!dataChanged && !postChanged) {
    console.log(`No change (${REPO}@${data.sourceSha}: ${data.counts.total} packages, ${data.counts.patched} patched, ${data.counts.pending} pending).`);
    return 0;
  }

  console.log(summary.join('\n').replace(/^(?!Initial)/gm, '- '));
  if (opts.check) {
    console.log(`\n--check: ${[dataChanged ? relative(ROOT, DATA_PATH) : null, postChanged ? opts.post : null].filter(Boolean).join(' and ')} would change.`);
    return 1;
  }

  if (dataChanged) {
    await mkdir(dirname(DATA_PATH), { recursive: true });
    const tmp = `${DATA_PATH}.tmp`;
    await writeFile(tmp, `${JSON.stringify(data, null, 2)}\n`);
    await rename(tmp, DATA_PATH);
    log(`wrote ${relative(ROOT, DATA_PATH)}`);
  }
  if (postChanged) {
    await writeFile(postFile, post.text);
    log(`wrote ${relative(ROOT, postFile)}`);
  }
  return 0;
}

try {
  process.exitCode = await main();
} catch (error) {
  if (error instanceof SyncError) console.error(`error: ${error.message}`);
  else console.error(`error: ${error?.stack ?? error}`);
  process.exitCode = 3;
}
