import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../store';
import { Link } from 'react-router-dom';
import { Activity, Droplet, Flame, Zap, Camera, Scale, Target, ChevronRight } from 'lucide-react';

export default function HomePage() {
  const { userProfile, history } = useStore();

  const todayStr = new Date().toDateString();
  const todayHistory = history.filter(item => new Date(item.date).toDateString() === todayStr);

  const totalCalories = todayHistory.reduce((sum, item) => sum + item.analysis.calories, 0);

  return (
    <div className="p-6 space-y-6">
      <header className="flex justify-between items-center mt-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-green-dark">
            สวัสดีคุณ, {userProfile.name || 'ผู้ใช้'}! 👋
          </h1>
          <p className="text-sm text-gray-500">พร้อมทานอาหารเพื่อสุขภาพแล้วหรือยังวันนี้?</p>
        </div>
        <div className="w-12 h-12 bg-white rounded-full shadow-sm flex items-center justify-center overflow-hidden border-2 border-brand-green">
          <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${userProfile.name || 'guest'}`} alt="avatar" />
        </div>
      </header>

      {/* Daily Summary Card */}
      <RevealSection delay={0}>
      <div className="bg-brand-green text-white p-6 rounded-3xl shadow-lg relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-32 h-32 bg-brand-green-light rounded-full opacity-50 blur-2xl"></div>
        <div className="relative z-10">
          <h2 className="text-sm font-medium opacity-90 mb-1">ปริมาณที่ได้รับในวันนี้</h2>
          <div className="flex items-end gap-2 mb-6">
            <span className="text-4xl font-bold">{totalCalories}</span>
            <span className="text-sm opacity-80 mb-1">/ 2000 kcal</span>
          </div>

          <div className="grid grid-cols-4 gap-2">
            <MacroBadge icon={<Droplet size={14} />} label="Protein" value="12g" />
            <MacroBadge icon={<Zap size={14} />} label="Carbs" value="45g" />
            <MacroBadge icon={<Flame size={14} />} label="Fat" value="20g" />
            <MacroBadge icon={<Activity size={14} />} label="Fiber" value="8g" />
          </div>
        </div>
      </div>

      </RevealSection>

      <RevealSection delay={100}>
      <div className="pt-4">
        <h3 className="text-lg font-bold text-gray-800 mb-4">ทางลัดด่วน</h3>
        <div className="grid grid-cols-2 gap-3">
          {/* Main action: Scan */}
          <Link to="/scan" className="col-span-2 relative overflow-hidden bg-gradient-to-br from-brand-green to-emerald-600 p-5 rounded-3xl text-white shadow-lg shadow-brand-green/30 group active:scale-[0.98] transition-all">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500" />
            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center ring-1 ring-white/30 group-hover:bg-white/30 transition-colors">
                  <Camera size={24} className="text-white" />
                </div>
                <div>
                  <h4 className="font-bold text-lg leading-tight">วิเคราะห์อาหาร</h4>
                  <p className="text-white/80 text-xs mt-1">สแกนจากกล้องหรือคลังภาพ</p>
                </div>
              </div>
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm group-hover:translate-x-1 transition-transform">
                <ChevronRight size={18} />
              </div>
            </div>
          </Link>

          {/* Sub actions */}
          <button className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 flex flex-col gap-3 group active:scale-[0.98] transition-all hover:border-blue-200">
            <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
              <Scale size={20} />
            </div>
            <div className="text-left">
              <h4 className="font-bold text-gray-800 text-sm">บันทึกน้ำหนัก</h4>
              <p className="text-gray-400 text-[10px] mt-0.5">ติดตามการเปลี่ยนแปลง</p>
            </div>
          </button>
          
          <button className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 flex flex-col gap-3 group active:scale-[0.98] transition-all hover:border-purple-200">
            <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center group-hover:bg-purple-600 group-hover:text-white transition-colors">
              <Target size={20} />
            </div>
            <div className="text-left">
              <h4 className="font-bold text-gray-800 text-sm">เป้าหมาย</h4>
              <p className="text-gray-400 text-[10px] mt-0.5">จัดการโควต้าต่อวัน</p>
            </div>
          </button>
        </div>
      </div>
      </RevealSection>
    </div>
  );
}

function MacroBadge({ icon, label, value }) {
  return (
    <div className="bg-white/20 rounded-xl p-2 flex flex-col items-center justify-center gap-1 backdrop-blur-sm">
      <div className="opacity-80">{icon}</div>
      <span className="text-[10px] opacity-90">{label}</span>
      <span className="text-xs font-bold">{value}</span>
    </div>
  );
}

// ─── Scroll-reveal wrapper ────────────────────────────────────────────────────
function RevealSection({ children, delay = 0 }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.08, rootMargin: '0px 0px -32px 0px' }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(22px)',
        transition: `opacity 0.55s ease ${delay}ms, transform 0.55s ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}
