import React, { useEffect, useMemo, useState } from 'react';
import {
  Award,
  BookOpen,
  Check,
  ChevronDown,
  Compass,
  Cpu,
  Crown,
  Dices,
  Eye,
  Filter,
  Flame,
  Hammer,
  Handshake,
  KeyRound,
  Moon,
  RotateCcw,
  Search,
  Settings,
  Shield,
  ShoppingBag,
  Sparkles,
  Swords,
  Trash2,
  Volume2,
  VolumeX,
  Wand2,
  Zap,
} from 'lucide-react';
import {
  ActivePartyBuff,
  CraftingStation,
  DailyLairEvent,
  GameItem,
  GuildBounty,
  HeroLoadout,
  HeroSlotType,
  JevDecisionTelemetry,
  Monster,
  RecipeRecord,
  WorkshopUpgrade,
} from './types/game';
import {
  ELEMENT_META,
  generateDailyBounties,
  INITIAL_ITEMS,
  INITIAL_UPGRADES,
  MONSTERS,
  RARITY_META,
  SHOP_CATALYST_IDS,
} from './data/bestiary';
import { GUILD_WORLD_HEROES, PartyHeroProfile } from './data/guildWorldCampaign';
import {
  CANONICAL_DAILY_EVENTS,
  generateDailyLairEvent,
  computeBuffFromItem,
} from './data/dailyEvents';
import {
  assembleCraftedItem,
  evaluateCrucibleWithJev,
  makeRecipeKey,
} from './engine/jevEngine';
import { JevTelemetryPanel } from './components/JevTelemetryPanel';
import { JeiCodexSidebar } from './components/JeiCodexSidebar';
import { ItemStatblockModal } from './components/ItemStatblockModal';
import { CompositeItemSprite, CompositeMonsterSprite } from './components/CompositeItemSprite';
import { HeroRaidPanel, getHeroSlotForItem } from './components/HeroRaidPanel';
import { MerchantHaggleModal } from './components/MerchantHaggleModal';
import { DmMasterModal } from './components/DmMasterModal';
import { CodexFolioPanel } from './components/CodexFolioPanel';
import { D20DiceModal } from './components/D20DiceModal';
import { SlagAlembicModal } from './components/SlagAlembicModal';
import { AccessGateModal } from './components/AccessGateModal';
import {
  AuthConfig,
  AuthSession,
  getAuthConfig,
  getSavedAuthSession,
  checkUrlAuthParams,
} from './utils/auth';
import { sfx } from './utils/sound';
import { useLanguage } from './context/LanguageContext';

const STORAGE_KEY = 'dnd_jev_alchemist_guild_world_v2';

interface RollResultState {
  context: 'craft' | 'harvest';
  d20Raw: number;
  d20Second?: number; // when rolling with Disadvantage (Exhausted)
  proficiencyBonus: number;
  extraBonus: number;
  total: number;
  dc: number;
  outcome: 'masterwork' | 'success' | 'cursed' | 'slag' | 'harvest_success' | 'harvest_fail';
  title: string;
  subtitle: string;
  createdItem?: GameItem;
  harvestedItems?: GameItem[];
  isFirstDiscovery?: boolean;
}

