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
