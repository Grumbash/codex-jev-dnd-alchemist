import React, { createContext, useContext, useEffect, useState } from 'react';
import { ElementType, GameItem, Monster, Rarity } from '../types/game';
import { ELEMENT_META, RARITY_META } from '../data/bestiary';

export type Language = 'en' | 'ru';

export const TRANSLATIONS = {
  en: {
    // Top Bar & Branding
    brandTitle: 'GUILD WORLD:',
    brandCrucible: 'CRUCIBLE',
    campaignSubtitle: '«Monsters» Campaign',
    dayPrefix: 'Day',
    location: 'Cape Far Stone',
    masterLabel: 'Master:',
    ambientOn: 'Ambient: ON',
    ambientOff: 'Ambient',
    ambientToastOn: '🌊 Cape Far Stone ambient soundscape enabled (ocean surf & hearth embers).',
    ambientToastOff: '🔇 Cape ambient soundscape muted.',
    tabletopAuto: '🎲 Auto-d20',
    tabletopManual: '🎯 Table ({val})',
    masteryLvl: 'Lvl.',
    energyLabel: 'Energy',
    restButton: 'Rest',
    treasuryLabel: 'Treasury',
    gmMode: 'GM Mode',
    gmRole: 'GM',
    playerRole: 'Player',
    foundryBtn: 'Foundry',
    settingsBtn: 'Settings',

    // Language switcher
    language: 'Language',
    currentLanguageLabel: 'EN',
    switchToRu: 'Переключить на русский',
    switchToEn: 'Switch to English',

    // Settings Menu
    settingsMenuTitle: 'Workshop Settings',
    sdkKey: 'TypeSafe Jev SDK Key',
    soundEffects: 'Sound Effects',
    capeAmbient: 'Cape Ambient Soundscape',
    statusOn: 'ON',
    statusOff: 'OFF',
    resetProgress: 'Reset Progress',
    resetConfirm: 'Reset all Grimoire progress and start anew from Day 1?',

    // Navigation Tabs (5 Core Screens)
    tabCrucible: '1. Crucible',
    tabCodex: '2. Grimoire',
    tabBestiary: '3. Bestiary',
    tabParty: '4. Party',
    tabBounties: '5. Bounties',

    // Daily Lair Event & Buffs Strip
    activeMutationsTitle: 'Active Party Mutations & Potions',
    activeMutationsSub: 'Lasts 3 raid battles or until dispelled',
    noActiveMutations: '🧪 No active mutations. Click any potion or trophy in your bag or statblock to apply to a hero.',
    heroesHint: 'Heroes: 🍽️ Quick, 🥷 Nocta, ⚔️ Slow',
    fightsLeft: '{count} b.',
    dismissBuff: 'Dismiss effect',
    dayRestBtn: 'Day Rest',
    dayRestTooltip: 'End the day and recover in the Bastion (20 gp)',

    // Tabletop Physical Dice Tray
    tabletopTrayTitle: 'Physical Tabletop d20 Tray: enter the roll from your physical dice or Foundry chat',
    activeHeroLabel: 'Active character:',
    craftBonusLabel: 'Craft',
    harvestBonusLabel: 'Harvest',

    // Roll Result Banner
    rollTotalLabel: 'd20 total',
    dieRollLabel: 'Die:',
    disadvantageLabel: 'disadvantage of {r1}, {r2}',
    modifierLabel: 'Modifier',
    extraBonusLabel: 'Bonus',
    dcLabel: 'DC',
    openStatblockBtn: 'Open D&D Statblock',

    // Screen 1: Crucible
    workshopTitle: 'Far Stone Workshop • Synthesis Station',
    workshopSub: 'Station selection sets the itemArchetype matrix for the Jev model',
    stationAlchemist: 'Alchemy',
    stationAlchemistSub: 'Potions, Poisons, Mutagens',
    stationBlacksmith: 'Blacksmith',
    stationBlacksmithSub: 'Blades, Hammers, Armor',
    stationArtificer: 'Artificer',
    stationArtificerSub: 'Rings, Wands, Robes',
    stationSkrep: 'Skrep Cube',
    stationSkrepSub: 'Slag & Relics',
    crucibleCauldronTitle: 'Crucible Cauldron',
    clearCauldronBtn: 'Clear cauldron',
    componentSlot: 'Component {num}',
    selectInBagHint: 'Select in bag',
    removeSlotHint: '(remove ✕)',
    readyToSynthesize: 'Ready to synthesize!',
    addReagentsPrompt: 'Select reagents below or in the JEI sidebar',
    synthesizeBtn: 'SYNTHESIZE (1⚡)',
    synthesizingBtn: 'Synthesizing...',
    roll3dD20Btn: 'Roll 3D d20',
    dcNotice: 'Base DC {dc} • Roll 1d20 + Craft Bonus vs DC',
    disadvantageWarning: 'Exhausted: rolling with DISADVANTAGE! (Rest to restore stamina)',

    // Adventurer's Bag
    bagTitle: 'Far Stone Adventurer\'s Bag',
    bagSub: 'Reagents, catalysts and synthesized relics available for crafting and export',
    filterAll: 'All',
    filterReagents: 'Reagents',
    filterCatalysts: 'Catalysts',
    filterCrafted: 'Artifacts',
    searchBagPlaceholder: 'Search by item, monster, rarity, element...',
    emptyBagMsg: 'No matching items in bag.',
    addToCrucibleBtn: 'To Crucible',
    applyHeroBtn: 'On Hero',
    inspectBtn: 'Inspect',
    sellBtn: 'Sell',

    // JEI Codex Sidebar
    jeiTitle: 'JEI Grimoire Codex',
    jeiSub: 'Interactive recipe index',
    jeiSearchPlaceholder: 'Search recipes and drops...',
    jeiTabRecipe: 'Recipe',
    jeiTabUses: 'Uses in Craft',
    jeiTabDrops: 'Monster Drops',
    jeiSelectPrompt: 'Select an item from the list to view its synthesis recipe, components, and monster drops.',
    loadRecipeBtn: 'Load Recipe to Crucible',
    jumpToMonsterBtn: 'Hunt in Bestiary',
    buyCatalystBtn: 'Buy Catalyst',
    discoveredLabel: 'Discovered',
    undiscoveredLabel: 'Undiscovered',

    // Station modal / Alembic / General
    closeBtn: 'Close',
    copyBtn: 'Copy',
    copiedBtn: 'Copied!',
    goldSuffix: 'gp',
    levelShort: 'Lvl.',
  },
  ru: {
    // Top Bar & Branding
    brandTitle: 'МИР ГИЛЬДИЙ:',
    brandCrucible: 'ТИГЕЛЬ',
    campaignSubtitle: 'Кампания «Монстры»',
    dayPrefix: 'День',
    location: 'Мыс Дальний Камень',
    masterLabel: 'Мастер:',
    ambientOn: 'Эмбиент: ВКЛ',
    ambientOff: 'Эмбиент',
    ambientToastOn: '🌊 Атмосферный эмбиент Мыса Дальний Камень включен (прибой океана и угли логова).',
    ambientToastOff: '🔇 Эмбиент мыса выключен.',
    tabletopAuto: '🎲 Авто-d20',
    tabletopManual: '🎯 Стол ({val})',
    masteryLvl: 'Ур.',
    energyLabel: 'Энергия',
    restButton: 'Отдых',
    treasuryLabel: 'Казна',
    gmMode: 'Режим ГМ',
    gmRole: 'ГМ',
    playerRole: 'Игрок',
    foundryBtn: 'Foundry',
    settingsBtn: 'Настройки',

    // Language switcher
    language: 'Язык',
    currentLanguageLabel: 'RU',
    switchToRu: 'Переключить на русский',
    switchToEn: 'Switch to English',

    // Settings Menu
    settingsMenuTitle: 'Настройки мастерской',
    sdkKey: 'Ключ TypeSafe Jev SDK',
    soundEffects: 'Звуковые эффекты',
    capeAmbient: 'Эмбиент мыса',
    statusOn: 'ВКЛ',
    statusOff: 'ВЫКЛ',
    resetProgress: 'Сбросить прогресс',
    resetConfirm: 'Сбросить весь прогресс Гримуара и начать заново?',

    // Navigation Tabs (5 Core Screens)
    tabCrucible: '1. Тигель',
    tabCodex: '2. Гримуар',
    tabBestiary: '3. Бестиарий',
    tabParty: '4. Отряд',
    tabBounties: '5. Поручения',

    // Daily Lair Event & Buffs Strip
    activeMutationsTitle: 'Живые мутации и зелья отряда',
    activeMutationsSub: 'Действуют 3 боя в вылазках или до снятия',
    noActiveMutations: '🧪 Мутации отряда не активны. Нажмите на зелье или трофей в статблоке или сумке, чтобы применить эффект на героя.',
    heroesHint: 'Герои: 🍽️ Квик, 🥷 Нокта, ⚔️ Слоу',
    fightsLeft: '{count} б.',
    dismissBuff: 'Снять эффект',
    dayRestBtn: 'Отдых дня',
    dayRestTooltip: 'Завершить день и восстановить силы в Бастионе (20 gp)',

    // Tabletop Physical Dice Tray
    tabletopTrayTitle: 'Лоток d20 со стола: укажите выпавшее число с вашего физического кубика или чата Foundry',
    activeHeroLabel: 'Активный персонаж:',
    craftBonusLabel: 'Крафт',
    harvestBonusLabel: 'Разделка',

    // Roll Result Banner
    rollTotalLabel: 'd20 итог',
    dieRollLabel: 'Кубик:',
    disadvantageLabel: 'помеха из {r1}, {r2}',
    modifierLabel: 'Модификатор',
    extraBonusLabel: 'Бонус',
    dcLabel: 'СЛ',
    openStatblockBtn: 'Открыть D&D Статблок',

    // Screen 1: Crucible
    workshopTitle: 'Мастерская Дальнего Камня • Станок синтеза',
    workshopSub: 'Выбор станка задает матрицу архетипов choice(itemArchetype) для модели Jev',
    stationAlchemist: 'Алхимия',
    stationAlchemistSub: 'Зелья, Яды, Мутагены',
    stationBlacksmith: 'Кузня',
    stationBlacksmithSub: 'Клинки, Молоты, Латы',
    stationArtificer: 'Артефакторика',
    stationArtificerSub: 'Кольца, Жезлы, Мантии',
    stationSkrep: 'Куб Скрепа',
    stationSkrepSub: 'Шлак & Реликвии',
    crucibleCauldronTitle: 'Чаша Горнила',
    clearCauldronBtn: 'Очистить чашу',
    componentSlot: 'Компонент {num}',
    selectInBagHint: 'Выберите в сумке',
    removeSlotHint: '(убрать ✕)',
    readyToSynthesize: 'Готово к синтезу!',
    addReagentsPrompt: 'Выберите реагенты ниже или в боковом JEI',
    synthesizeBtn: 'СИНТЕЗИРОВАТЬ (1⚡)',
    synthesizingBtn: 'Синтез...',
    roll3dD20Btn: 'Бросить 3D d20',
    dcNotice: 'Базовая СЛ {dc} • Бросок 1d20 + Бонус крафта против СЛ',
    disadvantageWarning: 'Истощение: бросок с ПОМЕХОЙ! (Отдохните для восстановления энергии)',

    // Adventurer's Bag
    bagTitle: 'Походная сумка Дальнего Камня',
    bagSub: 'Добытые трофеи, покупные катализаторы и созданные артефакты',
    filterAll: 'Все',
    filterReagents: 'Трофеи',
    filterCatalysts: 'Катализаторы',
    filterCrafted: 'Артефакты',
    searchBagPlaceholder: 'Поиск по названию, монстру, редкости, стихии...',
    emptyBagMsg: 'В сумке нет подходящих предметов.',
    addToCrucibleBtn: 'В тигель',
    applyHeroBtn: 'На героя',
    inspectBtn: 'Осмотреть',
    sellBtn: 'Продать',

    // JEI Codex Sidebar
    jeiTitle: 'JEI Гримуар-Справочник',
    jeiSub: 'Интерактивный индекс рецептов',
    jeiSearchPlaceholder: 'Поиск рецептов и трофеев...',
    jeiTabRecipe: 'Рецепт',
    jeiTabUses: 'Где применить',
    jeiTabDrops: 'Добыча с монстров',
    jeiSelectPrompt: 'Выберите предмет из списка, чтобы увидеть формулу синтеза, ингредиенты и монстров-источников.',
    loadRecipeBtn: 'Загрузить рецепт в тигель',
    jumpToMonsterBtn: 'Охотиться в бестиарии',
    buyCatalystBtn: 'Купить катализатор',
    discoveredLabel: 'Открыто',
    undiscoveredLabel: 'Не открыто',

    // Station modal / Alembic / General
    closeBtn: 'Закрыть',
    copyBtn: 'Скопировать',
    copiedBtn: 'Скопировано!',
    goldSuffix: 'gp',
    levelShort: 'Ур.',
  },
};

