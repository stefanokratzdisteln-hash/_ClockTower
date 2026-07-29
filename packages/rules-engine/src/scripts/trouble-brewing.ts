import type {
  Alignment,
  Assignment,
  CharacterId,
  CharacterType,
  EventActor,
  EventVisibility,
  GameEvent,
  GameState,
  PlayerId,
  PlayerStatus,
} from '@clocktower/shared';

export const TROUBLE_BREWING_SCRIPT_ID = 'trouble-brewing';
export const MIN_TROUBLE_BREWING_PLAYERS = 5;
export const MAX_TROUBLE_BREWING_PLAYERS = 15;

export type TroubleBrewingAbilityTiming =
  'setup' | 'firstNight' | 'otherNight' | 'day' | 'passive';

/**
 * A deliberately small, machine-readable placeholder. It identifies when an
 * ability matters without distributing the published rules text.
 */
export type TroubleBrewingAbilityModel = Readonly<{
  version: 1;
  kind: 'placeholder';
  timing: readonly TroubleBrewingAbilityTiming[];
  targeting?: Readonly<{
    minTargets: number;
    maxTargets: number;
    allowSelf: boolean;
    alive: 'required' | 'any';
  }>;
  playerResult?: 'storyteller' | 'grimoire';
  wakeCondition?: 'alive' | 'always' | 'diedTonight';
  setup?: Readonly<{
    outsiderDelta: number;
  }>;
}>;

export type TroubleBrewingRole = Readonly<{
  id: CharacterId;
  scriptId: typeof TROUBLE_BREWING_SCRIPT_ID;
  type: CharacterType;
  alignment: Alignment;
  firstNightOrder: number | null;
  otherNightOrder: number | null;
  abilityModel: TroubleBrewingAbilityModel;
}>;

export type RoleDistribution = Readonly<Record<CharacterType, number>>;

export type CharacterAssignmentInput = Readonly<{
  playerId: PlayerId;
  characterId: CharacterId;
}>;

export type AssignmentValidationErrorCode =
  | 'PLAYER_COUNT_OUT_OF_RANGE'
  | 'ASSIGNMENT_COUNT_MISMATCH'
  | 'UNKNOWN_PLAYER'
  | 'DUPLICATE_PLAYER'
  | 'UNKNOWN_CHARACTER'
  | 'DUPLICATE_CHARACTER'
  | 'TYPE_DISTRIBUTION_MISMATCH';

export type AssignmentValidationError = Readonly<{
  code: AssignmentValidationErrorCode;
  message: string;
  playerId?: PlayerId;
  characterId?: CharacterId;
  characterType?: CharacterType;
}>;

export type AssignmentValidationResult = Readonly<{
  valid: boolean;
  errors: readonly AssignmentValidationError[];
  expectedDistribution?: RoleDistribution;
  actualDistribution?: RoleDistribution;
}>;

export type AutoAssignmentOptions = Readonly<{
  /**
   * Dependency-injected for deterministic tests and seeded game setup.
   * It must return a value in the same range as Math.random().
   */
  random?: () => number;
}>;

export type AssignmentContext = Readonly<{
  occurredAt?: string;
  actor?: EventActor;
  visibility?: EventVisibility;
  correlationId?: string;
}>;

const placeholder = (
  timing: readonly TroubleBrewingAbilityTiming[],
  options: Pick<
    TroubleBrewingAbilityModel,
    'playerResult' | 'setup' | 'targeting' | 'wakeCondition'
  > = {},
): TroubleBrewingAbilityModel => ({
  version: 1,
  kind: 'placeholder',
  timing,
  ...options,
});

