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
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Link from '@mui/material/Link';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import CircularProgress from '@mui/material/CircularProgress';

import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import ContactPhoneOutlinedIcon from '@mui/icons-material/ContactPhoneOutlined';
import PolicyOutlinedIcon from '@mui/icons-material/PolicyOutlined';
import MonetizationOnOutlinedIcon from '@mui/icons-material/MonetizationOnOutlined';
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

const tabs = [
  { label:'General',    icon:<PersonOutlineIcon /> },
  { label:'Address',    icon:<HomeOutlinedIcon /> },
  { label:'Contact',    icon:<ContactPhoneOutlinedIcon /> },
  { label:'Policy',     icon:<PolicyOutlinedIcon /> },
  { label:'Financials', icon:<MonetizationOnOutlinedIcon /> },
  { label:'Documents',  icon:<FolderOutlinedIcon /> },
];

function Field({ label, value }) {
  if (!value) return null;
  return (
    <Box>
      <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.6, mb: 0.3 }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: 13.5, color: '#1A1A2E', fontWeight: 500 }}>
        {value}
      </Typography>
    </Box>
  );
}

function FinancialRow({ label, value }) {
  const fmt = (v) => v ? `LKR ${Number(v).toLocaleString()}` : '—';
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1, borderBottom: '1px solid rgba(255,139,90,0.08)' }}>
      <Typography sx={{ fontSize: 13, color: '#6B7280' }}>{label}</Typography>
      <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#1A1A2E' }}>{fmt(value)}</Typography>
    </Box>
  );
}

