# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# EuroVivienda

Portal estadístico y geográfico sobre el acceso a la vivienda en la UE-27 (nombre provisional). Mapa coroplético + gráficos sincronizados sobre indicadores de Eurostat, servidos como JSON estático.

- Especificación completa: `spec.md`
- Hitos y tareas: `tasks.md` (marca las tareas al terminarlas)

Idioma del proyecto: la interfaz y la documentación en español; el código (identificadores, commits) en inglés.

## Estado actual

- `apps/angular` (Angular 20, hito 4 terminado): catálogo por temas a la izquierda, mapa coroplético del indicador principal con leyenda, tooltip, tabla alternativa y contexto no UE, y panel de tarjetas a la derecha (escalar, índice, composición y derivado; máximo cuatro abiertas, con selector de desglose) y tarjeta de dispersión con r (`domain/scatter.ts`). La selección de región se comparte entre mapa, tabla y tarjetas (ranking y barras). Selector de año en la cabecera con fallback por indicador. Todo el estado compartible vive en la URL (`domain/url-state.ts`, `UrlStatePort` sobre el router). Nivel NUTS 2 solo con un indicador principal regional (`levelOf`, `selectionAt`, `valuesByGeo` por nivel; nombres de región desde `geo/nuts2.json`). SSR activado (`outputMode: "server"`, todas las rutas en `RenderMode.Prerender`), pero los datos se cargan solo en el navegador (`afterNextRender`). Tests con Karma + Jasmine en ChromeHeadless (define `CHROME_BIN` si Karma no encuentra Chrome).
- El mapa y los gráficos de las tarjetas van en bloques `@defer` (las tarjetas `on viewport`, con `@placeholder`: en móvil no se crean en una pestaña oculta): ECharts (~500 KB) queda fuera del bundle inicial. En móvil (`ui/shell/viewport.service.ts`, < 768 px) la app usa pestañas. ECharts se importa por piezas en `ui/map/echarts.ts` (mapa; regiones UE y contexto se registran juntos como el mapa `nuts0`) y `ui/charts/echarts.ts` (líneas, pastel y barras). En los tests de componentes con `@defer`, espera a los bloques (`getDeferBlocks` + `DeferBlockState.Complete`): Jasmine ordena los tests al azar.
- `packages/contract` tiene los esquemas Zod del contrato; `packages/etl` cubre el hito 0: catálogos de fuentes y geometrías, `download`, `build` (staging, modelo, calidad y publicación) y `export`, que publica los diez indicadores (en el orden de `publish.published`: el primero, `overburden`, es el de inicio de la app) y los TopoJSON NUTS 0 y NUTS 2, cada uno con la capa `context` de países no UE (presupuestos de 80 y 130 KB). Los indicadores regionales incluyen sus regiones NUTS 2 en `data/[id].json`. Ambos con TypeScript estricto, ESLint con tipos y Vitest.

## Comandos

Desde la raíz (pnpm 12, Node ≥ 22.18):

- `pnpm install`
- `pnpm start`: servidor de desarrollo de Angular en `http://localhost:4200/`. Si tras mover carpetas o cambiar dependencias la página no refleja el código (o el log muestra «There is a new version of the pre-bundle»), reinícialo.
- `pnpm build`, `pnpm test`, `pnpm typecheck`: en todos los paquetes (`pnpm test` corre Karma en una sola pasada).
- `pnpm lint`: ESLint sobre `packages/` y `apps/angular/src` (fronteras de capas incluidas).
- `pnpm etl download`: descarga cruda de Eurostat y GISCO en `data/raw/AAAA-MM-DD/`.
- `pnpm etl build`: borra y reconstruye `data/vivienda.duckdb` desde la última descarga completa; falla si no pasa algún test de calidad.
- Workflow mensual (`.github/workflows/monthly-data.yml`): tests, `download`, `build` y `export`; si cambian los datos, abre un PR. En CI, pnpm falla con builds ignorados: `better-sqlite3` (dependencia de mapshaper) está denegado en `allowBuilds`.
- `pnpm etl export`: escribe `catalog.json`, `data/[id].json`, `geo/nuts0.json` y `geo/nuts2.json` en `apps/angular/public/` (versionados); falla sin escribir nada si algo no cumple el contrato o el presupuesto de tamaño.
- SQL desde la CLI de DuckDB: `cat packages/etl/sql/staging/*.sql | duckdb -cmd "SET VARIABLE raw = 'data/raw/AAAA-MM-DD';"` (con `ATTACH '<fichero>' (STORAGE_VERSION 'latest')` si quieres persistirlo).
- Un paquete: `pnpm --filter @eurovivienda/etl test` (o `contract`, `angular`).
- Un solo test con Vitest: `pnpm --filter @eurovivienda/etl exec vitest run test/duckdb.test.ts`.
- Un solo test con Karma: `pnpm --filter @eurovivienda/angular exec ng test --watch=false --include src/app/app.spec.ts`.
- Karma en watch: `pnpm --filter @eurovivienda/angular test:watch`.

