import {
  CraftingStation,
  DndStatblock,
  ElementType,
  GameItem,
  JevDecisionTelemetry,
  Rarity,
} from '../types/game';
import { ELEMENT_META, RARITY_META } from '../data/bestiary';

const ALL_ELEMENTS: ElementType[] = [
  'acid',
  'fire',
  'cold',
  'poison',
  'necrotic',
  'psychic',
  'force',
  'lightning',
  'radiant',
];

const ARCHETYPES_BY_STATION: Record<
  CraftingStation,
  Record<
    string,
    {
      nameRu: string;
      nameEn: string;
      gender: 'm' | 'f' | 'n';
      icon: string;
      typeLabel: string;
      baseDice?: string;
      baseAc?: string;
    }
  >
> = {
  alchemist: {
    healing_draught: {
      nameRu: 'Фиал',
      nameEn: 'Draught',
      gender: 'm',
      icon: '🧪',
      typeLabel: 'Зелье',
    },
    deadly_poison: {
      nameRu: 'Токсин',
      nameEn: 'Venom',
      gender: 'm',
      icon: '☠️',
      typeLabel: 'Яд (контактный/оружейный)',
      baseDice: '3d6',
    },
    volatile_bomb: {
      nameRu: 'Алембик-граната',
      nameEn: 'Alchemical Bomb',
      gender: 'f',
      icon: '💣',
      typeLabel: 'Взрывчатый сосуд (радиус 15 футов)',
      baseDice: '4d6',
    },
    weapon_oil: {
      nameRu: 'Масло закалки',
      nameEn: 'Blade Oil',
      gender: 'n',
      icon: '🫙',
      typeLabel: 'Алхимическое масло (на 1 час)',
      baseDice: '1d8',
    },
    mutagen_elixir: {
      nameRu: 'Мутаген',
      nameEn: 'Mutagen Elixir',
      gender: 'm',
      icon: '🧬',
      typeLabel: 'Эликсир трансмутации',
    },
    astral_solvent: {
      nameRu: 'Эссенция',
      nameEn: 'Astral Essence',
      gender: 'f',
      icon: '⚗️',
      typeLabel: 'Концентрированный реагент-растворитель',
    },
  },
  blacksmith: {
    dagger: {
      nameRu: 'Кинжал',
      nameEn: 'Dagger',
      gender: 'm',
      icon: '🗡️',
      typeLabel: 'Оружие (кинжал, фехтовальное, легкое)',
      baseDice: '1d4',
    },
    longsword: {
      nameRu: 'Клинок',
      nameEn: 'Longsword',
      gender: 'm',
      icon: '⚔️',
      typeLabel: 'Оружие (длинный меч, универсальное)',
      baseDice: '1d8',
    },
    warhammer: {
      nameRu: 'Боевой молот',
      nameEn: 'Warhammer',
      gender: 'm',
      icon: '🔨',
      typeLabel: 'Оружие (боевой молот, дробящее)',
      baseDice: '1d10',
    },
    whip: {
      nameRu: 'Плеть',
      nameEn: 'Lash Whip',
      gender: 'f',
      icon: '🪢',
      typeLabel: 'Оружие (кнут, досягаемость 10 футов)',
      baseDice: '1d6',
    },
    breastplate: {
      nameRu: 'Кираса',
      nameEn: 'Cuirass',
      gender: 'f',
      icon: '🦺',
      typeLabel: 'Доспех (средний/тяжелый)',
      baseAc: '15 + Мод. Ловк (макс. 2)',
    },
    shield: {
      nameRu: 'Эгида',
      nameEn: 'Aegis Shield',
      gender: 'f',
      icon: '🛡️',
      typeLabel: 'Доспех (щит)',
      baseAc: '+2 к КД',
    },
  },
  artificer: {
    ring: {
      nameRu: 'Перстень',
      nameEn: 'Signet Ring',
      gender: 'm',
      icon: '💍',
      typeLabel: 'Кольцо',
    },
    wand: {
      nameRu: 'Жезл',
      nameEn: 'Arcane Wand',
      gender: 'm',
      icon: '🪄',
      typeLabel: 'Волшебная палочка / Жезл',
      baseDice: '3d8',
    },
    amulet: {
      nameRu: 'Талисман',
      nameEn: 'Amulet',
      gender: 'm',
      icon: '📿',
      typeLabel: 'Чудесный предмет (амулет)',
    },
    cloak: {
      nameRu: 'Мантия',
      nameEn: 'Cloak',
      gender: 'f',
      icon: '🧥',
      typeLabel: 'Чудесный предмет (плащ)',
      baseAc: '+1 к КД и спасброскам',
    },
    orb: {
      nameRu: 'Сфера',
      nameEn: 'Resonant Orb',
      gender: 'f',
      icon: '🔮',
      typeLabel: 'Чудесный предмет (магическая фокусировка)',
    },
    scroll: {
      nameRu: 'Манускрипт',
      nameEn: 'Runic Scroll',
      gender: 'm',
      icon: '📜',
      typeLabel: 'Свиток высших чар',
      baseDice: '5d6',
    },
  },
};

