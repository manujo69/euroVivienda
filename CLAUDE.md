# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# EuroVivienda

Portal estadístico y geográfico sobre el acceso a la vivienda en la UE-27 (nombre provisional). Mapa coroplético + gráficos sincronizados sobre indicadores de Eurostat, servidos como JSON estático.

- Especificación completa: `spec.md`
- Hitos y tareas: `tasks.md` (marca las tareas al terminarlas)

Idioma del proyecto: la interfaz y la documentación en español; el código (identificadores, commits) en inglés.

## Estado actual

- `apps/angular` es todavía la app generada por Angular CLI 20: SSR activado (`outputMode: "server"`, todas las rutas en `RenderMode.Prerender`) y tests con Karma + Jasmine. Su ESLint (con la regla de fronteras) llega en el hito 2; hoy `eslint.config.js` ignora `apps/`.
- `packages/contract` y `packages/etl` son esqueletos: TypeScript estricto, ESLint con tipos y Vitest.

## Comandos

Desde la raíz (pnpm 12, Node ≥ 22.18):

- `pnpm install`
- `pnpm start`: servidor de desarrollo de Angular en `http://localhost:4200/`.
- `pnpm build`, `pnpm test`, `pnpm typecheck`: en todos los paquetes (`pnpm test` corre Karma en una sola pasada).
- `pnpm lint`: ESLint sobre `packages/`.
- Un paquete: `pnpm --filter @eurovivienda/etl test` (o `contract`, `angular`).
- Un solo test con Vitest: `pnpm --filter @eurovivienda/etl exec vitest run test/duckdb.test.ts`.
- Un solo test con Karma: `pnpm --filter @eurovivienda/angular exec ng test --watch=false --include src/app/app.spec.ts`.
- Karma en watch: `pnpm --filter @eurovivienda/angular test:watch`.

Los paquetes Node se ejecutan con *type stripping* (sin compilar): importa con extensión `.ts`, usa `import type` y evita `enum`, `namespace` y propiedades de parámetro. La configuración común está en `tsconfig.base.json`.

pnpm respeta una antigüedad mínima de versiones: no añadas excepciones en `minimumReleaseAgeExclude`; fija una versión anterior. Los paquetes con scripts de instalación se aprueban en `allowBuilds` de `pnpm-workspace.yaml`.

Formato: Prettier con `printWidth: 100` y comillas simples (config en el `package.json` raíz).

## Estructura

Monorepo con pnpm workspaces:

- `packages/contract` — tipos del contrato JSON (`IndicatorMeta`, `IndicatorData`) y validador. Lo usan el ETL y la app. Cualquier cambio aquí es un cambio de contrato: actualiza `spec.md`.
- `packages/etl` — ETL en Node + TypeScript sobre DuckDB.
- `apps/angular` — frontend.

## ETL y datos

- Tres capas: `data/raw/AAAA-MM-DD/` (descargas crudas + manifiesto, no versionadas) → `vivienda.duckdb` (reconstruible, no versionada) → JSON/TopoJSON publicados (versionados).
- Esquemas DuckDB: `staging` (una tabla por dataset, sin transformar), `model` (`geo`, `indicator`, `observation`, `source_snapshot`), `publish` (vistas por indicador).
- El SQL vive en ficheros `.sql` numerados en `packages/etl/sql/{staging,model,publish}` y debe poder ejecutarse con la CLI de DuckDB. Node solo orquesta: no metas lógica de transformación en TypeScript si cabe en SQL.
- Índices rebasados a 2015 = 100 en el ETL. Cortes de clase fijos sobre toda la serie (`quantile_cont`). Geometrías de GISCO en EPSG:3035, ya proyectadas.
- Conserva los flags de Eurostat (`e`, `p`, `b`, `u`, `c`, `d`) en `observation.flags`.
- El ETL solo publica si pasan los tests de calidad; si Eurostat cambia dimensiones, falla con un error claro.
- Fuentes en `packages/etl/src/sources.ts`: se descargan en SDMX-CSV comprimido desde 2015, filtrando por clave SDMX (dimensiones en el orden de Eurostat). Al leerlas con `read_csv`, pasa `timestampformat='%d/%m/%y %H:%M:%S'`: si no, DuckDB interpreta `LAST UPDATE` como año/mes/día.
- Comandos previstos: `etl download`, `etl build`.

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
- Las fronteras entre capas las comprueba el lint en CI; no las desactives.

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
- Tests de calidad de datos en SQL (claves únicas, códigos sin geometría y geometrías sin datos, años y valores fuera de rango).