Los paquetes Node se ejecutan con *type stripping* (sin compilar): importa con extensión `.ts`, usa `import type` y evita `enum`, `namespace` y propiedades de parámetro. La configuración común está en `tsconfig.base.json`.

pnpm respeta una antigüedad mínima de versiones: no añadas excepciones en `minimumReleaseAgeExclude`; fija una versión anterior. Los paquetes con scripts de instalación se aprueban en `allowBuilds` de `pnpm-workspace.yaml`.

Formato: Prettier con `printWidth: 100` y comillas simples (config en el `package.json` raíz).

## Estructura

Monorepo con pnpm workspaces:

- `packages/contract` — contrato JSON como esquemas Zod 4 (`indicatorMetaSchema`, `catalogSchema`, `indicatorDataSchema(meta)`), de los que se infieren los tipos (`IndicatorMeta`, `IndicatorData`, `Catalog`). El ETL valida con los esquemas; la app importa solo los tipos (`import type`) para que Zod no entre en su bundle. Cualquier cambio aquí es un cambio de contrato: actualiza `spec.md`.
- `packages/etl` — ETL en Node + TypeScript sobre DuckDB.
- `apps/angular` — frontend.

## ETL y datos

- Tres capas: `data/raw/AAAA-MM-DD/` (descargas crudas + manifiesto, no versionadas) → `vivienda.duckdb` (reconstruible, no versionada) → JSON/TopoJSON publicados (versionados).
- Esquemas DuckDB: `staging` (una tabla por dataset, sin transformar), `model` (`geo`, `indicator`, `observation`, `source_snapshot`), `publish` (vistas por indicador).
- El SQL vive en ficheros `.sql` numerados en `packages/etl/sql/{staging,model,publish}` y debe poder ejecutarse con la CLI de DuckDB. Node solo orquesta: no metas lógica de transformación en TypeScript si cabe en SQL.
- Índices rebasados a 2015 = 100 en el ETL. Cortes de clase fijos sobre toda la serie (`quantile_cont`). Geometrías de GISCO en EPSG:3035, ya proyectadas.
- Notas por valor en `model.observation_note` (`model/13_notes.sql`), publicadas como `n` en cada celda del JSON y mostradas en tooltip y tabla.
- Conserva los flags de Eurostat (`e`, `p`, `b`, `u`, `c`, `d`, `n`, y combinaciones como `bdu`) en `observation.flags`.
- Cobertura y decisiones de datos en `cobertura.md` (NUTS 2024, renta hasta 2023, etc.); se reproduce con `cat packages/etl/sql/analysis/*.sql | duckdb -readonly -markdown data/vivienda.duckdb`.
- El ETL solo publica si pasan los tests de calidad; si Eurostat cambia dimensiones, falla con un error claro.
- Fuentes en `packages/etl/src/sources.ts`: se descargan en SDMX-CSV comprimido desde 2015, filtrando por clave SDMX (dimensiones en el orden de Eurostat). Al leerlas con `read_csv`, pasa `timestampformat='%d/%m/%y %H:%M:%S'`: si no, DuckDB interpreta `LAST UPDATE` como año/mes/día.
- Geometrías en `packages/etl/src/geometries.ts`: GeoJSON 20M de GISCO ya en EPSG:3035 (DuckDB lo lee con `ST_Read` sin reproyectar). Las ultraperiféricas también van dentro de las siluetas NUTS 0 de ES, FR y PT.
- `pnpm etl download` (en `packages/etl/src/download.ts`) descarga fuentes y geometrías en `data/raw/AAAA-MM-DD/` con `manifest.json`; sin manifiesto, la descarga está incompleta. La última actualización de Eurostat sale de la columna `LAST UPDATE`; la de GISCO, de `Last-Modified`.
- `etl build` (`src/build.ts`) fija `SET VARIABLE raw` y ejecuta los `.sql` en orden. `sql/staging/00_setup.sql` define las macros `raw_file`, `eurostat_csv` y `snapshot`; cada fichero posterior es reejecutable y registra su carga en `model.source_snapshot`. Staging lee Eurostat con `all_varchar` (salvo `OBS_VALUE` y `LAST UPDATE`): la detección automática convierte `sex` = `T` en booleano. La base se crea con `storage_compatibility_version: 'latest'` para no perder el CRS de las geometrías.
- `sql/publish/`: la lista de indicadores publicados (`publish.published`), cortes y escala (`publish.breaks`) y las vistas `publish.catalog`, `publish.data` y `publish.geo_nuts0`, que DuckDB arma como JSON con claves ordenadas (macro `sorted_object`; `json_group_object` no admite `ORDER BY`). `src/export.ts` solo valida con el contrato, pasa NUTS 0 por mapshaper (topología y cuantización, sin simplificar) y escribe. `data/` y `geo/` de `public/` pertenecen al export: los borra antes de escribir. mapshaper no trae tipos: `src/mapshaper.d.ts` declara lo que se usa.
- Capas en orden: `sql/staging`, `sql/model`, `sql/quality`, `sql/publish`. `model/00_tables.sql` recrea las tablas y define `first_year`/`final_year` (2015–2025) y las macros `keep` (geografía UE-27, valor no vacío, año en rango) y `merge_flags`; luego un fichero por indicador. Cada fichero de `quality/` lanza `error()` si encuentra violaciones, lo que detiene el build y la CLI. La lista de ultraperiféricas vive en `model/01_geo.sql`.
- Tests del modelo y de calidad: `test/staging-fixture.ts` monta un staging mínimo en memoria (`withModel`, `cleanData`) y ejecuta las capas sobre él.

