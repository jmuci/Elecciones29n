/**
 * Geometría de las gráficas de /historia (src/components/Grafica.astro).
 *
 * Todo se calcula en el build: el SVG sale ya dibujado y el script del cliente solo
 * añade el tooltip, el filtro de series y las pestañas. Las cifras vienen de la
 * colección `graficas`; aquí no se interpola ni se rellena ningún año sin dato.
 */
import type { Gobierno, Grafica } from './modelo';

type Serie = Grafica['data']['series'][number];

/** Eje temporal común: de 1996 (primer año con cifras) al día de las elecciones. */
export const X_DESDE = 1996;
export const X_HASTA = fechaAX(new Date(Date.UTC(2026, 10, 29)));

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** Año fraccionario de una fecha (2009-07-02 → ~2009,5). */
export function fechaAX(d: Date): number {
  const anio = d.getUTCFullYear();
  const ini = Date.UTC(anio, 0, 1);
  return anio + (d.getTime() - ini) / (Date.UTC(anio + 1, 0, 1) - ini);
}

/** Centro del periodo: "2009" → 2009,5; "2009-05" → mitad de mayo. */
export function claveAX(clave: string): number {
  const [anio, mes] = clave.split('-').map(Number);
  return mes === undefined ? anio + 0.5 : anio + (mes - 0.5) / 12;
}

export const esMensual = (clave: string): boolean => clave.includes('-');

/** "2009" o "mayo de 2009". */
export function etiquetaPeriodo(clave: string): string {
  const [anio, mes] = clave.split('-');
  return mes === undefined ? anio : `${MESES[Number(mes) - 1]} de ${anio}`;
}

const numero = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** "−3,8 %": un decimal, signo menos tipográfico, como en los textos de la web. */
export function formatoValor(v: number, unidad = '%'): string {
  const texto = numero.format(v).replace('-', '−');
  return unidad.startsWith('%') ? `${texto} %` : `${texto} ${unidad}`;
}

export interface Punto {
  clave: string;
  x: number;
  valor: number;
  provisional: boolean;
}

export function puntosDe(serie: Serie): Punto[] {
  return Object.entries(serie.valores)
    .map(([clave, valor]) => ({ clave, x: claveAX(clave), valor, provisional: serie.provisional.includes(clave) }))
    .sort((a, b) => a.x - b.x);
}

/** Dos periodos seguidos sin hueco entre ellos (años o meses consecutivos). */
function consecutivos(a: string, b: string): boolean {
  const [ya, ma] = a.split('-').map(Number);
  const [yb, mb] = b.split('-').map(Number);
  if (ma === undefined || mb === undefined) return yb - ya === 1;
  return yb * 12 + mb - (ya * 12 + ma) === 1;
}

/** Marcas "bonitas" del eje Y que cubren [min, max] e incluyen el cero. */
export function marcasY(min: number, max: number, objetivo = 5): number[] {
  const lo = Math.min(0, min);
  const hi = Math.max(0, max);
  const bruto = (hi - lo || 1) / objetivo;
  const mag = 10 ** Math.floor(Math.log10(bruto));
  const paso = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((p) => p >= bruto) ?? 10 * mag;
  const desde = Math.floor(lo / paso) * paso;
  const hasta = Math.ceil(hi / paso) * paso;
  const marcas: number[] = [];
  for (let v = desde; v <= hasta + paso / 1000; v += paso) marcas.push(Math.round(v * 1000) / 1000);
  return marcas;
}

export interface Dimensiones {
  W: number;
  H: number;
  M: { top: number; right: number; bottom: number; left: number };
  /** Cada cuántos años va una marca del eje X. */
  pasoAnios: number;
  /** Rótulo de cada gobierno sobre su franja. */
  rotulos: boolean;
  marcasY: number;
}

export const DIM_ANCHA: Dimensiones = {
  W: 960,
  H: 380,
  M: { top: 26, right: 12, bottom: 26, left: 52 },
  pasoAnios: 5,
  rotulos: true,
  marcasY: 6,
};
export const DIM_MEDIA: Dimensiones = {
  W: 680,
  H: 300,
  M: { top: 26, right: 12, bottom: 26, left: 52 },
  pasoAnios: 5,
  rotulos: true,
  marcasY: 5,
};
export const DIM_ESTRECHA: Dimensiones = {
  W: 360,
  H: 280,
  M: { top: 26, right: 8, bottom: 26, left: 44 },
  pasoAnios: 10,
  rotulos: true,
  marcasY: 4,
};
export const DIM_MINI: Dimensiones = {
  W: 200,
  H: 100,
  M: { top: 8, right: 6, bottom: 20, left: 34 },
  pasoAnios: 10,
  rotulos: false,
  marcasY: 2,
};

