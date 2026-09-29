CREATE OR REPLACE TABLE staging.demo_r_gind3 AS SELECT * FROM eurostat_csv('demo_r_gind3');

DELETE FROM model.source_snapshot WHERE dataset = 'demo_r_gind3';
INSERT INTO model.source_snapshot
  SELECT * FROM snapshot('demo_r_gind3', (SELECT count(*) FROM staging.demo_r_gind3));
