import Fastify from 'fastify';
import { createHash } from 'node:crypto';
import fastifyStatic from '@fastify/static';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { getPool, transaction } from './db.js';
import { archiveExamRound, loadCatalog, saveCatalogSnapshot, savePaymentAccountsSnapshot, updateExamRound } from './catalog.js';
import { registerAuthRoutes, requireAdmin, requireUser } from './auth.js';
import { createApplicationAdminNote, createIndividualDraft, createSchoolDraft, deleteApplicationAdminNote, downloadCertificatePhoto, getPublicApplicationForEdit, getSlipReplacementStatus, listAllApplications, listApplicationAdminNotes, listMyApplications, removeCertificatePhoto, replacePaymentSlip, reviewApplication, searchPublicApplicationStatuses, submitIndividualApplication, submitSchoolBatch, updateAdminApplication, updateApplicationAdminNote, updateOwnedApplicationProfile, updatePublicApplicationProfile, uploadCertificatePhoto } from './applications.js';
import { completeGoogleWorkspaceAuthorization, createGoogleWorkspaceAuthorizationUrl, downloadGoogleDriveFile, googleWorkspaceStatus, initializeGoogleDriveFolders } from './googleWorkspace.js';
import { enqueueIntegrationJob, integrationQueueStatus, retryIntegrationJob } from './integrationQueue.js';
import { applyFinalIds, generateExamNumbers, getFinalIdImport, importFinalIds, importResultRows, listAdminResultWorkflows, listPublishedResults, publishResultBatch, resolveFinalIdImportRow, resolveResultImportRow } from './results.js';
import { createFinalVerificationGrant, finalGrantCookie, finalGrantTokenFromRequest, listFinalEligibilityForUser, searchSchoolFinalEligibility } from './finalEligibility.js';

export const app = Fastify({ logger: true, bodyLimit: 16 * 1024 * 1024, trustProxy: true });

const publicLookupAttempts = new Map();
function publicLookupRateLimit(scope, limit, perNameLimit = null) {
  return async (request, reply) => {
    const now = Date.now();
    const consume = (key, max) => {
      const current = publicLookupAttempts.get(key);
      if (!current || current.resetAt <= now) {
        publicLookupAttempts.set(key, { count: 1, resetAt: now + 15 * 60 * 1000 });
        return true;
      }
      if (current.count >= max) return false;
      current.count += 1;
      return true;
    };
    if (!consume(`${scope}:${request.ip}`, limit)) {
      return reply.header('Retry-After', '900').code(429).send({ error: 'ลองบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่' });
    }
    const candidateName = request.body?.candidateName || request.body?.identity?.candidateName;
    if (perNameLimit && candidateName) {
      const nameHash = createHash('sha256').update(String(candidateName).normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase()).digest('hex');
      if (!consume(`${scope}:${request.ip}:${nameHash}`, perNameLimit)) {
        return reply.header('Retry-After', '900').code(429).send({ error: 'ลองบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่' });
      }
    }
    if (publicLookupAttempts.size > 5000) {
      for (const [attemptKey, bucket] of publicLookupAttempts) if (bucket.resetAt <= now) publicLookupAttempts.delete(attemptKey);
    }
  };
}

app.setErrorHandler((error, request, reply) => {
  request.log.error(error);
  const validation = error.validation || error.code === 'FST_ERR_VALIDATION';
  const status = validation ? 400 : error.code === '23503' || error.code === '23514' ? 400 : error.code === '23505' ? 409 : error.statusCode && error.statusCode < 500 ? error.statusCode : 500;
  return reply.code(status).send({ error: status === 500 ? 'Internal server error' : error.message, ...(status === 409 && error.existingApplicationId ? { existingApplicationId: error.existingApplicationId } : {}) });
});

app.get('/api/health', async () => {
  await getPool().query('SELECT 1');
  return { ok: true, service: 'ocec-portal-api' };
});

