import React, { useState } from 'react';
import { viewUrl } from '../cloudinary';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import CircularProgress from '@mui/material/CircularProgress';

import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';

const SECTION_COLORS = {
  Introducer:                 '#FF5A5A',
  'Insurance Company':        '#FF8B5A',
  'Proposer Details':         '#FFA95A',
  'Period of Insurance':      '#10B981',
  'Financial Interest':       '#0284c7',
  'Risk Information':         '#0891b2',
  'Claims History':           '#f59e0b',
  'Underwriting Information': '#7c3aed',
  'Sum Insured':              '#059669',
  'Covers Required':          '#16a34a',
  'Additional Clauses':       '#15803d',
  Deductibles:                '#dc2626',
  Premium:                    '#6366f1',
  Payment:                    '#8b5cf6',
  Commission:                 '#ec4899',
  Claims:                     '#ef4444',
  Documents:                  '#6366f1',
  Other:                      '#6B7280',
};

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

function Field({ label, value }) {
  if (!value && value !== 0) return null;
  return (
    <Box>
      <Typography sx={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.6, mb: 0.3 }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: 13, color: '#1A1A2E', fontWeight: 500, wordBreak: 'break-word' }}>
        {value}
      </Typography>
    </Box>
  );
}

function Section({ title, children }) {
  const items = React.Children.toArray(children).filter(Boolean);
  if (!items.length) return null;
  const color = SECTION_COLORS[title] || '#FF5A5A';
  return (
    <Box sx={{ mb: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
        <Box sx={{ width: 4, height: 18, borderRadius: '2px', background: `linear-gradient(180deg,${color},${color}44)` }} />
        <Typography sx={{ fontWeight: 700, fontSize: 11.5, textTransform: 'uppercase', letterSpacing: 0.8, color: '#374151' }}>
          {title}
        </Typography>
        <Box sx={{ flex: 1, height: 1, bgcolor: 'rgba(0,0,0,0.07)' }} />
      </Box>
      <Grid container spacing={2}>
        {items}
      </Grid>
    </Box>
  );
}

function FRow({ label, value }) {
  const fmt = v => v ? `LKR ${Number(v).toLocaleString()}` : null;
  const display = fmt(value);
  if (!display) return null;
  return (
    <Box sx={{ display:'flex', justifyContent:'space-between', alignItems:'center', py:0.8, borderBottom:'1px solid rgba(0,0,0,0.05)' }}>
      <Typography sx={{ fontSize:12.5, color:'#6B7280' }}>{label}</Typography>
      <Typography sx={{ fontSize:12.5, fontWeight:700, color:'#1A1A2E' }}>{display}</Typography>
    </Box>
  );
}

function DocCard({ label, url, description }) {
  return (
    <Box sx={{
      p:1.5, borderRadius:'10px',
      border:`1px solid ${url ? 'rgba(255,139,90,0.25)' : 'rgba(0,0,0,0.06)'}`,
      bgcolor: url ? 'rgba(255,248,245,0.8)' : '#FAFAFA',
    }}>
      <Box sx={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', mb:0.3 }}>
        <Typography sx={{ fontSize:12, fontWeight:700, color:'#374151' }}>{label}</Typography>
        {url && (
          <Link href={viewUrl(url)} target="_blank" rel="noopener noreferrer"
            sx={{ display:'flex', alignItems:'center', gap:0.3, fontSize:11, fontWeight:700, color:'#FF5A5A', textDecoration:'none',
                  '&:hover':{ textDecoration:'underline' } }}>
            View <OpenInNewIcon sx={{ fontSize:11 }} />
          </Link>
        )}
      </Box>
      <Typography sx={{ fontSize:10.5, color: url ? '#FF8B5A' : '#C4B5B0', fontWeight: url ? 500 : 400 }}>
        {url ? 'Uploaded' : 'No document'}
      </Typography>
      {description && (
        <Typography sx={{ fontSize:10.5, color:'#6B7280', mt:0.3, fontStyle:'italic' }}>{description}</Typography>
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

const ClientDetailsModal = ({ client, onClose }) => {
  const [exporting, setExporting] = useState(false);
  if (!client) return null;

  // Detect dynamic fields from client data
  const coverEntries   = Object.entries(client).filter(([k, v]) => k.startsWith('cover_')  && v && v !== 'No');
  const clauseEntries  = Object.entries(client).filter(([k, v]) => k.startsWith('clause_') && v && v !== 'No');
  const fiEntries      = Object.entries(client).filter(([k, v]) => k.startsWith('fi_')     && v && v !== 'No');

  const generatePdf = async () => {
    setExporting(true);
    try {
      const { default: jsPDF }     = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');
      const pdf   = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pw    = pdf.internal.pageSize.getWidth();
      const ph    = pdf.internal.pageSize.getHeight();
      const today = new Date().toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' });
      const fmtLKR = v => v ? `LKR ${Number(v).toLocaleString()}` : null;

      const TAB_H = 8;
      const sectionPages = {};
      const pageToSection = {};
      let currentSection = 'introducer';

      const startSec = (key) => {
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
        pdf.setFillColor(232,71,42); pdf.rect(0, ph-14, pw, 1, 'F');
        pdf.setFont('helvetica','bold'); pdf.setFontSize(7.5); pdf.setTextColor(255,139,90);
        pdf.text('Ceilao Insurance Brokers (Pvt) Ltd', 12, ph-8);
        pdf.setFont('helvetica','normal'); pdf.setFontSize(7); pdf.setTextColor(107,114,128);
        pdf.text(`Page ${pn} / ${tp}`, pw-12, ph-8, {align:'right'});
        pdf.setFont('helvetica','italic'); pdf.setFontSize(6.5); pdf.setTextColor(100,116,139);
        pdf.text(`Generated: ${today}  ·  CONFIDENTIAL`, pw/2, ph-3.5, {align:'center'});
      };

      drawHeader();

      // Title band
      pdf.setFillColor(249,250,251); pdf.rect(0, 22.5+TAB_H, pw, 13, 'F');
      pdf.setFontSize(10); pdf.setFont('helvetica','bold'); pdf.setTextColor(26,26,46);
      pdf.text('UNDERWRITING RECORD', 14, 30.5+TAB_H);
      pdf.setFontSize(7.5); pdf.setFont('helvetica','normal'); pdf.setTextColor(107,114,128);
      const fileRef = [client.ceilao_ib_file_no && `File: ${client.ceilao_ib_file_no}`, client.policy_no && `Policy: ${client.policy_no}`].filter(Boolean).join('   ·   ');
      if (fileRef) pdf.text(fileRef, pw-14, 30.5+TAB_H, {align:'right'});

      // Client banner
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
        pdf.text(t, tx + tw/2, 43.5+TAB_H, {align:'center'});
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
        didDrawPage: (d) => {
          if (d.pageNumber > 1) { drawHeader(); if (!pageToSection[d.pageNumber]) pageToSection[d.pageNumber] = currentSection; }
        },
      });

      const addSection = (sectionKey, title, rows) => {
        const filtered = rows.filter(r => r[1]);
        if (!filtered.length) return;
        startSec(sectionKey);
        autoTable(pdf, {
          ...tableOpts(y),
          head: [[{ content:title, colSpan:2, styles:{fillColor:[26,26,46],textColor:[255,139,90],fontStyle:'bold',fontSize:8.5,cellPadding:{top:3.5,bottom:3.5,left:6,right:6}} }]],
          body: filtered,
        });
        y = pdf.lastAutoTable.finalY + 5;
      };

      addSection('introducer', 'INTRODUCER', [
        ['Ceilao IB File No.', client.ceilao_ib_file_no],
        ['Manager',            client.manager],
        ['Introducer Code',    client.introducer_code],
      ]);

      addSection('insurance', 'INSURANCE COMPANY', [
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
        ['Telephone',             client.telephone],
        ['Mobile No',             client.mobile_no],
        ['Contact Person',        client.contact_person],
        ['Email',                 client.email],
        ['Social Media',          client.social_media],
      ]);

      addSection('period', 'PERIOD OF INSURANCE', [
        ['Policy No',          client.policy_no],
        ['Policy Type',        client.policy_type],
        ['Coverage',           client.coverage],
        ['Policy Period From', client.policy_period_from],
        ['Policy Period To',   client.policy_period_to],
        ['Policy Days',        client.policy_days],
        ['O/S Days',           client.os_days],
        ['Credit Period',      client.credit_period],
      ]);

      // Financial Interest
      if (fiEntries.length > 0) {
        addSection('financial', 'FINANCIAL INTEREST',
          fiEntries.map(([k, v]) => [fieldNameToLabel(k), String(v)])
        );
      }

      // Risk Information
      const riskRows = [
        ['Vehicle Number', client.vehicle_number],
        ['Make / Model',   client.vehicle_make && client.vehicle_model ? `${client.vehicle_make} ${client.vehicle_model}` : (client.vehicle_make || client.vehicle_model)],
        ['Engine No.',     client.engine_no],
        ['Chassis No.',    client.chassis_no],
        ['Body Type',      client.body_type],
        ['Fuel Type',      client.fuel_type],
        ['Vehicle Usage',  client.vehicle_usage],
        ['Voyage From',    client.voyage_from],
        ['Voyage To',      client.voyage_to],
        ['Vessel Name',    client.vessel_name],
        ['Cargo',          client.cargo_description],
      ].filter(r => r[1]);
      if (riskRows.length) addSection('risk', 'RISK INFORMATION', riskRows);

      // Claims History (dynamic fields)
      const claimsHistRows = Object.entries(client)
        .filter(([k, v]) => k.startsWith('claims_hist_') && v)
        .map(([k, v]) => [fieldNameToLabel(k.replace('claims_hist_', '')), String(v)]);
      if (claimsHistRows.length) addSection('claims_hist', 'CLAIMS HISTORY', claimsHistRows);

      // Underwriting Information (dynamic fields)
      const uwRows = Object.entries(client)
        .filter(([k, v]) => k.startsWith('uw_') && v)
        .map(([k, v]) => [fieldNameToLabel(k.replace('uw_', '')), String(v)]);
      if (uwRows.length) addSection('underwriting', 'UNDERWRITING INFORMATION', uwRows);

      addSection('sum_insured', 'SUM INSURED', [
        ['Sum Insured', fmtLKR(client.sum_insured)],
      ]);

      if (coverEntries.length > 0) {
        addSection('covers', 'COVERS REQUIRED',
          coverEntries.map(([k, v]) => [fieldNameToLabel(k), String(v)])
        );
      }

      if (clauseEntries.length > 0) {
        addSection('clauses', 'ADDITIONAL CLAUSES',
          clauseEntries.map(([k, v]) => [fieldNameToLabel(k), String(v)])
        );
      }

      // Premium
      startSec('premium');
      const finRows = [
        ['Basic Premium',   fmtLKR(client.basic_premium)],
        ['SRCC Premium',    fmtLKR(client.srcc_premium)],
        ['TC Premium',      fmtLKR(client.tc_premium)],
        ['Net Premium',     fmtLKR(client.net_premium)],
        ['Stamp Duty',      fmtLKR(client.stamp_duty)],
        ['Admin Fees',      fmtLKR(client.admin_fees)],
        ['Road Safety Fee', fmtLKR(client.road_safety_fee)],
        ['Policy Fee',      fmtLKR(client.policy_fee)],
        ['VAT',             fmtLKR(client.vat_fee)],
      ].filter(r => r[1]);
      if (finRows.length || client.total_invoice) {
        autoTable(pdf, {
          ...tableOpts(y),
          head: [[{ content:'PREMIUM', colSpan:2, styles:{fillColor:[26,26,46],textColor:[255,139,90],fontStyle:'bold',fontSize:8.5,cellPadding:{top:3.5,bottom:3.5,left:6,right:6}} }]],
          body: [
            ...finRows,
            [
              { content:'TOTAL INVOICE', styles:{fontStyle:'bold',fontSize:10.5,fillColor:[232,71,42],textColor:[255,255,255],cellPadding:{top:5,bottom:5,left:6,right:6}} },
              { content: fmtLKR(client.total_invoice) || '—', styles:{fontStyle:'bold',fontSize:10.5,fillColor:[232,71,42],textColor:[255,255,255],halign:'right',cellPadding:{top:5,bottom:5,left:6,right:6}} },
            ],
          ],
          columnStyles: { 0:{cellWidth:65,fontStyle:'bold',fillColor:[255,248,245],textColor:[55,65,81]}, 1:{halign:'right',textColor:[26,26,46]} },
          styles: { fontSize:9, cellPadding:{top:3,bottom:3,left:6,right:6}, lineColor:[255,220,200], lineWidth:0.1 },
          bodyStyles: { fillColor:[255,255,255] },
          alternateRowStyles: { fillColor:[255,252,250] },
          margin: { left:10, right:10, top:26, bottom:16 },
          didDrawPage: (d) => { if (d.pageNumber > 1) drawHeader(); },
        });
        y = pdf.lastAutoTable.finalY + 5;
      }

      addSection('deductibles', 'DEDUCTIBLES', [
        ['Deductible', client.deductible],
        ['Excesses',   client.excesses],
      ]);

      addSection('commission', 'COMMISSION', [
        ['Commission Type',         client.commission_type],
        ['Commission %',            client.commission_pct],
        ['Commission Basic',        fmtLKR(client.commission_basic)],
        ['Commission SRCC',         fmtLKR(client.commission_srcc)],
        ['Commission TC',           fmtLKR(client.commission_tc)],
        ['Total Commission',        fmtLKR(client.commission_total)],
        ['Commission Method',       client.commission_paid_method],
        ['Commission Receive Date', client.commission_receive_date],
        ['Commission Amount Paid',  fmtLKR(client.commission_amount_paid)],
        ['Commission VAT',          fmtLKR(client.commission_vat)],
      ]);

      addSection('payment', 'PAYMENT', [
        ['Payment Status',  client.payment_status],
        ['Amount Received', fmtLKR(client.amount_received)],
        ['Payment Date',    client.payment_date],
        ['Payment Method',  client.payment_method],
        ['Cheque / Slip No.', client.cheque_slip_no],
        ['Receipt No.',     client.receipt_no],
      ]);

      addSection('claims', 'CLAIMS', [
        ['Claim Paid?',           client.claim_paid],
        ['Date of Claim',         client.claim_date],
        ['Claim Amount',          fmtLKR(client.claim_amount)],
        ['Settled Amount',        fmtLKR(client.claim_settled)],
        ['Repudiation Reasons',   client.repudiation_reasons],
        ['Partial Payment Reasons', client.partial_payment_reasons],
      ]);

      // Documents page
      const uploadedDocs = docFields.filter(df => client[df.doc]);
      if (uploadedDocs.length > 0) {
        pdf.addPage();
        drawHeader();
        startSec('documents');

        const margL = 10, gap = 8, cols = 2;
        const colW = (pw - margL * 2 - gap * (cols - 1)) / cols;
        const imgMaxH = 110, labelH = 14, cellH = labelH + imgMaxH + 8;
        let docY = 22.5 + TAB_H + 6, docCol = 0;

        const addDocPageHdr = (title) => {
          pdf.setFillColor(26,26,46); pdf.rect(margL, docY, pw - margL*2, 9, 'F');
          pdf.setFontSize(8.5); pdf.setFont('helvetica','bold'); pdf.setTextColor(255,139,90);
          pdf.text(title, pw/2, docY+6, {align:'center'});
          docY += 13;
        };
        addDocPageHdr('UPLOADED DOCUMENTS');

        for (const df of uploadedDocs) {
          if (docY + cellH > ph - 18) {
            pdf.addPage(); drawHeader();
            docY = 28; docCol = 0;
            addDocPageHdr('UPLOADED DOCUMENTS (cont.)');
          }
          const cx = margL + docCol * (colW + gap);

          pdf.setFontSize(8.5); pdf.setFont('helvetica','bold'); pdf.setTextColor(26,26,46);
          pdf.text(df.label, cx, docY+5);
          const note = client[df.text];
          if (note) {
            pdf.setFontSize(7); pdf.setFont('helvetica','normal'); pdf.setTextColor(107,114,128);
            pdf.text(note, cx, docY+10, {maxWidth: colW});
          }

          const imgY = docY + labelH;
          const url  = client[df.doc];
          const isPdf = /\.pdf(\?|$)/i.test(url);
          const isImg = !isPdf && /\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(url);

          pdf.setFillColor(245,247,250); pdf.rect(cx, imgY, colW, imgMaxH, 'F');
          pdf.setDrawColor(210,215,225); pdf.setLineWidth(0.3); pdf.rect(cx, imgY, colW, imgMaxH, 'S');

          if (isImg) {
            try {
              const res  = await fetch(url);
              if (!res.ok) throw new Error('fetch');
              const blob = await res.blob();
              const b64  = await new Promise((res2, rej) => {
                const r = new FileReader();
                r.onload  = () => res2(r.result);
                r.onerror = rej;
                r.readAsDataURL(blob);
              });
              if (!b64.startsWith('data:image/')) throw new Error('not image');
              const dims = await new Promise(res2 => {
                const img = new window.Image();
                img.onload  = () => res2({ w: img.naturalWidth, h: img.naturalHeight });
                img.onerror = () => res2({ w: 4, h: 3 });
                img.src = b64;
              });
              const aspect = dims.w / dims.h;
              const bW = colW - 6, bH = imgMaxH - 6;
              let dw = bW, dh = dw / aspect;
              if (dh > bH) { dh = bH; dw = dh * aspect; }
              const fmt = /\.png(\?|$)/i.test(url) ? 'PNG' : 'JPEG';
              pdf.addImage(b64, fmt, cx+(colW-dw)/2, imgY+(imgMaxH-dh)/2, dw, dh, undefined, 'FAST');
            } catch {
              pdf.setFontSize(8); pdf.setFont('helvetica','bold'); pdf.setTextColor(107,114,128);
              pdf.text('Image unavailable', cx+colW/2, imgY+imgMaxH/2-4, {align:'center'});
              pdf.setFontSize(7); pdf.setFont('helvetica','normal');
              pdf.text('Click below to view online', cx+colW/2, imgY+imgMaxH/2+4, {align:'center'});
              pdf.setTextColor(99,102,241);
              pdf.textWithLink('Open document ↗', cx+colW/2, imgY+imgMaxH/2+12, {align:'center', url});
            }
          } else {
            const midY = imgY + imgMaxH/2;
            pdf.setFillColor(238,242,255);
            pdf.roundedRect(cx + colW/2 - 18, midY - 24, 36, 16, 3, 3, 'F');
            pdf.setFontSize(10); pdf.setFont('helvetica','bold'); pdf.setTextColor(99,102,241);
            pdf.text('PDF', cx + colW/2, midY - 13, {align:'center'});
            pdf.setFontSize(8); pdf.setFont('helvetica','bold'); pdf.setTextColor(55,65,81);
            pdf.text(df.label, cx + colW/2, midY - 2, {align:'center'});
            pdf.setFontSize(7); pdf.setFont('helvetica','normal'); pdf.setTextColor(107,114,128);
            pdf.text('Click to open document', cx + colW/2, midY + 8, {align:'center'});
            pdf.setFontSize(8); pdf.setFont('helvetica','bold'); pdf.setTextColor(99,102,241);
            pdf.textWithLink('Open ↗', cx + colW/2, midY + 18, {align:'center', url});
            pdf.link(cx + colW/2 - 15, midY + 13, 30, 7, {url});
          }

          docCol++;
          if (docCol >= cols) { docCol = 0; docY += cellH; }
        }
      }

      // Second pass: tab bar + footer on every page
      const total = pdf.internal.getNumberOfPages();
      const PDF_TAB_LABELS = [
        {key:'introducer',  label:'Introducer'},
        {key:'insurance',   label:'Insurance'},
        {key:'proposer',    label:'Proposer'},
        {key:'period',      label:'Period'},
        {key:'risk',        label:'Risk'},
        {key:'sum_insured', label:'Sum Insured'},
        {key:'premium',     label:'Premium'},
        {key:'commission',  label:'Commission'},
        {key:'documents',   label:'Documents'},
      ];
      const tabW = pw / PDF_TAB_LABELS.length;
      for (let i = 1; i <= total; i++) {
        pdf.setPage(i);
        const active = pageToSection[i] || 'introducer';
        pdf.setFillColor(22,26,48); pdf.rect(0, 22.5, pw, TAB_H, 'F');
        PDF_TAB_LABELS.forEach((t, idx) => {
          const tabX   = idx * tabW;
          const isAct  = t.key === active;
          if (isAct) { pdf.setFillColor(232,71,42); pdf.rect(tabX, 22.5+TAB_H-1.5, tabW, 1.5, 'F'); }
          pdf.setFontSize(5.5); pdf.setFont('helvetica', isAct ? 'bold' : 'normal');
          const [r,g,b] = isAct ? [255,255,255] : [148,163,184];
          pdf.setTextColor(r,g,b);
          pdf.text(t.label, tabX + tabW/2, 22.5 + TAB_H/2 + 1.5, {align:'center'});
          if (sectionPages[t.key] && sectionPages[t.key] !== i) {
            pdf.link(tabX, 22.5, tabW, TAB_H, {pageNumber: sectionPages[t.key]});
          }
        });
        drawFooter();
      }

      const safeName = (client.client_name || 'Client').replace(/\s+/g, '_').replace(/[^\w-]/g,'');
      const safeRef  = (client.policy_no || client.ceilao_ib_file_no || 'Record').replace(/[^\w-]/g,'');
      pdf.save(`CeilaoIB_${safeName}_${safeRef}.pdf`);

    } catch (err) {
      console.error('PDF export error:', err);
    }
    setExporting(false);
  };

  const fmtLKR = v => v ? `LKR ${Number(v).toLocaleString()}` : null;
  const coverItems  = Object.entries(client).filter(([k, v]) => k.startsWith('cover_')  && v && v !== 'No');
  const clauseItems = Object.entries(client).filter(([k, v]) => k.startsWith('clause_') && v && v !== 'No');

  return (
    <Dialog open={!!client} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: { maxHeight: '92vh' } }}>
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
              {client.ceilao_ib_file_no && (
                <Chip label={client.ceilao_ib_file_no} size="small"
                  sx={{ fontSize:10, fontWeight:700, bgcolor:'rgba(255,255,255,0.12)', color:'rgba(255,255,255,0.75)', height:20 }} />
              )}
            </Box>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p:3, overflowY:'auto' }}>
        <Box className="anim-fade-in">

          <Section title="Introducer">
            <Grid item xs={12} sm={6} md={4}><Field label="Ceilao IB File No." value={client.ceilao_ib_file_no} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Manager"            value={client.manager} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Introducer Code"    value={client.introducer_code} /></Grid>
          </Section>

          <Section title="Insurance Company">
            <Grid item xs={12} sm={6} md={4}><Field label="Main Class"         value={client.main_class} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Product"            value={client.product} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Customer Type"      value={client.customer_type} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Insurance Provider" value={client.insurance_provider} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Branch"             value={client.branch} /></Grid>
          </Section>

          <Section title="Proposer Details">
            <Grid item xs={12} sm={6} md={4}><Field label="Client Name"           value={client.client_name} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="NIC / Passport No."    value={client.nic_proof} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Business Registration" value={client.business_registration} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="SVAT / VAT No."        value={client.svat_proof} /></Grid>
            <Grid item xs={12} sm={6}       ><Field label="Street 1"              value={client.street1} /></Grid>
            <Grid item xs={12} sm={6}       ><Field label="Street 2"              value={client.street2} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="City"                  value={client.city} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="District"              value={client.district} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Province"              value={client.province} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Telephone"             value={client.telephone} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Mobile No"             value={client.mobile_no} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Email"                 value={client.email} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Contact Person"        value={client.contact_person} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Social Media"          value={client.social_media} /></Grid>
          </Section>

          <Section title="Period of Insurance">
            <Grid item xs={12} sm={6} md={4}><Field label="Policy No"          value={client.policy_no} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Policy Type"        value={client.policy_type} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Coverage"           value={client.coverage} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Policy Period From" value={client.policy_period_from} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Policy Period To"   value={client.policy_period_to} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Policy Days"        value={client.policy_days} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="O/S Days"           value={client.os_days} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Credit Period"      value={client.credit_period} /></Grid>
          </Section>

          {fiEntries.length > 0 && (
            <Section title="Financial Interest">
              {fiEntries.map(([k, v]) => (
                <Grid item xs={12} sm={6} md={4} key={k}>
                  <Field label={fieldNameToLabel(k)} value={String(v)} />
                </Grid>
              ))}
            </Section>
          )}

          <Section title="Risk Information">
            {client.vehicle_number && <Grid item xs={12} sm={6} md={4}><Field label="Vehicle Number" value={client.vehicle_number} /></Grid>}
            {(client.vehicle_make || client.vehicle_model) && (
              <Grid item xs={12} sm={6} md={4}><Field label="Make / Model" value={[client.vehicle_make, client.vehicle_model].filter(Boolean).join(' ')} /></Grid>
            )}
            {client.engine_no      && <Grid item xs={12} sm={6} md={4}><Field label="Engine No."    value={client.engine_no} /></Grid>}
            {client.chassis_no     && <Grid item xs={12} sm={6} md={4}><Field label="Chassis No."   value={client.chassis_no} /></Grid>}
            {client.body_type      && <Grid item xs={12} sm={6} md={4}><Field label="Body Type"     value={client.body_type} /></Grid>}
            {client.fuel_type      && <Grid item xs={12} sm={6} md={4}><Field label="Fuel Type"     value={client.fuel_type} /></Grid>}
            {client.vehicle_usage  && <Grid item xs={12} sm={6} md={4}><Field label="Vehicle Usage" value={client.vehicle_usage} /></Grid>}
            {client.voyage_from    && <Grid item xs={12} sm={6} md={4}><Field label="Voyage From"   value={client.voyage_from} /></Grid>}
            {client.voyage_to      && <Grid item xs={12} sm={6} md={4}><Field label="Voyage To"     value={client.voyage_to} /></Grid>}
            {client.vessel_name    && <Grid item xs={12} sm={6} md={4}><Field label="Vessel Name"   value={client.vessel_name} /></Grid>}
            {client.cargo_description && <Grid item xs={12} sm={6} md={4}><Field label="Cargo"      value={client.cargo_description} /></Grid>}
          </Section>

          {clauseItems.length > 0 && (
            <Section title="Claims History">
              {Object.entries(client)
                .filter(([k, v]) => k.startsWith('claims_hist_') && v)
                .map(([k, v]) => (
                  <Grid item xs={12} sm={6} md={4} key={k}>
                    <Field label={fieldNameToLabel(k.replace('claims_hist_', ''))} value={String(v)} />
                  </Grid>
                ))}
            </Section>
          )}

          <Section title="Sum Insured">
            <Grid item xs={12} sm={6} md={4}>
              <Box>
                <Typography sx={{ fontSize:10, fontWeight:700, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:0.6, mb:0.3 }}>
                  Sum Insured
                </Typography>
                <Typography sx={{ fontSize:18, fontWeight:800, color:'#059669' }}>
                  {client.sum_insured ? `LKR ${Number(client.sum_insured).toLocaleString()}` : '—'}
                </Typography>
              </Box>
            </Grid>
          </Section>

          {coverItems.length > 0 && (
            <Section title="Covers Required">
              {coverItems.map(([k, v]) => (
                <Grid item xs={12} sm={6} md={4} key={k}>
                  <Field label={fieldNameToLabel(k)} value={String(v)} />
                </Grid>
              ))}
            </Section>
          )}

          {clauseItems.length > 0 && (
            <Section title="Additional Clauses">
              {clauseItems.map(([k, v]) => (
                <Grid item xs={12} sm={6} md={4} key={k}>
                  <Field label={fieldNameToLabel(k)} value={String(v)} />
                </Grid>
              ))}
            </Section>
          )}

          <Section title="Premium">
            <Grid item xs={12}>
              <Box sx={{ display:'grid', gridTemplateColumns:{xs:'1fr',sm:'1fr 1fr'}, gap:3 }}>
                <Box>
                  <Typography sx={{ fontSize:11, fontWeight:700, color:'#9CA3AF', mb:1, letterSpacing:0.6, textTransform:'uppercase' }}>Premiums</Typography>
                  <FRow label="Basic Premium"  value={client.basic_premium} />
                  <FRow label="SRCC Premium"   value={client.srcc_premium} />
                  <FRow label="TC Premium"     value={client.tc_premium} />
                  <FRow label="Net Premium"    value={client.net_premium} />
                </Box>
                <Box>
                  <Typography sx={{ fontSize:11, fontWeight:700, color:'#9CA3AF', mb:1, letterSpacing:0.6, textTransform:'uppercase' }}>Fees & Taxes</Typography>
                  <FRow label="Stamp Duty"      value={client.stamp_duty} />
                  <FRow label="Admin Fees"      value={client.admin_fees} />
                  <FRow label="Road Safety Fee" value={client.road_safety_fee} />
                  <FRow label="Policy Fee"      value={client.policy_fee} />
                  <FRow label="VAT"             value={client.vat_fee} />
                </Box>
              </Box>
              {client.total_invoice && (
                <Box sx={{ mt:2, p:2, borderRadius:'10px', background:'linear-gradient(135deg,rgba(255,90,90,0.08),rgba(255,139,90,0.06))', border:'1px solid rgba(255,90,90,0.15)' }}>
                  <Typography sx={{ fontSize:11, color:'#9CA3AF', mb:0.3 }}>Total Invoice</Typography>
                  <Typography sx={{ fontSize:22, fontWeight:800, color:'#FF5A5A' }}>
                    LKR {Number(client.total_invoice).toLocaleString()}
                  </Typography>
                </Box>
              )}
            </Grid>
          </Section>

          {(client.deductible || client.excesses) && (
            <Section title="Deductibles">
              {client.deductible && <Grid item xs={12} sm={6} md={4}><Field label="Deductible" value={client.deductible} /></Grid>}
              {client.excesses   && <Grid item xs={12} sm={6} md={4}><Field label="Excesses"   value={client.excesses} /></Grid>}
            </Section>
          )}

          <Section title="Commission">
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
          </Section>

          <Section title="Payment">
            <Grid item xs={12} sm={6} md={4}><Field label="Payment Status"    value={client.payment_status} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Amount Received"   value={fmtLKR(client.amount_received)} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Payment Date"      value={client.payment_date} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Payment Method"    value={client.payment_method} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Cheque / Slip No." value={client.cheque_slip_no} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Receipt No."       value={client.receipt_no} /></Grid>
          </Section>

          <Section title="Claims">
            <Grid item xs={12} sm={6} md={4}><Field label="Claim Paid?"              value={client.claim_paid} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Date of Claim"            value={client.claim_date} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Claim Amount"             value={fmtLKR(client.claim_amount)} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Settled Amount"           value={fmtLKR(client.claim_settled)} /></Grid>
            <Grid item xs={12}             ><Field label="Repudiation Reasons"       value={client.repudiation_reasons} /></Grid>
            <Grid item xs={12}             ><Field label="Partial Payment Reasons"   value={client.partial_payment_reasons} /></Grid>
          </Section>

          {docFields.some(df => client[df.doc]) && (
            <>
              <Divider sx={{ my: 2 }} />
              <Section title="Documents">
                {docFields.map(df => (
                  <Grid item xs={12} sm={6} key={df.doc}>
                    <DocCard label={df.label} url={client[df.doc]} description={client[df.text]} />
                  </Grid>
                ))}
              </Section>
            </>
          )}

        </Box>
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
