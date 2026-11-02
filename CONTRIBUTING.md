# Cómo contribuir a Elecciones29n

Este proyecto resume las propuestas de los partidos. El objetivo es que cualquier persona, vote lo que vote, pueda reconocer el resumen de su partido como **justo y fiel**. Las reglas de neutralidad de abajo son obligatorias para cualquier cambio en `src/content/`.

---

## 1. Reglas de neutralidad

### Fuentes
1. **Solo fuentes oficiales del partido**: programa electoral, manifiestos, planes sectoriales, argumentarios de campaña, web oficial y notas de prensa oficiales. Mientras no haya programa, se puede citar cualquiera de los otros, y el `tipo` de la fuente lo deja claro. Un artículo de prensa puede servir para *encontrar* una propuesta, pero nunca es la fuente que se enlaza.
2. **Toda propuesta lleva fuente, página (o sección) y fecha de consulta.** Sin fuente verificable, la propuesta no entra.
3. **Archivar cada documento** en Wayback Machine al registrarlo. Los partidos cambian sus PDFs y el enlace tiene que seguir siendo comprobable.
4. **No mezclar convocatorias.** Solo documentos para el 29N. Si un partido aún no ha publicado nada sobre un tema, el estado es `no_publicado`. No se rellena con el programa de 2023 ni con declaraciones sueltas.

### Redacción
5. **Paráfrasis propia.** Cada resumen se escribe con palabras propias, en 1–2 frases. No copiar párrafos del programa.
6. **Citas literales: como mucho una por propuesta, breve y entre comillas.** Solo cuando la redacción exacta cambie el significado (por ejemplo, una cifra o un compromiso concreto).
7. **Verbos neutros:** *propone*, *plantea*, *prevé*, *se compromete a*. Evitar *promete*, *pretende*, *asegura*, *dice que*, que insinúan duda o ironía.
8. **Sin adjetivos valorativos.** Nada de *ambicioso*, *polémico*, *radical*, *populista*, *valiente*, *insuficiente*… ni siquiera si los usa el propio partido sobre sí mismo.
9. **Sin interpretar.** Recoger lo que el documento dice, no lo que "en realidad significa" ni sus consecuencias previstas. Si una propuesta es ambigua, se resume con la misma ambigüedad.
10. **Sin evaluar viabilidad, coste ni constitucionalidad.** La web describe propuestas; no las juzga.
11. **Mismos términos para lo mismo.** Si dos partidos proponen lo mismo, se describe con las mismas palabras. Usar terminología descriptiva y estable ("inmigración irregular", "vivienda protegida"), no la etiqueta preferida por cada bando.
12. **Cifras tal cual.** Importes, porcentajes y plazos como aparecen en la fuente, sin redondear ni convertir.

### Equilibrio
13. **Extensión comparable.** Para un mismo tema, las celdas de los distintos partidos deben tener una extensión parecida. Si un partido detalla mucho más, se seleccionan sus propuestas principales con un máximo de **5 por tema**, y se enlaza el documento para el resto.
14. **Criterio de selección explícito.** Cuando haya que seleccionar, se priorizan: (a) las propuestas que el propio partido destaca (resumen ejecutivo, titulares del programa), y luego (b) las más concretas y medibles.
15. **Orden fijo de partidos** en toda la web (ver `PLAN.md`). No se reordena por afinidad, popularidad ni por ningún otro criterio.
16. **Mismo tratamiento visual.** Ningún partido destaca sobre otro en tamaño, posición o estilo.

### Estado de cada celda
17. Usar el `estado` correcto:
    - `completo`: documento revisado entero; propuestas del tema recogidas.
    - `parcial`: revisión incompleta, o el partido ha publicado solo una parte.
    - `sin_propuesta`: el programa existe y está revisado, y **no trata el tema**.
    - `no_publicado`: aún no hay documento que cubra el tema.
18. **Nunca marcar `sin_propuesta` sin haber revisado el documento completo.** Ante la duda, `parcial`.

### Errores y transparencia
19. **Los errores se corrigen rápido y a la vista.** Cualquier corrección queda en el historial de Git. Si un error afectaba al sentido de una propuesta, se anota en la descripción del PR.
20. **Sin publicidad, financiación ni afiliación** de ningún partido.

---

## 2. Flujo de trabajo

1. Crea una rama: `contenido/<partido>-<tema>` o `fix/<descripcion>`.
2. Edita o crea el YAML correspondiente en `src/content/`:
   - Nueva fuente → `src/content/fuentes/<id>.yaml`.
   - Propuestas → `src/content/propuestas/<partido>/<tema>.yaml`.
3. Actualiza `revisado:` con la fecha de hoy en cada celda que toques.
4. Ejecuta `npm run build` en local. Si el schema no valida, el build falla.
5. Abre un PR. Vercel genera una preview; revísala en escritorio **y en móvil**.
6. Merge a `main` → se publica en producción.

## 3. Checklist del PR

- [ ] Cada propuesta nueva o modificada tiene `fuente`, `pagina` y la fuente tiene `consultado` y `archivo`.
- [ ] He comprobado cada resumen contra el documento original, en la página indicada.
- [ ] Redacción neutra: verbos neutros y ningún adjetivo valorativo.
- [ ] Como mucho una cita literal breve por propuesta.
- [ ] La extensión es comparable a la de los otros partidos en el mismo tema.
- [ ] El `estado` es correcto (`sin_propuesta` solo tras revisión completa).
- [ ] `npm run build` pasa en local.

## 4. Cuando una fuente cambia

El workflow `sources-watch` abre un issue si el hash de un documento oficial cambia. Para resolverlo:

1. Descargar la nueva versión y archivarla en Wayback Machine.
2. Actualizar `sha256`, `consultado` y `archivo` en la fuente.
3. Revisar todas las celdas que citan esa fuente: las páginas pueden haberse movido y las propuestas pueden haber cambiado.
4. Cerrar el issue enlazando el PR.
