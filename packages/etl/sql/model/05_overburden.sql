-- Housing cost overburden: total and youth (20-29) from ilc_lvho07a, tenure from ilc_lvho07c.
INSERT INTO model.observation
  SELECT 'overburden', geo, TIME_PERIOD::INT, CASE age WHEN 'TOTAL' THEN 'total' ELSE 'youth' END, '_', OBS_VALUE, OBS_FLAG
  FROM staging.ilc_lvho07a
  WHERE keep(geo, TIME_PERIOD, OBS_VALUE)
  UNION ALL
  SELECT 'overburden', geo, TIME_PERIOD::INT, lower(tenure), '_', OBS_VALUE, OBS_FLAG
  FROM staging.ilc_lvho07c
  WHERE keep(geo, TIME_PERIOD, OBS_VALUE) AND tenure <> 'TOTAL';
