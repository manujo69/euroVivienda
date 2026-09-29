-- One IndicatorMeta per published indicator. json_merge_patch drops the null keys
-- (categories, mapCategory, notes), which the contract leaves out rather than nulls.
CREATE OR REPLACE VIEW publish.catalog AS
  SELECT
    i.id AS indicator_id,
    json_merge_patch('{}', json_object(
      'id', i.id,
      'label', i.label,
      'theme', i.theme,
      'kind', i.kind,
      'unit', i.unit,
      'levels', i.levels,
      'years', [y.first_year, y.last_year],
      'source', json_object(
        'name', 'Eurostat',
        'code', i.source_code,
        'url', 'https://ec.europa.eu/eurostat/databrowser/view/'
          || trim(split_part(i.source_code, ',', 1)) || '/default/table',
        'lastUpdate', strftime((
          SELECT max(s.last_update) FROM model.source_snapshot AS s
          WHERE list_contains(list_transform(string_split(i.source_code, ','), lambda c: trim(c)), s.dataset)
        ), '%Y-%m-%d')),
      'breakdowns', i.breakdowns,
      'categories', i.categories,
      'mapCategory', i.map_category,
      'scale', b.scale,
      'breaks', b.breaks,
      'notes', i.notes
    )) AS meta
  FROM model.indicator AS i
  JOIN publish.published AS p ON p.indicator_id = i.id
  JOIN publish.breaks AS b ON b.indicator_id = i.id
  JOIN (
    SELECT indicator_id, min(year) AS first_year, max(year) AS last_year
    FROM model.observation GROUP BY ALL
  ) AS y ON y.indicator_id = i.id;
