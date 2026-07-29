import { describe, expect, it } from 'vitest';

import {
  InvalidCharacterAssignmentError,
  TROUBLE_BREWING_ROLES,
  assignTroubleBrewingCharactersManually,
  autoAssignTroubleBrewingCharacters,
  getTroubleBrewingDistribution,
  validateTroubleBrewingAssignments,
} from '../scripts/trouble-brewing.js';

const playerIds = (count: number) =>
  Array.from({ length: count }, (_, index) => `player-${index + 1}`);

describe('Trouble Brewing role distribution', () => {
  it.each([
    [5, 3, 0, 1, 1],
    [6, 3, 1, 1, 1],
    [7, 5, 0, 1, 1],
    [8, 5, 1, 1, 1],
    [9, 5, 2, 1, 1],
    [10, 7, 0, 2, 1],
    [11, 7, 1, 2, 1],
    [12, 7, 2, 2, 1],
    [13, 9, 0, 3, 1],
    [14, 9, 1, 3, 1],
    [15, 9, 2, 3, 1],
  ])(
    'returns the category counts for %i players',
    (count, townsfolk, outsider, minion, demon) => {
      expect(getTroubleBrewingDistribution(count)).toEqual({
        townsfolk,
        outsider,
        minion,
        demon,
      });
    },
  );

  it('rejects player counts outside the supported range', () => {
    expect(() => getTroubleBrewingDistribution(4)).toThrow(RangeError);
    expect(() => getTroubleBrewingDistribution(16)).toThrow(RangeError);
  });

  it('contains unique, structured role definitions without rules text', () => {
    expect(TROUBLE_BREWING_ROLES).toHaveLength(22);
    expect(new Set(TROUBLE_BREWING_ROLES.map(({ id }) => id)).size).toBe(22);

    for (const role of TROUBLE_BREWING_ROLES) {
      expect(role).toHaveProperty('firstNightOrder');
      expect(role).toHaveProperty('otherNightOrder');
      expect(role.abilityModel).toMatchObject({
        version: 1,
        kind: 'placeholder',
        timing: expect.any(Array),
      });
    }
  });

  it('declares every player-facing night interaction explicitly', () => {
    const byId = new Map(TROUBLE_BREWING_ROLES.map((role) => [role.id, role]));
    expect(
      Object.fromEntries(
        [
          'poisoner',
          'fortune_teller',
          'monk',
          'ravenkeeper',
          'butler',
          'imp',
        ].map((id) => [id, byId.get(id)?.abilityModel.targeting]),
      ),
    ).toEqual({
      poisoner: {
        minTargets: 1,
        maxTargets: 1,
        allowSelf: true,
        alive: 'any',
      },
      fortune_teller: {
        minTargets: 2,
        maxTargets: 2,
        allowSelf: true,
        alive: 'any',
      },
      monk: {
        minTargets: 1,
        maxTargets: 1,
        allowSelf: false,
        alive: 'any',
      },
      ravenkeeper: {
        minTargets: 1,
        maxTargets: 1,
        allowSelf: true,
        alive: 'any',
      },
      butler: {
        minTargets: 1,
        maxTargets: 1,
        allowSelf: false,
        alive: 'any',
      },
      imp: {
        minTargets: 1,
        maxTargets: 1,
        allowSelf: true,
        alive: 'any',
      },
    });
    expect(
      [
        'washerwoman',
        'librarian',
        'investigator',
        'chef',
        'empath',
        'fortune_teller',
        'undertaker',
        'ravenkeeper',
      ].every(
        (id) =>
          byId.get(id)?.abilityModel.playerResult === 'storyteller',
      ),
    ).toBe(true);
    expect(byId.get('spy')?.abilityModel.playerResult).toBe('grimoire');
    expect(byId.get('scarlet_woman')?.otherNightOrder).toBeNull();
  });
});

