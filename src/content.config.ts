/**
 * Colecciones de contenido (modelo de datos de PLAN.md §3).
 *
 * Rutas e ids:
 * - partidos:   src/content/partidos/<id>.yaml           → id = <id>
 * - temas:      src/content/temas/<id>.yaml              → id = <id>
 * - fuentes:    src/content/fuentes/<id>.yaml            → id = <id>
 * - propuestas: src/content/propuestas/<partido>/<tema>.yaml → id = <partido>/<tema>
 *
 * El id sale siempre de la ruta del fichero. Los YAML no llevan campo `id`:
 * todos los objetos son estrictos, así que un `id` (o cualquier clave mal
 * escrita) hace fallar el build. En `propuestas`, `partido` y `tema` deben
 * coincidir con la carpeta y el nombre del fichero.
 *
 * Referencias (`partido`, `tema`, `fuente`): Astro 7 solo avisa en el log si
 * apuntan a una entrada inexistente; `src/middleware.ts` hace fallar el build
 * en ese caso (ver src/lib/referencias.ts).
 *
 * Datos de ejemplo: `INCLUIR_EJEMPLO` (src/lib/ejemplo.ts) es true en
 * `astro dev` o con `ELECCIONES_EJEMPLO=1`, y false en `astro build` por
 * defecto. Cuando es false, los globs excluyen estos ficheros y no se cargan:
 * - src/content/partidos/ejemplo.yaml
 * - src/content/fuentes/ejemplo-*.yaml
 * - src/content/propuestas/ejemplo/*.yaml
 * La misma regla está replicada en `esEjemplo` de scripts/check-content.ts.
 * Las entradas ficticias deben llevar `ficticio: true` (partidos y fuentes)
 * para que la UI las etiquete.
 */
import { defineCollection, reference } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { INCLUIR_EJEMPLO } from './lib/ejemplo';
import { ESTADOS, ESTADOS_SIN_PROPUESTAS, TIPOS_AMBITO, TIPOS_FUENTE } from './lib/modelo';

const yamlGlob = (base: string, pattern: string, excluirEjemplo?: string) =>
  glob({
    base,
    pattern: INCLUIR_EJEMPLO || !excluirEjemplo ? pattern : [pattern, `!${excluirEjemplo}`],
    generateId: ({ entry }) => entry.replace(/\.ya?ml$/, ''),
  });

const fecha = z.coerce.date();
const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color en formato #RRGGBB');
const textoNoVacio = z.string().trim().min(1, 'No puede estar vacío');

const partidos = defineCollection({
  loader: yamlGlob('./src/content/partidos', '*.yaml', 'ejemplo.yaml'),
  schema: z.strictObject({
    nombre: textoNoVacio,
    nombre_corto: textoNoVacio,
    /** Orden fijo de PLAN.md §1 (pp=1 … democracia-21=6). */
    orden: z.number().int().positive(),
    ambito: z.strictObject({
      tipo: z.enum(TIPOS_AMBITO),
      /** Texto visible en la UI, p. ej. "Solo Madrid y Barcelona". */
      etiqueta: textoNoVacio,
      /** Coaliciones regionales y demás matices de ámbito. */
      notas: z.array(textoNoVacio).optional(),
    }),
    web: z.url(),
    /** Solo de apoyo visual; nunca único portador de información. */
    colores: z
      .strictObject({ primario: hexColor.optional(), secundario: hexColor.optional() })
      .optional(),
    ficticio: z.boolean().default(false),
  }),
});

const temas = defineCollection({
  loader: yamlGlob('./src/content/temas', '*.yaml'),
  schema: z.strictObject({
    nombre: textoNoVacio,
    descripcion: textoNoVacio.optional(),
    subtemas: z.array(textoNoVacio),
    orden: z.number().int().positive(),
  }),
});

