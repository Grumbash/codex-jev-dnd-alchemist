import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Coins,
  Cpu,
  Dices,
  Flame,
  Handshake,
  ShieldAlert,
  Sparkles,
  X,
} from 'lucide-react';
import { ElementType, GameItem, JevHaggleTelemetry } from '../types/game';
import { RARITY_META } from '../data/bestiary';
import { evaluateMerchantHaggleWithJev } from '../engine/jevEngine';
import { CompositeItemSprite } from './CompositeItemSprite';
import { sfx } from '../utils/sound';

interface MerchantProfile {
  id: string;
  name: string;
  title: string;
  specialtyLabel: string;
  favoriteStation: 'alchemist' | 'blacksmith' | 'artificer';
  favoriteElements: ElementType[];
  lovesCursed?: boolean;
  preferredSkill: 'persuasion' | 'deception' | 'intimidation';
  quoteGreeting: string;
  accentClass: string;
}

const MERCHANTS: MerchantProfile[] = [
  {
    id: 'emra_narvesh',
    name: 'Кормилец Нарвеша (Эмра)',
    title: 'Преобразившийся таврай • Зал общей трапезы',
    specialtyLabel: 'Алхимия, вытяжки Ремораза, Огонь, Кислота и Холод (+35% к базе)',
    favoriteStation: 'alchemist',
    favoriteElements: ['fire', 'acid', 'cold'],
    preferredSkill: 'persuasion',
    quoteGreeting:
      '«Гора помнит голод и принимает дары. Если твоя добыча напитает трапезу Нарвеша — община воздаст сполна.»',
    accentClass: 'from-amber-500/20 to-emerald-950/35 border-amber-500/40',
  },
  {
    id: 'irvek_saal_lich',
    name: 'Лич Ирвек Сааль',
    title: 'Лагерь монстров у разрушенного города',
    specialtyLabel: 'Артефакторика, Некротика, Псионика, Яд и Проклятые реликвии (+40% к базе)',
    favoriteStation: 'artificer',
    favoriteElements: ['necrotic', 'psychic', 'poison'],
    lovesCursed: true,
    preferredSkill: 'deception',
    quoteGreeting:
      '«Маги северного Арканума трясутся над своими шкатулками, а тавраи гибнут от дыхания смерти. Покажи, что ты выковал.»',
    accentClass: 'from-purple-500/25 to-indigo-950/35 border-purple-500/45',
  },
  {
    id: 'beirne_pilgrim',
    name: 'Паломник Бейрн',
    title: 'Одноногий охотник на драконов • Статуя Корвена',
    specialtyLabel: 'Кузнечное оружие и латы, Огонь, Молния, Излучение и Сила (+35% к базе)',
    favoriteStation: 'blacksmith',
    favoriteElements: ['fire', 'lightning', 'radiant', 'force'],
    preferredSkill: 'intimidation',
    quoteGreeting:
      '«Я свалил не одного крылатого змея на своем веку! Покажи честную сталь и твердую руку — сторгуемся у подножия Корвена.»',
    accentClass: 'from-orange-500/20 to-stone-900/45 border-orange-500/40',
  },
];

interface MerchantHaggleModalProps {
  item: GameItem | null;
  inventoryCount: number;
  proficiencyBonus: number;
  useLiveJev: boolean;
  apiKey?: string;
  tabletopRollMode?: boolean;
  onClose: () => void;
  onCompleteSale: (itemId: string, finalGold: number, xpBonus: number) => void;
}