export const TROUBLE_BREWING_ROLES = [
  {
    id: 'washerwoman',
    scriptId: TROUBLE_BREWING_SCRIPT_ID,
    type: 'townsfolk',
    alignment: 'good',
    firstNightOrder: 20,
    otherNightOrder: null,
    abilityModel: placeholder(['firstNight'], {
      playerResult: 'storyteller',
    }),
  },
  {
    id: 'librarian',
    scriptId: TROUBLE_BREWING_SCRIPT_ID,
    type: 'townsfolk',
    alignment: 'good',
    firstNightOrder: 30,
    otherNightOrder: null,
    abilityModel: placeholder(['firstNight'], {
      playerResult: 'storyteller',
    }),
  },
  {
    id: 'investigator',
    scriptId: TROUBLE_BREWING_SCRIPT_ID,
    type: 'townsfolk',
    alignment: 'good',
    firstNightOrder: 40,
    otherNightOrder: null,
    abilityModel: placeholder(['firstNight'], {
      playerResult: 'storyteller',
    }),
  },
  {
    id: 'chef',
    scriptId: TROUBLE_BREWING_SCRIPT_ID,
    type: 'townsfolk',
    alignment: 'good',
    firstNightOrder: 50,
    otherNightOrder: null,
    abilityModel: placeholder(['firstNight'], {
      playerResult: 'storyteller',
    }),
  },
  {
    id: 'empath',
    scriptId: TROUBLE_BREWING_SCRIPT_ID,
    type: 'townsfolk',
    alignment: 'good',
    firstNightOrder: 60,
    otherNightOrder: 60,
    abilityModel: placeholder(['firstNight', 'otherNight'], {
      playerResult: 'storyteller',
    }),
  },
  {
    id: 'fortune_teller',
    scriptId: TROUBLE_BREWING_SCRIPT_ID,
    type: 'townsfolk',
    alignment: 'good',
    firstNightOrder: 70,
    otherNightOrder: 70,
    abilityModel: placeholder(['firstNight', 'otherNight'], {
      targeting: {
        minTargets: 2,
        maxTargets: 2,
        allowSelf: true,
        alive: 'any',
      },
      playerResult: 'storyteller',
    }),
  },
  {
    id: 'undertaker',
    scriptId: TROUBLE_BREWING_SCRIPT_ID,
    type: 'townsfolk',
    alignment: 'good',
    firstNightOrder: null,
    otherNightOrder: 50,
    abilityModel: placeholder(['otherNight'], {
      playerResult: 'storyteller',
    }),
  },
  {
    id: 'monk',
    scriptId: TROUBLE_BREWING_SCRIPT_ID,
    type: 'townsfolk',
    alignment: 'good',
    firstNightOrder: null,
    otherNightOrder: 20,
    abilityModel: placeholder(['otherNight'], {
      targeting: {
        minTargets: 1,
        maxTargets: 1,
        allowSelf: false,
        alive: 'any',
      },
    }),
  },
  {
    id: 'ravenkeeper',
    scriptId: TROUBLE_BREWING_SCRIPT_ID,
    type: 'townsfolk',
    alignment: 'good',
    firstNightOrder: null,
    otherNightOrder: 40,
    abilityModel: placeholder(['otherNight'], {
      wakeCondition: 'diedTonight',
      targeting: {
        minTargets: 1,
        maxTargets: 1,
        allowSelf: true,
        alive: 'any',
      },
      playerResult: 'storyteller',
    }),
  },
  {
    id: 'virgin',
    scriptId: TROUBLE_BREWING_SCRIPT_ID,
    type: 'townsfolk',
    alignment: 'good',
    firstNightOrder: null,
    otherNightOrder: null,
    abilityModel: placeholder(['day', 'passive']),
  },
  {
    id: 'slayer',
    scriptId: TROUBLE_BREWING_SCRIPT_ID,
    type: 'townsfolk',
    alignment: 'good',
    firstNightOrder: null,
    otherNightOrder: null,
    abilityModel: placeholder(['day']),
  },
  {
    id: 'soldier',
    scriptId: TROUBLE_BREWING_SCRIPT_ID,
    type: 'townsfolk',
    alignment: 'good',
    firstNightOrder: null,
    otherNightOrder: null,
    abilityModel: placeholder(['passive']),
  },
  {
    id: 'mayor',
    scriptId: TROUBLE_BREWING_SCRIPT_ID,
    type: 'townsfolk',
    alignment: 'good',
    firstNightOrder: null,
    otherNightOrder: null,
    abilityModel: placeholder(['day', 'passive']),
  },
  {
    id: 'butler',
    scriptId: TROUBLE_BREWING_SCRIPT_ID,
    type: 'outsider',
    alignment: 'good',
    firstNightOrder: 80,
    otherNightOrder: 80,
    abilityModel: placeholder(['firstNight', 'otherNight', 'day'], {
      targeting: {
        minTargets: 1,
        maxTargets: 1,
        allowSelf: false,
        alive: 'any',
      },
    }),
  },
  {
    id: 'drunk',
    scriptId: TROUBLE_BREWING_SCRIPT_ID,
    type: 'outsider',
    alignment: 'good',
    firstNightOrder: null,
    otherNightOrder: null,
    abilityModel: placeholder(['setup', 'passive']),
  },
  {
    id: 'recluse',
    scriptId: TROUBLE_BREWING_SCRIPT_ID,
    type: 'outsider',
    alignment: 'good',
    firstNightOrder: null,
    otherNightOrder: null,
    abilityModel: placeholder(['passive']),
  },
  {
    id: 'saint',
    scriptId: TROUBLE_BREWING_SCRIPT_ID,
    type: 'outsider',
    alignment: 'good',
    firstNightOrder: null,
    otherNightOrder: null,
    abilityModel: placeholder(['day', 'passive']),
  },
  {
    id: 'poisoner',
    scriptId: TROUBLE_BREWING_SCRIPT_ID,
    type: 'minion',
    alignment: 'evil',
    firstNightOrder: 10,
    otherNightOrder: 10,
    abilityModel: placeholder(['firstNight', 'otherNight'], {
      targeting: {
        minTargets: 1,
        maxTargets: 1,
        allowSelf: true,
        alive: 'any',
      },
    }),
  },
  {
    id: 'spy',
    scriptId: TROUBLE_BREWING_SCRIPT_ID,
    type: 'minion',
    alignment: 'evil',
    firstNightOrder: 90,
    otherNightOrder: 90,
    abilityModel: placeholder(['firstNight', 'otherNight', 'passive'], {
      playerResult: 'grimoire',
    }),
  },
  {
    id: 'scarlet_woman',
    scriptId: TROUBLE_BREWING_SCRIPT_ID,
    type: 'minion',
    alignment: 'evil',
    firstNightOrder: null,
    otherNightOrder: null,
    abilityModel: placeholder(['otherNight', 'passive']),
  },
  {
    id: 'baron',
    scriptId: TROUBLE_BREWING_SCRIPT_ID,
    type: 'minion',
    alignment: 'evil',
    firstNightOrder: null,
    otherNightOrder: null,
    abilityModel: placeholder(['setup'], {
      setup: { outsiderDelta: 2 },
    }),
  },
  {
    id: 'imp',
    scriptId: TROUBLE_BREWING_SCRIPT_ID,
    type: 'demon',
    alignment: 'evil',
    firstNightOrder: null,
    otherNightOrder: 30,
    abilityModel: placeholder(['otherNight'], {
      targeting: {
        minTargets: 1,
        maxTargets: 1,
        allowSelf: true,
        alive: 'any',
      },
    }),
  },
] as const satisfies readonly TroubleBrewingRole[];