app.get('/api/ready', async (request, reply) => {
  try {
    await getPool().query('SELECT 1');
    const migrations = await getPool().query("SELECT version FROM schema_migrations WHERE version='014_final_verification_grants.sql'");
    const latest = await getPool().query('SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1');
    if (!migrations.rowCount) return reply.code(503).send({ ready: false, service: 'ocec-portal-api', reason: 'database_migrations_incomplete', latestMigration: latest.rows[0]?.version || null });
    return { ready: true, service: 'ocec-portal-api', latestMigration: latest.rows[0]?.version || null };
  } catch {
    return reply.code(503).send({ ready: false, service: 'ocec-portal-api' });
  }
});

registerAuthRoutes(app);

const noStore = async (_request, reply) => { reply.header('Cache-Control', 'no-store'); };
app.post('/api/public/final-eligibility/search', { onRequest: noStore, preHandler: publicLookupRateLimit('final-search', 60, 15), schema: { body: {
  type: 'object', additionalProperties: false, required: ['candidateName'], properties: { candidateName: { type: 'string', minLength: 3, maxLength: 255 } },
} } }, async (request) => ({ choices: await searchSchoolFinalEligibility(request.body.candidateName) }));
app.post('/api/public/final-eligibility/verify', { onRequest: noStore, preHandler: publicLookupRateLimit('final-verify', 30, 8), schema: { body: {
  type: 'object', additionalProperties: false, required: ['candidateName', 'finalRoundId', 'phoneLast4'], properties: {
    candidateName: { type: 'string', minLength: 3, maxLength: 255 }, finalRoundId: { type: 'string', minLength: 1, maxLength: 120 },
    phoneLast4: { type: 'string', pattern: '^\\d{4}$' },
  },
} } }, async (request, reply) => {
  const token = await createFinalVerificationGrant(request.body);
  return reply.header('Set-Cookie', finalGrantCookie(token)).send({ verified: true });
});
app.get('/api/applications/final-eligibility', { onRequest: noStore, preHandler: requireUser }, async (request) => ({
  choices: await listFinalEligibilityForUser(request.user.id, finalGrantTokenFromRequest(request)),
}));

app.post('/api/public/applications/status', { preHandler: publicLookupRateLimit('status', 120), schema: { body: {
  type: 'object', additionalProperties: false, required: ['name'], properties: { name: { type: 'string', minLength: 3, maxLength: 255 } },
} } }, async (request, reply) => {
  const results = await searchPublicApplicationStatuses(request.body.name);
  return reply.header('Cache-Control', 'no-store').send({ applications: results });
});
app.post('/api/public/applications/edit-access', { preHandler: publicLookupRateLimit('edit', 120, 12), schema: { body: {
  type: 'object', additionalProperties: false, required: ['candidateName','phoneLast4'], properties: {
    candidateName: { type: 'string', minLength: 3, maxLength: 255 }, phoneLast4: { type: 'string', pattern: '^\\d{4}$' },
  },
} } }, async (request, reply) => {
  const application = await getPublicApplicationForEdit(request.body.candidateName, request.body.phoneLast4);
  return reply.header('Cache-Control', 'no-store').send({ application });
});

app.get('/api/catalog', async () => loadCatalog());
app.put('/api/admin/catalog', { preHandler: requireAdmin }, async (request) => ({ catalog: await saveCatalogSnapshot(request.body, request.user.id) }));
app.put('/api/admin/payment-accounts', { preHandler: requireAdmin }, async (request) => ({ paymentAccounts: await savePaymentAccountsSnapshot(request.body?.paymentAccounts, request.user.id) }));

app.get('/api/results', async () => ({ results: await listPublishedResults() }));
app.get('/api/admin/results', { preHandler: requireAdmin }, async () => ({ workflows: await listAdminResultWorkflows() }));
app.post('/api/admin/exams/:id/exam-numbers', { preHandler: requireAdmin, schema: {
  params: { type: 'object', required: ['id'], properties: { id: { type: 'string', minLength: 1, maxLength: 120 } } },
  body: { type: 'object', additionalProperties: false, required: ['confirm'], properties: { confirm: { const: true } } },
} }, async (request) => generateExamNumbers(request.params.id,request.user.id));

