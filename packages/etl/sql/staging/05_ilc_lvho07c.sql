CREATE OR REPLACE TABLE staging.ilc_lvho07c AS SELECT * FROM eurostat_csv('ilc_lvho07c');

DELETE FROM model.source_snapshot WHERE dataset = 'ilc_lvho07c';
INSERT INTO model.source_snapshot
  SELECT * FROM snapshot('ilc_lvho07c', (SELECT count(*) FROM staging.ilc_lvho07c));
