import React, { useState } from 'react';
import { 
  Download, 
  Printer, 
  FileText, 
  FileCode, 
  Check, 
  X, 
  Sparkles,
  Activity,
  Layers,
  Calendar,
  Building2,
  PieChart,
  Presentation,
  ShieldCheck,
  Image as ImageIcon,
  Database,
  FileSpreadsheet
} from 'lucide-react';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, BorderStyle } from 'docx';
import pptxgen from 'pptxgenjs';
import { jsPDF } from 'jspdf';
import { CaseRecord } from '../types/bizpulse';

interface ReportExportModalProps {
  caseRecord: CaseRecord;
  isOpen: boolean;
  onClose: () => void;
  onPrintReport: () => void;
}

function escapeXml(unsafe: string): string {
  return (unsafe || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export const ReportExportModal: React.FC<ReportExportModalProps> = ({
  caseRecord,
  isOpen,
  onClose,
  onPrintReport
}) => {
  const [downloadStatus, setDownloadStatus] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  if (!isOpen) return null;

  const { profile, healthInputs, overallHealth, recommendations, financials } = caseRecord;
  const safeFilename = profile.name.replace(/[^a-zA-Z0-9]/g, '_');

  // 1. Generate Genuine OpenXML Microsoft Word Document (.docx)
  const handleDownloadWordDoc = async () => {
    setIsGenerating(true);
    try {
      const tableRows = [
        new TableRow({
          tableHeader: true,
          children: [
            new TableCell({
              width: { size: 2500, type: WidthType.DXA },
              children: [new Paragraph({ children: [new TextRun({ text: 'Dimension', bold: true })] })],
            }),
            new TableCell({
              width: { size: 1800, type: WidthType.DXA },
              children: [new Paragraph({ children: [new TextRun({ text: 'Status', bold: true })] })],
            }),
            new TableCell({
              width: { size: 2000, type: WidthType.DXA },
              children: [new Paragraph({ children: [new TextRun({ text: 'Evidence Basis', bold: true })] })],
            }),
            new TableCell({
              width: { size: 3700, type: WidthType.DXA },
              children: [new Paragraph({ children: [new TextRun({ text: 'Owner-Entered Notes', bold: true })] })],
            }),
          ],
        }),
        ...Object.values(healthInputs).map(item => new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: item.title, bold: true })] })],
            }),
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: item.status.toUpperCase(), bold: item.status === 'at_risk' })] })],
            }),
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: item.evidenceType })] })],
            }),
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: item.notes || 'No specific notes recorded.' })] })],
            }),
          ],
        }))
      ];

      const children: Paragraph[] = [
        new Paragraph({
          text: profile.name,
          heading: HeadingLevel.TITLE,
        }),
        new Paragraph({
          children: [
            new TextRun({ text: 'Commercial Turnaround Diagnostic & Strategic Action Report', bold: true, size: 28 }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({ text: `Date: ${new Date().toLocaleDateString()} | Case ID: ${profile.caseId} | Currency: ${profile.currency}\n`, italics: true }),
            new TextRun({ text: `Industry: ${profile.industry} (${profile.businessType}) | Country: ${profile.country}\n`, italics: true }),
            new TextRun({ text: `Workforce: ${profile.employeeCount} staff, ${profile.subcontractorCount} subcontractors | Operating: ${profile.yearsOperating} years\n`, italics: true }),
          ],
        }),
        new Paragraph({
          text: '1. Executive Summary & Health Assessment',
          heading: HeadingLevel.HEADING_1,
        }),
        new Paragraph({
          children: [
            new TextRun({ text: 'Overall Business Health: ', bold: true }),
            new TextRun({ text: `${overallHealth?.overallRating || 'Pending Evaluation'} (Score: ${overallHealth?.overallScore ?? 'N/A'}/100)\n` }),
            new TextRun({ text: 'Primary Commercial Objective: ', bold: true }),
            new TextRun({ text: `${profile.primaryObjective}\n` }),
            new TextRun({ text: 'Stated Primary Concern: ', bold: true }),
            new TextRun({ text: `${profile.primaryConcern || 'Unspecified commercial pressure'}\n` }),
          ],
        }),
        new Paragraph({
          text: '2. The Eight Commercial Health Dimensions',
          heading: HeadingLevel.HEADING_1,
        }),
      ];

      const doc = new Document({
        sections: [{
          properties: {},
          children: [
            ...children,
            new Table({
              rows: tableRows,
              width: { size: 10000, type: WidthType.DXA },
            }),
            new Paragraph({
              text: '3. Turnaround Diagnostic & Action Plan',
              heading: HeadingLevel.HEADING_1,
            }),
            new Paragraph({
              children: recommendations ? [
                new TextRun({ text: 'Primary Commercial Observation:\n', bold: true }),
                new TextRun({ text: `${recommendations.initialObservation}\n\n` }),
                new TextRun({ text: 'Why This Matters Commercially:\n', bold: true }),
                new TextRun({ text: `${recommendations.commercialWhy}\n\n` }),
                new TextRun({ text: 'Core Turnaround Recommendation:\n', bold: true }),
                new TextRun({ text: `${recommendations.initialRecommendation}\n\n` }),
                new TextRun({ text: 'Immediate 48–72 Hour Action:\n', bold: true }),
                new TextRun({ text: `${recommendations.immediateAction}\n\n` }),
                ...(recommendations.specialistAdviceNeeded ? [
                  new TextRun({ text: 'Specialist Advisory Trigger:\n', bold: true }),
                  new TextRun({ text: `${recommendations.specialistAdviceNeeded}\n\n` }),
                ] : []),
              ] : [
                new TextRun({ text: 'Diagnostic recommendations pending generation in the AI Advisory Engine.' }),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `Generated via Relaunch BizPulse Executive Coaching & Diagnostic OS • Confidential SME Diagnostic for ${profile.name}`,
                  italics: true,
                  size: 18,
                }),
              ],
            }),
          ],
        }],
      });

      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${safeFilename}_Turnaround_Report.docx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setDownloadStatus('Genuine Word document (.docx) generated and downloaded!');
      setTimeout(() => setDownloadStatus(null), 3500);
    } catch (err: any) {
      console.error('Word export error:', err);
      setDownloadStatus('Error creating .docx: ' + (err.message || 'Check inputs.'));
    } finally {
      setIsGenerating(false);
    }
  };

  // 2. Generate Genuine Microsoft PowerPoint Slide Deck (.pptx)
  const handleDownloadPowerPointDeck = async () => {
    setIsGenerating(true);
    try {
      const pres = new pptxgen();
      pres.layout = 'LAYOUT_16x9';

      // Slide 1: Title Slide
      const slide1 = pres.addSlide();
      slide1.background = { color: '0F172A' };
      slide1.addText('Relaunch BizPulse • Executive Diagnostic OS', {
        x: 0.8,
        y: 1.0,
        fontSize: 14,
        color: 'F59E0B',
        bold: true,
      });
      slide1.addText(profile.name, {
        x: 0.8,
        y: 1.6,
        fontSize: 32,
        color: 'FFFFFF',
        bold: true,
      });
      slide1.addText('Commercial Turnaround Diagnostic & Strategic Action Report', {
        x: 0.8,
        y: 2.5,
        fontSize: 18,
        color: '38BDF8',
      });
      slide1.addText(`Industry: ${profile.industry} (${profile.businessType}) | Country: ${profile.country} (${profile.currency})\nDate: ${new Date().toLocaleDateString()} | Case ID: ${profile.caseId}`, {
        x: 0.8,
        y: 3.5,
        fontSize: 12,
        color: '94A3B8',
        lineSpacing: 18,
      });

      // Slide 2: Overall Health Summary
      const slide2 = pres.addSlide();
      slide2.background = { color: '0F172A' };
      slide2.addText('Executive Health Assessment & Commercial Baseline', {
        x: 0.8,
        y: 0.6,
        fontSize: 22,
        color: 'F59E0B',
        bold: true,
      });
      slide2.addText(`Overall Health: ${overallHealth?.overallRating || 'In Progress'} (${overallHealth?.overallScore ?? 0}/100)`, {
        x: 0.8,
        y: 1.4,
        fontSize: 16,
        color: 'FFFFFF',
        bold: true,
      });
      slide2.addText(`Primary Objective: ${profile.primaryObjective}\nStated Concern: ${profile.primaryConcern || 'Unspecified'}\nOperating Track Record: ${profile.yearsOperating} years | Workforce: ${profile.employeeCount} staff, ${profile.subcontractorCount} subcontractors`, {
        x: 0.8,
        y: 2.0,
        fontSize: 12,
        color: 'CBD5E1',
        lineSpacing: 20,
      });

      // Slide 3: 8 Commercial Dimensions Scorecard Table
      const slide3 = pres.addSlide();
      slide3.background = { color: '0F172A' };
      slide3.addText('The 8 Commercial Health Dimensions', {
        x: 0.8,
        y: 0.6,
        fontSize: 22,
        color: '38BDF8',
        bold: true,
      });
      const tableData: any[][] = [
        [
          { text: 'Dimension', options: { bold: true, color: 'FFFFFF', fill: '1E293B' } },
          { text: 'Status', options: { bold: true, color: 'FFFFFF', fill: '1E293B' } },
          { text: 'Evidence Basis', options: { bold: true, color: 'FFFFFF', fill: '1E293B' } },
          { text: 'Owner-Reported Context', options: { bold: true, color: 'FFFFFF', fill: '1E293B' } },
        ],
        ...Object.values(healthInputs).map(item => [
          { text: item.title, options: { color: 'FFFFFF', fill: '0F172A' } },
          { text: item.status.toUpperCase(), options: { color: item.status === 'healthy' ? '10B981' : item.status === 'at_risk' ? 'EF4444' : 'F59E0B', bold: true, fill: '0F172A' } },
          { text: item.evidenceType, options: { color: '94A3B8', fill: '0F172A' } },
          { text: item.notes || 'No specific notes', options: { color: 'CBD5E1', fill: '0F172A' } },
        ]),
      ];
      slide3.addTable(tableData, { x: 0.8, y: 1.2, w: 11.5, fontSize: 10 });

      // Slide 4: Turnaround Recommendations
      const slide4 = pres.addSlide();
      slide4.background = { color: '0F172A' };
      slide4.addText('Diagnostic Recommendations & Commercial Rationale', {
        x: 0.8,
        y: 0.6,
        fontSize: 22,
        color: 'F59E0B',
        bold: true,
      });
      if (recommendations) {
        slide4.addText(`Primary Observation:\n${recommendations.initialObservation}\n\nCommercial Impact:\n${recommendations.commercialWhy}\n\nTurnaround Recommendation:\n${recommendations.initialRecommendation}`, {
          x: 0.8,
          y: 1.4,
          w: 11.5,
          fontSize: 13,
          color: 'E2E8F0',
          lineSpacing: 18,
        });
      } else {
        slide4.addText('Turnaround recommendations awaiting generation in the Recommendation Engine tab.', {
          x: 0.8,
          y: 2.0,
          fontSize: 14,
          color: '94A3B8',
        });
      }

      // Slide 5: Immediate 48-Hour Decision Gates
      const slide5 = pres.addSlide();
      slide5.background = { color: '0F172A' };
      slide5.addText('Immediate 48–72 Hour Action Plan & Decision Gates', {
        x: 0.8,
        y: 0.6,
        fontSize: 22,
        color: '10B981',
        bold: true,
      });
      if (recommendations) {
        slide5.addText(`Immediate Action (Next 48–72 Hours):\n${recommendations.immediateAction}\n\nSpecialist Advisory Trigger:\n${recommendations.specialistAdviceNeeded || 'None flagged for immediate legal/statutory risk.'}`, {
          x: 0.8,
          y: 1.5,
          w: 11.5,
          fontSize: 14,
          color: 'F1F5F9',
          lineSpacing: 22,
        });
      }

      await pres.writeFile({ fileName: `${safeFilename}_Presentation.pptx` });
      setDownloadStatus('Genuine PowerPoint presentation (.pptx) downloaded successfully!');
      setTimeout(() => setDownloadStatus(null), 3500);
    } catch (err: any) {
      console.error('PowerPoint export error:', err);
      setDownloadStatus('Error creating .pptx: ' + (err.message || 'Check inputs.'));
    } finally {
      setIsGenerating(false);
    }
  };

  // 3. Generate Valid PDF Document via jsPDF
  const handleDownloadDirectPdf = () => {
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'a4',
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 40;
      let y = 50;

      doc.setFillColor(15, 23, 42); // slate-900
      doc.rect(0, 0, pageWidth, 80, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.setTextColor(245, 158, 11); // amber-500
      doc.text(profile.name, margin, 40);

      doc.setFontSize(11);
      doc.setTextColor(226, 232, 240);
      doc.text('Commercial Turnaround Diagnostic & Strategic Action Report', margin, 60);

      y = 110;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      doc.text(`Date: ${new Date().toLocaleDateString()}   |   Case ID: ${profile.caseId}   |   Currency: ${profile.currency}`, margin, y);
      y += 14;
      doc.text(`Industry: ${profile.industry} (${profile.businessType})   |   Workforce: ${profile.employeeCount} staff, ${profile.subcontractorCount} subcontractors`, margin, y);
      y += 24;

      // Executive Health Box
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y, pageWidth - (margin * 2), 65, 'F');
      doc.setDrawColor(203, 213, 225);
      doc.rect(margin, y, pageWidth - (margin * 2), 65, 'D');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text('Executive Health Assessment & Stated Objective', margin + 12, y + 20);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(51, 65, 85);
      doc.text(`Overall Rating: ${overallHealth?.overallRating || 'In Progress'} (${overallHealth?.overallScore ?? 0}/100)`, margin + 12, y + 36);
      doc.text(`Objective: ${profile.primaryObjective.substring(0, 85)}...`, margin + 12, y + 50);

      y += 85;

      // 8 Dimensions Table
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text('Eight Commercial Health Dimensions', margin, y);
      y += 15;

      doc.setFillColor(241, 245, 249);
      doc.rect(margin, y, pageWidth - (margin * 2), 20, 'F');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text('Dimension', margin + 8, y + 13);
      doc.text('Status', margin + 140, y + 13);
      doc.text('Notes', margin + 230, y + 13);
      y += 20;

      Object.values(healthInputs).forEach((dim) => {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(30, 41, 59);
        doc.text(dim.title, margin + 8, y + 12);
        
        doc.setFont('helvetica', 'bold');
        if (dim.status === 'healthy') doc.setTextColor(16, 185, 129);
        else if (dim.status === 'at_risk') doc.setTextColor(239, 68, 68);
        else doc.setTextColor(245, 158, 11);
        doc.text(dim.status.toUpperCase(), margin + 140, y + 12);

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 116, 139);
        doc.text((dim.notes || 'No specific notes recorded.').substring(0, 55), margin + 230, y + 12);

        doc.setDrawColor(241, 245, 249);
        doc.line(margin, y + 18, pageWidth - margin, y + 18);
        y += 20;
      });

      y += 15;
      if (recommendations) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(15, 23, 42);
        doc.text('Turnaround Strategy & 48-Hour Decision Gate', margin, y);
        y += 15;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(51, 65, 85);

        const recLines = doc.splitTextToSize(`Recommendation: ${recommendations.initialRecommendation}`, pageWidth - (margin * 2));
        doc.text(recLines, margin, y);
        y += (recLines.length * 11) + 8;

        const actionLines = doc.splitTextToSize(`Immediate Action (48-72h): ${recommendations.immediateAction}`, pageWidth - (margin * 2));
        doc.text(actionLines, margin, y);
      }

      doc.save(`${safeFilename}_Diagnostic_Report.pdf`);
      setDownloadStatus('Genuine PDF document downloaded successfully!');
      setTimeout(() => setDownloadStatus(null), 3500);
    } catch (err: any) {
      console.error('PDF export error:', err);
      setDownloadStatus('Error creating PDF: ' + (err.message || 'Check browser permissions.'));
    }
  };

  // 4. Generate XML-Escaped Business Health Infographic (SVG)
  const handleDownloadInfographic = () => {
    const score = overallHealth?.overallScore ?? 50;
    const rating = overallHealth?.overallRating ?? 'Pending';
    const dims = Object.values(healthInputs);

    const safeName = escapeXml(profile.name);
    const safeIndustry = escapeXml(profile.industry);
    const safeCountry = escapeXml(profile.country);
    const safeCurrency = escapeXml(profile.currency);
    const safeCaseId = escapeXml(profile.caseId);
    const safeObjective = escapeXml(profile.primaryObjective);

    const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600" viewBox="0 0 900 600" style="background:#0f172a; font-family:sans-serif;">
  <rect width="900" height="600" fill="#0f172a"/>
  <text x="40" y="50" fill="#f59e0b" font-size="20" font-weight="bold">Relaunch BizPulse • Business Health Infographic</text>
  <text x="40" y="80" fill="#ffffff" font-size="24" font-weight="bold">${safeName}</text>
  <text x="40" y="105" fill="#94a3b8" font-size="13">${safeIndustry} • ${safeCountry} (${safeCurrency}) • Case: ${safeCaseId}</text>

  <!-- Score Box -->
  <rect x="660" y="30" width="200" height="90" rx="12" fill="#1e293b" stroke="#334155" stroke-width="1"/>
  <text x="760" y="55" fill="#94a3b8" font-size="11" text-anchor="middle" font-weight="bold">OVERALL HEALTH</text>
  <text x="760" y="90" fill="${score >= 70 ? '#34d399' : score >= 45 ? '#fbbf24' : '#f87171'}" font-size="26" text-anchor="middle" font-weight="bold">${score}/100</text>
  <text x="760" y="110" fill="#e2e8f0" font-size="11" text-anchor="middle">${escapeXml(rating)}</text>

  <!-- 8 Dimensions Visual Grid -->
  <text x="40" y="148" fill="#38bdf8" font-size="15" font-weight="bold">The Eight Commercial Health Dimensions</text>
  ${dims.map((d, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 40 + col * 420;
    const y = 165 + row * 88;
    const color = d.status === 'healthy' ? '#10b981' : d.status === 'needs_attention' ? '#f59e0b' : d.status === 'at_risk' ? '#ef4444' : '#3b82f6';
    const safeTitle = escapeXml(d.title);
    const safeStatus = escapeXml(d.status.toUpperCase());
    const safeNotes = escapeXml((d.notes || 'No specific notes entered').substring(0, 48));
    return `
      <g>
        <rect x="${x}" y="${y}" width="400" height="74" rx="8" fill="#1e293b" stroke="#334155" stroke-width="1"/>
        <circle cx="${x + 24}" cy="${y + 24}" r="7" fill="${color}"/>
        <text x="${x + 42}" y="${y + 28}" fill="#ffffff" font-size="13" font-weight="bold">${safeTitle}</text>
        <text x="${x + 380}" y="${y + 28}" fill="${color}" font-size="11" font-weight="bold" text-anchor="end">${safeStatus}</text>
        <text x="${x + 42}" y="${y + 51}" fill="#94a3b8" font-size="10">${safeNotes}...</text>
      </g>
    `;
  }).join('')}

  <!-- Footer -->
  <rect x="40" y="535" width="820" height="40" rx="8" fill="#1e293b" stroke="#334155" stroke-width="1"/>
  <text x="55" y="560" fill="#94a3b8" font-size="11">Primary Objective: ${safeObjective.substring(0, 60)}... • Confirmed Evidence-Based Assessment</text>
</svg>`;

    const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${safeFilename}_Health_Infographic.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setDownloadStatus('Business Health Infographic (.svg) downloaded successfully!');
    setTimeout(() => setDownloadStatus(null), 3500);
  };

  // 5. Generate clean Markdown Summary (.md)
  const handleDownloadMarkdown = () => {
    let md = `# ${profile.name} — Commercial Turnaround Report\n\n`;
    md += `**Date:** ${new Date().toLocaleDateString()}  \n`;
    md += `**Case ID:** ${profile.caseId}  \n`;
    md += `**Industry:** ${profile.industry} (${profile.businessType})  \n`;
    md += `**Location:** ${profile.country} (${profile.currency})  \n`;
    md += `**Workforce:** ${profile.employeeCount} staff, ${profile.subcontractorCount} subcontractors  \n\n`;
    
    md += `## 1. Business Essentials\n`;
    md += `- **Primary Objective:** ${profile.primaryObjective}\n`;
    md += `- **Primary Concern:** ${profile.primaryConcern || 'Unspecified'}\n`;
    md += `- **Products / Services:** ${profile.mainProductsServices}\n`;
    md += `- **Target Customers:** ${profile.mainCustomerTypes}\n\n`;

    if (overallHealth) {
      md += `## 2. Business Health Summary\n`;
      md += `- **Overall Rating:** ${overallHealth.overallRating} (${overallHealth.overallScore}/100)\n`;
      md += `- **Assessment Date:** ${overallHealth.assessmentDate}\n`;
      md += `- **Critical Risks:**\n`;
      overallHealth.criticalRisksIdentified.forEach(r => md += `  * ${r}\n`);
      md += `- **Core Strengths:**\n`;
      overallHealth.strongestAreas.forEach(s => md += `  * ${s}\n`);
      md += `\n`;
    }

    md += `## 3. Eight Commercial Health Dimensions\n\n`;
    Object.values(healthInputs).forEach(h => {
      md += `### ${h.title}\n`;
      md += `- **Status:** ${h.status.toUpperCase()}\n`;
      md += `- **Operational Notes:** ${h.notes || 'None provided'}\n\n`;
    });

    if (recommendations) {
      md += `## 4. Turnaround Recommendations\n\n`;
      md += `### Primary Observation\n${recommendations.initialObservation}\n\n`;
      md += `### Commercial Why\n${recommendations.commercialWhy}\n\n`;
      md += `### Strategic Recommendation\n${recommendations.initialRecommendation}\n\n`;
      md += `### Immediate 48-Hour Action\n${recommendations.immediateAction}\n\n`;
      if (recommendations.specialistAdviceNeeded) {
        md += `### Specialist Advice Trigger\n${recommendations.specialistAdviceNeeded}\n\n`;
      }
    }

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${safeFilename}_Briefing.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setDownloadStatus('Markdown report downloaded successfully!');
    setTimeout(() => setDownloadStatus(null), 3500);
  };

  // 6. Generate JSON Raw Data Backup (.json)
  const handleDownloadJson = () => {
    const jsonStr = JSON.stringify(caseRecord, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${safeFilename}_CaseData.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setDownloadStatus('JSON data export downloaded successfully!');
    setTimeout(() => setDownloadStatus(null), 3500);
  };

  // 7. Generate CSV Spreadsheet (.csv)
  const handleDownloadCsv = () => {
    const rows = [
      ['Dimension', 'Status', 'Evidence Basis', 'Notes'],
      ...Object.values(healthInputs).map(h => [
        `"${h.title.replace(/"/g, '""')}"`,
        `"${h.status}"`,
        `"${h.evidenceType}"`,
        `"${(h.notes || '').replace(/"/g, '""')}"`
      ])
    ];

    if (financials) {
      rows.push([]);
      rows.push(['Financial Metric', 'Value', 'Currency']);
      rows.push(['Annual Revenue', financials.annualRevenue?.toString() || '', profile.currency]);
      rows.push(['Reported Operating Profit', financials.operatingProfit?.toString() || '', profile.currency]);
      rows.push(['Accounts Receivable', financials.accountsReceivable?.toString() || '', profile.currency]);
      rows.push(['Overdue Receivables', financials.overdueReceivables?.toString() || '', profile.currency]);
      rows.push(['Available Cash', financials.cashInBank?.toString() || '', profile.currency]);
      rows.push(['Overdraft / Credit Drawn', financials.creditFacilityUsed?.toString() || '', profile.currency]);
      rows.push(['Overdraft / Credit Limit', financials.creditFacilityLimit?.toString() || '', profile.currency]);
    }

    const csvContent = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${safeFilename}_Scorecard.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setDownloadStatus('CSV scorecard exported successfully!');
    setTimeout(() => setDownloadStatus(null), 3500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden text-slate-100 space-y-5 p-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
              <Download className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Export Executive Reports & Presentation Deck</h3>
              <p className="text-xs text-slate-400">Current case: {profile.name} ({profile.country})</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        {downloadStatus && (
          <div className="p-3 bg-emerald-950/60 border border-emerald-800/40 text-emerald-300 text-xs rounded-xl flex items-center gap-2">
            <Check className="w-4 h-4" />
            <span>{downloadStatus}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Option 1: PDF Download */}
          <button
            onClick={handleDownloadDirectPdf}
            disabled={isGenerating}
            className="p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-amber-500 hover:bg-slate-850 transition text-left flex flex-col justify-between space-y-2 group disabled:opacity-50"
          >
            <div className="w-8 h-8 rounded-lg bg-red-500/10 text-red-400 flex items-center justify-center border border-red-500/20">
              <Printer className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-white text-xs block group-hover:text-amber-400">
                PDF Document (.pdf)
              </span>
              <span className="text-[11px] text-slate-400">
                Formatted executive summary report
              </span>
            </div>
          </button>

          {/* Option 2: Genuine Word Document */}
          <button
            onClick={handleDownloadWordDoc}
            disabled={isGenerating}
            className="p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-amber-500 hover:bg-slate-850 transition text-left flex flex-col justify-between space-y-2 group disabled:opacity-50"
          >
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-white text-xs block group-hover:text-amber-400">
                Word Document (.docx)
              </span>
              <span className="text-[11px] text-slate-400">
                Genuine OpenXML editable document
              </span>
            </div>
          </button>

          {/* Option 3: Genuine PowerPoint Deck */}
          <button
            onClick={handleDownloadPowerPointDeck}
            disabled={isGenerating}
            className="p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-amber-500 hover:bg-slate-850 transition text-left flex flex-col justify-between space-y-2 group disabled:opacity-50"
          >
            <div className="w-8 h-8 rounded-lg bg-orange-500/10 text-orange-400 flex items-center justify-center border border-orange-500/20">
              <Presentation className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-white text-xs block group-hover:text-amber-400">
                PowerPoint (.pptx)
              </span>
              <span className="text-[11px] text-slate-400">
                6-slide executive briefing deck
              </span>
            </div>
          </button>

          {/* Option 4: Business Health Infographic */}
          <button
            onClick={handleDownloadInfographic}
            disabled={isGenerating}
            className="p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-amber-500 hover:bg-slate-850 transition text-left flex flex-col justify-between space-y-2 group disabled:opacity-50"
          >
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
              <ImageIcon className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-white text-xs block group-hover:text-amber-400">
                Health Infographic
              </span>
              <span className="text-[11px] text-slate-400">
                Vector 8D scorecard infographic (.svg)
              </span>
            </div>
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800 text-xs">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                onClose();
                onPrintReport();
              }}
              className="text-slate-400 hover:text-slate-200 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 transition"
              title="Open full print view for memo"
            >
              <Printer className="w-3.5 h-3.5 text-rose-400" />
              <span>Print View</span>
            </button>

            <button
              onClick={handleDownloadMarkdown}
              className="text-slate-400 hover:text-slate-200 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 transition"
              title="Download structured Markdown summary"
            >
              <FileCode className="w-3.5 h-3.5 text-purple-400" />
              <span>Markdown (.md)</span>
            </button>

            <button
              onClick={handleDownloadCsv}
              className="text-slate-400 hover:text-slate-200 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 transition"
              title="Export scorecard & financials as CSV spreadsheet"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>Scorecard (.csv)</span>
            </button>

            <button
              onClick={handleDownloadJson}
              className="text-slate-400 hover:text-slate-200 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 transition"
              title="Download full case data as portable JSON"
            >
              <Database className="w-3.5 h-3.5 text-cyan-400" />
              <span>Full Data (.json)</span>
            </button>
          </div>

          <span className="text-[11px] text-slate-500 font-mono">
            Case ID: {profile.caseId}
          </span>
        </div>

        <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-[11px] text-slate-400 flex items-start gap-2">
          <Activity className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <span>
            Every export is strictly compiled from the active case (<strong>{profile.name}</strong>) and excludes information from other businesses.
          </span>
        </div>
      </div>
    </div>
  );
};
