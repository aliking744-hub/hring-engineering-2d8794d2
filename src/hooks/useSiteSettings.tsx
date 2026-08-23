import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';

interface SiteSettings {
  [key: string]: string;
}

interface PublicSettingsResponse {
  settings: Record<string, string | null>;
}

interface FontSettings {
  heading: string;
  body: string;
  button: string;
  nav: string;
}

interface LogoSettings {
  main: string;
  footer: string;
  auth: string;
  favicon: string;
}

interface CustomFont {
  name: string;
  url: string;
}

interface HslColor {
  h: number;
  s: number;
  l: number;
}

interface SiteSettingsContextType {
  settings: SiteSettings;
  loading: boolean;
  getSetting: (key: string, fallback?: string) => string;
  fonts: FontSettings;
  logos: LogoSettings;
  customFonts: CustomFont[];
  siteName: string;
  refetch: () => Promise<void>;
}

const DEFAULT_FONTS: FontSettings = {
  heading: 'Afarin',
  body: 'IRANSans',
  button: 'IRANSans',
  nav: 'IRANSans',
};

const DEFAULT_FAVICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236366f1' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='2' y='7' width='20' height='14' rx='2' ry='2'/%3E%3Cpath d='M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16'/%3E%3C/svg%3E";

const DEFAULT_LOGOS: LogoSettings = {
  main: '',
  footer: '',
  auth: '',
  favicon: DEFAULT_FAVICON,
};

const DEFAULT_SITE_NAME = 'HRing';

const DEFAULT_COLORS = {
  primary: '#3b82f6',
  accent: '#b84ddb',
  background: '#070811',
  card: '#0f1119',
  foreground: '#f8fafc',
};

const SiteSettingsContext = createContext<SiteSettingsContextType | null>(null);

const normalizeAssetUrl = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('/')) return trimmed;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return null;
    return parsed.toString();
  } catch {
    return null;
  }
};

const loadFontFace = (name: string, url: string) => {
  const cleanName = name.trim();
  const cleanUrl = normalizeAssetUrl(url);
  if (!cleanUrl || !/^[\p{L}\p{N} _-]{2,60}$/u.test(cleanName)) return;

  const existingStyle = Array.from(
    document.querySelectorAll<HTMLStyleElement>('style[data-cms-font]'),
  ).find((style) => style.dataset.cmsFont === cleanName);
  if (existingStyle) existingStyle.remove();

  const extensionSource = cleanUrl.split('#')[0];
  const ext = extensionSource.split('?')[0]?.split('.').pop()?.toLowerCase();
  const format =
    ext === 'woff2'
      ? 'woff2'
      : ext === 'woff'
        ? 'woff'
        : ext === 'otf'
          ? 'opentype'
          : ext === 'ttf'
            ? 'truetype'
            : undefined;

  const style = document.createElement('style');
  style.dataset.cmsFont = cleanName;
  style.textContent = `
    @font-face {
      font-family: '${cleanName}';
      src: url(${JSON.stringify(cleanUrl)})${format ? ` format('${format}')` : ''};
      font-weight: normal;
      font-style: normal;
      font-display: swap;
    }
  `;
  document.head.appendChild(style);
};

const applyFontsToDocument = (fonts: FontSettings) => {
  const root = document.documentElement;
  root.style.setProperty('--font-heading', fonts.heading);
  root.style.setProperty('--font-body', fonts.body);
  root.style.setProperty('--font-button', fonts.button);
  root.style.setProperty('--font-nav', fonts.nav);
  document.body.style.fontFamily = `${fonts.body}, 'BNazanin', 'Inter', system-ui, sans-serif`;
};

const hexToHsl = (hex: string): HslColor | null => {
  const match = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const red = Number.parseInt(match[1].slice(0, 2), 16) / 255;
  const green = Number.parseInt(match[1].slice(2, 4), 16) / 255;
  const blue = Number.parseInt(match[1].slice(4, 6), 16) / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;
  const delta = max - min;
  let hue = 0;
  let saturation = 0;

  if (delta !== 0) {
    saturation = delta / (1 - Math.abs(2 * lightness - 1));
    if (max === red) hue = 60 * (((green - blue) / delta) % 6);
    else if (max === green) hue = 60 * ((blue - red) / delta + 2);
    else hue = 60 * ((red - green) / delta + 4);
  }

  return {
    h: Math.round((hue + 360) % 360),
    s: Math.round(saturation * 100),
    l: Math.round(lightness * 100),
  };
};

