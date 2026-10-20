import React, { useEffect, useMemo, useState } from 'react';
import {
  Award,
  Compass,
  Cpu,
  Dices,
  Eye,
  Flame,
  Hammer,
  KeyRound,
  Moon,
  RotateCcw,
  ShieldAlert,
  ShoppingBag,
  Sparkles,
  Trash2,
  Volume2,
  VolumeX,
  Wand2,
  Zap,
} from 'lucide-react';
import {
  CraftingStation,
  GameItem,
  GuildBounty,
  JevDecisionTelemetry,
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
import {
  assembleCraftedItem,
  evaluateCrucibleWithJev,
  makeRecipeKey,
} from './engine/jevEngine';
import { JevTelemetryPanel } from './components/JevTelemetryPanel';
import { JeiCodexSidebar } from './components/JeiCodexSidebar';
import { ItemStatblockModal } from './components/ItemStatblockModal';
import { CompositeItemSprite, CompositeMonsterSprite } from './components/CompositeItemSprite';
import { sfx } from './utils/sound';

const STORAGE_KEY = 'dnd_jev_alchemist_save_v1';

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
  // === CORE GAME STATE ===
  const [activeMainTab, setActiveMainTab] = useState<'crucible' | 'bestiary' | 'guild'>('crucible');
  const [station, setStation] = useState<CraftingStation>('alchemist');

  const [itemsMap, setItemsMap] = useState<Record<string, GameItem>>(() => ({
    ...INITIAL_ITEMS,
  }));

  const [inventory, setInventory] = useState<Record<string, number>>({
    cube_acid_ooze: 3,
    mimic_toothed_splinter: 2,
    displacer_shimmer_hide: 2,
    manticore_tail_spike: 2,
    basilisk_stone_scale: 2,
    catalyst_crystal_vial: 3,
    catalyst_mithral_ingot: 2,
    catalyst_silver_ring: 1,
  });

  const [discoveredItemIds, setDiscoveredItemIds] = useState<string[]>([
    'cube_acid_ooze',
    'mimic_toothed_splinter',
    'displacer_shimmer_hide',
    'manticore_tail_spike',
    'basilisk_stone_scale',
    'catalyst_crystal_vial',
    'catalyst_mithral_ingot',
    'catalyst_silver_ring',
  ]);

  const [recipes, setRecipes] = useState<Record<string, RecipeRecord>>({});
  const [crucibleSlots, setCrucibleSlots] = useState<string[]>([]);

  // === PROGRESSION: MASTERY, STAMINA, GOLD ===
  const [day, setDay] = useState<number>(1);
  const [xp, setXp] = useState<number>(0);
  const [gold, setGold] = useState<number>(180);
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
  const [selectedJeiItemId, setSelectedJeiItemId] = useState<string | null>('cube_acid_ooze');
  const [jeiTab, setJeiTab] = useState<'recipe' | 'uses'>('recipe');
  const [inspectedItem, setInspectedItem] = useState<GameItem | null>(null);
  const [highlightedMonsterId, setHighlightedMonsterId] = useState<string | null>(null);
  const [lastRoll, setLastRoll] = useState<RollResultState | null>(null);
  const [isRolling, setIsRolling] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Load saved state on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.itemsMap) setItemsMap({ ...INITIAL_ITEMS, ...parsed.itemsMap });
        if (parsed.inventory) setInventory(parsed.inventory);
        if (parsed.discoveredItemIds) setDiscoveredItemIds(parsed.discoveredItemIds);
        if (parsed.recipes) setRecipes(parsed.recipes);
        if (typeof parsed.day === 'number') setDay(parsed.day);
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
          day,
          xp,
          gold,
          stamina,
          upgrades,
          bounties,
          customApiKey,
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
    day,
    xp,
    gold,
    stamina,
    upgrades,
    bounties,
    customApiKey,
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
    return 1 + alchemistLevel; // +2 at lvl 1 -> +6 at lvl 5
  }, [alchemistLevel]);

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

  const effectiveDc = useMemo(() => {
    if (!telemetry) return 12;
    return Math.max(
      6,
      telemetry.calculatedDc - knownRecipeBonus - upgradeDcReduction
    );
  }, [telemetry, knownRecipeBonus, upgradeDcReduction]);

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
    }).then((res) => {
      if (!cancelled) {
        setTelemetry(res);
        setIsEvaluating(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [crucibleSlots, station, useLiveJev, customApiKey]);

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
  const handleSynthesize = () => {
    if (crucibleItems.length < 2 || !telemetry || isRolling) return;
    sfx.playDiceRoll();
    setIsRolling(true);

    setTimeout(() => {
      const r1 = Math.floor(Math.random() * 20) + 1;
      const r2 = Math.floor(Math.random() * 20) + 1;
      const d20Raw = isExhausted ? Math.min(r1, r2) : r1;
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
          d20Second: isExhausted ? Math.max(r1, r2) : undefined,
          proficiencyBonus,
          extraBonus: 0,
          total,
          dc: effectiveDc,
          outcome: 'slag',
          title: '💥 Реакция сорвалась в шлак!',
          subtitle: salvagedItem
            ? `Контур возврата спас реагент «${salvagedItem.name}»! Получен Алхимический шлак.`
            : 'Нестабильность оказалась выше броска. Получен Нестабильный алхимический шлак.',
          createdItem: itemsMap.alchemical_slag,
        });
        setIsRolling(false);
        return;
      }

      // Assemble the crafted D&D item
      const crafted = assembleCraftedItem(station, crucibleItems, telemetry, outcome);
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
      const gainedXp = isFirst ? rarityXp : Math.round(rarityXp * 0.35);
      setXp((prev) => prev + gainedXp);

      setSelectedJeiItemId(crafted.id);
      setJeiTab('recipe');

      setLastRoll({
        context: 'craft',
        d20Raw,
        d20Second: isExhausted ? Math.max(r1, r2) : undefined,
        proficiencyBonus,
        extraBonus: 0,
        total,
        dc: effectiveDc,
        outcome,
        title:
          outcome === 'masterwork'
            ? '🌟 КРИТИЧЕСКИЙ СИНТЕЗ: ШЕДЕВР!'
            : outcome === 'cursed'
            ? '🩸 СИНТЕЗ С ПРОКЛЯТИЕМ!'
            : '✨ УСПЕШНЫЙ СИНТЕЗ АРТЕФАКТА!',
        subtitle: `${crafted.name} (+${gainedXp} XP${isFirst ? ' • ПЕРВООТКРЫТИЕ В ГРИМУАРЕ!' : ''})`,
        createdItem: crafted,
        isFirstDiscovery: isFirst,
      });

      setIsRolling(false);
    }, 320);
  };

  // === FAST HARVEST IN BESTIARY ===
  const handleHarvestMonster = (monsterId: string) => {
    const monster = MONSTERS.find((m) => m.id === monsterId);
    if (!monster || isRolling) return;

    if (alchemistLevel < monster.minAlchemistLevel) {
      showToast(`Требуется Уровень Мастерства ${monster.minAlchemistLevel} для охоты на ${monster.name}!`);
      return;
    }

    sfx.playDiceRoll();
    setIsRolling(true);

    setTimeout(() => {
      const r1 = Math.floor(Math.random() * 20) + 1;
      const r2 = Math.floor(Math.random() * 20) + 1;
      const d20Raw = isExhausted ? Math.min(r1, r2) : r1;
      const scalpelBonus = hasUpgrade('harvest_bonus_2') ? 2 : 0;
      const total = d20Raw + proficiencyBonus + scalpelBonus;

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

      // Even on low roll (unless Nat 1), give at least the common drop if within 2 points
      if (harvested.length === 0 && d20Raw !== 1) {
        const commonItem = itemsMap[monster.drops[0].itemId];
        if (commonItem) harvested.push(commonItem);
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
          d20Second: isExhausted ? Math.max(r1, r2) : undefined,
          proficiencyBonus,
          extraBonus: scalpelBonus,
          total,
          dc: monster.drops[1].dc,
          outcome: 'harvest_success',
          title: `🐉 Разделка: ${monster.name}`,
          subtitle: `Добыто трофеев: ${harvested.map((h) => h.name).join(', ')}`,
          harvestedItems: harvested,
        });
      } else {
        sfx.playFail();
        setLastRoll({
          context: 'harvest',
          d20Raw,
          d20Second: isExhausted ? Math.max(r1, r2) : undefined,
          proficiencyBonus,
          extraBonus: scalpelBonus,
          total,
          dc: monster.drops[0].dc,
          outcome: 'harvest_fail',
          title: `💥 Критический провал охоты (Nat 1)!`,
          subtitle: `${monster.name} ранил вас при отступлении. Трофеи испорчены.`,
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
    showToast(`День ${nextDay}: силы полностью восстановлены (${maxStamina}⚡), заказы Гильдии обновлены!`);
  };

  const handleBuyCatalyst = (itemId: string) => {
    const item = itemsMap[itemId];
    if (!item) return;
    if (gold < item.goldValue) {
      showToast(`Не хватает золота (${item.goldValue} gp)! Продайте артефакты или выполните заказ.`);
      return;
    }
    sfx.playCoin();
    setGold((prev) => prev - item.goldValue);
    setInventory((prev) => ({
      ...prev,
      [itemId]: (prev[itemId] || 0) + 1,
    }));
    markDiscovered([itemId]);
    showToast(`Куплено: ${item.name} (-${item.goldValue} gp)`);
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
    setGold((prev) => prev + bounty.rewardGold);
    setXp((prev) => prev + bounty.rewardXp);
    setBounties((prev) =>
      prev.map((b) => (b.id === bounty.id ? { ...b, completed: true } : b))
    );
    showToast(
      `Заказ выполнен! Получено +${bounty.rewardGold} gp и +${bounty.rewardXp} XP!`
    );
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
      .sort((a, b) => {
        if (a.kind !== b.kind) {
          const order = { crafted: 0, reagent: 1, catalyst: 2, slag: 3 };
          return order[a.kind] - order[b.kind];
        }
        return RARITY_META[b.rarity].rank - RARITY_META[a.rarity].rank;
      });
  }, [inventory, itemsMap]);

  return (
    <div className="min-h-screen flex flex-col bg-[#0b0a0e] text-stone-100">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 px-4 py-2.5 rounded-xl bg-amber-500/95 text-stone-950 font-semibold text-xs shadow-2xl border border-amber-300 flex items-center gap-2 animate-bounce">
          <Sparkles className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* TOP HUD NAVBAR */}
      <header className="sticky top-0 z-30 border-b border-stone-800/90 bg-[#0e0c14]/95 backdrop-blur-md px-4 py-2.5">
        <div className="max-w-[1600px] mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Brand Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/30 to-purple-600/30 border border-amber-500/50 flex items-center justify-center text-xl shadow-inner">
              ⚗️
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display font-bold text-base sm:text-lg tracking-wide text-amber-200">
                  CODEX JEV: ALCHEMIST OF THE REALMS
                </h1>
                <span className="hidden md:inline-flex px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono text-[10px]">
                  D&D 5e × JEI × TypeSafe Jev
                </span>
              </div>
              <p className="text-[11px] text-stone-400">
                День {day} • Система не-авторегрессионного крафта и анатомии чудовищ
              </p>
            </div>
          </div>

          {/* Progression Pillars: Mastery, Stamina, Gold */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* 1. Mastery Level */}
            <div className="rounded-xl bg-stone-900/90 border border-stone-800 px-3 py-1.5 flex items-center gap-2.5">
              <Award className="w-4 h-4 text-amber-400 shrink-0" />
              <div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-semibold text-stone-100">
                    Ур. {alchemistLevel}
                  </span>
                  <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-mono text-[10px] font-bold">
                    Бонус +{proficiencyBonus}
                  </span>
                </div>
                <div className="w-24 h-1.5 rounded-full bg-stone-800 mt-1 overflow-hidden">
                  <div
                    className="h-full bg-amber-400 transition-all"
                    style={{
                      width: `${Math.min(100, Math.round((xp / nextLevelXp) * 100))}%`,
                    }}
                  />
                </div>
              </div>
              <span className="text-[10px] font-mono text-stone-400">
                {xp}/{nextLevelXp} XP
              </span>
            </div>

            {/* 2. Stamina & Exhaustion */}
            <div
              className={`rounded-xl border px-3 py-1.5 flex items-center gap-2.5 ${
                isExhausted
                  ? 'bg-rose-950/50 border-rose-500/60'
                  : 'bg-stone-900/90 border-stone-800'
              }`}
            >
              <Zap
                className={`w-4 h-4 shrink-0 ${
                  isExhausted ? 'text-rose-400 animate-pulse' : 'text-sky-400'
                }`}
              />
              <div>
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="font-mono font-bold text-stone-100">
                    {stamina}/{maxStamina} ⚡
                  </span>
                  {isExhausted && (
                    <span className="text-[10px] font-mono text-rose-300 font-semibold">
                      ИСТОЩЕНИЕ (Помеха d20)
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-stone-400">Энергия дня</div>
              </div>
              <button
                onClick={handleLongRest}
                title="Долгий отдых в Таверне (восстанавливает энергию и обновляет заказы Гильдии)"
                className="ml-1 px-2.5 py-1 rounded-lg bg-indigo-500/25 hover:bg-indigo-500/35 border border-indigo-400/40 text-indigo-200 text-[11px] font-medium flex items-center gap-1 transition-colors"
              >
                <Moon className="w-3 h-3" />
                <span>Отдых (20 gp)</span>
              </button>
            </div>

            {/* 3. Gold Coins */}
            <div className="rounded-xl bg-amber-950/35 border border-amber-500/40 px-3 py-1.5 flex items-center gap-2">
              <span className="text-base">🪙</span>
              <div>
                <div className="font-mono font-bold text-xs text-amber-300">
                  {gold} gp
                </div>
                <div className="text-[10px] text-amber-200/70">Золото</div>
              </div>
            </div>

            {/* Jev Engine Settings & Audio */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setShowApiKeyModal(true)}
                className="px-2.5 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 border border-stone-700 text-xs font-mono text-stone-300 flex items-center gap-1.5"
                title="Настроить ключ TypeSafe AI Jev SDK"
              >
                <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden xl:inline">Jev SDK</span>
              </button>

              <button
                onClick={() => {
                  const next = !soundEnabled;
                  setSoundEnabled(next);
                  sfx.enabled = next;
                }}
                className="p-2 rounded-xl bg-stone-900 hover:bg-stone-800 border border-stone-800 text-stone-300"
                title="Звуковые эффекты"
              >
                {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>

              <button
                onClick={handleResetSave}
                className="p-2 rounded-xl bg-stone-900 hover:bg-rose-950/60 border border-stone-800 text-stone-400 hover:text-rose-300"
                title="Сбросить сохранение"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT GRID: Left/Center Workspace + Right JEI Codex Sidebar */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto p-4 grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* LEFT & CENTER WORKSPACE (8 cols) */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          {/* Navigation Bar between the 3 Core Screens */}
          <div className="grid grid-cols-3 gap-2 p-1.5 rounded-2xl bg-[#121018] border border-stone-800/90">
            <button
              onClick={() => {
                sfx.playClick();
                setActiveMainTab('crucible');
              }}
              className={`py-2.5 px-3 rounded-xl font-display font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all ${
                activeMainTab === 'crucible'
                  ? 'bg-gradient-to-r from-amber-500/25 to-purple-500/20 text-amber-200 border border-amber-500/50 shadow-lg'
                  : 'text-stone-400 hover:text-stone-200 hover:bg-stone-900/60'
              }`}
            >
              <Flame className="w-4 h-4 text-amber-400" />
              <span>1. Алхимический Стол</span>
            </button>

            <button
              onClick={() => {
                sfx.playClick();
                setActiveMainTab('bestiary');
              }}
              className={`py-2.5 px-3 rounded-xl font-display font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all ${
                activeMainTab === 'bestiary'
                  ? 'bg-gradient-to-r from-emerald-500/25 to-teal-500/20 text-emerald-200 border border-emerald-500/50 shadow-lg'
                  : 'text-stone-400 hover:text-stone-200 hover:bg-stone-900/60'
              }`}
            >
              <Compass className="w-4 h-4 text-emerald-400" />
              <span>2. Бестиарий (Harvest)</span>
            </button>

            <button
              onClick={() => {
                sfx.playClick();
                setActiveMainTab('guild');
              }}
              className={`py-2.5 px-3 rounded-xl font-display font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all ${
                activeMainTab === 'guild'
                  ? 'bg-gradient-to-r from-amber-500/25 to-yellow-500/20 text-amber-200 border border-amber-500/50 shadow-lg'
                  : 'text-stone-400 hover:text-stone-200 hover:bg-stone-900/60'
              }`}
            >
              <ShoppingBag className="w-4 h-4 text-amber-400" />
              <span>
                3. Гильдия и Лавка ({bounties.filter((b) => !b.completed).length})
              </span>
            </button>
          </div>

          {/* LAST ROLL BANNER (d20 feedback) */}
          {lastRoll && (
            <div
              className={`rounded-2xl border p-4 flex flex-wrap items-center justify-between gap-4 transition-all ${
                lastRoll.outcome === 'masterwork'
                  ? 'bg-amber-950/40 border-amber-400/70 shadow-[0_0_25px_rgba(251,191,36,0.2)]'
                  : lastRoll.outcome === 'slag' || lastRoll.outcome === 'harvest_fail'
                  ? 'bg-rose-950/35 border-rose-500/50'
                  : lastRoll.outcome === 'cursed'
                  ? 'bg-purple-950/40 border-purple-500/60'
                  : 'bg-emerald-950/35 border-emerald-500/50'
              }`}
            >
              <div className="flex items-center gap-3.5">
                <div className="w-14 h-14 rounded-2xl bg-stone-950/90 border border-stone-700 flex flex-col items-center justify-center shrink-0">
                  <span className="text-[10px] font-mono text-stone-400">d20 итог</span>
                  <span className="font-mono font-extrabold text-xl text-amber-300">
                    {lastRoll.total}
                  </span>
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-display font-bold text-sm text-stone-100">
                      {lastRoll.title}
                    </h3>
                    <span className="px-2 py-0.5 rounded bg-stone-900/90 border border-stone-700 font-mono text-[11px] text-stone-300">
                      Кубик: {lastRoll.d20Raw}
                      {lastRoll.d20Second !== undefined
                        ? ` (помеха из ${lastRoll.d20Raw}, ${lastRoll.d20Second})`
                        : ''}{' '}
                      + Мастерство {lastRoll.proficiencyBonus}
                      {lastRoll.extraBonus > 0 ? ` + Бонус ${lastRoll.extraBonus}` : ''} ={' '}
                      {lastRoll.total} (против СЛ {lastRoll.dc})
                    </span>
                  </div>
                  <p className="text-xs text-stone-300 mt-1">{lastRoll.subtitle}</p>
                </div>
              </div>

              {lastRoll.createdItem && lastRoll.createdItem.kind === 'crafted' && (
                <button
                  onClick={() => setInspectedItem(lastRoll.createdItem!)}
                  className="px-3.5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-amber-200 text-xs font-semibold flex items-center gap-1.5"
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
              <div className="rounded-2xl border border-stone-800 bg-[#13111c]/95 p-5 shadow-xl space-y-5">
                {/* Station Mode Selector */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display font-bold text-base text-amber-200">
                      Рабочий станок синтеза
                    </h2>
                    <p className="text-xs text-stone-400">
                      Выбор станка задает матрицу архетипов <code className="text-amber-300">choice(itemArchetype)</code> для модели Jev
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {[
                      {
                        id: 'alchemist',
                        label: 'Алхимия',
                        sub: 'Зелья, Яды, Мутагены',
                        icon: <Flame className="w-4 h-4 text-emerald-400" />,
                      },
                      {
                        id: 'blacksmith',
                        label: 'Кузня',
                        sub: 'Клинки, Молоты, Латы',
                        icon: <Hammer className="w-4 h-4 text-orange-400" />,
                      },
                      {
                        id: 'artificer',
                        label: 'Артефакторика',
                        sub: 'Кольца, Жезлы, Мантии',
                        icon: <Wand2 className="w-4 h-4 text-purple-400" />,
                      },
                    ].map((st) => (
                      <button
                        key={st.id}
                        onClick={() => {
                          sfx.playClick();
                          setStation(st.id as CraftingStation);
                        }}
                        className={`px-3.5 py-2 rounded-xl border text-left transition-all flex items-center gap-2.5 ${
                          station === st.id
                            ? 'bg-amber-500/20 border-amber-500/60 text-stone-100 shadow-md'
                            : 'bg-stone-900/80 border-stone-800 text-stone-400 hover:text-stone-200'
                        }`}
                      >
                        {st.icon}
                        <div>
                          <div className="text-xs font-bold leading-none">{st.label}</div>
                          <div className="text-[10px] text-stone-400 mt-0.5 hidden sm:block">
                            {st.sub}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Crucible Slots Area */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                  {/* Reagent Slots (7 cols) */}
                  <div className="md:col-span-7 flex items-center justify-center gap-3 py-4 px-3 rounded-2xl bg-stone-950/80 border border-stone-800/90 relative overflow-hidden">
                    {Array.from({ length: maxCrucibleSlots }).map((_, idx) => {
                      const itemId = crucibleSlots[idx];
                      const item = itemId ? itemsMap[itemId] : null;
                      return (
                        <React.Fragment key={idx}>
                          {idx > 0 && (
                            <span className="font-mono text-lg text-amber-500/60 font-bold">
                              +
                            </span>
                          )}
                          <div
                            onClick={() => item && handleRemoveCrucibleSlot(idx)}
                            className={`w-28 h-32 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center p-2 text-center transition-all cursor-pointer select-none ${
                              item
                                ? `${RARITY_META[item.rarity].bg} ${
                                    RARITY_META[item.rarity].border
                                  } border-solid hover:scale-105`
                                : 'border-stone-700/70 bg-stone-900/40 text-stone-500 hover:border-stone-600'
                            }`}
                          >
                            {item ? (
                              <>
                                <CompositeItemSprite item={item} size="lg" />
                                <span className="text-[11px] font-medium text-stone-100 mt-1.5 line-clamp-2 leading-tight">
                                  {item.name}
                                </span>
                                <span className="text-[9px] font-mono text-stone-400 mt-1">
                                  (клик — убрать)
                                </span>
                              </>
                            ) : (
                              <>
                                <Flame className="w-6 h-6 opacity-35 text-amber-400" />
                                <span className="text-[11px] font-mono mt-1">
                                  Слот {idx + 1}
                                </span>
                                <span className="text-[9px] text-stone-600">
                                  Выберите ниже
                                </span>
                              </>
                            )}
                          </div>
                        </React.Fragment>
                      );
                    })}

                    {crucibleSlots.length > 0 && (
                      <button
                        onClick={() => setCrucibleSlots([])}
                        title="Очистить котел"
                        className="absolute top-2.5 right-2.5 p-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-stone-400 hover:text-rose-300 border border-stone-800"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Synthesis Action & d20 Preview (5 cols) */}
                  <div className="md:col-span-5 flex flex-col justify-between rounded-2xl bg-gradient-to-br from-amber-950/30 via-stone-900/90 to-purple-950/30 border border-amber-500/30 p-4 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono text-stone-400">Проверка навыка:</span>
                      <span className="font-mono font-bold text-amber-300">
                        d20 + {proficiencyBonus}{' '}
                        {isExhausted ? '(с Помехой!)' : ''} vs СЛ{' '}
                        {crucibleItems.length >= 2 ? effectiveDc : '—'}
                      </span>
                    </div>

                    {knownRecipe && itemsMap[knownRecipe.resultItemId] ? (
                      <div className="rounded-xl bg-emerald-950/40 border border-emerald-500/40 p-2.5 text-xs flex items-center gap-2.5">
                        <CompositeItemSprite
                          item={itemsMap[knownRecipe.resultItemId]}
                          size="md"
                        />
                        <div className="min-w-0">
                          <div className="text-[10px] font-mono text-emerald-400 uppercase">
                            Известный рецепт (-3 к СЛ)
                          </div>
                          <div className="font-semibold text-stone-100 truncate">
                            {itemsMap[knownRecipe.resultItemId]?.name}
                          </div>
                        </div>
                      </div>
                    ) : crucibleItems.length >= 2 && telemetry ? (
                      <div className="rounded-xl bg-purple-950/35 border border-purple-500/40 p-2.5 text-xs flex items-center gap-2.5">
                        <Sparkles className="w-5 h-5 text-purple-300 shrink-0" />
                        <div>
                          <div className="text-[10px] font-mono text-purple-300 uppercase">
                            Неизученная комбинация!
                          </div>
                          <div className="text-stone-200">
                            Прогноз Jev:{' '}
                            <strong className={RARITY_META[telemetry.predictedRarity].text}>
                              {RARITY_META[telemetry.predictedRarity].label}
                            </strong>{' '}
                            ({ELEMENT_META[telemetry.elementAffinity.choice].label})
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-xl bg-stone-900/70 border border-stone-800 p-2.5 text-xs text-stone-400">
                        Добавьте минимум 2 компонента из инвентаря, чтобы Jev рассчитал СЛ и матрицу вероятностей.
                      </div>
                    )}

                    <button
                      onClick={handleSynthesize}
                      disabled={crucibleItems.length < 2 || isEvaluating || isRolling}
                      className={`w-full py-3 px-4 rounded-xl font-display font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                        crucibleItems.length >= 2 && !isEvaluating
                          ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-stone-950 shadow-[0_0_20px_rgba(245,158,11,0.35)] cursor-pointer'
                          : 'bg-stone-800 text-stone-500 cursor-not-allowed'
                      }`}
                    >
                      <Dices className="w-5 h-5" />
                      <span>
                        {isRolling
                          ? 'Бросок кубика d20...'
                          : `Синтезировать (Бросок d20 • 1⚡)`}
                      </span>
                    </button>
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

              {/* Player's Inventory Bag (Reagents, Catalysts, Crafted Artifacts) */}
              <div className="rounded-2xl border border-stone-800 bg-[#121018]/95 p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-display font-bold text-sm text-stone-200">
                      Сумка Алхимика (Нажмите на предмет, чтобы положить в тигель)
                    </h3>
                    <p className="text-[11px] text-stone-400">
                      Совет: в тигель можно класть не только трофеи монстров, но и уже созданные вами артефакты для многоступенчатого крафта!
                    </p>
                  </div>
                  <span className="text-xs font-mono text-stone-400">
                    Видов предметов: {ownedInventoryItems.length}
                  </span>
                </div>

                {ownedInventoryItems.length === 0 ? (
                  <div className="rounded-xl border border-stone-800 bg-stone-950/60 p-6 text-center space-y-2">
                    <p className="text-sm text-stone-300">В вашей сумке закончились реагенты!</p>
                    <button
                      onClick={() => setActiveMainTab('bestiary')}
                      className="px-4 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-semibold"
                    >
                      Отправиться в Бестиарий на охоту →
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2.5">
                    {ownedInventoryItems.map((item) => {
                      const totalCount = inventory[item.id] || 0;
                      const inCrucible = crucibleSlots.filter((id) => id === item.id).length;
                      const remaining = totalCount - inCrucible;
                      const rarity = RARITY_META[item.rarity];

                      return (
                        <div
                          key={item.id}
                          onClick={() => remaining > 0 && handleAddReagentToCrucible(item.id)}
                          className={`group relative rounded-xl border p-2.5 transition-all flex flex-col justify-between cursor-pointer select-none ${
                            rarity.bg
                          } ${rarity.border} ${
                            remaining > 0
                              ? 'hover:scale-[1.03] hover:shadow-md'
                              : 'opacity-45 cursor-not-allowed'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-1.5">
                            <CompositeItemSprite item={item} size="md" />
                            <div className="flex items-center gap-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedJeiItemId(item.id);
                                  setJeiTab('uses');
                                }}
                                title="Показать в JEI Гримуаре"
                                className="px-1.5 py-0.5 rounded bg-stone-900/90 hover:bg-stone-800 text-[9px] font-mono text-amber-300 border border-stone-700"
                              >
                                JEI
                              </button>
                              {item.kind === 'crafted' && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setInspectedItem(item);
                                  }}
                                  title="Открыть D&D Статблок"
                                  className="p-1 rounded bg-stone-900/90 hover:bg-stone-800 text-stone-300 border border-stone-700"
                                >
                                  <Eye className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>

                          <div className="mt-2">
                            <div className="text-xs font-semibold text-stone-100 line-clamp-1">
                              {item.name}
                            </div>
                            <div className="flex items-center justify-between mt-1 text-[10px] font-mono">
                              <span className={rarity.text}>{rarity.label}</span>
                              <span className="text-stone-300 font-bold">
                                x{remaining}
                                {inCrucible > 0 ? ` (${inCrucible} в котле)` : ''}
                              </span>
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
          {/* SCREEN 2: BESTIARY & FAST HARVEST (БЕСТИАРИЙ)         */}
          {/* ===================================================== */}
          {activeMainTab === 'bestiary' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-stone-800 bg-[#13111c]/95 p-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display font-bold text-base text-emerald-300">
                    Бестиарий Подземья: Быстрая охота и сбор органов (Harvest)
                  </h2>
                  <p className="text-xs text-stone-400">
                    Выберите монстра и бросьте <code className="text-amber-300">d20 + {proficiencyBonus + (hasUpgrade('harvest_bonus_2') ? 2 : 0)}</code>. Вы получаете все трофеи, чей порог СЛ (DC) вы пробили одним броском!
                  </p>
                </div>
                <div className="text-xs font-mono text-stone-300 bg-stone-900 px-3 py-1.5 rounded-xl border border-stone-800">
                  Модификатор разделки:{' '}
                  <strong className="text-emerald-400">
                    +{proficiencyBonus + (hasUpgrade('harvest_bonus_2') ? 2 : 0)}
                  </strong>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {MONSTERS.map((monster) => {
                  const locked = alchemistLevel < monster.minAlchemistLevel;
                  const isHighlighted = highlightedMonsterId === monster.id;

                  return (
                    <div
                      key={monster.id}
                      className={`rounded-2xl border p-4 bg-gradient-to-br ${
                        monster.accentColor
                      } bg-[#13111c] transition-all flex flex-col justify-between gap-3 ${
                        isHighlighted
                          ? 'border-amber-400 ring-2 ring-amber-400/50'
                          : 'border-stone-800/90'
                      } ${locked ? 'opacity-65' : ''}`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-3">
                            <div className="w-14 h-14 rounded-2xl bg-stone-950/80 border border-stone-800 flex items-center justify-center">
                              <CompositeMonsterSprite monster={monster} size="lg" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="font-display font-bold text-sm text-stone-100">
                                  {monster.name}
                                </h3>
                                <span className="px-2 py-0.5 rounded bg-stone-900/90 border border-stone-700 font-mono text-[10px] text-amber-300">
                                  {monster.crDisplay}
                                </span>
                              </div>
                              <p className="text-[11px] text-stone-400">
                                {monster.creatureType} • {monster.biome}
                              </p>
                            </div>
                          </div>

                          <span className="px-2 py-0.5 rounded-lg bg-stone-950/80 border border-stone-800 font-mono text-[11px] text-sky-300 shrink-0">
                            -{monster.staminaCost} ⚡
                          </span>
                        </div>

                        <p className="text-xs text-stone-300/90 mt-2.5 leading-relaxed">
                          {monster.lore}
                        </p>

                        {/* Monster Anatomical Drops Table */}
                        <div className="mt-3 space-y-1.5">
                          <div className="text-[10px] font-mono uppercase text-stone-400">
                            Анатомическая карта трофеев (клик — открыть в JEI):
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
                                className="rounded-xl bg-stone-950/75 hover:bg-stone-900 border border-stone-800/90 px-2.5 py-1.5 flex items-center justify-between gap-2 cursor-pointer transition-colors"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <CompositeItemSprite item={dropItem} size="sm" />
                                  <span className={`text-xs font-medium truncate ${rarity.text}`}>
                                    {dropItem.name}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0 font-mono text-[10px]">
                                  {ownedCount > 0 && (
                                    <span className="px-1.5 py-0.2 rounded bg-stone-800 text-stone-300">
                                      x{ownedCount}
                                    </span>
                                  )}
                                  <span className="px-1.5 py-0.5 rounded bg-stone-900 border border-stone-700 text-amber-300">
                                    СЛ {drop.dc}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <button
                        onClick={() => handleHarvestMonster(monster.id)}
                        disabled={locked || isRolling}
                        className={`w-full py-2.5 px-4 rounded-xl font-display font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                          locked
                            ? 'bg-stone-900 border border-stone-800 text-stone-500 cursor-not-allowed'
                            : 'bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/50 text-emerald-200 cursor-pointer'
                        }`}
                      >
                        <Dices className="w-4 h-4" />
                        <span>
                          {locked
                            ? `Требуется Уровень Мастерства ${monster.minAlchemistLevel}`
                            : `Выследить и разделать (Бросок d20 • ${monster.staminaCost}⚡)`}
                        </span>
                      </button>
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
              <div className="rounded-2xl border border-stone-800 bg-[#13111c]/95 p-5 space-y-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="font-display font-bold text-base text-amber-300">
                      Контракты Приключенцев (Доска Заказов Гильдии — День {day})
                    </h2>
                    <p className="text-xs text-stone-400">
                      Сдавайте подходящие по тегам и редкости артефакты за щедрое золото, опыт и бонусные реагенты
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
                            ? 'bg-stone-950/50 border-stone-800/60 opacity-60'
                            : 'bg-stone-900/80 border-amber-500/35'
                        }`}
                      >
                        <div className="space-y-2">
                          <div className="flex items-center gap-2.5">
                            <span className="text-2xl">{bounty.clientIcon}</span>
                            <div>
                              <div className="text-xs font-bold text-stone-100">
                                {bounty.clientName}
                              </div>
                              <div className="text-[10px] text-stone-400">
                                {bounty.clientTitle}
                              </div>
                            </div>
                          </div>

                          <div className="font-display font-bold text-xs text-amber-200">
                            «{bounty.questTitle}»
                          </div>
                          <p className="text-xs text-stone-300 leading-relaxed">
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

                        <div className="pt-2 border-t border-stone-800 space-y-2">
                          <div className="flex items-center justify-between text-xs font-mono">
                            <span className="text-amber-300 font-bold">
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
                              className="w-full py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs transition-colors"
                            >
                              Сдать «{matchingItems[0].name}»
                            </button>
                          ) : (
                            <div className="w-full py-2 px-2 rounded-xl bg-stone-950 border border-stone-800 text-stone-500 text-center text-[11px]">
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
                <div className="rounded-2xl border border-stone-800 bg-[#13111c]/95 p-5 space-y-3">
                  <h3 className="font-display font-bold text-sm text-amber-200">
                    Лавка Катализаторов и Заготовок
                  </h3>
                  <p className="text-xs text-stone-400">
                    Стабильные основы повышают совместимость <code className="text-emerald-300">noul</code> и снижают взрывоопасность реакции
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
                <div className="rounded-2xl border border-stone-800 bg-[#13111c]/95 p-5 space-y-3">
                  <h3 className="font-display font-bold text-sm text-purple-200">
                    Оборудование Мастерской
                  </h3>
                  <p className="text-xs text-stone-400">
                    Постоянные улучшения лаборатории и охотничьего снаряжения
                  </p>
                  <div className="space-y-2">
                    {upgrades.map((upg) => (
                      <div
                        key={upg.id}
                        className="rounded-xl bg-stone-900/90 border border-stone-800 p-3 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-2xl">{upg.icon}</span>
                          <div>
                            <div className="text-xs font-semibold text-stone-100">
                              {upg.name}
                            </div>
                            <div className="text-[11px] text-stone-400">
                              {upg.description}
                            </div>
                          </div>
                        </div>

                        {upg.purchased ? (
                          <span className="px-2.5 py-1 rounded-lg bg-emerald-950/50 border border-emerald-500/40 text-emerald-300 font-mono text-[11px] shrink-0">
                            ✓ Куплено
                          </span>
                        ) : (
                          <button
                            onClick={() => handleBuyUpgrade(upg.id)}
                            className="px-3 py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 text-purple-200 font-mono text-xs font-semibold shrink-0"
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
        </div>

        {/* RIGHT SIDEBAR: ALWAYS-ON JEI GRIMOIRE CODEX (4 cols) */}
        <div className="lg:col-span-4 h-[760px] lg:h-[calc(100vh-92px)] lg:sticky lg:top-[76px]">
          <JeiCodexSidebar
            itemsMap={itemsMap}
            discoveredItemIds={discoveredItemIds}
            inventory={inventory}
            recipes={recipes}
            monsters={MONSTERS}
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
          />
        </div>
      </main>

      {/* D&D 5e ITEM STATBLOCK MODAL */}
      <ItemStatblockModal
        item={inspectedItem}
        inventoryCount={inspectedItem ? inventory[inspectedItem.id] || 0 : 0}
        onClose={() => setInspectedItem(null)}
        onSellItem={handleSellItem}
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
    </div>
  );
}
export default App;
