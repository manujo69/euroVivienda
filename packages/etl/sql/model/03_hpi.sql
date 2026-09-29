-- House prices, rebased from 2025 = 100 to 2015 = 100 per country and breakdown.
INSERT INTO model.observation
  SELECT 'hpi', geo, year, breakdown, '_', 100 * value / base, flags
  FROM (
    SELECT
      geo,
      TIME_PERIOD::INT AS year,
      CASE purchase WHEN 'TOTAL' THEN 'total' WHEN 'DW_NEW' THEN 'new' WHEN 'DW_EXST' THEN 'existing' END AS breakdown,
      OBS_VALUE AS value,
      OBS_FLAG AS flags,
      max(OBS_VALUE) FILTER (WHERE TIME_PERIOD = '2015') OVER (PARTITION BY geo, purchase) AS base
    FROM staging.prc_hpi_a
    WHERE keep(geo, TIME_PERIOD, OBS_VALUE)
  )
  WHERE base IS NOT NULL;
