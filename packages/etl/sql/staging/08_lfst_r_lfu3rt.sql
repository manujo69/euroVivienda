CREATE OR REPLACE TABLE staging.lfst_r_lfu3rt AS SELECT * FROM eurostat_csv('lfst_r_lfu3rt');

DELETE FROM model.source_snapshot WHERE dataset = 'lfst_r_lfu3rt';
INSERT INTO model.source_snapshot
  SELECT * FROM snapshot('lfst_r_lfu3rt', (SELECT count(*) FROM staging.lfst_r_lfu3rt));
