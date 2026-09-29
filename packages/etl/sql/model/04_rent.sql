-- Actual rentals for housing (CP0411), rebased from 2025 = 100 to 2015 = 100.
INSERT INTO model.observation
  SELECT 'rent', geo, year, 'total', '_', 100 * value / base, flags
  FROM (
    SELECT
      geo,
      TIME_PERIOD::INT AS year,
      OBS_VALUE AS value,
      OBS_FLAG AS flags,
      max(OBS_VALUE) FILTER (WHERE TIME_PERIOD = '2015') OVER (PARTITION BY geo) AS base
    FROM staging.prc_hicp_ainr
    WHERE keep(geo, TIME_PERIOD, OBS_VALUE)
  )
  WHERE base IS NOT NULL;
