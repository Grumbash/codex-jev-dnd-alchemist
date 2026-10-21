export type UserRole = 'guest' | 'player' | 'gm';

export interface AuthSession {
  role: UserRole;
  authenticatedHeroId?: 'quick' | 'nocta' | 'slow';
  tokenUsed?: string;
  loginTime: number;
}

const AUTH_STORAGE_KEY = 'dnd_jev_alchemist_auth_v1';
const CONFIG_STORAGE_KEY = 'dnd_jev_alchemist_auth_config_v1';

export interface AuthConfig {
  partyPasscode: string;
  gmPasscode: string;
}

export const DEFAULT_AUTH_CONFIG: AuthConfig = {
  partyPasscode: 'dalniy_kamen', // Default party passcode
  gmPasscode: 'farstone_gm_master', // Default GM Master passcode
};

export function getAuthConfig(): AuthConfig {
  try {
    const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (raw) return { ...DEFAULT_AUTH_CONFIG, ...JSON.parse(raw) };
  } catch {}
  return DEFAULT_AUTH_CONFIG;
}

export function saveAuthConfig(config: AuthConfig) {
  try {
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
  } catch {}
}

export function getSavedAuthSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (raw) {
      const session = JSON.parse(raw);
      if (session.role && session.role !== 'guest') return session;
    }
  } catch {}
  return null;
}

export function saveAuthSession(session: AuthSession) {
  try {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
  } catch {}
}

export function clearAuthSession() {
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch {}
}

export function checkUrlAuthParams(config: AuthConfig): {
  session: AuthSession | null;
  heroParam?: 'quick' | 'nocta' | 'slow';
} {
  if (typeof window === 'undefined') return { session: null };

  const params = new URLSearchParams(window.location.search);
  const token = params.get('token') || params.get('pass') || params.get('party');
  const gmKey = params.get('gm') || params.get('key') || params.get('admin');
  const heroParam = params.get('hero') as 'quick' | 'nocta' | 'slow' | null;

  // 1. GM Key match
  if (gmKey && gmKey.toLowerCase().trim() === config.gmPasscode.toLowerCase().trim()) {
    const session: AuthSession = {
      role: 'gm',
      tokenUsed: gmKey,
      loginTime: Date.now(),
    };
    saveAuthSession(session);
    return {
      session,
      heroParam: heroParam && ['quick', 'nocta', 'slow'].includes(heroParam) ? heroParam : undefined,
    };
  }

  // 2. Party Passcode match
  if (token && token.toLowerCase().trim() === config.partyPasscode.toLowerCase().trim()) {
    const session: AuthSession = {
      role: 'player',
      authenticatedHeroId:
        heroParam && ['quick', 'nocta', 'slow'].includes(heroParam) ? heroParam : undefined,
      tokenUsed: token,
      loginTime: Date.now(),
    };
    saveAuthSession(session);
    return {
      session,
      heroParam: heroParam && ['quick', 'nocta', 'slow'].includes(heroParam) ? heroParam : undefined,
    };
  }

  return { session: null };
}

export function generateFoundryLinks(baseUrl: string, config: AuthConfig) {
  const cleanBase = baseUrl.split('?')[0].replace(/\/+$/, '');
  return {
    gmLink: `${cleanBase}?key=${encodeURIComponent(config.gmPasscode)}&role=gm`,
    partyGeneralLink: `${cleanBase}?token=${encodeURIComponent(config.partyPasscode)}`,
    quickLink: `${cleanBase}?token=${encodeURIComponent(config.partyPasscode)}&hero=quick`,
    noctaLink: `${cleanBase}?token=${encodeURIComponent(config.partyPasscode)}&hero=nocta`,
    slowLink: `${cleanBase}?token=${encodeURIComponent(config.partyPasscode)}&hero=slow`,
  };
}
