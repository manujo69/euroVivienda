# EuroVivienda — Especificación del MVP

> Nombre provisional. Documento vivo: la versión de referencia está en Claude Docs; este fichero es la copia para el repositorio.

## Resumen

EuroVivienda es un portal estadístico y geográfico sobre el acceso a la vivienda en la UE. El usuario activa indicadores, ve el principal sobre un mapa de Europa y el resto como gráficos sincronizados (barras, líneas, pastel, dispersión).

El MVP prioriza calidad sobre cantidad: 9 indicadores de Eurostat (10 si entra el crecimiento de población), documentados y comparables. Los datos se consolidan en una base DuckDB dentro del ETL y se publican como JSON estático, sin backend en tiempo de ejecución.

Se construye en Angular con arquitectura hexagonal simplificada. Una versión en React queda fuera del MVP.

## Alcance

**Incluido:**

- UE-27 en dos niveles: país (NUTS 0) y región (NUTS 2). Cada indicador declara los niveles en que existe; en NUTS 2, los indicadores solo nacionales muestran el valor de su país marcado como «dato nacional».
- Serie temporal 2015 → último año disponible, con selector de año global.
- Catálogo de 9 indicadores con desgloses, mapa coroplético, panel de gráficos y estado compartible por URL.
- Página «Sobre los datos» con fuentes, metodología, limitaciones de cada indicador y aviso de que las relaciones mostradas son descriptivas, no causales.
- Accesibilidad desde el primer mapa: paletas aptas para daltonismo y una tabla alternativa al mapa navegable por teclado.

**Fuera del MVP:** alquiler turístico (Inside Airbnb y estadísticas de plataformas), grandes tenedores, zoom a ciudades o secciones censales, fuentes nacionales de €/m², mapa bivariante y consultas a la base en el navegador (DuckDB-WASM).

## Catálogo de indicadores

Nueve indicadores en tres temas, más uno opcional. El tipo de cada uno decide qué gráficos genera. Los códigos se verifican en el hito 0.

| Tema | Indicador | Código Eurostat | Nivel | Tipo | Desgloses y limitaciones |
| --- | --- | --- | --- | --- | --- |
| Precios | Variación del precio de la vivienda | `prc_hpi_a` | País | Índice | Vivienda nueva y existente. Se rebasa a 2015 = 100 en el ETL |
| Precios | Variación del alquiler | `prc_hicp_aind` (CP041) | País | Índice | Alquileres pagados por inquilinos, incluidos regulados y sociales: no es el precio de mercado. Rebase a 2015 = 100 |
| Precios | Precio de la vivienda frente a renta | `prc_hpi_a` ÷ `nama_10r_2hhinc` | País | Derivado (índice) | Elaboración propia: índice de precios entre índice de renta disponible por habitante, ambos base 2015 |
| Acceso | Sobrecarga por coste de vivienda | `ilc_lvho07a` + `ilc_lvho07c` | País | Escalar (%) | Desgloses por edad (total y jóvenes) y por régimen de tenencia. Umbral: coste > 40 % de la renta disponible |
| Acceso | Régimen de tenencia | `ilc_lvho02` | País | Composición | Propietario con y sin hipoteca, alquiler a precio de mercado, alquiler reducido o gratuito |
| Acceso | Edad media de emancipación | `yth_demo_030` | País | Escalar (años) | Desglose por sexo; estimación de Eurostat |
| Contexto | Tasa de paro | `lfst_r_lfu3rt` | País + NUTS 2 | Escalar (%) | Total por defecto |
| Contexto | Renta disponible de los hogares por habitante | `nama_10r_2hhinc` | País + NUTS 2 | Escalar (€ o PPS) | Unidad por decidir. Retraso habitual de unos dos años |
| Contexto | Intensidad turística (noches por habitante) | `tour_occ_nin2` + población | País + NUTS 2 | Derivado | Elaboración propia. Posibles datos confidenciales en NUTS 2 (flag `c`); caída en 2020–2021 |
| Contexto | Crecimiento de la población (opcional) | `demo_r_gind3` | País + NUTS 2 | Escalar (‰) | Crecimiento total y saldo migratorio. Entra solo si la cobertura del hito 0 es limpia |

## Experiencia de usuario

Tres zonas: catálogo a la izquierda, mapa de la UE en el centro y panel de gráficos a la derecha. La cabecera lleva el selector de año y el de nivel (País / NUTS 2). En móvil, tres pestañas: Catálogo, Mapa y Gráficos.

**Reglas de interacción:**

