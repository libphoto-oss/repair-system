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
        <Link href="/dashboard" style={{ background: 'rgba(255,255,255,0.7)', padding: '0.5rem 1rem', borderRadius: '8px', backdropFilter: 'blur(5px)' }}>進入維修管理系統</Link>
      </div>
      <div className="card">
        <div style={{ textAlign: 'center', marginBottom: '-10px' }}>
          <img src="/bibi_mascot.png" alt="比比狗狗智能助理" style={{ width: '180px', height: '180px', objectFit: 'contain', filter: 'drop-shadow(0px 4px 6px rgba(0,0,0,0.1))' }} />
        </div>
        <h1>維修通報申請單</h1>

        {submitResult && (
          <div style={{
            textAlign: 'center',
            marginBottom: '1.5rem',
            padding: '1rem',
            borderRadius: '10px',
            background: submitResult.success ? '#d1fae5' : '#fee2e2',
            border: `1px solid ${submitResult.success ? '#6ee7b7' : '#fca5a5'}`,
          }}>
            {submitResult.success ? (
              <>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#065f46' }}>✅ 報修單送出成功！</div>
                <div style={{ marginTop: '0.4rem', color: '#047857' }}>
                  您的報修單號為 <strong style={{ fontSize: '1.2rem' }}>#{submitResult.id}</strong>，已通知相關單位。
                </div>
                <div style={{ fontSize: '0.85rem', color: '#6b7280', marginTop: '0.3rem' }}>請記下單號，可向總務處查詢進度。</div>
              </>
            ) : (
              <div style={{ fontWeight: 'bold', color: '#991b1b' }}>❌ {submitResult.message}</div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>單位 / 班級</label>
            <input type="text" name="department" placeholder="例如：設備組 或 二年三班" value={formData.department} onChange={handleChange} required />
          </div>
          <div className="form-group">
            <label>相關人員（班級導師 / 報修人）</label>
            <input type="text" name="teacher" placeholder="請填寫姓名" value={formData.teacher} onChange={handleChange} required />
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
            <input type="text" name="classroom" placeholder="例如：203教室 或 視聽教室" value={formData.classroom} onChange={handleChange} required />
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
            <textarea name="description" rows="4" placeholder="請詳細描述設備故障情形..." value={formData.description} onChange={handleChange} required></textarea>
          </div>
          <button type="submit" disabled={loading}>
            {loading ? '資料傳送中...' : '送出報修單'}
          </button>
        </form>
      </div>
    </div>
  );
}
