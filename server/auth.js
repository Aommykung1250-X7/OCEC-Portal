import { createHash, randomBytes } from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';
import { getPool } from './db.js';
import { bindFinalGrantToUser, finalGrantTokenFromRequest, findLiveFinalGrant } from './finalEligibility.js';

const hash = (value) => createHash('sha256').update(value).digest('hex');
const random = () => randomBytes(32).toString('base64url');
const cookieName = 'ocec_session';
const stateCookieName = 'ocec_oauth_state';
const isSecure = () => process.env.APP_ORIGIN?.startsWith('https://');
const cookie = (value, maxAge) => `${cookieName}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${isSecure() ? '; Secure' : ''}`;
const mockOAuth = () => process.env.GOOGLE_OAUTH_MODE === 'mock';
const oauthReady = () => Boolean(process.env.APP_ORIGIN && (mockOAuth() || (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REDIRECT_URI)));
const mockProfiles = Object.freeze({
  candidate: { sub: 'ocec-test-candidate', email: 'candidate@ocec.test', name: 'Test Candidate', email_verified: true },
  coordinator: { sub: 'ocec-test-coordinator', email: 'coordinator@ocec.test', name: 'Test Coordinator', email_verified: true },
  admin: { sub: 'ocec-test-admin', email: 'admin@ocec.test', name: 'Test Admin', email_verified: true },
});
const configuredAdminEmails = () => (process.env.ADMIN_EMAILS || '').split(',').map((email) => email.trim().toLowerCase()).filter(Boolean);
const isConfiguredAdmin = (email) => configuredAdminEmails().includes(String(email || '').trim().toLowerCase());

function returnPath(value) {
  if (typeof value !== 'string' || !/^\/(?!\/)[^\\\r\n]*$/.test(value)) return '/';
  try {
    const parsed = new URL(value, 'https://portal.invalid');
    return `${parsed.pathname}${parsed.search}`;
  } catch { return '/'; }
}

