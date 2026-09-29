CREATE OR REPLACE TABLE staging.nama_10r_2hhinc AS SELECT * FROM eurostat_csv('nama_10r_2hhinc');

DELETE FROM model.source_snapshot WHERE dataset = 'nama_10r_2hhinc';
INSERT INTO model.source_snapshot
  SELECT * FROM snapshot('nama_10r_2hhinc', (SELECT count(*) FROM staging.nama_10r_2hhinc));