const ELEMENT_ADJECTIVES: Record<
  ElementType,
  { m: string; f: string; n: string; en: string }
> = {
  acid: { m: 'Разъедающий', f: 'Разъедающая', n: 'Разъедающее', en: 'Corrosive' },
  fire: { m: 'Пламенный', f: 'Пламенная', n: 'Пламенное', en: 'Flaming' },
  cold: { m: 'Леденящий', f: 'Леденящая', n: 'Леденящее', en: 'Glacial' },
  poison: { m: 'Ядовитый', f: 'Ядовитая', n: 'Ядовитое', en: 'Venomous' },
  necrotic: { m: 'Мертвенный', f: 'Мертвенная', n: 'Мертвенное', en: 'Necrotic' },
  psychic: { m: 'Псионический', f: 'Псионическая', n: 'Псионическое', en: 'Psionic' },
  force: { m: 'Астральный', f: 'Астральная', n: 'Астральное', en: 'Astral' },
  lightning: { m: 'Грозовой', f: 'Грозовая', n: 'Грозовое', en: 'Stormforged' },
  radiant: { m: 'Лучезарный', f: 'Лучезарная', n: 'Лучезарное', en: 'Radiant' },
};

const SPECIAL_EFFECT_META: Record<
  string,
  {
    suffixByTier: { low: string; mid: string; high: string };
    suffixEnByTier: { low: string; mid: string; high: string };
    mechanicText: (rarityRank: number, saveDc: number, bonus: number) => string;
  }
