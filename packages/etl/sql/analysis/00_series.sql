-- Coverage analysis (task 0.6). Run after `etl build`:
--   cat packages/etl/sql/analysis/*.sql | duckdb -readonly data/vivienda.duckdb
-- Only temporary views: the database is left untouched.

-- Every catalogue series in long format.
CREATE OR REPLACE TEMP VIEW series AS
  SELECT 'hpi' AS indicator, purchase AS serie, geo, TIME_PERIOD::INT AS year, OBS_VALUE AS value, OBS_FLAG AS flags
    FROM staging.prc_hpi_a
  UNION ALL SELECT 'rent', coicop18, geo, TIME_PERIOD::INT, OBS_VALUE, OBS_FLAG FROM staging.prc_hicp_ainr
  UNION ALL SELECT 'income', unit, geo, TIME_PERIOD::INT, OBS_VALUE, OBS_FLAG FROM staging.nama_10r_2hhinc
  UNION ALL SELECT 'overburden', 'age=' || age, geo, TIME_PERIOD::INT, OBS_VALUE, OBS_FLAG FROM staging.ilc_lvho07a
  UNION ALL SELECT 'overburden', 'tenure=' || tenure, geo, TIME_PERIOD::INT, OBS_VALUE, OBS_FLAG FROM staging.ilc_lvho07c
  UNION ALL SELECT 'tenure', tenure, geo, TIME_PERIOD::INT, OBS_VALUE, OBS_FLAG FROM staging.ilc_lvho02
  UNION ALL SELECT 'emancipation', 'sex=' || sex, geo, TIME_PERIOD::INT, OBS_VALUE, OBS_FLAG FROM staging.yth_demo_030
  UNION ALL SELECT 'unemployment', 'total', geo, TIME_PERIOD::INT, OBS_VALUE, OBS_FLAG FROM staging.lfst_r_lfu3rt
  UNION ALL SELECT 'tourism', 'P_THAB', geo, TIME_PERIOD::INT, OBS_VALUE, OBS_FLAG FROM staging.tour_occ_nin2
  UNION ALL SELECT 'popgrowth', indic_de, geo, TIME_PERIOD::INT, OBS_VALUE, OBS_FLAG FROM staging.demo_r_gind3;

-- EU-27 countries and NUTS 2 regions (NUTS 2024).
CREATE OR REPLACE TEMP VIEW eu_geo AS
  SELECT DISTINCT LEVL_CODE AS level, NUTS_ID AS geo, NUTS_ID IN (
    'ES70', 'FRY1', 'FRY2', 'FRY3', 'FRY4', 'FRY5', 'PT20', 'PT30') AS outermost
  FROM staging.geo_nuts
  WHERE EU_STAT = 'T' AND LEVL_CODE IN (0, 2);

-- Observations with a value, restricted to EU-27 geography or the EU aggregate.
CREATE OR REPLACE TEMP VIEW eu_obs AS
  SELECT s.*, CASE WHEN s.geo = 'EU27_2020' THEN 'EU' WHEN length(s.geo) = 2 THEN 'NUTS0' ELSE 'NUTS2' END AS level
  FROM series AS s
  WHERE s.value IS NOT NULL
    AND (s.geo = 'EU27_2020' OR s.geo IN (SELECT geo FROM eu_geo));
