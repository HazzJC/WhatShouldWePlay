import { normalizeGameTitle, type GameInput } from "@/lib/games";

export type CuratedGame = GameInput & {
  slug: string;
  description: string;
  listSlugs: string[];
  tags: string[];
  sessionLength: "one-night" | "long-term" | "campaign";
  trending?: boolean;
  releaseStatus?: "released" | "recent" | "upcoming";
  caveat?: string;
};

export type CuratedList = {
  slug: string;
  title: string;
  description: string;
};

type CuratedGameSeed = {
  slug: string;
  title: string;
  description: string;
  listSlugs: string[];
  tags: string[];
  sessionLength: CuratedGame["sessionLength"];
  steamAppId?: number;
  minPlayers: number;
  maxPlayers: number;
  onlineCoop: boolean;
  localCoop: boolean;
  platforms?: string[];
  trending?: boolean;
  releaseStatus?: CuratedGame["releaseStatus"];
  caveat?: string;
};

export const curatedLists: CuratedList[] = [
  { slug: "online-co-op", title: "Best online co-op games", description: "Games that make it easy for a remote group to jump in together." },
  { slug: "local-co-op", title: "Best local co-op games", description: "Couch-friendly games for one screen or one room." },
  { slug: "4-player", title: "Best 4-player games", description: "Reliable picks for the classic four-player group." },
  { slug: "more-than-4", title: "More than 4?", description: "Bigger lobbies, party chaos, survival servers, and social deduction nights. Use the player slider to separate 5+, 10+, 16+, or 50+ needs." },
  { slug: "party", title: "Best party games", description: "Low-friction picks for mixed groups and casual nights." },
  { slug: "campaign-co-op", title: "Best campaign co-op games", description: "Longer shared adventures with meaningful progression." },
  { slug: "survival-groups", title: "Best survival games for groups", description: "Build, explore, panic, regroup, repeat." },
  { slug: "cheap-co-op", title: "Best cheap co-op games", description: "Budget-friendly group picks, especially when deals are live." },
  { slug: "trending-multiplayer", title: "Trending multiplayer games", description: "Currently hot multiplayer picks worth checking." },
  { slug: "recently-released", title: "Recently released group games", description: "Fresh multiplayer releases and current viral picks." },
  { slug: "friend-slop", title: "Fresh and upcoming friend-slop", description: "Messy, funny, highly shareable games for group discovery." },
];

