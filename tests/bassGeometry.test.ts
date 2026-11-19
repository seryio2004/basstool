import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BRIDGE_X,
  FRAME_COUNT,
  VIEW_W,
  bassFrame,
  bassModel,
  edgeNormals,
  frameAngle,
  signedArea,
} from '../src/components/bassGeometry';

const xs = (d: string) => [...d.matchAll(/[ML](-?[\d.]+) /g)].map((m) => Number(m[1]));

test('una clavija por cuerda, repartidas 2+2, 3+2 y 3+3', () => {
  for (const [count, upper] of [
    [4, 2],
    [5, 3],
    [6, 3],
  ] as const) {
    const m = bassModel(count, 34, 24);
    assert.equal(m.posts.length, count);
    assert.equal(m.posts.filter((p) => p.upper).length, upper);
    assert.equal(new Set(m.posts.map((p) => `${p.x},${p.y}`)).size, count);
    // Todas las clavijas quedan sobre la pala, más allá de la cejuela.
    m.posts.forEach((p) => assert.ok(p.x > m.nutX && Math.abs(p.y) < m.headHalf));
  }
});

test('la escala fija la distancia entre puente y cejuela, y los trastes siguen la regla del 12.º', () => {
  for (const scale of [30, 32, 34, 35]) {
    const m = bassModel(4, scale, 24);
    assert.equal(m.nutX - BRIDGE_X, scale * 16);
    assert.ok(Math.abs(m.fretXs[12]! - (BRIDGE_X + m.nutX) / 2) < 1e-9);
    assert.ok(m.boardEndX > 230, 'el diapasón termina sobre el cuerpo');
  }
});

test('normales exteriores con cualquier sentido de recorrido', () => {
  const square = [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
  ] as const;
  assert.ok(signedArea(square) > 0);
  assert.deepEqual(edgeNormals(square)[0], [0, -1]);
  // Recorrido inverso: el primer lado es el superior y su normal apunta hacia y positivo.
  assert.deepEqual(
    edgeNormals([...square].reverse())[0]!.map((v) => v + 0),
    [0, 1],
  );
});

test('los 16 fotogramas dan trazados válidos', () => {
  for (const count of [4, 5, 6]) {
    const m = bassModel(count, 34, 24);
    for (let f = 0; f < FRAME_COUNT; f++)
      for (const mirror of [false, true]) {
        const { shapes, clip } = bassFrame(m, frameAngle(f), mirror);
        assert.ok(shapes.length > 20);
        for (const s of [...shapes.map((sh) => sh.d), clip]) assert.doesNotMatch(s, /NaN|Infinity/);
      }
  }
});

test('de frente se ven cuerdas y diapasón; de espaldas, la placa del mástil y no las cuerdas', () => {
  const m = bassModel(5, 34, 24);
  const front = bassFrame(m, frameAngle(0), true).shapes;
  const back = bassFrame(m, frameAngle(FRAME_COUNT / 2), true).shapes;
  const edge = bassFrame(m, frameAngle(FRAME_COUNT / 4), true).shapes;
  assert.equal(front.filter((s) => s.stroke === 'string').length, 5);
  assert.ok(front.some((s) => s.fill === 'board'));
  assert.equal(back.filter((s) => s.stroke === 'string').length, 0);
  assert.ok(back.some((s) => s.fill === 'mapleRound'));
  // De canto no hay tapa ni trasera: solo los laterales.
  assert.ok(!edge.some((s) => s.fill === 'burst'));
  assert.ok(edge.some((s) => s.fill === 'lacquer'));
});

test('diestro y zurdo son espejos: la pala cambia de lado', () => {
  const m = bassModel(4, 34, 24);
  const right = bassFrame(m, 0, true).shapes;
  const left = bassFrame(m, 0, false).shapes;
  const strings = (shapes: typeof right) =>
    shapes.filter((s) => s.stroke === 'string').flatMap((s) => xs(s.d));
  // Diestro: la pala (fin de las cuerdas) a la izquierda.
  assert.ok(Math.min(...strings(right)) < VIEW_W / 4);
  assert.ok(Math.max(...strings(left)) > (VIEW_W * 3) / 4);
  assert.deepEqual(
    strings(right).map((x) => Math.round(VIEW_W - x)),
    strings(left).map((x) => Math.round(x)),
  );
});

test('el bajo cabe en el lienzo con cualquier escala y número de cuerdas', () => {
  for (const count of [4, 5, 6])
    for (const scale of [30, 32, 34, 35])
      for (const mirror of [false, true]) {
        const frame = bassFrame(bassModel(count, scale, 24), 0, mirror);
        const all = frame.shapes.flatMap((s) => xs(s.d));
        assert.ok(Math.min(...all) - frame.viewX >= 0, `${count}/${scale} izquierda`);
        assert.ok(Math.max(...all) - frame.viewX <= VIEW_W, `${count}/${scale} derecha`);
      }
});
