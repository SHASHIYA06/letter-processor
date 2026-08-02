import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Document, Packer, Paragraph, TextRun, AlignmentType, BorderStyle, TableRow, TableCell, Table, WidthType } from 'docx';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Asset path resolution for Vercel
function getAssetPath(filename) {
  const candidates = [
    path.join(__dirname, 'assets', filename),
    path.join('/var/task', 'assets', filename),
    path.join(process.cwd(), 'assets', filename),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return candidates[0];
}

const PAGE_MARGIN_BOTTOM = 50;
const A4_W = 595.28, A4_H = 841.89;

function checkPageBreak(doc, y, neededHeight, L, R) {
  if (y + neededHeight > doc.page.height - PAGE_MARGIN_BOTTOM) {
    doc.addPage();
    return 50;
  }
  return y;
}

function drawCheckbox(doc, x, y, checked) {
  doc.rect(x, y, 8, 8).lineWidth(0.5).stroke();
  if (checked) {
    doc.save().fontSize(9).font('Times-Bold').text('\u2588', x + 0.5, y - 0.5, { width: 8, align: 'center' }).restore();
  }
}

// ══════════════════════════════════════════════════════════════
//  BEML LETTER HEADER - Official Format (uses letterhead image)
// ══════════════════════════════════════════════════════════════
function drawBEMLHeader(doc, W) {
  const headerPath = getAssetPath('beml-letterhead-header.png');
  const logoPath = getAssetPath('beml-logo.jpg');
  
  // Try to use the official letterhead header image
  if (fs.existsSync(headerPath)) {
    try {
      doc.image(headerPath, 0, 0, { width: W, fit: [W, 120] });
      return 115; // Return Y position after the header image
    } catch (e) {}
  }
  
  // Fallback: Draw header manually
  let y = 15;
  if (fs.existsSync(logoPath)) {
    try { doc.image(logoPath, 15, y, { width: 70, height: 35, fit: 'contain' }); } catch (e) {}
  }
  doc.font('Times-Bold').fontSize(18).fillColor('#000').text('BEML LIMITED', 0, y, { width: W, align: 'center' });
  y += 22;
  doc.font('Times-Roman').fontSize(7).fillColor('#333');
  doc.text('A Government of India Enterprise under Ministry of Defence', 0, y, { width: W, align: 'center' });
  y += 11;
  doc.text('BEML Bhavan, No.1, Outer Ring Road, Bengaluru - 560068', 0, y, { width: W, align: 'center' });
  y += 11;
  doc.text('Ph: +91-80-2524 1752 | Fax: +91-80-2524 1746 | www.beml.co.in', 0, y, { width: W, align: 'center' });
  y += 14;
  doc.moveTo(40, y).lineTo(W - 40, y).lineWidth(1.5).stroke('#000');
  y += 4;
  doc.moveTo(40, y).lineTo(W - 40, y).lineWidth(0.5).stroke('#000');
  return y + 12;
}

function drawBEMLFooter(doc, W, H) {
  const footerPath = getAssetPath('beml-letterhead-footer.png');
  
  // Try to use the official letterhead footer image
  if (fs.existsSync(footerPath)) {
    try {
      doc.save();
      // Footer image should be at the very bottom of the page
      const footerHeight = 80;
      doc.image(footerPath, 0, H - footerHeight, { width: W, fit: [W, footerHeight] });
      doc.restore();
      return;
    } catch (e) {}
  }
  
  // Fallback: Draw footer manually
  doc.save();
  doc.moveTo(40, H - 75).lineTo(W - 40, H - 75).lineWidth(0.5).stroke('#999');
  doc.font('Times-Roman').fontSize(6.5).fillColor('#555');
  doc.text('Registered Office: BEML Bhavan, No.1, Outer Ring Road, Bengaluru - 560068', 40, H - 70, { width: W - 80, align: 'center' });
  doc.text('CIN: L35109KA1964GOI001758 | Ph: +91-80-2524 1752 | Email: info@beml.co.in | www.beml.co.in', 40, H - 60, { width: W - 80, align: 'center' });
  doc.restore();
}

// ══════════════════════════════════════════════════════════════
//  ORGANIZATION HEADERS
// ══════════════════════════════════════════════════════════════
const ORG_HEADERS = {
  'BEML': { name: 'BEML LIMITED', sub: 'A Government of India Enterprise under Ministry of Defence', addr: 'BEML Bhavan, No.1, Outer Ring Road, Bengaluru - 560068' },
  'KMRCL': { name: 'KOLKATA METRA RAIL CORPORATION LTD.', sub: 'A Government of India Enterprise', addr: 'KMRCL Bhavan, Salt Lake City, Kolkata - 700064' },
  'Metro Rail': { name: 'METRO RAIL CORPORATION LTD.', sub: 'A Government of India Enterprise', addr: 'Metro Rail Bhavan, Kolkata' }
};

function drawOrgHeader(doc, W, org) {
  const orgInfo = ORG_HEADERS[org] || ORG_HEADERS['BEML'];
  const logoPath = getAssetPath('beml-logo.jpg');
  let y = 15;
  if (fs.existsSync(logoPath)) {
    try { doc.image(logoPath, 15, y, { width: 60, height: 30, fit: 'contain' }); } catch (e) {}
  }
  doc.font('Times-Bold').fontSize(16).fillColor('#000').text(orgInfo.name, 0, y, { width: W, align: 'center' });
  y += 20;
  doc.font('Times-Roman').fontSize(7).fillColor('#333');
  doc.text(orgInfo.sub, 0, y, { width: W, align: 'center' });
  y += 11;
  doc.text(orgInfo.addr, 0, y, { width: W, align: 'center' });
  y += 11;
  doc.text('Ph: +91-80-2524 1752 | Fax: +91-80-2524 1746 | www.beml.co.in', 0, y, { width: W, align: 'center' });
  y += 14;
  doc.moveTo(40, y).lineTo(W - 40, y).lineWidth(1.5).stroke('#000');
  y += 4;
  doc.moveTo(40, y).lineTo(W - 40, y).lineWidth(0.5).stroke('#000');
  return y + 12;
}

// ══════════════════════════════════════════════════════════════
//  BEML LETTER PDF - Exact Match to Official Format
// ══════════════════════════════════════════════════════════════
function generateLetterPdf(data, outputPath) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margins: { top: 0, bottom: 0, left: 0, right: 0 } });
    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);
    const W = A4_W, H = A4_H, L = 72, R = W - 72, CW = R - L;
    const org = data.organization || 'BEML';
    
    // ── HEADER: Use official letterhead image ──
    let y = 0;
    const headerPath = getAssetPath('beml-letterhead-header.png');
    if (org === 'BEML' && fs.existsSync(headerPath)) {
      try {
        doc.image(headerPath, 0, 0, { width: W, fit: [W, 130] });
        y = 130;
      } catch (e) {}
    }
    if (y === 0) {
      y = drawOrgHeader(doc, W, org);
    }
    drawBEMLFooter(doc, W, H);

    // ── REF NUMBER (left) + DATE (right) ──
    y += 5;
    doc.font('Times-Bold').fontSize(10).fillColor('#000');
    doc.text(data.refNumber || '', L, y, { width: CW / 2 });
    doc.font('Times-Roman').fontSize(10);
    doc.text(data.date ? `Date: ${data.date}` : '', R - 180, y, { width: 180, align: 'right' });
    y += 18;

    // ── TO ADDRESS BLOCK ──
    doc.font('Times-Roman').fontSize(10).fillColor('#000');
    doc.text('To,', L, y);
    y += 14;
    if (data.to) {
      const toLines = data.to.split('\n');
      toLines.forEach(line => {
        if (line.trim()) {
          doc.text(line.trim(), L, y, { width: CW });
          y += 13;
        }
      });
    }
    y += 4;

    // ── KIND ATTENTION (bold, centered per BEML format) ──
    if (data.kindAttn) {
      doc.font('Times-Bold').fontSize(10).fillColor('#000');
      doc.text('Kind Attn: ' + data.kindAttn, L, y, { width: CW, align: 'center' });
      y = doc.y + 8;
    }

    // ── SUBJECT (bold italic, underlined per BEML format) ──
    y += 2;
    doc.font('Times-BoldItalic').fontSize(10).fillColor('#000');
    doc.text('Subject: ' + (data.subject || ''), L, y, { width: CW });
    y = doc.y + 10;

    // ── DEAR SIR (no comma per actual BEML format) ──
    doc.font('Times-Roman').fontSize(10).fillColor('#000');
    doc.text('Dear Sir,', L, y);
    y = doc.y + 8;

    // ── LETTER BODY (strip leading "Dear Sir/Madam," if present) ──
    let body = data.letterContent || data.letterBody || '';
    body = body.replace(/^(Dear\s+(?:Sir|Madam|Sir\/Madam)[,]?\s*\n?)/i, '').trim();
    if (body) {
      const bodyLines = body.split('\n');
      bodyLines.forEach(line => {
        if (line.trim()) {
          doc.text(line.trim(), L, y, { width: CW, lineGap: 3, align: 'justify' });
          y = doc.y + 2;
        }
      });
      y += 6;
    }

    // ── CLOSING: "Yours sincerely, for BEML Limited" per actual format ──
    y = checkPageBreak(doc, y, 140, L, R);
    doc.font('Times-Roman').fontSize(10).fillColor('#000');
    doc.text('Yours sincerely,', L, y);
    y = doc.y + 6;
    doc.text('for ' + (org === 'BEML' ? 'BEML Limited' : org), L, y);
    y = doc.y + 35;

    // ── SIGNATURE BLOCK ──
    if (data.signatory) {
      doc.font('Times-Roman').fontSize(10).text(data.signatory, L, y);
      y = doc.y + 4;
    }
    if (data.designation) {
      doc.font('Times-Roman').fontSize(10).text(data.designation, L, y);
      y = doc.y + 4;
    }
    if (data.project) {
      doc.font('Times-Roman').fontSize(10).text(data.project, L, y);
      y = doc.y + 4;
    }

    // ── ENCLOSURES ──
    if (data.enclosures) {
      y += 8;
      doc.font('Times-Roman').fontSize(9).fillColor('#000');
      doc.text('Encl: ' + data.enclosures, L, y, { width: CW });
      y = doc.y + 6;
    }

    // ── CC ──
    if (data.cc) {
      y += 4;
      doc.font('Times-Roman').fontSize(9).fillColor('#000');
      const ccLines = data.cc.split('\n');
      ccLines.forEach((line, i) => {
        if (line.trim()) {
          if (i === 0) {
            doc.text('Cc: ' + line.trim(), L, y, { width: CW });
          } else {
            doc.text('    ' + line.trim(), L, y, { width: CW });
          }
          y = doc.y + 2;
        }
      });
    }

    doc.end();
    stream.on('finish', () => resolve(outputPath));
    stream.on('error', reject);
  });
}

