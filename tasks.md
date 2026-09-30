# EuroVivienda — Tareas

El hito 0 está desglosado al detalle porque es el siguiente paso; los demás se afinarán cuando se cierre el informe de cobertura.

## Hito 0 — Fuentes y base de datos

Objetivo: una base DuckDB reconstruible con un comando, con todos los indicadores del catálogo cargados, y un informe de cobertura que confirme o descarte cada uno.

### 0.1 Repositorio y herramientas

- [x] Crear el monorepo con pnpm workspaces: `packages/contract`, `packages/etl` y `apps/angular`.
- [x] Configurar TypeScript estricto, ESLint y Vitest en `contract` y `etl`.
- [x] Instalar la CLI de DuckDB y `@duckdb/node-api`; comprobar que cargan las extensiones `httpfs` y `spatial`.
- [x] Crear `etl/sql/staging`, `etl/sql/model` y `etl/sql/publish`, y añadir `data/raw/` y `*.duckdb` a `.gitignore`.

### 0.2 Verificación de fuentes

- [x] Confirmar los códigos de dataset del catálogo, incluidos `ilc_lvho07c` (sobrecarga por tenencia) y `demo_r_gind3` (población, que la 0.6 acepta), y anotar dimensiones, unidades y filtros (`unit`, `age`, `sex`, `tenure`, `coicop`, `rskpovth`). `prc_hicp_aind` está descontinuado: se usa `prc_hicp_ainr` (CP0411).
- [x] Comprobar la base actual de `prc_hpi_a` y `prc_hicp_aind`. `prc_hpi_a` publica base 2015 y 2025; `prc_hicp_ainr`, solo base 2025.
- [x] Elegir el grupo de edad de «jóvenes» en `ilc_lvho07a`: `Y20-29` (18–29 no existe).
- [x] Elegir el dataset de población a 1 de enero por NUTS 2 para la intensidad turística. No hace falta: `tour_occ_nin2` publica noches por mil habitantes (`P_THAB`).
- [x] Descargar un mismo dataset en SDMX-CSV y en JSON-stat y elegir el formato que DuckDB lea sin transformación previa: SDMX-CSV comprimido.
- [x] Registrar cada fuente en un catálogo versionado (`sources.ts`): código, filtros, URL y atribución.

### 0.3 Geometrías

- [x] Descargar de GISCO las geometrías NUTS 0 y NUTS 2 en EPSG:3035, a resolución 20M para empezar. Registradas en `geometries.ts` (GeoJSON, que leen tanto `ST_Read` como mapshaper). Entre NUTS 2021 y 2024 solo cambian NL y PT en NUTS 2; la 0.6 eligió 2024.
- [x] Descargar la capa de países de GISCO para el contexto no UE: `CNTR_RG_20M_2024_3035`.
- [x] Identificar las regiones ultraperiféricas para marcarlas en `geo`: `ES70`, `FRY1`–`FRY5`, `PT20` y `PT30`, iguales en ambas versiones. Las geometrías NUTS 0 de ES, FR y PT las incluyen: hay que recortarlas también en el nivel país.

### 0.4 Descarga cruda

- [x] Comando `etl download`: guarda cada fuente en `data/raw/AAAA-MM-DD/` y escribe el manifiesto (URL, fecha, última actualización, hash y tamaño). Incluye las capas de GISCO; `manifest.json` se escribe al final, así que una carpeta sin manifiesto es una descarga incompleta.
- [x] Reintentos con espera y error explícito si una respuesta no tiene el formato esperado. Cuatro intentos (esperas de 1, 2 y 4 s) ante fallos de red, 429 y 5xx; los 4xx fallan al momento con el motivo de Eurostat. Se comprueban las columnas del CSV (falla si Eurostat cambia dimensiones) y la proyección del GeoJSON.

### 0.5 Staging

- [x] Cargar cada descarga en `staging.<dataset>` sin transformar, con un fichero `.sql` por dataset. Todo como texto salvo `OBS_VALUE` y `LAST UPDATE`: la detección automática lee `sex` = `T` como booleano.
- [x] Cargar las geometrías con `spatial` en `staging.geo_nuts` (NUTS 2024, niveles 0 y 2) y `staging.geo_countries`. La base se crea con el formato de almacenamiento actual para conservar el CRS.
- [x] Registrar cada carga en `source_snapshot`, a partir del manifiesto (una fila por fichero crudo).

