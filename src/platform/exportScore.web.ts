import type { Instrument } from '../core/instrument';
import { musicXml, tabText, type ScoreFormat } from '../core/scoreExport';
import type { Score } from '../core/scoreTypes';

export function exportScore(
  format: ScoreFormat,
  title: string,
  score: Score,
  instrument: Instrument,
) {
  const xml = format === 'musicxml';
  const data = xml ? musicXml(title, score, instrument) : tabText(score, instrument);
  const url = URL.createObjectURL(
    new Blob([data], {
      type: xml ? 'application/vnd.recordare.musicxml+xml' : 'text/plain;charset=utf-8',
    }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = title + '.' + format;
  try {
    link.click();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
