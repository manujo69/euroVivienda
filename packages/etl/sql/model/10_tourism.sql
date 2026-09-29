-- Nights spent in tourist accommodation: Eurostat publishes them per thousand inhabitants.
INSERT INTO model.observation
  SELECT 'tourism', geo, TIME_PERIOD::INT, 'total', '_', OBS_VALUE / 1000, OBS_FLAG
  FROM staging.tour_occ_nin2
  WHERE keep(geo, TIME_PERIOD, OBS_VALUE);
