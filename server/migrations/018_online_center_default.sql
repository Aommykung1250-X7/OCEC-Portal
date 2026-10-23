INSERT INTO exam_centers (id, code, name, active)
VALUES ('center-500', '500', 'Online : Home Base', true)
ON CONFLICT DO NOTHING;

UPDATE exam_centers
SET name = 'Online : Home Base', active = true
WHERE code = '500';
