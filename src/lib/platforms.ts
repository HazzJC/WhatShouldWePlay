export const gamingPlatforms = ["PC", "Xbox", "PlayStation", "Nintendo Switch", "Mobile"] as const;

export type GamingPlatform = (typeof gamingPlatforms)[number];

const aliases: Record<string, GamingPlatform> = {
  pc: "PC",
  steam: "PC",
  windows: "PC",
  mac: "PC",
  linux: "PC",
  xbox: "Xbox",
  "xbox one": "Xbox",
  "xbox series": "Xbox",
  "xbox series x|s": "Xbox",
  "game pass": "Xbox",
  playstation: "PlayStation",
  "playstation 4": "PlayStation",
  "playstation 5": "PlayStation",
  ps4: "PlayStation",
  ps5: "PlayStation",
  switch: "Nintendo Switch",
  "switch 2": "Nintendo Switch",
  "nintendo switch": "Nintendo Switch",
  mobile: "Mobile",
  ios: "Mobile",
  android: "Mobile",
};

export function normalizeGamingPlatform(value: string): GamingPlatform | null {
  return aliases[value.trim().toLocaleLowerCase()] ?? null;
}

export function parseGamingPlatforms(value: unknown): GamingPlatform[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value.flatMap((item) => {
    const platform = typeof item === "string" ? normalizeGamingPlatform(item) : null;
    return platform ? [platform] : [];
  }))];
}