1. Activar un indicador añade su tarjeta al panel. Como máximo hay cuatro tarjetas abiertas; el resto aparecen plegadas con su cifra principal.
2. Un indicador activo es el principal y colorea el mapa. Por defecto, el último activado.
3. Clic en una región: se selecciona y se resalta en todos los gráficos.
4. Con dos o más indicadores numéricos activos aparece una única tarjeta de dispersión, con parejas sugeridas (precio frente a renta; sobrecarga de jóvenes frente a edad de emancipación; sobrecarga frente a paro) y un selector libre como opción avanzada. Muestra el coeficiente r y el número de regiones, con el aviso de que correlación no implica causa. Si los años difieren, cada eje muestra el suyo.
5. En NUTS 2, los indicadores solo nacionales pintan cada región con el valor de su país, con trama y la etiqueta «dato nacional». La dispersión en NUTS 2 solo ofrece indicadores regionales.
6. Un indicador con desgloses muestra un selector en su tarjeta; el mapa usa el desglose activo del principal.
7. Todo el estado vive en la URL: `?ind=hpi,overburden&main=hpi&geo=ES&year=2023&level=0&bd=overburden:youth`. Una URL con combinaciones inválidas se normaliza al estado válido más cercano.

**Gráficos por tipo de indicador:**

| Tipo | Gráficos de la tarjeta | Qué pinta el mapa |
| --- | --- | --- |
| Escalar | Evolución en líneas (región frente a media UE) + ranking corto: tres primeras, tres últimas y la región seleccionada | El valor |
| Índice | Líneas con base 100 frente a la media UE | Variación acumulada desde 2015 (%) |
| Composición | Pastel de la región + barras apiladas al 100 % comparando países | El % de la categoría `mapCategory` |
| Derivado | Igual que escalar, con la etiqueta «elaboración propia» | El valor |

**Mapa:**

- Cuantiles con cortes fijos sobre toda la serie, para que un color signifique lo mismo en todos los años.
- Escala secuencial si todos los valores tienen el mismo signo; divergente centrada en 0 solo si hay valores a ambos lados. La decide el ETL.
- Regiones sin dato en gris con trama y el texto «sin dato».
- Tooltip con valor, año, fuente y flags de Eurostat: `e` estimado, `p` provisional, `b` ruptura de serie, `u` baja fiabilidad, `c` confidencial, `d` definición distinta.
- Proyección Lambert azimutal equivalente (EPSG:3035) aplicada en el ETL: el frontend recibe las geometrías ya proyectadas.
- Países no UE en gris neutro y sin interacción. Regiones ultraperiféricas fuera del mapa en el MVP, con nota; sus datos siguen en gráficos y tablas.
- Tabla alternativa accesible por teclado y lector de pantalla.

**Dirección visual («cifras destacadas»):**

- Fondo blanco y filetes finos en lugar de cajas; el color se reserva para los datos.
- Barlow Condensed en mayúsculas para cifras, títulos y encabezados de sección; Source Sans 3 para interfaz, tablas y textos. `font-variant-numeric: tabular-nums` en tablas y rankings.
- Títulos de sección en condensada mayúscula con filete de 2 px debajo.

| Nivel | Uso | Escritorio | Móvil |
| --- | --- | --- | --- |
| Cifra principal | Valor de la región seleccionada | 75 px (unidad 33 px) | 81 px (unidad 36 px) |
| Cifra de entrada del mapa | Media UE del indicador principal | 63 px (unidad 30 px) | Por diseñar |
| Cifras secundarias | Máximo y mínimo en el mapa; puesto y cambio en la ficha | 52–56 px | 48 px |
| Título de pantalla | Nombre del indicador sobre el mapa | 30 px | 24 px |
| Título de sección | Evolución, indicadores activos, ranking | 16 px | 15–16 px |
| Texto e interfaz | Etiquetas, tablas, explicaciones | 12,5–14 px | 12,5–13,5 px |

Reglas de cifras destacadas:

1. En el mapa: media UE como cifra de entrada, y máximo y mínimo con línea guía hacia su región.
2. Posiciones fijas en el margen del mapa, nunca junto a cada región.
3. En la ficha: valor de la región como cifra principal; puesto y cambio desde 2015 como secundarias.
4. Cada cifra lleva debajo una frase que la explica. Unidad más pequeña junto a la cifra; flags como superíndice.

Tablas: cabecera con filete oscuro y filas con filetes finos. Región seleccionada con fondo gris y filetes oscuros. En rankings, la media UE es una línea discontinua rotulada.

**Paneles reescalables y plegables:**

- Separadores arrastrables; doble clic restaura el ancho. Mínimos: catálogo 240 px, gráficos 320 px, mapa 480 px.
- Cada panel lateral se pliega a una barra de 48 px con icono y etiqueta vertical. Con el panel de gráficos plegado, la región seleccionada sigue en una tarjeta flotante sobre el mapa.
- Teclado: patrón *window splitter* de WAI-ARIA.
- Anchos y paneles plegados en `localStorage`, no en la URL.
- Cada tarjeta de gráfico usa un `ResizeObserver` agrupado con `requestAnimationFrame` para llamar a `resize()` de ECharts.
- Tableta (< 1024 px): el panel de gráficos pasa a cajón. Móvil: tres pestañas con el control de año siempre visible.

