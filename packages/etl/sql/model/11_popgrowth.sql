-- Crude rates of total population change and net migration (per thousand).
INSERT INTO model.observation
  SELECT 'popgrowth', geo, TIME_PERIOD::INT, CASE indic_de WHEN 'GROWRT' THEN 'total' ELSE 'migration' END,
    '_', OBS_VALUE, OBS_FLAG
  FROM staging.demo_r_gind3
  WHERE keep(geo, TIME_PERIOD, OBS_VALUE);
