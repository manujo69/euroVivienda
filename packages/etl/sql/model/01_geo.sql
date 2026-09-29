-- EU-27 countries and NUTS 2 regions (NUTS 2024) plus the EU aggregate.
-- Outermost regions (art. 349 TFEU) stay off the map; Saint-Martin has no NUTS code.
INSERT INTO model.geo
  SELECT
    NUTS_ID,
    LEVL_CODE,
    CNTR_CODE,
    NAME_LATN,
    '2024',
    false,
    NUTS_ID IN ('ES70', 'FRY1', 'FRY2', 'FRY3', 'FRY4', 'FRY5', 'PT20', 'PT30')
  FROM staging.geo_nuts
  WHERE EU_STAT = 'T' AND LEVL_CODE IN (0, 2);

INSERT INTO model.geo VALUES ('EU27_2020', 0, 'EU', 'Unión Europea (UE-27)', '2024', true, false);
