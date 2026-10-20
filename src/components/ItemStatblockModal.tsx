import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  Coins,
  Copy,
  Download,
  FileJson,
  Flame,
  Handshake,
  Rotate3d,
  RotateCcw,
  Shield,
  Sparkles,
  Swords,
  UserCheck,
  X,
} from 'lucide-react';
import { GameItem } from '../types/game';
import { ELEMENT_META, RARITY_META } from '../data/bestiary';
import { CompositeItemSprite } from './CompositeItemSprite';

interface ItemStatblockModalProps {
  item: GameItem | null;
  inventoryCount: number;
  onClose: () => void;
  onSellItem: (itemId: string) => void;
  onAddToCrucible?: (item: GameItem) => void;
  onEquipItem?: (item: GameItem) => void;
  onOpenHaggle?: (item: GameItem) => void;
  onApplyBuff?: (item: GameItem, heroId: 'quick' | 'nocta' | 'slow') => void;
}

export const ItemStatblockModal: React.FC<ItemStatblockModalProps> = ({
  item,
  inventoryCount,
  onClose,
  onSellItem,
  onAddToCrucible,
  onEquipItem,
  onOpenHaggle,
  onApplyBuff,
}) => {
  const [copied, setCopied] = useState(false);
  const [yawDeg, setYawDeg] = useState(0);
  const [pitchDeg, setPitchDeg] = useState(0);
  const [autoSpin, setAutoSpin] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; yaw: number; pitch: number }>({
    x: 0,
    y: 0,
    yaw: 0,
    pitch: 0,
  });

  useEffect(() => {
    setYawDeg(0);
    setPitchDeg(0);
    setAutoSpin(true);
  }, [item?.id]);

  useEffect(() => {
    if (!autoSpin || isDragging || !item) return;
    let rafId: number;
    const animate = () => {
      setYawDeg((prev) => (prev + 0.65) % 360);
      rafId = requestAnimationFrame(animate);
    };
    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, [autoSpin, isDragging, item]);

  if (!item) return null;

  const rarity = RARITY_META[item.rarity];
  const stats = item.stats;
  const svgDomId = `modal-lowpoly-svg-${item.id}`;

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    setAutoSpin(false);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      yaw: yawDeg,
      pitch: pitchDeg,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setYawDeg(dragStartRef.current.yaw + dx * 0.85);
    setPitchDeg(Math.max(-55, Math.min(55, dragStartRef.current.pitch + dy * 0.65)));
  };

  const handlePointerUp = () => {
    setIsDragging(false);
  };

  const handleCopyMarkdown = () => {
    const md = [
      `### ${item.name} (${item.nameEn})`,
      `*${stats?.typeLine || RARITY_META[item.rarity].label}*`,
      item.craftGeneration && item.craftGeneration >= 2
        ? `- **Синтез:** Тир-${item.craftGeneration} (${item.parentItemNames?.join(' + ') || 'Высшая амальгама'})`
        : null,
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

  const handleExportFoundryJson = () => {
    const foundryType =
      item.station === 'blacksmith'
        ? item.archetype === 'breastplate' || item.archetype === 'shield'
          ? 'equipment'
          : 'weapon'
        : item.station === 'alchemist'
          ? 'consumable'
          : 'equipment';

    const foundryDoc = {
      name: `${item.name} (${item.nameEn})`,
      type: foundryType,
      system: {
        description: {
          value: `<p><em>${stats?.typeLine || rarity.label}</em></p><p>${stats?.mechanicalEffect || item.description}</p>${
            stats?.curseEffect ? `<p><strong>Проклятие:</strong> ${stats.curseEffect}</p>` : ''
          }<blockquote>${stats?.loreQuote || ''}</blockquote>`,
        },
        rarity: item.rarity === 'very_rare' ? 'veryRare' : item.rarity,
        price: { value: item.goldValue, denomination: 'gp' },
        attunement: stats?.requiresAttunement ? 1 : 0,
        equipped: false,
        identified: true,
        damage: stats?.damageFormula
          ? { parts: [[stats.damageFormula, item.elements[0] || 'slashing']] }
          : undefined,
      },
      flags: {
        codexJev: {
          itemId: item.id,
          archetype: item.archetype,
          elements: item.elements,
          specialEffect: item.specialEffect,
          craftGeneration: item.craftGeneration ?? 1,
          isMasterwork: Boolean(item.isMasterwork),
          isCursed: Boolean(item.isCursed),
        },
      },
    };

    const blob = new Blob([JSON.stringify(foundryDoc, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${item.nameEn.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-foundry5e.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPngCard = () => {
    const svgEl = document.getElementById(svgDomId) as SVGSVGElement | null;
    if (!svgEl) return;

    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svgEl);
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 920;
      canvas.height = 540;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Dark Arcane Card Background
      const grad = ctx.createLinearGradient(0, 0, 920, 540);
      grad.addColorStop(0, '#171324');
      grad.addColorStop(0.5, '#100d19');
      grad.addColorStop(1, '#09070e');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 920, 540);

      // Rarity Border
      const borderColors: Record<string, string> = {
        common: '#71717a',
        uncommon: '#10b981',
        rare: '#38bdf8',
        very_rare: '#d946ef',
        legendary: '#f59e0b',
        artifact: '#f43f5e',
      };
      ctx.strokeStyle = borderColors[item.rarity] || '#f59e0b';
      ctx.lineWidth = 6;
      ctx.strokeRect(14, 14, 892, 512);

      // Draw Low-Poly 3D Sprite on the Left Pedestal
      ctx.fillStyle = 'rgba(255,255,255,0.03)';
      ctx.fillRect(36, 42, 240, 240);
      ctx.drawImage(img, 46, 52, 220, 220);

      // Title & Rarity
      ctx.fillStyle = borderColors[item.rarity] || '#fbbf24';
      ctx.font = 'bold 15px monospace';
      ctx.fillText(
        `${rarity.label.toUpperCase()} (${rarity.labelEn.toUpperCase()})${
          item.craftGeneration && item.craftGeneration >= 2
            ? ` • СИНТЕЗ ТИР-${item.craftGeneration}`
            : ''
        }`,
        300,
        64
      );

      ctx.fillStyle = '#fef3c7';
      ctx.font = 'bold 24px Georgia, serif';
      ctx.fillText(item.name.slice(0, 42), 300, 100);

      ctx.fillStyle = '#a8a29e';
      ctx.font = 'italic 15px monospace';
      ctx.fillText(stats?.typeLine || item.nameEn, 300, 128);

      // Divider
      ctx.fillStyle = borderColors[item.rarity] || '#f59e0b';
      ctx.fillRect(300, 144, 570, 2);

      let yCursor = 180;
      ctx.font = 'bold 16px monospace';
      if (stats?.damageFormula) {
        ctx.fillStyle = '#fb7185';
        ctx.fillText(`⚔ УРОН: ${stats.damageFormula}`, 300, yCursor);
        yCursor += 30;
      }
      if (stats?.armorClassBonus) {
        ctx.fillStyle = '#38bdf8';
        ctx.fillText(`🛡 ЗАЩИТА: ${stats.armorClassBonus}`, 300, yCursor);
        yCursor += 30;
      }
      if (stats?.savingThrow) {
        ctx.fillStyle = '#c084fc';
        ctx.fillText(`🎲 СПАСБРОСОК: ${stats.savingThrow}`, 300, yCursor);
        yCursor += 30;
      }

      // Wrap Mechanical Effect Text
      ctx.fillStyle = '#e7e5e4';
      ctx.font = '15px sans-serif';
      const words = (stats?.mechanicalEffect || item.description).split(' ');
      let line = '';
      for (const word of words) {
        const test = line + word + ' ';
        if (ctx.measureText(test).width > 560) {
          ctx.fillText(line, 300, yCursor);
          line = word + ' ';
          yCursor += 22;
        } else {
          line = test;
        }
      }
      if (line) {
        ctx.fillText(line, 300, yCursor);
        yCursor += 32;
      }

      // Footer Price & Signature
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 16px monospace';
      ctx.fillText(`🪙 Рыночная цена: ${item.goldValue} gp`, 40, 330);

      ctx.fillStyle = '#78716c';
      ctx.font = '13px monospace';
      ctx.fillText('CODEX JEV • D&D 5E NAR SYSTEM-1 ALCHEMIST', 40, 495);

      const pngUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = pngUrl;
      a.download = `${item.nameEn.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-card.png`;
      a.click();
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`relative w-full max-w-xl rounded-2xl border-2 p-6 bg-gradient-to-b from-[#162733] via-[#101b22] to-[#0a1217] text-[#f0ece3] shadow-2xl ${rarity.border} ${rarity.glow}`}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-stone-400 hover:text-stone-100 border border-stone-800"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Interactive 3D Low-Poly Stage + Item Header */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
          <div className="flex flex-col items-center shrink-0">
            <div
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              title="Потяните мышкой для 3D-вращения Low-Poly модели"
              className={`relative w-32 h-32 rounded-2xl border-2 flex items-center justify-center cursor-grab active:cursor-grabbing select-none touch-none ${rarity.bg} ${rarity.border} shadow-inner`}
            >
              <CompositeItemSprite
                item={item}
                size="xl"
                yawDeg={yawDeg}
                pitchDeg={pitchDeg}
                svgId={svgDomId}
              />
              <span className="absolute bottom-1.5 right-2 text-[9px] font-mono text-stone-400/90 flex items-center gap-0.5 pointer-events-none">
                <Rotate3d className="w-3 h-3 text-amber-400" /> 3D
              </span>
            </div>

            <div className="flex items-center gap-1.5 mt-2">
              <button
                onClick={() => setAutoSpin((s) => !s)}
                className={`px-2 py-0.5 rounded text-[10px] font-mono border transition-colors ${
                  autoSpin
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                    : 'bg-stone-900 border-stone-700 text-stone-400 hover:text-stone-200'
                }`}
              >
                {autoSpin ? '⏸ Стоп 3D' : '▶ Авто-3D'}
              </button>
              <button
                onClick={() => {
                  setAutoSpin(false);
                  setYawDeg(0);
                  setPitchDeg(0);
                }}
                className="p-1 rounded bg-stone-900 hover:bg-stone-800 border border-stone-700 text-stone-400 hover:text-stone-200"
                title="Сбросить 3D угол"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            </div>
          </div>

          <div className="min-w-0 flex-1 pr-4 text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
              <span
                className={`px-2 py-0.5 rounded text-[11px] font-mono uppercase font-bold border ${rarity.bg} ${rarity.border} ${rarity.text}`}
              >
                {rarity.label} ({rarity.labelEn})
              </span>
              {item.craftGeneration && item.craftGeneration >= 2 && (
                <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-fuchsia-500/20 border border-fuchsia-400/60 text-fuchsia-300 flex items-center gap-1">
                  <Flame className="w-3 h-3" /> Синтез Тир-{item.craftGeneration}
                </span>
              )}
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
            {item.parentItemNames && item.parentItemNames.length > 0 && (
              <p className="text-[11px] font-mono text-fuchsia-300/90 mt-1">
                ⚗️ Сплав: {item.parentItemNames.join(' + ')}
              </p>
            )}
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

        {/* Gameplay Actions Row (Recraft, Equip on Hero, Haggle with NPC) */}
        {inventoryCount > 0 && (
          <div className="mt-4 pt-3 border-t border-stone-800/80 grid grid-cols-1 sm:grid-cols-3 gap-2">
            {onAddToCrucible && (
              <button
                onClick={() => {
                  onAddToCrucible(item);
                  onClose();
                }}
                className="px-3 py-2 rounded-xl bg-fuchsia-500/15 hover:bg-fuchsia-500/25 border border-fuchsia-500/40 text-xs font-medium text-fuchsia-200 flex items-center justify-center gap-1.5 transition-colors"
              >
                <Flame className="w-3.5 h-3.5 text-fuchsia-400" />
                <span>В Котёл (Перекрафт)</span>
              </button>
            )}
            {item.kind === 'crafted' && onEquipItem && (
              <button
                onClick={() => {
                  onEquipItem(item);
                  onClose();
                }}
                className="px-3 py-2 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/40 text-xs font-medium text-sky-200 flex items-center justify-center gap-1.5 transition-colors"
              >
                <UserCheck className="w-3.5 h-3.5 text-sky-400" />
                <span>Надеть на Героя</span>
              </button>
            )}
            {item.kind === 'crafted' && onOpenHaggle && (
              <button
                onClick={() => {
                  onOpenHaggle(item);
                }}
                className="px-3 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-xs font-medium text-emerald-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Handshake className="w-3.5 h-3.5 text-emerald-400" />
                <span>Торг с NPC (Jev)</span>
              </button>
            )}

            {onApplyBuff && (
              <div className="col-span-full flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-[#0b1319] border border-[#c9aa72]/30 mt-1">
                <span className="text-xs font-semibold text-[#e5cb94] flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Применить эффект на героя (3 боя):</span>
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      onApplyBuff(item, 'quick');
                      onClose();
                    }}
                    className="px-2.5 py-1 rounded-lg bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-200 text-xs font-medium flex items-center gap-1 cursor-pointer transition-colors"
                    title="Скормить Квику (Мутация Обжоры: Временные HP + урон)"
                  >
                    <span>🍽️ Квик</span>
                  </button>
                  <button
                    onClick={() => {
                      onApplyBuff(item, 'nocta');
                      onClose();
                    }}
                    className="px-2.5 py-1 rounded-lg bg-indigo-950/70 hover:bg-indigo-900 border border-indigo-500/40 text-indigo-200 text-xs font-medium flex items-center gap-1 cursor-pointer transition-colors"
                    title="Настой для Нокты (Теневой настой: КД + разделка)"
                  >
                    <span>🥷 Нокта</span>
                  </button>
                  <button
                    onClick={() => {
                      onApplyBuff(item, 'slow');
                      onClose();
                    }}
                    className="px-2.5 py-1 rounded-lg bg-amber-950/70 hover:bg-amber-900 border border-amber-500/40 text-amber-200 text-xs font-medium flex items-center gap-1 cursor-pointer transition-colors"
                    title="Смазка клинка Слоу (Боевая закалка: Атака + урон)"
                  >
                    <span>⚔️ Слоу</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Export & Quick Sell Footer */}
        <div className="mt-4 pt-3 border-t border-stone-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={handleCopyMarkdown}
              className="px-2.5 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 border border-stone-700 text-[11px] font-medium text-stone-200 flex items-center gap-1.5 transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-300">Скопировано!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-amber-400" />
                  <span>MD Статблок</span>
                </>
              )}
            </button>

            <button
              onClick={handleExportPngCard}
              className="px-2.5 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 border border-stone-700 text-[11px] font-medium text-stone-200 flex items-center gap-1.5 transition-colors"
              title="Скачать PNG-карточку с текущим 3D-ракурсом"
            >
              <Download className="w-3.5 h-3.5 text-sky-400" />
              <span>PNG Карточка</span>
            </button>

            <button
              onClick={handleExportFoundryJson}
              className="px-2.5 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 border border-stone-700 text-[11px] font-medium text-stone-200 flex items-center gap-1.5 transition-colors"
              title="Экспорт предмета в формат FoundryVTT dnd5e JSON"
            >
              <FileJson className="w-3.5 h-3.5 text-purple-400" />
              <span>FoundryVTT .json</span>
            </button>
          </div>

          {inventoryCount > 0 && (
            <button
              onClick={() => onSellItem(item.id)}
              className="px-3.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-xs font-semibold text-amber-300 flex items-center gap-1.5 transition-colors"
            >
              <Coins className="w-3.5 h-3.5" />
              <span>Продать (+{item.goldValue} gp)</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
