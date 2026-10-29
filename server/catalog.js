import { getPool, transaction } from './db.js';
import { DEFAULT_CENTER_CATALOG, isOnlineCenter, ONLINE_CENTER_CODE, ONLINE_CENTER_ID } from '../src/centers.js';

const date = (value) => value ? (typeof value === 'string' ? value.slice(0, 10) : value.toISOString().slice(0, 10)) : '';
const time = (value) => value ? String(value).slice(0, 5) : '';
const bangkokToday = () => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
};

export async function loadCatalog() {
  const [rounds, grades, centers, links, pastPapers, accounts, competitions, centerPoster] = await Promise.all([
    getPool().query('SELECT * FROM exam_rounds WHERE active=true ORDER BY year DESC, title'),
    getPool().query('SELECT * FROM grade_catalog WHERE active=true ORDER BY sort_order, label'),
    getPool().query('SELECT * FROM exam_centers ORDER BY code'),
    getPool().query(`SELECT exam_round_id, grade_id, NULL::text AS center_id FROM exam_round_grades
      UNION ALL
      SELECT rc.exam_round_id, NULL::text, rc.center_id FROM exam_round_centers rc
      JOIN exam_centers ec ON ec.id=rc.center_id WHERE ec.code <> '500'`),
    getPool().query('SELECT * FROM past_papers WHERE archived=false ORDER BY group_name, id'),
    getPool().query('SELECT * FROM payment_accounts WHERE active=true ORDER BY id'),
    getPool().query('SELECT * FROM competitions ORDER BY id'),
    getPool().query("SELECT to_char(updated_at AT TIME ZONE 'UTC', 'YYYYMMDDHH24MISSUS') AS version FROM application_center_poster WHERE id=1"),
  ]);
  const gradeById = new Map(grades.rows.map((grade) => [grade.id, grade.label]));
  const gradeOrder = new Map(grades.rows.map((grade, index) => [grade.label, index]));
  const today = bangkokToday();
  const competitionOrder = ['hkimo', 'hkiso', 'hkico', 'timo', 'bbb'];
  const onlineCenter = centers.rows.find((center) => center.code === ONLINE_CENTER_CODE || center.id === ONLINE_CENTER_ID);
  const catalogCenters = centers.rows
    .filter((center) => !isOnlineCenter(center))
    .map((row) => ({ id: row.id, code: row.code, name: row.name, active: row.active }));
  catalogCenters.unshift({ ...DEFAULT_CENTER_CATALOG[0], id: onlineCenter?.id || DEFAULT_CENTER_CATALOG[0].id });
  return {
    competitions: competitions.rows.map((row) => ({ id: row.id, short: row.short_name, name: row.name, subject: row.subject, active: row.active }))
      .sort((left, right) => {
        const leftIndex = competitionOrder.indexOf(left.id);
        const rightIndex = competitionOrder.indexOf(right.id);
        return (leftIndex < 0 ? competitionOrder.length : leftIndex) - (rightIndex < 0 ? competitionOrder.length : rightIndex) || left.short.localeCompare(right.short);
      }),
    exams: rounds.rows.map((row) => {
      const openDate = date(row.open_date);
      const closeDate = date(row.close_date);
      const manuallyClosed = Boolean(row.final_manually_closed);
      return { id: row.id, competitionId: row.competition_id, title: row.title, year: row.year, roundType: row.round_type, round: row.round_type === 'HEAT' ? 'HEAT ROUND' : row.round_type === 'FINAL' ? 'FINAL ROUND' : 'FINAL X', openDate, closeDate, editCloseDate: date(row.edit_close_date), examDate: date(row.exam_date), examStartTime: time(row.exam_start_time), examEndTime: time(row.exam_end_time), finalConfirmCloseDate: row.round_type === 'FINAL' ? closeDate : date(row.final_confirm_close_date), finalManuallyClosed: manuallyClosed, isOpen: Boolean(openDate && closeDate && openDate <= today && today <= closeDate && !manuallyClosed), accent: row.accent, logoDataUrl: row.logo_data_url || '', prices: { paperBased: row.paper_price_satang / 100, onlineExam: row.online_price_satang / 100 }, description: row.description, gradeOptions: links.rows.filter((item) => item.exam_round_id === row.id && item.grade_id).map((item) => gradeById.get(item.grade_id)).filter(Boolean).sort((left, right) => gradeOrder.get(left) - gradeOrder.get(right)), centerIds: links.rows.filter((item) => item.exam_round_id === row.id && item.center_id).map((item) => item.center_id) };
    }),
    grades: grades.rows.map((row) => ({ id: row.id, label: row.label, sortOrder: row.sort_order, active: row.active })),
    centers: catalogCenters,
    pastPapers: pastPapers.rows.map((row) => ({ id: row.id, competitionId: row.competition_id, group: row.group_name, title: row.title, detail: row.detail, name: `${row.title} — ${row.detail}`, price: row.price_satang / 100, active: row.active })),
    paymentAccounts: accounts.rows.map((row) => ({ id: row.id, bankName: row.bank_name, accountName: row.account_name, accountNumber: row.account_number, category: row.category, showInForm: row.show_in_form, active: row.active })),
    centerPosterVersion: centerPoster.rows[0]?.version || null,
  };
}

