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
import { CaseRecord, HealthDimensionInput, HealthStatus, ReportFontFamily, TurnaroundAction } from '../types/bizpulse';
import { calculateOverallHealth, HEALTH_DIMENSION_ORDER } from './healthScoring';
import { mergeDiagnosticsIntoActionPlan } from './actionPlanEngine';
import { computeKpiTrend, computeKpiVariance, formatKpiNumber } from './kpiEngine';
import { KPI_CATEGORIES } from '../data/kpiCatalog';
import { computeRoiScenarioMetrics } from './roiEngine';

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
      return [29, 78, 216]; // #1D4ED8 Blue (Insufficient Information)
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
      return '1D4ED8';
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
    case 'unanswered':
    default:
      return null;
  }
}

/**
 * Generates a high-resolution Canvas PNG of the 12-Capability Radar & Bar chart
 * in browser environments for inclusion in Word (.docx) exports.
 */
export function renderHealthChartCanvasPng(caseRecord: CaseRecord): Uint8Array | null {
  if (typeof document === 'undefined') return null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 960;
    canvas.height = 560;
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
    ctx.fillText(`12-Capability Business Health Profile — ${caseRecord.profile.name}`, 20, 27);

    // Left: Radar Chart
    const cx = 215;
    const cy = 300;
    const radius = 150;
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

    // Right: Horizontal Score Bars (12 Capabilities)
    ctx.textAlign = 'left';
    const barStartX = 445;
    const barMaxW = 350;
    dims.forEach((key, idx) => {
      const item = caseRecord.healthInputs[key];
      const y = 76 + idx * 38;
      const numScore = getDimensionNumericScore(item?.status || 'unanswered');
      const [r, g, b] = getStatusRgb(item?.status || 'unanswered');

      ctx.fillStyle = '#0B1324';
      ctx.font = 'bold 11.5px sans-serif';
      ctx.fillText(item?.title || key, barStartX, y);

      // Background bar
      ctx.fillStyle = '#EEF2F8';
      ctx.fillRect(barStartX, y + 7, barMaxW, 12);

      // Score bar
      const fillW = numScore !== null ? Math.round((numScore / 100) * barMaxW) : 10;
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(barStartX, y + 7, fillW, 12);

      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.font = 'bold 11px monospace';
      ctx.fillText(
        numScore !== null ? `${numScore}/100 · ${formatStatusLabel(item.status)}` : formatStatusLabel(item?.status || 'unanswered'),
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
      : [29, 78, 216];

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

  // Visual Charts Block (Vector Radar + 12 Horizontal Bars — Guaranteed crisp & overlap-free)
  ensureSpace(305);
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(217, 226, 240);
  doc.roundedRect(margin, y, contentWidth, 295, 4, 4, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('12-Capability Equilibrium Chart & Quantitative Breakdown', margin + 12, y + 16);

  // Left Vector Radar
  const radarCx = margin + 108;
  const radarCy = y + 155;
  const radarR = 68;
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

  // Right Horizontal Score Bars (12 Capabilities)
  const barX = margin + 225;
  const barMaxW = 175;
  HEALTH_DIMENSION_ORDER.forEach((key, idx) => {
    const dim = healthInputs[key];
    const rowY = y + 32 + idx * 20.5;
    const sc = getDimensionNumericScore(dim?.status || 'unanswered');
    const [r, g, b] = getStatusRgb(dim?.status || 'unanswered');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(15, 23, 42);
    const shortTitle = (dim?.title || key).length > 34 ? `${(dim?.title || key).slice(0, 32)}…` : (dim?.title || key);
    doc.text(shortTitle, barX, rowY);

    doc.setFillColor(238, 242, 248);
    doc.rect(barX, rowY + 2.5, barMaxW, 5.5, 'F');
    const w = sc !== null ? Math.max(4, (sc / 100) * barMaxW) : 4;
    doc.setFillColor(r, g, b);
    doc.rect(barX, rowY + 2.5, w, 5.5, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(r, g, b);
    doc.text(
      sc !== null ? `${sc}/100 (${formatStatusLabel(dim.status)})` : formatStatusLabel(dim?.status || 'unanswered'),
      barX + barMaxW + 8,
      rowY + 7.5
    );
  });

  y += 308;

  // Section 2: Twelve Business Health Capabilities Detailed Table (Dynamic Wrapped Row Heights)
  drawSectionHeading('2', 'Twelve Business Health Capabilities (Detailed Evidence)');

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

  // Section 3: Key Operational Strengths & Weaknesses
  drawSectionHeading('3', 'Key Strengths & Priority Weaknesses');
  const attentionDims = HEALTH_DIMENSION_ORDER.map((k) => healthInputs[k]).filter(
    (d) => d && (d.status === 'at_risk' || d.status === 'needs_attention')
  );
  drawWrappedParagraph('Core Operational Strengths:', { fontSize: 9, bold: true, color: [21, 128, 61], gapAfter: 3 });
  if (computedHealth.strongestAreas.length > 0) {
    computedHealth.strongestAreas.forEach((st) =>
      drawWrappedParagraph(`•  ${st}`, { fontSize: 8.5, indent: 8, gapAfter: 3 })
    );
  } else {
    drawWrappedParagraph('•  No capability currently rated Healthy.', { fontSize: 8.5, indent: 8, color: [82, 98, 122], gapAfter: 3 });
  }
  drawWrappedParagraph('Priority Weaknesses & Capability Gaps (At Risk / Needs Attention):', { fontSize: 9, bold: true, color: [185, 28, 28], gapAfter: 3 });
  if (attentionDims.length > 0) {
    attentionDims.forEach((d) =>
      drawWrappedParagraph(
        `•  ${d.title} [${formatStatusLabel(d.status)}]${d.notes?.trim() ? ` — ${d.notes.trim()}` : ''}`,
        { fontSize: 8.5, indent: 8, gapAfter: 3 }
      )
    );
  } else {
    drawWrappedParagraph('•  No capabilities currently flagged Needs Attention or At Risk.', { fontSize: 8.5, indent: 8, color: [82, 98, 122], gapAfter: 3 });
  }
  y += 4;

  // Section 4: Financial & Operational Risks
  drawSectionHeading('4', `Financial & Operational Risks (${profile.currency})`);
  if (financials) {
    const finItems = [
      `Annual Revenue: ${financials.annualRevenue != null ? `${profile.currency} ${financials.annualRevenue.toLocaleString()}` : 'Not supplied'} | Operating Profit: ${financials.operatingProfit != null ? `${profile.currency} ${financials.operatingProfit.toLocaleString()}` : 'Not supplied'}`,
      `Cash in Bank: ${financials.cashInBank != null ? `${profile.currency} ${financials.cashInBank.toLocaleString()}` : 'Not supplied'} | Supplier Payables: ${financials.accountsPayable != null ? `${profile.currency} ${financials.accountsPayable.toLocaleString()}` : 'Not supplied'}`,
      `Accounts Receivable: ${financials.accountsReceivable != null ? `${profile.currency} ${financials.accountsReceivable.toLocaleString()}` : 'Not supplied'} (Overdue >60d: ${financials.overdueReceivables != null ? `${profile.currency} ${financials.overdueReceivables.toLocaleString()}` : 'Not supplied'})`,
      `Credit Facility Drawn: ${financials.creditFacilityUsed != null ? `${profile.currency} ${financials.creditFacilityUsed.toLocaleString()}` : '0'} of ${financials.creditFacilityLimit != null ? `${profile.currency} ${financials.creditFacilityLimit.toLocaleString()}` : '0'} limit`,
      `Customer Concentration & Terms: ${financials.customerCount ?? '—'} active customers | Top 5 share: ${financials.top5ConcentrationPercent != null ? `${financials.top5ConcentrationPercent}%` : '—'} | Standard Terms vs Actual: ${financials.standardPaymentTermsDays ?? '—'}d vs ${financials.actualPaymentDelayDays ?? '—'}d | Last Price Review: ${financials.pricingReviewLastYears != null ? `${financials.pricingReviewLastYears} yr(s) ago` : '—'}`,
    ];
    finItems.forEach((line) => drawWrappedParagraph(`•  ${line}`, { fontSize: 8.3, indent: 6, gapAfter: 3 }));
  } else {
    drawWrappedParagraph('No financial ledger figures have been entered yet in the Cash Flow Workbench.', { fontSize: 8.5, indent: 6, color: [82, 98, 122], gapAfter: 4 });
  }
  drawWrappedParagraph('Critical Risks Identified:', { fontSize: 9, bold: true, color: [185, 28, 28], gapAfter: 3 });
  computedHealth.criticalRisksIdentified.forEach((risk) =>
    drawWrappedParagraph(`•  ${risk}`, { fontSize: 8.5, indent: 8, gapAfter: 3 })
  );
  if (recommendations?.sustainabilityRisks?.length) {
    drawWrappedParagraph('Commercial & Sustainability Risks:', { fontSize: 9, bold: true, color: [180, 83, 9], gapAfter: 3 });
    recommendations.sustainabilityRisks.forEach((r) =>
      drawWrappedParagraph(`•  ${r}`, { fontSize: 8.3, indent: 8, gapAfter: 3 })
    );
  }
  y += 4;

  // Section 5: Improvement & Profit Opportunities (incl. CRM & ROI)
  drawSectionHeading('5', 'Improvement & Profit Opportunities (CRM & ROI)');
  if (recommendations?.profitOpportunities?.length) {
    drawWrappedParagraph('Structured Profit & Revenue Leakage Opportunities:', { fontSize: 9, bold: true, color: [29, 78, 216], gapAfter: 3 });
    recommendations.profitOpportunities.forEach((opp, idx) => {
      drawWrappedParagraph(
        `${idx + 1}. [${opp.area} · ${opp.horizon}] ${opp.title} — Impact: ${opp.estimatedFinancialImpact} | First Step: ${opp.whatToDoFirst || opp.evidenceBasis}`,
        { fontSize: 8.2, indent: 8, gapAfter: 3 }
      );
      if (opp.illustrativeExample) {
        drawWrappedParagraph(`Illustrative: ${opp.illustrativeExample}`, { fontSize: 7.8, italic: true, indent: 14, color: [71, 85, 105], gapAfter: 3 });
      }
    });
  }
  if (recommendations?.hiddenProfitOpportunities?.length) {
    drawWrappedParagraph('Hidden Profit Opportunities:', { fontSize: 9, bold: true, color: [21, 128, 61], gapAfter: 2 });
    recommendations.hiddenProfitOpportunities.forEach((o) => drawWrappedParagraph(`•  ${o}`, { fontSize: 8.4, indent: 8, gapAfter: 2 }));
  }
  if (recommendations?.revenueFlowImprovements?.length) {
    drawWrappedParagraph('Revenue Flow & Working Capital Improvements:', { fontSize: 9, bold: true, color: [21, 128, 61], gapAfter: 2 });
    recommendations.revenueFlowImprovements.forEach((rev) => drawWrappedParagraph(`•  ${rev}`, { fontSize: 8.4, indent: 8, gapAfter: 2 }));
  }
  const crmList = rawCase.crmContacts || [];
  const roiList = rawCase.roiScenarios || [];
  if (crmList.length > 0) {
    drawWrappedParagraph(`CRM Accounts & Pipeline (${crmList.length} records):`, { fontSize: 9, bold: true, color: [15, 23, 42], gapAfter: 3 });
    crmList.slice(0, 12).forEach((c) => {
      drawWrappedParagraph(
        `• ${c.companyOrName} (${c.recordType} · ${c.tier}) — Stage: ${c.salesStage} | Status: ${c.status} | Monthly: ${profile.currency} ${Number(c.monthlyValue || 0).toLocaleString()} | Opp: ${profile.currency} ${Number(c.opportunityValue || 0).toLocaleString()} | Follow-up: ${c.nextFollowUpDate || 'Unscheduled'}`,
        { fontSize: 8, indent: 8, gapAfter: 2 }
      );
    });
  }
  if (roiList.length > 0) {
    drawWrappedParagraph(`ROI & Break-Even Scenarios (${roiList.length} modeled):`, { fontSize: 9, bold: true, color: [29, 78, 216], gapAfter: 3 });
    roiList.forEach((s) => {
      const m = computeRoiScenarioMetrics(s);
      const roiLabel = !m.hasSufficientData
        ? 'Insufficient Data'
        : m.roiPct !== null
        ? `${m.roiPct.toFixed(1)}% ROI`
        : 'Zero-Cost Margin Gain';
      drawWrappedParagraph(
        `• ${s.name} [${s.category}${s.dataOrigin === 'draft_estimate' ? ' · Draft' : ''}] — Upfront: ${profile.currency} ${s.upfrontInvestment.toLocaleString()} | Monthly Rev: ${profile.currency} ${s.expectedMonthlyRevenue.toLocaleString()} @ ${s.grossMarginPct}% GM | ${s.monthsHorizon}m Net Benefit: ${profile.currency} ${Math.round(m.horizonNetBenefit).toLocaleString()} (${roiLabel}, ${s.confidencePct}% confidence)`,
        { fontSize: 8, indent: 8, gapAfter: 2 }
      );
    });
  }
  if (!recommendations && crmList.length === 0 && roiList.length === 0) {
    drawWrappedParagraph('No profit opportunities, CRM deals, or ROI scenarios recorded yet.', { fontSize: 8.5, indent: 6, color: [82, 98, 122] });
  }
  y += 4;

  // Section 6: Priority Coaching Recommendations & Sustainability Assessment
  drawSectionHeading('6', 'Priority Recommendations & Business Sustainability');
  if (recommendations) {
    drawWrappedParagraph('Primary Commercial Observation:', { fontSize: 9, bold: true, color: [15, 23, 42], gapAfter: 2 });
    drawWrappedParagraph(recommendations.initialObservation, { fontSize: 8.5, indent: 6, gapAfter: 5 });

    drawWrappedParagraph('Why This Matters Commercially:', { fontSize: 9, bold: true, color: [15, 23, 42], gapAfter: 2 });
    drawWrappedParagraph(recommendations.commercialWhy, { fontSize: 8.5, indent: 6, gapAfter: 5 });

    drawWrappedParagraph('Core Turnaround Recommendation:', { fontSize: 9, bold: true, color: [29, 78, 216], gapAfter: 2 });
    drawWrappedParagraph(recommendations.initialRecommendation, { fontSize: 8.5, indent: 6, gapAfter: 5 });

    drawWrappedParagraph('Immediate Action (Next 48–72 Hours):', { fontSize: 9, bold: true, color: [21, 128, 61], gapAfter: 2 });
    drawWrappedParagraph(recommendations.immediateAction, { fontSize: 8.5, bold: true, indent: 6, gapAfter: 5 });

    if (recommendations.sustainabilityAssessment) {
      const sust = recommendations.sustainabilityAssessment;
      drawWrappedParagraph(`Business Sustainability & Strategic Choice: ${sust.recommendedChoice}`, { fontSize: 9, bold: true, color: [15, 23, 42], gapAfter: 2 });
      drawWrappedParagraph(`Current Position: ${sust.currentPositionSummary}`, { fontSize: 8.3, indent: 8, gapAfter: 2 });
      drawWrappedParagraph(`6–12 Month Outlook: ${sust.futureOutlook6to12Months}`, { fontSize: 8.3, indent: 8, gapAfter: 2 });
      drawWrappedParagraph(`Strategic Rationale: ${sust.choiceRationale}`, { fontSize: 8.3, indent: 8, gapAfter: 3 });
      sust.areas?.forEach((a) => {
        drawWrappedParagraph(`• ${a.area} [${a.status.toUpperCase()}]: ${a.assessment}`, { fontSize: 8, indent: 10, gapAfter: 2 });
      });
      drawWrappedParagraph(`Notice: ${sust.disclaimer}`, { fontSize: 7.5, italic: true, indent: 8, color: [100, 116, 139], gapAfter: 5 });
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
      'Executive AI recommendations have not yet been generated for this business. Open the Coaching & Actions tab or click Generate Business Health Report to synthesize tailored guidance.',
      { fontSize: 8.5, color: [82, 98, 122] }
    );
  }

  // Section 7: 30 / 60 / 90-Day Action Plan Table
  drawSectionHeading('7', '30 / 60 / 90-Day Action Plan');
  const resolvedActionPlan: TurnaroundAction[] =
    rawCase.actionPlan && rawCase.actionPlan.length > 0
      ? rawCase.actionPlan
      : mergeDiagnosticsIntoActionPlan(rawCase);
  if (resolvedActionPlan.length > 0) {
    const actCols = [72, 115, 165, 78, contentWidth - 430];
    const drawActionHeader = () => {
      ensureSpace(22);
      doc.setFillColor(15, 23, 42);
      doc.rect(margin, y, contentWidth, 20, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(255, 255, 255);
      doc.text('Priority / Status', margin + 5, y + 13);
      doc.text('Issue / Why', margin + actCols[0] + 5, y + 13);
      doc.text('Recommended Action', margin + actCols[0] + actCols[1] + 5, y + 13);
      doc.text('Owner / Time', margin + actCols[0] + actCols[1] + actCols[2] + 5, y + 13);
      doc.text('Success KPI', margin + actCols[0] + actCols[1] + actCols[2] + actCols[3] + 5, y + 13);
      y += 20;
    };
    drawActionHeader();
    resolvedActionPlan.forEach((act, idx) => {
      const statusTxt = act.completed ? 'Completed' : act.status === 'in_progress' ? 'In Progress' : 'Pending';
      const pLines = doc.splitTextToSize(`${act.priority}\n[${statusTxt}]`, actCols[0] - 8);
      const issueWhy = `${act.businessIssue || 'Diagnostic priority'}${act.rationale ? ` — ${act.rationale}` : ''}`;
      const iLines = doc.splitTextToSize(issueWhy, actCols[1] - 8);
      const aLines = doc.splitTextToSize(act.action, actCols[2] - 8);
      const oLines = doc.splitTextToSize(`${act.accountableRole}\n${act.targetCompletionDate || act.timeframe}`, actCols[3] - 8);
      const kLines = doc.splitTextToSize(`${act.metricLink ? `${act.metricLink}: ` : ''}${act.measurableSuccessIndicator}`, actCols[4] - 8);
      const maxLines = Math.max(pLines.length, iLines.length, aLines.length, oLines.length, kLines.length);
      const rowH = Math.max(24, maxLines * 9.5 + 8);
      if (y + rowH > bottomLimit) {
        doc.addPage();
        drawRunningHeader(false);
        drawActionHeader();
      }
      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, y, contentWidth, rowH, 'F');
      }
      doc.setDrawColor(226, 232, 240);
      doc.rect(margin, y, contentWidth, rowH, 'S');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.2);
      doc.setTextColor(15, 23, 42);
      doc.text(pLines, margin + 4, y + 11);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(51, 65, 85);
      doc.text(iLines, margin + actCols[0] + 4, y + 11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(aLines, margin + actCols[0] + actCols[1] + 4, y + 11);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(51, 65, 85);
      doc.text(oLines, margin + actCols[0] + actCols[1] + actCols[2] + 4, y + 11);
      doc.text(kLines, margin + actCols[0] + actCols[1] + actCols[2] + actCols[3] + 4, y + 11);
      y += rowH;
    });
    y += 10;
  } else {
    drawWrappedParagraph(
      'No 30/60/90-day action items recorded yet. Generate Coaching Recommendations or add tasks on the Action Plan tab.',
      { fontSize: 8.5, color: [82, 98, 122], gapAfter: 8 }
    );
  }

  // Section 8: KPIs & Performance Monitoring
  drawSectionHeading('8', 'KPIs & Performance Monitoring');
  const kpis = rawCase.kpiTracker?.kpis || [];
  if (kpis.length > 0) {
    const kCols = [135, 72, 72, 72, 65, contentWidth - 416];
    const drawKpiHeader = () => {
      ensureSpace(22);
      doc.setFillColor(15, 23, 42);
      doc.rect(margin, y, contentWidth, 20, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(255, 255, 255);
      doc.text('KPI & Category', margin + 5, y + 13);
      doc.text('Baseline', margin + kCols[0] + 5, y + 13);
      doc.text('Target', margin + kCols[0] + kCols[1] + 5, y + 13);
      doc.text('Latest Actual', margin + kCols[0] + kCols[1] + kCols[2] + 5, y + 13);
      doc.text('Trend', margin + kCols[0] + kCols[1] + kCols[2] + kCols[3] + 5, y + 13);
      doc.text('Variance & Note', margin + kCols[0] + kCols[1] + kCols[2] + kCols[3] + kCols[4] + 5, y + 13);
      y += 20;
    };
    drawKpiHeader();
    kpis.forEach((k, idx) => {
      const catLabel = k.categoryLabel || KPI_CATEGORIES.find((c) => c.id === k.category)?.label || k.category;
      const variance = computeKpiVariance(k.latestActualValue, k.targetValue, k.direction, k.unit, profile.currency);
      const trend = computeKpiTrend(k.latestActualValue, k.previousValue, k.direction, k.unit);
      const nLines = doc.splitTextToSize(`${k.name}\n[${catLabel}]`, kCols[0] - 8);
      const bLines = doc.splitTextToSize(formatKpiNumber(k.baselineValue, k.unit, profile.currency), kCols[1] - 8);
      const tLines = doc.splitTextToSize(formatKpiNumber(k.targetValue, k.unit, profile.currency), kCols[2] - 8);
      const aLines = doc.splitTextToSize(formatKpiNumber(k.latestActualValue, k.unit, profile.currency), kCols[3] - 8);
      const trLines = doc.splitTextToSize(trend, kCols[4] - 8);
      const vNote = `${variance ? `${variance.formattedDelta} (${variance.statusLabel})` : 'Target/actual needed'}${k.ownerComment ? ` — ${k.ownerComment}` : ''}`;
      const vLines = doc.splitTextToSize(vNote, kCols[5] - 8);
      const rowH = Math.max(22, Math.max(nLines.length, vLines.length, aLines.length) * 9.5 + 8);
      if (y + rowH > bottomLimit) {
        doc.addPage();
        drawRunningHeader(false);
        drawKpiHeader();
      }
      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, y, contentWidth, rowH, 'F');
      }
      doc.setDrawColor(226, 232, 240);
      doc.rect(margin, y, contentWidth, rowH, 'S');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.2);
      doc.setTextColor(15, 23, 42);
      doc.text(nLines, margin + 4, y + 11);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(51, 65, 85);
      doc.text(bLines, margin + kCols[0] + 4, y + 11);
      doc.text(tLines, margin + kCols[0] + kCols[1] + 4, y + 11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(aLines, margin + kCols[0] + kCols[1] + kCols[2] + 4, y + 11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(trend === 'Improving' ? 21 : trend === 'Declining' ? 185 : 71, trend === 'Improving' ? 128 : trend === 'Declining' ? 28 : 85, trend === 'Improving' ? 61 : trend === 'Declining' ? 28 : 105);
      doc.text(trLines, margin + kCols[0] + kCols[1] + kCols[2] + kCols[3] + 4, y + 11);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(51, 65, 85);
      doc.text(vLines, margin + kCols[0] + kCols[1] + kCols[2] + kCols[3] + kCols[4] + 4, y + 11);
      y += rowH;
    });
    y += 10;
  } else {
    drawWrappedParagraph(
      'KPI & Performance Tracker has not been initialized for this business yet. Open Measure Improvement -> KPI & Performance Tracker to activate baseline and target tracking.',
      { fontSize: 8.5, color: [82, 98, 122], gapAfter: 8 }
    );
  }

  // Section 9: Information Gaps, Assumptions, Document Audits & Custom Notes
  drawSectionHeading('9', 'Information Gaps, Assumptions, Document Audits & Owner Notes');
  drawWrappedParagraph('Missing Information & Evidence Gaps (Blue):', { fontSize: 9, bold: true, color: [29, 78, 216], gapAfter: 3 });
  if (computedHealth.missingEvidenceAreas.length > 0) {
    computedHealth.missingEvidenceAreas.forEach((gap) =>
      drawWrappedParagraph(`•  ${gap}`, { fontSize: 8.4, indent: 8, gapAfter: 2 })
    );
  } else {
    drawWrappedParagraph('•  All 12 Business Health capabilities have been answered.', { fontSize: 8.4, indent: 8, color: [21, 128, 61], gapAfter: 2 });
  }
  if (recommendations?.knownsVsAssumptions) {
    const kva = recommendations.knownsVsAssumptions;
    if (kva.knowns?.length) {
      drawWrappedParagraph(`Established Knowns: ${kva.knowns.join('; ')}`, { fontSize: 8.2, indent: 8, color: [21, 128, 61], gapAfter: 2 });
    }
    if (kva.assumptions?.length) {
      drawWrappedParagraph(`Working Assumptions to Verify: ${kva.assumptions.join('; ')}`, { fontSize: 8.2, indent: 8, color: [180, 83, 9], gapAfter: 2 });
    }
    if (kva.unknowns?.length) {
      drawWrappedParagraph(`Missing / Unknown Data: ${kva.unknowns.join('; ')}`, { fontSize: 8.2, indent: 8, color: [29, 78, 216], gapAfter: 4 });
    }
  }
  if (recommendations?.missingEvidence?.length) {
    drawWrappedParagraph(`Missing Financial/Operational Records: ${recommendations.missingEvidence.join('; ')}`, { fontSize: 8.2, indent: 8, color: [185, 28, 28], gapAfter: 4 });
  }
  if (uploadedDocuments.length > 0) {
    drawWrappedParagraph(`Uploaded Document Financial Audits (${uploadedDocuments.length}):`, { fontSize: 9, bold: true, color: [15, 23, 42], gapAfter: 3 });
    uploadedDocuments.forEach((uDoc, i) => {
      drawWrappedParagraph(`${i + 1}. ${uDoc.fileName} (${new Date(uDoc.uploadedAt).toLocaleDateString()})`, {
        fontSize: 8.6,
        bold: true,
        color: [15, 23, 42],
        indent: 6,
        gapAfter: 2,
      });
      drawWrappedParagraph(`Summary: ${uDoc.summary}`, { fontSize: 8.2, indent: 10, gapAfter: 2 });
      drawWrappedParagraph(`Earning Potential Assessment: ${uDoc.earningPotentialAssessment}`, { fontSize: 8.2, indent: 10, gapAfter: 2 });
      if (uDoc.verifiedFacts?.length) {
        drawWrappedParagraph(`Verified Facts: ${uDoc.verifiedFacts.join('; ')}`, { fontSize: 7.9, indent: 10, color: [21, 128, 61], gapAfter: 2 });
      }
      if (uDoc.assumptionsFlagged?.length) {
        drawWrappedParagraph(`Assumptions Flagged: ${uDoc.assumptionsFlagged.join('; ')}`, { fontSize: 7.9, indent: 10, color: [180, 83, 9], gapAfter: 2 });
      }
      if (uDoc.missingFinancialFigures?.length) {
        drawWrappedParagraph(`Missing Figures: ${uDoc.missingFinancialFigures.join('; ')}`, { fontSize: 7.9, indent: 10, color: [185, 28, 28], gapAfter: 5 });
      }
    });
  }
  if (reportBlocks.length > 0) {
    drawWrappedParagraph('Custom Commentary & Owner Paragraphs:', { fontSize: 9, bold: true, color: [15, 23, 42], gapAfter: 3 });
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
            transformation: { width: 580, height: 338 },
            type: 'png',
          }),
        ],
        spacing: { before: 80, after: 200 },
      })
    );
  }

  sectionsChildren.push(
    new Paragraph({
      text: '2. Twelve Business Health Capabilities',
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 160, after: 100 },
    }),
    new Table({
      rows: [headerRow, ...dimensionRows],
      width: { size: 9600, type: WidthType.DXA },
    })
  );

  // 3. Key Strengths & Priority Weaknesses
  const attentionDimsDocx = HEALTH_DIMENSION_ORDER.map((k) => healthInputs[k]).filter(
    (d) => d && (d.status === 'at_risk' || d.status === 'needs_attention')
  );
  sectionsChildren.push(
    new Paragraph({
      text: '3. Key Operational Strengths & Weaknesses',
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 220, after: 80 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Core Strengths:\n', bold: true, color: '15803D', size: 20 }),
        ...(computedHealth.strongestAreas.length > 0
          ? computedHealth.strongestAreas.map((s) => new TextRun({ text: `• ${s}\n`, size: 19 }))
          : [new TextRun({ text: '• No capability currently rated Healthy.\n', size: 19, color: '64748B' })]),
        new TextRun({ text: '\nPriority Weaknesses & Capability Gaps:\n', bold: true, color: 'B91C1C', size: 20 }),
        ...(attentionDimsDocx.length > 0
          ? attentionDimsDocx.map(
              (d) =>
                new TextRun({
                  text: `• ${d.title} [${formatStatusLabel(d.status)}]${d.notes?.trim() ? ` — ${d.notes.trim()}` : ''}\n`,
                  size: 19,
                })
            )
          : [new TextRun({ text: '• No capabilities currently flagged Needs Attention or At Risk.\n', size: 19, color: '64748B' })]),
      ],
      spacing: { after: 160 },
    })
  );

  // 4. Financial & Operational Risks
  sectionsChildren.push(
    new Paragraph({
      text: `4. Financial & Operational Risks (${profile.currency})`,
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 220, after: 80 },
    })
  );
  if (financials) {
    sectionsChildren.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Annual Revenue: ${financials.annualRevenue?.toLocaleString() ?? 'N/A'}  |  Operating Profit: ${financials.operatingProfit?.toLocaleString() ?? 'N/A'}  |  Cash in Bank: ${financials.cashInBank?.toLocaleString() ?? 'N/A'}\nAccounts Receivable: ${financials.accountsReceivable?.toLocaleString() ?? 'N/A'} (Overdue >60d: ${financials.overdueReceivables?.toLocaleString() ?? 'N/A'})  |  Payables: ${financials.accountsPayable?.toLocaleString() ?? 'N/A'}\nCredit Facility Drawn: ${financials.creditFacilityUsed?.toLocaleString() ?? '0'} / ${financials.creditFacilityLimit?.toLocaleString() ?? '0'} limit\nActive Customers: ${financials.customerCount ?? '—'}  |  Top 5 Share: ${financials.top5ConcentrationPercent != null ? `${financials.top5ConcentrationPercent}%` : '—'}  |  Terms vs Actual Delay: ${financials.standardPaymentTermsDays ?? '—'}d vs ${financials.actualPaymentDelayDays ?? '—'}d  |  Last Price Review: ${financials.pricingReviewLastYears != null ? `${financials.pricingReviewLastYears} yr(s)` : '—'}`,
            size: 19,
          }),
        ],
        spacing: { after: 120 },
      })
    );
  }
  sectionsChildren.push(
    new Paragraph({
      children: [
        new TextRun({ text: 'Critical Risks Identified:\n', bold: true, color: 'B91C1C', size: 20 }),
        ...computedHealth.criticalRisksIdentified.map((r) => new TextRun({ text: `• ${r}\n`, size: 19 })),
        ...(recommendations?.sustainabilityRisks?.length
          ? [
              new TextRun({ text: '\nSustainability & Commercial Risks:\n', bold: true, color: 'B45309', size: 20 }),
              ...recommendations.sustainabilityRisks.map((x) => new TextRun({ text: `• ${x}\n`, size: 19 })),
            ]
          : []),
      ],
      spacing: { after: 160 },
    })
  );

  // 5. Improvement & Profit Opportunities (CRM & ROI)
  sectionsChildren.push(
    new Paragraph({
      text: '5. Improvement & Profit Opportunities (CRM & ROI)',
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 220, after: 80 },
    })
  );
  if (recommendations?.profitOpportunities?.length) {
    recommendations.profitOpportunities.forEach((opp, idx) => {
      sectionsChildren.push(
        new Paragraph({
          children: [
            new TextRun({ text: `${idx + 1}. [${opp.area} · ${opp.horizon}] ${opp.title}\n`, bold: true, size: 19 }),
            new TextRun({ text: `Evidence: ${opp.evidenceBasis}\nFirst Step: ${opp.whatToDoFirst || 'Review baseline margin'}\nImpact: ${opp.estimatedFinancialImpact}\n`, size: 18 }),
            ...(opp.illustrativeExample ? [new TextRun({ text: `Illustrative: ${opp.illustrativeExample}\n`, italics: true, size: 17, color: '475569' })] : []),
          ],
          spacing: { after: 80 },
        })
      );
    });
  }
  if (recommendations?.hiddenProfitOpportunities?.length || recommendations?.revenueFlowImprovements?.length) {
    sectionsChildren.push(
      new Paragraph({
        children: [
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
              ]
            : []),
        ],
        spacing: { after: 120 },
      })
    );
  }
  if (rawCase.crmContacts?.length) {
    rawCase.crmContacts.slice(0, 12).forEach((c) => {
      sectionsChildren.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `• CRM: ${c.companyOrName} (${c.recordType} · ${c.tier}) | Stage: ${c.salesStage} | Status: ${c.status} | Monthly: ${profile.currency} ${Number(c.monthlyValue || 0).toLocaleString()} | Opp: ${profile.currency} ${Number(c.opportunityValue || 0).toLocaleString()}`,
              size: 18,
            }),
          ],
          spacing: { after: 40 },
        })
      );
    });
  }
  if (rawCase.roiScenarios?.length) {
    rawCase.roiScenarios.forEach((s) => {
      const m = computeRoiScenarioMetrics(s);
      const roiTxt = !m.hasSufficientData ? 'Insufficient Data' : m.roiPct !== null ? `${m.roiPct.toFixed(1)}% ROI` : 'Zero-Cost Margin Gain';
      sectionsChildren.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `• ROI Scenario "${s.name}" [${s.category}]: Upfront ${profile.currency} ${s.upfrontInvestment.toLocaleString()}, Monthly Rev ${profile.currency} ${s.expectedMonthlyRevenue.toLocaleString()} @ ${s.grossMarginPct}% GM, ${s.monthsHorizon}m Net Benefit ${profile.currency} ${Math.round(m.horizonNetBenefit).toLocaleString()} (${roiTxt})`,
              size: 18,
            }),
          ],
          spacing: { after: 40 },
        })
      );
    });
  }

  // 6. Priority Coaching Recommendations & Business Sustainability
  sectionsChildren.push(
    new Paragraph({
      text: '6. Priority Recommendations & Business Sustainability',
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
        spacing: { after: 140 },
      })
    );
    if (recommendations.sustainabilityAssessment) {
      const sust = recommendations.sustainabilityAssessment;
      sectionsChildren.push(
        new Paragraph({
          children: [
            new TextRun({ text: `Sustainability Choice: ${sust.recommendedChoice}\n`, bold: true, size: 21, color: '1D4ED8' }),
            new TextRun({ text: `Current Position: ${sust.currentPositionSummary}\n`, size: 19 }),
            new TextRun({ text: `6–12 Month Outlook: ${sust.futureOutlook6to12Months}\n`, size: 19 }),
            new TextRun({ text: `Rationale: ${sust.choiceRationale}\n`, size: 19 }),
            ...(sust.areas || []).map(
              (a) => new TextRun({ text: `• ${a.area} [${a.status.toUpperCase()}]: ${a.assessment} (${a.keyDriverOrGap})\n`, size: 18 })
            ),
            new TextRun({ text: `\nNotice: ${sust.disclaimer}\n`, italics: true, size: 17, color: '64748B' }),
          ],
          spacing: { after: 140 },
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

  // 7. 30 / 60 / 90-Day Action Plan Table
  sectionsChildren.push(
    new Paragraph({
      text: '7. 30 / 60 / 90-Day Action Plan',
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 220, after: 80 },
    })
  );
  const resolvedDocxPlan: TurnaroundAction[] =
    rawCase.actionPlan && rawCase.actionPlan.length > 0
      ? rawCase.actionPlan
      : mergeDiagnosticsIntoActionPlan(rawCase);
  if (resolvedDocxPlan.length > 0) {
    const planHeader = new TableRow({
      tableHeader: true,
      children: [
        ['Priority / Status', 1500],
        ['Issue / Rationale', 2200],
        ['Recommended Action', 2400],
        ['Owner & Timeframe', 1600],
        ['Success KPI', 1900],
      ].map(
        ([label, w]) =>
          new TableCell({
            width: { size: w as number, type: WidthType.DXA },
            shading: { type: ShadingType.CLEAR, fill: '1D4ED8' },
            borders: cellBorders,
            margins: cellMargins,
            children: [new Paragraph({ children: [new TextRun({ text: label as string, bold: true, color: 'FFFFFF', size: 18 })] })],
          })
      ),
    });
    const planRows = resolvedDocxPlan.map((act) => {
      const statusTxt = act.completed ? 'Completed' : act.status === 'in_progress' ? 'In Progress' : 'Pending';
      return new TableRow({
        children: [
          new TableCell({
            borders: cellBorders,
            margins: cellMargins,
            children: [new Paragraph({ children: [new TextRun({ text: `${act.priority}\n[${statusTxt}]`, bold: true, size: 17 })] })],
          }),
          new TableCell({
            borders: cellBorders,
            margins: cellMargins,
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: `${act.businessIssue || 'Diagnostic priority'}\n`, bold: true, size: 17 }),
                  ...(act.rationale ? [new TextRun({ text: act.rationale, size: 16, color: '475569' })] : []),
                ],
              }),
            ],
          }),
          new TableCell({
            borders: cellBorders,
            margins: cellMargins,
            children: [new Paragraph({ children: [new TextRun({ text: act.action, bold: true, size: 17 })] })],
          }),
          new TableCell({
            borders: cellBorders,
            margins: cellMargins,
            children: [new Paragraph({ children: [new TextRun({ text: `${act.accountableRole}\n${act.targetCompletionDate || act.timeframe}`, size: 17 })] })],
          }),
          new TableCell({
            borders: cellBorders,
            margins: cellMargins,
            children: [new Paragraph({ children: [new TextRun({ text: `${act.metricLink ? `${act.metricLink}: ` : ''}${act.measurableSuccessIndicator}`, size: 17 })] })],
          }),
        ],
      });
    });
    sectionsChildren.push(
      new Table({
        rows: [planHeader, ...planRows],
        width: { size: 9600, type: WidthType.DXA },
      })
    );
  } else {
    sectionsChildren.push(
      new Paragraph({
        children: [new TextRun({ text: 'No 30/60/90-day action items recorded yet.', size: 18, color: '475569' })],
        spacing: { after: 140 },
      })
    );
  }

  // 8. KPIs & Performance Monitoring Table
  sectionsChildren.push(
    new Paragraph({
      text: '8. KPIs & Performance Monitoring',
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 220, after: 80 },
    })
  );
  const docxKpis = rawCase.kpiTracker?.kpis || [];
  if (docxKpis.length > 0) {
    const kpiHeader = new TableRow({
      tableHeader: true,
      children: [
        ['KPI & Category', 2300],
        ['Baseline', 1300],
        ['Target', 1300],
        ['Latest Actual', 1400],
        ['Trend', 1300],
        ['Variance & Note', 2000],
      ].map(
        ([label, w]) =>
          new TableCell({
            width: { size: w as number, type: WidthType.DXA },
            shading: { type: ShadingType.CLEAR, fill: '0F172A' },
            borders: cellBorders,
            margins: cellMargins,
            children: [new Paragraph({ children: [new TextRun({ text: label as string, bold: true, color: 'FFFFFF', size: 18 })] })],
          })
      ),
    });
    const kpiRows = docxKpis.map((k) => {
      const catLabel = k.categoryLabel || KPI_CATEGORIES.find((c) => c.id === k.category)?.label || k.category;
      const variance = computeKpiVariance(k.latestActualValue, k.targetValue, k.direction, k.unit, profile.currency);
      const trend = computeKpiTrend(k.latestActualValue, k.previousValue, k.direction, k.unit);
      return new TableRow({
        children: [
          new TableCell({
            borders: cellBorders,
            margins: cellMargins,
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: `${k.name}\n`, bold: true, size: 17 }),
                  new TextRun({ text: catLabel, size: 16, color: '475569' }),
                ],
              }),
            ],
          }),
          new TableCell({
            borders: cellBorders,
            margins: cellMargins,
            children: [new Paragraph({ children: [new TextRun({ text: formatKpiNumber(k.baselineValue, k.unit, profile.currency), size: 17 })] })],
          }),
          new TableCell({
            borders: cellBorders,
            margins: cellMargins,
            children: [new Paragraph({ children: [new TextRun({ text: formatKpiNumber(k.targetValue, k.unit, profile.currency), size: 17 })] })],
          }),
          new TableCell({
            borders: cellBorders,
            margins: cellMargins,
            children: [new Paragraph({ children: [new TextRun({ text: formatKpiNumber(k.latestActualValue, k.unit, profile.currency), bold: true, size: 17 })] })],
          }),
          new TableCell({
            borders: cellBorders,
            margins: cellMargins,
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: trend,
                    bold: true,
                    size: 17,
                    color: trend === 'Improving' ? '15803D' : trend === 'Declining' ? 'B91C1C' : '475569',
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            borders: cellBorders,
            margins: cellMargins,
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: `${variance ? `${variance.formattedDelta} (${variance.statusLabel})` : 'Insufficient Data'}${k.ownerComment ? `\n${k.ownerComment}` : ''}`,
                    size: 16,
                    color: '334155',
                  }),
                ],
              }),
            ],
          }),
        ],
      });
    });
    sectionsChildren.push(
      new Table({
        rows: [kpiHeader, ...kpiRows],
        width: { size: 9600, type: WidthType.DXA },
      })
    );
  } else {
    sectionsChildren.push(
      new Paragraph({
        children: [new TextRun({ text: 'KPI & Performance Tracker not yet initialized for this case.', size: 18, color: '475569' })],
        spacing: { after: 140 },
      })
    );
  }

  // 9. Information Gaps, Knowns vs Assumptions, Document Audits & Custom Commentary
  sectionsChildren.push(
    new Paragraph({
      text: '9. Information Gaps, Assumptions, Document Audits & Owner Notes',
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 220, after: 80 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Information & Evidence Gaps (Blue):\n', bold: true, color: '1D4ED8', size: 20 }),
        ...(computedHealth.missingEvidenceAreas.length > 0
          ? computedHealth.missingEvidenceAreas.map((g) => new TextRun({ text: `• ${g}\n`, size: 19 }))
          : [new TextRun({ text: '• All 12 capabilities answered.\n', size: 19, color: '15803D' })]),
        ...(recommendations?.knownsVsAssumptions?.knowns?.length
          ? [new TextRun({ text: `\nEstablished Knowns: ${recommendations.knownsVsAssumptions.knowns.join('; ')}\n`, size: 18, color: '15803D' })]
          : []),
        ...(recommendations?.knownsVsAssumptions?.assumptions?.length
          ? [new TextRun({ text: `Working Assumptions: ${recommendations.knownsVsAssumptions.assumptions.join('; ')}\n`, size: 18, color: 'B45309' })]
          : []),
        ...(recommendations?.knownsVsAssumptions?.unknowns?.length
          ? [new TextRun({ text: `Unknowns / Missing Data: ${recommendations.knownsVsAssumptions.unknowns.join('; ')}\n`, size: 18, color: '1D4ED8' })]
          : []),
      ],
      spacing: { after: 140 },
    })
  );

  if (uploadedDocuments.length > 0) {
    sectionsChildren.push(
      new Paragraph({
        text: 'Uploaded Document Financial Audits',
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 160, after: 80 },
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
    sectionsChildren.push(
      new Paragraph({
        text: 'Custom Commentary & Owner Paragraphs',
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 180, after: 80 },
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

/**
 * Generates a dedicated Coaching & Actions Plan PDF document from Coaching Recommendations & 30/60/90 Action Plan.
 */
export function generateCoachingPlanPdfBytes(rawCase: CaseRecord): Uint8Array {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
  });
  const { profile, recommendations } = rawCase;
  const computedHealth = rawCase.overallHealth || calculateOverallHealth(rawCase.healthInputs, rawCase.financials);
  const actions: TurnaroundAction[] =
    rawCase.actionPlan && rawCase.actionPlan.length > 0
      ? rawCase.actionPlan
      : mergeDiagnosticsIntoActionPlan(rawCase);

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;
  const bottomLimit = pageHeight - 48;
  let y = 0;

  const drawHeader = (isFirst: boolean) => {
    if (isFirst) {
      doc.setFillColor(7, 11, 20);
      doc.rect(0, 0, pageWidth, 80, 'F');
      doc.setFillColor(37, 99, 235);
      doc.rect(0, 76, pageWidth, 4, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(147, 197, 253);
      doc.text('RELAUNCH BIZPULSE — COACHING & ACTIONS PLAN', margin, 24);
      doc.setFontSize(16);
      doc.setTextColor(255, 255, 255);
      doc.text(profile.name || 'Active Business', margin, 48);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(203, 213, 225);
      doc.text(`${profile.industry} (${profile.country}, ${profile.currency})  |  Health Score: ${computedHealth.overallScore ?? 'Pending'}/100 (${computedHealth.overallRating})`, margin, 66);
      y = 102;
    } else {
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, pageWidth, 32, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(255, 255, 255);
      doc.text(`${profile.name} — Coaching & Actions Plan`, margin, 20);
      y = 50;
    }
  };

  const ensureSpace = (needed: number) => {
    if (y + needed > bottomLimit) {
      doc.addPage();
      drawHeader(false);
    }
  };

  const heading = (title: string) => {
    ensureSpace(30);
    doc.setFillColor(239, 246, 255);
    doc.rect(margin, y, contentWidth, 20, 'F');
    doc.setFillColor(37, 99, 235);
    doc.rect(margin, y, 4, 20, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(title, margin + 10, y + 13.5);
    y += 28;
  };

  const para = (text: string, opts?: { bold?: boolean; italic?: boolean; size?: number; indent?: number; color?: [number, number, number]; gap?: number }) => {
    const size = opts?.size ?? 9;
    const indent = opts?.indent ?? 0;
    const lh = size * 1.38;
    const [r, g, b] = opts?.color ?? [30, 41, 59];
    doc.setFont('helvetica', opts?.bold ? 'bold' : opts?.italic ? 'italic' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(r, g, b);
    const lines: string[] = doc.splitTextToSize(String(text || ''), contentWidth - indent);
    for (const line of lines) {
      ensureSpace(lh + 2);
      doc.text(line, margin + indent, y);
      y += lh;
    }
    y += opts?.gap ?? 5;
  };

  drawHeader(true);
  para(`Primary Objective: ${profile.primaryObjective || 'Not specified'}`, { size: 8.5, gap: 2 });
  para(`Primary Concern: ${profile.primaryConcern || 'Not specified'}`, { size: 8.5, gap: 8 });

  if (recommendations) {
    heading('1. Primary Commercial Diagnosis & Impact');
    para(recommendations.initialObservation, { bold: true, size: 9.5, gap: 4 });
    para(recommendations.commercialWhy, { size: 8.8, indent: 6, gap: 6 });

    heading('2. Core Turnaround Strategy & 48–72 Hour Priority');
    para(recommendations.initialRecommendation, { size: 9, gap: 4 });
    para(`Immediate 48–72h Action: ${recommendations.immediateAction}`, { bold: true, color: [21, 128, 61], size: 9, gap: 6 });

    if (recommendations.profitOpportunities?.length) {
      heading('3. Top Profit & Revenue Leakage Opportunities');
      recommendations.profitOpportunities.forEach((opp, i) => {
        para(`${i + 1}. [${opp.area} · ${opp.horizon}] ${opp.title} — Impact: ${opp.estimatedFinancialImpact}`, { bold: true, size: 8.6, indent: 4, gap: 2 });
        para(`First Step: ${opp.whatToDoFirst || opp.evidenceBasis}`, { size: 8.2, indent: 10, gap: 4 });
      });
    }

    if (recommendations.sustainabilityAssessment) {
      const s = recommendations.sustainabilityAssessment;
      heading(`4. Business Sustainability & Strategic Choice (${s.recommendedChoice})`);
      para(`Current Position: ${s.currentPositionSummary}`, { size: 8.5, indent: 4, gap: 3 });
      para(`6–12 Month Outlook: ${s.futureOutlook6to12Months}`, { size: 8.5, indent: 4, gap: 3 });
      para(`Rationale: ${s.choiceRationale}`, { size: 8.5, indent: 4, gap: 5 });
    }

    heading('5. Prioritized Coaching Actions & Evidence Audit');
    recommendations.actionItems?.forEach((act, idx) => {
      para(`${idx + 1}. [${act.priority}] ${act.action} — Owner: ${act.ownerRole} | ${act.timeframe} | Impact: ${act.expectedImpact}`, { size: 8.4, indent: 4, gap: 3 });
    });
    if (recommendations.knownsVsAssumptions) {
      para(`Knowns: ${recommendations.knownsVsAssumptions.knowns.join('; ')}`, { size: 8, indent: 4, color: [21, 128, 61], gap: 2 });
      para(`Assumptions: ${recommendations.knownsVsAssumptions.assumptions.join('; ')}`, { size: 8, indent: 4, color: [180, 83, 9], gap: 2 });
      para(`Missing Info: ${recommendations.knownsVsAssumptions.unknowns.join('; ')}`, { size: 8, indent: 4, color: [29, 78, 216], gap: 5 });
    }
  } else {
    heading('1. Coaching Recommendations Pending');
    para('Coaching recommendations have not yet been generated for this business.', { size: 8.8, color: [82, 98, 122], gap: 6 });
  }

  heading('6. 30 / 60 / 90-Day Action Plan');
  if (actions.length > 0) {
    actions.forEach((a, idx) => {
      const st = a.completed ? 'Completed' : a.status === 'in_progress' ? 'In Progress' : 'Pending';
      para(`${idx + 1}. [${a.priority} · ${st}] ${a.action}`, { bold: true, size: 8.5, indent: 4, gap: 2 });
      para(`Issue: ${a.businessIssue || 'Diagnostic priority'} | Owner: ${a.accountableRole} | Timeframe: ${a.targetCompletionDate || a.timeframe} | Success KPI: ${a.measurableSuccessIndicator}`, { size: 8, indent: 10, color: [71, 85, 105], gap: 4 });
    });
  } else {
    para('No 30/60/90-day actions added yet.', { size: 8.5, color: [82, 98, 122] });
  }

  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Relaunch BizPulse • Coaching & Actions Plan • ${profile.name}`, margin, pageHeight - 20);
    doc.text(`Page ${p} of ${totalPages}`, pageWidth - margin, pageHeight - 20, { align: 'right' });
  }

  return new Uint8Array(doc.output('arraybuffer'));
}

