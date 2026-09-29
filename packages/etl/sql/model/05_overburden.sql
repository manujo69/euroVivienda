-- Housing cost overburden: total and youth (20-29) from ilc_lvho07a, tenure from ilc_lvho07c.
INSERT INTO model.observation
  SELECT 'overburden', geo, TIME_PERIOD::INT, CASE age WHEN 'TOTAL' THEN 'total' ELSE 'youth' END, '_', OBS_VALUE, OBS_FLAG
  FROM staging.ilc_lvho07a
  WHERE keep(geo, TIME_PERIOD, OBS_VALUE)
  UNION ALL
  SELECT 'overburden', geo, TIME_PERIOD::INT, lower(tenure), '_', OBS_VALUE, OBS_FLAG
  FROM staging.ilc_lvho07c
  WHERE keep(geo, TIME_PERIOD, OBS_VALUE) AND tenure <> 'TOTAL';

-- All tenants, market and reduced rent together: the two rates weighted by the share of the
-- population in each (ilc_lvho02). Comparable across countries whatever they count as social rent
-- (the Netherlands moved it from market to reduced in 2021). Own calculation, not Eurostat's.
INSERT INTO model.observation
  SELECT 'overburden', r.geo, r.TIME_PERIOD::INT, 'rent', '_',
    sum(r.OBS_VALUE * s.OBS_VALUE) / sum(s.OBS_VALUE),
    merge_flags(string_agg(r.OBS_FLAG, ''), string_agg(s.OBS_FLAG, ''))
  FROM staging.ilc_lvho07c AS r
  JOIN staging.ilc_lvho02 AS s USING (geo, TIME_PERIOD, tenure)
  WHERE r.tenure IN ('RENT_MKT', 'RENT_FR') AND keep(r.geo, r.TIME_PERIOD, r.OBS_VALUE)
    AND s.OBS_VALUE IS NOT NULL
  GROUP BY r.geo, r.TIME_PERIOD
  HAVING count(*) = 2;
