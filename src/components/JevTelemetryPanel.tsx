import React from 'react';
import { Activity, Cpu, Flame, ShieldAlert, Sparkles, Zap } from 'lucide-react';
import { ElementType, JevDecisionTelemetry } from '../types/game';
import { ELEMENT_META, RARITY_META } from '../data/bestiary';

interface JevTelemetryPanelProps {
  telemetry: JevDecisionTelemetry | null;
  isEvaluating: boolean;
  effectiveDc: number;
  knownRecipeBonus: number;
  upgradeDcReduction: number;
}

export const JevTelemetryPanel: React.FC<JevTelemetryPanelProps> = ({
  telemetry,
  isEvaluating,
  effectiveDc,
  knownRecipeBonus,
  upgradeDcReduction,
}) => {
  if (isEvaluating) {
    return (
      <div className="rounded-2xl border border-[#d0ad77]/40 bg-[#0e1820]/90 p-4 animate-pulse">
        <div className="flex items-center gap-2 text-[#e5cb94] font-mono text-xs uppercase tracking-wider">
          <Cpu className="w-4 h-4 animate-spin" />
          <span>Jev System-1: параллельный расчет матрицы вероятностей...</span>
        </div>
      </div>
    );
  }

  if (!telemetry) {
    return (
      <div className="rounded-2xl border border-[#233845] bg-[#0c151c]/80 p-4 text-[#8ca0ab] text-xs">
        <div className="flex items-center justify-between mb-2">
          <span className="font-mono uppercase tracking-wider text-[#d0ad77] flex items-center gap-1.5 font-semibold">
            <Cpu className="w-4 h-4" />
            Окуляр решений Jev (System-1 NAR)
          </span>
          <span className="px-2 py-0.5 rounded bg-[#13212a] text-[#788e9b] font-mono text-[10px] border border-[#233845]">
            ОЖИДАНИЕ КОМПОНЕНТОВ
          </span>
        </div>
        <p className="text-[#8ca0ab] leading-relaxed">
          Положите <strong className="text-[#f0ece3]">2 или 3 трофея/артефакта</strong> в чашу горнила. Не-авторегрессионная модель{' '}
          <span className="text-[#e5cb94] font-mono">Jev</span> рассчитает вероятности стихий{' '}
          <code className="text-[#d0ad77]">choice</code>, совместимость <code className="text-emerald-400">noul</code> и порог сложности{' '}
          <code className="text-amber-300">score</code> без задержек.
        </p>
      </div>
    );
  }

  const topElements = (
    Object.entries(telemetry.elementAffinity.probabilities) as [ElementType, number][]
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  const topEffects = Object.entries(telemetry.specialEffect.probabilities)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  const compatPct = Math.round(telemetry.isCompatible.noul * 100);
  const cursePct = Math.round(telemetry.curseRisk.noul * 100);
  const rarityMeta = RARITY_META[telemetry.predictedRarity];

  return (
    <div className="rounded-2xl border border-[#c9aa72]/30 bg-[#0c161d] p-4 shadow-lg space-y-3.5">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#ffffff10] pb-2.5">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-[#d0ad77]" />
          <span className="font-mono text-xs font-semibold uppercase tracking-wider text-[#f0ece3]">
            Телеметрия Jev System-1
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold border ${
              telemetry.source === 'live-jev'
                ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
                : 'bg-[#1a2d39] border-[#c9aa72]/40 text-[#e5cb94]'
            }`}
          >
            {telemetry.source === 'live-jev' ? '● LIVE @typesafe-ai/sdk' : '◉ NAR CALIBRATED'}
          </span>
          <span className="px-2 py-0.5 rounded bg-[#101c24] border border-[#233845] text-[#e5cb94] font-mono text-[10px] flex items-center gap-1">
            <Zap className="w-3 h-3" />
            {telemetry.latencyMs} ms
          </span>
        </div>
      </div>

      {/* Primary Metrics Grid: Noul + Score + Predicted Rarity */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="rounded-xl bg-[#111e27] border border-[#213543] p-2.5">
          <div className="text-[10px] font-mono uppercase text-[#8ca0ab] flex items-center justify-between">
            <span>noul (Синергия)</span>
            <Activity className="w-3 h-3 text-emerald-400" />
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span
              className={`text-base font-mono font-bold ${
                compatPct >= 70
                  ? 'text-emerald-400'
                  : compatPct >= 45
                  ? 'text-[#e5cb94]'
                  : 'text-rose-400'
              }`}
            >
              {compatPct}%
            </span>
            <span className="text-[10px] text-[#718591] font-mono">
              p={telemetry.isCompatible.noul}
            </span>
          </div>
          <div className="mt-1.5 h-1.5 w-full rounded-full bg-[#0a1217] overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                compatPct >= 70
                  ? 'bg-emerald-500'
                  : compatPct >= 45
                  ? 'bg-[#d0ad77]'
                  : 'bg-rose-500'
              }`}
              style={{ width: `${compatPct}%` }}
            />
          </div>
        </div>

        <div className="rounded-xl bg-[#111e27] border border-[#213543] p-2.5">
          <div className="text-[10px] font-mono uppercase text-[#8ca0ab] flex items-center justify-between">
            <span>score (Нестаб.)</span>
            <Flame className="w-3 h-3 text-amber-400" />
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-base font-mono font-bold text-[#e5cb94]">
              {telemetry.volatility.score} / 5
            </span>
            <span className="text-[10px] font-mono text-[#8ca0ab]">
              СЛ {effectiveDc}
            </span>
          </div>
          <div className="mt-1.5 flex gap-1">
            {[1, 2, 3, 4, 5].map((lvl) => (
              <div
                key={lvl}
                className={`h-1.5 flex-1 rounded-sm ${
                  lvl <= telemetry.volatility.score
                    ? 'bg-[#d0ad77]'
                    : 'bg-[#0a1217]'
                }`}
              />
            ))}
          </div>
        </div>

        <div className="rounded-xl bg-[#111e27] border border-[#213543] p-2.5">
          <div className="text-[10px] font-mono uppercase text-[#8ca0ab] flex items-center justify-between">
            <span>noul (Проклятие)</span>
            <ShieldAlert className="w-3 h-3 text-purple-400" />
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span
              className={`text-base font-mono font-bold ${
                cursePct >= 55 ? 'text-purple-400' : 'text-[#f0ece3]'
              }`}
            >
              {cursePct}%
            </span>
            <span className={`text-[10px] font-semibold ${rarityMeta.text}`}>
              {rarityMeta.label}
            </span>
          </div>
          <div className="mt-1.5 h-1.5 w-full rounded-full bg-[#0a1217] overflow-hidden">
            <div
              className="h-full rounded-full bg-purple-500 transition-all duration-300"
              style={{ width: `${cursePct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Element Choice Probabilities */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-mono text-[#8ca0ab]">
            choice(elementAffinity) — распределение вероятностей:
          </span>
          {telemetry.elementAffinity.secondaryElement && (
            <span className="px-1.5 py-0.5 rounded bg-[#172b38] border border-[#c9aa72]/40 text-[#e5cb94] font-mono text-[10px] flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5" />
              Двойной резонанс!
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {topElements.map(([el, prob], idx) => {
            const meta = ELEMENT_META[el];
            const pct = Math.round(prob * 100);
            const isSelected =
              idx === 0 || el === telemetry.elementAffinity.secondaryElement;
            return (
              <div
                key={el}
                className={`rounded-xl px-2.5 py-1.5 border text-xs flex items-center justify-between ${
                  isSelected
                    ? `${meta.bg} ${meta.border}`
                    : 'bg-[#101b23] border-[#1e303c] opacity-75'
                }`}
              >
                <span className="flex items-center gap-1.5 truncate">
                  <span>{meta.emoji}</span>
                  <span className={isSelected ? meta.color + ' font-medium' : 'text-[#8ca0ab]'}>
                    {meta.label}
                  </span>
                </span>
                <span className="font-mono text-[11px] text-[#f0ece3]">{pct}%</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Archetype & Special Effect Distributions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-[#ffffff10] text-[11px] font-mono">
        <div className="rounded-xl bg-[#101b23] border border-[#213543] p-2 space-y-1">
          <div className="text-[10px] text-[#8ca0ab] uppercase">
            choice(itemArchetype):
          </div>
          {Object.entries(telemetry.itemArchetype.probabilities)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 2)
            .map(([arch, prob], i) => (
              <div key={arch} className="flex items-center justify-between">
                <span className={i === 0 ? 'text-[#e5cb94] font-semibold' : 'text-[#8ca0ab]'}>
                  {i === 0 ? '▸ ' : '  '}
                  {arch}
                </span>
                <span className="text-[#f0ece3]">{Math.round(prob * 100)}%</span>
              </div>
            ))}
        </div>

        <div className="rounded-xl bg-[#101b23] border border-[#213543] p-2 space-y-1">
          <div className="text-[10px] text-[#8ca0ab] uppercase">
            choice(specialEffect):
          </div>
          {topEffects.slice(0, 2).map(([eff, prob], i) => (
            <div key={eff} className="flex items-center justify-between">
              <span className={i === 0 ? 'text-purple-300 font-semibold' : 'text-[#8ca0ab]'}>
                {i === 0 ? '▸ ' : '  '}
                {eff}
              </span>
              <span className="text-[#f0ece3]">{Math.round(prob * 100)}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* DC Breakdown Footer */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[#ffffff10] text-[11px] text-[#8ca0ab] font-mono">
        <span>Модель: TypeSafe Jev System-1 (NAR)</span>
        <div>
          Итоговая СЛ (DC):{' '}
          <span className="text-[#f0ece3] font-bold">{effectiveDc}</span>
          {(knownRecipeBonus > 0 || upgradeDcReduction > 0) && (
            <span className="text-emerald-400 ml-1">
              (база {telemetry.calculatedDc}
              {knownRecipeBonus > 0 ? ` -${knownRecipeBonus} изучено` : ''}
              {upgradeDcReduction > 0 ? ` -${upgradeDcReduction} горн` : ''})
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