// ══════════════════════════════════════════════════════════════
//  NCR PDF - Exact Match to Official BEML Non-Conformity Report
// ══════════════════════════════════════════════════════════════
function generateNCRPdf(data, outputPath) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margins: { top: 0, bottom: 0, left: 0, right: 0 } });
    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);
    const W = A4_W, H = A4_H, LM = 40, RM = W - 40, CW = RM - LM;
    let y = 10;

    // ── HEADER BOX (exact BEML NCR format) ──
    const hdrH = 72;
    doc.rect(LM, y, CW, hdrH).lineWidth(0.8).stroke('#000');
    // BEML logo left
    const logoPath = getAssetPath('beml-logo.jpg');
    if (fs.existsSync(logoPath)) {
      try { doc.image(logoPath, LM + 8, y + 8, { width: 50, height: 30, fit: 'contain' }); } catch (e) {}
    }
    doc.font('Times-Bold').fontSize(7).fillColor('#000');
    doc.text('BHARAT EARTH MOVERS LTD.', LM + 8, y + 40, { width: 80 });
    doc.font('Times-Roman').fontSize(6);
    doc.text('Rolling Stock Division', LM + 8, y + 50, { width: 80 });
    // Title center
    doc.font('Times-Bold').fontSize(14).fillColor('#000');
    doc.text('NON-CONFORMITY', LM + CW / 2 - 80, y + 8, { width: 160, align: 'center' });
    doc.text('REPORT', LM + CW / 2 - 80, y + 24, { width: 160, align: 'center' });
    doc.font('Times-Roman').fontSize(7);
    doc.text(data.depot || 'KMRCL RS-3R Rolling Stock', LM + CW / 2 - 100, y + 42, { width: 200, align: 'center' });
    // NCR number + distribution right
    doc.font('Times-Bold').fontSize(9).fillColor('#cc0000');
    doc.text(data.ncrNo || '---', RM - 200, y + 5, { width: 195, align: 'right' });
    doc.font('Times-Roman').fontSize(7).fillColor('#000');
    doc.text('FM/RS/NCR/01/00', RM - 200, y + 18, { width: 195, align: 'right' });
    doc.text('Distribution: ' + (data.distribution || 'OEM/SBU-S&M/R&D/PM/Quality'), RM - 260, y + 30, { width: 255, align: 'right' });
    y += hdrH + 4;

    // ── MAIN DATA TABLE (6 columns: label|value|label|value|label|value) ──
    const c1 = LM, c2 = LM + 68, c3 = LM + 160, c4 = LM + 225, c5 = LM + CW / 2 + 10, c6 = LM + CW / 2 + 78, c7 = RM;
    const rH = 22;

    function drawDataRow(labels, values, heights) {
      const maxH = heights || rH;
      // Horizontal lines
      doc.moveTo(c1, y + maxH).lineTo(c7, y + maxH).lineWidth(0.3).stroke();
      // Vertical lines
      [c2, c3, c4, c5, c6].forEach(cx => { doc.moveTo(cx, y).lineTo(cx, y + maxH).lineWidth(0.3).stroke(); });
      // Outer borders
      doc.rect(c1, y, c7 - c1, maxH).lineWidth(0.3).stroke();
      // Labels (bold)
      doc.font('Times-Bold').fontSize(7).fillColor('#000');
      doc.text(labels[0], c1 + 3, y + 4, { width: c2 - c1 - 6 });
      doc.text(labels[1], c3 + 3, y + 4, { width: c4 - c3 - 6 });
      doc.text(labels[2], c5 + 3, y + 4, { width: c6 - c5 - 6 });
      // Values
      doc.font('Times-Roman').fontSize(7);
      doc.text(values[0] || '---', c2 + 3, y + 4, { width: c3 - c2 - 6 });
      doc.text(values[1] || '---', c4 + 3, y + 4, { width: c5 - c4 - 6 });
      doc.text(values[2] || '---', c6 + 3, y + 4, { width: c7 - c6 - 6 });
      y += maxH;
    }

    // Row 1: Project | Vehicle No. | Product
    drawDataRow(['Project', 'Vehicle No.', 'Product'], [data.project, data.vehicleNo || data.trainNo || data.trainSet, data.product || data.itemDesc]);
    // Row 2: Part Number | Supplier | Qty.
    drawDataRow(['Part Number', 'Supplier', 'Qty.'], [data.partNo, data.supplier || data.vendor || data.oem, data.qty]);
    // Row 3: Date of NCR | Date of Detection | Sub-System
    drawDataRow(['Date of NCR', 'Date of Detection', 'Sub-System'], [data.date || data.ncrDate, data.detectionDate, data.subSystem]);
    // Row 4: Faulty Sl. No. | Healthy Sl. No. | Status
    drawDataRow(['Faulty Sl. No.', 'Healthy Sl. No.', 'Status'], [data.faultySl, data.healthySl, data.status || 'OPEN']);

    // Row 5: Severity | Place | Stored At (with severity checkboxes)
    const sevH = 28;
    doc.rect(c1, y, c7 - c1, sevH).lineWidth(0.3).stroke();
    [c2, c3, c4, c5, c6].forEach(cx => { doc.moveTo(cx, y).lineTo(cx, y + sevH).lineWidth(0.3).stroke(); });
    doc.font('Times-Bold').fontSize(7).fillColor('#000');
    doc.text('Severity', c1 + 3, y + 4, { width: c2 - c1 - 6 });
    doc.text('Place', c3 + 3, y + 4, { width: c4 - c3 - 6 });
    doc.text('Stored At', c5 + 3, y + 4, { width: c6 - c5 - 6 });
    // Severity checkboxes
    const svY = y + 14;
    drawCheckbox(doc, c2 + 5, svY, data.severity === 'Critical');
    doc.font('Times-Roman').fontSize(6.5).text('Major', c2 + 14, svY, { width: 35 });
    drawCheckbox(doc, c2 + 50, svY, data.severity === 'Major');
    doc.text('Minor', c2 + 59, svY, { width: 35 });
    doc.text(data.place || '---', c4 + 3, y + 4, { width: c5 - c4 - 6 });
    doc.text(data.storedAt || '---', c6 + 3, y + 4, { width: c7 - c6 - 6 });
    y += sevH;

    // ── DESCRIPTION OF NON-CONFORMITY (black header) ──
    y += 4;
    y = checkPageBreak(doc, y, 80, LM, RM);
    const descHdrH = 14;
    doc.rect(c1, y, c7 - c1, descHdrH).fill('#000');
    doc.font('Times-Bold').fontSize(8).fillColor('#fff');
    doc.text('Description of Non-Conformity', c1 + 5, y + 3, { width: CW - 10 });
    y += descHdrH;
    doc.font('Times-Roman').fontSize(7.5).fillColor('#000');
    if (data.ncrDesc) {
      doc.text(data.ncrDesc, c1 + 6, y + 4, { width: CW - 12, lineGap: 2 });
      y = doc.y + 4;
    } else {
      doc.text('---', c1 + 6, y + 4, { width: CW - 12 });
      y += 16;
    }

    // ── Date + Issued By + Reviewed & Approved ──
    y += 2;
    const issueH = 28;
    doc.moveTo(c1, y).lineTo(c7, y).lineWidth(0.3).stroke();
    doc.moveTo(c1, y + issueH).lineTo(c7, y + issueH).lineWidth(0.3).stroke();
    doc.moveTo(c1 + 100, y).lineTo(c1 + 100, y + issueH).lineWidth(0.3).stroke();
    doc.font('Times-Bold').fontSize(7).fillColor('#000');
    doc.text('Date', c1 + 3, y + 3, { width: 94 });
    doc.text('Issued By', c1 + 103, y + 3, { width: CW - 106 });
    doc.font('Times-Roman').fontSize(7);
    doc.text(data.detectionDate || '---', c1 + 3, y + 14, { width: 94 });
    doc.text(data.issuedBy || '---', c1 + 103, y + 14, { width: CW - 106 });
    y += issueH;
    doc.font('Times-Bold').fontSize(7).fillColor('#000');
    doc.text('Reviewed & Approved By', c1 + 3, y + 3, { width: CW - 6 });
    doc.font('Times-Roman').fontSize(7);
    doc.text(data.reviewedBy || '---', c1 + 3, y + 14, { width: CW - 6 });
    y += 22;

    // ── CORRECTION / CORRECTIVE ACTION RESULT (black header) ──
    y = checkPageBreak(doc, y, 60, LM, RM);
    doc.rect(c1, y, c7 - c1, descHdrH).fill('#000');
    doc.font('Times-Bold').fontSize(8).fillColor('#fff');
    doc.text('Correction / Corrective Action Result', c1 + 5, y + 3, { width: CW - 10 });
    y += descHdrH;
    doc.font('Times-Roman').fontSize(7.5).fillColor('#000');
    if (data.correctiveAction || data.correction) {
      doc.text(data.correctiveAction || data.correction, c1 + 6, y + 4, { width: CW - 12, lineGap: 2 });
      y = doc.y + 4;
    } else {
      doc.text('---', c1 + 6, y + 4, { width: CW - 12 });
      y += 16;
    }
    // Healthy / Faulty Sl No
    doc.font('Times-Bold').fontSize(7).fillColor('#000');
    doc.text('In (Healthy) Sl. No.', c1 + 3, y + 2, { width: 120 });
    doc.text('Out (Faulty) Sl. No.', c1 + CW / 2, y + 2, { width: 120 });
    doc.font('Times-Roman').fontSize(7);
    doc.text(data.healthySl || '---', c1 + 3, y + 13, { width: 120 });
    doc.text(data.faultySl || '---', c1 + CW / 2, y + 13, { width: 120 });
    y += 24;
    doc.moveTo(c1, y).lineTo(c7, y).lineWidth(0.3).stroke();
    y += 4;

    // ── DECISION & VERIFICATION (black header) ──
    y = checkPageBreak(doc, y, 70, LM, RM);
    doc.rect(c1, y, c7 - c1, descHdrH).fill('#000');
    doc.font('Times-Bold').fontSize(8).fillColor('#fff');
    doc.text('Decision & Verification', c1 + 5, y + 3, { width: CW - 10 });
    y += descHdrH + 4;

    // Decision checkboxes
    doc.font('Times-Bold').fontSize(7).fillColor('#000');
    doc.text('Decision:', c1 + 3, y);
    y += 12;
    const decisions = ['Claim', 'Holding', 'Use as is', 'Rework', 'Waiver', 'Scrap', 'Repair'];
    let dX = c1 + 5;
    decisions.forEach(d => {
      drawCheckbox(doc, dX, y, data.decision === d);
      doc.font('Times-Roman').fontSize(6.5).fillColor('#000');
      doc.text(d, dX + 10, y, { width: 50 });
      dX += 65;
    });
    y += 14;

    // Repair Procedure Required + Gate Pass
    doc.font('Times-Bold').fontSize(7).fillColor('#000');
    doc.text('Repair Procedure Required', c1 + 3, y);
    doc.text('Gate Pass S/No', c1 + CW / 2, y);
    doc.font('Times-Roman').fontSize(7);
    doc.text(data.repairProcedure || 'Yes / No', c1 + 3, y + 10, { width: 120 });
    doc.text(data.gatePassNo || '---', c1 + CW / 2, y + 10, { width: 120 });
    y += 22;

    // NCR Closed By Document
    doc.font('Times-Bold').fontSize(7).fillColor('#000');
    doc.text('NCR Closed By Document', c1 + 3, y);
    doc.font('Times-Roman').fontSize(7);
    doc.text(data.ncrClosedByDoc || '---', c1 + 3, y + 10, { width: CW - 6 });
    y += 22;
    doc.moveTo(c1, y).lineTo(c7, y).lineWidth(0.3).stroke();
    y += 4;

    // ── ITEM REPAIR / REPLACEMENT DETAILS (black header) ──
    y = checkPageBreak(doc, y, 40, LM, RM);
    doc.rect(c1, y, c7 - c1, descHdrH).fill('#000');
    doc.font('Times-Bold').fontSize(8).fillColor('#fff');
    doc.text('Item Repair / Replacement Details', c1 + 5, y + 3, { width: CW - 10 });
    y += descHdrH + 4;

    doc.font('Times-Bold').fontSize(7).fillColor('#000');
    doc.text('Item Repaired/Recouped', c1 + 3, y, { width: 140 });
    doc.text('Item Replaced (If Any)', c1 + CW / 2, y, { width: 140 });
    doc.text('Source', c1 + CW - 80, y, { width: 77 });
    doc.font('Times-Roman').fontSize(7);
    doc.text(data.itemRepaired || '---', c1 + 3, y + 10, { width: 140 });
    doc.text(data.itemReplaced || '---', c1 + CW / 2, y + 10, { width: 140 });
    doc.text(data.source || '---', c1 + CW - 80, y + 10, { width: 77 });
    y += 22;
    doc.font('Times-Bold').fontSize(7).fillColor('#000');
    doc.text('Remarks', c1 + 3, y);
    doc.font('Times-Roman').fontSize(7);
    doc.text(data.remarks || '---', c1 + 3, y + 10, { width: CW - 6 });
    y += 22;
    doc.moveTo(c1, y).lineTo(c7, y).lineWidth(0.3).stroke();
    y += 4;

    // ── APPROVAL & VERIFICATION (black header) ──
    y = checkPageBreak(doc, y, 40, LM, RM);
    doc.rect(c1, y, c7 - c1, descHdrH).fill('#000');
    doc.font('Times-Bold').fontSize(8).fillColor('#fff');
    doc.text('Approval & Verification', c1 + 5, y + 3, { width: CW - 10 });
    y += descHdrH + 8;

    // Signature lines
    const sigW = CW / 4;
    ['BEML Site Engineer', 'Quality Assurance', 'Reviewed By', 'Approved By (BEML)'].forEach((label, i) => {
      const sx = c1 + i * sigW;
      doc.moveTo(sx + 5, y + 20).lineTo(sx + sigW - 5, y + 20).lineWidth(0.3).stroke();
      doc.font('Times-Roman').fontSize(6.5).fillColor('#000');
      doc.text(label, sx + 5, y + 22, { width: sigW - 10, align: 'center' });
    });
    y += 35;

    // ── FOOTER LINE ──
    doc.font('Times-Roman').fontSize(6).fillColor('#666');
    doc.text(`BEML Rolling Stock Division · KMRC RS-3R · ${data.ncrNo || 'NCR'} · IR Printed: —`, LM, y, { width: CW, align: 'center' });

    doc.end();
    stream.on('finish', () => resolve(outputPath));
    stream.on('error', reject);
  });
}

