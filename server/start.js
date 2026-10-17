import { app } from './index.js';
import { startIntegrationWorker } from './integrationWorker.js';

const port = Number(process.env.PORT || 3001);
const host = process.env.HOST || '0.0.0.0';
if (!Number.isInteger(port) || port < 1) throw new Error('Invalid PORT');
const stopIntegrationWorker = startIntegrationWorker(app.log);
app.addHook('onClose', async () => stopIntegrationWorker());
app.listen({ port, host }).catch((error) => { stopIntegrationWorker(); app.log.error(error); process.exitCode = 1; });
