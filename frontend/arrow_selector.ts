import {ArrowLocation} from './board';
import {WsEvaluationData} from './ws_feed';

export interface ArrowInfo {
  variationIdx: number;
  ply: number;
}

const ARROW_BUDGET = 10;
const MAX_VARIATION_IDX = 9;
const MIN_WEIGHT = 1 / 50;
const INITIAL_DECAY = 4.0;
const SECOND_DECAY = 1.0;
const FAR_DECAY = 1.0;

interface QueueItem {
  variationIdx: number;
  ply: number;
  weight: number;
  pv: string[];
  visitedSquares: Set<string>;
}

export function selectArrowsToRender(update: WsEvaluationData): ArrowInfo[] {
  let candidates: QueueItem[] = [];
  for (let [idx, variation] of update.variations.entries()) {
    if (idx >= MAX_VARIATION_IDX) break;
    const weight = variation.nodes / update.variations[0].nodes;
    if (weight < MIN_WEIGHT) break;
    const pv = variation.pvUci.split(' ');
    candidates.push({
      variationIdx: idx,
      ply: 0,
      weight,
      pv,
      visitedSquares: new Set([pv[0].slice(0, 2), pv[0].slice(2, 4)])
    });
  }

  let arrows: ArrowInfo[] = [];

  while (candidates.length > 0 && arrows.length < ARROW_BUDGET) {
    candidates.sort((a, b) => a.weight - b.weight);
    const candidate = candidates.pop()!;

    arrows.push({variationIdx: candidate.variationIdx, ply: candidate.ply});
    if (candidate.ply == 0) {
      candidate.weight /= INITIAL_DECAY;
      ++candidate.ply;
    } else if (candidate.ply == 1) {
      candidate.weight /= SECOND_DECAY;
      ++candidate.ply;
    } else {
      candidate.weight /= FAR_DECAY;
      candidate.ply += 2;
    }
    if (candidate.weight < MIN_WEIGHT) continue;
    if (candidate.pv.length <= candidate.ply) continue;

    if (candidate.ply >= 2) {
      const src = candidate.pv[candidate.ply].slice(0, 2);
      if (!candidate.visitedSquares.has(src)) continue;
      const newDst = candidate.pv[candidate.ply].slice(2, 4);
      if (candidate.visitedSquares.has(newDst)) continue;
      candidate.visitedSquares.add(newDst);
    }
    candidates.push(candidate);
  }

  arrows.sort((a, b) => a.ply - b.ply);
  return arrows;
}

export function numVariationsToRender(update: WsEvaluationData): number {
  const arrows = selectArrowsToRender(update);
  return arrows.reduce((max, x) => Math.max(max, x.variationIdx + 1), 0);
}