import {ArrowLocation} from './board';
import {WsEvaluationData} from './ws_feed';

export interface ArrowInfo {
  variationIdx: number;
  ply: number;
}

const ARROW_BUDGET = 10;
const MANEUVER_BUDGET_USE = 0.5;
const MAX_VARIATION_IDX = 9;
const MIN_WEIGHT = 1 / 25;
const RESPONSE_WEIGHT_MULTIPLIER = 1 / 2;
const MANEUVER_WEIGHT_MULTIPLIER = 1 / 4;
const RESPONSE_MANEUVER_WEIGHT_MULTIPLIER = 1 / 6;

interface QueueItem {
  variationIdx: number;
  ply: number;
  weight: number;
}

export function selectArrowsToRender(update: WsEvaluationData): ArrowInfo[] {
  let candidates: QueueItem[] = [];

  for (let [idx, variation] of update.variations.entries()) {
    if (idx >= MAX_VARIATION_IDX) break;
    const weight = variation.nodes / update.nodes;
    if (weight < MIN_WEIGHT) break;
    const pv = variation.pvUci.split(' ');
    candidates.push({
      variationIdx: idx,
      ply: 0,
      weight,
    });
    candidates.push({
      variationIdx: idx,
      ply: 1,
      weight: weight * RESPONSE_WEIGHT_MULTIPLIER,
    });

    const pushManeuver = (ply: number, weight: number) => {
      if (ply >= pv.length) return;
      const visitedSquares = new Set<string>();
      visitedSquares.add(pv[ply - 2].slice(2, 4));
      while (ply < pv.length) {
        const move = pv[ply];
        if (!visitedSquares.has(move.slice(0, 2))) break;
        if (visitedSquares.has(move.slice(2, 4))) break;
        visitedSquares.add(move.slice(2, 4));
        candidates.push({
          variationIdx: idx,
          ply: ply,
          weight,
        });
        ply += 2;
      }
    };
    pushManeuver(2, weight * MANEUVER_WEIGHT_MULTIPLIER);
    pushManeuver(3, weight * RESPONSE_MANEUVER_WEIGHT_MULTIPLIER);
  }

  let arrows: ArrowInfo[] = [];
  let remainingBudget = ARROW_BUDGET;

  candidates.sort((a, b) => (a.weight - b.weight) || (b.ply - a.ply));
  while (candidates.length > 0) {
    const candidate = candidates.pop()!;
    if (candidate.weight < MIN_WEIGHT) break;
    if (candidate.ply <= 3 && remainingBudget <= 0) break;
    arrows.push({variationIdx: candidate.variationIdx, ply: candidate.ply});
    remainingBudget -= candidate.ply >= 2 ? MANEUVER_BUDGET_USE : 1;
  }
  arrows.sort((a, b) => a.ply - b.ply);
  return arrows;
}

export function numVariationsToRender(update: WsEvaluationData): number {
  const arrows = selectArrowsToRender(update);
  return arrows.reduce((max, x) => Math.max(max, x.variationIdx + 1), 0);
}