### 0.6 Análisis inicial y cobertura

Consultas en `packages/etl/sql/analysis/`; resultados y decisiones en `cobertura.md`.

- [x] Por indicador y nivel: años disponibles, porcentaje de huecos por país o región y frecuencia de cada flag.
- [x] Versión NUTS de cada serie regional y cruce de sus códigos con las geometrías en ambos sentidos.
- [x] Disponibilidad del agregado `EU27_2020` en cada indicador.
- [x] Rangos y distribución de valores para detectar unidades erróneas y valores atípicos.
- [x] Redactar el informe de cobertura y cerrar con él las decisiones abiertas: NUTS 2024; año final 2025 con la renta hasta 2023; renta en PPS por habitante y derivado en moneda nacional; el mapa de tenencia pinta el alquiler total; el crecimiento de población entra sin media UE.

### 0.7 Modelo

- [x] Crear las tablas `geo`, `indicator`, `observation` y `source_snapshot` del esquema. `indicator` suma `levels`, `breakdowns` y `categories` para que el contrato salga del catálogo.
- [x] Transformaciones de staging a modelo por indicador: filtros, rebase a 2015, desgloses y categorías. Descartar la renta de 2024 y los códigos `XXZZ`. Un fichero por indicador en `sql/model/`; solo geografía UE-27, valores no vacíos y años 2015–2025.
- [x] Indicador derivado precio frente a renta (ambos índices con base 2015; renta por habitante en moneda nacional = `MIO_NAC × EUR_HAB / MIO_EUR`) y noches por habitante a partir de `P_THAB`.
- [x] Tests de calidad en SQL (`sql/quality/`, fallan con `error()`): indicadores sin datos, desgloses no declarados, años y valores fuera de rango, cobertura del último año (90 % de países, 95 % de regiones) y códigos NUTS sin geometría en el último año. Las claves únicas las garantiza la clave primaria.
- [x] Comando `etl build` que reconstruye la base completa desde `data/raw/` en una sola ejecución: staging, modelo y calidad.

## Hito 1 — ETL mínimo

- [x] Paquete `contract` con los tipos y un validador de esquema que usen los tests del ETL. Esquemas Zod 4 (`indicatorMetaSchema`, `catalogSchema`, `indicatorDataSchema(meta)`) con tipos inferidos; `etl` ya depende del paquete.
- [x] Vistas de publicación y exportación de `catalog.json` y `data/[id].json` para un escalar y el de composición: `overburden` y `tenure`. Vistas en `sql/publish/` (DuckDB arma el JSON) y comando `etl export`, que valida con el contrato y escribe en `apps/angular/public/` solo si todo pasa. Salida determinista (claves ordenadas).
- [x] Cálculo de cortes fijos con `quantile_cont` y de la escala (secuencial o divergente). Sobre los países (sin agregado UE) y todos los años, por desglose: quintiles si es secuencial; 0 más terciles de cada lado si es divergente. En índices, sobre la variación desde 2015; en composiciones, sobre `mapCategory`.
- [x] Simplificación de NUTS 0 con mapshaper y exportación a TopoJSON, con presupuesto de tamaño fijado: 50 KB (sale en 36 KB). A escala 20M no se simplifica, porque deforma las costas y apenas ahorra; mapshaper construye la topología y cuantiza (1:10.000). Ultraperiféricas recortadas de ES, FR y PT.
- [x] Workflow mensual de GitHub Actions que publica solo si pasan los tests: `.github/workflows/monthly-data.yml` (día 5 de cada mes y a mano). Lint, tipos y tests; download, build y export; si cambian los ficheros de `apps/angular/public/`, abre un pull request para revisar el diff antes de desplegar. Pendiente de la primera ejecución real en GitHub.

## Hito 2 — Mapa