const hslValue = ({ h, s, l }: HslColor) => `${h} ${s}% ${l}%`;
const withLightness = (color: HslColor, lightness: number): HslColor => ({
  ...color,
  l: Math.max(0, Math.min(100, Math.round(lightness))),
});

const applyThemeToDocument = (settingsMap: SiteSettings) => {
  const root = document.documentElement;
  const primary = hexToHsl(settingsMap.color_primary || '') ?? hexToHsl(DEFAULT_COLORS.primary)!;
  const accent = hexToHsl(settingsMap.color_accent || '') ?? hexToHsl(DEFAULT_COLORS.accent)!;
  const background = hexToHsl(settingsMap.color_background || '') ?? hexToHsl(DEFAULT_COLORS.background)!;
  const card = hexToHsl(settingsMap.color_card || '') ?? hexToHsl(DEFAULT_COLORS.card)!;
  const foreground = hexToHsl(settingsMap.color_foreground || '') ?? hexToHsl(DEFAULT_COLORS.foreground)!;
  const surfaceDirection = card.l < 50 ? 1 : -1;
  const mutedForeground = withLightness(
    foreground,
    background.l + (foreground.l - background.l) * 0.58,
  );
  const primaryForeground = withLightness(foreground, primary.l > 62 ? 8 : 98);
  const accentForeground = withLightness(foreground, accent.l > 62 ? 8 : 98);

  const variables: Record<string, string> = {
    '--primary': hslValue(primary),
    '--primary-foreground': hslValue(primaryForeground),
    '--ring': hslValue(primary),
    '--aurora-1': hslValue(primary),
    '--glow-primary': hslValue(primary),
    '--spotlight': hslValue(withLightness(primary, Math.min(82, primary.l + 10))),
    '--accent': hslValue(accent),
    '--accent-foreground': hslValue(accentForeground),
    '--aurora-2': hslValue(accent),
    '--glow-accent': hslValue(accent),
    '--background': hslValue(background),
    '--foreground': hslValue(foreground),
    '--card': hslValue(card),
    '--card-foreground': hslValue(foreground),
    '--popover': hslValue(card),
    '--popover-foreground': hslValue(foreground),
    '--glass-bg': hslValue(card),
    '--secondary': hslValue(withLightness(card, card.l + surfaceDirection * 6)),
    '--secondary-foreground': hslValue(foreground),
    '--muted': hslValue(withLightness(card, card.l + surfaceDirection * 4)),
    '--muted-foreground': hslValue(mutedForeground),
    '--input': hslValue(withLightness(card, card.l + surfaceDirection * 6)),
    '--border': hslValue(withLightness(card, card.l + surfaceDirection * 10)),
    '--glass-border': hslValue(withLightness(card, card.l + surfaceDirection * 12)),
  };
  Object.entries(variables).forEach(([key, value]) => root.style.setProperty(key, value));
};

const updateFavicon = (faviconUrl: string) => {
  if (!faviconUrl) return;
  const safeUrl = faviconUrl.startsWith('data:image/svg+xml')
    ? faviconUrl
    : normalizeAssetUrl(faviconUrl);
  if (!safeUrl) return;
  let link = document.querySelector("link[rel*='icon']") as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.type = safeUrl.startsWith('data:') ? 'image/svg+xml' : 'image/x-icon';
  link.href = safeUrl;
};

