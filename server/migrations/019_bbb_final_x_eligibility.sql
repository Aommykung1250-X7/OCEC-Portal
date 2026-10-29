-- Only a BBB Final medal leads to Final X. Other Finals and Final X are terminal.
UPDATE results res SET eligible_for_final=(r.competition_id='bbb' AND r.round_type='FINAL'
  AND upper(trim(res.award)) ~ '^(GOLD|SILVER|BRONZE)( (MEDAL|AWARD))?$')
FROM application_items ai, exam_rounds r
WHERE res.application_item_id=ai.id AND r.id=ai.exam_round_id
  AND r.round_type IN ('FINAL','FINAL_X');