Propuestas de la maqueta pendientes de validar: conmutador *Mapa | Tabla*, modo *Valor | Cambio desde 2015*, reproducción de años, buscador de regiones, filtro en frase y «Descargar CSV».

## Arquitectura

Sin backend en tiempo de ejecución: un ETL mensual (GitHub Actions) descarga Eurostat y GISCO, consolida en DuckDB y publica JSON estático que el frontend lee desde Vercel.

**Capas de datos:**

1. Descargas crudas en `data/raw/AAAA-MM-DD/` con manifiesto. No se versionan.
2. Base `vivienda.duckdb`, reconstruible y sin versionar. Esquemas `staging` (una tabla por dataset), `model` y `publish` (vistas por indicador).
3. Salida JSON y TopoJSON, versionada.

Las transformaciones viven en ficheros `.sql` numerados por capa, ejecutables también desde la CLI de DuckDB; Node solo orquesta. El ETL publica únicamente si pasan los tests de calidad.

**Stack:**

- Monorepo con pnpm workspaces: `packages/contract`, `packages/etl`, `apps/angular`.
- ETL en Node + TypeScript con `@duckdb/node-api` y extensiones `httpfs` y `spatial`; mapshaper para simplificar geometrías.
- Angular con componentes standalone y signals; estado sincronizado con la URL mediante el router.
- Apache ECharts con `ngx-echarts`. Geometrías proyectadas registradas como coordenadas planas; validar `aspectScale: 1` en el hito 2.

**Aplicación Angular: arquitectura hexagonal simplificada.** Cuatro capas con dependencias hacia dentro. «Simplificada» = un único `ExplorerStore` en lugar de un caso de uso por acción, y puertos solo donde hay entrada o salida.

```text
src/app/
  domain/          tipos, reglas puras y puertos (sin imports de Angular)
  application/     explorer.store.ts: estado con signals y acciones
  infrastructure/  http-indicator.repository.ts, router-url-state.adapter.ts, local-storage-layout.adapter.ts
  ui/              shell/, catalog/, map/, region/, charts/, table/
  app.config.ts    providers que enlazan cada puerto con su adaptador
```

- Puertos: `IndicatorRepository`, `GeographyRepository`, `UrlStatePort`, `LayoutPreferencesPort`, inyectados con `InjectionToken`.
- Fronteras comprobadas en CI con lint de dependencias (p. ej. `eslint-plugin-boundaries`).
- El dominio se prueba sin TestBed; los adaptadores, con JSON de ejemplo.
- Opciones de ECharts construidas con funciones puras a partir del estado.

## Modelo de datos

Observaciones en formato largo en DuckDB; la exportación las agrupa en el contrato JSON. Todo indicador lleva al menos el desglose `total`.

```sql
CREATE TABLE geo (
  code          VARCHAR PRIMARY KEY,   -- 'ES', 'ES61', 'EU27_2020'
  level         TINYINT NOT NULL,      -- 0 país, 2 región
  country       VARCHAR NOT NULL,
  name          VARCHAR NOT NULL,
  nuts_version  VARCHAR NOT NULL,
  is_aggregate  BOOLEAN NOT NULL DEFAULT false,
  is_outermost  BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE indicator (
  id             VARCHAR PRIMARY KEY,  -- 'hpi', 'overburden'
  label          VARCHAR NOT NULL,
  theme          VARCHAR NOT NULL,     -- prices | access | context
  kind           VARCHAR NOT NULL,     -- scalar | index | composition | derived
  unit           VARCHAR NOT NULL,
  source_code    VARCHAR NOT NULL,
  source_filter  JSON,
  map_category   VARCHAR,
  notes          VARCHAR
);

CREATE TABLE observation (
  indicator_id  VARCHAR NOT NULL REFERENCES indicator (id),
  geo           VARCHAR NOT NULL REFERENCES geo (code),
  year          SMALLINT NOT NULL,
  breakdown     VARCHAR NOT NULL DEFAULT 'total',
  category      VARCHAR NOT NULL DEFAULT '_',
  value         DOUBLE,
  flags         VARCHAR,
  PRIMARY KEY (indicator_id, geo, year, breakdown, category)
);

CREATE TABLE source_snapshot (
  dataset        VARCHAR NOT NULL,
  downloaded_at  TIMESTAMP NOT NULL,
  last_update    TIMESTAMP,
  file           VARCHAR NOT NULL,
  sha256         VARCHAR NOT NULL,
  row_count      INTEGER
);
```

