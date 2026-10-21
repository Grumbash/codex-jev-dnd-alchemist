import React, { useState } from 'react';
import {
  AuthConfig,
  AuthSession,
  generateFoundryLinks,
  saveAuthConfig,
  saveAuthSession,
  clearAuthSession,
} from '../utils/auth';
import { sfx } from '../utils/sound';
import { Shield, KeyRound, Copy, Check, LogOut, ExternalLink, Crown, Users } from 'lucide-react';

interface AccessGateModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: AuthSession | null;
  authConfig: AuthConfig;
  onUpdateSession: (session: AuthSession | null) => void;
  onUpdateConfig: (config: AuthConfig) => void;
  onSelectHero?: (heroId: 'quick' | 'nocta' | 'slow') => void;
}

export const AccessGateModal: React.FC<AccessGateModalProps> = ({
  isOpen,
  onClose,
  session,
  authConfig,
  onUpdateSession,
  onUpdateConfig,
  onSelectHero,
}) => {
  const [passInput, setPassInput] = useState('');
  const [selectedHero, setSelectedHero] = useState<'quick' | 'nocta' | 'slow'>('quick');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // GM Settings state
  const [isEditingConfig, setIsEditingConfig] = useState(false);
  const [newPartyPass, setNewPartyPass] = useState(authConfig.partyPasscode);
  const [newGmPass, setNewGmPass] = useState(authConfig.gmPasscode);

  if (!isOpen) return null;

  const currentUrl = typeof window !== 'undefined' ? window.location.href : 'https://alchemy.dungeonmancer.com';
  const links = generateFoundryLinks(currentUrl, authConfig);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const clean = passInput.trim();

    if (!clean) {
      setErrorMsg('Введите пароль отряда или ключ Ведущего');
      return;
    }

    if (clean.toLowerCase() === authConfig.gmPasscode.toLowerCase()) {
      const nextSession: AuthSession = {
        role: 'gm',
        loginTime: Date.now(),
        tokenUsed: clean,
      };
      saveAuthSession(nextSession);
      onUpdateSession(nextSession);
      sfx.playSuccess(true);
      setPassInput('');
      onClose();
      return;
    }

    if (clean.toLowerCase() === authConfig.partyPasscode.toLowerCase()) {
      const nextSession: AuthSession = {
        role: 'player',
        authenticatedHeroId: selectedHero,
        loginTime: Date.now(),
        tokenUsed: clean,
      };
      saveAuthSession(nextSession);
      onUpdateSession(nextSession);
      if (onSelectHero) onSelectHero(selectedHero);
      sfx.playSuccess(false);
      setPassInput('');
      onClose();
      return;
    }

    sfx.playFail();
    setErrorMsg('Неверный ключ. Проверьте пароль у Мастера или в Foundry VTT.');
  };

  const handleSaveConfig = () => {
    if (!newPartyPass.trim() || !newGmPass.trim()) return;
    const nextConfig: AuthConfig = {
      partyPasscode: newPartyPass.trim(),
      gmPasscode: newGmPass.trim(),
    };
    saveAuthConfig(nextConfig);
    onUpdateConfig(nextConfig);
    setIsEditingConfig(false);
    sfx.playClick();
  };

  const copyToClipboard = (text: string, keyName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyName);
    sfx.playClick();
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleLogout = () => {
    clearAuthSession();
    onUpdateSession(null);
    sfx.playClick();
  };

  const isGuest = !session || session.role === 'guest';
  const isGm = session?.role === 'gm';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-stone-900 border-2 border-amber-500/40 rounded-2xl shadow-[0_0_60px_rgba(217,119,6,0.3)] overflow-hidden flex flex-col">
        {/* Header Ribbon */}
        <div className="bg-gradient-to-r from-stone-950 via-amber-950/60 to-stone-950 px-6 py-4 border-b border-amber-500/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300 text-xl shadow-inner">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-serif font-black text-amber-200 text-base tracking-wide uppercase">
                {isGuest ? 'Магический Барьер Дальнего Камня' : 'Управление Доступом & Foundry VTT'}
              </h2>
              <p className="text-xs text-stone-400">
                Кампания «Монстры» • Защита чертогов алхимии от посторонних
              </p>
            </div>
          </div>

          {!isGuest && (
            <button
              onClick={onClose}
              className="text-stone-400 hover:text-amber-300 p-1.5 rounded-lg hover:bg-stone-800 transition"
            >
              ✕
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* 1. GUEST LOGIN SCREEN */}
          {isGuest ? (
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="p-4 rounded-xl bg-gradient-to-r from-stone-950 to-amber-950/30 border border-amber-500/20 text-xs text-stone-300 space-y-2">
                <div className="flex items-center gap-2 font-serif font-bold text-amber-300">
                  <span>🗝️</span>
                  <span>Вход для игроков и Ведущего</span>
                </div>
                <p>
                  Логово на мысе Дальний Камень запечатано рунами лича Ирвека Сааля. Для входа
                  введите пароль отряда или ключ Ведущего.
                </p>
                <div className="text-[11px] text-stone-400 font-mono pt-1">
                  💡 Игроки из Foundry VTT могут просто кликнуть персональную ссылку от Мастера,
                  чтобы заходить мгновенно без паролей.
                </div>
              </div>

              {/* Character Selection for Players */}
              <div className="space-y-2">
                <label className="text-xs font-serif font-semibold text-stone-300">
                  Выберите вашего персонажа (для игроков):
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'quick', name: 'Квик', role: 'Мимик • Варвар' },
                    { id: 'nocta', name: 'Нокта', role: 'Монах Пути Тени' },
                    { id: 'slow', name: 'Слоу', role: 'Полуорк Чемпион' },
                  ].map((hero) => (
                    <button
                      key={hero.id}
                      type="button"
                      onClick={() => setSelectedHero(hero.id as any)}
                      className={`p-2.5 rounded-xl border text-center transition-all ${
                        selectedHero === hero.id
                          ? 'bg-amber-500/20 border-amber-400 text-amber-200 shadow-md'
                          : 'bg-stone-950/60 border-stone-800 text-stone-400 hover:text-stone-200'
                      }`}
                    >
                      <div className="text-sm font-bold font-serif">{hero.name}</div>
                      <div className="text-[10px] text-stone-400 mt-0.5">{hero.role}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Passcode Input */}
              <div className="space-y-2">
                <label className="text-xs font-serif font-semibold text-stone-300 flex items-center justify-between">
                  <span>Ключ доступа (Пароль отряда или GM-ключ):</span>
                  <span className="text-[10px] text-stone-500 font-mono">
                    По умолч.: dalniy_kamen
                  </span>
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={passInput}
                    onChange={(e) => {
                      setPassInput(e.target.value);
                      setErrorMsg(null);
                    }}
                    placeholder="Введите пароль..."
                    className="w-full px-4 py-3 rounded-xl bg-stone-950 border border-stone-700 text-stone-100 text-sm font-mono focus:outline-none focus:border-amber-400"
                    autoFocus
                  />
                  <div className="absolute right-3 top-3 text-stone-500">
                    <KeyRound className="w-5 h-5" />
                  </div>
                </div>
                {errorMsg && (
                  <p className="text-xs text-rose-400 font-mono mt-1 animate-shake">{errorMsg}</p>
                )}
              </div>

              <button
                type="submit"
                className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-stone-950 font-bold text-sm shadow-xl transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>🔓</span>
                <span>Войти в Тигель Дальнего Камня</span>
              </button>
            </form>
          ) : (
            /* 2. AUTHENTICATED USER & FOUNDRY LINKS SCREEN */
            <div className="space-y-6">
              {/* Active Session Status */}
              <div className="p-4 rounded-xl bg-stone-950 border border-stone-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300">
                    {isGm ? <Crown className="w-5 h-5" /> : <Users className="w-5 h-5" />}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-stone-200">
                      Текущий статус: {isGm ? '👑 Ведущий (GM / Admin)' : '⚔️ Игрок отряда'}
                    </div>
                    <div className="text-[11px] text-stone-400">
                      {isGm
                        ? 'Полный доступ к панели Ведущего, выдаче наград и настройкам ключей'
                        : `Авторизован в роли персонажа`}
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleLogout}
                  className="px-3 py-1.5 rounded-lg border border-rose-500/40 bg-rose-950/30 hover:bg-rose-900/50 text-rose-300 text-xs font-semibold flex items-center gap-1.5 transition"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Выйти</span>
                </button>
              </div>

              {/* FOUNDRY VTT ONE-CLICK LINKS (FOR GM & PLAYERS) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-serif font-bold text-amber-200 text-sm flex items-center gap-2">
                    <ExternalLink className="w-4 h-4 text-amber-400" />
                    <span>Ссылки для Foundry VTT (Вход без паролей)</span>
                  </h3>
                  <span className="text-[11px] text-stone-400 font-mono">
                    Вставьте в Заметку или Макрос Foundry
                  </span>
                </div>

                <p className="text-xs text-stone-400">
                  Каждая ссылка содержит авторизационный токен. При клике из Foundry игрок сразу
                  попадает в интерфейс алхимии под своим персонажем:
                </p>

                <div className="space-y-2">
                  {[
                    {
                      label: '👁️ Квик (Варвар / Обжора)',
                      url: links.quickLink,
                      key: 'quick',
                    },
                    {
                      label: '🌑 Нокта (Монах Пути Тени)',
                      url: links.noctaLink,
                      key: 'nocta',
                    },
                    {
                      label: '🛡️ Слоу (Полуорк Чемпион)',
                      url: links.slowLink,
                      key: 'slow',
                    },
                    {
                      label: '👑 Ссылка Ведущего (GM Key)',
                      url: links.gmLink,
                      key: 'gm',
                    },
                  ].map((item) => (
                    <div
                      key={item.key}
                      className="p-3 rounded-xl bg-stone-950/70 border border-stone-800 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-stone-300">{item.label}</div>
                        <div className="text-[11px] text-stone-500 font-mono truncate max-w-sm">
                          {item.url}
                        </div>
                      </div>

                      <button
                        onClick={() => copyToClipboard(item.url, item.key)}
                        className="px-3 py-1.5 rounded-lg border border-amber-500/30 bg-stone-900 hover:bg-stone-800 text-amber-300 text-xs font-mono flex items-center gap-1.5 transition shrink-0"
                      >
                        {copiedKey === item.key ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-emerald-400">Скопировано!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Копировать</span>
                          </>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* GM PASSCODE MANAGEMENT */}
              {isGm && (
                <div className="pt-2 border-t border-stone-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-serif font-bold text-xs text-stone-300">
                      Смена ключей доступа кампании:
                    </h4>
                    {!isEditingConfig && (
                      <button
                        onClick={() => setIsEditingConfig(true)}
                        className="text-xs text-amber-400 hover:underline"
                      >
                        Изменить пароли
                      </button>
                    )}
                  </div>

                  {isEditingConfig ? (
                    <div className="space-y-3 p-3 rounded-xl bg-stone-950 border border-stone-800">
                      <div className="space-y-1">
                        <label className="text-[11px] text-stone-400">Пароль отряда (Party):</label>
                        <input
                          type="text"
                          value={newPartyPass}
                          onChange={(e) => setNewPartyPass(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-lg bg-stone-900 border border-stone-700 text-xs font-mono text-stone-200"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] text-stone-400">Ключ Ведущего (GM):</label>
                        <input
                          type="text"
                          value={newGmPass}
                          onChange={(e) => setNewGmPass(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-lg bg-stone-900 border border-stone-700 text-xs font-mono text-stone-200"
                        />
                      </div>
                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          onClick={() => setIsEditingConfig(false)}
                          className="px-3 py-1 rounded-lg text-xs text-stone-400 hover:bg-stone-800"
                        >
                          Отмена
                        </button>
                        <button
                          onClick={handleSaveConfig}
                          className="px-3 py-1 rounded-lg bg-amber-500 text-stone-950 font-bold text-xs"
                        >
                          Сохранить новые ключи
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-[11px] text-stone-500 font-mono flex items-center gap-4">
                      <span>Пароль отряда: {authConfig.partyPasscode}</span>
                      <span>Ключ GM: ••••••••</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
