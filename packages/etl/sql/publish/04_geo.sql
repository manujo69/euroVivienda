-- EU-27 countries as a GeoJSON FeatureCollection (EPSG:3035), with the outermost regions clipped
-- out of Spain, France and Portugal: they stay off the map (spec.md, «Mapa»). The export turns it
-- into TopoJSON with mapshaper.
CREATE OR REPLACE VIEW publish.geo_nuts0 AS
  WITH outermost AS (
    SELECT ST_Union_Agg(n.geom) AS geom
    FROM staging.geo_nuts AS n
    JOIN model.geo AS g ON g.code = n.NUTS_ID
    WHERE g.is_outermost
  )
  SELECT json_object(
    'type', 'FeatureCollection',
    'features', to_json(list(json_object(
      'type', 'Feature',
      'properties', json_object('code', n.NUTS_ID),
      'geometry', ST_AsGeoJSON(coalesce(ST_Difference(n.geom, o.geom), n.geom))::JSON
    ) ORDER BY n.NUTS_ID))
  ) AS geojson
  FROM staging.geo_nuts AS n
  JOIN model.geo AS g ON g.code = n.NUTS_ID
  CROSS JOIN outermost AS o
  WHERE g.level = 0 AND NOT g.is_aggregate;

-- EU NUTS 2 regions as a GeoJSON FeatureCollection (EPSG:3035), named in Latin script: the app
-- only knows the names of countries. The outermost regions are NUTS 2 regions themselves: they
-- stay off the map, as in NUTS 0.
CREATE OR REPLACE VIEW publish.geo_nuts2 AS
  SELECT json_object(
    'type', 'FeatureCollection',
    'features', to_json(list(json_object(
      'type', 'Feature',
      'properties', json_object('code', n.NUTS_ID, 'name', n.NAME_LATN),
      'geometry', ST_AsGeoJSON(n.geom)::JSON
    ) ORDER BY n.NUTS_ID))
  ) AS geojson
  FROM staging.geo_nuts AS n
  JOIN model.geo AS g ON g.code = n.NUTS_ID
  WHERE g.level = 2 AND NOT g.is_aggregate AND NOT g.is_outermost;

-- Non-EU countries around the EU, drawn in grey without interaction (spec.md, «Mapa»): GISCO
-- countries outside the EU, cut at a frame 300 km beyond the EU countries shown on the map.
CREATE OR REPLACE VIEW publish.geo_context AS
  WITH outermost AS (
    SELECT ST_Union_Agg(n.geom) AS geom
    FROM staging.geo_nuts AS n
    JOIN model.geo AS g ON g.code = n.NUTS_ID
    WHERE g.is_outermost
  ),
  frame AS (
    SELECT ST_Envelope(ST_Buffer(ST_Envelope(ST_Union_Agg(coalesce(ST_Difference(n.geom, o.geom), n.geom))), 300000)) AS geom
    FROM staging.geo_nuts AS n
    JOIN model.geo AS g ON g.code = n.NUTS_ID
    CROSS JOIN outermost AS o
    WHERE g.level = 0 AND NOT g.is_aggregate
  ),
  cut AS (
    SELECT c.CNTR_ID AS code, ST_Intersection(c.geom, f.geom) AS geom
    FROM staging.geo_countries AS c
    CROSS JOIN frame AS f
    WHERE c.EU_STAT = 'F' AND ST_Intersects(c.geom, f.geom)
  )
  SELECT json_object(
    'type', 'FeatureCollection',
    'features', to_json(list(json_object(
      'type', 'Feature',
      'properties', json_object('code', code),
      'geometry', ST_AsGeoJSON(geom)::JSON
    ) ORDER BY code))
  ) AS geojson
  FROM cut
  WHERE NOT ST_IsEmpty(geom);
