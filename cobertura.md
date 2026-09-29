# Informe de cobertura de EuroVivienda

Análisis inicial de los datos del catálogo (tarea 0.6), sobre la descarga del 29 de septiembre de 2026. Las consultas están en `packages/etl/sql/analysis/` y se reproducen con:

```bash
pnpm etl download && pnpm etl build
cat packages/etl/sql/analysis/*.sql | duckdb -readonly -markdown data/vivienda.duckdb
```

Los recuentos se refieren a la UE-27: 27 países y 236 regiones NUTS 2 continentales (las 244 de NUTS 2024 sin las 8 ultraperiféricas).

## Decisiones cerradas

| Decisión | Resultado | Motivo |
| --- | --- | --- |
| Versión NUTS | 2024 | En su último año, renta, turismo y población cubren las 236 regiones; paro, 233. Con NUTS 2021 faltarían NL31, NL33, PT16, PT17 y PT18 en los años recientes de todas las series. |
| Año final | 2025, con la renta hasta 2023 | Todo el catálogo publica 2025 salvo la renta: su 2024 solo tiene 12 países y 63 regiones, y se descarta para no pintar un mapa a medias. La renta y el precio frente a renta usan el fallback a 2023. |
| Unidad de la renta | PPS por habitante en el mapa; moneda nacional por habitante en el derivado | Los PPS comparan poder de compra entre países. El derivado mide crecimiento, igual que el índice de precios, que va en moneda nacional: entre 2015 y 2023 la renta por habitante de Hungría sube un 95 % en euros y un 136 % en forintos. Eurostat no publica moneda nacional por habitante; se calcula como `MIO_NAC × EUR_HAB / MIO_EUR`. |
| Categoría de tenencia del mapa | Alquiler total (`RENT`) | Estable ante la reclasificación de Países Bajos (ver anomalías) y con buen contraste: del 6 % al 53 % según el país. |
| Crecimiento de la población | Entra, sin media UE | Cobertura completa. Eurostat no publica agregado UE: la cifra de entrada del mapa no muestra media para este indicador. |

## Cobertura por indicador

Países con dato sobre 27, por año. Entre paréntesis, los huecos.

| Indicador | Serie | 2015–2025 | Agregado UE | Huecos y notas |
| --- | --- | --- | --- | --- |
| Precio de la vivienda | `prc_hpi_a` total, nueva y existente | 26 | 2015–2025 | Grecia no existe en el dataset: Eurostat no publica su índice. |
| Alquiler | `prc_hicp_ainr` CP0411 | 27 | 2015–2025 | Sin huecos ni flags. |
| Precio frente a renta | derivado | 26 hasta 2023 | calculado | Hereda la falta de Grecia y el final de la renta en 2023. |
| Sobrecarga | `ilc_lvho07a` total y 20–29 años | 27 (Francia falta en 2021) | 2015–2025 | 4 años del agregado UE son estimados (`e`). |
| Sobrecarga por tenencia | `ilc_lvho07c` | 27 (Francia 2021) | 2015–2025 | Alquiler reducido: Dinamarca no tiene ningún año y Rumanía falta en 2015. |
| Régimen de tenencia | `ilc_lvho02` | 27 | 2015–2025 | Las cuatro categorías suman 100 en todos los países y años. |
| Edad de emancipación | `yth_demo_030` | 27 | 2015–2025 | 11 % de observaciones con ruptura (`b`). |
| Paro | `lfst_r_lfu3rt` | 27 | 2015–2025 | NUTS 2: entre 224 y 235 regiones según el año; en 2025 faltan DEB2, FI20 y PL43. |
| Renta por habitante | `nama_10r_2hhinc` | 27 hasta 2023 | 2015–2023 | NUTS 2: 236 regiones en 2015–2023. |
| Intensidad turística | `tour_occ_nin2` P_THAB | 27 (Irlanda 2017, Eslovenia 2018) | 2015–2025 | NUTS 2: 195 regiones en 2015–2016, entre 223 y 229 en 2017–2022 y 236 desde 2023 (códigos antiguos, ver abajo). |
| Crecimiento de la población | `demo_r_gind3` | 27 | no existe | NUTS 2: 236 regiones hasta 2024 (saldo migratorio: 233 en 2015–2019). El nivel regional acaba en 2024. |