describe('Trouble Brewing assignment validation', () => {
  const players = playerIds(7);
  const legalInputs = [
    { playerId: players[0]!, characterId: 'washerwoman' },
    { playerId: players[1]!, characterId: 'chef' },
    { playerId: players[2]!, characterId: 'empath' },
    { playerId: players[3]!, characterId: 'virgin' },
    { playerId: players[4]!, characterId: 'soldier' },
    { playerId: players[5]!, characterId: 'poisoner' },
    { playerId: players[6]!, characterId: 'imp' },
  ];

  it('accepts a legal manual assignment and creates runtime assignments', () => {
    expect(validateTroubleBrewingAssignments(players, legalInputs)).toEqual({
      valid: true,
      errors: [],
      expectedDistribution: {
        townsfolk: 5,
        outsider: 0,
        minion: 1,
        demon: 1,
      },
      actualDistribution: {
        townsfolk: 5,
        outsider: 0,
        minion: 1,
        demon: 1,
      },
    });

    const assignments = assignTroubleBrewingCharactersManually(
      players,
      legalInputs,
    );
    expect(assignments).toHaveLength(7);
    expect(assignments[0]).toMatchObject({
      playerId: 'player-1',
      characterId: 'washerwoman',
      alignment: 'good',
      status: { alive: true },
    });
    expect(assignments[6]).toMatchObject({
      characterId: 'imp',
      alignment: 'evil',
    });
  });

  it('applies setup category modifiers when the Baron is selected', () => {
    const inputs = [
      { playerId: players[0]!, characterId: 'washerwoman' },
      { playerId: players[1]!, characterId: 'chef' },
      { playerId: players[2]!, characterId: 'empath' },
      { playerId: players[3]!, characterId: 'drunk' },
      { playerId: players[4]!, characterId: 'saint' },
      { playerId: players[5]!, characterId: 'baron' },
      { playerId: players[6]!, characterId: 'imp' },
    ];

    expect(validateTroubleBrewingAssignments(players, inputs)).toMatchObject({
      valid: true,
      expectedDistribution: {
        townsfolk: 3,
        outsider: 2,
        minion: 1,
        demon: 1,
      },
    });
  });

  it('reports duplicate, unknown, and category-invalid assignments', () => {
    const invalidInputs = [
      { playerId: players[0]!, characterId: 'washerwoman' },
      { playerId: players[0]!, characterId: 'washerwoman' },
      { playerId: players[2]!, characterId: 'chef' },
      { playerId: players[3]!, characterId: 'empath' },
      { playerId: players[4]!, characterId: 'virgin' },
      { playerId: players[5]!, characterId: 'not-on-script' },
      { playerId: 'missing-player', characterId: 'imp' },
    ];

    const validation = validateTroubleBrewingAssignments(
      players,
      invalidInputs,
    );
    const codes = validation.errors.map(({ code }) => code);

    expect(validation.valid).toBe(false);
    expect(codes).toContain('DUPLICATE_PLAYER');
    expect(codes).toContain('DUPLICATE_CHARACTER');
    expect(codes).toContain('UNKNOWN_CHARACTER');
    expect(codes).toContain('UNKNOWN_PLAYER');
    expect(codes).toContain('TYPE_DISTRIBUTION_MISMATCH');
    expect(() =>
      assignTroubleBrewingCharactersManually(players, invalidInputs),
    ).toThrow(InvalidCharacterAssignmentError);
  });
});

describe('Trouble Brewing automatic assignment', () => {
  it.each([5, 7, 10, 15])(
    'creates a legal, unique assignment for %i players',
    (count) => {
      const players = playerIds(count);
      const assignments = autoAssignTroubleBrewingCharacters(players, {
        random: () => 0.42,
      });

      expect(assignments).toHaveLength(count);
      expect(new Set(assignments.map(({ playerId }) => playerId)).size).toBe(
        count,
      );
      expect(
        new Set(assignments.map(({ characterId }) => characterId)).size,
      ).toBe(count);
      expect(
        validateTroubleBrewingAssignments(players, assignments).valid,
      ).toBe(true);
    },
  );
});
