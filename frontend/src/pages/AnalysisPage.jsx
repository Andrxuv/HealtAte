import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  AlertTriangle,
  Info,
  Check,
  ShieldAlert,
  RefreshCw,
  Loader2,
  X,
  Sparkles,
  Plus,
  Trash2,
  Utensils,
  ShieldCheck,
  HeartPulse,
  CheckCircle2,
  ChevronRight,
  Lightbulb,
} from 'lucide-react';
import { useStore } from '../store';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// ─── Re-process confirmation modal ────────────────────────────────────────────
function ReprocessModal({ dishName, onConfirm, onDecline, loading }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm px-4 pb-8">
      <div
        className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden"
        style={{ animation: 'slideUp 0.28s cubic-bezier(0.34,1.56,0.64,1)' }}
      >
        <div className="bg-gradient-to-br from-brand-green to-emerald-400 px-6 pt-7 pb-5 flex flex-col items-center gap-2">
          <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center">
            <Sparkles size={28} className="text-white" />
          </div>
          <h2 className="text-white font-bold text-lg text-center leading-tight mt-1">
            วิเคราะห์ใหม่ด้วย AI?
          </h2>
          <p className="text-white/80 text-xs text-center">ชื่อเมนูถูกเปลี่ยนเป็น</p>
          <span className="bg-white/20 text-white text-sm font-bold px-4 py-1 rounded-full">
            {dishName}
          </span>
        </div>

        <div className="px-6 pt-5 pb-6 space-y-4">
          <p className="text-sm text-gray-600 text-center leading-relaxed">
            ต้องการให้ AI วิเคราะห์ข้อมูลโภชนาการใหม่ตามชื่อเมนูที่แก้ไขหรือไม่?
          </p>

          <button
            onClick={onConfirm}
            disabled={loading}
            className="w-full bg-brand-green text-white font-bold rounded-2xl py-3.5 flex items-center justify-center gap-2 transition-opacity disabled:opacity-60"
          >
            {loading ? (
              <><Loader2 size={18} className="animate-spin" /> กำลังวิเคราะห์…</>
            ) : (
              <><Sparkles size={18} /> วิเคราะห์ใหม่</>
            )}
          </button>

          <button
            onClick={onDecline}
            disabled={loading}
            className="w-full bg-gray-100 text-gray-700 font-semibold rounded-2xl py-3.5 flex items-center justify-center gap-2 transition-opacity disabled:opacity-60"
          >
            <X size={16} /> ใช้ข้อมูลเดิม
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(60px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>
    </div>
  );
}

const DEFAULT_SAMPLE_DATA = {
  dishName: 'ข้าวกะเพราไก่ไข่ดาว',
  healthScore: 72,
  calories: 620,
  ingredients: [
    { name: 'ข้าวสวย', weightGrams: 180, minGrams: 150, maxGrams: 200 },
    { name: 'เนื้ออกไก่', weightGrams: 120, minGrams: 100, maxGrams: 140 },
    { name: 'ไข่ดาว', weightGrams: 50, minGrams: 45, maxGrams: 55 },
    { name: 'ใบกะเพราและพริกกระเทียม', weightGrams: 30, minGrams: 20, maxGrams: 40 },
    { name: 'น้ำมันและเครื่องปรุงรส', weightGrams: 20, minGrams: 15, maxGrams: 25 },
  ],
  macros: {
    protein: 32,
    carbs: 68,
    fat: 24,
    fiber: 3,
  },
  micronutrients: {
    sodium: 1350,
    sugar: 4,
    satFat: 6,
    vitaminC: 12,
    iron: 3,
    calcium: 45,
  },
  risks: [
    {
      riskName: 'โซเดียมค่อนข้างสูง',
      severity: 'medium',
      description: 'เมนูนี้มีปริมาณโซเดียมประมาณ 1,350 มก. คิดเป็นกว่า 58% ของปริมาณที่แนะนำต่อวัน ควรหลีกเลี่ยงการเติมพริกน้ำปลาเพิ่ม'
    },
    {
      riskName: 'ไขมันจากน้ำมันทอด',
      severity: 'low',
      description: 'ไข่ดาวและการผัดใช้น้ำมัน ควรเลือกรับประทานผักเพิ่มขึ้นในมื้อถัดไป'
    }
  ]
};

