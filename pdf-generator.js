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
      doc.image(footerPath, 0, H - 85, { width: W, fit: [W, 85] });
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
//  BEML LETTER PDF - Official Format
// ══════════════════════════════════════════════════════════════
function generateLetterPdf(data, outputPath) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margins: { top: 0, bottom: 0, left: 0, right: 0 } });
    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);
    const W = A4_W, H = A4_H, L = 55, R = W - 55, CW = R - L;
    const org = data.organization || 'BEML';
    
    // Use official letterhead for BEML, manual header for others
    let y;
    if (org === 'BEML') {
      y = drawBEMLHeader(doc, W);
    } else {
      y = drawOrgHeader(doc, W, org);
    }
    drawBEMLFooter(doc, W, H);

    // Ref number left, Date right
    doc.font('Times-Bold').fontSize(10).fillColor('#000');
    doc.text(data.refNumber || '', L, y, { width: CW / 2 });
    doc.font('Times-Roman').fontSize(10);
    doc.text(data.date ? `Date: ${data.date}` : '', R - 160, y, { width: 160, align: 'right' });
    y += 20;

    // To address block
    if (data.to) {
      doc.font('Times-Bold').fontSize(10).fillColor('#000').text('To,', L, y); y += 14;
      doc.font('Times-Roman').fontSize(10).fillColor('#000');
      const toLines = data.to.split('\n');
      toLines.forEach(line => { doc.text(line.trim(), L + 10, y, { width: CW - 10 }); y += 14; });
      y += 4;
    }

    // Kind Attention
    if (data.kindAttn) {
      doc.font('Times-Bold').fontSize(10).fillColor('#000').text('Kind Attn: ' + data.kindAttn, L, y, { width: CW });
      y += 16;
    }

    // Subject (underlined, bold)
    y += 4;
    doc.font('Times-Bold').fontSize(10).fillColor('#000').text('Subject: ' + (data.subject || ''), L, y, { width: CW, underline: true });
    y += 18;

    // All References
    if (data.allReferences) {
      doc.font('Times-Roman').fontSize(9).fillColor('#333');
      const refLines = data.allReferences.split('\n');
      refLines.forEach(line => { doc.text('Ref: ' + line.trim(), L, y, { width: CW }); y += 12; });
      y += 4;
    }

    // Dear Sir/Madam
    doc.font('Times-Roman').fontSize(10).fillColor('#000').text('Dear Sir/Madam,', L, y); y += 20;

    // Letter body
    const body = data.letterContent || data.letterBody || '';
    doc.font('Times-Roman').fontSize(10).fillColor('#000').text(body, L, y, { width: CW, lineGap: 4, align: 'justify' });
    y = doc.y + 10;

    // Closing
    y = checkPageBreak(doc, y, 120, L, R);
    const orgInfo = ORG_HEADERS[org] || ORG_HEADERS['BEML'];
    doc.font('Times-Roman').fontSize(10).fillColor('#000');
    doc.text('Thanking you,', L, y); y += 16;
    doc.text('Yours faithfully,', L, y); y += 20;
    doc.text(`For ${orgInfo.name}`, L, y); y += 30;

    // Signature block
    doc.font('Times-Bold').fontSize(10).text(data.signatory || '', L, y); y += 14;
    doc.font('Times-Roman').fontSize(10).text(data.designation || '', L, y); y += 12;
    if (data.project) { doc.text(data.project, L, y); y += 12; }

    // Enclosures
    if (data.enclosures) {
      y += 8;
      doc.font('Times-Roman').fontSize(9).fillColor('#333').text('Encl: ' + data.enclosures, L, y, { width: CW });
      y += 14;
    }

    // CC
    if (data.cc) {
      y += 4;
      doc.font('Times-Bold').fontSize(9).fillColor('#333').text('Copy to:', L, y); y += 12;
      doc.font('Times-Roman').fontSize(9);
      const ccLines = data.cc.split('\n');
      ccLines.forEach(line => { if (line.trim()) { doc.text(line.trim(), L + 10, y, { width: CW - 10 }); y += 11; } });
    }

    doc.end();
    stream.on('finish', () => resolve(outputPath));
    stream.on('error', reject);
  });
}