## Frontend Angular

Arquitectura hexagonal simplificada, dependencias hacia dentro:

- `domain/` — TypeScript puro. **Prohibido importar `@angular/*`**. Tipos, reglas puras (cortes de clase, ranking, fallback de año, dato nacional, estado de URL) y puertos.
- `application/` — `ExplorerStore` con signals: estado, `computed` y acciones. Depende solo de puertos del dominio.
- `infrastructure/` — adaptadores: HTTP sobre JSON estático, router para la URL, `localStorage` para los paneles.
- `ui/` — componentes standalone (`shell`, `catalog`, `map`, `region`, `charts`, `table`).
- `app.config.ts` enlaza cada puerto con su adaptador vía `InjectionToken`.

Convenciones:

- Componentes standalone, signals, `ChangeDetectionStrategy.OnPush`, control flow nativo (`@if`, `@for`).
- Las opciones de ECharts se construyen con funciones puras a partir del estado y se prueban sin DOM.
- Cada tarjeta de gráfico redimensiona con `ResizeObserver` + `requestAnimationFrame`.
- Todo el estado compartible vive en la URL; la disposición de paneles, en `localStorage`.
- Las fronteras entre capas las comprueba el lint en CI (`no-restricted-imports` por capa en `eslint.config.js`); no las desactives. `domain` no importa Angular, RxJS ni otras capas; `application` no importa `infrastructure` ni `ui`; `infrastructure` no importa `application` ni `ui`; `ui` no importa `infrastructure`.
- Los `InjectionToken` viven en `application/tokens.ts` (el dominio no puede importar Angular); los puertos devuelven promesas.
- CI (`.github/workflows/ci.yml`): lint, tipos, tests y build en cada push a `main` y en cada PR.

## Diseño

- Dirección visual «cifras destacadas»: fondo blanco, filetes finos, color solo en los datos.
- Tipografías: Barlow Condensed (cifras, títulos, encabezados, en mayúsculas) y Source Sans 3 (interfaz y tablas). `tabular-nums` en cifras de tablas.
- Escala tipográfica y reglas de cifras destacadas: ver `spec.md`.
- Accesibilidad: paletas aptas para daltonismo, tabla alternativa al mapa, separadores de paneles con el patrón *window splitter* de WAI-ARIA.

## Reglas de contenido

- Las relaciones entre indicadores se presentan como descriptivas, nunca causales.
- Solo fuentes oficiales y abiertas; nada de datos de portales inmobiliarios privados.
- Títulos, unidades y notas de cada gráfico salen del catálogo (`IndicatorMeta`), no se escriben a mano.
- Nada de gráficos con doble eje: dos series con escalas distintas van como índices con base común o en paneles separados.

## Tests

- Vitest en `contract` y `etl`; el dominio de Angular sin TestBed.
- Tests de calidad de datos en SQL (`sql/quality/`): indicadores sin datos, desgloses no declarados, años y valores fuera de rango, cobertura del último año y códigos NUTS sin geometría. Las claves únicas, por clave primaria.
