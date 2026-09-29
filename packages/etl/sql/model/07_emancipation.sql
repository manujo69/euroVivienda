-- Estimated average age of leaving the parental household, by sex.
INSERT INTO model.observation
  SELECT 'emancipation', geo, TIME_PERIOD::INT, CASE sex WHEN 'T' THEN 'total' WHEN 'F' THEN 'women' WHEN 'M' THEN 'men' END,
    '_', OBS_VALUE, OBS_FLAG
  FROM staging.yth_demo_030
  WHERE keep(geo, TIME_PERIOD, OBS_VALUE);
