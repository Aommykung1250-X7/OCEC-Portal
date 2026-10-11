import { app } from './index.js';

const port = Number(process.env.PORT || 3001);
if (!Number.isInteger(port) || port < 1) throw new Error('Invalid PORT');
app.listen({ port, host: '0.0.0.0' }).catch((error) => { app.log.error(error); process.exitCode = 1; });