Contrato JSON (`packages/contract`):

```ts
type IndicatorKind = 'scalar' | 'index' | 'composition' | 'derived';

interface IndicatorMeta {
  id: string;
  label: string;
  theme: 'prices' | 'access' | 'context';
  kind: IndicatorKind;
  unit: string;
  levels: (0 | 2)[];
  years: [number, number];
  source: { name: string; code: string; url: string; lastUpdate: string };
  breakdowns: { id: string; label: string }[];  // el primero es el de por defecto
  categories?: string[];                        // solo 'composition'
  mapCategory?: string;
  scale: 'sequential' | 'diverging';
  breaks: Record<string, number[]>;             // cortes fijos por desglose
  notes?: string;
}

// data/[id].json
interface IndicatorData {
  [geo: string]: {
    [year: string]: {
      [breakdown: string]: { v: number | Record<string, number>; f?: string };
    };
  };
}
```

La herencia del dato nacional en NUTS 2 se resuelve en el cliente (los dos primeros caracteres del código NUTS son el país). El agregado UE viene de Eurostat cuando existe; en los derivados lo calcula el ETL ponderando por población.

## Hitos

0. **Fuentes y base de datos:** verificar códigos, descarga cruda, carga en DuckDB e informe de cobertura.
1. **ETL mínimo:** un escalar + el de composición + NUTS 0 → JSON válido contra el contrato, con tests.
2. **Mapa:** coloreado, leyenda, tooltip, selección, paleta accesible y tabla alternativa.
3. **Catálogo y panel:** activar indicadores, principal, tarjetas por tipo y sincronización.
4. **Año, NUTS 2, desgloses y URL compartible.**
5. **Resto del catálogo:** dispersión con parejas sugeridas, estados vacíos y móvil.
6. **Pulido:** «Sobre los datos», accesibilidad y auditoría de rendimiento.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Años desiguales entre indicadores | Fallback al último año disponible, mostrado en la tarjeta y en cada eje |
| Huecos de datos | Informe de cobertura en el hito 0; estados vacíos en el MVP |
| Versión NUTS distinta entre geometrías y series | Una única versión; tests en ambos sentidos |
| Peso del TopoJSON NUTS 2 | Resolución 10M o 20M + mapshaper, con presupuesto de tamaño |
| Cambios de base o esquema en Eurostat | Rebase propio a 2015; el ETL falla y no publica si cambian las dimensiones |
| Revisiones de Eurostat | Manifiesto con fecha de actualización y JSON versionado |
| Cliente Node de DuckDB joven | SQL en ficheros `.sql`; Node solo orquesta |

## Decisiones

**Cerradas:** DuckDB en el ETL · ultraperiféricas fuera del mapa · dato nacional en NUTS 2 · desgloses como dimensión · una tarjeta de dispersión con parejas sugeridas · cuantiles con cortes fijos · rebase de índices a 2015 · proyección EPSG:3035 en el ETL · agregado UE de Eurostat o ponderado · Angular hexagonal simplificada · dirección visual «cifras destacadas».

**Abiertas:**

- [ ] Nombre definitivo (provisional: EuroVivienda).
- [ ] Unidad de la renta: € o PPS por habitante.
- [ ] Categoría de tenencia que pinta el mapa.
- [ ] Grupo de edad de «jóvenes» en la sobrecarga (15–29, 16–29 o 18–24).
- [ ] Versión NUTS (2021 o 2024).

## Fases posteriores

- **Fase 2 — Oferta, mercado y correlaciones.** Candidatos, todos oficiales y como relaciones descriptivas: hacinamiento (`ilc_lvho05a`), habitaciones por persona y tamaño del hogar (`ilc_lvho03`, `ilc_lvph01`), tipo de vivienda (`ilc_lvho01`), viviendas por 1.000 habitantes (OCDE), viviendas con licencia (`sts_cobp_a`), coste de construcción (`sts_copi_a`), compraventas (`prc_hpi_hsna`/`prc_hpi_hsva`), nivel de precios (`prc_ppp_ind`, A0104), tipo hipotecario (BCE MIR), gasto público en vivienda (`gov_10a_exp`, GF0601), Eurobarómetro. Además: alquiler turístico, viviendas vacías del Censo 2021, mapa bivariante y matriz de correlaciones (posible DuckDB-WASM).
- **Fase 3 — Zoom a España:** INE, Ministerio de Vivienda, Notariado, Registradores, CGPJ, Banco de España. Málaga como posible piloto.
- **Fase 4 — ¿Quién posee la vivienda?:** HFCS y cuentas distributivas del BCE; fuentes nacionales en sección aparte.
- **Opcional — Versión React** sobre el mismo contrato y dominio.
