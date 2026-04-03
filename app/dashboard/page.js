'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getReports, updateReport as apiUpdateReport, verifyPassword } from '@/lib/api';
import { exportToExcel } from '@/lib/export';

export default function Dashboard() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unlocked, setUnlocked] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');

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

      <div className="card" style={{ marginBottom: '2rem', padding: '1.5rem' }}>
        <h1 style={{ marginBottom: '1rem' }}>維修進度管理後台</h1>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleExport}
            style={{ width: 'auto', background: '#059669' }}
          >
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
              已解鎖編輯權限
            </span>
          )}
        </div>
        {authError && (
          <p style={{ color: 'red', textAlign: 'center', marginTop: '0.5rem', marginBottom: 0 }}>{authError}</p>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem' }}>載入中...</div>
      ) : reports.length === 0 ? (
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>目前尚無任何報修紀錄。</p>
      ) : (
        reports.map(report => (
          <div key={report.id} className="report-item">
            <div className="report-header">
              <h2>#{report.id} {report.category}</h2>
              <span className={`badge ${Number(report.isClosed) === 1 ? 'closed' : 'pending'}`}>
                {Number(report.isClosed) === 1 ? '已結案' : '處理中'}
              </span>
            </div>

            <div className="report-grid">
              <div><strong>報修單位:</strong> {report.department} ({report.teacher})</div>
              <div><strong>報修時間:</strong> {new Date(report.reportTime).toLocaleString('zh-TW')}</div>
              <div><strong>地點:</strong> {report.location} - {report.classroom}</div>
              <div style={{ gridColumn: '1 / -1' }}><strong>問題說明:</strong> {report.description}</div>
              {report.assignedPerson && <div><strong>前往人員:</strong> {report.assignedPerson}</div>}
              {report.status && report.status !== '未處理' && <div><strong>維修情形:</strong> {report.status}</div>}
            </div>

            {unlocked && (
              <div className="update-form">
                <div>
                  <label>維修情形（進度備註）</label>
                  <input
                    type="text"
                    defaultValue={report.status}
                    onBlur={(e) => handleUpdate(report.id, 'status', e.target.value)}
                  />
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
