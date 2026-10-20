import React, { useMemo, useState } from 'react';
import {
  Award,
  Coins,
  Dices,
  Flame,
  Heart,
  Shield,
  Skull,
  Sparkles,
  Swords,
  Trash2,
  UserCheck,
  Zap,
} from 'lucide-react';
import {
  ElementType,
  GameItem,
  HeroLoadout,
  HeroSlotType,
  Monster,
} from '../types/game';
import { ELEMENT_META, RARITY_META } from '../data/bestiary';
import { GUILD_WORLD_HEROES, PartyHeroProfile } from '../data/guildWorldCampaign';
import { CompositeItemSprite, CompositeMonsterSprite } from './CompositeItemSprite';
import { sfx } from '../utils/sound';

export function getHeroSlotForItem(item: GameItem): HeroSlotType | null {
  if (item.kind !== 'crafted') return null;
  switch (item.archetype) {
    case 'dagger':
    case 'longsword':
    case 'warhammer':
    case 'whip':
    case 'wand':
      return 'weapon';
    case 'shield':
    case 'orb':
    case 'scroll':
    case 'weapon_oil':
      return 'offhand';
    case 'breastplate':
      return 'armor';
    case 'cloak':
      return 'cloak';
    case 'amulet':
    case 'ring':
      return 'jewelry';
    case 'healing_draught':
    case 'deadly_poison':
    case 'volatile_bomb':
    case 'mutagen_elixir':
    case 'astral_solvent':
    default:
      return 'belt';
  }
}

const SLOT_META: Record<
  HeroSlotType,
  { label: string; sub: string; allowedHint: string }
> = {
  weapon: {
    label: 'Правая рука (Оружие)',
    sub: 'Клинки, молоты, плети, жезлы',
    allowedHint: 'dagger, longsword, warhammer, whip, wand',
  },
  offhand: {
    label: 'Левая рука (Щит / Фокус)',
    sub: 'Эгиды, сферы, свитки, масла',
    allowedHint: 'shield, orb, scroll, weapon_oil',
  },
  armor: {
    label: 'Доспех (Торс)',
    sub: 'Кирасы и чешуйчатая броня',
    allowedHint: 'breastplate',
  },
  cloak: {
    label: 'Плечи (Мантия)',
    sub: 'Плащи смещения и защиты',
    allowedHint: 'cloak',
  },
  jewelry: {
    label: 'Реликвия (Кольцо / Амулет)',
    sub: 'Перстни и талисманы',
    allowedHint: 'ring, amulet',
  },
  belt: {
    label: 'Пояс (Зелье / Бомба)',
    sub: 'Фиалы, яды, гранаты, мутагены',
    allowedHint: 'healing_draught, volatile_bomb, deadly_poison, mutagen_elixir',
  },
};

interface CombatLogEntry {
  round: number;
  actor: 'hero' | 'monster' | 'system';
  text: string;
  highlight?: 'crit' | 'effect' | 'heal' | 'danger' | 'victory';
}

interface HeroRaidPanelProps {
  alchemistLevel: number;
  proficiencyBonus: number;
  stamina: number;
  itemsCatalog: Record<string, GameItem>;
  inventory: Record<string, number>;
  loadout: HeroLoadout;
  monsters: Monster[];
  activeHeroId?: PartyHeroProfile['id'];
  onSelectHero?: (heroId: PartyHeroProfile['id']) => void;
  onEquipSlot: (slot: HeroSlotType, itemId: string | undefined) => void;
  onInspectItem: (item: GameItem) => void;
  onCompleteRaid: (result: {
    victory: boolean;
    monster: Monster;
    lootItemIds: string[];
    goldEarned: number;
    xpEarned: number;
    staminaSpent: number;
  }) => void;
}