## Códigos NUTS

Las series regionales mezclan versiones en los años antiguos. Con NUTS 2024 quedan sin geometría, y por tanto «sin dato» en el mapa NUTS 2:

- Turismo 2015–2016: las antiguas regiones francesas (`FR21`…`FRA5`), `HU10`, `IE01`, `IE02`, `LT00` y `PL11`…`PL34` (NUTS 2013).
- Turismo hasta 2022–2023, población hasta 2021–2022 y paro hasta 2018: `NL31`, `NL33` y `PT16`–`PT18` (NUTS 2021).
- `HR04` (NUTS 2016) en los primeros años de turismo, población y paro.
- La renta incluye códigos `XXZZ` («extra-regio»): no son regiones y el modelo debe descartarlos.

En sentido contrario, toda geometría NUTS 2024 continental tiene dato en el último año de cada serie (2023 en la renta) salvo las tres regiones de paro citadas.

## Flags

Porcentaje de observaciones con flag en los países (y regiones, donde aplica):

- Alquiler: 0 %. Precio de la vivienda: 2 % (`b`, `p`). Turismo: 4 % (`e`, `u`); no aparece ningún confidencial (`c`), que la especificación temía en NUTS 2.
- Sobrecarga y tenencia: 6–7 % (`b`, `p`). Emancipación: 11 % (`b`). Población: 10 % (`b`, `e`, `p` y combinaciones).
- Renta en NUTS 2: 31 % (`e`, `p`). Paro en NUTS 2: 25 % (`b`, `d`, `u` y combinaciones).
- Aparece un flag no previsto: `n` («no significativo»), en el alquiler reducido de Dinamarca. Se conserva como los demás.

## Valores y anomalías

No hay unidades erróneas: todos los rangos son plausibles. Las anomalías relevantes:

- **Países Bajos, tenencia 2021.** El alquiler de mercado cae del 30,1 % al 4,0 % y el reducido sube del 0,8 % al 25,9 %, sin flag de ruptura: el alquiler social pasa a contarse como reducido. El alquiler total apenas cambia (30,9 → 29,9 %). Hay que anotarlo en la tarjeta de tenencia y en la sobrecarga por tenencia.
- **Algarve (PT15), población.** −61 ‰ en 2020 y +144 ‰ en 2022, con flag `b` en 2022 por la revisión del censo de 2021.
- **Sobrecarga en países pequeños.** Saltos de más del 50 % entre años en Eslovaquia, Lituania o Malta, sobre porcentajes bajos (del 2 % al 6 %, por ejemplo): ruido de muestra de la EU-SILC, no errores.
- **Turismo en el Egeo Meridional (EL42).** 128 noches por habitante en 2025, el máximo regional; es real.
- **Índices en base 2025.** Precios y alquiler valen 100 en 2025 y algunos países superan 100 antes (Luxemburgo, 118 en 2022). El rebase a 2015 del modelo lo corrige.

## Consecuencias para el modelo (0.7)

- Geometrías y regiones: solo NUTS 2024.
- Renta: PPS por habitante como indicador; moneda nacional por habitante (`MIO_NAC × EUR_HAB / MIO_EUR`) solo para el derivado. Descartar 2024 y los códigos `XXZZ`.
- Tenencia: `mapCategory` = alquiler total.
- Crecimiento de la población: indicador del catálogo, sin agregado UE.
- Conservar el flag `n` junto a `e`, `p`, `b`, `u`, `c` y `d`.
