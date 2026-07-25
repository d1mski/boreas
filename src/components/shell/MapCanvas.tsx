import { useEffect, useRef, useState } from 'react';
import {
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import type { Coordinates, TabId } from '../../types';
import { iconA, iconB } from '../../utils/mapIcons';
import { fetchIpLocation } from '../../utils/ipLocation';
import { escapeHtml, safeHttpsUrl } from '../../utils/escapeHtml';
import { ContextMapLayer } from './layers/ContextMapLayer';
import { HazardsMapLayer } from './layers/HazardsMapLayer';
import { ClimateCellLayer } from './layers/ClimateCellLayer';
import { useTheme } from '../../contexts/ThemeContext';

const DEFAULT_CENTER: [number, number] = [30, 20];
const CITY_ZOOM = 13;

interface Props {
  coordsA: Coordinates | null;
  coordsB: Coordinates | null;
  onChangeA: (coords: Coordinates) => void;
  onChangeB: (coords: Coordinates) => void;
  activeSlot: 'a' | 'b';
  compareMode: boolean;
  activeTab: TabId | null;
}

function ClickHandler({
  activeSlot,
  onChangeA,
  onChangeB,
}: {
  activeSlot: 'a' | 'b';
  onChangeA: (c: Coordinates) => void;
  onChangeB: (c: Coordinates) => void;
}) {
  useMapEvents({
    click(e) {
      const c = { lat: e.latlng.lat, lon: e.latlng.lng };
      if (activeSlot === 'b') onChangeB(c);
      else onChangeA(c);
    },
  });
  return null;
}

function FitToCoords({
  coordsA,
  coordsB,
}: {
  coordsA: Coordinates | null;
  coordsB: Coordinates | null;
}) {
  const map = useMap();
  const prevA = useRef<Coordinates | null>(null);
  const prevB = useRef<Coordinates | null>(null);
  useEffect(() => {
    const aChanged =
      (coordsA?.lat !== prevA.current?.lat || coordsA?.lon !== prevA.current?.lon) &&
      coordsA !== null;
    const bChanged =
      (coordsB?.lat !== prevB.current?.lat || coordsB?.lon !== prevB.current?.lon) &&
      coordsB !== null;
    const target = bChanged ? coordsB : aChanged ? coordsA : null;
    if (target) {
      map.flyTo([target.lat, target.lon], Math.max(map.getZoom(), CITY_ZOOM));
    }
    prevA.current = coordsA;
    prevB.current = coordsB;
  }, [coordsA?.lat, coordsA?.lon, coordsB?.lat, coordsB?.lon, map]);
  return null;
}

function UserLocationInitial({
  initialHasCoords,
}: {
  initialHasCoords: boolean;
}) {
  const map = useMap();
  useEffect(() => {
    if (initialHasCoords) return;
    // Center on the visitor's coarse IP location — no permission prompt. The
    // OS geolocation popup is reserved for the explicit crosshair button.
    // Per-run `active` flag (not a persisted ref) so this stays correct under
    // React StrictMode's double-invoke; snap (animate:false) to avoid a
    // world-map-to-city flight.
    let active = true;
    fetchIpLocation().then((loc) => {
      if (active && loc) {
        map.setView([loc.lat, loc.lon], CITY_ZOOM, { animate: false });
      }
    });
    return () => {
      active = false;
    };
  }, [map, initialHasCoords]);
  return null;
}

function FlyToListener() {
  const map = useMap();
  useEffect(() => {
    const handler = (e: Event) => {
      const { lat, lon, title, url } = (e as CustomEvent).detail;
      if (typeof lat !== 'number' || typeof lon !== 'number') {
        // Silent in prod (a bad event should not break the map), loud in dev —
        // otherwise a mistyped dispatch just makes fly-to quietly do nothing.
        if (import.meta.env.DEV) {
          console.warn('boreas-flyto: ignoring event with non-numeric coords', { lat, lon });
        }
        return;
      }
      map.flyTo([lat, lon], Math.max(map.getZoom(), 16));
      if (typeof title === 'string' && title) {
        const safeUrl = safeHttpsUrl(url);
        const link = safeUrl
          ? `<br/><a href="${safeUrl}" target="_blank" rel="noopener noreferrer" style="color:rgb(126,234,255);font-size:10px">Open Wikipedia &rarr;</a>`
          : '';
        setTimeout(() => {
          map.openPopup(
            `<div style="font-family:'JetBrains Mono',monospace;font-size:11px"><strong>${escapeHtml(title)}</strong>${link}</div>`,
            [lat, lon],
          );
        }, 700);
      }
    };
    window.addEventListener('boreas-flyto', handler);
    return () => window.removeEventListener('boreas-flyto', handler);
  }, [map]);
  return null;
}

function MapInvalidator() {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    const t1 = setTimeout(() => map.invalidateSize({ animate: false }), 0);
    const t2 = setTimeout(() => map.invalidateSize({ animate: false }), 100);
    const t3 = setTimeout(() => map.invalidateSize({ animate: false }), 400);
    const ro = new ResizeObserver(() => map.invalidateSize({ animate: false }));
    ro.observe(container);
    const onResize = () => map.invalidateSize({ animate: false });
    window.addEventListener('resize', onResize);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      ro.disconnect();
      window.removeEventListener('resize', onResize);
    };
  }, [map]);
  return null;
}