export default function AnalysisPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { history, addHistory, updateHistory, userProfile } = useStore();

  const { analysisData: initialData, imagePreviewUrl: initialImage, fromHistory, historyId } = location.state || {};

  const effectiveData = initialData || (history && history.length > 0 ? history[0].analysis : DEFAULT_SAMPLE_DATA);
  const imagePreviewUrl = initialImage || (history && history.length > 0 ? history[0].imageUrl : 'https://images.unsplash.com/photo-1563245372-f21724e3856d?auto=format&fit=crop&w=800&q=80');

  const [data, setData] = useState(effectiveData);
  const [dishName, setDishName] = useState(effectiveData?.dishName || '');
  const [isEditing, setIsEditing] = useState(false);
  const [ingredients, setIngredients] = useState(effectiveData?.ingredients || []);
  const [activeTab, setActiveTab] = useState('nutrition'); // 'nutrition' | 'risks'

  // Re-process modal state
  const [showReprocessModal, setShowReprocessModal] = useState(false);
  const [pendingEditedData, setPendingEditedData] = useState(null);
  const [reprocessing, setReprocessing] = useState(false);
  const [reprocessError, setReprocessError] = useState(null);

  // Re-analysis loading screen state
  const [reanalysisLoading, setReanalysisLoading] = useState(false);
  const [reanalysisProgress, setReanalysisProgress] = useState(0);

  // Animate progress bar during re-analysis
  useEffect(() => {
    let interval;
    if (reanalysisLoading) {
      setReanalysisProgress(0);
      interval = setInterval(() => {
        setReanalysisProgress(p => (p >= 90 ? p : p + Math.random() * 8));
      }, 800);
    }
    return () => clearInterval(interval);
  }, [reanalysisLoading]);

  if (!data) return null;

  const handleWeightChange = (index, newWeight) => {
    const updated = [...ingredients];
    const oldWeight = updated[index].weightGrams;

    updated[index].weightGrams = Number(newWeight);
    setIngredients(updated);
  };

  const handleNameChange = (index, newName) => {
    const updated = [...ingredients];
    updated[index].name = newName;
    setIngredients(updated);
  };

  const handleAddIngredient = () => {
    setIngredients([...ingredients, { name: '', weightGrams: 0, minGrams: 0, maxGrams: 0 }]);
  };

  const handleRemoveIngredient = (index) => {
    const updated = ingredients.filter((_, i) => i !== index);
    setIngredients(updated);
  };

  const saveAndRecalculate = () => {
    const baseData = initialData || effectiveData;
    const oldTotalWeight = baseData.ingredients.reduce((acc, curr) => acc + curr.weightGrams, 0);
    const newTotalWeight = ingredients.reduce((acc, curr) => acc + curr.weightGrams, 0);
    const ratio = newTotalWeight / (oldTotalWeight || 1);

    const updatedData = {
      ...data,
      dishName,
      ingredients,
      calories: Math.round(baseData.calories * ratio),
      macros: {
        protein: Math.round(baseData.macros.protein * ratio),
        carbs: Math.round(baseData.macros.carbs * ratio),
        fat: Math.round(baseData.macros.fat * ratio),
        fiber: Math.round(baseData.macros.fiber * ratio),
      },
      micronutrients: {
        sodium: Math.round(baseData.micronutrients.sodium * ratio),
        sugar: Math.round(baseData.micronutrients.sugar * ratio),
        satFat: Math.round(baseData.micronutrients.satFat * ratio),
        vitaminC: Math.round(baseData.micronutrients.vitaminC * ratio),
        iron: Math.round(baseData.micronutrients.iron * ratio),
        calcium: Math.round(baseData.micronutrients.calcium * ratio),
      },
    };

    setIsEditing(false);

    // Show re-process modal only if the dish name changed
    if (dishName.trim() !== (baseData?.dishName || '').trim()) {
      setPendingEditedData(updatedData);
      setReprocessError(null);
      setShowReprocessModal(true);
    } else {
      setData(updatedData);
    }
  };

  // ── Re-process: call backend with dish name only ──────────────────────────
  const handleReprocess = async () => {
    // Close modal and show loading screen immediately
    setShowReprocessModal(false);
    setReanalysisLoading(true);
    setReanalysisProgress(0);
    setReprocessError(null);
    try {
      const response = await fetch('http://localhost:3001/api/analyze-by-name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dishName: dishName.trim(), userProfile }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `Server error ${response.status}`);
      }
      const newData = await response.json();
      // Snap progress to 100% and wait briefly before revealing results
      setReanalysisProgress(100);
      setTimeout(() => {
        setData({ ...newData, dishName: dishName.trim() });
        setPendingEditedData(null);
        setReanalysisLoading(false);
      }, 800);
    } catch (err) {
      setReprocessError(err.message);
      setReanalysisLoading(false);
    }
  };

  // ── Decline: keep locally recalculated data ──────────────────────────────
  const handleDeclineReprocess = () => {
    if (pendingEditedData) {
      setData(pendingEditedData);
      setPendingEditedData(null);
    }
    setShowReprocessModal(false);
  };

  const handleSaveToHistory = () => {
    if (fromHistory && historyId) {
      updateHistory(historyId, data);
    } else {
      addHistory({
        id: Date.now().toString(),
        date: new Date().toISOString(),
        analysis: data,
        imageUrl: imagePreviewUrl // In a real app, upload this to cloud storage
      });
    }
    navigate('/history');
  };

  const totalWeight = data.ingredients.reduce((acc, curr) => acc + curr.weightGrams, 0);

  // Filter out AI placeholder "no risk" entries (e.g. "ไม่มีความเสี่ยงสำคัญ")
  // Gemini fills the required risks array with these when food is actually healthy.
  const realRisks = (data.risks || []).filter(
    r => !r.riskName?.startsWith('ไม่มี')
  );
  const riskCount = realRisks.length;

  // Derive overall risk level from the highest severity among all risks
  const riskLevel = (() => {
    if (riskCount === 0) return 'none';
    if (realRisks.some(r => r.severity === 'high')) return 'high';
    if (realRisks.some(r => r.severity === 'medium')) return 'medium';
    return 'low';
  })();

  const riskIndicator = {
    none: { dot: 'bg-emerald-400', text: 'text-emerald-600', label: 'สุขภาพดี' },
    low: { dot: 'bg-yellow-400', text: 'text-yellow-600', label: 'ความเสี่ยงต่ำ' },
    medium: { dot: 'bg-orange-400', text: 'text-orange-600', label: 'ความเสี่ยงปานกลาง' },
    high: { dot: 'bg-red-500', text: 'text-red-600', label: 'ความเสี่ยงสูง' },
  }[riskLevel];

  // ── Full-screen re-analysis loading screen ────────────────────────────────
  if (reanalysisLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 bg-brand-cream space-y-8 mt-10">
        <img src="/ai.gif" alt="loading" style={{ width: '100px', height: '100px' }} className="mx-auto" />

        <div className="w-full max-w-sm space-y-4">
          <h2 className="text-xl font-bold text-gray-900 text-center">กำลังวิเคราะห์สารอาหาร</h2>
          <p className="text-sm text-gray-500 text-center px-4">
            AI กำลังวิเคราะห์รูปภาพอาหารของคุณ กรุณารอสักครู่
          </p>

          <div className="pt-2">
            <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
              <div
                className="bg-brand-green h-full rounded-full transition-all duration-700 ease-out"
                style={{ width: `${Math.min(100, Math.max(0, Math.round(reanalysisProgress)))}%` }}
              />
            </div>
            <p className="text-center text-gray-400 text-sm mt-3">{Math.round(reanalysisProgress)}%</p>
          </div>

          <div className="space-y-4 pt-6 pl-4">
            <div className="flex items-center gap-3">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors duration-300 ${reanalysisProgress > 10 ? 'bg-brand-green text-white' : 'bg-gray-200 text-transparent'}`}>
                <Check size={14} strokeWidth={3} />
              </div>
              <span className={`text-sm ${reanalysisProgress > 10 ? 'text-gray-600' : 'text-gray-400'}`}>กำลังวิเคราะห์ภาพถ่าย</span>
            </div>
            <div className="flex items-center gap-3">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors duration-300 ${reanalysisProgress > 30 ? 'bg-brand-green text-white' : 'bg-gray-200 text-transparent'}`}>
                <Check size={14} strokeWidth={3} />
              </div>
              <span className={`text-sm ${reanalysisProgress > 30 ? 'text-gray-600' : 'text-gray-400'}`}>กำลังระบุชนิดอาหาร</span>
            </div>
            <div className="flex items-center gap-3">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors duration-300 ${reanalysisProgress > 55 ? 'bg-brand-green text-white' : 'bg-gray-200 text-transparent'}`}>
                <Check size={14} strokeWidth={3} />
              </div>
              <span className={`text-sm ${reanalysisProgress > 55 ? 'text-gray-600' : 'text-gray-400'}`}>กำลังคำนวณสารอาหาร</span>
            </div>
            <div className="flex items-center gap-3">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors duration-300 ${reanalysisProgress > 80 ? 'bg-brand-green text-white' : 'bg-gray-200 text-transparent'}`}>
                <Check size={14} strokeWidth={3} />
              </div>
              <span className={`text-sm ${reanalysisProgress > 80 ? 'text-gray-600' : 'text-gray-400'}`}>กำลังประเมินความเสี่ยงด้านสุขภาพ</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {showReprocessModal && (
        <ReprocessModal
          dishName={dishName}
          onConfirm={handleReprocess}
          onDecline={handleDeclineReprocess}
          loading={reprocessing}
        />
      )}

      <div className="bg-brand-cream min-h-full pb-10">
        <div className="relative h-64">
          {imagePreviewUrl ? (
            <img src={imagePreviewUrl} alt="Food" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gray-300" />
          )}
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-black/50 via-transparent to-brand-cream" />

          <button onClick={() => navigate(-1)} className="absolute top-6 left-6 w-10 h-10 bg-white/30 backdrop-blur-md rounded-full flex items-center justify-center text-white">
            <ArrowLeft size={20} />
          </button>
        </div>

        <div className="px-6 -mt-12 relative z-10 space-y-6">

          {/* Reprocess error banner */}
          {reprocessError && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex gap-3 text-red-800">
              <AlertTriangle size={18} className="shrink-0 mt-0.5" />
              <p className="text-xs leading-relaxed">
                <span className="font-bold">ไม่สามารถวิเคราะห์ใหม่ได้:</span> {reprocessError}
              </p>
            </div>
          )}

          {/* Header Card */}
          <div className="bg-white rounded-3xl p-6 shadow-xl border border-gray-100">
            <div className="mb-2">
              {isEditing ? (
                <input
                  type="text"
                  value={dishName}
                  onChange={(e) => setDishName(e.target.value)}
                  className="text-2xl font-bold text-gray-800 leading-tight bg-gray-50 border border-gray-200 rounded px-2 py-1 w-full focus:outline-none focus:border-brand-green"
                />
              ) : (
                <h1 className="text-2xl font-bold text-gray-800 leading-tight">{data.dishName}</h1>
              )}
            </div>
            <p className="text-sm text-gray-500 mb-4 flex items-center gap-2">
              ~ {totalWeight}g
              <button
                type="button"
                onClick={() => setActiveTab('risks')}
                className="inline-flex items-center gap-1.5 hover:opacity-80 transition-opacity cursor-pointer group"
                title="คลิกเพื่อดูรายละเอียดความเสี่ยง"
              >
                <span
                  className={cn('inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-sm transition-transform group-hover:scale-125', riskIndicator.dot)}
                  style={{ boxShadow: riskLevel !== 'none' ? `0 0 6px 1px var(--tw-shadow-color)` : undefined }}
                />
                <span className={cn('font-semibold underline decoration-dotted underline-offset-2', riskIndicator.text)}>
                  {riskCount === 0 ? riskIndicator.label : `${riskCount} ความเสี่ยง — ${riskIndicator.label}`}
                </span>
                <ChevronRight size={13} className={riskIndicator.text} />
              </button>
            </p>

            <div className="border-t border-gray-100 pt-4">
              <span className="block text-xs text-gray-400 font-semibold mb-1">แคลอรี่</span>
              <div className="flex items-end gap-1.5">
                <span className="text-4xl font-black text-brand-green">{data.calories}</span>
                <span className="text-sm text-gray-500 font-bold pb-1">kcal</span>
              </div>
            </div>
          </div>

          {/* Segmented Tabs Navigation */}
          <div className="bg-white/95 backdrop-blur-md p-1.5 rounded-2xl flex gap-1.5 shadow-md shadow-gray-200/50 border border-gray-200/70 sticky top-2 z-20">
            <button
              type="button"
              onClick={() => setActiveTab('nutrition')}
              className={cn(
                "flex-1 py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer",
                activeTab === 'nutrition'
                  ? "bg-brand-green text-white shadow-md shadow-brand-green/25 scale-[1.01]"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-100/70"
              )}
            >
              <Utensils size={15} />
              <span>ข้อมูลโภชนาการ</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('risks')}
              className={cn(
                "flex-1 py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all duration-200 relative cursor-pointer",
                activeTab === 'risks'
                  ? "bg-brand-green text-white shadow-md shadow-brand-green/25 scale-[1.01]"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-100/70"
              )}
            >
              <ShieldAlert size={15} />
              <span>ความเสี่ยงสุขภาพ</span>
              {riskCount > 0 ? (
                <span
                  className={cn(
                    "text-[10px] font-black px-1.5 py-0.5 rounded-full shrink-0 transition-colors",
                    activeTab === 'risks' ? "bg-white text-red-600" : "bg-red-500 text-white"
                  )}
                >
                  {riskCount}
                </span>
              ) : (
                <span
                  className={cn(
                    "w-2 h-2 rounded-full shrink-0 transition-colors",
                    activeTab === 'risks' ? "bg-white" : "bg-emerald-500"
                  )}
                />
              )}
            </button>
          </div>

          {/* ─── TAB 1: NUTRITION & INGREDIENTS ─── */}
          {activeTab === 'nutrition' && (
            <div className="space-y-6 animate-fadeIn">
              {/* Disclaimer */}
              <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 flex gap-3 text-orange-800 shadow-sm">
                <Info size={18} className="shrink-0 mt-0.5 text-orange-500" />
                <p className="text-xs leading-relaxed">
                  <span className="font-bold">การประมาณค่า:</span> ปริมาณสารอาหารแสดงเป็นค่าโดยประมาณ (+/-20-40%) จากการประมวลผลด้วยภาพ
                </p>
              </div>

              {/* Ingredients & Editing */}
              <RevealSection delay={0}>
                <div className="bg-emerald-800 rounded-4xl p-6 shadow-lg shadow-brand-emerald/30 relative overflow-hidden transition-shadow duration-300">
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h2 className="text-xl font-black text-white tracking-tight">
                        ส่วนผสมหลัก
                      </h2>
                      <p className="text-xs text-emerald-200/80 mt-0.5">
                        {ingredients.length} วัตถุดิบที่ตรวจพบ
                      </p>
                    </div>
                    <button
                      onClick={() => isEditing ? saveAndRecalculate() : setIsEditing(true)}
                      className={cn(
                        "px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors",
                        isEditing
                          ? "bg-white text-brand-green shadow-sm hover:bg-gray-50"
                          : "bg-white text-emerald-800 hover:bg-white/80"
                      )}
                    >
                      {isEditing ? <><Check size={16} /> บันทึก</> : <><RefreshCw size={16} /> แก้ไข</>}
                    </button>
                  </div>

                  <div className="space-y-3">
                    {ingredients.map((ing, idx) => (
                      <div
                        key={idx}
                        className="flex justify-between items-center p-4 rounded-2xl bg-[#e8fce1] border border-[#bbf7d0] transition-colors duration-300 group gap-3"
                      >
                        {isEditing ? (
                          <input
                            type="text"
                            value={ing.name}
                            onChange={(e) => handleNameChange(idx, e.target.value)}
                            className="text-base font-bold text-gray-900 bg-white border border-gray-200 rounded-xl px-3 py-2 flex-1 min-w-0 focus:outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20 shadow-sm transition-all"
                          />
                        ) : (
                          <span className="text-base font-bold text-gray-800 flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-brand-green" />
                            {ing.name}
                          </span>
                        )}

                        {isEditing ? (
                          <div className="flex items-center gap-2 shrink-0">
                            <div className="flex items-center gap-2 bg-white p-1.5 rounded-xl border border-gray-200 focus-within:border-brand-green focus-within:ring-2 focus-within:ring-brand-green/20 shadow-sm transition-all">
                              <input
                                type="number"
                                value={ing.weightGrams}
                                onChange={(e) => handleWeightChange(idx, e.target.value)}
                                className="w-16 bg-transparent border-none rounded px-2 py-1 text-base font-black text-right focus:outline-none text-brand-green"
                              />
                              <span className="text-xs font-bold text-gray-400 pr-2">ก.</span>
                            </div>
                            <button
                              onClick={() => handleRemoveIngredient(idx)}
                              className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors shrink-0 border border-transparent hover:border-red-200 bg-white shadow-sm"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        ) : (
                          <div className="text-right">
                            <span className="text-lg font-black text-gray-900">{ing.weightGrams}<span className="text-sm font-bold text-gray-600 ml-0.5">ก.</span></span>
                            <div className="text-[10px] text-gray-500 font-medium">({ing.minGrams}-{ing.maxGrams}ก.)</div>
                          </div>
                        )}
                      </div>
                    ))}

                    {isEditing && (
                      <button
                        onClick={handleAddIngredient}
                        className="w-full py-3 rounded-2xl border-2 border-dashed border-white/50 text-white font-bold hover:bg-white/10 hover:border-white transition-all flex items-center justify-center gap-2 mt-4"
                      >
                        <Plus size={18} /> เพิ่มส่วนผสม
                      </button>
                    )}
                  </div>
                </div>
              </RevealSection>

              {/* Macros */}
              <RevealSection delay={60}>
                <div className="bg-white rounded-4xl p-6 shadow-xl shadow-gray-200/50 border border-gray-100 relative overflow-hidden transition-shadow duration-300">
                  <div className="flex justify-between items-start mb-5">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-xl font-black text-gray-900 tracking-tight">
                          สารอาหารหลัก
                        </h2>
                        <span className="text-[11px] font-bold text-brand-green bg-brand-green/10 px-2.5 py-0.5 rounded-full">
                          4 ชนิด
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        ปริมาณที่ได้รับต่อมื้อ เทียบกับเกณฑ์มาตรฐานต่อวัน (RDI)
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <MacroRingCard
                      label="โปรตีน"
                      enLabel="Protein"
                      value={data.macros.protein}
                      unit="g"
                      max={50}
                      color="#3b82f6"
                      bg="#f8faff"
                      border="#dbeafe"
                      track="#bfdbfe"
                      role="เสริมสร้างกล้ามเนื้อ"
                    />
                    <MacroRingCard
                      label="คาร์โบไฮเดรต"
                      enLabel="Carbs"
                      value={data.macros.carbs}
                      unit="g"
                      max={300}
                      color="#f59e0b"
                      bg="#fffdf7"
                      border="#fef3c7"
                      track="#fde68a"
                      role="แหล่งพลังงานหลัก"
                    />
                    <MacroRingCard
                      label="ไขมัน"
                      enLabel="Fat"
                      value={data.macros.fat}
                      unit="g"
                      max={65}
                      color="#ef4444"
                      bg="#fff8f8"
                      border="#fee2e2"
                      track="#fecaca"
                      role="พลังงาน & ความอบอุ่น"
                    />
                    <MacroRingCard
                      label="ใยอาหาร"
                      enLabel="Fiber"
                      value={data.macros.fiber}
                      unit="g"
                      max={28}
                      color="#22c55e"
                      bg="#f7fdf9"
                      border="#dcfce7"
                      track="#bbf7d0"
                      role="ช่วยระบบขับถ่าย"
                    />
                  </div>

                  {/* Clarification footer note inside card */}
                  <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-400">
                    <span>* คิดจากเกณฑ์แนะนำสำหรับผู้ใหญ่ 2,000 kcal / วัน</span>
                    <span className="font-semibold text-brand-green">1 มื้ออาหาร</span>
                  </div>
                </div>
              </RevealSection>

              {/* Micronutrients */}
              <RevealSection delay={100}>
                <div className="bg-white rounded-3xl p-6 shadow-xl shadow-gray-200/50 border border-gray-100 relative overflow-hidden transition-shadow duration-300">
                  <div className="flex justify-between items-center mb-1">
                    <h2 className="text-lg font-bold text-gray-800">ข้อมูลโภชนาการย่อย</h2>
                    <span className="text-xs font-semibold text-brand-green bg-brand-green/10 px-2.5 py-1 rounded-full">
                      ต่อวัน (RDI)
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mb-6">
                    เทียบกับปริมาณสารอาหารที่แนะนำให้บริโภคต่อวัน
                  </p>
                  <div className="space-y-4">
                    <ProgressBar label="โซเดียม" value={data.micronutrients.sodium || 0} unit="mg" max={2300} isLimitCategory={true} />
                    <ProgressBar label="น้ำตาล" value={data.micronutrients.sugar || 0} unit="g" max={50} isLimitCategory={false} />
                    <ProgressBar label="ไขมันอิ่มตัว" value={data.micronutrients.satFat || 0} unit="g" max={20} isLimitCategory={true} />
                    <ProgressBar label="วิตามินซี" value={data.micronutrients.vitaminC || 0} unit="mg" max={90} isLimitCategory={false} />
                    <ProgressBar label="ธาตุเหล็ก" value={data.micronutrients.iron || 0} unit="mg" max={18} isLimitCategory={false} />
                    <ProgressBar label="แคลเซียม" value={data.micronutrients.calcium || 0} unit="mg" max={1300} isLimitCategory={false} />
                  </div>
                </div>
              </RevealSection>
            </div>
          )}

          {/* ─── TAB 2: HEALTH RISKS & WARNINGS ─── */}
          {activeTab === 'risks' && (
            <div className="space-y-6 animate-fadeIn">
              {/* Risk Level Summary Card */}
              <div
                className={cn(
                  "rounded-3xl p-6 border shadow-lg transition-all",
                  riskLevel === 'high'
                    ? "bg-gradient-to-br from-red-50 to-rose-100 border-red-200 text-red-950"
                    : riskLevel === 'medium'
                    ? "bg-gradient-to-br from-orange-50 to-amber-100 border-orange-200 text-orange-950"
                    : riskLevel === 'low'
                    ? "bg-gradient-to-br from-yellow-50 to-amber-50 border-yellow-200 text-yellow-950"
                    : "bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200 text-emerald-950"
                )}
              >
                <div className="flex items-center gap-4">
                  <div
                    className={cn(
                      "w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-sm",
                      riskLevel === 'high'
                        ? "bg-red-500 text-white"
                        : riskLevel === 'medium'
                        ? "bg-orange-500 text-white"
                        : riskLevel === 'low'
                        ? "bg-yellow-500 text-white"
                        : "bg-emerald-500 text-white"
                    )}
                  >
                    {riskLevel === 'none' ? (
                      <ShieldCheck size={28} />
                    ) : (
                      <ShieldAlert size={28} />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider opacity-70">
                        การประเมินความเสี่ยง
                      </span>
                    </div>
                    <h3 className="text-xl font-black mt-0.5">
                      {riskIndicator.label}
                    </h3>
                    <p className="text-xs opacity-80 mt-1 leading-relaxed">
                      {riskLevel === 'high'
                        ? 'มีสารอาหารบางชนิดเกินเกณฑ์มาตรฐานอย่างมีนัยสำคัญ ควรระวังปริมาณการรับประทาน'
                        : riskLevel === 'medium'
                        ? 'มีสารอาหารบางชนิดใกล้เคียงหรือเกินเกณฑ์เล็กน้อย ควรปรับสมดุลในมื้อถัดไป'
                        : riskLevel === 'low'
                        ? 'ความเสี่ยงอยู่ในเกณฑ์ต่ำ สามารถรับประทานได้ตามปกติ'
                        : 'เมนูนี้มีความสมดุลและปลอดภัยสูง ไม่พบความเสี่ยงต่อสุขภาพที่น่ากังวล'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Personalized Risks List */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <AlertTriangle size={18} className="text-brand-green" /> รายการความเสี่ยงที่ระบุ ({riskCount})
                  </h2>
                </div>

                {realRisks.length > 0 ? (
                  <div className="space-y-3">
                    {realRisks.map((risk, idx) => {
                      const isHigh = risk.severity === 'high';
                      const isMed = risk.severity === 'medium';
                      return (
                        <div
                          key={idx}
                          className={cn(
                            'p-5 rounded-2xl border transition-all duration-200 bg-white shadow-sm flex flex-col gap-3',
                            isHigh
                              ? 'border-red-200 hover:border-red-300'
                              : isMed
                              ? 'border-orange-200 hover:border-orange-300'
                              : 'border-yellow-200 hover:border-yellow-300'
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2.5">
                              <div
                                className={cn(
                                  "w-8 h-8 rounded-xl flex items-center justify-center shrink-0",
                                  isHigh
                                    ? "bg-red-100 text-red-600"
                                    : isMed
                                    ? "bg-orange-100 text-orange-600"
                                    : "bg-yellow-100 text-yellow-600"
                                )}
                              >
                                <AlertTriangle size={18} />
                              </div>
                              <h3 className="font-bold text-gray-900 text-base leading-snug">
                                {risk.riskName}
                              </h3>
                            </div>
                            <span
                              className={cn(
                                "text-[11px] font-bold px-2.5 py-1 rounded-full shrink-0",
                                isHigh
                                  ? "bg-red-100 text-red-700 border border-red-200"
                                  : isMed
                                  ? "bg-orange-100 text-orange-700 border border-orange-200"
                                  : "bg-yellow-100 text-yellow-700 border border-yellow-200"
                              )}
                            >
                              {isHigh ? 'ความเสี่ยงสูง' : isMed ? 'ความเสี่ยงปานกลาง' : 'ความเสี่ยงต่ำ'}
                            </span>
                          </div>

                          <p className="text-xs text-gray-600 leading-relaxed pl-10.5">
                            {risk.description}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="bg-white rounded-3xl p-8 border border-emerald-100 text-center shadow-sm flex flex-col items-center">
                    <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 mb-3">
                      <CheckCircle2 size={32} />
                    </div>
                    <h3 className="text-base font-bold text-gray-900">
                      ไม่พบความเสี่ยงต่อสุขภาพ
                    </h3>
                    <p className="text-xs text-gray-500 mt-1 max-w-xs leading-relaxed">
                      เมนูนี้มีสัดส่วนสารอาหารที่ปลอดภัย ไม่เกินเกณฑ์ปริมาณโซเดียม ไขมัน หรือน้ำตาล
                    </p>
                  </div>
                )}
              </div>

              {/* Health Tips Card */}
              <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-3xl p-5 shadow-sm space-y-3">
                <div className="flex items-center gap-2 text-emerald-900">
                  <Lightbulb size={18} className="text-emerald-600" />
                  <h4 className="font-bold text-sm">คำแนะนำจาก AI ด้านสุขภาพ</h4>
                </div>
                <ul className="text-xs text-emerald-800 space-y-2 leading-relaxed">
                  {riskLevel === 'high' ? (
                    <>
                      <li className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                        <span>ควรดื่มน้ำเปล่าเพิ่มขึ้น 1-2 แก้ว เพื่อช่วยให้ร่างกายขับโซเดียมและของเสีย</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                        <span>สำหรับมื้อถัดไป ควรเน้นผักสด ผลไม้หวานน้อย และหลีกเลี่ยงของทอดหรืออาหารรสเค็มจัด</span>
                      </li>
                    </>
                  ) : riskLevel === 'medium' ? (
                    <>
                      <li className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                        <span>สามารถรับประทานได้ โดยลดการซดน้ำแกงหรือน้ำจิ้มเพื่อจำกัดโซเดียม</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                        <span>เสริมการเดินหรือขยับร่างกายเบาๆ 15-20 นาทีหลังมื้ออาหาร</span>
                      </li>
                    </>
                  ) : (
                    <>
                      <li className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                        <span>อาหารมื้อนี้มีสารอาหารที่สมดุลดีแล้ว สามารถรับประทานได้อย่างมั่นใจ</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                        <span>รักษาพฤติกรรมการทานอาหารที่ดีแบบนี้อย่างต่อเนื่องในทุกมื้อ</span>
                      </li>
                    </>
                  )}
                </ul>
              </div>
            </div>
          )}

          {/* Action button always accessible at bottom */}
          <button
            onClick={handleSaveToHistory}
            className="w-full bg-brand-green text-white font-bold rounded-2xl py-4 hover:bg-brand-green-dark transition-all shadow-lg shadow-brand-green/30 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
          >
            <Check size={20} /> {fromHistory ? 'อัปเดตรายการอาหาร' : 'บันทึกรายการอาหาร'}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </>
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

// ─── Macro Ring Card ──────────────────────────────────────────────────────────
function MacroRingCard({ label, enLabel, value, unit, max, color, bg, border, track, role }) {
  const ref = useRef(null);
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setAnimated(true); obs.disconnect(); } },
      { threshold: 0.3 }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  const pct = Math.min(Math.round((value / max) * 100), 100);
  const r = 28;
  const circ = 2 * Math.PI * r;
  const dashArray = animated ? `${(pct / 100) * circ} ${circ}` : `0 ${circ}`;

  return (
    <div
      ref={ref}
      className="rounded-3xl p-3.5 border transition-all duration-300 flex flex-col items-center justify-between shadow-sm hover:shadow-md"
      style={{
        background: bg,
        borderColor: border || 'rgba(0,0,0,0.06)',
      }}
    >
      {/* Top Header: Dot + Thai Title + EN Tag */}
      <div className="w-full flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
          <span className="text-xs font-black text-gray-900 truncate">{label}</span>
        </div>
        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">{enLabel}</span>
      </div>

      {/* Ring with value in center */}
      <div className="relative my-1" style={{ width: 72, height: 72 }}>
        <svg width="72" height="72" viewBox="0 0 72 72" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="36" cy="36" r={r} fill="none" stroke={track} strokeWidth="6" />
          <circle
            cx="36" cy="36" r={r}
            fill="none"
            stroke={color}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={dashArray}
            style={{ transition: 'stroke-dasharray 0.9s cubic-bezier(0.4,0,0.2,1)' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-base font-black text-gray-900 leading-none">{value}</span>
          <span className="text-[9px] text-gray-500 font-bold mt-0.5">{unit}</span>
        </div>
      </div>

      {/* Target & Daily % info */}
      <div className="w-full text-center mt-1 pt-1.5 border-t border-black/5 space-y-1">
        <div className="text-[11px] font-black text-gray-800">
          {value}{unit} <span className="text-[10px] text-gray-400 font-medium">/ {max}{unit}</span>
        </div>
        <div
          className="inline-block text-[9.5px] font-bold px-2 py-0.5 rounded-full"
          style={{ background: color + '18', color }}
        >
          {pct}% ของเกณฑ์ต่อวัน
        </div>
        {role && (
          <div className="text-[9px] text-gray-400 font-medium truncate pt-0.5">
            {role}
          </div>
        )}
      </div>
    </div>
  );
}

function ProgressBar({ label, value, unit, max, isLimitCategory }) {
  const percent = Math.min((value / max) * 100, 100);

  const labelColor = isLimitCategory ? 'text-[#8b4513] font-semibold' : 'text-gray-500';
  const barColor = isLimitCategory ? 'bg-[#8b4513]' : 'bg-[#2b7a2b]';
  const percentColor = isLimitCategory ? 'text-[#8b4513]' : 'text-gray-500';

  return (
    <div className="flex items-center gap-4 py-1">
      <div className={`w-24 shrink-0 text-sm ${labelColor}`}>
        {label}
      </div>
      <div className="flex-1 h-2 bg-[#e5e5e0] rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-1000 ease-out ${barColor}`} style={{ width: `${percent}%` }} />
      </div>
      <div className="w-14 shrink-0 text-right flex flex-col items-end leading-tight">
        <span className="text-sm font-semibold text-gray-700">{value}{unit}</span>
        <span className={`text-xs font-medium ${percentColor}`}>{Math.round(percent)}%</span>
      </div>
    </div>
  );
}
