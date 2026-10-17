INSERT INTO competitions(id, short_name, name, subject) VALUES
  ('hkimo', 'HKIMO', 'HKIMO', 'Mathematics'),
  ('hkiso', 'HKISO', 'HKISO', 'Science'),
  ('hkico', 'HKICO', 'HKICO', 'Computer'),
  ('timo', 'TIMO', 'TIMO', 'Mathematics'),
  ('bbb', 'BBB', 'Big Bay Bei (BBB)', 'Mathematics')
ON CONFLICT (id) DO UPDATE SET short_name = excluded.short_name, active = true;
