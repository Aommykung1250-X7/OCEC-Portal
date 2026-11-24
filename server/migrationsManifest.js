import { readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), 'migrations');

/**
 * Single authoritative list of SQL migrations required by this release.
 * Shared by both the migration runner (`server/migrate.js`) and `/api/ready`.
 */
export const RELEASE_MIGRATIONS = Object.freeze([
  '001_initial.sql',
  '002_drafts.sql',
  '003_google_workspace.sql',
  '004_application_submission.sql',
  '005_catalog_and_application_edit.sql',
  '006_integrations_outbox.sql',
  '007_sheet_row_tracking.sql',
  '008_outbox_index_cleanup.sql',
  '009_results_and_photos.sql',
  '010_remove_payment_slip_ocr.sql',
  '011_admin_application_editing.sql',
  '012_competition_choices.sql',
  '013_admin_application_notes.sql',
  '014_final_verification_grants.sql',
  '015_mock_delivery_sheets.sql',
  '016_archive_past_papers.sql',
  '017_paper_based_center_poster.sql',
  '018_online_center_default.sql',
  '019_bbb_final_x_eligibility.sql',
  '020_final_shirts.sql',
  '021_final_registration_packages.sql',
  '022_final_overseas_center.sql',
  '023_payment_slip_inspections.sql',
  '024_result_publication_snapshots.sql',
  '025_catalog_revision.sql',
]);

export const LATEST_RELEASE_MIGRATION = RELEASE_MIGRATIONS[RELEASE_MIGRATIONS.length - 1];

export async function listDiskMigrations(dir = migrationsDir) {
  return (await readdir(dir)).filter((name) => /^\d+.*\.sql$/.test(name)).sort();
}

export async function verifyReleaseMigrationsManifest(dir = migrationsDir) {
  const onDisk = await listDiskMigrations(dir);
  const declared = [...RELEASE_MIGRATIONS];
  const missingOnDisk = declared.filter((name) => !onDisk.includes(name));
  const undeclaredOnDisk = onDisk.filter((name) => !declared.includes(name));
  if (missingOnDisk.length || undeclaredOnDisk.length) {
    throw new Error(
      `Release migration manifest mismatch (missingOnDisk: ${missingOnDisk.join(', ') || 'none'}; undeclaredOnDisk: ${undeclaredOnDisk.join(', ') || 'none'})`,
    );
  }
  return declared;
}
