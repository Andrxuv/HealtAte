import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faUtensils,
  faDumbbell,
  faLocationDot,
  faRotate,
  faMagnifyingGlass,
  faCircleExclamation,
  faSliders,
  faClock,
  faPhone,
  faMapLocationDot,
  faLocationArrow,
} from '@fortawesome/free-solid-svg-icons';


// ─── API base (mirrors ScanPage pattern) ─────────────────────────────────────
const API_BASE =
  import.meta.env.VITE_API_URL ||
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3001'
    : '');

// ─── Fix Leaflet default icon paths broken by Vite ───────────────────────────
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// ─── FA path data for Leaflet SVG markers ────────────────────────────────────
const FA_PATHS = {
  utensils:
    'M416 0C400 0 288 32 288 176V288c0 35.3 28.7 64 64 64h32V480c0 17.7 14.3 32 32 32s32-14.3 32-32V352h32c35.3 0 64-28.7 64-64V176C544 32 432 0 416 0zM128 0c-17.7 0-32 14.3-32 32V240H64V32C64 14.3 49.7 0 32 0S0 14.3 0 32V240c0 44.2 35.8 80 80 80h16V480c0 17.7 14.3 32 32 32s32-14.3 32-32V320h16c44.2 0 80-35.8 80-80V32c0-17.7-14.3-32-32-32z',
  dumbbell:
    'M96 64c0-17.7 14.3-32 32-32l32 0c17.7 0 32 14.3 32 32l0 160 0 64 0 160c0 17.7-14.3 32-32 32l-32 0c-17.7 0-32-14.3-32-32l0-64-32 0c-17.7 0-32-14.3-32-32l0-64c-17.7 0-32-14.3-32-32s14.3-32 32-32l0-64c0-17.7 14.3-32 32-32l32 0 0-64zm448 0l0 64 32 0c17.7 0 32 14.3 32 32l0 64c17.7 0 32 14.3 32 32s-14.3 32-32 32l0 64c0 17.7-14.3 32-32 32l-32 0 0 64c0 17.7-14.3 32-32 32l-32 0c-17.7 0-32-14.3-32-32l0-160 0-64 0-160c0-17.7 14.3-32 32-32l32 0c17.7 0 32 14.3 32 32zM256 224l0-64 192 0 0 64-192 0zm0 64l192 0 0 64-192 0 0-64z',
  locationDot:
    'M256 0c-88.4 0-160 71.6-160 160c0 130.6 160 352 160 352S416 290.6 416 160C416 71.6 344.4 0 256 0zM256 208a48 48 0 1 1 0-96 48 48 0 1 1 0 96z',
};

function makeFaMarker(pathKey, bgColor) {
  const path = FA_PATHS[pathKey];
  const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="18" height="18">
    <path fill="#fff" d="${path}"/>
  </svg>`;
  const pin = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="48" viewBox="0 0 40 48">
    <defs>
      <filter id="ds" x="-30%" y="-20%" width="160%" height="160%">
        <feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-opacity="0.35"/>
      </filter>
    </defs>
    <path filter="url(#ds)" d="M20 0C9 0 0 9 0 20c0 14 20 28 20 28S40 34 40 20C40 9 31 0 20 0z" fill="${bgColor}"/>
    <circle cx="20" cy="19" r="11" fill="rgba(255,255,255,0.18)"/>
    <g transform="translate(11,10)">${iconSvg}</g>
  </svg>`;
  return L.divIcon({ html: pin, className: '', iconSize: [40, 48], iconAnchor: [20, 48], popupAnchor: [0, -50] });
}

const restaurantMarker = makeFaMarker('utensils',    '#1B4D3E');
const gymMarker        = makeFaMarker('dumbbell',    '#2563eb');
const userMarker       = makeFaMarker('locationDot', '#dc2626');

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDist(m) {
  return m < 1000 ? `${Math.round(m)} ม.` : `${(m / 1000).toFixed(1)} กม.`;
}
function formatRadius(m) {
  return m < 1000 ? `${m} ม.` : `${(m / 1000).toFixed(1)} กม.`;
}

const RADIUS_OPTIONS = [500, 1000, 1500, 2000, 3000, 5000];