const fail = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
const cleanText = (value, field, maxLength = 255) => {
  const result = String(value ?? '').trim();
  if (!result || result.length > maxLength) throw fail(`${field} is required and must be at most ${maxLength} characters`);
  return result;
};
const safeId = (value, field) => {
  const result = cleanText(value, field, 180);
  if (!/^[\p{L}\p{N}_.:-]+$/u.test(result)) throw fail(`${field} contains unsupported characters`);
  return result;
};
const roundType = (exam) => exam.roundType || (String(exam.round || '').toUpperCase().includes('FINAL X') ? 'FINAL_X' : String(exam.round || '').toUpperCase().includes('FINAL') ? 'FINAL' : 'HEAT');

export function normalizePaymentAccounts(paymentAccounts) {
  if (!Array.isArray(paymentAccounts)) throw fail('Catalog field paymentAccounts must be an array');
  const accounts = paymentAccounts.map((account) => {
    const id = safeId(account.id, 'Payment account ID');
    const category = account.category === 'president' ? 'president' : account.category === 'other' ? 'other' : null;
    if (!category) throw fail('Payment account category must be president or other');
    return {
      id,
      bankName: cleanText(account.bankName, 'Bank name'),
      accountName: cleanText(account.accountName, 'Account name'),
      accountNumber: cleanText(account.accountNumber, 'Account number', 80),
      category,
      showInForm: account.showInForm === true,
      active: account.active !== false,
    };
  });
  const accountNumbers = new Set();
  if (accounts.some((account) => {
    const key = account.accountNumber.replace(/\D/g, '');
    const duplicate = accountNumbers.has(key);
    accountNumbers.add(key);
    return duplicate;
  })) throw fail('Payment account numbers must be unique');
  const activeAccountCount = accounts.filter((account) => account.active).length;
  const selectedAccountCount = accounts.filter((account) => account.active && account.showInForm).length;
  if (selectedAccountCount > 1) throw fail('Only one active payment account can be shown in the application form');
  if (activeAccountCount > 0 && selectedAccountCount !== 1) {
    throw fail('Select one active payment account to show in the application form');
  }
  return accounts;
}

async function persistPaymentAccounts(accounts, actorId, action) {
  await transaction(async (client) => {
    const before = await catalogAuditSnapshot(client);
    await client.query('UPDATE payment_accounts SET active=false');
    for (const account of accounts) await client.query(`INSERT INTO payment_accounts(id,bank_name,account_name,account_number,category,show_in_form,active)
      VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO UPDATE SET bank_name=excluded.bank_name,account_name=excluded.account_name,
      account_number=excluded.account_number,category=excluded.category,show_in_form=excluded.show_in_form,active=excluded.active`,
    [account.id, account.bankName, account.accountName, account.accountNumber, account.category, account.showInForm, account.active]);
    const after = await catalogAuditSnapshot(client);
    await client.query(`INSERT INTO audit_logs(actor_user_id,entity_type,entity_id,action,before_data,after_data)
      VALUES($1,'catalog','payment-accounts',$2,$3,$4)`, [actorId, action, before, after]);
  });
}

/** Persist just the payment-account selection, independent from unrelated catalog validation. */
export async function savePaymentAccountsSnapshot(paymentAccounts, actorId) {
  const accounts = normalizePaymentAccounts(paymentAccounts);
  await persistPaymentAccounts(accounts, actorId, 'payment_accounts_replace');
  return (await loadCatalog()).paymentAccounts;
}

