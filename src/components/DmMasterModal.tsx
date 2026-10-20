import React, { useState } from 'react';
import {
  Coins,
  Crown,
  Download,
  Gift,
  PlusCircle,
  Sparkles,
  Upload,
  X,
  Zap,
} from 'lucide-react';
import {
  ElementType,
  GameItem,
  MaterialTag,
  Monster,
} from '../types/game';
import { ELEMENT_META, RARITY_META } from '../data/bestiary';
import { CompositeItemSprite, CompositeMonsterSprite } from './CompositeItemSprite';
import { sfx } from '../utils/sound';

interface DmMasterModalProps {
  isOpen: boolean;
  onClose: () => void;
  monsters: Monster[];
  itemsMap: Record<string, GameItem>;
  inventory: Record<string, number>;
  gold: number;
  onGrantItems: (itemIds: string[], countEach?: number) => void;
  onGrantGold: (amount: number) => void;
  onRestoreStamina: () => void;
  onCreateCustomMonster: (
    monster: Monster,
    newItems: GameItem[],
    grantImmediately: boolean
  ) => void;
  onExportCampaignJson: () => string;
  onImportCampaignJson: (rawJson: string) => boolean;
}

const MATERIAL_OPTIONS: { id: MaterialTag; label: string }[] = [
  { id: 'organ', label: 'Орган / Железа' },
  { id: 'bone', label: 'Кость / Рог' },
  { id: 'scale', label: 'Чешуя / Панцирь' },
  { id: 'chitin', label: 'Хитин / Клешня' },
  { id: 'blood', label: 'Кровь / Желчь' },
  { id: 'eye', label: 'Глаз / Линза' },
  { id: 'crystal', label: 'Кристалл / Печать' },
  { id: 'metal', label: 'Реликтовый металл' },
  { id: 'hide', label: 'Шкура / Ткань плаща' },
  { id: 'artifact_core', label: 'Ядро / Ковчег' },
];

