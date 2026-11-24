import Fastify from 'fastify';
import { createHash } from 'node:crypto';
import fastifyStatic from '@fastify/static';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { getPool, transaction } from './db.js';
import { archiveExamRound, createExamRounds, formatCatalogEtag, loadCatalog, parseCatalogRevision, saveCatalogSnapshot, saveGeneralCatalogOptions, savePaymentAccountsSnapshot, updateExamRound } from './catalog.js';
import { registerAuthRoutes, requireAdmin, requireUser } from './auth.js';
import { confirmAdminPaymentSlipInspection, createApplicationAdminNote, createIndividualDraft, createSchoolDraft, deleteApplicationAdminNote, downloadCertificatePhoto, getPublicApplicationForEdit, getSlipReplacementStatus, listAllApplications, listApplicationAdminNotes, listMyApplications, loadAdminPaymentSlip, removeCertificatePhoto, replacePaymentSlip, reviewApplication, searchPublicApplicationStatuses, submitIndividualApplication, submitSchoolBatch, updateAdminApplication, updateApplicationAdminNote, updateOwnedApplicationProfile, updatePublicApplicationProfile, uploadCertificatePhoto } from './applications.js';
import { addFilteredApplicationsToMockSheet, completeGoogleWorkspaceAuthorization, createGoogleWorkspaceAuthorizationUrl, googleWorkspaceStatus, initializeGoogleDriveFolders, organizeExistingGoogleDrivePaymentSlips } from './googleWorkspace.js';
import { enqueueIntegrationJob, integrationQueueStatus, retryIntegrationJob } from './integrationQueue.js';
import { applyFinalIds, generateExamNumbers, getFinalIdImport, importFinalIds, importResultRows, listAdminResultWorkflows, listPublishedResultFilters, listPublishedResults, publishResultBatch, resolveFinalIdImportRow, resolveResultImportRow } from './results.js';
import { createFinalVerificationGrant, finalGrantCookie, finalGrantTokenFromRequest, listFinalEligibilityForUser, searchSchoolFinalEligibility } from './finalEligibility.js';
import { isKnownSpaLocation } from '../src/routes.js';
import { getCenterPosterOverride, resetCenterPoster, saveCenterPoster } from './centerPoster.js';
import { FINAL_SHIRT_SIZES } from '../shared/finalShirts.js';
import { getFinalShirtImage, removeFinalShirtImage, saveFinalShirtImage, saveFinalShirtSizes } from './finalShirts.js';
import { checkDatabaseReadiness } from './migrate.js';

export function sanitizeRequestPath(rawUrl) {
  const text = String(rawUrl || '/');
  const queryIndex = text.indexOf('?');
  const hashIndex = text.indexOf('#');
  let cut = text.length;
  if (queryIndex >= 0 && queryIndex < cut) cut = queryIndex;
  if (hashIndex >= 0 && hashIndex < cut) cut = hashIndex;
  return text.slice(0, cut) || '/';
}

export function createLoggerOptions(overrides = {}) {
  return {
    redact: {
      paths: [
        'req.headers.cookie',
        'req.headers.authorization',
        'res.headers["set-cookie"]',
        '*.cookie',
        '*.authorization',
        '*.token',
        '*.code',
        '*.state',
        '*.password',
        '*.secret',
        '*.refreshToken',
        '*.accessToken',
        '*.dataBase64',
      ],
      censor: '[REDACTED]',
    },
    serializers: {
      req(request) {
        return {
          method: request.method,
          route: request.routeOptions?.url || sanitizeRequestPath(request.url),
          path: sanitizeRequestPath(request.url),
          requestId: request.id,
          remoteAddress: request.ip,
        };
      },
      res(reply) {
        return {
          statusCode: reply.statusCode,
        };
      },
    },
    ...overrides,
  };
}

