'use client';
import { useState } from 'react';
import Link from 'next/link';
import { addReport } from '@/lib/api';

export default function ReportForm() {
  const [formData, setFormData] = useState({
    reportTime: new Date().toISOString().slice(0, 16),
    department: '',
    teacher: '',
    location: '',
    classroom: '',
    category: '',
    description: ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      await addReport(formData);
      setMessage('報修單送出成功！已通知相關單位。');
      setFormData(prev => ({
        ...prev,
        department: '', teacher: '', location: '', classroom: '', description: '', category: ''
      }));
    } catch (err) {
      setMessage('回報失敗，請稍後再試。');
    } finally {
      setLoading(false);
    }
  };

  const isSuccess = message.includes('成功');

  return (
    <div className="container">
      <div className="nav-links">
        <Link href="/dashboard" style={{ background: 'rgba(255,255,255,0.7)', padding: '0.5rem 1rem', borderRadius: '8px', backdropFilter: 'blur(5px)' }}>進入維修管理系統</Link>
      </div>
      <div className="card">
        <div style={{ textAlign: 'center', marginBottom: '-10px' }}>
          <img src="/bibi_mascot.png" alt="比比狗狗智能助理" style={{ width: '130px', height: '130px', objectFit: 'contain', filter: 'drop-shadow(0px 4px 6px rgba(0,0,0,0.1))' }} />
        </div>
        <h1>維修通報申請單</h1>
        {message && (
          <div style={{ textAlign: 'center', marginBottom: '1.5rem', fontWeight: 'bold', color: isSuccess ? 'var(--success-color)' : 'red' }}>
            {message}
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>填報時間</label>
            <input type="datetime-local" name="reportTime" value={formData.reportTime} onChange={handleChange} required />
          </div>
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
            <input type="text" name="location" placeholder="例如：教學大樓" value={formData.location} onChange={handleChange} required />
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