/**
 * Generates a dedicated Coaching & Actions Plan Word (.docx) document.
 */
export async function generateCoachingPlanDocxUint8Array(rawCase: CaseRecord): Promise<Uint8Array> {
  const { profile, recommendations } = rawCase;
  const computedHealth = rawCase.overallHealth || calculateOverallHealth(rawCase.healthInputs, rawCase.financials);
  const actions: TurnaroundAction[] =
    rawCase.actionPlan && rawCase.actionPlan.length > 0
      ? rawCase.actionPlan
      : mergeDiagnosticsIntoActionPlan(rawCase);

  const children: (Paragraph | Table)[] = [
    new Paragraph({
      children: [new TextRun({ text: 'RELAUNCH BIZPULSE  •  COACHING & ACTIONS PLAN', bold: true, size: 18, color: '1D4ED8' })],
      spacing: { after: 100 },
    }),
    new Paragraph({
      text: `${profile.name || 'Active Business'} — Coaching & Actions Plan`,
      heading: HeadingLevel.TITLE,
      spacing: { after: 80 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Industry: ${profile.industry} (${profile.country}, ${profile.currency})  |  Health Score: ${computedHealth.overallScore ?? 'Pending'}/100 (${computedHealth.overallRating})\nPrimary Objective: ${profile.primaryObjective || 'Not specified'}\nPrimary Concern: ${profile.primaryConcern || 'Not specified'}`,
          size: 19,
          color: '334155',
        }),
      ],
      spacing: { after: 180 },
    }),
  ];

  if (recommendations) {
    children.push(
      new Paragraph({ text: '1. Commercial Diagnosis & Impact', heading: HeadingLevel.HEADING_1, spacing: { before: 140, after: 80 } }),
      new Paragraph({
        children: [
          new TextRun({ text: `${recommendations.initialObservation}\n\n`, bold: true, size: 20 }),
          new TextRun({ text: recommendations.commercialWhy, size: 19 }),
        ],
        spacing: { after: 140 },
      }),
      new Paragraph({ text: '2. Turnaround Strategy & 48–72 Hour Priority', heading: HeadingLevel.HEADING_1, spacing: { before: 140, after: 80 } }),
      new Paragraph({
        children: [
          new TextRun({ text: `${recommendations.initialRecommendation}\n\n`, size: 19 }),
          new TextRun({ text: `Immediate 48–72 Hour Action: ${recommendations.immediateAction}`, bold: true, color: '15803D', size: 19 }),
        ],
        spacing: { after: 140 },
      })
    );

    if (recommendations.profitOpportunities?.length) {
      children.push(new Paragraph({ text: '3. Profit & Revenue Leakage Opportunities', heading: HeadingLevel.HEADING_1, spacing: { before: 140, after: 80 } }));
      recommendations.profitOpportunities.forEach((opp, idx) => {
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: `${idx + 1}. [${opp.area} · ${opp.horizon}] ${opp.title}\n`, bold: true, size: 19 }),
              new TextRun({ text: `Impact: ${opp.estimatedFinancialImpact}  |  First Step: ${opp.whatToDoFirst || opp.evidenceBasis}`, size: 18 }),
            ],
            spacing: { after: 80 },
          })
        );
      });
    }

    if (recommendations.sustainabilityAssessment) {
      const s = recommendations.sustainabilityAssessment;
      children.push(
        new Paragraph({ text: `4. Sustainability Choice (${s.recommendedChoice})`, heading: HeadingLevel.HEADING_1, spacing: { before: 140, after: 80 } }),
        new Paragraph({
          children: [
            new TextRun({ text: `Current Position: ${s.currentPositionSummary}\n6–12 Month Outlook: ${s.futureOutlook6to12Months}\nRationale: ${s.choiceRationale}`, size: 19 }),
          ],
          spacing: { after: 120 },
        })
      );
    }

    if (recommendations.knownsVsAssumptions) {
      children.push(
        new Paragraph({ text: '5. Knowns, Working Assumptions & Missing Evidence', heading: HeadingLevel.HEADING_1, spacing: { before: 140, after: 80 } }),
        new Paragraph({
          children: [
            new TextRun({ text: `Knowns: ${recommendations.knownsVsAssumptions.knowns.join('; ')}\n`, size: 18, color: '15803D' }),
            new TextRun({ text: `Working Assumptions: ${recommendations.knownsVsAssumptions.assumptions.join('; ')}\n`, size: 18, color: 'B45309' }),
            new TextRun({ text: `Missing Info: ${recommendations.knownsVsAssumptions.unknowns.join('; ')}`, size: 18, color: '1D4ED8' }),
          ],
          spacing: { after: 140 },
        })
      );
    }
  }

  children.push(new Paragraph({ text: '6. 30 / 60 / 90-Day Action Plan', heading: HeadingLevel.HEADING_1, spacing: { before: 160, after: 80 } }));
  if (actions.length > 0) {
    actions.forEach((a, idx) => {
      const st = a.completed ? 'Completed' : a.status === 'in_progress' ? 'In Progress' : 'Pending';
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: `${idx + 1}. [${a.priority} · ${st}] ${a.action}\n`, bold: true, size: 19 }),
            new TextRun({ text: `Issue/Reason: ${a.businessIssue || 'Diagnostic priority'}${a.rationale ? ` — ${a.rationale}` : ''}\nOwner: ${a.accountableRole} | Timeframe: ${a.targetCompletionDate || a.timeframe} | Success KPI: ${a.measurableSuccessIndicator}`, size: 18, color: '334155' }),
          ],
          spacing: { after: 90 },
        })
      );
    });
  } else {
    children.push(new Paragraph({ children: [new TextRun({ text: 'No action items recorded yet.', size: 18, color: '475569' })] }));
  }

  const wordDoc = new Document({
    sections: [
      {
        properties: { page: { margin: { top: 900, right: 900, bottom: 900, left: 900 } } },
        children,
      },
    ],
  });

  if (typeof window !== 'undefined' && typeof Blob !== 'undefined') {
    const blob = await Packer.toBlob(wordDoc);
    return new Uint8Array(await blob.arrayBuffer());
  }
  return new Uint8Array(await Packer.toBuffer(wordDoc));
}
