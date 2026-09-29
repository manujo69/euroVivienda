.print '## Flags on EU-27 observations (count per flag)'
SELECT indicator, serie, level, sum(n)::INT AS obs,
  string_agg(flags || '=' || n, ' ' ORDER BY flags) FILTER (WHERE flags IS NOT NULL) AS flags,
  round(100 * sum(n) FILTER (WHERE flags IS NOT NULL) / sum(n), 1) AS pct_flagged
FROM (SELECT indicator, serie, level, flags, count(*) AS n FROM eu_obs GROUP BY ALL)
GROUP BY ALL ORDER BY ALL;

.print '## Value ranges (EU-27, both levels)'
SELECT indicator, serie, level,
  round(min(value), 1) AS min, round(quantile_cont(value, 0.05), 1) AS p05, round(median(value), 1) AS median,
  round(quantile_cont(value, 0.95), 1) AS p95, round(max(value), 1) AS max,
  arg_min(geo || ' ' || year, value) AS at_min, arg_max(geo || ' ' || year, value) AS at_max
FROM eu_obs WHERE level <> 'EU'
GROUP BY ALL ORDER BY ALL;

.print '## Tenure composition: country-years whose four categories do not add up to 100 (±1)'
SELECT geo, year, round(sum(value), 1) AS total
FROM eu_obs
WHERE indicator = 'tenure' AND serie IN ('OWN_L', 'OWN_NL', 'RENT_MKT', 'RENT_FR') AND level = 'NUTS0'
GROUP BY ALL HAVING abs(sum(value) - 100) > 1 ORDER BY ALL;

.print '## Tenure categories: EU mean share and spread across countries (latest year)'
SELECT serie, round(avg(value), 1) AS mean, round(min(value), 1) AS min, round(max(value), 1) AS max,
  (SELECT value FROM eu_obs AS e WHERE e.indicator = 'tenure' AND e.serie = o.serie AND e.level = 'EU' ORDER BY year DESC LIMIT 1) AS eu
FROM eu_obs AS o
WHERE indicator = 'tenure' AND level = 'NUTS0' AND year = (SELECT max(year) FROM eu_obs WHERE indicator = 'tenure' AND level = 'NUTS0')
GROUP BY ALL ORDER BY ALL;

.print '## Year-on-year jumps above 50 % (possible breaks or unit errors)'
SELECT indicator, serie, geo, year, prev, value, flags
FROM (
  SELECT *, lag(value) OVER (PARTITION BY indicator, serie, geo ORDER BY year) AS prev
  FROM eu_obs WHERE level <> 'EU' AND indicator NOT IN ('popgrowth')
)
WHERE prev > 0 AND abs(value / prev - 1) > 0.5 AND NOT (indicator = 'tourism' AND year IN (2020, 2021, 2022))
ORDER BY ALL;
