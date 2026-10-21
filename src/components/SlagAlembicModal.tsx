import React, { useState } from 'react';
import { GameItem, Rarity } from '../types/game';
import { CompositeItemSprite } from './CompositeItemSprite';
import { sfx } from '../utils/sound';
import { RARITY_META } from '../data/bestiary';

interface SlagAlembicModalProps {
  isOpen: boolean;
  onClose: () => void;
  inventory: Record<string, number>;
  itemsMap: Record<string, GameItem>;
  gold: number;
  onDistillSlag: (recipeId: string, costSlag: number, costGold: number, resultItem: GameItem) => void;
  onFuseRelics: (itemA: GameItem, itemB: GameItem, costGold: number, resultItem: GameItem) => void;
}

interface DistillRecipe {
  id: string;
  name: string;
  desc: string;
  costSlag: number;
  costGold: number;
  icon: string;
  rewardType: 'reagent' | 'bomb' | 'solvent' | 'mutagen';
}

const DISTILL_RECIPES: DistillRecipe[] = [
  {
    id: 'extract_essence',
    name: 'Экстракция Первичной Стихии',
    desc: 'Перегонка шипящего шлака в чистый стихийный экстракт (кислота, огонь, холод или яд).',
    costSlag: 2,
    costGold: 0,
    icon: '🧪',
    rewardType: 'reagent',
  },
  {
    id: 'alembic_bomb',
    name: 'Нестабильная алембик-бомба Скрепа',
    desc: 'Прессование ядовитых осадочных солей в метательный алхимический снаряд (4d6 урона по площади, 15 фт).',
    costSlag: 3,
    costGold: 20,
    icon: '💣',
    rewardType: 'bomb',
  },
  {
    id: 'astral_solvent',
    name: 'Астральный растворитель Дальнего Камня',
    desc: 'Тройная дистилляция через медный змеевик. Идеальный катализатор для высшей трансмутации.',
    costSlag: 4,
    costGold: 35,
    icon: '⚗️',
    rewardType: 'solvent',
  },
  {
    id: 'purified_mutagen',
    name: 'Эликсир Трансмутации Плоти',
    desc: 'Очищенный мутаген для Квика, Нокты или Слоу. Дарует +2 к выбранной характеристике на день.',
    costSlag: 3,
    costGold: 25,
    icon: '🧬',
    rewardType: 'mutagen',
  },
];

