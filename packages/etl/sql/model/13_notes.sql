-- Notes shown next to a value (tooltip and table), several joined when they apply together.
CREATE OR REPLACE MACRO decimal_es(x) AS replace(printf('%.1f', x), '.', ',');

INSERT INTO model.observation_note
  SELECT indicator_id, geo, year, breakdown, string_agg(note, ' ' ORDER BY priority)
  FROM (
    -- The Netherlands counts social rent as reduced, not market, since 2021 (cobertura.md).
    SELECT o.indicator_id, o.geo, o.year, o.breakdown, 1 AS priority,
      CASE WHEN o.year >= 2021
        THEN 'Desde 2021, el alquiler social cuenta como reducido y no como de mercado: no es '
          || 'comparable con años anteriores ni con otros países.'
          || coalesce(' Con todos los inquilinos: ' || decimal_es(t.value) || ' %.', '')
        ELSE 'Hasta 2020 incluye el alquiler social, que desde 2021 cuenta como reducido.'
      END AS note
    FROM model.observation AS o
    LEFT JOIN model.observation AS t
      ON t.indicator_id = o.indicator_id AND t.geo = o.geo AND t.year = o.year AND t.breakdown = 'rent'
    WHERE o.indicator_id = 'overburden' AND o.geo = 'NL' AND o.breakdown IN ('rent_mkt', 'rent_fr')

    UNION ALL

    -- A tenure group under 5 % of the population rests on few survey answers.
    SELECT o.indicator_id, o.geo, o.year, o.breakdown, 2,
      'Solo el ' || decimal_es(s.OBS_VALUE) || ' % de la población está en este grupo: '
        || 'estimación con una muestra pequeña.'
    FROM model.observation AS o
    JOIN staging.ilc_lvho02 AS s
      ON s.geo = o.geo AND s.TIME_PERIOD::INT = o.year AND s.tenure = upper(o.breakdown)
    WHERE o.indicator_id = 'overburden'
      AND o.breakdown IN ('rent_mkt', 'rent_fr', 'rent', 'own_l', 'own_nl')
      AND s.OBS_VALUE < 5
  )
  GROUP BY ALL;
