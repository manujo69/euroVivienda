-- Coverage in the latest year of each indicator: at least 90 % of the EU-27 countries and,
-- for regional indicators, 95 % of the mainland NUTS 2 regions (cobertura.md: 26 of 27 and 233 of 236).
SELECT error('countries without data in the latest year: ' || string_agg(indicator_id || ' ' || year || ' (' || n || ' of 27)', ', '))
FROM (
  SELECT o.indicator_id, o.year, count(DISTINCT o.geo) FILTER (WHERE g.level = 0 AND NOT g.is_aggregate) AS n
  FROM model.observation AS o
  JOIN model.geo AS g ON g.code = o.geo
  WHERE g.level = 0
    AND o.year = (SELECT max(year) FROM model.observation AS x WHERE x.indicator_id = o.indicator_id)
  GROUP BY ALL
)
WHERE n < 0.9 * (SELECT count(*) FROM model.geo WHERE level = 0 AND NOT is_aggregate)
HAVING count(*) > 0;

SELECT error('regions without data in the latest year: ' || string_agg(indicator_id || ' ' || year || ' (' || n || ' regions)', ', '))
FROM (
  SELECT o.indicator_id, o.year, count(DISTINCT o.geo) AS n
  FROM model.observation AS o
  JOIN model.geo AS g ON g.code = o.geo
  WHERE g.level = 2 AND NOT g.is_outermost
    AND o.year = (
      SELECT max(x.year) FROM model.observation AS x JOIN model.geo AS y ON y.code = x.geo
      WHERE x.indicator_id = o.indicator_id AND y.level = 2
    )
  GROUP BY ALL
)
WHERE n < 0.95 * (SELECT count(*) FROM model.geo WHERE level = 2 AND NOT is_outermost)
HAVING count(*) > 0;
