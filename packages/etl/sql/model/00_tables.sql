-- Model tables (spec.md, «Modelo de datos»). Rebuilt from scratch on every run;
-- source_snapshot is created by staging/00_setup.sql, which fills it.

SET VARIABLE first_year = 2015;
SET VARIABLE final_year = 2025;

DROP TABLE IF EXISTS model.observation_note;
DROP TABLE IF EXISTS model.observation;
DROP TABLE IF EXISTS model.indicator;
DROP TABLE IF EXISTS model.geo;

CREATE TABLE model.geo (
  code          VARCHAR PRIMARY KEY,   -- 'ES', 'ES61', 'EU27_2020'
  level         TINYINT NOT NULL,      -- 0 país, 2 región
  country       VARCHAR NOT NULL,
  name          VARCHAR NOT NULL,
  nuts_version  VARCHAR NOT NULL,
  is_aggregate  BOOLEAN NOT NULL DEFAULT false,
  is_outermost  BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE model.indicator (
  id             VARCHAR PRIMARY KEY,  -- 'hpi', 'overburden'
  label          VARCHAR NOT NULL,
  theme          VARCHAR NOT NULL,     -- prices | access | context
  kind           VARCHAR NOT NULL,     -- scalar | index | composition | derived
  unit           VARCHAR NOT NULL,
  levels         TINYINT[] NOT NULL,   -- [0] o [0, 2]
  breakdowns     JSON NOT NULL,        -- [{id, label}], el primero es el de por defecto
  categories     JSON,                 -- solo composition: porciones del pastel
  source_code    VARCHAR NOT NULL,
  source_filter  JSON,
  map_category   VARCHAR,
  notes          VARCHAR
);

CREATE TABLE model.observation (
  indicator_id  VARCHAR NOT NULL REFERENCES model.indicator (id),
  geo           VARCHAR NOT NULL REFERENCES model.geo (code),
  year          SMALLINT NOT NULL,
  breakdown     VARCHAR NOT NULL DEFAULT 'total',
  category      VARCHAR NOT NULL DEFAULT '_',
  value         DOUBLE,
  flags         VARCHAR,
  PRIMARY KEY (indicator_id, geo, year, breakdown, category)
);

-- Explanation of one value shown with it (small sample, change of definition).
CREATE TABLE model.observation_note (
  indicator_id  VARCHAR NOT NULL,
  geo           VARCHAR NOT NULL,
  year          SMALLINT NOT NULL,
  breakdown     VARCHAR NOT NULL,
  note          VARCHAR NOT NULL,
  PRIMARY KEY (indicator_id, geo, year, breakdown)
);

-- Staging rows the model keeps: EU-27 geography or aggregate, a value, and a year in range.
CREATE OR REPLACE MACRO keep(geo, year, value) AS
  value IS NOT NULL
  AND year::INT BETWEEN getvariable('first_year') AND getvariable('final_year')
  AND geo IN (SELECT code FROM model.geo);

-- Distinct flag letters of two observations, sorted: 'p' + 'e' -> 'ep'.
CREATE OR REPLACE MACRO merge_flags(a, b) AS
  nullif(array_to_string(list_sort(list_distinct(string_split(coalesce(a, '') || coalesce(b, ''), ''))), ''), '');
