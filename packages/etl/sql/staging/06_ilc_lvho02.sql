CREATE OR REPLACE TABLE staging.ilc_lvho02 AS SELECT * FROM eurostat_csv('ilc_lvho02');

DELETE FROM model.source_snapshot WHERE dataset = 'ilc_lvho02';
INSERT INTO model.source_snapshot
  SELECT * FROM snapshot('ilc_lvho02', (SELECT count(*) FROM staging.ilc_lvho02));
