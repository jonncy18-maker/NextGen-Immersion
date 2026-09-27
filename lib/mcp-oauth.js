import crypto from 'node:crypto';
import { getDb } from './api/_db.js';

// OAuth 2.1 handshake for the MCP server (app/api/mcp) — claude.ai's hosted
// "Add custom connector" flow requires OAuth + dynamic client registration
// per the MCP spec; Claude Code's own MCP config and ChatGPT's "Access
// token / API key" connector mode take a bare bearer header directly and
// need none of this.
//
// This is NOT a second credential. The access/refresh token this flow
// ultimately hands back is the MCP server's own bearer secret
// (IMMERSION_MCP_TOKEN) — OAuth here is only a handshake proving the caller
// knows that secret (typed into the /authorize page), not a new identity
// system. Client IDs are not tracked or validated anywhere in this flow —
// the real gate is the token typed into /authorize.

const CODE_TTL_MS = 5 * 60 * 1000; // short-lived, single-use

// This app has no Vercel Authentication wall in front of it, so this is
// currently always a no-op — kept only so a future protection layer doesn't
// silently break MCP discovery the way it would without this escape hatch.
export function withBypass(url) {
  const secret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  if (!secret) return url;
  const u = new URL(url);
  u.searchParams.set('x-vercel-protection-bypass', secret);
  u.searchParams.set('x-vercel-set-bypass-cookie', 'true');
  return u.toString();
}

export function protectedResourceMetadata(origin, resourcePath) {
  const resource = `${origin}${resourcePath}`;
  // RFC 9728 requires this to be a clean issuer identifier — no query string
  // — so it can never carry the bypass secret directly.
  return { resource, authorization_servers: [resource] };
}

export function authorizationServerMetadata(origin, resourcePath) {
  const issuer = `${origin}${resourcePath}`;
  return {
    issuer,
    authorization_endpoint: withBypass(`${origin}${resourcePath}/authorize`),
    token_endpoint: withBypass(`${origin}${resourcePath}/token`),
    registration_endpoint: withBypass(`${origin}${resourcePath}/register`),
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
  };
}

export async function createAuthCode({
  server,
  codeChallenge,
  codeChallengeMethod,
  redirectUri,
}) {
  const sql = getDb();
  // Opportunistic sweep so expired, never-redeemed codes don't accumulate —
  // volume here is one login every so often, not worth a cron for.
  await sql`DELETE FROM mcp_auth_codes WHERE expires_at < now()`;

  const code = crypto.randomBytes(24).toString('hex');
  const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString();
  await sql`
    INSERT INTO mcp_auth_codes
      (code, server, code_challenge, code_challenge_method, redirect_uri,
       expires_at)
    VALUES (${code}, ${server}, ${codeChallenge || null},
            ${codeChallengeMethod || 'S256'}, ${redirectUri}, ${expiresAt})
  `;
  return code;
}

// Single-use by construction: DELETE ... RETURNING both consumes the row and
// hands back what it held, so a replayed code always finds nothing.
export async function consumeAuthCode({ server, code, codeVerifier }) {
  if (!code || !server) return false;
  const sql = getDb();
  const [row] = await sql`
    DELETE FROM mcp_auth_codes
    WHERE code = ${code} AND server = ${server}
    RETURNING *
  `;
  if (!row) return false;
  if (new Date(row.expires_at).getTime() < Date.now()) return false;
  if (!row.code_challenge) return true; // client didn't send PKCE params

  const computed = crypto
    .createHash('sha256')
    .update(codeVerifier || '')
    .digest('base64url');
  return computed === row.code_challenge;
}