export const HeroRaidPanel: React.FC<HeroRaidPanelProps> = ({
  alchemistLevel,
  proficiencyBonus,
  stamina,
  itemsCatalog,
  inventory,
  loadout,
  monsters,
  activeHeroId = 'quick',
  onSelectHero,
  onEquipSlot,
  onInspectItem,
  onCompleteRaid,
}) => {
  const [selectedMonsterId, setSelectedMonsterId] = useState<string>(monsters[0]?.id || 'chuul_water_passage');
  const [pickingSlot, setPickingSlot] = useState<HeroSlotType | null>(null);
  const [combatLogs, setCombatLogs] = useState<CombatLogEntry[]>([]);
  const [raidOutcome, setRaidOutcome] = useState<{
    victory: boolean;
    heroHpLeft: number;
    monsterHpLeft: number;
    lootIds: string[];
    gold: number;
    xp: number;
  } | null>(null);

  const activeHero = useMemo(
    () => GUILD_WORLD_HEROES.find((h) => h.id === activeHeroId) || GUILD_WORLD_HEROES[0],
    [activeHeroId]
  );

  const equippedItems = useMemo(() => {
    const res: Partial<Record<HeroSlotType, GameItem>> = {};
    (Object.keys(SLOT_META) as HeroSlotType[]).forEach((slot) => {
      const id = loadout[slot];
      if (id && itemsCatalog[id]) {
        res[slot] = itemsCatalog[id];
      }
    });
    return res;
  }, [loadout, itemsCatalog]);

  // Compute D&D 5e Hero Combat Stats from Foundry Base Sheet + Equipped Crafted Items
  const heroStats = useMemo(() => {
    let maxHp = activeHero.baseHp;
    let ac = activeHero.baseAc;
    let attackBonus = activeHero.attackBonus;
    const baseHitAvg =
      activeHero.baseDamageDice === '2d6'
        ? 7 + activeHero.baseDamageBonus
        : 4.5 + activeHero.baseDamageBonus;
    let avgDamage = baseHitAvg * activeHero.attacksPerRound;
    const elements = new Set<ElementType>();
    const effects = new Set<string>();

    (Object.values(equippedItems) as (GameItem | undefined)[]).forEach((it) => {
      if (!it) return;
      const rank = RARITY_META[it.rarity].rank;
      it.elements.forEach((e) => elements.add(e));
      if (it.specialEffect) effects.add(it.specialEffect);

      const slot = getHeroSlotForItem(it);
      if (slot === 'weapon') {
        attackBonus += Math.max(1, Math.floor(rank / 2));
        avgDamage += rank * 4.5 + (it.isMasterwork ? 4 : 0);
      } else if (slot === 'offhand') {
        if (it.archetype === 'shield') {
          ac += 1 + Math.floor(rank / 2);
        } else {
          attackBonus += Math.ceil(rank / 2);
          avgDamage += rank * 2.5;
        }
      } else if (slot === 'armor') {
        ac += Math.max(1, Math.floor(rank / 2));
        maxHp += rank * 6;
      } else if (slot === 'cloak') {
        ac += 1 + Math.floor(rank / 3);
      } else if (slot === 'jewelry') {
        maxHp += rank * 7;
        attackBonus += Math.floor(rank / 2);
      } else if (slot === 'belt') {
        maxHp += rank * 5;
        avgDamage += rank * 2.5;
      }
    });

    return {
      maxHp,
      ac: Math.min(28, ac),
      attackBonus,
      avgDamage: Math.round(avgDamage),
      elements: Array.from(elements),
      effects: Array.from(effects),
    };
  }, [equippedItems, activeHero, alchemistLevel, proficiencyBonus]);

  const selectedMonster = useMemo(
    () => monsters.find((m) => m.id === selectedMonsterId) || monsters[0],
    [monsters, selectedMonsterId]
  );

  // Compatible crafted items in player's inventory for the currently selected slot
  const compatibleInventoryItems = useMemo(() => {
    if (!pickingSlot) return [];
    return Object.entries(inventory)
      .filter(([, count]) => count > 0)
      .map(([id]) => itemsCatalog[id])
      .filter(
        (it): it is GameItem =>
          Boolean(it) && it.kind === 'crafted' && getHeroSlotForItem(it) === pickingSlot
      )
      .sort((a, b) => RARITY_META[b.rarity].rank - RARITY_META[a.rarity].rank);
  }, [pickingSlot, inventory, itemsCatalog]);

  const handleRunRaidSimulation = () => {
    if (!selectedMonster || stamina < 2) return;
    sfx.playDiceRoll();

    const logs: CombatLogEntry[] = [];
    let heroHp = heroStats.maxHp;
    const monsterMaxHp = Math.round(35 + selectedMonster.cr * 14);
    let monsterHp = monsterMaxHp;
    let monsterAc = Math.min(22, 12 + Math.floor(selectedMonster.cr * 0.45));
    const monsterAtkBonus = Math.round(4 + selectedMonster.cr * 0.6);
    const monsterBaseDmg = Math.round(8 + selectedMonster.cr * 1.8);
    let potionUsed = false;

    logs.push({
      round: 0,
      actor: 'system',
      text: `⚔️ ${activeHero.name} (${activeHero.raceClass} • HP ${heroHp}, КД ${heroStats.ac}, Атака +${heroStats.attackBonus}) вступает в бой против: ${selectedMonster.name} (HP ${monsterMaxHp}, КД ${monsterAc})!`,
    });

    for (let round = 1; round <= 6; round++) {
      if (heroHp <= 0 || monsterHp <= 0) break;

      // 1. Hero Turn
      const d20Hero = Math.floor(Math.random() * 20) + 1;
      const heroAttackTotal = d20Hero + heroStats.attackBonus;
      const isCrit = d20Hero >= activeHero.critRangeMin;

      if (isCrit || heroAttackTotal >= monsterAc) {
        let dmg = Math.round(
          heroStats.avgDamage * (0.85 + Math.random() * 0.35) * (isCrit ? 1.75 : 1)
        );

        // Trigger Jev Special Effects!
        if (heroStats.effects.includes('corrosion') && monsterAc > 10) {
          monsterAc -= 1;
          logs.push({
            round,
            actor: 'hero',
            text: `🧪 Эффект Jev [Коррозия]: кислотный клинок разъедает панцирь врага! КД монстра снижен до ${monsterAc}.`,
            highlight: 'effect',
          });
        }
        if (heroStats.effects.includes('hellfire')) {
          const burn = 4 + Math.floor(Math.random() * 6);
          dmg += burn;
        }

        monsterHp = Math.max(0, monsterHp - dmg);
        logs.push({
          round,
          actor: 'hero',
          text: `${isCrit ? `💥 КРИТ (${d20Hero} на d20)!` : `🎲 Бросок ${d20Hero}+${heroStats.attackBonus}=${heroAttackTotal} (пробил КД ${monsterAc}):`} ${activeHero.name} (${activeHero.attacksPerRound} атк.) наносит ${dmg} ед. урона! (У врага осталось ${monsterHp} HP)`,
          highlight: isCrit ? 'crit' : undefined,
        });

        if (heroStats.effects.includes('vampiric') && heroHp < heroStats.maxHp) {
          const heal = Math.min(heroStats.maxHp - heroHp, Math.max(2, Math.round(dmg * 0.25)));
          heroHp += heal;
          logs.push({
            round,
            actor: 'hero',
            text: `🩸 Эффект Jev [Вампиризм]: похищено ${heal} хитов жизненной силы (HP Героя: ${heroHp}).`,
            highlight: 'heal',
          });
        }
      } else {
        logs.push({
          round,
          actor: 'hero',
          text: `🎲 Бросок атаки Героя ${d20Hero}+${heroStats.attackBonus}=${heroAttackTotal} не пробивает КД ${monsterAc}.`,
        });
      }

      if (monsterHp <= 0) break;

      // 2. Monster Turn
      let d20Monster = Math.floor(Math.random() * 20) + 1;
      if (heroStats.effects.includes('phase_shift')) {
        const secondRoll = Math.floor(Math.random() * 20) + 1;
        if (secondRoll < d20Monster) {
          d20Monster = secondRoll;
          logs.push({
            round,
            actor: 'hero',
            text: `✨ Эффект Jev [Фазовый сдвиг]: иллюзорный двойник накладывает Помеху на удар монстра!`,
            highlight: 'effect',
          });
        }
      }

      const monsterTotal = d20Monster + monsterAtkBonus;
      if (d20Monster === 20 || monsterTotal >= heroStats.ac) {
        // Reduce damage if hero has matching elemental gear
        const resistReduction = heroStats.elements.length >= 2 ? 0.78 : 0.9;
        const mDmg = Math.max(
          2,
          Math.round(monsterBaseDmg * (0.85 + Math.random() * 0.3) * resistReduction)
        );
        heroHp = Math.max(0, heroHp - mDmg);
        logs.push({
          round,
          actor: 'monster',
          text: `🐉 ${selectedMonster.name} атакует (${d20Monster}+${monsterAtkBonus}=${monsterTotal} против КД ${heroStats.ac}) и наносит ${mDmg} урона! (HP Героя: ${heroHp})`,
          highlight: 'danger',
        });
      } else {
        logs.push({
          round,
          actor: 'monster',
          text: `🛡️ ${selectedMonster.name} промахивается (${d20Monster}+${monsterAtkBonus}=${monsterTotal} против КД ${heroStats.ac}) — доспех Героя отразил удар!`,
        });
      }

      // 3. Belt Potion Auto-Trigger & Regeneration
      if (heroHp > 0 && heroHp < heroStats.maxHp * 0.55 && equippedItems.belt && !potionUsed) {
        potionUsed = true;
        const beltRank = RARITY_META[equippedItems.belt.rarity].rank;
        const healAmt = 8 + beltRank * 6;
        heroHp = Math.min(heroStats.maxHp, heroHp + healAmt);
        logs.push({
          round,
          actor: 'hero',
          text: `🧪 Поясной слот (${equippedItems.belt.name}): Герой выпивает эликсир и восстанавливает +${healAmt} HP (теперь ${heroHp} HP)!`,
          highlight: 'heal',
        });
      }

      if (heroHp > 0 && heroStats.effects.includes('regeneration') && heroHp < heroStats.maxHp) {
        heroHp = Math.min(heroStats.maxHp, heroHp + 4);
      }
    }

    const victory = monsterHp <= 0 || heroHp >= monsterHp;
    const lootIds = victory
      ? selectedMonster.drops.map((d) => d.itemId)
      : [selectedMonster.drops[0].itemId];
    const gold = victory
      ? Math.round(selectedMonster.cr * 24 + 35)
      : Math.round(selectedMonster.cr * 5 + 10);
    const xp = victory ? Math.round(selectedMonster.cr * 30 + 60) : 20;

    logs.push({
      round: 7,
      actor: 'system',
      text: victory
        ? `🏆 ПОБЕДА! ${selectedMonster.name} повержен! Добыты все 3 трофея монстра, +${gold} зм (gp) и +${xp} XP!`
        : `⚠️ Отступление! Монстр оказался слишком крепок, но Герой унёс базовый трофей и +${gold} зм.`,
      highlight: victory ? 'victory' : 'danger',
    });

    if (victory) {
      sfx.playSuccess();
    } else {
      sfx.playFail();
    }

    setCombatLogs(logs);
    setRaidOutcome({
      victory,
      heroHpLeft: heroHp,
      monsterHpLeft: monsterHp,
      lootIds,
      gold,
      xp,
    });

    onCompleteRaid({
      victory,
      monster: selectedMonster,
      lootItemIds: lootIds,
      goldEarned: gold,
      xpEarned: xp,
      staminaSpent: 2,
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      {/* LEFT: HERO PAPER-DOLL & D&D 5E COMBAT STATBLOCK */}
      <div className="lg:col-span-6 rounded-2xl bg-stone-900/70 border border-stone-800 p-5 space-y-4">
        {/* Party Character Switcher: Квик, Нокта, Слоу */}
        <div className="space-y-2">
          <div className="text-[11px] font-mono uppercase tracking-wider text-sky-400 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5" />
              <span>Персонажи Кампании «Монстры» (Листы Foundry VTT)</span>
            </span>
            <span className="text-amber-300/90">Логово: Дальний Камень</span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {GUILD_WORLD_HEROES.map((hero) => {
              const isSelected = hero.id === activeHero.id;
              return (
                <button
                  key={hero.id}
                  onClick={() => {
                    sfx.playClick();
                    onSelectHero?.(hero.id);
                  }}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    isSelected
                      ? `bg-gradient-to-br ${hero.accentColor} ring-1 ring-amber-400/60 shadow-lg`
                      : 'bg-stone-950/70 border-stone-800 hover:border-stone-700 opacity-75'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-base">{hero.avatarEmoji}</span>
                    <span className="font-display font-bold text-xs text-stone-100 truncate">
                      {hero.name}
                    </span>
                  </div>
                  <div className="text-[10px] text-stone-400 mt-0.5 truncate">
                    {hero.playerHint}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 pt-1">
          <div>
            <h2 className="font-display font-bold text-lg text-amber-100">
              {activeHero.avatarEmoji} {activeHero.name}
            </h2>
            <p className="text-xs text-stone-400">{activeHero.raceClass}</p>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="px-2.5 py-1 rounded-lg bg-rose-950/50 border border-rose-500/40 text-rose-300 flex items-center gap-1">
              <Heart className="w-3.5 h-3.5 text-rose-400" /> {heroStats.maxHp} HP
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-sky-950/50 border border-sky-500/40 text-sky-300 flex items-center gap-1">
              <Shield className="w-3.5 h-3.5 text-sky-400" /> КД {heroStats.ac}
            </span>
          </div>
        </div>

        {/* Canonical Foundry Trait Box */}
        <div className="rounded-xl bg-stone-950/80 border border-stone-800/90 p-2.5 text-xs">
          <div className="font-mono text-[10px] text-amber-300 uppercase">
            ★ Особенность листа ({activeHero.specialTraitTitle}):
          </div>
          <div className="text-stone-300 mt-0.5 leading-relaxed">
            {activeHero.specialTraitDesc}
          </div>
        </div>

        {/* Summary Combat Bar */}
        <div className="grid grid-cols-3 gap-2.5 text-center font-mono text-xs">
          <div className="p-2.5 rounded-xl bg-stone-950/80 border border-stone-800">
            <div className="text-[10px] text-stone-400 uppercase">Бонус Атаки</div>
            <div className="text-sm font-bold text-amber-300 mt-0.5">
              +{heroStats.attackBonus} к d20
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-stone-950/80 border border-stone-800">
            <div className="text-[10px] text-stone-400 uppercase">Средний Урон (DPR)</div>
            <div className="text-sm font-bold text-rose-300 mt-0.5">
              ~{heroStats.avgDamage} ед. / раунд
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-stone-950/80 border border-stone-800">
            <div className="text-[10px] text-stone-400 uppercase">Активные Чары Jev</div>
            <div className="text-sm font-bold text-emerald-300 mt-0.5">
              {heroStats.effects.length} св-в
            </div>
          </div>
        </div>

        {/* 6 Equipment Slots Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {(Object.keys(SLOT_META) as HeroSlotType[]).map((slot) => {
            const meta = SLOT_META[slot];
            const eqItem = equippedItems[slot];
            const rarity = eqItem ? RARITY_META[eqItem.rarity] : null;

            return (
              <div
                key={slot}
                className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-2.5 ${
                  eqItem && rarity
                    ? `${rarity.bg} ${rarity.border}`
                    : 'bg-stone-950/60 border-stone-800/80 hover:border-stone-700'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {eqItem ? (
                    <button
                      onClick={() => onInspectItem(eqItem)}
                      className="shrink-0 hover:scale-105 transition-transform"
                      title="Открыть 3D-модель предмета"
                    >
                      <CompositeItemSprite item={eqItem} size="md" />
                    </button>
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-stone-900 border border-dashed border-stone-700 flex items-center justify-center text-stone-600 text-xs font-mono shrink-0">
                      Пусто
                    </div>
                  )}

                  <div className="min-w-0">
                    <div className="text-[10px] font-mono uppercase text-stone-400">
                      {meta.label}
                    </div>
                    {eqItem ? (
                      <div className="text-xs font-semibold text-amber-100 truncate">
                        {eqItem.name}
                      </div>
                    ) : (
                      <div className="text-[11px] text-stone-500 truncate">{meta.sub}</div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() =>
                      setPickingSlot((prev) => (prev === slot ? null : slot))
                    }
                    className="px-2.5 py-1 rounded-lg bg-stone-900 hover:bg-stone-800 border border-stone-700 text-[11px] font-mono text-amber-300 cursor-pointer"
                  >
                    {eqItem ? 'Сменить' : 'Надеть'}
                  </button>
                  {eqItem && (
                    <button
                      onClick={() => onEquipSlot(slot, undefined)}
                      className="p-1 rounded-lg bg-stone-900 hover:bg-rose-950/50 border border-stone-800 text-stone-400 hover:text-rose-300"
                      title="Снять предмет"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Slot Picker Drawer */}
        {pickingSlot && (
          <div className="p-3.5 rounded-xl bg-stone-950 border border-amber-500/40 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-amber-300">
                Выберите скрафченный предмет для слота «{SLOT_META[pickingSlot].label}»:
              </span>
              <button
                onClick={() => setPickingSlot(null)}
                className="text-xs font-mono text-stone-400 hover:text-stone-200"
              >
                Закрыть
              </button>
            </div>
            {compatibleInventoryItems.length === 0 ? (
              <p className="text-xs text-stone-400 py-2">
                В инвентаре пока нет подходящих созданных предметов ({SLOT_META[pickingSlot].sub}). Скрафтите их в Мастерской!
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                {compatibleInventoryItems.map((it) => (
                  <button
                    key={it.id}
                    onClick={() => {
                      onEquipSlot(pickingSlot, it.id);
                      setPickingSlot(null);
                      sfx.playClick();
                    }}
                    className="p-2 rounded-lg bg-stone-900 hover:bg-stone-800 border border-stone-700 flex items-center gap-2.5 text-left"
                  >
                    <CompositeItemSprite item={it} size="sm" />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-stone-100 truncate">
                        {it.name}
                      </div>
                      <div className="text-[10px] font-mono text-amber-300">
                        {RARITY_META[it.rarity].label}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* RIGHT: DUNGEON RAID COMBAT SIMULATOR */}
      <div className="lg:col-span-6 rounded-2xl bg-stone-900/70 border border-stone-800 p-5 flex flex-col justify-between space-y-4">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[11px] font-mono uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                <Swords className="w-3.5 h-3.5" />
                <span>Авто-Рейд в Подземелье (Пошаговый бой D&D 5e)</span>
              </div>
              <h2 className="font-display font-bold text-lg text-amber-100 mt-0.5">
                Выберите Босса для Охоты
              </h2>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-amber-950/50 border border-amber-500/40 text-xs font-mono text-amber-300 flex items-center gap-1">
              <Zap className="w-3.5 h-3.5" /> Цена рейда: 2⚡
            </span>
          </div>

          {/* Monster Selector Pills */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
            {monsters.map((m) => {
              const active = m.id === selectedMonster?.id;
              return (
                <button
                  key={m.id}
                  onClick={() => setSelectedMonsterId(m.id)}
                  className={`p-2 rounded-xl border text-left flex items-center gap-2 transition-all ${
                    active
                      ? 'bg-rose-950/40 border-rose-500/70 ring-1 ring-rose-400/40'
                      : 'bg-stone-950/60 border-stone-800 hover:border-stone-700'
                  }`}
                >
                  <CompositeMonsterSprite monster={m} size="sm" />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-stone-100 truncate">
                      {m.name}
                    </div>
                    <div className="text-[10px] font-mono text-rose-300">
                      {m.crDisplay} • HP {Math.round(22 + m.cr * 11)}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Combat Log Console */}
          <div className="rounded-xl bg-stone-950/90 border border-stone-800 p-3.5 h-60 overflow-y-auto space-y-2 font-mono text-xs">
            {combatLogs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-stone-500 px-4">
                <Swords className="w-8 h-8 text-stone-700 mb-2" />
                <p>
                  Экипируйте созданное в тигле оружие, броню и эликсиры на Героя и нажмите «Начать Рейд», чтобы испытать ваши предметы в реальном D&D 5e бою!
                </p>
              </div>
            ) : (
              combatLogs.map((entry, i) => (
                <div
                  key={i}
                  className={`p-2 rounded-lg border ${
                    entry.highlight === 'victory'
                      ? 'bg-emerald-950/50 border-emerald-500/50 text-emerald-200 font-bold'
                      : entry.highlight === 'crit'
                        ? 'bg-amber-950/50 border-amber-500/50 text-amber-200'
                        : entry.highlight === 'effect'
                          ? 'bg-fuchsia-950/40 border-fuchsia-500/40 text-fuchsia-200'
                          : entry.highlight === 'heal'
                            ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
                            : entry.highlight === 'danger'
                              ? 'bg-rose-950/35 border-rose-500/30 text-rose-200'
                              : 'bg-stone-900/70 border-stone-800 text-stone-300'
                  }`}
                >
                  {entry.round > 0 && entry.round <= 6 && (
                    <span className="text-[10px] text-stone-500 mr-1.5">
                      [Раунд {entry.round}]
                    </span>
                  )}
                  <span>{entry.text}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Launch Raid Button */}
        <div className="flex items-center justify-between gap-3 pt-2 border-t border-stone-800">
          <div className="text-xs font-mono text-stone-400">
            Награда победы:{' '}
            <span className="text-amber-300 font-semibold">
              Все 3 органа + {Math.round((selectedMonster?.cr ?? 2) * 24 + 35)} gp
            </span>
          </div>
          <button
            onClick={handleRunRaidSimulation}
            disabled={stamina < 2}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
              stamina >= 2
                ? 'bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-400 hover:to-amber-400 text-stone-950 shadow-lg'
                : 'bg-stone-800 text-stone-500 cursor-not-allowed'
            }`}
          >
            <Dices className="w-4 h-4" />
            <span>
              {stamina >= 2
                ? `В Бой с «${selectedMonster?.name}» (-2⚡)`
                : 'Нужно 2⚡ Выносливости (Отдохните в Таверне)'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
