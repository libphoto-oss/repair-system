'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getReports, updateReport as apiUpdateReport, verifyPassword, deleteReport as apiDeleteReport } from '@/lib/api';
import { exportToExcel } from '@/lib/export';

const STATUS_OPTIONS = ['未處理', '已派人前往', '零件等待中', '已完成修復', '無法修復（待評估）'];

export default function Dashboard() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unlocked, setUnlocked] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');
  const [sortBy, setSortBy] = useState('pending_first');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterLocation, setFilterLocation] = useState('');

  const fetchReports = async () => {
    try {
      const data = await getReports();
      setReports(data);
    } catch (err) {
      alert('無法取得資料：' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const handleUnlock = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      const data = await verifyPassword(passwordInput);
      if (data.success) {
        setUnlocked(true);
      } else {
        setAuthError('密碼錯誤，請重新輸入。');
      }
    } catch {
      setAuthError('驗證過程發生錯誤。');
    }
  };

  const handleUpdate = async (id, field, value) => {
    if (!unlocked) return;
    try {
      await apiUpdateReport(id, field, value);
      fetchReports();
    } catch (err) {
      alert('狀態更新失敗');
    }
  };

  const handleDelete = async (id) => {
    if (!unlocked) return;
    if (!confirm(`確定要刪除報修單 #${id} 嗎？此動作無法復原。`)) return;
    try {
      await apiDeleteReport(id);
      fetchReports();
    } catch (err) {
      alert('刪除失敗：' + err.message);
    }
  };

  // 取得唯一地點清單（供篩選用）
  const locationOptions = [...new Set(reports.map(r => r.location).filter(Boolean))].sort();
  const categoryOptions = [...new Set(reports.map(r => r.category).filter(Boolean))].sort();

  // 篩選
  const filteredReports = reports.filter(r => {
    if (filterCategory && r.category !== filterCategory) return false;
    if (filterLocation && r.location !== filterLocation) return false;
    if (filterStatus === 'pending' && Number(r.isClosed) === 1) return false;
    if (filterStatus === 'closed' && Number(r.isClosed) === 0) return false;
    return true;
  });

  // 排序
  const sortedReports = [...filteredReports].sort((a, b) => {
    if (sortBy === 'time_asc') return new Date(a.reportTime) - new Date(b.reportTime);
    if (sortBy === 'pending_first') {
      if (Number(a.isClosed) !== Number(b.isClosed)) return Number(a.isClosed) - Number(b.isClosed);
      return new Date(b.reportTime) - new Date(a.reportTime);
    }
    return new Date(b.reportTime) - new Date(a.reportTime);
  });

  // 統計
  const total = reports.length;
  const pending = reports.filter(r => Number(r.isClosed) === 0).length;
  const closed = reports.filter(r => Number(r.isClosed) === 1).length;

  const handleExport = () => {
    if (reports.length === 0) {
      alert('目前沒有報修紀錄可匯出。');
      return;
    }
    exportToExcel(reports);
  };

  return (
    <div className="container" style={{ maxWidth: '1000px' }}>
      <div className="nav-links">
        <Link href="/">返回填寫報修單</Link>
      </div>

      {/* 頂部控制卡片 */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
        <h1 style={{ marginBottom: '1rem' }}>維修進度管理後台</h1>

        {/* 統計數字 */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          {[
            { label: '全部', value: total, color: '#4f46e5', bg: '#ede9fe' },
            { label: '處理中', value: pending, color: '#d97706', bg: '#fef3c7' },
            { label: '已結案', value: closed, color: '#059669', bg: '#d1fae5' },
          ].map(stat => (
            <div key={stat.label} style={{ textAlign: 'center', background: stat.bg, borderRadius: '10px', padding: '0.6rem 1.4rem', minWidth: '80px' }}>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: stat.color, lineHeight: 1 }}>{stat.value}</div>
              <div style={{ fontSize: '0.8rem', color: stat.color, marginTop: '0.2rem' }}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* 按鈕列 */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <button type="button" onClick={handleExport} style={{ width: 'auto', background: '#059669' }}>
            匯出 Excel 報表
          </button>
          {!unlocked && (
            <form onSubmit={handleUnlock} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input
                type="password"
                placeholder="輸入管理密碼以啟用編輯"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                style={{ width: '220px', margin: 0 }}
              />
              <button type="submit" style={{ width: 'auto', whiteSpace: 'nowrap' }}>解鎖編輯</button>
            </form>
          )}
          {unlocked && (
            <span style={{ color: 'var(--success-color)', fontWeight: 600, alignSelf: 'center' }}>
              ✅ 已解鎖編輯權限
            </span>
          )}
        </div>
        {authError && (
          <p style={{ color: 'red', textAlign: 'center', marginTop: '0.5rem', marginBottom: 0 }}>{authError}</p>
        )}

        {/* 排序 */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>排序：</span>
          {[
            { value: 'pending_first', label: '🔴 未結案優先' },
            { value: 'time_desc', label: '⬇ 最新優先' },
            { value: 'time_asc', label: '⬆ 最舊優先' },
          ].map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setSortBy(opt.value)}
              style={{
                width: 'auto',
                background: sortBy === opt.value ? 'var(--primary-color)' : '#e5e7eb',
                color: sortBy === opt.value ? 'white' : 'var(--text-primary)',
                padding: '0.4rem 0.9rem',
                fontSize: '0.85rem',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* 篩選 */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', marginTop: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>篩選：</span>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            style={{ width: 'auto', padding: '0.35rem 0.7rem', fontSize: '0.85rem' }}
          >
            <option value="">全部狀態</option>
            <option value="pending">處理中</option>
            <option value="closed">已結案</option>
          </select>
          <select
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
            style={{ width: 'auto', padding: '0.35rem 0.7rem', fontSize: '0.85rem' }}
          >
            <option value="">全部類別</option>
            {categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select
            value={filterLocation}
            onChange={e => setFilterLocation(e.target.value)}
            style={{ width: 'auto', padding: '0.35rem 0.7rem', fontSize: '0.85rem' }}
          >
            <option value="">全部地點</option>
            {locationOptions.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          {(filterStatus || filterCategory || filterLocation) && (
            <button
              type="button"
              onClick={() => { setFilterStatus(''); setFilterCategory(''); setFilterLocation(''); }}
              style={{ width: 'auto', background: '#6b7280', padding: '0.35rem 0.7rem', fontSize: '0.85rem' }}
            >
              清除篩選
            </button>
          )}
        </div>

        {/* 篩選結果數量提示 */}
        {(filterStatus || filterCategory || filterLocation) && (
          <p style={{ textAlign: 'center', marginTop: '0.5rem', marginBottom: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            顯示 {sortedReports.length} / {total} 筆
          </p>
        )}
      </div>

      {/* 報修清單 */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem' }}>載入中...</div>
      ) : sortedReports.length === 0 ? (
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
          {reports.length === 0 ? '目前尚無任何報修紀錄。' : '沒有符合篩選條件的紀錄。'}
        </p>
      ) : (
        sortedReports.map(report => (
          <div key={report.id} className="report-item">
            <div className="report-header">
              <h2>#{report.id} {report.category}</h2>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <span className={`badge ${Number(report.isClosed) === 1 ? 'closed' : 'pending'}`}>
                  {Number(report.isClosed) === 1 ? '已結案' : '處理中'}
                </span>
                {unlocked && (
                  <button
                    type="button"
                    onClick={() => handleDelete(report.id)}
                    style={{ width: 'auto', background: '#ef4444', padding: '0.25rem 0.65rem', fontSize: '0.8rem' }}
                    title="刪除此報修單"
                  >
                    🗑 刪除
                  </button>
                )}
              </div>
            </div>

            <div className="report-grid">
              <div><strong>報修單位:</strong> {report.department} ({report.teacher})</div>
              <div><strong>報修時間:</strong> {report.reportTime}</div>
              <div><strong>地點:</strong> {report.location} - {report.classroom}</div>
              <div style={{ gridColumn: '1 / -1' }}><strong>問題說明:</strong> {report.description}</div>
              {report.assignedPerson && <div><strong>前往人員:</strong> {report.assignedPerson}</div>}
              {report.status && report.status !== '未處理' && <div><strong>維修情形:</strong> {report.status}</div>}
            </div>

            {unlocked && (
              <div className="update-form">
                <div>
                  <label>維修情形（進度備註）</label>
                  <select
                    defaultValue={report.status || '未處理'}
                    onChange={(e) => handleUpdate(report.id, 'status', e.target.value)}
                  >
                    {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label>前往人員</label>
                  <input
                    type="text"
                    defaultValue={report.assignedPerson}
                    onBlur={(e) => handleUpdate(report.id, 'assignedPerson', e.target.value)}
                  />
                </div>
                <div>
                  <label>結案狀態</label>
                  <select
                    defaultValue={Number(report.isClosed)}
                    onChange={(e) => handleUpdate(report.id, 'isClosed', parseInt(e.target.value))}
                  >
                    <option value={0}>處理中</option>
                    <option value={1}>已結案</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
