# Elecciones29n — Plan de trabajo

Web personal y sin ánimo de lucro para comparar, tema a tema, lo que proponen los principales partidos para las **elecciones generales del 29 de noviembre de 2026**, siempre con enlace a la fuente oficial de cada propuesta.

- **Autor:** Jose Mucientes (ciudadano particular, sin afiliación a ningún partido).
- **Idioma de la web:** español.
- **Despliegue:** Vercel, desde este repositorio (`main` → producción, PRs → preview).

---

## 1. Alcance

### Partidos cubiertos (orden fijo en toda la web)

El orden sigue los escaños obtenidos en las generales de julio de 2023, y los partidos nuevos van al final. No implica ninguna valoración.

| id | Partido | Ámbito el 29N | Notas |
|---|---|---|---|
| `pp` | Partido Popular | Toda España | |
| `psoe` | PSOE | Toda España | |
| `vox` | Vox | Toda España | |
| `frente-amplio` | Frente Amplio (Movimiento Sumar, IU, Más Madrid, Comuns y aliados) | Casi toda España, con marcas regionales | Candidata: Ada Colau. Coaliciones regionales: Compromís-Front Valencià (incluye a Podemos), Chunta Aragonesista-Frente Amplio Aragón, Ara Més-Frente Amplio (Baleares), Frente Amplio por Andalucía, candidatura conjunta con Podemos en Canarias. |
| `podemos` | Podemos | Casi toda España | En Canarias y en la Comunidad Valenciana concurre en candidaturas conjuntas con Frente Amplio. En Cataluña tiene un acuerdo con ERC. |
| `democracia-21` | Democracia 21 (en coalición con Ciudadanos y UCIN) | **Solo Madrid y Barcelona** | Partido nuevo. A 2 de noviembre de 2026 ha publicado dos planes: vivienda y regeneración ("España limpia"). |

> El ámbito de cada partido debe mostrarse siempre en la UI (etiqueta visible), para que nadie crea que puede votar a un partido que no se presenta en su provincia.

### Secciones de la web (roadmap)

| # | Sección | Estado |
|---|---|---|
| 1 | **Comparador de propuestas** (un desplegable por tema con los partidos en orden fijo, con enlace a fuente) | 🟡 En curso (prioridad) |
| 2 | **Fuentes**: listado de todos los documentos oficiales usados | 🟡 Sale del mismo modelo de datos |
| 3 | **Quién soy y por qué lo hago** | ⚪ Pendiente (texto) |
| 4 | **Estadísticas / encuestas**: hemiciclos con las proyecciones de escaños y sus fuentes (`/encuestas`, colección `encuestas`) | 🟡 Primera versión (2-nov): 10 encuestas con escaños + CIS aparte. Pendiente: contrastar cada cifra con la ficha original y actualizar hasta el 23-nov |
| 5 | **Test de afinidad** (`/test`, colección `preguntas`): 1–2 preguntas por tema; cada respuesta resume la propuesta de uno o varios partidos sin nombrarlos y enlaza su fuente y página; importancia 1–5 por pregunta | 🟡 Primera versión (2-nov): 23 preguntas. Pendiente: revisión humana y rehacerlas cuando se publiquen los programas |
| 6 | **Historia** (`/historia`): línea de tiempo 2000–2026 coloreada por bloque (derecha = rojo, izquierda = azul), una sección por gobierno con presidente, cargos destacados, contexto internacional y economía global, macroeconomía y percepción ciudadana, logros y críticas, con fuentes de prensa, datos oficiales, sentencias o estudios. Las cifras económicas se ven también en gráficas con pestañas (macro y percepción por separado, franjas de cada gobierno de fondo, leyenda pulsable, tooltip y tabla de datos) y en minigráficas dentro de cada gobierno | 🟡 Primera pasada (4 gobiernos; faltan logros de Aznar y Rajoy) |
| 7 | **Corrupción** (`/historia#corrupcion`): recuentos de terceros con su metodología y límites, casos con sentencia firme desde 2000 y gráficas de casos por legislatura y por partido (últimos 20 años) con el importe de cada sentencia cuando dos fuentes lo recogen | 🟡 Primera pasada (11 casos; no exhaustivo) |