export const SlagAlembicModal: React.FC<SlagAlembicModalProps> = ({
  isOpen,
  onClose,
  inventory,
  itemsMap,
  gold,
  onDistillSlag,
  onFuseRelics,
}) => {
  const [activeTab, setActiveTab] = useState<'distill' | 'fuse'>('distill');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [selectedRelicA, setSelectedRelicA] = useState<string | null>(null);
  const [selectedRelicB, setSelectedRelicB] = useState<string | null>(null);

  if (!isOpen) return null;

  const slagCount = inventory.alchemical_slag || 0;

  // List of crafted items available for fusion
  const craftedItems = Object.entries(inventory)
    .filter(([id, count]) => count > 0 && itemsMap[id]?.kind === 'crafted')
    .map(([id]) => itemsMap[id])
    .filter(Boolean);

  const handleRunDistill = (recipe: DistillRecipe) => {
    if (slagCount < recipe.costSlag || gold < recipe.costGold || isProcessing) return;

    setIsProcessing(true);
    sfx.playDistillationBubble();

    setTimeout(() => {
      let createdItem: GameItem;
      const ts = Date.now();

      if (recipe.rewardType === 'reagent') {
        const elementalCandidates = [
          'cube_acid_ooze',
          'chuul_chitin_plate',
          'dragon_scorched_claw',
          'kreym_thunder_herbs',
          'catalyst_crystal_vial',
        ];
        const randomId =
          elementalCandidates[Math.floor(Math.random() * elementalCandidates.length)];
        createdItem = itemsMap[randomId] || itemsMap.catalyst_crystal_vial;
      } else if (recipe.rewardType === 'bomb') {
        createdItem = {
          id: `slag_bomb_${ts}`,
          name: 'Нестабильная алембик-бомба Скрепа',
          nameEn: 'Skrep Volatile Alembic Bomb',
          kind: 'crafted',
          rarity: 'rare',
          icon: '💣',
          material: 'essence',
          elements: ['fire', 'acid'],
          powerLevel: 14,
          goldValue: 120,
          description:
            'Тяжелый медный фиал с осадком перегнанного шлака. При ударе детонирует на 15 футов вокруг.',
          station: 'alchemist',
          archetype: 'volatile_bomb',
          stats: {
            typeLine: 'Чудесный предмет (бомба), редкий',
            damageFormula: '4d6 огненный / кислотный урон (Спасбросок Ловкости СЛ 15)',
            requiresAttunement: false,
            mechanicalEffect:
              'Действием можно метнуть бомбу на расстояние до 60 футов. Существа в радиусе 15 футов получают 4d6 урона (половина при успехе). Наносит двойной урон строениям.',
            loreQuote: '«Не тряси сильно, парень. Скреп еле успел закрутить медный клапан.» — Скреп',
          },
        };
      } else if (recipe.rewardType === 'solvent') {
        createdItem = {
          id: `slag_solvent_${ts}`,
          name: 'Астральный растворитель Дальнего Камня',
          nameEn: 'Far Stone Astral Solvent',
          kind: 'crafted',
          rarity: 'rare',
          icon: '⚗️',
          material: 'crystal',
          elements: ['force', 'radiant'],
          powerLevel: 16,
          goldValue: 160,
          description:
            'Сверхчистая мерцающая эссенция. Очищает любые проклятия и служит универсальным катализатором.',
          station: 'alchemist',
          archetype: 'astral_solvent',
          stats: {
            typeLine: 'Чудесный предмет, редкий',
            requiresAttunement: false,
            mechanicalEffect:
              'При добавлении в тигель снимает эффект нестабильности и гарантирует +3 к броску d20 на следующий крафт.',
            loreQuote: '«Прозрачнее морской слезы на рассвете над Дальним Камнем.»',
          },
        };
      } else {
        // Mutagen
        createdItem = {
          id: `slag_mutagen_${ts}`,
          name: 'Эликсир Глубинной Трансмутации',
          nameEn: 'Deep Sea Mutagen Elixir',
          kind: 'crafted',
          rarity: 'rare',
          icon: '🧬',
          material: 'organ',
          elements: ['acid', 'psychic'],
          powerLevel: 15,
          goldValue: 140,
          description:
            'Густой маслянистый мутаген, временно перестраивающий мышечные волокна и органы восприятия.',
          station: 'alchemist',
          archetype: 'mutagen_elixir',
          stats: {
            typeLine: 'Зелье, редкое',
            requiresAttunement: false,
            mechanicalEffect:
              'Дарует преимущество на все спасброски Силы и Телосложения, а также ночное зрение 60 фт на 8 часов.',
            loreQuote: '«Квик выпил залпом и сказал, что на вкус как копченый осьминог.»',
          },
        };
      }

      onDistillSlag(recipe.id, recipe.costSlag, recipe.costGold, createdItem);
      sfx.playSuccess(false);
      setIsProcessing(false);
    }, 700);
  };

  const handleFuseRelicsSubmit = () => {
    if (!selectedRelicA || !selectedRelicB || selectedRelicA === selectedRelicB) return;
    const itemA = itemsMap[selectedRelicA];
    const itemB = itemsMap[selectedRelicB];
    if (!itemA || !itemB || gold < 50 || isProcessing) return;

    setIsProcessing(true);
    sfx.playDistillationBubble();

    setTimeout(() => {
      const ts = Date.now();
      const combinedElements = Array.from(new Set([...itemA.elements, ...itemB.elements]));
      const highestPower = Math.max(itemA.powerLevel, itemB.powerLevel);

      const fusedItem: GameItem = {
        id: `heritage_relic_${ts}`,
        name: `[Реликвия Наследия] ${itemA.name.replace(/\[.*?\]\s*/g, '')} — ${itemB.name.replace(/\[.*?\]\s*/g, '')}`,
        nameEn: `Heritage Relic: ${itemA.nameEn} of Far Stone`,
        kind: 'crafted',
        rarity: 'artifact',
        icon: '👑',
        material: 'artifact_core',
        elements: combinedElements,
        powerLevel: Math.min(20, highestPower + 4),
        goldValue: (itemA.goldValue + itemB.goldValue) * 2,
        craftGeneration: 3,
        station: 'artificer',
        parentItemNames: [itemA.name, itemB.name],
        description: `Великий реликт Дальнего Камня 3-го тира. Рождён в пламени перегонного куба Скрепа из союза «${itemA.name}» и «${itemB.name}».`,
        stats: {
          typeLine: 'Древний артефакт Дальнего Камня (требует настройки)',
          armorClassBonus: itemA.stats?.armorClassBonus || itemB.stats?.armorClassBonus,
          damageFormula: itemA.stats?.damageFormula || itemB.stats?.damageFormula,
          requiresAttunement: true,
          mechanicalEffect: `Слияние двух наследий: [${itemA.stats?.mechanicalEffect || 'Великая сила 1'}] И [${itemB.stats?.mechanicalEffect || 'Великая сила 2'}]. Носитель получает сопротивление стихиям: ${combinedElements.join(', ')}.`,
          loreQuote: `«Даже дракон Дальнего Камня не видел сокровища прекраснее. Скреп клянётся, что в этом клинке поёт сам мыс.»`,
        },
      };

      onFuseRelics(itemA, itemB, 50, fusedItem);
      sfx.playTransmutationBoom();
      setSelectedRelicA(null);
      setSelectedRelicB(null);
      setIsProcessing(false);
    }, 900);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl bg-stone-900 border-2 border-amber-500/50 rounded-2xl shadow-[0_0_60px_rgba(217,119,6,0.3)] overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header Ribbon */}
        <div className="bg-gradient-to-r from-stone-950 via-amber-950/60 to-stone-950 px-6 py-4 border-b border-amber-500/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-2xl shadow-inner">
              ⚗️
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-serif font-black text-amber-200 text-lg tracking-wide uppercase">
                  Перегонный куб Скрепа
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono">
                  Тигель Дальнего Камня
                </span>
              </div>
              <p className="text-xs text-stone-400">
                Очиститель алхимического шлака и Великая Трансмутация Реликвий
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Slag Counter */}
            <div className="flex items-center gap-2 bg-stone-950/80 px-3 py-1.5 rounded-xl border border-stone-700">
              <span className="text-base">🪨</span>
              <span className="text-xs font-mono text-stone-300">
                Шлак:{' '}
                <span className="font-bold text-amber-400 text-sm">{slagCount} шт.</span>
              </span>
            </div>

            <button
              onClick={onClose}
              className="text-stone-400 hover:text-amber-300 p-1.5 rounded-lg hover:bg-stone-800 transition"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-stone-800 bg-stone-950/50 px-6 pt-2 gap-2">
          <button
            onClick={() => setActiveTab('distill')}
            className={`pb-3 px-4 font-serif text-xs font-bold transition border-b-2 flex items-center gap-2 ${
              activeTab === 'distill'
                ? 'border-amber-500 text-amber-200'
                : 'border-transparent text-stone-400 hover:text-stone-200'
            }`}
          >
            <span>⚗️</span>
            <span>Дистилляция Шлака ({slagCount})</span>
          </button>
          <button
            onClick={() => setActiveTab('fuse')}
            className={`pb-3 px-4 font-serif text-xs font-bold transition border-b-2 flex items-center gap-2 ${
              activeTab === 'fuse'
                ? 'border-amber-500 text-amber-200'
                : 'border-transparent text-stone-400 hover:text-stone-200'
            }`}
          >
            <span>👑</span>
            <span>Слияние Реликвий (Тир-3 Артефакты)</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {activeTab === 'distill' ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-gradient-to-r from-stone-950 to-amber-950/20 border border-amber-500/20 flex items-center gap-4">
                <div className="text-3xl animate-bounce">🔥</div>
                <div className="text-xs text-stone-300">
                  <span className="font-bold text-amber-300 font-serif">
                    Инструкции мастера Скрепа:
                  </span>{' '}
                  «Не выбрасывайте то, что вскипело в тигле! Даже перегоревший шлак содержит крупицы
                  первородных стихий. Пропустите его через змеевик Дальнего Камня и получите
                  гранаты, растворители или чистую эссенцию.»
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {DISTILL_RECIPES.map((recipe) => {
                  const canAfford = slagCount >= recipe.costSlag && gold >= recipe.costGold;
                  return (
                    <div
                      key={recipe.id}
                      className={`p-4 rounded-xl border transition flex flex-col justify-between ${
                        canAfford
                          ? 'bg-stone-950/70 border-stone-700 hover:border-amber-500/50 shadow-md'
                          : 'bg-stone-950/30 border-stone-800 opacity-60'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-2xl p-2 rounded-lg bg-stone-900 border border-stone-800">
                            {recipe.icon}
                          </span>
                          <div>
                            <h4 className="font-serif font-bold text-amber-200 text-sm leading-tight">
                              {recipe.name}
                            </h4>
                            <div className="text-[11px] text-stone-400 flex items-center gap-2 mt-0.5 font-mono">
                              <span className={slagCount >= recipe.costSlag ? 'text-amber-400' : 'text-red-400'}>
                                🪨 {recipe.costSlag} шлака
                              </span>
                              {recipe.costGold > 0 && (
                                <span className={gold >= recipe.costGold ? 'text-amber-300' : 'text-red-400'}>
                                  🪙 {recipe.costGold} зм
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <p className="text-xs text-stone-400 mb-4">{recipe.desc}</p>
                      </div>

                      <button
                        onClick={() => handleRunDistill(recipe)}
                        disabled={!canAfford || isProcessing}
                        className={`w-full py-2 px-3 rounded-lg font-serif text-xs font-bold transition flex items-center justify-center gap-2 ${
                          canAfford && !isProcessing
                            ? 'bg-amber-600 hover:bg-amber-500 text-stone-950 shadow-md'
                            : 'bg-stone-800 text-stone-500 cursor-not-allowed'
                        }`}
                      >
                        {isProcessing ? '⚗️ Идёт перегонка...' : 'Перегнать в кубе'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* FUSION TAB: TIER-3 HERITAGE RELICS */
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-gradient-to-r from-stone-950 to-indigo-950/30 border border-indigo-500/30 flex items-center gap-4">
                <div className="text-3xl">🔮</div>
                <div className="text-xs text-stone-300">
                  <span className="font-bold text-indigo-300 font-serif">
                    Великая Трансмутация Наследия:
                  </span>{' '}
                  Объедините два уже созданных редких изделия партии в единую{' '}
                  <span className="text-rose-400 font-bold">Тир-3 Реликвию Наследия</span>.
                  Скреп направит пламя тигля так, чтобы соединить эффекты обоих предметов в
                  артефакт колоссальной мощи!
                </div>
              </div>

              {craftedItems.length < 2 ? (
                <div className="p-8 text-center border-2 border-dashed border-stone-800 rounded-xl bg-stone-950/30">
                  <p className="text-sm text-stone-400 mb-1">
                    У вас недостаточно созданных предметов для слияния.
                  </p>
                  <p className="text-xs text-stone-500">
                    Сначала создайте минимум 2 предмета в Тигле или Кузне, чтобы разблокировать
                    Великую Трансмутацию!
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Item Selectors */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Relic A */}
                    <div className="p-4 rounded-xl bg-stone-950 border border-stone-800 flex flex-col justify-between">
                      <div className="text-xs font-serif font-bold text-amber-300 mb-2">
                        1. Первый артефакт слияния:
                      </div>
                      <select
                        value={selectedRelicA || ''}
                        onChange={(e) => setSelectedRelicA(e.target.value || null)}
                        className="w-full bg-stone-900 border border-stone-700 rounded-lg p-2 text-xs text-stone-200 focus:outline-none focus:border-amber-500"
                      >
                        <option value="">-- Выберите предмет --</option>
                        {craftedItems.map((item) => (
                          <option
                            key={item.id}
                            value={item.id}
                            disabled={item.id === selectedRelicB}
                          >
                            {item.name} ({RARITY_META[item.rarity].label})
                          </option>
                        ))}
                      </select>
                      {selectedRelicA && itemsMap[selectedRelicA] && (
                        <div className="mt-3 p-2 bg-stone-900/60 rounded border border-stone-800 flex items-center gap-3">
                          <CompositeItemSprite item={itemsMap[selectedRelicA]} size="sm" />
                          <div className="text-[11px] text-stone-300 truncate">
                            <div className="font-bold text-amber-200 truncate">
                              {itemsMap[selectedRelicA].name}
                            </div>
                            <div className="text-stone-400">
                              {itemsMap[selectedRelicA].stats?.typeLine || 'Изделие логова'}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Relic B */}
                    <div className="p-4 rounded-xl bg-stone-950 border border-stone-800 flex flex-col justify-between">
                      <div className="text-xs font-serif font-bold text-indigo-300 mb-2">
                        2. Второй артефакт слияния:
                      </div>
                      <select
                        value={selectedRelicB || ''}
                        onChange={(e) => setSelectedRelicB(e.target.value || null)}
                        className="w-full bg-stone-900 border border-stone-700 rounded-lg p-2 text-xs text-stone-200 focus:outline-none focus:border-indigo-500"
                      >
                        <option value="">-- Выберите предмет --</option>
                        {craftedItems.map((item) => (
                          <option
                            key={item.id}
                            value={item.id}
                            disabled={item.id === selectedRelicA}
                          >
                            {item.name} ({RARITY_META[item.rarity].label})
                          </option>
                        ))}
                      </select>
                      {selectedRelicB && itemsMap[selectedRelicB] && (
                        <div className="mt-3 p-2 bg-stone-900/60 rounded border border-stone-800 flex items-center gap-3">
                          <CompositeItemSprite item={itemsMap[selectedRelicB]} size="sm" />
                          <div className="text-[11px] text-stone-300 truncate">
                            <div className="font-bold text-indigo-200 truncate">
                              {itemsMap[selectedRelicB].name}
                            </div>
                            <div className="text-stone-400">
                              {itemsMap[selectedRelicB].stats?.typeLine || 'Изделие логова'}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Fusion Action Button */}
                  <div className="pt-2">
                    <button
                      onClick={handleFuseRelicsSubmit}
                      disabled={
                        !selectedRelicA ||
                        !selectedRelicB ||
                        selectedRelicA === selectedRelicB ||
                        gold < 50 ||
                        isProcessing
                      }
                      className={`w-full py-3.5 px-6 rounded-xl font-serif text-sm font-bold shadow-xl transition flex items-center justify-center gap-3 ${
                        selectedRelicA &&
                        selectedRelicB &&
                        selectedRelicA !== selectedRelicB &&
                        gold >= 50 &&
                        !isProcessing
                          ? 'bg-gradient-to-r from-amber-600 via-rose-600 to-indigo-600 hover:from-amber-500 hover:to-indigo-500 text-white shadow-rose-950/50'
                          : 'bg-stone-800 text-stone-500 cursor-not-allowed'
                      }`}
                    >
                      <span>✨</span>
                      <span>
                        {isProcessing
                          ? 'Идёт Великая Трансмутация Наследия...'
                          : 'Свершить Великую Трансмутацию (50 Золота)'}
                      </span>
                      <span>👑</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
