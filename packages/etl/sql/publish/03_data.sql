-- One IndicatorData per published indicator: geo -> year -> breakdown -> {v, f, n}.
-- v is a number, or {category: share} in compositions; f and n only when there are flags or a note.
CREATE OR REPLACE VIEW publish.data AS
  WITH cells AS (
    SELECT o.indicator_id, o.geo, o.year, o.breakdown,
      CASE WHEN i.kind = 'composition'
        THEN sorted_object(o.category, round(o.value, 2))
        ELSE to_json(round(any_value(o.value), 2))
      END AS v,
      merge_flags(string_agg(o.flags, ''), NULL) AS f
    FROM model.observation AS o
    JOIN model.indicator AS i ON i.id = o.indicator_id
    WHERE o.indicator_id IN (SELECT indicator_id FROM publish.published)
    GROUP BY o.indicator_id, o.geo, o.year, o.breakdown, i.kind
  ),
  years AS (
    SELECT c.indicator_id, c.geo, c.year,
      sorted_object(c.breakdown, json_merge_patch('{}', json_object('v', c.v, 'f', c.f, 'n', n.note)))
        AS breakdowns
    FROM cells AS c
    LEFT JOIN model.observation_note AS n USING (indicator_id, geo, year, breakdown)
    GROUP BY ALL
  ),
  geos AS (
    SELECT indicator_id, geo, sorted_object(year::VARCHAR, breakdowns) AS years
    FROM years
    GROUP BY ALL
  )
  SELECT indicator_id, sorted_object(geo, years) AS data
  FROM geos
  GROUP BY ALL;
