import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, Info, Check, ShieldAlert, RefreshCw, Loader2, X, Sparkles } from 'lucide-react';
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

export default function AnalysisPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { addHistory, updateHistory, userProfile } = useStore();

  const { analysisData: initialData, imagePreviewUrl, fromHistory, historyId } = location.state || {};

  const [data, setData] = useState(initialData);
  const [dishName, setDishName] = useState(initialData?.dishName || '');
  const [isEditing, setIsEditing] = useState(false);
  const [ingredients, setIngredients] = useState(initialData?.ingredients || []);

  // Re-process modal state
  const [showReprocessModal, setShowReprocessModal] = useState(false);
  const [pendingEditedData, setPendingEditedData] = useState(null);
  const [reprocessing, setReprocessing] = useState(false);
  const [reprocessError, setReprocessError] = useState(null);

  // Re-analysis loading screen state
  const [reanalysisLoading, setReanalysisLoading] = useState(false);
  const [reanalysisProgress, setReanalysisProgress] = useState(0);

  useEffect(() => {
    if (!initialData) {
      navigate('/scan');
    }
  }, [initialData, navigate]);

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

  const saveAndRecalculate = () => {
    const oldTotalWeight = initialData.ingredients.reduce((acc, curr) => acc + curr.weightGrams, 0);
    const newTotalWeight = ingredients.reduce((acc, curr) => acc + curr.weightGrams, 0);
    const ratio = newTotalWeight / (oldTotalWeight || 1);

    const updatedData = {
      ...data,
      dishName,
      ingredients,
      calories: Math.round(initialData.calories * ratio),
      macros: {
        protein: Math.round(initialData.macros.protein * ratio),
        carbs: Math.round(initialData.macros.carbs * ratio),
        fat: Math.round(initialData.macros.fat * ratio),
        fiber: Math.round(initialData.macros.fiber * ratio),
      },
      micronutrients: {
        sodium: Math.round(initialData.micronutrients.sodium * ratio),
        sugar: Math.round(initialData.micronutrients.sugar * ratio),
        satFat: Math.round(initialData.micronutrients.satFat * ratio),
        vitaminC: Math.round(initialData.micronutrients.vitaminC * ratio),
        iron: Math.round(initialData.micronutrients.iron * ratio),
        calcium: Math.round(initialData.micronutrients.calcium * ratio),
      },
    };

    setIsEditing(false);

    // Show re-process modal only if the dish name changed
    if (dishName.trim() !== initialData.dishName?.trim()) {
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
    none:   { dot: 'bg-emerald-400', text: 'text-emerald-600', label: 'สุขภาพดี' },
    low:    { dot: 'bg-yellow-400',  text: 'text-yellow-600',  label: 'ความเสี่ยงต่ำ' },
    medium: { dot: 'bg-orange-400',  text: 'text-orange-600',  label: 'ความเสี่ยงปานกลาง' },
    high:   { dot: 'bg-red-500',     text: 'text-red-600',     label: 'ความเสี่ยงสูง' },
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
            <div className="flex justify-between items-start mb-2">
              {isEditing ? (
                <input
                  type="text"
                  value={dishName}
                  onChange={(e) => setDishName(e.target.value)}
                  className="text-2xl font-bold text-gray-800 leading-tight bg-gray-50 border border-gray-200 rounded px-2 py-1 w-2/3 focus:outline-none focus:border-brand-green"
                />
              ) : (
                <h1 className="text-2xl font-bold text-gray-800 leading-tight">{data.dishName}</h1>
              )}
              <div className="bg-brand-green text-white px-3 py-1 rounded-full text-xs font-bold shadow-sm">
                {data.healthScore}/100
              </div>
            </div>
            <p className="text-sm text-gray-500 mb-4 flex items-center gap-2">
              ~ {totalWeight}g
              <span className="inline-flex items-center gap-1.5">
                <span
                  className={cn('inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-sm', riskIndicator.dot)}
                  style={{ boxShadow: riskLevel !== 'none' ? `0 0 6px 1px var(--tw-shadow-color)` : undefined }}
                />
                <span className={cn('font-semibold', riskIndicator.text)}>
                  {riskCount === 0 ? riskIndicator.label : `${riskCount} ความเสี่ยง — ${riskIndicator.label}`}
                </span>
              </span>
            </p>

            <div className="flex items-center gap-4 border-t border-gray-100 pt-4">
              <div className="flex-1">
                <span className="block text-xs text-gray-400 font-semibold mb-1">แคลอรี่</span>
                <div className="flex items-end gap-1">
                  <span className="text-4xl font-black text-brand-green">{data.calories}</span>
                  <span className="text-sm text-gray-500 pb-1">kcal</span>
                </div>
              </div>
              <div className="w-14 h-14 rounded-full border-4 border-brand-green/20 flex items-center justify-center relative">
                <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-brand-green"
                    strokeDasharray={`${Math.min((data.calories / 2000) * 100, 100)}, 100`}
                    stroke="currentColor"
                    strokeWidth="3"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <span className="text-xs font-bold text-gray-700">{Math.round((data.calories / 2000) * 100)}%</span>
              </div>
            </div>
          </div>

          {/* Disclaimer */}
          <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4 flex gap-3 text-orange-800">
            <Info size={20} className="shrink-0 mt-0.5" />
            <p className="text-xs leading-relaxed">
              <span className="font-bold">การประมาณค่า:</span> ปริมาณที่แสดงเป็นค่าโดยประมาณ (+/-20-40%) ขึ้นอยู่กับมุมในการถ่ายภาพ
            </p>
          </div>

          {/* Ingredients & Editing */}
          <RevealSection delay={0}>
          <div>
            <div className="flex justify-between items-end mb-3">
              <h2 className="text-lg font-bold text-gray-800">ส่วนผสมที่พบ</h2>
              <button
                onClick={() => isEditing ? saveAndRecalculate() : setIsEditing(true)}
                className="text-brand-green text-sm font-bold flex items-center gap-1"
              >
                {isEditing ? <><Check size={14} /> บันทึก</> : <><RefreshCw size={14} /> แก้ไขวัตถุดิบ</>}
              </button>
            </div>
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3">
              {ingredients.map((ing, idx) => (
                <div key={idx} className="flex justify-between items-center">
                  {isEditing ? (
                    <input
                      type="text"
                      value={ing.name}
                      onChange={(e) => handleNameChange(idx, e.target.value)}
                      className="text-sm font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded px-2 py-1 flex-1 mr-2 focus:outline-none focus:border-brand-green"
                    />
                  ) : (
                    <span className="text-sm font-medium text-gray-700">{ing.name}</span>
                  )}

                  {isEditing ? (
                    <div className="flex items-center gap-1 shrink-0">
                      <input
                        type="number"
                        value={ing.weightGrams}
                        onChange={(e) => handleWeightChange(idx, e.target.value)}
                        className="w-16 bg-gray-50 border border-gray-200 rounded px-2 py-1 text-sm text-right focus:outline-none focus:border-brand-green"
                      />
                      <span className="text-xs text-gray-500">กรัม</span>
                    </div>
                  ) : (
                    <span className="text-sm text-gray-500">{ing.weightGrams}กรัม{' '}
                      <span className="text-[10px] text-gray-400">({ing.minGrams}-{ing.maxGrams}กรัม)</span>
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
          </RevealSection>

          {/* Personalized Risks */}
          {data.risks && data.risks.length > 0 && (
            <RevealSection delay={80}>
            <div>
              <h2 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
                <ShieldAlert size={20} className="text-red-500" /> ความเสี่ยงที่เกี่ยวข้องกับคุณ
              </h2>
              <div className="space-y-3">
                {data.risks.map((risk, idx) => (
                  <div key={idx} className={cn(
                    'p-4 rounded-2xl border flex gap-3',
                    risk.severity === 'high'   ? 'bg-red-50 border-red-100 text-red-900' :
                    risk.severity === 'medium' ? 'bg-orange-50 border-orange-100 text-orange-900' :
                                                 'bg-yellow-50 border-yellow-100 text-yellow-900'
                  )}>
                    <AlertTriangle size={24} className="shrink-0" />
                    <div>
                      <h3 className="font-bold text-sm mb-1">{risk.riskName}</h3>
                      <p className="text-xs opacity-90">{risk.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            </RevealSection>
          )}

          {/* Macros */}
          <RevealSection delay={120}>
            <h2 className="text-lg font-bold text-gray-800 mb-4">สารอาหารหลัก</h2>
            <div className="grid grid-cols-2 gap-3">
              <MacroRingCard label="โปรตีน"        value={data.macros.protein} unit="g" max={50}  color="#3b82f6" bg="#eff6ff" track="#bfdbfe" />
              <MacroRingCard label="คาร์โบไฮเดรต" value={data.macros.carbs}   unit="g" max={300} color="#f59e0b" bg="#fffbeb" track="#fde68a" />
              <MacroRingCard label="ไขมัน"         value={data.macros.fat}     unit="g" max={65}  color="#ef4444" bg="#fef2f2" track="#fecaca" />
              <MacroRingCard label="ใยอาหาร"       value={data.macros.fiber}   unit="g" max={28}  color="#22c55e" bg="#f0fdf4" track="#bbf7d0" />
            </div>
          </RevealSection>

          {/* Micronutrients */}
          <RevealSection delay={160}>
          <div>
            <h2 className="text-lg font-bold text-gray-800 mb-3">ข้อมูลโภชนาการ </h2>
            <p className="text-xs text-gray-500 mb-3">({data.micronutrients.minSugar}-{data.micronutrients.maxSugar}เปรียบเทียบตามร้อยละของปริมาณที่แนะนำต่อวัน)</p>
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-4">
              <ProgressBar label="โซเดียม" value={data.micronutrients.sodium} unit="mg" max={2300} warnAt={1500} />
              <ProgressBar label="น้ำตาล" value={data.micronutrients.sugar} unit="g" max={50} warnAt={30} />
              <ProgressBar label="ไขมันอิ่มตัว" value={data.micronutrients.satFat} unit="g" max={20} warnAt={13} />
            </div>
          </div>
          </RevealSection>

          <button
            onClick={handleSaveToHistory}
            className="w-full bg-brand-green text-white font-bold rounded-xl py-4 mt-8 hover:bg-brand-green-dark transition-colors shadow-lg shadow-brand-green/30 flex items-center justify-center gap-2"
          >
            <Check size={20} /> {fromHistory ? 'อัปเดตรายการอาหาร' : 'บันทึกรายการอาหาร'}
          </button>
        </div>
      </div>
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
function MacroRingCard({ label, value, unit, max, color, bg, track }) {
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

  const pct          = Math.min(Math.round((value / max) * 100), 100);
  const r            = 28;
  const circ         = 2 * Math.PI * r;
  const dashArray    = animated ? `${(pct / 100) * circ} ${circ}` : `0 ${circ}`;

  return (
    <div
      ref={ref}
      style={{
        background: bg,
        borderRadius: 20,
        padding: '18px 12px 14px',
        border: '1.5px solid rgba(0,0,0,0.05)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
      }}
    >
      {/* Ring */}
      <div style={{ position: 'relative', width: 72, height: 72 }}>
        <svg width="72" height="72" viewBox="0 0 72 72" style={{ transform: 'rotate(-90deg)' }}>
          {/* Track */}
          <circle cx="36" cy="36" r={r} fill="none" stroke={track} strokeWidth="6" />
          {/* Progress */}
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
        {/* Center label */}
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: 16, fontWeight: 900, color: '#111827', lineHeight: 1 }}>{value}</span>
          <span style={{ fontSize: 9, color: '#9ca3af', fontWeight: 600, marginTop: 1 }}>{unit}</span>
        </div>
      </div>
      {/* Label */}
      <p style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#374151', margin: 0 }}>{label}</p>
      {/* Daily % */}
      <span style={{
        background: color + '22', color,
        fontSize: 9, fontWeight: 700,
        padding: '2px 8px', borderRadius: 99,
      }}>
        {pct}% ต่อวัน
      </span>
    </div>
  );
}

function ProgressBar({ label, value, unit, max, warnAt }) {
  const percent = Math.min((value / max) * 100, 100);
  const isWarn = value > warnAt;
  const isDanger = value > max;

  return (
    <div>
      <div className="flex justify-between text-xs font-bold mb-1">
        <span className="text-gray-700">{label}</span>
        <span className="text-gray-500">{value}{unit} <span className="font-normal text-[10px]">/ {max}{unit}</span></span>
      </div>
      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", isDanger ? 'bg-red-500' : isWarn ? 'bg-orange-400' : 'bg-brand-green')}
          style={{ width: `${percent}%` }}
        ></div>
      </div>
    </div>
  );
}
