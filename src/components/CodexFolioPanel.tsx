import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Coins,
  Compass,
  Eye,
  Filter,
  Flame,
  HelpCircle,
  Layers,
  Lock,
  Plus,
  Search,
  Shield,
  Sparkles,
  Swords,
  Unlock,
  UserCheck,
  X,
  Zap,
} from 'lucide-react';
import {
  CraftingStation,
  ElementType,
  GameItem,
  Monster,
  Rarity,
  RecipeRecord,
} from '../types/game';
import { ELEMENT_META, RARITY_META } from '../data/bestiary';
import { CompositeItemSprite } from './CompositeItemSprite';
import { GUILD_WORLD_HEROES } from '../data/guildWorldCampaign';
import { sfx } from '../utils/sound';
import { useLanguage } from '../context/LanguageContext';

interface CodexFolioPanelProps {
  itemsMap: Record<string, GameItem>;
  discoveredItemIds: string[];
  inventory: Record<string, number>;
  recipes: Record<string, RecipeRecord>;
  monsters: Monster[];
  selectedItemId: string | null;
  onSelectItemId: (itemId: string) => void;
  onLoadRecipeToCrucible: (station: CraftingStation, ingredientIds: string[]) => void;
  onAddReagentToCrucible: (itemId: string) => void;
  onInspectItem: (item: GameItem) => void;
  onApplyBuffToHero?: (item: GameItem, heroId: 'quick' | 'nocta' | 'slow') => void;
  onJumpToMonster?: (monsterId: string) => void;
}