// ══════════════════════════════════════════════════════════════
//  NCR PDF - Official BEML Non-Conformity Report Format
// ══════════════════════════════════════════════════════════════
function generateNCRPdf(data, outputPath) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margins: { top: 0, bottom: 0, left: 0, right: 0 } });
    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);
    const W = A4_W, H = A4_H, L = 40, R = W - 40, CW = R - L;
    let y = 12;

    // ── HEADER - Use official NCR header image ──
    const ncrHeaderPath = getAssetPath('ncr-header.png');
    if (fs.existsSync(ncrHeaderPath)) {
      try {
        doc.image(ncrHeaderPath, 0, 0, { width: W, fit: [W, 60] });
        y = 65;
      } catch (e) {
        // Fallback to manual header
        const logoPath = getAssetPath('beml-logo.jpg');
        if (fs.existsSync(logoPath)) {
          try { doc.image(logoPath, 12, y, { width: 55, height: 25, fit: 'contain' }); } catch (e2) {}
        }
        doc.font('Times-Bold').fontSize(12).fillColor('#000').text('NON-CONFORMITY REPORT', 0, y, { width: W, align: 'center' });
        y += 18;
      }
    } else {
      const logoPath = getAssetPath('beml-logo.jpg');
      if (fs.existsSync(logoPath)) {
        try { doc.image(logoPath, 12, y, { width: 55, height: 25, fit: 'contain' }); } catch (e) {}
      }
      doc.font('Times-Bold').fontSize(12).fillColor('#000').text('NON-CONFORMITY REPORT', 0, y, { width: W, align: 'center' });
      y += 18;
    }

    // ── TOP INFO BAR (OEM/SBU info + Report no) ──
    const barH = 28;
    doc.rect(L, y, CW, barH).lineWidth(0.4).stroke();
    doc.font('Times-Roman').fontSize(7).fillColor('#000');
    doc.text('OEM/ SBU-S&M / R&D/ PM/Purchase/ Quality', L + 4, y + 3, { width: CW / 2 - 10 });
    doc.text(data.trainSet ? `${data.trainSet} ${data.car || ''} ${data.line || ''}` : '', L + 4, y + 13, { width: CW / 2 - 10 });
    doc.font('Times-Bold').fontSize(7.5);
    doc.text('Report no.', R - CW / 2 + 10, y + 3, { width: 60 });
    doc.font('Times-Roman').fontSize(7.5);
    doc.text(data.ncrNo || '---', R - CW / 2 + 70, y + 3, { width: CW / 2 - 80 });
    doc.font('Times-Bold').fontSize(7.5);
    doc.text('Distribution to:', R - CW / 2 + 10, y + 15, { width: 70 });
    doc.font('Times-Roman').fontSize(7.5);
    doc.text(data.distribution || '---', R - CW / 2 + 80, y + 15, { width: CW / 2 - 90 });
    y += barH;

    // ── MAIN DATA TABLE (4 columns: label1 | value1 | label2 | value2) ──
    const col1 = L, col2 = L + 90, col3 = L + CW / 2, col4 = L + CW / 2 + 85, col5 = R;
    const rowH = 17;

    function drawCellRow(l1, v1, l2, v2, h) {
      const rh = h || rowH;
      doc.moveTo(col1, y + rh).lineTo(col5, y + rh).lineWidth(0.3).stroke();
      doc.moveTo(col2, y).lineTo(col2, y + rh).lineWidth(0.3).stroke();
      doc.moveTo(col3, y).lineTo(col3, y + rh).lineWidth(0.3).stroke();
      doc.moveTo(col4, y).lineTo(col4, y + rh).lineWidth(0.3).stroke();
      doc.font('Times-Bold').fontSize(7).fillColor('#000');
      doc.text(l1, col1 + 3, y + 4, { width: col2 - col1 - 6 });
      if (l2) doc.text(l2, col3 + 3, y + 4, { width: col4 - col3 - 6 });
      doc.font('Times-Roman').fontSize(7.5);
      if (v1 !== undefined) doc.text(v1 || '---', col2 + 3, y + 4, { width: col3 - col2 - 6 });
      if (v2 !== undefined) doc.text(v2 || '---', col4 + 3, y + 4, { width: col5 - col4 - 6 });
      y += rh;
    }

    // Row 1: Project + Vehicle no
    drawCellRow('Project', data.project || '---', 'Vehicle no.', data.vehicleNo || data.trainSet || '---');
    // Row 2: Product + Assy dwg no
    drawCellRow('Product', data.product || data.itemDesc || '---', 'Assy dwg no.', data.assyDwgNo || '---');
    // Row 3: Quantity + Part no
    drawCellRow('Quantity', data.qty || '---', 'Part no.', data.partNo || '---');
    // Row 4: Supplier + Assy serial no
    drawCellRow('Supplier', data.supplier || data.vendor || data.oem || '---', 'Assy serial no.', data.assySerialNo || '---');
    // Row 5: Detection + Part serial no
    drawCellRow('Detection', data.detectionDate || '---', 'Part serial no.', data.partSerialNo || '---');
    // Row 6: Place + B/L No
    drawCellRow('Place', data.place || data.location || '---', 'B/L No.', data.blNo || '---');
    // Row 7: Stored at + Invoice no
    drawCellRow('Stored at', data.storedAt || '---', 'Invoice no.', data.invoiceNo || '---');

    // Row 8: Severity + Material status (with checkboxes)
    const sevRowH = 28;
    doc.moveTo(col1, y + sevRowH).lineTo(col5, y + sevRowH).lineWidth(0.3).stroke();
    doc.moveTo(col2, y).lineTo(col2, y + sevRowH).lineWidth(0.3).stroke();
    doc.moveTo(col3, y).lineTo(col3, y + sevRowH).lineWidth(0.3).stroke();
    doc.font('Times-Bold').fontSize(7).fillColor('#000');
    doc.text('Severity', col1 + 3, y + 4, { width: col2 - col1 - 6 });
    doc.text('Material status', col3 + 3, y + 4, { width: col4 - col3 - 6 });
    const svY = y + 13;
    drawCheckbox(doc, col2 + 5, svY, data.severity === 'Critical');
    doc.font('Times-Roman').fontSize(6.5).text(' Critical', col2 + 14, svY, { width: 45 });
    drawCheckbox(doc, col2 + 55, svY, data.severity === 'Major');
    doc.text(' Major', col2 + 64, svY, { width: 40 });
    drawCheckbox(doc, col2 + 100, svY, data.severity === 'Minor');
    doc.text(' Minor', col2 + 109, svY, { width: 40 });
    const msY = y + 6;
    drawCheckbox(doc, col3 + 5, msY, data.materialStatus === 'Before installation');
    doc.font('Times-Roman').fontSize(6.5).text(' Before installation', col3 + 14, msY, { width: 90 });
    drawCheckbox(doc, col3 + 5, msY + 10, data.materialStatus === 'Installed');
    doc.text(' Installed', col3 + 14, msY + 10, { width: 60 });
    drawCheckbox(doc, col3 + 80, msY + 10, data.materialStatus === 'Before receiving');
    doc.text(' Before receiving', col3 + 89, msY + 10, { width: 80 });
    y += sevRowH;

    // Row 9: Responsible party + Disassembled
    const respRowH = 17;
    doc.moveTo(col1, y + respRowH).lineTo(col5, y + respRowH).lineWidth(0.3).stroke();
    doc.moveTo(col2, y).lineTo(col2, y + respRowH).lineWidth(0.3).stroke();
    doc.moveTo(col3, y).lineTo(col3, y + respRowH).lineWidth(0.3).stroke();
    doc.font('Times-Bold').fontSize(7).fillColor('#000');
    doc.text('Responsible party', col1 + 3, y + 4, { width: col2 - col1 - 6 });
    doc.text('Disassembled', col3 + 3, y + 4, { width: col4 - col3 - 6 });
    doc.font('Times-Roman').fontSize(7.5);
    doc.text(data.responsibility || '---', col2 + 3, y + 4, { width: col3 - col2 - 6 });
    drawCheckbox(doc, col4 + 5, y + 5, data.disassembled === 'Yes');
    doc.font('Times-Roman').fontSize(6.5).text(' Yes', col4 + 14, y + 5, { width: 30 });
    y += respRowH;

    // ── OUTERMOST BORDER ──
    // (Already drawn by rows)

    // ── DESCRIPTION OF NON-CONFORMITY ──
    y += 4;
    y = checkPageBreak(doc, y, 70, L, R);
    doc.moveTo(col1, y).lineTo(col5, y).lineWidth(0.4).stroke();
    doc.font('Times-Bold').fontSize(7.5).fillColor('#000').text('Description of non-conformity:', col1 + 3, y + 4);
    y += 14;
    doc.font('Times-Roman').fontSize(7.5).fillColor('#000').text(data.ncrDesc || '---', col1 + 6, y, { width: CW - 12, lineGap: 2 });
    y = doc.y + 4;
    doc.font('Times-Italic').fontSize(6.5).fillColor('#444').text('Attached documents (if any):', col1 + 3, y);
    y += 10;
    doc.moveTo(col1, y).lineTo(col5, y).lineWidth(0.4).stroke();
    y += 2;

    // ── ATTACHED DOCUMENTS TABLE ──
    y = checkPageBreak(doc, y, 30, L, R);
    const tC = [col1, col1 + 80, col1 + 180, col1 + 300, col5];
    const tH = 13;
    doc.moveTo(col1, y).lineTo(col5, y).lineWidth(0.3).stroke();
    doc.moveTo(col1, y + tH).lineTo(col5, y + tH).lineWidth(0.3).stroke();
    tC.forEach((cx, i) => { if (i > 0) doc.moveTo(cx, y).lineTo(cx, y + tH).lineWidth(0.3).stroke(); });
    doc.font('Times-Bold').fontSize(6.5).fillColor('#000');
    doc.text('Date', tC[0] + 2, y + 3, { width: 76 });
    doc.text('Team', tC[1] + 2, y + 3, { width: 96 });
    doc.text('Issued by', tC[2] + 2, y + 3, { width: 116 });
    doc.text('Reviewed & approved by', tC[3] + 2, y + 3, { width: R - tC[3] - 2 });
    y += tH;
    doc.font('Times-Roman').fontSize(7);
    doc.text(data.detectionDate || '---', tC[0] + 2, y + 3, { width: 76 });
    doc.text(data.team || '---', tC[1] + 2, y + 3, { width: 96 });
    doc.text(data.issuedBy || '---', tC[2] + 2, y + 3, { width: 116 });
    doc.text(data.reviewedBy || '---', tC[3] + 2, y + 3, { width: R - tC[3] - 2 });
    y += tH + 4;

    // ── CAUSE OF NON-CONFORMITY ──
    y = checkPageBreak(doc, y, 60, L, R);
    doc.moveTo(col1, y).lineTo(col5, y).lineWidth(0.4).stroke();
    doc.font('Times-Bold').fontSize(7.5).fillColor('#000').text('Cause of non-conformity:', col1 + 3, y + 4);
    y += 14;
    doc.font('Times-Roman').fontSize(7.5).text(data.cause || data.rootCause || '---', col1 + 6, y, { width: CW - 12, lineGap: 2 });
    y = doc.y + 4;
    doc.font('Times-Italic').fontSize(6.5).fillColor('#444').text('Attached documents (if any):', col1 + 3, y);
    y += 10;
    doc.moveTo(col1, y).lineTo(col5, y).lineWidth(0.4).stroke();
    y += 2;

    // ── CORRECTION / CORRECTIVE ACTION RESULT ──
    y = checkPageBreak(doc, y, 70, L, R);
    doc.moveTo(col1, y).lineTo(col5, y).lineWidth(0.4).stroke();
    doc.font('Times-Bold').fontSize(7.5).fillColor('#000').text('Correction / Corrective Action Result:', col1 + 3, y + 4);
    y += 14;
    doc.font('Times-Roman').fontSize(7.5).text(data.correction || data.correctiveAction || '---', col1 + 6, y, { width: CW - 12, lineGap: 2 });
    y = doc.y + 3;
    if (data.healthySl || data.faultySl) {
      doc.font('Times-Roman').fontSize(7.5);
      if (data.healthySl) { doc.text('In (Healthy) Sl. No: ' + data.healthySl, col1 + 10, y); y += 11; }
      if (data.faultySl) { doc.text('Out (Faulty) Sl. No: ' + data.faultySl, col1 + 10, y); y += 11; }
    }
    doc.font('Times-Italic').fontSize(6.5).fillColor('#444').text('Attached documents (if any):', col1 + 3, y);
    y += 10;
    doc.moveTo(col1, y).lineTo(col5, y).lineWidth(0.4).stroke();
    y += 2;

    // ── REVIEW TABLE ──
    y = checkPageBreak(doc, y, 50, L, R);
    const rC = [col1, col1 + 55, col1 + 140, col1 + 280, col1 + 350, col5];
    const rH = 14;
    // Header row
    doc.moveTo(col1, y).lineTo(col5, y).lineWidth(0.3).stroke();
    doc.moveTo(col1, y + rH).lineTo(col5, y + rH).lineWidth(0.3).stroke();
    rC.forEach((cx, i) => { if (i > 0) doc.moveTo(cx, y).lineTo(cx, y + rH + rH).lineWidth(0.3).stroke(); });
    doc.font('Times-Bold').fontSize(6.5).fillColor('#000');
    doc.text('Reviewed by', rC[0] + 2, y + 3, { width: 50 });
    doc.text('Date', rC[1] + 2, y + 3, { width: 80 });
    doc.text('Action by', rC[2] + 2, y + 3, { width: 130 });
    doc.text('Decision', rC[3] + 2, y + 3, { width: 65 });
    doc.text('Name', rC[4] + 2, y + 3, { width: R - rC[4] - 2 });
    y += rH;
    // Decision checkboxes in review row
    const dY = y + 3;
    let dX = rC[3] + 2;
    ['Claim', 'Holding', 'Use as is', 'Rework'].forEach(d => {
      drawCheckbox(doc, dX, dY, data.decision === d);
      doc.font('Times-Roman').fontSize(5.5).text(d, dX + 9, dY, { width: 50 });
      dX += 48;
    });
    doc.font('Times-Roman').fontSize(6.5);
    doc.text('Date', rC[4] + 2, y + 3, { width: R - rC[4] - 2 });
    y += rH;

    // Second review row
    doc.moveTo(col1, y + rH).lineTo(col5, y + rH).lineWidth(0.3).stroke();
    rC.forEach((cx, i) => { if (i > 0) doc.moveTo(cx, y).lineTo(cx, y + rH).lineWidth(0.3).stroke(); });
    const dY2 = y + 3;
    let dX2 = rC[3] + 2;
    ['Waiver', 'Scrap', 'Repair'].forEach(d => {
      drawCheckbox(doc, dX2, dY2, data.decision === d);
      doc.font('Times-Roman').fontSize(5.5).text(d, dX2 + 9, dY2, { width: 50 });
      dX2 += 48;
    });
    doc.font('Times-Bold').fontSize(6.5).fillColor('#000');
    doc.text('Sign', rC[4] + 2, y + 3, { width: R - rC[4] - 2 });
    y += rH + 2;

    // ── VERIFICATION TABLE ──
    y = checkPageBreak(doc, y, 40, L, R);
    const vC = [col1, col1 + 110, col1 + 180, col5];
    const vH = 14;
    // Verification on correction
    doc.moveTo(col1, y).lineTo(col5, y).lineWidth(0.3).stroke();
    doc.moveTo(col1, y + vH).lineTo(col5, y + vH).lineWidth(0.3).stroke();
    vC.forEach((cx, i) => { if (i > 0) doc.moveTo(cx, y).lineTo(cx, y + vH * 2).lineWidth(0.3).stroke(); });
    doc.font('Times-Bold').fontSize(6.5).fillColor('#000');
    doc.text('Verification on correction', col1 + 3, y + 4, { width: vC[1] - col1 - 6 });
    doc.text('Name', vC[1] + 2, y + 4, { width: vC[2] - vC[1] - 4 });
    doc.text('Date', vC[2] + 2, y + 4, { width: vC[3] - vC[2] - 4 });
    doc.text('Sign', vC[3] + 2, y + 4, { width: R - vC[3] - 2 });
    y += vH;
    // Verification on corrective action
    doc.moveTo(col1, y + vH).lineTo(col5, y + vH).lineWidth(0.3).stroke();
    vC.forEach((cx, i) => { if (i > 0) doc.moveTo(cx, y).lineTo(cx, y + vH).lineWidth(0.3).stroke(); });
    doc.font('Times-Bold').fontSize(6.5).fillColor('#000');
    doc.text('Verification on corrective action', col1 + 3, y + 4, { width: vC[1] - col1 - 6 });
    y += vH;

    // ── APPROVAL TABLE ──
    y = checkPageBreak(doc, y, 40, L, R);
    const aC = [col1, col1 + 60, col1 + 180, col1 + 300, col5];
    const aH = 14;
    doc.moveTo(col1, y).lineTo(col5, y).lineWidth(0.3).stroke();
    doc.moveTo(col1, y + aH).lineTo(col5, y + aH).lineWidth(0.3).stroke();
    aC.forEach((cx, i) => { if (i > 0) doc.moveTo(cx, y).lineTo(cx, y + aH).lineWidth(0.3).stroke(); });
    doc.font('Times-Bold').fontSize(6.5).fillColor('#000');
    doc.text('Approved by', aC[0] + 2, y + 3, { width: 55 });
    doc.text('Entity', aC[1] + 2, y + 3, { width: 116 });
    doc.text('Position', aC[2] + 2, y + 3, { width: 116 });
    doc.text('Sign', aC[3] + 2, y + 3, { width: R - aC[3] - 2 });
    y += aH;
    // Approval scope row
    doc.moveTo(col1, y + aH).lineTo(col5, y + aH).lineWidth(0.3).stroke();
    aC.forEach((cx, i) => { if (i > 0) doc.moveTo(cx, y).lineTo(cx, y + aH).lineWidth(0.3).stroke(); });
    doc.font('Times-Bold').fontSize(6.5).fillColor('#000');
    doc.text('Approval', col1 + 3, y + 4, { width: 55 });
    const apprY = y + 4;
    drawCheckbox(doc, aC[0] + 3, apprY + 10, data.approvalScope === 'Internal');
    doc.font('Times-Roman').fontSize(6).text(' Internal', aC[0] + 12, apprY + 10, { width: 40 });
    drawCheckbox(doc, aC[0] + 55, apprY + 10, data.approvalScope === 'Customer');
    doc.text(' Customer', aC[0] + 64, apprY + 10, { width: 45 });
    doc.text(data.approvedBy || '---', aC[1] + 2, y + 4, { width: 116 });
    doc.text(data.approvedPosition || '---', aC[2] + 2, y + 4, { width: 116 });
    doc.font('Times-Bold').fontSize(6.5);
    doc.text('Issued by', aC[3] + 2, y + 4, { width: R - aC[3] - 2 });
    y += aH;

    // ── REPAIR PROCEDURE ──
    y = checkPageBreak(doc, y, 20, L, R);
    doc.moveTo(col1, y).lineTo(col5, y).lineWidth(0.3).stroke();
    doc.font('Times-Bold').fontSize(7).fillColor('#000').text('Repair procedure', col1 + 3, y + 4);
    drawCheckbox(doc, col1 + 90, y + 5, data.repairProcedure === 'Yes');
    doc.font('Times-Roman').fontSize(7).text(' Yes', col1 + 99, y + 5, { width: 25 });
    drawCheckbox(doc, col1 + 125, y + 5, data.repairProcedure === 'No');
    doc.text(' No', col1 + 134, y + 5, { width: 25 });
    y += 16;
    doc.moveTo(col1, y).lineTo(col5, y).lineWidth(0.4).stroke();

    // ── BEML FOOTER ──
    drawBEMLFooter(doc, W, H);

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
