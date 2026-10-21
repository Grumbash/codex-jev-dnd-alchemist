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
  onOpenFullCodex?: () => void;
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
  onOpenFullCodex,
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
    <aside className="flex flex-col h-full rounded-2xl border border-[#c9aa72]/30 bg-[#0e1820] shadow-2xl overflow-hidden">
      {/* Top Header — Фолиант Гримуара */}
      <div className="p-3.5 border-b border-[#c9aa72]/25 bg-gradient-to-r from-[#14232c] to-[#0c151c]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-[#d0ad77]" />
            <h2 className="font-display font-bold text-sm tracking-wide text-[#f0ece3]">
              Гримуар Знаний
            </h2>
            {onOpenFullCodex && (
              <button
                onClick={onOpenFullCodex}
                className="px-2 py-0.5 rounded bg-[#182a35] hover:bg-[#223947] border border-[#c9aa72]/40 text-[#e5cb94] text-[10px] font-mono flex items-center gap-1 cursor-pointer transition-colors"
                title="Развернуть полный Каталог-Гримуар на весь экран"
              >
                <span>⛶ Каталог</span>
              </button>
            )}
          </div>
          <span className="text-[11px] font-mono text-[#8ca0ab]">
            Открыто:{' '}
            <strong className="text-[#e5cb94]">{discoveredSet.size}</strong> / {allItems.length}
          </span>
        </div>

        {/* Search Input */}
        <div className="mt-2.5 relative">
          <Search className="w-3.5 h-3.5 text-[#8ca0ab] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по фолианту, бестиям, стихиям..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[#081015] border border-[#233845] text-xs text-[#f0ece3] placeholder:text-[#657a87] focus:outline-none focus:border-[#d0ad77]/60"
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
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap cursor-pointer ${
                kindFilter === tab.id
                  ? 'bg-[#1a2d39] text-[#e5cb94] border border-[#c9aa72]/40 font-bold'
                  : 'bg-[#0a1217] text-[#8ca0ab] border border-[#1e303c] hover:text-[#f0ece3]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Selected Item JEI Inspector (R / U Tabs) */}
      {selectedItem ? (
        <div className="p-3.5 border-b border-[#c9aa72]/20 bg-[#121f28] space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border bg-[#091217] ${
                  RARITY_META[selectedItem.rarity].border
                }`}
              >
                {isSelectedDiscovered ? (
                  <CompositeItemSprite item={selectedItem} size="md" />
                ) : (
                  <span className="font-mono font-bold text-[#5c707d] text-lg">?</span>
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
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#0b141a] border border-[#213543] text-[#e5cb94]">
                      В сумке: ×{inventory[selectedItem.id]}
                    </span>
                  )}
                </div>
                <h3 className="font-semibold text-xs text-[#f0ece3] mt-1 truncate">
                  {isSelectedDiscovered ? selectedItem.name : 'Неизученный реагент (???)'}
                </h3>
              </div>
            </div>

            {isSelectedDiscovered && (
              <div className="flex items-center gap-1 shrink-0">
                {(inventory[selectedItem.id] || 0) > 0 && (
                  <button
                    onClick={() => onAddReagentToCrucible(selectedItem.id)}
                    title="Положить в чашу горнила"
                    className="px-2 py-1 rounded-lg bg-[#1c2e39] hover:bg-[#253e4d] border border-[#c9aa72]/40 text-[#e5cb94] text-[11px] font-medium flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" /> В чашу
                  </button>
                )}
                {selectedItem.kind === 'crafted' && (
                  <button
                    onClick={() => onInspectStatblock(selectedItem)}
                    title="Открыть D&D Статблок"
                    className="p-1.5 rounded-lg bg-[#1c2e39] hover:bg-[#253e4d] text-[#e5cb94] border border-[#c9aa72]/30 cursor-pointer"
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
              <span className="px-2 py-0.5 rounded text-[10px] bg-[#091117] border border-[#213543] text-[#e5cb94] font-mono">
                {selectedItem.goldValue} gp
              </span>
            </div>
          )}

          {/* JEI Mode Switcher: [R] Как получить vs [U] Где используется */}
          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-lg bg-[#091117] border border-[#213543]">
            <button
              onClick={() => onSelectJeiItem(selectedItem.id, 'recipe')}
              className={`py-1 px-2 rounded text-[11px] font-mono font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                jeiTab === 'recipe'
                  ? 'bg-[#182934] text-[#e5cb94] border border-[#c9aa72]/40 font-bold'
                  : 'text-[#8ca0ab] hover:text-[#f0ece3]'
              }`}
            >
              <span className="px-1 rounded bg-[#0b151b] text-[9px] text-[#d0ad77]">R</span>
              Источник / Рецепт
            </button>
            <button
              onClick={() => onSelectJeiItem(selectedItem.id, 'uses')}
              className={`py-1 px-2 rounded text-[11px] font-mono font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                jeiTab === 'uses'
                  ? 'bg-[#182934] text-purple-300 border border-purple-500/40 font-bold'
                  : 'text-[#8ca0ab] hover:text-[#f0ece3]'
              }`}
            >
              <span className="px-1 rounded bg-[#0b151b] text-[9px] text-purple-400">U</span>
              Применение ({usageRecipes.length})
            </button>
          </div>

          {/* JEI Tab Content */}
          {jeiTab === 'recipe' ? (
            <div className="space-y-2 text-xs">
              {/* Monster Drop Source */}
              {selectedItem.monsterId && (
                <div className="rounded-lg bg-[#0c161d] border border-[#213543] p-2.5 flex items-center justify-between gap-2">
                  <div>
                    <div className="text-[10px] font-mono uppercase text-[#8ca0ab]">
                      Трофей монстра (Разделка СЛ {selectedItem.harvestDc})
                    </div>
                    <div className="font-medium text-[#f0ece3] mt-0.5">
                      {selectedItem.monsterName}
                    </div>
                  </div>
                  <button
                    onClick={() => onJumpToMonster(selectedItem.monsterId!)}
                    className="px-2.5 py-1.5 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-500/40 text-emerald-300 text-[11px] font-medium flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    <Compass className="w-3.5 h-3.5" /> На охоту
                  </button>
                </div>
              )}

              {/* Catalyst Shop Source */}
              {selectedItem.kind === 'catalyst' && (
                <div className="rounded-lg bg-[#0c161d] border border-[#213543] p-2.5 flex items-center justify-between gap-2">
                  <div>
                    <div className="text-[10px] font-mono uppercase text-[#8ca0ab]">
                      Лавка Ремесленника
                    </div>
                    <div className="text-[#f0ece3] text-xs mt-0.5">
                      Базовый катализатор ({selectedItem.goldValue} gp)
                    </div>
                  </div>
                  <button
                    onClick={() => onBuyCatalyst(selectedItem.id)}
                    className="px-2.5 py-1.5 rounded-lg bg-[#1a2c38] hover:bg-[#233a4a] border border-[#c9aa72]/40 text-[#e5cb94] text-[11px] font-medium flex items-center gap-1 cursor-pointer"
                  >
                    <ShoppingBag className="w-3.5 h-3.5" /> Купить ({selectedItem.goldValue} gp)
                  </button>
                </div>
              )}

              {/* Crafting Recipes that produce this item */}
              {producingRecipes.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[10px] font-mono uppercase text-[#8ca0ab]">
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
                        className="rounded-lg bg-[#0c161d] border border-[#213543] p-2 flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            title={st.name}
                            className="px-1.5 py-0.5 rounded bg-[#15242f] text-[10px] font-mono text-[#d0ad77]"
                          >
                            {st.name}
                          </span>
                          {rec.ingredientIds.map((ingId, idx) => {
                            const ing = itemsMap[ingId];
                            if (!ing) return null;
                            return (
                              <React.Fragment key={ingId + idx}>
                                {idx > 0 && <span className="text-[#5c707d]">+</span>}
                                <button
                                  onClick={() => onSelectJeiItem(ing.id, 'recipe')}
                                  className="px-1.5 py-0.5 rounded bg-[#091117] border border-[#213543] hover:border-[#d0ad77]/50 text-[11px] flex items-center gap-1 cursor-pointer"
                                >
                                  <CompositeItemSprite item={ing} size="sm" className="w-4 h-4" />
                                  <span className="truncate max-w-[95px] text-[#f0ece3]">{ing.name}</span>
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
                              ? 'Загрузить ингредиенты в чашу'
                              : 'Не хватает ингредиентов в сумке'
                          }
                          className={`px-2 py-1 rounded text-[10px] font-mono font-semibold shrink-0 cursor-pointer ${
                            canCraftAll
                              ? 'bg-[#1c2e39] hover:bg-[#253e4d] text-[#e5cb94] border border-[#c9aa72]/40'
                              : 'bg-[#101920] text-[#556976] border border-[#1b2b36] cursor-not-allowed'
                          }`}
                        >
                          + В чашу
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {!selectedItem.monsterId &&
                selectedItem.kind !== 'catalyst' &&
                producingRecipes.length === 0 && (
                  <div className="text-[#8ca0ab] text-[11px] italic">
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
                      className="rounded-lg bg-[#0c161d] border border-[#213543] p-2 flex items-center justify-between gap-1.5"
                    >
                      <div className="flex items-center gap-1 flex-wrap min-w-0">
                        <span className="text-[10px] font-mono text-[#8ca0ab]" title={st.name}>
                          [{st.name.slice(0, 3)}]
                        </span>
                        {rec.ingredientIds.map((id, i) => {
                          const it = itemsMap[id];
                          if (!it) return null;
                          return (
                            <React.Fragment key={id + i}>
                              {i > 0 && <span className="text-[#5c707d]">+</span>}
                              <button
                                onClick={() => onSelectJeiItem(id, 'recipe')}
                                className={`p-0.5 rounded border cursor-pointer ${
                                  id === selectedItem.id
                                    ? 'bg-[#1a2d39] border-[#d0ad77]'
                                    : 'bg-[#091117] border-[#213543]'
                                }`}
                              >
                                <CompositeItemSprite item={it} size="sm" className="w-5 h-5" />
                              </button>
                            </React.Fragment>
                          );
                        })}
                        <ArrowRight className="w-3 h-3 text-[#5c707d] mx-0.5" />
                        <button
                          onClick={() => onSelectJeiItem(resItem.id, 'recipe')}
                          className={`px-2 py-0.5 rounded text-[11px] font-medium border flex items-center gap-1 truncate max-w-[155px] cursor-pointer ${
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
                <div className="rounded-lg bg-[#0c161d] border border-[#213543] p-2.5 text-[11px] text-[#8ca0ab] flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
                  <span>
                    Вы ещё не открыли рецепты с этим компонентом. Положите его в чашу и рассчитайте синергию через Jev!
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="p-3 border-b border-[#c9aa72]/20 bg-[#091217] text-[11px] text-[#8ca0ab] flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-[#d0ad77] shrink-0" />
          <span>
            Кликните по любому предмету в сетке, чтобы узнать источник получения [R] или рецепты применения [U].
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
                className={`group relative aspect-square rounded-xl border p-1.5 flex flex-col items-center justify-center transition-all cursor-pointer ${
                  isKnown
                    ? `bg-[#0c161d] ${rarity.border} hover:scale-105 hover:border-[#d0ad77]`
                    : 'bg-[#091117]/80 border-[#1c2c36] opacity-55 hover:opacity-85'
                } ${isSelected ? 'ring-2 ring-[#d0ad77] scale-105 z-10' : ''}`}
              >
                {isKnown ? (
                  <CompositeItemSprite item={item} size="md" />
                ) : (
                  <span className="font-mono font-bold text-lg text-[#556976]">?</span>
                )}

                <span className="mt-1 text-[9px] leading-tight text-[#c4d5dd] line-clamp-1 w-full text-center px-0.5">
                  {isKnown
                    ? item.name.replace('✨ Шедевральный ', '').replace('🩸 Проклятый ', '')
                    : '???'}
                </span>

                {/* Inventory Count Badge */}
                {count > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.2 rounded-full bg-[#d0ad77] text-[#0c151c] font-mono font-bold text-[10px] shadow">
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
