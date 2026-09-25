import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { Activity } from 'lucide-react';
import { format } from 'date-fns';

export default function HistoryPage() {
  const navigate = useNavigate();
  const { history, userProfile } = useStore();

  const todayStr = new Date().toDateString();
  const todayHistory = history.filter(item => new Date(item.date).toDateString() === todayStr);

  const totalSodium = todayHistory.reduce((sum, item) => sum + item.analysis.micronutrients.sodium, 0);
  const totalCalories = todayHistory.reduce((sum, item) => sum + item.analysis.calories, 0);

  // Example cumulative risk for hypertension
  const isHypertension = userProfile.chronicDiseases.some(d => d.toLowerCase().includes('hypertension') || d.toLowerCase().includes('pressure') || d.includes('โรคความดันโลหิตสูง'));
  const sodiumPercent = Math.min((totalSodium / 2000) * 100, 100);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-brand-green-dark mt-4">ประวัติการทาน</h1>

      {/* Cumulative Risk Tracker */}
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
        <h2 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
          <Activity size={16} className="text-brand-green" /> สรุปผลการทานวันนี้
        </h2>

        {isHypertension && (
          <div className="mb-4 bg-orange-50 p-3 rounded-xl border border-orange-100">
            <div className="flex justify-between text-xs font-bold text-orange-900 mb-1">
              <span>โซเดียม (ข้อควรระวังสำหรับผู้มีความดันโลหิตสูง)</span>
              <span>{Math.round(sodiumPercent)}%</span>
            </div>
            <div className="w-full h-1.5 bg-orange-200 rounded-full overflow-hidden mb-2">
              <div
                className={`h-full rounded-full ${sodiumPercent > 80 ? 'bg-red-500' : 'bg-orange-500'}`}
                style={{ width: `${sodiumPercent}%` }}
              ></div>
            </div>
            {sodiumPercent > 80 && (
              <p className="text-[10px] text-red-700 leading-tight">
                คุณได้รับโซเดียมเกินกว่า &gt;80% ของปริมาณที่แนะนำต่อวันแล้ว สำหรับผู้ป่วยโรคความดันโลหิตสูง ควรหลีกเลี่ยงอาหารรสเค็มในมื้อที่เหลือของวันนี้
              </p>
            )}
          </div>
        )}

        <div className="flex justify-between text-xs font-bold text-gray-700 mb-1">
          <span>พลังงาน</span>
          <span>{totalCalories} / 2000 kcal</span>
        </div>
        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-brand-green"
            style={{ width: `${Math.min((totalCalories / 2000) * 100, 100)}%` }}
          ></div>
        </div>
      </div>

      {/* History List */}
      <div>
        <h3 className="font-bold text-gray-800 mb-4">วิเคราะห์ล่าสุด</h3>
        {history.length === 0 ? (
          <div className="text-center text-gray-400 py-10 text-sm">
            ยังไม่มีประวัติการทาน
          </div>
        ) : (
          <div className="space-y-3">
            {history.map(item => (
              <div
                key={item.id}
                onClick={() => navigate('/analysis', { state: { analysisData: item.analysis, imagePreviewUrl: item.imageUrl, fromHistory: true, historyId: item.id } })}
                className="bg-white p-3 rounded-2xl flex gap-3 shadow-sm border border-gray-50 items-center cursor-pointer hover:bg-gray-50 transition-colors"
              >
                <div className="w-16 h-16 rounded-xl bg-gray-200 overflow-hidden shrink-0">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.analysis.dishName} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-brand-cream"></div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-sm text-gray-800 truncate">{item.analysis.dishName}</h4>
                  <p className="text-xs text-gray-500 mb-1">{format(new Date(item.date), 'MMM d, h:mm a')}</p>
                  <div className="flex gap-2">
                    <span className="text-[10px] font-bold bg-brand-cream text-brand-green-dark px-2 py-0.5 rounded">
                      {item.analysis.calories} kcal
                    </span>
                    <span className="text-[10px] font-bold bg-green-50 text-green-700 px-2 py-0.5 rounded">
                      Score: {item.analysis.healthScore}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
