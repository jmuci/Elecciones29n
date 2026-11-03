/**
 * Colecciones de contenido (modelo de datos de PLAN.md §3).
 *
 * Rutas e ids:
 * - partidos:   src/content/partidos/<id>.yaml           → id = <id>
 * - temas:      src/content/temas/<id>.yaml              → id = <id>
 * - fuentes:    src/content/fuentes/<id>.yaml            → id = <id>
 * - propuestas: src/content/propuestas/<partido>/<tema>.yaml → id = <partido>/<tema>
 * - gobiernos:  src/content/gobiernos/<id>.yaml          → id = <id>   (sección /historia)
 * - casos:      src/content/casos/<id>.yaml              → id = <id>   (sección /historia#corrupcion)
 * - recuentos:  src/content/recuentos/<id>.yaml          → id = <id>   (estudios de terceros)
 * - encuestas:  src/content/encuestas/<id>.yaml           → id = <id>
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
import {
  BLOQUES,
  ESTADOS,
  ESTADOS_SIN_PROPUESTAS,
  IDS_OTROS,
  PARTIDOS_ENCUESTA,
  TIPOS_AMBITO,
  TIPOS_FUENTE,
  TIPOS_FUENTE_ENCUESTA,
  TIPOS_FUENTE_HISTORIA,
  TOTAL_ESCANOS,
} from './lib/modelo';

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

/** Fuente de la sección /historia: prensa, sentencias, estudios… (no son fuentes de partido). */
const fuenteHistoria = z.strictObject({
  medio: textoNoVacio,
  titulo: textoNoVacio,
  url: z.url(),
  tipo: z.enum(TIPOS_FUENTE_HISTORIA),
  fecha: fecha.optional(),
});

/** Logro o crítica: un hecho verificable con al menos una fuente. */
const hecho = z.strictObject({
  titulo: textoNoVacio,
  descripcion: textoNoVacio,
  fuentes: z.array(fuenteHistoria).min(1, 'Cada hecho necesita al menos una fuente'),
});

const gobiernos = defineCollection({
  loader: yamlGlob('./src/content/gobiernos', '*.yaml'),
  schema: z.strictObject({
    presidente: textoNoVacio,
    partido: reference('partidos'),
    /** Solo para colorear la línea de tiempo (src/lib/historia.ts). */
    bloque: z.enum(BLOQUES),
    inicio: fecha,
    /** Sin fecha = sigue en el cargo. */
    fin: fecha.optional(),
    orden: z.number().int().positive(),
    resumen: textoNoVacio,
    apoyos: textoNoVacio.optional(),
    destacados: z.array(z.strictObject({ nombre: textoNoVacio, cargo: textoNoVacio })).min(1),
    /**
     * Entorno en el que gobernó, sin atribuir causas ni méritos al Gobierno:
     * `internacional` recoge guerras, crisis y decisiones exteriores que afectaron a España;
     * `economia_global` el ciclo económico y monetario mundial y europeo.
     */
    contexto: z.strictObject({
      internacional: z.array(hecho),
      economia_global: z.array(hecho),
    }),
    /**
     * Dos lecturas de la misma economía: `macro` son las cifras agregadas (PIB, empleo, precios,
     * cuentas públicas); `percepcion` cómo la valoró y la vivió la ciudadanía (encuestas, condiciones
     * de vida). Pueden no coincidir, y la web las muestra por separado a propósito.
     */
    economia: z.strictObject({
      macro: z.array(hecho),
      percepcion: z.array(hecho),
    }),
    logros: z.array(hecho),
    criticas: z.array(hecho),
    /** Aviso visible cuando la revisión de fuentes no está terminada. */
    nota_revision: textoNoVacio.optional(),
    revisado: fecha,
  }),
});

