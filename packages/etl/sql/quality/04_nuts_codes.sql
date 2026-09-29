-- NUTS 2 codes of EU countries that the model dropped for lacking a geometry, in the latest year of
-- each regional series. Old codes in earlier years are expected (cobertura.md); in the latest year
-- they mean Eurostat moved to a new NUTS version. Extra-regio codes (ZZ) are not regions.
SELECT error('codes without geometry in the latest year: ' || string_agg(DISTINCT dataset || ' ' || geo, ', '))
FROM (
  SELECT 'lfst_r_lfu3rt' AS dataset, geo, TIME_PERIOD FROM staging.lfst_r_lfu3rt
  UNION ALL SELECT 'nama_10r_2hhinc', geo, TIME_PERIOD FROM staging.nama_10r_2hhinc WHERE TIME_PERIOD::INT <= 2023
  UNION ALL SELECT 'tour_occ_nin2', geo, TIME_PERIOD FROM staging.tour_occ_nin2
  UNION ALL SELECT 'demo_r_gind3', geo, TIME_PERIOD FROM staging.demo_r_gind3
) AS s
WHERE length(geo) = 4 AND geo NOT LIKE '%ZZ'
  AND substr(geo, 1, 2) IN (SELECT code FROM model.geo WHERE level = 0 AND NOT is_aggregate)
  AND geo NOT IN (SELECT code FROM model.geo)
  AND TIME_PERIOD = (SELECT max(TIME_PERIOD) FROM (
    SELECT 'lfst_r_lfu3rt' AS dataset, TIME_PERIOD FROM staging.lfst_r_lfu3rt
    UNION ALL SELECT 'nama_10r_2hhinc', TIME_PERIOD FROM staging.nama_10r_2hhinc WHERE TIME_PERIOD::INT <= 2023
    UNION ALL SELECT 'tour_occ_nin2', TIME_PERIOD FROM staging.tour_occ_nin2
    UNION ALL SELECT 'demo_r_gind3', TIME_PERIOD FROM staging.demo_r_gind3
  ) AS t WHERE t.dataset = s.dataset)
HAVING count(*) > 0;
