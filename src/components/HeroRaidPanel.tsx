import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Brain,
  Dices,
  Heart,
  Lock,
  Shield,
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
  JevRaidTelemetry,
  Monster,
} from '../types/game';
import { RARITY_META } from '../data/bestiary';
import { GUILD_WORLD_HEROES, PartyHeroProfile } from '../data/guildWorldCampaign';
import { evaluateRaidWithJev } from '../engine/jevEngine';
import { CompositeItemSprite, CompositeMonsterSprite } from './CompositeItemSprite';
import { D20DiceModal } from './D20DiceModal';
import { useLanguage } from '../context/LanguageContext';
import { sfx } from '../utils/sound';

export function getHeroSlotForItem(item: GameItem): HeroSlotType | null {
  if (item.kind !== 'crafted') return null;
  switch (item.archetype) {
    case 'dagger':
    case 'longsword':
    case 'warhammer':
    case 'whip':
    case 'wand':
    case 'gauntlets':
      return 'weapon';
    case 'shield':
    case 'orb':
    case 'scroll':
    case 'weapon_oil':
      return 'offhand';
    case 'breastplate':
      return 'armor';
    case 'cloak':
    case 'boots':
      return 'cloak';
    case 'amulet':
    case 'ring':
      return 'jewelry';
    case 'belt_girdle':
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
  { label: string; labelEn: string; sub: string; subEn: string; allowedHint: string }
> = {
  weapon: {
    label: 'Правая рука (Оружие / Рукавицы)',
    labelEn: 'Main Hand (Weapon / Gauntlets)',
    sub: 'Клинки, молоты, плети, жезлы, рукавицы',
    subEn: 'Blades, warhammers, whips, wands, gauntlets',
    allowedHint: 'dagger, longsword, warhammer, whip, wand, gauntlets',
  },
  offhand: {
    label: 'Левая рука (Щит / Фокус)',
    labelEn: 'Off-Hand (Shield / Focus)',
    sub: 'Эгиды, сферы, свитки, масла',
    subEn: 'Shields, orbs, scrolls, blade oils',
    allowedHint: 'shield, orb, scroll, weapon_oil',
  },
  armor: {
    label: 'Доспех (Торс)',
    labelEn: 'Armor (Torso)',
    sub: 'Кирасы и чешуйчатая броня',
    subEn: 'Cuirasses & heavy scale armor',
    allowedHint: 'breastplate',
  },
  cloak: {
    label: 'Плечи и Сапоги (Мантия / Обувь)',
    labelEn: 'Cloak & Strider Boots',
    sub: 'Плащи смещения и рунные сапоги',
    subEn: 'Phase cloaks & enchanted boots',
    allowedHint: 'cloak, boots',
  },
  jewelry: {
    label: 'Реликвия (Кольцо / Амулет)',
    labelEn: 'Relic (Ring / Amulet)',
    sub: 'Перстни и талисманы',
    subEn: 'Signet rings & talismans',
    allowedHint: 'ring, amulet',
  },
  belt: {
    label: 'Пояс (Перевязь / Зелье / Бомба)',
    labelEn: 'Belt (War Girdle / Potion / Bomb)',
    sub: 'Боевые пояса, фиалы, яды, гранаты',
    subEn: 'War girdles, draughts, venoms, bombs',
    allowedHint: 'belt_girdle, healing_draught, volatile_bomb, deadly_poison, mutagen_elixir',
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
  activeBuffs?: import('../types/game').ActivePartyBuff[];
  heroHpMap?: Record<PartyHeroProfile['id'], number>;
  heroWoundsMap?: Record<PartyHeroProfile['id'], number>;
  useLiveApi?: boolean;
  apiKey?: string;
  onSelectHero?: (heroId: PartyHeroProfile['id']) => void;
  onEquipSlot: (slot: HeroSlotType, itemId: string | undefined) => void;
  onInspectItem: (item: GameItem) => void;
  onHealHeroWithGold?: (heroId: PartyHeroProfile['id'], costGold: number) => void;
  onBattleFinished?: (heroId: PartyHeroProfile['id']) => void;
  onCompleteRaid: (result: {
    victory: boolean;
    monster: Monster;
    lootItemIds: string[];
    goldEarned: number;
    xpEarned: number;
    staminaSpent: number;
    heroHpLeft?: number;
    woundAdded?: boolean;
  }) => void;
}

export function computeMonsterRaidStats(monster: Monster) {
  const maxHp = Math.round(72 + Math.pow(monster.cr, 1.52) * 9.5);
  const ac = Math.min(25, 13 + Math.floor(monster.cr * 0.55));
  const atkBonus = Math.round(6 + monster.cr * 0.78);
  const baseDmg = Math.round(14 + Math.pow(monster.cr, 1.32) * 2.8);
  return { maxHp, ac, atkBonus, baseDmg };
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
  activeBuffs = [],
  heroHpMap,
  heroWoundsMap,
  useLiveApi = false,
  apiKey = '',
  onSelectHero,
  onEquipSlot,
  onInspectItem,
  onHealHeroWithGold,
  onBattleFinished,
  onCompleteRaid,
}) => {
  const { lang } = useLanguage();
  const isEn = lang === 'en';

  const [selectedMonsterId, setSelectedMonsterId] = useState<string>(
    monsters[0]?.id || 'chuul_water_passage'
  );
  const [tierFilter, setTierFilter] = useState<'all' | '1-4' | '5-9' | '10-15' | '16+'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [pickingSlot, setPickingSlot] = useState<HeroSlotType | null>(null);
  const [combatLogs, setCombatLogs] = useState<CombatLogEntry[]>([]);
  const [raidTelemetry, setRaidTelemetry] = useState<JevRaidTelemetry | null>(null);
  const [isEvaluatingJev, setIsEvaluatingJev] = useState<boolean>(false);
  const [lockedRaidD20, setLockedRaidD20] = useState<number | null>(null);
  const [isRaidDiceModalOpen, setIsRaidDiceModalOpen] = useState<boolean>(false);

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

  const heroWounds = heroWoundsMap?.[activeHero.id] ?? 0;

  // Compute D&D 5e Hero Combat Stats from Foundry Base Sheet + Equipped Crafted Items + Wounds
  const heroStats = useMemo(() => {
    let maxHp = activeHero.baseHp;
    let ac = activeHero.baseAc;
    let attackBonus = activeHero.attackBonus - heroWounds * 2;
    const baseHitAvg =
      activeHero.baseDamageDice === '2d6'
        ? 7 + activeHero.baseDamageBonus
        : 4.5 + activeHero.baseDamageBonus;
    let avgDamage = baseHitAvg * activeHero.attacksPerRound;
    const elements = new Set<ElementType>();
    const effects = new Set<string>();
    let equippedCount = 0;

    (Object.values(equippedItems) as (GameItem | undefined)[]).forEach((it) => {
      if (!it) return;
      equippedCount += 1;
      const rank = RARITY_META[it.rarity].rank;
      it.elements.forEach((e) => elements.add(e));
      if (it.specialEffect) effects.add(it.specialEffect);

      const slot = getHeroSlotForItem(it);
      if (slot === 'weapon') {
        attackBonus += Math.max(1, Math.floor(rank / 2));
        avgDamage += rank * 4.8 + (it.isMasterwork ? 5 : 0);
      } else if (slot === 'offhand') {
        if (it.archetype === 'shield') {
          ac += 1 + Math.floor(rank / 2);
        } else {
          attackBonus += Math.ceil(rank / 2);
          avgDamage += rank * 2.8;
        }
      } else if (slot === 'armor') {
        ac += Math.max(1, Math.floor(rank / 2));
        maxHp += rank * 8;
      } else if (slot === 'cloak') {
        ac += 1 + Math.floor(rank / 3);
        if (it.archetype === 'boots') {
          attackBonus += 1;
        }
      } else if (slot === 'jewelry') {
        maxHp += rank * 7;
        attackBonus += Math.floor(rank / 2);
      } else if (slot === 'belt') {
        maxHp += rank * 6;
        avgDamage += rank * 3.0;
        if (it.archetype === 'belt_girdle') {
          ac += 1;
          attackBonus += 1;
        }
      }
    });

    // Apply Active Party Buffs & Mutations
    const heroBuffs = activeBuffs.filter((b) => b.heroId === activeHeroId);
    heroBuffs.forEach((buff) => {
      buff.elements.forEach((e) => elements.add(e));
      if (buff.statBonus?.tempHp) maxHp += buff.statBonus.tempHp;
      if (buff.statBonus?.armorClassBonus) ac += buff.statBonus.armorClassBonus;
      if (buff.statBonus?.attackBonus) attackBonus += buff.statBonus.attackBonus;
      if (buff.statBonus?.bonusDamagePerRound) avgDamage += buff.statBonus.bonusDamagePerRound;
    });

    const currentHp =
      heroHpMap && typeof heroHpMap[activeHero.id] === 'number'
        ? Math.min(maxHp, heroHpMap[activeHero.id])
        : maxHp;

    return {
      currentHp,
      maxHp,
      ac: Math.min(28, ac),
      attackBonus,
      avgDamage: Math.round(avgDamage),
      elements: Array.from(elements),
      effects: Array.from(effects),
      equippedCount,
      buffsCount: heroBuffs.length,
    };
  }, [
    equippedItems,
    activeHero,
    alchemistLevel,
    proficiencyBonus,
    activeBuffs,
    activeHeroId,
    heroHpMap,
    heroWounds,
  ]);

  const filteredMonsters = useMemo(() => {
    return monsters.filter((m) => {
      if (tierFilter === '1-4' && (m.cr < 1 || m.cr > 4)) return false;
      if (tierFilter === '5-9' && (m.cr < 5 || m.cr > 9)) return false;
      if (tierFilter === '10-15' && (m.cr < 10 || m.cr > 15)) return false;
      if (tierFilter === '16+' && m.cr < 16) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          m.name.toLowerCase().includes(q) ||
          m.nameEn.toLowerCase().includes(q) ||
          m.creatureType.toLowerCase().includes(q) ||
          m.biome.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [monsters, tierFilter, searchQuery]);

  const selectedMonster = useMemo(
    () => monsters.find((m) => m.id === selectedMonsterId) || monsters[0],
    [monsters, selectedMonsterId]
  );

  // Live Jev Raid Evaluation whenever hero, gear, monster, or locked d20 changes
  useEffect(() => {
    if (!selectedMonster) return;
    let cancelled = false;
    setIsEvaluatingJev(true);
    evaluateRaidWithJev(
      {
        heroId: activeHero.id,
        heroName: activeHero.name,
        heroHp: heroStats.currentHp,
        heroMaxHp: heroStats.maxHp,
        heroAc: heroStats.ac,
        heroAttackBonus: heroStats.attackBonus,
        equippedItemsCount: heroStats.equippedCount,
        activeBuffsCount: heroStats.buffsCount,
        monster: selectedMonster,
        d20InitiativeOrStrike: lockedRaidD20 ?? undefined,
      },
      { useLiveApi, apiKey }
    ).then((tel) => {
      if (!cancelled) {
        setRaidTelemetry(tel);
        setIsEvaluatingJev(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [
    selectedMonster,
    activeHero.id,
    activeHero.name,
    heroStats.currentHp,
    heroStats.maxHp,
    heroStats.ac,
    heroStats.attackBonus,
    heroStats.equippedCount,
    heroStats.buffsCount,
    lockedRaidD20,
    useLiveApi,
    apiKey,
  ]);

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

  const isMonsterLocked = selectedMonster
    ? alchemistLevel < selectedMonster.minAlchemistLevel
    : false;
  const raidStaminaCost = selectedMonster ? Math.max(2, selectedMonster.staminaCost) : 2;
  const isHeroTooWounded = heroStats.currentHp < Math.round(heroStats.maxHp * 0.2);

  const handleRunRaidSimulation = async (forcedOpeningD20?: number) => {
    if (
      !selectedMonster ||
      stamina < raidStaminaCost ||
      isMonsterLocked ||
      isHeroTooWounded
    )
      return;
    sfx.playDiceRoll();

    const openingRoll = forcedOpeningD20 ?? lockedRaidD20 ?? undefined;
    const telemetry = await evaluateRaidWithJev(
      {
        heroId: activeHero.id,
        heroName: activeHero.name,
        heroHp: heroStats.currentHp,
        heroMaxHp: heroStats.maxHp,
        heroAc: heroStats.ac,
        heroAttackBonus: heroStats.attackBonus,
        equippedItemsCount: heroStats.equippedCount,
        activeBuffsCount: heroStats.buffsCount,
        monster: selectedMonster,
        d20InitiativeOrStrike: openingRoll,
      },
      { useLiveApi, apiKey }
    );
    setRaidTelemetry(telemetry);
    setLockedRaidD20(null);

    const logs: CombatLogEntry[] = [];
    let heroHp = heroStats.currentHp;
    const mStats = computeMonsterRaidStats(selectedMonster);
    const monsterMaxHp = mStats.maxHp;
    let monsterHp = monsterMaxHp;
    let monsterAc = mStats.ac;
    const monsterAtkBonus = mStats.atkBonus;
    const monsterBaseDmg = mStats.baseDmg;
    let potionUsed = false;

    const currentHeroBuffs = activeBuffs.filter((b) => b.heroId === activeHeroId);

    logs.push({
      round: 0,
      actor: 'system',
      text: isEn
        ? `🧠 Jev Raid Director (${telemetry.source}): Win Prob ${Math.round(
            telemetry.winProbability.noul * 100
          )}% • Ambush Risk ${Math.round(
            telemetry.ambushRisk.noul * 100
          )}% • Tactic [${telemetry.monsterTactic.choice}] • Hazard [${
            telemetry.battlefieldHazard.choice
          }]`
        : `🧠 Тактический ИИ Jev (${telemetry.source}): Шанс победы ${Math.round(
            telemetry.winProbability.noul * 100
          )}% • Риск засады ${Math.round(
            telemetry.ambushRisk.noul * 100
          )}% • Тактика [${telemetry.monsterTactic.choice}]`,
      highlight: 'effect',
    });

    logs.push({
      round: 0,
      actor: 'system',
      text: isEn
        ? `⚔️ ${activeHero.name} (HP ${heroHp}/${heroStats.maxHp}, AC ${heroStats.ac}, Atk +${heroStats.attackBonus}) engages ${selectedMonster.nameEn} (${selectedMonster.crDisplay} • HP ${monsterMaxHp}, AC ${monsterAc})!`
        : `⚔️ ${activeHero.name} (HP ${heroHp}/${heroStats.maxHp}, КД ${heroStats.ac}, Атака +${heroStats.attackBonus}) вступает в смертельный бой против: ${selectedMonster.name} (HP ${monsterMaxHp}, КД ${monsterAc})!`,
    });

    if (currentHeroBuffs.length > 0) {
      logs.push({
        round: 0,
        actor: 'hero',
        text: `✨ ${isEn ? 'Active Elixirs & Mutations:' : 'Мутации и зелья в действии:'} ${currentHeroBuffs
          .map((b) => `${b.iconEmoji} ${b.title}`)
          .join(' • ')}`,
        highlight: 'effect',
      });
    }

    // Check Jev Ambush Risk before Round 1
    if (
      telemetry.monsterTactic.choice === 'lair_ambush' &&
      telemetry.ambushRisk.noul >= 0.45 &&
      (!openingRoll || openingRoll < 14)
    ) {
      const ambushDmg = Math.max(8, Math.round(monsterBaseDmg * 0.55));
      heroHp = Math.max(0, heroHp - ambushDmg);
      logs.push({
        round: 0,
        actor: 'monster',
        text: isEn
          ? `⚠️ Jev Ambush Triggered! ${selectedMonster.nameEn} strikes from the shadows before round 1 for ${ambushDmg} damage! (Hero HP: ${heroHp})`
          : `⚠️ Сработала Засада Логова (Jev ${Math.round(
              telemetry.ambushRisk.noul * 100
            )}%)! ${selectedMonster.name} наносит внезапный удар из тени на ${ambushDmg} урона! (HP Героя: ${heroHp})`,
        highlight: 'danger',
      });
    }

    for (let round = 1; round <= 6; round++) {
      if (heroHp <= 0 || monsterHp <= 0) break;

      // 1. Hero Turn (Round 1 uses locked 3D d20 roll if provided!)
      const d20Hero =
        round === 1 && openingRoll !== undefined
          ? openingRoll
          : Math.floor(Math.random() * 20) + 1;
      const heroAttackTotal = d20Hero + heroStats.attackBonus;
      const isCrit = d20Hero >= activeHero.critRangeMin;

      if (d20Hero !== 1 && (isCrit || heroAttackTotal >= monsterAc)) {
        const hazardMult =
          telemetry.battlefieldHazard.choice === 'blood_frenzy' ? 1.15 : 1.0;
        let dmg = Math.round(
          heroStats.avgDamage *
            (0.82 + Math.random() * 0.32) *
            (isCrit ? 1.75 : 1) *
            hazardMult
        );

        // Trigger Jev Special Effects!
        if (heroStats.effects.includes('corrosion') && monsterAc > 11) {
          monsterAc -= 1;
          logs.push({
            round,
            actor: 'hero',
            text: isEn
              ? `🧪 Jev Effect [Corrosion]: Acid melts monster plating! Monster AC reduced to ${monsterAc}.`
              : `🧪 Эффект Jev [Коррозия]: кислотный клинок разъедает панцирь врага! КД монстра снижен до ${monsterAc}.`,
            highlight: 'effect',
          });
        }
        if (heroStats.effects.includes('hellfire')) {
          const burn = 5 + Math.floor(Math.random() * 7);
          dmg += burn;
        }

        monsterHp = Math.max(0, monsterHp - dmg);
        logs.push({
          round,
          actor: 'hero',
          text: isEn
            ? `${
                isCrit
                  ? `💥 CRIT (${d20Hero} on d20)!`
                  : `🎲 Roll ${d20Hero}+${heroStats.attackBonus}=${heroAttackTotal} (vs AC ${monsterAc}):`
              } ${activeHero.name} deals ${dmg} damage! (Monster HP: ${monsterHp}/${monsterMaxHp})`
            : `${
                isCrit
                  ? `💥 КРИТ (${d20Hero} на d20)!`
                  : `🎲 Бросок ${d20Hero}+${heroStats.attackBonus}=${heroAttackTotal} (пробил КД ${monsterAc}):`
              } ${activeHero.name} наносит ${dmg} ед. урона! (У врага осталось ${monsterHp}/${monsterMaxHp} HP)`,
          highlight: isCrit ? 'crit' : undefined,
        });

        if (heroStats.effects.includes('vampiric') && heroHp < heroStats.maxHp) {
          const heal = Math.min(heroStats.maxHp - heroHp, Math.max(2, Math.round(dmg * 0.22)));
          heroHp += heal;
          logs.push({
            round,
            actor: 'hero',
            text: isEn
              ? `🩸 Jev Effect [Vampiric]: Drained ${heal} HP (Hero HP: ${heroHp}).`
              : `🩸 Эффект Jev [Вампиризм]: похищено ${heal} хитов жизненной силы (HP Героя: ${heroHp}).`,
            highlight: 'heal',
          });
        }
      } else {
        logs.push({
          round,
          actor: 'hero',
          text: isEn
            ? `🎲 Hero attack roll ${d20Hero}+${heroStats.attackBonus}=${heroAttackTotal} misses Monster AC ${monsterAc}!`
            : `🎲 Бросок атаки Героя ${d20Hero}+${heroStats.attackBonus}=${heroAttackTotal} не пробивает КД ${monsterAc}!`,
        });
      }

      if (monsterHp <= 0) break;

      // Monster Regeneration Tactic
      if (telemetry.monsterTactic.choice === 'regenerative_stall' && monsterHp > 0) {
        const regen = Math.round(8 + selectedMonster.cr * 1.6);
        monsterHp = Math.min(monsterMaxHp, monsterHp + regen);
        logs.push({
          round,
          actor: 'monster',
          text: isEn
            ? `🧬 Monster Tactic [Regeneration]: ${selectedMonster.nameEn} regenerates +${regen} HP (Now ${monsterHp} HP)!`
            : `🧬 Тактика Монстра [Регенерация]: ${selectedMonster.name} сращивает ткани на +${regen} HP (теперь ${monsterHp} HP)!`,
          highlight: 'danger',
        });
      }

      // 2. Monster Turn
      let d20Monster = Math.floor(Math.random() * 20) + 1;
      if (heroStats.effects.includes('phase_shift')) {
        const secondRoll = Math.floor(Math.random() * 20) + 1;
        if (secondRoll < d20Monster) {
          d20Monster = secondRoll;
          logs.push({
            round,
            actor: 'hero',
            text: isEn
              ? `✨ Jev Effect [Phase Shift]: Illusory double forces Disadvantage on monster attack!`
              : `✨ Эффект Jev [Фазовый сдвиг]: иллюзорный двойник накладывает Помеху на удар монстра!`,
            highlight: 'effect',
          });
        }
      }

      const effectiveHeroAc =
        telemetry.monsterTactic.choice === 'arcane_barrage'
          ? Math.max(12, heroStats.ac - 2)
          : heroStats.ac;
      const monsterTotal = d20Monster + monsterAtkBonus;

      if (d20Monster === 20 || (d20Monster !== 1 && monsterTotal >= effectiveHeroAc)) {
        const resistReduction = heroStats.elements.length >= 2 ? 0.8 : 0.92;
        const tacticMult =
          telemetry.monsterTactic.choice === 'frenzied_assault' && round <= 2
            ? 1.25
            : d20Monster === 20
              ? 1.65
              : 1.0;
        const mDmg = Math.max(
          4,
          Math.round(
            monsterBaseDmg * (0.85 + Math.random() * 0.35) * resistReduction * tacticMult
          )
        );
        heroHp = Math.max(0, heroHp - mDmg);
        logs.push({
          round,
          actor: 'monster',
          text: isEn
            ? `🐉 ${selectedMonster.nameEn} strikes (${d20Monster}+${monsterAtkBonus}=${monsterTotal} vs AC ${effectiveHeroAc}) for ${mDmg} damage! (Hero HP: ${heroHp}/${heroStats.maxHp})`
            : `🐉 ${selectedMonster.name} сокрушает оборону (${d20Monster}+${monsterAtkBonus}=${monsterTotal} против КД ${effectiveHeroAc}) и наносит ${mDmg} урона! (HP Героя: ${heroHp}/${heroStats.maxHp})`,
          highlight: 'danger',
        });

        if (telemetry.monsterTactic.choice === 'soul_drain' && monsterHp < monsterMaxHp) {
          const drainHeal = Math.round(mDmg * 0.35);
          monsterHp = Math.min(monsterMaxHp, monsterHp + drainHeal);
        }
      } else {
        logs.push({
          round,
          actor: 'monster',
          text: isEn
            ? `🛡️ ${selectedMonster.nameEn} misses (${d20Monster}+${monsterAtkBonus}=${monsterTotal} vs AC ${effectiveHeroAc})!`
            : `🛡️ ${selectedMonster.name} промахивается (${d20Monster}+${monsterAtkBonus}=${monsterTotal} против КД ${effectiveHeroAc}) — броня выдержала!`,
        });
      }

      // 3. Belt Potion Auto-Trigger & Regeneration
      if (heroHp > 0 && heroHp < heroStats.maxHp * 0.5 && equippedItems.belt && !potionUsed) {
        potionUsed = true;
        const beltRank = RARITY_META[equippedItems.belt.rarity].rank;
        const healAmt = 12 + beltRank * 8;
        heroHp = Math.min(heroStats.maxHp, heroHp + healAmt);
        logs.push({
          round,
          actor: 'hero',
          text: isEn
            ? `🧪 Belt Slot (${equippedItems.belt.nameEn}): Hero consumes elixir and restores +${healAmt} HP (Now ${heroHp} HP)!`
            : `🧪 Поясной слот (${equippedItems.belt.name}): Герой активирует поясной резерв и восстанавливает +${healAmt} HP (теперь ${heroHp} HP)!`,
          highlight: 'heal',
        });
      }

      if (heroHp > 0 && heroStats.effects.includes('regeneration') && heroHp < heroStats.maxHp) {
        heroHp = Math.min(heroStats.maxHp, heroHp + 5);
      }
    }

    // STRICT VICTORY CONDITION: Monster must be reduced to 0 HP while Hero survives!
    const victory = monsterHp <= 0 && heroHp > 0;

    // Organ preservation score from Jev determines how many organs remain intact on victory!
    const presScore = telemetry.organPreservation.score;
    const lootIds = victory
      ? presScore >= 4
        ? selectedMonster.drops.map((d) => d.itemId) // all 3 drops
        : presScore >= 2
          ? selectedMonster.drops.slice(0, 2).map((d) => d.itemId) // common + rare
          : [selectedMonster.drops[0].itemId]
      : []; // ZERO free loot on defeat!

    const gold = victory ? Math.round(selectedMonster.cr * 22 + 30) : 0;
    const xp = victory ? Math.round(selectedMonster.cr * 28 + 50) : 10;

    logs.push({
      round: 7,
      actor: 'system',
      text: victory
        ? isEn
          ? `🏆 VICTORY! ${selectedMonster.nameEn} is slain! Organ Preservation (${presScore}/5) yielded ${lootIds.length} trophy organs, +${gold} gp, and +${xp} XP!`
          : `🏆 ПОБЕДА! ${selectedMonster.name} повержен! Сохранность органов Jev (${presScore}/5) позволила добыть ${lootIds.length} трофея, +${gold} зм и +${xp} XP!`
        : isEn
          ? `💀 DEFEAT & RETREAT! ${selectedMonster.nameEn} overwhelmed ${activeHero.name} (Monster had ${monsterHp} HP left). No trophies harvested, and the hero suffered a Battle Wound (-2 Atk until healed)!`
          : `💀 ПОРАЖЕНИЕ И ОТСТУПЛЕНИЕ! ${selectedMonster.name} оказался сильнее (у монстра осталось ${monsterHp} HP). Трофеи потеряны, а Герой получил Боевое Ранение (-2 к атаке до лечения в Бастионе)!`,
      highlight: victory ? 'victory' : 'danger',
    });

    if (victory) {
      sfx.playSuccess();
    } else {
      sfx.playFail();
    }

    setCombatLogs(logs);

    onCompleteRaid({
      victory,
      monster: selectedMonster,
      lootItemIds: lootIds,
      goldEarned: gold,
      xpEarned: xp,
      staminaSpent: raidStaminaCost,
      heroHpLeft: Math.max(15, heroHp),
      woundAdded: !victory,
    });

    if (onBattleFinished) {
      onBattleFinished(activeHeroId);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      {/* LEFT: HERO PAPER-DOLL & D&D 5E COMBAT STATBLOCK */}
      <div className="lg:col-span-6 rounded-2xl bg-[#101b22] border border-[#c9aa72]/25 shadow-xl p-5 space-y-4">
        {/* Party Character Switcher: Квик, Нокта, Слоу */}
        <div className="space-y-2">
          <div className="text-[11px] font-mono uppercase tracking-wider text-[#d0ad77] flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-semibold">
              <UserCheck className="w-3.5 h-3.5" />
              <span>
                {isEn
                  ? 'Party Heroes (Foundry VTT Sheets)'
                  : 'Персонажи Кампании «Монстры» (Листы Foundry VTT)'}
              </span>
            </span>
            <span className="text-[#e5cb94]">
              {isEn ? 'Bastion: Far Stone' : 'Бастион: Дальний Камень'}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {GUILD_WORLD_HEROES.map((hero) => {
              const isSelected = hero.id === activeHero.id;
              const hWounds = heroWoundsMap?.[hero.id] ?? 0;
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
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-base">{hero.avatarEmoji}</span>
                      <span className="font-display font-bold text-xs text-stone-100 truncate">
                        {hero.name}
                      </span>
                    </div>
                    {hWounds > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-rose-950 border border-rose-500/60 text-[9px] font-mono text-rose-300">
                        🩸x{hWounds}
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-stone-400 mt-0.5 truncate">
                    {hero.playerHint}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div>
            <h2 className="font-display font-bold text-lg text-amber-100">
              {activeHero.avatarEmoji} {activeHero.name}
            </h2>
            <p className="text-xs text-stone-400">{activeHero.raceClass}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
            <span
              className={`px-2.5 py-1 rounded-lg border flex items-center gap-1 ${
                heroStats.currentHp < heroStats.maxHp * 0.45
                  ? 'bg-rose-950/80 border-rose-500 text-rose-200 animate-pulse'
                  : 'bg-rose-950/50 border-rose-500/40 text-rose-300'
              }`}
            >
              <Heart className="w-3.5 h-3.5 text-rose-400" /> {heroStats.currentHp}/
              {heroStats.maxHp} HP
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-sky-950/50 border border-sky-500/40 text-sky-300 flex items-center gap-1">
              <Shield className="w-3.5 h-3.5 text-sky-400" /> AC {heroStats.ac}
            </span>
            {(heroStats.currentHp < heroStats.maxHp || heroWounds > 0) &&
              onHealHeroWithGold && (
                <button
                  onClick={() => onHealHeroWithGold(activeHero.id, 45)}
                  className="px-2.5 py-1 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/50 text-emerald-200 text-[11px] font-bold transition cursor-pointer"
                  title={
                    isEn
                      ? 'Heal full HP and cure battle wounds at the Bastion Apothecary (45 gp)'
                      : 'Полностью исцелить хиты и снять ранения в Лазарете Бастиона (45 зм)'
                  }
                >
                  ➕ {isEn ? 'Heal (45 gp)' : 'Лечить (45 зм)'}
                </button>
              )}
          </div>
        </div>

        {heroWounds > 0 && (
          <div className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-500/50 flex items-center justify-between gap-2 text-xs text-rose-200">
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>
                {isEn
                  ? `Battle Wounds (${heroWounds}): -${heroWounds * 2} penalty to Attack rolls until treated or rested!`
                  : `Тяжелые ранения (${heroWounds}): штраф -${heroWounds * 2} к броскам атаки до лечения или отдыха!`}
              </span>
            </span>
          </div>
        )}

        {/* Canonical Foundry Trait Box */}
        <div className="rounded-xl bg-stone-950/80 border border-stone-800/90 p-2.5 text-xs">
          <div className="font-mono text-[10px] text-amber-300 uppercase">
            ★ {isEn ? 'Character Sheet Trait' : 'Особенность листа'} ({activeHero.specialTraitTitle}):
          </div>
          <div className="text-stone-300 mt-0.5 leading-relaxed">
            {activeHero.specialTraitDesc}
          </div>
        </div>

        {/* Summary Combat Bar */}
        <div className="grid grid-cols-3 gap-2.5 text-center font-mono text-xs">
          <div className="p-2.5 rounded-xl bg-stone-950/80 border border-stone-800">
            <div className="text-[10px] text-stone-400 uppercase">
              {isEn ? 'Attack Bonus' : 'Бонус Атаки'}
            </div>
            <div className="text-sm font-bold text-amber-300 mt-0.5">
              +{heroStats.attackBonus} d20
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-stone-950/80 border border-stone-800">
            <div className="text-[10px] text-stone-400 uppercase">
              {isEn ? 'Avg Damage (DPR)' : 'Средний Урон (DPR)'}
            </div>
            <div className="text-sm font-bold text-rose-300 mt-0.5">
              ~{heroStats.avgDamage} / {isEn ? 'rnd' : 'раунд'}
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-stone-950/80 border border-stone-800">
            <div className="text-[10px] text-stone-400 uppercase">
              {isEn ? 'Equipped Gear' : 'Надето Артефактов'}
            </div>
            <div className="text-sm font-bold text-emerald-300 mt-0.5">
              {heroStats.equippedCount} / 6
            </div>
          </div>
        </div>

        {/* Active Party Buffs & Mutations for this Hero */}
        {activeBuffs.filter((b) => b.heroId === activeHeroId).length > 0 && (
          <div className="p-3 rounded-xl bg-gradient-to-r from-[#14232a] to-[#0c161d] border border-[#d0ad77]/40 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-mono text-[#d0ad77]">
              <span className="flex items-center gap-1.5 font-bold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>
                  {isEn
                    ? `Active Elixirs & Mutations (${activeHero.name}):`
                    : `Активные мутации и эликсиры (${activeHero.name}):`}
                </span>
              </span>
            </div>
            <div className="space-y-1.5">
              {activeBuffs
                .filter((b) => b.heroId === activeHeroId)
                .map((buff) => (
                  <div
                    key={buff.id}
                    className="p-2 rounded-lg bg-[#081015] border border-[#2b4150] flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base">{buff.iconEmoji}</span>
                      <div>
                        <div className="font-semibold text-[#f0ece3]">{buff.title}</div>
                        <div className="text-[11px] text-[#93a6b0]">{buff.description}</div>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-[#162732] border border-[#3b596d] font-mono text-[10px] text-[#e5cb94] shrink-0">
                      ⏳ {buff.durationFights}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}

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
                      title={isEn ? 'Inspect 3D Item' : 'Открыть 3D-модель предмета'}
                    >
                      <CompositeItemSprite item={eqItem} size="md" />
                    </button>
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-stone-900 border border-dashed border-stone-700 flex items-center justify-center text-stone-600 text-xs font-mono shrink-0">
                      {isEn ? 'Empty' : 'Пусто'}
                    </div>
                  )}

                  <div className="min-w-0">
                    <div className="text-[10px] font-mono uppercase text-stone-400">
                      {isEn ? meta.labelEn : meta.label}
                    </div>
                    {eqItem ? (
                      <div className="text-xs font-semibold text-amber-100 truncate">
                        {isEn ? eqItem.nameEn : eqItem.name}
                      </div>
                    ) : (
                      <div className="text-[11px] text-stone-500 truncate">
                        {isEn ? meta.subEn : meta.sub}
                      </div>
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
                    {eqItem ? (isEn ? 'Swap' : 'Сменить') : isEn ? 'Equip' : 'Надеть'}
                  </button>
                  {eqItem && (
                    <button
                      onClick={() => onEquipSlot(slot, undefined)}
                      className="p-1 rounded-lg bg-stone-900 hover:bg-rose-950/50 border border-stone-800 text-stone-400 hover:text-rose-300"
                      title={isEn ? 'Unequip' : 'Снять предмет'}
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
                {isEn
                  ? `Select crafted item for "${SLOT_META[pickingSlot].labelEn}":`
                  : `Выберите скрафченный предмет для слота «${SLOT_META[pickingSlot].label}»:`}
              </span>
              <button
                onClick={() => setPickingSlot(null)}
                className="text-xs font-mono text-stone-400 hover:text-stone-200"
              >
                {isEn ? 'Close' : 'Закрыть'}
              </button>
            </div>
            {compatibleInventoryItems.length === 0 ? (
              <p className="text-xs text-stone-400 py-2">
                {isEn
                  ? `No compatible crafted items in inventory (${SLOT_META[pickingSlot].subEn}). Craft them in the Crucible!`
                  : `В инвентаре пока нет подходящих созданных предметов (${SLOT_META[pickingSlot].sub}). Скрафтите их в Мастерской!`}
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
                        {isEn ? it.nameEn : it.name}
                      </div>
                      <div className="text-[10px] font-mono text-amber-300">
                        {isEn
                          ? RARITY_META[it.rarity].labelEn
                          : RARITY_META[it.rarity].label}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* RIGHT: DUNGEON RAID COMBAT SIMULATOR + JEV SYSTEM-1 RAID DIRECTOR */}
      <div className="lg:col-span-6 rounded-2xl bg-[#101b22] border border-[#c9aa72]/25 shadow-xl p-5 flex flex-col justify-between space-y-4">
        <div className="space-y-3.5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-[11px] font-mono uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                <Swords className="w-3.5 h-3.5" />
                <span>
                  {isEn
                    ? 'Dungeon Raid & Jev Combat Director (D&D 5e)'
                    : 'Рейд в Подземелье + Тактический ИИ Jev (D&D 5e)'}
                </span>
              </div>
              <h2 className="font-display font-bold text-lg text-amber-100 mt-0.5">
                {isEn
                  ? `Select Target Monster (${monsters.length} in Bestiary)`
                  : `Выберите Монстра для Рейда (${monsters.length} в Бестиарии)`}
              </h2>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-amber-950/50 border border-amber-500/40 text-xs font-mono text-amber-300 flex items-center gap-1 shrink-0">
              <Zap className="w-3.5 h-3.5" /> -{raidStaminaCost}⚡
            </span>
          </div>

          {/* Filter & Search Bar for 74+ Monsters */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              {(['all', '1-4', '5-9', '10-15', '16+'] as const).map((tier) => (
                <button
                  key={tier}
                  onClick={() => setTierFilter(tier)}
                  className={`px-2 py-1 rounded-lg text-[10px] font-mono border transition cursor-pointer ${
                    tierFilter === tier
                      ? 'bg-amber-500/20 border-amber-400 text-amber-200 font-bold'
                      : 'bg-stone-950/70 border-stone-800 text-stone-400 hover:text-stone-200'
                  }`}
                >
                  {tier === 'all' ? (isEn ? 'All CR' : 'Все CR') : `CR ${tier}`}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isEn ? 'Search monster...' : 'Поиск монстра...'}
              className="px-2.5 py-1 rounded-lg bg-stone-950/90 border border-stone-800 text-xs text-stone-200 placeholder:text-stone-500 focus:outline-none focus:border-amber-500/50 w-40"
            />
          </div>

          {/* Monster Selector Pills */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
            {filteredMonsters.map((m) => {
              const active = m.id === selectedMonster?.id;
              const locked = alchemistLevel < m.minAlchemistLevel;
              const mStats = computeMonsterRaidStats(m);
              return (
                <button
                  key={m.id}
                  onClick={() => setSelectedMonsterId(m.id)}
                  className={`p-2 rounded-xl border text-left flex items-center gap-2 transition-all cursor-pointer ${
                    active
                      ? 'bg-rose-950/45 border-rose-500/80 ring-1 ring-rose-400/50'
                      : locked
                        ? 'bg-stone-950/40 border-stone-900 opacity-60'
                        : 'bg-stone-950/60 border-stone-800 hover:border-stone-700'
                  }`}
                >
                  <CompositeMonsterSprite monster={m} size="sm" />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-stone-100 truncate flex items-center gap-1">
                      {locked && <Lock className="w-3 h-3 text-amber-400 shrink-0" />}
                      <span className="truncate">{isEn ? m.nameEn : m.name}</span>
                    </div>
                    <div className="text-[10px] font-mono text-rose-300 truncate">
                      CR {m.cr} • HP {mStats.maxHp} • AC {mStats.ac}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* JEV SYSTEM-1 RAID DIRECTOR TELEMETRY PANEL */}
          {raidTelemetry && selectedMonster && (
            <div className="rounded-xl bg-gradient-to-br from-[#0c1821] via-[#111f2a] to-[#161324] border border-cyan-500/35 p-3 space-y-2 shadow-inner">
              <div className="flex items-center justify-between text-[10px] font-mono">
                <span className="text-cyan-300 font-bold flex items-center gap-1.5 uppercase">
                  <Brain className="w-3.5 h-3.5 text-cyan-400" />
                  <span>
                    {isEn
                      ? 'TypeSafe Jev System-1 • Raid Director'
                      : 'Нейро-оценка Рейда • TypeSafe Jev System-1'}
                  </span>
                </span>
                <span className="px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/40 text-cyan-200">
                  {isEvaluatingJev
                    ? '...'
                    : `${raidTelemetry.source} • ${raidTelemetry.latencyMs}ms`}
                </span>
              </div>

              <div className="grid grid-cols-4 gap-2 text-center font-mono">
                <div className="p-2 rounded-lg bg-stone-950/80 border border-stone-800">
                  <div className="text-[9px] text-stone-400 uppercase">
                    {isEn ? 'Win Prob (noul)' : 'Победа (noul)'}
                  </div>
                  <div
                    className={`text-sm font-black mt-0.5 ${
                      raidTelemetry.winProbability.noul >= 0.6
                        ? 'text-emerald-400'
                        : raidTelemetry.winProbability.noul >= 0.38
                          ? 'text-amber-300'
                          : 'text-rose-400'
                    }`}
                  >
                    {Math.round(raidTelemetry.winProbability.noul * 100)}%
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-stone-950/80 border border-stone-800">
                  <div className="text-[9px] text-stone-400 uppercase">
                    {isEn ? 'Ambush (noul)' : 'Засада (noul)'}
                  </div>
                  <div className="text-sm font-bold text-rose-300 mt-0.5">
                    {Math.round(raidTelemetry.ambushRisk.noul * 100)}%
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-stone-950/80 border border-stone-800">
                  <div className="text-[9px] text-stone-400 uppercase">
                    {isEn ? 'Enemy Tactic' : 'Тактика врага'}
                  </div>
                  <div className="text-[11px] font-bold text-amber-200 mt-0.5 truncate">
                    {raidTelemetry.monsterTactic.choice.replace('_', ' ')}
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-stone-950/80 border border-stone-800">
                  <div className="text-[9px] text-stone-400 uppercase">
                    {isEn ? 'Intact Organs' : 'Сохранность'}
                  </div>
                  <div className="text-sm font-bold text-cyan-300 mt-0.5">
                    {raidTelemetry.organPreservation.score} / 5 ★
                  </div>
                </div>
              </div>

              <div className="text-[11px] text-stone-300 font-mono flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="truncate">
                  {isEn ? raidTelemetry.tacticalSummaryEn : raidTelemetry.tacticalSummaryRu}
                </span>
              </div>
            </div>
          )}

          {/* Combat Log Console */}
          <div className="rounded-xl bg-stone-950/90 border border-stone-800 p-3.5 h-48 overflow-y-auto space-y-2 font-mono text-xs">
            {combatLogs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-stone-500 px-4">
                <Swords className="w-7 h-7 text-stone-700 mb-1.5" />
                <p>
                  {isEn
                    ? 'Equip crafted weapons, belts, and armor on your Hero! High-CR monsters will defeat unequipped heroes and inflict Battle Wounds.'
                    : 'Экипируйте созданное в тигле оружие, пояса и броню на Героя! Высокоуровневые монстры победят неэкипированного героя и нанесут Боевые Ранения.'}
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
                      [{isEn ? `Round ${entry.round}` : `Раунд ${entry.round}`}]
                    </span>
                  )}
                  <span>{entry.text}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Launch Raid Controls + 3D Dice Button */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-stone-800">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsRaidDiceModalOpen(true)}
              disabled={isMonsterLocked || stamina < raidStaminaCost || isHeroTooWounded}
              className="px-3 py-2 rounded-xl border border-amber-500/50 bg-stone-900 hover:bg-stone-800 text-amber-200 text-xs font-mono font-bold flex items-center gap-1.5 transition disabled:opacity-40 cursor-pointer"
              title={
                isEn
                  ? 'Roll 3D d20 for Round 1 Strike & Jev Raid Evaluation'
                  : 'Бросить 3D кубик d20 для первого удара и запуска рейда'
              }
            >
              <span>🎲</span>
              <span>
                {lockedRaidD20 !== null
                  ? isEn
                    ? `3D d20 Locked: ${lockedRaidD20}`
                    : `3D d20 Готов: ${lockedRaidD20}`
                  : isEn
                    ? 'Roll 3D d20'
                    : '3D Бросок d20'}
              </span>
            </button>
            {lockedRaidD20 !== null && (
              <button
                onClick={() => setLockedRaidD20(null)}
                className="text-[10px] font-mono text-stone-400 hover:text-rose-300"
              >
                ✕
              </button>
            )}
          </div>

          <button
            onClick={() => handleRunRaidSimulation()}
            disabled={stamina < raidStaminaCost || isMonsterLocked || isHeroTooWounded}
            className={`flex-1 sm:flex-initial px-5 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
              stamina >= raidStaminaCost && !isMonsterLocked && !isHeroTooWounded
                ? 'bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-400 hover:to-amber-400 text-stone-950 shadow-lg'
                : 'bg-stone-800 text-stone-500 cursor-not-allowed'
            }`}
          >
            <Dices className="w-4 h-4" />
            <span>
              {isMonsterLocked
                ? isEn
                  ? `Requires Mastery Lv. ${selectedMonster?.minAlchemistLevel}`
                  : `Нужен Уровень Мастерства ${selectedMonster?.minAlchemistLevel}`
                : isHeroTooWounded
                  ? isEn
                    ? 'Hero Too Wounded — Heal First!'
                    : 'Герой тяжело ранен — Исцелите!'
                  : stamina >= raidStaminaCost
                    ? isEn
                      ? `Raid "${selectedMonster?.nameEn}" (-${raidStaminaCost}⚡)${
                          lockedRaidD20 ? ` [d20=${lockedRaidD20}]` : ''
                        }`
                      : `В Рейд на «${selectedMonster?.name}» (-${raidStaminaCost}⚡)${
                          lockedRaidD20 ? ` [d20=${lockedRaidD20}]` : ''
                        }`
                    : isEn
                      ? `Need ${raidStaminaCost}⚡ Stamina (Rest in Bastion)`
                      : `Нужно ${raidStaminaCost}⚡ Выносливости (Отдохните)`}
            </span>
          </button>
        </div>
      </div>

      <D20DiceModal
        isOpen={isRaidDiceModalOpen}
        onClose={() => setIsRaidDiceModalOpen(false)}
        modifier={heroStats.attackBonus}
        dc={selectedMonster ? computeMonsterRaidStats(selectedMonster).ac : 15}
        title={
          isEn
            ? `3D Raid Strike vs ${selectedMonster?.nameEn || 'Monster'}`
            : `3D Бросок Атаки Рейда: ${selectedMonster?.name || 'Монстр'}`
        }
        subtitle={`${activeHero.name} • +${heroStats.attackBonus} vs AC ${
          selectedMonster ? computeMonsterRaidStats(selectedMonster).ac : 15
        }`}
        actionLabel={
          isEn ? '⚔️ Launch Raid with this Roll' : '⚔️ Начать Рейд с этим броском'
        }
        onRollComplete={(rolled) => {
          setLockedRaidD20(rolled);
        }}
        onConfirmAction={(rolled) => {
          setLockedRaidD20(rolled);
          handleRunRaidSimulation(rolled);
        }}
      />
    </div>
  );
};
