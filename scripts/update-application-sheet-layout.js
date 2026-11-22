import { getPool } from '../server/db.js';
import { updateGoogleWorkspaceApplicationLayouts } from '../server/googleWorkspace.js';

try {
  const result = await updateGoogleWorkspaceApplicationLayouts({ dryRun: !process.argv.includes('--apply') });
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await getPool().end();
}