export const curatedGames: CuratedGame[] = [
  game({ slug: "meccha-chameleon", title: "Meccha Chameleon", description: "A viral paint-and-hide party game with chaotic lobbies and strong spectator energy.", listSlugs: ["recently-released", "friend-slop", "party", "more-than-4", "more-than-4", "cheap-co-op", "trending-multiplayer"], tags: ["hide and seek", "party", "viral"], sessionLength: "one-night", steamAppId: 4704690, minPlayers: 2, maxPlayers: 24, onlineCoop: true, localCoop: false, platforms: ["PC", "Steam"], trending: true, releaseStatus: "recent", caveat: "Recommended around 2-10 players; larger rooms depend heavily on host connection and stability." }),
  game({ slug: "big-walk", title: "Big Walk", description: "A cooperative walker-talker from House House built around getting lost and communicating with friends.", listSlugs: ["friend-slop", "online-co-op", "more-than-4", "party"], tags: ["co-op", "communication", "adventure"], sessionLength: "one-night", steamAppId: 1478500, minPlayers: 2, maxPlayers: 12, onlineCoop: true, localCoop: false, platforms: ["PC", "Mac", "PlayStation 5", "Switch 2"], trending: true, releaseStatus: "upcoming", caveat: "Planned for August 4, 2026; use as a wishlist/upcoming pick until release." }),
  game({ slug: "repo", title: "R.E.P.O.", description: "Scrappy physics horror extraction for groups who enjoy panic, betrayal, and bad decisions.", listSlugs: ["friend-slop", "online-co-op", "more-than-4", "party", "trending-multiplayer"], tags: ["horror", "physics", "friendslop"], sessionLength: "one-night", steamAppId: 3241660, minPlayers: 1, maxPlayers: 6, onlineCoop: true, localCoop: false, trending: true, releaseStatus: "recent" }),
  game({ slug: "peak", title: "PEAK", description: "Climb, fall, shout, recover: a compact co-op chaos pick for a small group.", listSlugs: ["friend-slop", "online-co-op", "party", "recently-released"], tags: ["co-op", "climbing", "chaos"], sessionLength: "one-night", steamAppId: 3527290, minPlayers: 1, maxPlayers: 4, onlineCoop: true, localCoop: false, trending: true, releaseStatus: "recent" }),
  game({ slug: "content-warning", title: "Content Warning", description: "Film spooky nonsense with friends and try to survive long enough to upload it.", listSlugs: ["friend-slop", "online-co-op", "4-player", "party"], tags: ["horror", "co-op", "comedy"], sessionLength: "one-night", steamAppId: 2881650, minPlayers: 1, maxPlayers: 4, onlineCoop: true, localCoop: false, trending: true }),
  game({ slug: "lethal-company", title: "Lethal Company", description: "Scrappy co-op horror built for laughs, panic, and clips.", listSlugs: ["online-co-op", "4-player", "party", "friend-slop", "cheap-co-op"], tags: ["horror", "co-op", "party"], sessionLength: "one-night", steamAppId: 1966720, minPlayers: 1, maxPlayers: 4, onlineCoop: true, localCoop: false, trending: true }),
  game({ slug: "phasmophobia", title: "Phasmophobia", description: "Co-op ghost hunting with strong one-night energy.", listSlugs: ["online-co-op", "4-player", "party"], tags: ["horror", "co-op"], sessionLength: "one-night", steamAppId: 739630, minPlayers: 1, maxPlayers: 4, onlineCoop: true, localCoop: false }),

  game({ slug: "deep-rock-galactic", title: "Deep Rock Galactic", description: "Co-op mining chaos with strong 4-player teamwork.", listSlugs: ["online-co-op", "4-player", "cheap-co-op"], tags: ["co-op", "shooter", "dwarves"], sessionLength: "long-term", steamAppId: 548430, minPlayers: 1, maxPlayers: 4, onlineCoop: true, localCoop: false }),
  game({ slug: "helldivers-2", title: "HELLDIVERS 2", description: "Explosive online co-op with fast missions and big group energy.", listSlugs: ["online-co-op", "4-player", "trending-multiplayer"], tags: ["co-op", "shooter", "intense"], sessionLength: "long-term", steamAppId: 553850, minPlayers: 1, maxPlayers: 4, onlineCoop: true, localCoop: false, trending: true }),
  game({ slug: "sea-of-thieves", title: "Sea of Thieves", description: "Pirate co-op with sessions that naturally turn into stories.", listSlugs: ["online-co-op", "4-player", "campaign-co-op"], tags: ["co-op", "adventure", "open world"], sessionLength: "long-term", steamAppId: 1172620, minPlayers: 1, maxPlayers: 4, onlineCoop: true, localCoop: false }),
  game({ slug: "monster-hunter-wilds", title: "Monster Hunter Wilds", description: "Big hunts, repeated sessions, and a natural fit for a committed four-player group.", listSlugs: ["online-co-op", "4-player", "campaign-co-op", "trending-multiplayer"], tags: ["action", "co-op", "campaign"], sessionLength: "long-term", steamAppId: 2246340, minPlayers: 1, maxPlayers: 4, onlineCoop: true, localCoop: false, trending: true }),
  game({ slug: "warhammer-vermintide-2", title: "Warhammer: Vermintide 2", description: "Melee-focused horde co-op with a mountain of classes and progression.", listSlugs: ["online-co-op", "4-player", "cheap-co-op"], tags: ["co-op", "horde", "melee"], sessionLength: "long-term", steamAppId: 552500, minPlayers: 1, maxPlayers: 4, onlineCoop: true, localCoop: false }),
  game({ slug: "left-4-dead-2", title: "Left 4 Dead 2", description: "Still one of the cleanest templates for a co-op campaign night.", listSlugs: ["online-co-op", "4-player", "campaign-co-op", "cheap-co-op"], tags: ["co-op", "campaign", "zombies"], sessionLength: "one-night", steamAppId: 550, minPlayers: 1, maxPlayers: 4, onlineCoop: true, localCoop: true }),
  game({ slug: "risk-of-rain-2", title: "Risk of Rain 2", description: "Stack absurd builds together and turn a short run into a disaster story.", listSlugs: ["online-co-op", "4-player"], tags: ["roguelite", "co-op", "action"], sessionLength: "one-night", steamAppId: 632360, minPlayers: 1, maxPlayers: 4, onlineCoop: true, localCoop: false }),
  game({ slug: "baldurs-gate-3", title: "Baldur's Gate 3", description: "A deep campaign co-op choice for committed groups.", listSlugs: ["online-co-op", "campaign-co-op", "4-player"], tags: ["rpg", "campaign", "turn-based"], sessionLength: "campaign", steamAppId: 1086940, minPlayers: 1, maxPlayers: 4, onlineCoop: true, localCoop: true }),

  game({ slug: "overcooked-2", title: "Overcooked! 2", description: "Local and online co-op stress disguised as cooking.", listSlugs: ["local-co-op", "online-co-op", "4-player", "party"], tags: ["co-op", "party", "chaos"], sessionLength: "one-night", steamAppId: 728880, minPlayers: 1, maxPlayers: 4, onlineCoop: true, localCoop: true }),
  game({ slug: "plateup", title: "PlateUp!", description: "Restaurant roguelite co-op with satisfying group escalation.", listSlugs: ["local-co-op", "online-co-op", "4-player", "party"], tags: ["co-op", "roguelite", "management"], sessionLength: "one-night", steamAppId: 1599600, minPlayers: 1, maxPlayers: 4, onlineCoop: true, localCoop: true }),
  game({ slug: "ultimate-chicken-horse", title: "Ultimate Chicken Horse", description: "Build the level, sabotage the level, pretend it was fair.", listSlugs: ["local-co-op", "online-co-op", "4-player", "party", "cheap-co-op"], tags: ["party", "platformer", "competitive"], sessionLength: "one-night", steamAppId: 386940, minPlayers: 2, maxPlayers: 4, onlineCoop: true, localCoop: true }),
  game({ slug: "towerfall-ascension", title: "TowerFall Ascension", description: "Tiny arena archery with instant readability and local chaos.", listSlugs: ["local-co-op", "4-player", "party", "cheap-co-op"], tags: ["local", "party", "arena"], sessionLength: "one-night", steamAppId: 251470, minPlayers: 2, maxPlayers: 4, onlineCoop: false, localCoop: true }),
  game({ slug: "pico-park", title: "PICO PARK", description: "Simple cooperative puzzles that get funnier as communication breaks down.", listSlugs: ["local-co-op", "online-co-op", "more-than-4", "party", "cheap-co-op"], tags: ["puzzle", "party", "co-op"], sessionLength: "one-night", steamAppId: 1509960, minPlayers: 2, maxPlayers: 8, onlineCoop: true, localCoop: true }),
  game({ slug: "stardew-valley", title: "Stardew Valley", description: "Chill farming co-op that works for short visits or long campaigns.", listSlugs: ["online-co-op", "local-co-op", "campaign-co-op", "cheap-co-op", "more-than-4"], tags: ["chill", "farming", "campaign"], sessionLength: "campaign", steamAppId: 413150, minPlayers: 1, maxPlayers: 8, onlineCoop: true, localCoop: true }),

  game({ slug: "valheim", title: "Valheim", description: "Survival crafting with broad group goals and low pressure pacing.", listSlugs: ["online-co-op", "survival-groups", "cheap-co-op", "more-than-4"], tags: ["survival", "crafting", "open world"], sessionLength: "long-term", steamAppId: 892970, minPlayers: 1, maxPlayers: 10, onlineCoop: true, localCoop: false, caveat: "Best for larger groups with a persistent hosted world." }),
  game({ slug: "project-zomboid", title: "Project Zomboid", description: "Deep survival sandbox for patient group storytelling.", listSlugs: ["online-co-op", "survival-groups", "more-than-4", "more-than-4"], tags: ["survival", "sandbox", "hardcore"], sessionLength: "long-term", steamAppId: 108600, minPlayers: 1, maxPlayers: 32, onlineCoop: true, localCoop: false, caveat: "Large groups are best on a dedicated server with agreed rules." }),
  game({ slug: "minecraft", title: "Minecraft", description: "The default large-group sandbox: build, survive, mod, or host a private event.", listSlugs: ["online-co-op", "survival-groups", "more-than-4", "more-than-4", "party"], tags: ["sandbox", "survival", "server"], sessionLength: "long-term", minPlayers: 1, maxPlayers: 30, onlineCoop: true, localCoop: true, platforms: ["PC", "Xbox", "PlayStation", "Switch", "Mobile"], caveat: "16+ works best with a Realm or dedicated/community server." }),
  game({ slug: "terraria", title: "Terraria", description: "Bosses, building, exploration, and long-term chaos for a medium group.", listSlugs: ["online-co-op", "survival-groups", "more-than-4", "cheap-co-op"], tags: ["sandbox", "crafting", "bosses"], sessionLength: "long-term", steamAppId: 105600, minPlayers: 1, maxPlayers: 8, onlineCoop: true, localCoop: false }),
  game({ slug: "core-keeper", title: "Core Keeper", description: "Underground survival crafting that scales nicely beyond a small squad.", listSlugs: ["online-co-op", "survival-groups", "more-than-4"], tags: ["survival", "crafting", "co-op"], sessionLength: "long-term", steamAppId: 1621690, minPlayers: 1, maxPlayers: 8, onlineCoop: true, localCoop: false }),
  game({ slug: "enshrouded", title: "Enshrouded", description: "Voxel survival RPG with a meaningful 16-player ceiling for hosted worlds.", listSlugs: ["online-co-op", "survival-groups", "more-than-4", "more-than-4"], tags: ["survival", "rpg", "server"], sessionLength: "long-term", steamAppId: 1203620, minPlayers: 1, maxPlayers: 16, onlineCoop: true, localCoop: false, caveat: "Use a hosted or dedicated server for smooth 16-player sessions." }),
  game({ slug: "palworld", title: "Palworld", description: "Creature survival chaos that can scale up when hosted properly.", listSlugs: ["online-co-op", "survival-groups", "more-than-4", "more-than-4", "trending-multiplayer"], tags: ["survival", "crafting", "server"], sessionLength: "long-term", steamAppId: 1623730, minPlayers: 1, maxPlayers: 32, onlineCoop: true, localCoop: false, caveat: "Large groups require a dedicated server; small co-op is simpler." }),
  game({ slug: "ark-survival-ascended", title: "ARK: Survival Ascended", description: "Dinosaur survival for groups who want a persistent server project.", listSlugs: ["online-co-op", "survival-groups", "more-than-4", "more-than-4"], tags: ["survival", "dinosaurs", "server"], sessionLength: "long-term", steamAppId: 2399830, minPlayers: 1, maxPlayers: 70, onlineCoop: true, localCoop: false, caveat: "16+ is a server-hosting commitment, not a casual lobby." }),
  game({ slug: "factorio", title: "Factorio", description: "A shared factory project that gets funnier and more terrifying with each extra engineer.", listSlugs: ["online-co-op", "survival-groups", "more-than-4", "more-than-4"], tags: ["automation", "factory", "server"], sessionLength: "long-term", steamAppId: 427520, minPlayers: 1, maxPlayers: 32, onlineCoop: true, localCoop: false, caveat: "Large groups work best with a persistent server and clear roles." }),
  game({ slug: "satisfactory", title: "Satisfactory", description: "First-person factory building for a group that enjoys shared megaprojects.", listSlugs: ["online-co-op", "survival-groups", "more-than-4"], tags: ["factory", "building", "co-op"], sessionLength: "long-term", steamAppId: 526870, minPlayers: 1, maxPlayers: 8, onlineCoop: true, localCoop: false, caveat: "Bigger groups are possible through server setups, but 4-8 is the clean recommendation." }),
  game({ slug: "eco", title: "Eco", description: "A civilization-scale server game about building society without destroying the planet.", listSlugs: ["online-co-op", "survival-groups", "more-than-4", "more-than-4"], tags: ["server", "simulation", "society"], sessionLength: "long-term", steamAppId: 382310, minPlayers: 1, maxPlayers: 30, onlineCoop: true, localCoop: false, caveat: "Needs a persistent server and a group willing to coordinate over days." }),
  game({ slug: "barotrauma", title: "Barotrauma", description: "Submarine disaster management for groups who enjoy jobs, shouting, and betrayal.", listSlugs: ["online-co-op", "more-than-4", "more-than-4", "party"], tags: ["submarine", "roles", "chaos"], sessionLength: "one-night", steamAppId: 602960, minPlayers: 2, maxPlayers: 16, onlineCoop: true, localCoop: false }),
  game({ slug: "unturned", title: "Unturned", description: "Lightweight zombie survival with private-server flexibility.", listSlugs: ["online-co-op", "survival-groups", "more-than-4", "more-than-4", "cheap-co-op"], tags: ["survival", "zombies", "server"], sessionLength: "long-term", steamAppId: 304930, minPlayers: 1, maxPlayers: 24, onlineCoop: true, localCoop: false, caveat: "Best for 16+ with a private server and agreed mods/settings." }),
  game({ slug: "rust", title: "Rust", description: "Brutal social survival for groups who specifically want a server war story.", listSlugs: ["survival-groups", "more-than-4", "more-than-4"], tags: ["survival", "pvp", "server"], sessionLength: "long-term", steamAppId: 252490, minPlayers: 1, maxPlayers: 100, onlineCoop: true, localCoop: false, caveat: "Not cosy co-op. Works for 16+ only if the group wants PvP survival friction." }),

  game({ slug: "among-us", title: "Among Us", description: "Social deduction that scales well beyond the usual four.", listSlugs: ["party", "more-than-4", "cheap-co-op"], tags: ["social deduction", "party"], sessionLength: "one-night", steamAppId: 945360, minPlayers: 4, maxPlayers: 15, onlineCoop: true, localCoop: true }),
  game({ slug: "goose-goose-duck", title: "Goose Goose Duck", description: "Social deduction with lots of roles and room for a large voice call.", listSlugs: ["party", "more-than-4", "more-than-4", "cheap-co-op"], tags: ["social deduction", "party", "roles"], sessionLength: "one-night", steamAppId: 1568590, minPlayers: 5, maxPlayers: 16, onlineCoop: true, localCoop: false }),
  game({ slug: "jackbox-party-pack-10", title: "The Jackbox Party Pack 10", description: "Phone-controlled party games for mixed groups.", listSlugs: ["party", "more-than-4", "local-co-op"], tags: ["party", "quiz", "casual"], sessionLength: "one-night", steamAppId: 2216830, minPlayers: 2, maxPlayers: 9, onlineCoop: false, localCoop: true }),
  game({ slug: "gartic-phone", title: "Gartic Phone", description: "Browser-based drawing telephone that works for huge casual groups.", listSlugs: ["party", "more-than-4", "more-than-4"], tags: ["drawing", "browser", "party"], sessionLength: "one-night", minPlayers: 4, maxPlayers: 30, onlineCoop: true, localCoop: false, platforms: ["Browser"], caveat: "Browser game; not a Steam import match, but excellent for big groups." }),
  game({ slug: "skribbl-io", title: "skribbl.io", description: "Fast browser drawing rounds for groups that need zero install friction.", listSlugs: ["party", "more-than-4", "more-than-4"], tags: ["drawing", "browser", "party"], sessionLength: "one-night", minPlayers: 3, maxPlayers: 20, onlineCoop: true, localCoop: false, platforms: ["Browser"], caveat: "Browser game; great backup when ownership is fragmented." }),
  game({ slug: "golf-with-your-friends", title: "Golf With Your Friends", description: "Readable, casual minigolf that can carry a full Discord call.", listSlugs: ["party", "more-than-4", "cheap-co-op"], tags: ["party", "golf", "casual"], sessionLength: "one-night", steamAppId: 431240, minPlayers: 1, maxPlayers: 12, onlineCoop: true, localCoop: true }),
  game({ slug: "gang-beasts", title: "Gang Beasts", description: "Local or online physics brawling that gets sillier as people rotate in.", listSlugs: ["party", "local-co-op", "online-co-op", "more-than-4"], tags: ["party", "fighting", "physics"], sessionLength: "one-night", steamAppId: 285900, minPlayers: 2, maxPlayers: 8, onlineCoop: true, localCoop: true }),
  game({ slug: "party-animals", title: "Party Animals", description: "Physics brawling made for casual group nights.", listSlugs: ["party", "local-co-op", "online-co-op", "more-than-4"], tags: ["party", "fighting", "casual"], sessionLength: "one-night", steamAppId: 1260320, minPlayers: 2, maxPlayers: 8, onlineCoop: true, localCoop: true }),
  game({ slug: "crab-game", title: "Crab Game", description: "Chaotic elimination rounds for very large, unserious groups.", listSlugs: ["party", "more-than-4", "more-than-4", "cheap-co-op"], tags: ["party", "elimination", "chaos"], sessionLength: "one-night", steamAppId: 1782210, minPlayers: 2, maxPlayers: 40, onlineCoop: true, localCoop: false }),
  game({ slug: "garrys-mod", title: "Garry's Mod", description: "Prop Hunt, Trouble in Terrorist Town, sandbox chaos: still a big-group toolbox.", listSlugs: ["party", "more-than-4", "more-than-4", "friend-slop"], tags: ["sandbox", "mods", "party"], sessionLength: "one-night", steamAppId: 4000, minPlayers: 2, maxPlayers: 32, onlineCoop: true, localCoop: false, caveat: "Requires choosing a mode/server; great once someone hosts." }),

  game({ slug: "counter-strike-2", title: "Counter-Strike 2", description: "Private lobbies and custom servers for groups that want teams, aim, or chaos modes.", listSlugs: ["more-than-4", "more-than-4", "party"], tags: ["shooter", "pvp", "server"], sessionLength: "one-night", steamAppId: 730, minPlayers: 2, maxPlayers: 20, onlineCoop: true, localCoop: false, caveat: "Best for 10+ as private teams or community/custom server modes." }),
  game({ slug: "team-fortress-2", title: "Team Fortress 2", description: "Large-team class shooter with a massive history of silly server nights.", listSlugs: ["more-than-4", "more-than-4", "cheap-co-op", "party"], tags: ["shooter", "classes", "server"], sessionLength: "one-night", steamAppId: 440, minPlayers: 2, maxPlayers: 24, onlineCoop: true, localCoop: false }),
  game({ slug: "battlebit-remastered", title: "BattleBit Remastered", description: "Huge low-poly battlefield chaos if your group wants to pile into the same war.", listSlugs: ["more-than-4", "more-than-4"], tags: ["shooter", "large scale", "pvp"], sessionLength: "one-night", steamAppId: 671860, minPlayers: 2, maxPlayers: 254, onlineCoop: true, localCoop: false, caveat: "Not private-party focused, but excellent for large groups joining together." }),
  game({ slug: "foxhole", title: "Foxhole", description: "Persistent war logistics for groups that want a shared long-term campaign.", listSlugs: ["more-than-4", "more-than-4", "campaign-co-op"], tags: ["war", "logistics", "persistent"], sessionLength: "campaign", steamAppId: 505460, minPlayers: 1, maxPlayers: 50, onlineCoop: true, localCoop: false, caveat: "Best when the group joins the same faction and treats it as an ongoing campaign." }),
  game({ slug: "vrchat", title: "VRChat", description: "Social worlds, party games, murder mystery rooms, and hangouts for very large groups.", listSlugs: ["party", "more-than-4", "more-than-4", "cheap-co-op"], tags: ["social", "worlds", "party"], sessionLength: "one-night", steamAppId: 438100, minPlayers: 1, maxPlayers: 40, onlineCoop: true, localCoop: false, platforms: ["PC", "VR"], caveat: "Works without VR; choose private/group instances for friend nights." }),
];