async function catalogAuditSnapshot(client) {
  const result = await client.query(`SELECT jsonb_build_object(
    'rounds',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'competitionId',competition_id,'title',title,'year',year,'roundType',round_type,'openDate',open_date,'closeDate',close_date,'editCloseDate',edit_close_date,'examDate',exam_date,'isOpen',is_open,'active',active,'paperPriceSatang',paper_price_satang,'onlinePriceSatang',online_price_satang) ORDER BY id),'[]'::jsonb) FROM exam_rounds),
    'grades',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'label',label,'sortOrder',sort_order,'active',active) ORDER BY sort_order,id),'[]'::jsonb) FROM grade_catalog),
    'centers',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'code',code,'name',name,'active',active) ORDER BY code),'[]'::jsonb) FROM exam_centers),
    'pastPapers',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'competitionId',competition_id,'group',group_name,'title',title,'detail',detail,'priceSatang',price_satang,'active',active,'archived',archived) ORDER BY id),'[]'::jsonb) FROM past_papers),
    'paymentAccounts',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'bankName',bank_name,'accountName',account_name,'accountLast4',right(regexp_replace(account_number,'[^0-9]','','g'),4),'category',category,'showInForm',show_in_form,'active',active) ORDER BY id),'[]'::jsonb) FROM payment_accounts),
    'competitions',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'short',short_name,'name',name,'subject',subject,'active',active) ORDER BY id),'[]'::jsonb) FROM competitions)
  ) AS snapshot`);
  return result.rows[0].snapshot;
}