export const MerchantHaggleModal: React.FC<MerchantHaggleModalProps> = ({
  item,
  inventoryCount,
  proficiencyBonus,
  useLiveJev,
  apiKey,
  tabletopRollMode = false,
  onClose,
  onCompleteSale,
}) => {
  const [selectedMerchantId, setSelectedMerchantId] = useState<string>(MERCHANTS[0].id);
  const [markupPercent, setMarkupPercent] = useState<25 | 50 | 90>(25);
  const [socialSkill, setSocialSkill] = useState<'persuasion' | 'deception' | 'intimidation'>(
    'persuasion'
  );
  const [manualD20, setManualD20] = useState<number>(14);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [rollResult, setRollResult] = useState<{
    d20: number;
    bonus: number;
    total: number;
    dc: number;
  } | null>(null);
  const [telemetry, setTelemetry] = useState<JevHaggleTelemetry | null>(null);

  const merchant = useMemo(
    () => MERCHANTS.find((m) => m.id === selectedMerchantId) || MERCHANTS[0],
    [selectedMerchantId]
  );

  if (!item || inventoryCount <= 0) return null;

  // Calculate collector affinity multiplier
  const matchesStation = item.station === merchant.favoriteStation;
  const matchesElement = item.elements.some((el) =>
    merchant.favoriteElements.includes(el)
  );
  const matchesCurse = Boolean(merchant.lovesCursed && item.isCursed);

  const collectorBonusMultiplier =
    1 +
    (matchesStation ? 0.2 : 0) +
    (matchesElement ? 0.15 : 0) +
    (matchesCurse ? 0.25 : 0);

  const baseOfferGold = Math.round(item.goldValue * collectorBonusMultiplier);
  const demandedGold = Math.round(baseOfferGold * (1 + markupPercent / 100));

  // Calculate D&D 5e Social Check DC
  const skillSynergyBonus = socialSkill === merchant.preferredSkill ? -2 : 0;
  const baseDc =
    markupPercent === 25 ? 11 : markupPercent === 50 ? 15 : 19;
  const targetDc = Math.max(8, baseDc + skillSynergyBonus);

  const handleRollAndNegotiate = async () => {
    setIsEvaluating(true);
    sfx.playDiceRoll();

    const d20 = tabletopRollMode
      ? Math.max(1, Math.min(20, manualD20))
      : Math.floor(Math.random() * 20) + 1;
    const skillMatchBonus = socialSkill === merchant.preferredSkill ? 2 : 0;
    const totalBonus = proficiencyBonus + skillMatchBonus;
    const total = d20 + totalBonus;

    setRollResult({ d20, bonus: totalBonus, dc: targetDc, total });

    const jevResult = await evaluateMerchantHaggleWithJev(
      {
        merchantId: merchant.id,
        merchantName: merchant.name,
        merchantSpecialty: merchant.specialtyLabel,
        item,
        baseOfferGold,
        demandedGold,
        markupPercent,
        socialSkill,
        d20Total: total,
        dc: targetDc,
      },
      { useLiveApi: useLiveJev, apiKey }
    );

    setTelemetry(jevResult);
    setIsEvaluating(false);

    if (
      jevResult.counterReaction.choice === 'accept_gladly' ||
      jevResult.counterReaction.choice === 'grudging_deal'
    ) {
      sfx.playSuccess();
    } else {
      sfx.playFail();
    }
  };

  const handleConfirmDeal = () => {
    if (!telemetry) return;
    sfx.playCoin();
    const xpBonus =
      telemetry.counterReaction.choice === 'accept_gladly'
        ? 35
        : telemetry.counterReaction.choice === 'grudging_deal'
          ? 20
          : 10;
    onCompleteSale(item.id, telemetry.finalPriceGold, xpBonus);
    onClose();
  };

  const rarity = RARITY_META[item.rarity];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl rounded-2xl border-2 border-amber-500/40 bg-gradient-to-b from-[#171422] via-[#110e19] to-[#0a0810] p-6 text-stone-100 shadow-2xl"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-stone-400 hover:text-stone-100 border border-stone-800"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2 text-amber-400 text-xs font-mono uppercase tracking-wider">
          <Handshake className="w-4 h-4" />
          <span>Гильдейский Аукцион • Jev System-1 Оценка Сделки</span>
        </div>
        <h2 className="font-display font-bold text-xl text-amber-100 mt-1">
          Торг за предмет: {item.name}
        </h2>

        {/* Item Summary Bar */}
        <div className="mt-3 p-3 rounded-xl bg-stone-900/80 border border-stone-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <CompositeItemSprite item={item} size="md" />
            <div className="min-w-0">
              <div className="text-xs font-semibold text-stone-100 truncate">
                {item.name}
              </div>
              <div className="text-[11px] font-mono text-stone-400">
                {rarity.label} • Базовая цена: {item.goldValue} gp
              </div>
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[10px] font-mono uppercase text-stone-400">
              Оценка скупщика
            </div>
            <div className="text-sm font-mono font-bold text-emerald-400">
              {baseOfferGold} gp{' '}
              {collectorBonusMultiplier > 1 && (
                <span className="text-[11px] text-amber-300">
                  (x{collectorBonusMultiplier.toFixed(2)} интерес!)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Step 1: Select NPC Merchant */}
        <div className="mt-4">
          <label className="block text-[11px] font-mono uppercase text-stone-400 mb-2">
            1. Выберите коллекционера-скупщика:
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {MERCHANTS.map((m) => {
              const active = m.id === selectedMerchantId;
              return (
                <button
                  key={m.id}
                  disabled={Boolean(telemetry)}
                  onClick={() => {
                    setSelectedMerchantId(m.id);
                    setRollResult(null);
                    setTelemetry(null);
                  }}
                  className={`text-left p-3 rounded-xl border transition-all ${
                    active
                      ? `bg-gradient-to-br ${m.accentClass} ring-1 ring-amber-400/50`
                      : 'bg-stone-900/60 border-stone-800 hover:border-stone-700 opacity-75'
                  }`}
                >
                  <div className="font-display font-bold text-xs text-amber-100">
                    {m.name}
                  </div>
                  <div className="text-[10px] font-mono text-stone-400 mt-0.5">
                    {m.title}
                  </div>
                  <div className="text-[10px] text-emerald-300/90 mt-1.5 leading-snug">
                    {m.specialtyLabel}
                  </div>
                </button>
              );
            })}
          </div>
          <blockquote className="mt-2 px-3 py-2 rounded-lg bg-stone-950/70 border border-stone-800/80 text-xs italic text-stone-300">
            {merchant.quoteGreeting}
          </blockquote>
        </div>

        {/* Step 2: Choose Markup & Social Skill */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-mono uppercase text-stone-400 mb-1.5">
              2. Запросить наценку:
            </label>
            <div className="grid grid-cols-3 gap-2">
              {([25, 50, 90] as const).map((pct) => (
                <button
                  key={pct}
                  disabled={Boolean(telemetry)}
                  onClick={() => setMarkupPercent(pct)}
                  className={`p-2 rounded-xl border text-center font-mono transition-colors ${
                    markupPercent === pct
                      ? 'bg-amber-500/20 border-amber-400 text-amber-200 font-bold'
                      : 'bg-stone-900 border-stone-800 text-stone-400 hover:text-stone-200'
                  }`}
                >
                  <div className="text-xs">+{pct}%</div>
                  <div className="text-[10px] text-amber-400">
                    {Math.round(baseOfferGold * (1 + pct / 100))} gp
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-mono uppercase text-stone-400 mb-1.5">
              3. Навык Харизмы (D&D 5e):
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: 'persuasion', label: 'Убеждение' },
                  { id: 'deception', label: 'Обман' },
                  { id: 'intimidation', label: 'Напор' },
                ] as const
              ).map((sk) => {
                const isPreferred = merchant.preferredSkill === sk.id;
                return (
                  <button
                    key={sk.id}
                    disabled={Boolean(telemetry)}
                    onClick={() => setSocialSkill(sk.id)}
                    className={`p-2 rounded-xl border text-center transition-colors ${
                      socialSkill === sk.id
                        ? 'bg-sky-500/20 border-sky-400 text-sky-200 font-semibold'
                        : 'bg-stone-900 border-stone-800 text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    <div className="text-xs">{sk.label}</div>
                    <div className="text-[9px] font-mono text-emerald-400">
                      {isPreferred ? '★ Любит (+2)' : 'Обычный'}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Roll & Jev Telemetry Result */}
        {!telemetry ? (
          <div className="mt-5 space-y-2.5 p-3.5 rounded-xl bg-stone-900/90 border border-stone-800">
            {tabletopRollMode && (
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-stone-800">
                <span className="text-[11px] font-mono text-amber-300">
                  🎯 Режим живого стола — укажите выпавший за столом d20:
                </span>
                <div className="flex flex-wrap gap-1">
                  {Array.from({ length: 20 }, (_, i) => i + 1).map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setManualD20(val)}
                      className={`w-6 h-6 rounded text-[10px] font-mono font-bold transition-colors ${
                        manualD20 === val
                          ? 'bg-amber-400 text-stone-950 ring-1 ring-amber-200'
                          : val === 20
                          ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-500/40'
                          : val === 1
                          ? 'bg-rose-950/70 text-rose-300 border border-rose-500/40'
                          : 'bg-stone-950 text-stone-400 hover:text-stone-200 border border-stone-800'
                      }`}
                    >
                      {val}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex items-center justify-between gap-4">
              <div className="text-xs font-mono text-stone-300">
                Сложность торга:{' '}
                <span className="text-amber-300 font-bold">СЛ (DC) {targetDc}</span> • Запрос:{' '}
                <span className="text-emerald-400 font-bold">{demandedGold} gp</span>
              </div>
              <button
                onClick={handleRollAndNegotiate}
                disabled={isEvaluating}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-stone-950 font-bold text-xs flex items-center gap-2 shadow-lg cursor-pointer"
              >
                <Dices className="w-4 h-4" />
                <span>
                  {isEvaluating
                    ? 'Jev оценивает сделку...'
                    : tabletopRollMode
                    ? `Применить d20=${manualD20} (+${proficiencyBonus + (socialSkill === merchant.preferredSkill ? 2 : 0)})`
                    : `Бросить d20 + ${proficiencyBonus + (socialSkill === merchant.preferredSkill ? 2 : 0)} (Торговаться)`}
                </span>
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-5 space-y-3 rounded-xl bg-stone-950/90 border border-amber-500/40 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-800 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-lg bg-stone-900 border border-stone-700 font-mono text-xs text-amber-300">
                  🎲 Бросок d20: {rollResult?.d20} + {rollResult?.bonus} ={' '}
                  <strong>{rollResult?.total}</strong> (СЛ {rollResult?.dc})
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[11px] font-mono ${
                    (rollResult?.total ?? 0) >= (rollResult?.dc ?? 10)
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  }`}
                >
                  {(rollResult?.total ?? 0) >= (rollResult?.dc ?? 10)
                    ? 'Успех проверки!'
                    : 'Промах проверки'}
                </span>
              </div>
              <div className="text-[11px] font-mono text-stone-400 flex items-center gap-1">
                <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                <span>
                  {telemetry.source === 'live-jev' ? 'Live Jev API' : 'NAR Sim'} •{' '}
                  {telemetry.latencyMs}ms
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
              <div className="p-2.5 rounded-lg bg-stone-900/80 border border-stone-800">
                <div className="text-[10px] text-stone-400 uppercase">
                  noul(willAccept)
                </div>
                <div className="text-sm font-bold text-emerald-400 mt-0.5">
                  {Math.round(telemetry.willAccept.noul * 100)}% согласие
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-stone-900/80 border border-stone-800">
                <div className="text-[10px] text-stone-400 uppercase">
                  score(merchantMood)
                </div>
                <div className="text-sm font-bold text-amber-300 mt-0.5">
                  Настроение: {telemetry.merchantMood.score} / 5
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-stone-900/80 border border-stone-800">
                <div className="text-[10px] text-stone-400 uppercase">
                  Итоговая цена Jev
                </div>
                <div className="text-sm font-bold text-amber-400 mt-0.5 flex items-center gap-1">
                  <Coins className="w-3.5 h-3.5" /> {telemetry.finalPriceGold} gp
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-2">
              <div className="text-xs text-stone-300">
                {telemetry.counterReaction.choice === 'accept_gladly' && (
                  <span className="text-emerald-300 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4" /> Купец в восторге и платит полную запрошенную сумму!
                  </span>
                )}
                {telemetry.counterReaction.choice === 'grudging_deal' && (
                  <span className="text-sky-300 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" /> Купец ворчит, но соглашается на ваши условия.
                  </span>
                )}
                {telemetry.counterReaction.choice === 'counter_offer' && (
                  <span className="text-amber-300 flex items-center gap-1.5">
                    <Flame className="w-4 h-4" /> Купец сбивает наценку до компромиссной суммы.
                  </span>
                )}
                {telemetry.counterReaction.choice === 'insulted_refusal' && (
                  <span className="text-rose-300 flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4" /> Купец оскорблён жадностью и штрафует предложение!
                  </span>
                )}
              </div>

              <button
                onClick={handleConfirmDeal}
                className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-bold text-xs flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                <Coins className="w-4 h-4" />
                <span>Забрать {telemetry.finalPriceGold} gp</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
