/**
 * Copia privada de las fuentes oficiales, como respaldo de los snapshots de
 * Wayback Machine (que a veces se retiran). Se ejecuta con Node de forma nativa:
 *   node scripts/backup-sources.ts [destino] [directorio-content]
 *
 * Destino: el argumento, o `ELECCIONES_RESPALDO`, o ~/Elecciones29n-respaldo.
 * Tiene que estar fuera del repositorio: las copias no se publican ni se
 * versionan (la fuente pública que se enlaza sigue siendo el snapshot).
 *
 * Cada documento se guarda como <destino>/<id>/<sha256>.<ext> y solo si su
 * hash coincide con el `sha256` de la fuente, así que la copia demuestra que es
 * el mismo documento que se citó. Si la `url` ya no sirve ese documento, se
 * intenta con el snapshot de `archivo`. Los ficheros ya guardados no se vuelven
 * a descargar. Escribe <destino>/manifiesto.json con el estado de cada fuente.
 * Sale con código 1 si alguna fuente con `sha256` queda sin copia verificada.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { cargarFuentes, descargar, type Fuente } from './check-sources.ts';

const sha256 = (b: Buffer): string => createHash('sha256').update(b).digest('hex');

/** Snapshot de Wayback en modo "id_": el fichero tal cual se archivó, sin la barra de navegación. */
export const snapshotCrudo = (archivo: string): string =>
  archivo.replace(/(web\.archive\.org\/web\/\d+)(?:[a-z]{2}_)?\//, '$1id_/');

/** Wayback sirve a veces el cuerpo comprimido con gzip; se descomprime antes de comparar. */
const descomprimir = (b: Buffer): Buffer => (b[0] === 0x1f && b[1] === 0x8b ? gunzipSync(b) : b);

const extension = (b: Buffer): string => (b.subarray(0, 5).toString() === '%PDF-' ? 'pdf' : 'html');

type Origen = 'url' | 'archivo';

export interface Entrada {
  id: string;
  sha256: string;
  estado: 'guardado' | 'ya_estaba' | 'sin_copia';
  origen?: Origen;
  fichero?: string;
  detalle?: string;
}

async function obtener(f: Fuente & { sha256: string }): Promise<{ cuerpo: Buffer; origen: Origen } | { detalle: string }> {
  const intentos: [Origen, string][] = [['url', f.url]];
  if (f.archivo) intentos.push(['archivo', snapshotCrudo(f.archivo)]);
  const fallos: string[] = [];
  for (const [origen, url] of intentos) {
    try {
      const cuerpo = descomprimir((await descargar(url)).cuerpo);
      const hash = sha256(cuerpo);
      if (hash === f.sha256) return { cuerpo, origen };
      fallos.push(`${origen}: hash distinto (${hash.slice(0, 12)}…)`);
    } catch (e) {
      const err = e as Error & { cause?: { code?: string } };
      fallos.push(`${origen}: ${err.message}${err.cause?.code ? ` (${err.cause.code})` : ''}`);
    }
  }
  if (!f.archivo) fallos.push('sin snapshot');
  return { detalle: fallos.join('; ') };
}

export async function respaldar(f: Fuente & { sha256: string }, destino: string): Promise<Entrada> {
  const base = { id: f.id, sha256: f.sha256 };
  const dir = join(destino, f.id);
  for (const ext of ['pdf', 'html']) {
    const fichero = join(dir, `${f.sha256}.${ext}`);
    if (existsSync(fichero) && sha256(readFileSync(fichero)) === f.sha256)
      return { ...base, estado: 'ya_estaba', fichero: relative(destino, fichero) };
  }
  const r = await obtener(f);
  if ('detalle' in r) return { ...base, estado: 'sin_copia', detalle: r.detalle };
  mkdirSync(dir, { recursive: true });
  const fichero = join(dir, `${f.sha256}.${extension(r.cuerpo)}`);
  writeFileSync(fichero, r.cuerpo);
  return { ...base, estado: 'guardado', origen: r.origen, fichero: relative(destino, fichero) };
}

async function main(): Promise<void> {
  const [destinoArg, base = 'src/content'] = process.argv.slice(2);
  const destino = resolve(destinoArg ?? process.env.ELECCIONES_RESPALDO ?? join(homedir(), 'Elecciones29n-respaldo'));
  const repo = resolve('.');
  if (!relative(repo, destino).startsWith('..')) {
    console.error(`El destino (${destino}) está dentro del repositorio; usa una carpeta fuera de él.`);
    process.exit(2);
  }

  const fuentes = cargarFuentes(base);
  const conHash = fuentes.filter((f): f is Fuente & { sha256: string } => f.sha256 !== undefined);
  const entradas: Entrada[] = [];
  for (const f of conHash) entradas.push(await respaldar(f, destino));

  const marca = { guardado: '✔ guardado', ya_estaba: '✔ ya estaba', sin_copia: '✖ sin copia' };
  for (const e of entradas)
    console.log(`${marca[e.estado]}  ${e.id}${e.origen === 'archivo' ? ' (desde el snapshot)' : ''}${e.detalle ? `: ${e.detalle}` : ''}`);

  mkdirSync(destino, { recursive: true });
  writeFileSync(join(destino, 'manifiesto.json'), JSON.stringify({ actualizado: new Date().toISOString(), entradas }, null, 2));

  const faltan = entradas.filter((e) => e.estado === 'sin_copia');
  console.log(
    `\n${conHash.length} fuente(s) con hash en ${destino}: ${conHash.length - faltan.length} con copia verificada, ${faltan.length} sin copia` +
      (fuentes.length > conHash.length ? `; ${fuentes.length - conHash.length} sin sha256 (no se respaldan)` : ''),
  );
  if (faltan.length > 0) process.exit(1);
}

if (import.meta.main) await main();