// ─── Star row — pure CSS, no FA icons (avoids FA7 free-tier icon gaps) ────────
function StarRow({ rating, reviews }) {
  if (!rating) return null;
  // Build a clipped gold bar over grey stars using CSS background trick
  const pct = Math.round((rating / 5) * 100);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      {/* Grey stars base + gold overlay clip */}
      <span style={{ position: 'relative', display: 'inline-block', fontSize: 11, lineHeight: 1 }}>
        <span style={{ color: '#e5e7eb', letterSpacing: 1 }}>★★★★★</span>
        <span style={{
          position: 'absolute', top: 0, left: 0, overflow: 'hidden',
          width: `${pct}%`, color: '#f59e0b', letterSpacing: 1, whiteSpace: 'nowrap',
        }}>★★★★★</span>
      </span>
      <span style={{ fontSize: 10, color: '#6b7280', fontFamily: 'Kanit,sans-serif' }}>
        {rating.toFixed(1)}{reviews ? ` (${reviews.toLocaleString()})` : ''}
      </span>
    </span>
  );
}


// ─── Main Component ───────────────────────────────────────────────────────────
export default function MapPage() {
  const mapRef       = useRef(null);
  const leafletMap   = useRef(null);
  const markersLayer = useRef(null);

  const [status,        setStatus]        = useState('idle');
  const [errorMsg,      setErrorMsg]      = useState('');
  const [userCoords,    setUserCoords]    = useState(null);
  const [places,        setPlaces]        = useState([]);
  const [activeFilter,  setActiveFilter]  = useState('all');
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [radiusM,       setRadiusM]       = useState(2000);
  const [pendingRadius, setPendingRadius] = useState(2000);

  // ── Init map ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (leafletMap.current) return;
    leafletMap.current = L.map(mapRef.current, {
      center: [13.7563, 100.5018],
      zoom: 14,
      zoomControl: false,
      attributionControl: false,
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 })
      .addTo(leafletMap.current);
    markersLayer.current = L.layerGroup().addTo(leafletMap.current);
    return () => { leafletMap.current?.remove(); leafletMap.current = null; };
  }, []);

  // ── Update markers ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!markersLayer.current) return;
    markersLayer.current.clearLayers();
    if (userCoords) {
      L.marker([userCoords.lat, userCoords.lng], { icon: userMarker })
        .addTo(markersLayer.current)
        .bindPopup('<b style="font-family:Kanit,sans-serif">ตำแหน่งของคุณ</b>');
    }
    const toShow = activeFilter === 'all' ? places : places.filter((p) => p.type === activeFilter);
    toShow.forEach((p) => {
      const icon = p.type === 'gym' ? gymMarker : restaurantMarker;
      L.marker([p.lat, p.lng], { icon })
        .addTo(markersLayer.current)
        .bindPopup(
          `<b style="font-family:Kanit,sans-serif">${p.name}</b><br/>` +
          `<span style="font-family:Kanit,sans-serif;font-size:11px;color:#6b7280">${p.address || ''}</span>`
        )
        .on('click', () => setSelectedPlace(p));
    });
  }, [places, activeFilter, userCoords]);

  // ── Locate → fetch from backend ───────────────────────────────────────────
  const locate = useCallback((overrideRadius) => {
    const searchRadius = overrideRadius ?? pendingRadius;
    setStatus('locating');
    setErrorMsg('');
    setSelectedPlace(null);
    setRadiusM(searchRadius);

    if (!navigator.geolocation) {
      setStatus('error');
      setErrorMsg('เบราว์เซอร์ของคุณไม่รองรับ GPS');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setUserCoords({ lat, lng });
        leafletMap.current?.setView([lat, lng], 15);
        setStatus('loading');
        try {
          const url = `${API_BASE}/api/places?lat=${lat}&lng=${lng}&radius=${searchRadius}&type=all`;
          const res = await fetch(url);
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error || `HTTP ${res.status}`);
          }
          const { places: fetched } = await res.json();
          setPlaces(fetched || []);
          setStatus('done');
        } catch (err) {
          setStatus('error');
          setErrorMsg(err.message || 'ไม่สามารถโหลดข้อมูลสถานที่ได้ กรุณาลองอีกครั้ง');
        }
      },
      (err) => {
        setStatus('error');
        setErrorMsg(
          err.code === 1
            ? 'กรุณาอนุญาตการเข้าถึงตำแหน่งของคุณในเบราว์เซอร์'
            : 'ไม่สามารถระบุตำแหน่งของคุณได้'
        );
      },
      { timeout: 12000, enableHighAccuracy: true }
    );
  }, [pendingRadius]);

  // Auto-locate on mount
  useEffect(() => { locate(2000); }, []); // eslint-disable-line

  const filtered        = activeFilter === 'all' ? places : places.filter((p) => p.type === activeFilter);
  const restaurantCount = places.filter((p) => p.type === 'restaurant').length;
  const gymCount        = places.filter((p) => p.type === 'gym').length;
  const isSearching     = status === 'locating' || status === 'loading';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#F7F5F0', position: 'relative', overflow: 'hidden' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeSlideIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
        @keyframes sheetUp { from { transform:translateY(100%); opacity:0; } to { transform:translateY(0); opacity:1; } }
        .map-place-card { animation: fadeSlideIn 0.3s ease both; transition: transform 0.15s, box-shadow 0.15s; }
        .map-place-card:active { transform: scale(0.97); }
        .map-reload-btn:hover:not(:disabled) { background: #f0fdf4 !important; }
        .map-filter-btn { transition: all 0.2s !important; }
        .map-search-btn:hover:not(:disabled) { filter: brightness(1.1); }
        .map-search-btn:active:not(:disabled) { transform: scale(0.96); }
        .leaflet-container { font-family: Kanit, sans-serif; }
        .detail-sheet { animation: sheetUp 0.32s cubic-bezier(0.32,0.72,0,1) both; }
        .detail-gmaps-btn:hover { filter: brightness(1.08); }
        .detail-gmaps-btn:active { transform: scale(0.97); }
        input[type=range].radius-slider { -webkit-appearance: none; appearance: none; width: 100%; height: 5px;
          border-radius: 99px; background: transparent; cursor: pointer; outline: none; }
        input[type=range].radius-slider::-webkit-slider-runnable-track { height: 5px; border-radius: 99px; background: #e5e7eb; }
        input[type=range].radius-slider::-webkit-slider-thumb { -webkit-appearance: none; appearance: none;
          width: 18px; height: 18px; border-radius: 50%; background: #1B4D3E;
          margin-top: -6.5px; box-shadow: 0 1px 4px rgba(0,0,0,0.2); transition: transform 0.15s; }
        input[type=range].radius-slider::-webkit-slider-thumb:hover { transform: scale(1.15); }
        input[type=range].radius-slider::-moz-range-track { height: 5px; border-radius: 99px; background: #e5e7eb; }
        input[type=range].radius-slider::-moz-range-thumb { width: 18px; height: 18px; border-radius: 50%;
          background: #1B4D3E; border: none; box-shadow: 0 1px 4px rgba(0,0,0,0.2); }
      `}</style>

      {/* ── Header ── */}
      <div style={{
        padding: '20px 20px 14px',
        background: 'linear-gradient(135deg,#1B4D3E 0%,#2A735D 100%)',
        color: '#fff', flexShrink: 0,
      }}>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, fontFamily: 'Kanit,sans-serif',
          display: 'flex', alignItems: 'center', gap: 8 }}>
          <FontAwesomeIcon icon={faMapLocationDot} style={{ fontSize: 16 }} />
          ค้นหาสถานที่สุขภาพ
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 12, opacity: 0.85, fontFamily: 'Kanit,sans-serif' }}>
          ข้อมูลจาก Google Maps · ร้านอาหาร & ฟิตเนสรอบตัวคุณ
        </p>
      </div>

      {/* ── Map ── */}
      <div style={{ position: 'relative', height: 200, flexShrink: 0 }}>
        <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
        <button
          className="map-reload-btn"
          onClick={() => locate(pendingRadius)}
          disabled={isSearching}
          title="รีเฟรชตำแหน่ง"
          style={{
            position: 'absolute', top: 10, right: 10, zIndex: 1000,
            background: '#fff', border: 'none', borderRadius: '50%',
            width: 36, height: 36, boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            cursor: isSearching ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#1B4D3E', transition: 'background 0.2s',
          }}
        >
          <FontAwesomeIcon icon={faRotate} style={{ fontSize: 15,
            animation: isSearching ? 'spin 0.8s linear infinite' : 'none' }} />
        </button>

        {isSearching && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(27,77,62,0.15)', backdropFilter: 'blur(2px)',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', zIndex: 900,
          }}>
            <div style={{
              width: 36, height: 36, border: '4px solid rgba(27,77,62,0.2)',
              borderTop: '4px solid #1B4D3E', borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }} />
            <p style={{ color: '#1B4D3E', fontWeight: 700, marginTop: 8, fontSize: 13, fontFamily: 'Kanit,sans-serif' }}>
              {status === 'locating' ? 'กำลังระบุตำแหน่ง…' : 'กำลังโหลดข้อมูล…'}
            </p>
          </div>
        )}
      </div>

      {/* ── Radius Slider ── */}
      <div style={{ padding: '12px 16px 10px', background: '#fff', borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 12, fontWeight: 600, color: '#374151', fontFamily: 'Kanit,sans-serif' }}>
            <FontAwesomeIcon icon={faSliders} style={{ color: '#1B4D3E', fontSize: 13 }} />
            รัศมีการค้นหา
          </span>
          <span style={{ background: '#f0fdf4', color: '#1B4D3E', fontWeight: 700,
            fontSize: 12, padding: '2px 10px', borderRadius: 99, fontFamily: 'Kanit,sans-serif',
            border: '1.5px solid #bbf7d0' }}>
            {formatRadius(pendingRadius)}
          </span>
        </div>
        <div style={{ position: 'relative' }}>
          <div style={{
            position: 'absolute', top: '50%', left: 0,
            width: `${(RADIUS_OPTIONS.indexOf(pendingRadius) / (RADIUS_OPTIONS.length - 1)) * 100}%`,
            height: 5, background: '#1B4D3E', borderRadius: 99,
            transform: 'translateY(-50%)', pointerEvents: 'none', zIndex: 1,
          }} />
          <input
            type="range" className="radius-slider"
            min={0} max={RADIUS_OPTIONS.length - 1} step={1}
            value={RADIUS_OPTIONS.indexOf(pendingRadius) === -1 ? 3 : RADIUS_OPTIONS.indexOf(pendingRadius)}
            onChange={(e) => setPendingRadius(RADIUS_OPTIONS[+e.target.value])}
            style={{ position: 'relative', zIndex: 2 }}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
          {RADIUS_OPTIONS.map((r) => (
            <span key={r} onClick={() => setPendingRadius(r)} style={{
              fontSize: 9, color: pendingRadius === r ? '#1B4D3E' : '#9ca3af',
              fontWeight: pendingRadius === r ? 700 : 400,
              fontFamily: 'Kanit,sans-serif', cursor: 'pointer', transition: 'color 0.2s',
            }}>{formatRadius(r)}</span>
          ))}
        </div>
        <button
          className="map-search-btn"
          onClick={() => locate(pendingRadius)}
          disabled={isSearching}
          style={{
            marginTop: 10, width: '100%', padding: '9px 0',
            background: '#1B4D3E', color: '#fff', border: 'none',
            borderRadius: 12, fontSize: 13, fontWeight: 700,
            cursor: isSearching ? 'default' : 'pointer',
            fontFamily: 'Kanit,sans-serif',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            opacity: isSearching ? 0.65 : 1, transition: 'opacity 0.2s, filter 0.2s, transform 0.15s',
          }}
        >
          <FontAwesomeIcon icon={isSearching ? faRotate : faMagnifyingGlass}
            style={{ fontSize: 12, animation: isSearching ? 'spin 0.8s linear infinite' : 'none' }} />
          {isSearching ? 'กำลังค้นหา…' : `ค้นหาในรัศมี ${formatRadius(pendingRadius)}`}
        </button>
      </div>

      {/* ── Filter Tabs ── */}
      <div style={{ display: 'flex', gap: 8, padding: '10px 14px',
        background: '#fff', borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
        {[
          { key: 'all',        label: `ทั้งหมด (${places.length})`,    icon: faMapLocationDot },
          { key: 'restaurant', label: `อาหาร (${restaurantCount})`,     icon: faUtensils       },
          { key: 'gym',        label: `ฟิตเนส (${gymCount})`,           icon: faDumbbell       },
        ].map((f) => (
          <button key={f.key} className="map-filter-btn" onClick={() => setActiveFilter(f.key)}
            style={{
              flex: 1, padding: '7px 2px', borderRadius: 20, border: 'none',
              background: activeFilter === f.key ? '#1B4D3E' : '#F7F5F0',
              color: activeFilter === f.key ? '#fff' : '#374151',
              fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'Kanit,sans-serif',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            }}
          >
            <FontAwesomeIcon icon={f.icon} style={{ fontSize: 11 }} />
            <span>{f.label}</span>
          </button>
        ))}
      </div>

      {/* ── Result count ── */}
      {status === 'done' && filtered.length > 0 && (
        <div style={{ padding: '8px 16px 2px', flexShrink: 0 }}>
          <p style={{ margin: 0, fontSize: 11, color: '#6b7280', fontFamily: 'Kanit,sans-serif',
            display: 'flex', alignItems: 'center', gap: 5 }}>
            <FontAwesomeIcon icon={faLocationArrow} style={{ color: '#1B4D3E', fontSize: 10 }} />
            พบ <strong style={{ color: '#1B4D3E', margin: '0 3px' }}>{filtered.length}</strong>
            สถานที่ในรัศมี
            <strong style={{ color: '#1B4D3E', marginLeft: 3 }}>{formatRadius(radiusM)}</strong>
          </p>
        </div>
      )}

      {/* ── List ── */}
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 8 }}>
        {status === 'error' && <ErrorCard msg={errorMsg} onRetry={() => locate(pendingRadius)} />}
        {status === 'done' && filtered.length === 0 && <EmptyCard filter={activeFilter} radius={radiusM} />}
        {status === 'idle' && (
          <div style={{ padding: '40px 20px', textAlign: 'center' }}>
            <FontAwesomeIcon icon={faMapLocationDot} style={{ fontSize: 36, color: '#d1d5db', marginBottom: 8 }} />
            <p style={{ color: '#9ca3af', fontSize: 13, fontFamily: 'Kanit,sans-serif', margin: 0 }}>
              ตั้งค่ารัศมีแล้วกดค้นหา
            </p>
          </div>
        )}

        {filtered.map((p, i) => (
          <PlaceCard
            key={p.id}
            place={p}
            index={i}
            isSelected={selectedPlace?.id === p.id}
            onClick={() => {
              setSelectedPlace(p);
              leafletMap.current?.setView([p.lat, p.lng], 17);
            }}
          />
        ))}

        {isSearching && Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>

      {/* ── Detail Sheet ── */}
      {selectedPlace && (
        <PlaceDetailSheet
          place={selectedPlace}
          onClose={() => setSelectedPlace(null)}
        />
      )}
    </div>
  );
}

// ─── Place Card ───────────────────────────────────────────────────────────────
function PlaceCard({ place, index, isSelected, onClick }) {
  const isGym = place.type === 'gym';
  return (
    <div
      className="map-place-card"
      onClick={onClick}
      style={{
        margin: '4px 12px', padding: '10px 12px',
        background: isSelected ? '#f0fdf4' : '#fff',
        borderRadius: 16,
        border: isSelected ? '2px solid #1B4D3E' : '1.5px solid #f3f4f6',
        display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
        boxShadow: isSelected ? '0 4px 16px rgba(27,77,62,0.15)' : '0 1px 4px rgba(0,0,0,0.05)',
        animationDelay: `${index * 40}ms`,
      }}
    >
      {/* Thumbnail or fallback icon */}
      <div style={{
        width: 52, height: 52, borderRadius: 12, flexShrink: 0, overflow: 'hidden',
        background: isGym
          ? 'linear-gradient(135deg,#dbeafe,#bfdbfe)'
          : 'linear-gradient(135deg,#dcfce7,#bbf7d0)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {place.thumbnail ? (
          <img
            src={place.thumbnail}
            alt={place.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        ) : (
          <FontAwesomeIcon
            icon={isGym ? faDumbbell : faUtensils}
            style={{ fontSize: 20, color: isGym ? '#2563eb' : '#15803d' }}
          />
        )}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          margin: 0, fontWeight: 700, fontSize: 13, color: '#111827',
          fontFamily: 'Kanit,sans-serif', whiteSpace: 'nowrap',
          overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {place.name}
        </p>
        {place.category && (
          <p style={{ margin: '1px 0 0', fontSize: 10, color: '#6b7280', fontFamily: 'Kanit,sans-serif' }}>
            {place.category}
          </p>
        )}
        {place.address && (
          <p style={{
            margin: '1px 0 0', fontSize: 10, color: '#9ca3af', fontFamily: 'Kanit,sans-serif',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {place.address}
          </p>
        )}
        <div style={{ marginTop: 2 }}>
          <StarRow rating={place.rating} reviews={place.reviews} />
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
          {place.openingHours && typeof place.openingHours === 'string' && (
            <span style={{ fontSize: 9, color: '#10b981', fontFamily: 'Kanit,sans-serif',
              display: 'flex', alignItems: 'center', gap: 3 }}>
              <FontAwesomeIcon icon={faClock} style={{ fontSize: 8 }} />
              {place.openingHours}
            </span>
          )}
          {place.phone && (
            <span style={{ fontSize: 9, color: '#6b7280', fontFamily: 'Kanit,sans-serif',
              display: 'flex', alignItems: 'center', gap: 3 }}>
              <FontAwesomeIcon icon={faPhone} style={{ fontSize: 8 }} />
              {place.phone}
            </span>
          )}
        </div>
      </div>

      {/* Distance badge */}
      <span style={{
        background: isGym ? '#dbeafe' : '#dcfce7',
        color: isGym ? '#1d4ed8' : '#15803d',
        fontSize: 11, fontWeight: 700, padding: '4px 10px',
        borderRadius: 20, fontFamily: 'Kanit,sans-serif', flexShrink: 0,
        whiteSpace: 'nowrap',
      }}>
        {formatDist(place.distM)}
      </span>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div style={{ margin: '4px 12px', padding: '10px 12px', background: '#fff',
      borderRadius: 16, border: '1.5px solid #f3f4f6',
      display: 'flex', alignItems: 'center', gap: 10 }}>
      <div className="animate-shimmer" style={{ width: 52, height: 52, borderRadius: 12, flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div className="animate-shimmer" style={{ height: 13, borderRadius: 6, marginBottom: 5, width: '65%' }} />
        <div className="animate-shimmer" style={{ height: 10, borderRadius: 6, marginBottom: 4, width: '40%' }} />
        <div className="animate-shimmer" style={{ height: 9,  borderRadius: 6, width: '55%' }} />
      </div>
      <div className="animate-shimmer" style={{ width: 48, height: 24, borderRadius: 20 }} />
    </div>
  );
}

// ─── Error Card ───────────────────────────────────────────────────────────────
function ErrorCard({ msg, onRetry }) {
  const isMissingKey = msg?.includes('SERPAPI_KEY');
  return (
    <div style={{ margin: '16px 12px', padding: 20, background: '#fff',
      borderRadius: 16, border: '1.5px solid #fee2e2', textAlign: 'center' }}>
      <FontAwesomeIcon icon={faCircleExclamation} style={{ fontSize: 36, color: '#ef4444', marginBottom: 8 }} />
      <p style={{ margin: '0 0 6px', fontSize: 13, color: '#374151', fontFamily: 'Kanit,sans-serif' }}>
        {isMissingKey ? 'ยังไม่ได้ตั้งค่า SERPAPI_KEY' : msg}
      </p>
      {isMissingKey && (
        <p style={{ margin: '0 0 14px', fontSize: 11, color: '#6b7280', fontFamily: 'Kanit,sans-serif',
          background: '#f9fafb', padding: '8px 10px', borderRadius: 8, textAlign: 'left' }}>
          เพิ่ม <code style={{ background: '#f3f4f6', padding: '1px 5px', borderRadius: 4 }}>SERPAPI_KEY=xxx</code>
          {' '}ลงใน <code style={{ background: '#f3f4f6', padding: '1px 5px', borderRadius: 4 }}>backend/.env</code>
          {' '}แล้วรีสตาร์ทเซิร์ฟเวอร์
        </p>
      )}
      <button onClick={onRetry} style={{
        background: '#1B4D3E', color: '#fff', border: 'none',
        borderRadius: 20, padding: '8px 28px',
        fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Kanit,sans-serif',
        display: 'inline-flex', alignItems: 'center', gap: 8,
      }}>
        <FontAwesomeIcon icon={faRotate} />
        ลองอีกครั้ง
      </button>
    </div>
  );
}

// ─── Empty Card ───────────────────────────────────────────────────────────────
function EmptyCard({ filter, radius }) {
  const labels = { restaurant: 'ร้านอาหาร', gym: 'ฟิตเนส', all: 'สถานที่' };
  return (
    <div style={{ padding: '40px 20px', textAlign: 'center' }}>
      <FontAwesomeIcon icon={faMagnifyingGlass} style={{ fontSize: 36, color: '#d1d5db', marginBottom: 8 }} />
      <p style={{ color: '#6b7280', fontSize: 13, fontFamily: 'Kanit,sans-serif', margin: 0 }}>
        ไม่พบ{labels[filter]}ในรัศมี {formatRadius(radius)}
      </p>
    </div>
  );
}

// ─── Place Detail Sheet ───────────────────────────────────────────────────────
function PlaceDetailSheet({ place, onClose }) {
  const isGym = place.type === 'gym';
  const accentColor = isGym ? '#2563eb' : '#1B4D3E';
  const pct = place.rating ? Math.round((place.rating / 5) * 100) : 0;

  const mapsUrl = place.mapsUrl ||
    `https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}`;
  const directionsUrl =
    `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute', inset: 0, zIndex: 1100,
          background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(1px)',
        }}
      />

      {/* Sheet */}
      <div
        className="detail-sheet"
        style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          zIndex: 1200,
          background: '#fff',
          borderRadius: '24px 24px 0 0',
          maxHeight: '78%',
          overflowY: 'auto',
          boxShadow: '0 -8px 40px rgba(0,0,0,0.18)',
        }}
      >
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 99, background: '#e5e7eb' }} />
        </div>

        {/* Thumbnail */}
        {place.thumbnail && (
          <div style={{ position: 'relative', height: 140, overflow: 'hidden', margin: '0 0 0 0' }}>
            <img
              src={place.thumbnail}
              alt={place.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            {/* Category badge over image */}
            <span style={{
              position: 'absolute', top: 10, left: 14,
              background: accentColor, color: '#fff',
              fontSize: 10, fontWeight: 700, padding: '3px 10px',
              borderRadius: 99, fontFamily: 'Kanit,sans-serif',
            }}>
              {isGym ? 'ฟิตเนส / ยิม' : 'ร้านอาหาร'}
            </span>
          </div>
        )}

        <div style={{ padding: '14px 18px 24px' }}>
          {/* Category badge (no thumbnail fallback) */}
          {!place.thumbnail && (
            <span style={{
              display: 'inline-block', background: accentColor + '18', color: accentColor,
              fontSize: 10, fontWeight: 700, padding: '2px 10px',
              borderRadius: 99, fontFamily: 'Kanit,sans-serif', marginBottom: 6,
            }}>
              {place.category || (isGym ? 'ฟิตเนส / ยิม' : 'ร้านอาหาร')}
            </span>
          )}

          {/* Name */}
          <h2 style={{
            margin: '0 0 6px', fontSize: 17, fontWeight: 700,
            color: '#111827', fontFamily: 'Kanit,sans-serif', lineHeight: 1.3,
          }}>
            {place.name}
          </h2>

          {/* Category (with thumbnail) */}
          {place.thumbnail && place.category && (
            <p style={{ margin: '0 0 6px', fontSize: 11, color: '#6b7280', fontFamily: 'Kanit,sans-serif' }}>
              {place.category}
            </p>
          )}

          {/* Rating + distance row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
            {place.rating && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                {/* Star bar */}
                <span style={{ position: 'relative', display: 'inline-block', fontSize: 14, lineHeight: 1 }}>
                  <span style={{ color: '#e5e7eb', letterSpacing: 1 }}>★★★★★</span>
                  <span style={{
                    position: 'absolute', top: 0, left: 0, overflow: 'hidden',
                    width: `${pct}%`, color: '#f59e0b', letterSpacing: 1, whiteSpace: 'nowrap',
                  }}>★★★★★</span>
                </span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#111827', fontFamily: 'Kanit,sans-serif' }}>
                  {place.rating.toFixed(1)}
                </span>
                {place.reviews && (
                  <span style={{ fontSize: 11, color: '#6b7280', fontFamily: 'Kanit,sans-serif' }}>
                    ({place.reviews.toLocaleString()} รีวิว)
                  </span>
                )}
              </span>
            )}
            <span style={{
              background: isGym ? '#dbeafe' : '#dcfce7',
              color: isGym ? '#1d4ed8' : '#15803d',
              fontSize: 11, fontWeight: 700, padding: '2px 10px',
              borderRadius: 99, fontFamily: 'Kanit,sans-serif',
            }}>
              {formatDist(place.distM)}
            </span>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: '#f3f4f6', margin: '10px 0' }} />

          {/* Address */}
          {place.address && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'flex-start' }}>
              <FontAwesomeIcon icon={faLocationDot} style={{ color: accentColor, fontSize: 13, marginTop: 2, flexShrink: 0 }} />
              <p style={{ margin: 0, fontSize: 12, color: '#374151', fontFamily: 'Kanit,sans-serif', lineHeight: 1.5 }}>
                {place.address}
              </p>
            </div>
          )}

          {/* Opening hours */}
          {place.openingHours && typeof place.openingHours === 'string' && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
              <FontAwesomeIcon icon={faClock} style={{ color: '#10b981', fontSize: 13, flexShrink: 0 }} />
              <p style={{ margin: 0, fontSize: 12, color: '#10b981', fontFamily: 'Kanit,sans-serif', fontWeight: 600 }}>
                {place.openingHours}
              </p>
            </div>
          )}

          {/* Phone */}
          {place.phone && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
              <FontAwesomeIcon icon={faPhone} style={{ color: '#6b7280', fontSize: 12, flexShrink: 0 }} />
              <a
                href={`tel:${place.phone}`}
                style={{ margin: 0, fontSize: 12, color: accentColor, fontFamily: 'Kanit,sans-serif',
                  textDecoration: 'none', fontWeight: 600 }}
              >
                {place.phone}
              </a>
            </div>
          )}

          {/* Description */}
          {place.description && (
            <>
              <div style={{ height: 1, background: '#f3f4f6', margin: '10px 0' }} />
              <p style={{ margin: 0, fontSize: 12, color: '#6b7280', fontFamily: 'Kanit,sans-serif', lineHeight: 1.6 }}>
                {place.description}
              </p>
            </>
          )}

          {/* Divider */}
          <div style={{ height: 1, background: '#f3f4f6', margin: '14px 0 12px' }} />

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
            {/* นำทาง */}
            <a
              href={directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                flex: 1, padding: '10px 0', borderRadius: 12,
                border: `1.5px solid ${accentColor}`,
                color: accentColor, background: '#fff',
                fontSize: 13, fontWeight: 700, fontFamily: 'Kanit,sans-serif',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                textDecoration: 'none', transition: 'background 0.15s',
              }}
            >
              <FontAwesomeIcon icon={faLocationArrow} style={{ fontSize: 12 }} />
              นำทาง
            </a>

            {/* โทรหาร้าน */}
            {place.phone ? (
              <a
                href={`tel:${place.phone}`}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 12,
                  border: '1.5px solid #e5e7eb',
                  color: '#374151', background: '#fff',
                  fontSize: 13, fontWeight: 700, fontFamily: 'Kanit,sans-serif',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  textDecoration: 'none',
                }}
              >
                <FontAwesomeIcon icon={faPhone} style={{ fontSize: 12 }} />
                โทรหาร้าน
              </a>
            ) : (
              <div style={{
                flex: 1, padding: '10px 0', borderRadius: 12,
                border: '1.5px solid #f3f4f6',
                color: '#d1d5db', background: '#fafafa',
                fontSize: 13, fontWeight: 700, fontFamily: 'Kanit,sans-serif',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}>
                <FontAwesomeIcon icon={faPhone} style={{ fontSize: 12 }} />
                โทรหาร้าน
              </div>
            )}
          </div>

          {/* เปิด Google Maps */}
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="detail-gmaps-btn"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              width: '100%', padding: '14px 0',
              background: `linear-gradient(135deg, ${accentColor} 0%, ${isGym ? '#1d4ed8' : '#2A735D'} 100%)`,
              color: '#fff', borderRadius: 16,
              fontSize: 15, fontWeight: 700, fontFamily: 'Kanit,sans-serif',
              textDecoration: 'none', boxSizing: 'border-box',
              boxShadow: `0 4px 16px ${accentColor}40`,
              transition: 'filter 0.2s, transform 0.15s',
            }}
          >
            <FontAwesomeIcon icon={faMapLocationDot} style={{ fontSize: 16 }} />
            เปิด Google Maps
          </a>
        </div>
      </div>
    </>
  );
}
