// JSON contract between the ETL and the app (spec.md, «Contrato JSON»): catalog.json lists the
// indicators, data/[id].json holds each one's values. The app imports only the types.

import { z } from 'zod';

const id = z.string().regex(/^[a-z][a-z0-9_]*$/);
const year = z.int().min(1900).max(2100);
/** Eurostat flags, alone or combined: e, p, b, u, c, d, n. */
const flags = z.string().regex(/^[bcdenpu]+$/);

export const indicatorMetaSchema = z
  .strictObject({
    id,
    label: z.string().min(1),
    theme: z.enum(['prices', 'access', 'context']),
    kind: z.enum(['scalar', 'index', 'composition', 'derived']),
    unit: z.string().min(1),
    levels: z.array(z.union([z.literal(0), z.literal(2)])).min(1),
    years: z.tuple([year, year]),
    source: z.strictObject({
      name: z.string().min(1),
      code: z.string().min(1),
      url: z.url(),
      lastUpdate: z.iso.date(),
    }),
    /** The first one is the default. */
    breakdowns: z.array(z.strictObject({ id, label: z.string().min(1) })).min(1),
    /** Composition only: the slices of the pie. */
    categories: z.array(id).min(1).optional(),
    /** Composition only: the category the map paints, possibly a total of several categories. */
    mapCategory: id.optional(),
    scale: z.enum(['sequential', 'diverging']),
    /** Fixed class breaks per breakdown, over the whole series. */
    breaks: z.record(z.string(), z.array(z.number()).min(1)),
    notes: z.string().min(1).optional(),
  })
  .superRefine((meta, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: 'custom', message });
    if (meta.years[0] > meta.years[1]) fail('years must go from first to last');
    const ids = meta.breakdowns.map((breakdown) => breakdown.id);
    for (const repeated of new Set(ids.filter((breakdown, i) => ids.indexOf(breakdown) !== i))) {
      fail(`repeated breakdown id: ${repeated}`);
    }
    const composition = meta.kind === 'composition';
    const hasCategories = meta.categories !== undefined || meta.mapCategory !== undefined;
    if (composition && (!meta.categories || !meta.mapCategory)) {
      fail('composition needs categories and mapCategory');
    }
    if (!composition && hasCategories) fail('only compositions have categories or mapCategory');
    const keys = Object.keys(meta.breaks);
    if (keys.length !== ids.length || !ids.every((breakdown) => keys.includes(breakdown))) {
      fail(`breaks must cover exactly the breakdowns: ${ids.join(', ')}`);
    }
    for (const [breakdown, values] of Object.entries(meta.breaks)) {
      if (values.some((value, i) => i > 0 && value <= (values[i - 1] ?? value))) {
        fail(`breaks of ${breakdown} must be ascending`);
      }
    }
  });

export type IndicatorMeta = z.infer<typeof indicatorMetaSchema>;
export type IndicatorKind = IndicatorMeta['kind'];

/** catalog.json */
export const catalogSchema = z.array(indicatorMetaSchema).superRefine((catalog, ctx) => {
  const ids = catalog.map((meta) => meta.id);
  for (const repeated of new Set(ids.filter((indicator, i) => ids.indexOf(indicator) !== i))) {
    ctx.addIssue({ code: 'custom', message: `repeated indicator id: ${repeated}` });
  }
});

export type Catalog = z.infer<typeof catalogSchema>;

const cell = z.strictObject({
  /** A number, or the share of each category in a composition. */
  v: z.union([z.number(), z.record(id, z.number())]),
  f: flags.optional(),
});

const dataShape = z.record(
  z.string().min(1), // geo code
  z.record(z.string().regex(/^\d{4}$/), z.record(z.string(), cell)),
);

export type IndicatorData = z.infer<typeof dataShape>;

/** data/[id].json, checked against the indicator it belongs to. */
export function indicatorDataSchema(meta: IndicatorMeta) {
  const breakdowns = new Set(meta.breakdowns.map((breakdown) => breakdown.id));
  const categories = new Set(meta.categories);
  if (meta.mapCategory) categories.add(meta.mapCategory);
  const composition = meta.kind === 'composition';
  const [first, last] = meta.years;

  return dataShape.superRefine((data, ctx) => {
    const fail = (message: string, path: string[]) =>
      ctx.addIssue({ code: 'custom', message, path });
    for (const [geo, years] of Object.entries(data)) {
      for (const [key, cells] of Object.entries(years)) {
        if (Number(key) < first || Number(key) > last) {
          fail(`year outside ${first}–${last}: ${key}`, [geo, key]);
        }
        for (const [breakdown, { v }] of Object.entries(cells)) {
          const path = [geo, key, breakdown];
          if (!breakdowns.has(breakdown)) fail(`undeclared breakdown: ${breakdown}`, path);
          if (!composition && typeof v !== 'number') fail('value must be a number', path);
          if (composition && typeof v === 'number') {
            fail('value must be a record of categories', path);
          }
          if (typeof v === 'object') {
            for (const category of Object.keys(v)) {
              if (!categories.has(category)) fail(`unknown category: ${category}`, path);
            }
          }
        }
      }
    }
  });
}
