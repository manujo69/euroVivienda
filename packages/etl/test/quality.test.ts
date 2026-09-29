import { describe, expect, it } from 'vitest';
import { cleanData, rows, withModel } from './staging-fixture.ts';
import type { Row } from './staging-fixture.ts';

const quality = (data: Record<string, Row[]>) =>
  withModel(data, ['model', 'quality'], (connection) =>
    rows(connection, 'SELECT count(*)::INTEGER AS n FROM model.observation'),
  );

function withRows(code: string, extra: Row[]): Record<string, Row[]> {
  const data = cleanData();
  return { ...data, [code]: [...(data[code] ?? []), ...extra] };
}

describe('quality checks', () => {
  it('pass on clean data', async () => {
    const [{ n }] = (await quality(cleanData())) as [{ n: number }];
    expect(n).toBeGreaterThan(0);
  });

  it('fail on values outside the plausible range of the indicator', async () => {
    const data = withRows('lfst_r_lfu3rt', [{ geo: 'ES', TIME_PERIOD: '2017', OBS_VALUE: 140 }]);
    await expect(quality(data)).rejects.toThrow(/values out of range.*unemployment ES 2017/);
  });

  it('fail when an indicator loses countries in its latest year', async () => {
    const data = {
      ...cleanData(),
      yth_demo_030: [{ geo: 'EU27_2020', sex: 'T', TIME_PERIOD: '2016', OBS_VALUE: 26 }],
    };
    await expect(quality(data)).rejects.toThrow(/countries without data.*emancipation/);
  });

  it('fail when a regional indicator loses regions in its latest year', async () => {
    const data = withRows('lfst_r_lfu3rt', [
      { geo: 'ES', TIME_PERIOD: '2017', OBS_VALUE: 17 },
      { geo: 'ES30', TIME_PERIOD: '2017', OBS_VALUE: 15 },
    ]);
    await expect(quality(data)).rejects.toThrow(/regions without data.*unemployment 2017/);
  });

  it('fail when the latest year of a series uses NUTS codes without geometry', async () => {
    const data = withRows('tour_occ_nin2', [{ geo: 'ES31', TIME_PERIOD: '2016', OBS_VALUE: 4000 }]);
    await expect(quality(data)).rejects.toThrow(/codes without geometry.*tour_occ_nin2 ES31/);
  });

  it('ignore old NUTS codes in earlier years and extra-regio codes', async () => {
    const data = withRows('tour_occ_nin2', [
      { geo: 'ES31', TIME_PERIOD: '2015', OBS_VALUE: 4000 },
      { geo: 'ESZZ', TIME_PERIOD: '2016', OBS_VALUE: 1 },
    ]);
    await expect(quality(data)).resolves.toBeDefined();
  });

  it('fail when an indicator has no observations', async () => {
    const data = { ...cleanData(), prc_hicp_ainr: [] };
    await expect(quality(data)).rejects.toThrow(/indicators without data: rent/);
  });
});