> = {
  corrosion: {
    suffixByTier: {
      low: 'Слабого Травления',
      mid: 'Едкого Распада',
      high: 'Абсолютного Растворения',
    },
    suffixEnByTier: {
      low: 'of Minor Etching',
      mid: 'of Caustic Decay',
      high: 'of Total Dissolution',
    },
    mechanicText: (rank, saveDc, bonus) =>
      rank <= 1
        ? `Раз в короткий отдых при попадании окисляет доспех цели: спасбросок Ловкости СЛ ${saveDc}, иначе следующая атака по цели до конца хода идет с бонусом +1.`
        : rank === 2
        ? `При критическом попадании (или 1 раз за бой) разъедает броню: спасбросок Ловкости СЛ ${saveDc}, иначе КД (AC) цели снижается на 1 на 1 минуту.`
        : `При попадании плавит защиту врага: спасбросок Ловкости СЛ ${saveDc}, иначе КД (AC) противника снижается на ${bonus} до ремонта.`,
  },
  phase_shift: {
    suffixByTier: {
      low: 'Мерцающей Тени',
      mid: 'Смещения Силуэта',
      high: 'Фазового Сдвига',
    },
    suffixEnByTier: {
      low: 'of Flickering Blur',
      mid: 'of Displaced Silhouette',
      high: 'of Phase Displacement',
    },
    mechanicText: (rank) =>
      rank <= 1
        ? `Раз в короткий отдых позволяет реакцией создать оптическую рябь, давая атакующему Помеху (Disadvantage) на один удар.`
        : rank === 2
        ? `Дает +1 к проверкам Скрытности, а раз за бой позволяет сместить силуэт на 10 футов бонусным действием.`
        : `Проецирует иллюзорного двойника: атаки по владельцу совершаются с Помехой, а раз в ход можно телепортироваться на 15 футов в тень.`,
  },
  vampiric: {
    suffixByTier: {
      low: 'Кровавой Капли',
      mid: 'Жажды Крови',
      high: 'Кровавой Жатвы',
    },
    suffixEnByTier: {
      low: 'of Blood Drop',
      mid: 'of Thirsting Veins',
      high: 'of Vampiric Harvest',
    },
    mechanicText: (rank, _, bonus) =>
      rank <= 1
        ? `Один раз за короткий отдых при добивании врага дарует владельцу 1d4 временных хитов.`
        : rank === 2
        ? `При критическом ударе или добивании врага восстанавливает владельцу 1d6 + 1 хитов.`
        : `Поглощает жизненную эссенцию: восстанавливает хиты в размере половины нанесенного стихийного урона (+${bonus + 2} временных хитов за убийство).`,
  },
  antimagic: {
    suffixByTier: {
      low: 'Помех Плетения',
      mid: 'Разрыва Чар',
      high: 'Подавления Плетения',
    },
    suffixEnByTier: {
      low: 'of Static Weave',
      mid: 'of Spell Disruption',
      high: 'of Spellbreaker Antimagic',
    },
    mechanicText: (rank, saveDc) =>
      rank <= 1
        ? `Дает бонус +1 к спасброскам против заговоров (Cantrips) и слабых магических ловушек.`
        : rank === 2
        ? `При попадании по магу накладывает Помеху на его следующую проверку Концентрации (СЛ ${saveDc}).`
        : `Гасит магические потоки: позволяет реакцией рассеять заклинание 3-го круга или ниже, либо ослепить мага (Спасбросок Интеллекта СЛ ${saveDc}).`,
  },
  petrification: {
    suffixByTier: {
      low: 'Каменной Пыли',
      mid: 'Тяжести Базальта',
      high: 'Каменного Взора',
    },
    suffixEnByTier: {
      low: 'of Stone Dust',
      mid: 'of Basalt Weight',
      high: 'of Petrifying Gaze',
    },
    mechanicText: (rank, saveDc) =>
      rank <= 1
        ? `Раз за короткий отдых при попадании утяжеляет шаг цели: спасбросок Телосложения СЛ ${saveDc} или её скорость падает на 5 футов на 1 раунд.`
        : rank === 2
        ? `Покрывает врага каменной коркой (1 раз за бой): спасбросок Телосложения СЛ ${saveDc} или скорость цели уменьшается вдвое на 1 минуту.`
        : `Сковывает плоть базальтом: спасбросок Телосложения СЛ ${saveDc}, иначе цель становится Опутанной, а при повторном провале — Окаменевшей.`,
  },
  mind_blast: {
    suffixByTier: {
      low: 'Головной Боли',
      mid: 'Ментального Шума',
      high: 'Взрыва Разума',
    },
    suffixEnByTier: {
      low: 'of Neural Echo',
      mid: 'of Psychic Static',
      high: 'of Cerebral Blast',
    },
    mechanicText: (rank, saveDc) =>
      rank <= 1
        ? `Раз в короткий отдых вызывает звон в ушах цели: спасбросок Мудрости СЛ ${saveDc} или цель получает -1d4 на следующую проверку внимания.`
        : rank === 2
        ? `Раз за бой выпускает пси-импульс: цель проходит спасбросок Интеллекта СЛ ${saveDc} или лишается Реакции до конца хода.`
        : `Испускает волну Дальнего Предела: существа в конусе 15 футов проходят спасбросок Интеллекта СЛ ${saveDc} или становятся Ошеломленными (Stunned) на 1 раунд.`,
  },
  adhesive: {
    suffixByTier: {
      low: 'Липкой Смолы',
      mid: 'Вязкого Захвата',
      high: 'Мертвой Хватки Мимика',
    },
    suffixEnByTier: {
      low: 'of Sticky Resin',
      mid: 'of Viscous Grip',
      high: 'of Adhesive Grasp',
    },
    mechanicText: (rank, saveDc) =>
      rank <= 1
        ? `Рукоять не выскальзывает из ладони: владелец получает преимущество против попыток выбить предмет из рук.`
        : rank === 2
        ? `Раз за короткий отдых приклеивается к щиту или оружию врага: проверка Атлетики СЛ ${saveDc}, чтобы оторваться.`
        : `Мгновенно сковывает врага при касании: цель Захвачена (Grappled, СЛ освобождения ${saveDc}), а обезоружить владельца невозможно.`,
  },
  hellfire: {
    suffixByTier: {
      low: 'Тлеющей Искры',
      mid: 'Яростного Горна',
      high: 'Драконьего Инферно',
    },
    suffixEnByTier: {
      low: 'of Smoldering Spark',
      mid: 'of Blazing Forge',
      high: 'of Draconic Inferno',
    },
    mechanicText: (rank, saveDc, bonus) =>
      rank <= 1
        ? `По команде слабо светится в темноте на 10 футов и раз в отдых опаляет цель на +2 огненного урона.`
        : rank === 2
        ? `Раз за бой воспламеняет цель при попадании: спасбросок Ловкости СЛ ${saveDc} или +1d6 урона огнем в начале её хода.`
        : `Окутывает первородным пламенем: игнорирует обычное сопротивление огню и поджигает цель на ${bonus}d6 урона каждый ход (СЛ ${saveDc}).`,
  },
  regeneration: {
    suffixByTier: {
      low: 'Болотного Тонуса',
      mid: 'Срастания Тканей',
      high: 'Бессмертной Плоти',
    },
    suffixEnByTier: {
      low: 'of Bog Vigor',
      mid: 'of Flesh Mending',
      high: 'of Undying Regeneration',
    },
    mechanicText: (rank, _, bonus) =>
      rank <= 1
        ? `Во время Короткого отдыха позволяет перебросить 1 кость хитов (Hit Die), если выпала 1 или 2.`
        : rank === 2
        ? `Раз за бой бонусным действием восстанавливает 1d6 + 2 хитов за счет тролльего метаболизма.`
        : `Запускает бурное деление клеток: в начале каждого своего хода владелец регенерирует ${bonus + 2} хитов и получает преимущество против яда.`,
  },
};

export function makeRecipeKey(station: CraftingStation, items: GameItem[]): string {
  const sortedIds = items.map((i) => i.id).sort();
  return `${station}:${sortedIds.join('+')}`;
}

function deterministicHash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function normalizeProbabilities<T extends string>(weights: Record<T, number>): Record<T, number> {
  const entries = Object.entries(weights) as [T, number][];
  const sum = entries.reduce((acc, [, v]) => acc + Math.max(0.01, v), 0);
  const result = {} as Record<T, number>;
  for (const [k, v] of entries) {
    result[k] = Number((Math.max(0.01, v) / sum).toFixed(3));
  }
  return result;
}