export const SiteSettingsProvider = ({ children }: { children: ReactNode }) => {
  const [settings, setSettings] = useState<SiteSettings>({});
  const [loading, setLoading] = useState(true);
  const [fonts, setFonts] = useState<FontSettings>(DEFAULT_FONTS);
  const [logos, setLogos] = useState<LogoSettings>(DEFAULT_LOGOS);
  const [customFonts, setCustomFonts] = useState<CustomFont[]>([]);
  const [siteName, setSiteName] = useState<string>(DEFAULT_SITE_NAME);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const response = await apiRequest<PublicSettingsResponse>(
        '/public/settings',
        {},
        { auth: false, retryAuth: false },
      );
      const settingsMap: SiteSettings = {};
      Object.entries(response.settings || {}).forEach(([key, value]) => {
        if (value !== null && value !== undefined) settingsMap[key] = value;
      });
      setSettings(settingsMap);

      document.querySelectorAll('style[data-cms-font]').forEach((style) => style.remove());

      if (settingsMap.custom_fonts) {
        try {
          const parsed: unknown = JSON.parse(settingsMap.custom_fonts);
          const validFonts = Array.isArray(parsed)
            ? parsed.filter((item): item is CustomFont => (
                typeof item === 'object'
                && item !== null
                && typeof (item as CustomFont).name === 'string'
                && typeof (item as CustomFont).url === 'string'
                && /^[\p{L}\p{N} _-]{2,60}$/u.test((item as CustomFont).name.trim())
                && normalizeAssetUrl((item as CustomFont).url) !== null
              ))
            : [];
          setCustomFonts(validFonts);
          validFonts.forEach((font) => loadFontFace(font.name, font.url));
        } catch {
          setCustomFonts([]);
        }
      } else {
        setCustomFonts([]);
      }

      const nextFonts: FontSettings = {
        heading: settingsMap.font_heading || DEFAULT_FONTS.heading,
        body: settingsMap.font_body || DEFAULT_FONTS.body,
        button: settingsMap.font_button || DEFAULT_FONTS.button,
        nav: settingsMap.font_nav || DEFAULT_FONTS.nav,
      };
      setFonts(nextFonts);
      applyFontsToDocument(nextFonts);
      applyThemeToDocument(settingsMap);

      const nextLogos: LogoSettings = {
        main: normalizeAssetUrl(settingsMap.logo_main || '') || DEFAULT_LOGOS.main,
        footer: normalizeAssetUrl(settingsMap.logo_footer || '') || DEFAULT_LOGOS.footer,
        auth: normalizeAssetUrl(settingsMap.logo_auth || '') || DEFAULT_LOGOS.auth,
        favicon: settingsMap.logo_favicon || DEFAULT_LOGOS.favicon,
      };
      setLogos(nextLogos);
      updateFavicon(nextLogos.favicon);
      setSiteName(settingsMap.site_name || DEFAULT_SITE_NAME);
    } catch (error) {
      console.error('Error fetching public HRing settings:', error);
      setSettings({});
      setFonts(DEFAULT_FONTS);
      setLogos(DEFAULT_LOGOS);
      setCustomFonts([]);
      setSiteName(DEFAULT_SITE_NAME);
      document.querySelectorAll('style[data-cms-font]').forEach((style) => style.remove());
      applyFontsToDocument(DEFAULT_FONTS);
      applyThemeToDocument({});
      updateFavicon(DEFAULT_FAVICON);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchSettings();
  }, []);

  const getSetting = (key: string, fallback = '') => (settings[key] || fallback)
    .split('{site_name}')
    .join(siteName);

  return (
    <SiteSettingsContext.Provider
      value={{
        settings,
        loading,
        getSetting,
        fonts,
        logos,
        customFonts,
        siteName,
        refetch: fetchSettings,
      }}
    >
      {children}
    </SiteSettingsContext.Provider>
  );
};

export const useSiteSettings = (): SiteSettingsContextType => {
  const context = useContext(SiteSettingsContext);
  if (!context) {
    return {
      settings: {},
      loading: false,
      getSetting: (_key: string, fallback = '') => fallback,
      fonts: DEFAULT_FONTS,
      logos: DEFAULT_LOGOS,
      customFonts: [],
      siteName: DEFAULT_SITE_NAME,
      refetch: async () => {},
    };
  }
  return context;
};

export const useSiteName = () => useSiteSettings().siteName;
export const useFonts = () => useSiteSettings().fonts;
export const useLogos = () => useSiteSettings().logos;