const ROLES_BY_ID = new Map<CharacterId, TroubleBrewingRole>(
  TROUBLE_BREWING_ROLES.map((role) => [role.id, role]),
);

const BASE_DISTRIBUTIONS: Readonly<Record<number, RoleDistribution>> = {
  5: { townsfolk: 3, outsider: 0, minion: 1, demon: 1 },
  6: { townsfolk: 3, outsider: 1, minion: 1, demon: 1 },
  7: { townsfolk: 5, outsider: 0, minion: 1, demon: 1 },
  8: { townsfolk: 5, outsider: 1, minion: 1, demon: 1 },
  9: { townsfolk: 5, outsider: 2, minion: 1, demon: 1 },
  10: { townsfolk: 7, outsider: 0, minion: 2, demon: 1 },
  11: { townsfolk: 7, outsider: 1, minion: 2, demon: 1 },
  12: { townsfolk: 7, outsider: 2, minion: 2, demon: 1 },
  13: { townsfolk: 9, outsider: 0, minion: 3, demon: 1 },
  14: { townsfolk: 9, outsider: 1, minion: 3, demon: 1 },
  15: { townsfolk: 9, outsider: 2, minion: 3, demon: 1 },
};

export function getTroubleBrewingRole(
  characterId: CharacterId,
): TroubleBrewingRole | undefined {
  return ROLES_BY_ID.get(characterId);
}

export function getDrunkPerceivedRole(
  assignment: Pick<Assignment, 'characterId' | 'effects'>,
): TroubleBrewingRole | undefined {
  if (assignment.characterId !== 'drunk') return undefined;
  const perceivedCharacterId = (assignment.effects ?? []).find(
    ({ kind, label, sourceRoleId }) =>
      kind === 'custom' &&
      label === '酒鬼伪装身份' &&
      sourceRoleId !== undefined,
  )?.sourceRoleId;
  return perceivedCharacterId
    ? getTroubleBrewingRole(perceivedCharacterId)
    : undefined;
}