---

## 2. Stack técnico

- **Astro** (salida estática) + **TypeScript**.
- **Content collections** de Astro con schemas **Zod**: los datos viven en YAML dentro de `src/content/` y se validan en build. Si un dato no cumple el schema, el build falla.
- **Estilos:** CSS propio o Tailwind (a decidir). La prioridad es que la tabla funcione en el móvil.
- **Vercel:** proyecto importado desde GitHub, sin configuración especial.
- **GitHub Actions:** validación en cada PR y comprobación periódica de cambios en las fuentes.

### Estructura propuesta

```
src/
  content/
    partidos/        # un YAML por partido (nombre, colores, ámbito, web oficial)
    temas/           # un YAML por tema (id, nombre, descripción, subtemas, orden)
    fuentes/         # un YAML por documento oficial
    propuestas/
      <partido>/
        <tema>.yaml  # una celda de la tabla = un fichero
  content.config.ts  # schemas Zod
  pages/
    index.astro      # tabla comparativa
    tema/[tema].astro
    fuentes.astro
    quien-soy.astro
  components/
scripts/
  check-sources.ts   # descarga fuentes, compara hash, avisa de cambios
.github/workflows/
  validate.yml       # build + schema + enlaces en cada PR
  sources-watch.yml  # cron: detecta cambios en los PDFs oficiales
```

---

## 3. Modelo de datos

### Fuente (`src/content/fuentes/<id>.yaml`)

```yaml
id: pp-programa-29n
partido: pp
titulo: "Programa electoral elecciones generales 2026"
url: https://...                 # URL oficial en la web del partido
tipo: programa                   # programa | manifiesto | plan_sectorial | documento_politico | argumentario | web | nota_prensa
publicado: 2026-11-xx            # si se conoce
consultado: 2026-11-xx           # obligatorio
archivo: https://web.archive.org/web/...   # snapshot en Wayback Machine
sha256: "..."                    # hash del fichero descargado (para detectar cambios)
anterior_a_convocatoria: false   # true si es anterior a la convocatoria del 29N (CONTRIBUTING §1.4); se muestra un aviso
```

Solo se admiten **fuentes oficiales del partido**: su web, sus PDFs y sus notas de prensa. La prensa puede servir para *descubrir* una propuesta, pero la celda debe enlazar al documento del partido. Si no existe documento oficial, la propuesta no entra.

### Celda partido × tema (`src/content/propuestas/<partido>/<tema>.yaml`)

```yaml
partido: pp
tema: vivienda
estado: parcial      # completo | parcial | sin_propuesta | no_publicado
revisado: 2026-11-xx
propuestas:
  - subtema: alquiler
    resumen: "Redacción propia, neutra, 1–2 frases."
    cita: "Opcional, literal y breve, solo si la redacción exacta importa"
    fuente: pp-programa-29n
    pagina: 34
    # posicion: reservado para el test de afinidad (fase posterior)
fuentes_revisadas:   # opcional: documentos revisados para esta celda, citen o no propuestas
  - pp-programa-29n
```

### Significado de `estado`

| Estado | Significa | Cómo se muestra |
|---|---|---|
| `completo` | Revisado el documento completo; todas las propuestas del tema están recogidas | Normal |
| `parcial` | Hay propuestas, pero la revisión no está terminada o el partido solo ha publicado una parte | Aviso "revisión parcial" |
| `sin_propuesta` | El programa está publicado y revisado, y **no dice nada** sobre este tema | "El programa no incluye propuestas sobre este tema" |
| `no_publicado` | El partido **aún no ha publicado** documento que cubra este tema | Gris: "Pendiente de publicación" |

La distinción entre `sin_propuesta` y `no_publicado` es obligatoria. Confundirlas sería injusto con los partidos que aún no han publicado su programa.

