import { ActivePartyBuff, DailyLairEvent, GameItem } from '../types/game';
import { RARITY_META } from './bestiary';

export const CANONICAL_DAILY_EVENTS: Omit<DailyLairEvent, 'id' | 'day'>[] = [
  {
    title: 'Баркас контрабандистов из Нарвеша',
    badge: 'Торговля • Нарвеш',
    flavor: 'Под покровом ночи к тайной пристани мыса Дальний Камень причалил баркас Кормильца Эмры. Доставлены свежие склянки и заготовки.',
    effectDescription: 'Цены на базовые катализаторы и основы в мастерской снижены на 25% на весь день.',
    iconEmoji: '⛵',
    modifierType: 'discount_catalysts',
    bonusValue: 25,
  },
  {
    title: 'Приливный шторм и вынос глубин',
    badge: 'Находка • Мыс',
    flavor: 'Бушующие волны разбили рифы у Дальнего Камня и выбросили на песчаную косу органические трофеи из водных гротов.',
    effectDescription: 'Смотритель Скреп обнаружил на берегу ценный трофей чууля! Трофей добавлен в вашу сумку.',
    iconEmoji: '🌊',
    modifierType: 'free_reagent',
    bonusItemId: 'chuul_chitin_plate',
  },
  {
    title: 'Эманации Ирвека Сааля',
    badge: 'Некромантия • Ирвек',
    flavor: 'Костяной ворон доставил послание от Лича Ирвека Сааля. Древние формулы темной алхимии сегодня даются легче.',
    effectDescription: 'Сложность (СЛ) трансмутации для всех некротических и ядовитых зелий снижена на 2.',
    iconEmoji: '💀',
    modifierType: 'dc_reduction',
    bonusValue: 2,
  },
  {
    title: 'Гроза над Бастионом Дальнего Камня',
    badge: 'Резонанс • Стихия',
    flavor: 'Грозовые разряды бьют в железные флюгеры бастиона. Искры наполняют воздух силой чистой магии.',
    effectDescription: 'Любая удачная трансмутация сегодня приносит партии дополнительные +100 XP.',
    iconEmoji: '⚡',
    modifierType: 'extra_xp',
    bonusValue: 100,
  },
  {
    title: 'Особый пир Квика в катакомбах',
    badge: 'Мутация • Квик',
    flavor: 'Квик залез в древние погреба Дальнего Камня и сожрал светящуюся кладку личинок. Его желудок урчит от колоссальной сытости.',
    effectDescription: 'Квик начинает день с бонусом +25 временных HP и сопротивлением яду во всех вылазках.',
    iconEmoji: '🍽️',
    modifierType: 'hero_temp_hp',
    bonusValue: 25,
  },
  {
    title: 'Курьер Гильдии Авантюристов',
    badge: 'Контракты • Награда',
    flavor: 'На мыс прибыл гонец с гербовой сургучной печатью. Заказчики срочно ищут редкие алхимические снадобья.',
    effectDescription: 'Все поручения и контракты Гильдии сегодня приносят на +35% больше золота в казну.',
    iconEmoji: '🪙',
    modifierType: 'bonus_bounty_gold',
    bonusValue: 35,
  },
];

export function generateDailyLairEvent(day: number): DailyLairEvent {
  const index = (day - 1) % CANONICAL_DAILY_EVENTS.length;
  const template = CANONICAL_DAILY_EVENTS[index];
  return {
    ...template,
    id: `event_day_${day}_${index}`,
    day,
  };
}

export function computeBuffFromItem(
  item: GameItem,
  targetHeroId: 'quick' | 'nocta' | 'slow',
  currentDay: number
): ActivePartyBuff {
  const rank = RARITY_META[item.rarity].rank;
  const heroName =
    targetHeroId === 'quick' ? 'Квик' : targetHeroId === 'nocta' ? 'Нокта' : 'Слоу';

  let title = `${item.name}`;
  let description = '';
  let emoji = '🧪';
  const statBonus: ActivePartyBuff['statBonus'] = {};

  if (targetHeroId === 'quick') {
    // Mimic Barbarian Glutton eating mutations
    emoji = '🍽️';
    title = `Мутация Обжоры: ${item.name}`;
    const elemName = item.elements[0] || 'acid';
    statBonus.bonusDamagePerRound = 3 + rank * 2;
    statBonus.tempHp = 10 + rank * 8;
    description = `Квик сожрал ${item.name}! Временные HP +${statBonus.tempHp}, а удары наносят +${statBonus.bonusDamagePerRound} урона (${elemName}) в каждом раунде боя.`;
  } else if (targetHeroId === 'nocta') {
    // Shadow monk ki & cloak infusion
    emoji = '🥷';
    title = `Теневой Настой: ${item.name}`;
    statBonus.armorClassBonus = Math.min(3, 1 + Math.floor(rank / 2));
    statBonus.harvestBonus = rank >= 3 ? 2 : 1;
    description = `Нокта медитирует с настоем ${item.name}: защита в тенях повышает КД на +${statBonus.armorClassBonus}, а разделка бестий получает +${statBonus.harvestBonus}.`;
  } else {
    // Half-orc champion weapon oil / battle draft
    emoji = '⚔️';
    title = `Боевая Закалка: ${item.name}`;
    statBonus.attackBonus = 1 + Math.floor(rank / 2);
    statBonus.bonusDamagePerRound = 4 + rank * 3;
    description = `Слоу натёр лезвие вытяжкой ${item.name}: +${statBonus.attackBonus} к броскам атаки и +${statBonus.bonusDamagePerRound} урона за раунд.`;
  }

  return {
    id: `buff_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    heroId: targetHeroId,
    sourceItemId: item.id,
    sourceItemName: item.name,
    sourceItemArchetype: item.archetype,
    elements: item.elements,
    rarity: item.rarity,
    title,
    description,
    durationFights: 3, // lasts for 3 auto-raid battles or encounters
    appliedAtDay: currentDay,
    iconEmoji: emoji,
    statBonus,
  };
}
