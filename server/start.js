import { validateStartupConfig } from './config.js';
import { app } from './index.js';
import { startIntegrationWorker } from './integrationWorker.js';

const runtimeConfig = validateStartupConfig(process.env);
const stopIntegrationWorker = startIntegrationWorker(app.log);
app.addHook('onClose', async () => stopIntegrationWorker());
app.listen({ port: runtimeConfig.port, host: runtimeConfig.host }).catch((error) => {
  stopIntegrationWorker();
  app.log.error(error);
  process.exitCode = 1;
});
