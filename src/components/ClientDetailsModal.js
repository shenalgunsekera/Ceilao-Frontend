import React, { useState } from 'react';
import { viewUrl } from '../storage';
import { PRODUCTS } from '../config/products';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import Button from '@mui/material/Button';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Link from '@mui/material/Link';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import CircularProgress from '@mui/material/CircularProgress';

import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import AttachMoneyOutlinedIcon from '@mui/icons-material/AttachMoneyOutlined';
import MonetizationOnOutlinedIcon from '@mui/icons-material/MonetizationOnOutlined';
import PaymentOutlinedIcon from '@mui/icons-material/PaymentOutlined';
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';

const docFields = [
  { label:'Policyholder',     doc:'policyholder_doc_url',     text:'policyholder_text' },
  { label:'Proposal Form',    doc:'proposal_form_doc_url',    text:'proposal_form_text' },
  { label:'Quotation',        doc:'quotation_doc_url',        text:'quotation_text' },
  { label:'CR Copy',          doc:'cr_copy_doc_url',          text:'cr_copy_text' },
  { label:'Schedule',         doc:'schedule_doc_url',         text:'schedule_text' },
  { label:'Invoice / Debit',  doc:'invoice_doc_url',          text:'invoice_text' },
  { label:'Payment Receipt',  doc:'payment_receipt_doc_url',  text:'payment_receipt_text' },
  { label:'NIC / BR',         doc:'nic_br_doc_url',           text:'nic_br_text' },
];

const TABS = [
  { label:'Overview',    icon:<BadgeOutlinedIcon /> },
  { label:'Proposer',    icon:<PersonOutlineIcon /> },
  { label:'Policy',      icon:<CalendarMonthOutlinedIcon /> },
  { label:'Risk',        icon:<ShieldOutlinedIcon /> },
  { label:'Coverage',    icon:<AttachMoneyOutlinedIcon /> },
  { label:'Financials',  icon:<MonetizationOnOutlinedIcon /> },
  { label:'Commission',  icon:<PaymentOutlinedIcon /> },
  { label:'Claims',      icon:<ReportProblemOutlinedIcon /> },
  { label:'Documents',   icon:<FolderOutlinedIcon /> },
];

function Field({ label, value }) {
  if (!value && value !== 0) return null;
  return (
    <Box>
      <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.6, mb: 0.3 }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: 13.5, color: '#1A1A2E', fontWeight: 500, wordBreak: 'break-word' }}>
        {value}
      </Typography>
    </Box>
  );
}

function SubHeader({ title }) {
  return (
    <Grid item xs={12}>
      <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.8, mb: -0.5, mt: 0.5 }}>
        {title}
      </Typography>
      <Divider sx={{ mb: 1, borderColor: 'rgba(255,139,90,0.15)' }} />
    </Grid>
  );
}

function FinancialRow({ label, value }) {
  const fmt = v => v ? `LKR ${Number(v).toLocaleString()}` : '—';
  return (
    <Box sx={{ display:'flex', justifyContent:'space-between', alignItems:'center', py:1, borderBottom:'1px solid rgba(255,139,90,0.08)' }}>
      <Typography sx={{ fontSize:13, color:'#6B7280' }}>{label}</Typography>
      <Typography sx={{ fontSize:13, fontWeight:700, color:'#1A1A2E' }}>{fmt(value)}</Typography>
    </Box>
  );
}

