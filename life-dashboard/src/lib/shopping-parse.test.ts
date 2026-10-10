import { describe, expect, it } from 'vitest';
import { parseShoppingText } from './family';

describe('parseShoppingText', () => {
  it('una línea = un artículo, sin vacíos', () => expect(parseShoppingText('Leche\n\n  Pan  \r\nHuevos\n')).toEqual(['Leche', 'Pan', 'Huevos']));
  it('quita viñetas, casillas y numeración', () => expect(parseShoppingText('- Leche\n• Pan\n* Huevos\n☐ Arroz\n[ ] Sal\n[x] Aceite\n1. Café\n2) Té')).toEqual(['Leche', 'Pan', 'Huevos', 'Arroz', 'Sal', 'Aceite', 'Café', 'Té']));
  it('no mutila palabras que empiezan por x o por número', () => expect(parseShoppingText('Xilitol\n2 litros de leche')).toEqual(['Xilitol', '2 litros de leche']));
  it('elimina repetidos sin distinguir mayúsculas ni tildes', () => expect(parseShoppingText('Café\ncafe\nCAFÉ\nté')).toEqual(['Café', 'té']));
  it('limita la longitud y colapsa espacios', () => { const [l] = parseShoppingText(`a${' '.repeat(5)}b`.padEnd(300, 'c')); expect(l!.length).toBeLessThanOrEqual(120); expect(l!.startsWith('a b')).toBe(true); });
  it('texto vacío → nada', () => expect(parseShoppingText(' \n \n')).toEqual([]));
});