const casos = defineCollection({
  loader: yamlGlob('./src/content/casos', '*.yaml'),
  schema: z
    .strictObject({
      nombre: textoNoVacio,
      /** Partido de la web al que se asocia el caso, o `otro_partido` si no es uno de los seis. */
      partido: reference('partidos').optional(),
      otro_partido: textoNoVacio.optional(),
      territorio: textoNoVacio,
      resumen: textoNoVacio,
      firme: z.strictObject({ tribunal: textoNoVacio, fecha }),
      condenas: z
        .array(z.strictObject({ persona: textoNoVacio, cargo: textoNoVacio, pena: textoNoVacio }))
        .min(1),
      /** Qué se le impuso al partido como tal (p. ej. partícipe a título lucrativo), si algo. */
      responsabilidad_partido: textoNoVacio.optional(),
      cuantia: z.strictObject({ euros: z.number().positive(), concepto: textoNoVacio }).optional(),
      /** Cambios posteriores a la sentencia (p. ej. anulación parcial por el Constitucional). */
      nota: textoNoVacio.optional(),
      fuentes: z.array(fuenteHistoria).min(1),
      revisado: fecha,
    })
    .refine((c) => (c.partido === undefined) !== (c.otro_partido === undefined), {
      message: 'Indica `partido` (uno de la web) o `otro_partido`, pero no ambos',
    }),
});

const recuentos = defineCollection({
  loader: yamlGlob('./src/content/recuentos', '*.yaml'),
  schema: z.strictObject({
    titulo: textoNoVacio,
    autoria: textoNoVacio,
    url: z.url(),
    publicado: fecha,
    /** Periodo y ámbito que cubre el recuento. */
    alcance: textoNoVacio,
    metodologia: textoNoVacio,
    cifras: z
      .array(z.strictObject({ concepto: textoNoVacio, partido: textoNoVacio.optional(), valor: textoNoVacio }))
      .min(1),
    limitaciones: z.array(textoNoVacio).min(1),
    orden: z.number().int().positive(),
    revisado: fecha,
  }),
});

const porcentaje = z.number().min(0).max(100);
const rangoEscanos = z
  .strictObject({
    min: z.number().int().min(0).max(TOTAL_ESCANOS),
    max: z.number().int().min(0).max(TOTAL_ESCANOS),
  })
  .refine((r) => r.min <= r.max, { message: '`min` no puede superar a `max`' });
/** Escaños de un partido: una cifra o una horquilla {min, max}. */
const escanos = z.union([z.number().int().min(0).max(TOTAL_ESCANOS), rangoEscanos]);

const porClaves = <K extends string, T extends z.ZodType>(claves: readonly K[], valor: T) =>
  z.strictObject(Object.fromEntries(claves.map((k) => [k, valor.optional()])) as Record<K, z.ZodOptional<T>>);

const encuestas = defineCollection({
  loader: yamlGlob('./src/content/encuestas', '*.yaml'),
  schema: z
    .strictObject({
      instituto: textoNoVacio,
      /** Medio que la publica o encarga; ausente en el CIS. */
      medio: textoNoVacio.optional(),
      /** `cis` se muestra aparte de las demás (PLAN.md §7). */
      tipo: z.enum(['privada', 'cis']),
      campo_inicio: fecha,
      campo_fin: fecha,
      muestra: z.number().int().positive().optional(),
      /** Seguimiento continuo cuyo campo abarca varias semanas. */
      acumulada: z.boolean().default(false),
      /** % de voto por partido; solo los que la encuesta desglosa. */
      votos: porClaves(PARTIDOS_ENCUESTA, porcentaje),
      /** Escaños por partido; omitido el partido que la fuente no desglosa. */
      escanos: porClaves(PARTIDOS_ENCUESTA, escanos).optional(),
      /** Escaños de otras fuerzas (el «Resto»), solo si la fuente los desglosa con fiabilidad. */
      otros_escanos: porClaves(IDS_OTROS, escanos).optional(),
      fuentes: z
        .array(
          z.strictObject({
            titulo: textoNoVacio,
            url: z.url(),
            tipo: z.enum(TIPOS_FUENTE_ENCUESTA),
          }),
        )
        .min(1),
      nota: textoNoVacio.optional(),
      consultado: fecha,
    })
    .superRefine((e, ctx) => {
      if (e.campo_fin < e.campo_inicio)
        ctx.addIssue({ code: 'custom', path: ['campo_fin'], message: '`campo_fin` es anterior a `campo_inicio`' });
      const suma = [...Object.values(e.escanos ?? {}), ...Object.values(e.otros_escanos ?? {})].reduce<number>(
        (acc, v) => acc + (v === undefined ? 0 : typeof v === 'number' ? v : v.min),
        0,
      );
      if (suma > TOTAL_ESCANOS)
        ctx.addIssue({ code: 'custom', path: ['escanos'], message: `Los escaños suman más de ${TOTAL_ESCANOS} (${suma})` });
    }),
});

export const collections = { partidos, temas, fuentes, propuestas, encuestas, gobiernos, casos, recuentos };
