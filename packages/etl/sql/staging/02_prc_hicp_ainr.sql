CREATE OR REPLACE TABLE staging.prc_hicp_ainr AS SELECT * FROM eurostat_csv('prc_hicp_ainr');

DELETE FROM model.source_snapshot WHERE dataset = 'prc_hicp_ainr';
INSERT INTO model.source_snapshot
  SELECT * FROM snapshot('prc_hicp_ainr', (SELECT count(*) FROM staging.prc_hicp_ainr));
