import { useSiteSettings } from './useSiteSettings';

/**
 * Returns whether a section is visible based on site_settings.
 * Default: visible. Set `section_visible_<id>` to 'false' to hide.
 */
export const useSectionVisible = (sectionId: string): boolean => {
  const { getSetting } = useSiteSettings();
  return getSetting(`section_visible_${sectionId}`, 'true') !== 'false';
};
