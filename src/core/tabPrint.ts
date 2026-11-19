import type { Instrument } from './instrument';
import { layoutScore, type Primitive } from './scoreLayout';
import type { Score } from './scoreTypes';
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
function svg(s: Primitive) {
  switch (s.kind) {
    case 'line':
      return `<line x1="${s.x1}" x2="${s.x2}" y1="${s.y1}" y2="${s.y2}" stroke="${s.color ?? 'black'}" stroke-width="${s.width ?? 1}"/>`;
    case 'text':
      return `<text x="${s.x}" y="${s.y}" font-size="${s.size}" text-anchor="${s.anchor ?? 'middle'}">${escape(s.text)}</text>`;
    case 'ellipse':
      return `<ellipse cx="${s.x}" cy="${s.y}" rx="${s.rx}" ry="${s.ry}" stroke="black" fill="${s.hollow ? 'white' : 'black'}"/>`;
    case 'path':
      return `<path d="${s.d}" fill="${s.fill ? 'black' : 'none'}" stroke="black" stroke-width="${s.width ?? 1}"/>`;
    case 'rect':
      return `<rect x="${s.x}" y="${s.y}" width="${s.width}" height="${s.height}" fill="${s.color ?? 'black'}"/>`;
  }
}
export function printDocument(title: string, score: Score, instrument: Instrument) {
  const layout = layoutScore(score, instrument, 'both', 740);
  const lines = layout.lines.flatMap((line) => {
    const shapes = [...line.measures.flatMap((m) => m.primitives), ...line.primitives]
      .map(svg)
      .join('');
    const end = line.measures.at(-1)!;
    const width = end.x + end.width + 12;
    const cuts = [0];
    for (const event of line.measures.flatMap((m) => m.events)) {
      if (event.endX - cuts.at(-1)! > 740 && event.x - 14 > cuts.at(-1)!) cuts.push(event.x - 14);
    }
    return cuts.map((left, i) => {
      const span = (cuts[i + 1] ?? width) - left;
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${left} 0 ${span} ${line.height}" style="width:${Math.min(100, (100 * span) / 740)}%">${shapes}</svg>`;
    });
  });
  return `<!doctype html><html lang="es"><meta charset="utf-8"><title>${escape(title)}</title><style>@page{size:A4;margin:14mm}body{font-family:system-ui,sans-serif;margin:0}h1{font-size:20pt;overflow-wrap:anywhere;break-after:avoid}svg{display:block;break-inside:avoid;page-break-inside:avoid}</style><h1>${escape(title)}</h1>${lines.join('')}</html>`;
}