// ══════════════════════════════════════════════════════════════
//  DOCX GENERATORS
// ══════════════════════════════════════════════════════════════
function generateNCRDocx(data, outputPath) {
  return new Promise((resolve, reject) => {
    const bs = { style: BorderStyle.SINGLE, size: 1, color: '000000' }, cb = { top: bs, bottom: bs, left: bs, right: bs };
    function mr(cells) { return new TableRow({ children: cells.map(([text, bold, w]) => new TableCell({ borders: cb, width: { size: w || 25, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: text || '---', bold: bold || false, size: 16, font: 'Times New Roman' })] })] })) }); }
    const doc = new Document({ sections: [{ children: [
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'BEML LIMITED', bold: true, size: 28, font: 'Times New Roman' })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'NON-CONFORMITY REPORT', bold: true, size: 24, font: 'Times New Roman' })] }),
      new Paragraph({ spacing: { before: 100 }, children: [] }),
      new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [
        mr([['NCR Report No.', true, 20], [data.ncrNo || '---', false, 30], ['Date:', true, 15], [data.date || '---', false, 35]]),
        mr([['Project', true, 20], [data.project || '---', false, 30], ['Detection Date:', true, 15], [data.detectionDate || '---', false, 35]]),
        mr([['Issued By', true, 20], [data.issuedBy || data.raisedBy || '---', false, 30], ['Issued To:', true, 15], [data.responsibility || '---', false, 35]]),
        mr([['Item Description', true, 20], [data.itemDesc || data.product || '---', false, 80]]),
        mr([['Part Number', true, 20], [data.partNo || '---', false, 30], ['Quantity:', true, 15], [data.qty || '---', false, 35]]),
        mr([['Train Set', true, 20], [data.trainSet || data.trainNo || data.vehicleNo || '---', false, 30], ['Car:', true, 15], [data.car || '---', false, 35]]),
        mr([['Vendor/OEM', true, 20], [data.vendor || data.supplier || data.oem || '---', false, 30], ['Location:', true, 15], [data.location || data.place || '---', false, 35]]),
        mr([['Severity', true, 20], [(data.severity === 'Critical' ? '[X]' : '[ ]') + ' Critical  ' + (data.severity === 'Major' ? '[X]' : '[ ]') + ' Major  ' + (data.severity === 'Minor' ? '[X]' : '[ ]') + ' Minor', false, 80]]),
        mr([['Description', true, 20], [data.ncrDesc || '---', false, 80]]),
        mr([['Root Cause', true, 20], [data.cause || data.rootCause || '---', false, 80]]),
        mr([['Corrective Action', true, 20], [data.correction || data.correctiveAction || '---', false, 80]]),
        mr([['Preventive Action', true, 20], [data.preventiveAction || '---', false, 80]]),
        mr([['Decision', true, 20], [data.decision || '---', false, 30], ['Status:', true, 15], [data.status || 'Open', false, 35]]),
      ]}),
    ]}]});
    Packer.toBuffer(doc).then(buffer => { fs.writeFileSync(outputPath, buffer); resolve(outputPath); }).catch(reject);
  });
}

