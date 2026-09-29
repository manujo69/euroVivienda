.print '## Countries with a value per year (of 27)'
PIVOT (SELECT indicator, serie, year, geo FROM eu_obs WHERE level = 'NUTS0')
  ON year USING count(DISTINCT geo) GROUP BY indicator, serie ORDER BY indicator, serie;

.print '## Missing countries per series (years 2015 onwards without a value)'
SELECT indicator, serie, c.geo, string_agg(y.year::VARCHAR, ' ' ORDER BY y.year) AS missing_years
FROM (SELECT DISTINCT indicator, serie FROM eu_obs) AS s
CROSS JOIN (SELECT geo FROM eu_geo WHERE level = 0) AS c
CROSS JOIN (SELECT DISTINCT year FROM eu_obs) AS y
WHERE y.year <= (SELECT max(year) FROM eu_obs AS o WHERE o.indicator = s.indicator AND o.serie = s.serie AND o.level = 'NUTS0')
  AND NOT EXISTS (SELECT 1 FROM eu_obs AS o WHERE o.indicator = s.indicator AND o.serie = s.serie AND o.geo = c.geo AND o.year = y.year)
GROUP BY ALL ORDER BY ALL;

.print '## EU27_2020 aggregate: years with a value'
SELECT s.indicator, s.serie, coalesce(string_agg(o.year::VARCHAR, ' ' ORDER BY o.year), '(none)') AS years
FROM (SELECT DISTINCT indicator, serie FROM series) AS s
LEFT JOIN eu_obs AS o ON o.indicator = s.indicator AND o.serie = s.serie AND o.level = 'EU'
GROUP BY ALL ORDER BY ALL;