const resultRowSchema = { type: 'object', additionalProperties: false, required: ['candidateNo','grade','schoolName','candidateName','award'], properties: {
  candidateNo: { type: 'string', minLength: 1, maxLength: 80 }, examNumber: { type: 'string', maxLength: 80 },
  grade: { type: 'string', minLength: 1, maxLength: 120 }, schoolName: { type: 'string', minLength: 1, maxLength: 255 },
  candidateName: { type: 'string', minLength: 1, maxLength: 255 }, award: { type: 'string', minLength: 1, maxLength: 80 },
} };
const finalIdRowSchema = { type: 'object', additionalProperties: false, required: ['candidateNo','schoolName','candidateName'], properties: {
  candidateNo: { type: 'string', minLength: 1, maxLength: 80 }, examNumber: { type: 'string', maxLength: 80 },
  grade: { type: 'string', minLength: 1, maxLength: 120 }, schoolName: { type: 'string', minLength: 1, maxLength: 255 },
  candidateName: { type: 'string', minLength: 1, maxLength: 255 },
} };
const resultRowsSchema = (row) => ({ type: 'array', minItems: 1, maxItems: 20000, items: row });
const examIdParams = { type: 'object', required: ['id'], properties: { id: { type: 'string', minLength: 1, maxLength: 120 } } };
app.post('/api/admin/exams/:id/results/draft', { preHandler: requireAdmin, schema: { params: examIdParams, body: { type: 'object', additionalProperties: false, required: ['fileName','rows'], properties: { fileName: { type: 'string', minLength: 1, maxLength: 255 }, rows: resultRowsSchema(resultRowSchema) } } } }, async (request) => ({ workflow: await importResultRows(request.params.id,request.body.fileName,request.body.rows,request.user.id) }));
app.patch('/api/admin/result-import-rows/:id/resolve', { preHandler: requireAdmin, schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'string', format: 'uuid' } } }, body: { type: 'object', additionalProperties: false, required: ['action'], properties: { action: { type: 'string', enum: ['confirm','use_application','manual_match'] }, applicationItemId: { type: 'string', format: 'uuid' } } } } }, async (request) => ({ workflow: await resolveResultImportRow(request.params.id,request.body.action,request.body.applicationItemId,request.user.id) }));
app.post('/api/admin/exams/:id/results/publish', { preHandler: requireAdmin, schema: { params: examIdParams, body: { type: 'object', additionalProperties: false, required: ['confirm'], properties: { confirm: { const: true } } } } }, async (request) => publishResultBatch(request.params.id,request.user.id));

app.get('/api/admin/final-ids', { preHandler: requireAdmin, schema: { querystring: { type: 'object', additionalProperties: false, properties: { roundId: { type: 'string', maxLength: 120 } } } } }, async (request) => ({ workflow: await getFinalIdImport(request.query?.roundId) }));
app.post('/api/admin/exams/:id/final-ids/draft', { preHandler: requireAdmin, schema: { params: examIdParams, body: { type: 'object', additionalProperties: false, required: ['fileName','rows'], properties: { fileName: { type: 'string', minLength: 1, maxLength: 255 }, rows: resultRowsSchema(finalIdRowSchema) } } } }, async (request) => ({ workflow: await importFinalIds(request.params.id,request.body.fileName,request.body.rows,request.user.id) }));
app.patch('/api/admin/final-id-import-rows/:id/resolve', { preHandler: requireAdmin, schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'string', format: 'uuid' } } }, body: { type: 'object', additionalProperties: false, required: ['action'], properties: { action: { type: 'string', enum: ['confirm','use_application','manual_match'] }, applicationItemId: { type: 'string', format: 'uuid' } } } } }, async (request) => ({ workflow: await resolveFinalIdImportRow(request.params.id,request.body.action,request.body.applicationItemId,request.user.id) }));
app.post('/api/admin/exams/:id/final-ids/apply', { preHandler: requireAdmin, schema: { params: examIdParams, body: { type: 'object', additionalProperties: false, required: ['confirm'], properties: { confirm: { const: true } } } } }, async (request) => applyFinalIds(request.params.id,request.user.id));