export function MapCanvas({
  coordsA,
  coordsB,
  onChangeA,
  onChangeB,
  activeSlot,
  compareMode,
  activeTab,
}: Props) {
  const { theme } = useTheme();
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = theme === 'dark' || (theme === 'system' && prefersDark);
  const [initial] = useState<{
    center: [number, number];
    zoom: number;
    hadCoords: boolean;
  }>(() => ({
    center: coordsA ? [coordsA.lat, coordsA.lon] : DEFAULT_CENTER,
    zoom: coordsA ? CITY_ZOOM : 3,
    hadCoords: coordsA !== null,
  }));

  const showLine = compareMode && coordsA && coordsB;
  const baseUrl = isDark
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
  const attribution =
    '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>';

  return (
    <div className="absolute inset-0">
      <MapContainer
        center={initial.center}
        zoom={initial.zoom}
        scrollWheelZoom
        zoomControl={false}
        className="h-full w-full"
      >
        <TileLayer
          key={`base-${isDark ? 'dark' : 'light'}`}
          attribution={attribution}
          url={baseUrl}
          maxZoom={20}
        />
        <ClickHandler
          activeSlot={activeSlot}
          onChangeA={onChangeA}
          onChangeB={onChangeB}
        />
        <FitToCoords coordsA={coordsA} coordsB={coordsB} />
        <UserLocationInitial initialHasCoords={initial.hadCoords} />
        <FlyToListener />
        <MapInvalidator />

        {/* Context markers (nearby features / places / wiki / webcams) show
            whenever a pin exists — not gated to the context tab. */}
        {(coordsA || coordsB) && (
          <ContextMapLayer coordsA={coordsA} coordsB={coordsB} />
        )}
        {activeTab === 'hazards' && (
          <HazardsMapLayer coordsA={coordsA} coordsB={coordsB} />
        )}
        {(activeTab === 'wind' || activeTab === 'climate') && (
          <ClimateCellLayer coordsA={coordsA} coordsB={coordsB} />
        )}

        {showLine && (
          <Polyline
            positions={[
              [coordsA!.lat, coordsA!.lon],
              [coordsB!.lat, coordsB!.lon],
            ]}
            pathOptions={{
              color: '#7eeaff',
              weight: 1.2,
              opacity: 0.55,
              dashArray: '4 6',
            }}
          />
        )}

        {coordsA && (
          <Marker
            position={[coordsA.lat, coordsA.lon]}
            icon={iconA}
            draggable
            eventHandlers={{
              dragend: (e) => {
                const ll = e.target.getLatLng();
                onChangeA({ lat: ll.lat, lon: ll.lng });
              },
            }}
          />
        )}
        {coordsB && (
          <Marker
            position={[coordsB.lat, coordsB.lon]}
            icon={iconB}
            draggable
            eventHandlers={{
              dragend: (e) => {
                const ll = e.target.getLatLng();
                onChangeB({ lat: ll.lat, lon: ll.lng });
              },
            }}
          />
        )}
      </MapContainer>
    </div>
  );
}
