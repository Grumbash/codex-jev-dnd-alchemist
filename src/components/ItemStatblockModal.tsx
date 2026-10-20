import React, { useState } from 'react';
import { Check, Coins, Copy, Shield, Sparkles, Swords, X } from 'lucide-react';
import { GameItem } from '../types/game';
import { ELEMENT_META, RARITY_META } from '../data/bestiary';

interface ItemStatblockModalProps {
  item: GameItem | null;
  inventoryCount: number;
  onClose: () => void;
  onSellItem: (itemId: string) => void;
}

export const ItemStatblockModal: React.FC<ItemStatblockModalProps> = ({
  item,
  inventoryCount,
  onClose,
  onSellItem,
}) => {
  const [copied, setCopied] = useState(false);

  if (!item) return null;

  const rarity = RARITY_META[item.rarity];
  const stats = item.stats;

  const handleCopyMarkdown = () => {
    const md = [
      `### ${item.icon} ${item.name} (${item.nameEn})`,
      `*${stats?.typeLine || RARITY_META[item.rarity].label}*`,
      '',
      stats?.damageFormula ? `- **Урон:** ${stats.damageFormula}` : null,
      stats?.armorClassBonus ? `- **Защита:** ${stats.armorClassBonus}` : null,
      stats?.savingThrow ? `- **Спасбросок эффекта:** ${stats.savingThrow}` : null,
      stats?.chargesInfo ? `- **Заряды:** ${stats.chargesInfo}` : null,
      `- **Свойство:** ${stats?.mechanicalEffect || item.description}`,
      stats?.curseEffect ? `- **Проклятие:** ${stats.curseEffect}` : null,
      `- **Рыночная стоимость:** ${item.goldValue} зм (gp)`,
      '',
      `> ${stats?.loreQuote || item.description}`,
    ]
      .filter(Boolean)
      .join('\n');

    navigator.clipboard.writeText(md).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`relative w-full max-w-lg rounded-2xl border-2 p-6 bg-gradient-to-b from-[#1a1624] via-[#12101a] to-[#0d0b12] text-stone-100 shadow-2xl ${rarity.border} ${rarity.glow}`}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-stone-400 hover:text-stone-100 border border-stone-800"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Item Header */}
        <div className="flex items-start gap-4">
          <div
            className={`w-16 h-16 rounded-2xl border-2 flex items-center justify-center text-4xl shrink-0 ${rarity.bg} ${rarity.border}`}
          >
            {item.icon}
          </div>
          <div className="min-w-0 pr-6">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`px-2 py-0.5 rounded text-[11px] font-mono uppercase font-bold border ${rarity.bg} ${rarity.border} ${rarity.text}`}
              >
                {rarity.label} ({rarity.labelEn})
              </span>
              {item.isMasterwork && (
                <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-amber-500/20 border border-amber-400/50 text-amber-300 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Шедевр (Nat 20)
                </span>
              )}
            </div>
            <h2 className="font-display font-bold text-lg text-amber-100 mt-1.5 leading-snug">
              {item.name}
            </h2>
            <p className="text-xs font-mono text-stone-400 italic">
              {stats?.typeLine || item.nameEn}
            </p>
          </div>
        </div>

        {/* D&D Red/Gold Divider Line */}
        <div className="my-4 h-0.5 w-full bg-gradient-to-r from-amber-500/70 via-amber-400/30 to-transparent" />

        {/* Elemental Tags & Stats */}
        <div className="space-y-3 text-sm">
          <div className="flex flex-wrap gap-2">
            {item.elements.map((el) => {
              const m = ELEMENT_META[el];
              return (
                <span
                  key={el}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${m.bg} ${m.border} ${m.color} flex items-center gap-1.5`}
                >
                  <span>{m.emoji}</span>
                  <span>Стихия: {m.label}</span>
                </span>
              );
            })}
            <span className="px-2.5 py-1 rounded-lg text-xs font-mono bg-amber-950/40 border border-amber-500/40 text-amber-300 flex items-center gap-1.5">
              <Coins className="w-3.5 h-3.5" /> {item.goldValue} gp
            </span>
          </div>

          {stats?.damageFormula && (
            <div className="rounded-xl bg-stone-900/90 border border-stone-800 p-3 flex items-center gap-3">
              <Swords className="w-5 h-5 text-rose-400 shrink-0" />
              <div>
                <div className="text-[10px] font-mono uppercase text-stone-400">
                  Формула урона / воздействия (D&D 5e)
                </div>
                <div className="font-mono font-semibold text-stone-100 text-xs mt-0.5">
                  {stats.damageFormula}
                </div>
              </div>
            </div>
          )}

          {stats?.armorClassBonus && (
            <div className="rounded-xl bg-stone-900/90 border border-stone-800 p-3 flex items-center gap-3">
              <Shield className="w-5 h-5 text-sky-400 shrink-0" />
              <div>
                <div className="text-[10px] font-mono uppercase text-stone-400">
                  Защитные характеристики
                </div>
                <div className="font-mono font-semibold text-stone-100 text-xs mt-0.5">
                  {stats.armorClassBonus}
                </div>
              </div>
            </div>
          )}

          <div className="rounded-xl bg-stone-900/70 border border-stone-800/90 p-3.5 space-y-2">
            <div className="text-[11px] font-mono uppercase text-amber-400">
              Магическое свойство предмета
            </div>
            <p className="text-xs text-stone-200 leading-relaxed">
              {stats?.mechanicalEffect || item.description}
            </p>
            {stats?.chargesInfo && (
              <p className="text-[11px] font-mono text-indigo-300">
                ⚡ Заряды: {stats.chargesInfo}
              </p>
            )}
          </div>

          {stats?.curseEffect && (
            <div className="rounded-xl bg-rose-950/35 border border-rose-500/50 p-3 text-xs text-rose-200">
              <strong className="text-rose-400 font-mono uppercase block text-[10px] mb-1">
                ⚠️ Побочное проклятие:
              </strong>
              {stats.curseEffect}
            </div>
          )}

          {stats?.loreQuote && (
            <blockquote className="border-l-2 border-amber-500/50 pl-3 py-1 text-xs italic text-stone-400">
              {stats.loreQuote}
            </blockquote>
          )}
        </div>

        {/* Actions Footer */}
        <div className="mt-5 pt-4 border-t border-stone-800 flex flex-wrap items-center justify-between gap-2">
          <button
            onClick={handleCopyMarkdown}
            className="px-3.5 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 border border-stone-700 text-xs font-medium text-stone-200 flex items-center gap-2 transition-colors"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                <span className="text-emerald-300">Скопировано для D&D!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-amber-400" />
                <span>Скопировать D&D статблок</span>
              </>
            )}
          </button>

          {inventoryCount > 0 && (
            <button
              onClick={() => onSellItem(item.id)}
              className="px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-xs font-semibold text-amber-300 flex items-center gap-1.5 transition-colors"
            >
              <Coins className="w-4 h-4" />
              <span>Продать 1 шт. (+{item.goldValue} gp)</span>
              <span className="text-[10px] font-mono opacity-80">(в сумке: {inventoryCount})</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