export const CodexFolioPanel: React.FC<CodexFolioPanelProps> = ({
  itemsMap,
  discoveredItemIds,
  inventory,
  recipes,
  monsters,
  selectedItemId,
  onSelectItemId,
  onLoadRecipeToCrucible,
  onAddReagentToCrucible,
  onInspectItem,
  onApplyBuffToHero,
  onJumpToMonster,
}) => {
  const { lang, t, getItemName, getMonsterName, getRarityLabel, getElementLabel } = useLanguage();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'reagent' | 'crafted' | 'catalyst' | 'recipes'>('all');
  const [rarityFilter, setRarityFilter] = useState<Rarity | 'all'>('all');
  const [selectedElement, setSelectedElement] = useState<ElementType | 'all'>('all');
  const [discoveryFilter, setDiscoveryFilter] = useState<'all' | 'discovered' | 'undiscovered'>('all');

  const discoveredSet = useMemo(() => new Set(discoveredItemIds), [discoveredItemIds]);
  const allItems = useMemo(() => Object.values(itemsMap), [itemsMap]);
  const recipeList = useMemo(() => Object.values(recipes), [recipes]);

  // Overall catalog progress statistics
  const totalItemsCount = allItems.length;
  const discoveredCount = allItems.filter(
    (it) => discoveredSet.has(it.id) || (inventory[it.id] || 0) > 0
  ).length;
  const progressPercent = Math.round((discoveredCount / Math.max(1, totalItemsCount)) * 100);

  // Filtered Items List
  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();

    return allItems
      .filter((item) => {
        const isDiscovered = discoveredSet.has(item.id) || (inventory[item.id] || 0) > 0;

        // Discovery filter
        if (discoveryFilter === 'discovered' && !isDiscovered) return false;
        if (discoveryFilter === 'undiscovered' && isDiscovered) return false;

        // Category filter
        if (categoryFilter === 'recipes') {
          // Item must have at least one recipe creating it
          const hasRecipe = recipeList.some((r) => r.resultItemId === item.id);
          if (!hasRecipe) return false;
        } else if (categoryFilter !== 'all' && item.kind !== categoryFilter) {
          return false;
        }

        // Rarity filter
        if (rarityFilter !== 'all' && item.rarity !== rarityFilter) return false;

        // Element filter
        if (selectedElement !== 'all' && !item.elements.includes(selectedElement)) {
          return false;
        }

        // Search query
        if (!q) return true;
        if (!isDiscovered) {
          return (
            item.monsterName?.toLowerCase().includes(q) ||
            RARITY_META[item.rarity].label.toLowerCase().includes(q)
          );
        }
        return (
          item.name.toLowerCase().includes(q) ||
          item.nameEn.toLowerCase().includes(q) ||
          (item.monsterName && item.monsterName.toLowerCase().includes(q)) ||
          item.elements.some((el) => ELEMENT_META[el].label.toLowerCase().includes(q)) ||
          RARITY_META[item.rarity].label.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const aInv = inventory[a.id] || 0;
        const bInv = inventory[b.id] || 0;
        if (aInv > 0 && bInv === 0) return -1;
        if (bInv > 0 && aInv === 0) return 1;
        return RARITY_META[b.rarity].rank - RARITY_META[a.rarity].rank;
      });
  }, [
    allItems,
    categoryFilter,
    rarityFilter,
    selectedElement,
    discoveryFilter,
    search,
    discoveredSet,
    inventory,
    recipeList,
  ]);

  const activeItem = useMemo(() => {
    if (selectedItemId && itemsMap[selectedItemId]) {
      return itemsMap[selectedItemId];
    }
    return filteredItems[0] || allItems[0];
  }, [selectedItemId, itemsMap, filteredItems, allItems]);

  const isActiveDiscovered =
    activeItem && (discoveredSet.has(activeItem.id) || (inventory[activeItem.id] || 0) > 0);

  // Recipes creating this item
  const creatingRecipes = useMemo(() => {
    if (!activeItem) return [];
    return recipeList.filter((r) => r.resultItemId === activeItem.id);
  }, [recipeList, activeItem]);

  // Recipes where this item is used as an ingredient
  const usageRecipes = useMemo(() => {
    if (!activeItem) return [];
    return recipeList.filter((r) => r.ingredientIds.includes(activeItem.id));
  }, [recipeList, activeItem]);

  // Associated monster (if trophy)
  const monsterSource = useMemo(() => {
    if (!activeItem?.monsterId) return null;
    return monsters.find((m) => m.id === activeItem.monsterId);
  }, [activeItem, monsters]);

  return (
    <div className="space-y-4">
      {/* 1. GRIMOIRE FOLIO HEADER & PROGRESS BAR */}
      <div className="rounded-2xl border border-[#c9aa72]/30 bg-gradient-to-r from-[#12202a] via-[#0f1b22] to-[#0c161d] p-5 shadow-xl relative overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[#091117] border border-[#d0ad77]/50 flex items-center justify-center text-2xl shadow-inner text-[#e5cb94]">
              📖
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display font-bold text-lg text-[#f0ece3]">
                  {lang === 'en'
                    ? 'Grand Grimoire of Dalniy Kamen • Catalog of Entities'
                    : 'Великий Гримуар Дальнего Камня • Каталог Сущностей'}
                </h2>
                <span className="px-2 py-0.5 rounded bg-[#182833] border border-[#3b5567] font-mono text-[11px] text-[#d0ad77]">
                  {lang === 'en'
                    ? `${discoveredCount} / ${totalItemsCount} discovered`
                    : `${discoveredCount} / ${totalItemsCount} открыто`}
                </span>
              </div>
              <p className="text-xs text-[#8ca0ab] mt-0.5">
                {lang === 'en'
                  ? 'Complete compendium of monstrous trophies, alchemical catalysts, and synthesized Guild World relics'
                  : 'Полный компендиум монструозных трофеев, алхимических катализаторов и синтезированных реликвий «Мира Гильдий»'}
              </p>
            </div>
          </div>

          {/* Catalog Discovery Progress Meter */}
          <div className="w-full sm:w-64 space-y-1.5">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-[#8ca0ab]">{lang === 'en' ? 'World Lore Discovered:' : 'Исследование мира:'}</span>
              <span className="font-bold text-[#e5cb94]">{progressPercent}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-[#081015] border border-[#233845] overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#d0ad77] to-amber-400 transition-all duration-500 rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Search & Filters Matrix */}
        <div className="mt-4 pt-4 border-t border-[#ffffff10] space-y-3">
          {/* Search bar + Category tabs */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[260px]">
              <Search className="w-4 h-4 text-[#8ca0ab] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={
                  lang === 'en'
                    ? 'Search catalog: item name, beast, element, tier...'
                    : 'Поиск по названию, стихии, монстру или свойству...'
                }
                className="w-full pl-9 pr-8 py-2 rounded-xl bg-[#081015] border border-[#2b4150] text-xs text-[#f0ece3] placeholder-[#647985] focus:outline-none focus:border-[#d0ad77]"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-300"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {[
                { id: 'all', label: lang === 'en' ? 'All Entities' : 'Все сущности' },
                { id: 'reagent', label: lang === 'en' ? 'Beast Trophies' : 'Трофеи бестий' },
                { id: 'catalyst', label: lang === 'en' ? 'Bases & Ingots' : 'Основы & Слитки' },
                { id: 'crafted', label: lang === 'en' ? 'D&D Syntheses' : 'Синтез D&D' },
                { id: 'recipes', label: lang === 'en' ? 'Formulas' : 'Формулы' },
              ].map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => {
                    sfx.playClick();
                    setCategoryFilter(cat.id as any);
                  }}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    categoryFilter === cat.id
                      ? 'bg-[#1b2f3b] border-[#d0ad77] text-[#fbf7ee] shadow-sm'
                      : 'bg-[#0a1319] border-[#223643] text-[#7f94a1] hover:text-[#f0ece3] hover:border-[#c9aa72]/40'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Elemental & Rarity Filter Strip */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            {/* Elements */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-mono text-[#8ca0ab] mr-1">{lang === 'en' ? 'Element:' : 'Стихия:'}</span>
              <button
                onClick={() => setSelectedElement('all')}
                className={`px-2 py-1 rounded-lg border font-mono text-[10px] cursor-pointer ${
                  selectedElement === 'all'
                    ? 'bg-[#1b2f3b] border-[#d0ad77] text-[#e5cb94]'
                    : 'bg-[#091117] border-[#203440] text-[#7a8f9c]'
                }`}
              >
                {lang === 'en' ? 'All' : 'Все'}
              </button>
              {(Object.keys(ELEMENT_META) as ElementType[]).map((elem) => {
                const meta = ELEMENT_META[elem];
                const active = selectedElement === elem;
                return (
                  <button
                    key={elem}
                    onClick={() => {
                      sfx.playClick();
                      setSelectedElement(active ? 'all' : elem);
                    }}
                    className={`px-2 py-1 rounded-lg border font-mono text-[10px] flex items-center gap-1 transition-all cursor-pointer ${
                      active
                        ? `${meta.bg} ${meta.border} ${meta.color} ring-1 ring-amber-400/50 shadow-md`
                        : 'bg-[#091117] border-[#203440] text-[#8ca0ab] hover:border-[#385366]'
                    }`}
                  >
                    <span>{meta.emoji}</span>
                    <span className="hidden sm:inline">{lang === 'en' ? meta.labelEn : meta.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Discovery Status Toggle */}
            <div className="flex items-center gap-1 font-mono text-[11px]">
              <span className="text-[#8ca0ab] mr-1">{lang === 'en' ? 'Status:' : 'Статус:'}</span>
              {[
                { id: 'all', label: lang === 'en' ? 'All' : 'Все' },
                { id: 'discovered', label: lang === 'en' ? '✓ Discovered' : '✓ Открыто' },
                { id: 'undiscovered', label: lang === 'en' ? '? Secrets' : '? Тайны' },
              ].map((st) => (
                <button
                  key={st.id}
                  onClick={() => {
                    sfx.playClick();
                    setDiscoveryFilter(st.id as any);
                  }}
                  className={`px-2.5 py-1 rounded-lg border cursor-pointer ${
                    discoveryFilter === st.id
                      ? 'bg-[#172b36] border-[#d0ad77] text-[#e5cb94]'
                      : 'bg-[#091117] border-[#203440] text-[#718591]'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 2. DUAL-PANE FOLIO WORKSPACE (Items Grid + Grimoire Dossier) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT / CENTER: ITEMS GRID (7 cols) */}
        <div className="lg:col-span-7 rounded-2xl bg-[#101b22] border border-[#c9aa72]/25 p-4 shadow-xl space-y-3">
          <div className="flex items-center justify-between text-xs font-mono text-[#8ca0ab] pb-2 border-b border-[#ffffff10]">
            <span>
              {lang === 'en' ? 'Catalog items found: ' : 'Найдено в каталоге: '}
              <strong className="text-[#e5cb94]">{filteredItems.length}</strong>
            </span>
            <span>{lang === 'en' ? 'Click item to inspect folio' : 'Кликните для детального разворота'}</span>
          </div>

          {filteredItems.length === 0 ? (
            <div className="text-center py-16 text-[#718591] space-y-2">
              <div className="text-3xl">🔍</div>
              <p className="text-sm">
                {lang === 'en'
                  ? 'No items found matching the current filters.'
                  : 'Ничего не найдено по текущим фильтрам каталога.'}
              </p>
              <button
                onClick={() => {
                  setSearch('');
                  setCategoryFilter('all');
                  setRarityFilter('all');
                  setSelectedElement('all');
                  setDiscoveryFilter('all');
                }}
                className="text-xs text-[#d0ad77] underline cursor-pointer"
              >
                {lang === 'en' ? 'Reset all filters' : 'Сбросить все фильтры'}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 max-h-[720px] overflow-y-auto pr-1">
              {filteredItems.map((item) => {
                const isDiscovered =
                  discoveredSet.has(item.id) || (inventory[item.id] || 0) > 0;
                const isSelected = activeItem?.id === item.id;
                const owned = inventory[item.id] || 0;
                const rarity = RARITY_META[item.rarity];

                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      sfx.playClick();
                      onSelectItemId(item.id);
                    }}
                    className={`p-3 rounded-2xl border text-center transition-all cursor-pointer relative group flex flex-col justify-between select-none ${
                      isSelected
                        ? 'ring-2 ring-[#d0ad77] shadow-[0_0_18px_rgba(208,173,119,0.35)] scale-[1.02]'
                        : 'hover:scale-[1.01]'
                    } ${
                      isDiscovered
                        ? `${rarity.bg} ${rarity.border}`
                        : 'bg-[#0a1217]/80 border-[#1f323e] border-dashed opacity-75'
                    }`}
                  >
                    {/* Top Badges */}
                    <div className="flex items-center justify-between w-full text-[10px] font-mono mb-1">
                      {isDiscovered ? (
                        <span className={`px-1.5 py-0.2 rounded ${rarity.border} ${rarity.text}`}>
                          {(lang === 'en' ? rarity.labelEn : rarity.label).slice(0, 3)}
                        </span>
                      ) : (
                        <span className="text-stone-500 flex items-center gap-0.5">
                          <Lock className="w-3 h-3" /> {lang === 'en' ? 'Secret' : 'Тайна'}
                        </span>
                      )}

                      {owned > 0 && (
                        <span className="px-1.5 py-0.2 rounded bg-[#091117] text-[#e5cb94] font-bold border border-[#3b596d]">
                          ×{owned}
                        </span>
                      )}
                    </div>

                    {/* Sprite Display */}
                    <div className="py-2 flex items-center justify-center">
                      {isDiscovered ? (
                        <CompositeItemSprite item={item} size="md" />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-[#091117] border border-[#213542] flex items-center justify-center text-xl text-stone-600">
                          ?
                        </div>
                      )}
                    </div>

                    {/* Name & Origin */}
                    <div className="space-y-0.5 mt-1">
                      <div className="font-semibold text-xs text-[#f0ece3] line-clamp-2 leading-tight">
                        {isDiscovered ? getItemName(item) : (lang === 'en' ? 'Undiscovered Artifact' : 'Неоткрытый артефакт')}
                      </div>
                      <div className="text-[10px] text-[#7d919d] truncate">
                        {isDiscovered
                          ? (lang === 'en' ? item.name : (item.monsterName || item.nameEn))
                          : item.monsterName
                          ? (lang === 'en' ? `From: ${item.monsterName}` : `С: ${item.monsterName}`)
                          : (lang === 'en' ? 'Jev Transmutation' : 'Трансмутация Jev')}
                      </div>
                    </div>

                    {/* Elements Strip */}
                    {isDiscovered && item.elements.length > 0 && (
                      <div className="flex items-center justify-center gap-1 mt-2">
                        {item.elements.map((el) => (
                          <span
                            key={el}
                            className="text-[10px]"
                            title={ELEMENT_META[el].label}
                          >
                            {ELEMENT_META[el].emoji}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* RIGHT: GRIMOIRE DOSSIER (Разворот страницы фолианта) (5 cols) */}
        <div className="lg:col-span-5 rounded-2xl bg-[#0e171e] border border-[#c9aa72]/30 p-5 shadow-2xl space-y-4 lg:sticky lg:top-[84px]">
          {activeItem ? (
            <>
              {/* Header: Title, Rarity, Actions */}
              <div className="border-b border-[#ffffff10] pb-4 space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span
                    className={`px-2 py-0.5 rounded border uppercase text-[10px] font-bold ${
                      RARITY_META[activeItem.rarity].bg
                    } ${RARITY_META[activeItem.rarity].border} ${
                      RARITY_META[activeItem.rarity].text
                    }`}
                  >
                    {lang === 'en' ? RARITY_META[activeItem.rarity].labelEn : RARITY_META[activeItem.rarity].label}
                  </span>
                  <span className="text-[#8ca0ab] flex items-center gap-1">
                    {isActiveDiscovered ? (
                      <span className="text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> {lang === 'en' ? 'Discovered in Grimoire' : 'Открыто в Гримуаре'}
                      </span>
                    ) : (
                      <span className="text-amber-400 flex items-center gap-1">
                        <Lock className="w-3.5 h-3.5" /> {lang === 'en' ? 'Undiscovered (Secret)' : 'Не открыто (Тайна)'}
                      </span>
                    )}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <CompositeItemSprite item={activeItem} size="lg" />
                  <div>
                    <h3 className="font-display font-bold text-base text-[#f0ece3]">
                      {isActiveDiscovered ? getItemName(activeItem) : (lang === 'en' ? 'Undiscovered Secret' : 'Неоткрытая тайна')}
                    </h3>
                    <p className="text-xs text-[#8ca0ab] italic">
                      {lang === 'en' ? activeItem.name : activeItem.nameEn}
                    </p>
                    <div className="text-[11px] font-mono text-[#d0ad77] mt-1">
                      {lang === 'en'
                        ? `Value: ${activeItem.goldValue} gp • In Stock: ×${inventory[activeItem.id] || 0}`
                        : `Ценность: ${activeItem.goldValue} gp • В наличии: ×${inventory[activeItem.id] || 0}`}
                    </div>
                  </div>
                </div>

                {/* Elements Badges */}
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  {activeItem.elements.map((el) => {
                    const meta = ELEMENT_META[el];
                    return (
                      <span
                        key={el}
                        className={`px-2.5 py-0.5 rounded-lg border font-mono text-[10px] flex items-center gap-1.5 ${meta.bg} ${meta.border} ${meta.color}`}
                      >
                        <span>{meta.emoji}</span>
                        <span>{lang === 'en' ? meta.labelEn : meta.label}</span>
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* Lore & Origin Box */}
              <div className="space-y-1.5 text-xs">
                <div className="font-mono text-[10px] uppercase text-[#d0ad77]">
                  {lang === 'en' ? '★ Chronicle & Origin:' : '★ Летопись и Происхождение:'}
                </div>
                <p className="text-[#c4d5dd] leading-relaxed p-3 rounded-xl bg-[#091117] border border-[#20333f]">
                  {isActiveDiscovered
                    ? activeItem.description
                    : lang === 'en'
                    ? 'Sealed knowledge. Hunt beasts or synthesize in the Crucible to reveal.'
                    : 'Запечатанное знание. Для открытия сущности выследите чудовище или завершите трансмутацию в Горниле Дальнего Камня.'}
                </p>
                {monsterSource && (
                  <div className="flex items-center justify-between p-2 rounded-xl bg-[#13222a] border border-[#293e4b]">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{monsterSource.icon}</span>
                      <div>
                        <div className="font-semibold text-[#f0ece3] text-xs">
                          {getMonsterName(monsterSource)}
                        </div>
                        <div className="text-[10px] text-[#8ca0ab]">
                          {monsterSource.crDisplay} • {monsterSource.biome}
                        </div>
                      </div>
                    </div>
                    {onJumpToMonster && (
                      <button
                        onClick={() => onJumpToMonster(monsterSource.id)}
                        className="px-2.5 py-1 rounded-lg bg-[#1c303c] hover:bg-[#253f4e] border border-[#c9aa72]/40 text-[#e5cb94] font-mono text-[10px] flex items-center gap-1 cursor-pointer"
                      >
                        <Compass className="w-3 h-3" />
                        <span>{lang === 'en' ? 'Bestiary' : 'Бестиарий'}</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Recipe & Usage Tree */}
              <div className="space-y-3 pt-1">
                {/* 1. Creating Recipes */}
                <div className="space-y-1.5">
                  <div className="font-mono text-[10px] uppercase text-[#d0ad77] flex items-center justify-between">
                    <span>
                      {lang === 'en'
                        ? `Creation Formulas (${creatingRecipes.length}):`
                        : `Формулы создания (${creatingRecipes.length}):`}
                    </span>
                  </div>
                  {creatingRecipes.length === 0 ? (
                    <div className="text-[11px] text-[#718591] p-2 rounded-lg bg-[#091117] border border-[#1b2b36]">
                      {activeItem.kind === 'reagent'
                        ? lang === 'en'
                          ? 'Primary natural reagent. Obtained by hunting beasts.'
                          : 'Первичный природный реагент. Добывается охотой на бестий.'
                        : lang === 'en'
                        ? 'Unknown formula. Try combining matching elemental reagents in the Crucible.'
                        : 'Неизвестная формула. Попробуйте скомбинировать подходящие стихийные трофеи в Тигле.'}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {creatingRecipes.map((rec) => (
                        <div
                          key={rec.key}
                          className="p-2.5 rounded-xl bg-[#091117] border border-[#2b4150] space-y-2 text-xs"
                        >
                          <div className="flex items-center justify-between text-[10px] font-mono text-[#8ca0ab]">
                            <span>{lang === 'en' ? `Station: ${rec.station}` : `Станок: ${rec.station}`}</span>
                            <span>{lang === 'en' ? `Crafted: ${rec.timesCrafted}` : `Крафтов: ${rec.timesCrafted}`}</span>
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {rec.ingredientIds.map((ingId) => {
                              const ing = itemsMap[ingId];
                              const owned = inventory[ingId] || 0;
                              return (
                                <div
                                  key={ingId}
                                  className={`px-2 py-1 rounded-lg border flex items-center gap-1 text-[11px] ${
                                    owned > 0
                                      ? 'bg-[#14232c] border-[#395669] text-[#f0ece3]'
                                      : 'bg-[#12161a] border-rose-500/30 text-rose-300'
                                  }`}
                                >
                                  <span>{ing?.icon || '📦'}</span>
                                  <span>{ing ? getItemName(ing) : ingId}</span>
                                  <span className="font-mono text-[9px] text-[#d0ad77]">
                                    ({owned})
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                          <button
                            onClick={() => onLoadRecipeToCrucible(rec.station, rec.ingredientIds)}
                            className="w-full py-1.5 rounded-lg bg-[#192b36] hover:bg-[#223a49] border border-[#d0ad77]/50 text-[#e5cb94] text-[11px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                          >
                            <Flame className="w-3.5 h-3.5 text-amber-400" />
                            <span>{lang === 'en' ? 'Load Formula into Crucible' : 'Загрузить формулу в Тигель'}</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 2. Used in other recipes */}
                {usageRecipes.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="font-mono text-[10px] uppercase text-[#d0ad77]">
                      {lang === 'en'
                        ? `Used in Formulas (${usageRecipes.length}):`
                        : `Применяется в формулах (${usageRecipes.length}):`}
                    </div>
                    <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                      {usageRecipes.map((ur) => {
                        const target = itemsMap[ur.resultItemId];
                        return (
                          <div
                            key={ur.key}
                            onClick={() => onSelectItemId(ur.resultItemId)}
                            className="p-2 rounded-lg bg-[#091117] hover:bg-[#121f28] border border-[#213543] flex items-center justify-between text-xs cursor-pointer transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <span>{target?.icon || '✨'}</span>
                              <span className="text-[#f0ece3] font-medium truncate">
                                {target ? getItemName(target) : ur.resultItemId}
                              </span>
                            </div>
                            <ArrowRight className="w-3.5 h-3.5 text-[#8ca0ab]" />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-[#ffffff10] space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      sfx.playClick();
                      onAddReagentToCrucible(activeItem.id);
                    }}
                    disabled={(inventory[activeItem.id] || 0) <= 0}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      (inventory[activeItem.id] || 0) > 0
                        ? 'bg-[#1b2f3b] hover:bg-[#243e4e] border-[#d0ad77]/60 text-[#f0ece3]'
                        : 'bg-[#0f171d] border-[#1e2d36] text-[#556976] cursor-not-allowed'
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5 text-[#d0ad77]" />
                    <span>{lang === 'en' ? 'To Crucible' : 'В чашу тигля'}</span>
                  </button>

                  <button
                    onClick={() => {
                      sfx.playClick();
                      onInspectItem(activeItem);
                    }}
                    className="py-2 px-3 rounded-xl bg-[#121f28] hover:bg-[#1a2b37] border border-[#3b596d] text-[#e5cb94] text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>{lang === 'en' ? 'D&D Statblock' : 'D&D Статблок'}</span>
                  </button>
                </div>

                {/* Hero Buff Quick Apply */}
                {onApplyBuffToHero && (inventory[activeItem.id] || 0) > 0 && (
                  <div className="p-2 rounded-xl bg-[#081015] border border-[#c9aa72]/30 flex items-center justify-between gap-1 text-[11px]">
                    <span className="text-[#d0ad77] font-semibold flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-amber-400" />
                      <span>{lang === 'en' ? 'Apply Buff:' : 'Применить бафф:'}</span>
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onApplyBuffToHero(activeItem, 'quick')}
                        className="px-2 py-0.5 rounded bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-200 cursor-pointer"
                        title={lang === 'en' ? 'Feed Quick' : 'Скормить Квику'}
                      >
                        🍽️ {lang === 'en' ? 'Quick' : 'Квик'}
                      </button>
                      <button
                        onClick={() => onApplyBuffToHero(activeItem, 'nocta')}
                        className="px-2 py-0.5 rounded bg-indigo-950/70 hover:bg-indigo-900 border border-indigo-500/40 text-indigo-200 cursor-pointer"
                        title={lang === 'en' ? "Nocta's Draught" : 'Настой Нокты'}
                      >
                        🥷 {lang === 'en' ? 'Nocta' : 'Нокта'}
                      </button>
                      <button
                        onClick={() => onApplyBuffToHero(activeItem, 'slow')}
                        className="px-2 py-0.5 rounded bg-amber-950/70 hover:bg-amber-900 border border-amber-500/40 text-amber-200 cursor-pointer"
                        title={lang === 'en' ? "Slow's Tempering" : 'Закалка Слоу'}
                      >
                        ⚔️ {lang === 'en' ? 'Slow' : 'Слоу'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-20 text-[#677c88]">
              {lang === 'en'
                ? 'Select an entity from the catalog grid to view its folio.'
                : 'Выберите сущность в сетке каталога для изучения её свойств.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
