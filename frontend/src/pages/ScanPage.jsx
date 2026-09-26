import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Image as ImageIcon, ArrowLeft, Check, X, AlertCircle, Sparkles, Zap } from 'lucide-react';
import { useStore } from '../store';
import axios from 'axios';

const API_URL =
  import.meta.env.VITE_API_URL ||
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3001'
    : '');

export default function ScanPage() {
  const navigate = useNavigate();
  const { userProfile } = useStore();
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [errorInfo, setErrorInfo] = useState(null);
  const [backendStatus, setBackendStatus] = useState(null);

  // Confirmation screen state
  const [pendingFile, setPendingFile] = useState(null);
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState(null);
  const [pendingSource, setPendingSource] = useState('gallery'); // 'camera' | 'gallery'

  useEffect(() => {
    let interval;
    if (loading) {
      setProgress(0);
      interval = setInterval(() => {
        setProgress(p => (p >= 90 ? p : p + Math.random() * 8));
      }, 800);
    } else {
      setProgress(100);
    }
    return () => clearInterval(interval);
  }, [loading]);

  useEffect(() => {
    axios
      .get(`${API_URL}/api/health`)
      .then(res => setBackendStatus({ ok: true, ...res.data }))
      .catch(err => setBackendStatus({ ok: false, message: err.message || `Backend not reachable at ${API_URL}` }));
  }, []);

  // ── Step 1: pick image → show confirmation (don't call API yet) ──────────
  const handleFileChange = (e, source = 'gallery') => {
    const file = e.target.files[0];
    if (!file) return;
    setErrorInfo(null);
    setPendingFile(file);
    setPendingPreviewUrl(URL.createObjectURL(file));
    setPendingSource(source);
    e.target.value = ''; // reset so same file can be re-selected
  };

  const handleChangeImage = () => {
    setPendingFile(null);
    setPendingPreviewUrl(null);
    setErrorInfo(null);
  };

  // ── Step 2: user confirms → call API ─────────────────────────────────────
  const handleAnalyze = async () => {
    if (!pendingFile) return;
    setLoading(true);
    setErrorInfo(null);

    const formData = new FormData();
    formData.append('image', pendingFile);
    formData.append('userProfile', JSON.stringify(userProfile));

    try {
      const imagePreviewUrl = pendingPreviewUrl;
      const response = await axios.post(`${API_URL}/api/analyze`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const analysisData = response.data;

      if (analysisData.isRealPhoto === false) {
        setErrorInfo({
          message: 'ไม่สามารถวิเคราะห์ภาพนี้ได้',
          details: 'ระบบกรองตรวจพบว่าภาพนี้มีลักษณะคล้ายกับภาพวาด, การ์ตูน, หรือภาพที่ AI สร้างขึ้น กรุณาถ่ายรูปหรืออัปโหลดภาพถ่ายอาหารจริง',
        });
        setLoading(false);
        setPendingFile(null);
        setPendingPreviewUrl(null);
        return;
      }

      if (analysisData.isFood === false) {
        setErrorInfo({
          message: 'ไม่พบรูปอาหาร',
          details: 'ระบบกรองไม่พบรูปภาพอาหารในภาพที่อัปโหลด กรุณาตรวจสอบให้แน่ใจว่าคุณอัปโหลดรูปถ่ายมื้ออาหารที่คมชัด',
        });
        setLoading(false);
        setPendingFile(null);
        setPendingPreviewUrl(null);
        return;
      }

      setProgress(100);
      setTimeout(() => {
        setLoading(false);
        navigate('/analysis', { state: { analysisData, imagePreviewUrl } });
      }, 14000);
    } catch (err) {
      const data = err.response?.data;
      console.error('วิเคราะห์ภาพไม่สำเร็จ:', data ? JSON.stringify(data, null, 2) : err.message, `(HTTP ${err.response?.status ?? 'none'})`);
      if (err.code === 'ERR_NETWORK' || err.message?.includes('Network Error')) {
        setErrorInfo({
          message: `Cannot reach the server at ${API_URL}. Check that the backend is running and deployed.`,
          details: err.message,
          debug: { step: 'network', message: err.message, code: err.code },
        });
      } else {
        setErrorInfo({
          message: data?.error || 'ไม่สามารถวิเคราะห์รูปภาพได้ โปรดตรวจสอบให้แน่ใจว่าเป็นภาพถ่ายอาหารที่ชัดเจน แล้วลองใหม่อีกครั้ง',
          details: data?.details || (!data?.debug ? 'Backend returned a generic error — an old server may still be on port 3001.' : undefined),
          debug: { httpStatus: err.response?.status ?? null, fileType: pendingFile?.type, fileSizeBytes: pendingFile?.size, ...(data?.debug || {}) },
        });
      }
      setLoading(false);
      setPendingFile(null);
      setPendingPreviewUrl(null);
    }
  };

  // ── Loading screen ────────────────────────────────────────────────────────
  if (loading) {
    const steps = [
      { label: 'อัปโหลดรูปภาพ', at: 10 },
      { label: 'ตรวจสอบภาพถ่าย', at: 30 },
      { label: 'วิเคราะห์ข้อมูลจากภาพ', at: 55 },
      { label: 'ประมวลผลข้อมูล', at: 80 },
    ];
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 bg-brand-cream space-y-8 mt-10">
        <img src="/ai.gif" alt="loading" style={{ width: 100, height: 100 }} className="mx-auto" />
        <div className="w-full max-w-sm space-y-4">
          <h2 className="text-xl font-bold text-gray-900 text-center">กำลังวิเคราะห์รูปภาพ</h2>
          <p className="text-sm text-gray-500 text-center px-4">AI กำลังวิเคราะห์รูปภาพอาหารของคุณ กรุณารอสักครู่</p>
          <div className="pt-2">
            <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
              <div className="bg-brand-green h-full rounded-full transition-all duration-100 ease-out"
                style={{ width: `${Math.min(100, Math.max(0, Math.round(progress)))}%` }} />
            </div>
            <p className="text-center text-gray-400 text-sm mt-3">{Math.round(progress)}%</p>
          </div>
          <div className="space-y-4 pt-6 pl-4">
            {steps.map(step => (
              <div key={step.label} className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors duration-300 ${progress > step.at ? 'bg-brand-green text-white' : 'bg-gray-200 text-transparent'}`}>
                  <Check size={14} strokeWidth={3} />
                </div>
                <span className={`text-sm ${progress > step.at ? 'text-gray-600' : 'text-gray-400'}`}>{step.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Confirmation screen ───────────────────────────────────────────────────
  if (pendingFile && pendingPreviewUrl) {
    const analyzeItems = [
      { emoji: '', label: 'ส่วนผสมและวัตถุดิบอาหาร' },
      { emoji: '', label: 'สารอาหารและโภชนาการ' },
      { emoji: '', label: 'ความเสี่ยงและคำเตือนด้านสุขภาพ' },
      { emoji: '', label: 'คะแนนสุขภาพโดยรวม' },
    ];
    return (
      <div className="h-full bg-brand-cream flex flex-col overflow-y-auto">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 pt-7 pb-2 flex-shrink-0">
          <button
            onClick={handleChangeImage}
            className="w-9 h-9 bg-white rounded-full flex items-center justify-center shadow-sm border border-gray-100 flex-shrink-0"
          >
            <ArrowLeft size={18} className="text-gray-700" />
          </button>
          <div>
            <p className="text-[10px] font-bold text-brand-green uppercase tracking-widest">ขั้นตอนที่ 2 จาก 3</p>
            <h1 className="text-lg font-bold text-gray-900 leading-tight">ยืนยันรูปภาพ</h1>
          </div>
        </div>
        <p className="text-sm text-gray-500 px-5 mb-4 flex-shrink-0">
          ตรวจสอบให้แน่ใจว่าอาหารมองเห็นชัดเจนก่อนวิเคราะห์
        </p>

        <div className="px-5 space-y-4 pb-8 flex-1">
          {/* Image preview */}
          <div className="relative rounded-3xl overflow-hidden shadow-lg border border-gray-100">
            <img
              src={pendingPreviewUrl}
              alt="Food preview"
              className="w-full object-cover"
              style={{ maxHeight: 280 }}
            />
            <button
              onClick={handleChangeImage}
              className="absolute top-3 right-3 w-8 h-8 bg-black/50 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-black/70 transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Detected card */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-3">
            <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center flex-shrink-0">
              {pendingSource === 'camera'
                ? <Camera size={22} className="text-brand-green" />
                : <ImageIcon size={22} className="text-brand-green" />}
            </div>
            <div>
              <p className="text-[10px] font-bold text-brand-green uppercase tracking-widest mb-0.5">ตรวจพบ</p>
              <p className="text-sm font-bold text-gray-800">
                {pendingSource === 'camera' ? 'ภาพถ่ายจากกล้อง' : 'ภาพจากแกลเลอรี่'}
              </p>
              <p className="text-xs text-gray-400">
                {pendingSource === 'camera' ? 'ถ่ายด้วยกล้องโดยตรง' : 'อัปโหลดจากคลังรูปภาพ'}
              </p>
            </div>
          </div>

          {/* What We'll Analyze */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <p className="text-sm font-bold text-gray-800 mb-3">สิ่งที่จะวิเคราะห์</p>
            <div className="space-y-3">
              {analyzeItems.map((item, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-base w-6 text-center">{item.emoji}</span>
                    <span className="text-sm text-gray-600">{item.label}</span>
                  </div>
                  <div className="w-5 h-5 rounded-full bg-brand-green flex items-center justify-center flex-shrink-0">
                    <Check size={11} className="text-white" strokeWidth={3} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 pt-1">
            <button
              onClick={handleChangeImage}
              className="flex-1 py-3.5 rounded-2xl border-2 border-gray-200 text-gray-700 font-semibold text-sm hover:border-gray-300 hover:bg-gray-50 transition-all"
            >
              เปลี่ยนรูปภาพ
            </button>
            <button
              onClick={handleAnalyze}
              className="flex-[2] py-3.5 rounded-2xl bg-brand-green text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-brand-green/30 hover:brightness-110 active:scale-95 transition-all"
            >
              <Sparkles size={16} />
              วิเคราะห์อาหาร
            </button>
          </div>
        </div>

        <input type="file" accept="image/*" capture="environment" className="hidden" ref={cameraInputRef} onChange={e => handleFileChange(e, 'camera')} />
        <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={e => handleFileChange(e, 'gallery')} />
      </div>
    );
  }

  // ── Main scan screen ──────────────────────────────────────────────────────
  return (
    <div className="h-full bg-brand-cream relative flex flex-col overflow-hidden">
      <style>{`
        @keyframes floatCamera { 0%,100% { transform:translateY(0) rotate(0deg); } 50% { transform:translateY(-10px) rotate(-3deg); } }
        .camera-float { animation: floatCamera 3.5s ease-in-out infinite; }
        @keyframes pulseRing { 0%,100% { transform:scale(1); opacity:0.4; } 50% { transform:scale(1.15); opacity:0.1; } }
        .pulse-ring { animation: pulseRing 2.5s ease-in-out infinite; }
      `}</style>

      {/* Back */}
      <div className="absolute top-6 left-6 z-10">
        <button onClick={() => navigate(-1)} className="w-10 h-10 bg-white/80 backdrop-blur-md rounded-full flex items-center justify-center text-gray-800 shadow-sm border border-gray-100">
          <ArrowLeft size={20} />
        </button>
      </div>

      {/* Hero */}
      <RevealSection delay={0}>
      <div className="relative pt-20 pb-6 px-6 flex-shrink-0 text-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-50 via-emerald-50/60 to-brand-cream pointer-events-none" />
        <div className="relative">
          {/* Floating icon with pulse rings */}
          <div className="relative inline-block mb-5">
            <div className="absolute inset-0 rounded-3xl bg-brand-green pulse-ring" style={{ margin: '-10px' }} />
            <Camera size={34} className="text-black" />

          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1.5">คุณกินอะไรแล้วหรือยัง?</h1>
          <p className="text-sm text-gray-500 leading-relaxed">ถ่ายรูปหรืออัปโหลดเพื่อดูข้อมูล<br />โภชนาการได้ทันที</p>
        </div>
      </div>
      </RevealSection>

      {/* Backend offline warning */}
      {backendStatus && !backendStatus.ok && (
        <div className="mx-5 mb-3 flex-shrink-0">
          <div className="bg-amber-50 text-amber-900 p-3 rounded-2xl text-xs border border-amber-200 flex items-start gap-2">
            <AlertCircle size={14} className="flex-shrink-0 mt-0.5 text-amber-500" />
            <span>
              Backend offline — รัน <code className="font-mono bg-amber-100 px-1 rounded">cd backend && npm start</code>
            </span>
          </div>
        </div>
      )}

      {/* Error card */}
      {errorInfo && (
        <div className="mx-5 mb-3 flex-shrink-0">
          <div className="bg-white rounded-2xl shadow-sm border border-red-100 overflow-hidden">
            {/* Error header bar */}
            <div className="flex items-center gap-2 bg-red-500 px-4 py-2.5">
              <AlertCircle size={15} className="text-white flex-shrink-0" />
              <span className="text-white font-bold text-sm">เกิดข้อผิดพลาด</span>
            </div>
            <div className="px-4 py-3 space-y-2">
              <p className="text-red-700 font-semibold text-sm leading-snug">{errorInfo.message}</p>
              {errorInfo.details && errorInfo.details !== errorInfo.message && (
                <p className="text-gray-500 text-xs leading-relaxed border-l-2 border-red-200 pl-3">{errorInfo.details}</p>
              )}
              {errorInfo.debug && (
                <details className="mt-1">
                  <summary className="text-[11px] text-red-400 cursor-pointer font-medium">รายละเอียดเพิ่มเติม</summary>
                  <pre className="mt-1.5 p-2 bg-red-50 rounded-lg text-[10px] whitespace-pre-wrap break-words font-mono text-red-800 border border-red-100">
                    {JSON.stringify(errorInfo.debug, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <RevealSection delay={100}>
      <div className="flex-1 flex flex-col gap-4 px-5 pb-6 justify-center">
        {/* Camera */}
        <button
          onClick={() => cameraInputRef.current.click()}
          className="relative w-full h-44 rounded-3xl overflow-hidden shadow-2xl shadow-brand-green/20 group active:scale-[0.98] transition-transform"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-brand-green via-emerald-600 to-emerald-600 transition-all duration-500" />

          {/* Decorative circles */}
          <div className="relative flex flex-col items-center justify-center h-full gap-3 text-white">
            <div className="w-16 h-16 bg-white/25 rounded-full flex items-center justify-center backdrop-blur-md ring-4 ring-white/20 group-hover:ring-white/40 group-hover:scale-110 transition-all duration-300">
              <Camera size={30} />
            </div>
            <div>
              <p className="font-bold text-lg">ถ่ายรูป</p>
              <p className="text-white/70 text-xs mt-0.5">ใช้กล้องถ่ายอาหารโดยตรง</p>
            </div>
          </div>
        </button>

        {/* Gallery */}
        <button
          onClick={() => fileInputRef.current.click()}
          className="w-full h-24 bg-white border-2 border-dashed border-gray-200 rounded-3xl text-gray-600 flex items-center justify-center gap-4 hover:border-brand-green hover:text-brand-green hover:bg-emerald-50 active:scale-[0.98] transition-all shadow-sm group"
        >
          <div className="w-11 h-11 rounded-2xl bg-gray-100 group-hover:bg-emerald-100 flex items-center justify-center transition-colors flex-shrink-0">
            <ImageIcon size={20} />
          </div>
          <div className="text-left">
            <p className="font-semibold text-sm">อัปโหลดจากแกลเลอรี่</p>
            <p className="text-xs text-gray-400 group-hover:text-emerald-400 transition-colors mt-0.5">เลือกรูปจากคลังภาพ</p>
          </div>
        </button>

        {/* Tip */}
        <div className="flex items-start gap-3 bg-white/70 rounded-2xl p-3.5 border border-gray-100">
          <div className="w-7 h-7 bg-amber-50 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
            <Zap size={14} className="text-amber-500" />
          </div>
          <p className="text-xs text-gray-500 leading-relaxed">
            <span className="font-semibold text-gray-700">เคล็ดลับ:</span>{' '}
            ถ่ายรูปอาหารในมุมตรง ในแสงสว่าง และให้อาหารอยู่ในเฟรมทั้งหมดเพื่อผลลัพธ์ที่แม่นยำที่สุด
          </p>
        </div>
      </div>
      </RevealSection>

      <input type="file" accept="image/*" capture="environment" className="hidden" ref={cameraInputRef} onChange={e => handleFileChange(e, 'camera')} />
      <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={e => handleFileChange(e, 'gallery')} />
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
