ALTER TABLE exam_rounds
  ADD COLUMN final_package_prices jsonb,
  ADD COLUMN final_guest_price_satang integer CHECK (final_guest_price_satang >= 0);

UPDATE exam_rounds SET final_package_prices = CASE WHEN competition_id='timo' AND round_type='FINAL'
  THEN '{"onsite":450000,"onsite_ceremony":790000}'::jsonb
  ELSE '{"onsite_ceremony":790000,"online":450000}'::jsonb END,
  final_guest_price_satang=450000
WHERE round_type='FINAL' OR (round_type='FINAL_X' AND competition_id='bbb');

ALTER TABLE application_items
  ADD COLUMN final_package_code text CHECK (final_package_code IN ('onsite','onsite_ceremony','online')),
  ADD COLUMN final_package_price_satang integer CHECK (final_package_price_satang >= 0),
  ADD COLUMN final_guest_price_satang integer CHECK (final_guest_price_satang >= 0),
  ADD COLUMN final_guests jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(final_guests)='array' AND jsonb_array_length(final_guests)<=4);