/** Persist the current admin-edited catalog atomically; referenced rows are archived, never hard-deleted. */
export async function saveCatalogSnapshot(snapshot, actorId) {
  for (const key of ['exams', 'grades', 'centers', 'pastPapers', 'paymentAccounts']) {
    if (!Array.isArray(snapshot?.[key])) throw fail(`Catalog field ${key} must be an array`);
  }
  const labelIds = new Map();
  const duplicateGradeIds = [];
  const grades = snapshot.grades.flatMap((grade, index) => {
    const label = cleanText(typeof grade === 'string' ? grade : grade.label, 'Grade label', 120);
    const normalized = label.toLocaleLowerCase();
    const id = safeId((typeof grade === 'object' && grade.id) || `grade-${label.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-')}`, 'Grade ID');
    if (labelIds.has(normalized)) {
      if (id !== labelIds.get(normalized)) duplicateGradeIds.push(id);
      return [];
    }
    labelIds.set(normalized, id);
    return [{ id, label, sortOrder: Number.isInteger(grade.sortOrder) ? grade.sortOrder : index + 1 }];
  });
  const centerIds = new Set();
  const centerCodes = new Set();
  const onlineCenter = snapshot.centers.find((center) => center.code === ONLINE_CENTER_CODE || center.id === ONLINE_CENTER_ID);
  const submittedCenters = [
    ...snapshot.centers.filter((center) => !isOnlineCenter(center)),
    { ...DEFAULT_CENTER_CATALOG[0], id: onlineCenter?.id || DEFAULT_CENTER_CATALOG[0].id },
  ];
  const centers = submittedCenters.map((center) => {
    const id = safeId(center.id, 'Exam center ID');
    const code = center.id === ONLINE_CENTER_ID ? ONLINE_CENTER_CODE : cleanText(center.code, 'Exam center code', 3);
    const name = center.id === ONLINE_CENTER_ID ? DEFAULT_CENTER_CATALOG[0].name : cleanText(center.name, 'Exam center name', 255);
    if (!/^\d{3}$/.test(code)) throw fail('Exam center codes must contain exactly three digits');
    if (centerIds.has(id) || centerCodes.has(code)) throw fail('Exam center IDs and codes must be unique');
    centerIds.add(id); centerCodes.add(code);
    return { id, code, name, active: center.id === ONLINE_CENTER_ID || center.active !== false };
  });
  const competitionIds = new Set();
  const competitionShorts = new Set();
  const competitions = (snapshot.competitions || []).map((competition) => {
    const id = safeId(competition.id, 'Competition ID');
    const short = cleanText(competition.short || competition.name, 'Competition short name', 30);
    const name = cleanText(competition.name || competition.short, 'Competition name', 255);
    const subject = cleanText(competition.subject || 'Mathematics', 'Competition subject', 80);
    const shortKey = short.toLocaleLowerCase();
    if (competitionIds.has(id) || competitionShorts.has(shortKey)) throw fail('Competition IDs and short names must be unique');
    competitionIds.add(id); competitionShorts.add(shortKey);
    return { id, short, name, subject, active: competition.active !== false };
  });
  const roundIds = new Set();
  const onlineCenterIds = new Set(centers.filter((center) => center.code === '500').map((center) => center.id));
  const exams = snapshot.exams.map((exam) => {
    const id = safeId(exam.id, 'Exam round ID');
    const competitionId = safeId(exam.competitionId, 'Competition ID');
    const title = cleanText(exam.title, 'Exam title', 255);
    const year = cleanText(exam.year, 'Academic year', 8);
    const type = roundType(exam);
    if (!['HEAT', 'FINAL', 'FINAL_X'].includes(type)) throw fail(`Unsupported exam round type: ${type}`);
    if (type === 'FINAL_X' && competitionId !== 'bbb') throw fail('Final X เปิดให้เฉพาะ BBB');
    if (roundIds.has(id)) throw fail(`Duplicate exam round: ${id}`);
    if (exam.isOpen && !Array.isArray(exam.gradeOptions ?? []) || exam.isOpen && !(exam.gradeOptions || []).length) throw fail(`Open round ${title} requires at least one grade`);
    const selectedGrades = [...new Set((exam.gradeOptions || []).map((label) => {
      const found = labelIds.get(String(label).toLocaleLowerCase());
      if (!found) throw fail(`Unknown grade selected for ${title}: ${label}`);
      return found;
    }))];
    const selectedCenters = [...new Set(exam.centerIds || [])]
      .map((centerId) => safeId(centerId, 'Exam center ID'))
      .filter((centerId) => !onlineCenterIds.has(centerId));
    if (selectedCenters.some((centerId) => !centers.some((center) => center.id === centerId && center.active && center.code !== '500'))) throw fail(`Unknown or inactive exam center selected for ${title}`);
    const price = (value, label) => {
      const amount = Number(value);
      if (!Number.isSafeInteger(Math.round(amount * 100)) || amount < 0) throw fail(`${label} must be a non-negative amount`);
      return Math.round(amount * 100);
    };
    const isoDate = (value, label) => {
      if (value == null || value === '') return null;
      const dateValue = String(value);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue) || Number.isNaN(Date.parse(`${dateValue}T00:00:00Z`))) throw fail(`${label} must be a valid date`);
      return dateValue;
    };
    const timeValue = (value, label) => {
      if (value == null || value === '') return null;
      const timeText = String(value);
      if (!/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(timeText)) throw fail(`${label} must be a valid time`);
      return timeText.length === 5 ? `${timeText}:00` : timeText;
    };
    const logo = String(exam.logoDataUrl || '');
    if (logo && (!/^data:image\/(png|jpeg|webp);base64,/.test(logo) || logo.length > 7_000_000)) throw fail(`Logo for ${title} must be PNG/JPG/WEBP and no larger than 5 MB`);
    const openDate = isoDate(exam.openDate, 'Opening date');
    const closeDate = isoDate(exam.closeDate, 'Registration close date');
    if (openDate && closeDate && openDate > closeDate) throw fail(`Opening date must be on or before the registration close date for ${title}`);
    roundIds.add(id);
    return {
      id, competitionId, title, year, type,
      openDate, closeDate,
      editCloseDate: isoDate(exam.editCloseDate, 'Edit close date'), examDate: isoDate(exam.examDate, 'Exam date'),
      finalConfirmCloseDate: type === 'FINAL' ? isoDate(exam.closeDate, 'Registration close date') : isoDate(exam.finalConfirmCloseDate, 'Final confirmation close date'),
      examStartTime: timeValue(exam.examStartTime, 'Exam start time'), examEndTime: timeValue(exam.examEndTime, 'Exam end time'),
      finalManuallyClosed: Boolean(exam.finalManuallyClosed), isOpen: Boolean(exam.isOpen), accent: String(exam.accent || '').slice(0, 40) || null,
      description: String(exam.description || '').slice(0, 1000), logo, paperPrice: price(exam.prices?.paperBased ?? 0, 'Paper-Based price'),
      onlinePrice: price(exam.prices?.onlineExam ?? 0, 'Online Exam price'), gradeIds: selectedGrades, centerIds: selectedCenters,
    };
  });
  const papers = snapshot.pastPapers.map((paper) => {
    const id = safeId(paper.id, 'Past paper ID');
    const name = String(paper.name || '').trim();
    const title = cleanText(paper.title || name.split(' — ')[0], 'Past paper title', 255);
    const detail = String(paper.detail ?? (name.includes(' — ') ? name.slice(name.indexOf(' — ') + 3) : '')).trim().slice(0, 255);
    const group = cleanText(paper.group, 'Past paper group', 255);
    const competitionId = paper.competitionId || null;
    const priceSatang = Math.round(Number(paper.price) * 100);
    if (!Number.isSafeInteger(priceSatang) || priceSatang < 0) throw fail(`Invalid price for past paper ${title}`);
    return { id, title, detail, group, competitionId, priceSatang, active: paper.active !== false };
  });
  const paperIds = new Set();
  if (papers.some((paper) => paperIds.has(paper.id) || !paperIds.add(paper.id))) throw fail('Past paper IDs must be unique');
  const accounts = normalizePaymentAccounts(snapshot.paymentAccounts);

  await transaction(async (client) => {
    if (duplicateGradeIds.length) {
      const referencedDuplicates = await client.query('SELECT DISTINCT grade_id FROM application_items WHERE grade_id=ANY($1::text[])', [duplicateGradeIds]);
      if (referencedDuplicates.rowCount) throw fail('Cannot merge duplicate grades that are used by existing applications');
    }
    const before = await catalogAuditSnapshot(client);
    const todayResult = await client.query("SELECT (now() AT TIME ZONE 'Asia/Bangkok')::date AS today");
    const today = String(todayResult.rows[0].today).slice(0, 10);
    const missingOpenRoundGrades = exams.find((exam) => !exam.finalManuallyClosed && exam.openDate && exam.closeDate
      && exam.openDate <= today && today <= exam.closeDate && !exam.gradeIds.length);
    if (missingOpenRoundGrades) throw fail(`Open round ${missingOpenRoundGrades.title} requires at least one grade`);

    await client.query('UPDATE grade_catalog SET active=false');
    for (const grade of grades) await client.query(`INSERT INTO grade_catalog(id,label,sort_order,active) VALUES($1,$2,$3,true)
      ON CONFLICT(id) DO UPDATE SET label=excluded.label,sort_order=excluded.sort_order,active=true`, [grade.id, grade.label, grade.sortOrder]);

    await client.query('UPDATE exam_centers SET active=false WHERE code <> \'500\'');
    for (const center of centers) await client.query(`INSERT INTO exam_centers(id,code,name,active) VALUES($1,$2,$3,$4)
      ON CONFLICT(id) DO UPDATE SET code=excluded.code,name=excluded.name,active=excluded.active`, [center.id, center.code, center.name, center.active]);

    const existingCompetitions = await client.query('SELECT id,short_name,name,subject,active FROM competitions');
    const compById = new Map(existingCompetitions.rows.map((item) => [item.id, item]));
    const normalizedCompetitions = new Map(competitions.map((item) => [item.id, item]));
    const compShort = (id, title) => ({ bbb: 'BBB', hkimo: 'HKIMO', hkiso: 'HKISO', hkico: 'HKICO', timo: 'TIMO' }[id] || id.toUpperCase().slice(0, 30));
    for (const exam of exams) {
      if (normalizedCompetitions.has(exam.competitionId)) continue;
      const prior = compById.get(exam.competitionId);
      normalizedCompetitions.set(exam.competitionId, {
        id: exam.competitionId, short: prior?.short_name || compShort(exam.competitionId, exam.title),
        name: prior?.name || exam.title,
        subject: prior?.subject || (/iso/i.test(exam.competitionId) ? 'Science' : /ico/i.test(exam.competitionId) ? 'Computer' : 'Mathematics'),
        active: true,
      });
    }
    if (Array.isArray(snapshot.competitions)) await client.query('UPDATE competitions SET active=false');
    for (const competition of normalizedCompetitions.values()) {
      await client.query(`INSERT INTO competitions(id,short_name,name,subject,active) VALUES($1,$2,$3,$4,$5)
        ON CONFLICT(id) DO UPDATE SET short_name=excluded.short_name,name=excluded.name,subject=excluded.subject,active=excluded.active`,
      [competition.id, competition.short, competition.name, competition.subject, competition.active]);
      compById.set(competition.id, { short_name: competition.short, name: competition.name, subject: competition.subject, active: competition.active });
    }
    for (const exam of exams) {
      const prior = compById.get(exam.competitionId);
      const subject = prior?.subject || (/iso/i.test(exam.competitionId) ? 'Science' : /ico/i.test(exam.competitionId) ? 'Computer' : 'Mathematics');
      if (!prior) {
        await client.query(`INSERT INTO competitions(id,short_name,name,subject,active) VALUES($1,$2,$3,$4,true)`, [exam.competitionId, compShort(exam.competitionId, exam.title), exam.title, subject]);
      }
    }
    await client.query('UPDATE exam_rounds SET active=false,is_open=false,updated_at=now() WHERE active');
    await client.query('UPDATE past_papers SET active=false, archived=true WHERE archived=false');
    for (const paper of papers) {
      if (paper.competitionId && !compById.has(paper.competitionId) && !exams.some((exam) => exam.competitionId === paper.competitionId)) throw fail(`Unknown competition for past paper ${paper.title}`);
      await client.query(`INSERT INTO past_papers(id,competition_id,group_name,title,detail,price_satang,active,archived)
        VALUES($1,$2,$3,$4,$5,$6,$7,false) ON CONFLICT(id) DO UPDATE SET competition_id=excluded.competition_id,
        group_name=excluded.group_name,title=excluded.title,detail=excluded.detail,price_satang=excluded.price_satang,active=excluded.active,archived=false`,
      [paper.id, paper.competitionId, paper.group, paper.title, paper.detail, paper.priceSatang, paper.active]);
    }
    for (const exam of exams) {
      await client.query(`INSERT INTO exam_rounds(id,competition_id,title,year,round_type,open_date,close_date,edit_close_date,exam_date,exam_start_time,exam_end_time,final_confirm_close_date,final_manually_closed,is_open,accent,logo_data_url,paper_price_satang,online_price_satang,description,active)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,true)
        ON CONFLICT(id) DO UPDATE SET competition_id=excluded.competition_id,title=excluded.title,year=excluded.year,round_type=excluded.round_type,
        open_date=excluded.open_date,close_date=excluded.close_date,edit_close_date=excluded.edit_close_date,exam_date=excluded.exam_date,
        exam_start_time=excluded.exam_start_time,exam_end_time=excluded.exam_end_time,final_confirm_close_date=excluded.final_confirm_close_date,
        final_manually_closed=excluded.final_manually_closed,is_open=excluded.is_open,accent=excluded.accent,logo_data_url=excluded.logo_data_url,
        paper_price_satang=excluded.paper_price_satang,online_price_satang=excluded.online_price_satang,description=excluded.description,active=true,updated_at=now()`,
      [exam.id, exam.competitionId, exam.title, exam.year, exam.type, exam.openDate, exam.closeDate, exam.editCloseDate, exam.examDate,
        exam.examStartTime, exam.examEndTime, exam.finalConfirmCloseDate, exam.finalManuallyClosed,
        Boolean(exam.openDate && exam.closeDate && exam.openDate <= today && today <= exam.closeDate && !exam.finalManuallyClosed), exam.accent, exam.logo || null,
        exam.paperPrice, exam.onlinePrice, exam.description]);
      await client.query('DELETE FROM exam_round_grades WHERE exam_round_id=$1', [exam.id]);
      for (const gradeId of exam.gradeIds) await client.query('INSERT INTO exam_round_grades(exam_round_id,grade_id) VALUES($1,$2)', [exam.id, gradeId]);
      await client.query('DELETE FROM exam_round_centers WHERE exam_round_id=$1', [exam.id]);
      for (const centerId of exam.centerIds) await client.query('INSERT INTO exam_round_centers(exam_round_id,center_id) VALUES($1,$2)', [exam.id, centerId]);
    }

    await client.query('UPDATE payment_accounts SET active=false');
    for (const account of accounts) await client.query(`INSERT INTO payment_accounts(id,bank_name,account_name,account_number,category,show_in_form,active)
      VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO UPDATE SET bank_name=excluded.bank_name,account_name=excluded.account_name,
      account_number=excluded.account_number,category=excluded.category,show_in_form=excluded.show_in_form,active=excluded.active`,
    [account.id, account.bankName, account.accountName, account.accountNumber, account.category, account.showInForm, account.active]);

    const after = await catalogAuditSnapshot(client);
    await client.query(`INSERT INTO audit_logs(actor_user_id,entity_type,entity_id,action,before_data,after_data)
      VALUES($1,'catalog','all','replace',$2,$3)`, [actorId, before, after]);
  });
  return loadCatalog();
}