const certificatePhotoSchema = { type: 'object', additionalProperties: false, required: ['fileName','mimeType','dataBase64'], properties: {
  fileName: { type: 'string', minLength: 1, maxLength: 255 }, mimeType: { type: 'string', enum: ['image/jpeg','image/png','image/webp'] }, dataBase64: { type: 'string', minLength: 1, maxLength: 14_000_000 },
} };
app.post('/api/applications/:id/certificate-photo', { preHandler: requireUser, schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'string', format: 'uuid' } } }, body: certificatePhotoSchema } }, async (request) => uploadCertificatePhoto(request.params.id,request.body,request.user.id,request.user.email,request.user.is_admin));
app.delete('/api/applications/:id/certificate-photo', { preHandler: requireUser, schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'string', format: 'uuid' } } } } }, async (request) => removeCertificatePhoto(request.params.id,request.user.id,request.user.email,request.user.is_admin));
app.get('/api/certificate-photos/:itemId', { preHandler: requireUser, schema: { params: { type: 'object', required: ['itemId'], properties: { itemId: { type: 'string', format: 'uuid' } } } } }, async (request,reply) => {
  const photo = await downloadCertificatePhoto(request.params.itemId,request.user.id,request.user.email,request.user.is_admin);
  const encodedName = encodeURIComponent(photo.fileName).replace(/['()*]/g,(character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
  return reply.header('Content-Type',photo.mimeType).header('Content-Disposition',`inline; filename="certificate-photo"; filename*=UTF-8''${encodedName}`).header('Cache-Control','private, no-store').header('X-Content-Type-Options','nosniff').send(photo.content);
});

const replacementTokenSchema = { type: 'string', minLength: 32, maxLength: 100, pattern: '^[A-Za-z0-9_-]+$' };
app.post('/api/slip-replacements/validate', { schema: { body: { type: 'object', additionalProperties: false, required: ['token'], properties: { token: replacementTokenSchema } } } }, async (request) => getSlipReplacementStatus(request.body.token));
app.post('/api/slip-replacements/submit', { schema: { body: { type: 'object', additionalProperties: false, required: ['token','slip'], properties: { token: replacementTokenSchema, slip: { type: 'object', additionalProperties: false, required: ['fileName','mimeType','dataBase64'], properties: {
  fileName: { type: 'string', minLength: 1, maxLength: 255 }, mimeType: { type: 'string', enum: ['application/pdf','image/jpeg','image/png'] }, dataBase64: { type: 'string', minLength: 1, maxLength: 14_000_000 },
} } } } } }, async (request) => replacePaymentSlip(request.body.token, request.body.slip));

app.get('/api/admin/google-workspace/status', { preHandler: requireAdmin }, async () => googleWorkspaceStatus());
app.post('/api/admin/google-workspace/connect', { preHandler: requireAdmin }, async (request) => ({ authorizationUrl: await createGoogleWorkspaceAuthorizationUrl(request.user.id) }));
app.get('/api/admin/google-workspace/callback', { preHandler: requireAdmin }, async (request, reply) => {
  if (request.query?.error) return reply.code(400).send({ error: 'Google account authorization was cancelled' });
  const connection = await completeGoogleWorkspaceAuthorization(request.user.id, request.query?.code, request.query?.state);
  request.log.info({ accountEmail: connection.email }, 'Google Workspace account connected');
  return reply.redirect('/portal-admin/integrations/sheets');
});
app.post('/api/admin/google-workspace/initialize-drive', { preHandler: requireAdmin }, async () => initializeGoogleDriveFolders());
app.get('/api/admin/integrations/status', { preHandler: requireAdmin }, async () => ({ workspace: await googleWorkspaceStatus(), queue: await integrationQueueStatus() }));
app.post('/api/admin/integrations/sheets/sync', { preHandler: requireAdmin }, async (request) => {
  const result = await getPool().query(`SELECT ai.id AS application_item_id,a.version FROM application_items ai
    JOIN applications a ON a.id=ai.application_id WHERE a.status='approved' ORDER BY a.approved_at,a.id,ai.id`);
  await transaction(async (client) => {
    const batchKey = Date.now();
    for (const row of result.rows) {
      await enqueueIntegrationJob(client, 'sheets.sync_item', { applicationItemId: row.application_item_id }, `sheets-manual:${batchKey}:${row.application_item_id}:v${row.version}`);
    }
  });
  return { queued: result.rowCount };
});
app.post('/api/admin/integration-jobs/:id/retry', { preHandler: requireAdmin, schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'string', pattern: '^[1-9][0-9]*$' } } } } }, async (request, reply) => {
  const retried = await retryIntegrationJob(request.params.id, request.user.id);
  if (!retried) return reply.code(404).send({ error: 'Failed integration job not found' });
  return { job: retried };
});

