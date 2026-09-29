-- Regional series against the NUTS 2024 geometries, in both directions.
CREATE OR REPLACE TEMP VIEW regional AS
  SELECT indicator, serie, geo, year, value
  FROM series
  WHERE indicator IN ('unemployment', 'income', 'tourism', 'popgrowth')
    AND length(geo) = 4 AND geo NOT LIKE 'EU%' AND geo NOT LIKE 'EA%' AND value IS NOT NULL;

CREATE OR REPLACE TEMP VIEW mainland AS
  SELECT geo FROM eu_geo WHERE level = 2 AND NOT outermost;

.print '## Mainland NUTS 2 regions with a value per year (of 236)'
PIVOT (SELECT indicator, serie, year, geo FROM regional WHERE geo IN (SELECT geo FROM mainland))
  ON year USING count(DISTINCT geo) GROUP BY indicator, serie ORDER BY indicator, serie;

.print '## Geometries without data in the latest year of each series'
SELECT r.indicator, r.serie, r.year, string_agg(g.geo, ' ' ORDER BY g.geo) AS regions_without_data
FROM (SELECT indicator, serie, max(year) AS year FROM regional GROUP BY ALL) AS r
CROSS JOIN mainland AS g
WHERE NOT EXISTS (SELECT 1 FROM regional AS x WHERE x.indicator = r.indicator AND x.serie = r.serie AND x.year = r.year AND x.geo = g.geo)
GROUP BY ALL ORDER BY ALL;

.print '## EU NUTS 2 codes in the data without a geometry, with the years they appear'
SELECT indicator, geo, min(year) AS first_year, max(year) AS last_year
FROM regional
WHERE substr(geo, 1, 2) IN (SELECT geo FROM eu_geo WHERE level = 0)
  AND geo NOT IN (SELECT geo FROM eu_geo WHERE level = 2)
GROUP BY ALL ORDER BY ALL;