export type TranslationKey = keyof typeof TRANSLATIONS['en'];

interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  toggleLang: () => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  getItemName: (item?: { name: string; nameEn?: string } | null) => string;
  getMonsterName: (monster?: { name: string; nameEn?: string } | null) => string;
  getRarityLabel: (rarity: Rarity) => string;
  getElementLabel: (element: ElementType) => string;
  getElementName: (element: ElementType) => string;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

const STORAGE_LANG_KEY = 'jev_alchemist_lang';

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // DEFAULT TO ENGLISH as requested by the user: "сделать по дефолту английский"
  const [lang, setLangState] = useState<Language>(() => {
    if (typeof window === 'undefined') return 'en';
    const saved = localStorage.getItem(STORAGE_LANG_KEY);
    return saved === 'ru' ? 'ru' : 'en';
  });

  const setLang = (nextLang: Language) => {
    setLangState(nextLang);
    try {
      localStorage.setItem(STORAGE_LANG_KEY, nextLang);
    } catch {
      // ignore
    }
  };

  const toggleLang = () => {
    setLang(lang === 'en' ? 'ru' : 'en');
  };

  const t = (key: TranslationKey, params?: Record<string, string | number>): string => {
    const dict = TRANSLATIONS[lang] || TRANSLATIONS['en'];
    let str = dict[key] || TRANSLATIONS['en'][key] || String(key);
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      });
    }
    return str;
  };

  const getItemName = (item?: { name: string; nameEn?: string } | null): string => {
    if (!item) return '';
    if (lang === 'en') {
      return item.nameEn || item.name;
    }
    return item.name || item.nameEn || '';
  };

  const getMonsterName = (monster?: { name: string; nameEn?: string } | null): string => {
    if (!monster) return '';
    if (lang === 'en') {
      return monster.nameEn || monster.name;
    }
    return monster.name || monster.nameEn || '';
  };

  const getRarityLabel = (rarity: Rarity): string => {
    const meta = RARITY_META[rarity];
    if (!meta) return rarity;
    return lang === 'en' ? meta.labelEn : meta.label;
  };

  const getElementLabel = (element: ElementType): string => {
    const meta = ELEMENT_META[element];
    if (!meta) return element;
    return lang === 'en' ? meta.labelEn : meta.label;
  };

  return (
    <LanguageContext.Provider
      value={{
        lang,
        setLang,
        toggleLang,
        t,
        getItemName,
        getMonsterName,
        getRarityLabel,
        getElementLabel,
        getElementName: getElementLabel,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return ctx;
};