const candidateSchema = {
  type: 'object', additionalProperties: false, required: ['applicant', 'items'], properties: {
    applicant: { type: 'object', additionalProperties: false, required: ['firstNameEn', 'lastNameEn', 'dateOfBirth', 'schoolName', 'contactEmail', 'contactPhone'], properties: {
      firstNameEn: { type: 'string', minLength: 1, maxLength: 120 }, middleNameEn: { type: 'string', maxLength: 120 }, lastNameEn: { type: 'string', minLength: 1, maxLength: 120 },
      firstNameTh: { type: 'string', maxLength: 120 }, lastNameTh: { type: 'string', maxLength: 120 }, gender: { type: 'string', maxLength: 40 }, certificateSchoolName: { type: 'string', maxLength: 255 }, dateOfBirth: { type: 'string', format: 'date' },
      schoolName: { type: 'string', minLength: 1, maxLength: 255 }, contactEmail: { type: 'string', format: 'email' }, contactPhone: { type: 'string', minLength: 8, maxLength: 30 },
      address: { type: 'object', additionalProperties: { type: 'string' }, maxProperties: 20 },
    } },
    items: { type: 'array', minItems: 1, maxItems: 20, items: { type: 'object', additionalProperties: false, required: ['roundId', 'gradeId', 'format', 'centerId'], properties: {
      roundId: { type: 'string', minLength: 1 }, gradeId: { type: 'string', minLength: 1 }, format: { type: 'string', enum: ['paper', 'online'] }, centerId: { type: 'string', minLength: 1 }, examEmail: { type: 'string', format: 'email' },
    } } },
    pastPaperIds: { type: 'array', maxItems: 50, uniqueItems: true, items: { type: 'string' } },
    marketingConsent: { type: 'boolean' }, sourceHeatApplicationId: { type: 'string', format: 'uuid' },
  },
};

const slipSchema = { type: 'object', additionalProperties: false, required: ['fileName', 'mimeType', 'dataBase64'], properties: {
  fileName: { type: 'string', minLength: 1, maxLength: 255 }, mimeType: { type: 'string', enum: ['application/pdf', 'image/jpeg', 'image/png'] }, dataBase64: { type: 'string', minLength: 1, maxLength: 14_000_000 },
} };
const individualSubmissionSchema = { ...candidateSchema, required: [...candidateSchema.required, 'slip'], properties: {
  ...candidateSchema.properties, source: { type: 'string', enum: ['self', 'guest', 'final'] }, slip: slipSchema,
} };
const schoolSubmissionSchema = { type: 'object', additionalProperties: false, required: ['schoolName', 'source', 'applicants', 'slip'], properties: {
  schoolName: { type: 'string', minLength: 1, maxLength: 255 }, source: { type: 'string', enum: ['manual', 'excel'] },
  applicants: { type: 'array', minItems: 1, maxItems: 100, items: candidateSchema }, slip: slipSchema,
} };

