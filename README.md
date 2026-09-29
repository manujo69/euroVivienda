# EuroVivienda

Portal estadístico y geográfico sobre el acceso a la vivienda en la UE-27. El usuario activa indicadores de Eurostat, ve el principal sobre un mapa coroplético de Europa y el resto como gráficos sincronizados (líneas, barras, pastel y dispersión).

> Nombre provisional. Proyecto en fase inicial: ver [Estado](#estado).

## Qué ofrece el MVP

- UE-27 en dos niveles: país (NUTS 0) y región (NUTS 2).
- Serie temporal desde 2015 hasta el último año disponible, con selector de año global.
- Nueve indicadores documentados y comparables, más uno opcional.
- Estado compartible: indicadores activos, región, año, nivel y desgloses viven en la URL.
- Accesibilidad desde el primer mapa: paletas aptas para daltonismo y tabla alternativa navegable por teclado.
- Página «Sobre los datos» con fuentes, metodología y limitaciones.

Las relaciones entre indicadores se presentan como descriptivas, nunca causales.

## Indicadores

| Tema | Indicador | Fuente (Eurostat) | Nivel |
| --- | --- | --- | --- |
| Precios | Variación del precio de la vivienda | `prc_hpi_a` | País |
| Precios | Variación del alquiler | `prc_hicp_ainr` (CP0411) | País |
| Precios | Precio de la vivienda frente a renta | `prc_hpi_a` ÷ `nama_10r_2hhinc` | País |
| Acceso | Sobrecarga por coste de vivienda | `ilc_lvho07a`, `ilc_lvho07c` | País |
| Acceso | Régimen de tenencia | `ilc_lvho02` | País |
| Acceso | Edad media de emancipación | `yth_demo_030` | País |
| Contexto | Tasa de paro | `lfst_r_lfu3rt` | País + NUTS 2 |
| Contexto | Renta disponible de los hogares por habitante | `nama_10r_2hhinc` | País + NUTS 2 |
| Contexto | Intensidad turística (noches por habitante) | `tour_occ_nin2` (P_THAB) | País + NUTS 2 |
| Contexto | Crecimiento de la población (opcional) | `demo_r_gind3` | País + NUTS 2 |

Los índices se rebasan a 2015 = 100. El indicador derivado (precio frente a renta) se marca como «elaboración propia». Solo se usan fuentes oficiales y abiertas; las geometrías proceden de GISCO.

## Arquitectura

No hay backend en tiempo de ejecución. Un ETL mensual descarga Eurostat y GISCO, consolida los datos en DuckDB y publica JSON y TopoJSON estáticos que lee el frontend.

```text
Eurostat / GISCO
      │  etl download
      ▼
data/raw/AAAA-MM-DD/     descargas crudas + manifiesto (no versionadas)
      │  etl build
      ▼
vivienda.duckdb          staging → model → publish (reconstruible, no versionada)
      │  exportación (solo si pasan los tests de calidad)
      ▼
JSON + TopoJSON          versionados; los consume la app Angular
```

Las transformaciones están en ficheros `.sql` numerados y ejecutables con la CLI de DuckDB. Node solo orquesta.

**Stack previsto**

- Monorepo con pnpm workspaces: `packages/contract` (tipos del contrato JSON y validador), `packages/etl` (Node + TypeScript con `@duckdb/node-api`) y `apps/angular`.
- Angular con componentes standalone y signals, en arquitectura hexagonal simplificada (`domain`, `application`, `infrastructure`, `ui`).
- Apache ECharts con `ngx-echarts`, sobre geometrías ya proyectadas en EPSG:3035.
- Publicación mensual con GitHub Actions y despliegue en Vercel.

## Estado

El monorepo pnpm ya está montado. `apps/angular` sigue siendo la app base de Angular CLI 20 (SSR con prerenderizado y tests con Karma); `packages/contract` y `packages/etl` son esqueletos con TypeScript estricto, ESLint y Vitest. El trabajo en curso es el hito 0.

Hitos:

0. Fuentes y base de datos
1. ETL mínimo
2. Mapa
3. Catálogo y panel
4. Año, NUTS 2, desgloses y URL
5. Resto del catálogo
6. Pulido

## Desarrollo

Requisitos: Node.js 22.18 o posterior, pnpm 12 y la [CLI de DuckDB](https://duckdb.org/docs/installation/).

```bash
pnpm install
pnpm start                                  # http://localhost:4200/
pnpm build                                  # build de todos los paquetes
pnpm test                                   # tests de todos los paquetes (una sola pasada)
pnpm typecheck                              # comprobación de tipos
pnpm lint                                   # ESLint sobre packages/
pnpm --filter @eurovivienda/etl test        # tests de un solo paquete
```

## Documentación

- [spec.md](spec.md): especificación completa del MVP (catálogo, experiencia de usuario, modelo de datos, contrato JSON, riesgos y decisiones).
- [tasks.md](tasks.md): hitos y tareas.
- [CLAUDE.md](CLAUDE.md): convenciones del proyecto para agentes de código.