function generateLetterDocx(data, outputPath) {
  return new Promise((resolve, reject) => {
    const children = [
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'BEML LIMITED', bold: true, size: 28, font: 'Times New Roman' })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'A Government of India Enterprise | Ministry of Defence', size: 14, font: 'Times New Roman', color: '666666' })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'BEML Bhavan, No.1, Outer Ring Road, Bengaluru - 560068', size: 14, font: 'Times New Roman', color: '333333' })] }),
      new Paragraph({ spacing: { after: 200 }, children: [] }),
      new Paragraph({ children: [new TextRun({ text: data.refNumber || '', bold: true, size: 20, font: 'Times New Roman' }), new TextRun({ text: '\t\t\t\t\tDate: ' + (data.date || ''), size: 20, font: 'Times New Roman' })] }),
      new Paragraph({ spacing: { after: 100 }, children: [] }),
      new Paragraph({ children: [new TextRun({ text: 'To,', size: 20, font: 'Times New Roman' })] }),
    ];
    if (data.to) { data.to.split('\n').forEach(line => { children.push(new Paragraph({ children: [new TextRun({ text: line.trim(), size: 20, font: 'Times New Roman' })] })); }); }
    children.push(new Paragraph({ spacing: { after: 100 }, children: [] }));
    if (data.kindAttn) { children.push(new Paragraph({ children: [new TextRun({ text: 'Kind Attn: ' + data.kindAttn, bold: true, size: 20, font: 'Times New Roman' })] })); }
    children.push(new Paragraph({ spacing: { after: 100 }, children: [] }));
    children.push(new Paragraph({ children: [new TextRun({ text: 'Subject: ' + (data.subject || ''), bold: true, size: 20, font: 'Times New Roman', underline: {} })] }));
    children.push(new Paragraph({ spacing: { after: 100 }, children: [] }));
    if (data.allReferences) { children.push(new Paragraph({ children: [new TextRun({ text: 'Ref: ' + data.allReferences, size: 18, font: 'Times New Roman' })] })); }
    children.push(new Paragraph({ spacing: { after: 200 }, children: [] }));
    children.push(new Paragraph({ children: [new TextRun({ text: 'Dear Sir/Madam,', size: 20, font: 'Times New Roman' })] }));
    children.push(new Paragraph({ spacing: { after: 100 }, children: [] }));
    const body = data.letterContent || data.letterBody || '';
    body.split('\n').forEach(p => { children.push(new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: p, size: 20, font: 'Times New Roman' })] })); });
    children.push(new Paragraph({ spacing: { after: 200 }, children: [] }));
    children.push(new Paragraph({ children: [new TextRun({ text: 'Thanking you,', size: 20, font: 'Times New Roman' })] }));
    children.push(new Paragraph({ children: [new TextRun({ text: 'Yours faithfully,', size: 20, font: 'Times New Roman' })] }));
    children.push(new Paragraph({ spacing: { after: 200 }, children: [] }));
    children.push(new Paragraph({ children: [new TextRun({ text: 'For BEML Limited', size: 20, font: 'Times New Roman' })] }));
    children.push(new Paragraph({ spacing: { after: 100 }, children: [] }));
    if (data.signatory) { children.push(new Paragraph({ children: [new TextRun({ text: data.signatory, bold: true, size: 20, font: 'Times New Roman' })] })); }
    if (data.designation) { children.push(new Paragraph({ children: [new TextRun({ text: data.designation, size: 20, font: 'Times New Roman' })] })); }
    if (data.project) { children.push(new Paragraph({ children: [new TextRun({ text: data.project, size: 20, font: 'Times New Roman' })] })); }
    if (data.enclosures) { children.push(new Paragraph({ spacing: { before: 200 }, children: [new TextRun({ text: 'Encl: ' + data.enclosures, size: 18, font: 'Times New Roman' })] })); }

    const doc = new Document({ sections: [{ children }] });
    Packer.toBuffer(doc).then(buffer => { fs.writeFileSync(outputPath, buffer); resolve(outputPath); }).catch(reject);
  });
}