function DocCard({ label, url, description }) {
  return (
    <Box sx={{
      p:1.5, borderRadius:'12px',
      border:`1px solid ${url ? 'rgba(255,139,90,0.25)' : 'rgba(0,0,0,0.06)'}`,
      bgcolor: url ? 'rgba(255,248,245,0.8)' : '#FAFAFA',
      transition:'all 0.2s ease',
      '&:hover': url ? { boxShadow:'0 4px 16px rgba(255,90,90,0.10)', transform:'translateY(-1px)' } : {},
    }}>
      <Box sx={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', mb:0.5 }}>
        <Typography sx={{ fontSize:12, fontWeight:700, color:'#374151' }}>{label}</Typography>
        {url && (
          <Link href={viewUrl(url)} target="_blank" rel="noopener noreferrer"
            sx={{ display:'flex', alignItems:'center', gap:0.3, fontSize:11, fontWeight:700, color:'#FF5A5A', textDecoration:'none',
                  '&:hover':{ textDecoration:'underline' } }}>
            View <OpenInNewIcon sx={{ fontSize:11 }} />
          </Link>
        )}
      </Box>
      <Typography sx={{ fontSize:11, color: url ? '#FF8B5A' : '#C4B5B0', fontWeight: url ? 500 : 400 }}>
        {url ? 'Document uploaded' : 'No document'}
      </Typography>
      {description && (
        <Typography sx={{ fontSize:11, color:'#6B7280', mt:0.5, fontStyle:'italic' }}>{description}</Typography>
      )}
    </Box>
  );
}

function fieldNameToLabel(name) {
  return name
    .replace(/^(cover_|clause_|fi_)/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

// Quotation form field names that differ from UW form field names
const UW_FIELD_ALIASES = {
  vehicle_no: 'vehicle_number',
  make: 'vehicle_make',
  model: 'vehicle_model',
};

const ClientDetailsModal = ({ client, onClose }) => {
  const [tab,       setTab]       = useState(0);
  const [exporting, setExporting] = useState(false);
  if (!client) return null;

  const coverItems  = Object.entries(client).filter(([k, v]) => k.startsWith('cover_')  && v && v !== 'No');
  const clauseItems = Object.entries(client).filter(([k, v]) => k.startsWith('clause_') && v && v !== 'No');
  const fiItems     = Object.entries(client).filter(([k, v]) => k.startsWith('fi_')     && v && v !== 'No');

  // Parse insurer cover/clause responses stored as JSON strings
  const coverResponses  = (() => { try { return JSON.parse(client.cover_responses  || '{}'); } catch { return {}; } })();
  const clauseResponses = (() => { try { return JSON.parse(client.clause_responses || '{}'); } catch { return {}; } })();

  // Dynamic product field lookup — resolves all product-specific fields for this client's product
  const productKey    = Object.entries(PRODUCTS).find(([, v]) => v.label === client.product)?.[0];
  const productFields = productKey ? (PRODUCTS[productKey].fields || []) : [];

  const riskInfoFields  = productFields.filter(f => f.section === 'Risk Information');
  const claimsHistFields = productFields.filter(f => f.section === 'Claims History');
  const uwInfoFields    = productFields.filter(f => f.section === 'Underwriting Information');
  const sumSubFields    = productFields.filter(f => f.section === 'Sum Insured' && f.name !== 'sum_insured' && f.type !== 'file');
  const prodDocFields   = productFields.filter(f => f.section === 'Document Uploads' && f.type === 'file');
  const extraDocCards   = prodDocFields.filter(df =>
    client[df.name] && typeof client[df.name] === 'string' && client[df.name].startsWith('http')
  );

  // Gets display value for a product config field from the client object,
  // using UW form name aliases where quotation and UW form use different names.
  const getFieldValue = (field) => {
    const alias = UW_FIELD_ALIASES[field.name];
    const raw = (alias && client[alias] != null && client[alias] !== '') ? client[alias] : client[field.name];
    if (raw === null || raw === undefined || raw === '' || raw === false) return null;
    if (Array.isArray(raw)) return raw.filter(Boolean).join(', ');
    return String(raw);
  };

  const generatePdf = async () => {
    setExporting(true);
    try {
      const { default: jsPDF }     = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');
      const pdf   = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' });
      const pw    = pdf.internal.pageSize.getWidth();
      const ph    = pdf.internal.pageSize.getHeight();
      const today = new Date().toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' });
      const fmtLKR = v => v ? `LKR ${Number(v).toLocaleString()}` : '—';

      const PDF_TABS = [
        { key:'overview',   label:'Overview'   },
        { key:'proposer',   label:'Proposer'   },
        { key:'policy',     label:'Policy'     },
        { key:'risk',       label:'Risk'       },
        { key:'coverage',   label:'Coverage'   },
        { key:'financials', label:'Financials' },
        { key:'commission', label:'Commission' },
        { key:'claims',     label:'Claims'     },
        { key:'documents',  label:'Documents'  },
      ];
      const TAB_H = 8;
      const sectionPages = {};
      const pageToSection = {};
      let currentSection = 'overview';

      const startSec = key => {
        currentSection = key;
        const p = pdf.internal.getCurrentPageInfo().pageNumber;
        if (!sectionPages[key]) sectionPages[key] = p;
        if (!pageToSection[p])  pageToSection[p]  = key;
      };

      const drawHeader = () => {
        pdf.setFillColor(26,26,46);  pdf.rect(0,0,pw,20,'F');
        pdf.setFillColor(232,71,42); pdf.rect(0,20,pw,2.5,'F');
        pdf.setFontSize(11); pdf.setFont('helvetica','bold'); pdf.setTextColor(255,139,90);
        pdf.text('CEILAO INSURANCE BROKERS (PVT) LTD', pw/2, 9, {align:'center'});
        pdf.setFontSize(7.5); pdf.setFont('helvetica','normal'); pdf.setTextColor(148,163,184);
        pdf.text('INSURANCE BROKING & RISK MANAGEMENT  ·  SRI LANKA', pw/2, 15.5, {align:'center'});
      };

      const drawFooter = () => {
        const pn = pdf.internal.getCurrentPageInfo().pageNumber;
        const tp = pdf.internal.getNumberOfPages();
        pdf.setFillColor(26,26,46);  pdf.rect(0, ph-14, pw, 14, 'F');
        pdf.setFillColor(232,71,42); pdf.rect(0, ph-14, pw, 1,  'F');
        pdf.setFont('helvetica','bold'); pdf.setFontSize(7.5); pdf.setTextColor(255,139,90);
        pdf.text('Ceilao Insurance Brokers (Pvt) Ltd', 12, ph-8);
        pdf.setFont('helvetica','normal'); pdf.setFontSize(7); pdf.setTextColor(107,114,128);
        pdf.text(`Page ${pn} / ${tp}`, pw-12, ph-8, {align:'right'});
        pdf.setFont('helvetica','italic'); pdf.setFontSize(6.5); pdf.setTextColor(100,116,139);
        pdf.text(`Generated: ${today}  ·  CONFIDENTIAL`, pw/2, ph-3.5, {align:'center'});
      };

      drawHeader();
      pdf.setFillColor(249,250,251); pdf.rect(0, 22.5+TAB_H, pw, 13, 'F');
      pdf.setFontSize(10); pdf.setFont('helvetica','bold'); pdf.setTextColor(26,26,46);
      pdf.text('UNDERWRITING RECORD', 14, 30.5+TAB_H);
      pdf.setFontSize(7.5); pdf.setFont('helvetica','normal'); pdf.setTextColor(107,114,128);
      const fileRef = [client.ceilao_ib_file_no && `File: ${client.ceilao_ib_file_no}`, client.policy_no && `Policy: ${client.policy_no}`].filter(Boolean).join('   ·   ');
      if (fileRef) pdf.text(fileRef, pw-14, 30.5+TAB_H, {align:'right'});

      pdf.setFillColor(232,71,42); pdf.rect(0, 35.5+TAB_H, pw, 15, 'F');
      pdf.setFontSize(13); pdf.setFont('helvetica','bold'); pdf.setTextColor(255,255,255);
      pdf.text(client.client_name || '—', 14, 44.5+TAB_H);
      const tags = [client.main_class, client.product, client.customer_type].filter(Boolean);
      let tx = pw - 14;
      [...tags].reverse().forEach(t => {
        const tw = pdf.getTextWidth(t) + 10;
        tx -= tw;
        pdf.setFillColor(200,50,30);
        pdf.roundedRect(tx, 38.5+TAB_H, tw, 8, 2, 2, 'F');
        pdf.setFontSize(7); pdf.setFont('helvetica','bold'); pdf.setTextColor(255,255,255);
        pdf.text(t, tx+tw/2, 43.5+TAB_H, {align:'center'});
        tx -= 3;
      });

      let y = 55 + TAB_H;
      const tableOpts = (startY) => ({
        startY,
        columnStyles: { 0:{cellWidth:58, fontStyle:'bold', fillColor:[255,248,245], textColor:[55,65,81]}, 1:{textColor:[26,26,46]} },
        styles: { fontSize:9, cellPadding:{top:3,bottom:3,left:6,right:6}, lineColor:[255,220,200], lineWidth:0.1 },
        bodyStyles: { fillColor:[255,255,255] },
        alternateRowStyles: { fillColor:[255,252,250] },
        margin: { left:10, right:10, top:26+TAB_H, bottom:16 },
        didDrawPage: d => { if (d.pageNumber > 1) { drawHeader(); if (!pageToSection[d.pageNumber]) pageToSection[d.pageNumber] = currentSection; } },
      });

      const addSection = (sectionKey, title, rows) => {
        const filtered = rows.filter(r => r[1] && r[1] !== '—');
        if (!filtered.length) return;
        startSec(sectionKey);
        autoTable(pdf, {
          ...tableOpts(y),
          head: [[{ content:title, colSpan:2, styles:{fillColor:[26,26,46],textColor:[255,139,90],fontStyle:'bold',fontSize:8.5,cellPadding:{top:3.5,bottom:3.5,left:6,right:6}} }]],
          body: filtered,
        });
        y = pdf.lastAutoTable.finalY + 5;
      };

      addSection('overview', 'INTRODUCER', [
        ['Ceilao IB File No.', client.ceilao_ib_file_no],
        ['Manager',            client.manager],
        ['Introducer Code',    client.introducer_code],
      ]);
      addSection('overview', 'INSURANCE COMPANY', [
        ['Main Class',         client.main_class],
        ['Product',            client.product],
        ['Customer Type',      client.customer_type],
        ['Insurance Provider', client.insurance_provider],
        ['Branch',             client.branch],
      ]);

      addSection('proposer', 'PROPOSER DETAILS', [
        ['Client Name',           client.client_name],
        ['NIC / Passport No.',    client.nic_proof],
        ['Business Registration', client.business_registration],
        ['SVAT / VAT No.',        client.svat_proof],
        ['Street 1',              client.street1],
        ['Street 2',              client.street2],
        ['City',                  client.city],
        ['District',              client.district],
        ['Province',              client.province],
        ['Postal Code',           client.postal_code],
        ['Telephone',             client.telephone],
        ['Mobile No',             client.mobile_no],
        ['Email',                 client.email],
        ['Contact Person',        client.contact_person],
        ['Social Media',          client.social_media],
      ]);

      addSection('policy', 'PERIOD OF INSURANCE', [
        ['Policy No',             client.policy_no],
        ['Policy Type',           client.policy_type],
        ['Coverage',              client.coverage],
        ['Policy Period From',    client.policy_period_from],
        ['Policy Period To',      client.policy_period_to],
        ['Policy Days',           client.policy_days],
        ['O/S Days',              client.os_days],
        ['Credit Period',         client.credit_period],
        ['Quote Validity (days)', client.validity_days],
      ]);

      // Dynamic risk sections using PRODUCTS config
      const getRiskVal = (field) => {
        const alias = UW_FIELD_ALIASES[field.name];
        const raw = (alias && client[alias] != null && client[alias] !== '') ? client[alias] : client[field.name];
        if (!raw && raw !== 0) return null;
        if (Array.isArray(raw)) return raw.filter(Boolean).join(', ');
        return String(raw);
      };

      if (fiItems.length) addSection('risk', 'FINANCIAL INTEREST', fiItems.map(([k,v]) => [fieldNameToLabel(k), String(v)]));

      const pdfRiskRows = productFields.filter(f => f.section === 'Risk Information').map(f => [f.label, getRiskVal(f)]).filter(r => r[1]);
      if (pdfRiskRows.length) addSection('risk', 'RISK INFORMATION', pdfRiskRows);

      const pdfClaimsRows = productFields.filter(f => f.section === 'Claims History').map(f => [f.label, getRiskVal(f)]).filter(r => r[1]);
      if (pdfClaimsRows.length) addSection('risk', 'CLAIMS HISTORY', pdfClaimsRows);

      const pdfUwRows = productFields.filter(f => f.section === 'Underwriting Information').map(f => [f.label, getRiskVal(f)]).filter(r => r[1]);
      if (pdfUwRows.length) addSection('risk', 'UNDERWRITING INFORMATION', pdfUwRows);

      // Sum Insured breakdown then total
      const pdfSumSubRows = productFields.filter(f => f.section === 'Sum Insured' && f.name !== 'sum_insured' && f.type !== 'file').map(f => [f.label, getRiskVal(f) ? fmtLKR(getRiskVal(f)) : null]).filter(r => r[1] && r[1] !== '—');
      if (pdfSumSubRows.length) addSection('coverage', 'SUM INSURED BREAKDOWN', pdfSumSubRows);
      addSection('coverage', 'SUM INSURED', [['Sum Insured (Total)', fmtLKR(client.sum_insured)]]);
      if (coverItems.length)  addSection('coverage', 'COVERS REQUIRED',   coverItems.map(([k,v]) => [fieldNameToLabel(k), String(v)]));
      if (clauseItems.length) addSection('coverage', 'ADDITIONAL CLAUSES', clauseItems.map(([k,v]) => [fieldNameToLabel(k), String(v)]));

      startSec('financials');
      const finRows = [
        ['Basic Premium',    fmtLKR(client.basic_premium)],
        ['SRCC Premium',    fmtLKR(client.srcc_premium)],
        ['Terrorism Cover (TC)', fmtLKR(client.tc_premium)],
        ['Cess',                 fmtLKR(client.cess)],
        ['NBL',             fmtLKR(client.nbl)],
        ['SSC Levy',        fmtLKR(client.ssc_levy)],
        ['Other Premium',   fmtLKR(client.other_premium)],
        ['Net Premium',     fmtLKR(client.net_premium)],
        ['Stamp Duty',      fmtLKR(client.stamp_duty)],
        ['Admin Fees',      fmtLKR(client.admin_fees)],
        ['Road Safety Fee', fmtLKR(client.road_safety_fee)],
        ['Policy Fee',      fmtLKR(client.policy_fee)],
        ['VAT',             fmtLKR(client.vat_fee)],
      ].filter(r => r[1] !== '—');

      if (finRows.length || client.total_invoice) {
        autoTable(pdf, {
          ...tableOpts(y),
          head: [[{ content:'PREMIUM', colSpan:2, styles:{fillColor:[26,26,46],textColor:[255,139,90],fontStyle:'bold',fontSize:8.5,cellPadding:{top:3.5,bottom:3.5,left:6,right:6}} }]],
          body: [...finRows, [
            { content:'TOTAL INVOICE', styles:{fontStyle:'bold',fontSize:10.5,fillColor:[232,71,42],textColor:[255,255,255],cellPadding:{top:5,bottom:5,left:6,right:6}} },
            { content: fmtLKR(client.total_invoice), styles:{fontStyle:'bold',fontSize:10.5,fillColor:[232,71,42],textColor:[255,255,255],halign:'right',cellPadding:{top:5,bottom:5,left:6,right:6}} },
          ]],
          columnStyles: { 0:{cellWidth:65,fontStyle:'bold',fillColor:[255,248,245],textColor:[55,65,81]}, 1:{halign:'right',textColor:[26,26,46]} },
          styles: { fontSize:9, cellPadding:{top:3,bottom:3,left:6,right:6}, lineColor:[255,220,200], lineWidth:0.1 },
          bodyStyles: { fillColor:[255,255,255] },
          alternateRowStyles: { fillColor:[255,252,250] },
          margin: { left:10, right:10, top:26, bottom:16 },
          didDrawPage: d => { if (d.pageNumber > 1) drawHeader(); },
        });
        y = pdf.lastAutoTable.finalY + 5;
      }

      addSection('financials', 'DEDUCTIBLES', [
        ['Deductible', client.deductible],
        ['Excesses',   client.excesses],
      ]);

      addSection('commission', 'COMMISSION', [
        ['Commission Type',         client.commission_type],
        ['Commission %',            client.commission_pct],
        ['Commission Basic',        client.commission_basic ? fmtLKR(client.commission_basic) : null],
        ['Commission SRCC',         client.commission_srcc  ? fmtLKR(client.commission_srcc)  : null],
        ['Commission TC',           client.commission_tc    ? fmtLKR(client.commission_tc)    : null],
        ['Total Commission',        client.commission_total ? fmtLKR(client.commission_total) : null],
        ['Commission Method',       client.commission_paid_method],
        ['Commission Receive Date', client.commission_receive_date],
        ['Commission Amount Paid',  client.commission_amount_paid ? fmtLKR(client.commission_amount_paid) : null],
        ['Commission VAT',          client.commission_vat ? fmtLKR(client.commission_vat) : null],
      ]);
      addSection('commission', 'PAYMENT', [
        ['Payment Status',  client.payment_status],
        ['Amount Received', client.amount_received ? fmtLKR(client.amount_received) : null],
        ['Payment Date',    client.payment_date],
        ['Payment Method',  client.payment_method],
        ['Cheque / Slip No.', client.cheque_slip_no],
        ['Receipt No.',     client.receipt_no],
      ]);

      addSection('claims', 'CLAIMS', [
        ['Claim Paid?',             client.claim_paid],
        ['Date of Claim',           client.claim_date],
        ['Claim Amount',            client.claim_amount ? fmtLKR(client.claim_amount) : null],
        ['Settled Amount',          client.claim_settled ? fmtLKR(client.claim_settled) : null],
        ['Repudiation Reasons',     client.repudiation_reasons],
        ['Partial Payment Reasons', client.partial_payment_reasons],
      ]);

      // Documents — product-specific docs first, then standard UW docs
      const allPdfDocs = [
        ...extraDocCards.map(df => ({ label: df.label, doc: df.name, text: null })),
        ...docFields.filter(df => client[df.doc]),
      ];
      if (allPdfDocs.length > 0) {
        pdf.addPage(); drawHeader(); startSec('documents');
        const margL = 10, gap = 8, cols = 2;
        const colW = (pw - margL*2 - gap*(cols-1)) / cols;
        const imgMaxH = 110, labelH = 14, cellH = labelH + imgMaxH + 8;
        let docY = 22.5 + TAB_H + 6, docCol = 0;

        const addDocPageHdr = (title) => {
          pdf.setFillColor(26,26,46); pdf.rect(margL, docY, pw-margL*2, 9, 'F');
          pdf.setFontSize(8.5); pdf.setFont('helvetica','bold'); pdf.setTextColor(255,139,90);
          pdf.text(title, pw/2, docY+6, {align:'center'});
          docY += 13;
        };
        addDocPageHdr('UPLOADED DOCUMENTS');

        for (const df of allPdfDocs) {
          if (docY + cellH > ph - 18) { pdf.addPage(); drawHeader(); docY = 28; docCol = 0; addDocPageHdr('UPLOADED DOCUMENTS (cont.)'); }
          const cx = margL + docCol*(colW+gap);
          pdf.setFontSize(8.5); pdf.setFont('helvetica','bold'); pdf.setTextColor(26,26,46);
          pdf.text(df.label, cx, docY+5);
          const note = df.text ? client[df.text] : null;
          if (note) { pdf.setFontSize(7); pdf.setFont('helvetica','normal'); pdf.setTextColor(107,114,128); pdf.text(note, cx, docY+10, {maxWidth:colW}); }
          const imgY = docY + labelH;
          const url  = client[df.doc];
          const isPdf = /\.pdf(\?|$)/i.test(url);
          const isImg = !isPdf && /\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(url);
          pdf.setFillColor(245,247,250); pdf.rect(cx, imgY, colW, imgMaxH, 'F');
          pdf.setDrawColor(210,215,225); pdf.setLineWidth(0.3); pdf.rect(cx, imgY, colW, imgMaxH, 'S');
          if (isImg) {
            try {
              const res = await fetch(url); if (!res.ok) throw new Error('fetch');
              const blob = await res.blob();
              const b64 = await new Promise((res2, rej) => { const r = new FileReader(); r.onload = () => res2(r.result); r.onerror = rej; r.readAsDataURL(blob); });
              if (!b64.startsWith('data:image/')) throw new Error('not image');
              const dims = await new Promise(res2 => { const img = new window.Image(); img.onload = () => res2({w:img.naturalWidth,h:img.naturalHeight}); img.onerror = () => res2({w:4,h:3}); img.src = b64; });
              const aspect = dims.w/dims.h;
              const bW = colW-6, bH = imgMaxH-6; let dw=bW, dh=dw/aspect; if(dh>bH){dh=bH;dw=dh*aspect;}
              const fmt = /\.png(\?|$)/i.test(url) ? 'PNG' : 'JPEG';
              pdf.addImage(b64, fmt, cx+(colW-dw)/2, imgY+(imgMaxH-dh)/2, dw, dh, undefined, 'FAST');
            } catch {
              pdf.setFontSize(8); pdf.setFont('helvetica','bold'); pdf.setTextColor(107,114,128);
              pdf.text('Image unavailable', cx+colW/2, imgY+imgMaxH/2-4, {align:'center'});
              pdf.setFontSize(7); pdf.setFont('helvetica','normal'); pdf.text('Click below to view online', cx+colW/2, imgY+imgMaxH/2+4, {align:'center'});
              pdf.setTextColor(99,102,241); pdf.textWithLink('Open document ↗', cx+colW/2, imgY+imgMaxH/2+12, {align:'center', url});
            }
          } else {
            const midY = imgY + imgMaxH/2;
            pdf.setFillColor(238,242,255); pdf.roundedRect(cx+colW/2-18, midY-24, 36, 16, 3, 3, 'F');
            pdf.setFontSize(10); pdf.setFont('helvetica','bold'); pdf.setTextColor(99,102,241); pdf.text('PDF', cx+colW/2, midY-13, {align:'center'});
            pdf.setFontSize(8); pdf.setFont('helvetica','bold'); pdf.setTextColor(55,65,81); pdf.text(df.label, cx+colW/2, midY-2, {align:'center'});
            pdf.setFontSize(7); pdf.setFont('helvetica','normal'); pdf.setTextColor(107,114,128); pdf.text('Click to open document', cx+colW/2, midY+8, {align:'center'});
            pdf.setFontSize(8); pdf.setFont('helvetica','bold'); pdf.setTextColor(99,102,241); pdf.textWithLink('Open ↗', cx+colW/2, midY+18, {align:'center', url});
            pdf.link(cx+colW/2-15, midY+13, 30, 7, {url});
          }
          docCol++;
          if (docCol >= cols) { docCol = 0; docY += cellH; }
        }
      }

      const total = pdf.internal.getNumberOfPages();
      const tabW  = pw / PDF_TABS.length;
      for (let i = 1; i <= total; i++) {
        pdf.setPage(i);
        const active = pageToSection[i] || 'overview';
        pdf.setFillColor(22,26,48); pdf.rect(0, 22.5, pw, TAB_H, 'F');
        PDF_TABS.forEach((t, idx) => {
          const tabX = idx * tabW, isAct = t.key === active;
          if (isAct) { pdf.setFillColor(232,71,42); pdf.rect(tabX, 22.5+TAB_H-1.5, tabW, 1.5, 'F'); }
          pdf.setFontSize(5.5); pdf.setFont('helvetica', isAct ? 'bold' : 'normal');
          const [r,g,b] = isAct ? [255,255,255] : [148,163,184];
          pdf.setTextColor(r,g,b);
          pdf.text(t.label, tabX+tabW/2, 22.5+TAB_H/2+1.5, {align:'center'});
          if (sectionPages[t.key] && sectionPages[t.key] !== i) pdf.link(tabX, 22.5, tabW, TAB_H, {pageNumber:sectionPages[t.key]});
        });
        drawFooter();
      }

      const safeName = (client.client_name || 'Client').replace(/\s+/g,'_').replace(/[^\w-]/g,'');
      const safeRef  = (client.policy_no || client.ceilao_ib_file_no || 'Record').replace(/[^\w-]/g,'');
      pdf.save(`CeilaoIB_${safeName}_${safeRef}.pdf`);
    } catch (err) {
      console.error('PDF export error:', err);
    }
    setExporting(false);
  };

  const fmtLKR = v => v ? `LKR ${Number(v).toLocaleString()}` : null;

  const renderTab = () => {
    switch (tab) {
      case 0: /* Overview — Introducer + Insurance Company */
        return (
          <Grid container spacing={2.5}>
            <SubHeader title="Introducer" />
            <Grid item xs={12} sm={6} md={4}><Field label="Ceilao IB File No." value={client.ceilao_ib_file_no} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Manager"            value={client.manager} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Introducer Code"    value={client.introducer_code} /></Grid>
            <SubHeader title="Insurance Company" />
            <Grid item xs={12} sm={6} md={4}><Field label="Main Class"         value={client.main_class} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Product"            value={client.product} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Customer Type"      value={client.customer_type} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Insurance Provider" value={client.insurance_provider} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Branch"             value={client.branch} /></Grid>
          </Grid>
        );
      case 1: /* Proposer Details */
        return (
          <Grid container spacing={2.5}>
            <Grid item xs={12} sm={6} md={4}><Field label="Client Name"           value={client.client_name} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="NIC / Passport No."    value={client.nic_proof} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Business Registration" value={client.business_registration} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="SVAT / VAT No."        value={client.svat_proof} /></Grid>
            <Grid item xs={12} sm={6}       ><Field label="Street 1"              value={client.street1} /></Grid>
            <Grid item xs={12} sm={6}       ><Field label="Street 2"              value={client.street2} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="City"                  value={client.city} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="District"              value={client.district} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Province"              value={client.province} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Postal Code"           value={client.postal_code} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Telephone"             value={client.telephone} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Mobile No"             value={client.mobile_no} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Email"                 value={client.email} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Contact Person"        value={client.contact_person} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Social Media"          value={client.social_media} /></Grid>
          </Grid>
        );
      case 2: /* Period of Insurance */
        return (
          <Grid container spacing={2.5}>
            <Grid item xs={12} sm={6} md={4}><Field label="Policy No"             value={client.policy_no} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Policy Type"           value={client.policy_type} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Coverage"              value={client.coverage} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Policy Period From"    value={client.policy_period_from} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Policy Period To"      value={client.policy_period_to} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Policy Days"           value={client.policy_days} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="O/S Days"              value={client.os_days} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Credit Period"         value={client.credit_period} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Quote Validity (days)" value={client.validity_days} /></Grid>
          </Grid>
        );
      case 3: /* Risk — Financial Interest + Product Risk Fields + Claims History + Underwriting Info */
        return (
          <Grid container spacing={2.5}>
            {fiItems.length > 0 && (
              <>
                <SubHeader title="Financial Interest" />
                {fiItems.map(([k, v]) => (
                  <Grid item xs={12} sm={6} md={4} key={k}><Field label={fieldNameToLabel(k)} value={String(v)} /></Grid>
                ))}
              </>
            )}
            {riskInfoFields.length > 0 && riskInfoFields.some(f => getFieldValue(f)) && (
              <>
                <SubHeader title="Risk Information" />
                {riskInfoFields.map(f => {
                  const v = getFieldValue(f);
                  return v ? <Grid item xs={12} sm={6} md={4} key={f.name}><Field label={f.label} value={v} /></Grid> : null;
                })}
              </>
            )}
            {claimsHistFields.length > 0 && claimsHistFields.some(f => getFieldValue(f)) && (
              <>
                <SubHeader title="Claims History" />
                {claimsHistFields.map(f => {
                  const v = getFieldValue(f);
                  return v ? <Grid item xs={12} sm={6} md={4} key={f.name}><Field label={f.label} value={v} /></Grid> : null;
                })}
              </>
            )}
            {uwInfoFields.length > 0 && uwInfoFields.some(f => getFieldValue(f)) && (
              <>
                <SubHeader title="Underwriting Information" />
                {uwInfoFields.map(f => {
                  const v = getFieldValue(f);
                  return v ? <Grid item xs={12} sm={6} md={4} key={f.name}><Field label={f.label} value={v} /></Grid> : null;
                })}
              </>
            )}
            {!fiItems.length && !riskInfoFields.some(f => getFieldValue(f)) && !claimsHistFields.some(f => getFieldValue(f)) && !uwInfoFields.some(f => getFieldValue(f)) && (
              <Grid item xs={12}>
                <Typography sx={{ color: '#9CA3AF', fontSize: 13 }}>No risk information recorded.</Typography>
              </Grid>
            )}
          </Grid>
        );
      case 4: /* Coverage — Sum Insured + Covers + Clauses */
        return (
          <Grid container spacing={2.5}>
            <SubHeader title="Sum Insured" />
            {sumSubFields.map(f => {
              const v = getFieldValue(f);
              return v ? (
                <Grid item xs={12} sm={6} md={4} key={f.name}>
                  <Field label={f.label} value={`LKR ${Number(v).toLocaleString()}`} />
                </Grid>
              ) : null;
            })}
            <Grid item xs={12} sm={6} md={4}>
              <Box>
                <Typography sx={{ fontSize:10.5, fontWeight:700, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:0.6, mb:0.3 }}>
                  {sumSubFields.length > 0 ? 'Total Sum Insured' : 'Sum Insured'}
                </Typography>
                <Typography sx={{ fontSize:20, fontWeight:800, color:'#059669' }}>
                  {client.sum_insured ? `LKR ${Number(client.sum_insured).toLocaleString()}` : '—'}
                </Typography>
              </Box>
            </Grid>
            {coverItems.length > 0 && (
              <>
                <SubHeader title="Covers Required" />
                {coverItems.map(([k, v]) => {
                  const ir = coverResponses[k] || {};
                  const irColor = ir.status === 'Accepted' ? '#10B981' : ir.status === 'Declined' ? '#EF4444' : '#F59E0B';
                  return (
                    <Grid item xs={12} sm={6} md={4} key={k}>
                      <Field label={fieldNameToLabel(k)} value={String(v)} />
                      {ir.status && (
                        <Box sx={{ mt:0.5, px:1, py:0.3, borderRadius:'6px', bgcolor:`${irColor}14`, display:'inline-flex', alignItems:'center', gap:0.5, flexWrap:'wrap' }}>
                          <Typography sx={{ fontSize:10.5, fontWeight:700, color:irColor }}>{ir.status}</Typography>
                          {ir.premium ? <Typography sx={{ fontSize:10.5, color:irColor }}>· +LKR {ir.premium}</Typography> : null}
                          {ir.notes   ? <Typography sx={{ fontSize:10.5, color:'#6B7280' }}>· {ir.notes}</Typography> : null}
                        </Box>
                      )}
                    </Grid>
                  );
                })}
              </>
            )}
            {clauseItems.length > 0 && (
              <>
                <SubHeader title="Additional Clauses" />
                {clauseItems.map(([k, v]) => {
                  const ir = clauseResponses[k] || {};
                  const included = ir.status === 'Included';
                  const declined = ir.status === 'Not Included' || ir.status === 'Declined';
                  const irColor = included ? '#10B981' : declined ? '#EF4444' : null;
                  return (
                    <Grid item xs={12} sm={6} md={4} key={k}>
                      <Field label={fieldNameToLabel(k)} value={String(v)} />
                      {ir.status && (
                        <Box sx={{ mt:0.5, px:1, py:0.3, borderRadius:'6px', bgcolor:`${irColor || '#F59E0B'}14`, display:'inline-flex', alignItems:'center', gap:0.5 }}>
                          <Typography sx={{ fontSize:10.5, fontWeight:700, color:irColor || '#F59E0B' }}>{ir.status}</Typography>
                          {ir.notes ? <Typography sx={{ fontSize:10.5, color:'#6B7280' }}>· {ir.notes}</Typography> : null}
                        </Box>
                      )}
                    </Grid>
                  );
                })}
              </>
            )}
          </Grid>
        );
      case 5: /* Financials — Premium + Deductibles */
        return (
          <Box>
            <Box sx={{ display:'grid', gridTemplateColumns:{xs:'1fr',sm:'1fr 1fr'}, gap:3, mb:2 }}>
              <Box>
                <Typography sx={{ fontSize:12, fontWeight:700, color:'#9CA3AF', mb:1, letterSpacing:0.6, textTransform:'uppercase' }}>Premiums</Typography>
                <FinancialRow label="Basic Premium"   value={client.basic_premium} />
                <FinancialRow label="SRCC Premium"   value={client.srcc_premium} />
                <FinancialRow label="Terrorism Cover (TC)" value={client.tc_premium} />
                <FinancialRow label="Cess"               value={client.cess} />
                <FinancialRow label="NBL"            value={client.nbl} />
                <FinancialRow label="SSC Levy"       value={client.ssc_levy} />
                <FinancialRow label="Other Premium"  value={client.other_premium} />
                <FinancialRow label="Net Premium"    value={client.net_premium} />
              </Box>
              <Box>
                <Typography sx={{ fontSize:12, fontWeight:700, color:'#9CA3AF', mb:1, letterSpacing:0.6, textTransform:'uppercase' }}>Fees & Taxes</Typography>
                <FinancialRow label="Stamp Duty"      value={client.stamp_duty} />
                <FinancialRow label="Admin Fees"      value={client.admin_fees} />
                <FinancialRow label="Road Safety Fee" value={client.road_safety_fee} />
                <FinancialRow label="Policy Fee"      value={client.policy_fee} />
                <FinancialRow label="VAT"             value={client.vat_fee} />
              </Box>
            </Box>
            <Box sx={{ p:2, borderRadius:'12px', background:'linear-gradient(135deg,rgba(255,90,90,0.08),rgba(255,139,90,0.06))', border:'1px solid rgba(255,90,90,0.15)', mb:2 }}>
              <Typography sx={{ fontSize:12, color:'#9CA3AF', mb:0.5 }}>Total Invoice</Typography>
              <Typography sx={{ fontSize:24, fontWeight:800, color:'#FF5A5A' }}>
                LKR {Number(client.total_invoice || 0).toLocaleString()}
              </Typography>
            </Box>
            {(client.deductible || client.excesses) && (
              <Box>
                <Typography sx={{ fontSize:12, fontWeight:700, color:'#9CA3AF', mb:1, letterSpacing:0.6, textTransform:'uppercase' }}>Deductibles</Typography>
                <Stack direction="row" spacing={3} flexWrap="wrap">
                  <Field label="Deductible" value={client.deductible} />
                  <Field label="Excesses"   value={client.excesses} />
                </Stack>
              </Box>
            )}
          </Box>
        );
      case 6: /* Commission + Payment */
        return (
          <Grid container spacing={2.5}>
            <SubHeader title="Commission" />
            <Grid item xs={12} sm={6} md={4}><Field label="Commission Type"         value={client.commission_type} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Commission %"            value={client.commission_pct} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Commission Basic"        value={fmtLKR(client.commission_basic)} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Commission SRCC"         value={fmtLKR(client.commission_srcc)} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Commission TC"           value={fmtLKR(client.commission_tc)} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Total Commission"        value={fmtLKR(client.commission_total)} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Commission Method"       value={client.commission_paid_method} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Receive Date"            value={client.commission_receive_date} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Commission Amount Paid"  value={fmtLKR(client.commission_amount_paid)} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Commission VAT"          value={fmtLKR(client.commission_vat)} /></Grid>
            <SubHeader title="Payment" />
            <Grid item xs={12} sm={6} md={4}><Field label="Payment Status"    value={client.payment_status} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Amount Received"   value={fmtLKR(client.amount_received)} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Payment Date"      value={client.payment_date} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Payment Method"    value={client.payment_method} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Cheque / Slip No." value={client.cheque_slip_no} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Receipt No."       value={client.receipt_no} /></Grid>
          </Grid>
        );
      case 7: /* Claims */
        return (
          <Grid container spacing={2.5}>
            <Grid item xs={12} sm={6} md={4}><Field label="Claim Paid?"              value={client.claim_paid} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Date of Claim"            value={client.claim_date} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Claim Amount"             value={fmtLKR(client.claim_amount)} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Settled Amount"           value={fmtLKR(client.claim_settled)} /></Grid>
            <Grid item xs={12}             ><Field label="Repudiation Reasons"       value={client.repudiation_reasons} /></Grid>
            <Grid item xs={12}             ><Field label="Partial Payment Reasons"   value={client.partial_payment_reasons} /></Grid>
          </Grid>
        );
      case 8: /* Documents — quotation-form docs + standard UW docs */
        return (
          <Grid container spacing={1.5}>
            {extraDocCards.length > 0 && (
              <>
                <SubHeader title="Quotation Form Documents" />
                {extraDocCards.map(df => (
                  <Grid item xs={12} sm={6} key={df.name}>
                    <DocCard label={df.label} url={client[df.name]} />
                  </Grid>
                ))}
              </>
            )}
            <SubHeader title="Underwriting Documents" />
            {docFields.map(df => (
              <Grid item xs={12} sm={6} key={df.doc}>
                <DocCard label={df.label} url={client[df.doc]} description={client[df.text]} />
              </Grid>
            ))}
          </Grid>
        );
      default: return null;
    }
  };

  return (
    <Dialog open={!!client} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: { maxHeight: '90vh' } }}>
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display:'flex', alignItems:'center', gap:1.5 }}>
          <Box sx={{ flex:1 }}>
            <Typography sx={{ fontWeight:800, fontSize:17, color:'#fff' }}>{client.client_name}</Typography>
            <Box sx={{ display:'flex', gap:1, mt:0.5, flexWrap:'wrap' }}>
              {client.customer_type && (
                <Chip label={client.customer_type} size="small"
                  sx={{ fontSize:10, fontWeight:700, bgcolor:'rgba(255,255,255,0.20)', color:'#fff', height:20 }} />
              )}
              {client.product && (
                <Chip label={client.product} size="small"
                  sx={{ fontSize:10, fontWeight:700, bgcolor:'rgba(255,255,255,0.20)', color:'#fff', height:20 }} />
              )}
            </Box>
          </Box>
        </Box>
      </DialogTitle>

      <Box sx={{ bgcolor:'rgba(255,248,245,0.5)', borderBottom:'1px solid rgba(255,139,90,0.12)' }}>
        <Tabs
          value={tab} onChange={(_, v) => setTab(v)}
          variant="scrollable" scrollButtons="auto"
          sx={{
            minHeight:42,
            '& .MuiTab-root': { fontSize:11.5, fontWeight:600, minHeight:42, py:0, textTransform:'none', color:'#9CA3AF', minWidth:'unset', px:1.5 },
            '& .Mui-selected': { color:'#FF5A5A' },
            '& .MuiTabs-indicator': { background:'linear-gradient(90deg,#FF5A5A,#FF8B5A)', height:2.5 },
          }}
        >
          {TABS.map((t, i) => (
            <Tab key={i} label={t.label} icon={t.icon} iconPosition="start"
              sx={{ '& .MuiTab-iconWrapper': { fontSize:16, mr:0.5 } }} />
          ))}
        </Tabs>
      </Box>

      <DialogContent sx={{ p:3, overflowY:'auto' }}>
        <Box className="anim-fade-in">{renderTab()}</Box>
      </DialogContent>

      <DialogActions sx={{ px:3, py:2, borderTop:'1px solid rgba(255,139,90,0.10)' }}>
        <Button onClick={onClose} variant="outlined"
          sx={{ borderColor:'#e0e0e0', color:'#6B7280', '&:hover':{ borderColor:'#aaa' } }}>
          Close
        </Button>
        <Button
          variant="contained"
          startIcon={exporting ? <CircularProgress size={14} color="inherit" /> : <FileDownloadOutlinedIcon />}
          onClick={generatePdf}
          disabled={exporting}
          sx={{ background:'linear-gradient(135deg,#1A1A2E,#2d2d44)', fontSize:13 }}>
          {exporting ? 'Generating PDF…' : 'Download PDF'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ClientDetailsModal;