export async function archiveExamRound(id, actorId) {
  return transaction(async (client) => {
    const prior = await client.query('SELECT * FROM exam_rounds WHERE id=$1 AND active=true FOR UPDATE', [id]);
    if (!prior.rowCount) return false;
    await client.query('UPDATE exam_rounds SET active=false,is_open=false,updated_at=now() WHERE id=$1', [id]);
    await client.query('INSERT INTO audit_logs(actor_user_id,entity_type,entity_id,action,before_data,after_data) VALUES($1,$2,$3,$4,$5,$6)', [actorId, 'exam_round', id, 'archive', prior.rows[0], { active: false, is_open: false }]);
    return true;
  });
}

export async function updateExamRound(id, patch, actorId) {
  const allowed = { title: 'title', openDate: 'open_date', closeDate: 'close_date', editCloseDate: 'edit_close_date', examDate: 'exam_date', examStartTime: 'exam_start_time', examEndTime: 'exam_end_time', accent: 'accent', description: 'description' };
  return transaction(async (client) => {
    const prior = await client.query('SELECT * FROM exam_rounds WHERE id=$1 FOR UPDATE', [id]);
    if (!prior.rowCount) return null;
    const roundBefore = prior.rows[0];
    const manualClosed = Object.hasOwn(patch, 'manualClosed') ? patch.manualClosed
      : Object.hasOwn(patch, 'finalManuallyClosed') ? patch.finalManuallyClosed
        : Object.hasOwn(patch, 'isOpen') ? !patch.isOpen : undefined;
    const patchedDate = (key, original) => {
      if (Object.hasOwn(patch, key)) return patch[key] || '';
      if (key === 'closeDate' && roundBefore.round_type === 'FINAL' && Object.hasOwn(patch, 'finalConfirmCloseDate')) return patch.finalConfirmCloseDate || '';
      return date(original);
    };
    const nextOpenDate = patchedDate('openDate', roundBefore.open_date);
    const nextCloseDate = patchedDate('closeDate', roundBefore.close_date);
    if (nextOpenDate && nextCloseDate && nextOpenDate > nextCloseDate) {
      const error = new Error('วันเริ่มรับสมัครต้องไม่อยู่หลังวันปิดรับสมัคร'); error.statusCode = 400; throw error;
    }
    if (manualClosed === false) {
      const dateResult = await client.query("SELECT (now() AT TIME ZONE 'Asia/Bangkok')::date AS today");
      const today = String(dateResult.rows[0].today).slice(0, 10);
      const openDate = patchedDate('openDate', roundBefore.open_date);
      const closeDate = patchedDate('closeDate', roundBefore.close_date);
      if (!openDate || !closeDate || today < openDate || today > closeDate) {
        const error = new Error('เปิดรับสมัครได้เฉพาะภายในช่วงวันที่กำหนด'); error.statusCode = 409; throw error;
      }
      const available = await client.query('SELECT 1 FROM exam_round_grades WHERE exam_round_id=$1 LIMIT 1', [id]);
      if (!available.rowCount) { const error = new Error('Open exam rounds require at least one grade'); error.statusCode = 400; throw error; }
    }
    const normalizedPatch = { ...patch };
    if (manualClosed !== undefined) normalizedPatch.finalManuallyClosed = manualClosed;
    if (roundBefore.round_type === 'FINAL') {
      if (Object.hasOwn(patch, 'closeDate')) normalizedPatch.finalConfirmCloseDate = patch.closeDate;
      else if (Object.hasOwn(patch, 'finalConfirmCloseDate')) normalizedPatch.closeDate = patch.finalConfirmCloseDate;
    }
    if (Array.isArray(patch.gradeOptions)) {
      const found = await client.query('SELECT label FROM grade_catalog WHERE label=ANY($1::text[]) AND active=true', [patch.gradeOptions]);
      if (found.rowCount !== patch.gradeOptions.length) { const error = new Error('Unknown or inactive grade'); error.statusCode = 400; throw error; }
    }
    if (Array.isArray(patch.centerIds)) {
      const found = await client.query("SELECT id FROM exam_centers WHERE id=ANY($1::text[]) AND active=true AND code <> '500'", [patch.centerIds]);
      if (found.rowCount !== patch.centerIds.length) { const error = new Error('Unknown or inactive exam center'); error.statusCode = 400; throw error; }
    }
    if ((manualClosed === false || (manualClosed === undefined && (patch.isOpen ?? (!roundBefore.final_manually_closed && roundBefore.is_open)))) && Array.isArray(patch.gradeOptions) && !patch.gradeOptions.length) {
      const error = new Error('Open exam rounds require at least one grade'); error.statusCode = 400; throw error;
    }
    const assignments = [];
    const values = [];
    for (const [key, column] of Object.entries(allowed)) if (Object.hasOwn(normalizedPatch, key)) {
      values.push(normalizedPatch[key]);
      assignments.push(`${column}=$${values.length}`);
    }
    if (Object.hasOwn(normalizedPatch, 'finalConfirmCloseDate')) {
      values.push(normalizedPatch.finalConfirmCloseDate || null);
      assignments.push(`final_confirm_close_date=$${values.length}`);
    }
    if (manualClosed !== undefined) {
      values.push(Boolean(manualClosed));
      assignments.push(`final_manually_closed=$${values.length}`);
      const dateResult = await client.query("SELECT (now() AT TIME ZONE 'Asia/Bangkok')::date AS today");
      const today = String(dateResult.rows[0].today).slice(0, 10);
      const openDate = patchedDate('openDate', roundBefore.open_date);
      const closeDate = patchedDate('closeDate', roundBefore.close_date);
      values.push(Boolean(!manualClosed && openDate && closeDate && openDate <= today && today <= closeDate));
      assignments.push(`is_open=$${values.length}`);
    } else if (Object.hasOwn(normalizedPatch, 'openDate') || Object.hasOwn(normalizedPatch, 'closeDate')) {
      const dateResult = await client.query("SELECT (now() AT TIME ZONE 'Asia/Bangkok')::date AS today");
      const today = String(dateResult.rows[0].today).slice(0, 10);
      const openDate = patchedDate('openDate', roundBefore.open_date);
      const closeDate = patchedDate('closeDate', roundBefore.close_date);
      values.push(Boolean(!roundBefore.final_manually_closed && openDate && closeDate && openDate <= today && today <= closeDate));
      assignments.push(`is_open=$${values.length}`);
    }
    if (Object.hasOwn(patch, 'logoDataUrl')) {
      values.push(patch.logoDataUrl || null);
      assignments.push(`logo_data_url=$${values.length}`);
    }
    if (Object.hasOwn(patch, 'prices')) {
      if (patch.prices?.paperBased !== undefined) { values.push(Math.round(Number(patch.prices.paperBased) * 100)); assignments.push(`paper_price_satang=$${values.length}`); }
      if (patch.prices?.onlineExam !== undefined) { values.push(Math.round(Number(patch.prices.onlineExam) * 100)); assignments.push(`online_price_satang=$${values.length}`); }
    }
    if (assignments.length) {
      values.push(id);
      await client.query(`UPDATE exam_rounds SET ${assignments.join(', ')}, updated_at=now() WHERE id=$${values.length}`, values);
    }
    if (Array.isArray(patch.gradeOptions)) {
      await client.query('DELETE FROM exam_round_grades WHERE exam_round_id=$1', [id]);
      for (const label of patch.gradeOptions) await client.query('INSERT INTO exam_round_grades(exam_round_id, grade_id) SELECT $1,id FROM grade_catalog WHERE label=$2', [id, label]);
    }
    if (Array.isArray(patch.centerIds)) {
      await client.query('DELETE FROM exam_round_centers WHERE exam_round_id=$1', [id]);
      for (const centerId of patch.centerIds) await client.query('INSERT INTO exam_round_centers(exam_round_id, center_id) VALUES($1,$2)', [id, centerId]);
    }
    if (patch.isOpen && !Array.isArray(patch.gradeOptions)) {
      const available = await client.query('SELECT 1 FROM exam_round_grades WHERE exam_round_id=$1 LIMIT 1', [id]);
      if (!available.rowCount) { const error = new Error('Open exam rounds require at least one grade'); error.statusCode = 400; throw error; }
    }
    const after = await client.query('SELECT * FROM exam_rounds WHERE id=$1', [id]);
    await client.query('INSERT INTO audit_logs(actor_user_id, entity_type, entity_id, action, before_data, after_data) VALUES($1,$2,$3,$4,$5,$6)', [actorId, 'exam_round', id, 'update', prior.rows[0], after.rows[0]]);
    return after.rows[0];
  });
}
