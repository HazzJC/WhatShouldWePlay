import type { CommitmentFilter, ScoreMode } from "@/lib/match-scoring";
import { normalizeGamingPlatform, type GamingPlatform } from "@/lib/platforms";

type QueryValue = string | string[] | undefined;
export type PickSearchParams = Record<string, QueryValue>;

export type PickQuery = {
  selectedParticipantIds: string[];
  selectionExplicit: boolean;
  playerCount: number;
  mode: "online" | "local" | "either";
  setup: "native" | "modded" | "either";
  scoreMode: ScoreMode;
  sessionMinutes: number;
  commitment: CommitmentFilter;
  search: string;
  page: number;
  pageSize: number;
  platforms: GamingPlatform[];
  genres: string[];
  tags: string[];
  groupBuy: {
    budget: number;
    genre: string;
    mode: "online" | "local" | "either";
    sessionLength: "one-night" | "long-term" | "campaign" | "any";
    platform: string;
    avoidOwned: boolean;
    saleOnly: boolean;
  };
};

export type ParsePickQueryOptions = {
  allowedParticipantIds: Iterable<string>;
  defaultSelectedParticipantIds?: Iterable<string>;
  defaultPlayerCount?: number;
  defaultSessionMinutes?: number;
};

const SCORE_MODES = ["balanced", "coop", "backlog", "cheap", "familiar", "fresh"] as const;
const COMMITMENTS = ["any", "one-session", "under-10", "10-30", "30-100", "100-1000", "1000-plus", "endless"] as const;
const SETUPS = ["native", "modded", "either"] as const;
const MODES = ["online", "local", "either"] as const;
const SESSION_LENGTHS = ["one-night", "long-term", "campaign", "any"] as const;

const MAX_PLAYER_COUNT = 50;
const MAX_SESSION_MINUTES = 1_440;
const MAX_PAGE = 10_000;
const MAX_PAGE_SIZE = 100;
const MAX_BUDGET_MINOR = 10_000_000;
const MAX_TEXT_LENGTH = 120;
const MAX_FACET_VALUES = 20;

export function parsePickQuery(params: PickSearchParams, options: ParsePickQueryOptions): PickQuery {
  const allowedParticipantIds = new Set(options.allowedParticipantIds);
  // `selectedParticipants` is accepted for the existing GET form; new callers use
  // the contract name so the client and snapshot DTO describe the same thing.
  const selectedValues = valuesFor(params, "selectedParticipantIds", "selectedParticipants");
  const selectionExplicit = parseBoolean(first(params, "selectionExplicit")) ?? selectedValues.length > 0;
  const defaults = uniqueAllowed(options.defaultSelectedParticipantIds ?? allowedParticipantIds, allowedParticipantIds);
  const selectedParticipantIds = selectionExplicit
    ? uniqueAllowed(selectedValues, allowedParticipantIds)
    : defaults;

  return {
    selectedParticipantIds,
    selectionExplicit,
    playerCount: parseInteger(first(params, "playerCount"), options.defaultPlayerCount ?? 1, 1, MAX_PLAYER_COUNT),
    mode: parseEnum(first(params, "mode"), MODES, "either"),
    setup: parseEnum(first(params, "setup"), SETUPS, "native"),
    scoreMode: parseEnum(first(params, "scoreMode"), SCORE_MODES, "balanced"),
    sessionMinutes: parseInteger(first(params, "sessionMinutes"), options.defaultSessionMinutes ?? 60, 0, MAX_SESSION_MINUTES),
    commitment: parseEnum(first(params, "commitment"), COMMITMENTS, "any"),
    search: parseText(first(params, "search")),
    page: parseInteger(first(params, "page"), 1, 1, MAX_PAGE),
    pageSize: parseInteger(first(params, "pageSize"), 24, 1, MAX_PAGE_SIZE),
    platforms: uniquePlatforms(valuesFor(params, "platforms", "platform")),
    genres: parseFacet(valuesFor(params, "genres", "genre")),
    tags: parseFacet(valuesFor(params, "tags", "tag")),
    groupBuy: {
      budget: parseMoneyMinor(first(params, "groupBudget"), 0),
      genre: parseText(first(params, "groupGenre")),
      mode: parseEnum(first(params, "groupMode"), MODES, "either"),
      sessionLength: parseEnum(first(params, "groupLength"), SESSION_LENGTHS, "any"),
      platform: parseText(first(params, "groupPlatform")),
      avoidOwned: parseBoolean(first(params, "avoidOwned")) ?? false,
      saleOnly: parseBoolean(first(params, "saleOnly")) ?? false,
    },
  };
}

export function serializePickQuery(query: PickQuery): URLSearchParams {
  const params = new URLSearchParams();
  params.set("selectionExplicit", String(query.selectionExplicit));
  for (const participantId of query.selectedParticipantIds) params.append("selectedParticipantIds", participantId);
  params.set("playerCount", String(query.playerCount));
  params.set("mode", query.mode);
  params.set("setup", query.setup);
  params.set("scoreMode", query.scoreMode);
  params.set("sessionMinutes", String(query.sessionMinutes));
  params.set("commitment", query.commitment);
  params.set("search", query.search);
  params.set("page", String(query.page));
  params.set("pageSize", String(query.pageSize));
  for (const platform of query.platforms) params.append("platforms", platform);
  for (const genre of query.genres) params.append("genres", genre);
  for (const tag of query.tags) params.append("tags", tag);
  params.set("groupBudget", (query.groupBuy.budget / 100).toFixed(2));
  params.set("groupGenre", query.groupBuy.genre);
  params.set("groupMode", query.groupBuy.mode);
  params.set("groupLength", query.groupBuy.sessionLength);
  params.set("groupPlatform", query.groupBuy.platform);
  params.set("avoidOwned", String(query.groupBuy.avoidOwned));
  params.set("saleOnly", String(query.groupBuy.saleOnly));
  return params;
}

function first(params: PickSearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function valuesFor(params: PickSearchParams, ...keys: string[]) {
  return keys.flatMap((key) => {
    const value = params[key];
    return (Array.isArray(value) ? value : value === undefined ? [] : [value]).filter((item) => item.length > 0);
  });
}

function parseInteger(value: string | undefined, fallback: number, minimum: number, maximum: number) {
  if (!value || !/^(?:0|[1-9]\d*)$/.test(value)) return fallback;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : fallback;
}

function parseMoneyMinor(value: string | undefined, fallback: number) {
  if (!value || !/^\d+(?:\.\d{1,2})?$/.test(value)) return fallback;
  const [whole, fraction = ""] = value.split(".");
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(minor) && minor <= MAX_BUDGET_MINOR ? minor : fallback;
}

function parseEnum<T extends readonly string[]>(value: string | undefined, values: T, fallback: T[number]): T[number] {
  return values.includes(value as T[number]) ? value as T[number] : fallback;
}

function parseBoolean(value: string | undefined) {
  return value === "true" ? true : value === "false" ? false : undefined;
}

function parseText(value: string | undefined) {
  return value ? value.trim().slice(0, MAX_TEXT_LENGTH) : "";
}

function parseFacet(values: string[]) {
  return [...new Set(values.map(parseText).filter(Boolean))].slice(0, MAX_FACET_VALUES);
}

function uniquePlatforms(values: string[]) {
  return [...new Set(values.map(normalizeGamingPlatform).filter((value): value is GamingPlatform => value !== null))];
}

function uniqueAllowed(values: Iterable<string>, allowed: Set<string>) {
  return [...new Set([...values].filter((value) => allowed.has(value)))];
}
