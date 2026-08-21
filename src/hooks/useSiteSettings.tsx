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

const DEFAULT_SITE_NAME = 'hring';

const SiteSettingsContext = createContext<SiteSettingsContextType | null>(null);

const loadFontFace = (name: string, url: string) => {
  const existingStyle = document.querySelector(`style[data-font="${name}"]`);
  if (existingStyle) existingStyle.remove();

  const cleanUrl = url.split('#')[0];
  const ext = cleanUrl.split('?')[0]?.split('.').pop()?.toLowerCase();
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
  style.setAttribute('data-font', name);
  style.textContent = `
    @font-face {
      font-family: '${name}';
      src: url('${url}')${format ? ` format('${format}')` : ''};
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

const updateFavicon = (faviconUrl: string) => {
  if (!faviconUrl) return;
  let link = document.querySelector("link[rel*='icon']") as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.type = faviconUrl.startsWith('data:') ? 'image/svg+xml' : 'image/x-icon';
  link.href = faviconUrl;
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

      if (settingsMap.custom_fonts) {
        try {
          const parsed = JSON.parse(settingsMap.custom_fonts) as CustomFont[];
          setCustomFonts(parsed);
          parsed.forEach((font) => loadFontFace(font.name, font.url));
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

      const nextLogos: LogoSettings = {
        main: settingsMap.logo_main || DEFAULT_LOGOS.main,
        footer: settingsMap.logo_footer || DEFAULT_LOGOS.footer,
        auth: settingsMap.logo_auth || DEFAULT_LOGOS.auth,
        favicon: settingsMap.logo_favicon || DEFAULT_LOGOS.favicon,
      };
      setLogos(nextLogos);
      updateFavicon(nextLogos.favicon);
      setSiteName(settingsMap.site_name || DEFAULT_SITE_NAME);
    } catch (error) {
      console.error('Error fetching public HRing settings:', error);
      applyFontsToDocument(DEFAULT_FONTS);
      updateFavicon(DEFAULT_FAVICON);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchSettings();
  }, []);

  const getSetting = (key: string, fallback = '') => settings[key] || fallback;

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
