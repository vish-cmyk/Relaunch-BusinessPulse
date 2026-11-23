import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  ShadingType,
  ImageRun,
  AlignmentType,
} from 'docx';
import { jsPDF } from 'jspdf';
import { CaseRecord, HealthDimensionInput, HealthStatus, ReportFontFamily } from '../types/bizpulse';
import { calculateOverallHealth, HEALTH_DIMENSION_ORDER } from './healthScoring';

function resolvePdfFont(font: ReportFontFamily = 'sans'): 'helvetica' | 'times' | 'courier' {
  if (font === 'serif') return 'times';
  if (font === 'mono') return 'courier';
  return 'helvetica';
}

function resolveDocxFont(font: ReportFontFamily = 'sans'): string {
  if (font === 'serif') return 'Georgia';
  if (font === 'mono') return 'Consolas';
  return 'Calibri';
}

function formatStatusLabel(status: HealthStatus): string {
  switch (status) {
    case 'healthy':
      return 'Healthy';
    case 'needs_attention':
      return 'Needs Attention';
    case 'at_risk':
      return 'At Risk';
    case 'not_sure':
      return 'Not Sure / No Data';
    case 'unanswered':
    default:
      return 'Unanswered';
  }
}

function getStatusRgb(status: HealthStatus): [number, number, number] {
  switch (status) {
    case 'healthy':
      return [21, 128, 61]; // #15803D Green
    case 'needs_attention':
      return [180, 83, 9]; // #B45309 Amber
    case 'at_risk':
      return [185, 28, 28]; // #B91C1C Red
    case 'not_sure':
    case 'unanswered':
    default:
      return [71, 85, 105]; // #475569 Neutral Slate
  }
}

function getStatusHex(status: HealthStatus): string {
  switch (status) {
    case 'healthy':
      return '15803D';
    case 'needs_attention':
      return 'B45309';
    case 'at_risk':
      return 'B91C1C';
    case 'not_sure':
    case 'unanswered':
    default:
      return '475569';
  }
}

function getDimensionNumericScore(status: HealthStatus): number | null {
  switch (status) {
    case 'healthy':
      return 100;
    case 'needs_attention':
      return 55;
    case 'at_risk':
      return 15;
    case 'not_sure':
      return 40;
    case 'unanswered':
    default:
      return null;
  }
}

/**
 * Generates a high-resolution Canvas PNG of the 8-Dimension Radar & Bar chart
 * in browser environments for inclusion in Word (.docx) exports.
 */