export const DmMasterModal: React.FC<DmMasterModalProps> = ({
  isOpen,
  onClose,
  monsters,
  itemsMap,
  inventory,
  gold,
  onGrantItems,
  onGrantGold,
  onRestoreStamina,
  onCreateCustomMonster,
  onExportCampaignJson,
  onImportCampaignJson,
}) => {
  const [activeTab, setActiveTab] = useState<'loot' | 'creator' | 'sync'>('loot');

  // Custom Monster Creator Form State
  const [monsterName, setMonsterName] = useState('Рыцарь Смерти (Dark Grace)');
  const [monsterBiome, setMonsterBiome] = useState('Лагерь у разрушенного города (Лиарен)');
  const [monsterCr, setMonsterCr] = useState<number>(14);
  const [primaryElement, setPrimaryElement] = useState<ElementType>('necrotic');
  const [secondaryElement, setSecondaryElement] = useState<ElementType>('cold');
  const [monsterLore, setMonsterLore] = useState(
    'Полководец пятнадцатитысячного войска монстров на пути через три поселения тавраев.'
  );

  const [drop1Name, setDrop1Name] = useState('Осколок Чёрного Доспеха');
  const [drop1Mat, setDrop1Mat] = useState<MaterialTag>('metal');

  const [drop2Name, setDrop2Name] = useState('Печать Пепельного Похода');
  const [drop2Mat, setDrop2Mat] = useState<MaterialTag>('crystal');

  const [drop3Name, setDrop3Name] = useState('Сердце Неупокоенного Командора');
  const [drop3Mat, setDrop3Mat] = useState<MaterialTag>('artifact_core');

  const [grantOnCreate, setGrantOnCreate] = useState(true);
  const [importText, setImportText] = useState('');
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!monsterName.trim()) return;

    const slug = `custom_${Date.now()}`;
    const item1Id = `${slug}_common`;
    const item2Id = `${slug}_rare`;
    const item3Id = `${slug}_legendary`;

    const newItems: GameItem[] = [
      {
        id: item1Id,
        name: drop1Name.trim() || `Трофей: ${monsterName}`,
        nameEn: 'Custom Trophy I',
        kind: 'reagent',
        rarity: 'common',
        icon: ELEMENT_META[primaryElement].emoji,
        material: drop1Mat,
        elements: [primaryElement],
        powerLevel: Math.max(1, Math.min(20, monsterCr - 2)),
        goldValue: Math.max(25, monsterCr * 7),
        monsterId: slug,
        monsterName: monsterName.trim(),
        harvestDc: Math.max(8, Math.min(15, 8 + Math.floor(monsterCr / 3))),
        description: `Добытый в сессии «Монстры» трофей существа «${monsterName.trim()}» (${monsterBiome}).`,
      },
      {
        id: item2Id,
        name: drop2Name.trim() || `Редкий орган: ${monsterName}`,
        nameEn: 'Custom Trophy II',
        kind: 'reagent',
        rarity: 'rare',
        icon: ELEMENT_META[secondaryElement].emoji,
        material: drop2Mat,
        elements: [primaryElement, secondaryElement],
        powerLevel: Math.max(3, Math.min(20, monsterCr)),
        goldValue: Math.max(70, monsterCr * 15),
        monsterId: slug,
        monsterName: monsterName.trim(),
        harvestDc: Math.max(12, Math.min(19, 11 + Math.floor(monsterCr / 2))),
        description: `Концентрированный реагент из «${monsterName.trim()}», насыщенный стихиями ${ELEMENT_META[primaryElement].label} и ${ELEMENT_META[secondaryElement].label}.`,
      },
      {
        id: item3Id,
        name: drop3Name.trim() || `Сердцевина: ${monsterName}`,
        nameEn: 'Custom Trophy III',
        kind: 'reagent',
        rarity: 'legendary',
        icon: '👑',
        material: drop3Mat,
        elements: [primaryElement, secondaryElement],
        powerLevel: Math.max(6, Math.min(20, monsterCr + 3)),
        goldValue: Math.max(160, monsterCr * 30),
        monsterId: slug,
        monsterName: monsterName.trim(),
        harvestDc: Math.max(16, Math.min(24, 14 + Math.floor(monsterCr / 2))),
        description: `Уникальный реликтовый трофей босса «${monsterName.trim()}», созданный Мастером для партии Дальнего Камня.`,
      },
    ];

    const newMonster: Monster = {
      id: slug,
      name: monsterName.trim(),
      nameEn: monsterName.trim(),
      cr: monsterCr,
      crDisplay: `CR ${monsterCr} • Сцена ГМ`,
      creatureType: 'Особый противник кампании «Монстры»',
      biome: monsterBiome.trim() || 'Восточный континент',
      staminaCost: 2,
      minAlchemistLevel: 1,
      icon: ELEMENT_META[primaryElement].emoji,
      accentColor: 'from-amber-500/25 to-purple-950/40',
      lore: monsterLore.trim() || 'Добавлено ведущим прямо во время игровой сессии.',
      drops: [
        { tier: 'common', dc: newItems[0].harvestDc!, itemId: item1Id },
        { tier: 'rare', dc: newItems[1].harvestDc!, itemId: item2Id },
        { tier: 'legendary', dc: newItems[2].harvestDc!, itemId: item3Id },
      ],
    };

    sfx.playSuccess(true);
    onCreateCustomMonster(newMonster, newItems, grantOnCreate);
    setActiveTab('loot');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-4xl rounded-2xl border border-[#c9aa72]/40 bg-[#0e171e] text-[#f0ece3] p-5 sm:p-6 shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-stone-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/20 border border-amber-400/50 flex items-center justify-center text-amber-300">
              <Crown className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display font-bold text-lg text-amber-200">
                  Панель Ведущего (ГМ) • Кампания «Монстры»
                </h2>
                <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 font-mono text-[10px] text-amber-300">
                  Мир Гильдий • Дальний Камень
                </span>
              </div>
              <p className="text-xs text-stone-400 mt-0.5">
                Выдавайте Квику, Нокте и Слоу трофеи убитых на сессии врагов без траты энергии или создавайте новых боссов на лету
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-400 hover:text-stone-100 border border-stone-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Campaign Treasury Bar */}
        <div className="rounded-xl bg-stone-900/90 border border-stone-800 p-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs">
            <span className="text-stone-400">Текущая казна в тигле:</span>{' '}
            <strong className="font-mono text-amber-300">{gold} gp</strong>
            <span className="text-stone-500 ml-2">
              (В записях логова Дальний Камень числится 33 000 gp сокровищ дракона)
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                sfx.playCoin();
                onGrantGold(500);
              }}
              className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 font-mono text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Coins className="w-3.5 h-3.5" />
              <span>+500 gp</span>
            </button>
            <button
              onClick={() => {
                sfx.playCoin();
                onGrantGold(33000);
              }}
              className="px-3 py-1.5 rounded-lg bg-amber-500/30 hover:bg-amber-500/40 border border-amber-400/60 text-amber-100 font-mono text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              title="Выдать найденные 33 000 золотых из сокровищницы дракона Дальнего Камня"
            >
              <Coins className="w-3.5 h-3.5" />
              <span>Выдать казну Дракона (+33 000 gp)</span>
            </button>
            <button
              onClick={() => {
                sfx.playSuccess(false);
                onRestoreStamina();
              }}
              className="px-3 py-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/40 text-sky-200 font-mono text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Полная Энергия ⚡</span>
            </button>
          </div>
        </div>

        {/* Sub-navigation Tabs */}
        <div className="grid grid-cols-3 gap-2 p-1 rounded-xl bg-stone-950 border border-stone-800">
          <button
            onClick={() => setActiveTab('loot')}
            className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'loot'
                ? 'bg-amber-500/25 text-amber-200 border border-amber-500/50'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <Gift className="w-4 h-4" />
            <span>1. Выдать трофеи партии</span>
          </button>
          <button
            onClick={() => setActiveTab('creator')}
            className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'creator'
                ? 'bg-purple-500/25 text-purple-200 border border-purple-500/50'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            <span>2. Создать монстра со стола</span>
          </button>
          <button
            onClick={() => setActiveTab('sync')}
            className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'sync'
                ? 'bg-emerald-500/25 text-emerald-200 border border-emerald-500/50'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>3. Обмен состоянием с игроками</span>
          </button>
        </div>

        {/* TAB 1: GRANT TROPHIES FROM BESTIARY */}
        {activeTab === 'loot' && (
          <div className="space-y-3 max-h-[52vh] overflow-y-auto pr-1">
            {monsters.map((m) => (
              <div
                key={m.id}
                className="rounded-xl bg-stone-900/80 border border-stone-800 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-stone-950 border border-stone-800 flex items-center justify-center shrink-0">
                    <CompositeMonsterSprite monster={m} size="md" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-display font-bold text-sm text-stone-100">
                        {m.name}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-stone-950 border border-stone-700 font-mono text-[10px] text-amber-300">
                        {m.crDisplay}
                      </span>
                    </div>
                    <p className="text-[11px] text-stone-400">{m.biome}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {m.drops.map((d) => {
                    const it = itemsMap[d.itemId];
                    if (!it) return null;
                    const count = inventory[it.id] || 0;
                    return (
                      <button
                        key={d.itemId}
                        onClick={() => {
                          sfx.playSuccess(false);
                          onGrantItems([it.id], 1);
                        }}
                        className={`px-2.5 py-1.5 rounded-lg border text-[11px] flex items-center gap-1.5 transition-all cursor-pointer ${
                          RARITY_META[it.rarity].bg
                        } ${RARITY_META[it.rarity].border} hover:scale-105`}
                        title={`Выдать +1 «${it.name}» в сумку партии`}
                      >
                        <CompositeItemSprite item={it} size="sm" />
                        <span className="text-stone-100 font-medium max-w-[130px] truncate">
                          +1 {it.name}
                        </span>
                        {count > 0 && (
                          <span className="font-mono text-[10px] text-amber-300">
                            (x{count})
                          </span>
                        )}
                      </button>
                    );
                  })}

                  <button
                    onClick={() => {
                      sfx.playSuccess(true);
                      onGrantItems(
                        m.drops.map((d) => d.itemId),
                        1
                      );
                    }}
                    className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/50 text-emerald-200 font-mono text-[11px] font-bold cursor-pointer"
                  >
                    +Все 3
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB 2: CUSTOM MONSTER & REAGENT CREATOR */}
        {activeTab === 'creator' && (
          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-mono text-stone-400 mb-1">
                  Имя существа / босса со стола:
                </label>
                <input
                  type="text"
                  value={monsterName}
                  onChange={(e) => setMonsterName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-stone-950 border border-stone-800 text-xs text-stone-100"
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] font-mono text-stone-400 mb-1">
                  Уровень опасности (CR 1–25):
                </label>
                <input
                  type="number"
                  min={1}
                  max={25}
                  value={monsterCr}
                  onChange={(e) => setMonsterCr(Number(e.target.value) || 10)}
                  className="w-full px-3 py-2 rounded-xl bg-stone-950 border border-stone-800 text-xs font-mono text-amber-300"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-mono text-stone-400 mb-1">
                  Локация в «Мире Гильдий»:
                </label>
                <input
                  type="text"
                  value={monsterBiome}
                  onChange={(e) => setMonsterBiome(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-stone-950 border border-stone-800 text-xs text-stone-100"
                />
              </div>
              <div>
                <label className="block text-[11px] font-mono text-stone-400 mb-1">
                  Основная стихия:
                </label>
                <select
                  value={primaryElement}
                  onChange={(e) => setPrimaryElement(e.target.value as ElementType)}
                  className="w-full px-3 py-2 rounded-xl bg-stone-950 border border-stone-800 text-xs text-stone-100"
                >
                  {(Object.keys(ELEMENT_META) as ElementType[]).map((el) => (
                    <option key={el} value={el}>
                      {ELEMENT_META[el].emoji} {ELEMENT_META[el].label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-mono text-stone-400 mb-1">
                  Вторичная стихия:
                </label>
                <select
                  value={secondaryElement}
                  onChange={(e) => setSecondaryElement(e.target.value as ElementType)}
                  className="w-full px-3 py-2 rounded-xl bg-stone-950 border border-stone-800 text-xs text-stone-100"
                >
                  {(Object.keys(ELEMENT_META) as ElementType[]).map((el) => (
                    <option key={el} value={el}>
                      {ELEMENT_META[el].emoji} {ELEMENT_META[el].label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-mono text-stone-400 mb-1">
                Описание / заметка из сессии:
              </label>
              <input
                type="text"
                value={monsterLore}
                onChange={(e) => setMonsterLore(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-stone-950 border border-stone-800 text-xs text-stone-200"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div className="p-3 rounded-xl bg-stone-900/90 border border-stone-800 space-y-2">
                <div className="text-[10px] font-mono uppercase text-stone-400">
                  1. Обычный трофей (Common)
                </div>
                <input
                  type="text"
                  value={drop1Name}
                  onChange={(e) => setDrop1Name(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-stone-950 border border-stone-800 text-xs text-stone-100"
                />
                <select
                  value={drop1Mat}
                  onChange={(e) => setDrop1Mat(e.target.value as MaterialTag)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-stone-950 border border-stone-800 text-[11px] text-stone-300"
                >
                  {MATERIAL_OPTIONS.map((m) => (
                    <option key={m.id} value={m.id}>
                      3D форма: {m.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="p-3 rounded-xl bg-sky-950/25 border border-sky-500/40 space-y-2">
                <div className="text-[10px] font-mono uppercase text-sky-300">
                  2. Редкий орган (Rare)
                </div>
                <input
                  type="text"
                  value={drop2Name}
                  onChange={(e) => setDrop2Name(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-stone-950 border border-stone-800 text-xs text-stone-100"
                />
                <select
                  value={drop2Mat}
                  onChange={(e) => setDrop2Mat(e.target.value as MaterialTag)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-stone-950 border border-stone-800 text-[11px] text-stone-300"
                >
                  {MATERIAL_OPTIONS.map((m) => (
                    <option key={m.id} value={m.id}>
                      3D форма: {m.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="p-3 rounded-xl bg-amber-950/25 border border-amber-500/40 space-y-2">
                <div className="text-[10px] font-mono uppercase text-amber-300">
                  3. Легендарное ядро (Legendary)
                </div>
                <input
                  type="text"
                  value={drop3Name}
                  onChange={(e) => setDrop3Name(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-stone-950 border border-stone-800 text-xs text-stone-100"
                />
                <select
                  value={drop3Mat}
                  onChange={(e) => setDrop3Mat(e.target.value as MaterialTag)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-stone-950 border border-stone-800 text-[11px] text-stone-300"
                >
                  {MATERIAL_OPTIONS.map((m) => (
                    <option key={m.id} value={m.id}>
                      3D форма: {m.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <label className="flex items-center gap-2 text-xs text-stone-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={grantOnCreate}
                  onChange={(e) => setGrantOnCreate(e.target.checked)}
                  className="rounded accent-amber-500"
                />
                <span>Сразу выдать по 1 экземпляру каждого трофея в сумку партии</span>
              </label>

              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-stone-950 font-display font-bold text-xs flex items-center gap-2 shadow-lg cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>Добавить в Бестиарий и Гримуар</span>
              </button>
            </div>
          </form>
        )}

        {/* TAB 3: EXPORT / IMPORT STATE FOR PLAYERS */}
        {activeTab === 'sync' && (
          <div className="space-y-4">
            <p className="text-xs text-stone-300 leading-relaxed">
              Скопируйте слепок состояния логова «Дальний Камень» (все реагенты пачки, созданные артефакты, золото и открытые рецепты Гримуара), чтобы передать его Квику, Нокте и Слоу или синхронизировать между устройствами:
            </p>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => {
                  const json = onExportCampaignJson();
                  navigator.clipboard?.writeText(json);
                  setImportText(json);
                  setSyncStatus('✓ JSON-слепок скопирован в буфер обмена!');
                }}
                className="px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-200 text-xs font-semibold flex items-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Скопировать состояние партии в буфер</span>
              </button>

              <button
                onClick={() => {
                  if (!importText.trim()) return;
                  const ok = onImportCampaignJson(importText);
                  setSyncStatus(
                    ok
                      ? '✓ Состояние партии успешно загружено!'
                      : '✕ Ошибка чтения JSON-слепка.'
                  );
                }}
                className="px-4 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/50 text-emerald-200 text-xs font-semibold flex items-center gap-2 cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>Загрузить вставленный JSON</span>
              </button>
            </div>

            {syncStatus && (
              <div className="text-xs font-mono text-amber-300">{syncStatus}</div>
            )}

            <textarea
              rows={6}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="Нажмите «Скопировать состояние» выше или вставьте сюда JSON от ведущего..."
              className="w-full p-3 rounded-xl bg-stone-950 border border-stone-800 font-mono text-[11px] text-stone-300"
            />
          </div>
        )}
      </div>
    </div>
  );
};
