-- The value the map paints: the change since 2015 for indices, the map category for compositions.
-- Countries only (no EU aggregate), all years: fixed breaks mean the same colour every year.
CREATE OR REPLACE VIEW publish.map_value AS
  SELECT o.indicator_id, o.breakdown, o.geo, o.year,
    CASE i.kind WHEN 'index' THEN o.value - 100 ELSE o.value END AS value
  FROM model.observation AS o
  JOIN model.indicator AS i ON i.id = o.indicator_id
  JOIN model.geo AS g ON g.code = o.geo
  WHERE g.level = 0 AND NOT g.is_aggregate AND o.category = coalesce(i.map_category->>'id', '_');

-- Sequential: quintiles. Diverging (values on both sides of 0): 0 plus terciles of each side.
CREATE OR REPLACE VIEW publish.breaks AS
  WITH scales AS (
    SELECT indicator_id,
      CASE WHEN min(value) < 0 AND max(value) > 0 THEN 'diverging' ELSE 'sequential' END AS scale
    FROM publish.map_value
    GROUP BY ALL
  ),
  cuts AS (
    SELECT v.indicator_id, v.breakdown, s.scale,
      CASE s.scale
        WHEN 'sequential' THEN quantile_cont(v.value, [0.2, 0.4, 0.6, 0.8])
        ELSE list_concat(
          coalesce(quantile_cont(v.value, [1 / 3, 2 / 3]) FILTER (WHERE v.value < 0), []),
          [0],
          coalesce(quantile_cont(v.value, [1 / 3, 2 / 3]) FILTER (WHERE v.value > 0), []))
      END AS cuts
    FROM publish.map_value AS v
    JOIN scales AS s USING (indicator_id)
    GROUP BY v.indicator_id, v.breakdown, s.scale
  )
  SELECT indicator_id, scale,
    sorted_object(breakdown, list_sort(list_distinct(list_transform(cuts, lambda x: round(x, 2))))) AS breaks
  FROM cuts
  GROUP BY ALL;