---

## 4. Taxonomía de temas

Lista cerrada. Añadir un tema requiere un PR que lo cree para **todos** los partidos a la vez, con el estado que corresponda.

| Orden | id | Tema | Subtemas orientativos |
|---|---|---|---|
| 1 | `vivienda` | Vivienda | alquiler, oferta y construcción, vivienda pública, compra y propiedad, jóvenes, okupación, desahucios |
| 2 | `inmigracion` | Inmigración | regularización, fronteras, expulsiones, nacionalidad, integración, servicios y prestaciones, asilo |
| 3 | `impuestos` | Impuestos | fiscalidad general, IRPF, IVA, sociedades, patrimonio y sucesiones, autónomos, vivienda, otros |
| 4 | `empleo` | Empleo y salarios | SMI, jornada, contratación, desempleo |
| 5 | `pensiones` | Pensiones | revalorización, sostenibilidad, edad de jubilación |
| 6 | `sanidad` | Sanidad | listas de espera, atención primaria, salud mental |
| 7 | `educacion` | Educación | universidad, FP, becas, 0–3 años |
| 8 | `energia-clima` | Energía y clima | nuclear, renovables, precio de la luz, agua |
| 9 | `regeneracion` | Regeneración institucional | corrupción, justicia, independencia de órganos |
| 10 | `territorial` | Modelo territorial | financiación autonómica, Cataluña, lenguas |
| 11 | `seguridad-justicia` | Seguridad y justicia | multirreincidencia, policía, okupación penal |
| 12 | `familia` | Familia y natalidad | permisos, ayudas por hijo, conciliación |
| 13 | `igualdad-derechos` | Igualdad y derechos | igualdad, LGTBI, aborto, eutanasia |
| 14 | `exterior-defensa` | Exterior y defensa | UE, OTAN, gasto en defensa |

**Piloto:** `vivienda`, `inmigracion` e `impuestos`.

Los subtemas son cerrados: cada propuesta lleva uno o varios de la lista de su tema (`src/content/temas/<tema>.yaml`), y `check:content` falla si no. Los de los temas piloto se ampliaron en la Fase 1 con lo que traían los documentos; los demás temas son orientativos hasta que se revisen.

---

## 5. Fases y tareas

### Fase 0 · Arranque del repo
- [x] Inicializar Astro + TypeScript en este repo.
- [x] Definir los schemas Zod de `partidos`, `temas`, `fuentes` y `propuestas`.
- [x] Crear los YAML de los 6 partidos y los 14 temas.
- [x] Conectar el repo a Vercel. Comprobar que se despliega y que los PRs generan preview.

### Fase 1 · Inventario de fuentes oficiales
- [x] Localizar, para cada partido, el programa electoral del 29N y los planes sectoriales en su web oficial (primera pasada, 2-nov). Pendiente: Podemos (podemos.info bloquea el acceso con una verificación de Cloudflare).
- [x] Registrar cada documento en `fuentes/` con fecha de consulta, snapshot en Wayback Machine y hash.
- [x] Marcar como `no_publicado` lo que aún no exista. Las celdas piloto con documento se han redactado ya (adelanto de la Fase 2).
- [ ] **Segunda pasada el 13–14 de noviembre** (inicio de campaña): es probable que se publiquen o actualicen programas.

