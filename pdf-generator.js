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

// Embedded BEML logo as base64 for Vercel compatibility
const BEML_LOGO_B64 = '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';

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
    doc.rect(x + 1, y + 1, 6, 6).fill('#000');
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

// KMRCL/Metro Rail Header - matches MYCEL/KMRCL letter format
function drawKMRCLHeader(doc, W, org) {
  let y = 8;
  
  // Left side: MYCEL info
  doc.font('Times-Bold').fontSize(11).fillColor('#000');
  doc.text('MYCEL', 40, y, { width: 280, align: 'left' });
  y += 16;
  doc.font('Times-Roman').fontSize(8).fillColor('#333');
  doc.text('General Consultants', 40, y, { width: 280, align: 'left' });
  y += 12;
  doc.text('Kolkata East West Metro', 40, y, { width: 280, align: 'left' });
  y += 12;
  doc.text('KMRCL Bhavan, Munshi Premchand Sarani', 40, y, { width: 280, align: 'left' });
  y += 12;
  doc.text('Kolkata - 700 021', 40, y, { width: 280, align: 'left' });
  y += 12;
  doc.text('Tel: +91-33-22314553', 40, y, { width: 280, align: 'left' });
  
  // Right side: Our Ref and Date (will be filled from data in generateLetterPdf)
  y = 8;
  doc.font('Times-Bold').fontSize(9).fillColor('#000');
  doc.text('Our Ref.:', W - 280, y, { width: 80, align: 'right' });
  doc.font('Times-Roman').fontSize(9);
  doc.text('Date:', W - 280, y + 22, { width: 80, align: 'right' });
  
  y = 68;
  doc.moveTo(40, y).lineTo(W - 40, y).lineWidth(1).stroke('#000');
  y += 3;
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
    
    // ── HEADER: Use organization-specific header ──
    let y = 0;
    if (org === 'BEML') {
      // BEML: Use official letterhead image
      const headerPath = getAssetPath('beml-letterhead-header.png');
      if (fs.existsSync(headerPath)) {
        try { doc.image(headerPath, 0, 0, { width: W, fit: [W, 130] }); y = 130; } catch (e) {}
      }
    } else if (org === 'KMRCL' || org === 'Metro Rail') {
      // KMRCL/Metro Rail: Use KMRCL letterhead style with MYCEL/KMRCL branding
      y = drawKMRCLHeader(doc, W, org);
    }
    if (y === 0) {
      y = drawOrgHeader(doc, W, org);
    }
    
    // ── FOOTER: Only for BEML ──
    if (org === 'BEML') {
      drawBEMLFooter(doc, W, H);
    }

    // Fill in Our Ref and Date in KMRCL header (drawn at fixed positions)
    if (org === 'KMRCL' || org === 'Metro Rail') {
      doc.font('Times-Roman').fontSize(9).fillColor('#000');
      doc.text(data.refNumber || '', W - 190, 8, { width: 170, align: 'left' });
      doc.text(data.date ? `${data.date}` : '', W - 190, 30, { width: 170, align: 'left' });
    }

    // ── KMRCL/METRO RAIL LETTER FORMAT ──
    if (org === 'KMRCL' || org === 'Metro Rail') {
      y = drawKMRCLLetterBody(doc, data, L, R, CW, y);
    } else {
      // ── BEML LETTER FORMAT (existing) ──
      y = drawBEMLLetterBody(doc, data, L, R, CW, y);
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

    // ── HEADER: Match exact BEML NCR format from reference ──
    // BEML Logo on left - try multiple sources
    const logoCandidates = [
      path.join(__dirname, 'assets', 'beml-logo.png'),
      path.join(__dirname, 'assets', 'beml-logo.jpg'),
      path.join('/var/task', 'assets', 'beml-logo.png'),
      path.join(process.cwd(), 'assets', 'beml-logo.png'),
    ];
    let logoUsed = false;
    for (const lp of logoCandidates) {
      if (fs.existsSync(lp)) {
        try { doc.image(lp, LM, y, { width: 90, height: 55 }); logoUsed = true; break; } catch (e) {}
      }
    }
    // Fallback: embedded PNG base64 for Vercel
    if (!logoUsed) {
      try {
        const logoBuf = Buffer.from(BEML_LOGO_B64, 'base64');
        doc.image(logoBuf, LM, y, { width: 90, height: 55 });
      } catch (e) { console.log('⚠️ NCR logo failed:', e.message?.substring(0, 80)); }
    }
    
    // Company name in blue (matching reference: Hindi + English)
    const nameX = LM + 100;
    doc.font('Times-Bold').fontSize(12).fillColor('#1a5276');
    doc.text('BEML LIMITED', nameX, y + 8, { width: CW - 100, align: 'center' });
    doc.font('Times-Roman').fontSize(7).fillColor('#333');
    doc.text('(Formally BHARAT EARTH MOVERS LIMITED)', nameX, y + 24, { width: CW - 100, align: 'center' });
    doc.text('(A Govt. of India Mini Ratna Company under Ministry of Defence)', nameX, y + 34, { width: CW - 100, align: 'center' });
    
    y += 58;
    
    // NON-CONFORMITY REPORT title (centered, underlined)
    doc.font('Times-Bold').fontSize(13).fillColor('#000');
    doc.text('NON-CONFORMITY REPORT', LM, y, { width: CW, align: 'center' });
    
    // Underline
    y += 16;
    doc.moveTo(LM + 180, y).lineTo(RM - 180, y).lineWidth(1).stroke('#000');
    
    y += 10;

    // ── MAIN DATA TABLE (2-column format: label|value) ──
    const cL = LM, cM = LM + CW / 2, cR = RM;
    const rH = 18;

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
    // Row 3: Product | Assy dwg no. + Rev
    const prodH = rH;
    doc.rect(cL, y, CW, prodH).lineWidth(0.3).stroke();
    doc.moveTo(cM, y).lineTo(cM, y + prodH).lineWidth(0.3).stroke();
    doc.moveTo(RM - 40, y).lineTo(RM - 40, y + prodH).lineWidth(0.3).stroke();
    doc.font('Times-Bold').fontSize(7).fillColor('#000');
    doc.text('Product', cL + 4, y + 4, { width: 70 });
    doc.font('Times-Roman').fontSize(7);
    doc.text(data.product || data.itemDesc || '---', cL + 78, y + 4, { width: cM - cL - 82 });
    doc.font('Times-Bold').fontSize(7).fillColor('#000');
    doc.text('Assy dwg no.', cM + 4, y + 4, { width: 70 });
    doc.font('Times-Roman').fontSize(7);
    doc.text(data.assyDwgNo || '---', cM + 78, y + 4, { width: cR - cM - 122 });
    doc.font('Times-Bold').fontSize(7).fillColor('#000');
    doc.text('Rev', RM - 36, y + 4, { width: 32, align: 'center' });
    y += prodH;
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

    // Row 9: Severity + Responsible party
    const sevH = 20;
    doc.rect(cL, y, CW, sevH).lineWidth(0.3).stroke();
    doc.moveTo(cM, y).lineTo(cM, y + sevH).lineWidth(0.3).stroke();

    // Severity
    doc.font('Times-Bold').fontSize(7).fillColor('#000');
    doc.text('Severity', cL + 4, y + 4, { width: 60 });
    let svY = y + 6;
    drawCheckbox(doc, cL + 65, svY, data.severity === 'Major');
    doc.font('Times-Roman').fontSize(6.5).text('Major', cL + 77, svY, { width: 35 });
    drawCheckbox(doc, cL + 115, svY, data.severity === 'Minor');
    doc.text('Minor', cL + 127, svY, { width: 35 });

    // Responsible party
    doc.font('Times-Bold').fontSize(7).fillColor('#000');
    doc.text('Responsible party', cM + 4, y + 4, { width: 80 });
    doc.font('Times-Roman').fontSize(7);
    doc.text(data.responsibleParty || data.vendor || data.oem || '---', cM + 88, y + 4, { width: cR - cM - 92 });
    y += sevH;

    // Row 10: Material status
    const matH = 22;
    doc.rect(cL, y, CW, matH).lineWidth(0.3).stroke();
    doc.font('Times-Bold').fontSize(7).fillColor('#000');
    doc.text('Material status', cL + 4, y + 4, { width: 70 });
    
    let matY = y + 6;
    drawCheckbox(doc, cL + 80, matY, data.materialStatus === 'Before installation');
    doc.font('Times-Roman').fontSize(6.5).text('Before installation', cL + 92, matY, { width: 80 });
    drawCheckbox(doc, cL + 200, matY, data.materialStatus === 'Installed');
    doc.text('Installed', cL + 212, matY, { width: 50 });
    drawCheckbox(doc, cM + 80, matY, data.materialStatus === 'Disassembled');
    doc.text('Disassembled', cM + 92, matY, { width: 60 });
    
    matY += 12;
    drawCheckbox(doc, cM + 80, matY, data.materialStatus === 'Before receiving');
    doc.text('Before receiving', cM + 92, matY, { width: 70 });
    y += matH;

    // ── DESCRIPTION OF NON-CONFORMITY (plain bold text, no background) ──
    y += 2;
    y = checkPageBreak(doc, y, 80, LM, RM);
    doc.font('Times-Bold').fontSize(7.5).fillColor('#000');
    doc.text('Description of non-conformity:', cL, y, { width: CW });
    y = doc.y + 2;
    doc.font('Times-Roman').fontSize(7).fillColor('#000');
    const descText = data.ncrDesc || data.description || '---';
    doc.text(descText, cL + 6, y, { width: CW - 12, lineGap: 2 });
    y = doc.y + 2;
    doc.font('Times-Italic').fontSize(6.5).fillColor('#444');
    doc.text('Attached documents (if any): (Picture attached)', cL + 6, y, { width: CW - 12 });
    y += 12;

    // Date + Team + Issued by + Reviewed & approved (4-column)
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

    // ── CAUSE OF NON-CONFORMITY (plain bold text, no background) ──
    y = checkPageBreak(doc, y, 60, LM, RM);
    doc.font('Times-Bold').fontSize(7.5).fillColor('#000');
    doc.text('Cause of non-conformity:', cL, y, { width: CW });
    y = doc.y + 2;
    doc.font('Times-Roman').fontSize(7).fillColor('#000');
    doc.text(data.cause || data.rootCause || '---', cL + 6, y, { width: CW - 12, lineGap: 2 });
    y = doc.y + 2;
    doc.font('Times-Italic').fontSize(6.5).fillColor('#444');
    doc.text('Attached documents (if any):', cL + 6, y, { width: CW - 12 });
    y += 12;

    // ── CORRECTION / CORRECTIVE ACTION RESULT (plain bold text, no background) ──
    y = checkPageBreak(doc, y, 70, LM, RM);
    doc.font('Times-Bold').fontSize(7.5).fillColor('#000');
    doc.text('Correction / Corrective Action Result:', cL, y, { width: CW });
    y = doc.y + 2;
    doc.font('Times-Roman').fontSize(7).fillColor('#000');
    doc.text(data.correctiveAction || data.correction || '---', cL + 6, y, { width: CW - 12, lineGap: 2 });
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

    // ── Date + Action by + Issued by + Reviewed by + Approved by (5-column table) ──
    y = checkPageBreak(doc, y, 50, LM, RM);
    const c5 = CW / 5;
    doc.rect(cL, y, CW, 24).lineWidth(0.3).stroke();
    for (let i = 1; i < 5; i++) { doc.moveTo(cL + i * c5, y).lineTo(cL + i * c5, y + 24).lineWidth(0.3).stroke(); }
    doc.font('Times-Bold').fontSize(6.5).fillColor('#000');
    ['Date', 'Action by', 'Issued by', 'Reviewed by', 'Approved by'].forEach((lbl, i) => {
      doc.text(lbl, cL + i * c5 + 4, y + 3, { width: c5 - 8 });
    });
    doc.font('Times-Roman').fontSize(6.5);
    doc.text(data.date || '---', cL + 4, y + 14, { width: c5 - 8 });
    doc.text(data.actionBy || '---', cL + c5 + 4, y + 14, { width: c5 - 8 });
    doc.text(data.issuedBy || '---', cL + 2 * c5 + 4, y + 14, { width: c5 - 8 });
    doc.text(data.reviewedBy || '---', cL + 3 * c5 + 4, y + 14, { width: c5 - 8 });
    doc.text(data.approvedBy || '---', cL + 4 * c5 + 4, y + 14, { width: c5 - 8 });
    y += 26;

    // ── Decision row with checkboxes ──
    doc.rect(cL, y, CW, 14).lineWidth(0.3).stroke();
    doc.font('Times-Bold').fontSize(6.5).fillColor('#000');
    doc.text('Decision', cL + 4, y + 4, { width: 45 });
    const decs = ['Claim', 'Holding', 'Use as is', 'Rework', 'Waiver', 'Scrap', 'Repair'];
    let dX = cL + 50;
    decs.forEach(d => {
      drawCheckbox(doc, dX, y + 4, data.decision === d);
      doc.font('Times-Roman').fontSize(6).fillColor('#000');
      doc.text(d, dX + 10, y + 4, { width: 42 });
      dX += 52;
    });
    y += 14;

    // ── Repair procedure + Approval Scope ──
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

    // ── VERIFICATION ON CORRECTION (plain bold text, no background) ──
    y = checkPageBreak(doc, y, 50, LM, RM);
    doc.font('Times-Bold').fontSize(7.5).fillColor('#000');
    doc.text('Verification on correction', cL, y, { width: CW });
    y = doc.y + 2;

    // Verification table: Name | Date | Sign
    doc.rect(cL, y, CW, 22).lineWidth(0.3).stroke();
    const vcolW = CW / 3;
    doc.moveTo(cL + vcolW, y).lineTo(cL + vcolW, y + 22).lineWidth(0.3).stroke();
    doc.moveTo(cL + 2 * vcolW, y).lineTo(cL + 2 * vcolW, y + 22).lineWidth(0.3).stroke();
    doc.font('Times-Bold').fontSize(6.5).fillColor('#000');
    doc.text('Name', cL + 4, y + 3, { width: vcolW - 8 });
    doc.text('Date', cL + vcolW + 4, y + 3, { width: vcolW - 8 });
    doc.text('Sign', cL + 2 * vcolW + 4, y + 3, { width: vcolW - 8 });
    y += 24;

    // ── VERIFICATION ON CORRECTIVE ACTION (plain bold text, no background) ──
    doc.font('Times-Bold').fontSize(7.5).fillColor('#000');
    doc.text('Verification on corrective action', cL, y, { width: CW });
    y = doc.y + 2;

    doc.rect(cL, y, CW, 22).lineWidth(0.3).stroke();
    doc.moveTo(cL + vcolW, y).lineTo(cL + vcolW, y + 22).lineWidth(0.3).stroke();
    doc.moveTo(cL + 2 * vcolW, y).lineTo(cL + 2 * vcolW, y + 22).lineWidth(0.3).stroke();
    doc.font('Times-Bold').fontSize(6.5).fillColor('#000');
    doc.text('Entity', cL + 4, y + 3, { width: vcolW - 8 });
    doc.text('Position', cL + vcolW + 4, y + 3, { width: vcolW - 8 });
    doc.text('Sign', cL + 2 * vcolW + 4, y + 3, { width: vcolW - 8 });
    y += 24;

    // ── APPROVED BY (plain bold text, no background) ──
    doc.font('Times-Bold').fontSize(7.5).fillColor('#000');
    doc.text('Approved by', cL, y, { width: CW });
    y = doc.y + 2;

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

// ═══════════════════════════════════════════════════════════════
//  BEML LETTER BODY (Original Format)
// ═══════════════════════════════════════════════════════════════
function drawBEMLLetterBody(doc, data, L, R, CW, y) {
  // REF NUMBER (left) + DATE (right)
  y += 8;
  doc.font('Times-Bold').fontSize(10).fillColor('#000');
  doc.text(data.refNumber || '', L, y, { width: CW / 2 });
  doc.font('Times-Roman').fontSize(10);
  doc.text(data.date ? `Date: ${data.date}` : '', R - 180, y, { width: 180, align: 'right' });
  y += 22;

  // TO ADDRESS BLOCK
  doc.font('Times-Roman').fontSize(10).fillColor('#000');
  doc.text('To,', L, y);
  y += 14;
  if (data.to) {
    let toLines = data.to.split('\n');
    if (toLines.length === 1) toLines = data.to.split(',');
    toLines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed) {
        doc.text(trimmed, L, y, { width: CW });
        y += 13;
      }
    });
  }
  y += 4;

  // KIND ATTENTION (right-aligned)
  if (data.kindAttn) {
    doc.font('Times-Bold').fontSize(10).fillColor('#000');
    doc.text('Kind Attn: ' + data.kindAttn, L, y, { width: CW, align: 'right' });
    y = doc.y + 8;
  }

  // SUBJECT (bold, underlined)
  y += 2;
  doc.font('Times-Bold').fontSize(10).fillColor('#000');
  doc.text('Subject: ' + (data.subject || ''), L, y, { width: CW, underline: true });
  y = doc.y + 10;

  // DEAR SIR
  doc.font('Times-Roman').fontSize(10).fillColor('#000');
  doc.text('Dear Sir,', L, y);
  y = doc.y + 8;

  // LETTER BODY
  let body = data.letterContent || data.letterBody || '';
  body = body.replace(/^(Dear\s+(?:Sir|Madam|Sir\/Madam|Team)[,]?\s*\n?)/i, '').trim();
  body = body.replace(/\n*(Yours\s+(?:sincerely|faithfully|truly)[,]?\s*[\s\S]*)$/i, '').trim();
  
  if (body) {
    const bodyLines = body.split('\n');
    bodyLines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed) {
        const isRef = /^[\(\[].*[\)\]]\s*/.test(trimmed) || /^(?:Ref|Reference)\s*[:\.]/i.test(trimmed) || /^[A-Z]\.\s/.test(trimmed);
        if (isRef) {
          doc.font('Times-Roman').fontSize(10).fillColor('#000');
          doc.text(trimmed, L + 12, y, { width: CW - 12, lineGap: 2, align: 'left' });
        } else {
          doc.font('Times-Roman').fontSize(10).fillColor('#000');
          doc.text(trimmed, L, y, { width: CW, lineGap: 3, align: 'justify' });
        }
        y = doc.y + 3;
      }
    });
    y += 6;
  }

  // CLOSING
  y = checkPageBreak(doc, y, 140, L, R);
  doc.font('Times-Roman').fontSize(10).fillColor('#000');
  doc.text('Yours sincerely,', L, y);
  y = doc.y + 6;
  doc.text('for BEML Limited', L, y);
  y = doc.y + 20;
  if (data.signatory) {
    doc.font('Times-Bold').fontSize(10).fillColor('#000');
    doc.text(data.signatory, L, y);
    y += 12;
  }
  if (data.designation) {
    doc.font('Times-Roman').fontSize(10).fillColor('#000');
    doc.text(data.designation, L, y);
    y += 12;
  }
  return y;
}

