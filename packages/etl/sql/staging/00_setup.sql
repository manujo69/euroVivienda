-- Staging setup. Expects the raw folder in a variable, e.g.
--   SET VARIABLE raw = 'data/raw/2026-09-29';
-- Every later file in this folder can be re-run on its own after this one.

INSTALL spatial;
LOAD spatial;

CREATE SCHEMA IF NOT EXISTS staging;
CREATE SCHEMA IF NOT EXISTS model;

CREATE OR REPLACE MACRO raw_file(name) AS getvariable('raw') || '/' || name;

-- Eurostat SDMX-CSV as published. Everything stays text except the value and the update date:
-- type sniffing reads sex = 'T' as a boolean and whole-number values as integers.
CREATE OR REPLACE MACRO eurostat_csv(dataset) AS TABLE
  SELECT *
  FROM read_csv(
    raw_file(dataset || '.csv.gz'),
    all_varchar = true,
    types = {'OBS_VALUE': 'DOUBLE', 'LAST UPDATE': 'TIMESTAMP'},
    timestampformat = '%d/%m/%y %H:%M:%S'
  );

-- The manifest entry of one raw file, shaped as a source_snapshot row.
CREATE OR REPLACE MACRO snapshot(dataset, row_count) AS TABLE
  SELECT
    f.name AS dataset,
    m.downloadedAt::TIMESTAMP AS downloaded_at,
    f.lastUpdate::TIMESTAMP AS last_update,
    f.file,
    f.sha256,
    row_count::INTEGER AS row_count
  FROM (SELECT downloadedAt, unnest(files) AS f FROM read_json(raw_file('manifest.json'))) AS m
  WHERE f.name = dataset;

-- Lives in model but is filled while loading staging.
CREATE TABLE IF NOT EXISTS model.source_snapshot (
  dataset        VARCHAR NOT NULL,
  downloaded_at  TIMESTAMP NOT NULL,
  last_update    TIMESTAMP,
  file           VARCHAR NOT NULL,
  sha256         VARCHAR NOT NULL,
  row_count      INTEGER
);
