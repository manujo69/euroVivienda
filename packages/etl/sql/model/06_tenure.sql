-- Tenure status as categories of one composition. 'rent' (market + reduced) is what the map paints;
-- the pie uses the four detailed categories.
INSERT INTO model.observation
  SELECT 'tenure', geo, TIME_PERIOD::INT, 'total', lower(tenure), OBS_VALUE, OBS_FLAG
  FROM staging.ilc_lvho02
  WHERE keep(geo, TIME_PERIOD, OBS_VALUE) AND tenure IN ('OWN_L', 'OWN_NL', 'RENT_MKT', 'RENT_FR', 'RENT');
