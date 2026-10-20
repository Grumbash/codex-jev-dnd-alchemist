export type ElementType =
  | 'acid'
  | 'fire'
  | 'cold'
  | 'poison'
  | 'necrotic'
  | 'psychic'
  | 'force'
  | 'lightning'
  | 'radiant';

export type Rarity =
  | 'common'
  | 'uncommon'
  | 'rare'
  | 'very_rare'
  | 'legendary'
  | 'artifact';

export type CraftingStation = 'alchemist' | 'blacksmith' | 'artificer';

export type ItemKind = 'reagent' | 'catalyst' | 'crafted' | 'slag';

export type MaterialTag =
  | 'ooze'
  | 'chitin'
  | 'scale'
  | 'organ'
  | 'bone'
  | 'hide'
  | 'blood'
  | 'eye'
  | 'essence'
  | 'metal'
  | 'crystal'
  | 'parchment'
  | 'artifact_core';

export interface DndStatblock {
  typeLine: string; // e.g., "Чудесный предмет, редкий (требует настройки)"
  damageFormula?: string; // e.g., "1d8 рубящий + 2d4 кислотный"
  armorClassBonus?: string; // e.g., "+2 к КД (AC)"
  savingThrow?: string; // e.g., "Спасбросок Телосложения СЛ 15"
  chargesInfo?: string; // e.g., "3 заряда (восст. 1d3 на рассвете)"
  requiresAttunement: boolean;
  mechanicalEffect: string;
  curseEffect?: string;
  loreQuote: string;
}

export interface GameItem {
  id: string;
  name: string;
  nameEn: string;
  kind: ItemKind;
  rarity: Rarity;
  icon: string;
  material: MaterialTag;
  elements: ElementType[];
  powerLevel: number; // 1..20 (maps roughly to monster CR)
  goldValue: number;
  description: string;
  // Source metadata if dropped by a monster
  monsterId?: string;
  monsterName?: string;
  harvestDc?: number;
  // Crafted metadata
  station?: CraftingStation;
  archetype?: string;
  specialEffect?: string;
  stats?: DndStatblock;
  isMasterwork?: boolean;
  isCursed?: boolean;
  craftGeneration?: number; // 1 = normal craft, 2 = 2nd-order fusion, 3+ = higher-order synthesis
  parentItemNames?: string[];
}

export type HeroSlotType = 'weapon' | 'offhand' | 'armor' | 'cloak' | 'jewelry' | 'belt';

export type HeroLoadout = Partial<Record<HeroSlotType, string>>;

export interface JevHaggleTelemetry {
  source: 'live-jev' | 'nar-calibrated-sim';
  latencyMs: number;
  willAccept: {
    noul: number; // 0..1 probability merchant accepts the demanded price
  };
  merchantMood: {
    score: number; // 1..5 (1 = furious, 5 = delighted)
  };
  counterReaction: {
    choice: 'accept_gladly' | 'grudging_deal' | 'counter_offer' | 'insulted_refusal';
    probabilities: Record<string, number>;
  };
  finalPriceGold: number;
}

export interface MonsterDropSlot {
  tier: 'common' | 'rare' | 'legendary';
  dc: number;
  itemId: string;
}

export interface Monster {
  id: string;
  name: string;
  nameEn: string;
  cr: number;
  crDisplay: string;
  creatureType: string;
  biome: string;
  staminaCost: number; // 1, 2, or 3 stamina
  minAlchemistLevel: number;
  icon: string;
  accentColor: string;
  lore: string;
  drops: MonsterDropSlot[];
}

export interface JevDecisionTelemetry {
  source: 'live-jev' | 'nar-calibrated-sim';
  latencyMs: number;
  isCompatible: {
    noul: number; // 0..1 calibrated probability
  };
  volatility: {
    score: number; // 1..5
  };
  itemArchetype: {
    choice: string;
    probabilities: Record<string, number>;
  };
  elementAffinity: {
    choice: ElementType;
    secondaryElement?: ElementType;
    probabilities: Record<ElementType, number>;
  };
  specialEffect: {
    choice: string;
    probabilities: Record<string, number>;
  };
  curseRisk: {
    noul: number; // 0..1 calibrated probability
  };
  calculatedDc: number;
  predictedRarity: Rarity;
}

export interface RecipeRecord {
  key: string; // e.g. "alchemist:cube_ooze+shop_vial"
  station: CraftingStation;
  ingredientIds: string[]; // sorted IDs
  resultItemId: string;
  discoveredAt: number;
  timesCrafted: number;
  telemetry: JevDecisionTelemetry;
}

export interface GuildBounty {
  id: string;
  clientName: string;
  clientTitle: string;
  clientIcon: string;
  questTitle: string;
  requestText: string;
  requiredStation?: CraftingStation;
  requiredElement?: ElementType;
  minRarity: Rarity;
  rewardGold: number;
  rewardXp: number;
  bonusItemId?: string;
  completed: boolean;
}

export interface WorkshopUpgrade {
  id: string;
  name: string;
  icon: string;
  description: string;
  costGold: number;
  purchased: boolean;
  effectKey: 'crucible_3_slots' | 'dc_reduction_2' | 'salvage_on_fail' | 'harvest_bonus_2' | 'max_stamina_14';
}

export interface ActivePartyBuff {
  id: string;
  heroId: 'quick' | 'nocta' | 'slow';
  sourceItemId: string;
  sourceItemName: string;
  sourceItemArchetype?: string;
  elements: ElementType[];
  rarity: Rarity;
  title: string;
  description: string;
  durationFights: number; // remaining fights or encounters
  appliedAtDay: number;
  iconEmoji: string;
  statBonus?: {
    attackBonus?: number;
    armorClassBonus?: number;
    bonusDamagePerRound?: number;
    tempHp?: number;
    harvestBonus?: number;
  };
}

export interface DailyLairEvent {
  id: string;
  day: number;
  title: string;
  badge: string;
  flavor: string;
  effectDescription: string;
  iconEmoji: string;
  modifierType:
    | 'discount_catalysts'
    | 'free_reagent'
    | 'dc_reduction'
    | 'extra_xp'
    | 'hero_temp_hp'
    | 'bonus_bounty_gold';
  bonusItemId?: string;
  bonusValue?: number;
}
