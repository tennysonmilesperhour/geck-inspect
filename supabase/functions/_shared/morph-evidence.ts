export type RawVisualNeighbor = {
  id: string;
  image_url: string;
  primary_morph: string;
  genetic_traits?: unknown;
  secondary_traits?: unknown;
  base_color?: string | null;
  similarity: number;
  label_weight: number;
  label_source?: string | null;
  source_cluster?: string | null;
};

export type VisualNeighbor = {
  id: string;
  image_url: string;
  primary_morph: string;
  genetic_traits: string[];
  secondary_traits: string[];
  base_color: string | null;
  similarity: number;
  label_weight: number;
  label_source: string;
  source_cluster: string;
};

export type VisualConsensus = {
  primary_morph: string;
  agreement: number;
  weighted_score: number;
  support: number;
  mean_similarity: number;
  source_diversity: number;
  runner_up: string | null;
  margin: number;
};

export type VisualEvidence = {
  status: "available" | "no_matches" | "unavailable";
  model: string | null;
  photo_count: number;
  neighbors: VisualNeighbor[];
  consensus: VisualConsensus | null;
  note?: string;
};

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.length > 0)
    : [];
}

function finite(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function buildVisualEvidence(
  rows: RawVisualNeighbor[],
  options: {
    model: string;
    photoCount: number;
    minSimilarity?: number;
    maxNeighbors?: number;
    maxPerMorph?: number;
  },
): VisualEvidence {
  const minSimilarity = options.minSimilarity ?? 0.50;
  const maxNeighbors = options.maxNeighbors ?? 8;
  const maxPerMorph = options.maxPerMorph ?? 2;
  const seenClusters = new Set<string>();
  const countsByMorph = new Map<string, number>();
  const neighbors: VisualNeighbor[] = [];

  const normalized = rows.flatMap((row): VisualNeighbor[] => {
    const similarity = finite(row.similarity, -1);
    const labelWeight = Math.max(0.1, Math.min(1, finite(row.label_weight, 0.4)));
    if (!row.id || !row.image_url || !row.primary_morph || similarity < minSimilarity) return [];
    return [{
      id: row.id,
      image_url: row.image_url,
      primary_morph: row.primary_morph,
      genetic_traits: stringArray(row.genetic_traits),
      secondary_traits: stringArray(row.secondary_traits),
      base_color: typeof row.base_color === "string" ? row.base_color : null,
      similarity: Math.max(-1, Math.min(1, similarity)),
      label_weight: labelWeight,
      label_source: row.label_source || "unclassified",
      source_cluster: row.source_cluster || row.id,
    }];
  }).sort((a, b) => b.similarity - a.similarity);

  for (const row of normalized) {
    if (neighbors.length >= maxNeighbors) break;
    if (seenClusters.has(row.source_cluster)) continue;
    const morphCount = countsByMorph.get(row.primary_morph) || 0;
    if (morphCount >= maxPerMorph) continue;
    seenClusters.add(row.source_cluster);
    countsByMorph.set(row.primary_morph, morphCount + 1);
    neighbors.push(row);
  }

  if (neighbors.length === 0) {
    return {
      status: "no_matches",
      model: options.model,
      photo_count: options.photoCount,
      neighbors: [],
      consensus: null,
    };
  }

  const votes = new Map<string, { score: number; support: number; similarity: number; clusters: Set<string> }>();
  let totalScore = 0;
  for (const row of neighbors) {
    const score = Math.max(0, row.similarity - minSimilarity + 0.1) ** 2 * row.label_weight;
    totalScore += score;
    const current = votes.get(row.primary_morph) || {
      score: 0,
      support: 0,
      similarity: 0,
      clusters: new Set<string>(),
    };
    current.score += score;
    current.support += 1;
    current.similarity += row.similarity;
    current.clusters.add(row.source_cluster);
    votes.set(row.primary_morph, current);
  }
  const ranked = [...votes.entries()].sort((a, b) => b[1].score - a[1].score);
  const [topMorph, top] = ranked[0];
  const runnerUp = ranked[1] || null;
  const agreement = totalScore > 0 ? top.score / totalScore : 0;
  const runnerAgreement = totalScore > 0 && runnerUp ? runnerUp[1].score / totalScore : 0;

  return {
    status: "available",
    model: options.model,
    photo_count: options.photoCount,
    neighbors,
    consensus: {
      primary_morph: topMorph,
      agreement,
      weighted_score: top.score,
      support: top.support,
      mean_similarity: top.similarity / top.support,
      source_diversity: top.clusters.size,
      runner_up: runnerUp?.[0] || null,
      margin: agreement - runnerAgreement,
    },
  };
}

export function evidenceAssessment(
  primaryMorph: string | null,
  modelSignal: number,
  modelMargin: number,
  photoAssessment: {
    subject_is_crested_gecko: boolean;
    usable_for_id: boolean;
    quality_grade: string;
  },
  evidence: VisualEvidence,
): { status: "best_match" | "tentative" | "insufficient_evidence"; conflict: boolean } {
  if (
    !primaryMorph ||
    !photoAssessment.subject_is_crested_gecko ||
    !photoAssessment.usable_for_id ||
    photoAssessment.quality_grade === "poor"
  ) {
    return { status: "insufficient_evidence", conflict: false };
  }

  const consensus = evidence.consensus;
  const retrievalIsStrong = evidence.status === "available" && !!consensus &&
    consensus.support >= 2 &&
    consensus.source_diversity >= 2 &&
    consensus.agreement >= 0.50 &&
    consensus.margin >= 0.15 &&
    consensus.mean_similarity >= 0.55;
  const conflict = !!(retrievalIsStrong && consensus?.primary_morph !== primaryMorph);
  const retrievalSupports = !!(retrievalIsStrong && consensus?.primary_morph === primaryMorph);
  const modelIsStrong = modelSignal >= 75 && modelMargin >= 12;

  return {
    status: modelIsStrong && !conflict && (retrievalSupports || evidence.status !== "available")
      ? "best_match"
      : "tentative",
    conflict,
  };
}