function computeRarityAndDc(
  reagents: GameItem[],
  volatilityScore: number,
  compatibilityNoul: number
): { rarity: Rarity; dc: number } {
  const avgPower =
    reagents.reduce((sum, r) => sum + r.powerLevel, 0) / Math.max(1, reagents.length);
  const maxPower = Math.max(...reagents.map((r) => r.powerLevel));
  const maxRank = Math.max(...reagents.map((r) => RARITY_META[r.rarity].rank));

  let targetRank = maxRank;

  // Floor based on highest monster CR / powerLevel in the crucible:
  // CR 13-20 (Beholder, Lich, Red Dragon -> powerLevel 12..20) => at least Rare (3) or Very Rare (4)
  if (maxPower >= 14) {
    targetRank = Math.max(targetRank, avgPower >= 13 ? 4 : 3);
  } else if (maxPower >= 7) {
    // CR 7+ (Mind Flayer, Venom Troll -> powerLevel 7..14) => at least Uncommon (2), never Common!
    targetRank = Math.max(targetRank, 2);
  }

  // Synergy upgrades from Jev compatibilityNoul + average power
  if (avgPower >= 16 && compatibilityNoul >= 0.55) targetRank = Math.max(targetRank, 5); // legendary
  else if (avgPower >= 11 && compatibilityNoul >= 0.48) targetRank = Math.max(targetRank, 4); // very_rare
  else if (avgPower >= 5.5 && compatibilityNoul >= 0.42) targetRank = Math.max(targetRank, 3); // rare
  else if (avgPower >= 3 && compatibilityNoul >= 0.5) targetRank = Math.max(targetRank, 2); // uncommon

  if (reagents.length >= 3 && compatibilityNoul >= 0.6) {
    targetRank = Math.min(6, targetRank + 1);
  }

  const rankToRarity: Record<number, Rarity> = {
    1: 'common',
    2: 'uncommon',
    3: 'rare',
    4: 'very_rare',
    5: 'legendary',
    6: 'artifact',
  };

  const rarity = rankToRarity[Math.min(6, Math.max(1, targetRank))];
  const dc = Math.min(
    24,
    Math.max(8, Math.round(7 + avgPower * 0.55 + volatilityScore * 1.6))
  );

  return { rarity, dc };
}

/**
 * Calibrated deterministic System-1 simulation when running without external network or API key,
 * or to enrich raw Jev answers into full telemetry.
 */
