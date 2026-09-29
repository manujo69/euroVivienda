-- Quality checks: each file raises an error (and stops the build) when it finds violations.
-- Unique keys need no check: the primary key of model.observation already rejects duplicates.

SELECT error('indicators without data: ' || string_agg(id, ', ' ORDER BY id))
FROM model.indicator
WHERE id NOT IN (SELECT DISTINCT indicator_id FROM model.observation)
HAVING count(*) > 0;

SELECT error('undeclared breakdowns or categories: ' || string_agg(DISTINCT o.indicator_id || ':' || o.breakdown || '/' || o.category, ', '))
FROM model.observation AS o
JOIN model.indicator AS i ON i.id = o.indicator_id
WHERE NOT list_contains(json_extract_string(i.breakdowns, '$[*].id'), o.breakdown)
  OR (o.category <> '_' AND NOT list_contains(json_extract_string(i.categories, '$[*]'), o.category)
      AND o.category IS DISTINCT FROM i.map_category)
HAVING count(*) > 0;

SELECT error('observations at undeclared levels: ' || string_agg(DISTINCT o.indicator_id || ' ' || g.level, ', '))
FROM model.observation AS o
JOIN model.indicator AS i ON i.id = o.indicator_id
JOIN model.geo AS g ON g.code = o.geo
WHERE NOT list_contains(i.levels, g.level)
HAVING count(*) > 0;
