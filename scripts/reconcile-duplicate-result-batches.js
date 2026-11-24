import { fileURLToPath } from 'node:url';
import { getPool } from '../server/db.js';
import { reconcileDuplicatePublishedBatches } from '../server/resultMigrationPreflight.js';

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token.startsWith('--')) {
      args[token.slice(2)] = argv[index + 1];
      index += 1;
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.round || !args['approved-batch'] || !args['approval-note']) {
    process.stderr.write('Usage: node --env-file-if-exists=.env scripts/reconcile-duplicate-result-batches.js --round <exam_round_id> --approved-batch <batch_uuid> --approval-note "<owner approval reference>" [--actor <admin_uuid>]\n');
    process.exitCode = 1;
    return;
  }
  try {
    const result = await reconcileDuplicatePublishedBatches({
      examRoundId: args.round,
      approvedBatchId: args['approved-batch'],
      ownerApprovalNote: args['approval-note'],
      actorUserId: args.actor || null,
    });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } finally {
    await getPool().end().catch(() => {});
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
