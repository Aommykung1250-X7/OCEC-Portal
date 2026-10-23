import { fileURLToPath } from 'node:url';
import { DEFAULT_CENTER_CATALOG } from '../src/centers.js';
import { getPool, transaction } from './db.js';
import { migrate } from './migrate.js';

const competitions = [
  { id: 'bbb', short: 'BBB', name: 'Big Bay Bei (BBB)', subject: 'Mathematics', grades: ['Primary 1', 'Primary 2', 'Primary 3', 'Primary 4', 'Primary 5', 'Primary 6', 'Secondary 1', 'Secondary 2', 'Secondary 3', 'Senior Secondary'], start: '11:15', end: '12:30', accent: 'coral' },
  { id: 'hkiso', short: 'HKISO', name: 'HKISO', subject: 'Science', grades: ['Primary 2', 'Primary 3', 'Primary 4', 'Primary 5', 'Primary 6', 'Secondary 1', 'Secondary 2', 'Secondary 3', 'Senior Secondary'], start: '09:45', end: '10:45', accent: 'violet' },
  { id: 'hkico', short: 'HKICO', name: 'HKICO', subject: 'Computer', grades: ['Primary 2 — Scratch', 'Primary 3 — Scratch', 'Primary 4 — Scratch', 'Primary 5 — Blockly', 'Primary 6 — Blockly', 'Secondary 1 — Blockly', 'Secondary 2 — Python', 'Secondary 3 — Python', 'Senior Secondary — Python'], start: '08:30', end: '09:30', accent: 'pink' },
];
const competitionChoices = [
  ['hkimo', 'HKIMO', 'HKIMO', 'Mathematics'],
  ['hkiso', 'HKISO', 'HKISO', 'Science'],
  ['hkico', 'HKICO', 'HKICO', 'Computer'],
  ['timo', 'TIMO', 'TIMO', 'Mathematics'],
  ['bbb', 'BBB', 'Big Bay Bei (BBB)', 'Mathematics'],
];

const pastPapers = [
  ['hkiso-2023', 'hkiso', 'HKISO Past Papers', 'HKISO Heat Round 2023–2024', 'English Version', 200],
  ['hkiso-2024', 'hkiso', 'HKISO Past Papers', 'HKISO Heat Round 2024–2025', 'English Version', 200],
  ['hkico-2023', 'hkico', 'HKICO Past Papers', 'HKICO Heat Round 2023–2024', 'English Version', 250],
  ['hkico-2024', 'hkico', 'HKICO Past Papers', 'HKICO Heat Round 2024–2025', 'English Version', 250],
  ['bbb-2024', 'bbb', 'Big Bay Bei Past Papers', 'Qualifier Round 2024', 'PDF English + Thai · Thai VDO', 250],
  ['bbb-2025', 'bbb', 'Big Bay Bei Past Papers', 'Qualifier Round 2025', 'PDF English + Thai · Thai VDO', 250],
  ['bbb-2026', 'bbb', 'Big Bay Bei Past Papers', 'Qualifier Round 2026', 'PDF English + Thai · Thai VDO', 250],
];

export async function seed() {
  await migrate();
  await transaction(async (client) => {
    for (const [index, label] of [...new Set(competitions.flatMap((competition) => competition.grades))].entries()) {
      await client.query('INSERT INTO grade_catalog(id, label, sort_order) VALUES($1,$2,$3) ON CONFLICT (id) DO NOTHING', [`grade-${index + 1}`, label, index + 1]);
    }
    for (const center of DEFAULT_CENTER_CATALOG) {
      await client.query('INSERT INTO exam_centers(id, code, name, active) VALUES($1,$2,$3,$4) ON CONFLICT (id) DO NOTHING', [center.id, center.code, center.name, center.active]);
    }
    for (const competition of competitions) {
      await client.query('INSERT INTO competitions(id, short_name, name, subject) VALUES($1,$2,$3,$4) ON CONFLICT (id) DO NOTHING', [competition.id, competition.short, competition.name, competition.subject]);
      const roundId = `${competition.id}-heat-2569`;
      await client.query(`INSERT INTO exam_rounds(id, competition_id, title, year, round_type, open_date, close_date, edit_close_date, exam_date, exam_start_time, exam_end_time, is_open, accent, paper_price_satang, online_price_satang, description)
        VALUES($1,$2,$3,'2569','HEAT','2026-10-01','2026-11-30','2026-11-30','2026-12-13',$4,$5,true,$6,75500,65500,$7) ON CONFLICT (id) DO NOTHING`, [roundId, competition.id, competition.name, competition.start, competition.end, competition.accent, `${competition.name} · HEAT ROUND · ปีการศึกษา 2569`]);
      for (const grade of competition.grades) {
        await client.query('INSERT INTO exam_round_grades(exam_round_id, grade_id) SELECT $1,id FROM grade_catalog WHERE label=$2 ON CONFLICT DO NOTHING', [roundId, grade]);
      }
      for (const center of DEFAULT_CENTER_CATALOG.filter((item) => item.code !== '500')) {
        await client.query('INSERT INTO exam_round_centers(exam_round_id, center_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [roundId, center.id]);
      }
    }
    for (const [id, short, name, subject] of competitionChoices) {
      await client.query('INSERT INTO competitions(id, short_name, name, subject) VALUES($1,$2,$3,$4) ON CONFLICT (id) DO NOTHING', [id, short, name, subject]);
    }
    for (const [id, competitionId, group, title, detail, price] of pastPapers) {
      await client.query('INSERT INTO past_papers(id, competition_id, group_name, title, detail, price_satang) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING', [id, competitionId, group, title, detail, price * 100]);
    }
    await client.query(`INSERT INTO payment_accounts(id, bank_name, account_name, account_number, category, show_in_form, active)
      VALUES('ocec-main-account','Kasikorn Bank','บจก. โอซีอีซี (ไทยแลนด์)','219-3-78805-2','president',true,true) ON CONFLICT (id) DO NOTHING`);
  });
  process.stdout.write('Seed catalog ready\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  seed().then(() => getPool().end()).catch((error) => { console.error(error); process.exitCode = 1; getPool().end().catch(() => {}); });
}
