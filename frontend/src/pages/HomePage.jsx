import React from 'react';
import { useStore } from '../store';
import { Link } from 'react-router-dom';
import { Activity, Droplet, Flame, Zap } from 'lucide-react';

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

      <div className="pt-4">
        <h3 className="font-bold text-gray-800 mb-4">การดำเนินการด่วน</h3>
        <Link to="/scan" className="w-full bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="w-12 h-12 bg-brand-cream rounded-xl flex items-center justify-center text-brand-green">
            <Activity size={24} />
          </div>
          <div className="flex-1">
            <h4 className="font-bold text-gray-800">วิเคราะห์อาหาร</h4>
            <p className="text-xs text-gray-500">ถ่ายรูปเพื่อรับข้อมูล</p>
          </div>
          <div className="text-brand-green font-bold text-xl">+</div>
        </Link>
      </div>
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
