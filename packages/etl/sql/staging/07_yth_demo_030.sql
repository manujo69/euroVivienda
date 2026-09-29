CREATE OR REPLACE TABLE staging.yth_demo_030 AS SELECT * FROM eurostat_csv('yth_demo_030');

DELETE FROM model.source_snapshot WHERE dataset = 'yth_demo_030';
INSERT INTO model.source_snapshot
  SELECT * FROM snapshot('yth_demo_030', (SELECT count(*) FROM staging.yth_demo_030));