### Fase 2 · Piloto (vivienda, inmigración, impuestos)
- [x] Extraer y redactar las propuestas de los 6 partidos en los 3 temas, siguiendo `CONTRIBUTING.md` (auditadas contra la fuente en #12 y #13; criterios de Jose en #14).
- [ ] Revisión humana de cada celda contra la fuente (página incluida).
- [x] Ajustar el schema si el piloto revela carencias (subtemas cerrados por tema, `fuentes_revisadas`, tipos `manifiesto` y `argumentario`, `anterior_a_convocatoria`).

### Fase 3 · Interfaz del comparador
- [x] **Una sola vista (escritorio y móvil):** una sección desplegable por tema, plegada por defecto. Al desplegarla aparecen los 6 partidos en el orden fijo, cada uno con sus propuestas y el enlace a la fuente con página. Sustituye a la tabla temas × partidos, que se leía mal.
- [x] Selector para comparar 2–3 partidos (se aplica a todos los temas y, en pantallas anchas, los muestra en columnas), botones para desplegar o plegar todo y enlace directo a un tema (`/#vivienda`).
- [x] Índice de temas al principio de la página.
- [x] Comparaciones compartibles: la selección de partidos se guarda en la URL (`?partidos=pp,psoe`).
- [x] Filtro por subtema dentro de cada tema, con los subtemas que usan sus propuestas.
- [x] Etiquetas de ámbito (D21 solo Madrid/Barcelona; coaliciones regionales).
- [x] Indicadores de `estado` y fecha de última revisión por celda.
- [x] Página `/fuentes` generada desde la colección `fuentes`.
- [x] Accesibilidad básica: contraste, navegación por teclado, las secciones legibles con lector de pantalla.
- [x] Colores de partido solo como apoyo, nunca como único portador de información.

### Fase 4 · Resto de temas
- [x] Completar los 11 temas restantes para los 6 partidos (primera pasada, 2–3 nov, PRs #15–#18). Las 84 celdas: 53 `parcial`, 31 `no_publicado`, ninguna `completo`.
- [ ] Revisión humana de los 11 temas contra la fuente (dudas de neutralidad y selección anotadas en la descripción de cada PR).
- [ ] Archivar en Wayback la nota del PSOE de Gijón (`psoe-nota-pensiones-constitucion-gijon`): la captura automática guarda el muro de Incapsula.

### Fase 5 · Flujo de actualización
- [x] `validate.yml`: build de Astro (que valida los schemas), comprobación de que cada propuesta tiene `fuente` existente y `pagina`, y comprobación de que las URLs responden (job `enlaces`, `scripts/check-links.ts`: HEAD y, si falla, GET; clasifica ok/redirección/bloqueado antibots/roto; solo falla si `archivo` está roto o `url` rota sin snapshot, el resto es warning; no bloquea el job `validate`).
- [x] `sources-watch.yml`: cron diario hasta el 29-nov-2026 (el job se omite después) y `workflow_dispatch`. Ejecuta `scripts/check-sources.ts`, que descarga cada fuente con `sha256`, compara el hash y distingue hash distinto, error HTTP/red y redirección; las fuentes sin hash se listan aparte sin contar como error. Abre o actualiza un único issue por fuente (label `fuente-cambiada`, título `Fuente cambiada: <id>`) y no hace commits.
  - Nota: pasada la campaña, cambiar el cron a semanal (p. ej. `17 6 * * 1`) y quitar la guarda de fecha.
- [x] Ciclo de edición: editar YAML → PR → preview de Vercel → merge (usado en #12–#19).

### Fase 6 · Pulido y publicación
- [ ] Página "Quién soy y por qué lo hago".
- [x] Aviso visible: "Resúmenes propios; la fuente oficial siempre prevalece. Última actualización: …".
- [x] Formulario o enlace para reportar errores (issue de GitHub).
- [ ] Dominio propio (opcional).

---

## 6. Calendario objetivo

| Fecha | Hito |
|---|---|
| 2–6 nov | Fase 0 + Fase 1 (primera pasada) |
| hasta 13 nov | Piloto de 3 temas publicado en Vercel |
| 13–14 nov | Inicio de campaña: segunda pasada de fuentes |
| hasta 20–22 nov | Todos los temas revisados |
| 23 nov | Último día legal para publicar encuestas (afecta a la futura sección de estadísticas) |
| 24–28 nov | Prohibido publicar encuestas nuevas. La tabla de propuestas sí puede actualizarse |
| 29 nov | Elecciones |

---

## 7. Notas para fases posteriores

- **Test de afinidad:** presentarlo como "afinidad con cada partido" (porcentaje global y por tema), no como "deberías votar X". Los partidos que no se presentan en la provincia del usuario deben indicarse claramente.
  - Implementado sin usar `posicion`: cada respuesta de `src/content/preguntas/` enlaza la propuesta del partido por `fuente` + `pagina`, y `check:content` comprueba que existe. Un partido aparece como mucho en una respuesta por pregunta, y no aparece si no tiene propuesta sobre ella.
  - Cálculo: por partido, suma de la importancia de las preguntas en las que coincide la respuesta ÷ suma de la importancia de las preguntas en las que tiene propuesta. Se muestra sobre cuántas preguntas se calcula y un aviso si cubre menos de la mitad del peso. Resultados en el orden fijo de partidos, con la misma barra neutra para todos.
  - El orden de las respuestas se baraja con una semilla fija por pregunta, para que no siga el orden de los partidos.
  - Flujo: una página por tema, con barra de progreso (preguntas respondidas) y Anterior/Siguiente; no se avanza con preguntas sin responder que cuentan. La página en curso se guarda en el navegador.
  - Perfil (`src/lib/test-perfil.ts`): además de los porcentajes, se señala el partido más afín, pero solo entre los que cubren al menos la mitad del peso. El caso (sintonía total ≥80 %, afinidad clara ≥65 %, entre dos si los dos primeros están a menos de 10 puntos, parcial ≥50 %, transversal <50 %, faltan respuestas) elige un mensaje pregenerado; la variante sale de una huella de las respuestas, así que un enlace compartido muestra el mismo texto. Los mensajes describen la coincidencia, sin valorar a la persona ni a los partidos.
  - Mapa de cercanía: escalado multidimensional (SMACOF) sin ejes con significado. Distancia entre partidos = parte de las preguntas comunes en las que proponen respuestas distintas (igual para todo el mundo); la persona se coloca después con 1 − afinidad. Ningún partido se sitúa a mano en un eje izquierda–derecha.
  - Imagen para compartir: se dibuja en el navegador (canvas) y se comparte con la Web Share API o se descarga; no pasa por ningún servidor.
  - Las respuestas siguen las reglas de redacción de `CONTRIBUTING.md` y evitan etiquetas propias de un partido que lo identifiquen.
- **Estadísticas:** citar cada encuesta con instituto, medio, fecha de campo y tamaño muestral. Mostrar el CIS por separado de la media de institutos privados, porque sus estimaciones divergen mucho. No publicar encuestas nuevas entre el 24 y el 28 de noviembre.
- **Historia:** mismo formato para cada gobierno (contexto internacional y economía global; macroeconomía y, aparte, percepción ciudadana; logros y críticas; cada punto con fuentes y tipo de fuente visible). Las cifras macro y la percepción no se mezclan ni se atribuyen causas al Gobierno de turno. Para la percepción se usan los barómetros del CIS y Eurostat; el CIS cambió la formulación de la valoración económica en 2022 (sin «regular»), así que no se comparan porcentajes de antes y después sin avisarlo. Aquí sí se admite prensa, porque se documentan hechos y no propuestas de partido; las reglas de neutralidad de `CONTRIBUTING.md` sobre redacción siguen valiendo (verbos neutros, sin adjetivos valorativos, cifras tal cual). Las opiniones se marcan como tal. Colecciones: `gobiernos`, `casos`, `recuentos` y `graficas` en `src/content/`. Las series de `graficas` solo copian cifras que ya están en los textos de `gobiernos`, con las mismas fuentes, y nunca rellenan años sin dato (`npm run check:content` comprueba que cada cifra aparece en esos textos). Los colores de las series no son los de ningún partido ni los de los bloques.
- **Corrupción:** basarse solo en **sentencias firmes** y en las cuantías que fijan los tribunales, citando cada sentencia. Distinguir condenas a personas de responsabilidad civil o a título lucrativo del partido. Nada de casos en instrucción presentados como hechos probados.
