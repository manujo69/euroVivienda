-- Disposable household income per inhabitant in PPS. 2024 is published for only a few countries.
INSERT INTO model.observation
  SELECT 'income', geo, TIME_PERIOD::INT, 'total', '_', OBS_VALUE, OBS_FLAG
  FROM staging.nama_10r_2hhinc
  WHERE keep(geo, TIME_PERIOD, OBS_VALUE) AND unit = 'PPS_EU27_2020_HAB' AND TIME_PERIOD::INT <= 2023;
