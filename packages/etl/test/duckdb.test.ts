import { DuckDBInstance } from '@duckdb/node-api';
import { describe, expect, it } from 'vitest';

describe('DuckDB', () => {
  it('loads the httpfs and spatial extensions', async () => {
    const instance = await DuckDBInstance.create(':memory:');
    const connection = await instance.connect();
    try {
      await connection.run('INSTALL httpfs; LOAD httpfs; INSTALL spatial; LOAD spatial;');
      const reader = await connection.runAndReadAll(
        "SELECT extension_name FROM duckdb_extensions() WHERE loaded AND extension_name IN ('httpfs', 'spatial') ORDER BY 1",
      );
      expect(reader.getRowObjects()).toEqual([
        { extension_name: 'httpfs' },
        { extension_name: 'spatial' },
      ]);
    } finally {
      connection.closeSync();
      instance.closeSync();
    }
  });
});