export function renderHealthChartCanvasPng(caseRecord: CaseRecord): Uint8Array | null {
  if (typeof document === 'undefined') return null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 960;
    canvas.height = 420;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Clean white card background with subtle cool border
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#D9E2F0';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);

    // Top Black-to-Blue header strip
    const grad = ctx.createLinearGradient(0, 0, canvas.width, 0);
    grad.addColorStop(0, '#070B14');
    grad.addColorStop(0.6, '#0F172A');
    grad.addColorStop(1, '#1D4ED8');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, 44);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText(`8-Dimension Commercial Health Profile — ${caseRecord.profile.name}`, 20, 27);

    // Left: Radar Chart
    const cx = 215;
    const cy = 232;
    const radius = 128;
    const dims = HEALTH_DIMENSION_ORDER;
    const step = (Math.PI * 2) / dims.length;

    // Rings
    [0.25, 0.5, 0.75, 1.0].forEach((lvl) => {
      ctx.beginPath();
      ctx.arc(cx, cy, radius * lvl, 0, Math.PI * 2);
      ctx.strokeStyle = '#DCE5F2';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    });

    // Spokes
    dims.forEach((key, idx) => {
      const angle = idx * step - Math.PI / 2;
      const sx = cx + radius * Math.cos(angle);
      const sy = cy + radius * Math.sin(angle);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(sx, sy);
      ctx.strokeStyle = '#CBD5E1';
      ctx.lineWidth = 1;
      ctx.stroke();

      const lx = cx + (radius + 26) * Math.cos(angle);
      const ly = cy + (radius + 20) * Math.sin(angle);
      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(key.slice(0, 8).toUpperCase(), lx, ly + 4);
    });

    // Polygon
    const pts = dims.map((key, idx) => {
      const status = caseRecord.healthInputs[key]?.status || 'unanswered';
      const s = getDimensionNumericScore(status);
      const factor = s !== null ? s / 100 : 0.06;
      const angle = idx * step - Math.PI / 2;
      return {
        x: cx + radius * factor * Math.cos(angle),
        y: cy + radius * factor * Math.sin(angle),
        status,
      };
    });

    ctx.beginPath();
    pts.forEach((p, idx) => {
      if (idx === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.closePath();
    ctx.fillStyle = 'rgba(29, 78, 216, 0.18)';
    ctx.fill();
    ctx.strokeStyle = '#1D4ED8';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    pts.forEach((p) => {
      const [r, g, b] = getStatusRgb(p.status);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5.5, 0, Math.PI * 2);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });

    // Right: Horizontal Score Bars
    ctx.textAlign = 'left';
    const barStartX = 445;
    const barMaxW = 350;
    dims.forEach((key, idx) => {
      const item = caseRecord.healthInputs[key];
      const y = 78 + idx * 41;
      const numScore = getDimensionNumericScore(item?.status || 'unanswered');
      const [r, g, b] = getStatusRgb(item?.status || 'unanswered');

      ctx.fillStyle = '#0B1324';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText(item?.title || key, barStartX, y);

      // Background bar
      ctx.fillStyle = '#EEF2F8';
      ctx.fillRect(barStartX, y + 7, barMaxW, 12);

      // Score bar
      const fillW = numScore !== null ? Math.round((numScore / 100) * barMaxW) : 8;
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(barStartX, y + 7, fillW, 12);

      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.font = 'bold 11px monospace';
      ctx.fillText(
        numScore !== null ? `${numScore}/100 · ${formatStatusLabel(item.status)}` : 'Unanswered',
        barStartX + barMaxW + 12,
        y + 17
      );
    });

    const dataUrl = canvas.toDataURL('image/png');
    const b64 = dataUrl.split(',')[1];
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
      bytes[i] = bin.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}

/**
 * Generates a cleanly paginated, overlap-free executive PDF report with embedded vector charts.
 * Works identically in browser and Node.js.
 */
export function generatePdfReportBytes(rawCase: CaseRecord): Uint8Array {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
  });

  const computedHealth = rawCase.overallHealth || calculateOverallHealth(rawCase.healthInputs, rawCase.financials);
  const {
    profile,
    healthInputs,
    recommendations,
    financials,
    uploadedDocuments = [],
    reportBlocks = [],
    reportEditorSettings,
  } = rawCase;
  const pdfFont = resolvePdfFont(reportEditorSettings?.fontFamily);

  const pageWidth = doc.internal.pageSize.getWidth(); // ~595.28
  const pageHeight = doc.internal.pageSize.getHeight(); // ~841.89
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;
  const bottomLimit = pageHeight - 50;
  let y = 0;

  const drawRunningHeader = (isFirstPage: boolean) => {
    if (isFirstPage) {
      // Black-to-blue banded cover header
      doc.setFillColor(7, 11, 20); // #070B14 Obsidian
      doc.rect(0, 0, pageWidth, 88, 'F');
      doc.setFillColor(29, 78, 216); // #1D4ED8 Cobalt accent strip
      doc.rect(0, 84, pageWidth, 4, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(147, 197, 253); // #93C5FD
      doc.text('RELAUNCH BIZPULSE — EXECUTIVE COACHING & DIAGNOSTIC OS', margin, 26);

      doc.setFontSize(17);
      doc.setTextColor(255, 255, 255);
      const titleLines = doc.splitTextToSize(profile.name, contentWidth);
      doc.text(titleLines[0], margin, 50);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(203, 213, 225);
      doc.text(
        `Commercial Diagnostic & Turnaround Report  |  ${profile.industry} (${profile.country}, ${profile.currency})`,
        margin,
        70
      );
      y = 110;
    } else {
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, pageWidth, 34, 'F');
      doc.setFillColor(29, 78, 216);
      doc.rect(0, 32, pageWidth, 2, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(255, 255, 255);
      doc.text(`${profile.name} — Diagnostic Report`, margin, 21);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(147, 197, 253);
      doc.text(`Case: ${profile.caseId}`, pageWidth - margin, 21, { align: 'right' });
      y = 54;
    }
  };

  const ensureSpace = (neededHeight: number) => {
    if (y + neededHeight > bottomLimit) {
      doc.addPage();
      drawRunningHeader(false);
    }
  };

  const drawSectionHeading = (num: string, title: string) => {
    ensureSpace(34);
    doc.setFillColor(239, 246, 255); // #EFF6FF
    doc.rect(margin, y, contentWidth, 22, 'F');
    doc.setFillColor(29, 78, 216);
    doc.rect(margin, y, 4, 22, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`${num}. ${title}`, margin + 12, y + 14.5);
    y += 30;
  };

  const drawWrappedParagraph = (
    text: string,
    opts?: {
      fontSize?: number;
      bold?: boolean;
      italic?: boolean;
      font?: 'helvetica' | 'times' | 'courier';
      align?: 'left' | 'center' | 'justify';
      color?: [number, number, number];
      indent?: number;
      lineHeight?: number;
      gapAfter?: number;
    }
  ) => {
    const fontSize = opts?.fontSize ?? 9;
    const indent = opts?.indent ?? 0;
    const lineHeight = opts?.lineHeight ?? fontSize * 1.38;
    const gapAfter = opts?.gapAfter ?? 6;
    const fontStyle = opts?.bold && opts?.italic ? 'bolditalic' : opts?.bold ? 'bold' : opts?.italic ? 'italic' : 'normal';
    doc.setFont(opts?.font || pdfFont, fontStyle);
    doc.setFontSize(fontSize);
    const [r, g, b] = opts?.color ?? [30, 41, 59];
    doc.setTextColor(r, g, b);

    const lines: string[] = doc.splitTextToSize(String(text || ''), contentWidth - indent);
    const xPos = opts?.align === 'center' ? pageWidth / 2 : margin + indent;
    for (const line of lines) {
      ensureSpace(lineHeight + 2);
      doc.text(line, xPos, y, opts?.align === 'center' ? { align: 'center' } : undefined);
      y += lineHeight;
    }
    y += gapAfter;
  };

  // Start Page 1
  drawRunningHeader(true);

  // Business Details Strip
  const metaTextLines = [
    `Assessment Date: ${computedHealth.assessmentDate || new Date().toISOString().split('T')[0]}   |   Case ID: ${profile.caseId}   |   Currency: ${profile.currency}`,
    `Structure: ${profile.businessType}   |   Years Operating: ${profile.yearsOperating}   |   Workforce: ${profile.employeeCount} Staff, ${profile.subcontractorCount} Subcontractors`,
  ];
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(82, 98, 122);
  metaTextLines.forEach((line) => {
    doc.text(line, margin, y);
    y += 13;
  });
  y += 6;

  // Section 1: Business Profile & Overall Health Summary
  drawSectionHeading('1', 'Business Profile & Overall Commercial Health');

  const objLines = doc.splitTextToSize(`Primary Objective: ${profile.primaryObjective || 'Not specified'}`, contentWidth - 150);
  const concernLines = doc.splitTextToSize(`Primary Concern: ${profile.primaryConcern || 'Not specified'}`, contentWidth - 150);
  const expLines = doc.splitTextToSize(
    computedHealth.overallExplanation || computedHealth.scoreLabel,
    contentWidth - 24
  );

  const summaryBoxHeight = Math.max(92, 34 + objLines.length * 12 + concernLines.length * 12) + expLines.length * 11.5 + 16;
  ensureSpace(summaryBoxHeight + 10);

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(217, 226, 240);
  doc.roundedRect(margin, y, contentWidth, summaryBoxHeight, 4, 4, 'FD');

  // Right-side score block inside summary box
  const scoreBoxW = 118;
  const scoreBoxX = margin + contentWidth - scoreBoxW - 12;
  const scoreBoxY = y + 12;
  const ratingColor: [number, number, number] =
    computedHealth.overallRating === 'Healthy'
      ? [21, 128, 61]
      : computedHealth.overallRating === 'Needs Attention'
      ? [180, 83, 9]
      : computedHealth.overallRating === 'At Risk'
      ? [185, 28, 28]
      : [71, 85, 105];

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(ratingColor[0], ratingColor[1], ratingColor[2]);
  doc.roundedRect(scoreBoxX, scoreBoxY, scoreBoxW, 64, 4, 4, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(82, 98, 122);
  doc.text('OVERALL HEALTH', scoreBoxX + scoreBoxW / 2, scoreBoxY + 14, { align: 'center' });

  doc.setFontSize(computedHealth.overallScore !== null ? 20 : 12);
  doc.setTextColor(ratingColor[0], ratingColor[1], ratingColor[2]);
  doc.text(
    computedHealth.overallScore !== null ? `${computedHealth.overallScore}/100` : 'Pending',
    scoreBoxX + scoreBoxW / 2,
    scoreBoxY + 38,
    { align: 'center' }
  );

  doc.setFontSize(8);
  const ratingBadgeLines = doc.splitTextToSize(computedHealth.overallRating, scoreBoxW - 10);
  doc.text(ratingBadgeLines[0], scoreBoxX + scoreBoxW / 2, scoreBoxY + 54, { align: 'center' });

  // Left-side objective & concern inside summary box
  let innerY = y + 20;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(computedHealth.scoreLabel, margin + 12, innerY, { maxWidth: contentWidth - 148 });
  innerY += 16;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  doc.text(objLines, margin + 12, innerY);
  innerY += objLines.length * 12 + 4;
  doc.text(concernLines, margin + 12, innerY);
  innerY = Math.max(innerY + concernLines.length * 12 + 10, scoreBoxY + 74);

  doc.setDrawColor(226, 232, 240);
  doc.line(margin + 12, innerY - 4, margin + contentWidth - 12, innerY - 4);
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  doc.text(expLines, margin + 12, innerY + 8);

  y += summaryBoxHeight + 14;

  // Visual Charts Block (Vector Radar + Horizontal Bars — Guaranteed crisp & overlap-free)
  ensureSpace(225);
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(217, 226, 240);
  doc.roundedRect(margin, y, contentWidth, 212, 4, 4, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('8-Dimension Equilibrium Chart & Quantitative Breakdown', margin + 12, y + 16);

  // Left Vector Radar
  const radarCx = margin + 108;
  const radarCy = y + 114;
  const radarR = 64;
  const step = (Math.PI * 2) / HEALTH_DIMENSION_ORDER.length;

  [0.25, 0.5, 0.75, 1.0].forEach((lvl) => {
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.6);
    doc.circle(radarCx, radarCy, radarR * lvl, 'S');
  });

  const polyPts: [number, number][] = [];
  HEALTH_DIMENSION_ORDER.forEach((key, idx) => {
    const angle = idx * step - Math.PI / 2;
    const xEnd = radarCx + radarR * Math.cos(angle);
    const yEnd = radarCy + radarR * Math.sin(angle);
    doc.setDrawColor(217, 226, 240);
    doc.line(radarCx, radarCy, xEnd, yEnd);

    const status = healthInputs[key]?.status || 'unanswered';
    const sc = getDimensionNumericScore(status);
    const factor = sc !== null ? sc / 100 : 0.08;
    const px = radarCx + radarR * factor * Math.cos(angle);
    const py = radarCy + radarR * factor * Math.sin(angle);
    polyPts.push([px, py]);

    const lx = radarCx + (radarR + 17) * Math.cos(angle);
    const ly = radarCy + (radarR + 13) * Math.sin(angle) + 2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(51, 65, 85);
    doc.text(key.slice(0, 6).toUpperCase(), lx, ly, { align: 'center' });
  });

  // Connect polygon perimeter cleanly
  doc.setDrawColor(29, 78, 216);
  doc.setLineWidth(1.6);
  for (let i = 0; i < polyPts.length; i++) {
    const curr = polyPts[i];
    const next = polyPts[(i + 1) % polyPts.length];
    doc.line(curr[0], curr[1], next[0], next[1]);
  }
  polyPts.forEach(([px, py], idx) => {
    const key = HEALTH_DIMENSION_ORDER[idx];
    const [r, g, b] = getStatusRgb(healthInputs[key]?.status || 'unanswered');
    doc.setFillColor(r, g, b);
    doc.circle(px, py, 2.8, 'F');
  });

  // Right Horizontal Score Bars
  const barX = margin + 225;
  const barMaxW = 175;
  HEALTH_DIMENSION_ORDER.forEach((key, idx) => {
    const dim = healthInputs[key];
    const rowY = y + 32 + idx * 21.5;
    const sc = getDimensionNumericScore(dim?.status || 'unanswered');
    const [r, g, b] = getStatusRgb(dim?.status || 'unanswered');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    const shortTitle = (dim?.title || key).length > 34 ? `${(dim?.title || key).slice(0, 32)}…` : (dim?.title || key);
    doc.text(shortTitle, barX, rowY);

    doc.setFillColor(238, 242, 248);
    doc.rect(barX, rowY + 3, barMaxW, 6, 'F');
    const w = sc !== null ? Math.max(4, (sc / 100) * barMaxW) : 4;
    doc.setFillColor(r, g, b);
    doc.rect(barX, rowY + 3, w, 6, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(r, g, b);
    doc.text(
      sc !== null ? `${sc}/100 (${formatStatusLabel(dim.status)})` : 'Unanswered',
      barX + barMaxW + 8,
      rowY + 8
    );
  });

  y += 226;

  // Section 2: Eight Commercial Health Dimensions Detailed Table (Dynamic Wrapped Row Heights)
  drawSectionHeading('2', 'Eight Commercial Health Dimensions (Detailed Evidence)');

  const colWidths = [130, 88, 48, contentWidth - 266];
  const drawTableHeader = () => {
    ensureSpace(24);
    doc.setFillColor(15, 23, 42);
    doc.rect(margin, y, contentWidth, 20, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text('Dimension', margin + 6, y + 13);
    doc.text('Status', margin + colWidths[0] + 6, y + 13);
    doc.text('Score', margin + colWidths[0] + colWidths[1] + 6, y + 13);
    doc.text('Owner Notes & Assessment Basis', margin + colWidths[0] + colWidths[1] + colWidths[2] + 6, y + 13);
    y += 20;
  };

  drawTableHeader();

  HEALTH_DIMENSION_ORDER.forEach((key, idx) => {
    const dim: HealthDimensionInput | undefined = healthInputs[key];
    if (!dim) return;
    const sc = getDimensionNumericScore(dim.status);
    const [r, g, b] = getStatusRgb(dim.status);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    const titleLines: string[] = doc.splitTextToSize(dim.title, colWidths[0] - 10);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const noteBody = `${dim.notes?.trim() ? dim.notes.trim() : 'No notes recorded.'} [Basis: ${dim.evidenceType.replace('_', ' ')}]`;
    const noteLines: string[] = doc.splitTextToSize(noteBody, colWidths[3] - 10);

    const rowHeight = Math.max(24, Math.max(titleLines.length, noteLines.length) * 10.5 + 10);

    if (y + rowHeight > bottomLimit) {
      doc.addPage();
      drawRunningHeader(false);
      drawTableHeader();
    }

    if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y, contentWidth, rowHeight, 'F');
    }
    doc.setDrawColor(226, 232, 240);
    doc.rect(margin, y, contentWidth, rowHeight, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text(titleLines, margin + 6, y + 12);

    doc.setTextColor(r, g, b);
    doc.text(formatStatusLabel(dim.status), margin + colWidths[0] + 6, y + 12);

    doc.setTextColor(15, 23, 42);
    doc.text(sc !== null ? `${sc}/100` : '—', margin + colWidths[0] + colWidths[1] + 6, y + 12);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.text(noteLines, margin + colWidths[0] + colWidths[1] + colWidths[2] + 6, y + 12);

    y += rowHeight;
  });

  y += 14;

  // Financial Snapshot if supplied
  if (financials && (financials.annualRevenue != null || financials.cashInBank != null || financials.accountsReceivable != null)) {
    drawSectionHeading('3', `Supplied Financial Baseline (${profile.currency})`);
    const finItems = [
      `Annual Revenue: ${financials.annualRevenue != null ? `${profile.currency} ${financials.annualRevenue.toLocaleString()}` : 'Not supplied'}`,
      `Reported Operating Profit: ${financials.operatingProfit != null ? `${profile.currency} ${financials.operatingProfit.toLocaleString()}` : 'Not supplied'}`,
      `Cash in Bank: ${financials.cashInBank != null ? `${profile.currency} ${financials.cashInBank.toLocaleString()}` : 'Not supplied'}`,
      `Accounts Receivable: ${financials.accountsReceivable != null ? `${profile.currency} ${financials.accountsReceivable.toLocaleString()}` : 'Not supplied'} (Overdue: ${financials.overdueReceivables != null ? `${profile.currency} ${financials.overdueReceivables.toLocaleString()}` : 'Not supplied'})`,
      `Supplier Payables: ${financials.accountsPayable != null ? `${profile.currency} ${financials.accountsPayable.toLocaleString()}` : 'Not supplied'}`,
      `Credit Facility: ${financials.creditFacilityUsed != null ? `${profile.currency} ${financials.creditFacilityUsed.toLocaleString()}` : '0'} drawn of ${financials.creditFacilityLimit != null ? `${profile.currency} ${financials.creditFacilityLimit.toLocaleString()}` : '0'} limit`,
    ];
    finItems.forEach((line) => drawWrappedParagraph(`•  ${line}`, { fontSize: 8.5, indent: 6, gapAfter: 3 }));
    y += 6;
  }

  // Section 4: Findings & Diagnostic Risks / Strengths
  const nextSectionNum = financials ? '4' : '3';
  drawSectionHeading(nextSectionNum, 'Key Diagnostic Findings & Risk Priorities');
  drawWrappedParagraph('Critical Risks Identified:', { fontSize: 9, bold: true, color: [185, 28, 28], gapAfter: 3 });
  computedHealth.criticalRisksIdentified.forEach((risk) =>
    drawWrappedParagraph(`•  ${risk}`, { fontSize: 8.5, indent: 8, gapAfter: 3 })
  );
  drawWrappedParagraph('Core Operational Strengths:', { fontSize: 9, bold: true, color: [21, 128, 61], gapAfter: 3 });
  computedHealth.strongestAreas.forEach((st) =>
    drawWrappedParagraph(`•  ${st}`, { fontSize: 8.5, indent: 8, gapAfter: 3 })
  );
  drawWrappedParagraph('Missing Information / Evidence Gaps:', { fontSize: 9, bold: true, color: [71, 85, 105], gapAfter: 3 });
  computedHealth.missingEvidenceAreas.forEach((gap) =>
    drawWrappedParagraph(`•  ${gap}`, { fontSize: 8.5, indent: 8, gapAfter: 3 })
  );
  y += 4;

  // Section 5: AI Recommendations & Actions
  const recSectionNum = String(Number(nextSectionNum) + 1);
  drawSectionHeading(recSectionNum, 'Executive Recommendations & Action Plan');
  if (recommendations) {
    drawWrappedParagraph('Primary Commercial Observation:', { fontSize: 9, bold: true, color: [15, 23, 42], gapAfter: 2 });
    drawWrappedParagraph(recommendations.initialObservation, { fontSize: 8.5, indent: 6, gapAfter: 6 });

    drawWrappedParagraph('Why This Matters Commercially:', { fontSize: 9, bold: true, color: [15, 23, 42], gapAfter: 2 });
    drawWrappedParagraph(recommendations.commercialWhy, { fontSize: 8.5, indent: 6, gapAfter: 6 });

    if (recommendations.sustainabilityRisks?.length) {
      drawWrappedParagraph('Sustainability Risks:', { fontSize: 9, bold: true, color: [185, 28, 28], gapAfter: 2 });
      recommendations.sustainabilityRisks.forEach((r) => drawWrappedParagraph(`•  ${r}`, { fontSize: 8.5, indent: 8, gapAfter: 2 }));
      y += 4;
    }

    if (recommendations.hiddenProfitOpportunities?.length) {
      drawWrappedParagraph('Hidden Profit Opportunities:', { fontSize: 9, bold: true, color: [29, 78, 216], gapAfter: 2 });
      recommendations.hiddenProfitOpportunities.forEach((o) => drawWrappedParagraph(`•  ${o}`, { fontSize: 8.5, indent: 8, gapAfter: 2 }));
      y += 4;
    }

    if (recommendations.revenueFlowImprovements?.length) {
      drawWrappedParagraph('Revenue Flow & Working Capital Improvements:', { fontSize: 9, bold: true, color: [21, 128, 61], gapAfter: 2 });
      recommendations.revenueFlowImprovements.forEach((rev) => drawWrappedParagraph(`•  ${rev}`, { fontSize: 8.5, indent: 8, gapAfter: 2 }));
      y += 4;
    }

    drawWrappedParagraph('Core Turnaround Recommendation:', { fontSize: 9, bold: true, color: [29, 78, 216], gapAfter: 2 });
    drawWrappedParagraph(recommendations.initialRecommendation, { fontSize: 8.5, indent: 6, gapAfter: 6 });

    drawWrappedParagraph('Immediate Action (Next 48–72 Hours):', { fontSize: 9, bold: true, color: [21, 128, 61], gapAfter: 2 });
    drawWrappedParagraph(recommendations.immediateAction, { fontSize: 8.5, bold: true, indent: 6, gapAfter: 6 });

    if (recommendations.actionItems?.length) {
      drawWrappedParagraph('Prioritized Actions (Owner, Priority & Timeframe):', { fontSize: 9, bold: true, color: [15, 23, 42], gapAfter: 4 });
      recommendations.actionItems.forEach((act, idx) => {
        drawWrappedParagraph(
          `${idx + 1}. [${act.priority}] ${act.action} — Owner: ${act.ownerRole} | Timeframe: ${act.timeframe} | Expected Impact: ${act.expectedImpact}`,
          { fontSize: 8.5, indent: 8, gapAfter: 4 }
        );
      });
    }

    if (recommendations.specialistAdviceNeeded) {
      drawWrappedParagraph(`Specialist Advisory Note: ${recommendations.specialistAdviceNeeded}`, {
        fontSize: 8.5,
        bold: true,
        color: [180, 83, 9],
        gapAfter: 6,
      });
    }
  } else {
    drawWrappedParagraph(
      'Executive AI recommendations have not yet been generated for this business. Open the Recommendations tab to synthesize tailored guidance.',
      { fontSize: 8.5, color: [82, 98, 122] }
    );
  }

  // Section 6: Uploaded Document Audits (Evidence vs Assumptions)
  if (uploadedDocuments.length > 0) {
    const docSectionNum = String(Number(recSectionNum) + 1);
    drawSectionHeading(docSectionNum, 'Uploaded Document Financial Audits (Evidence vs. Assumptions)');
    uploadedDocuments.forEach((uDoc, i) => {
      drawWrappedParagraph(`${i + 1}. ${uDoc.fileName} (${new Date(uDoc.uploadedAt).toLocaleDateString()})`, {
        fontSize: 9,
        bold: true,
        color: [15, 23, 42],
        gapAfter: 2,
      });
      drawWrappedParagraph(`Summary: ${uDoc.summary}`, { fontSize: 8.5, indent: 8, gapAfter: 3 });
      drawWrappedParagraph(`Earning Potential Assessment: ${uDoc.earningPotentialAssessment}`, { fontSize: 8.5, indent: 8, gapAfter: 3 });
      if (uDoc.verifiedFacts?.length) {
        drawWrappedParagraph(`Verified Facts: ${uDoc.verifiedFacts.join('; ')}`, { fontSize: 8, indent: 8, color: [21, 128, 61], gapAfter: 2 });
      }
      if (uDoc.assumptionsFlagged?.length) {
        drawWrappedParagraph(`Assumptions Flagged: ${uDoc.assumptionsFlagged.join('; ')}`, { fontSize: 8, indent: 8, color: [180, 83, 9], gapAfter: 2 });
      }
      if (uDoc.missingFinancialFigures?.length) {
        drawWrappedParagraph(`Missing Figures (Not Fabricated): ${uDoc.missingFinancialFigures.join('; ')}`, { fontSize: 8, indent: 8, color: [185, 28, 28], gapAfter: 6 });
      }
    });
  }

  if (reportBlocks.length > 0) {
    const baseNum = uploadedDocuments.length > 0 ? Number(recSectionNum) + 2 : Number(recSectionNum) + 1;
    drawSectionHeading(String(baseNum), 'Custom Commentary & Owner Paragraphs');
    reportBlocks.forEach((blk) => {
      const blkPdfFont = resolvePdfFont(blk.fontFamily);
      const blkFontSize = blk.fontSize === 'sm' ? 8.5 : blk.fontSize === 'lg' ? 11 : 9.5;
      const accentRgb: [number, number, number] =
        blk.accent === 'blue'
          ? [29, 78, 216]
          : blk.accent === 'green'
          ? [21, 128, 61]
          : blk.accent === 'amber'
          ? [180, 83, 9]
          : [15, 23, 42];
      drawWrappedParagraph(blk.heading, {
        font: blkPdfFont,
        fontSize: blkFontSize + 0.5,
        bold: true,
        color: accentRgb,
        align: blk.align || 'left',
        gapAfter: 2,
      });
      drawWrappedParagraph(blk.body, {
        font: blkPdfFont,
        fontSize: blkFontSize,
        bold: blk.bold,
        italic: blk.italic,
        align: blk.align || 'left',
        indent: blk.align === 'center' ? 0 : 8,
        gapAfter: 7,
      });
    });
  }

  // Running Footers across all pages
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setDrawColor(217, 226, 240);
    doc.line(margin, pageHeight - 36, pageWidth - margin, pageHeight - 36);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Relaunch BizPulse • Confidential Assessment for ${profile.name} (${profile.caseId})`,
      margin,
      pageHeight - 22
    );
    doc.text(`Page ${p} of ${totalPages}`, pageWidth - margin, pageHeight - 22, { align: 'right' });
  }

  const arrBuf = doc.output('arraybuffer');
  return new Uint8Array(arrBuf);
}

/**
 * Generates a genuine, properly structured OpenXML Microsoft Word (.docx) report
 * including optional embedded chart PNG, wrapped tables, findings, recommendations, and document audits.
 */
export async function generateDocxReportUint8Array(
  rawCase: CaseRecord,
  chartPngBytes?: Uint8Array | null
): Promise<Uint8Array> {
  const computedHealth = rawCase.overallHealth || calculateOverallHealth(rawCase.healthInputs, rawCase.financials);
  const {
    profile,
    healthInputs,
    recommendations,
    financials,
    uploadedDocuments = [],
    reportBlocks = [],
    reportEditorSettings,
  } = rawCase;
  const docxDefaultFont = resolveDocxFont(reportEditorSettings?.fontFamily);

  const borderStyle = {
    style: BorderStyle.SINGLE,
    size: 4,
    color: 'D9E2F0',
  };
  const cellBorders = {
    top: borderStyle,
    bottom: borderStyle,
    left: borderStyle,
    right: borderStyle,
  };
  const cellMargins = { top: 100, bottom: 100, left: 130, right: 130 };

  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      new TableCell({
        width: { size: 2400, type: WidthType.DXA },
        shading: { type: ShadingType.CLEAR, fill: '0F172A' },
        borders: cellBorders,
        margins: cellMargins,
        children: [new Paragraph({ children: [new TextRun({ text: 'Dimension', bold: true, color: 'FFFFFF', size: 20 })] })],
      }),
      new TableCell({
        width: { size: 1600, type: WidthType.DXA },
        shading: { type: ShadingType.CLEAR, fill: '0F172A' },
        borders: cellBorders,
        margins: cellMargins,
        children: [new Paragraph({ children: [new TextRun({ text: 'Status', bold: true, color: 'FFFFFF', size: 20 })] })],
      }),
      new TableCell({
        width: { size: 1000, type: WidthType.DXA },
        shading: { type: ShadingType.CLEAR, fill: '0F172A' },
        borders: cellBorders,
        margins: cellMargins,
        children: [new Paragraph({ children: [new TextRun({ text: 'Score', bold: true, color: 'FFFFFF', size: 20 })] })],
      }),
      new TableCell({
        width: { size: 4600, type: WidthType.DXA },
        shading: { type: ShadingType.CLEAR, fill: '0F172A' },
        borders: cellBorders,
        margins: cellMargins,
        children: [new Paragraph({ children: [new TextRun({ text: 'Evidence Notes & Meaning', bold: true, color: 'FFFFFF', size: 20 })] })],
      }),
    ],
  });

  const dimensionRows = HEALTH_DIMENSION_ORDER.map((key, idx) => {
    const dim = healthInputs[key];
    const score = getDimensionNumericScore(dim.status);
    const hex = getStatusHex(dim.status);
    const detail = computedHealth.dimensionScores?.find((d) => d.key === key);
    const fill = idx % 2 === 1 ? 'F8FAFC' : 'FFFFFF';

    return new TableRow({
      children: [
        new TableCell({
          shading: { type: ShadingType.CLEAR, fill },
          borders: cellBorders,
          margins: cellMargins,
          children: [new Paragraph({ children: [new TextRun({ text: dim.title, bold: true, size: 19, color: '0F172A' })] })],
        }),
        new TableCell({
          shading: { type: ShadingType.CLEAR, fill },
          borders: cellBorders,
          margins: cellMargins,
          children: [new Paragraph({ children: [new TextRun({ text: formatStatusLabel(dim.status), bold: true, size: 19, color: hex })] })],
        }),
        new TableCell({
          shading: { type: ShadingType.CLEAR, fill },
          borders: cellBorders,
          margins: cellMargins,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: score !== null ? `${score}/100` : '—', bold: true, size: 19, color: '0F172A' })],
            }),
          ],
        }),
        new TableCell({
          shading: { type: ShadingType.CLEAR, fill },
          borders: cellBorders,
          margins: cellMargins,
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: `${dim.notes?.trim() || 'No owner notes entered.'}\n`, size: 18, color: '1E293B' }),
                new TextRun({ text: detail?.explanation || '', size: 17, italics: true, color: '475569' }),
              ],
            }),
          ],
        }),
      ],
    });
  });

  const sectionsChildren: (Paragraph | Table)[] = [
    new Paragraph({
      children: [
        new TextRun({ text: 'RELAUNCH BIZPULSE  •  EXECUTIVE COACHING & DIAGNOSTIC REPORT', bold: true, size: 18, color: '1D4ED8' }),
      ],
      spacing: { after: 100 },
    }),
    new Paragraph({
      text: profile.name,
      heading: HeadingLevel.TITLE,
      spacing: { after: 80 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Assessment Date: ${computedHealth.assessmentDate}  |  Case ID: ${profile.caseId}  |  Industry: ${profile.industry} (${profile.businessType})\n`,
          size: 19,
          color: '475569',
        }),
        new TextRun({
          text: `Country: ${profile.country}  |  Currency: ${profile.currency}  |  Workforce: ${profile.employeeCount} staff, ${profile.subcontractorCount} subcontractors  |  Operating: ${profile.yearsOperating} yrs`,
          size: 19,
          color: '475569',
        }),
      ],
      spacing: { after: 200 },
    }),
    new Paragraph({
      text: '1. Business Profile & Overall Health Result',
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 120, after: 100 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Overall Business Health: ', bold: true, size: 21 }),
        new TextRun({
          text: `${computedHealth.overallRating} — ${
            computedHealth.overallScore !== null ? `${computedHealth.overallScore}/100` : 'Pending Assessment'
          } (${computedHealth.scoreLabel})\n`,
          bold: true,
          size: 21,
          color: computedHealth.overallRating === 'Healthy' ? '15803D' : computedHealth.overallRating === 'At Risk' ? 'B91C1C' : 'B45309',
        }),
        new TextRun({ text: `${computedHealth.overallExplanation || ''}\n\n`, size: 19, color: '1E293B' }),
        new TextRun({ text: 'Primary Business Objective: ', bold: true, size: 19 }),
        new TextRun({ text: `${profile.primaryObjective || 'Not specified'}\n`, size: 19 }),
        new TextRun({ text: 'Stated Primary Concern: ', bold: true, size: 19 }),
        new TextRun({ text: `${profile.primaryConcern || 'Not specified'}\n`, size: 19 }),
      ],
      spacing: { after: 180 },
    }),
  ];

  // Embed radar/bar chart PNG when available
  if (chartPngBytes && chartPngBytes.length > 0) {
    sectionsChildren.push(
      new Paragraph({
        children: [
          new ImageRun({
            data: chartPngBytes,
            transformation: { width: 580, height: 254 },
            type: 'png',
          }),
        ],
        spacing: { before: 80, after: 200 },
      })
    );
  }

  sectionsChildren.push(
    new Paragraph({
      text: '2. Eight Commercial Health Dimensions',
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 160, after: 100 },
    }),
    new Table({
      rows: [headerRow, ...dimensionRows],
      width: { size: 9600, type: WidthType.DXA },
    })
  );

  if (financials && (financials.annualRevenue != null || financials.cashInBank != null || financials.accountsReceivable != null)) {
    sectionsChildren.push(
      new Paragraph({
        text: `Supplied Financial Baseline (${profile.currency})`,
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 200, after: 80 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: `Annual Revenue: ${financials.annualRevenue?.toLocaleString() ?? 'N/A'}  |  Operating Profit: ${financials.operatingProfit?.toLocaleString() ?? 'N/A'}  |  Cash in Bank: ${financials.cashInBank?.toLocaleString() ?? 'N/A'}\nAccounts Receivable: ${financials.accountsReceivable?.toLocaleString() ?? 'N/A'} (Overdue: ${financials.overdueReceivables?.toLocaleString() ?? 'N/A'})  |  Payables: ${financials.accountsPayable?.toLocaleString() ?? 'N/A'}\nCredit Facility Drawn: ${financials.creditFacilityUsed?.toLocaleString() ?? '0'} / ${financials.creditFacilityLimit?.toLocaleString() ?? '0'} limit`,
            size: 19,
          }),
        ],
        spacing: { after: 160 },
      })
    );
  }

  sectionsChildren.push(
    new Paragraph({
      text: '3. Key Findings, Risks & Strengths',
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 220, after: 80 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Critical Risks Identified:\n', bold: true, color: 'B91C1C', size: 20 }),
        ...computedHealth.criticalRisksIdentified.map((r) => new TextRun({ text: `• ${r}\n`, size: 19 })),
        new TextRun({ text: '\nCore Strengths:\n', bold: true, color: '15803D', size: 20 }),
        ...computedHealth.strongestAreas.map((s) => new TextRun({ text: `• ${s}\n`, size: 19 })),
        new TextRun({ text: '\nInformation & Evidence Gaps:\n', bold: true, color: '475569', size: 20 }),
        ...computedHealth.missingEvidenceAreas.map((g) => new TextRun({ text: `• ${g}\n`, size: 19 })),
      ],
      spacing: { after: 180 },
    })
  );

  sectionsChildren.push(
    new Paragraph({
      text: '4. Executive Coaching Recommendations & Actions',
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 220, after: 80 },
    })
  );

  if (recommendations) {
    sectionsChildren.push(
      new Paragraph({
        children: [
          new TextRun({ text: 'Primary Commercial Observation:\n', bold: true, size: 20 }),
          new TextRun({ text: `${recommendations.initialObservation}\n\n`, size: 19 }),
          new TextRun({ text: 'Commercial Rationale:\n', bold: true, size: 20 }),
          new TextRun({ text: `${recommendations.commercialWhy}\n\n`, size: 19 }),
          ...(recommendations.sustainabilityRisks?.length
            ? [
                new TextRun({ text: 'Sustainability Risks:\n', bold: true, color: 'B91C1C', size: 20 }),
                ...recommendations.sustainabilityRisks.map((x) => new TextRun({ text: `• ${x}\n`, size: 19 })),
                new TextRun({ text: '\n', size: 19 }),
              ]
            : []),
          ...(recommendations.hiddenProfitOpportunities?.length
            ? [
                new TextRun({ text: 'Hidden Profit Opportunities:\n', bold: true, color: '1D4ED8', size: 20 }),
                ...recommendations.hiddenProfitOpportunities.map((x) => new TextRun({ text: `• ${x}\n`, size: 19 })),
                new TextRun({ text: '\n', size: 19 }),
              ]
            : []),
          ...(recommendations.revenueFlowImprovements?.length
            ? [
                new TextRun({ text: 'Revenue Flow Improvements:\n', bold: true, color: '15803D', size: 20 }),
                ...recommendations.revenueFlowImprovements.map((x) => new TextRun({ text: `• ${x}\n`, size: 19 })),
                new TextRun({ text: '\n', size: 19 }),
              ]
            : []),
          new TextRun({ text: 'Strategic Turnaround Recommendation:\n', bold: true, color: '1D4ED8', size: 20 }),
          new TextRun({ text: `${recommendations.initialRecommendation}\n\n`, size: 19 }),
          new TextRun({ text: 'Immediate Action (Next 48–72 Hours):\n', bold: true, color: '15803D', size: 20 }),
          new TextRun({ text: `${recommendations.immediateAction}\n\n`, size: 19 }),
          ...(recommendations.specialistAdviceNeeded
            ? [
                new TextRun({ text: 'Specialist Advice Needed:\n', bold: true, color: 'B45309', size: 20 }),
                new TextRun({ text: `${recommendations.specialistAdviceNeeded}\n`, size: 19 }),
              ]
            : []),
        ],
        spacing: { after: 160 },
      })
    );

    if (recommendations.actionItems?.length) {
      const actionTableRows = [
        new TableRow({
          tableHeader: true,
          children: [
            new TableCell({
              width: { size: 1500, type: WidthType.DXA },
              shading: { type: ShadingType.CLEAR, fill: '1D4ED8' },
              borders: cellBorders,
              margins: cellMargins,
              children: [new Paragraph({ children: [new TextRun({ text: 'Priority', bold: true, color: 'FFFFFF', size: 19 })] })],
            }),
            new TableCell({
              width: { size: 1700, type: WidthType.DXA },
              shading: { type: ShadingType.CLEAR, fill: '1D4ED8' },
              borders: cellBorders,
              margins: cellMargins,
              children: [new Paragraph({ children: [new TextRun({ text: 'Owner', bold: true, color: 'FFFFFF', size: 19 })] })],
            }),
            new TableCell({
              width: { size: 1400, type: WidthType.DXA },
              shading: { type: ShadingType.CLEAR, fill: '1D4ED8' },
              borders: cellBorders,
              margins: cellMargins,
              children: [new Paragraph({ children: [new TextRun({ text: 'Timeframe', bold: true, color: 'FFFFFF', size: 19 })] })],
            }),
            new TableCell({
              width: { size: 5000, type: WidthType.DXA },
              shading: { type: ShadingType.CLEAR, fill: '1D4ED8' },
              borders: cellBorders,
              margins: cellMargins,
              children: [new Paragraph({ children: [new TextRun({ text: 'Practical Action & Impact', bold: true, color: 'FFFFFF', size: 19 })] })],
            }),
          ],
        }),
        ...recommendations.actionItems.map((item) =>
          new TableRow({
            children: [
              new TableCell({
                borders: cellBorders,
                margins: cellMargins,
                children: [new Paragraph({ children: [new TextRun({ text: item.priority, bold: true, size: 18 })] })],
              }),
              new TableCell({
                borders: cellBorders,
                margins: cellMargins,
                children: [new Paragraph({ children: [new TextRun({ text: item.ownerRole, size: 18 })] })],
              }),
              new TableCell({
                borders: cellBorders,
                margins: cellMargins,
                children: [new Paragraph({ children: [new TextRun({ text: item.timeframe, size: 18 })] })],
              }),
              new TableCell({
                borders: cellBorders,
                margins: cellMargins,
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({ text: `${item.action}\n`, bold: true, size: 18 }),
                      new TextRun({ text: `Expected Impact: ${item.expectedImpact}`, size: 17, color: '475569' }),
                    ],
                  }),
                ],
              }),
            ],
          })
        ),
      ];
      sectionsChildren.push(
        new Table({
          rows: actionTableRows,
          width: { size: 9600, type: WidthType.DXA },
        })
      );
    }
  } else {
    sectionsChildren.push(
      new Paragraph({
        children: [new TextRun({ text: 'Diagnostic recommendations pending generation inside Relaunch BizPulse.', size: 19, color: '475569' })],
        spacing: { after: 160 },
      })
    );
  }

  if (uploadedDocuments.length > 0) {
    sectionsChildren.push(
      new Paragraph({
        text: '5. Uploaded Document Financial Audits',
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 240, after: 80 },
      })
    );
    uploadedDocuments.forEach((docItem) => {
      sectionsChildren.push(
        new Paragraph({
          children: [
            new TextRun({ text: `${docItem.fileName} (${new Date(docItem.uploadedAt).toLocaleDateString()})\n`, bold: true, size: 20 }),
            new TextRun({ text: `Summary: ${docItem.summary}\n`, size: 19 }),
            new TextRun({ text: `Earning Potential Assessment: ${docItem.earningPotentialAssessment}\n`, size: 19 }),
            new TextRun({ text: `Verified Facts: ${(docItem.verifiedFacts || []).join('; ') || 'None'}\n`, size: 18, color: '15803D' }),
            new TextRun({ text: `Assumptions Flagged: ${(docItem.assumptionsFlagged || []).join('; ') || 'None'}\n`, size: 18, color: 'B45309' }),
            new TextRun({ text: `Missing Financial Figures: ${(docItem.missingFinancialFigures || []).join('; ') || 'None'}\n\n`, size: 18, color: 'B91C1C' }),
          ],
          spacing: { after: 120 },
        })
      );
    });
  }

  if (reportBlocks.length > 0) {
    const customSecNum = uploadedDocuments.length > 0 ? 6 : 5;
    sectionsChildren.push(
      new Paragraph({
        text: `${customSecNum}. Custom Commentary & Owner Paragraphs`,
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 240, after: 80 },
      })
    );
    reportBlocks.forEach((blk) => {
      const blkFont = resolveDocxFont(blk.fontFamily);
      const blkSizeHalfPt = blk.fontSize === 'sm' ? 18 : blk.fontSize === 'lg' ? 24 : 20;
      const alignMap =
        blk.align === 'center'
          ? AlignmentType.CENTER
          : blk.align === 'justify'
          ? AlignmentType.BOTH
          : AlignmentType.LEFT;
      const accentHex =
        blk.accent === 'blue'
          ? '1D4ED8'
          : blk.accent === 'green'
          ? '15803D'
          : blk.accent === 'amber'
          ? 'B45309'
          : '0F172A';

      sectionsChildren.push(
        new Paragraph({
          alignment: alignMap,
          children: [
            new TextRun({
              text: blk.heading,
              bold: true,
              font: blkFont,
              size: blkSizeHalfPt + 2,
              color: accentHex,
            }),
          ],
          spacing: { before: 120, after: 40 },
        }),
        new Paragraph({
          alignment: alignMap,
          children: [
            new TextRun({
              text: blk.body,
              bold: Boolean(blk.bold),
              italics: Boolean(blk.italic),
              font: blkFont,
              size: blkSizeHalfPt,
              color: '1E293B',
            }),
          ],
          spacing: { after: 140 },
        })
      );
    });
  }

  sectionsChildren.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `Generated by Relaunch BizPulse — Executive Coaching & Diagnostic OS • Confidential Report for ${profile.name} (${profile.caseId})`,
          italics: true,
          size: 17,
          color: '64748B',
        }),
      ],
      spacing: { before: 240 },
    })
  );

  const wordDoc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: docxDefaultFont,
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 900, right: 900, bottom: 900, left: 900 },
          },
        },
        children: sectionsChildren,
      },
    ],
  });

  if (typeof window !== 'undefined' && typeof Blob !== 'undefined') {
    const blob = await Packer.toBlob(wordDoc);
    const buf = await blob.arrayBuffer();
    return new Uint8Array(buf);
  }
  const nodeBuf = await Packer.toBuffer(wordDoc);
  return new Uint8Array(nodeBuf);
}