// ═══════════════════════════════════════════════════════════════
//  KMRCL/METRO RAIL LETTER BODY (MYCEL/KMRCL Format)
// ═══════════════════════════════════════════════════════════════
function drawKMRCLLetterBody(doc, data, L, R, CW, y) {
  const isMetro = data.organization === 'Metro Rail';
  
  // CONTRACT NO. (left) - from techDetails or default
  y += 2;
  doc.font('Times-Roman').fontSize(10).fillColor('#000');
  doc.text('Contract no.', L, y);
  y += 14;
  const contractNo = data.techDetails || 'KMRC/Contract RS(3R)/2016/1&2 dated 29th Feb 2016.';
  doc.text(contractNo, L, y, { width: CW });
  y += 18;

  // ATTN (right-aligned)
  if (data.kindAttn) {
    doc.font('Times-Bold').fontSize(10).fillColor('#000');
    doc.text('Attn: ' + data.kindAttn, R - 260, y, { width: 260, align: 'right' });
    y = doc.y + 10;
  }

  // TO ADDRESS BLOCK (left)
  doc.font('Times-Roman').fontSize(10).fillColor('#000');
  if (data.to) {
    let toLines = data.to.split('\n');
    if (toLines.length === 1) toLines = data.to.split(',');
    toLines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed) {
        doc.text(trimmed, L, y, { width: CW });
        y += 13;
      }
    });
  }
  y += 8;

  // SUB: with underline
  doc.font('Times-Bold').fontSize(10).fillColor('#000');
  doc.text('Sub: ' + (data.subject || ''), L, y, { width: CW, underline: true });
  y = doc.y + 12;

  // REF: numbered references
  if (data.allReferences) {
    doc.font('Times-Bold').fontSize(10).fillColor('#000');
    doc.text('Ref:', L, y);
    y = doc.y + 6;
    const refs = data.allReferences.split('|');
    refs.forEach((ref, idx) => {
      doc.font('Times-Roman').fontSize(10).fillColor('#000');
      doc.text(`${idx + 1}. ${ref.trim()}`, L + 12, y, { width: CW - 12, lineGap: 2 });
      y = doc.y + 3;
    });
    y += 6;
  }

  // DEAR MADAM,
  doc.font('Times-Roman').fontSize(10).fillColor('#000');
  doc.text('Dear Madam,', L, y);
  y = doc.y + 10;

  // LETTER BODY
  let body = data.letterContent || data.letterBody || '';
  body = body.replace(/^(Dear\s+(?:Sir|Madam|Sir\/Madam|Team)[,]?\s*\n?)/i, '').trim();
  body = body.replace(/\n*(Yours\s+(?:sincerely|faithfully|truly)[,]?\s*[\s\S]*)$/i, '').trim();
  
  if (body) {
    const bodyLines = body.split('\n');
    bodyLines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed) {
        const isRef = /^[\(\[].*[\)\]]\s*/.test(trimmed) || /^(?:Ref|Reference)\s*[:\.]/i.test(trimmed) || /^[A-Z]\.\s/.test(trimmed);
        if (isRef) {
          doc.font('Times-Roman').fontSize(10).fillColor('#000');
          doc.text(trimmed, L + 12, y, { width: CW - 12, lineGap: 2, align: 'left' });
        } else {
          doc.font('Times-Roman').fontSize(10).fillColor('#000');
          doc.text(trimmed, L, y, { width: CW, lineGap: 3, align: 'justify' });
        }
        y = doc.y + 3;
      }
    });
    y += 8;
  }

  // CLOSING - Yours faithfully,
  y = checkPageBreak(doc, y, 140, L, R);
  doc.font('Times-Roman').fontSize(10).fillColor('#000');
  doc.text('Yours faithfully,', L, y);
  y = doc.y + 8;
  
  // Signature scribble "M.."
  doc.text('M..', L, y);
  y = doc.y + 10;
  
  // Signatory in parentheses: (Name)
  if (data.signatory) {
    doc.font('Times-Bold').fontSize(10).fillColor('#000');
    doc.text(`(${data.signatory})`, L, y);
    y += 14;
  }
  // Designation
  if (data.designation) {
    doc.font('Times-Roman').fontSize(10).fillColor('#000');
    doc.text(data.designation, L, y);
    y += 14;
  }
  
  // ENCL:
  if (data.enclosures) {
    y += 6;
    doc.font('Times-Roman').fontSize(10).fillColor('#000');
    doc.text('Encl:', L, y);
    doc.text(data.enclosures, L + 50, y, { width: CW - 50 });
    y += 14;
  }
  
  // CC:
  if (data.cc) {
    y += 2;
    doc.font('Times-Roman').fontSize(10).fillColor('#000');
    doc.text('CC:', L, y);
    y += 14;
    const ccLines = data.cc.split(';');
    ccLines.forEach(cc => {
      doc.text(cc.trim(), L + 12, y, { width: CW - 12, lineGap: 2 });
      y += 14;
    });
  }
  
  return y;
}
