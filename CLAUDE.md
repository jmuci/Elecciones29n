# CLAUDE.md

Contexto para Claude Code en este repo.

## Qué es
Web estática en español que compara, tema a tema, las propuestas de 6 partidos para las elecciones generales españolas del 29-N-2026, con enlace a la fuente oficial de cada propuesta. Autor: Jose (jmuci). Despliegue en Vercel desde `main`.

**Lee siempre `PLAN.md` (alcance, stack, modelo de datos, fases) y `CONTRIBUTING.md` (reglas de neutralidad) antes de tocar contenido.**

## Reglas no negociables
- Todo contenido en `src/content/` cumple las reglas de neutralidad de `CONTRIBUTING.md`.
- Solo fuentes oficiales de los partidos. Nunca inventes una propuesta, una página ni una URL. Si no encuentras la fuente, el estado es `no_publicado` o `parcial`, nunca rellenes.
- Resúmenes con paráfrasis propia; como mucho una cita literal breve (<15 palabras) por propuesta.
- Orden fijo de partidos: pp, psoe, vox, frente-amplio, podemos, democracia-21.
- No distinguir visualmente a ningún partido.
- El texto de cara al usuario va en español; el código y los identificadores, en inglés o español según convenga, pero de forma consistente.

## Stack
Astro (salida estática) + TypeScript, content collections con Zod, Vercel, GitHub Actions.

## Comandos
- `npm ci` — instala dependencias (Node 26, ver `.nvmrc`)
- `npm run dev` — servidor de desarrollo
- `npm run build` — build estático a `dist/`
- `npm run preview` — sirve el build
- `npm run check` — `astro check` (tipos TS/Astro)
- `npm run check:content` — valida referencias fuente/partido/tema y fuentes huérfanas (`ELECCIONES_EJEMPLO=1` incluye los datos ficticios)

## Autor
Jose es ingeniero senior (Android/Kotlin); no hace falta explicar fundamentos. Prefiere diffs a reescrituras completas.
