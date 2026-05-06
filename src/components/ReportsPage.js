import React, { useState, useMemo } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import logoUrl from '../Ceilao Logo.png';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Collapse from '@mui/material/Collapse';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

import BarChartIcon from '@mui/icons-material/BarChart';
import PeopleOutlineIcon from '@mui/icons-material/PeopleOutline';
import MonetizationOnOutlinedIcon from '@mui/icons-material/MonetizationOnOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

/* ── colour palette (ARGB for ExcelJS) ───────────────────────────────── */
const XL = {
  coral:      'FFFF5A5A',
  orange:     'FFFF8B5A',
  gold:       'FFFFD45A',
  dark:       'FF1A1A2E',
  grey:       'FF6B7280',
  lightGrey:  'FF9CA3AF',
  peach:      'FFFFF8F5',
  peachBorder:'FFFFD4C0',
  white:      'FFFFFFFF',
};

/* ── fetch logo as base64 ─────────────────────────────────────────────── */
async function fetchLogoBase64() {
  try {
    const resp = await fetch(logoUrl);
    const blob = await resp.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/* ── shared cell helpers ─────────────────────────────────────────────── */
function headerStyle(cell, { bg = XL.coral, color = XL.white, size = 12, bold = true, align = 'center' } = {}) {
  cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
  cell.font   = { bold, size, color: { argb: color }, name: 'Calibri' };
  cell.alignment = { horizontal: align, vertical: 'middle' };
}

function dataStyle(cell, { bg = XL.white, bold = false, align = 'left', color = XL.dark } = {}) {
  cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
  cell.font  = { bold, size: 10, color: { argb: color }, name: 'Calibri' };
  cell.alignment = { horizontal: align, vertical: 'middle' };
  cell.border = {
    top:    { style: 'hair', color: { argb: XL.peachBorder } },
    bottom: { style: 'hair', color: { argb: XL.peachBorder } },
    left:   { style: 'hair', color: { argb: XL.peachBorder } },
    right:  { style: 'hair', color: { argb: XL.peachBorder } },
  };
}

/* ── add logo + title block to any sheet ──────────────────────────────── */
function addSheetHeader(ws, logoId, wb, title, subtitle) {
  // Rows 1-4: coral background block
  [1, 2, 3, 4].forEach(r => {
    ws.getRow(r).height = r === 3 ? 28 : 18;
  });

  const cols = ws.columns.length || 8;
  const lastCol = cols;

  // Merge full-width coral header
  ws.mergeCells(1, 1, 4, lastCol);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = '';
  headerStyle(titleCell, { bg: XL.coral, size: 14 });

  // Logo (top-left) — ws.addImage positions the image; wb.addImage only registers it
  if (logoId !== null) {
    ws.addImage(logoId, {
      tl: { col: 0.3, row: 0.2 },
      ext: { width: 110, height: 55 },
    });
  }

  // Company name (right side of header block) — row 2 separate cell trick
  // We overlay a text cell in the merged area by un-merging then re-styling
  // Instead: put company info below the logo block
  ws.mergeCells(5, 1, 5, lastCol);
  const companyCell = ws.getCell(5, 1);
  companyCell.value = 'CEILAO INSURANCE BROKERS (PVT) LTD';
  headerStyle(companyCell, { bg: XL.dark, size: 13, color: XL.white });
  ws.getRow(5).height = 24;

  ws.mergeCells(6, 1, 6, lastCol);
  const reportTitleCell = ws.getCell(6, 1);
  reportTitleCell.value = title;
  headerStyle(reportTitleCell, { bg: XL.orange, size: 11, color: XL.white });
  ws.getRow(6).height = 20;

  ws.mergeCells(7, 1, 7, lastCol);
  const subCell = ws.getCell(7, 1);
  subCell.value = subtitle;
  headerStyle(subCell, { bg: XL.peach, size: 9.5, color: XL.grey, bold: false });
  ws.getRow(7).height = 16;

  // blank spacer
  ws.getRow(8).height = 8;
}

/* ── ts helper ────────────────────────────────────────────────────────── */
function ts() {
  const n = new Date();
  return `${n.getFullYear()}${String(n.getMonth()+1).padStart(2,'0')}${String(n.getDate()).padStart(2,'0')}`;
}
function dateLabel() {
  return new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

/* ── summary stat ─────────────────────────────────────────────────────── */
function SumStat({ label, value, gradient, icon }) {
  return (
    <Box sx={{
      p: 2.5, borderRadius: '14px',
      background: gradient,
      flex: 1, minWidth: 140,
    }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
        <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase', letterSpacing: 0.6 }}>
          {label}
        </Typography>
        <Box sx={{ '& svg': { color: 'rgba(255,255,255,0.7)', fontSize: 18 } }}>{icon}</Box>
      </Box>
      <Typography sx={{ fontSize: 20, fontWeight: 800, color: '#fff', lineHeight: 1 }}>
        {value}
      </Typography>
    </Box>
  );
}

/* ── report card ──────────────────────────────────────────────────────── */
function ReportCard({ title, description, icon, expanded, onToggle, children, onDownload, downloadLabel, loading }) {
  return (
    <Card className="anim-fade-up card-hover" sx={{ mb: 2.5 }}>
      <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
        <Box sx={{
          px: 3, py: 2,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: expanded ? '1px solid rgba(255,139,90,0.10)' : 'none',
          cursor: 'pointer',
          '&:hover': { bgcolor: 'rgba(255,90,90,0.02)' },
          transition: 'background 0.15s ease',
        }} onClick={onToggle}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{
              width: 38, height: 38, borderRadius: '10px',
              background: 'linear-gradient(135deg,#FF5A5A,#FF8B5A)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              '& svg': { color: '#fff', fontSize: 18 },
            }}>
              {icon}
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: 15, color: '#1A1A2E' }}>{title}</Typography>
              <Typography sx={{ fontSize: 12, color: '#9CA3AF' }}>{description}</Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {onDownload && (
              <Button
                size="small" variant="outlined" startIcon={<FileDownloadOutlinedIcon />}
                onClick={e => { e.stopPropagation(); onDownload(); }}
                sx={{ fontSize: 11.5, borderColor: 'rgba(255,139,90,0.30)', color: '#FF8B5A',
                      '&:hover': { borderColor: '#FF8B5A', bgcolor: 'rgba(255,139,90,0.06)' } }}
              >
                {downloadLabel || 'Export XLS'}
              </Button>
            )}
            {expanded ? <ExpandLessIcon sx={{ color: '#9CA3AF' }} /> : <ExpandMoreIcon sx={{ color: '#9CA3AF' }} />}
          </Box>
        </Box>

        <Collapse in={expanded} timeout={280} unmountOnExit>
          <Box sx={{ px: 3, py: 2.5 }}>
            {loading
              ? <Stack spacing={1}>
                  {[1,2,3,4].map(i => <Skeleton key={i} height={36} sx={{ bgcolor: 'rgba(255,90,90,0.05)', borderRadius: '8px' }} />)}
                </Stack>
              : children
            }
          </Box>
        </Collapse>
      </CardContent>
    </Card>
  );
}

/* ── main ─────────────────────────────────────────────────────────────── */
const ReportsPage = () => {
  const [clients,    setClients]    = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [expanded,   setExpanded]   = useState('');
  const [dateFrom,   setDateFrom]   = useState(null);
  const [dateTo,     setDateTo]     = useState(null);
  const [useRange,   setUseRange]   = useState(false);
  const [exporting,  setExporting]  = useState(false);
  const [exportErr,  setExportErr]  = useState('');

  const fetchAll = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'clients'), orderBy('created_at', 'desc'));
      const snap = await getDocs(q);
      setClients(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch { /* ignore */ }
    setLoading(false);
  };

  const handleToggle = (card) => {
    if (expanded !== card) {
      setExpanded(card);
      if (!clients.length) fetchAll();
    } else {
      setExpanded('');
    }
  };

  const filteredClients = useMemo(() => {
    if (!useRange || (!dateFrom && !dateTo)) return clients;
    return clients.filter(c => {
      const d = c.policy_period_from ? new Date(c.policy_period_from) : null;
      if (!d) return false;
      if (dateFrom && d < dateFrom) return false;
      if (dateTo   && d > dateTo)   return false;
      return true;
    });
  }, [clients, useRange, dateFrom, dateTo]);

  const summary = useMemo(() => {
    const sum = (k) => filteredClients.reduce((a, c) => a + (Number(c[k]) || 0), 0);
    return {
      total:      filteredClients.length,
      sumInsured: sum('sum_insured'),
      basicPrem:  sum('basic_premium'),
      netPrem:    sum('net_premium'),
      totalInv:   sum('total_invoice'),
      expiring:   filteredClients.filter(c => {
        const d = c.policy_period_to ? Math.ceil((new Date(c.policy_period_to) - new Date()) / 86400000) : null;
        return d !== null && d >= 0 && d <= 30;
      }).length,
      expired: filteredClients.filter(c => {
        const d = c.policy_period_to ? Math.ceil((new Date(c.policy_period_to) - new Date()) / 86400000) : null;
        return d !== null && d < 0;
      }).length,
    };
  }, [filteredClients]);

  const lkr = (v) => `LKR ${Number(v).toLocaleString()}`;

  /* ── XLS: full report (summary + client list) ── */
  const exportFullXLS = async () => {
    setExporting(true); setExportErr('');
    try {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Ceilao Insurance Brokers';
    wb.created = new Date();

    const logoBase64 = await fetchLogoBase64();
    const logoId = logoBase64
      ? wb.addImage({ base64: logoBase64, extension: 'png' })
      : null;

    /* ── Sheet 1: Summary ── */
    const ws1 = wb.addWorksheet('Summary', { pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true } });
    ws1.columns = [
      { width: 32 },
      { width: 28 },
      { width: 18 },
    ];

    addSheetHeader(ws1, logoId, wb, 'FINANCIAL SUMMARY REPORT',
      `Generated: ${dateLabel()} | ${filteredClients.length} client${filteredClients.length !== 1 ? 's' : ''}${useRange ? ' (filtered)' : ''}`
    );

    // Section: Key Financials
    const kfHeader = ws1.getRow(9);
    ws1.mergeCells(9, 1, 9, 3);
    headerStyle(ws1.getCell(9, 1), { bg: XL.dark, size: 10, color: XL.orange });
    ws1.getCell(9, 1).value = 'KEY FINANCIALS';
    kfHeader.height = 18;

    const financials = [
      ['Sum Insured',   summary.sumInsured, true],
      ['Basic Premium', summary.basicPrem,  false],
      ['Net Premium',   summary.netPrem,    false],
      ['Total Invoice', summary.totalInv,   true],
    ];
    financials.forEach(([label, val, highlight], i) => {
      const r = 10 + i;
      const bg = highlight ? XL.peach : XL.white;
      ws1.getRow(r).height = 20;

      const lc = ws1.getCell(r, 1);
      lc.value = label;
      dataStyle(lc, { bg, bold: highlight, color: XL.grey });

      const vc = ws1.getCell(r, 2);
      vc.value = Number(val);
      vc.numFmt = '"LKR "#,##0.00';
      dataStyle(vc, { bg, bold: highlight, align: 'right', color: highlight ? XL.coral : XL.dark });

      ws1.getCell(r, 3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
    });

    // spacer
    ws1.getRow(14).height = 10;

    // Section: Portfolio Health
    ws1.mergeCells(15, 1, 15, 3);
    headerStyle(ws1.getCell(15, 1), { bg: XL.dark, size: 10, color: XL.orange });
    ws1.getCell(15, 1).value = 'PORTFOLIO HEALTH';
    ws1.getRow(15).height = 18;

    const health = [
      ['Total Clients',        summary.total,    XL.coral],
      ['Expiring in 30 Days',  summary.expiring, 'FFD97706'],
      ['Expired Policies',     summary.expired,  'FFDC2626'],
    ];
    health.forEach(([label, val, accent], i) => {
      const r = 16 + i;
      ws1.getRow(r).height = 20;

      const lc = ws1.getCell(r, 1);
      lc.value = label;
      dataStyle(lc, { bg: i % 2 === 1 ? XL.peach : XL.white, color: XL.grey });

      const vc = ws1.getCell(r, 2);
      vc.value = val;
      dataStyle(vc, { bg: i % 2 === 1 ? XL.peach : XL.white, bold: true, align: 'right', color: accent });

      ws1.getCell(r, 3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: i % 2 === 1 ? XL.peach : XL.white } };
    });

    // Footer
    ws1.getRow(20).height = 10;
    ws1.mergeCells(21, 1, 21, 3);
    const foot1 = ws1.getCell(21, 1);
    foot1.value = 'CEILAO INSURANCE BROKERS (PVT) LTD — CONFIDENTIAL';
    foot1.font = { size: 8, color: { argb: XL.lightGrey }, italic: true, name: 'Calibri' };
    foot1.alignment = { horizontal: 'center' };

    /* ── Sheet 2: Client List ── */
    const clientCols = [
      { header: 'Client Name',        key: 'client_name',          width: 26 },
      { header: 'Mobile',             key: 'mobile_no',            width: 14 },
      { header: 'Product',            key: 'product',              width: 20 },
      { header: 'Insurance Provider', key: 'insurance_provider',   width: 22 },
      { header: 'Policy No',          key: 'policy_no',            width: 17 },
      { header: 'Policy Type',        key: 'policy_type',          width: 16 },
      { header: 'Period From',        key: 'policy_period_from',   width: 13 },
      { header: 'Period To',          key: 'policy_period_to',     width: 13 },
      { header: 'Sum Insured (LKR)',  key: 'sum_insured',          width: 17 },
      { header: 'Net Premium (LKR)',  key: 'net_premium',          width: 17 },
      { header: 'Total Invoice (LKR)',key: 'total_invoice',        width: 17 },
    ];

    const ws2 = wb.addWorksheet('Client List', {
      pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
    });
    ws2.columns = clientCols;

    addSheetHeader(ws2, logoId, wb, 'CLIENT LIST — POLICY DETAILS',
      `Generated: ${dateLabel()} | ${filteredClients.length} client${filteredClients.length !== 1 ? 's' : ''}${useRange ? ' (date-filtered)' : ' (all time)'}`
    );

    // Column header row (row 9)
    const colHeaderRow = ws2.getRow(9);
    colHeaderRow.height = 24;
    clientCols.forEach((col, ci) => {
      const cell = ws2.getCell(9, ci + 1);
      cell.value = col.header;
      headerStyle(cell, { bg: XL.orange, size: 9.5, color: XL.white });
      cell.border = {
        bottom: { style: 'medium', color: { argb: XL.coral } },
        right:  { style: 'thin',   color: { argb: 'FFFF5A5A66' } },
      };
    });

    // Data rows starting at row 10
    const numericCols = new Set([9, 10, 11]); // 1-indexed: sum_insured, net_premium, total_invoice

    filteredClients.forEach((c, i) => {
      const rowIdx = 10 + i;
      const bg = i % 2 === 1 ? XL.peach : XL.white;
      const row = ws2.getRow(rowIdx);
      row.height = 18;

      const values = [
        c.client_name || '',
        c.mobile_no   || '',
        c.product     || '',
        c.insurance_provider || '',
        c.policy_no   || '',
        c.policy_type || '',
        c.policy_period_from || '',
        c.policy_period_to   || '',
        Number(c.sum_insured)   || 0,
        Number(c.net_premium)   || 0,
        Number(c.total_invoice) || 0,
      ];

      values.forEach((val, ci) => {
        const colNum = ci + 1;
        const cell = ws2.getCell(rowIdx, colNum);
        cell.value = val;
        dataStyle(cell, {
          bg,
          bold:  colNum === 1,
          align: numericCols.has(colNum) ? 'right' : 'left',
          color: colNum === 1 ? XL.dark : XL.grey,
        });
        if (numericCols.has(colNum)) {
          cell.numFmt = '#,##0.00';
        }
      });
    });

    // Totals row
    const totRowIdx = 10 + filteredClients.length;
    ws2.getRow(totRowIdx).height = 22;
    clientCols.forEach((_, ci) => {
      const colNum = ci + 1;
      const cell = ws2.getCell(totRowIdx, colNum);
      if (colNum === 1) {
        cell.value = `TOTAL (${filteredClients.length} clients)`;
        headerStyle(cell, { bg: XL.dark, size: 10, color: XL.gold, align: 'left' });
      } else if (numericCols.has(colNum)) {
        const key = clientCols[ci].key;
        cell.value = filteredClients.reduce((a, c) => a + (Number(c[key]) || 0), 0);
        cell.numFmt = '#,##0.00';
        headerStyle(cell, { bg: XL.dark, size: 10, color: XL.gold, align: 'right' });
      } else {
        cell.value = '';
        headerStyle(cell, { bg: XL.dark, size: 10, color: XL.white });
      }
    });

    // Freeze header rows
    ws2.views = [{ state: 'frozen', ySplit: 9 }];

    // Footer
    const footRowIdx = totRowIdx + 2;
    ws2.mergeCells(footRowIdx, 1, footRowIdx, clientCols.length);
    const foot2 = ws2.getCell(footRowIdx, 1);
    foot2.value = 'CEILAO INSURANCE BROKERS (PVT) LTD — CONFIDENTIAL';
    foot2.font = { size: 8, color: { argb: XL.lightGrey }, italic: true, name: 'Calibri' };
    foot2.alignment = { horizontal: 'center' };

    /* ── download ── */
    const buffer = await wb.xlsx.writeBuffer();
    saveAs(
      new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      `ceilao_report_${ts()}.xlsx`
    );
    } catch (err) { setExportErr(err.message || 'Export failed'); }
    setExporting(false);
  };

  /* ── XLS: client list only ── */
  const exportClientXLS = async () => {
    setExporting(true); setExportErr('');
    try {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Ceilao Insurance Brokers';
    wb.created = new Date();

    const logoBase64 = await fetchLogoBase64();
    const logoId = logoBase64
      ? wb.addImage({ base64: logoBase64, extension: 'png' })
      : null;

    const clientCols = [
      { header: 'Client Name',        key: 'client_name',          width: 26 },
      { header: 'Mobile',             key: 'mobile_no',            width: 14 },
      { header: 'Product',            key: 'product',              width: 20 },
      { header: 'Insurance Provider', key: 'insurance_provider',   width: 22 },
      { header: 'Policy No',          key: 'policy_no',            width: 17 },
      { header: 'Policy Type',        key: 'policy_type',          width: 16 },
      { header: 'Period From',        key: 'policy_period_from',   width: 13 },
      { header: 'Period To',          key: 'policy_period_to',     width: 13 },
      { header: 'Sum Insured (LKR)',  key: 'sum_insured',          width: 17 },
      { header: 'Net Premium (LKR)',  key: 'net_premium',          width: 17 },
      { header: 'Total Invoice (LKR)',key: 'total_invoice',        width: 17 },
    ];

    const ws = wb.addWorksheet('Client List', {
      pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
    });
    ws.columns = clientCols;

    addSheetHeader(ws, logoId, wb, 'CLIENT LIST — POLICY DETAILS',
      `Generated: ${dateLabel()} | ${filteredClients.length} client${filteredClients.length !== 1 ? 's' : ''}${useRange ? ' (date-filtered)' : ' (all time)'}`
    );

    const colHeaderRow = ws.getRow(9);
    colHeaderRow.height = 24;
    clientCols.forEach((col, ci) => {
      const cell = ws.getCell(9, ci + 1);
      cell.value = col.header;
      headerStyle(cell, { bg: XL.orange, size: 9.5, color: XL.white });
      cell.border = { bottom: { style: 'medium', color: { argb: XL.coral } } };
    });

    const numericCols = new Set([9, 10, 11]);

    filteredClients.forEach((c, i) => {
      const rowIdx = 10 + i;
      const bg = i % 2 === 1 ? XL.peach : XL.white;
      ws.getRow(rowIdx).height = 18;

      const values = [
        c.client_name || '',
        c.mobile_no   || '',
        c.product     || '',
        c.insurance_provider || '',
        c.policy_no   || '',
        c.policy_type || '',
        c.policy_period_from || '',
        c.policy_period_to   || '',
        Number(c.sum_insured)   || 0,
        Number(c.net_premium)   || 0,
        Number(c.total_invoice) || 0,
      ];

      values.forEach((val, ci) => {
        const colNum = ci + 1;
        const cell = ws.getCell(rowIdx, colNum);
        cell.value = val;
        dataStyle(cell, {
          bg,
          bold:  colNum === 1,
          align: numericCols.has(colNum) ? 'right' : 'left',
          color: colNum === 1 ? XL.dark : XL.grey,
        });
        if (numericCols.has(colNum)) cell.numFmt = '#,##0.00';
      });
    });

    // Totals
    const totRowIdx = 10 + filteredClients.length;
    ws.getRow(totRowIdx).height = 22;
    clientCols.forEach((_, ci) => {
      const colNum = ci + 1;
      const cell = ws.getCell(totRowIdx, colNum);
      if (colNum === 1) {
        cell.value = `TOTAL (${filteredClients.length} clients)`;
        headerStyle(cell, { bg: XL.dark, size: 10, color: XL.gold, align: 'left' });
      } else if (numericCols.has(colNum)) {
        const key = clientCols[ci].key;
        cell.value = filteredClients.reduce((a, c) => a + (Number(c[key]) || 0), 0);
        cell.numFmt = '#,##0.00';
        headerStyle(cell, { bg: XL.dark, size: 10, color: XL.gold, align: 'right' });
      } else {
        cell.value = '';
        headerStyle(cell, { bg: XL.dark, size: 10, color: XL.white });
      }
    });

    ws.views = [{ state: 'frozen', ySplit: 9 }];

    const buffer = await wb.xlsx.writeBuffer();
    saveAs(
      new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      `ceilao_clients_${ts()}.xlsx`
    );
    } catch (err) { setExportErr(err.message || 'Export failed'); }
    setExporting(false);
  };

  /* ── date range filter UI ── */
  const DateRangeFilter = () => (
    <Box sx={{ mb: 2.5 }}>
      <Stack direction="row" spacing={1} sx={{ mb: 1.5 }} flexWrap="wrap">
        <Chip
          label="All time" clickable size="small"
          onClick={() => setUseRange(false)}
          sx={{ fontWeight: 700, fontSize: 12,
                background: !useRange ? 'linear-gradient(135deg,#FF5A5A,#FF8B5A)' : 'rgba(255,90,90,0.08)',
                color: !useRange ? '#fff' : '#FF5A5A' }}
        />
        <Chip
          label="Date range" clickable size="small"
          onClick={() => setUseRange(true)}
          sx={{ fontWeight: 700, fontSize: 12,
                background: useRange ? 'linear-gradient(135deg,#FF5A5A,#FF8B5A)' : 'rgba(255,90,90,0.08)',
                color: useRange ? '#fff' : '#FF5A5A' }}
        />
        <Button size="small" startIcon={<RefreshIcon />} onClick={fetchAll}
          sx={{ fontSize: 11.5, color: '#9CA3AF', '&:hover': { color: '#FF5A5A' } }}>
          Refresh
        </Button>
      </Stack>
      {useRange && (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems="center">
          <DatePicker
            label="From date" value={dateFrom} onChange={setDateFrom}
            slotProps={{ textField: { size: 'small', sx: { minWidth: 160, '& .MuiOutlinedInput-root': { borderRadius: '10px', fontSize: 13 } } } }}
          />
          <DatePicker
            label="To date" value={dateTo} onChange={setDateTo}
            slotProps={{ textField: { size: 'small', sx: { minWidth: 160, '& .MuiOutlinedInput-root': { borderRadius: '10px', fontSize: 13 } } } }}
          />
        </Stack>
      )}
    </Box>
  );

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box className="page-enter" sx={{ maxWidth: 1000, mx: 'auto' }}>
        <Typography variant="h5" sx={{ mb: 0.5, fontWeight: 800 }}>Reports</Typography>
        <Typography sx={{ fontSize: 13, color: '#9CA3AF', mb: 3 }}>
          Financial summaries, client analytics, and export tools.
        </Typography>

        {/* ── summary overview ────────────────────────────────── */}
        {exportErr && (
          <Alert severity="error" sx={{ mb: 2, fontSize: 12 }} onClose={() => setExportErr('')}>
            Export failed: {exportErr}
          </Alert>
        )}
        <ReportCard
          title="Financial Summary"
          description="Portfolio totals and premium breakdown"
          icon={<MonetizationOnOutlinedIcon />}
          expanded={expanded === 'summary'}
          onToggle={() => handleToggle('summary')}
          onDownload={filteredClients.length && !exporting ? exportFullXLS : null}
          downloadLabel={exporting ? 'Generating…' : 'Export XLS'}
          loading={loading}
        >
          <DateRangeFilter />
          <Typography sx={{ fontSize: 12, color: '#9CA3AF', mb: 1.5 }}>
            Based on {filteredClients.length} client{filteredClients.length !== 1 ? 's' : ''}
          </Typography>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} flexWrap="wrap" sx={{ mb: 2.5 }}>
            <SumStat label="Sum Insured"   value={lkr(summary.sumInsured)} gradient="linear-gradient(135deg,#FF5A5A,#FF8B5A)" icon={<TrendingUpIcon />} />
            <SumStat label="Net Premium"   value={lkr(summary.netPrem)}   gradient="linear-gradient(135deg,#FFA95A,#FFD45A)" icon={<MonetizationOnOutlinedIcon />} />
            <SumStat label="Total Invoice" value={lkr(summary.totalInv)} gradient="linear-gradient(135deg,#6366f1,#818cf8)" icon={<BarChartIcon />} />
          </Stack>

          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Box sx={{ p: 2, borderRadius: '12px', bgcolor: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.20)', flex: 1, minWidth: 130 }}>
              <WarningAmberIcon sx={{ color: '#d97706', fontSize: 20, mb: 0.5 }} />
              <Typography sx={{ fontSize: 22, fontWeight: 800, color: '#d97706' }}>{summary.expiring}</Typography>
              <Typography sx={{ fontSize: 12, color: '#6B7280' }}>Expiring in 30 days</Typography>
            </Box>
            <Box sx={{ p: 2, borderRadius: '12px', bgcolor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.20)', flex: 1, minWidth: 130 }}>
              <WarningAmberIcon sx={{ color: '#dc2626', fontSize: 20, mb: 0.5 }} />
              <Typography sx={{ fontSize: 22, fontWeight: 800, color: '#dc2626' }}>{summary.expired}</Typography>
              <Typography sx={{ fontSize: 12, color: '#6B7280' }}>Expired policies</Typography>
            </Box>
            <Box sx={{ p: 2, borderRadius: '12px', bgcolor: 'rgba(255,90,90,0.06)', border: '1px solid rgba(255,90,90,0.15)', flex: 1, minWidth: 130 }}>
              <PeopleOutlineIcon sx={{ color: '#FF5A5A', fontSize: 20, mb: 0.5 }} />
              <Typography sx={{ fontSize: 22, fontWeight: 800, color: '#FF5A5A' }}>{summary.total}</Typography>
              <Typography sx={{ fontSize: 12, color: '#6B7280' }}>Total clients</Typography>
            </Box>
          </Box>
        </ReportCard>

        {/* ── client list ─────────────────────────────────────── */}
        <ReportCard
          title="Client List"
          description="Full client list with policy details"
          icon={<PeopleOutlineIcon />}
          expanded={expanded === 'clients'}
          onToggle={() => handleToggle('clients')}
          onDownload={filteredClients.length && !exporting ? exportClientXLS : null}
          downloadLabel={exporting ? 'Generating…' : 'Export XLS'}
          loading={loading}
        >
          <DateRangeFilter />
          {filteredClients.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography sx={{ color: '#9CA3AF' }}>No clients found for selected range.</Typography>
            </Box>
          ) : (
            <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid rgba(255,139,90,0.10)', borderRadius: '12px', maxHeight: 440 }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Client Name</TableCell>
                    <TableCell>Product</TableCell>
                    <TableCell>Policy No</TableCell>
                    <TableCell>Period From</TableCell>
                    <TableCell>Period To</TableCell>
                    <TableCell align="right">Net Premium</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredClients.map((c, i) => (
                    <TableRow key={c.id} sx={{ bgcolor: i % 2 === 0 ? '#fff' : 'rgba(255,248,245,0.6)' }}>
                      <TableCell sx={{ fontWeight: 600 }}>{c.client_name}</TableCell>
                      <TableCell>{c.product}</TableCell>
                      <TableCell sx={{ fontFamily: 'monospace' }}>{c.policy_no || '—'}</TableCell>
                      <TableCell>{c.policy_period_from || '—'}</TableCell>
                      <TableCell>{c.policy_period_to || '—'}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>
                        {c.net_premium ? `LKR ${Number(c.net_premium).toLocaleString()}` : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </ReportCard>
      </Box>
    </LocalizationProvider>
  );
};

export default ReportsPage;
