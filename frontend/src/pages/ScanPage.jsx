import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Image as ImageIcon, ArrowLeft, Loader2, Check } from 'lucide-react';
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
      .then((res) => setBackendStatus({ ok: true, ...res.data }))
      .catch((err) =>
        setBackendStatus({
          ok: false,
          message: err.message || `Backend not reachable at ${API_URL}`,
        })
      );
  }, []);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Check duplicate logic could be added here (e.g., hash file or compare last upload)

    setLoading(true);
    setErrorInfo(null);

    const formData = new FormData();
    formData.append('image', file);
    formData.append('userProfile', JSON.stringify(userProfile));

    try {
      // Create a temporary object URL for previewing later
      const imagePreviewUrl = URL.createObjectURL(file);

      const response = await axios.post(`${API_URL}/api/analyze`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      const analysisData = response.data;

      if (analysisData.isRealPhoto === false) {
        setErrorInfo({
          message: 'ไม่สามารถวิเคราะห์ภาพนี้ได้',
          details: 'ระบบกรองตรวจพบว่าภาพนี้มีลักษณะคล้ายกับภาพวาด, การ์ตูน, หรือภาพที่ AI สร้างขึ้น กรุณาถ่ายรูปหรืออัปโหลดภาพถ่ายอาหารจริง'
        });
        setLoading(false);
        return;
      }

      if (analysisData.isFood === false) {
        setErrorInfo({
          message: 'ไม่พบรูปอาหาร',
          details: 'ระบบกรองไม่พบรูปภาพอาหารในภาพที่อัปโหลด กรุณาตรวจสอบให้แน่ใจว่าคุณอัปโหลดรูปถ่ายมื้ออาหารที่คมชัด'
        });
        setLoading(false);
        return;
      }

      // Ensure progress hits 100% and displays before navigating
      setProgress(100);
      setTimeout(() => {
        setLoading(false);
        navigate('/analysis', { state: { analysisData, imagePreviewUrl } });
      }, 14000);
    } catch (err) {
      const data = err.response?.data;
      console.error(
        'วิเคราะห์ภาพไม่สำเร็จ:',
        data ? JSON.stringify(data, null, 2) : err.message,
        `(HTTP ${err.response?.status ?? 'none'})`
      );
      if (err.code === 'ERR_NETWORK' || err.message?.includes('Network Error')) {
        setErrorInfo({
          message:
            `Cannot reach the server at ${API_URL}. Check that the backend is running and deployed.`,
          details: err.message,
          debug: { step: 'network', message: err.message, code: err.code },
        });
      } else {
        setErrorInfo({
          message:
            data?.error ||
            'ไม่สามารถวิเคราะห์รูปภาพได้ โปรดตรวจสอบให้แน่ใจว่าเป็นภาพถ่ายอาหารที่ชัดเจน แล้วลองใหม่อีกครั้ง',
          details:
            data?.details ||
            (!data?.debug
              ? 'Backend returned a generic error — an old server may still be on port 3001. Stop all Node processes, run npm start in backend again, and confirm /api/health shows debug-v2.'
              : undefined),
          debug: {
            httpStatus: err.response?.status ?? null,
            fileType: file.type,
            fileSizeBytes: file.size,
            ...(data?.debug || {}),
          },
        });
      }
      setLoading(false);
    }
  };

  return (
    <div className="h-full bg-brand-cream relative">
      <div className="absolute top-6 left-6 z-10">
        <button onClick={() => navigate(-1)} className="w-10 h-10 bg-white/50 backdrop-blur-md rounded-full flex items-center justify-center text-gray-800">
          <ArrowLeft size={20} />
        </button>
      </div>

      {loading ? (
        <div className="h-full flex flex-col item-center justify-center p-8 bg-brand-cream space-y-8 mt-10">
          <img src="/ai.gif" alt="loading" style={{ width: '100px', height: '100px' }} className='mx-auto' />

          <div className="w-full max-w-sm space-y-4">
            <h2 className="text-xl font-bold text-gray-900 text-center">กำลังวิเคราะห์รูปภาพ</h2>
            <p className="text-sm text-gray-500 text-center px-4">
              AI กำลังวิเคราะห์รูปภาพอาหารของคุณ กรุณารอสักครู่
            </p>

            <div className="pt-2">
              <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-brand-green h-full rounded-full transition-all duration-100 ease-out"
                  style={{ width: `${Math.min(100, Math.max(0, Math.round(progress)))}%` }}
                ></div>
              </div>
              <p className="text-center text-gray-400 text-sm mt-3">{Math.round(progress)}%</p>
            </div>

            <div className="space-y-4 pt-6 pl-4">
              <div className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors duration-300 ${progress > 10 ? 'bg-brand-green text-white' : 'bg-gray-200 text-transparent'}`}>
                  <Check size={14} strokeWidth={3} />
                </div>
                <span className={`text-sm ${progress > 10 ? 'text-gray-600' : 'text-gray-400'}`}>อัปโหลดรูปภาพ</span>
              </div>
              <div className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors duration-300 ${progress > 30 ? 'bg-brand-green text-white' : 'bg-gray-200 text-transparent'}`}>
                  <Check size={14} strokeWidth={3} />
                </div>
                <span className={`text-sm ${progress > 30 ? 'text-gray-600' : 'text-gray-400'}`}>ตรวจสอบภาพถ่าย</span>
              </div>
              <div className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors duration-300 ${progress > 55 ? 'bg-brand-green text-white' : 'bg-gray-200 text-transparent'}`}>
                  <Check size={14} strokeWidth={3} />
                </div>
                <span className={`text-sm ${progress > 55 ? 'text-gray-600' : 'text-gray-400'}`}>วิเคราะห์ข้อมูลจากภาพ</span>
              </div>
              <div className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors duration-300 ${progress > 80 ? 'bg-brand-green text-white' : 'bg-gray-200 text-transparent'}`}>
                  <Check size={14} strokeWidth={3} />
                </div>
                <span className={`text-sm ${progress > 80 ? 'text-gray-600' : 'text-gray-400'}`}>ประมวลผลข้อมูล</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="h-full flex flex-col pt-24 px-6 pb-6">
          <h1 className="text-3xl font-bold text-brand-green-dark mb-2">คุณกินอะไรแล้วหรือยัง?</h1>
          <p className="text-gray-500 mb-10">ถ่ายรูปหรืออัปโหลดจากแกลเลอรี่เพื่อดูข้อมูลทางโภชนาการได้ทันที</p>

          {backendStatus && !backendStatus.ok && (
            <div className="bg-amber-50 text-amber-900 p-3 rounded-xl mb-4 text-xs border border-amber-200">
              Backend offline — run <code className="font-mono">cd backend && npm start</code>
            </div>
          )}

          {errorInfo && (
            <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-6 text-sm flex flex-col gap-2 border border-red-100 max-h-72 overflow-y-auto">
              <span className="font-semibold">เกิดข้อผิดพลาด</span>
              <span>{errorInfo.message}</span>
              {errorInfo.details && errorInfo.details !== errorInfo.message && (
                <p className="text-red-800 text-xs">{errorInfo.details}</p>
              )}
              {errorInfo.debug && (
                <pre className="mt-1 p-2 bg-red-100/80 rounded text-xs whitespace-pre-wrap break-words font-mono text-red-900">
                  {JSON.stringify(errorInfo.debug, null, 2)}
                </pre>
              )}
            </div>
          )}

          <div className="flex-1 flex flex-col gap-4 justify-center">
            <button
              onClick={() => cameraInputRef.current.click()}
              className="w-full h-40 bg-brand-green rounded-3xl text-white flex flex-col items-center justify-center gap-3 hover:bg-brand-green-dark transition-colors shadow-xl shadow-brand-green/20"
            >
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-md">
                <Camera size={32} />
              </div>
              <span className="font-bold text-lg">ถ่ายรูป</span>
            </button>

            <button
              onClick={() => fileInputRef.current.click()}
              className="w-full h-24 bg-white border-2 border-dashed border-gray-300 rounded-3xl text-gray-600 flex items-center justify-center gap-3 hover:border-brand-green hover:text-brand-green transition-colors"
            >
              <ImageIcon size={24} />
              <span className="font-semibold">อัปโหลดจากแกลเลอรี่</span>
            </button>
          </div>

          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            ref={cameraInputRef}
            onChange={handleFileChange}
          />
          <input
            type="file"
            accept="image/*"
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileChange}
          />
        </div>
      )}

    </div>
  );
}
