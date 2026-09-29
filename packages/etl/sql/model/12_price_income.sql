-- House prices against household income per inhabitant, both rebased to 2015 = 100.
-- Income goes in national currency, like the price index: Eurostat publishes it only in total,
-- so per inhabitant = MIO_NAC * EUR_HAB / MIO_EUR.
INSERT INTO model.observation
  WITH income AS (
    SELECT
      geo,
      TIME_PERIOD::INT AS year,
      max(OBS_VALUE) FILTER (WHERE unit = 'MIO_NAC')
        * max(OBS_VALUE) FILTER (WHERE unit = 'EUR_HAB')
        / max(OBS_VALUE) FILTER (WHERE unit = 'MIO_EUR') AS value,
      merge_flags(string_agg(OBS_FLAG, ''), NULL) AS flags
    FROM staging.nama_10r_2hhinc
    WHERE keep(geo, TIME_PERIOD, OBS_VALUE) AND unit IN ('MIO_NAC', 'EUR_HAB', 'MIO_EUR')
      AND TIME_PERIOD::INT <= 2023 AND geo IN (SELECT code FROM model.geo WHERE level = 0)
    GROUP BY ALL
  ),
  income_index AS (
    SELECT geo, year, 100 * value / max(value) FILTER (WHERE year = 2015) OVER (PARTITION BY geo) AS value, flags
    FROM income
  )
  SELECT 'price_income', p.geo, p.year, 'total', '_', 100 * p.value / i.value, merge_flags(p.flags, i.flags)
  FROM model.observation AS p
  JOIN income_index AS i USING (geo, year)
  WHERE p.indicator_id = 'hpi' AND p.breakdown = 'total' AND i.value IS NOT NULL;
