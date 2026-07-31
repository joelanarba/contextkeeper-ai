import { describe, expect, it } from 'vitest';

import {
  makeCaptureSK,
  makeGSI1PK,
  makeGSI1SK,
  makeGSI2PK,
  makeGSI2SK,
  makeItemSK,
  makePersonSK,
  makeUserPK,
  normalizeName,
} from './keys.js';

describe('key builders', () => {
  describe('makeUserPK', () => {
    it('prefixes with USER#', () => {
      expect(makeUserPK('abc-123')).toBe('USER#abc-123');
    });
  });

  describe('makeCaptureSK', () => {
    it('builds CAPTURE#<createdAt>#<captureId>', () => {
      expect(makeCaptureSK('2026-08-01T10:00:00.000Z', 'cap-1')).toBe(
        'CAPTURE#2026-08-01T10:00:00.000Z#cap-1',
      );
    });
  });

  describe('makeItemSK', () => {
    it('prefixes with ITEM#', () => {
      expect(makeItemSK('item-42')).toBe('ITEM#item-42');
    });
  });

  describe('makePersonSK', () => {
    it('prefixes with PERSON#', () => {
      expect(makePersonSK('dr. gyamfua')).toBe('PERSON#dr. gyamfua');
    });
  });

  describe('makeGSI1PK', () => {
    it('builds USER#<userId>#TYPE#<type>', () => {
      expect(makeGSI1PK('u1', 'TASK')).toBe('USER#u1#TYPE#TASK');
    });
  });

  describe('makeGSI1SK', () => {
    it('uses dueDate when present', () => {
      expect(makeGSI1SK('OPEN', '2026-08-07', 'item-1')).toBe('OPEN#2026-08-07#item-1');
    });

    it('substitutes 9999-12-31 when dueDate is null', () => {
      expect(makeGSI1SK('OPEN', null, 'item-2')).toBe('OPEN#9999-12-31#item-2');
    });
  });

  describe('makeGSI2PK', () => {
    it('builds USER#<userId>#PERSON#<name>', () => {
      expect(makeGSI2PK('u1', 'samuel')).toBe('USER#u1#PERSON#samuel');
    });
  });

  describe('makeGSI2SK', () => {
    it('returns createdAt directly', () => {
      expect(makeGSI2SK('2026-08-01T10:00:00.000Z')).toBe('2026-08-01T10:00:00.000Z');
    });
  });

  describe('normalizeName', () => {
    it('lowercases', () => {
      expect(normalizeName('Dr. Gyamfua')).toBe('dr. gyamfua');
    });

    it('trims whitespace', () => {
      expect(normalizeName('  Samuel  ')).toBe('samuel');
    });

    it('collapses internal whitespace', () => {
      expect(normalizeName('John   Doe')).toBe('john doe');
    });

    it('handles already-normalized names', () => {
      expect(normalizeName('alice')).toBe('alice');
    });
  });
});