function DocCard({ label, url, description }) {
  return (
    <Box sx={{
      p: 1.5, borderRadius: '12px',
      border: `1px solid ${url ? 'rgba(255,139,90,0.25)' : 'rgba(0,0,0,0.06)'}`,
      bgcolor: url ? 'rgba(255,248,245,0.8)' : '#FAFAFA',
      transition: 'all 0.2s ease',
      '&:hover': url ? { boxShadow: '0 4px 16px rgba(255,90,90,0.10)', transform: 'translateY(-1px)' } : {},
    }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
        <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>{label}</Typography>
        {url && (
          <Link href={viewUrl(url)} target="_blank" rel="noopener noreferrer"
            sx={{ display: 'flex', alignItems: 'center', gap: 0.3, fontSize: 11, fontWeight: 700, color: '#FF5A5A', textDecoration: 'none',
                  '&:hover': { textDecoration: 'underline' } }}>
            View <OpenInNewIcon sx={{ fontSize: 11 }} />
          </Link>
        )}
      </Box>
      <Typography sx={{ fontSize: 11, color: url ? '#FF8B5A' : '#C4B5B0', fontWeight: url ? 500 : 400 }}>
        {url ? 'Document uploaded' : 'No document'}
      </Typography>
      {description && (
        <Typography sx={{ fontSize: 11, color: '#6B7280', mt: 0.5, fontStyle: 'italic' }}>
          {description}
        </Typography>
      )}
    </Box>
  );
}

const ClientDetailsModal = ({ client, onClose }) => {
  const [tab,       setTab]       = useState(0);
  const [exporting, setExporting] = useState(false);
  if (!client) return null;

  const generatePdf = async () => {
    setExporting(true);
    try {
      const { default: jsPDF }     = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');
      const pdf   = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pw    = pdf.internal.pageSize.getWidth();
      const ph    = pdf.internal.pageSize.getHeight();
      const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
      const fmtLKR = v => v ? `LKR ${Number(v).toLocaleString()}` : '—';

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

      // ── Page 1 ──────────────────────────────────────────────────────────────
      drawHeader();

      // Title band
      pdf.setFillColor(249,250,251); pdf.rect(0,22.5,pw,13,'F');
      pdf.setFontSize(10); pdf.setFont('helvetica','bold'); pdf.setTextColor(26,26,46);
      pdf.text('UNDERWRITING RECORD', 14, 30.5);
      pdf.setFontSize(7.5); pdf.setFont('helvetica','normal'); pdf.setTextColor(107,114,128);
      const fileRef = [client.ceilao_ib_file_no && `File: ${client.ceilao_ib_file_no}`, client.policy_no && `Policy: ${client.policy_no}`].filter(Boolean).join('   ·   ');
      if (fileRef) pdf.text(fileRef, pw-14, 30.5, {align:'right'});

      // Client banner
      pdf.setFillColor(232,71,42); pdf.rect(0,35.5,pw,15,'F');
      pdf.setFontSize(13); pdf.setFont('helvetica','bold'); pdf.setTextColor(255,255,255);
      pdf.text(client.client_name || '—', 14, 44.5);
      const tags = [client.main_class, client.product, client.customer_type].filter(Boolean);
      let tx = pw - 14;
      [...tags].reverse().forEach(t => {
        const tw = pdf.getTextWidth(t) + 10;
        tx -= tw;
        pdf.setFillColor(200,50,30);
        pdf.roundedRect(tx, 38.5, tw, 8, 2, 2, 'F');
        pdf.setFontSize(7); pdf.setFont('helvetica','bold'); pdf.setTextColor(255,255,255);
        pdf.text(t, tx + tw/2, 43.5, {align:'center'});
        tx -= 3;
      });

      let y = 55;
      const tableOpts = (startY) => ({
        startY,
        columnStyles: { 0:{ cellWidth:58, fontStyle:'bold', fillColor:[255,248,245], textColor:[55,65,81] }, 1:{ textColor:[26,26,46] } },
        styles: { fontSize:9, cellPadding:{top:3,bottom:3,left:6,right:6}, lineColor:[255,220,200], lineWidth:0.1 },
        bodyStyles: { fillColor:[255,255,255] },
        alternateRowStyles: { fillColor:[255,252,250] },
        margin: { left:10, right:10, top:26, bottom:16 },
        didDrawPage: (d) => { if (d.pageNumber > 1) drawHeader(); },
      });

      const addSection = (title, rows) => {
        const filtered = rows.filter(r => r[1]);
        if (!filtered.length) return;
        autoTable(pdf, {
          ...tableOpts(y),
          head: [[{ content:title, colSpan:2, styles:{fillColor:[26,26,46],textColor:[255,139,90],fontStyle:'bold',fontSize:8.5,cellPadding:{top:3.5,bottom:3.5,left:6,right:6}} }]],
          body: filtered,
        });
        y = pdf.lastAutoTable.finalY + 5;
      };

      addSection('GENERAL INFORMATION', [
        ['Client Name',          client.client_name],
        ['Customer Type',        client.customer_type],
        ['Insurance Provider',   client.insurance_provider],
        ['Insurer',              client.insurer],
        ['Main Class',           client.main_class],
        ['Product',              client.product],
        ['Branch',               client.branch],
        ['Ceilao IB File No.',   client.ceilao_ib_file_no],
        ['Vehicle Number',       client.vehicle_number],
        ['Introducer Code',      client.introducer_code],
        ['Sales Rep ID',         client.sales_rep_id],
      ]);

      addSection('POLICY DETAILS', [
        ['Policy No',            client.policy_no],
        ['Policy Type',          client.policy_type],
        ['Coverage',             client.coverage],
        ['Policy Period From',   client.policy_period_from],
        ['Policy Period To',     client.policy_period_to],
      ]);

      addSection('ADDRESS', [
        ['Street 1',  client.street1],
        ['Street 2',  client.street2],
        ['City',      client.city],
        ['District',  client.district],
        ['Province',  client.province],
      ]);

      addSection('CONTACT', [
        ['Mobile No',       client.mobile_no],
        ['Telephone',       client.telephone],
        ['Email',           client.email],
        ['Contact Person',  client.contact_person],
        ['Social Media',    client.social_media],
      ]);

      addSection('IDENTIFICATION & PROOFS', [
        ['NIC Proof',              client.nic_proof],
        ['DOB Proof',              client.dob_proof],
        ['Business Registration',  client.business_registration],
        ['SVAT Proof',             client.svat_proof],
        ['VAT Proof',              client.vat_proof],
      ]);

      // Financial Summary
      const finRows = [
        ['Sum Insured',     fmtLKR(client.sum_insured)],
        ['Basic Premium',   fmtLKR(client.basic_premium)],
        ['SRCC Premium',    fmtLKR(client.srcc_premium)],
        ['TC Premium',      fmtLKR(client.tc_premium)],
        ['Net Premium',     fmtLKR(client.net_premium)],
        ['Stamp Duty',      fmtLKR(client.stamp_duty)],
        ['Admin Fees',      fmtLKR(client.admin_fees)],
        ['Road Safety Fee', fmtLKR(client.road_safety_fee)],
        ['Policy Fee',      fmtLKR(client.policy_fee)],
        ['VAT Fee',         fmtLKR(client.vat_fee)],
      ].filter(r => r[1] !== '—');

      autoTable(pdf, {
        ...tableOpts(y),
        head: [[{ content:'FINANCIAL SUMMARY', colSpan:2, styles:{fillColor:[26,26,46],textColor:[255,139,90],fontStyle:'bold',fontSize:8.5,cellPadding:{top:3.5,bottom:3.5,left:6,right:6}} }]],
        body: [
          ...finRows,
          [
            { content:'TOTAL INVOICE', styles:{fontStyle:'bold',fontSize:10.5,fillColor:[232,71,42],textColor:[255,255,255],cellPadding:{top:5,bottom:5,left:6,right:6}} },
            { content: fmtLKR(client.total_invoice), styles:{fontStyle:'bold',fontSize:10.5,fillColor:[232,71,42],textColor:[255,255,255],halign:'right',cellPadding:{top:5,bottom:5,left:6,right:6}} },
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

      addSection('COMMISSION', [
        ['Commission Type',  client.commission_type],
        ['Commission Basic', client.commission_basic ? fmtLKR(client.commission_basic) : null],
        ['Commission SRCC',  client.commission_srcc  ? fmtLKR(client.commission_srcc)  : null],
        ['Commission TC',    client.commission_tc    ? fmtLKR(client.commission_tc)    : null],
      ]);

      // ── Documents page ───────────────────────────────────────────────────────
      const uploadedDocs = docFields.filter(df => client[df.doc]);
      if (uploadedDocs.length > 0) {
        pdf.addPage();
        drawHeader();

        const margL = 10, gap = 8, cols = 2;
        const colW = (pw - margL * 2 - gap * (cols - 1)) / cols;
        const imgMaxH = 110, labelH = 14, cellH = labelH + imgMaxH + 8;
        let docY = 28, docCol = 0;

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

          // Label + notes
          pdf.setFontSize(8.5); pdf.setFont('helvetica','bold'); pdf.setTextColor(26,26,46);
          pdf.text(df.label, cx, docY+5);
          const note = client[df.text];
          if (note) {
            pdf.setFontSize(7); pdf.setFont('helvetica','normal'); pdf.setTextColor(107,114,128);
            pdf.text(note, cx, docY+10, {maxWidth: colW});
          }

          const imgY  = docY + labelH;
          const url   = client[df.doc];
          // Only treat as embeddable image if extension is explicitly an image type
          // PDFs uploaded to /image/upload/ must NOT be treated as images
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
              // Fallback: show as link card
              pdf.setFontSize(8); pdf.setFont('helvetica','bold'); pdf.setTextColor(107,114,128);
              pdf.text('Image unavailable', cx+colW/2, imgY+imgMaxH/2-4, {align:'center'});
              pdf.setFontSize(7); pdf.setFont('helvetica','normal');
              pdf.text('Click below to view online', cx+colW/2, imgY+imgMaxH/2+4, {align:'center'});
              pdf.setTextColor(99,102,241);
              pdf.textWithLink('Open document ↗', cx+colW/2, imgY+imgMaxH/2+12, {align:'center', url});
            }
          } else {
            // PDF or unknown file — show a clean reference card with clickable link
            const midY = imgY + imgMaxH/2;

            // PDF badge box
            pdf.setFillColor(238,242,255);
            pdf.roundedRect(cx + colW/2 - 18, midY - 24, 36, 16, 3, 3, 'F');
            pdf.setFontSize(10); pdf.setFont('helvetica','bold'); pdf.setTextColor(99,102,241);
            pdf.text('PDF', cx + colW/2, midY - 13, {align:'center'});

            pdf.setFontSize(8); pdf.setFont('helvetica','bold'); pdf.setTextColor(55,65,81);
            pdf.text(df.label, cx + colW/2, midY - 2, {align:'center'});

            pdf.setFontSize(7); pdf.setFont('helvetica','normal'); pdf.setTextColor(107,114,128);
            pdf.text('Click to open document', cx + colW/2, midY + 8, {align:'center'});

            // Clickable "Open ↗" link
            pdf.setFontSize(8); pdf.setFont('helvetica','bold'); pdf.setTextColor(99,102,241);
            pdf.textWithLink('Open ↗', cx + colW/2, midY + 18, {align:'center', url});
            pdf.link(cx + colW/2 - 15, midY + 13, 30, 7, {url});
          }

          docCol++;
          if (docCol >= cols) { docCol = 0; docY += cellH; }
        }
      }

      // Draw footers on every page in one pass (avoids didDrawPage timing issues)
      const total = pdf.internal.getNumberOfPages();
      for (let i = 1; i <= total; i++) { pdf.setPage(i); drawFooter(); }

      const safeName = (client.client_name || 'Client').replace(/\s+/g, '_').replace(/[^\w-]/g,'');
      const safeRef  = (client.policy_no || client.ceilao_ib_file_no || 'Record').replace(/[^\w-]/g,'');
      pdf.save(`CeilaoIB_${safeName}_${safeRef}.pdf`);

    } catch (err) {
      console.error('PDF export error:', err);
    }
    setExporting(false);
  };

  const renderTab = () => {
    switch (tab) {
      case 0: /* General */
        return (
          <Grid container spacing={2.5}>
            <Grid item xs={12} sm={6} md={4}><Field label="Client Name"         value={client.client_name} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Customer Type"        value={client.customer_type} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Product"              value={client.product} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Insurance Provider"   value={client.insurance_provider} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Insurer"              value={client.insurer} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Branch"               value={client.branch} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Main Class"           value={client.main_class} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Vehicle Number"       value={client.vehicle_number} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Ceilao IB File No."   value={client.ceilao_ib_file_no} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Introducer Code"      value={client.introducer_code} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="NIC Proof"            value={client.nic_proof} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="DOB Proof"            value={client.dob_proof} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Business Reg."        value={client.business_registration} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="SVAT Proof"           value={client.svat_proof} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="VAT Proof"            value={client.vat_proof} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Sales Rep ID"         value={client.sales_rep_id} /></Grid>
          </Grid>
        );
      case 1: /* Address */
        return (
          <Grid container spacing={2.5}>
            <Grid item xs={12} sm={6}><Field label="Street 1"  value={client.street1} /></Grid>
            <Grid item xs={12} sm={6}><Field label="Street 2"  value={client.street2} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="City"     value={client.city} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="District" value={client.district} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Province" value={client.province} /></Grid>
          </Grid>
        );
      case 2: /* Contact */
        return (
          <Grid container spacing={2.5}>
            <Grid item xs={12} sm={6} md={4}><Field label="Mobile No"      value={client.mobile_no} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Telephone"      value={client.telephone} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Email"          value={client.email} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Contact Person" value={client.contact_person} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Social Media"   value={client.social_media} /></Grid>
          </Grid>
        );
      case 3: /* Policy */
        return (
          <Grid container spacing={2.5}>
            <Grid item xs={12} sm={6} md={4}><Field label="Policy Type"        value={client.policy_type} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Policy No"          value={client.policy_no} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Policy"             value={client.policy_} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Policy Period From" value={client.policy_period_from} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Policy Period To"   value={client.policy_period_to} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Coverage"           value={client.coverage} /></Grid>
          </Grid>
        );
      case 4: /* Financials */
        return (
          <Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 3, mb: 2 }}>
              <Box>
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', mb: 1, letterSpacing: 0.6, textTransform: 'uppercase' }}>Premiums</Typography>
                <FinancialRow label="Sum Insured"    value={client.sum_insured} />
                <FinancialRow label="Basic Premium"  value={client.basic_premium} />
                <FinancialRow label="SRCC Premium"   value={client.srcc_premium} />
                <FinancialRow label="TC Premium"     value={client.tc_premium} />
                <FinancialRow label="Net Premium"    value={client.net_premium} />
              </Box>
              <Box>
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', mb: 1, letterSpacing: 0.6, textTransform: 'uppercase' }}>Fees & Taxes</Typography>
                <FinancialRow label="Stamp Duty"      value={client.stamp_duty} />
                <FinancialRow label="Admin Fees"      value={client.admin_fees} />
                <FinancialRow label="Road Safety Fee" value={client.road_safety_fee} />
                <FinancialRow label="Policy Fee"      value={client.policy_fee} />
                <FinancialRow label="VAT Fee"         value={client.vat_fee} />
              </Box>
            </Box>
            <Box sx={{ p: 2, borderRadius: '12px', background: 'linear-gradient(135deg,rgba(255,90,90,0.08),rgba(255,139,90,0.06))', border: '1px solid rgba(255,90,90,0.15)' }}>
              <Typography sx={{ fontSize: 12, color: '#9CA3AF', mb: 0.5 }}>Total Invoice</Typography>
              <Typography sx={{ fontSize: 24, fontWeight: 800, color: '#FF5A5A' }}>
                LKR {Number(client.total_invoice || 0).toLocaleString()}
              </Typography>
            </Box>
            <Box sx={{ mt: 2 }}>
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', mb: 1, letterSpacing: 0.6, textTransform: 'uppercase' }}>Commission</Typography>
              <Stack direction="row" spacing={2} flexWrap="wrap">
                <Field label="Type"  value={client.commission_type} />
                <Field label="Basic" value={client.commission_basic} />
                <Field label="SRCC"  value={client.commission_srcc} />
                <Field label="TC"    value={client.commission_tc} />
              </Stack>
            </Box>
          </Box>
        );
      case 5: /* Documents */
        return (
          <Grid container spacing={1.5}>
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
    <Dialog
      open={!!client} onClose={onClose}
      maxWidth="md" fullWidth
      PaperProps={{ sx: { maxHeight: '90vh' } }}
    >
      {/* header */}
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontWeight: 800, fontSize: 17, color: '#fff' }}>{client.client_name}</Typography>
            <Box sx={{ display: 'flex', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
              {client.customer_type && (
                <Chip label={client.customer_type} size="small"
                  sx={{ fontSize: 10, fontWeight: 700, bgcolor: 'rgba(255,255,255,0.20)', color: '#fff', height: 20 }} />
              )}
              {client.product && (
                <Chip label={client.product} size="small"
                  sx={{ fontSize: 10, fontWeight: 700, bgcolor: 'rgba(255,255,255,0.20)', color: '#fff', height: 20 }} />
              )}
            </Box>
          </Box>
        </Box>
      </DialogTitle>

      {/* tabs */}
      <Box sx={{ bgcolor: 'rgba(255,248,245,0.5)', borderBottom: '1px solid rgba(255,139,90,0.12)' }}>
        <Tabs
          value={tab} onChange={(_, v) => setTab(v)}
          variant="scrollable" scrollButtons="auto"
          sx={{
            minHeight: 42,
            '& .MuiTab-root': { fontSize: 12, fontWeight: 600, minHeight: 42, py: 0, textTransform: 'none', color: '#9CA3AF', minWidth: 'unset', px: 2 },
            '& .Mui-selected': { color: '#FF5A5A' },
            '& .MuiTabs-indicator': { background: 'linear-gradient(90deg,#FF5A5A,#FF8B5A)', height: 2.5 },
          }}
        >
          {tabs.map((t, i) => (
            <Tab key={i} label={t.label} icon={t.icon} iconPosition="start"
              sx={{ '& .MuiTab-iconWrapper': { fontSize: 16, mr: 0.5 } }} />
          ))}
        </Tabs>
      </Box>

      {/* content */}
      <DialogContent sx={{ p: 3, overflowY: 'auto' }}>
        <Box className="anim-fade-in">
          {renderTab()}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid rgba(255,139,90,0.10)' }}>
        <Button onClick={onClose} variant="outlined"
          sx={{ borderColor: '#e0e0e0', color: '#6B7280', '&:hover': { borderColor: '#aaa' } }}>
          Close
        </Button>
        <Button
          variant="contained"
          startIcon={exporting ? <CircularProgress size={14} color="inherit" /> : <FileDownloadOutlinedIcon />}
          onClick={generatePdf}
          disabled={exporting}
          sx={{ background: 'linear-gradient(135deg,#1A1A2E,#2d2d44)', fontSize: 13 }}>
          {exporting ? 'Generating PDF…' : 'Download PDF'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ClientDetailsModal;