- [x] Esqueleto hexagonal de la app Angular: carpetas `domain`, `application`, `infrastructure` y `ui`, puertos con `InjectionToken`, enlace en `app.config.ts` y regla de lint de fronteras en CI. Puertos `IndicatorRepository` y `GeographyRepository` (promesas; la geografía llega como GeoJSON), adaptadores HTTP, fronteras con `no-restricted-imports` por capa y workflow `ci.yml` (lint, tipos, tests en ChromeHeadless y build).
- [x] Tipografías (Barlow Condensed y Source Sans 3) y tokens de la dirección visual «cifras destacadas». Fuentes autoalojadas con `@fontsource` (subconjunto latino); tokens como variables CSS en `src/styles.scss` (familias, escala tipográfica de escritorio y móvil, neutros y filetes) y clases `.figure`, `.screen-title`, `.section-title` y `.tabular`. `lang="es"` en `index.html`.
- [x] App Angular standalone que carga el catálogo y un indicador. `ExplorerStore` con signals; la carga ocurre solo en el navegador (`afterNextRender`), así que el prerenderizado sirve el esqueleto vacío.
- [x] Registrar el mapa en ECharts con las geometrías proyectadas y validar `aspectScale: 1` (comprobado con capturas: las proporciones coinciden con las de mapshaper). ECharts va en un bloque `@defer`: el bundle inicial baja de 848 KB a 320 KB.
- [x] Coloreado con cortes fijos, leyenda, tooltip con flags y selección de región. Opciones de ECharts construidas con funciones puras (`ui/map/map-option.ts`); regiones sin dato en gris con trama; la selección es la del store, compartida con la tabla.
- [x] Paleta apta para daltonismo y tabla alternativa accesible. ColorBrewer YlGnBu (secuencial) y PuOr (divergente); tabla con `caption`, botón por país (teclado) y media UE al pie.
- [x] Países no UE en gris y nota de regiones ultraperiféricas. El export añade la capa `context` (países GISCO fuera de la UE, recortados a 300 km del marco UE) en la misma topología; presupuesto de `geo/nuts0.json` subido a 80 KB (65 KB, 21 KB comprimido).

## Hito 3 — Catálogo y panel

- [x] Catálogo por temas con activar y desactivar. `CatalogComponent` a la izquierda del mapa: un `fieldset` por tema (Precios, Acceso, Contexto; los vacíos no salen) y una casilla por indicador. El store guarda los activos en orden de activación y carga los datos de cada indicador la primera vez; si fallan, la casilla queda sin marcar y avisa. Al cargar, el primer indicador del catálogo está activo.
- [x] Indicador principal y su efecto en el mapa. Por defecto, el último activado; al desactivar el principal, el mapa pasa al último que sigue activo, y sin ninguno activo se pide activar uno. Botón «Ver en el mapa» (`aria-pressed`) en cada indicador activo del catálogo. Cada principal empieza en su primer desglose.
- [x] Tarjetas por tipo: escalar, índice, composición y derivado; máximo cuatro abiertas. Panel a la derecha con una tarjeta por indicador activo y su cifra principal (región seleccionada o media UE); abiertas las cuatro usadas más recientemente, el resto plegadas. Escalar y derivado: evolución frente a la media UE y ranking corto (derivado con «elaboración propia»); índice: variación desde 2015 y líneas con base 100; composición: pastel y barras apiladas al 100 %, con una leyenda común. Gráficos en `@defer`. El contrato nombra las categorías (`categories` y `mapCategory` como `{ id, label }`).
- [ ] Selección sincronizada entre mapa y gráficos.

## Hito 4 — Año, NUTS 2, desgloses y URL

- [ ] Selector de año con fallback por indicador.
- [ ] Nivel NUTS 2 con herencia del dato nacional.
- [ ] Selector de desglose en las tarjetas (edad y régimen de tenencia en la sobrecarga).
- [ ] Estado en la URL y normalización de combinaciones inválidas.

## Hito 5 — Resto del catálogo

- [ ] Exportar el resto de indicadores del catálogo y las geometrías NUTS 2.
- [ ] Tarjeta de dispersión con parejas sugeridas, selector libre y coeficiente r.
- [ ] Estados vacíos y diseño móvil con pestañas.

## Hito 6 — Pulido

- [ ] Página «Sobre los datos» generada desde el catálogo.
- [ ] Revisión de accesibilidad.
- [ ] Auditoría de rendimiento: Lighthouse, tamaño del bundle y tiempo hasta el primer mapa.
