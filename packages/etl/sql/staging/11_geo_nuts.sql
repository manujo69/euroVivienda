-- GISCO NUTS 2024, levels 0 and 2, as published (EPSG:3035).
CREATE OR REPLACE TABLE staging.geo_nuts AS
  SELECT * FROM ST_Read(raw_file('NUTS_RG_20M_2024_3035_LEVL_0.geojson'))
  UNION ALL BY NAME
  SELECT * FROM ST_Read(raw_file('NUTS_RG_20M_2024_3035_LEVL_2.geojson'));

DELETE FROM model.source_snapshot WHERE dataset LIKE 'NUTS_RG_20M_%';
INSERT INTO model.source_snapshot
  SELECT * FROM snapshot('NUTS_RG_20M_2024_3035_LEVL_0',
    (SELECT count(*) FROM staging.geo_nuts WHERE LEVL_CODE = 0))
  UNION ALL
  SELECT * FROM snapshot('NUTS_RG_20M_2024_3035_LEVL_2',
    (SELECT count(*) FROM staging.geo_nuts WHERE LEVL_CODE = 2));
