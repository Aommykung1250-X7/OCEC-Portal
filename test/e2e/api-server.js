import { app } from '../../server/index.js';
import { installMockGoogleWorkspace } from './google-workspace-mock.js';

if (process.env.NODE_ENV !== 'test' || process.env.GOOGLE_OAUTH_MODE !== 'mock') {
  throw new Error('The browser-test API server only runs in mock test mode');
}
await installMockGoogleWorkspace();
await app.listen({ host: '127.0.0.1', port: Number(process.env.E2E_API_PORT || 3001) });
