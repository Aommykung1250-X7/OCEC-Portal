import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { getPool } from './db.js';
import { loadCatalog, updateExamRound } from './catalog.js';
import { registerAuthRoutes, requireAdmin, requireUser } from './auth.js';
import { createIndividualDraft, createSchoolDraft, listMyApplications } from './applications.js';

export const app = Fastify({ logger: true, bodyLimit: 1024 * 1024, trustProxy: true });

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

registerAuthRoutes(app);

app.get('/api/catalog', async () => loadCatalog());

const candidateSchema = {
  type: 'object', additionalProperties: false, required: ['applicant', 'items'], properties: {
    applicant: { type: 'object', additionalProperties: false, required: ['firstNameEn', 'lastNameEn', 'dateOfBirth', 'schoolName', 'contactEmail', 'contactPhone'], properties: {
      firstNameEn: { type: 'string', minLength: 1, maxLength: 120 }, middleNameEn: { type: 'string', maxLength: 120 }, lastNameEn: { type: 'string', minLength: 1, maxLength: 120 },
      firstNameTh: { type: 'string', maxLength: 120 }, lastNameTh: { type: 'string', maxLength: 120 }, dateOfBirth: { type: 'string', format: 'date' },
      schoolName: { type: 'string', minLength: 1, maxLength: 255 }, contactEmail: { type: 'string', format: 'email' }, contactPhone: { type: 'string', minLength: 8, maxLength: 30 },
      address: { type: 'object', additionalProperties: { type: 'string' }, maxProperties: 20 },
    } },
    items: { type: 'array', minItems: 1, maxItems: 20, items: { type: 'object', additionalProperties: false, required: ['roundId', 'gradeId', 'format', 'centerId'], properties: {
      roundId: { type: 'string', minLength: 1 }, gradeId: { type: 'string', minLength: 1 }, format: { type: 'string', enum: ['paper', 'online'] }, centerId: { type: 'string', minLength: 1 }, examEmail: { type: 'string', format: 'email' },
    } } },
    pastPaperIds: { type: 'array', maxItems: 50, uniqueItems: true, items: { type: 'string' } },
  },
};

app.get('/api/applications/mine', { preHandler: requireUser }, async (request) => ({ applications: await listMyApplications(request.user.id) }));
app.post('/api/application-drafts', { preHandler: requireUser, schema: { body: candidateSchema } }, async (request, reply) => reply.code(201).send({ application: await createIndividualDraft(request.body, request.user.id) }));
app.post('/api/school-batch-drafts', { preHandler: requireUser, schema: { body: { type: 'object', additionalProperties: false, required: ['schoolName', 'source', 'applicants'], properties: {
  schoolName: { type: 'string', minLength: 1, maxLength: 255 }, source: { type: 'string', enum: ['manual', 'excel'] },
  applicants: { type: 'array', minItems: 1, maxItems: 100, items: candidateSchema },
} } } }, async (request, reply) => reply.code(201).send({ batch: await createSchoolDraft(request.body, request.user.id, request.user.email) }));

app.patch('/api/admin/exams/:id', { preHandler: requireAdmin, schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'string', minLength: 1 } } }, body: { type: 'object', additionalProperties: false, minProperties: 1, properties: { title: { type: 'string', minLength: 1 }, openDate: { type: 'string', format: 'date' }, closeDate: { type: 'string', format: 'date' }, editCloseDate: { type: 'string', format: 'date' }, examDate: { type: 'string', format: 'date' }, examStartTime: { type: 'string', pattern: '^([01]\\d|2[0-3]):[0-5]\\d$' }, examEndTime: { type: 'string', pattern: '^([01]\\d|2[0-3]):[0-5]\\d$' }, isOpen: { type: 'boolean' }, accent: { type: 'string' }, description: { type: 'string' }, prices: { type: 'object', additionalProperties: false, properties: { paperBased: { type: 'number', minimum: 0 }, onlineExam: { type: 'number', minimum: 0 } } }, gradeOptions: { type: 'array', uniqueItems: true, items: { type: 'string' } }, centerIds: { type: 'array', uniqueItems: true, items: { type: 'string' } } } } } }, async (request, reply) => {
  const updated = await updateExamRound(request.params.id, request.body, request.user.id);
  if (!updated) return reply.code(404).send({ error: 'Exam round not found' });
  return { exam: (await loadCatalog()).exams.find((exam) => exam.id === request.params.id) };
});

const distDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
if (existsSync(join(distDir, 'index.html'))) {
  app.register(fastifyStatic, { root: distDir, prefix: '/' });
  app.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith('/api/')) return reply.code(404).send({ error: 'Not found' });
    return reply.type('text/html').sendFile('index.html');
  });
}
