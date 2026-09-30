-- What the export turns into JSON: catalog.json, data/[id].json, geo/nuts0.json and geo/nuts2.json.
-- Views over the model, so `etl export` can read them from its own session.

CREATE SCHEMA IF NOT EXISTS publish;

-- Indicators on the website, in catalogue order. The app opens on the first one when the URL
-- names none; the catalogue groups them by theme, where the order is that of spec.md.
CREATE OR REPLACE TABLE publish.published AS
  SELECT * FROM (VALUES
    (1, 'overburden'),
    (2, 'hpi'),
    (3, 'rent'),
    (4, 'price_income'),
    (5, 'tenure'),
    (6, 'emancipation'),
    (7, 'unemployment'),
    (8, 'income'),
    (9, 'tourism'),
    (10, 'popgrowth')
  ) AS t(position, indicator_id);

-- json_group_object with keys in order, so the versioned JSON only changes when the data does.
CREATE OR REPLACE MACRO sorted_object(k, v) AS to_json(map(list(k ORDER BY k), list(v ORDER BY k)));