export interface FilaTooltip {
  serie: string;
  nombre: string;
  valor: string | null;
}

export interface Diana {
  x: number;
  ancho: number;
  guia: number;
  etiqueta: string;
  filas: FilaTooltip[];
}

export interface ModeloGrafica {
  dim: Dimensiones;
  franjas: { id: string; x: number; ancho: number; rotulo: string; par: boolean; resaltada: boolean }[];
  ejeY: { y: number; texto: string; cero: boolean }[];
  ejeX: { x: number; texto: string }[];
  series: {
    id: string;
    indice: number;
    nombre: string;
    segmentos: { d: string; discontinuo: boolean }[];
    puntos: { cx: number; cy: number; provisional: boolean }[];
    barras: { d: string; provisional: boolean }[];
  }[];
  dianas: Diana[];
  /** Descripción para lectores de pantalla. */
  descripcion: string;
}

/** Rectángulo con las dos esquinas del extremo de datos redondeadas (el otro extremo apoya en la base). */
function barra(x: number, ancho: number, yBase: number, yValor: number): string {
  const alto = Math.abs(yBase - yValor);
  const r = Math.min(2, ancho / 2, alto);
  const arriba = yValor < yBase;
  const y0 = yBase;
  const y1 = yValor;
  const s = arriba ? 1 : -1; // el redondeo va hacia la base: abajo si la barra sube, arriba si baja
  return [
    `M ${x} ${y0}`,
    `L ${x} ${y1 + s * r}`,
    `Q ${x} ${y1} ${x + r} ${y1}`,
    `L ${x + ancho - r} ${y1}`,
    `Q ${x + ancho} ${y1} ${x + ancho} ${y1 + s * r}`,
    `L ${x + ancho} ${y0}`,
    'Z',
  ]
    .map((p) => p.replace(/(\d+\.\d{2})\d+/g, '$1'))
    .join(' ');
}

