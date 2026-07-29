import type {
  Assignment,
  CharacterId,
  GameState,
  PlayerId,
} from '@clocktower/shared';

import {
  TROUBLE_BREWING_ROLES,
  getDrunkPerceivedRole,
  type TroubleBrewingAbilityModel,
} from '../scripts/trouble-brewing.js';

export type NightKind = 'firstNight' | 'otherNight';

export type NightCharacterConfig = Readonly<{
  id: CharacterId;
  firstNightOrder: number | null;
  otherNightOrder: number | null;
  abilityModel: TroubleBrewingAbilityModel;
}>;

export type NightOrderEntry = Readonly<{
  playerId: PlayerId;
  characterId: CharacterId;
  order: number;
}>;

export type NightOrderOptions = {
  /** Needed for conditional abilities such as a character killed tonight. */
  diedTonightPlayerIds?: readonly PlayerId[];
};

function shouldWake(
  assignment: Assignment,
  config: NightCharacterConfig,
  options: NightOrderOptions,
): boolean {
  switch (config.abilityModel.wakeCondition ?? 'alive') {
    case 'always':
      return true;
    case 'diedTonight':
      return (
        options.diedTonightPlayerIds?.includes(assignment.playerId) ?? false
      );
    case 'alive':
      return assignment.status.alive;
  }
}

/**
 * Calculates a deterministic order from script configuration. Equal explicit
 * order values are resolved by seat order and then player id.
 */
export function calculateNightOrder(
  state: Pick<GameState, 'assignments' | 'players'>,
  characters: readonly NightCharacterConfig[],
  nightKind: NightKind,
  options: NightOrderOptions = {},
): NightOrderEntry[] {
  const configById = new Map(characters.map((role) => [role.id, role]));
  const seatByPlayer = new Map(
    state.players.map(({ id, seatIndex }) => [id, seatIndex]),
  );
  const orderKey =
    nightKind === 'firstNight' ? 'firstNightOrder' : 'otherNightOrder';

  return state.assignments
    .flatMap((assignment): NightOrderEntry[] => {
      const effectiveCharacterId =
        getDrunkPerceivedRole(assignment)?.id ?? assignment.characterId;
      const config = configById.get(effectiveCharacterId);
      const order = config?.[orderKey];
      if (
        config === undefined ||
        typeof order !== 'number' ||
        !Number.isFinite(order) ||
        !shouldWake(assignment, config, options)
      ) {
        return [];
      }
      return [{ playerId: assignment.playerId, characterId: config.id, order }];
    })
    .sort(
      (left, right) =>
        left.order - right.order ||
        (seatByPlayer.get(left.playerId) ?? Number.MAX_SAFE_INTEGER) -
          (seatByPlayer.get(right.playerId) ?? Number.MAX_SAFE_INTEGER) ||
        left.playerId.localeCompare(right.playerId),
    );
}

export function nightKindForPhase(
  phase: GameState['phase'],
): NightKind | undefined {
  if (phase === 'first_night') return 'firstNight';
  if (phase === 'night') return 'otherNight';
  return undefined;
}

export function getNightOrder(
  state: GameState,
  options: NightOrderOptions = {},
): NightOrderEntry[] {
  const nightKind = nightKindForPhase(state.phase);
  if (nightKind === undefined) return [];
  return calculateNightOrder(state, TROUBLE_BREWING_ROLES, nightKind, options);
}

export function getCurrentNightActor(
  state: GameState,
  completedPlayerIds: readonly PlayerId[] = [],
  options: NightOrderOptions = {},
): NightOrderEntry | undefined {
  const completed = new Set(completedPlayerIds);
  return getNightOrder(state, options).find(
    ({ playerId }) => !completed.has(playerId),
  );
}
