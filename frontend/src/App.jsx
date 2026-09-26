import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faHouse,
  faCamera,
  faCalendarDays,
  faChartBar,
  faLocationDot,
  faEllipsis,
} from '@fortawesome/free-solid-svg-icons';
import HomePage from './pages/HomePage';
import ProfilePage from './pages/ProfilePage';
import ScanPage from './pages/ScanPage';
import AnalysisPage from './pages/AnalysisPage';
import HistoryPage from './pages/HistoryPage';
import MapPage from './pages/MapPage';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const NAV_ITEMS = [
  { to: '/', icon: faHouse, label: 'หน้าแรก' },
  { to: '/scan', icon: faCamera, label: 'สแกน' },
  { to: '/history', icon: faCalendarDays, label: 'แผนอาหาร' },
  { to: '/analysis', icon: faChartBar, label: 'วิเคราะห์ความเสี่ยง' },
  { to: '/map', icon: faLocationDot, label: 'แผนที่ร้านสุขภาพ' },
  { to: '/profile', icon: faEllipsis, label: 'เพิ่มเติม' },
];

function MobileFrame({ children }) {
  const location = useLocation();

  return (
    <div className="relative w-[390px] h-[844px] bg-brand-cream overflow-hidden shadow-2xl rounded-[40px] border-[8px] border-black flex flex-col">
      {/* Status Bar Mockup */}
      <div className="h-12 w-full flex justify-between items-center px-6 text-sm font-medium z-50 text-black">
        <span>9:41</span>
        <div className="flex gap-2 items-center">
          <div className="w-4 h-4 rounded-full bg-black"></div>
          <div className="w-4 h-4 rounded-full bg-black"></div>
          <div className="w-6 h-3 rounded-sm bg-black"></div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto relative scroll-smooth" style={{ paddingBottom: '72px' }}>
        {children}
      </div>

      {/* Bottom Navigation — flat tab bar matching the image */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '72px',
          background: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(12px)',
          borderTop: '1px solid #e5e7eb',
          display: 'flex',
          alignItems: 'stretch',
          borderBottomLeftRadius: '32px',
          borderBottomRightRadius: '32px',
          paddingBottom: '8px',
        }}
      >
        {NAV_ITEMS.map((item) => (
          <NavTab key={item.to} item={item} currentPath={location.pathname} />
        ))}
      </div>
    </div>
  );
}

function NavTab({ item, currentPath }) {
  const isActive =
    item.to === '/'
      ? currentPath === '/'
      : currentPath.startsWith(item.to);

  return (
    <Link
      to={item.to}
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '3px',
        color: isActive ? '#16a34a' : '#9ca3af',
        textDecoration: 'none',
        position: 'relative',
        transition: 'color 0.2s',
        fontSize: '9px',
        fontWeight: 600,
        paddingTop: '6px',
      }}
    >
      {/* Active indicator line at top */}
      {isActive && (
        <span
          style={{
            position: 'absolute',
            top: 0,
            left: '20%',
            right: '20%',
            height: '2.5px',
            background: '#16a34a',
            borderRadius: '0 0 4px 4px',
          }}
        />
      )}

      <FontAwesomeIcon
        icon={item.icon}
        style={{
          fontSize: isActive ? '18px' : '16px',
          transition: 'font-size 0.2s',
        }}
      />
      <span
        style={{
          fontSize: '8.5px',
          fontWeight: 600,
          lineHeight: 1.2,
          textAlign: 'center',
          maxWidth: '52px',
        }}
      >
        {item.label}
      </span>
    </Link>
  );
}

function App() {
  return (
    <Router>
      <MobileFrame>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/scan" element={<ScanPage />} />
          <Route path="/analysis" element={<AnalysisPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/map" element={<MapPage />} />
        </Routes>
      </MobileFrame>
    </Router>
  );
}

export default App;
