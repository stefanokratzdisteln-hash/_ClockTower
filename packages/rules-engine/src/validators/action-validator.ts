import type { GameState, PlayerId } from '@clocktower/shared';

import {
  getTroubleBrewingRole,
  type TroubleBrewingAbilityModel,
} from '../scripts/trouble-brewing.js';
import {
  getNightOrder,
  nightKindForPhase,
  type NightOrderOptions,
} from '../selectors/night-order.js';

export type NightActionValidation =
  { valid: true } | { valid: false; errors: readonly string[] };

function abilityForActor(
  state: GameState,
  actorPlayerId: PlayerId,
): TroubleBrewingAbilityModel | undefined {
  const assignment = state.assignments.find(
    ({ playerId }) => playerId === actorPlayerId,
  );
  return assignment === undefined
    ? undefined
    : getTroubleBrewingRole(assignment.characterId)?.abilityModel;
}

export function getLegalNightTargets(
  state: GameState,
  actorPlayerId: PlayerId,
  options: NightOrderOptions = {},
): PlayerId[] {
  if (nightKindForPhase(state.phase) === undefined) return [];
  if (
    !getNightOrder(state, options).some(
      ({ playerId }) => playerId === actorPlayerId,
    )
  ) {
    return [];
  }
  const targeting = abilityForActor(state, actorPlayerId)?.targeting;
  if (targeting === undefined) return [];

  return state.players
    .filter(({ id }) => {
      if (!targeting.allowSelf && id === actorPlayerId) return false;
      const assignment = state.assignments.find(
        ({ playerId }) => playerId === id,
      );
      return (
        assignment !== undefined &&
        (targeting.alive === 'any' || assignment.status.alive)
      );
    })
    .sort((left, right) => left.seatIndex - right.seatIndex)
    .map(({ id }) => id);
}

export function validateNightAction(
  state: GameState,
  actorPlayerId: PlayerId,
  targetPlayerIds: readonly PlayerId[],
  options: NightOrderOptions = {},
): NightActionValidation {
  const errors: string[] = [];
  const nightKind = nightKindForPhase(state.phase);
  if (nightKind === undefined) {
    errors.push(`Night actions are not allowed during ${state.phase}.`);
  }

  const assignment = state.assignments.find(
    ({ playerId }) => playerId === actorPlayerId,
  );
  if (assignment === undefined) {
    errors.push(`Unknown assigned player: ${actorPlayerId}.`);
    return { valid: false, errors };
  }

  const role = getTroubleBrewingRole(assignment.characterId);
  const ability = role?.abilityModel;
  const targeting = ability?.targeting;
  const expectedTiming =
    nightKind === 'firstNight' ? 'firstNight' : 'otherNight';
  if (ability === undefined || !ability.timing.includes(expectedTiming)) {
    errors.push(`${assignment.characterId} has no action this night.`);
  } else if (
    !getNightOrder(state, options).some(
      ({ playerId }) => playerId === actorPlayerId,
    )
  ) {
    errors.push(`${assignment.characterId} does not wake in this night state.`);
  }

  const uniqueTargets = new Set(targetPlayerIds);
  if (uniqueTargets.size !== targetPlayerIds.length) {
    errors.push('A target may only be selected once.');
  }

  if (targeting === undefined) {
    if (targetPlayerIds.length > 0) {
      errors.push(`${assignment.characterId} does not select targets.`);
    }
  } else {
    if (
      targetPlayerIds.length < targeting.minTargets ||
      targetPlayerIds.length > targeting.maxTargets
    ) {
      errors.push(
        `Expected ${targeting.minTargets}-${targeting.maxTargets} targets; received ${targetPlayerIds.length}.`,
      );
    }
    const legalTargets = new Set(
      getLegalNightTargets(state, actorPlayerId, options),
    );
    for (const target of uniqueTargets) {
      if (!legalTargets.has(target)) {
        errors.push(`Illegal target: ${target}.`);
      }
    }
  }

  return errors.length === 0 ? { valid: true } : { valid: false, errors };
}