function extractCatalogRevision(request) {
  const ifMatch = request.headers?.['if-match'];
  if (ifMatch !== undefined && String(ifMatch).trim() !== '') {
    return {
      expectedRevision: parseCatalogRevision(ifMatch),
      expectedRevisionSource: 'if-match',
    };
  }
  const bodyRev = request.body?.expectedRevision ?? request.body?.revision;
  if (bodyRev !== undefined && bodyRev !== null && bodyRev !== '') {
    return {
      expectedRevision: parseCatalogRevision(bodyRev),
      expectedRevisionSource: 'body',
    };
  }
  return { expectedRevision: null, expectedRevisionSource: 'body' };
}

export function buildApp({ logger = createLoggerOptions() } = {}) {
  const app = Fastify({ logger, bodyLimit: 16 * 1024 * 1024, trustProxy: true });

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
        return reply.header('Retry-After', '900').code(429).send({ error: 'มีการดำเนินการบ่อยเกินไป โปรดรอสักครู่แล้วลองอีกครั้ง' });
      }
      const candidateName = request.body?.candidateName || request.body?.identity?.candidateName;
      if (perNameLimit && candidateName) {
        const nameHash = createHash('sha256').update(String(candidateName).normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase()).digest('hex');
        if (!consume(`${scope}:${request.ip}:${nameHash}`, perNameLimit)) {
          return reply.header('Retry-After', '900').code(429).send({ error: 'มีการดำเนินการบ่อยเกินไป โปรดรอสักครู่แล้วลองอีกครั้ง' });
        }
      }
      if (publicLookupAttempts.size > 5000) {
        for (const [attemptKey, bucket] of publicLookupAttempts) if (bucket.resetAt <= now) publicLookupAttempts.delete(attemptKey);
      }
    };
  }

  app.setErrorHandler((error, request, reply) => {
    request.log.error({ err: { message: error?.message, code: error?.code, statusCode: error?.statusCode }, route: request.routeOptions?.url || sanitizeRequestPath(request.url), requestId: request.id }, 'Request failed');
    if (error.code === 'GOOGLE_WORKSPACE_NOT_CONNECTED') return reply.code(503).send({ error: error.message });
    const validation = error.validation || error.code === 'FST_ERR_VALIDATION';
    const upstreamStatus = [502, 503, 504].includes(error.statusCode) ? error.statusCode : null;
    const status = validation ? 400 : error.code === '23503' || error.code === '23514' ? 400 : error.code === '23505' ? 409 : upstreamStatus || (error.statusCode && error.statusCode < 500 ? error.statusCode : 500);
    return reply.code(status).send({
      error: status === 500 ? 'Internal server error' : error.message,
      ...(status === 409 && error.existingApplicationId ? { existingApplicationId: error.existingApplicationId } : {}),
      ...(error.code === 'CATALOG_REVISION_CONFLICT' ? { code: error.code, currentRevision: error.currentRevision } : {}),
    });
  });

  // Process liveness probes (independent of database connectivity or migration state).
  const livenessResponse = async () => ({ ok: true, alive: true, service: 'ocec-portal-api' });
  app.get('/api/health', livenessResponse);
  app.get('/api/live', livenessResponse);

  // Database & release-migration readiness probe.
  app.get('/api/ready', async (_request, reply) => {
    try {
      const readiness = await checkDatabaseReadiness();
      if (!readiness.ready) return reply.code(503).send(readiness);
      return readiness;
    } catch {
      return reply.code(503).send({ ready: false, service: 'ocec-portal-api', reason: 'database_unavailable' });
    }
  });

  registerAuthRoutes(app);

  const sensitiveNoStore = async (_request, reply) => {
    reply.header('Cache-Control', 'no-store').header('Referrer-Policy', 'no-referrer');
  };
  const centerPosterDefaultPath = join(dirname(fileURLToPath(import.meta.url)), '../public/paper-based-centers-poster.png');
  app.get('/api/center-poster', async (request, reply) => {
    const override = await getCenterPosterOverride();
    const content = override?.content || await readFile(centerPosterDefaultPath);
    const mimeType = override?.mimeType || 'image/png';
    const etag = `"${createHash('sha256').update(content).digest('hex')}"`;
    const requestedEtags = String(request.headers['if-none-match'] || '').split(',').map((value) => value.trim());
    reply.header('ETag', etag).header('Cache-Control', 'public, max-age=0, must-revalidate')
      .header('X-Content-Type-Options', 'nosniff').type(mimeType);
    if (requestedEtags.includes('*') || requestedEtags.includes(etag)) return reply.code(304).send();
    return reply.send(content);
  });
  const centerPosterUploadSchema = { type: 'object', additionalProperties: false, required: ['mimeType', 'dataBase64'], properties: {
    mimeType: { type: 'string', enum: ['image/png', 'image/jpeg', 'image/webp'] },
    dataBase64: { type: 'string', minLength: 1, maxLength: 6_990_508 },
  } };
  app.put('/api/admin/center-poster', { preHandler: requireAdmin, schema: { body: centerPosterUploadSchema } }, async (request) => saveCenterPoster(request.body, request.user.id));
  app.delete('/api/admin/center-poster', { preHandler: requireAdmin }, async (request) => {
    await resetCenterPoster(request.user.id);
    return { version: null };
  });
  const shirtImageParams = { type: 'object', required: ['kind'], properties: { kind: { type: 'string', enum: ['chart','sample'] } } };
  app.get('/api/final-shirt-images/:kind', { schema: { params: shirtImageParams } }, async (request, reply) => {
    const image = await getFinalShirtImage(request.params.kind);
    const etag = `"${createHash('sha256').update(image.content).digest('hex')}"`;
    reply.header('ETag',etag).header('Cache-Control','public, max-age=0, must-revalidate')
      .header('X-Content-Type-Options','nosniff').type(image.mimeType);
    if (String(request.headers['if-none-match'] || '').split(',').map(value => value.trim()).some(value => value === etag || value === '*')) return reply.code(304).send();
    return reply.send(image.content);
  });
  app.put('/api/admin/final-shirt-images/:kind', { preHandler: requireAdmin, schema: { params: shirtImageParams, body: centerPosterUploadSchema } }, async (request) => saveFinalShirtImage(request.params.kind,request.body,request.user.id));
  app.delete('/api/admin/final-shirt-images/:kind', { preHandler: requireAdmin, schema: { params: shirtImageParams } }, async (request) => removeFinalShirtImage(request.params.kind,request.user.id));
  app.put('/api/applications/:id/shirt-sizes', { preHandler: requireUser, schema: {
    params: { type: 'object', required: ['id'], properties: { id: { type: 'string', format: 'uuid' } } },
    body: { type: 'object', additionalProperties: false, required: ['items'], properties: { items: {
      type: 'array', minItems: 1, maxItems: 20, items: { type: 'object', additionalProperties: false, required: ['applicationItemId','shirtSize'],
        properties: { applicationItemId: { type: 'string', format: 'uuid' },shirtSize: { type: 'string', enum: [...FINAL_SHIRT_SIZES] } } },
    } } },
  } }, async (request) => saveFinalShirtSizes(request.params.id,request.body.items,request.user));
  app.post('/api/public/final-eligibility/search', { onRequest: sensitiveNoStore, preHandler: publicLookupRateLimit('final-search', 60, 15), schema: { body: {
    type: 'object', additionalProperties: false, required: ['candidateName'], properties: { candidateName: { type: 'string', minLength: 3, maxLength: 255 } },
  } } }, async (request) => ({ choices: await searchSchoolFinalEligibility(request.body.candidateName) }));
  app.post('/api/public/final-eligibility/verify', { onRequest: sensitiveNoStore, preHandler: publicLookupRateLimit('final-verify', 30, 8), schema: { body: {
    type: 'object', additionalProperties: false, required: ['candidateName', 'finalRoundId', 'phoneLast4'], properties: {
      candidateName: { type: 'string', minLength: 3, maxLength: 255 }, finalRoundId: { type: 'string', minLength: 1, maxLength: 120 },
      phoneLast4: { type: 'string', pattern: '^\\d{4}$' },
    },
  } } }, async (request, reply) => {
    const token = await createFinalVerificationGrant(request.body);
    return reply.header('Set-Cookie', finalGrantCookie(token)).send({ verified: true });
  });
  app.get('/api/applications/final-eligibility', { onRequest: sensitiveNoStore, preHandler: requireUser }, async (request) => ({
    choices: await listFinalEligibilityForUser(request.user.id, finalGrantTokenFromRequest(request)),
  }));

  app.post('/api/public/applications/status', { onRequest: sensitiveNoStore, preHandler: publicLookupRateLimit('status', 120), schema: { body: {
    type: 'object', additionalProperties: false, required: ['name'], properties: { name: { type: 'string', minLength: 3, maxLength: 255 } },
  } } }, async (request) => ({ applications: await searchPublicApplicationStatuses(request.body.name) }));
  app.post('/api/public/applications/edit-access', { onRequest: sensitiveNoStore, preHandler: publicLookupRateLimit('edit', 120, 12), schema: { body: {
    type: 'object', additionalProperties: false, required: ['candidateName','phoneLast4'], properties: {
      candidateName: { type: 'string', minLength: 3, maxLength: 255 }, phoneLast4: { type: 'string', pattern: '^\\d{4}$' },
    },
  } } }, async (request) => ({ application: await getPublicApplicationForEdit(request.body.candidateName, request.body.phoneLast4) }));

  app.get('/api/catalog', async (_request, reply) => {
    const catalog = await loadCatalog();
    return reply.header('ETag', formatCatalogEtag(catalog.revision)).header('Cache-Control', 'no-cache').send(catalog);
  });
  app.put('/api/admin/catalog', { preHandler: requireAdmin }, async (request, reply) => {
    const catalog = await saveCatalogSnapshot(request.body, request.user.id, extractCatalogRevision(request));
    return reply.header('ETag', formatCatalogEtag(catalog.revision)).send({ catalog });
  });
  app.put('/api/admin/catalog/options', { preHandler: requireAdmin }, async (request, reply) => {
    const catalog = await saveGeneralCatalogOptions(request.body, request.user.id, extractCatalogRevision(request));
    return reply.header('ETag', formatCatalogEtag(catalog.revision)).send({ catalog });
  });
  app.put('/api/admin/payment-accounts', { preHandler: requireAdmin }, async (request, reply) => {
    const saved = await savePaymentAccountsSnapshot(request.body?.paymentAccounts, request.user.id, extractCatalogRevision(request));
    return reply.header('ETag', formatCatalogEtag(saved.revision)).send(saved);
  });
  app.post('/api/admin/exams', { preHandler: requireAdmin }, async (request, reply) => {
    const created = await createExamRounds(request.body?.exams, request.user.id, extractCatalogRevision(request));
    return reply.code(201).header('ETag', formatCatalogEtag(created.revision)).send(created);
  });

  const publicResultsQuerySchema = {
    type: 'object',
    additionalProperties: false,
    properties: {
      competitionId: { type: 'string', maxLength: 80 },
      year: { type: 'string', maxLength: 16 },
      roundType: { type: 'string', maxLength: 32 },
      grade: { type: 'string', maxLength: 120 },
      q: { type: 'string', maxLength: 255 },
      limit: { type: 'integer', minimum: 1, maximum: 5000 },
      offset: { type: 'integer', minimum: 0, maximum: 100000 },
    },
  };
  app.get('/api/results', { schema: { querystring: publicResultsQuerySchema } }, async (request) => {
    const [results, filters] = await Promise.all([
      listPublishedResults(request.query || {}),
      listPublishedResultFilters(),
    ]);
    return { results, total: results.length, filters };
  });
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
  app.post('/api/slip-replacements/validate', { onRequest: sensitiveNoStore, schema: { body: { type: 'object', additionalProperties: false, required: ['token'], properties: { token: replacementTokenSchema } } } }, async (request) => getSlipReplacementStatus(request.body.token));
  app.post('/api/slip-replacements/submit', { onRequest: sensitiveNoStore, schema: { body: { type: 'object', additionalProperties: false, required: ['token','slip'], properties: { token: replacementTokenSchema, slip: { type: 'object', additionalProperties: false, required: ['fileName','mimeType','dataBase64'], properties: {
    fileName: { type: 'string', minLength: 1, maxLength: 255 }, mimeType: { type: 'string', enum: ['application/pdf','image/jpeg','image/png'] }, dataBase64: { type: 'string', minLength: 1, maxLength: 14_000_000 },
  } } } } } }, async (request) => replacePaymentSlip(request.body.token, request.body.slip));

  app.get('/api/admin/google-workspace/status', { preHandler: requireAdmin }, async () => googleWorkspaceStatus());
  app.post('/api/admin/google-workspace/connect', { onRequest: sensitiveNoStore, preHandler: requireAdmin }, async (request) => ({ authorizationUrl: await createGoogleWorkspaceAuthorizationUrl(request.user.id) }));
  app.get('/api/admin/google-workspace/callback', { onRequest: sensitiveNoStore, preHandler: requireAdmin }, async (request, reply) => {
    if (request.query?.error) return reply.code(400).send({ error: 'Google account authorization was cancelled' });
    const connection = await completeGoogleWorkspaceAuthorization(request.user.id, request.query?.code, request.query?.state);
    request.log.info({ accountEmail: connection.email }, 'Google Workspace account connected');
    return reply.redirect('/portal-admin/integrations/sheets');
  });
  app.post('/api/admin/google-workspace/initialize-drive', { preHandler: requireAdmin }, async () => initializeGoogleDriveFolders());
  app.post('/api/admin/google-workspace/organize-payment-slips', { preHandler: requireAdmin }, async () => organizeExistingGoogleDrivePaymentSlips());
  app.get('/api/admin/integrations/status', { preHandler: requireAdmin }, async () => ({ workspace: await googleWorkspaceStatus(), queue: await integrationQueueStatus() }));
  app.post('/api/admin/integrations/sheets/sync', { preHandler: requireAdmin }, async () => {
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
  app.post('/api/admin/mock-sheets/add', { preHandler: requireAdmin, schema: { body: {
    type: 'object', additionalProperties: false, required: ['year', 'competition', 'grade', 'startDate', 'endDate'], properties: {
      year: { type: 'string', minLength: 1, maxLength: 30 },
      competition: { type: 'string', minLength: 1, maxLength: 80 },
      grade: { type: 'string', minLength: 1, maxLength: 120 },
      startDate: { type: 'string', format: 'date' },
      endDate: { type: 'string', format: 'date' },
    },
  } } }, async (request, reply) => {
    if (request.body.startDate > request.body.endDate) return reply.code(400).send({ error: 'วันที่เริ่มต้นต้องไม่อยู่หลังวันที่สิ้นสุด' });
    return addFilteredApplicationsToMockSheet(request.body);
  });
  app.post('/api/admin/integration-jobs/:id/retry', { preHandler: requireAdmin, schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'string', pattern: '^[1-9][0-9]*$' } } } } }, async (request, reply) => {
    const retried = await retryIntegrationJob(request.params.id, request.user.id);
    if (!retried) return reply.code(404).send({ error: 'Failed integration job not found' });
    return { job: retried };
  });

  const finalBookingItemProperties = {
    packageCode: {type:'string',enum:['onsite','onsite_ceremony','online']},shirtSize:{type:'string',enum:[...FINAL_SHIRT_SIZES]},
    guests:{type:'array',maxItems:4,items:{type:'object',additionalProperties:false,required:['firstNameEn','lastNameEn','shirtSize'],properties:{firstNameEn:{type:'string',minLength:1,maxLength:120},lastNameEn:{type:'string',minLength:1,maxLength:120},shirtSize:{type:'string',enum:[...FINAL_SHIRT_SIZES]}}}},
  };
  const finalPackagePriceSchema={type:"object",additionalProperties:false,properties:{onsite:{type:"number",minimum:0},onsite_ceremony:{type:"number",minimum:0},online:{type:"number",minimum:0}}};
  const candidateSchema = {
    type: 'object', additionalProperties: false, required: ['applicant', 'items'], properties: {
      applicant: { type: 'object', additionalProperties: false, required: ['firstNameEn', 'lastNameEn', 'dateOfBirth', 'schoolName', 'contactEmail', 'contactPhone'], properties: {
        firstNameEn: { type: 'string', minLength: 1, maxLength: 120 }, middleNameEn: { type: 'string', maxLength: 120 }, lastNameEn: { type: 'string', minLength: 1, maxLength: 120 },
        firstNameTh: { type: 'string', maxLength: 120 }, lastNameTh: { type: 'string', maxLength: 120 }, gender: { type: 'string', maxLength: 40 }, certificateSchoolName: { type: 'string', maxLength: 255 }, dateOfBirth: { type: 'string', format: 'date' },
        schoolName: { type: 'string', minLength: 1, maxLength: 255 }, contactEmail: { type: 'string', format: 'email' }, contactPhone: { type: 'string', minLength: 8, maxLength: 30 },
        address: { type: 'object', additionalProperties: { type: 'string' }, maxProperties: 20 },
      } },
      items: { type: 'array', minItems: 1, maxItems: 20, items: { type: 'object', additionalProperties: false, required: ['roundId', 'gradeId', 'format'], properties: {
        roundId: { type: 'string', minLength: 1 }, gradeId: { type: 'string', minLength: 1 }, format: { type: 'string', enum: ['paper', 'online'] }, centerId: { type: 'string', minLength: 1 }, examEmail: { type: 'string', format: 'email' },
        ...finalBookingItemProperties,
      } } },
      pastPaperIds: { type: 'array', maxItems: 50, uniqueItems: true, items: { type: 'string' } },
      marketingConsent: { type: 'boolean' }, sourceHeatApplicationId: { type: 'string', format: 'uuid' },
    },
  };

  const slipSchema = { type: 'object', additionalProperties: false, required: ['fileName', 'mimeType', 'dataBase64'], properties: {
    fileName: { type: 'string', minLength: 1, maxLength: 255 }, mimeType: { type: 'string', enum: ['application/pdf', 'image/jpeg', 'image/png'] }, dataBase64: { type: 'string', minLength: 1, maxLength: 14_000_000 },
  } };
  const individualSubmissionSchema = { ...candidateSchema, required: [...candidateSchema.required, 'slip'], properties: {
    ...candidateSchema.properties, source: { type: 'string', enum: ['self', 'guest', 'final'] }, slip: slipSchema,certificatePhoto:certificatePhotoSchema,
  } };
  const schoolSubmissionSchema = { type: 'object', additionalProperties: false, required: ['schoolName', 'source', 'applicants', 'slip'], properties: {
    schoolName: { type: 'string', minLength: 1, maxLength: 255 }, source: { type: 'string', enum: ['manual', 'excel'] },
    applicants: { type: 'array', minItems: 1, maxItems: 100, items: candidateSchema }, slip: slipSchema,
  } };

  app.get('/api/applications/mine', { onRequest: sensitiveNoStore, preHandler: requireUser }, async (request) => ({ applications: await listMyApplications(request.user.id) }));
  app.post('/api/application-drafts', { preHandler: requireUser, schema: { body: candidateSchema } }, async (request, reply) => reply.code(201).send({ application: await createIndividualDraft(request.body, request.user.id) }));
  app.post('/api/school-batch-drafts', { preHandler: requireUser, schema: { body: { type: 'object', additionalProperties: false, required: ['schoolName', 'source', 'applicants'], properties: {
    schoolName: { type: 'string', minLength: 1, maxLength: 255 }, source: { type: 'string', enum: ['manual', 'excel'] },
    applicants: { type: 'array', minItems: 1, maxItems: 100, items: candidateSchema },
  } } } }, async (request, reply) => reply.code(201).send({ batch: await createSchoolDraft(request.body, request.user.id, request.user.email) }));

  app.post('/api/applications/submit', { bodyLimit:32*1024*1024,preHandler: requireUser, schema: { body: individualSubmissionSchema } }, async (request, reply) => reply.code(201).send({ application: await submitIndividualApplication(request.body, request.user.id, finalGrantTokenFromRequest(request)) }));
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
  app.patch('/api/public/applications/:id/profile', { onRequest: sensitiveNoStore, preHandler: publicLookupRateLimit('edit-save', 120, 30), schema: {
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
  } }, async (request) => {
    const { identity, profile } = request.body;
    const updated = await updatePublicApplicationProfile(request.params.id, profile, identity);
    const candidateName = [profile.firstNameEn, profile.middleNameEn, profile.lastNameEn].filter(Boolean).join(' ');
    const phoneLast4 = String(profile.contactPhone || '').replace(/\D/g, '').slice(-4);
    const application = await getPublicApplicationForEdit(candidateName, phoneLast4, request.params.id);
    return { updated, application };
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
        required: ['roundId','gradeId','format'], properties: {
          applicationItemId: { type: ['string','null'], format: 'uuid' }, roundId: { type: 'string', minLength: 1, maxLength: 180 },
          gradeId: { type: 'string', minLength: 1, maxLength: 180 }, format: { type: 'string', enum: ['paper','online'] },
          centerId: { type: 'string', minLength: 1, maxLength: 180 }, examEmail: { type: 'string', maxLength: 255 },
          ...finalBookingItemProperties,
        } } },
      paymentSlip: slipSchema,
    } },
  } }, async (request) => ({ result: await updateAdminApplication(request.params.id, request.body, request.user.id) }));
  app.get('/api/admin/payment-slips/:id', { preHandler: requireAdmin, schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'string', format: 'uuid' } } } } }, async (request, reply) => {
    const slip = await loadAdminPaymentSlip(request.params.id, request.user.id);
    if (!slip) return reply.code(404).send({ error: 'Payment slip is not available' });
    const asciiName = slip.fileName.replace(/[^\x20-\x7e]|["\\]/g, '_').slice(0, 160) || 'payment-slip';
    const encodedName = encodeURIComponent(slip.fileName).replace(/['()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
    return reply.header('Content-Type', slip.mimeType)
      .header('Content-Disposition', `inline; filename="${asciiName}"; filename*=UTF-8''${encodedName}`)
      .header('Cache-Control', 'private, no-store')
      .header('Referrer-Policy', 'no-referrer')
      .header('X-Content-Type-Options', 'nosniff')
      .header('X-Payment-Id', slip.paymentId)
      .header('X-Payment-Slip-Id', slip.id)
      .header('X-Payment-Slip-Version', String(slip.version))
      .send(slip.content);
  });
  app.post('/api/admin/payment-slips/:id/confirm-inspection', { preHandler: requireAdmin, schema: {
    params: { type: 'object', required: ['id'], properties: { id: { type: 'string', format: 'uuid' } } },
    body: { type: 'object', additionalProperties: false, required: ['paymentId', 'slipVersion'], properties: {
      paymentId: { type: 'string', format: 'uuid' },
      slipVersion: { type: 'integer', minimum: 1 },
    } },
  } }, async (request) => confirmAdminPaymentSlipInspection(request.params.id, request.body, request.user.id));
  app.patch('/api/admin/applications/:id/review', { preHandler: requireAdmin, schema: {
    params: { type: 'object', required: ['id'], properties: { id: { type: 'string', format: 'uuid' } } },
    body: { type: 'object', additionalProperties: false, required: ['decision'], properties: {
      decision: { type: 'string', enum: ['approve', 'slip_issue', 'reject'] },
      reason: { type: 'string', maxLength: 240 },
      paymentId: { type: 'string', format: 'uuid' },
      slipId: { type: 'string', format: 'uuid' },
      slipVersion: { type: 'integer', minimum: 1 },
    } },
  } }, async (request) => reviewApplication(request.params.id, request.body, request.user.id));

  app.patch('/api/admin/exams/:id', { preHandler: requireAdmin, schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'string', minLength: 1 } } }, body: { type: 'object', additionalProperties: false, minProperties: 1, properties: { expectedRevision: { type: 'integer', minimum: 1 }, title: { type: 'string', minLength: 1 }, openDate: { type: ['string','null'], format: 'date' }, closeDate: { type: ['string','null'], format: 'date' }, editCloseDate: { type: ['string','null'], format: 'date' }, examDate: { type: ['string','null'], format: 'date' }, finalConfirmCloseDate: { type: ['string','null'], format: 'date' }, examStartTime: { type: ['string','null'], pattern: '^([01]\\d|2[0-3]):[0-5]\\d$' }, examEndTime: { type: ['string','null'], pattern: '^([01]\\d|2[0-3]):[0-5]\\d$' }, manualClosed: { type: 'boolean' }, finalManuallyClosed: { type: 'boolean' }, isOpen: { type: 'boolean' }, accent: { type: ['string','null'] }, logoDataUrl: { type: 'string', maxLength: 7000000 }, description: { type: 'string' }, packagePrices:finalPackagePriceSchema,guestPrice:{type:'number',minimum:0}, prices: { type: 'object', additionalProperties: false, properties: { paperBased: { type: 'number', minimum: 0 }, onlineExam: { type: 'number', minimum: 0 } } }, gradeOptions: { type: 'array', uniqueItems: true, items: { type: 'string' } }, centerIds: { type: 'array', uniqueItems: true, items: { type: 'string' } } } } } }, async (request, reply) => {
    const { expectedRevision: _ignored, ...patch } = request.body;
    const updated = await updateExamRound(request.params.id, patch, request.user.id, extractCatalogRevision(request));
    if (!updated) return reply.code(404).send({ error: 'Exam round not found' });
    const catalog = await loadCatalog();
    return reply.header('ETag', formatCatalogEtag(catalog.revision)).send({
      exam: catalog.exams.find((exam) => exam.id === request.params.id),
      revision: catalog.revision,
    });
  });
  app.delete('/api/admin/exams/:id', { preHandler: requireAdmin, schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'string', minLength: 1 } } } } }, async (request, reply) => {
    const archived = await archiveExamRound(request.params.id, request.user.id, extractCatalogRevision(request));
    if (!archived) return reply.code(404).send({ error: 'Exam round not found' });
    return reply.header('ETag', formatCatalogEtag(archived.revision)).send({ ok: true, revision: archived.revision });
  });

  const distDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
  if (existsSync(join(distDir, 'index.html'))) {
    app.register(fastifyStatic, { root: distDir, prefix: '/' });
    app.setNotFoundHandler(async (request, reply) => {
      if (request.url.startsWith('/api/')) return reply.code(404).send({ error: 'Not found' });
      const location = new URL(request.url, 'http://localhost');
      const status = isKnownSpaLocation(location) ? 200 : 404;
      const isTokenBearingPage = location.pathname.startsWith('/slip-replacement')
        || location.pathname.startsWith('/slip-upload')
        || location.searchParams.has('token');
      if (isTokenBearingPage) {
        const html = await readFile(join(distDir, 'index.html'));
        return reply
          .code(status)
          .header('Cache-Control', 'no-store')
          .header('Referrer-Policy', 'no-referrer')
          .type('text/html; charset=utf-8')
          .send(html);
      }
      return reply.code(status).type('text/html').sendFile('index.html');
    });
  }

  return app;
}

export const app = buildApp();
