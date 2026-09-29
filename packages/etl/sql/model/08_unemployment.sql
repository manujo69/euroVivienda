-- Unemployment rate, countries and NUTS 2 regions.
INSERT INTO model.observation
  SELECT 'unemployment', geo, TIME_PERIOD::INT, 'total', '_', OBS_VALUE, OBS_FLAG
  FROM staging.lfst_r_lfu3rt
  WHERE keep(geo, TIME_PERIOD, OBS_VALUE);
