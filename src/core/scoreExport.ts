import { type Instrument } from './instrument';
import { durationValue, eventNotes, measureMeter, tiedStrings, tupletCount } from './score';
import { spellPitch } from './scoreLayout';
import type { Score } from './scoreTypes';

export type ScoreFormat = 'txt' | 'musicxml';

export function tabText(score: Score, instrument: Instrument): string {
  return score.measures
    .map((bar, index) => {
      const rows = instrument.strings.map(() => '');
      for (const e of bar.events) {
        const notes = eventNotes(e);
        const cells = rows.map((_, string) => {
          const note = notes.find((n) => n.string === string);
          return note
            ? (e.technique === 'dead' ? 'x' : String(note.fret)) +
                (tiedStrings(e).includes(string) ? '~' : '')
            : '-';
        });
        const width = Math.max(...cells.map((c) => c.length));
        cells.forEach((c, i) => {
          rows[i] += c.padEnd(width + 1, '-');
        });
      }
      return [
        'Compás ' + (index + 1),
        ...rows.map((row, i) => instrument.strings.length - i + ' |' + row + '|').reverse(),
      ].join('\n');
    })
    .join('\n\n');
}

const escapeXml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const types = {
  1: 'whole',
  2: 'half',
  4: 'quarter',
  8: 'eighth',
  16: '16th',
  32: '32nd',
  64: '64th',
  256: '256th',
};

export function musicXml(title: string, score: Score, instrument: Instrument): string {
  // 120 quarter divisions represent every supported split and tuplet exactly.
  const divisions = 120;
  let incoming: number[] = [];
  const measures = score.measures
    .map((bar, index) => {
      const meter = measureMeter(score, index);
      const attributes = `<attributes><divisions>${divisions}</divisions><key><fifths>${score.keyFifths}</fifths></key><time><beats>${meter.beats}</beats><beat-type>${meter.unit}</beat-type></time><clef><sign>F</sign><line>4</line></clef><transpose><chromatic>0</chromatic><octave-change>-1</octave-change></transpose></attributes>`;
      const labels = (bar.chords ?? [])
        .map(
          (ch) =>
            `<direction><direction-type><words>${escapeXml(ch.symbol)}</words></direction-type><offset>${Math.round((ch.beat * divisions * 4) / meter.unit)}</offset></direction>`,
        )
        .join('');
      const events = bar.events
        .map((e) => {
          const d = durationValue(e.duration);
          const notes = eventNotes(e);
          const count = tupletCount(e.duration);
          const outgoing = tiedStrings(e);
          const xml = (notes.length ? notes : [undefined])
            .map((n, i) => {
              const p = n && spellPitch(instrument.strings[n.string]! + n.fret, score.keyFifths);
              const pitch = p
                ? `<pitch><step>${'CDEFGAB'[p.letter]}</step><alter>${p.alter}</alter><octave>${p.octave}</octave></pitch>`
                : '<rest/>';
              const ties = n
                ? [
                    ...(incoming.includes(n.string) ? ['stop'] : []),
                    ...(outgoing.includes(n.string) ? ['start'] : []),
                  ]
                : [];
              const technical = n
                ? `<technical><string>${instrument.strings.length - n.string}</string><fret>${n.fret}</fret></technical>`
                : '';
              const tuplet =
                count > 1
                  ? `<time-modification><actual-notes>${count}</actual-notes><normal-notes>${2 ** Math.floor(Math.log2(count))}</normal-notes></time-modification>`
                  : '';
              return `<note>${i ? '<chord/>' : ''}${pitch}<duration>${(divisions * 4 * d.n) / d.d}</duration>${ties.map((t) => `<tie type="${t}"/>`).join('')}<voice>1</voice><type>${types[e.duration.base]}</type>${e.duration.dots ? '<dot/>' : ''}${tuplet}<notations>${ties.map((t) => `<tied type="${t}"/>`).join('')}${technical}</notations></note>`;
            })
            .join('');
          incoming = outgoing;
          return xml;
        })
        .join('');
      return `<measure number="${index + 1}">${index === 0 || bar.meter ? attributes : ''}${labels}${events}</measure>`;
    })
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?><score-partwise version="4.0"><work><work-title>${escapeXml(title)}</work-title></work><part-list><score-part id="P1"><part-name>Bajo</part-name></score-part></part-list><part id="P1">${measures}</part></score-partwise>`;
}
