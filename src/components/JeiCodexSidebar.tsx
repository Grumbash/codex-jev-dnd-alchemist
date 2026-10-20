import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Compass,
  Eye,
  Filter,
  HelpCircle,
  Layers,
  Plus,
  Search,
  ShoppingBag,
  Sparkles,
} from 'lucide-react';
import {
  CraftingStation,
  GameItem,
  Monster,
  RecipeRecord,
} from '../types/game';
import { ELEMENT_META, RARITY_META } from '../data/bestiary';
import { CompositeItemSprite } from './CompositeItemSprite';

interface JeiCodexSidebarProps {
  itemsMap: Record<string, GameItem>;
  discoveredItemIds: string[];
  inventory: Record<string, number>;
  recipes: Record<string, RecipeRecord>;
  monsters: Monster[];
  selectedJeiItemId: string | null;
  jeiTab: 'recipe' | 'uses';
  onSelectJeiItem: (itemId: string, tab?: 'recipe' | 'uses') => void;
  onAddReagentToCrucible: (itemId: string) => void;
  onLoadFullRecipeToCrucible: (station: CraftingStation, ingredientIds: string[]) => void;
  onJumpToMonster: (monsterId: string) => void;
  onBuyCatalyst: (itemId: string) => void;
  onInspectStatblock: (item: GameItem) => void;
}

const STATION_LABELS: Record<CraftingStation, { name: string; icon: string }> = {
  alchemist: { name: 'Алхимия', icon: '⚗️' },
  blacksmith: { name: 'Кузня', icon: '🔨' },
  artificer: { name: 'Артефакторика', icon: '🔮' },
};

