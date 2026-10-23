import { supabase } from '../supabaseClient';

/**
 * Default standard science laboratory & school property locations for Leon National High School
 */
export const DEFAULT_LAB_LOCATIONS: string[] = [
  'Cabinet 1',
  'Cabinet 2',
  'Cabinet 3',
  'Cabinet 3-4',
  'Cabinet 4',
  'Cabinet 5',
  'Laboratory - Cabinet A',
  'Laboratory Sink Cabinet',
  'Science Laboratory',
  'Science Laboratory - Cabinet 1',
  'Science Preparation Room',
  'Computer Laboratory 1',
  'Audio-Visual Room (AVR)',
  'Physics Lab',
  'Chemistry Lab',
  'Biology Lab'
];

const CUSTOM_LOCATIONS_KEY = 'ilems_custom_locations';
const CACHED_LOCATIONS_KEY = 'ilems_cached_locations';

/**
 * Natural sort comparator so Cabinet 1, Cabinet 2 ... Cabinet 10 are sorted logically
 */
export const sortLocations = (locations: string[]): string[] => {
  return [...locations].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
  );
};

/**
 * Get locally stored custom locations
 */
export const getCustomLocations = (): string[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CUSTOM_LOCATIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

/**
 * Save and remember a new or existing location in localStorage & trigger updates
 */
export const rememberLocation = (newLoc?: string): void => {
  if (!newLoc) return;
  const cleaned = newLoc.trim();
  if (!cleaned) return;

  if (typeof window === 'undefined') return;

  try {
    const existing = getCustomLocations();
    const exists = existing.some(loc => loc.toLowerCase() === cleaned.toLowerCase());
    if (!exists) {
      const updated = [...existing, cleaned];
      localStorage.setItem(CUSTOM_LOCATIONS_KEY, JSON.stringify(updated));
    }

    // Also update active cache if available
    const cachedRaw = localStorage.getItem(CACHED_LOCATIONS_KEY);
    if (cachedRaw) {
      const cached: string[] = JSON.parse(cachedRaw);
      if (!cached.some(c => c.toLowerCase() === cleaned.toLowerCase())) {
        const newCached = sortLocations([...cached, cleaned]);
        localStorage.setItem(CACHED_LOCATIONS_KEY, JSON.stringify(newCached));
      }
    }

    // Dispatch custom event for real-time syncing across dropdowns
    window.dispatchEvent(new CustomEvent('ilems:locations-updated', { detail: cleaned }));
  } catch (err) {
    console.error('Failed to remember location:', err);
  }
};

/**
 * Fetch all distinct locations from both inventory_items (Non-PIS) and property_items (PIS)
 * in the cloud database, merged with standard laboratory locations and user-remembered locations.
 */
export const fetchRememberedLocations = async (): Promise<string[]> => {
  // Start with defaults + custom local entries
  const localCustom = getCustomLocations();
  const locationSet = new Map<string, string>(); // lowercase key -> display value

  // Seed with default locations
  DEFAULT_LAB_LOCATIONS.forEach(loc => {
    locationSet.set(loc.toLowerCase().trim(), loc.trim());
  });

  // Seed with custom local locations
  localCustom.forEach(loc => {
    if (loc?.trim()) {
      locationSet.set(loc.toLowerCase().trim(), loc.trim());
    }
  });

  // Load from Supabase: Non-PIS items (inventory_items)
  try {
    if (supabase && typeof supabase.from === 'function') {
      const [invRes, propRes] = await Promise.all([
        supabase.from('inventory_items').select('location'),
        supabase.from('property_items').select('location')
      ]);

      if (invRes.data && Array.isArray(invRes.data)) {
        invRes.data.forEach((row: { location?: string }) => {
          if (row.location && row.location.trim()) {
            const loc = row.location.trim();
            locationSet.set(loc.toLowerCase(), loc);
          }
        });
      }

      if (propRes.data && Array.isArray(propRes.data)) {
        propRes.data.forEach((row: { location?: string }) => {
          if (row.location && row.location.trim()) {
            const loc = row.location.trim();
            locationSet.set(loc.toLowerCase(), loc);
          }
        });
      }
    }
  } catch (err) {
    console.warn('Could not query database locations, falling back to local list:', err);
  }

  const merged = sortLocations(Array.from(locationSet.values()));

  // Cache to localStorage for instantaneous offline/sync render
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(CACHED_LOCATIONS_KEY, JSON.stringify(merged));
    } catch {}
  }

  return merged;
};

/**
 * Synchronous getter from cache for initial render
 */
export const getCachedLocations = (): string[] => {
  if (typeof window === 'undefined') return DEFAULT_LAB_LOCATIONS;
  try {
    const raw = localStorage.getItem(CACHED_LOCATIONS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}

  const localCustom = getCustomLocations();
  const map = new Map<string, string>();
  DEFAULT_LAB_LOCATIONS.forEach(l => map.set(l.toLowerCase(), l));
  localCustom.forEach(l => map.set(l.toLowerCase(), l));
  return sortLocations(Array.from(map.values()));
};