export function getTroubleBrewingDistribution(
  playerCount: number,
): RoleDistribution {
  const distribution = BASE_DISTRIBUTIONS[playerCount];

  if (distribution === undefined) {
    throw new RangeError(
      `Trouble Brewing requires ${MIN_TROUBLE_BREWING_PLAYERS}-${MAX_TROUBLE_BREWING_PLAYERS} players; received ${playerCount}.`,
    );
  }

  return { ...distribution };
}

function emptyDistribution(): Record<CharacterType, number> {
  return { townsfolk: 0, outsider: 0, minion: 0, demon: 0 };
}

function expectedDistributionForRoles(
  playerCount: number,
  roles: readonly TroubleBrewingRole[],
): RoleDistribution {
  const base = getTroubleBrewingDistribution(playerCount);
  const outsiderDelta = roles.reduce(
    (total, role) => total + (role.abilityModel.setup?.outsiderDelta ?? 0),
    0,
  );

  return {
    ...base,
    townsfolk: base.townsfolk - outsiderDelta,
    outsider: base.outsider + outsiderDelta,
  };
}

export function validateTroubleBrewingAssignments(
  playerIds: readonly PlayerId[],
  assignments: readonly CharacterAssignmentInput[],
): AssignmentValidationResult {
  const errors: AssignmentValidationError[] = [];
  const playerIdSet = new Set(playerIds);
  const seenPlayers = new Set<PlayerId>();
  const seenCharacters = new Set<CharacterId>();
  const roles: TroubleBrewingRole[] = [];
  const actualDistribution = emptyDistribution();

  let baseDistribution: RoleDistribution | undefined;
  try {
    baseDistribution = getTroubleBrewingDistribution(playerIds.length);
  } catch {
    errors.push({
      code: 'PLAYER_COUNT_OUT_OF_RANGE',
      message: `Player count must be between ${MIN_TROUBLE_BREWING_PLAYERS} and ${MAX_TROUBLE_BREWING_PLAYERS}.`,
    });
  }

  if (assignments.length !== playerIds.length) {
    errors.push({
      code: 'ASSIGNMENT_COUNT_MISMATCH',
      message: `Expected ${playerIds.length} assignments; received ${assignments.length}.`,
    });
  }

  for (const assignment of assignments) {
    if (!playerIdSet.has(assignment.playerId)) {
      errors.push({
        code: 'UNKNOWN_PLAYER',
        message: `Unknown player: ${assignment.playerId}.`,
        playerId: assignment.playerId,
      });
    }

    if (seenPlayers.has(assignment.playerId)) {
      errors.push({
        code: 'DUPLICATE_PLAYER',
        message: `Player ${assignment.playerId} has more than one character.`,
        playerId: assignment.playerId,
      });
    }
    seenPlayers.add(assignment.playerId);

    const role = getTroubleBrewingRole(assignment.characterId);
    if (role === undefined) {
      errors.push({
        code: 'UNKNOWN_CHARACTER',
        message: `Character ${assignment.characterId} is not in Trouble Brewing.`,
        characterId: assignment.characterId,
      });
      continue;
    }

    if (seenCharacters.has(assignment.characterId)) {
      errors.push({
        code: 'DUPLICATE_CHARACTER',
        message: `Character ${assignment.characterId} is assigned more than once.`,
        characterId: assignment.characterId,
      });
    }
    seenCharacters.add(assignment.characterId);
    roles.push(role);
    actualDistribution[role.type] += 1;
  }

  let expectedDistribution: RoleDistribution | undefined = baseDistribution;
  if (baseDistribution !== undefined) {
    expectedDistribution = expectedDistributionForRoles(
      playerIds.length,
      roles,
    );

    for (const characterType of [
      'townsfolk',
      'outsider',
      'minion',
      'demon',
    ] as const) {
      if (
        actualDistribution[characterType] !==
        expectedDistribution[characterType]
      ) {
        errors.push({
          code: 'TYPE_DISTRIBUTION_MISMATCH',
          message: `Expected ${expectedDistribution[characterType]} ${characterType}; received ${actualDistribution[characterType]}.`,
          characterType,
        });
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    ...(expectedDistribution === undefined ? {} : { expectedDistribution }),
    actualDistribution,
  };
}

export class InvalidCharacterAssignmentError extends Error {
  readonly validation: AssignmentValidationResult;

  constructor(validation: AssignmentValidationResult) {
    super(
      `Invalid Trouble Brewing assignments: ${validation.errors
        .map((error) => error.message)
        .join(' ')}`,
    );
    this.name = 'InvalidCharacterAssignmentError';
    this.validation = validation;
  }
}

const INITIAL_PLAYER_STATUS: Readonly<PlayerStatus> = {
  alive: true,
  deadVoteAvailable: false,
  drunk: false,
  poisoned: false,
  protected: false,
};

export function assignTroubleBrewingCharactersManually(
  playerIds: readonly PlayerId[],
  assignments: readonly CharacterAssignmentInput[],
): Assignment[] {
  const validation = validateTroubleBrewingAssignments(playerIds, assignments);
  if (!validation.valid) {
    throw new InvalidCharacterAssignmentError(validation);
  }

  return assignments.map(({ playerId, characterId }) => {
    const role = getTroubleBrewingRole(characterId);
    if (role === undefined) {
      throw new Error(`Validated character ${characterId} was not found.`);
    }

    return {
      playerId,
      characterId,
      alignment: role.alignment,
      status: { ...INITIAL_PLAYER_STATUS },
      effects: [],
      reminders: [],
    };
  });
}

function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const randomValue = random();
    if (!Number.isFinite(randomValue) || randomValue < 0 || randomValue >= 1) {
      throw new RangeError(
        'The random function must return a value in [0, 1).',
      );
    }
    const swapIndex = Math.floor(randomValue * (index + 1));
    [result[index], result[swapIndex]] = [
      result[swapIndex] as T,
      result[index] as T,
    ];
  }
  return result;
}

