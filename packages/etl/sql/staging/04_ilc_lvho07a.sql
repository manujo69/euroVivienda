CREATE OR REPLACE TABLE staging.ilc_lvho07a AS SELECT * FROM eurostat_csv('ilc_lvho07a');

DELETE FROM model.source_snapshot WHERE dataset = 'ilc_lvho07a';
INSERT INTO model.source_snapshot
  SELECT * FROM snapshot('ilc_lvho07a', (SELECT count(*) FROM staging.ilc_lvho07a));
