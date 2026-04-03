import * as XLSX from 'xlsx';

export function exportToExcel(reports) {
  const rows = reports.map((r) => ({
    '編號': r.id,
    '填報時間': r.reportTime,
    '單位/班級': r.department,
    '班級導師/報修人': r.teacher,
    '地點': r.location,
    '教室編號': r.classroom,
    '報修項目': r.category,
    '問題說明': r.description,
    '維修情形': r.status,
    '維修日期': r.maintenanceDate,
    '是否結案': Number(r.isClosed) === 1 ? '是' : '否',
    '前往人員': r.assignedPerson,
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);

  ws['!cols'] = [
    { wch: 6 },
    { wch: 20 },
    { wch: 14 },
    { wch: 12 },
    { wch: 14 },
    { wch: 14 },
    { wch: 18 },
    { wch: 30 },
    { wch: 18 },
    { wch: 14 },
    { wch: 10 },
    { wch: 12 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, '報修紀錄');

  const dateStr = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `repair_reports_${dateStr}.xlsx`);
}
