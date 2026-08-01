import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Document, Packer, Paragraph, TextRun, AlignmentType, BorderStyle, TableRow, TableCell, Table, WidthType } from 'docx';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
    doc.save().fontSize(9).font('Helvetica-Bold').text('\u2588', x + 0.5, y - 0.5, { width: 8, align: 'center' }).restore();
  }
}

// ══════════════════════════════════════════════════════════════
//  BEML LETTER HEADER - Official Format
// ══════════════════════════════════════════════════════════════
function drawBEMLHeader(doc, W) {
  const logoPath = path.join(__dirname, 'assets', 'beml-logo.jpg');
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
  const footerPath = path.join(__dirname, 'assets', 'beml-letterhead-footer.png');
  if (fs.existsSync(footerPath)) {
    try {
      doc.save();
      doc.opacity(0.6);
      doc.image(footerPath, 0, H - 100, { width: W });
      doc.restore();
      return;
    } catch (e) {}
  }
  doc.save();
  doc.moveTo(40, H - 75).lineTo(W - 40, H - 75).lineWidth(0.5).stroke('#999');
  doc.font('Times-Roman').fontSize(6.5).fillColor('#555');
  doc.text('Registered Office: BEML Bhavan, No.1, Outer Ring Road, Bengaluru - 560068', 40, H - 70, { width: W - 80, align: 'center' });
  doc.text('CIN: L35109KA1964GOI001758 | Ph: +91-80-2524 1752 | Email: info@beml.co.in | www.beml.co.in', 40, H - 60, { width: W - 80, align: 'center' });
  doc.restore();
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
    let y = drawBEMLHeader(doc, W);
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
    doc.font('Times-Roman').fontSize(10).fillColor('#000');
    doc.text('Thanking you,', L, y); y += 16;
    doc.text('Yours faithfully,', L, y); y += 20;
    doc.text('For BEML Limited', L, y); y += 30;

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

    // Header: Logo + Company
    const logoPath = path.join(__dirname, 'assets', 'beml-logo.jpg');
    if (fs.existsSync(logoPath)) {
      try { doc.image(logoPath, 12, y, { width: 60, height: 30, fit: 'contain' }); } catch (e) {}
    }
    doc.font('Times-Bold').fontSize(14).fillColor('#000').text('BEML LIMITED', 0, y + 2, { width: W, align: 'center' });
    y += 18;
    doc.font('Times-Roman').fontSize(7).fillColor('#333').text('A Government of India Enterprise | Ministry of Defence', 0, y, { width: W, align: 'center' });
    y += 12;
    doc.moveTo(L, y).lineTo(R, y).lineWidth(1).stroke('#000');
    y += 8;

    // Title
    doc.font('Times-Bold').fontSize(13).fillColor('#000').text('NON-CONFORMITY REPORT', 0, y, { width: W, align: 'center' });
    y += 20;

    // NCR Number and Date row
    const c1 = L, c2 = L + 130, c3 = L + 300, c4 = R, rowH = 20;
    function drawRow(l1, v1, l2, v2, h) {
      const rh = h || rowH;
      doc.moveTo(c1, y + rh).lineTo(c4, y + rh).lineWidth(0.4).stroke();
      doc.moveTo(c2, y).lineTo(c2, y + rh).lineWidth(0.4).stroke();
      if (l2) doc.moveTo(c3, y).lineTo(c3, y + rh).lineWidth(0.4).stroke();
      doc.font('Times-Bold').fontSize(7.5).fillColor('#000');
      if (l1) doc.text(l1, c1 + 3, y + 4, { width: c2 - c1 - 6 });
      if (l2) doc.text(l2, c3 + 3, y + 4, { width: c4 - c3 - 6 });
      doc.font('Helvetica').fontSize(8);
      if (v1 !== undefined) doc.text(v1 || '---', c2 + 3, y + 4, { width: c3 - c2 - 6 });
      if (v2 !== undefined) doc.text(v2 || '---', c4 + 3, y + 4, { width: R - c4 - 6 });
      y += rh;
    }

    // Row 1: NCR No + Date
    drawRow('NCR Report No.', data.ncrNo, 'Date of NCR:', data.date);
    // Row 2: Project + Detection Date
    drawRow('Project:', data.project, 'Date of Detection:', data.detectionDate);
    // Row 3: Issued By + Issued To (Responsibility)
    drawRow('Issued By:', data.issuedBy || data.raisedBy, 'Issued To (Responsibility):', data.responsibility);
    // Row 4: Product/Item
    doc.moveTo(c1, y + rowH).lineTo(c4, y + rowH).lineWidth(0.4).stroke();
    doc.font('Times-Bold').fontSize(7.5).fillColor('#000').text('Item Description:', c1 + 3, y + 4, { width: c2 - c1 - 6 });
    doc.font('Helvetica').fontSize(8).text(data.itemDesc || data.product || '---', c2 + 3, y + 4, { width: c4 - c2 - 6 });
    y += rowH;
    // Row 5: Part No + Qty
    drawRow('Part Number:', data.partNo, 'Quantity:', data.qty);
    // Row 6: Train Set + Car
    drawRow('Train Set / Train No:', data.trainSet || data.trainNo || data.vehicleNo, 'Car / Vehicle:', data.car);
    // Row 7: Vendor/OEM + Location
    drawRow('Vendor / OEM:', data.vendor || data.supplier || data.oem, 'Location:', data.location || data.place);
    // Row 8: Sub-System + System
    drawRow('Sub-System:', data.subSystem, 'System:', data.system);

    y += 2;

    // Severity row with checkboxes
    doc.moveTo(c1, y + rowH).lineTo(c4, y + rowH).lineWidth(0.4).stroke();
    doc.moveTo(c2, y).lineTo(c2, y + rowH).lineWidth(0.4).stroke();
    doc.font('Times-Bold').fontSize(7.5).fillColor('#000').text('Severity:', c1 + 3, y + 4, { width: c2 - c1 - 6 });
    const sv = y + 6;
    drawCheckbox(doc, c2 + 8, sv, data.severity === 'Critical');
    doc.font('Helvetica').fontSize(7.5).text(' Critical', c2 + 18, sv, { width: 55 });
    drawCheckbox(doc, c2 + 70, sv, data.severity === 'Major');
    doc.text(' Major', c2 + 80, sv, { width: 50 });
    drawCheckbox(doc, c2 + 120, sv, data.severity === 'Minor');
    doc.text(' Minor', c2 + 130, sv, { width: 50 });
    doc.font('Times-Bold').fontSize(7.5).text('NCR Category:', c3 + 3, y + 4, { width: c4 - c3 - 6 });
    doc.font('Helvetica').fontSize(8).text(data.ncrCategory || '---', c4 + 3, y + 4, { width: R - c4 - 6 });
    y += rowH;

    // Description of Non-Conformity
    y = checkPageBreak(doc, y, 80, L, R);
    doc.moveTo(c1, y).lineTo(c4, y).lineWidth(0.4).stroke();
    doc.font('Times-Bold').fontSize(8).fillColor('#000').text('Description of Non-Conformity:', c1 + 3, y + 4);
    y += 14;
    doc.font('Helvetica').fontSize(8).fillColor('#000').text(data.ncrDesc || '---', c1 + 6, y, { width: CW - 12, lineGap: 3 });
    const descLines = Math.ceil((data.ncrDesc || '').length / 90);
    y += Math.max(25, descLines * 11 + 15);
    doc.moveTo(c1, y).lineTo(c4, y).lineWidth(0.4).stroke();
    y += 4;

    // Attached Documents table
    y = checkPageBreak(doc, y, 60, L, R);
    doc.font('Times-Bold').fontSize(7).fillColor('#666').text('Attached Documents (if any):', c1 + 3, y);
    y += 10;
    const tC = [c1, c1 + 80, c1 + 200, c1 + 320, c4];
    const tH = 14;
    doc.moveTo(c1, y).lineTo(c4, y).lineWidth(0.3).stroke();
    doc.moveTo(c1, y + tH).lineTo(c4, y + tH).lineWidth(0.3).stroke();
    tC.forEach((cx, i) => { if (i > 0) doc.moveTo(cx, y).lineTo(cx, y + tH).lineWidth(0.3).stroke(); });
    doc.font('Times-Bold').fontSize(6.5).fillColor('#000');
    doc.text('Date', tC[0] + 2, y + 3, { width: 76 });
    doc.text('Team', tC[1] + 2, y + 3, { width: 116 });
    doc.text('Issued By', tC[2] + 2, y + 3, { width: 116 });
    doc.text('Reviewed & Approved By', tC[3] + 2, y + 3, { width: R - tC[3] - 2 });
    y += tH;
    doc.font('Helvetica').fontSize(7);
    doc.text(data.detectionDate || '---', tC[0] + 2, y + 3, { width: 76 });
    doc.text(data.team || '---', tC[1] + 2, y + 3, { width: 116 });
    doc.text(data.issuedBy || '---', tC[2] + 2, y + 3, { width: 116 });
    doc.text(data.reviewedBy || '---', tC[3] + 2, y + 3, { width: R - tC[3] - 2 });
    y += tH + 6;

    // Cause of Non-Conformity
    y = checkPageBreak(doc, y, 60, L, R);
    doc.moveTo(c1, y).lineTo(c4, y).lineWidth(0.4).stroke();
    doc.font('Times-Bold').fontSize(8).fillColor('#000').text('Cause of Non-Conformity:', c1 + 3, y + 4);
    y += 14;
    doc.font('Helvetica').fontSize(8).text(data.cause || data.rootCause || '---', c1 + 6, y, { width: CW - 12, lineGap: 3 });
    const causeLines = Math.ceil((data.cause || data.rootCause || '').length / 90);
    y += Math.max(20, causeLines * 11 + 10);
    doc.moveTo(c1, y).lineTo(c4, y).lineWidth(0.4).stroke();
    y += 6;

    // Correction / Corrective Action
    y = checkPageBreak(doc, y, 70, L, R);
    doc.moveTo(c1, y).lineTo(c4, y).lineWidth(0.4).stroke();
    doc.font('Times-Bold').fontSize(8).fillColor('#000').text('Correction / Corrective Action Result:', c1 + 3, y + 4);
    y += 14;
    doc.font('Helvetica').fontSize(8).text(data.correction || data.correctiveAction || '---', c1 + 6, y, { width: CW - 12, lineGap: 3 });
    const corrLines = Math.ceil((data.correction || data.correctiveAction || '').length / 90);
    y += Math.max(20, corrLines * 11 + 10);
    if (data.healthySl || data.faultySl) {
      doc.font('Helvetica').fontSize(8);
      if (data.healthySl) { doc.text('Healthy Sl. No: ' + data.healthySl, c1 + 20, y); y += 11; }
      if (data.faultySl) { doc.text('Faulty Sl. No: ' + data.faultySl, c1 + 20, y); y += 11; }
    }
    doc.moveTo(c1, y).lineTo(c4, y).lineWidth(0.4).stroke();
    y += 6;

    // Preventive Action
    y = checkPageBreak(doc, y, 40, L, R);
    doc.moveTo(c1, y).lineTo(c4, y).lineWidth(0.4).stroke();
    doc.font('Times-Bold').fontSize(8).fillColor('#000').text('Preventive Action:', c1 + 3, y + 4);
    y += 14;
    doc.font('Helvetica').fontSize(8).text(data.preventiveAction || '---', c1 + 6, y, { width: CW - 12, lineGap: 3 });
    const prevLines = Math.ceil((data.preventiveAction || '').length / 90);
    y += Math.max(18, prevLines * 11 + 8);
    doc.moveTo(c1, y).lineTo(c4, y).lineWidth(0.4).stroke();
    y += 6;

    // Decision checkboxes
    y = checkPageBreak(doc, y, 40, L, R);
    doc.moveTo(c1, y).lineTo(c4, y).lineWidth(0.4).stroke();
    doc.font('Times-Bold').fontSize(8).fillColor('#000').text('Decision:', c1 + 3, y + 4);
    y += 14;
    const decisions = ['Claim', 'Holding', 'Use as is', 'Rework', 'Waiver', 'Scrap', 'Repair'];
    let dx = c1 + 10;
    decisions.forEach(d => {
      drawCheckbox(doc, dx, y, data.decision === d);
      doc.font('Helvetica').fontSize(7).text(' ' + d, dx + 10, y, { width: 55 });
      dx += 65;
      if (dx > c4 - 60) { dx = c1 + 10; y += 12; }
    });
    y += 16;
    doc.moveTo(c1, y).lineTo(c4, y).lineWidth(0.4).stroke();
    y += 6;

    // Status and Closure
    y = checkPageBreak(doc, y, 50, L, R);
    doc.moveTo(c1, y).lineTo(c4, y).lineWidth(0.4).stroke();
    doc.font('Times-Bold').fontSize(8).fillColor('#000').text('Status & Closure:', c1 + 3, y + 4);
    y += 14;
    doc.font('Helvetica').fontSize(8);
    doc.text('Status: ' + (data.status || 'Open'), c1 + 6, y, { width: 200 });
    doc.text('Closure Date: ' + (data.closureDate || '---'), c1 + 220, y, { width: 150 });
    doc.text('Closure Authority: ' + (data.closureAuthority || '---'), c1 + 6, y + 12, { width: CW - 12 });
    y += 28;
    doc.moveTo(c1, y).lineTo(c4, y).lineWidth(0.4).stroke();
    y += 6;

    // Approved By table
    y = checkPageBreak(doc, y, 50, L, R);
    doc.moveTo(c1, y).lineTo(c4, y).lineWidth(0.4).stroke();
    const aC = [c1, c1 + 80, c1 + 200, c1 + 320, c4];
    doc.moveTo(c1, y + 16).lineTo(c4, y + 16).lineWidth(0.3).stroke();
    doc.moveTo(c1, y + 32).lineTo(c4, y + 32).lineWidth(0.3).stroke();
    aC.forEach((cx, i) => { if (i > 0) { doc.moveTo(cx, y).lineTo(cx, y + 32).lineWidth(0.3).stroke(); } });
    doc.font('Times-Bold').fontSize(7).fillColor('#000');
    doc.text('Approved By', aC[0] + 2, y + 3, { width: 76 });
    doc.text('Entity', aC[1] + 2, y + 3, { width: 116 });
    doc.text('Position', aC[2] + 2, y + 3, { width: 116 });
    doc.text('Name', aC[3] + 2, y + 3, { width: R - aC[3] - 2 });
    y += 16;
    doc.font('Helvetica').fontSize(7);
    doc.text(data.approvedBy || '---', aC[0] + 2, y + 3, { width: 76 });
    doc.text(data.approvedEntity || '---', aC[1] + 2, y + 3, { width: 116 });
    doc.text(data.approvedPosition || '---', aC[2] + 2, y + 3, { width: 116 });
    doc.text(data.approvedDate || '---', aC[3] + 2, y + 3, { width: R - aC[3] - 2 });
    y += 36;

    // Remarks at bottom
    if (data.remarks) {
      y = checkPageBreak(doc, y, 30, L, R);
      doc.font('Times-Bold').fontSize(8).fillColor('#000').text('Remarks:', c1 + 3, y);
      y += 12;
      doc.font('Helvetica').fontSize(8).text(data.remarks, c1 + 6, y, { width: CW - 12 });
    }

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
async function generateJointNotePdf(data) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W = doc.page.width;
    const L = 50, R = W - 50;

    // Header
    drawBEMLHeader(doc, W);
    let y = 165;

    // Title
    doc.fontSize(16).font('Helvetica-Bold').text('JOINT NOTE', L, y, { align: 'center', width: R - L });
    y = doc.y + 5;
    if (data.jointNoteNo) {
      doc.fontSize(9).font('Helvetica').text(`No: ${data.jointNoteNo}`, L, y, { align: 'center', width: R - L });
      y = doc.y + 15;
    }

    // Separator
    doc.moveTo(L, y).lineTo(R, y).lineWidth(1).stroke();
    y += 12;

    // Date
    if (data.date) {
      doc.fontSize(10).font('Helvetica-Bold').text(`Date: ${data.date}`, L, y);
      y = doc.y + 8;
    }

    // Parties
    if (data.parties) {
      doc.font('Helvetica-Bold').text('Parties / Participants:', L, y);
      y = doc.y + 2;
      doc.font('Helvetica').fontSize(10).text(data.parties, L + 5, y, { width: R - L - 10 });
      y = doc.y + 8;
    }

    // Subject
    if (data.subject) {
      doc.font('Helvetica-Bold').text('Subject:', L, y);
      y = doc.y + 2;
      doc.font('Helvetica').fontSize(10).text(data.subject, L + 5, y, { width: R - L - 10 });
      y = doc.y + 12;
    }

    // Description
    if (data.description) {
      y = checkPageBreak(doc, y, 60, L, R);
      doc.font('Helvetica-Bold').text('Description:', L, y);
      y = doc.y + 2;
      doc.font('Helvetica').fontSize(10).text(data.description, L + 5, y, { width: R - L - 10 });
      y = doc.y + 12;
    }

    // Items Discussed
    if (data.itemsDiscussed) {
      y = checkPageBreak(doc, y, 60, L, R);
      doc.font('Helvetica-Bold').text('Items Discussed:', L, y);
      y = doc.y + 2;
      doc.font('Helvetica').fontSize(10).text(data.itemsDiscussed, L + 5, y, { width: R - L - 10 });
      y = doc.y + 12;
    }

    // Decisions
    if (data.decisions) {
      y = checkPageBreak(doc, y, 60, L, R);
      doc.font('Helvetica-Bold').text('Decisions Taken:', L, y);
      y = doc.y + 2;
      doc.font('Helvetica').fontSize(10).text(data.decisions, L + 5, y, { width: R - L - 10 });
      y = doc.y + 12;
    }

    // Action Items
    if (data.actionItems) {
      y = checkPageBreak(doc, y, 60, L, R);
      doc.font('Helvetica-Bold').text('Action Items:', L, y);
      y = doc.y + 2;
      doc.font('Helvetica').fontSize(10).text(data.actionItems, L + 5, y, { width: R - L - 10 });
      y = doc.y + 12;
    }

    // Remarks
    if (data.remarks) {
      y = checkPageBreak(doc, y, 40, L, R);
      doc.font('Helvetica-Bold').text('Remarks:', L, y);
      y = doc.y + 2;
      doc.font('Helvetica').fontSize(10).text(data.remarks, L + 5, y, { width: R - L - 10 });
      y = doc.y + 12;
    }

    // Status
    y = checkPageBreak(doc, y, 30, L, R);
    doc.font('Helvetica-Bold').text('Status: ', L, y);
    doc.font('Helvetica').text(data.status || 'Open', L + 50, y);
    y = doc.y + 20;

    // Signatures
    y = checkPageBreak(doc, y, 80, L, R);
    doc.moveTo(L, y).lineTo(R, y).lineWidth(0.5).stroke();
    y += 15;
    doc.fontSize(10).font('Helvetica').text('Authorized Signatory (BEML Limited)', L, y);
    doc.text('Authorized Signatory (Other Party)', R - 200, y);

    drawBEMLFooter(doc, W);
    doc.end();
  });
}

// ══════════════════════════════════════════════════════════════
//  JOINT NOTE DOCX
// ══════════════════════════════════════════════════════════════
async function generateJointNoteDocx(data) {
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
  return Packer.toBuffer(doc);
}