export { generateNCRPdf, generateLetterPdf, generateNCRDocx, generateLetterDocx, generateJointNotePdf, generateJointNoteDocx };

// ══════════════════════════════════════════════════════════════
//  JOINT NOTE PDF
// ══════════════════════════════════════════════════════════════
async function generateJointNotePdf(data, outputPath) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margins: { top: 0, bottom: 0, left: 0, right: 0 } });
    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);
    const W = A4_W, H = A4_H, L = 55, R = W - 55, CW = R - L;
    let y = drawBEMLHeader(doc, W);
    drawBEMLFooter(doc, W, H);

    // Title
    doc.font('Times-Bold').fontSize(16).fillColor('#000').text('JOINT NOTE', L, y, { width: CW, align: 'center' });
    y = doc.y + 5;
    if (data.jointNoteNo) {
      doc.font('Times-Roman').fontSize(9).fillColor('#333').text(`No: ${data.jointNoteNo}`, L, y, { width: CW, align: 'center' });
      y = doc.y + 15;
    }

    // Separator
    doc.moveTo(L, y).lineTo(R, y).lineWidth(1).stroke('#000');
    y += 12;

    // Date
    if (data.date) {
      doc.font('Times-Bold').fontSize(10).fillColor('#000').text(`Date: ${data.date}`, L, y, { width: CW });
      y = doc.y + 8;
    }

    // Parties
    if (data.parties) {
      doc.font('Times-Bold').fillColor('#000').text('Parties / Participants:', L, y, { width: CW });
      y = doc.y + 2;
      doc.font('Times-Roman').fontSize(10).fillColor('#333').text(data.parties, L + 5, y, { width: CW - 10 });
      y = doc.y + 8;
    }

    // Subject
    if (data.subject) {
      doc.font('Times-Bold').fillColor('#000').text('Subject:', L, y, { width: CW });
      y = doc.y + 2;
      doc.font('Times-Roman').fontSize(10).fillColor('#333').text(data.subject, L + 5, y, { width: CW - 10 });
      y = doc.y + 12;
    }

    // Description
    if (data.description) {
      y = checkPageBreak(doc, y, 60, L, R);
      doc.font('Times-Bold').fillColor('#000').text('Description:', L, y, { width: CW });
      y = doc.y + 2;
      doc.font('Times-Roman').fontSize(10).fillColor('#333').text(data.description, L + 5, y, { width: CW - 10 });
      y = doc.y + 12;
    }

    // Items Discussed
    if (data.itemsDiscussed) {
      y = checkPageBreak(doc, y, 60, L, R);
      doc.font('Times-Bold').fillColor('#000').text('Items Discussed:', L, y, { width: CW });
      y = doc.y + 2;
      doc.font('Times-Roman').fontSize(10).fillColor('#333').text(data.itemsDiscussed, L + 5, y, { width: CW - 10 });
      y = doc.y + 12;
    }

    // Decisions
    if (data.decisions) {
      y = checkPageBreak(doc, y, 60, L, R);
      doc.font('Times-Bold').fillColor('#000').text('Decisions Taken:', L, y, { width: CW });
      y = doc.y + 2;
      doc.font('Times-Roman').fontSize(10).fillColor('#333').text(data.decisions, L + 5, y, { width: CW - 10 });
      y = doc.y + 12;
    }

    // Action Items
    if (data.actionItems) {
      y = checkPageBreak(doc, y, 60, L, R);
      doc.font('Times-Bold').fillColor('#000').text('Action Items:', L, y, { width: CW });
      y = doc.y + 2;
      doc.font('Times-Roman').fontSize(10).fillColor('#333').text(data.actionItems, L + 5, y, { width: CW - 10 });
      y = doc.y + 12;
    }

    // Remarks
    if (data.remarks) {
      y = checkPageBreak(doc, y, 40, L, R);
      doc.font('Times-Bold').fillColor('#000').text('Remarks:', L, y, { width: CW });
      y = doc.y + 2;
      doc.font('Times-Roman').fontSize(10).fillColor('#333').text(data.remarks, L + 5, y, { width: CW - 10 });
      y = doc.y + 12;
    }

    // Status
    y = checkPageBreak(doc, y, 30, L, R);
    doc.font('Times-Bold').fontSize(10).fillColor('#000').text('Status: ', L, y, { continued: true });
    doc.font('Times-Roman').text(data.status || 'Open');
    y = doc.y + 20;

    // Signatures
    y = checkPageBreak(doc, y, 80, L, R);
    doc.moveTo(L, y).lineTo(R, y).lineWidth(0.5).stroke('#000');
    y += 15;
    doc.font('Times-Roman').fontSize(10).fillColor('#000').text('Authorized Signatory (BEML Limited)', L, y);
    doc.text('Authorized Signatory (Other Party)', R - 200, y);

    doc.end();
    stream.on('finish', () => resolve());
    stream.on('error', reject);
  });
}

