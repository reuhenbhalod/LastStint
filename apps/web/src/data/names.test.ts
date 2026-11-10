import { describe, expect, it } from 'vitest';
import { named, namedUpper, surname } from './names.js';

describe('driver names in text', () => {
  it('says three-letter codes as surnames, as before', () => {
    expect(named('VER is 1.2 s behind HAM')).toBe('Verstappen is 1.2 s behind Hamilton');
    expect(namedUpper('PAST HAM!')).toBe('PAST HAMILTON!');
  });

  it('says four-letter Eras codes as surnames', () => {
    expect(named('SENA has stopped')).toBe('Senna has stopped');
    expect(named('MSCM was 1.1 s quicker than PIQN')).toBe(
      'Schumacher was 1.1 s quicker than Piquet',
    );
    expect(named('ROSK leads ALBM')).toBe('Rosberg leads Alboreto');
    expect(namedUpper('PAST SENA!')).toBe('PAST SENNA!');
    expect(surname('SENA')).toBe('Senna');
  });

  it('leaves unknown codes and other capital words alone', () => {
    expect(surname('ZZZZ')).toBe('ZZZZ');
    expect(named('ZZZ and ZZZZ pit; BOX now, SLOW · GEARBOX?')).toBe(
      'ZZZ and ZZZZ pit; BOX now, SLOW · GEARBOX?',
    );
    expect(named('SENAX and HAMS')).toBe('SENAX and HAMS');
  });
});
