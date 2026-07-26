import { renderToStaticMarkup } from 'react-dom/server';
import L from 'leaflet';
import {
  Plane, Shield, Zap, Droplets, Pickaxe, Trash2, Server, Factory, Building2,
  Anchor, Ship, TrainFront, Train, TramFront, Bus, Waves, Flag, Trees,
  Cross, Stethoscope, School, GraduationCap, Library, Drama, Film, Utensils,
  Coffee, Beer, Landmark, Pill, Fuel, SquareParking, Church, Mail,
  ShoppingBag, AlertTriangle, MapPin,
  type LucideIcon,
} from 'lucide-react';
import type { FeatureCategory } from '../hooks/useOverpassFeatures';

// subtype string (from useOverpassFeatures.categorise) → Lucide glyph.
// Raw OSM amenity/shop values flow through as the subtype, so common ones
// (theatre, bench, cafe…) map directly without touching the categoriser.
const SUBTYPE_ICONS: Record<string, LucideIcon> = {
  // transit
  bus_stop: Bus,
  'railway:station': TrainFront,
  'railway:halt': Train,
  'railway:tram_stop': TramFront,
  'pt:station': TrainFront,
  station: TrainFront,
  subway: TrainFront,
  ferry_terminal: Ship,
  harbour: Anchor,
  // airport
  aerodrome: Plane,
  // water / green
  water: Waves,
  park: Trees,
  golf_course: Flag,
  // health / education
  hospital: Cross,
  clinic: Stethoscope,
  school: School,
  'school:primary': School,
  'school:secondary': School,
  university: GraduationCap,
  college: GraduationCap,
  library: Library,
  // leisure / food
  theatre: Drama,
  cinema: Film,
  restaurant: Utensils,
  fast_food: Utensils,
  cafe: Coffee,
  bar: Beer,
  pub: Beer,
  // services
  bank: Landmark,
  pharmacy: Pill,
  fuel: Fuel,
  parking: SquareParking,
  place_of_worship: Church,
  post_office: Mail,
  // industrial / hazard
  industrial: Factory,
  commercial: Building2,
  substation: Zap,
  wastewater: Droplets,
  quarry: Pickaxe,
  landfill: Trash2,
  data_center: Server,
  // military
  military: Shield,
};

const CATEGORY_ICONS: Record<FeatureCategory, LucideIcon> = {
  amenity: MapPin,
  industrial: Factory,
  airport: Plane,
  water: Waves,
  park: Trees,
  place: MapPin,
  transit: Bus,
  hazard: AlertTriangle,
  military: Shield,
  other: MapPin,
};

function pickIcon(subtype: string, category: FeatureCategory): LucideIcon {
  if (SUBTYPE_ICONS[subtype]) return SUBTYPE_ICONS[subtype];
  if (subtype.startsWith('shop:')) return ShoppingBag;
  return CATEGORY_ICONS[category] ?? MapPin;
}

// All badge colours are mid/bright so the dark glyph stays legible on every fill.
const HEALTH = new Set(['hospital', 'clinic', 'pharmacy', 'doctors', 'dentist']);
const FOOD = new Set(['restaurant', 'fast_food', 'cafe', 'bar', 'pub', 'food_court', 'biergarten']);
const EDUCATION = new Set(['school', 'school:primary', 'school:secondary', 'university', 'college', 'library', 'kindergarten']);
const CULTURE = new Set(['theatre', 'cinema', 'arts_centre', 'place_of_worship', 'nightclub', 'museum']);

// Category-only colour spreads most POIs onto one hue (amenity was the catch-all).
// Sub-group amenities so different points read differently; green is parks only.
export function featureColor(subtype: string, category: FeatureCategory): string {
  switch (category) {
    case 'hazard': return '#fb923c';     // orange
    case 'military': return '#bdb76b';   // khaki (app's existing military tone)
    case 'airport': return '#ef4444';    // red
    case 'water': return '#22d3ee';      // cyan
    case 'transit': return '#3b82f6';    // blue
    case 'industrial': return '#cbd5e1'; // light slate
    case 'park': return '#22c55e';       // green
    case 'place': return '#9ca3af';      // gray
    case 'amenity':
      if (HEALTH.has(subtype)) return '#fb7185';     // rose
      if (FOOD.has(subtype)) return '#fbbf24';       // amber
      if (EDUCATION.has(subtype)) return '#c084fc';  // purple
      if (CULTURE.has(subtype)) return '#e879f9';    // fuchsia
      if (subtype.startsWith('shop:')) return '#2dd4bf'; // teal
      return '#9ca3af';                              // civic/other amenity — gray
    default: return '#9ca3af';
  }
}

// Memoised per (subtype, dim) — renderToStaticMarkup runs at most once per
// distinct glyph variant (~30), not per marker. Colour is derived from subtype.
const iconCache = new Map<string, L.DivIcon>();

export function featureDivIcon(
  subtype: string,
  category: FeatureCategory,
  dim: boolean,
): L.DivIcon {
  const key = `${subtype}|${category}|${dim ? 'd' : 'f'}`;
  const cached = iconCache.get(key);
  if (cached) return cached;

  const Icon = pickIcon(subtype, category);
  const color = featureColor(subtype, category);
  const glyph = renderToStaticMarkup(<Icon size={11} color="#11161c" strokeWidth={2.5} />);
  const html =
    `<div style="width:18px;height:18px;border-radius:50%;background:${color};` +
    `display:flex;align-items:center;justify-content:center;opacity:${dim ? 0.6 : 1};` +
    `box-shadow:0 0 0 1.5px rgba(255,255,255,.75),0 1px 2px rgba(0,0,0,.6)">${glyph}</div>`;
  const icon = L.divIcon({
    className: 'settl-feature-pin',
    html,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
  iconCache.set(key, icon);
  return icon;
}