function chooseRoles(
  type: CharacterType,
  count: number,
  random: () => number,
): TroubleBrewingRole[] {
  return shuffled(
    TROUBLE_BREWING_ROLES.filter((role) => role.type === type),
    random,
  ).slice(0, count);
}

export function autoAssignTroubleBrewingCharacters(
  playerIds: readonly PlayerId[],
  options: AutoAssignmentOptions = {},
): Assignment[] {
  const random = options.random ?? Math.random;
  const base = getTroubleBrewingDistribution(playerIds.length);
  const minions = chooseRoles('minion', base.minion, random);
  const distribution = expectedDistributionForRoles(playerIds.length, minions);
  const selectedRoles = [
    ...chooseRoles('townsfolk', distribution.townsfolk, random),
    ...chooseRoles('outsider', distribution.outsider, random),
    ...minions,
    ...chooseRoles('demon', distribution.demon, random),
  ];
  const shuffledRoles = shuffled(selectedRoles, random);
  const inputs = playerIds.map((playerId, index) => ({
    playerId,
    characterId: (shuffledRoles[index] as TroubleBrewingRole).id,
  }));

  return assignTroubleBrewingCharactersManually(playerIds, inputs);
}

/**
 * Assigns characters to a game and records every assignment in the event
 * stream. UI clients should use this command instead of writing assignments
 * onto GameState themselves.
 */
export function autoAssignTroubleBrewingCharactersToGame(
  state: GameState,
  options: AutoAssignmentOptions = {},
  context: AssignmentContext = {},
): GameState {
  if (state.phase !== 'assign_characters') {
    throw new InvalidCharacterAssignmentError({
      valid: false,
      errors: [
        {
          code: 'ASSIGNMENT_COUNT_MISMATCH',
          message: `Characters can only be assigned during assign_characters; current phase is ${state.phase}.`,
        },
      ],
    });
  }

  const assignments = autoAssignTroubleBrewingCharacters(
    state.players.map(({ id }) => id),
    options,
  );
  const occurredAt = context.occurredAt ?? new Date().toISOString();
  const events: GameEvent[] = assignments.map((assignment, index) => ({
    id: `${state.id}:assignment:${state.version + index + 1}`,
    gameId: state.id,
    sequence: state.version + index + 1,
    occurredAt,
    actor: context.actor ?? { type: 'rules_engine' },
    visibility: context.visibility ?? { scope: 'storyteller' },
    ...(context.correlationId === undefined
      ? {}
      : { correlationId: context.correlationId }),
    type: 'CHARACTER_ASSIGNED',
    playerId: assignment.playerId,
    characterId: assignment.characterId,
  }));

  return {
    ...state,
    assignments,
    events: [...state.events, ...events],
    version: state.version + events.length,
    updatedAt: occurredAt,
  };
}