export const JeiCodexSidebar: React.FC<JeiCodexSidebarProps> = ({
  itemsMap,
  discoveredItemIds,
  inventory,
  recipes,
  monsters,
  selectedJeiItemId,
  jeiTab,
  onSelectJeiItem,
  onAddReagentToCrucible,
  onLoadFullRecipeToCrucible,
  onJumpToMonster,
  onBuyCatalyst,
  onInspectStatblock,
}) => {
  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState<'all' | 'reagent' | 'crafted' | 'catalyst'>('all');

  const discoveredSet = useMemo(() => new Set(discoveredItemIds), [discoveredItemIds]);
  const allItems = useMemo(() => Object.values(itemsMap), [itemsMap]);
  const recipeList = useMemo(() => Object.values(recipes), [recipes]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allItems
      .filter((item) => {
        if (kindFilter !== 'all' && item.kind !== kindFilter) return false;
        const isKnown = discoveredSet.has(item.id) || (inventory[item.id] || 0) > 0;
        if (!q) return true;
        if (!isKnown) {
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
          RARITY_META[item.rarity].label.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const aInv = inventory[a.id] || 0;
        const bInv = inventory[b.id] || 0;
        if (aInv > 0 && bInv === 0) return -1;
        if (bInv > 0 && aInv === 0) return 1;
        return RARITY_META[b.rarity].rank - RARITY_META[a.rarity].rank;
      });
  }, [allItems, kindFilter, search, discoveredSet, inventory]);

  const selectedItem = selectedJeiItemId ? itemsMap[selectedJeiItemId] : null;
  const isSelectedDiscovered =
    selectedItem &&
    (discoveredSet.has(selectedItem.id) || (inventory[selectedItem.id] || 0) > 0);

  // Reverse index: How to obtain selectedItem (Recipes producing it)
  const producingRecipes = useMemo(() => {
    if (!selectedItem) return [];
    return recipeList.filter((r) => r.resultItemId === selectedItem.id);
  }, [recipeList, selectedItem]);

  // Forward index: Where selectedItem is used as an ingredient
  const usageRecipes = useMemo(() => {
    if (!selectedItem) return [];
    return recipeList.filter((r) => r.ingredientIds.includes(selectedItem.id));
  }, [recipeList, selectedItem]);

  return (
    <aside className="flex flex-col h-full rounded-2xl border border-stone-800/90 bg-[#110f17]/95 shadow-2xl overflow-hidden">
      {/* Top Header */}
      <div className="p-3.5 border-b border-stone-800/80 bg-gradient-to-r from-amber-950/30 via-stone-900/60 to-purple-950/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-amber-400" />
            <h2 className="font-display font-bold text-sm tracking-wide text-amber-200">
              JEI Гримуар Знаний
            </h2>
          </div>
          <span className="text-[11px] font-mono text-stone-400">
            Открыто:{' '}
            <strong className="text-amber-300">{discoveredSet.size}</strong> / {allItems.length}
          </span>
        </div>

        {/* Search Input */}
        <div className="mt-2.5 relative">
          <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск предмета, монстра, стихии..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-stone-950/90 border border-stone-800 text-xs text-stone-100 placeholder:text-stone-500 focus:outline-none focus:border-amber-500/60"
          />
        </div>

        {/* Category Filter Pills */}
        <div className="mt-2 flex items-center gap-1 overflow-x-auto pb-0.5">
          {[
            { id: 'all', label: 'Все' },
            { id: 'reagent', label: 'Трофеи' },
            { id: 'crafted', label: 'Артефакты' },
            { id: 'catalyst', label: 'Основы' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setKindFilter(tab.id as any)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap ${
                kindFilter === tab.id
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'bg-stone-900/80 text-stone-400 border border-stone-800 hover:text-stone-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Selected Item JEI Inspector (R / U Tabs) */}
      {selectedItem ? (
        <div className="p-3.5 border-b border-stone-800 bg-[#161320]/95 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border ${
                  RARITY_META[selectedItem.rarity].bg
                } ${RARITY_META[selectedItem.rarity].border}`}
              >
                {isSelectedDiscovered ? (
                  <CompositeItemSprite item={selectedItem} size="md" />
                ) : (
                  <span className="font-mono font-bold text-stone-500 text-lg">?</span>
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span
                    className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded border ${
                      RARITY_META[selectedItem.rarity].bg
                    } ${RARITY_META[selectedItem.rarity].border} ${
                      RARITY_META[selectedItem.rarity].text
                    }`}
                  >
                    {RARITY_META[selectedItem.rarity].label}
                  </span>
                  {(inventory[selectedItem.id] || 0) > 0 && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-stone-800 text-stone-200">
                      В сумке: x{inventory[selectedItem.id]}
                    </span>
                  )}
                </div>
                <h3 className="font-semibold text-xs text-stone-100 mt-1 truncate">
                  {isSelectedDiscovered ? selectedItem.name : 'Неизученный реагент (???)'}
                </h3>
              </div>
            </div>

            {isSelectedDiscovered && (
              <div className="flex items-center gap-1 shrink-0">
                {(inventory[selectedItem.id] || 0) > 0 && (
                  <button
                    onClick={() => onAddReagentToCrucible(selectedItem.id)}
                    title="Положить в котел"
                    className="px-2 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-[11px] font-medium flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> В котел
                  </button>
                )}
                {selectedItem.kind === 'crafted' && (
                  <button
                    onClick={() => onInspectStatblock(selectedItem)}
                    title="Открыть D&D Статблок"
                    className="p-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-amber-300 border border-stone-700"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Element Tags */}
          {isSelectedDiscovered && (
            <div className="flex flex-wrap gap-1.5">
              {selectedItem.elements.map((el) => {
                const m = ELEMENT_META[el];
                return (
                  <span
                    key={el}
                    className={`px-2 py-0.5 rounded text-[10px] border ${m.bg} ${m.border} ${m.color} flex items-center gap-1`}
                  >
                    <span>{m.label}</span>
                  </span>
                );
              })}
              <span className="px-2 py-0.5 rounded text-[10px] bg-stone-900 border border-stone-800 text-amber-300 font-mono">
                {selectedItem.goldValue} gp
              </span>
            </div>
          )}

          {/* JEI Mode Switcher: [R] Как получить vs [U] Где используется */}
          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-lg bg-stone-950 border border-stone-800">
            <button
              onClick={() => onSelectJeiItem(selectedItem.id, 'recipe')}
              className={`py-1 px-2 rounded text-[11px] font-mono font-medium transition-colors flex items-center justify-center gap-1.5 ${
                jeiTab === 'recipe'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              <span className="px-1 rounded bg-stone-800 text-[9px] text-amber-400">R</span>
              Источник / Рецепт
            </button>
            <button
              onClick={() => onSelectJeiItem(selectedItem.id, 'uses')}
              className={`py-1 px-2 rounded text-[11px] font-mono font-medium transition-colors flex items-center justify-center gap-1.5 ${
                jeiTab === 'uses'
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              <span className="px-1 rounded bg-stone-800 text-[9px] text-purple-400">U</span>
              Применение ({usageRecipes.length})
            </button>
          </div>

          {/* JEI Tab Content */}
          {jeiTab === 'recipe' ? (
            <div className="space-y-2 text-xs">
              {/* Monster Drop Source */}
              {selectedItem.monsterId && (
                <div className="rounded-lg bg-stone-900/90 border border-stone-800 p-2.5 flex items-center justify-between gap-2">
                  <div>
                    <div className="text-[10px] font-mono uppercase text-stone-400">
                      Дроп с монстра (Harvest СЛ {selectedItem.harvestDc})
                    </div>
                    <div className="font-medium text-stone-200 mt-0.5">
                      {selectedItem.monsterName}
                    </div>
                  </div>
                  <button
                    onClick={() => onJumpToMonster(selectedItem.monsterId!)}
                    className="px-2.5 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-[11px] font-medium flex items-center gap-1 shrink-0"
                  >
                    <Compass className="w-3.5 h-3.5" /> На охоту
                  </button>
                </div>
              )}

              {/* Catalyst Shop Source */}
              {selectedItem.kind === 'catalyst' && (
                <div className="rounded-lg bg-stone-900/90 border border-stone-800 p-2.5 flex items-center justify-between gap-2">
                  <div>
                    <div className="text-[10px] font-mono uppercase text-stone-400">
                      Лавка Алхимика
                    </div>
                    <div className="text-stone-200 text-xs mt-0.5">
                      Базовый катализатор ({selectedItem.goldValue} gp)
                    </div>
                  </div>
                  <button
                    onClick={() => onBuyCatalyst(selectedItem.id)}
                    className="px-2.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-[11px] font-medium flex items-center gap-1"
                  >
                    <ShoppingBag className="w-3.5 h-3.5" /> Купить ({selectedItem.goldValue} gp)
                  </button>
                </div>
              )}

              {/* Crafting Recipes that produce this item */}
              {producingRecipes.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[10px] font-mono uppercase text-stone-400">
                    Открытые формулы синтеза:
                  </div>
                  {producingRecipes.map((rec) => {
                    const st = STATION_LABELS[rec.station];
                    const canCraftAll = rec.ingredientIds.every(
                      (id) => (inventory[id] || 0) > 0
                    );
                    return (
                      <div
                        key={rec.key}
                        className="rounded-lg bg-stone-900/90 border border-stone-800 p-2 flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            title={st.name}
                            className="px-1.5 py-0.5 rounded bg-stone-800 text-[10px] font-mono text-amber-300"
                          >
                            {st.name}
                          </span>
                          {rec.ingredientIds.map((ingId, idx) => {
                            const ing = itemsMap[ingId];
                            if (!ing) return null;
                            return (
                              <React.Fragment key={ingId + idx}>
                                {idx > 0 && <span className="text-stone-500">+</span>}
                                <button
                                  onClick={() => onSelectJeiItem(ing.id, 'recipe')}
                                  className="px-1.5 py-0.5 rounded bg-stone-950 border border-stone-700 hover:border-amber-500/50 text-[11px] flex items-center gap-1"
                                >
                                  <CompositeItemSprite item={ing} size="sm" className="w-4 h-4" />
                                  <span className="truncate max-w-[95px]">{ing.name}</span>
                                </button>
                              </React.Fragment>
                            );
                          })}
                        </div>
                        <button
                          onClick={() =>
                            onLoadFullRecipeToCrucible(rec.station, rec.ingredientIds)
                          }
                          disabled={!canCraftAll}
                          title={
                            canCraftAll
                              ? 'Загрузить ингредиенты в котел'
                              : 'Не хватает ингредиентов в инвентаре'
                          }
                          className={`px-2 py-1 rounded text-[10px] font-mono font-semibold shrink-0 ${
                            canCraftAll
                              ? 'bg-amber-500/25 hover:bg-amber-500/35 text-amber-200 border border-amber-500/40'
                              : 'bg-stone-800/60 text-stone-500 border border-stone-800 cursor-not-allowed'
                          }`}
                        >
                          + На стол
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {!selectedItem.monsterId &&
                selectedItem.kind !== 'catalyst' &&
                producingRecipes.length === 0 && (
                  <div className="text-stone-400 text-[11px] italic">
                    Побочный продукт нестабильной алхимической реакции.
                  </div>
                )}
            </div>
          ) : (
            <div className="space-y-1.5 text-xs max-h-40 overflow-y-auto pr-1">
              {usageRecipes.length > 0 ? (
                usageRecipes.map((rec) => {
                  const resItem = itemsMap[rec.resultItemId];
                  const st = STATION_LABELS[rec.station];
                  if (!resItem) return null;
                  return (
                    <div
                      key={rec.key}
                      className="rounded-lg bg-stone-900/90 border border-stone-800 p-2 flex items-center justify-between gap-1.5"
                    >
                      <div className="flex items-center gap-1 flex-wrap min-w-0">
                        <span className="text-[10px] font-mono text-stone-400" title={st.name}>
                          [{st.name.slice(0, 3)}]
                        </span>
                        {rec.ingredientIds.map((id, i) => {
                          const it = itemsMap[id];
                          if (!it) return null;
                          return (
                            <React.Fragment key={id + i}>
                              {i > 0 && <span className="text-stone-500">+</span>}
                              <button
                                onClick={() => onSelectJeiItem(id, 'recipe')}
                                className={`p-0.5 rounded border ${
                                  id === selectedItem.id
                                    ? 'bg-amber-500/15 border-amber-500/40'
                                    : 'bg-stone-950 border-stone-800'
                                }`}
                              >
                                <CompositeItemSprite item={it} size="sm" className="w-5 h-5" />
                              </button>
                            </React.Fragment>
                          );
                        })}
                        <ArrowRight className="w-3 h-3 text-stone-500 mx-0.5" />
                        <button
                          onClick={() => onSelectJeiItem(resItem.id, 'recipe')}
                          className={`px-2 py-0.5 rounded text-[11px] font-medium border flex items-center gap-1 truncate max-w-[155px] ${
                            RARITY_META[resItem.rarity].bg
                          } ${RARITY_META[resItem.rarity].border} ${
                            RARITY_META[resItem.rarity].text
                          }`}
                        >
                          <CompositeItemSprite item={resItem} size="sm" className="w-4 h-4" />
                          <span className="truncate">{resItem.name}</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-lg bg-stone-900/60 border border-stone-800/80 p-2.5 text-[11px] text-stone-400 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
                  <span>
                    Вы ещё не открыли рецепты с этим компонентом. Положите его в котел и проверьте синергию через Jev!
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="p-3 border-b border-stone-800/80 bg-stone-950/60 text-[11px] text-stone-400 flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>
            Кликните по любому предмету ниже, чтобы посмотреть его источник дропа [R] или рецепты крафта [U].
          </span>
        </div>
      )}

      {/* JEI Item Matrix Grid */}
      <div className="p-3 flex-1 overflow-y-auto">
        <div className="grid grid-cols-4 sm:grid-cols-5 lg:grid-cols-4 xl:grid-cols-5 gap-2">
          {filteredItems.map((item) => {
            const count = inventory[item.id] || 0;
            const isKnown = discoveredSet.has(item.id) || count > 0;
            const rarity = RARITY_META[item.rarity];
            const isSelected = selectedJeiItemId === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onSelectJeiItem(item.id, 'recipe')}
                onContextMenu={(e) => {
                  e.preventDefault();
                  onSelectJeiItem(item.id, 'uses');
                }}
                title={
                  isKnown
                    ? `${item.name} (${rarity.label})\nЛКМ: Как получить [R] | ПКМ: Где используется [U]`
                    : `Неизученный трофей (${item.monsterName || 'Неизвестно'})`
                }
                className={`group relative aspect-square rounded-xl border p-1.5 flex flex-col items-center justify-center transition-all ${
                  isKnown
                    ? `${rarity.bg} ${rarity.border} hover:scale-105`
                    : 'bg-stone-950/70 border-stone-800/70 opacity-55 hover:opacity-85'
                } ${isSelected ? 'ring-2 ring-amber-400 scale-105 z-10' : ''}`}
              >
                {isKnown ? (
                  <CompositeItemSprite item={item} size="md" />
                ) : (
                  <span className="font-mono font-bold text-lg text-stone-600">?</span>
                )}

                <span className="mt-1 text-[9px] leading-tight text-stone-300 line-clamp-1 w-full text-center px-0.5">
                  {isKnown
                    ? item.name.replace('✨ Шедевральный ', '').replace('🩸 Проклятый ', '')
                    : '???'}
                </span>

                {/* Inventory Count Badge */}
                {count > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.2 rounded-full bg-amber-500 text-stone-950 font-mono font-bold text-[10px] shadow">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
};