export function App() {
  const { lang, setLang, toggleLang, t, getItemName, getMonsterName, getRarityLabel, getElementName } =
    useLanguage();

  // === CORE GAME STATE ===
  const [activeMainTab, setActiveMainTab] = useState<'crucible' | 'codex' | 'bestiary' | 'guild' | 'hero_raid'>('crucible');
  const [station, setStation] = useState<CraftingStation>('alchemist');
  const [activeHeroId, setActiveHeroId] = useState<PartyHeroProfile['id']>('quick');

  // === TABLETOP ROLL MODE (Живой d20 со стола) & DM MODE ===
  const [tabletopRollMode, setTabletopRollMode] = useState<boolean>(false);
  const [manualD20Roll, setManualD20Roll] = useState<number>(15);
  const [showDmModal, setShowDmModal] = useState<boolean>(false);
  const [customMonsters, setCustomMonsters] = useState<Monster[]>([]);

  const [itemsMap, setItemsMap] = useState<Record<string, GameItem>>(() => ({
    ...INITIAL_ITEMS,
  }));

  const [inventory, setInventory] = useState<Record<string, number>>({
    chuul_chitin_plate: 2,
    tavrai_kerdos_bone: 2,
    kreym_thunder_herbs: 2,
    kreym_lightblade_shard: 1,
    remorhaz_chitin_crest: 2,
    dalniy_dragon_horn: 2,
    cube_acid_ooze: 2,
    mimic_toothed_splinter: 2,
    irvek_bone_ash: 1,
    feeder_fat_oil: 1,
    aboleth_mucus_vial: 1,
    chimera_reef_horn: 1,
    catalyst_crystal_vial: 3,
    catalyst_mithral_ingot: 2,
    catalyst_silver_ring: 1,
  });

  const [discoveredItemIds, setDiscoveredItemIds] = useState<string[]>([
    'chuul_chitin_plate',
    'tavrai_kerdos_bone',
    'kreym_thunder_herbs',
    'kreym_lightblade_shard',
    'remorhaz_chitin_crest',
    'dalniy_dragon_horn',
    'cube_acid_ooze',
    'mimic_toothed_splinter',
    'irvek_bone_ash',
    'feeder_fat_oil',
    'aboleth_mucus_vial',
    'chimera_reef_horn',
    'catalyst_crystal_vial',
    'catalyst_mithral_ingot',
    'catalyst_silver_ring',
  ]);

  const [recipes, setRecipes] = useState<Record<string, RecipeRecord>>({});
  const [crucibleSlots, setCrucibleSlots] = useState<string[]>([]);
  const [heroLoadout, setHeroLoadout] = useState<HeroLoadout>({});

  // === PROGRESSION: MASTERY, STAMINA, GOLD ===
  const [day, setDay] = useState<number>(1);
  const [xp, setXp] = useState<number>(0);
  const [gold, setGold] = useState<number>(350);
  const [stamina, setStamina] = useState<number>(10);
  const [upgrades, setUpgrades] = useState<WorkshopUpgrade[]>(INITIAL_UPGRADES);
  const [bounties, setBounties] = useState<GuildBounty[]>(() => generateDailyBounties(1));

  // === JEV DECISION ENGINE STATE ===
  const [useLiveJev, setUseLiveJev] = useState<boolean>(true);
  const [customApiKey, setCustomApiKey] = useState<string>('');
  const [showApiKeyModal, setShowApiKeyModal] = useState<boolean>(false);
  const [telemetry, setTelemetry] = useState<JevDecisionTelemetry | null>(null);
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);

  // === UI / MODALS / JEI ===
  const [selectedJeiItemId, setSelectedJeiItemId] = useState<string | null>('chuul_chitin_plate');
  const [jeiTab, setJeiTab] = useState<'recipe' | 'uses'>('recipe');
  const [inspectedItem, setInspectedItem] = useState<GameItem | null>(null);
  const [haggleItem, setHaggleItem] = useState<GameItem | null>(null);
  const [highlightedMonsterId, setHighlightedMonsterId] = useState<string | null>(null);
  const [lastRoll, setLastRoll] = useState<RollResultState | null>(null);
  const [isRolling, setIsRolling] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // === FEATURES 1 & 3: ACTIVE PARTY BUFFS & DAILY LAIR EVENTS ===
  const [activeBuffs, setActiveBuffs] = useState<ActivePartyBuff[]>([]);
  const [activeDailyEvent, setActiveDailyEvent] = useState<DailyLairEvent | null>(() =>
    generateDailyLairEvent(1)
  );

  // === REDESIGN: BAG CATEGORIES, SEARCH & SETTINGS MENU ===
  const [inventoryFilter, setInventoryFilter] = useState<'all' | 'reagent' | 'catalyst' | 'crafted'>('all');
  const [inventorySearch, setInventorySearch] = useState<string>('');
  const [showSettingsMenu, setShowSettingsMenu] = useState<boolean>(false);

  // === TARGET BLUEPRINT / ARCHETYPE SELECTION (CRUCIBLE) ===
  const [targetArchetype, setTargetArchetype] = useState<string>('auto');

  // === PERSISTENT HERO HEALTH & WOUNDS (D&D 5E STAKES) ===
  const [heroHpMap, setHeroHpMap] = useState<Record<PartyHeroProfile['id'], number>>({
    quick: 201,
    nocta: 115,
    slow: 186,
  });
  const [heroWoundsMap, setHeroWoundsMap] = useState<Record<PartyHeroProfile['id'], number>>({
    quick: 0,
    nocta: 0,
    slow: 0,
  });

  // === FEATURES 5 & 3: AMBIENT SOUNDSCAPE, 3D D20 & SLAG ALEMBIC ===
  const [isAmbientPlaying, setIsAmbientPlaying] = useState<boolean>(false);
  const [showD20Modal, setShowD20Modal] = useState<boolean>(false);
  const [locked3dRoll, setLocked3dRoll] = useState<number | null>(null);
  const [d20ModalTargetResult, setD20ModalTargetResult] = useState<number | undefined>(undefined);
  const [d20ModalDc, setD20ModalDc] = useState<number | undefined>(undefined);
  const [d20ModalModifier, setD20ModalModifier] = useState<number>(0);
  const [d20ModalTitle, setD20ModalTitle] = useState<string>('Бросок d20 Судьбы');
  const [d20ModalSubtitle, setD20ModalSubtitle] = useState<string>('Мыс Дальний Камень');
  const [d20ModalActionLabel, setD20ModalActionLabel] = useState<string | undefined>(undefined);
  const [d20ModalConfirmCallback, setD20ModalConfirmCallback] = useState<((rolled: number) => void) | null>(null);
  const [showAlembicModal, setShowAlembicModal] = useState<boolean>(false);

  // === ACCESS CONTROL & FOUNDRY VTT GATE ===
  const [authConfig, setAuthConfig] = useState<AuthConfig>(() => getAuthConfig());
  const [authSession, setAuthSession] = useState<AuthSession | null>(() => getSavedAuthSession());
  const [showAccessGateModal, setShowAccessGateModal] = useState<boolean>(false);

  const allMonsters = useMemo(
    () => [...customMonsters, ...MONSTERS],
    [customMonsters]
  );

  const activeHero = useMemo(
    () => GUILD_WORLD_HEROES.find((h) => h.id === activeHeroId) || GUILD_WORLD_HEROES[0],
    [activeHeroId]
  );

  // Load saved state and verify URL auth parameters on mount
  useEffect(() => {
    // Check URL parameters for instant Foundry login
    const urlAuth = checkUrlAuthParams(authConfig);
    if (urlAuth.session) {
      setAuthSession(urlAuth.session);
      if (urlAuth.heroParam) {
        setActiveHeroId(urlAuth.heroParam);
      }
    } else if (!authSession) {
      // If not authenticated and no token in URL, lock screen behind Far Stone Ward
      setShowAccessGateModal(true);
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.itemsMap) setItemsMap({ ...INITIAL_ITEMS, ...parsed.itemsMap });
        if (parsed.inventory) setInventory(parsed.inventory);
        if (parsed.discoveredItemIds) setDiscoveredItemIds(parsed.discoveredItemIds);
        if (parsed.recipes) setRecipes(parsed.recipes);
        if (parsed.heroLoadout) setHeroLoadout(parsed.heroLoadout);
        if (parsed.activeHeroId) setActiveHeroId(parsed.activeHeroId);
        if (typeof parsed.tabletopRollMode === 'boolean') setTabletopRollMode(parsed.tabletopRollMode);
        if (Array.isArray(parsed.customMonsters)) setCustomMonsters(parsed.customMonsters);
        if (typeof parsed.day === 'number') {
          setDay(parsed.day);
          setActiveDailyEvent(generateDailyLairEvent(parsed.day));
        }
        if (Array.isArray(parsed.activeBuffs)) setActiveBuffs(parsed.activeBuffs);
        if (typeof parsed.xp === 'number') setXp(parsed.xp);
        if (typeof parsed.gold === 'number') setGold(parsed.gold);
        if (typeof parsed.stamina === 'number') setStamina(parsed.stamina);
        if (parsed.upgrades) setUpgrades(parsed.upgrades);
        if (parsed.bounties) setBounties(parsed.bounties);
        if (parsed.customApiKey) setCustomApiKey(parsed.customApiKey);
      }
    } catch {
      // ignore corrupted storage
    }
  }, []);

  // Save state on change
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          itemsMap,
          inventory,
          discoveredItemIds,
          recipes,
          heroLoadout,
          activeHeroId,
          tabletopRollMode,
          customMonsters,
          day,
          xp,
          gold,
          stamina,
          upgrades,
          bounties,
          customApiKey,
          activeBuffs,
        })
      );
    } catch {
      // ignore storage quota errors
    }
  }, [
    itemsMap,
    inventory,
    discoveredItemIds,
    recipes,
    heroLoadout,
    activeHeroId,
    tabletopRollMode,
    customMonsters,
    day,
    xp,
    gold,
    stamina,
    upgrades,
    bounties,
    customApiKey,
    activeBuffs,
  ]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3200);
  };

  // === DERIVED STATS & UPGRADES ===
  const alchemistLevel = useMemo(() => {
    if (xp >= 1500) return 5;
    if (xp >= 850) return 4;
    if (xp >= 400) return 3;
    if (xp >= 150) return 2;
    return 1;
  }, [xp]);

  const nextLevelXp = useMemo(() => {
    const thresholds = [150, 400, 850, 1500, 3000];
    return thresholds[alchemistLevel - 1] || 3000;
  }, [alchemistLevel]);

  const proficiencyBonus = useMemo(() => {
    return Math.max(1 + alchemistLevel, activeHero.craftBonus);
  }, [alchemistLevel, activeHero]);

  const hasUpgrade = (key: WorkshopUpgrade['effectKey']) =>
    upgrades.some((u) => u.effectKey === key && u.purchased);

  const maxCrucibleSlots = hasUpgrade('crucible_3_slots') || alchemistLevel >= 3 ? 3 : 2;
  const maxStamina = hasUpgrade('max_stamina_14') ? 14 : 10;
  const isExhausted = stamina <= 0;

  const crucibleItems = useMemo(
    () => crucibleSlots.map((id) => itemsMap[id]).filter(Boolean),
    [crucibleSlots, itemsMap]
  );

  const currentRecipeKey = useMemo(() => {
    if (crucibleItems.length < 2) return null;
    return makeRecipeKey(station, crucibleItems);
  }, [station, crucibleItems]);

  const knownRecipe = currentRecipeKey ? recipes[currentRecipeKey] : undefined;
  const knownRecipeBonus = knownRecipe ? 3 : 0;
  const upgradeDcReduction = hasUpgrade('dc_reduction_2') ? 2 : 0;
  const eventDcReduction =
    activeDailyEvent?.modifierType === 'dc_reduction' ? activeDailyEvent.bonusValue || 2 : 0;

  const effectiveDc = useMemo(() => {
    if (!telemetry) return 12;
    return Math.max(
      6,
      telemetry.calculatedDc - knownRecipeBonus - upgradeDcReduction - eventDcReduction
    );
  }, [telemetry, knownRecipeBonus, upgradeDcReduction, eventDcReduction]);

  // === EVALUATE CRUCIBLE WITH JEV WHENEVER SLOTS OR STATION CHANGE ===
  useEffect(() => {
    let cancelled = false;
    if (crucibleItems.length < 2) {
      setTelemetry(null);
      setIsEvaluating(false);
      return;
    }

    // Check if we already cached telemetry for this recipe key
    const rKey = makeRecipeKey(station, crucibleItems);
    if (recipes[rKey]?.telemetry) {
      setTelemetry(recipes[rKey].telemetry);
      return;
    }

    setIsEvaluating(true);
    evaluateCrucibleWithJev(station, crucibleItems, {
      useLiveApi: useLiveJev,
      apiKey: customApiKey || undefined,
      preferredArchetype: targetArchetype !== 'auto' ? targetArchetype : undefined,
    }).then((res) => {
      if (!cancelled) {
        setTelemetry(res);
        setIsEvaluating(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [crucibleSlots, station, useLiveJev, customApiKey, targetArchetype]);

  // === INVENTORY & CRUCIBLE HELPERS ===
  const markDiscovered = (ids: string[]) => {
    setDiscoveredItemIds((prev) => {
      const set = new Set(prev);
      ids.forEach((id) => set.add(id));
      return Array.from(set);
    });
  };

  const handleAddReagentToCrucible = (itemId: string) => {
    sfx.playClick();
    if (crucibleSlots.length >= maxCrucibleSlots) {
      showToast(`В тигле максимум ${maxCrucibleSlots} слота!`);
      return;
    }
    const alreadyInCrucibleCount = crucibleSlots.filter((id) => id === itemId).length;
    const availableCount = (inventory[itemId] || 0) - alreadyInCrucibleCount;
    if (availableCount <= 0) {
      showToast('Недостаточно экземпляров этого реагента в сумке!');
      return;
    }
    setCrucibleSlots((prev) => [...prev, itemId]);
  };

  const handleRemoveCrucibleSlot = (index: number) => {
    sfx.playClick();
    setCrucibleSlots((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleLoadFullRecipeToCrucible = (
    targetStation: CraftingStation,
    ingredientIds: string[]
  ) => {
    sfx.playClick();
    // Verify player has ingredients
    const neededCounts: Record<string, number> = {};
    ingredientIds.forEach((id) => {
      neededCounts[id] = (neededCounts[id] || 0) + 1;
    });
    for (const [id, needed] of Object.entries(neededCounts)) {
      if ((inventory[id] || 0) < needed) {
        showToast('В инвентаре не хватает ингредиентов для этого рецепта!');
        return;
      }
    }
    setStation(targetStation);
    setCrucibleSlots(ingredientIds.slice(0, maxCrucibleSlots));
    setActiveMainTab('crucible');
    showToast('Рецепт загружен на алхимический стол!');
  };

  // === SYNTHESIZE (ROLL D20 AGAINST JEV DC) ===
  const handleSynthesize = (forcedD20?: number) => {
    if (crucibleItems.length < 2 || !telemetry || isRolling) return;
    if (stamina <= 0) {
      showToast(
        lang === 'en'
          ? 'Exhausted! Rest in the Bastion to restore stamina.'
          : 'Истощение! Отдохните в Бастионе для восстановления выносливости.'
      );
      return;
    }
    if (station === 'alchemist') {
      sfx.playCauldronBubble();
    } else if (station === 'blacksmith') {
      sfx.playAnvilHammer();
    } else {
      sfx.playArtificerChime();
    }
    sfx.playDiceRoll();
    setIsRolling(true);

    const activeRoll = forcedD20 ?? locked3dRoll ?? undefined;
    setLocked3dRoll(null);

    setTimeout(() => {
      const r1 =
        activeRoll !== undefined
          ? activeRoll
          : tabletopRollMode
            ? Math.max(1, Math.min(20, manualD20Roll))
            : Math.floor(Math.random() * 20) + 1;
      const r2 = tabletopRollMode || activeRoll !== undefined ? r1 : Math.floor(Math.random() * 20) + 1;
      const d20Raw = isExhausted && !tabletopRollMode && activeRoll === undefined ? Math.min(r1, r2) : r1;
      const total = d20Raw + proficiencyBonus;

      // Consume stamina (can drop to 0)
      setStamina((prev) => Math.max(0, prev - 1));

      // Consume ingredients from inventory
      const consumedIds = [...crucibleSlots];
      const nextInv = { ...inventory };
      consumedIds.forEach((id) => {
        nextInv[id] = Math.max(0, (nextInv[id] || 0) - 1);
      });

      let outcome: 'masterwork' | 'success' | 'cursed' | 'slag';
      if (d20Raw === 20 || total >= effectiveDc + 5) {
        outcome = 'masterwork';
      } else if (d20Raw !== 1 && total >= effectiveDc) {
        outcome = 'success';
      } else if (d20Raw !== 1 && total >= effectiveDc - 3 && telemetry.curseRisk.noul >= 0.35) {
        outcome = 'cursed';
      } else {
        outcome = 'slag';
      }

      if (outcome === 'slag') {
        sfx.playFail();
        nextInv.alchemical_slag = (nextInv.alchemical_slag || 0) + 1;
        let salvagedItem: GameItem | undefined;
        if (hasUpgrade('salvage_on_fail') && consumedIds.length > 0) {
          const savedId = consumedIds[0];
          nextInv[savedId] = (nextInv[savedId] || 0) + 1;
          salvagedItem = itemsMap[savedId];
        }
        setInventory(nextInv);
        setCrucibleSlots([]);
        markDiscovered(['alchemical_slag']);
        setXp((prev) => prev + 10);

        setLastRoll({
          context: 'craft',
          d20Raw,
          d20Second: isExhausted && !tabletopRollMode ? Math.max(r1, r2) : undefined,
          proficiencyBonus,
          extraBonus: 0,
          total,
          dc: effectiveDc,
          outcome: 'slag',
          title: `💥 Реакция сорвалась в шлак (${activeHero.name})!`,
          subtitle: salvagedItem
            ? `Защищённое хранилище спасло реагент «${salvagedItem.name}»! Получен Алхимический шлак.`
            : 'Нестабильность оказалась выше броска. Получен Нестабильный алхимический шлак.',
          createdItem: itemsMap.alchemical_slag,
        });
        setIsRolling(false);
        return;
      }

      // Assemble the crafted D&D item with target archetype
      const crafted = assembleCraftedItem(
        station,
        crucibleItems,
        telemetry,
        outcome,
        targetArchetype !== 'auto' ? targetArchetype : undefined
      );
      const rKey = makeRecipeKey(station, crucibleItems);
      const isFirst = !recipes[rKey];

      sfx.playSuccess(outcome === 'masterwork');

      setItemsMap((prev) => ({
        ...prev,
        [crafted.id]: crafted,
      }));

      nextInv[crafted.id] = (nextInv[crafted.id] || 0) + 1;
      setInventory(nextInv);
      setCrucibleSlots([]);
      markDiscovered([crafted.id]);

      setRecipes((prev) => ({
        ...prev,
        [rKey]: {
          key: rKey,
          station,
          ingredientIds: [...consumedIds].sort(),
          resultItemId: crafted.id,
          discoveredAt: prev[rKey]?.discoveredAt || Date.now(),
          timesCrafted: (prev[rKey]?.timesCrafted || 0) + 1,
          telemetry,
        },
      }));

      const rarityXp = RARITY_META[crafted.rarity].xpReward;
      const eventExtraXp =
        activeDailyEvent?.modifierType === 'extra_xp' ? activeDailyEvent.bonusValue || 100 : 0;
      const gainedXp = (isFirst ? rarityXp : Math.round(rarityXp * 0.35)) + eventExtraXp;
      setXp((prev) => prev + gainedXp);

      setSelectedJeiItemId(crafted.id);
      setJeiTab('recipe');

      setLastRoll({
        context: 'craft',
        d20Raw,
        d20Second: isExhausted && !tabletopRollMode ? Math.max(r1, r2) : undefined,
        proficiencyBonus,
        extraBonus: 0,
        total,
        dc: effectiveDc,
        outcome,
        title:
          outcome === 'masterwork'
            ? `🌟 КРИТИЧЕСКИЙ СИНТЕЗ (${activeHero.name}): ШЕДЕВР!`
            : outcome === 'cursed'
            ? `🩸 СИНТЕЗ С ПРОКЛЯТИЕМ (${activeHero.name})!`
            : `✨ УСПЕШНЫЙ СИНТЕЗ (${activeHero.name})!`,
        subtitle: `${crafted.name} (+${gainedXp} XP${isFirst ? ' • ПЕРВООТКРЫТИЕ В ГРИМУАРЕ!' : ''})`,
        createdItem: crafted,
        isFirstDiscovery: isFirst,
      });

      setIsRolling(false);
    }, 320);
  };

  // === FAST HARVEST IN BESTIARY ===
  const handleHarvestMonster = (monsterId: string, forcedD20?: number) => {
    const monster = allMonsters.find((m) => m.id === monsterId);
    if (!monster || isRolling) return;

    if (stamina < monster.staminaCost) {
      showToast(
        lang === 'en'
          ? `Not enough stamina (${monster.staminaCost}⚡ required)! Rest at the Tavern.`
          : `Не хватает выносливости (${monster.staminaCost}⚡)! Отдохните в Таверне.`
      );
      return;
    }

    if (alchemistLevel < monster.minAlchemistLevel) {
      showToast(
        lang === 'en'
          ? `Requires Mastery Level ${monster.minAlchemistLevel} to hunt ${monster.nameEn || monster.name}!`
          : `Требуется Уровень Мастерства ${monster.minAlchemistLevel} для охоты на ${monster.name}!`
      );
      return;
    }

    sfx.playDiceRoll();
    setIsRolling(true);

    const activeRoll = forcedD20 ?? locked3dRoll ?? undefined;
    setLocked3dRoll(null);

    setTimeout(() => {
      const r1 =
        activeRoll !== undefined
          ? activeRoll
          : tabletopRollMode
            ? Math.max(1, Math.min(20, manualD20Roll))
            : Math.floor(Math.random() * 20) + 1;
      const r2 = tabletopRollMode || activeRoll !== undefined ? r1 : Math.floor(Math.random() * 20) + 1;
      const d20Raw = isExhausted && !tabletopRollMode && activeRoll === undefined ? Math.min(r1, r2) : r1;
      const scalpelBonus = hasUpgrade('harvest_bonus_2') ? 2 : 0;
      const harvestMod = Math.max(proficiencyBonus, activeHero.harvestBonus);
      const total = d20Raw + harvestMod + scalpelBonus;

      setStamina((prev) => Math.max(0, prev - monster.staminaCost));

      const harvested: GameItem[] = [];
      if (d20Raw !== 1) {
        monster.drops.forEach((drop) => {
          if (total >= drop.dc || d20Raw === 20) {
            const it = itemsMap[drop.itemId];
            if (it) harvested.push(it);
          }
        });
      }

      if (harvested.length > 0) {
        sfx.playSuccess(d20Raw === 20);
        const nextInv = { ...inventory };
        harvested.forEach((it) => {
          nextInv[it.id] = (nextInv[it.id] || 0) + 1;
        });
        setInventory(nextInv);
        markDiscovered(harvested.map((i) => i.id));
        setXp((prev) => prev + harvested.length * 15);
        setSelectedJeiItemId(harvested[harvested.length - 1].id);
        setJeiTab('uses');

        setLastRoll({
          context: 'harvest',
          d20Raw,
          d20Second: isExhausted && !tabletopRollMode ? Math.max(r1, r2) : undefined,
          proficiencyBonus: harvestMod,
          extraBonus: scalpelBonus,
          total,
          dc: monster.drops[0].dc,
          outcome: 'harvest_success',
          title: `🐉 Разделка (${activeHero.name}): ${monster.name}`,
          subtitle: `Добыто трофеев: ${harvested.map((h) => h.name).join(', ')}`,
          harvestedItems: harvested,
        });
      } else {
        sfx.playFail();
        const counterDamage = Math.max(6, Math.round(monster.cr * 3.5));
        setHeroHpMap((prev) => ({
          ...prev,
          [activeHero.id]: Math.max(10, (prev[activeHero.id] ?? activeHero.baseHp) - counterDamage),
        }));

        setLastRoll({
          context: 'harvest',
          d20Raw,
          d20Second: isExhausted && !tabletopRollMode ? Math.max(r1, r2) : undefined,
          proficiencyBonus: harvestMod,
          extraBonus: scalpelBonus,
          total,
          dc: monster.drops[0].dc,
          outcome: 'harvest_fail',
          title: d20Raw === 1 ? `💥 Критический провал охоты (Nat 1)!` : `❌ Неудача разделки (${total} vs СЛ ${monster.drops[0].dc})`,
          subtitle: `${monster.name} ранил героя ${activeHero.name} на ${counterDamage} HP и скрылся. Трофеи потеряны.`,
        });
      }

      setIsRolling(false);
    }, 280);
  };

  // === LONG REST, SHOP, BOUNTIES ===
  const handleLongRest = () => {
    const restCost = 20;
    if (gold < restCost && stamina > 0) {
      showToast(`Для отдыха в таверне нужно ${restCost} gp (или потратьте энергию до 0)!`);
      return;
    }
    sfx.playCoin();
    if (gold >= restCost) {
      setGold((prev) => prev - restCost);
    }
    const nextDay = day + 1;
    setDay(nextDay);
    setStamina(maxStamina);
    setBounties(generateDailyBounties(nextDay));

    const nextEvent = generateDailyLairEvent(nextDay);
    setActiveDailyEvent(nextEvent);

    // Apply immediate event rewards
    if (nextEvent.modifierType === 'free_reagent' && nextEvent.bonusItemId) {
      setInventory((prev) => ({
        ...prev,
        [nextEvent.bonusItemId!]: (prev[nextEvent.bonusItemId!] || 0) + 1,
      }));
      markDiscovered([nextEvent.bonusItemId]);
    } else if (nextEvent.modifierType === 'hero_temp_hp') {
      const quickBuff: ActivePartyBuff = {
        id: `buff_event_feast_${Date.now()}`,
        heroId: 'quick',
        sourceItemId: 'event_feast',
        sourceItemName: 'Пир в катакомбах',
        elements: ['poison'],
        rarity: 'rare',
        title: 'Сытость Катакомб (Пир Квика)',
        description: 'Квик насытился в древних погребах: +25 временных HP и сопротивление яду!',
        durationFights: 3,
        appliedAtDay: nextDay,
        iconEmoji: '🍽️',
        statBonus: {
          tempHp: nextEvent.bonusValue || 25,
          bonusDamagePerRound: 3,
        },
      };
      setActiveBuffs((prev) => [quickBuff, ...prev.filter((b) => b.id !== quickBuff.id)]);
    }

    showToast(`День ${nextDay}: силы восстановлены (${maxStamina}⚡)! Событие: «${nextEvent.title}»!`);
  };

  const handleBuyCatalyst = (itemId: string) => {
    const item = itemsMap[itemId];
    if (!item) return;
    const discountRate =
      activeDailyEvent?.modifierType === 'discount_catalysts'
        ? (activeDailyEvent.bonusValue || 25) / 100
        : 0;
    const finalPrice = Math.max(1, Math.round(item.goldValue * (1 - discountRate)));
    if (gold < finalPrice) {
      showToast(`Не хватает золота (${finalPrice} gp)! Продайте артефакты или выполните заказ.`);
      return;
    }
    sfx.playCoin();
    setGold((prev) => prev - finalPrice);
    setInventory((prev) => ({
      ...prev,
      [itemId]: (prev[itemId] || 0) + 1,
    }));
    markDiscovered([itemId]);
    showToast(
      `Куплено: ${item.name} (-${finalPrice} gp${discountRate > 0 ? ' • Скидка баркаса!' : ''})`
    );
  };

  // === FEATURES 1 & 2: PARTY BUFFS / MUTATIONS HANDLERS ===
  const handleApplyBuffToHero = (item: GameItem, heroId: 'quick' | 'nocta' | 'slow') => {
    if ((inventory[item.id] || 0) <= 0) {
      showToast('В сумке нет этого предмета!');
      return;
    }
    setInventory((prev) => ({
      ...prev,
      [item.id]: Math.max(0, (prev[item.id] || 0) - 1),
    }));

    const newBuff = computeBuffFromItem(item, heroId, day);
    setActiveBuffs((prev) => [
      newBuff,
      ...prev.filter((b) => b.heroId !== heroId || b.sourceItemId !== item.id),
    ]);
    sfx.playBuffApply();

    const heroName = heroId === 'quick' ? 'Квик' : heroId === 'nocta' ? 'Нокта' : 'Слоу';
    showToast(`Эффект «${newBuff.title}» активирован на герое ${heroName} на 3 боя!`);
  };

  const handleRemoveBuff = (buffId: string) => {
    sfx.playClick();
    setActiveBuffs((prev) => prev.filter((b) => b.id !== buffId));
    showToast('Действие эффекта снято.');
  };

  const handleConsumeBuffFight = (heroId: PartyHeroProfile['id']) => {
    setActiveBuffs((prev) => {
      const updated: ActivePartyBuff[] = [];
      prev.forEach((buff) => {
        if (buff.heroId === heroId) {
          const nextDuration = buff.durationFights - 1;
          if (nextDuration > 0) {
            updated.push({ ...buff, durationFights: nextDuration });
          } else {
            const hName =
              buff.heroId === 'quick' ? 'Квика' : buff.heroId === 'nocta' ? 'Нокты' : 'Слоу';
            showToast(`⏳ Действие «${buff.title}» у ${hName} завершилось.`);
          }
        } else {
          updated.push(buff);
        }
      });
      return updated;
    });
  };

  const handleSellItem = (itemId: string) => {
    const item = itemsMap[itemId];
    if (!item || (inventory[itemId] || 0) <= 0) return;
    sfx.playCoin();
    setInventory((prev) => ({
      ...prev,
      [itemId]: Math.max(0, (prev[itemId] || 0) - 1),
    }));
    setGold((prev) => prev + item.goldValue);
    showToast(`Продано: ${item.name} (+${item.goldValue} gp)`);
  };

  const handleBuyUpgrade = (upgradeId: string) => {
    const upg = upgrades.find((u) => u.id === upgradeId);
    if (!upg || upg.purchased) return;
    if (gold < upg.costGold) {
      showToast(`Недостаточно золота (${upg.costGold} gp)!`);
      return;
    }
    sfx.playSuccess(true);
    setGold((prev) => prev - upg.costGold);
    setUpgrades((prev) =>
      prev.map((u) => (u.id === upgradeId ? { ...u, purchased: true } : u))
    );
    if (upg.effectKey === 'max_stamina_14') {
      setStamina((prev) => prev + 4);
    }
    showToast(`Улучшение установлено: ${upg.name}!`);
  };

  const findMatchingItemsForBounty = (bounty: GuildBounty): GameItem[] => {
    const minRank = RARITY_META[bounty.minRarity].rank;
    return Object.entries(inventory)
      .filter(([, count]) => count > 0)
      .map(([id]) => itemsMap[id])
      .filter((item): item is GameItem => {
        if (!item || item.kind !== 'crafted') return false;
        if (RARITY_META[item.rarity].rank < minRank) return false;
        if (bounty.requiredStation && item.station !== bounty.requiredStation) return false;
        if (bounty.requiredElement && !item.elements.includes(bounty.requiredElement))
          return false;
        return true;
      });
  };

  const handleFulfillBounty = (bounty: GuildBounty, itemId: string) => {
    if (bounty.completed || (inventory[itemId] || 0) <= 0) return;
    sfx.playCoin();
    setInventory((prev) => {
      const next = { ...prev, [itemId]: Math.max(0, (prev[itemId] || 0) - 1) };
      if (bounty.bonusItemId) {
        next[bounty.bonusItemId] = (next[bounty.bonusItemId] || 0) + 1;
      }
      return next;
    });
    if (bounty.bonusItemId) {
      markDiscovered([bounty.bonusItemId]);
    }
    const goldBonusRate =
      activeDailyEvent?.modifierType === 'bonus_bounty_gold'
        ? (activeDailyEvent.bonusValue || 35) / 100
        : 0;
    const finalGoldReward = Math.round(bounty.rewardGold * (1 + goldBonusRate));
    setGold((prev) => prev + finalGoldReward);
    setXp((prev) => prev + bounty.rewardXp);
    setBounties((prev) =>
      prev.map((b) => (b.id === bounty.id ? { ...b, completed: true } : b))
    );
    showToast(
      `Заказ выполнен! Получено +${finalGoldReward} gp${
        goldBonusRate > 0 ? ' (вкл. +35% бонус курьера)' : ''
      } и +${bounty.rewardXp} XP!`
    );
  };

  const handleDistillSlag = (
    recipeId: string,
    costSlag: number,
    costGold: number,
    resultItem: GameItem
  ) => {
    setInventory((prev) => ({
      ...prev,
      alchemical_slag: Math.max(0, (prev.alchemical_slag || 0) - costSlag),
      [resultItem.id]: (prev[resultItem.id] || 0) + 1,
    }));
    if (costGold > 0) {
      setGold((prev) => Math.max(0, prev - costGold));
    }
    setItemsMap((prev) => ({ ...prev, [resultItem.id]: resultItem }));
    markDiscovered([resultItem.id]);
    setXp((prev) => prev + 45);
    setSelectedJeiItemId(resultItem.id);
    showToast(`⚗️ Скреп завершил перегонку: получено «${resultItem.name}»! (+45 XP)`);
  };

  const handleFuseRelics = (
    itemA: GameItem,
    itemB: GameItem,
    costGold: number,
    resultItem: GameItem
  ) => {
    setInventory((prev) => {
      const next = { ...prev };
      next[itemA.id] = Math.max(0, (next[itemA.id] || 0) - 1);
      next[itemB.id] = Math.max(0, (next[itemB.id] || 0) - 1);
      next[resultItem.id] = (next[resultItem.id] || 0) + 1;
      return next;
    });
    setGold((prev) => Math.max(0, prev - costGold));
    setItemsMap((prev) => ({ ...prev, [resultItem.id]: resultItem }));
    markDiscovered([resultItem.id]);
    setXp((prev) => prev + 350);
    setInspectedItem(resultItem);
    setSelectedJeiItemId(resultItem.id);
    showToast(`👑 ВЕЛИКАЯ ТРАНСМУТАЦИЯ СОВЕРШЕНА! Создан артефакт «${resultItem.name}»! (+350 XP)`);
  };

  const handleResetSave = () => {
    if (!window.confirm('Сбросить весь прогресс Гримуара и начать заново?')) return;
    localStorage.removeItem(STORAGE_KEY);
    window.location.reload();
  };

  const ownedInventoryItems = useMemo(() => {
    return Object.entries(inventory)
      .filter(([, count]) => count > 0)
      .map(([id]) => itemsMap[id])
      .filter(Boolean)
      .filter((item) => {
        if (inventoryFilter !== 'all' && item.kind !== inventoryFilter) return false;
        if (inventorySearch.trim()) {
          const q = inventorySearch.toLowerCase().trim();
          const matchesName = item.name.toLowerCase().includes(q) || item.nameEn.toLowerCase().includes(q);
          const matchesMonster = item.monsterName?.toLowerCase().includes(q);
          const matchesRarity = RARITY_META[item.rarity].label.toLowerCase().includes(q);
          const matchesElement = item.elements.some((el) => ELEMENT_META[el].label.toLowerCase().includes(q));
          return Boolean(matchesName || matchesMonster || matchesRarity || matchesElement);
        }
        return true;
      })
      .sort((a, b) => {
        if (a.kind !== b.kind) {
          const order = { crafted: 0, reagent: 1, catalyst: 2, slag: 3 };
          return order[a.kind] - order[b.kind];
        }
        return RARITY_META[b.rarity].rank - RARITY_META[a.rarity].rank;
      });
  }, [inventory, itemsMap, inventoryFilter, inventorySearch]);

  return (
    <div className="min-h-screen flex flex-col bg-[#0b0a0e] text-stone-100">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 px-4 py-2.5 rounded-xl bg-amber-500/95 text-stone-950 font-semibold text-xs shadow-2xl border border-amber-300 flex items-center gap-2 animate-bounce">
          <Sparkles className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* TOP HUD NAVBAR — СТИЛЬ ЦИТАДЕЛИ ДАЛЬНЕГО КАМНЯ */}
      <header className="sticky top-0 z-30 border-b border-[#c9aa72]/25 bg-[#0c151c]/95 backdrop-blur-md px-3 sm:px-4 py-2 sm:py-2.5 shadow-xl">
        <div className="max-w-[1600px] mx-auto flex flex-col sm:flex-row sm:flex-wrap items-center justify-between gap-2 sm:gap-3">
          {/* Mobile Top Row / Desktop Brand Title */}
          <div className="w-full sm:w-auto flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-[#14242e] border border-[#c9aa72]/40 flex items-center justify-center text-lg sm:text-xl shrink-0 shadow-[inset_0_1px_4px_rgba(208,173,119,0.3)]">
                ⚗️
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h1 className="font-display font-bold text-sm sm:text-lg tracking-wide text-[#f0ece3] truncate">
                    {t('brandTitle')} <span className="text-[#d0ad77]">{t('brandCrucible')}</span>
                  </h1>
                  <span className="hidden md:inline-flex px-1.5 py-0.2 rounded bg-[#162732] border border-[#c9aa72]/30 text-[#d0ad77] font-mono text-[9px]">
                    {t('campaignSubtitle')}
                  </span>
                </div>
                <p className="text-[10px] sm:text-[11px] text-[#94a7b0] truncate">
                  {t('dayPrefix')} {day} • {t('location')}
                </p>
              </div>
            </div>

            {/* Quick Mobile Resource Chips (Visible on Mobile only) */}
            <div className="flex sm:hidden items-center gap-1.5 shrink-0">
              <div className="rounded-lg bg-[#17231c] border border-[#c9aa72]/40 px-2 py-1 flex items-center gap-1 text-[11px] font-mono font-bold text-[#e5cb94]">
                <span>🪙</span>
                <span>{gold}</span>
              </div>
              <div
                className={`rounded-lg border px-2 py-1 flex items-center gap-1 text-[11px] font-mono font-bold ${
                  isExhausted
                    ? 'bg-rose-950/50 border-rose-500/60 text-rose-300'
                    : 'bg-[#101b22] border-[#233540] text-sky-300'
                }`}
              >
                <span>⚡</span>
                <span>{stamina}</span>
              </div>
            </div>
          </div>

          {/* Party Hero Centerpiece (Квик / Нокта / Слоу) */}
          <div className="w-full sm:w-auto rounded-xl bg-[#091116] border border-[#c9aa72]/30 p-1 flex items-center justify-between sm:justify-start gap-1 shadow-inner">
            <span className="text-[10px] font-mono uppercase text-[#7d929d] px-2 hidden md:inline">
              {t('masterLabel')}
            </span>
            {GUILD_WORLD_HEROES.map((hero) => {
              const selected = hero.id === activeHeroId;
              return (
                <button
                  key={hero.id}
                  onClick={() => {
                    sfx.playClick();
                    setActiveHeroId(hero.id);
                  }}
                  title={`${hero.name} (${hero.raceClass}) — Бонус крафта +${hero.craftBonus}, разделки +${hero.harvestBonus}`}
                  className={`flex-1 sm:flex-initial px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg text-xs font-display font-bold flex items-center justify-center gap-1 sm:gap-1.5 transition-all cursor-pointer ${
                    selected
                      ? 'bg-[#1a2d38] border border-[#d0ad77] text-[#fbf7ee] shadow-[0_0_12px_rgba(208,173,119,0.25)]'
                      : 'text-[#8b9ea8] hover:text-[#f0ece3] hover:bg-[#101b22]'
                  }`}
                >
                  <span className="text-sm">{hero.avatarEmoji}</span>
                  <span className="truncate">{hero.name.split(' ')[0]}</span>
                  <span className="text-[10px] font-mono text-[#d0ad77]/80 font-normal">
                    (+{hero.craftBonus})
                  </span>
                </button>
              );
            })}
          </div>

          {/* Progression Pillars: Ambient, Tabletop, Mastery, Stamina, Gold, GM Mode, Settings */}
          <div className="w-full sm:w-auto flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 sm:py-0">
            {/* Cape Farstone Ambient Soundscape Toggle */}
            <button
              onClick={() => {
                const isPlaying = sfx.toggleAmbientSoundscape();
                setIsAmbientPlaying(isPlaying);
                showToast(isPlaying ? t('ambientToastOn') : t('ambientToastOff'));
              }}
              title={lang === 'en' ? 'Toggle Cape Far Stone ambient soundscape' : 'Переключить атмосферный эмбиент Мыса Дальний Камень'}
              className={`shrink-0 px-2.5 sm:px-3 py-1.5 rounded-xl border text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                isAmbientPlaying
                  ? 'bg-cyan-950/70 border-cyan-400 text-cyan-200 shadow-[0_0_14px_rgba(6,182,212,0.3)]'
                  : 'bg-[#101b22] border-[#293d48] text-[#9cb0b9] hover:border-cyan-500/40 hover:text-[#f0ece3]'
              }`}
            >
              <span className={isAmbientPlaying ? 'animate-bounce' : ''}>
                {isAmbientPlaying ? '🌊' : '🔇'}
              </span>
              <span className="hidden sm:inline">
                {isAmbientPlaying ? t('ambientOn') : t('ambientOff')}
              </span>
            </button>

            {/* Tabletop d20 Roll Mode Toggle */}
            <button
              onClick={() => {
                sfx.playClick();
                setTabletopRollMode((prev) => !prev);
              }}
              title={lang === 'en' ? 'Toggle tabletop dice mode' : 'Переключить между виртуальным броском и вводом реального кубика d20 со стола'}
              className={`shrink-0 px-2.5 sm:px-3 py-1.5 rounded-xl border text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                tabletopRollMode
                  ? 'bg-emerald-950/70 border-emerald-400 text-emerald-200 shadow-[0_0_14px_rgba(16,185,129,0.25)]'
                  : 'bg-[#101b22] border-[#293d48] text-[#9cb0b9] hover:border-[#c9aa72]/40 hover:text-[#f0ece3]'
              }`}
            >
              <Dices className="w-3.5 h-3.5 text-[#d0ad77]" />
              <span className="hidden sm:inline">
                {tabletopRollMode ? t('tabletopManual', { val: manualD20Roll }) : t('tabletopAuto')}
              </span>
              <span className="sm:hidden font-mono">
                {tabletopRollMode ? `🎯 ${manualD20Roll}` : '🎲'}
              </span>
            </button>

            {/* Mastery Level */}
            <div className="shrink-0 rounded-xl bg-[#101b22] border border-[#233540] px-2.5 sm:px-3 py-1.5 flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-[#d0ad77] shrink-0" />
              <div>
                <div className="flex items-center gap-1 text-[11px] sm:text-xs">
                  <span className="font-semibold text-[#f0ece3]">
                    {t('masteryLvl')}{alchemistLevel}
                  </span>
                  <span className="px-1 py-0.2 rounded bg-[#d0ad77]/15 text-[#e5cb94] font-mono text-[9px] font-bold">
                    +{proficiencyBonus}
                  </span>
                </div>
              </div>
            </div>

            {/* Stamina & Rest (Desktop view) */}
            <div
              className={`hidden sm:flex shrink-0 rounded-xl border px-3 py-1.5 items-center gap-2 ${
                isExhausted
                  ? 'bg-rose-950/50 border-rose-500/60'
                  : 'bg-[#101b22] border-[#233540]'
              }`}
            >
              <Zap
                className={`w-4 h-4 shrink-0 ${
                  isExhausted ? 'text-rose-400 animate-pulse' : 'text-sky-400'
                }`}
              />
              <div>
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="font-mono font-bold text-[#f0ece3]">
                    {stamina}/{maxStamina}
                  </span>
                </div>
                <div className="text-[9px] text-[#8699a2]">{t('energyLabel')}</div>
              </div>
              <button
                onClick={handleLongRest}
                title={lang === 'en' ? 'Long rest in Far Stone' : 'Долгий отдых на Дальнем Камне'}
                className="ml-1 px-2 py-0.5 rounded bg-[#1c2e39] hover:bg-[#253d4b] border border-[#c9aa72]/30 text-[#e5cb94] text-[10px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Moon className="w-2.5 h-2.5" />
                <span>{t('restButton')}</span>
              </button>
            </div>

            {/* Gold (Desktop view) */}
            <div className="hidden sm:flex shrink-0 rounded-xl bg-[#17231c] border border-[#c9aa72]/40 px-3 py-1.5 items-center gap-2">
              <span className="text-sm">🪙</span>
              <div>
                <div className="font-mono font-bold text-xs text-[#e5cb94]">
                  {gold} {t('goldSuffix')}
                </div>
                <div className="text-[9px] text-[#9cb0a8]">{t('treasuryLabel')}</div>
              </div>
            </div>

            {/* Language Toggle Badge */}
            <button
              onClick={() => {
                sfx.playClick();
                toggleLang();
              }}
              className="shrink-0 px-2.5 sm:px-3 py-1.5 rounded-xl border border-[#c9aa72]/50 bg-[#162732] hover:bg-[#1f3747] text-[#fbf7ee] text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
              title={lang === 'en' ? 'Switch to Russian / Переключить на русский' : 'Switch to English / Переключить на английский'}
            >
              <span className="text-sm">🌐</span>
              <span className="text-[#d0ad77] uppercase font-bold">{lang.toUpperCase()}</span>
            </button>

            {/* Access & Foundry VTT Links Button */}
            <button
              onClick={() => {
                sfx.playClick();
                setShowAccessGateModal(true);
              }}
              className={`shrink-0 px-2.5 sm:px-3 py-1.5 rounded-xl border text-xs font-display font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                authSession?.role === 'gm'
                  ? 'bg-amber-950/60 border-amber-500/60 text-amber-300 shadow-md'
                  : 'bg-[#101b22] border-[#293d48] text-[#9cb0b9] hover:text-[#f0ece3]'
              }`}
              title={lang === 'en' ? 'Access Control & Foundry VTT Links' : 'Управление доступом и ссылками для Foundry VTT'}
            >
              <Shield className="w-3.5 h-3.5 text-amber-400" />
              <span>{authSession?.role === 'gm' ? t('gmRole') : t('foundryBtn')}</span>
            </button>

            {/* DM Mode Button (GM Only) */}
            {authSession?.role === 'gm' && (
              <button
                onClick={() => {
                  sfx.playClick();
                  setShowDmModal(true);
                }}
                className="shrink-0 px-2.5 sm:px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#2a2215] to-[#1d1b2a] hover:from-[#3a2f1c] hover:to-[#28253b] border border-[#c9aa72]/60 text-xs font-display font-bold text-[#e5cb94] flex items-center gap-1 shadow-md cursor-pointer"
                title={lang === 'en' ? 'Open GM Master Panel' : 'Открыть Панель Ведущего (выдача трофеев и создание монстров)'}
              >
                <Crown className="w-3.5 h-3.5 text-[#d0ad77]" />
                <span className="hidden sm:inline">{t('gmMode')}</span>
              </button>
            )}

            {/* Settings Menu Dropdown */}
            <div className="relative shrink-0">
              <button
                onClick={() => setShowSettingsMenu((prev) => !prev)}
                className={`p-1.5 sm:p-2 rounded-xl border transition-colors cursor-pointer ${
                  showSettingsMenu
                    ? 'bg-[#1b2b35] border-[#c9aa72]/60 text-[#f0ece3]'
                    : 'bg-[#101b22] hover:bg-[#182730] border-[#293d48] text-[#94a7b0]'
                }`}
                title={t('settingsBtn')}
              >
                <Settings className="w-4 h-4" />
              </button>

              {showSettingsMenu && (
                <div className="absolute right-0 mt-2 w-56 rounded-xl bg-[#101b22] border border-[#c9aa72]/40 shadow-2xl p-2 z-50 space-y-1">
                  {/* Language Selector in Menu */}
                  <button
                    onClick={() => {
                      sfx.playClick();
                      toggleLang();
                    }}
                    className="w-full px-3 py-2 rounded-lg text-left text-xs text-[#f0ece3] hover:bg-[#182832] flex items-center justify-between"
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-sm">🌐</span>
                      <span>{t('language')}</span>
                    </span>
                    <span className="text-[10px] font-mono text-[#d0ad77] font-bold">
                      {lang === 'en' ? 'English (EN)' : 'Русский (RU)'}
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      setShowSettingsMenu(false);
                      setShowApiKeyModal(true);
                    }}
                    className="w-full px-3 py-2 rounded-lg text-left text-xs font-mono text-[#d0ad77] hover:bg-[#182832] flex items-center gap-2"
                  >
                    <KeyRound className="w-3.5 h-3.5 text-[#d0ad77]" />
                    <span>{t('sdkKey')}</span>
                  </button>

                  <button
                    onClick={() => {
                      const next = !soundEnabled;
                      setSoundEnabled(next);
                      sfx.enabled = next;
                    }}
                    className="w-full px-3 py-2 rounded-lg text-left text-xs text-[#f0ece3] hover:bg-[#182832] flex items-center justify-between"
                  >
                    <span className="flex items-center gap-2">
                      {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-emerald-400" /> : <VolumeX className="w-3.5 h-3.5 text-[#8699a2]" />}
                      <span>{t('soundEffects')}</span>
                    </span>
                    <span className="text-[10px] font-mono text-[#94a7b0]">
                      {soundEnabled ? t('statusOn') : t('statusOff')}
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      const isPlaying = sfx.toggleAmbientSoundscape();
                      setIsAmbientPlaying(isPlaying);
                      showToast(isPlaying ? t('ambientToastOn') : t('ambientToastOff'));
                    }}
                    className="w-full px-3 py-2 rounded-lg text-left text-xs text-[#f0ece3] hover:bg-[#182832] flex items-center justify-between"
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-sm">🌊</span>
                      <span>{t('capeAmbient')}</span>
                    </span>
                    <span className="text-[10px] font-mono text-[#94a7b0]">
                      {isAmbientPlaying ? t('statusOn') : t('statusOff')}
                    </span>
                  </button>

                  <div className="border-t border-[#ffffff10] my-1 pt-1">
                    <button
                      onClick={() => {
                        setShowSettingsMenu(false);
                        handleResetSave();
                      }}
                      className="w-full px-3 py-2 rounded-lg text-left text-xs text-rose-300 hover:bg-rose-950/40 flex items-center gap-2"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>{t('resetProgress')}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT GRID: Left/Center Workspace + Right JEI Codex Sidebar */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto p-2 sm:p-4 grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-5">
        {/* LEFT & CENTER WORKSPACE (8 cols) */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          {/* DAILY LAIR EVENT BANNER (Мыс Дальний Камень) */}
          {activeDailyEvent && (
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-[#14232c] via-[#101b22] to-[#0c161d] border border-[#d0ad77]/40 shadow-lg relative overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#0b141a] border border-[#d0ad77]/50 flex items-center justify-center text-xl shrink-0 shadow-inner">
                    {activeDailyEvent.iconEmoji}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded bg-[#0b141a] border border-[#304856] font-mono text-[10px] text-[#d0ad77]">
                        {activeDailyEvent.badge} • День {day}
                      </span>
                      <h3 className="font-display font-bold text-sm text-[#f0ece3]">
                        {activeDailyEvent.title}
                      </h3>
                    </div>
                    <p className="text-xs text-[#95aab5] mt-0.5 leading-snug">
                      {activeDailyEvent.flavor}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-xl bg-[#172b36] border border-[#395669] text-xs font-semibold text-[#e5cb94]">
                    ✨ {activeDailyEvent.effectDescription}
                  </span>
                  <button
                    onClick={handleLongRest}
                    className="px-3 py-1.5 rounded-xl bg-[#1f3340] hover:bg-[#284354] border border-[#d0ad77]/60 text-[#f0ece3] text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all"
                    title="Завершить день и восстановить силы в Бастионе (20 gp)"
                  >
                    <Moon className="w-3.5 h-3.5 text-[#d0ad77]" />
                    <span>Отдых дня</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ACTIVE PARTY BUFFS & MUTATIONS STRIP */}
          <div className="p-3 rounded-2xl bg-[#0e1820] border border-[#c9aa72]/20 shadow-md">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-xs font-mono text-[#d0ad77]">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span className="font-bold uppercase tracking-wider">
                  Живые мутации и зелья отряда ({activeBuffs.length})
                </span>
              </div>
              <span className="text-[10px] text-[#7e93a0]">
                Действуют 3 боя в вылазках или до снятия
              </span>
            </div>

            {activeBuffs.length === 0 ? (
              <div className="text-xs text-[#6e828e] py-1.5 px-3 rounded-xl bg-[#0b1319] border border-[#1b2b36] flex items-center justify-between">
                <span>
                  🧪 Мутации отряда не активны. Нажмите на зелье или трофей в статблоке или сумке, чтобы применить эффект на героя.
                </span>
                <span className="text-[10px] font-mono text-[#8ca0ab]">
                  Герои: 🍽️ Квик, 🥷 Нокта, ⚔️ Слоу
                </span>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {activeBuffs.map((buff) => {
                  const heroProfile = GUILD_WORLD_HEROES.find((h) => h.id === buff.heroId);
                  return (
                    <div
                      key={buff.id}
                      className="p-2.5 rounded-xl bg-[#0c151c] border border-[#c9aa72]/30 flex items-start justify-between gap-2 text-xs shadow-sm"
                    >
                      <div className="flex items-start gap-2 min-w-0">
                        <span className="text-lg leading-none mt-0.5">{buff.iconEmoji}</span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-[#f0ece3] truncate">
                              {buff.title}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#162732] border border-[#2c4555] font-mono text-[#d0ad77]">
                              {heroProfile?.name.split(' ')[0] || buff.heroId}
                            </span>
                          </div>
                          <div className="text-[11px] text-[#93a6b0] line-clamp-2 mt-0.5">
                            {buff.description}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="px-1.5 py-0.5 rounded bg-[#14232d] border border-[#2c4555] font-mono text-[10px] text-[#e5cb94]">
                          ⚔️ {buff.durationFights} б.
                        </span>
                        <button
                          onClick={() => handleRemoveBuff(buff.id)}
                          className="text-[#6e828e] hover:text-rose-300 p-0.5 cursor-pointer transition-colors"
                          title="Снять эффект"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Navigation Bar between the 5 Core Screens — Стиль фолианта */}
          <div className="flex overflow-x-auto no-scrollbar sm:grid sm:grid-cols-5 gap-1.5 p-1.5 rounded-2xl bg-[#0e1820] border border-[#c9aa72]/25 shadow-lg">
            <button
              onClick={() => {
                sfx.playClick();
                setActiveMainTab('crucible');
              }}
              className={`py-2 sm:py-2.5 px-3 sm:px-2 rounded-xl font-display font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer shrink-0 sm:shrink min-w-[110px] sm:min-w-0 ${
                activeMainTab === 'crucible'
                  ? 'bg-[#182a34] text-[#fbf7ee] border border-[#d0ad77] shadow-[0_2px_10px_rgba(208,173,119,0.2)]'
                  : 'text-[#8b9ea8] hover:text-[#f0ece3] hover:bg-[#121f28]'
              }`}
            >
              <Flame className="w-4 h-4 text-[#d0ad77] shrink-0" />
              <span className="truncate">{t('tabCrucible')}</span>
            </button>

            <button
              onClick={() => {
                sfx.playClick();
                setActiveMainTab('codex');
              }}
              className={`py-2 sm:py-2.5 px-3 sm:px-2 rounded-xl font-display font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer shrink-0 sm:shrink min-w-[130px] sm:min-w-0 ${
                activeMainTab === 'codex'
                  ? 'bg-[#182a34] text-[#e5cb94] border border-[#c9aa72] shadow-[0_2px_10px_rgba(208,173,119,0.2)]'
                  : 'text-[#8b9ea8] hover:text-[#f0ece3] hover:bg-[#121f28]'
              }`}
            >
              <BookOpen className="w-4 h-4 text-[#e5cb94] shrink-0" />
              <span className="truncate">{t('tabCodex')}</span>
            </button>

            <button
              onClick={() => {
                sfx.playClick();
                setActiveMainTab('bestiary');
              }}
              className={`py-2 sm:py-2.5 px-3 sm:px-2 rounded-xl font-display font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer shrink-0 sm:shrink min-w-[125px] sm:min-w-0 ${
                activeMainTab === 'bestiary'
                  ? 'bg-[#182a34] text-emerald-200 border border-emerald-500/60 shadow-[0_2px_10px_rgba(16,185,129,0.2)]'
                  : 'text-[#8b9ea8] hover:text-[#f0ece3] hover:bg-[#121f28]'
              }`}
            >
              <Compass className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="truncate">{t('tabBestiary')} ({allMonsters.length})</span>
            </button>

            <button
              onClick={() => {
                sfx.playClick();
                setActiveMainTab('hero_raid');
              }}
              className={`py-2 sm:py-2.5 px-3 sm:px-2 rounded-xl font-display font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer shrink-0 sm:shrink min-w-[120px] sm:min-w-0 ${
                activeMainTab === 'hero_raid'
                  ? 'bg-[#182a34] text-rose-200 border border-rose-500/60 shadow-[0_2px_10px_rgba(244,63,94,0.2)]'
                  : 'text-[#8b9ea8] hover:text-[#f0ece3] hover:bg-[#121f28]'
              }`}
            >
              <Swords className="w-4 h-4 text-rose-400 shrink-0" />
              <span className="truncate">
                {t('tabParty')} ({activeHero.name.split(' ')[0]})
              </span>
            </button>

            <button
              onClick={() => {
                sfx.playClick();
                setActiveMainTab('guild');
              }}
              className={`py-2 sm:py-2.5 px-3 sm:px-2 rounded-xl font-display font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer shrink-0 sm:shrink min-w-[125px] sm:min-w-0 ${
                activeMainTab === 'guild'
                  ? 'bg-[#182a34] text-amber-300 border border-amber-500/60 shadow-[0_2px_10px_rgba(208,173,119,0.2)]'
                  : 'text-[#8b9ea8] hover:text-[#f0ece3] hover:bg-[#121f28]'
              }`}
            >
              <ShoppingBag className="w-4 h-4 text-[#d0ad77] shrink-0" />
              <span className="truncate">
                {t('tabBounties')} ({bounties.filter((b) => !b.completed).length})
              </span>
            </button>
          </div>

          {/* TABLETOP REAL D20 ROLL BAR — Лоток для физического кубика */}
          {tabletopRollMode && (
            <div className="rounded-2xl border border-emerald-500/50 bg-[#0e211b] px-4 py-3 flex flex-wrap items-center justify-between gap-3 shadow-lg">
              <div>
                <div className="text-xs font-display font-bold text-emerald-200 flex items-center gap-1.5">
                  <Dices className="w-4 h-4 text-emerald-400" />
                  <span>Лоток d20 со стола: укажите выпавшее число с вашего физического кубика или чата Foundry</span>
                </div>
                <p className="text-[11px] text-[#9cb0a8] mt-0.5">
                  Активный персонаж: <strong className="text-[#e5cb94]">{activeHero.name}</strong> (Крафт +{proficiencyBonus} / Разделка +{Math.max(proficiencyBonus, activeHero.harvestBonus)})
                </p>
              </div>
              <div className="flex flex-wrap gap-1">
                {Array.from({ length: 20 }, (_, i) => i + 1).map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => {
                      sfx.playClick();
                      setManualD20Roll(val);
                    }}
                    className={`w-7 h-7 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                      manualD20Roll === val
                        ? 'bg-[#d0ad77] text-[#121f28] ring-2 ring-[#f8e7c9] scale-105'
                        : val === 20
                        ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/50 hover:bg-emerald-900'
                        : val === 1
                        ? 'bg-rose-950/80 text-rose-300 border border-rose-500/50 hover:bg-rose-900'
                        : 'bg-[#121e27] text-[#c4d5dd] hover:bg-[#1a2b37] border border-[#273d4c]'
                    }`}
                  >
                    {val}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => {
                    setD20ModalTargetResult(manualD20Roll);
                    setD20ModalModifier(proficiencyBonus);
                    setD20ModalTitle(`3D d20: ${activeHero.name}`);
                    setD20ModalSubtitle(`Бонус персонажа: +${proficiencyBonus}`);
                    setShowD20Modal(true);
                  }}
                  className="px-3 py-1 rounded-lg bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-stone-950 font-display font-bold text-xs flex items-center gap-1.5 shadow-md cursor-pointer transition-all ml-1"
                  title="Запустить интерактивную 3D-анимацию кубика d20 Three.js"
                >
                  <span>🎲</span>
                  <span>3D d20</span>
                </button>
              </div>
            </div>
          )}

          {/* LAST ROLL BANNER (d20 feedback) */}
          {lastRoll && (
            <div
              className={`rounded-2xl border p-4 flex flex-wrap items-center justify-between gap-4 transition-all ${
                lastRoll.outcome === 'masterwork'
                  ? 'bg-[#211a10] border-[#d0ad77] shadow-[0_0_20px_rgba(208,173,119,0.2)]'
                  : lastRoll.outcome === 'slag' || lastRoll.outcome === 'harvest_fail'
                  ? 'bg-rose-950/40 border-rose-500/50'
                  : lastRoll.outcome === 'cursed'
                  ? 'bg-purple-950/40 border-purple-500/60'
                  : 'bg-[#10231c] border-emerald-500/50'
              }`}
            >
              <div className="flex items-center gap-3.5">
                <div className="w-14 h-14 rounded-2xl bg-[#091117] border border-[#c9aa72]/30 flex flex-col items-center justify-center shrink-0">
                  <span className="text-[10px] font-mono text-[#8699a2]">d20 итог</span>
                  <span className="font-mono font-extrabold text-xl text-[#e5cb94]">
                    {lastRoll.total}
                  </span>
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-display font-bold text-sm text-[#f0ece3]">
                      {lastRoll.title}
                    </h3>
                    <span className="px-2 py-0.5 rounded bg-[#0b141a] border border-[#233845] font-mono text-[11px] text-[#9cb0b9]">
                      Кубик: {lastRoll.d20Raw}
                      {lastRoll.d20Second !== undefined
                        ? ` (помеха из ${lastRoll.d20Raw}, ${lastRoll.d20Second})`
                        : ''}{' '}
                      + Модификатор {lastRoll.proficiencyBonus}
                      {lastRoll.extraBonus > 0 ? ` + Бонус ${lastRoll.extraBonus}` : ''} ={' '}
                      {lastRoll.total} (СЛ {lastRoll.dc})
                    </span>
                  </div>
                  <p className="text-xs text-[#c4d5dd] mt-1">{lastRoll.subtitle}</p>
                </div>
              </div>

              {lastRoll.createdItem && lastRoll.createdItem.kind === 'crafted' && (
                <button
                  onClick={() => setInspectedItem(lastRoll.createdItem!)}
                  className="px-3.5 py-2 rounded-xl bg-[#1d303b] hover:bg-[#253f4e] border border-[#c9aa72]/50 text-[#e5cb94] text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Eye className="w-4 h-4" />
                  <span>Открыть D&D Статблок</span>
                </button>
              )}
            </div>
          )}

          {/* ===================================================== */}
          {/* SCREEN 1: THE CRUCIBLE (АЛХИМИЧЕСКИЙ СТОЛ)             */}
          {/* ===================================================== */}
          {activeMainTab === 'crucible' && (
            <div className="space-y-4">
              {/* Station Selector + Crucible Cauldron Card */}
              <div className="rounded-2xl border border-[#c9aa72]/25 bg-[#101b22] p-5 shadow-xl space-y-5">
                {/* Station Mode Selector */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ffffff10] pb-4">
                  <div>
                    <h2 className="font-display font-bold text-base text-[#e5cb94]">
                      {t('workshopTitle')}
                    </h2>
                    <p className="text-xs text-[#8ca0ab]">
                      {t('workshopSub')}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full sm:w-auto">
                    {[
                      {
                        id: 'alchemist',
                        label: t('stationAlchemist'),
                        sub: t('stationAlchemistSub'),
                        icon: <Flame className="w-4 h-4 text-emerald-400 shrink-0" />,
                      },
                      {
                        id: 'blacksmith',
                        label: t('stationBlacksmith'),
                        sub: t('stationBlacksmithSub'),
                        icon: <Hammer className="w-4 h-4 text-amber-400 shrink-0" />,
                      },
                      {
                        id: 'artificer',
                        label: t('stationArtificer'),
                        sub: t('stationArtificerSub'),
                        icon: <Wand2 className="w-4 h-4 text-purple-400 shrink-0" />,
                      },
                    ].map((st) => (
                      <button
                        key={st.id}
                        onClick={() => {
                          sfx.playClick();
                          setStation(st.id as CraftingStation);
                        }}
                        className={`px-2.5 sm:px-3.5 py-2 rounded-xl border text-left transition-all flex items-center gap-2 cursor-pointer ${
                          station === st.id
                            ? 'bg-[#192b36] border-[#d0ad77] text-[#fbf7ee] shadow-md'
                            : 'bg-[#0d161d] border-[#223541] text-[#8699a2] hover:text-[#f0ece3] hover:border-[#c9aa72]/30'
                        }`}
                      >
                        {st.icon}
                        <div className="min-w-0">
                          <div className="text-xs font-bold leading-none truncate">{st.label}</div>
                          <div className="text-[10px] text-[#7d929e] mt-0.5 hidden sm:block truncate">
                            {st.sub}
                          </div>
                        </div>
                      </button>
                    ))}

                    {/* Skrep's Slag Alembic & Relic Fusion Button */}
                    <button
                      onClick={() => {
                        sfx.playClick();
                        setShowAlembicModal(true);
                      }}
                      className="px-2.5 sm:px-3.5 py-2 rounded-xl border border-amber-500/50 bg-[#1e1710] hover:bg-[#2b1f14] text-amber-200 text-left transition-all flex items-center gap-2 cursor-pointer shadow-md"
                      title={lang === 'en' ? 'Open Skrep Alembic' : 'Открыть Перегонный куб Скрепа (Очиститель шлака и Великая Трансмутация)'}
                    >
                      <span className="text-lg sm:text-xl shrink-0">⚗️</span>
                      <div className="min-w-0">
                        <div className="text-xs font-bold leading-none flex items-center gap-1.5">
                          <span className="truncate">{t('stationSkrep')}</span>
                          {(inventory.alchemical_slag || 0) > 0 && (
                            <span className="px-1.5 py-0.2 rounded-full bg-amber-500/30 text-amber-300 text-[10px] font-mono shrink-0">
                              {inventory.alchemical_slag}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-amber-400/80 mt-0.5 hidden sm:block truncate">
                          {t('stationSkrepSub')}
                        </div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* TARGET BLUEPRINT / ITEM FORM SELECTOR (Пояс, Зелье, Бомба, Меч, и др.) */}
                <div className="rounded-xl bg-[#0b141a] border border-[#c9aa72]/20 p-2.5 sm:p-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-[#d0ad77] uppercase flex items-center gap-1.5">
                      <span>🎯</span>
                      <span>{lang === 'en' ? 'Target Blueprint:' : 'Желаемый предмет:'}</span>
                    </span>
                    <span className="text-[11px] text-[#8ca0ab] hidden sm:inline">
                      {lang === 'en'
                        ? 'Select what item archetype you want the Crucible to forge'
                        : 'Выберите конкретный тип вещи для синтеза в тигле'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-1 sm:pb-0">
                    {[
                      { id: 'auto', label: lang === 'en' ? '✦ Auto (Jev AI)' : '✦ Авто (ИИ Jev)', icon: '🔮' },
                      ...(station === 'alchemist'
                        ? [
                            { id: 'healing_draught', label: lang === 'en' ? 'Potion / Draught' : 'Зелье / Фиал', icon: '🧪' },
                            { id: 'deadly_poison', label: lang === 'en' ? 'Venom / Toxin' : 'Яд / Токсин', icon: '☠️' },
                            { id: 'volatile_bomb', label: lang === 'en' ? 'Bomb / Grenade' : 'Бомба / Граната', icon: '💣' },
                            { id: 'mutagen_elixir', label: lang === 'en' ? 'Mutagen Elixir' : 'Мутаген', icon: '🧬' },
                            { id: 'weapon_oil', label: lang === 'en' ? 'Blade Oil' : 'Масло закалки', icon: '🫙' },
                            { id: 'astral_solvent', label: lang === 'en' ? 'Essence Solvent' : 'Эссенция', icon: '⚗️' },
                          ]
                        : station === 'blacksmith'
                        ? [
                            { id: 'belt_girdle', label: lang === 'en' ? 'War Girdle / Belt' : 'Боевой пояс', icon: '🥋' },
                            { id: 'gauntlets', label: lang === 'en' ? 'Gauntlets' : 'Рукавицы', icon: '🧤' },
                            { id: 'longsword', label: lang === 'en' ? 'Blade / Sword' : 'Клинок / Меч', icon: '⚔️' },
                            { id: 'warhammer', label: lang === 'en' ? 'Warhammer' : 'Боевой молот', icon: '🔨' },
                            { id: 'breastplate', label: lang === 'en' ? 'Cuirass / Armor' : 'Кираса / Доспех', icon: '🦺' },
                            { id: 'shield', label: lang === 'en' ? 'Aegis Shield' : 'Щит / Эгида', icon: '🛡️' },
                            { id: 'dagger', label: lang === 'en' ? 'Dagger' : 'Кинжал', icon: '🗡️' },
                            { id: 'whip', label: lang === 'en' ? 'Lash Whip' : 'Боевой кнут', icon: '🪢' },
                          ]
                        : [
                            { id: 'belt_girdle', label: lang === 'en' ? 'Runic Belt' : 'Рунный пояс', icon: '🥋' },
                            { id: 'boots', label: lang === 'en' ? 'Strider Boots' : 'Сапоги', icon: '🥾' },
                            { id: 'ring', label: lang === 'en' ? 'Signet Ring' : 'Перстень / Кольцо', icon: '💍' },
                            { id: 'amulet', label: lang === 'en' ? 'Talisman / Amulet' : 'Амулет / Талисман', icon: '📿' },
                            { id: 'cloak', label: lang === 'en' ? 'Phase Cloak' : 'Мантия / Плащ', icon: '🧥' },
                            { id: 'wand', label: lang === 'en' ? 'Arcane Wand' : 'Жезл', icon: '🪄' },
                            { id: 'orb', label: lang === 'en' ? 'Resonant Orb' : 'Сфера', icon: '🔮' },
                            { id: 'scroll', label: lang === 'en' ? 'Runic Scroll' : 'Манускрипт', icon: '📜' },
                          ]),
                    ].map((pill) => (
                      <button
                        key={pill.id}
                        onClick={() => {
                          sfx.playClick();
                          setTargetArchetype(pill.id);
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-mono whitespace-nowrap border transition-all flex items-center gap-1 cursor-pointer ${
                          targetArchetype === pill.id
                            ? 'bg-[#192b36] border-amber-400 text-amber-200 font-bold shadow-sm'
                            : 'bg-[#091117] border-[#223541] text-[#8699a2] hover:text-[#f0ece3] hover:border-[#c9aa72]/40'
                        }`}
                      >
                        <span>{pill.icon}</span>
                        <span>{pill.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Crucible Chamber Layout */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-stretch">
                  {/* Reagent Slots: Crucible Chamber (7 cols) */}
                  <div className="md:col-span-7 flex flex-col justify-between py-4 sm:py-6 px-2.5 sm:px-4 rounded-2xl bg-gradient-to-b from-[#0c161d] to-[#091117] border border-[#c9aa72]/35 relative overflow-hidden shadow-inner">
                    {/* Background Runic Crucible Motif */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-5">
                      <div className="w-72 h-72 rounded-full border-4 border-dashed border-[#d0ad77]" />
                    </div>

                    <div className="flex items-center justify-between text-xs font-mono text-[#8ca0ab] mb-3 px-1">
                      <span className="flex items-center gap-1.5 text-[#d0ad77]">
                        <Flame className="w-3.5 h-3.5" />
                        <span>{t('crucibleCauldronTitle')} ({crucibleSlots.length}/{maxCrucibleSlots})</span>
                      </span>
                      {crucibleSlots.length > 0 && (
                        <button
                          onClick={() => setCrucibleSlots([])}
                          className="text-[11px] text-rose-300 hover:text-rose-200 flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>{t('clearCauldronBtn')}</span>
                        </button>
                      )}
                    </div>

                    {/* Sockets Row */}
                    <div className="flex items-center justify-center gap-1.5 sm:gap-3 relative z-10 py-2">
                      {Array.from({ length: maxCrucibleSlots }).map((_, idx) => {
                        const itemId = crucibleSlots[idx];
                        const item = itemId ? itemsMap[itemId] : null;
                        return (
                          <React.Fragment key={idx}>
                            {idx > 0 && (
                              <div className="flex flex-col items-center justify-center text-[#d0ad77]/60 font-mono text-xs sm:text-sm shrink-0">
                                <span>✦</span>
                              </div>
                            )}
                            <div
                              onClick={() => item && handleRemoveCrucibleSlot(idx)}
                              className={`w-24 h-28 sm:w-32 sm:h-36 flex-1 max-w-[124px] rounded-2xl border-2 flex flex-col items-center justify-center p-1.5 sm:p-2.5 text-center transition-all cursor-pointer select-none relative group ${
                                item
                                  ? `${RARITY_META[item.rarity].bg} ${
                                      RARITY_META[item.rarity].border
                                    } border-solid shadow-[0_4px_16px_rgba(0,0,0,0.4)] hover:scale-105`
                                  : 'border-[#293d4b] border-dashed bg-[#0e1921]/60 text-[#718590] hover:border-[#c9aa72]/50 hover:text-[#9fb2bc]'
                              }`}
                            >
                              {item ? (
                                <>
                                  <div className="hidden sm:block">
                                    <CompositeItemSprite item={item} size="lg" />
                                  </div>
                                  <div className="sm:hidden">
                                    <CompositeItemSprite item={item} size="sm" />
                                  </div>
                                  <span className="text-[10px] sm:text-[11px] font-semibold text-[#f0ece3] mt-1 sm:mt-2 line-clamp-1 sm:line-clamp-2 leading-tight">
                                    {getItemName(item)}
                                  </span>
                                  <span className="text-[9px] font-mono text-[#d0ad77] mt-0.5 sm:mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {t('removeSlotHint')}
                                  </span>
                                </>
                              ) : (
                                <>
                                  <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full border border-[#2b404f] flex items-center justify-center text-[#d0ad77]/40 mb-0.5 sm:mb-1 text-xs">
                                    {idx + 1}
                                  </div>
                                  <span className="text-[10px] sm:text-[11px] font-mono text-[#8ca0ab]">
                                    {t('componentSlot', { num: idx + 1 })}
                                  </span>
                                  <span className="text-[8px] sm:text-[9px] text-[#5e727e] mt-0.5 hidden xs:inline sm:inline">
                                    {t('selectInBagHint')}
                                  </span>
                                </>
                              )}
                            </div>
                          </React.Fragment>
                        );
                      })}
                    </div>

                    {/* Animated Crucible Hearth Cauldron FX */}
                    <div className="mt-4 p-3 rounded-2xl border border-[#c9aa72]/30 relative overflow-hidden bg-[#091117] shadow-inner">
                      {/* Animated Fluid Layer */}
                      <div
                        className={`absolute inset-0 opacity-40 transition-all duration-700 cauldron-liquid ${
                          isRolling ? 'opacity-85 scale-105' : ''
                        }`}
                        style={{
                          background:
                            crucibleItems.length === 0
                              ? 'radial-gradient(ellipse at center, rgba(16, 27, 34, 0.9) 0%, rgba(9, 17, 23, 0.95) 100%)'
                              : crucibleItems.length === 1
                              ? 'radial-gradient(ellipse at center, rgba(208, 173, 119, 0.35) 0%, rgba(9, 17, 23, 0.95) 100%)'
                              : 'linear-gradient(135deg, rgba(16, 185, 129, 0.4), rgba(245, 158, 11, 0.35), rgba(56, 189, 248, 0.35), rgba(208, 173, 119, 0.25))'
                        }}
                      />

                      {/* Simmering Bubbles / Arcane Sparks */}
                      <div className="absolute inset-0 pointer-events-none overflow-hidden">
                        <div className="absolute left-[20%] bottom-1 w-2.5 h-2.5 rounded-full bg-[#d0ad77]/60 cauldron-bubble-1" />
                        <div className="absolute left-[50%] bottom-2 w-3.5 h-3.5 rounded-full bg-emerald-400/60 cauldron-bubble-2" />
                        <div className="absolute left-[78%] bottom-1 w-2 h-2 rounded-full bg-sky-400/60 cauldron-bubble-3" />
                      </div>

                      {/* Hearth State Info */}
                      <div className="relative z-10 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-3 h-3 rounded-full transition-colors ${
                              isRolling
                                ? 'bg-amber-400 animate-ping'
                                : crucibleItems.length >= 2
                                ? 'bg-emerald-400 animate-pulse'
                                : 'bg-stone-600'
                            }`}
                          />
                          <span className="font-mono text-xs text-[#f0ece3] font-semibold">
                            {crucibleItems.length === 0
                              ? 'Очаг тих (Вложите компоненты)'
                              : crucibleItems.length === 1
                              ? 'Первичный накал субстанции'
                              : isRolling
                              ? '🔥 КИПЕНИЕ ТИГЛЯ • ИДЁТ ТРАНСМУТАЦИЯ...'
                              : '✦ Горнило разогрето: реакция готова к запуску'}
                          </span>
                        </div>

                        {/* Elemental tags of slotted ingredients */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {Array.from(new Set(crucibleItems.flatMap((i) => i.elements))).map(
                            (elem) => {
                              const meta = ELEMENT_META[elem];
                              return (
                                <span
                                  key={elem}
                                  className={`px-2 py-0.5 rounded-lg border font-mono text-[10px] flex items-center gap-1 shadow-sm ${meta.bg} ${meta.border} ${meta.color}`}
                                >
                                  <span>{meta.emoji}</span>
                                  <span>{meta.label}</span>
                                </span>
                              );
                            }
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Synthesis Control Console (5 cols) */}
                  <div className="md:col-span-5 flex flex-col justify-between rounded-2xl bg-[#0e171e] border border-[#c9aa72]/30 p-4 space-y-3">
                    <div className="flex items-center justify-between text-xs border-b border-[#ffffff10] pb-2">
                      <span className="font-mono text-[#8ca0ab]">
                        Проверка ({activeHero.name.split(' ')[0]}):
                      </span>
                      <span className="font-mono font-bold text-[#e5cb94]">
                        {tabletopRollMode ? `d20(${manualD20Roll})` : 'd20'} + {proficiencyBonus}{' '}
                        {isExhausted && !tabletopRollMode ? '(Помеха!)' : ''} vs СЛ{' '}
                        {crucibleItems.length >= 2 ? effectiveDc : '—'}
                      </span>
                    </div>

                    {knownRecipe && itemsMap[knownRecipe.resultItemId] ? (
                      <div className="rounded-xl bg-[#0e241c] border border-emerald-500/40 p-2.5 text-xs flex items-center gap-2.5">
                        <CompositeItemSprite
                          item={itemsMap[knownRecipe.resultItemId]}
                          size="md"
                        />
                        <div className="min-w-0">
                          <div className="text-[10px] font-mono text-emerald-400 uppercase">
                            Изученный рецепт (-3 к СЛ)
                          </div>
                          <div className="font-semibold text-[#f0ece3] truncate">
                            {itemsMap[knownRecipe.resultItemId]?.name}
                          </div>
                        </div>
                      </div>
                    ) : crucibleItems.length >= 2 && telemetry ? (
                      <div className="rounded-xl bg-[#1e1529] border border-purple-500/40 p-2.5 text-xs flex items-center gap-2.5">
                        <Sparkles className="w-5 h-5 text-purple-300 shrink-0" />
                        <div>
                          <div className="text-[10px] font-mono text-purple-300 uppercase">
                            Неизученная трансмутация!
                          </div>
                          <div className="text-[#f0ece3]">
                            Прогноз Jev:{' '}
                            <strong className={RARITY_META[telemetry.predictedRarity].text}>
                              {RARITY_META[telemetry.predictedRarity].label}
                            </strong>{' '}
                            ({ELEMENT_META[telemetry.elementAffinity.choice].label})
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-xl bg-[#121e27] border border-[#213543] p-2.5 text-xs text-[#8ca0ab]">
                        Добавьте минимум 2 компонента из сумки для параллельного расчета вероятностей Jev.
                      </div>
                    )}

                    {locked3dRoll !== null && (
                      <div className="rounded-xl bg-amber-950/60 border border-amber-500/60 p-2 text-xs flex items-center justify-between gap-2 text-amber-200">
                        <span className="flex items-center gap-1.5 font-mono">
                          <span>🎲</span>
                          <span>
                            {lang === 'en' ? 'Locked 3D d20 Roll:' : 'Зафиксирован бросок 3D d20:'}{' '}
                            <strong className="text-base text-amber-300 font-bold">{locked3dRoll}</strong>{' '}
                            (+{proficiencyBonus} = <span className="text-emerald-300 font-bold">{locked3dRoll + proficiencyBonus}</span>)
                          </span>
                        </span>
                        <button
                          onClick={() => setLocked3dRoll(null)}
                          className="text-[10px] text-stone-400 hover:text-rose-300 underline font-mono cursor-pointer"
                        >
                          {lang === 'en' ? 'Clear' : 'Сброс'}
                        </button>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSynthesize()}
                        disabled={crucibleItems.length < 2 || isEvaluating || isRolling || stamina <= 0}
                        className={`flex-1 py-3.5 px-4 rounded-xl font-display font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
                          crucibleItems.length >= 2 && !isEvaluating && stamina > 0
                            ? 'bg-gradient-to-r from-[#d0ad77] via-[#c9aa72] to-[#b89154] hover:from-[#e0bd86] hover:to-[#cbb075] text-[#121e27] shadow-[0_4px_20px_rgba(208,173,119,0.35)]'
                            : 'bg-[#182630] text-[#5e727e] border border-[#243745] cursor-not-allowed'
                        }`}
                      >
                        <Dices className="w-5 h-5" />
                        <span>
                          {isRolling
                            ? t('synthesizingBtn')
                            : locked3dRoll !== null
                            ? `${lang === 'en' ? 'Apply 3D Roll & Synthesize' : 'Применить 3D бросок'} (${locked3dRoll} + ${proficiencyBonus} = ${locked3dRoll + proficiencyBonus})`
                            : tabletopRollMode
                            ? `${lang === 'en' ? 'Synthesize' : 'Синтезировать'} (${manualD20Roll} + ${proficiencyBonus} = ${manualD20Roll + proficiencyBonus})`
                            : `${lang === 'en' ? 'Synthesize (d20 • 1⚡)' : 'Синтезировать (d20 • 1⚡)'}`}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setD20ModalDc(crucibleItems.length >= 2 ? effectiveDc : undefined);
                          setD20ModalModifier(proficiencyBonus);
                          setD20ModalTitle(lang === 'en' ? `Synthesis 3D Roll: ${activeHero.name}` : `3D Бросок Синтеза: ${activeHero.name}`);
                          setD20ModalSubtitle(
                            crucibleItems.length >= 2
                              ? (lang === 'en' ? `Synthesis DC: ${effectiveDc}` : `Сложность синтеза СЛ: ${effectiveDc}`)
                              : (lang === 'en' ? 'Craft check d20' : 'Проверка ремесла d20')
                          );
                          setD20ModalTargetResult(tabletopRollMode ? manualD20Roll : undefined);
                          setD20ModalActionLabel(
                            crucibleItems.length >= 2
                              ? (lang === 'en' ? '🔥 Apply & Synthesize Now!' : '🔥 Применить и Синтезировать!')
                              : (lang === 'en' ? 'Lock 3D Roll' : 'Зафиксировать бросок')
                          );
                          setD20ModalConfirmCallback(() => (rolled: number) => {
                            setLocked3dRoll(rolled);
                            if (crucibleItems.length >= 2) {
                              handleSynthesize(rolled);
                            }
                          });
                          setShowD20Modal(true);
                        }}
                        className={`px-3.5 py-3.5 rounded-xl border font-display font-bold text-xs flex items-center gap-1.5 shadow-md cursor-pointer transition-all ${
                          locked3dRoll !== null
                            ? 'border-amber-400 bg-amber-950/80 text-amber-200 ring-2 ring-amber-400/50'
                            : 'border-amber-500/50 bg-[#162732] hover:bg-[#203644] text-amber-300'
                        }`}
                        title="3D d20"
                      >
                        <span>🎲</span>
                        <span className="hidden sm:inline">
                          {locked3dRoll !== null ? `3D: ${locked3dRoll}` : '3D d20'}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Jev System-1 Telemetry Panel */}
                <JevTelemetryPanel
                  telemetry={telemetry}
                  isEvaluating={isEvaluating}
                  effectiveDc={effectiveDc}
                  knownRecipeBonus={knownRecipeBonus}
                  upgradeDcReduction={upgradeDcReduction}
                />
              </div>

              {/* Player's Inventory Bag (Сумка Алхимика с фильтрами и поиском) */}
              <div className="rounded-2xl border border-[#c9aa72]/25 bg-[#101b22] p-5 space-y-4 shadow-xl">
                {/* Bag Header + Filters */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ffffff10] pb-3">
                  <div>
                    <h3 className="font-display font-bold text-sm text-[#f0ece3]">
                      {t('bagTitle')}
                    </h3>
                    <p className="text-[11px] text-[#8ca0ab]">
                      {t('bagSub')}
                    </p>
                  </div>

                  {/* Search and Category Filter Tabs */}
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Search Input */}
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-[#8ca0ab] absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={inventorySearch}
                        onChange={(e) => setInventorySearch(e.target.value)}
                        placeholder={t('searchBagPlaceholder')}
                        className="pl-8 pr-3 py-1 rounded-lg bg-[#0c151c] border border-[#233845] text-xs text-[#f0ece3] placeholder:text-[#657a87] focus:outline-none focus:border-[#d0ad77]/60"
                      />
                    </div>

                    {/* Category Buttons */}
                    <div className="flex items-center gap-1 rounded-lg bg-[#0c151c] border border-[#233845] p-0.5">
                      {[
                        { id: 'all', label: t('filterAll') },
                        { id: 'reagent', label: t('filterReagents') },
                        { id: 'catalyst', label: t('filterCatalysts') },
                        { id: 'crafted', label: t('filterCrafted') },
                      ].map((tab) => (
                        <button
                          key={tab.id}
                          onClick={() => setInventoryFilter(tab.id as any)}
                          className={`px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                            inventoryFilter === tab.id
                              ? 'bg-[#1a2d39] text-[#e5cb94] border border-[#c9aa72]/40 font-bold'
                              : 'text-[#8ca0ab] hover:text-[#f0ece3]'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {ownedInventoryItems.length === 0 ? (
                  <div className="rounded-xl border border-[#233845] bg-[#0c151c]/80 p-8 text-center space-y-2">
                    <p className="text-sm text-[#8ca0ab]">{t('emptyBagMsg')}</p>
                    <button
                      onClick={() => {
                        setInventoryFilter('all');
                        setInventorySearch('');
                        setActiveMainTab('bestiary');
                      }}
                      className="px-4 py-2 rounded-xl bg-[#192b36] border border-[#c9aa72]/40 text-[#e5cb94] text-xs font-semibold cursor-pointer"
                    >
                      {lang === 'en' ? 'Hunt in Bestiary →' : 'Отправиться на охоту в Бестиарий →'}
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
                    {ownedInventoryItems.map((item) => {
                      const totalCount = inventory[item.id] || 0;
                      const inCrucible = crucibleSlots.filter((id) => id === item.id).length;
                      const remaining = totalCount - inCrucible;
                      const rarity = RARITY_META[item.rarity];

                      return (
                        <div
                          key={item.id}
                          onClick={() => remaining > 0 && handleAddReagentToCrucible(item.id)}
                          className={`group relative rounded-xl border p-3 transition-all flex flex-col justify-between cursor-pointer select-none bg-[#13222b] ${
                            rarity.border
                          } ${
                            remaining > 0
                              ? 'hover:border-[#d0ad77] hover:scale-[1.02] shadow-sm'
                              : 'opacity-40 cursor-not-allowed'
                          }`}
                        >
                          {/* Top Sprite & Quick Actions */}
                          <div className="flex items-start justify-between gap-1.5">
                            <div className="p-1 rounded-lg bg-[#0b141a] border border-[#203442]">
                              <CompositeItemSprite item={item} size="md" />
                            </div>

                            <div className="flex flex-col items-end gap-1">
                              <span className="px-1.5 py-0.5 rounded bg-[#0b141a] border border-[#203442] text-[11px] font-mono font-bold text-[#e5cb94]">
                                ×{remaining}
                              </span>

                              <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedJeiItemId(item.id);
                                    setJeiTab('uses');
                                  }}
                                  title="JEI"
                                  className="px-1.5 py-0.5 rounded bg-[#182935] hover:bg-[#22394a] text-[9px] font-mono text-[#d0ad77] border border-[#c9aa72]/30"
                                >
                                  JEI
                                </button>
                                {item.kind === 'crafted' && (
                                  <>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setHaggleItem(item);
                                      }}
                                      title={lang === 'en' ? 'Haggle with merchant' : 'Торговаться с NPC-скупщиком (Jev)'}
                                      className="p-1 rounded bg-[#182935] hover:bg-emerald-950 text-emerald-300 border border-[#203442]"
                                    >
                                      <Handshake className="w-3 h-3" />
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setInspectedItem(item);
                                      }}
                                      title={lang === 'en' ? 'Open 3D model & D&D Statblock' : 'Открыть 3D-модель и D&D Статблок'}
                                      className="p-1 rounded bg-[#182935] hover:bg-[#22394a] text-[#f0ece3] border border-[#203442]"
                                    >
                                      <Eye className="w-3 h-3" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Item Meta info */}
                          <div className="mt-2.5">
                            <div className="text-xs font-semibold text-[#f0ece3] line-clamp-1">
                              {getItemName(item)}
                            </div>
                            <div className="flex items-center justify-between mt-1 text-[10px] font-mono">
                              <span className={rarity.text}>
                                {getRarityLabel(item.rarity)}
                                {item.craftGeneration && item.craftGeneration >= 2
                                  ? ` • T${item.craftGeneration}`
                                  : ''}
                              </span>
                              {inCrucible > 0 && (
                                <span className="text-[#d0ad77] font-semibold">
                                  {lang === 'en' ? `(${inCrucible} in crucible)` : `(${inCrucible} в котле)`}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ===================================================== */}
          {/* SCREEN 2: CODEX FOLIO (КАТАЛОГ-ГРИМУАР ДАЛЬНЕГО КАМНЯ) */}
          {/* ===================================================== */}
          {activeMainTab === 'codex' && (
            <CodexFolioPanel
              itemsMap={itemsMap}
              discoveredItemIds={discoveredItemIds}
              inventory={inventory}
              recipes={recipes}
              monsters={allMonsters}
              selectedItemId={selectedJeiItemId}
              onSelectItemId={(id) => setSelectedJeiItemId(id)}
              onLoadRecipeToCrucible={handleLoadFullRecipeToCrucible}
              onAddReagentToCrucible={handleAddReagentToCrucible}
              onInspectItem={(it) => setInspectedItem(it)}
              onApplyBuffToHero={handleApplyBuffToHero}
              onJumpToMonster={(monsterId) => {
                sfx.playClick();
                setHighlightedMonsterId(monsterId);
                setActiveMainTab('bestiary');
              }}
            />
          )}

          {/* ===================================================== */}
          {/* SCREEN 3: BESTIARY & FAST HARVEST (БЕСТИАРИЙ)         */}
          {/* ===================================================== */}
          {activeMainTab === 'bestiary' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-[#c9aa72]/25 bg-[#101b22] p-4 flex flex-wrap items-center justify-between gap-3 shadow-xl">
                <div>
                  <h2 className="font-display font-bold text-base text-emerald-300">
                    {lang === 'en'
                      ? `«Guild World» Bestiary: Hunting & Harvesting (${activeHero.name})`
                      : `Бестиарий «Мира Гильдий»: Охота и разделка (${activeHero.name})`}
                  </h2>
                  <p className="text-xs text-[#8ca0ab]">
                    {lang === 'en'
                      ? `Select a creature and make a harvest check. You receive all trophies whose DC threshold is beaten!`
                      : `Выберите существо и совершите проверку. Вы получаете все трофеи, чей порог СЛ пробит!`}
                  </p>
                </div>
                <div className="text-xs font-mono text-[#f0ece3] bg-[#0c161d] px-3 py-1.5 rounded-xl border border-[#213543]">
                  {lang === 'en' ? 'Modifier' : 'Модификатор'} ({activeHero.name.split(' ')[0]}):{' '}
                  <strong className="text-emerald-400">
                    +{Math.max(proficiencyBonus, activeHero.harvestBonus) + (hasUpgrade('harvest_bonus_2') ? 2 : 0)}
                  </strong>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {allMonsters.map((monster) => {
                  const locked = alchemistLevel < monster.minAlchemistLevel;
                  const isHighlighted = highlightedMonsterId === monster.id;

                  return (
                    <div
                      key={monster.id}
                      className={`rounded-2xl border p-4 bg-[#101b22] transition-all flex flex-col justify-between gap-3 ${
                        isHighlighted
                          ? 'border-[#d0ad77] ring-2 ring-[#d0ad77]/50'
                          : 'border-[#c9aa72]/20 hover:border-[#c9aa72]/45'
                      } ${locked ? 'opacity-65' : ''}`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-3">
                            <div className="w-14 h-14 rounded-2xl bg-[#091117] border border-[#213543] flex items-center justify-center">
                              <CompositeMonsterSprite monster={monster} size="lg" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="font-display font-bold text-sm text-[#f0ece3]">
                                  {getMonsterName(monster)}
                                </h3>
                                <span className="px-2 py-0.5 rounded bg-[#0b141a] border border-[#213543] font-mono text-[10px] text-[#e5cb94]">
                                  {monster.crDisplay}
                                </span>
                              </div>
                              <p className="text-[11px] text-[#8ca0ab]">
                                {monster.creatureType} • {monster.biome}
                              </p>
                            </div>
                          </div>

                          <span className="px-2 py-0.5 rounded-lg bg-[#0b141a] border border-[#213543] font-mono text-[11px] text-sky-300 shrink-0">
                            -{monster.staminaCost} ⚡
                          </span>
                        </div>

                        <p className="text-xs text-[#c4d5dd] mt-2.5 leading-relaxed">
                          {monster.lore}
                        </p>

                        {/* Monster Anatomical Drops Table */}
                        <div className="mt-3 space-y-1.5">
                          <div className="text-[10px] font-mono uppercase text-[#8ca0ab]">
                            {lang === 'en' ? 'Anatomical Trophy Map (click — open in JEI):' : 'Анатомическая карта трофеев (клик — открыть в JEI):'}
                          </div>
                          {monster.drops.map((drop) => {
                            const dropItem = itemsMap[drop.itemId];
                            if (!dropItem) return null;
                            const rarity = RARITY_META[dropItem.rarity];
                            const ownedCount = inventory[dropItem.id] || 0;

                            return (
                              <div
                                key={drop.itemId}
                                onClick={() => {
                                  setSelectedJeiItemId(dropItem.id);
                                  setJeiTab('uses');
                                }}
                                className="rounded-xl bg-[#0b141a] hover:bg-[#13222c] border border-[#213543] px-2.5 py-1.5 flex items-center justify-between gap-2 cursor-pointer transition-colors"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <CompositeItemSprite item={dropItem} size="sm" />
                                  <span className={`text-xs font-medium truncate ${rarity.text}`}>
                                    {getItemName(dropItem)}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0 font-mono text-[10px]">
                                  {ownedCount > 0 && (
                                    <span className="px-1.5 py-0.2 rounded bg-[#162733] text-[#e5cb94] border border-[#233b4d]">
                                      ×{ownedCount}
                                    </span>
                                  )}
                                  <span className="px-1.5 py-0.5 rounded bg-[#091117] border border-[#213543] text-[#e5cb94]">
                                    {t('dcLabel')} {drop.dc}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleHarvestMonster(monster.id)}
                          disabled={locked || isRolling || stamina < monster.staminaCost}
                          className={`flex-1 py-2.5 px-3 rounded-xl font-display font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                            locked || stamina < monster.staminaCost
                              ? 'bg-[#0f171d] border border-[#1e2d36] text-[#556976] cursor-not-allowed'
                              : 'bg-[#152a22] hover:bg-[#1d3d31] border border-emerald-500/50 text-emerald-200'
                          }`}
                        >
                          <span className="text-base">🔪</span>
                          <span>
                            {locked
                              ? (lang === 'en' ? `Mastery Lv. ${monster.minAlchemistLevel}` : `Мастерство ${monster.minAlchemistLevel}`)
                              : isRolling
                              ? (lang === 'en' ? 'Harvesting...' : 'Разделка...')
                              : locked3dRoll !== null
                              ? (lang === 'en' ? `Apply 3D (${locked3dRoll}) -${monster.staminaCost}⚡` : `Применить 3D (${locked3dRoll}) -${monster.staminaCost}⚡`)
                              : tabletopRollMode
                              ? (lang === 'en' ? `Harvest (${manualD20Roll} • -${monster.staminaCost}⚡)` : `Разделать (${manualD20Roll} • -${monster.staminaCost}⚡)`)
                              : (lang === 'en' ? `Fast Harvest (-${monster.staminaCost}⚡)` : `Охота и разделка (-${monster.staminaCost}⚡)`)}
                          </span>
                        </button>

                        <button
                          type="button"
                          disabled={locked || isRolling || stamina < monster.staminaCost}
                          onClick={() => {
                            setD20ModalDc(monster.drops[0].dc);
                            setD20ModalModifier(Math.max(proficiencyBonus, activeHero.harvestBonus) + (hasUpgrade('harvest_bonus_2') ? 2 : 0));
                            setD20ModalTitle(lang === 'en' ? `3D Harvest: ${monster.nameEn}` : `3D Разделка: ${monster.name}`);
                            setD20ModalSubtitle(`${activeHero.name} • DC ${monster.drops[0].dc} (${monster.drops[0].tier})`);
                            setD20ModalActionLabel(lang === 'en' ? '🔪 Harvest Monster Now' : '🔪 Разделать монстра сейчас');
                            setD20ModalConfirmCallback(() => (rolled: number) => {
                              setLocked3dRoll(rolled);
                              handleHarvestMonster(monster.id, rolled);
                            });
                            setShowD20Modal(true);
                          }}
                          className={`px-3 py-2.5 rounded-xl border font-mono font-bold text-xs flex items-center justify-center gap-1 shadow-md cursor-pointer transition-all ${
                            locked3dRoll !== null
                              ? 'border-amber-400 bg-amber-950/80 text-amber-200 ring-1 ring-amber-400'
                              : 'border-emerald-500/50 bg-[#162732] hover:bg-[#203644] text-emerald-300'
                          }`}
                          title="3D d20"
                        >
                          <span>🎲</span>
                          <span className="hidden sm:inline">3D</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ===================================================== */}
          {/* SCREEN 3: GUILD BOUNTIES, CATALYST SHOP & UPGRADES    */}
          {/* ===================================================== */}
          {activeMainTab === 'guild' && (
            <div className="space-y-5">
              {/* 1. Guild Bounties */}
              <div className="rounded-2xl border border-[#c9aa72]/25 bg-[#101b22] p-5 space-y-3.5 shadow-xl">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#ffffff10] pb-3">
                  <div>
                    <h2 className="font-display font-bold text-base text-[#e5cb94]">
                      Поручения «Мира Гильдий» (Нарвеш, Ирвек, Бейрн и Дальний Камень — День {day})
                    </h2>
                    <p className="text-xs text-[#8ca0ab]">
                      Сдавайте подходящие по стихии и редкости артефакты союзникам и заказчикам кампании «Монстры»
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                  {bounties.map((bounty) => {
                    const matchingItems = findMatchingItemsForBounty(bounty);
                    return (
                      <div
                        key={bounty.id}
                        className={`rounded-2xl border p-4 flex flex-col justify-between gap-3 ${
                          bounty.completed
                            ? 'bg-[#091117]/60 border-[#1c2c36] opacity-60'
                            : 'bg-[#0e1820] border-[#c9aa72]/30'
                        }`}
                      >
                        <div className="space-y-2">
                          <div className="flex items-center gap-2.5">
                            <span className="text-2xl">{bounty.clientIcon}</span>
                            <div>
                              <div className="text-xs font-bold text-[#f0ece3]">
                                {bounty.clientName}
                              </div>
                              <div className="text-[10px] text-[#8ca0ab]">
                                {bounty.clientTitle}
                              </div>
                            </div>
                          </div>

                          <div className="font-display font-bold text-xs text-[#e5cb94]">
                            «{bounty.questTitle}»
                          </div>
                          <p className="text-xs text-[#c4d5dd] leading-relaxed">
                            {bounty.requestText}
                          </p>

                          <div className="flex flex-wrap gap-1.5 pt-1">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
                                RARITY_META[bounty.minRarity].bg
                              } ${RARITY_META[bounty.minRarity].border} ${
                                RARITY_META[bounty.minRarity].text
                              }`}
                            >
                              Мин: {RARITY_META[bounty.minRarity].label}
                            </span>
                            {bounty.requiredElement && (
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] border ${
                                  ELEMENT_META[bounty.requiredElement].bg
                                } ${ELEMENT_META[bounty.requiredElement].border} ${
                                  ELEMENT_META[bounty.requiredElement].color
                                }`}
                              >
                                {ELEMENT_META[bounty.requiredElement].label}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="pt-2 border-t border-[#ffffff10] space-y-2">
                          <div className="flex items-center justify-between text-xs font-mono">
                            <span className="text-[#e5cb94] font-bold">
                              +{bounty.rewardGold} gp
                            </span>
                            <span className="text-purple-300">+{bounty.rewardXp} XP</span>
                          </div>

                          {bounty.completed ? (
                            <div className="w-full py-2 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-center text-xs font-semibold">
                              ✓ Контракт выполнен
                            </div>
                          ) : matchingItems.length > 0 ? (
                            <button
                              onClick={() => handleFulfillBounty(bounty, matchingItems[0].id)}
                              className="w-full py-2 px-3 rounded-xl bg-[#d0ad77] hover:bg-[#e5cb94] text-[#121f28] font-bold text-xs transition-colors cursor-pointer"
                            >
                              Сдать «{matchingItems[0].name}»
                            </button>
                          ) : (
                            <div className="w-full py-2 px-2 rounded-xl bg-[#091117] border border-[#213543] text-[#556976] text-center text-[11px]">
                              Нет подходящего предмета в сумке
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 2. Catalyst Shop & Workshop Upgrades */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Shop Catalysts */}
                <div className="rounded-2xl border border-[#c9aa72]/25 bg-[#101b22] p-5 space-y-3 shadow-xl">
                  <h3 className="font-display font-bold text-sm text-[#e5cb94]">
                    Запасы Скрепа: Катализаторы и Заготовки
                  </h3>
                  <p className="text-xs text-[#8ca0ab]">
                    Стабильные основы повышают совместимость <code className="text-emerald-400">noul</code> и снижают взрывоопасность реакции
                  </p>
                  <div className="space-y-2">
                    {SHOP_CATALYST_IDS.map((id) => {
                      const item = itemsMap[id];
                      if (!item) return null;
                      return (
                        <div
                          key={id}
                          className="rounded-xl bg-stone-900/90 border border-stone-800 p-3 flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <CompositeItemSprite item={item} size="md" />
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-stone-100 truncate">
                                {item.name}
                              </div>
                              <div className="text-[11px] text-stone-400 line-clamp-1">
                                {item.description}
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => handleBuyCatalyst(id)}
                            className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-mono text-xs font-semibold shrink-0"
                          >
                            Купить ({item.goldValue} gp)
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Workshop Upgrades */}
                <div className="rounded-2xl border border-[#c9aa72]/25 bg-[#101b22] p-5 space-y-3 shadow-xl">
                  <h3 className="font-display font-bold text-sm text-[#e5cb94]">
                    Обустройство Бастиона «Дальний Камень»
                  </h3>
                  <p className="text-xs text-[#8ca0ab]">
                    Постоянные проекты развития мыса и мастерской партии «Монстры»
                  </p>
                  <div className="space-y-2">
                    {upgrades.map((upg) => (
                      <div
                        key={upg.id}
                        className="rounded-xl bg-[#0c161d] border border-[#213543] p-3 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-2xl">{upg.icon}</span>
                          <div>
                            <div className="text-xs font-semibold text-[#f0ece3]">
                              {upg.name}
                            </div>
                            <div className="text-[11px] text-[#8ca0ab]">
                              {upg.description}
                            </div>
                          </div>
                        </div>

                        {upg.purchased ? (
                          <span className="px-2.5 py-1 rounded-lg bg-emerald-950/50 border border-emerald-500/40 text-emerald-300 font-mono text-[11px] shrink-0">
                            ✓ Построено
                          </span>
                        ) : (
                          <button
                            onClick={() => handleBuyUpgrade(upg.id)}
                            className="px-3 py-1.5 rounded-xl bg-[#1c2e39] hover:bg-[#253e4d] border border-[#c9aa72]/40 text-[#e5cb94] font-mono text-xs font-semibold shrink-0 cursor-pointer"
                          >
                            {upg.costGold} gp
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ===================================================== */}
          {/* SCREEN 4: HERO DOLL & AUTO-RAID DUNGEON SIMULATOR     */}
          {/* ===================================================== */}
          {activeMainTab === 'hero_raid' && (
            <HeroRaidPanel
              alchemistLevel={alchemistLevel}
              proficiencyBonus={proficiencyBonus}
              stamina={stamina}
              itemsCatalog={itemsMap}
              inventory={inventory}
              loadout={heroLoadout}
              monsters={allMonsters}
              activeHeroId={activeHeroId}
              activeBuffs={activeBuffs}
              heroHpMap={heroHpMap}
              heroWoundsMap={heroWoundsMap}
              useLiveApi={useLiveJev}
              apiKey={customApiKey || undefined}
              onSelectHero={(hId) => setActiveHeroId(hId)}
              onBattleFinished={handleConsumeBuffFight}
              onHealHeroWithGold={(hId, costGold) => {
                if (gold < costGold) {
                  showToast(
                    lang === 'en'
                      ? `Not enough gold (${costGold} gp needed)!`
                      : `Не хватает золота (нужно ${costGold} зм)!`
                  );
                  return;
                }
                const hero = GUILD_WORLD_HEROES.find((h) => h.id === hId) || activeHero;
                setGold((prev) => Math.max(0, prev - costGold));
                setHeroHpMap((prev) => ({
                  ...prev,
                  [hId]: hero.baseHp,
                }));
                setHeroWoundsMap((prev) => ({
                  ...prev,
                  [hId]: 0,
                }));
                sfx.playSuccess();
                showToast(
                  lang === 'en'
                    ? `${hero.name} fully restored (${hero.baseHp} HP) and cured of battle wounds!`
                    : `${hero.name} полностью исцелен (${hero.baseHp} HP) и вылечен от ранений!`
                );
              }}
              onEquipSlot={(slot: HeroSlotType, itemId: string | undefined) => {
                setHeroLoadout((prev) => ({
                  ...prev,
                  [slot]: itemId,
                }));
                if (itemId && itemsMap[itemId]) {
                  showToast(`Экипировано на ${activeHero.name}: ${itemsMap[itemId].name}`);
                }
              }}
              onInspectItem={(it) => setInspectedItem(it)}
              onCompleteRaid={({ victory, monster, lootItemIds, goldEarned, xpEarned, staminaSpent, heroHpLeft, woundAdded }) => {
                setStamina((prev) => Math.max(0, prev - staminaSpent));
                setGold((prev) => prev + goldEarned);
                setXp((prev) => prev + xpEarned);
                if (typeof heroHpLeft === 'number') {
                  setHeroHpMap((prev) => ({
                    ...prev,
                    [activeHero.id]: heroHpLeft,
                  }));
                }
                if (woundAdded) {
                  setHeroWoundsMap((prev) => ({
                    ...prev,
                    [activeHero.id]: (prev[activeHero.id] || 0) + 1,
                  }));
                }
                setInventory((prev) => {
                  const next = { ...prev };
                  lootItemIds.forEach((id) => {
                    next[id] = (next[id] || 0) + 1;
                  });
                  return next;
                });
                markDiscovered(lootItemIds);
                showToast(
                  victory
                    ? `🏆 ${activeHero.name} победил «${monster.name}»! +${lootItemIds.length} трофея, +${goldEarned} gp!`
                    : `💀 ${activeHero.name} потерпел поражение от «${monster.name}»! Получено ранение.`
                );
              }}
            />
          )}
        </div>

        {/* RIGHT SIDEBAR: ALWAYS-ON JEI GRIMOIRE CODEX (4 cols) */}
        <div className="lg:col-span-4 h-[520px] lg:h-[calc(100vh-92px)] lg:sticky lg:top-[76px]">
          <JeiCodexSidebar
            itemsMap={itemsMap}
            discoveredItemIds={discoveredItemIds}
            inventory={inventory}
            recipes={recipes}
            monsters={allMonsters}
            selectedJeiItemId={selectedJeiItemId}
            jeiTab={jeiTab}
            onSelectJeiItem={(id, tab) => {
              sfx.playClick();
              setSelectedJeiItemId(id);
              if (tab) setJeiTab(tab);
            }}
            onAddReagentToCrucible={handleAddReagentToCrucible}
            onLoadFullRecipeToCrucible={handleLoadFullRecipeToCrucible}
            onJumpToMonster={(monsterId) => {
              sfx.playClick();
              setHighlightedMonsterId(monsterId);
              setActiveMainTab('bestiary');
            }}
            onBuyCatalyst={handleBuyCatalyst}
            onInspectStatblock={(item) => setInspectedItem(item)}
            onOpenFullCodex={() => setActiveMainTab('codex')}
          />
        </div>
      </main>

      {/* D&D 5e ITEM STATBLOCK MODAL (with 3D Turntable + PNG/Foundry Export) */}
      <ItemStatblockModal
        item={inspectedItem}
        inventoryCount={inspectedItem ? inventory[inspectedItem.id] || 0 : 0}
        onClose={() => setInspectedItem(null)}
        onSellItem={handleSellItem}
        onAddToCrucible={(it) => {
          setActiveMainTab('crucible');
          handleAddReagentToCrucible(it.id);
        }}
        onEquipItem={(it) => {
          const slot = getHeroSlotForItem(it);
          if (slot) {
            setHeroLoadout((prev) => ({ ...prev, [slot]: it.id }));
            setActiveMainTab('hero_raid');
            showToast(`Экипировано в слот (${activeHero.name}): ${it.name}`);
          }
        }}
        onOpenHaggle={(it) => {
          setInspectedItem(null);
          setHaggleItem(it);
        }}
        onApplyBuff={handleApplyBuffToHero}
      />

      {/* NPC COLLECTOR HAGGLE MODAL (Jev System-1 Negotiation) */}
      <MerchantHaggleModal
        item={haggleItem}
        inventoryCount={haggleItem ? inventory[haggleItem.id] || 0 : 0}
        proficiencyBonus={proficiencyBonus}
        useLiveJev={useLiveJev}
        apiKey={customApiKey}
        tabletopRollMode={tabletopRollMode}
        onClose={() => setHaggleItem(null)}
        onCompleteSale={(itemId, finalGold, xpBonus) => {
          const sold = itemsMap[itemId];
          setInventory((prev) => ({
            ...prev,
            [itemId]: Math.max(0, (prev[itemId] || 0) - 1),
          }));
          setGold((prev) => prev + finalGold);
          setXp((prev) => prev + xpBonus);
          showToast(
            `Сделка заключена! Продано «${sold?.name || itemId}» за +${finalGold} gp (+${xpBonus} XP)!`
          );
        }}
      />

      {/* DM MASTER MODE MODAL (Grant Campaign Trophies & Custom Monster Creator) */}
      <DmMasterModal
        isOpen={showDmModal}
        onClose={() => setShowDmModal(false)}
        monsters={allMonsters}
        itemsMap={itemsMap}
        inventory={inventory}
        gold={gold}
        onGrantItems={(itemIds, countEach = 1) => {
          setInventory((prev) => {
            const next = { ...prev };
            itemIds.forEach((id) => {
              next[id] = (next[id] || 0) + countEach;
            });
            return next;
          });
          markDiscovered(itemIds);
          const names = itemIds.map((id) => itemsMap[id]?.name || id).join(', ');
          showToast(`🎁 ГМ выдал партии: ${names}`);
        }}
        onGrantGold={(amount) => {
          setGold((prev) => prev + amount);
          showToast(`🪙 ГМ пополнил казну Дальнего Камня: +${amount} gp!`);
        }}
        onRestoreStamina={() => {
          setStamina(maxStamina);
          showToast(`⚡ ГМ полностью восстановил энергию партии (${maxStamina}⚡)!`);
        }}
        onCreateCustomMonster={(newMonster, newItems, grantImmediately) => {
          setItemsMap((prev) => {
            const next = { ...prev };
            newItems.forEach((it) => {
              next[it.id] = it;
            });
            return next;
          });
          setCustomMonsters((prev) => [newMonster, ...prev]);
          markDiscovered(newItems.map((i) => i.id));
          if (grantImmediately) {
            setInventory((prev) => {
              const next = { ...prev };
              newItems.forEach((it) => {
                next[it.id] = (next[it.id] || 0) + 1;
              });
              return next;
            });
          }
          showToast(
            `👑 Создан босс «${newMonster.name}» и 3 трофея${
              grantImmediately ? ' (выданы в сумку!)' : ''
            }!`
          );
        }}
        onExportCampaignJson={() =>
          JSON.stringify(
            {
              itemsMap,
              inventory,
              discoveredItemIds,
              recipes,
              heroLoadout,
              activeHeroId,
              customMonsters,
              day,
              xp,
              gold,
              stamina,
              upgrades,
              bounties,
            },
            null,
            2
          )
        }
        onImportCampaignJson={(rawJson) => {
          try {
            const parsed = JSON.parse(rawJson);
            if (parsed.itemsMap) setItemsMap({ ...INITIAL_ITEMS, ...parsed.itemsMap });
            if (parsed.inventory) setInventory(parsed.inventory);
            if (parsed.discoveredItemIds) setDiscoveredItemIds(parsed.discoveredItemIds);
            if (parsed.recipes) setRecipes(parsed.recipes);
            if (parsed.heroLoadout) setHeroLoadout(parsed.heroLoadout);
            if (parsed.activeHeroId) setActiveHeroId(parsed.activeHeroId);
            if (Array.isArray(parsed.customMonsters)) setCustomMonsters(parsed.customMonsters);
            if (typeof parsed.day === 'number') setDay(parsed.day);
            if (typeof parsed.xp === 'number') setXp(parsed.xp);
            if (typeof parsed.gold === 'number') setGold(parsed.gold);
            if (typeof parsed.stamina === 'number') setStamina(parsed.stamina);
            if (parsed.upgrades) setUpgrades(parsed.upgrades);
            if (parsed.bounties) setBounties(parsed.bounties);
            showToast('✓ Состояние партии Дальнего Камня синхронизировано!');
            return true;
          } catch {
            return false;
          }
        }}
      />

      {/* TYPESAFE AI JEV SDK CONFIGURATION MODAL */}
      {showApiKeyModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
          onClick={() => setShowApiKeyModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-amber-500/40 bg-[#14111d] p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu className="w-5 h-5 text-amber-400" />
                <h3 className="font-display font-bold text-base text-amber-200">
                  Настройка TypeSafe AI (Jev System-1)
                </h3>
              </div>
              <button
                onClick={() => setShowApiKeyModal(false)}
                className="text-stone-400 hover:text-stone-200 text-xs font-mono"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-stone-300 leading-relaxed">
              Серверный роут <code className="text-amber-300">/api/jev/decide</code> вызывает официальный пакет{' '}
              <code className="text-amber-300">@typesafe-ai/sdk</code> (<code className="text-violet-300">client.systemOne</code>) с примитивами{' '}
              <code>choice</code>, <code>score</code> и <code>noul</code>. Если API-ключ не задан, автоматически работает калиброванный локальный NAR-движок с теми же распределениями вероятностей.
            </p>

            <div className="space-y-2">
              <label className="block text-xs font-mono text-stone-400">
                TYPESAFE_API_KEY (опционально, либо через .env):
              </label>
              <input
                type="password"
                value={customApiKey}
                onChange={(e) => setCustomApiKey(e.target.value)}
                placeholder="ts_live_..."
                className="w-full px-3 py-2 rounded-xl bg-stone-950 border border-stone-800 text-xs font-mono text-stone-100 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <label className="flex items-center gap-2 text-xs text-stone-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useLiveJev}
                  onChange={(e) => setUseLiveJev(e.target.checked)}
                  className="rounded accent-amber-500"
                />
                <span>Использовать Live API при наличии ключа</span>
              </label>

              <button
                onClick={() => {
                  setShowApiKeyModal(false);
                  showToast('Настройки Jev Decision Engine сохранены!');
                }}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs"
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3D THREE.JS D20 DICE ROLL MODAL */}
      <D20DiceModal
        isOpen={showD20Modal}
        onClose={() => {
          setShowD20Modal(false);
          setD20ModalConfirmCallback(null);
        }}
        targetResult={d20ModalTargetResult}
        modifier={d20ModalModifier}
        dc={d20ModalDc}
        title={d20ModalTitle}
        subtitle={d20ModalSubtitle}
        actionLabel={d20ModalActionLabel}
        onRollComplete={(rolledVal) => {
          setManualD20Roll(rolledVal);
          setLocked3dRoll(rolledVal);
        }}
        onConfirmAction={(rolledVal) => {
          setManualD20Roll(rolledVal);
          setLocked3dRoll(rolledVal);
          if (d20ModalConfirmCallback) {
            d20ModalConfirmCallback(rolledVal);
          }
        }}
      />

      {/* SKREP'S SLAG ALEMBIC & HERITAGE RELIC FUSION MODAL */}
      <SlagAlembicModal
        isOpen={showAlembicModal}
        onClose={() => setShowAlembicModal(false)}
        inventory={inventory}
        itemsMap={itemsMap}
        gold={gold}
        onDistillSlag={handleDistillSlag}
        onFuseRelics={handleFuseRelics}
      />

      {/* ACCESS CONTROL & FOUNDRY GATEKEEPER MODAL */}
      <AccessGateModal
        isOpen={showAccessGateModal}
        onClose={() => setShowAccessGateModal(false)}
        session={authSession}
        authConfig={authConfig}
        onUpdateSession={(sess) => {
          setAuthSession(sess);
          if (sess?.authenticatedHeroId) {
            setActiveHeroId(sess.authenticatedHeroId);
          }
        }}
        onUpdateConfig={(cfg) => setAuthConfig(cfg)}
        onSelectHero={(heroId) => setActiveHeroId(heroId)}
      />
    </div>
  );
}
export default App;
