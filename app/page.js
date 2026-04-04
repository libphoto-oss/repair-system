'use client';
import { useState } from 'react';
import Link from 'next/link';
import { addReport } from '@/lib/api';

const LOCATIONS = [
  '行政大樓',
  '教學大樓A棟',
  '教學大樓B棟',
  '教學大樓C棟',
  '實習工廠',
  '圖書館',
  '體育館',
  '操場',
  '餐廳',
  '其他',
];

export default function ReportForm() {
  const [formData, setFormData] = useState({
    department: '',
    teacher: '',
    location: '',
    classroom: '',
    category: '',
    description: ''
  });
  const [loading, setLoading] = useState(false);
  const [submitResult, setSubmitResult] = useState(null);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSubmitResult(null);
    try {
      const now = new Date();
      const localTime = `${now.getFullYear()}/${String(now.getMonth()+1).padStart(2,'0')}/${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
      const result = await addReport({ ...formData, reportTime: localTime });
      setSubmitResult({ success: true, id: result.id });
      setFormData({
        department: '', teacher: '', location: '', classroom: '', description: '', category: ''
      });
    } catch (err) {
      setSubmitResult({ success: false, message: '回報失敗，請稍後再試。' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <div className="nav-links">
        <Link href="/dashboard">進入維修管理系統</Link>
      </div>
      <div className="card">
        <div className="mascot-container">
          <img
            src="/bibi_mascot.png"
            alt="比比狗狗智能助理"
            className="mascot-image"
          />
        </div>
        <h1>維修通報申請單</h1>

        {submitResult && (
          <div className={`submit-result ${submitResult.success ? 'success' : 'error'}`}>
            {submitResult.success ? (
              <>
                <div className="result-title">報修單送出成功</div>
                <div className="result-id">
                  您的報修單號為 <strong>#{submitResult.id}</strong>，已通知相關單位。
                </div>
                <div className="result-hint">
                  請記下單號，可向資媒組/總務處查詢進度。
                </div>
              </>
            ) : (
              <div className="result-title">{submitResult.message}</div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>單位 / 班級</label>
            <input
              type="text"
              name="department"
              placeholder="例如：設備組 或 二年三班"
              value={formData.department}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label>相關人員（班級導師 / 報修人）</label>
            <input
              type="text"
              name="teacher"
              placeholder="請填寫姓名"
              value={formData.teacher}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label>地點</label>
            <select name="location" value={formData.location} onChange={handleChange} required>
              <option value="">請選擇地點</option>
              {LOCATIONS.map(loc => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>教室編號 / 空間名稱</label>
            <input
              type="text"
              name="classroom"
              placeholder="例如：203教室 或 視聽教室"
              value={formData.classroom}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label>報修項目</label>
            <select name="category" value={formData.category} onChange={handleChange} required>
              <option value="">請選擇</option>
              <option value="水電設備">水電設備</option>
              <option value="資訊設備（電腦/投影機）">資訊設備（電腦/投影機）</option>
              <option value="桌椅傢具">桌椅傢具</option>
              <option value="建築毀損">建築毀損</option>
              <option value="其他">其他</option>
            </select>
          </div>
          <div className="form-group">
            <label>問題說明</label>
            <textarea
              name="description"
              rows="4"
              placeholder="請詳細描述設備故障情形..."
              value={formData.description}
              onChange={handleChange}
              required
            ></textarea>
          </div>
          <button type="submit" disabled={loading}>
            {loading ? '資料傳送中...' : '送出報修單'}
          </button>
        </form>
      </div>
    </div>
  );
}