const fuentes = defineCollection({
  loader: yamlGlob('./src/content/fuentes', '*.yaml', 'ejemplo-*.yaml'),
  schema: z.strictObject({
    partido: reference('partidos'),
    titulo: textoNoVacio,
    url: z.url(),
    tipo: z.enum(TIPOS_FUENTE),
    publicado: fecha.optional(),
    consultado: fecha,
    /** Snapshot en Wayback Machine. */
    archivo: z.url().optional(),
    sha256: z
      .string()
      .regex(/^[0-9a-f]{64}$/, 'sha256 debe tener 64 caracteres hexadecimales en minúscula')
      .optional(),
    /**
     * Documento oficial anterior a la convocatoria del 29N, admitido con aviso
     * (CONTRIBUTING §1.4). Se marca a mano y solo con evidencia de la fecha del
     * documento (fecha impresa, metadatos del PDF, ruta de subida); no se
     * calcula a partir de `publicado`. La UI muestra el aviso junto a cada
     * propuesta que cita la fuente y en /fuentes.
     */
    anterior_a_convocatoria: z.boolean().default(false),
    ficticio: z.boolean().default(false),
  }),
});

const MAX_PALABRAS_CITA = 14; // "menos de 15 palabras" (CONTRIBUTING §1.6)

const propuesta = z.strictObject({
  /** Uno o varios de los `subtemas` del tema (lo comprueba `check:content`). */
  subtema: z.union([textoNoVacio, z.array(textoNoVacio).min(1)]).optional(),
  resumen: textoNoVacio,
  cita: textoNoVacio
    .refine((s) => s.split(/\s+/).length <= MAX_PALABRAS_CITA, {
      message: `La cita literal debe tener menos de 15 palabras (máximo ${MAX_PALABRAS_CITA})`,
    })
    .optional(),
  fuente: reference('fuentes'),
  /** Número de página del documento, o el nombre de la sección si no hay paginación. */
  pagina: z.union([z.number().int().positive(), textoNoVacio], {
    error: (issue) =>
      issue.input === undefined
        ? 'Falta `pagina`: indica la página (entero positivo) o la sección'
        : '`pagina` debe ser un entero positivo o el nombre de una sección',
  }),
  /**
   * Reservado para el test de afinidad (fase posterior). Sin forma definida
   * todavía: se acepta cualquier valor y la UI no lo usa.
   */
  posicion: z.unknown().optional(),
});

const propuestas = defineCollection({
  loader: glob({
    base: './src/content/propuestas',
    pattern: INCLUIR_EJEMPLO ? '*/*.yaml' : ['*/*.yaml', '!ejemplo/**'],
    generateId: ({ entry, data }) => {
      const id = entry.replace(/\.ya?ml$/, '');
      const [partido, tema] = id.split('/');
      if (data.partido !== partido || data.tema !== tema) {
        throw new Error(
          `propuestas/${entry}: \`partido\` y \`tema\` deben coincidir con la ruta ` +
            `(esperado partido: ${partido}, tema: ${tema}; encontrado partido: ${String(data.partido)}, tema: ${String(data.tema)})`,
        );
      }
      return id;
    },
  }),
  schema: z
    .strictObject({
      partido: reference('partidos'),
      tema: reference('temas'),
      estado: z.enum(ESTADOS),
      revisado: fecha,
      propuestas: z.array(propuesta),
      /**
       * Documentos del partido revisados para esta celda, citen o no alguna
       * propuesta (p. ej. los que se comprobaron para un `no_publicado`).
       * `check:content` los cuenta como referencia de la fuente.
       */
      fuentes_revisadas: z.array(reference('fuentes')).optional(),
    })
    .superRefine((celda, ctx) => {
      const n = celda.propuestas.length;
      const debeEstarVacia = (ESTADOS_SIN_PROPUESTAS as readonly string[]).includes(celda.estado);
      if (debeEstarVacia && n > 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['propuestas'],
          message: `Con estado \`${celda.estado}\` la lista \`propuestas\` debe estar vacía (tiene ${n}). Usa \`parcial\` o \`completo\` si hay propuestas.`,
        });
      }
      if (!debeEstarVacia && n === 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['propuestas'],
          message: `Con estado \`${celda.estado}\` hace falta al menos una propuesta. Si no hay ninguna, usa \`sin_propuesta\` o \`no_publicado\`.`,
        });
      }
    }),
});

export const collections = { partidos, temas, fuentes, propuestas };
