import { CircleMarker, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import type { Coordinates } from '../../../types';
import { useWikipedia } from '../../../hooks/useWikipedia';
import {
  useOverpassFeatures,
  type NearbyFeature,
} from '../../../hooks/useOverpassFeatures';
import { useReverseGeocode } from '../../../hooks/useNominatim';
import { featureDivIcon } from '../../../utils/featureIcons';
import { useWebcams, pendingWebcam, type WindyWebcam } from '../../../hooks/useWebcams';
import type { WikiArticle } from '../../../types';

// Camera glyph marker — distinct from the circular feature/wiki pins
const webcamIcon = L.divIcon({
  className: 'settl-webcam-pin',
  html: '<div style="font-size:15px;line-height:1;filter:drop-shadow(0 0 2px rgba(0,0,0,.9))">📷</div>',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

interface Props {
  coordsA: Coordinates | null;
  coordsB: Coordinates | null;
}

export function ContextMapLayer({ coordsA, coordsB }: Props) {
  const geoA = useReverseGeocode(coordsA);
  const geoB = useReverseGeocode(coordsB);
  const wikiA = useWikipedia(coordsA, geoA.result?.countryCode ?? null);
  const wikiB = useWikipedia(coordsB, geoB.result?.countryCode ?? null);
  const featuresA = useOverpassFeatures(coordsA);
  const featuresB = useOverpassFeatures(coordsB);
  // Shares the module-level cache with the panel's useWebcams(coordsA) — no extra fetch
  const webcamsA = useWebcams(coordsA);

  return (
    <>
      {featuresA.data && (
        <FeaturePins features={featuresA.data} slot="A" tone="cyan" />
      )}
      {featuresB.data && (
        <FeaturePins features={featuresB.data} slot="B" tone="amber" />
      )}
      {wikiA.data && <WikiPins articles={wikiA.data} slot="A" color="#7eeaff" />}
      {wikiB.data && <WikiPins articles={wikiB.data} slot="B" color="#ffb347" />}
      {webcamsA.data && <WebcamPins webcams={webcamsA.data} />}
    </>
  );
}

function WebcamPins({ webcams }: { webcams: WindyWebcam[] }) {
  return (
    <>
      {webcams
        .filter((c) => Number.isFinite(c.lat) && Number.isFinite(c.lon))
        .map((cam) => (
          <Marker key={`cam-${cam.webcamId}`} position={[cam.lat, cam.lon]} icon={webcamIcon}>
            <Popup>
              <div className="font-mono text-[10px] leading-snug" style={{ maxWidth: 200 }}>
                <div className="font-bold truncate">{cam.title}</div>
                <div className="uppercase text-gray-500">
                  {cam.distanceKm.toFixed(1)} KM · WEBCAM
                </div>
                {cam.thumbnailUrl && (
                  <img
                    src={cam.thumbnailUrl}
                    alt={cam.title}
                    style={{ width: '100%', marginTop: 4, borderRadius: 2 }}
                  />
                )}
                <button
                  type="button"
                  onClick={() => {
                    // Set first so a fresh-mounting panel reads it; event opens the panel + handles the already-open case
                    pendingWebcam.id = cam.webcamId;
                    window.dispatchEvent(
                      new CustomEvent('settl-webcam-select', { detail: { webcamId: cam.webcamId } }),
                    );
                  }}
                  className="block mt-1.5 underline"
                  style={{ color: '#e879f9', background: 'none', border: 0, padding: 0, cursor: 'pointer' }}
                >
                  VIEW FOOTAGE →
                </button>
              </div>
            </Popup>
          </Marker>
        ))}
    </>
  );
}

function FeaturePins({
  features,
  slot,
  tone,
}: {
  features: NearbyFeature[];
  slot: 'A' | 'B';
  tone: 'cyan' | 'amber';
}) {
  return (
    <>
      {features
        .filter((f) => Number.isFinite(f.lat) && Number.isFinite(f.lon))
        .slice(0, 160)
        .map((f) => {
          const dist = typeof f.distanceKm === 'number' ? f.distanceKm.toFixed(2) : '—';
          return (
            <Marker
              key={`feat-${slot}-${f.elementType}-${f.id}`}
              position={[f.lat, f.lon]}
              icon={featureDivIcon(f.subtype, f.category, slot === 'B')}
            >
              <Popup>
                <div className="font-mono text-[10px] leading-snug">
                  <div className="font-bold">{f.name ?? f.subtype}</div>
                  <div className="uppercase text-gray-500">
                    {f.category} · {f.subtype}
                  </div>
                  <div className={tone === 'cyan' ? 'text-cyan-600' : 'text-amber-600'}>
                    {dist} KM · TGT·{slot}
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
    </>
  );
}

function WikiPins({
  articles,
  slot,
  color,
}: {
  articles: WikiArticle[];
  slot: 'A' | 'B';
  color: string;
}) {
  return (
    <>
      {articles
        .filter((a) => Number.isFinite(a.lat) && Number.isFinite(a.lon))
        .slice(0, 12)
        .map((article) => {
          const dist = typeof article.distanceKm === 'number'
            ? article.distanceKm.toFixed(1)
            : '—';
          return (
        <CircleMarker
          key={`wiki-${slot}-${article.language}-${article.pageid}`}
          center={[article.lat, article.lon]}
          radius={7}
          pathOptions={{
            color,
            fillColor: color,
            fillOpacity: 0.12,
            weight: 2,
          }}
        >
          <Popup>
            <div
              className="font-mono text-[10px] leading-snug"
              style={{ maxWidth: 240 }}
            >
              <div className="font-bold uppercase tracking-wide">
                {article.title}
              </div>
              <div className="uppercase text-gray-500 mt-0.5">
                {article.language.toUpperCase()} · {dist}
                KM · TGT·{slot}
              </div>
              {article.extract && (
                <div className="mt-1.5 leading-relaxed line-clamp-4">
                  {article.extract}
                </div>
              )}
              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block mt-1.5 underline"
                style={{ color }}
              >
                OPEN ARTICLE →
              </a>
            </div>
          </Popup>
        </CircleMarker>
          );
        })}
    </>
  );
}
