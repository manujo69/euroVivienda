CREATE OR REPLACE TABLE staging.prc_hpi_a AS SELECT * FROM eurostat_csv('prc_hpi_a');

DELETE FROM model.source_snapshot WHERE dataset = 'prc_hpi_a';
INSERT INTO model.source_snapshot
  SELECT * FROM snapshot('prc_hpi_a', (SELECT count(*) FROM staging.prc_hpi_a));
