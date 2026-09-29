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

- [ ] Crear las tablas `geo`, `indicator`, `observation` y `source_snapshot` del esquema.
- [ ] Transformaciones de staging a modelo por indicador: filtros, rebase a 2015, desgloses y categorías. Descartar la renta de 2024 y los códigos `XXZZ`.
- [ ] Indicador derivado precio frente a renta (ambos índices con base 2015; renta por habitante en moneda nacional = `MIO_NAC × EUR_HAB / MIO_EUR`) y noches por habitante a partir de `P_THAB`.
- [ ] Tests de calidad en SQL: claves únicas, códigos sin geometría, años fuera de rango y valores fuera de rango.
- [ ] Comando `etl build` que reconstruye la base completa desde `data/raw/` en una sola ejecución. Ya existe y ejecuta `sql/staging`; falta añadir `model` a `LAYERS` en `build.ts`.

## Hito 1 — ETL mínimo

- [ ] Paquete `contract` con los tipos y un validador de esquema que usen los tests del ETL.
- [ ] Vistas de publicación y exportación de `catalog.json` y `data/[id].json` para un escalar y el de composición.
- [ ] Cálculo de cortes fijos con `quantile_cont` y de la escala (secuencial o divergente).
- [ ] Simplificación de NUTS 0 con mapshaper y exportación a TopoJSON, con presupuesto de tamaño fijado.
- [ ] Workflow mensual de GitHub Actions que publica solo si pasan los tests.

## Hito 2 — Mapa

- [ ] Esqueleto hexagonal de la app Angular: carpetas `domain`, `application`, `infrastructure` y `ui`, puertos con `InjectionToken`, enlace en `app.config.ts` y regla de lint de fronteras en CI.
- [ ] Tipografías (Barlow Condensed y Source Sans 3) y tokens de la dirección visual «cifras destacadas».
- [ ] App Angular standalone que carga el catálogo y un indicador.
- [ ] Registrar el mapa en ECharts con las geometrías proyectadas y validar `aspectScale: 1`.
- [ ] Coloreado con cortes fijos, leyenda, tooltip con flags y selección de región.
- [ ] Paleta apta para daltonismo y tabla alternativa accesible.
- [ ] Países no UE en gris y nota de regiones ultraperiféricas.

## Hito 3 — Catálogo y panel

- [ ] Catálogo por temas con activar y desactivar.
- [ ] Indicador principal y su efecto en el mapa.
- [ ] Tarjetas por tipo: escalar, índice, composición y derivado; máximo cuatro abiertas.
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
