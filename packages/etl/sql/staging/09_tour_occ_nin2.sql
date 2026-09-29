CREATE OR REPLACE TABLE staging.tour_occ_nin2 AS SELECT * FROM eurostat_csv('tour_occ_nin2');

DELETE FROM model.source_snapshot WHERE dataset = 'tour_occ_nin2';
INSERT INTO model.source_snapshot
  SELECT * FROM snapshot('tour_occ_nin2', (SELECT count(*) FROM staging.tour_occ_nin2));