export function simulateCalibratedJevDecision(
  station: CraftingStation,
  reagents: GameItem[]
): JevDecisionTelemetry {
  const sorted = [...reagents].sort((a, b) => a.id.localeCompare(b.id));
  const seedKey = makeRecipeKey(station, sorted);
  const hash = deterministicHash(seedKey);

  // 1. Element distribution based on reagent elemental tags
  const elWeights: Record<ElementType, number> = {
    acid: 0.08,
    fire: 0.08,
    cold: 0.08,
    poison: 0.08,
    necrotic: 0.08,
    psychic: 0.08,
    force: 0.08,
    lightning: 0.08,
    radiant: 0.08,
  };

  for (const r of sorted) {
    r.elements.forEach((el, idx) => {
      elWeights[el] += idx === 0 ? 1.45 * (1 + r.powerLevel * 0.05) : 0.85;
    });
  }

  const elProbs = normalizeProbabilities(elWeights);
  const sortedEl = (Object.entries(elProbs) as [ElementType, number][]).sort(
    (a, b) => b[1] - a[1]
  );
  const primaryEl = sortedEl[0][0];
  const secondaryEl =
    sortedEl[1] && sortedEl[1][1] >= 0.22 && sortedEl[1][0] !== primaryEl
      ? sortedEl[1][0]
      : undefined;

  // 2. Archetype distribution based on station & reagent material tags
  const stationArchetypes = Object.keys(ARCHETYPES_BY_STATION[station]);
  const archWeights: Record<string, number> = {};
  stationArchetypes.forEach((k, idx) => {
    archWeights[k] = 0.25 + (((hash >> (idx * 3)) & 7) * 0.08);
  });

  const materials = new Set(sorted.map((r) => r.material));
  if (station === 'alchemist') {
    if (materials.has('blood') || sorted.some((r) => r.id.includes('troll')))
      archWeights.healing_draught += 1.6;
    if (elProbs.poison > 0.25 || elProbs.acid > 0.28) archWeights.deadly_poison += 1.5;
    if (elProbs.fire > 0.25 || materials.has('essence')) archWeights.volatile_bomb += 1.5;
    if (materials.has('ooze')) archWeights.weapon_oil += 1.3;
    if (materials.has('organ')) archWeights.mutagen_elixir += 1.4;
    if (materials.has('crystal') || materials.has('eye')) archWeights.astral_solvent += 1.4;
  } else if (station === 'blacksmith') {
    if (materials.has('bone') && sorted.some((r) => r.powerLevel <= 6))
      archWeights.dagger += 1.6;
    if (materials.has('metal') || materials.has('bone')) archWeights.longsword += 1.45;
    if (materials.has('scale') || materials.has('chitin')) {
      archWeights.breastplate += 1.55;
      archWeights.shield += 1.35;
    }
    if (sorted.some((r) => r.id.includes('tentacle') || r.id.includes('tongue')))
      archWeights.whip += 2.1;
    if (sorted.some((r) => r.powerLevel >= 12)) archWeights.warhammer += 1.25;
  } else {
    if (materials.has('crystal') || sorted.some((r) => r.id.includes('ring')))
      archWeights.ring += 1.65;
    if (materials.has('eye') || sorted.some((r) => r.id.includes('stalk')))
      archWeights.wand += 1.9;
    if (materials.has('organ')) archWeights.amulet += 1.45;
    if (materials.has('hide')) archWeights.cloak += 1.95;
    if (elProbs.psychic > 0.25 || elProbs.force > 0.25) archWeights.orb += 1.5;
    if (materials.has('parchment') || materials.has('essence')) archWeights.scroll += 1.85;
  }

  const archProbs = normalizeProbabilities(archWeights);
  const topArch = Object.entries(archProbs).sort((a, b) => b[1] - a[1])[0][0];

  // 3. Special Effect distribution
  const effectWeights: Record<string, number> = {
    corrosion: 0.15 + elProbs.acid * 2.2,
    phase_shift: 0.15 + elProbs.force * 1.6,
    vampiric: 0.15 + elProbs.necrotic * 1.9,
    antimagic: 0.12 + (sorted.some((r) => r.id.includes('beholder')) ? 2.4 : elProbs.force * 1.1),
    petrification: 0.12 + (sorted.some((r) => r.id.includes('basilisk')) ? 2.5 : elProbs.poison * 0.8),
    mind_blast: 0.12 + elProbs.psychic * 2.3,
    adhesive: 0.12 + (sorted.some((r) => r.id.includes('mimic')) ? 2.4 : 0.1),
    hellfire: 0.15 + elProbs.fire * 2.3 + elProbs.radiant * 0.9,
    regeneration: 0.15 + (sorted.some((r) => r.id.includes('troll')) ? 2.4 : elProbs.poison * 0.9),
  };
  if (sorted.some((r) => r.id.includes('displacer'))) effectWeights.phase_shift += 2.1;

  const effectProbs = normalizeProbabilities(effectWeights);
  const topEffect = Object.entries(effectProbs).sort((a, b) => b[1] - a[1])[0][0];

  // 4. Compatibility (noul) & Volatility (score) & CurseRisk (noul)
  const hasOpposingElements =
    (elProbs.fire > 0.3 && elProbs.cold > 0.3) ||
    (elProbs.radiant > 0.3 && elProbs.necrotic > 0.3);
  const hasSlag = sorted.some((r) => r.kind === 'slag');
  const hasCatalyst = sorted.some((r) => r.kind === 'catalyst');

  const rawCompat = Math.min(
    0.98,
    Math.max(
      0.18,
      0.74 +
        (hasCatalyst ? 0.14 : 0) -
        (hasOpposingElements ? 0.28 : 0) -
        (hasSlag ? 0.22 : 0) +
        (((hash % 17) - 8) * 0.01)
    )
  );

  const avgPower =
    sorted.reduce((sum, r) => sum + r.powerLevel, 0) / Math.max(1, sorted.length);
  const volatilityScore = Math.min(
    5,
    Math.max(
      1,
      Math.round(
        1.4 +
          avgPower * 0.14 +
          (hasOpposingElements ? 1.5 : 0) +
          (hasSlag ? 1.2 : 0) -
          (hasCatalyst ? 0.6 : 0)
      )
    )
  );

  const curseRiskNoul = Number(
    Math.min(
      0.96,
      Math.max(
        0.06,
        0.15 +
          elProbs.necrotic * 0.65 +
          elProbs.psychic * 0.45 +
          (hasSlag ? 0.35 : 0) +
          (avgPower > 14 ? 0.18 : 0)
      )
    ).toFixed(3)
  );

  const { rarity, dc } = computeRarityAndDc(sorted, volatilityScore, rawCompat);

  return {
    source: 'nar-calibrated-sim',
    latencyMs: 68 + (hash % 29),
    isCompatible: { noul: Number(rawCompat.toFixed(3)) },
    volatility: { score: volatilityScore },
    itemArchetype: {
      choice: topArch,
      probabilities: archProbs,
    },
    elementAffinity: {
      choice: primaryEl,
      secondaryElement: secondaryEl,
      probabilities: elProbs,
    },
    specialEffect: {
      choice: topEffect,
      probabilities: effectProbs,
    },
    curseRisk: { noul: curseRiskNoul },
    calculatedDc: dc,
    predictedRarity: rarity,
  };
}

/**
 * Evaluates a combination of reagents via TypeSafe AI Jev (`client.systemOne`)
 * with automatic fallback to the calibrated NAR engine if no API key is configured.
 */
