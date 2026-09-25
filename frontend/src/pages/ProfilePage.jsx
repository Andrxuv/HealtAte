import React, { useState } from 'react';
import { Settings } from 'lucide-react';
import { useStore } from '../store';

const CHRONIC_DISEASES = [
  'โรคเบาหวาน', 'โรคความดันโลหิตสูง', 'โรคไต', 'คอเลสเตอรอลสูง', 'โรคหัวใจ', 'โรคเกาต์',
];

function calcAge(birthDate) {
  if (!birthDate) return null;
  let year, month, day;
  if (birthDate.includes('-')) {
    [year, month, day] = birthDate.split('-').map(Number);
  } else if (birthDate.includes('/')) {
    [day, month, year] = birthDate.split('/').map(Number);
  } else return null;
  if (!day || !month || !year || year < 1900) return null;
  const today = new Date();
  let age = today.getFullYear() - year;
  const m = today.getMonth() + 1 - month;
  if (m < 0 || (m === 0 && today.getDate() < day)) age--;
  return age >= 0 ? age : null;
}

function toDisplay(val) {
  if (!val || !val.includes('-')) return val || '';
  const [y, m, d] = val.split('-');
  return `${d}/${m}/${y}`;
}

function toNative(val) {
  if (!val || !val.includes('/')) return val || '';
  const parts = val.split('/');
  if (parts.length !== 3) return '';
  const [d, m, y] = parts;
  return `${y.padStart(4, '0')}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

export default function ProfilePage() {
  const { userProfile, setUserProfile } = useStore();
  const [formData, setFormData] = useState({
    drugAllergies: '',
    foodAllergies: '',
    medications: '',
    ...userProfile,
  });
  const [customDisease, setCustomDisease] = useState('');
  const [displayDate, setDisplayDate] = useState(toDisplay(userProfile.birthDate || ''));

  const computedAge = calcAge(formData.birthDate);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleNativeDateChange = (e) => {
    const native = e.target.value;
    setFormData({ ...formData, birthDate: native });
    setDisplayDate(toDisplay(native));
  };

  const handleDisplayDateChange = (e) => {
    let val = e.target.value.replace(/[^0-9/]/g, '');
    if (val.length === 2 && !displayDate.includes('/')) val += '/';
    if (val.length === 5 && val.split('/').length - 1 === 1) val += '/';
    if (val.length > 10) return;
    setDisplayDate(val);
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(val)) {
      setFormData({ ...formData, birthDate: toNative(val) });
    }
  };

  const toggleDisease = (disease) => {
    const current = formData.chronicDiseases || [];
    setFormData({
      ...formData,
      chronicDiseases: current.includes(disease)
        ? current.filter((d) => d !== disease)
        : [...current, disease],
    });
  };

  const addCustomDisease = () => {
    if (customDisease.trim() && !formData.chronicDiseases?.includes(customDisease.trim())) {
      setFormData({
        ...formData,
        chronicDiseases: [...(formData.chronicDiseases || []), customDisease.trim()],
      });
      setCustomDisease('');
    }
  };

  const saveProfile = () => {
    setUserProfile(formData);
    alert('บันทึกโปรไฟล์แล้ว!');
  };

  const inputCls =
    'w-full bg-[#f4f3ef] border border-transparent rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#2f6f4c] focus:ring-1 focus:ring-[#2f6f4c] transition-all';

  return (
    <div className="p-4 space-y-6 bg-[#fcfbf9] min-h-full pb-24 relative">

      <div className="bg-[#2f6f4c] rounded-[1.25rem] p-5 text-white flex justify-between items-center relative overflow-hidden">
        <div className="flex items-center gap-3 relative z-10">
          <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-[#2f6f4c] font-bold text-lg">
            {formData.name ? formData.name.substring(0, 2) : 'สช'}
          </div>
          <div>
            <h2 className="text-[1.1rem] font-bold leading-tight">โปรไฟล์สุขภาพ</h2>
            <p className="text-xs text-white/80 mt-0.5">
              คุณ{formData.name || 'สมชาย ดีใจยิ่ง'}
              {computedAge !== null && (
                <span className="ml-1 opacity-75">· อายุ {computedAge} ปี</span>
              )}
            </p>
          </div>
        </div>
        <button className="relative z-10 bg-white/10 p-2 rounded-full backdrop-blur-sm border border-white/20">
          <Settings size={20} className="text-white/80" />
        </button>
      </div>

      <div className="mb-2">
        <h2 className="text-lg font-bold text-gray-800">ข้อมูลส่วนตัวทั่วไป</h2>
        <p className="text-[11px] text-gray-500 mt-1">
          ระบุข้อมูลพื้นฐานเพื่อใช้ในการคำนวณดัชนีร่างกายและติดต่อยามฉุกเฉิน
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-[11px] font-bold text-gray-700 mb-1">
            ชื่อ-นามสกุล <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="name"
            value={formData.name || ''}
            onChange={handleChange}
            className={inputCls}
            placeholder="สมชาย ดีใจยิ่ง"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-gray-700 mb-1">
              วันเกิด <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={displayDate}
                onChange={handleDisplayDateChange}
                className={inputCls + ' pr-8'}
                placeholder="วว/ดด/ปปปป"
                maxLength={10}
              />
              <input
                type="date"
                value={formData.birthDate || ''}
                onChange={handleNativeDateChange}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                tabIndex={-1}
              />
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                📅
              </span>
            </div>
            {computedAge !== null && (
              <p className="text-[10px] text-[#2f6f4c] font-semibold mt-1">อายุ {computedAge} ปี</p>
            )}
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-700 mb-1">เพศ</label>
            <div className="relative">
              <select
                name="gender"
                value={formData.gender || 'ชาย'}
                onChange={handleChange}
                className={inputCls + ' appearance-none'}
              >
                <option value="ชาย">ชาย</option>
                <option value="หญิง">หญิง</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                  <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-gray-700 mb-1">
              น้ำหนัก (กก.) <span className="text-red-500">*</span>
            </label>
            <input type="number" name="weight" value={formData.weight || ''} onChange={handleChange} className={inputCls} placeholder="72.5" />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-gray-700 mb-1">
              ส่วนสูง (ซม.) <span className="text-red-500">*</span>
            </label>
            <input type="number" name="height" value={formData.height || ''} onChange={handleChange} className={inputCls} placeholder="178" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-gray-700 mb-1">กรุ๊ปเลือด</label>
            <div className="relative">
              <select name="bloodType" value={formData.bloodType || 'O'} onChange={handleChange} className={inputCls + ' appearance-none'}>
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="AB">AB</option>
                <option value="O">O</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                  <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                </svg>
              </div>
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-gray-700 mb-1">
              เบอร์ติดต่อฉุกเฉิน <span className="text-red-500">*</span>
            </label>
            <input type="text" name="emergencyContact" value={formData.emergencyContact || ''} onChange={handleChange} className={inputCls} placeholder="089-765-4321" />
          </div>
        </div>

        <div className="pt-5 border-t border-gray-100 space-y-4">
          <div>
            <h2 className="text-lg font-bold text-gray-800">ข้อมูลทางการแพทย์</h2>
            <p className="text-[11px] text-gray-500 mt-1">
              ข้อมูลเหล่านี้จะถูกนำไปใช้ในการวิเคราะห์ความเสี่ยงด้านสุขภาพจากอาหารที่สแกน
            </p>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-700 mb-1">
              ยาที่แพ้ <span className="text-[10px] font-normal text-gray-400">(Drug Allergies)</span>
            </label>
            <textarea
              name="drugAllergies"
              value={formData.drugAllergies || ''}
              onChange={handleChange}
              rows={2}
              className={inputCls + ' resize-none'}
              placeholder="เช่น เพนิซิลลิน, แอสไพริน (หรือระบุ 'ไม่มี')"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-700 mb-1">
              อาหารที่แพ้ <span className="text-[10px] font-normal text-gray-400">(Food Allergies)</span>
            </label>
            <textarea
              name="foodAllergies"
              value={formData.foodAllergies || ''}
              onChange={handleChange}
              rows={2}
              className={inputCls + ' resize-none'}
              placeholder="เช่น กุ้ง, ถั่ว, นม, กลูเตน (หรือระบุ 'ไม่มี')"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-700 mb-1">
              ยาที่รับประทานเป็นประจำ <span className="text-[10px] font-normal text-gray-400">(Regular Medications)</span>
            </label>
            <textarea
              name="medications"
              value={formData.medications || ''}
              onChange={handleChange}
              rows={2}
              className={inputCls + ' resize-none'}
              placeholder="เช่น เมตฟอร์มิน, แอมโลดิปีน (หรือระบุ 'ไม่มี')"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-700 mb-2">โรคประจำตัว</label>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {CHRONIC_DISEASES.map((disease) => (
                <button
                  key={disease}
                  onClick={() => toggleDisease(disease)}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-medium border transition-colors ${
                    formData.chronicDiseases?.includes(disease)
                      ? 'bg-[#2f6f4c] text-white border-[#2f6f4c]'
                      : 'bg-white text-gray-500 border-gray-200'
                  }`}
                >
                  {disease}
                </button>
              ))}
              {formData.chronicDiseases
                ?.filter((d) => !CHRONIC_DISEASES.includes(d))
                .map((disease) => (
                  <button
                    key={disease}
                    onClick={() => toggleDisease(disease)}
                    className="px-2.5 py-1 rounded-full text-[10px] font-medium border transition-colors bg-[#2f6f4c] text-white border-[#2f6f4c]"
                  >
                    {disease} ✕
                  </button>
                ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={customDisease}
                onChange={(e) => setCustomDisease(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addCustomDisease();
                  }
                }}
                className="flex-1 bg-[#f4f3ef] border border-transparent rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#2f6f4c] focus:ring-1 focus:ring-[#2f6f4c] transition-all"
                placeholder="ระบุโรคประจำตัวอื่นๆ..."
              />
              <button
                onClick={addCustomDisease}
                className="bg-[#2f6f4c] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#235339] transition-colors"
              >
                เพิ่ม
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur-md border-t border-gray-100 rounded-b-[32px]">
        <button
          onClick={saveProfile}
          className="w-full bg-[#2f6f4c] text-white font-bold rounded-[1rem] py-3.5 hover:bg-[#235339] transition-colors"
        >
          บันทึกและปรับปรุงแผนสุขภาพ
        </button>
      </div>
    </div>
  );
}