export async function currentUser(request) {
  const raw = request.headers.cookie?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${cookieName}=`));
  const token = raw?.slice(cookieName.length + 1);
  if (!token || !/^[A-Za-z0-9_-]{32,}$/.test(token)) return null;
  const result = await getPool().query(`SELECT u.id, u.email, u.display_name, u.picture_url, u.is_admin
    FROM sessions s JOIN users u ON u.id=s.user_id
    WHERE s.token_hash=$1 AND s.expires_at>now() AND u.is_active=true`, [hash(token)]);
  const user = result.rows[0];
  return user ? { ...user, is_admin: isConfiguredAdmin(user.email) } : null;
}

export async function requireUser(request, reply) {
  const user = await currentUser(request);
  if (!user) return reply.code(401).send({ error: 'Authentication required' });
  request.user = user;
}

export async function requireAdmin(request, reply) {
  const user = await currentUser(request);
  if (!user) return reply.code(401).send({ error: 'Authentication required' });
  if (!user.is_admin) return reply.code(403).send({ error: 'Administrator access required' });
  request.user = user;
}

export function registerAuthRoutes(app) {
  if (mockOAuth() && process.env.NODE_ENV !== 'test') throw new Error('Mock Google OAuth is available only in test mode');
  app.get('/api/auth/google/start', async (request, reply) => {
    if (!oauthReady()) return reply.code(503).send({ error: 'Google Login is not configured' });
    const finalToken = request.query?.flow === 'final' ? finalGrantTokenFromRequest(request) : null;
    const finalGrant = finalToken ? await findLiveFinalGrant(finalToken) : null;
    if (finalToken && !finalGrant) return reply.code(403).send({ error: 'Final verification expired' });
    const state = random();
    const nonce = random();
    const verifier = random();
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    await getPool().query('INSERT INTO oauth_attempts(state_hash, nonce, code_verifier, return_path, expires_at, final_verification_grant_id) VALUES($1,$2,$3,$4,now()+interval \'10 minutes\',$5)', [hash(state), nonce, verifier, returnPath(request.query?.returnTo), finalGrant?.id || null]);
    reply.header('Set-Cookie', `${stateCookieName}=${state}; Path=/api/auth/google/callback; HttpOnly; SameSite=Lax; Max-Age=600${isSecure() ? '; Secure' : ''}`);
    if (mockOAuth()) {
      const persona = Object.hasOwn(mockProfiles, request.query?.testPersona) ? request.query.testPersona : 'candidate';
      const callback = new URL('/api/auth/google/callback', process.env.APP_ORIGIN);
      callback.search = new URLSearchParams({ state, code: persona, ...(request.query?.testNonce === 'wrong' ? { testNonce: 'wrong' } : {}) }).toString();
      return reply.redirect(callback.toString());
    }
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.search = new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID, redirect_uri: process.env.GOOGLE_REDIRECT_URI, response_type: 'code', scope: 'openid email profile', access_type: 'online', state, nonce, code_challenge: challenge, code_challenge_method: 'S256', prompt: 'select_account' }).toString();
    return reply.redirect(url.toString());
  });

  app.get('/api/auth/google/callback', async (request, reply) => {
    const { code, state, error } = request.query || {};
    if (error || typeof code !== 'string' || typeof state !== 'string') return reply.code(400).send({ error: 'Google authentication cancelled or invalid' });
    const browserState = request.headers.cookie?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${stateCookieName}=`))?.slice(stateCookieName.length + 1);
    if (state !== browserState) return reply.code(400).send({ error: 'Authentication state mismatch' });
    reply.header('Set-Cookie', `${stateCookieName}=; Path=/api/auth/google/callback; HttpOnly; SameSite=Lax; Max-Age=0${isSecure() ? '; Secure' : ''}`);
    const attempt = await getPool().query('DELETE FROM oauth_attempts WHERE state_hash=$1 AND expires_at>now() RETURNING *', [hash(state)]);
    if (!attempt.rowCount) return reply.code(400).send({ error: 'Authentication attempt expired' });
    let profile;
    if (mockOAuth()) {
      profile = mockProfiles[code] ? { ...mockProfiles[code], nonce: request.query?.testNonce === 'wrong' ? 'invalid-nonce' : attempt.rows[0].nonce } : null;
    } else {
      const values = new URLSearchParams({ code, client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, redirect_uri: process.env.GOOGLE_REDIRECT_URI, grant_type: 'authorization_code', code_verifier: attempt.rows[0].code_verifier });
      const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: values });
      if (!response.ok) return reply.code(502).send({ error: 'Google token exchange failed' });
      const tokens = await response.json();
      if (!tokens.id_token) return reply.code(502).send({ error: 'Google ID token missing' });
      const ticket = await new OAuth2Client().verifyIdToken({ idToken: tokens.id_token, audience: process.env.GOOGLE_CLIENT_ID });
      profile = ticket.getPayload();
    }
    if (!profile?.sub || !profile.email || !profile.email_verified || profile.nonce !== attempt.rows[0].nonce) return reply.code(403).send({ error: 'Google identity verification failed' });
    const isAdmin = isConfiguredAdmin(profile.email);
    const user = await getPool().query(`INSERT INTO users(google_sub, email, display_name, picture_url, is_admin)
      VALUES($1,$2,$3,$4,$5) ON CONFLICT (google_sub) DO UPDATE SET
      email=excluded.email, display_name=excluded.display_name, picture_url=excluded.picture_url,
      is_admin=excluded.is_admin, updated_at=now() RETURNING id`, [profile.sub, profile.email, profile.name || profile.email, profile.picture || null, isAdmin]);
    if (attempt.rows[0].final_verification_grant_id) await bindFinalGrantToUser(attempt.rows[0].final_verification_grant_id, user.rows[0].id);
    const session = random();
    await getPool().query('INSERT INTO sessions(token_hash, user_id, expires_at) VALUES($1,$2,now()+interval \'14 days\')', [hash(session), user.rows[0].id]);
    reply.header('Set-Cookie', [
      `${stateCookieName}=; Path=/api/auth/google/callback; HttpOnly; SameSite=Lax; Max-Age=0${isSecure() ? '; Secure' : ''}`,
      cookie(session, 14 * 24 * 60 * 60),
    ]);
    return reply.redirect(new URL(attempt.rows[0].return_path, process.env.APP_ORIGIN).toString());
  });

  app.get('/api/auth/me', async (request) => {
    const user = await currentUser(request);
    return { user: user ? { id: user.id, email: user.email, name: user.display_name, picture: user.picture_url, isAdmin: user.is_admin } : null };
  });

  app.post('/api/auth/logout', async (request, reply) => {
    const raw = request.headers.cookie?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${cookieName}=`));
    const token = raw?.slice(cookieName.length + 1);
    if (token) await getPool().query('DELETE FROM sessions WHERE token_hash=$1', [hash(token)]);
    reply.header('Set-Cookie', cookie('', 0));
    return { ok: true };
  });
}