export function construirGrafica(
  grafica: Grafica,
  gobiernos: Gobierno[],
  dim: Dimensiones,
  opciones: { series?: string[]; resaltar?: string } = {},
): ModeloGrafica {
  const { tipo, unidad } = grafica.data;
  const series = grafica.data.series.filter((s) => !opciones.series || opciones.series.includes(s.id));
  const puntos = new Map(series.map((s) => [s.id, puntosDe(s)]));
  const { W, H, M } = dim;
  const x = (v: number): number => M.left + ((v - X_DESDE) / (X_HASTA - X_DESDE)) * (W - M.left - M.right);
  const anchoAnio = x(X_DESDE + 1) - x(X_DESDE);

  // Eje Y.
  const valores = [...puntos.values()].flat().map((p) => p.valor);
  const marcas =
    tipo === 'apiladas' ? [0, 25, 50, 75, 100].filter((_, i) => dim.marcasY > 2 || i % 2 === 0) : marcasY(Math.min(...valores), Math.max(...valores), dim.marcasY);
  const yMin = marcas[0];
  const yMax = marcas.at(-1) ?? 1;
  const y = (v: number): number => M.top + ((yMax - v) / (yMax - yMin)) * (H - M.top - M.bottom);
  const y0 = y(Math.max(yMin, 0));
  const ejeY = marcas.map((m) => ({
    y: y(m),
    texto: unidad.startsWith('%') ? `${String(m).replace('.', ',').replace('-', '−')} %` : String(m),
    cero: m === 0,
  }));

  const ejeX: ModeloGrafica['ejeX'] = [];
  for (let a = 2000; a <= 2025; a += dim.pasoAnios) ejeX.push({ x: x(a), texto: String(a) });

  const franjas = gobiernos.map((g, i) => {
    const x0 = x(Math.max(X_DESDE, fechaAX(g.data.inicio)));
    const x1 = x(Math.min(X_HASTA, g.data.fin ? fechaAX(g.data.fin) : X_HASTA));
    return {
      id: g.id,
      x: x0,
      ancho: x1 - x0,
      rotulo: g.data.presidente.split(' ').at(-1) ?? g.data.presidente,
      par: !opciones.resaltar && i % 2 === 0,
      resaltada: g.id === opciones.resaltar,
    };
  });

  // Series.
  const anchoGrupo = anchoAnio * (series.length > 1 ? 0.8 : 0.62);
  const anchoBarra = anchoGrupo / series.length;
  const acumulado = new Map<string, number>();
  const modeloSeries = series.map((s, indice) => {
    const ps = puntos.get(s.id) ?? [];
    const segmentos: ModeloGrafica['series'][number]['segmentos'] = [];
    const barras: ModeloGrafica['series'][number]['barras'] = [];
    if (tipo === 'lineas') {
      for (let i = 1; i < ps.length; i++) {
        const a = ps[i - 1];
        const b = ps[i];
        segmentos.push({
          d: `M ${x(a.x).toFixed(2)} ${y(a.valor).toFixed(2)} L ${x(b.x).toFixed(2)} ${y(b.valor).toFixed(2)}`,
          discontinuo: !consecutivos(a.clave, b.clave),
        });
      }
    } else if (tipo === 'barras') {
      for (const p of ps) {
        const bx = x(p.x) - anchoGrupo / 2 + indice * anchoBarra;
        barras.push({ d: barra(bx + 0.5, Math.max(1, anchoBarra - 1), y0, y(p.valor)), provisional: p.provisional });
      }
    } else {
      const ancho = Math.min(22, Math.max(8, anchoAnio * 1.1));
      for (const p of ps) {
        const base = acumulado.get(p.clave) ?? 0;
        acumulado.set(p.clave, base + p.valor);
        // 1 px de separación entre tramos, del color de la superficie (lo pone el trazo en CSS).
        barras.push({ d: barra(x(p.x) - ancho / 2, ancho, y(base), y(base + p.valor)), provisional: p.provisional });
      }
    }
    return {
      id: s.id,
      indice,
      nombre: s.nombre,
      segmentos,
      puntos: tipo === 'lineas' ? ps.map((p) => ({ cx: x(p.x), cy: y(p.valor), provisional: p.provisional })) : [],
      barras,
    };
  });

  // Dianas del tooltip: una por periodo con algún dato, de punto medio a punto medio.
  const claves = [...new Map([...puntos.values()].flat().map((p) => [p.clave, p.x])).entries()].sort((a, b) => a[1] - b[1]);
  const dianas: Diana[] = claves.map(([clave, cx], i) => {
    const izq = i === 0 ? M.left : (x(claves[i - 1][1]) + x(cx)) / 2;
    const der = i === claves.length - 1 ? W - M.right : (x(cx) + x(claves[i + 1][1])) / 2;
    return {
      x: izq,
      ancho: der - izq,
      guia: x(cx),
      etiqueta: etiquetaPeriodo(clave),
      filas: series.map((s) => {
        const v = s.valores[clave];
        return {
          serie: s.id,
          nombre: s.nombre,
          valor: v === undefined ? null : `${formatoValor(v, unidad)}${s.provisional.includes(clave) ? ' (provisional)' : ''}`,
        };
      }),
    };
  });

  const descripcion = `${grafica.data.titulo}. ${series
    .map((s) => `${s.nombre}: ${(puntos.get(s.id) ?? []).map((p) => `${etiquetaPeriodo(p.clave)}, ${formatoValor(p.valor, unidad)}`).join('; ')}`)
    .join('. ')}.`;

  return { dim, franjas, ejeY, ejeX, series: modeloSeries, dianas, descripcion };
}

/**
 * Resumen de una serie dentro de los años de un gobierno (`cifras` en su YAML), para las minigráficas.
 * `tramo`: primer y último dato del periodo. `extremos`: mínimo y máximo del periodo.
 */
export function resumenSerie(
  serie: Serie,
  desde: number,
  hasta: number,
  modo: 'tramo' | 'extremos',
): { a: Punto; b: Punto } | { solo: Punto } | null {
  const ps = puntosDe(serie).filter((p) => {
    const anio = Number(p.clave.slice(0, 4));
    return anio >= desde && anio <= hasta;
  });
  if (ps.length === 0) return null;
  if (ps.length === 1) return { solo: ps[0] };
  if (modo === 'tramo') return { a: ps[0], b: ps.at(-1) as Punto };
  const orden = [...ps].sort((p, q) => p.valor - q.valor);
  return { a: orden[0], b: orden.at(-1) as Punto };
}

/** Forma del marcador de cada serie (círculo, cuadrado, triángulo): el color nunca va solo. */
export function marcador(indice: number, cx: number, cy: number, r: number): string {
  const f = (n: number): string => n.toFixed(2);
  if (indice === 1) return `M ${f(cx - r)} ${f(cy - r)} h ${f(2 * r)} v ${f(2 * r)} h ${f(-2 * r)} Z`;
  if (indice === 2) {
    const t = r * 1.25;
    return `M ${f(cx)} ${f(cy - t)} L ${f(cx + t)} ${f(cy + t * 0.75)} L ${f(cx - t)} ${f(cy + t * 0.75)} Z`;
  }
  return `M ${f(cx - r)} ${f(cy)} a ${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0 a ${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0 Z`;
}
