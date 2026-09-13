import type { GamingPlatform } from "@/lib/platforms";
import type { CommitmentFilter, PickSetup } from "@/lib/match-scoring";

export type Eligibility = {
  status: "supported" | "unsupported" | "uncertain";
  reasons: Array<{ code: string; message: string }>;
  setupId?: string;
};

export type PickConstraints = {
  selectedParticipantIds: string[];
  selectionExplicit: boolean;
  playerCount: number;
  mode: "online" | "local" | "either";
  setup: PickSetup;
  sessionMinutes: number;
  commitment: CommitmentFilter;
  platforms: GamingPlatform[];
  genres: string[];
  tags: string[];
};

export type OwnershipState = "have" | "dontHave" | "unknown";

export type OwnershipEvidence = {
  state: OwnershipState;
  source: "user-library" | "legacy-session" | "none";
};

export type OwnershipMatrix = Map<string, Map<string, OwnershipEvidence>>;

export type MatchSnapshot<TParticipant, TCandidate> = {
  asOf: Date;
  complete: boolean;
  participants: TParticipant[];
  candidates: TCandidate[];
  ownership: OwnershipMatrix;
  constraints: PickConstraints;
};

export type RecommendationActionPolicy = {
  canShortlist: boolean;
  canSignal: boolean;
  canChooseFinal: boolean;
};