// ══════════════════════════════════════════════════════════════
//  JOINT NOTE DOCX
// ══════════════════════════════════════════════════════════════
async function generateJointNoteDocx(data, outputPath) {
  return new Promise((resolve, reject) => {
    const children = [];

  // Title
  children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [
    new TextRun({ text: 'JOINT NOTE', bold: true, size: 28, font: 'Times New Roman' })
  ]}));
  if (data.jointNoteNo) {
    children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [
      new TextRun({ text: `No: ${data.jointNoteNo}`, size: 20, font: 'Times New Roman' })
    ]}));
  }

  children.push(new Paragraph({ spacing: { after: 100 }, border: { bottom: { style: BorderStyle.SINGLE, size: 1 } }, children: [] }));

  if (data.date) {
    children.push(new Paragraph({ spacing: { after: 80 }, children: [
      new TextRun({ text: 'Date: ', bold: true, size: 20, font: 'Times New Roman' }),
      new TextRun({ text: data.date, size: 20, font: 'Times New Roman' })
    ]}));
  }

  if (data.parties) {
    children.push(new Paragraph({ spacing: { after: 40 }, children: [
      new TextRun({ text: 'Parties / Participants:', bold: true, size: 20, font: 'Times New Roman' })
    ]}));
    children.push(new Paragraph({ spacing: { after: 100 }, indent: { left: 200 }, children: [
      new TextRun({ text: data.parties, size: 20, font: 'Times New Roman' })
    ]}));
  }

  if (data.subject) {
    children.push(new Paragraph({ spacing: { after: 40 }, children: [
      new TextRun({ text: 'Subject:', bold: true, size: 20, font: 'Times New Roman' })
    ]}));
    children.push(new Paragraph({ spacing: { after: 100 }, indent: { left: 200 }, children: [
      new TextRun({ text: data.subject, size: 20, font: 'Times New Roman' })
    ]}));
  }

  if (data.description) {
    children.push(new Paragraph({ spacing: { before: 100, after: 40 }, children: [
      new TextRun({ text: 'Description:', bold: true, size: 20, font: 'Times New Roman' })
    ]}));
    children.push(new Paragraph({ spacing: { after: 100 }, indent: { left: 200 }, children: [
      new TextRun({ text: data.description, size: 20, font: 'Times New Roman' })
    ]}));
  }

  if (data.itemsDiscussed) {
    children.push(new Paragraph({ spacing: { before: 100, after: 40 }, children: [
      new TextRun({ text: 'Items Discussed:', bold: true, size: 20, font: 'Times New Roman' })
    ]}));
    children.push(new Paragraph({ spacing: { after: 100 }, indent: { left: 200 }, children: [
      new TextRun({ text: data.itemsDiscussed, size: 20, font: 'Times New Roman' })
    ]}));
  }

  if (data.decisions) {
    children.push(new Paragraph({ spacing: { before: 100, after: 40 }, children: [
      new TextRun({ text: 'Decisions Taken:', bold: true, size: 20, font: 'Times New Roman' })
    ]}));
    children.push(new Paragraph({ spacing: { after: 100 }, indent: { left: 200 }, children: [
      new TextRun({ text: data.decisions, size: 20, font: 'Times New Roman' })
    ]}));
  }

  if (data.actionItems) {
    children.push(new Paragraph({ spacing: { before: 100, after: 40 }, children: [
      new TextRun({ text: 'Action Items:', bold: true, size: 20, font: 'Times New Roman' })
    ]}));
    children.push(new Paragraph({ spacing: { after: 100 }, indent: { left: 200 }, children: [
      new TextRun({ text: data.actionItems, size: 20, font: 'Times New Roman' })
    ]}));
  }

  if (data.remarks) {
    children.push(new Paragraph({ spacing: { before: 100, after: 40 }, children: [
      new TextRun({ text: 'Remarks:', bold: true, size: 20, font: 'Times New Roman' })
    ]}));
    children.push(new Paragraph({ spacing: { after: 100 }, indent: { left: 200 }, children: [
      new TextRun({ text: data.remarks, size: 20, font: 'Times New Roman' })
    ]}));
  }

  children.push(new Paragraph({ spacing: { after: 80 }, children: [
    new TextRun({ text: 'Status: ', bold: true, size: 20, font: 'Times New Roman' }),
    new TextRun({ text: data.status || 'Open', size: 20, font: 'Times New Roman' })
  ]}));

  children.push(new Paragraph({ spacing: { before: 300 }, children: [] }));
  children.push(new Paragraph({ children: [
    new TextRun({ text: 'Authorized Signatory (BEML Limited)', size: 20, font: 'Times New Roman' }),
    new TextRun({ text: '                    Authorized Signatory (Other Party)', size: 20, font: 'Times New Roman' })
  ]}));

  const doc = new Document({ sections: [{ children }] });
  Packer.toBuffer(doc).then(buffer => { fs.writeFileSync(outputPath, buffer); resolve(outputPath); }).catch(reject);
  });
}