export async function evaluateCrucibleWithJev(
  station: CraftingStation,
  reagents: GameItem[],
  options: { useLiveApi: boolean; apiKey?: string }
): Promise<JevDecisionTelemetry> {
  const sorted = [...reagents].sort((a, b) => a.id.localeCompare(b.id));
  const fallback = simulateCalibratedJevDecision(station, sorted);

  if (!options.useLiveApi) {
    return fallback;
  }

  try {
    const statePayload = {
      station,
      reagents: sorted.map((r) => ({
        id: r.id,
        name: r.nameEn,
        monster: r.monsterName || 'Alchemical Catalyst',
        powerLevel: r.powerLevel,
        material: r.material,
        elements: r.elements,
        description: r.description,
      })),
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (options.apiKey) {
      headers['x-typesafe-api-key'] = options.apiKey;
    }

    const res = await fetch('/api/jev/decide', {
      method: 'POST',
      headers,
      body: JSON.stringify({ state: statePayload }),
    });

    if (!res.ok) {
      return fallback;
    }

    const data = await res.json();
    const ans = data.answers;
    if (!ans) return fallback;

    const compatNoul =
      typeof ans.isCompatible?.noul === 'number'
        ? ans.isCompatible.noul
        : fallback.isCompatible.noul;

    const volScore =
      typeof ans.volatility?.score === 'number'
        ? Math.min(5, Math.max(1, Math.round(ans.volatility.score)))
        : fallback.volatility.score;

    const elChoice = (ans.elementAffinity?.choice as ElementType) || fallback.elementAffinity.choice;
    const elProbs: Record<ElementType, number> =
      ans.elementAffinity?.probabilities || fallback.elementAffinity.probabilities;

    const sortedEl = (Object.entries(elProbs) as [ElementType, number][]).sort(
      (a, b) => b[1] - a[1]
    );
    const secondaryElement =
      sortedEl[1] && sortedEl[1][1] >= 0.22 && sortedEl[1][0] !== elChoice
        ? sortedEl[1][0]
        : undefined;

    const { rarity, dc } = computeRarityAndDc(sorted, volScore, compatNoul);

    return {
      source: 'live-jev',
      latencyMs: data.latencyMs || 85,
      isCompatible: { noul: Number(compatNoul.toFixed(3)) },
      volatility: { score: volScore },
      itemArchetype: {
        choice: ans.itemArchetype?.choice || fallback.itemArchetype.choice,
        probabilities: ans.itemArchetype?.probabilities || fallback.itemArchetype.probabilities,
      },
      elementAffinity: {
        choice: elChoice,
        secondaryElement,
        probabilities: elProbs,
      },
      specialEffect: {
        choice: ans.specialEffect?.choice || fallback.specialEffect.choice,
        probabilities: ans.specialEffect?.probabilities || fallback.specialEffect.probabilities,
      },
      curseRisk: {
        noul:
          typeof ans.curseRisk?.noul === 'number'
            ? Number(ans.curseRisk.noul.toFixed(3))
            : fallback.curseRisk.noul,
      },
      calculatedDc: dc,
      predictedRarity: rarity,
    };
  } catch {
    return fallback;
  }
}

const RARITY_ORDER: Rarity[] = [
  'common',
  'uncommon',
  'rare',
  'very_rare',
  'legendary',
  'artifact',
];

/**
 * Procedural D&D 5e Item Assembler:
 * Converts the typed Jev Decision Telemetry + Roll Outcome into a playable D&D 5e item & statblock.
 */
export function assembleCraftedItem(
  station: CraftingStation,
  reagents: GameItem[],
  telemetry: JevDecisionTelemetry,
  rollOutcome: 'masterwork' | 'success' | 'cursed'
): GameItem {
  const sorted = [...reagents].sort((a, b) => a.id.localeCompare(b.id));
  const recipeKey = makeRecipeKey(station, sorted);

  const stationMap = ARCHETYPES_BY_STATION[station];
  const archKey = stationMap[telemetry.itemArchetype.choice]
    ? telemetry.itemArchetype.choice
    : Object.keys(stationMap)[0];
  const arch = stationMap[archKey];

  const primaryEl = ALL_ELEMENTS.includes(telemetry.elementAffinity.choice)
    ? telemetry.elementAffinity.choice
    : 'force';
  const secondaryEl = telemetry.elementAffinity.secondaryElement;

  const effectKey = SPECIAL_EFFECT_META[telemetry.specialEffect.choice]
    ? telemetry.specialEffect.choice
    : 'corrosion';
  const effect = SPECIAL_EFFECT_META[effectKey];

  // Upgrade rarity by +1 step on Masterwork (Nat 20 or DC+5)
  let finalRarity = telemetry.predictedRarity;
  if (rollOutcome === 'masterwork') {
    const idx = RARITY_ORDER.indexOf(finalRarity);
    if (idx < RARITY_ORDER.length - 1) {
      finalRarity = RARITY_ORDER[idx + 1];
    }
  }

  const rarityRank = RARITY_META[finalRarity].rank;
  // D&D 5e DMG scaling: Common=+0, Uncommon=+1, Rare=+1, Very Rare=+2, Legendary/Artifact=+3
  const magicBonus =
    rarityRank <= 1 ? 0 : rarityRank <= 3 ? 1 : rarityRank === 4 ? 2 : 3;
  // Save DC scaling: Common=11, Uncommon=13, Rare=15, Very Rare=16, Legendary=18, Artifact=19
  const saveDcByRank: Record<number, number> = {
    1: 11,
    2: 13,
    3: 15,
    4: 16,
    5: 18,
    6: 19,
  };
  const saveDc = saveDcByRank[rarityRank] || 13;

  const tierKey: 'low' | 'mid' | 'high' =
    rarityRank <= 1 ? 'low' : rarityRank <= 3 ? 'mid' : 'high';

  const adj = ELEMENT_ADJECTIVES[primaryEl][arch.gender];
  const adjEn = ELEMENT_ADJECTIVES[primaryEl].en;

  const prefixTag =
    rollOutcome === 'masterwork'
      ? '✨ Шедевральный '
      : rollOutcome === 'cursed'
      ? '🩸 Проклятый '
      : '';

  const nameRu = `${prefixTag}${adj} ${arch.nameRu} ${effect.suffixByTier[tierKey]}`.trim();
  const nameEn = `${adjEn} ${arch.nameEn} ${effect.suffixEnByTier[tierKey]}`;

  const elements: ElementType[] =
    secondaryEl && rarityRank >= 2 ? [primaryEl, secondaryEl] : [primaryEl];

  const elLabel1 = ELEMENT_META[primaryEl].label.toLowerCase();
  const elLabel2 =
    secondaryEl && rarityRank >= 2 ? ELEMENT_META[secondaryEl].label.toLowerCase() : null;

  let damageFormula: string | undefined;
  const isMartialWeapon = ['dagger', 'longsword', 'warhammer', 'whip'].includes(archKey);

  if (isMartialWeapon && arch.baseDice) {
    if (rarityRank === 1) {
      damageFormula = `${arch.baseDice} (оружейный) + 1 (${elLabel1}) [Магическое, +0]`;
    } else if (rarityRank === 2) {
      damageFormula = `${arch.baseDice} + 1d4 (${elLabel1})${
        elLabel2 ? ` + 1 (${elLabel2})` : ''
      } [Бонус +1]`;
    } else if (rarityRank === 3) {
      damageFormula = `${arch.baseDice} + 1d6 (${elLabel1})${
        elLabel2 ? ` + 1d4 (${elLabel2})` : ''
      } [Бонус +1]`;
    } else if (rarityRank === 4) {
      damageFormula = `${arch.baseDice} + 2d6 (${elLabel1})${
        elLabel2 ? ` + 1d6 (${elLabel2})` : ''
      } [Бонус +2]`;
    } else {
      damageFormula = `${arch.baseDice} + 3d6 (${elLabel1})${
        elLabel2 ? ` + 1d8 (${elLabel2})` : ''
      } [Бонус +3]`;
    }
  } else if (archKey === 'wand' || archKey === 'scroll') {
    const casterDiceByRank: Record<number, string> = {
      1: `1d4 (${elLabel1}) [Заговор, бонус атаки +0]`,
      2: `1d8 (${elLabel1})${elLabel2 ? ` + 1d4 (${elLabel2})` : ''} [Чары 1-го круга, бонус +1]`,
      3: `2d8 (${elLabel1})${elLabel2 ? ` + 1d6 (${elLabel2})` : ''} [Чары 3-го круга, бонус +1]`,
      4: `4d8 (${elLabel1})${elLabel2 ? ` + 2d6 (${elLabel2})` : ''} [Чары 5-го круга, бонус +2]`,
      5: `6d8 (${elLabel1})${elLabel2 ? ` + 3d6 (${elLabel2})` : ''} [Чары 7-го круга, бонус +3]`,
      6: `8d8 (${elLabel1})${elLabel2 ? ` + 4d6 (${elLabel2})` : ''} [Чары 9-го круга, бонус +3]`,
    };
    damageFormula = casterDiceByRank[rarityRank];
  } else if (archKey === 'volatile_bomb' || archKey === 'deadly_poison') {
    const alchDiceByRank: Record<number, string> = {
      1: `1d4 (${elLabel1}) [Малая доза, СЛ 11]`,
      2: `2d4 (${elLabel1})${elLabel2 ? ` + 1 (${elLabel2})` : ''} [СЛ 13]`,
      3: `3d6 (${elLabel1})${elLabel2 ? ` + 1d4 (${elLabel2})` : ''} [СЛ 15]`,
      4: `5d6 (${elLabel1})${elLabel2 ? ` + 2d6 (${elLabel2})` : ''} [СЛ 16]`,
      5: `7d6 (${elLabel1})${elLabel2 ? ` + 3d6 (${elLabel2})` : ''} [СЛ 18]`,
      6: `10d6 (${elLabel1})${elLabel2 ? ` + 4d6 (${elLabel2})` : ''} [СЛ 19]`,
    };
    damageFormula = alchDiceByRank[rarityRank];
  } else if (archKey === 'weapon_oil') {
    const oilByRank: Record<number, string> = {
      1: `+1 (${elLabel1}) к урону оружия (на 1 минуту)`,
      2: `+1d4 (${elLabel1}) к урону оружия (на 10 минут)`,
      3: `+1d6 (${elLabel1}) к урону оружия (на 1 час, Бонус +1)`,
      4: `+2d6 (${elLabel1}) к урону оружия (на 1 час, Бонус +2)`,
      5: `+3d6 (${elLabel1}) к урону оружия (на 8 часов, Бонус +3)`,
      6: `+4d6 (${elLabel1}) к урону оружия (на 24 часа, Бонус +3)`,
    };
    damageFormula = oilByRank[rarityRank];
  } else if (archKey === 'healing_draught') {
    const healByRank: Record<number, string> = {
      1: `Восстанавливает 1d4 + 1 хитов и дает +1d4 против стихии «${elLabel1}»`,
      2: `Восстанавливает 2d4 + 2 хитов и снимает отравление/кислоту`,
      3: `Восстанавливает 4d4 + 4 хитов и дает сопротивление (${elLabel1}) на 10 мин`,
      4: `Восстанавливает 8d4 + 8 хитов и дает сопротивление (${elLabel1}) на 1 час`,
      5: `Восстанавливает 10d4 + 20 хитов и снимает все проклятия и состояния`,
      6: `Полное исцеление (100% хитов) + иммунитет к стихии «${elLabel1}» на 1 час`,
    };
    damageFormula = healByRank[rarityRank];
  }

  let armorClassBonus: string | undefined;
  if (arch.baseAc) {
    if (rarityRank === 1) {
      armorClassBonus = `${arch.baseAc} (снижает входящий урон стихией «${ELEMENT_META[primaryEl].label}» на 1 ед.)`;
    } else if (rarityRank === 2) {
      armorClassBonus = `${arch.baseAc} (преимущество на спасброски от стихии «${ELEMENT_META[primaryEl].label}»)`;
    } else {
      armorClassBonus = `${arch.baseAc} (магический бонус +${magicBonus}, сопротивление: ${ELEMENT_META[primaryEl].label})`;
    }
  }

  const curseEffect =
    rollOutcome === 'cursed'
      ? `Проклятие нестабильного синтеза (риск Jev ${Math.round(
          telemetry.curseRisk.noul * 100
        )}%): при выбросе 1 на кубике атаки или спасброска владелец получает 1d6 урона стихией «${
          ELEMENT_META[primaryEl].label
        }».`
      : undefined;

  const monsterSources = Array.from(
    new Set(sorted.map((r) => r.monsterName).filter(Boolean))
  );
  const sourceText =
    monsterSources.length > 0
      ? `Выковано из трофеев: ${monsterSources.join(' и ')}.`
      : `Создано в тигле из редких катализаторов.`;

  const stats: DndStatblock = {
    typeLine: `${arch.typeLabel}, ${RARITY_META[finalRarity].label.toLowerCase()}${
      rarityRank >= 3 ? ' (требует настройки)' : ''
    }`,
    damageFormula,
    armorClassBonus,
    savingThrow: `СЛ ${saveDc}`,
    chargesInfo:
      station === 'artificer' && archKey !== 'scroll'
        ? `${rarityRank + 1} зарядов (восстанавливает 1d${Math.max(2, rarityRank)} на рассвете)`
        : archKey === 'scroll'
        ? `1 заряд (одноразовый манускрипт)`
        : undefined,
    requiresAttunement: rarityRank >= 3,
    mechanicalEffect: effect.mechanicText(rarityRank, saveDc, Math.max(1, magicBonus)),
    curseEffect,
    loreQuote: `«${sourceText} Вероятность резонанса стихии ${
      ELEMENT_META[primaryEl].label
    }: ${Math.round((telemetry.elementAffinity.probabilities[primaryEl] || 0.5) * 100)}%.»`,
  };

  const rawGoldSum = sorted.reduce((sum, r) => sum + r.goldValue, 0);
  const goldCapsByRank: Record<number, { min: number; max: number }> = {
    1: { min: 25, max: 75 },
    2: { min: 85, max: 210 },
    3: { min: 220, max: 550 },
    4: { min: 560, max: 1400 },
    5: { min: 1500, max: 3500 },
    6: { min: 3600, max: 7500 },
  };
  const cap = goldCapsByRank[rarityRank] || { min: 50, max: 200 };
  const clampedBaseGold = Math.min(
    cap.max,
    Math.max(cap.min, Math.round(rawGoldSum * (1.1 + rarityRank * 0.25)))
  );
  const goldMultiplier =
    rollOutcome === 'masterwork' ? 1.6 : rollOutcome === 'cursed' ? 0.65 : 1.0;

  const itemId = `crafted_${deterministicHash(recipeKey + '_' + rollOutcome).toString(36)}`;

  return {
    id: itemId,
    name: nameRu,
    nameEn,
    kind: 'crafted',
    rarity: finalRarity,
    icon: arch.icon,
    material: 'artifact_core',
    elements,
    powerLevel: Math.min(20, Math.round(rarityRank * 3.2)),
    goldValue: Math.round(clampedBaseGold * goldMultiplier),
    description: `${stats.typeLine}. ${stats.mechanicalEffect}`,
    station,
    archetype: archKey,
    specialEffect: effectKey,
    stats,
    isMasterwork: rollOutcome === 'masterwork',
    isCursed: rollOutcome === 'cursed',
  };
}