app.get('/api/applications/mine', { preHandler: requireUser }, async (request) => ({ applications: await listMyApplications(request.user.id,request.user.email) }));
app.post('/api/application-drafts', { preHandler: requireUser, schema: { body: candidateSchema } }, async (request, reply) => reply.code(201).send({ application: await createIndividualDraft(request.body, request.user.id) }));
app.post('/api/school-batch-drafts', { preHandler: requireUser, schema: { body: { type: 'object', additionalProperties: false, required: ['schoolName', 'source', 'applicants'], properties: {
  schoolName: { type: 'string', minLength: 1, maxLength: 255 }, source: { type: 'string', enum: ['manual', 'excel'] },
  applicants: { type: 'array', minItems: 1, maxItems: 100, items: candidateSchema },
} } } }, async (request, reply) => reply.code(201).send({ batch: await createSchoolDraft(request.body, request.user.id, request.user.email) }));

app.post('/api/applications/submit', { preHandler: requireUser, schema: { body: individualSubmissionSchema } }, async (request, reply) => reply.code(201).send({ application: await submitIndividualApplication(request.body, request.user.id, finalGrantTokenFromRequest(request)) }));
app.post('/api/school-batches/submit', { preHandler: requireUser, schema: { body: schoolSubmissionSchema } }, async (request, reply) => reply.code(201).send({ batch: await submitSchoolBatch(request.body, request.user.id, request.user.email) }));
app.patch('/api/applications/:id/profile', { preHandler: requireUser, schema: {
  params: { type: 'object', required: ['id'], properties: { id: { type: 'string', format: 'uuid' } } },
  body: { type: 'object', additionalProperties: false, required: ['firstNameEn','middleNameEn','lastNameEn','schoolName','contactEmail','contactPhone','address'], properties: {
    firstNameEn: { type: 'string', minLength: 1, maxLength: 120 }, middleNameEn: { type: 'string', maxLength: 120 }, lastNameEn: { type: 'string', minLength: 1, maxLength: 120 },
    firstNameTh: { type: 'string', maxLength: 120 }, lastNameTh: { type: 'string', maxLength: 120 },
    schoolName: { type: 'string', minLength: 1, maxLength: 255 }, contactEmail: { type: 'string', format: 'email' }, contactPhone: { type: 'string', minLength: 8, maxLength: 30 },
    address: { type: 'object', additionalProperties: { type: 'string', maxLength: 255 }, maxProperties: 20 },
  } },
} }, async (request) => ({ application: await updateOwnedApplicationProfile(request.params.id, request.body, request.user.id) }));
app.patch('/api/public/applications/:id/profile', { preHandler: publicLookupRateLimit('edit-save', 120, 30), schema: {
  params: { type: 'object', required: ['id'], properties: { id: { type: 'string', format: 'uuid' } } },
  body: { type: 'object', additionalProperties: false, required: ['identity','profile'], properties: {
    identity: { type: 'object', additionalProperties: false, required: ['candidateName','phoneLast4'], properties: {
      candidateName: { type: 'string', minLength: 3, maxLength: 255 }, phoneLast4: { type: 'string', pattern: '^\\d{4}$' },
    } },
    profile: { type: 'object', additionalProperties: false, required: ['firstNameEn','middleNameEn','lastNameEn','schoolName','contactEmail','contactPhone','address'], properties: {
      firstNameEn: { type: 'string', minLength: 1, maxLength: 120 }, middleNameEn: { type: 'string', maxLength: 120 }, lastNameEn: { type: 'string', minLength: 1, maxLength: 120 },
      firstNameTh: { type: 'string', maxLength: 120 }, lastNameTh: { type: 'string', maxLength: 120 },
      schoolName: { type: 'string', minLength: 1, maxLength: 255 }, contactEmail: { type: 'string', format: 'email' }, contactPhone: { type: 'string', minLength: 8, maxLength: 30 },
      address: { type: 'object', additionalProperties: { type: 'string', maxLength: 255 }, maxProperties: 20 },
    } },
  } },
} }, async (request, reply) => {
  const { identity, profile } = request.body;
  const updated = await updatePublicApplicationProfile(request.params.id, profile, identity);
  const candidateName = [profile.firstNameEn, profile.middleNameEn, profile.lastNameEn].filter(Boolean).join(' ');
  const phoneLast4 = String(profile.contactPhone || '').replace(/\D/g, '').slice(-4);
  const application = await getPublicApplicationForEdit(candidateName, phoneLast4, request.params.id);
  return reply.header('Cache-Control', 'no-store').send({ updated, application });
});

