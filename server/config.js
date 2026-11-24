function parseHttpOrigin(rawValue, envName, { requireHttps = false } = {}) {
  let parsed;
  try {
    parsed = new URL(String(rawValue || ''));
  } catch {
    return `${envName} must be a valid URL`;
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) return `${envName} must use http or https`;
  if (requireHttps && parsed.protocol !== 'https:') return `${envName} must use https in production`;
  if (parsed.username || parsed.password) return `${envName} must not embed credentials`;
  if (parsed.pathname !== '/' || parsed.search || parsed.hash) return `${envName} must be an origin without path, query, or hash`;
  return null;
}

function parseCallbackUrl(rawValue, envName, expectedOrigin) {
  let parsed;
  try {
    parsed = new URL(String(rawValue || ''));
  } catch {
    return `${envName} must be a valid URL`;
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) return `${envName} must use http or https`;
  if (parsed.username || parsed.password) return `${envName} must not embed credentials`;
  if (expectedOrigin && parsed.origin !== expectedOrigin) return `${envName} origin must match APP_ORIGIN`;
  return null;
}

function parseDatabaseUrl(rawValue) {
  let parsed;
  try {
    parsed = new URL(String(rawValue || ''));
  } catch {
    return 'DATABASE_URL must be a valid PostgreSQL URL';
  }
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol) || !parsed.hostname) {
    return 'DATABASE_URL must use postgres:// or postgresql:// with a hostname';
  }
  return null;
}

function parseEncryptionKey(rawValue) {
  const text = String(rawValue || '').trim();
  if (!text) return 'GOOGLE_INTEGRATION_ENCRYPTION_KEY is required';
  const decoded = Buffer.from(text, 'base64');
  if (decoded.length !== 32) return 'GOOGLE_INTEGRATION_ENCRYPTION_KEY must be a base64-encoded 32-byte key';
  return null;
}

/**
 * Validate required runtime configuration at process startup without ever
 * exposing secret values in error messages or logs.
 */
export function validateStartupConfig(env = process.env) {
  const errors = [];
  const isProduction = env.NODE_ENV === 'production';
  const isTest = env.NODE_ENV === 'test';
  const mockOAuth = env.GOOGLE_OAUTH_MODE === 'mock';

  const portValue = env.PORT == null || env.PORT === '' ? 3001 : Number(env.PORT);
  if (!Number.isInteger(portValue) || portValue < 1 || portValue > 65535) {
    errors.push('PORT must be an integer between 1 and 65535');
  }

  if (mockOAuth && !isTest) {
    errors.push('GOOGLE_OAUTH_MODE=mock is forbidden outside test mode');
  }

  if (!env.DATABASE_URL) {
    errors.push('DATABASE_URL is required');
  } else {
    const dbError = parseDatabaseUrl(env.DATABASE_URL);
    if (dbError) errors.push(dbError);
  }

  let normalizedOrigin = null;
  if (env.APP_ORIGIN) {
    const originError = parseHttpOrigin(env.APP_ORIGIN, 'APP_ORIGIN', { requireHttps: isProduction });
    if (originError) errors.push(originError);
    else normalizedOrigin = new URL(env.APP_ORIGIN).origin;
  } else if (isProduction) {
    errors.push('APP_ORIGIN is required in production');
  }

  if (env.GOOGLE_INTEGRATION_ENCRYPTION_KEY || isProduction) {
    const keyError = parseEncryptionKey(env.GOOGLE_INTEGRATION_ENCRYPTION_KEY);
    if (keyError) errors.push(keyError);
  }

  if (isProduction) {
    const requiredProd = [
      'GOOGLE_CLIENT_ID',
      'GOOGLE_CLIENT_SECRET',
      'GOOGLE_REDIRECT_URI',
      'ADMIN_EMAILS',
    ];
    for (const key of requiredProd) {
      if (!String(env[key] || '').trim()) errors.push(`${key} is required in production`);
    }
    if (env.GOOGLE_REDIRECT_URI) {
      const redirectError = parseCallbackUrl(env.GOOGLE_REDIRECT_URI, 'GOOGLE_REDIRECT_URI', normalizedOrigin);
      if (redirectError) errors.push(redirectError);
    }
    if (env.GOOGLE_INTEGRATION_REDIRECT_URI) {
      const workspaceRedirectError = parseCallbackUrl(env.GOOGLE_INTEGRATION_REDIRECT_URI, 'GOOGLE_INTEGRATION_REDIRECT_URI', normalizedOrigin);
      if (workspaceRedirectError) errors.push(workspaceRedirectError);
    }
    const adminEmails = String(env.ADMIN_EMAILS || '').split(',').map((item) => item.trim()).filter(Boolean);
    if (!adminEmails.length) errors.push('ADMIN_EMAILS must contain at least one administrator email');
  }

  if (errors.length) {
    const error = new Error(`Invalid startup configuration: ${errors.join('; ')}`);
    error.code = 'INVALID_STARTUP_CONFIG';
    error.issues = errors;
    throw error;
  }

  return {
    port: portValue,
    host: env.HOST || '0.0.0.0',
    nodeEnv: env.NODE_ENV || 'development',
    hasAppOrigin: Boolean(normalizedOrigin),
    mockOAuth,
  };
}
