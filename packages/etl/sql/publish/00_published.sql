-- What the export turns into JSON: catalog.json, data/[id].json and geo/nuts0.json.
-- Views over the model, so `etl export` can read them from its own session.

CREATE SCHEMA IF NOT EXISTS publish;

-- Indicators on the website. Milestone 1: one scalar and the composition (spec.md, «Hitos»).
CREATE OR REPLACE TABLE publish.published AS
  SELECT unnest(['overburden', 'tenure']) AS indicator_id;

-- json_group_object with keys in order, so the versioned JSON only changes when the data does.
CREATE OR REPLACE MACRO sorted_object(k, v) AS to_json(map(list(k ORDER BY k), list(v ORDER BY k)));
