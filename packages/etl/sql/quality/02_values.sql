-- Years and values outside what each indicator can plausibly take: a unit change shows up here.
SELECT error('years out of range: ' || string_agg(DISTINCT indicator_id || ' ' || year, ', '))
FROM model.observation
WHERE year NOT BETWEEN getvariable('first_year') AND getvariable('final_year')
HAVING count(*) > 0;

SELECT error('values out of range: ' || string_agg(o.indicator_id || ' ' || o.geo || ' ' || o.year || ' = ' || o.value, ', ' ORDER BY o.indicator_id, o.geo, o.year))
FROM model.observation AS o
JOIN (VALUES
  ('hpi', 10, 400), ('rent', 10, 400), ('price_income', 10, 400),
  ('overburden', 0, 100), ('tenure', 0, 100), ('unemployment', 0, 100),
  ('emancipation', 15, 45), ('income', 1000, 100000), ('tourism', 0, 500), ('popgrowth', -200, 200)
) AS r (indicator_id, low, high) USING (indicator_id)
WHERE o.value NOT BETWEEN r.low AND r.high
HAVING count(*) > 0;