export function getCuratedList(slug: string) {
  return curatedLists.find((list) => list.slug === slug);
}

export function getCuratedGame(slug: string) {
  return curatedGames.find((game) => game.slug === slug);
}

export function curatedGamesForList(slug: string, minimumPlayers = 1) {
  return curatedGames.filter((game) => game.listSlugs.includes(slug) && supportsAtLeast(game, minimumPlayers));
}

export function curatedGamesForMinimumPlayerCount(minimumPlayers: number) {
  return curatedGames.filter((game) => supportsAtLeast(game, minimumPlayers));
}

export function supportsAtLeast(game: CuratedGame, minimumPlayers: number) {
  return (game.maxPlayers ?? 1) >= minimumPlayers;
}

export function gameSlug(title: string) {
  return normalizeGameTitle(title).replaceAll(" ", "-");
}

function game(seed: CuratedGameSeed): CuratedGame {
  return {
    slug: seed.slug,
    title: seed.title,
    description: seed.description,
    listSlugs: [...new Set(seed.listSlugs)],
    tags: seed.tags,
    sessionLength: seed.sessionLength,
    steamAppId: seed.steamAppId ?? null,
    minPlayers: seed.minPlayers,
    maxPlayers: seed.maxPlayers,
    onlineCoop: seed.onlineCoop,
    localCoop: seed.localCoop,
    gameModes: [seed.onlineCoop || seed.localCoop ? "Co-op" : "Multiplayer"],
    platforms: seed.platforms ?? ["PC"],
    genres: seed.tags,
    capabilitySource: "curated",
    capabilityConfidence: seed.caveat ? 0.75 : 0.9,
    trending: seed.trending,
    releaseStatus: seed.releaseStatus ?? "released",
    caveat: seed.caveat,
  };
}