app.get('/api/admin/applications', { preHandler: requireAdmin }, async () => ({ applications: await listAllApplications() }));
app.get('/api/admin/applications/:id/notes', { preHandler: requireAdmin, schema: {
  params: { type: 'object', required: ['id'], properties: { id: { type: 'string', format: 'uuid' } } },
  querystring: { type: 'object', additionalProperties: false, properties: { includeHistory: { type: 'boolean' } } },
} }, async (request) => listApplicationAdminNotes(request.params.id, { includeHistory: request.query.includeHistory === true }));
app.post('/api/admin/applications/:id/notes', { preHandler: requireAdmin, schema: {
  params: { type: 'object', required: ['id'], properties: { id: { type: 'string', format: 'uuid' } } },
  body: { type: 'object', additionalProperties: false, required: ['body'], properties: { body: { type: 'string', minLength: 1, maxLength: 4000 } } },
} }, async (request, reply) => reply.code(201).send({ note: await createApplicationAdminNote(request.params.id, request.body.body, request.user.id) }));
app.patch('/api/admin/applications/:id/notes/:noteId', { preHandler: requireAdmin, schema: {
  params: { type: 'object', required: ['id','noteId'], properties: { id: { type: 'string', format: 'uuid' }, noteId: { type: 'string', format: 'uuid' } } },
  body: { type: 'object', additionalProperties: false, required: ['body'], properties: { body: { type: 'string', minLength: 1, maxLength: 4000 } } },
} }, async (request) => ({ note: await updateApplicationAdminNote(request.params.id, request.params.noteId, request.body.body, request.user.id) }));
app.delete('/api/admin/applications/:id/notes/:noteId', { preHandler: requireAdmin, schema: {
  params: { type: 'object', required: ['id','noteId'], properties: { id: { type: 'string', format: 'uuid' }, noteId: { type: 'string', format: 'uuid' } } },
} }, async (request, reply) => {
  await deleteApplicationAdminNote(request.params.id, request.params.noteId, request.user.id);
  return reply.code(204).send();
});
app.patch('/api/admin/applications/:id', { preHandler: requireAdmin, schema: {
  params: { type: 'object', required: ['id'], properties: { id: { type: 'string', format: 'uuid' } } },
  body: { type: 'object', additionalProperties: false, required: ['profile','items'], properties: {
    profile: { type: 'object', additionalProperties: false, required: ['firstNameEn','lastNameEn','schoolName','contactEmail','contactPhone','address'], properties: {
      firstNameEn: { type: 'string', minLength: 1, maxLength: 120 }, middleNameEn: { type: 'string', maxLength: 120 },
      firstNameTh: { type: 'string', maxLength: 120 }, lastNameTh: { type: 'string', maxLength: 120 },
      lastNameEn: { type: 'string', minLength: 1, maxLength: 120 }, schoolName: { type: 'string', minLength: 1, maxLength: 255 },
      contactEmail: { type: 'string', format: 'email', maxLength: 255 }, contactPhone: { type: 'string', minLength: 4, maxLength: 30 },
      address: { type: 'object', additionalProperties: { type: 'string', maxLength: 255 }, maxProperties: 20 },
    } },
    items: { type: 'array', minItems: 1, maxItems: 30, items: { type: 'object', additionalProperties: false,
      required: ['roundId','gradeId','format','centerId'], properties: {
        applicationItemId: { type: ['string','null'], format: 'uuid' }, roundId: { type: 'string', minLength: 1, maxLength: 180 },
        gradeId: { type: 'string', minLength: 1, maxLength: 180 }, format: { type: 'string', enum: ['paper','online'] },
        centerId: { type: 'string', minLength: 1, maxLength: 180 }, examEmail: { type: 'string', maxLength: 255 },
      } } },
    paymentSlip: slipSchema,
  } },
} }, async (request) => ({ result: await updateAdminApplication(request.params.id, request.body, request.user.id) }));
app.get('/api/admin/payment-slips/:id', { preHandler: requireAdmin, schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'string', format: 'uuid' } } } } }, async (request, reply) => {
  const result = await getPool().query('SELECT file_name,mime_type,content_bytes,drive_file_id FROM payment_slips WHERE id=$1 ORDER BY version DESC,uploaded_at DESC LIMIT 1', [request.params.id]);
  const slip = result.rows[0];
  if (!slip) return reply.code(404).send({ error: 'Payment slip not found' });
  const content = slip.drive_file_id ? await downloadGoogleDriveFile(slip.drive_file_id) : slip.content_bytes;
  if (!content) return reply.code(404).send({ error: 'Payment slip is no longer available in Google Drive' });
  const asciiName = slip.file_name.replace(/[^\x20-\x7e]|["\\]/g, '_').slice(0, 160) || 'payment-slip';
  const encodedName = encodeURIComponent(slip.file_name).replace(/['()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
  return reply.header('Content-Type', slip.mime_type)
    .header('Content-Disposition', `inline; filename="${asciiName}"; filename*=UTF-8''${encodedName}`)
    .header('Cache-Control', 'private, no-store')
    .header('X-Content-Type-Options', 'nosniff')
    .send(content);
});
app.patch('/api/admin/applications/:id/review', { preHandler: requireAdmin, schema: {
  params: { type: 'object', required: ['id'], properties: { id: { type: 'string', format: 'uuid' } } },
  body: { type: 'object', additionalProperties: false, required: ['decision'], properties: {
    decision: { type: 'string', enum: ['approve', 'slip_issue', 'reject'] }, reason: { type: 'string', maxLength: 240 }, paymentId: { type: 'string', format: 'uuid' },
  } },
} }, async (request) => reviewApplication(request.params.id, request.body, request.user.id));

app.patch('/api/admin/exams/:id', { preHandler: requireAdmin, schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'string', minLength: 1 } } }, body: { type: 'object', additionalProperties: false, minProperties: 1, properties: { title: { type: 'string', minLength: 1 }, openDate: { type: ['string','null'], format: 'date' }, closeDate: { type: ['string','null'], format: 'date' }, editCloseDate: { type: ['string','null'], format: 'date' }, examDate: { type: ['string','null'], format: 'date' }, finalConfirmCloseDate: { type: ['string','null'], format: 'date' }, examStartTime: { type: ['string','null'], pattern: '^([01]\\d|2[0-3]):[0-5]\\d$' }, examEndTime: { type: ['string','null'], pattern: '^([01]\\d|2[0-3]):[0-5]\\d$' }, manualClosed: { type: 'boolean' }, finalManuallyClosed: { type: 'boolean' }, isOpen: { type: 'boolean' }, accent: { type: ['string','null'] }, logoDataUrl: { type: 'string', maxLength: 7000000 }, description: { type: 'string' }, prices: { type: 'object', additionalProperties: false, properties: { paperBased: { type: 'number', minimum: 0 }, onlineExam: { type: 'number', minimum: 0 } } }, gradeOptions: { type: 'array', uniqueItems: true, items: { type: 'string' } }, centerIds: { type: 'array', uniqueItems: true, items: { type: 'string' } } } } } }, async (request, reply) => {
  const updated = await updateExamRound(request.params.id, request.body, request.user.id);
  if (!updated) return reply.code(404).send({ error: 'Exam round not found' });
  return { exam: (await loadCatalog()).exams.find((exam) => exam.id === request.params.id) };
});
app.delete('/api/admin/exams/:id', { preHandler: requireAdmin, schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'string', minLength: 1 } } } } }, async (request, reply) => {
  const archived = await archiveExamRound(request.params.id, request.user.id);
  if (!archived) return reply.code(404).send({ error: 'Exam round not found' });
  return { ok: true };
});

const distDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
if (existsSync(join(distDir, 'index.html'))) {
  app.register(fastifyStatic, { root: distDir, prefix: '/' });
  app.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith('/api/')) return reply.code(404).send({ error: 'Not found' });
    return reply.type('text/html').sendFile('index.html');
  });
}
