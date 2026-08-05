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
    let y = 12;

    // ── HEADER BOX (exact BEML NCR format) ──
    const hdrH = 70;
    doc.rect(LM, y, CW, hdrH).lineWidth(0.8).stroke('#000');

    // BEML logo left
    const logoPath = getAssetPath('beml-logo.jpg');
    if (fs.existsSync(logoPath)) {
      try { doc.image(logoPath, LM + 8, y + 6, { width: 55, height: 28, fit: 'contain' }); } catch (e) {}
    }
    doc.font('Times-Bold').fontSize(7).fillColor('#000');
    doc.text('BHARAT EARTH MOVERS LTD.', LM + 8, y + 36, { width: 80 });
    doc.font('Times-Roman').fontSize(6);
    doc.text('Rolling Stock Division', LM + 8, y + 46, { width: 80 });

    // Title center
    doc.font('Times-Bold').fontSize(16).fillColor('#000');
    doc.text('NON-CONFORMITY', LM + CW / 2 - 90, y + 6, { width: 180, align: 'center' });
    doc.text('REPORT', LM + CW / 2 - 90, y + 24, { width: 180, align: 'center' });

    // Distribution text
    doc.font('Times-Roman').fontSize(6.5);
    doc.text('OEM/ SBU-S&M / R&D/', RM - 140, y + 6, { width: 135, align: 'right' });
    doc.text('PM/Purchase/ Quality', RM - 140, y + 16, { width: 135, align: 'right' });

    // NCR number red
    doc.font('Times-Bold').fontSize(9).fillColor('#cc0000');
    doc.text(data.ncrNo || '---', LM + 8, y + 54, { width: 200 });

    // FM/RS/NCR right
    doc.font('Times-Roman').fontSize(6.5).fillColor('#000');
    doc.text('FM/RS/NCR/01/00', RM - 80, y + 54, { width: 75, align: 'right' });

    y += hdrH + 4;

    // ── MAIN DATA TABLE (2-column format: label|value) ──
    const cL = LM, cM = LM + CW / 2, cR = RM;
    const rH = 20;

    function drawRow(label1, val1, label2, val2, rowH) {
      const rh = rowH || rH;
      doc.rect(cL, y, CW, rh).lineWidth(0.3).stroke();
      doc.moveTo(cM, y).lineTo(cM, y + rh).lineWidth(0.3).stroke();
      doc.font('Times-Bold').fontSize(7).fillColor('#000');
      doc.text(label1, cL + 4, y + 4, { width: 70 });
      doc.font('Times-Roman').fontSize(7);
      doc.text(val1 || '---', cL + 78, y + 4, { width: cM - cL - 82 });
      doc.font('Times-Bold').fontSize(7).fillColor('#000');
      doc.text(label2, cM + 4, y + 4, { width: 70 });
      doc.font('Times-Roman').fontSize(7);
      doc.text(val2 || '---', cM + 78, y + 4, { width: cR - cM - 82 });
      y += rh;
    }

    // Row 1: Report no. | Distribution to
    drawRow('Report no.', data.ncrNo, 'Distribution to:', data.distribution || 'OEM/ SBU-S&M / R&D/ PM/Purchase/ Quality');
    // Row 2: Project | Vehicle no.
    drawRow('Project', data.project || 'KMRCL RS-3R', 'Vehicle no.', data.vehicleNo || data.trainNo || data.trainSet || '---');
    // Row 3: Product | Assy dwg no.
    drawRow('Product', data.product || data.itemDesc || '---', 'Assy dwg no.', data.assyDwgNo || '---');
    // Row 4: Quantity | Part no.
    drawRow('Quantity', data.qty || '01 no.', 'Part no.', data.partNo || '---');
    // Row 5: Supplier | Assy serial no.
    drawRow('Supplier', data.supplier || data.vendor || data.oem || '---', 'Assy serial no.', data.assySerialNo || '---');
    // Row 6: Detection | Part serial no.
    drawRow('Detection', data.detectionDate || data.date || '---', 'Part serial no.', data.partSerialNo || '---');
    // Row 7: Place | B/L No.
    drawRow('Place', data.place || '---', 'B/L No.', data.blNo || '---');
    // Row 8: Stored at | Invoice no.
    drawRow('Stored at', data.storedAt || '---', 'Invoice no.', data.invoiceNo || '---');

    // Row 9: Severity + Material status + Responsible party (3-column with checkboxes)
    const sevH = 36;
    doc.rect(cL, y, CW, sevH).lineWidth(0.3).stroke();
    doc.moveTo(cL + 130, y).lineTo(cL + 130, y + sevH).lineWidth(0.3).stroke();
    doc.moveTo(cM, y).lineTo(cM, y + sevH).lineWidth(0.3).stroke();

    // Severity
    doc.font('Times-Bold').fontSize(7).fillColor('#000');
    doc.text('Severity', cL + 4, y + 4, { width: 60 });
    let svY = y + 14;
    drawCheckbox(doc, cL + 8, svY, data.severity === 'Major');
    doc.font('Times-Roman').fontSize(6.5).text('Major', cL + 20, svY, { width: 35 });
    drawCheckbox(doc, cL + 55, svY, data.severity === 'Minor');
    doc.text('Minor', cL + 67, svY, { width: 35 });

    // Material status
    doc.font('Times-Bold').fontSize(7).fillColor('#000');
    doc.text('Material status', cL + 134, y + 4, { width: 80 });
    svY = y + 14;
    drawCheckbox(doc, cL + 138, svY, data.materialStatus === 'Before installation');
    doc.font('Times-Roman').fontSize(6.5).text('Before installation', cL + 150, svY, { width: 80 });
    drawCheckbox(doc, cL + 138, svY + 10, data.materialStatus === 'Installed');
    doc.text('Installed', cL + 150, svY + 10, { width: 50 });
    svY = y + 14;
    drawCheckbox(doc, cM + 8, svY, data.materialStatus === 'Before receiving');
    doc.font('Times-Roman').fontSize(6.5).text('Before receiving', cM + 20, svY, { width: 70 });
    drawCheckbox(doc, cM + 8, svY + 10, data.disassembled === 'Yes');
    doc.text('Disassembled', cM + 20, svY + 10, { width: 70 });

    // Responsible party
    doc.font('Times-Bold').fontSize(7).fillColor('#000');
    doc.text('Responsible party', cM + 100, y + 4, { width: 80 });
    doc.font('Times-Roman').fontSize(7);
    doc.text(data.responsibility || data.vendor || '---', cM + 100, y + 18, { width: CW - (cM - cL) - 104 });

    y += sevH;

    // ── DESCRIPTION OF NON-CONFORMITY (black header) ──
    y += 2;
    y = checkPageBreak(doc, y, 80, LM, RM);
    const descHdrH = 14;
    doc.rect(cL, y, CW, descHdrH).fill('#000');
    doc.font('Times-Bold').fontSize(7.5).fillColor('#fff');
    doc.text('Description of non-conformity:', cL + 5, y + 3, { width: CW - 10 });
    y += descHdrH;
    doc.font('Times-Roman').fontSize(7).fillColor('#000');
    const descText = data.ncrDesc || data.description || '---';
    doc.text(descText, cL + 6, y + 4, { width: CW - 12, lineGap: 2 });
    y = doc.y + 2;
    doc.font('Times-Italic').fontSize(6.5).fillColor('#444');
    doc.text('Attached documents (if any): (Picture attached)', cL + 6, y, { width: CW - 12 });
    y += 12;

    // Date + Team + Issued by + Reviewed & approved
    const tblY = y;
    const colW = CW / 4;
    doc.rect(cL, y, CW, 26).lineWidth(0.3).stroke();
    for (let i = 1; i < 4; i++) { doc.moveTo(cL + i * colW, y).lineTo(cL + i * colW, y + 26).lineWidth(0.3).stroke(); }
    doc.font('Times-Bold').fontSize(6.5).fillColor('#000');
    ['Date', 'Team', 'Issued by', 'Reviewed & approved by'].forEach((lbl, i) => {
      doc.text(lbl, cL + i * colW + 4, y + 3, { width: colW - 8 });
    });
    doc.font('Times-Roman').fontSize(6.5);
    doc.text(data.detectionDate || '---', cL + 4, y + 14, { width: colW - 8 });
    doc.text(data.team || 'BEML (S&M)', cL + colW + 4, y + 14, { width: colW - 8 });
    doc.text(data.issuedBy || '---', cL + 2 * colW + 4, y + 14, { width: colW - 8 });
    doc.text(data.reviewedBy || '---', cL + 3 * colW + 4, y + 14, { width: colW - 8 });
    y += 28;

    // ── CAUSE OF NON-CONFORMITY ──
    y = checkPageBreak(doc, y, 60, LM, RM);
    doc.rect(cL, y, CW, descHdrH).fill('#000');
    doc.font('Times-Bold').fontSize(7.5).fillColor('#fff');
    doc.text('Cause of non-conformity:', cL + 5, y + 3, { width: CW - 10 });
    y += descHdrH;
    doc.font('Times-Roman').fontSize(7).fillColor('#000');
    doc.text(data.cause || data.rootCause || '---', cL + 6, y + 4, { width: CW - 12, lineGap: 2 });
    y = doc.y + 2;
    doc.font('Times-Italic').fontSize(6.5).fillColor('#444');
    doc.text('Attached documents (if any):', cL + 6, y, { width: CW - 12 });
    y += 12;

    // ── CORRECTION / CORRECTIVE ACTION RESULT ──
    y = checkPageBreak(doc, y, 70, LM, RM);
    doc.rect(cL, y, CW, descHdrH).fill('#000');
    doc.font('Times-Bold').fontSize(7.5).fillColor('#fff');
    doc.text('Correction / Corrective Action Result:', cL + 5, y + 3, { width: CW - 10 });
    y += descHdrH;
    doc.font('Times-Roman').fontSize(7).fillColor('#000');
    doc.text(data.correctiveAction || data.correction || '---', cL + 6, y + 4, { width: CW - 12, lineGap: 2 });
    y = doc.y + 4;

    // Healthy / Faulty Sl No
    doc.font('Times-Bold').fontSize(7).fillColor('#000');
    doc.text('In (Healthy) Sl. No:', cL + 4, y, { width: 140 });
    doc.text('Out (Faulty) Sl. No:', cL + CW / 2, y, { width: 140 });
    doc.font('Times-Roman').fontSize(7);
    doc.text(data.healthySl || '---', cL + 110, y, { width: 120 });
    doc.text(data.faultySl || '---', cL + CW / 2 + 110, y, { width: 120 });
    y += 12;

    doc.font('Times-Italic').fontSize(6.5).fillColor('#444');
    doc.text('Attached documents (if any):', cL + 6, y, { width: CW - 12 });
    y += 14;

    // ── REVIEWED BY + DECISION ──
    y = checkPageBreak(doc, y, 50, LM, RM);
    doc.rect(cL, y, CW, 24).lineWidth(0.3).stroke();
    doc.moveTo(cL + 120, y).lineTo(cL + 120, y + 24).lineWidth(0.3).stroke();
    doc.moveTo(cL + CW / 2, y).lineTo(cL + CW / 2, y + 24).lineWidth(0.3).stroke();
    doc.font('Times-Bold').fontSize(6.5).fillColor('#000');
    doc.text('Reviewed by', cL + 4, y + 3, { width: 112 });
    doc.text('Date', cL + 124, y + 3, { width: CW / 2 - 128 });
    doc.text('Action by', cL + CW / 2 + 4, y + 3, { width: CW / 2 - 8 });
    doc.font('Times-Roman').fontSize(6.5);
    doc.text(data.reviewedBy || '---', cL + 4, y + 14, { width: 112 });
    doc.text('---', cL + 124, y + 14, { width: CW / 2 - 128 });
    doc.text(data.actionBy || '---', cL + CW / 2 + 4, y + 14, { width: CW / 2 - 8 });
    y += 24;

    // Decision row with checkboxes
    doc.rect(cL, y, CW, 16).lineWidth(0.3).stroke();
    doc.font('Times-Bold').fontSize(6.5).fillColor('#000');
    doc.text('Decision', cL + 4, y + 4, { width: 50 });
    const decs = ['Claim', 'Holding', 'Use as is', 'Rework', 'Waiver', 'Scrap', 'Repair'];
    let dX = cL + 55;
    decs.forEach(d => {
      drawCheckbox(doc, dX, y + 4, data.decision === d);
      doc.font('Times-Roman').fontSize(6).fillColor('#000');
      doc.text(d, dX + 10, y + 4, { width: 45 });
      dX += 58;
    });
    y += 16;

    // Name + Date + Sign row
    doc.rect(cL, y, CW, 14).lineWidth(0.3).stroke();
    doc.font('Times-Bold').fontSize(6.5).fillColor('#000');
    doc.text('Name', cL + 4, y + 3, { width: 120 });
    doc.text('Date', cL + CW / 2, y + 3, { width: 80 });
    doc.text('Sign', cL + CW - 80, y + 3, { width: 76 });
    y += 16;

    // Repair procedure + Approval Scope
    doc.rect(cL, y, CW, 14).lineWidth(0.3).stroke();
    doc.moveTo(cL + CW / 2, y).lineTo(cL + CW / 2, y + 14).lineWidth(0.3).stroke();
    doc.font('Times-Bold').fontSize(6.5).fillColor('#000');
    doc.text('Repair procedure', cL + 4, y + 3, { width: 60 });
    drawCheckbox(doc, cL + 70, y + 3, data.repairProcedure === 'Yes');
    doc.font('Times-Roman').fontSize(6).text('Yes', cL + 82, y + 3, { width: 20 });
    drawCheckbox(doc, cL + 100, y + 3, data.repairProcedure === 'No');
    doc.text('No', cL + 112, y + 3, { width: 20 });
    doc.font('Times-Bold').fontSize(6.5).fillColor('#000');
    doc.text('Approval Scope', cL + CW / 2 + 4, y + 3, { width: 70 });
    drawCheckbox(doc, cL + CW / 2 + 80, y + 3, data.approvalScope === 'Internal');
    doc.font('Times-Roman').fontSize(6).text('Internal', cL + CW / 2 + 92, y + 3, { width: 40 });
    drawCheckbox(doc, cL + CW / 2 + 130, y + 3, data.approvalScope === 'Customer');
    doc.text('Customer', cL + CW / 2 + 142, y + 3, { width: 40 });
    y += 16;

    // ── VERIFICATION ON CORRECTION ──
    y = checkPageBreak(doc, y, 50, LM, RM);
    doc.rect(cL, y, CW, descHdrH).fill('#000');
    doc.font('Times-Bold').fontSize(7.5).fillColor('#fff');
    doc.text('Verification on correction', cL + 5, y + 3, { width: CW - 10 });
    y += descHdrH;

    // Verification table
    doc.rect(cL, y, CW, 22).lineWidth(0.3).stroke();
    const vcolW = CW / 3;
    doc.moveTo(cL + vcolW, y).lineTo(cL + vcolW, y + 22).lineWidth(0.3).stroke();
    doc.moveTo(cL + 2 * vcolW, y).lineTo(cL + 2 * vcolW, y + 22).lineWidth(0.3).stroke();
    doc.font('Times-Bold').fontSize(6.5).fillColor('#000');
    doc.text('Name', cL + 4, y + 3, { width: vcolW - 8 });
    doc.text('Date', cL + vcolW + 4, y + 3, { width: vcolW - 8 });
    doc.text('Sign', cL + 2 * vcolW + 4, y + 3, { width: vcolW - 8 });
    y += 24;

    // ── VERIFICATION ON CORRECTIVE ACTION ──
    doc.rect(cL, y, CW, descHdrH).fill('#000');
    doc.font('Times-Bold').fontSize(7.5).fillColor('#fff');
    doc.text('Verification on corrective action', cL + 5, y + 3, { width: CW - 10 });
    y += descHdrH;

    doc.rect(cL, y, CW, 22).lineWidth(0.3).stroke();
    doc.moveTo(cL + vcolW, y).lineTo(cL + vcolW, y + 22).lineWidth(0.3).stroke();
    doc.moveTo(cL + 2 * vcolW, y).lineTo(cL + 2 * vcolW, y + 22).lineWidth(0.3).stroke();
    doc.font('Times-Bold').fontSize(6.5).fillColor('#000');
    doc.text('Entity', cL + 4, y + 3, { width: vcolW - 8 });
    doc.text('Position', cL + vcolW + 4, y + 3, { width: vcolW - 8 });
    doc.text('Sign', cL + 2 * vcolW + 4, y + 3, { width: vcolW - 8 });
    y += 24;

    // ── APPROVAL ──
    doc.rect(cL, y, CW, descHdrH).fill('#000');
    doc.font('Times-Bold').fontSize(7.5).fillColor('#fff');
    doc.text('Approval', cL + 5, y + 3, { width: CW - 10 });
    y += descHdrH;

    doc.rect(cL, y, CW, 22).lineWidth(0.3).stroke();
    const acolW = CW / 3;
    doc.moveTo(cL + acolW, y).lineTo(cL + acolW, y + 22).lineWidth(0.3).stroke();
    doc.moveTo(cL + 2 * acolW, y).lineTo(cL + 2 * acolW, y + 22).lineWidth(0.3).stroke();
    doc.font('Times-Bold').fontSize(6.5).fillColor('#000');
    doc.text('Approved by', cL + 4, y + 3, { width: acolW - 8 });
    doc.text('Date', cL + acolW + 4, y + 3, { width: acolW - 8 });
    doc.text('Sign', cL + 2 * acolW + 4, y + 3, { width: acolW - 8 });
    y += 24;

    // ── FOOTER ──
    doc.font('Times-Roman').fontSize(6).fillColor('#666');
    doc.text(`NCR: ${data.ncrNo || '---'}`, LM, y + 4, { width: CW, align: 'center' });

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
