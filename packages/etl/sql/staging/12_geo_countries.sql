-- GISCO countries, as published (EPSG:3035): grey context for non-EU countries.
CREATE OR REPLACE TABLE staging.geo_countries AS
  SELECT * FROM ST_Read(raw_file('CNTR_RG_20M_2024_3035.geojson'));

DELETE FROM model.source_snapshot WHERE dataset = 'CNTR_RG_20M_2024_3035';
INSERT INTO model.source_snapshot
  SELECT * FROM snapshot('CNTR_RG_20M_2024_3035', (SELECT count(*) FROM staging.geo_countries));
