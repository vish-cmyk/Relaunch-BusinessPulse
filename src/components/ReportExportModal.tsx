import React, { useState } from 'react';
import {
  Download,
  Printer,
  FileText,
  FileCode,
  Check,
  X,
  Activity,
  Presentation,
  Image as ImageIcon,
  Database,
  FileSpreadsheet,
} from 'lucide-react';
import pptxgen from 'pptxgenjs';
import { CaseRecord } from '../types/bizpulse';
import {
  generateDocxReportUint8Array,
  generatePdfReportBytes,
  renderHealthChartCanvasPng,
} from '../services/reportGenerator';

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
  onPrintReport,
}) => {
  const [downloadStatus, setDownloadStatus] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  if (!isOpen) return null;

  const { profile, healthInputs, overallHealth, recommendations, financials, uploadedDocuments } =
    caseRecord;
  const safeFilename = (profile.name || 'Business').replace(/[^a-zA-Z0-9]/g, '_');

  const notifySuccess = (msg: string) => {
    setDownloadError(null);
    setDownloadStatus(msg);
    setTimeout(() => setDownloadStatus(null), 4000);
  };

  // 1. Genuine Microsoft Word Document (.docx) with embedded chart, wrapped tables & document evidence
  const handleDownloadWordDoc = async () => {
    setIsGenerating(true);
    setDownloadError(null);
    try {
      const chartPng = await renderHealthChartCanvasPng(caseRecord);
      const docxBytes = await generateDocxReportUint8Array(caseRecord, chartPng || undefined);
      const blob = new Blob([new Uint8Array(docxBytes)], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${safeFilename}_Diagnostic_Report.docx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      notifySuccess('Word report (.docx) with embedded health chart downloaded successfully.');
    } catch (err: any) {
      console.error('Word export error:', err);
      setDownloadError('Error creating Word report: ' + (err.message || 'Check inputs.'));
    } finally {
      setIsGenerating(false);
    }
  };

  // 2. Clean Paginated PDF Report via reportGenerator.ts (zero text overlap or clipped tables)
  const handleDownloadDirectPdf = () => {
    setIsGenerating(true);
    setDownloadError(null);
    try {
      const pdfBytes = generatePdfReportBytes(caseRecord);
      const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${safeFilename}_Diagnostic_Report.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      notifySuccess('Paginated PDF diagnostic report with charts downloaded successfully.');
    } catch (err: any) {
      console.error('PDF export error:', err);
      setDownloadError('Error creating PDF report: ' + (err.message || 'Check inputs.'));
    } finally {
      setIsGenerating(false);
    }
  };

  // 3. PowerPoint Slide Deck (.pptx) styled in Black-to-Blue Executive palette
  const handleDownloadPowerPointDeck = async () => {
    setIsGenerating(true);
    setDownloadError(null);
    try {
      const pres = new pptxgen();
      pres.layout = 'LAYOUT_16x9';

      // Slide 1: Title Slide
      const slide1 = pres.addSlide();
      slide1.background = { color: '071936' };
      slide1.addText('Relaunch BizPulse • Executive Coaching & Diagnostic OS', {
        x: 0.8,
        y: 1.0,
        fontSize: 13,
        color: '6495ED',
        bold: true,
      });
      slide1.addText(profile.name || 'Business Diagnostic', {
        x: 0.8,
        y: 1.6,
        fontSize: 32,
        color: 'FFFFFF',
        bold: true,
      });
      slide1.addText('Executive Health Diagnostic & Commercial Action Briefing', {
        x: 0.8,
        y: 2.5,
        fontSize: 18,
        color: 'CBD5E1',
      });
      slide1.addText(
        `Industry: ${profile.industry} (${profile.businessType}) | Country: ${profile.country} (${profile.currency})\nDate: ${new Date().toLocaleDateString()} | Case ID: ${profile.caseId}`,
        {
          x: 0.8,
          y: 3.5,
          fontSize: 12,
          color: '94A3B8',
          lineSpacing: 18,
        }
      );

      // Slide 2: Overall Health Summary
      const slide2 = pres.addSlide();
      slide2.background = { color: '0A2E6E' };
      slide2.addText('Executive Health Summary & Commercial Baseline', {
        x: 0.8,
        y: 0.6,
        fontSize: 22,
        color: '6495ED',
        bold: true,
      });
      const scoreDisplay =
        overallHealth?.overallScore !== null && overallHealth?.overallScore !== undefined
          ? `${overallHealth.overallScore}/100`
          : 'Unrated';
      slide2.addText(
        `Overall Health: ${overallHealth?.overallRating || 'Pending'} (${scoreDisplay})`,
        {
          x: 0.8,
          y: 1.4,
          fontSize: 16,
          color: 'FFFFFF',
          bold: true,
        }
      );
      slide2.addText(
        `Summary: ${overallHealth?.overallExplanation || 'Complete all 12 capabilities for diagnostic synthesis.'}\n\nPrimary Objective: ${profile.primaryObjective}\nStated Concern: ${profile.primaryConcern || 'Unspecified'}\nWorkforce: ${profile.employeeCount} staff, ${profile.subcontractorCount} subcontractors${profile.turnoverRange ? `\nTurnover Range: ${profile.turnoverRange}` : ''}`,
        {
          x: 0.8,
          y: 2.0,
          w: 11.5,
          fontSize: 12,
          color: 'CBD5E1',
          lineSpacing: 20,
        }
      );

      // Slide 3: 12 Capabilities Scorecard Table
      const slide3 = pres.addSlide();
      slide3.background = { color: '0A2E6E' };
      slide3.addText('Twelve Business Health Capabilities', {
        x: 0.8,
        y: 0.6,
        fontSize: 22,
        color: '6495ED',
        bold: true,
      });
      const tableData: any[][] = [
        [
          { text: 'Dimension', options: { bold: true, color: 'FFFFFF', fill: '0F52BA' } },
          { text: 'Status', options: { bold: true, color: 'FFFFFF', fill: '0F52BA' } },
          { text: 'Score', options: { bold: true, color: 'FFFFFF', fill: '0F52BA' } },
          { text: 'Owner Notes', options: { bold: true, color: 'FFFFFF', fill: '0F52BA' } },
        ],
        ...Object.values(healthInputs).map((item) => {
          const detail = overallHealth?.dimensionScores?.find((d) => d.key === item.key);
          const color =
            item.status === 'healthy'
              ? '34D399'
              : item.status === 'at_risk'
              ? 'F87171'
              : item.status === 'needs_attention'
              ? 'FBBF24'
              : '6495ED';
          return [
            { text: item.title, options: { color: 'FFFFFF', fill: '071936' } },
            { text: item.status.replace('_', ' ').toUpperCase(), options: { color, bold: true, fill: '071936' } },
            { text: detail && detail.score !== null ? `${detail.score}/100` : '—', options: { color: 'CBD5E1', fill: '071936' } },
            { text: item.notes || 'No notes supplied', options: { color: 'CBD5E1', fill: '071936' } },
          ];
        }),
      ];
      slide3.addTable(tableData, { x: 0.8, y: 1.2, w: 11.5, fontSize: 10 });

      // Slide 4: Coaching Recommendations & Sustainability
      const slide4 = pres.addSlide();
      slide4.background = { color: '0A2E6E' };
      slide4.addText('Diagnostic Coaching & Strategic Choice', {
        x: 0.8,
        y: 0.6,
        fontSize: 22,
        color: '6495ED',
        bold: true,
      });
      if (recommendations) {
        const sustLine = recommendations.sustainabilityAssessment
          ? `\n\nSustainability Choice: ${recommendations.sustainabilityAssessment.recommendedChoice} — ${recommendations.sustainabilityAssessment.choiceRationale}`
          : '';
        slide4.addText(
          `Primary Observation:\n${recommendations.initialObservation}\n\nCommercial Why:\n${recommendations.commercialWhy}\n\nCore Recommendation:\n${recommendations.initialRecommendation}\n\nImmediate 48–72h Action:\n${recommendations.immediateAction}${sustLine}`,
          {
            x: 0.8,
            y: 1.3,
            w: 11.5,
            fontSize: 11.5,
            color: 'E2E8F0',
            lineSpacing: 16,
          }
        );
      } else {
        slide4.addText('Coaching recommendations not yet generated for this session.', {
          x: 0.8,
          y: 2.0,
          fontSize: 14,
          color: '94A3B8',
        });
      }

      // Slide 5: CRM & ROI Highlights (when populated)
      if ((caseRecord.crmContacts?.length || 0) > 0 || (caseRecord.roiScenarios?.length || 0) > 0) {
        const slide5 = pres.addSlide();
        slide5.background = { color: '0A2E6E' };
        slide5.addText('CRM Pipeline & ROI Investment Scenarios', {
          x: 0.8,
          y: 0.6,
          fontSize: 22,
          color: '6495ED',
          bold: true,
        });
        const crmLines = (caseRecord.crmContacts || [])
          .slice(0, 5)
          .map(
            (c) =>
              `• ${c.companyOrName} (${c.recordType} · ${c.salesStage}) — ${profile.currency} ${Number(c.monthlyValue || 0).toLocaleString()}/mo | Opp ${profile.currency} ${Number(c.opportunityValue || 0).toLocaleString()}`
          )
          .join('\n');
        const roiLines = (caseRecord.roiScenarios || [])
          .slice(0, 4)
          .map((s) => {
            const netGain =
              ((s.expectedMonthlyRevenue * s.grossMarginPct) / 100 - s.monthlyOperatingCost) *
                s.monthsHorizon -
              s.upfrontInvestment;
            return `• ${s.name}: Upfront ${profile.currency} ${s.upfrontInvestment.toLocaleString()} -> ${s.monthsHorizon}m Net ${profile.currency} ${Math.round(netGain).toLocaleString()}`;
          })
          .join('\n');
        slide5.addText(
          `${crmLines ? `Top CRM Pipeline:\n${crmLines}\n\n` : ''}${roiLines ? `ROI Scenarios:\n${roiLines}` : ''}`,
          {
            x: 0.8,
            y: 1.3,
            w: 11.5,
            fontSize: 11.5,
            color: 'E2E8F0',
            lineSpacing: 17,
          }
        );
      }

      await pres.writeFile({ fileName: `${safeFilename}_Presentation.pptx` });
      notifySuccess('PowerPoint deck (.pptx) downloaded successfully.');
    } catch (err: any) {
      console.error('PowerPoint export error:', err);
      setDownloadError('Error creating PowerPoint deck: ' + (err.message || 'Check inputs.'));
    } finally {
      setIsGenerating(false);
    }
  };

  // 4. Business Health Infographic (SVG) with strict semantic colors
  const handleDownloadInfographic = () => {
    const scoreText =
      overallHealth?.overallScore !== null && overallHealth?.overallScore !== undefined
        ? `${overallHealth.overallScore}/100`
        : 'Pending';
    const scoreNum = overallHealth?.overallScore ?? 0;
    const rating = overallHealth?.overallRating ?? 'Pending';
    const dims = Object.values(healthInputs);

    const safeName = escapeXml(profile.name || 'Business');
    const safeIndustry = escapeXml(profile.industry);
    const safeCountry = escapeXml(profile.country);
    const safeCurrency = escapeXml(profile.currency);
    const safeCaseId = escapeXml(profile.caseId);
    const safeObjective = escapeXml(profile.primaryObjective || 'Commercial sustainability');

    const scoreColor =
      overallHealth?.overallScore === null || overallHealth?.overallScore === undefined
        ? '#94A3B8'
        : scoreNum >= 72
        ? '#34D399'
        : scoreNum >= 45
        ? '#FBBF24'
        : '#F87171';

    const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="900" height="790" viewBox="0 0 900 790" style="background:#071936; font-family:sans-serif;">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#071936"/>
      <stop offset="100%" stop-color="#0A2E6E"/>
    </linearGradient>
  </defs>
  <rect width="900" height="790" fill="url(#bg)"/>
  <text x="40" y="48" fill="#6495ED" font-size="16" font-weight="bold">Relaunch BizPulse • Executive Health Infographic</text>
  <text x="40" y="80" fill="#FFFFFF" font-size="24" font-weight="bold">${safeName}</text>
  <text x="40" y="106" fill="#CBD5E1" font-size="13">${safeIndustry} • ${safeCountry} (${safeCurrency}) • Case: ${safeCaseId}</text>

  <rect x="650" y="28" width="210" height="92" rx="12" fill="#0A2E6E" stroke="#0F52BA" stroke-width="1.5"/>
  <text x="755" y="54" fill="#B7CEF7" font-size="11" text-anchor="middle" font-weight="bold">OVERALL HEALTH</text>
  <text x="755" y="90" fill="${scoreColor}" font-size="26" text-anchor="middle" font-weight="bold">${escapeXml(scoreText)}</text>
  <text x="755" y="110" fill="#E2E8F0" font-size="11" text-anchor="middle">${escapeXml(rating)}</text>

  <text x="40" y="152" fill="#B7CEF7" font-size="15" font-weight="bold">The Twelve Business Health Capabilities</text>
  ${dims
    .map((d, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = 40 + col * 420;
      const y = 170 + row * 90;
      const color =
        d.status === 'healthy'
          ? '#10B981'
          : d.status === 'needs_attention'
          ? '#F59E0B'
          : d.status === 'at_risk'
          ? '#EF4444'
          : '#6495ED';
      const safeTitle = escapeXml(d.title);
      const safeStatus = escapeXml(d.status.replace('_', ' ').toUpperCase());
      const safeNotes = escapeXml((d.notes || 'No specific notes entered').substring(0, 52));
      return `
      <g>
        <rect x="${x}" y="${y}" width="400" height="76" rx="8" fill="#0B224D" stroke="#0F52BA" stroke-width="1"/>
        <circle cx="${x + 22}" cy="${y + 24}" r="7" fill="${color}"/>
        <text x="${x + 38}" y="${y + 28}" fill="#FFFFFF" font-size="13" font-weight="bold">${safeTitle}</text>
        <text x="${x + 382}" y="${y + 28}" fill="${color}" font-size="11" font-weight="bold" text-anchor="end">${safeStatus}</text>
        <text x="${x + 38}" y="${y + 52}" fill="#CBD5E1" font-size="10">${safeNotes}</text>
      </g>`;
    })
    .join('')}

  <rect x="40" y="720" width="820" height="44" rx="8" fill="#0B224D" stroke="#0F52BA" stroke-width="1"/>
  <text x="56" y="747" fill="#CBD5E1" font-size="11">Objective: ${safeObjective.substring(0, 75)}</text>
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
    notifySuccess('Health Infographic (.svg) downloaded.');
  };

  // 5. Markdown Briefing (.md)
  const handleDownloadMarkdown = () => {
    let md = `# ${profile.name} — Executive Coaching & Diagnostic Report\n\n`;
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
      md += `- **Overall Rating:** ${overallHealth.overallRating} (${overallHealth.overallScore ?? 'N/A'}/100)\n`;
      md += `- **Explanation:** ${overallHealth.overallExplanation}\n`;
      md += `- **Assessment Date:** ${overallHealth.assessmentDate}\n\n`;
    }

    md += `## 3. Twelve Business Health Capabilities\n\n`;
    Object.values(healthInputs).forEach((h) => {
      md += `### ${h.title}\n`;
      md += `- **Status:** ${h.status.replace('_', ' ').toUpperCase()}\n`;
      md += `- **Notes:** ${h.notes || 'None provided'}\n\n`;
    });

    if (recommendations) {
      md += `## 4. Coaching Recommendations & Actions\n\n`;
      md += `### Primary Observation\n${recommendations.initialObservation}\n\n`;
      md += `### Commercial Why\n${recommendations.commercialWhy}\n\n`;
      md += `### Strategic Recommendation\n${recommendations.initialRecommendation}\n\n`;
      md += `### Immediate 48–72 Hour Action\n${recommendations.immediateAction}\n\n`;
      if (recommendations.profitOpportunities?.length) {
        md += `### Profit & Revenue Opportunities\n`;
        recommendations.profitOpportunities.forEach((opp) => {
          md += `- **${opp.title}** (${opp.area} · ${opp.horizon}): ${opp.estimatedFinancialImpact} — ${opp.whatToDoFirst || opp.evidenceBasis}\n`;
        });
        md += `\n`;
      }
      if (recommendations.sustainabilityAssessment) {
        const sust = recommendations.sustainabilityAssessment;
        md += `### Business Sustainability & Strategic Choice: ${sust.recommendedChoice}\n`;
        md += `- **Current Position:** ${sust.currentPositionSummary}\n`;
        md += `- **6–12 Month Outlook:** ${sust.futureOutlook6to12Months}\n`;
        md += `- **Rationale:** ${sust.choiceRationale}\n\n`;
      }
      if (recommendations.actionItems?.length) {
        md += `### Prioritized Action Checklist\n`;
        recommendations.actionItems.forEach((a) => {
          md += `- [${a.completed ? 'x' : ' '}] **${a.priority}** (${a.ownerRole}, ${a.timeframe}): ${a.action}\n`;
        });
        md += `\n`;
      }
    }

    if ((caseRecord.crmContacts?.length || 0) > 0) {
      md += `## CRM Pipeline (${caseRecord.crmContacts?.length})\n\n`;
      caseRecord.crmContacts?.forEach((c) => {
        md += `- **${c.companyOrName}** (${c.recordType} · ${c.tier}) — Stage: ${c.salesStage} · Monthly: ${profile.currency} ${c.monthlyValue} · Opp: ${profile.currency} ${c.opportunityValue}\n`;
      });
      md += `\n`;
    }

    if ((caseRecord.roiScenarios?.length || 0) > 0) {
      md += `## ROI Scenarios (${caseRecord.roiScenarios?.length})\n\n`;
      caseRecord.roiScenarios?.forEach((s) => {
        md += `- **${s.name}** (${s.category}) — Upfront: ${profile.currency} ${s.upfrontInvestment}, Monthly Rev: ${profile.currency} ${s.expectedMonthlyRevenue} @ ${s.grossMarginPct}% GM\n`;
      });
      md += `\n`;
    }

    if (uploadedDocuments && uploadedDocuments.length > 0) {
      md += `## 5. Uploaded Documents Audit\n\n`;
      uploadedDocuments.forEach((doc) => {
        md += `### ${doc.fileName} (${doc.fileType.toUpperCase()})\n${doc.summary}\n\n`;
      });
    }

    if (caseRecord.reportBlocks && caseRecord.reportBlocks.length > 0) {
      md += `## 6. Custom Commentary & Owner Paragraphs\n\n`;
      caseRecord.reportBlocks.forEach((blk) => {
        md += `### ${blk.heading}\n${blk.body}\n\n`;
      });
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
    notifySuccess('Markdown briefing (.md) downloaded.');
  };

  // 6. Full Case JSON
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
    notifySuccess('Case backup (.json) downloaded.');
  };

  // 7. CSV Spreadsheet
  const handleDownloadCsv = () => {
    const rows: string[][] = [
      ['Dimension', 'Status', 'Score', 'Evidence Basis', 'Notes'],
      ...Object.values(healthInputs).map((h) => {
        const detail = overallHealth?.dimensionScores?.find((d) => d.key === h.key);
        return [
          `"${h.title.replace(/"/g, '""')}"`,
          `"${h.status}"`,
          `"${detail?.score ?? ''}"`,
          `"${h.evidenceType}"`,
          `"${(h.notes || '').replace(/"/g, '""')}"`,
        ];
      }),
    ];

    if (financials) {
      rows.push([]);
      rows.push(['Financial Metric', 'Value', 'Currency']);
      rows.push(['Annual Revenue', financials.annualRevenue?.toString() || '', profile.currency]);
      rows.push(['Reported Operating Profit', financials.operatingProfit?.toString() || '', profile.currency]);
      rows.push(['Accounts Receivable', financials.accountsReceivable?.toString() || '', profile.currency]);
      rows.push(['Overdue Receivables', financials.overdueReceivables?.toString() || '', profile.currency]);
      rows.push(['Available Cash', financials.cashInBank?.toString() || '', profile.currency]);
      rows.push(['Credit Facility Drawn', financials.creditFacilityUsed?.toString() || '', profile.currency]);
      rows.push(['Credit Facility Limit', financials.creditFacilityLimit?.toString() || '', profile.currency]);
    }

    if (caseRecord.crmContacts && caseRecord.crmContacts.length > 0) {
      rows.push([]);
      rows.push(['CRM Account', 'Type', 'Tier', 'Stage', 'Status', `Monthly (${profile.currency})`, `Opportunity (${profile.currency})`]);
      caseRecord.crmContacts.forEach((c) => {
        rows.push([
          `"${c.companyOrName.replace(/"/g, '""')}"`,
          `"${c.recordType}"`,
          `"${c.tier}"`,
          `"${c.salesStage}"`,
          `"${c.status}"`,
          String(c.monthlyValue || 0),
          String(c.opportunityValue || 0),
        ]);
      });
    }

    const csvContent = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${safeFilename}_Scorecard.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    notifySuccess('Scorecard (.csv) exported.');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/65 backdrop-blur-xs p-4">
      <div className="bg-white border border-[#0F172A]/15 rounded w-full max-w-2xl shadow-2xl overflow-hidden text-[#0F172A]">
        {/* Deep Sapphire Modal Header */}
        <div className="bizpulse-hero-gradient text-white px-6 py-4 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded bg-[#0F52BA] text-white flex items-center justify-center border border-white/20">
              <Download className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">
                Export Executive Reports &amp; Presentations
              </h3>
              <p className="text-xs text-[#CBD5E1]">
                Isolated Export for {profile.name} ({profile.country})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded text-[#CBD5E1] hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {downloadStatus && (
            <div className="p-3 bg-[#ECFDF5] border border-[#A7F3D0] text-[#15803D] text-xs rounded flex items-center gap-2 font-semibold">
              <Check className="w-4 h-4 shrink-0" />
              <span>{downloadStatus}</span>
            </div>
          )}

          {downloadError && (
            <div className="p-3 bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C] text-xs rounded font-semibold">
              {downloadError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* PDF */}
            <button
              type="button"
              onClick={handleDownloadDirectPdf}
              disabled={isGenerating}
              className="p-4 rounded bg-[#F8FAFC] border border-[#0F172A]/12 hover:border-[#0F52BA] hover:bg-white transition text-left flex flex-col justify-between space-y-2.5 group disabled:opacity-50"
            >
              <div className="w-8 h-8 rounded bg-[#FEF2F2] text-[#B91C1C] flex items-center justify-center border border-[#FECACA]">
                <Printer className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-[#0F172A] text-xs block group-hover:text-[#0F52BA]">
                  PDF Report (.pdf)
                </span>
                <span className="text-[11px] text-[#475569]">
                  Paginated layout with radar &amp; bar charts
                </span>
              </div>
            </button>

            {/* Word */}
            <button
              type="button"
              onClick={handleDownloadWordDoc}
              disabled={isGenerating}
              className="p-4 rounded bg-[#F8FAFC] border border-[#0F172A]/12 hover:border-[#0F52BA] hover:bg-white transition text-left flex flex-col justify-between space-y-2.5 group disabled:opacity-50"
            >
              <div className="w-8 h-8 rounded bg-[#0A2E6E] text-[#6495ED] flex items-center justify-center border border-[#0A2E6E]">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-[#0F172A] text-xs block group-hover:text-[#0F52BA]">
                  Word (.docx)
                </span>
                <span className="text-[11px] text-[#475569]">
                  Editable OpenXML report + chart image
                </span>
              </div>
            </button>

            {/* PowerPoint */}
            <button
              type="button"
              onClick={handleDownloadPowerPointDeck}
              disabled={isGenerating}
              className="p-4 rounded bg-[#F8FAFC] border border-[#0F172A]/12 hover:border-[#0F52BA] hover:bg-white transition text-left flex flex-col justify-between space-y-2.5 group disabled:opacity-50"
            >
              <div className="w-8 h-8 rounded bg-[#EDF3FD] text-[#0F52BA] flex items-center justify-center border border-[#B7CEF7]">
                <Presentation className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-[#0F172A] text-xs block group-hover:text-[#0F52BA]">
                  Slides (.pptx)
                </span>
                <span className="text-[11px] text-[#475569]">
                  Executive presentation briefing deck
                </span>
              </div>
            </button>

            {/* Infographic */}
            <button
              type="button"
              onClick={handleDownloadInfographic}
              disabled={isGenerating}
              className="p-4 rounded bg-[#F8FAFC] border border-[#0F172A]/12 hover:border-[#0F52BA] hover:bg-white transition text-left flex flex-col justify-between space-y-2.5 group disabled:opacity-50"
            >
              <div className="w-8 h-8 rounded bg-[#ECFDF5] text-[#15803D] flex items-center justify-center border border-[#A7F3D0]">
                <ImageIcon className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-[#0F172A] text-xs block group-hover:text-[#0F52BA]">
                  Infographic (.svg)
                </span>
                <span className="text-[11px] text-[#475569]">
                  Vector 12-capability health summary
                </span>
              </div>
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#0F172A]/10 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onPrintReport();
                }}
                className="text-[#475569] hover:text-[#0F172A] flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-[#F8FAFC] border border-[#0F172A]/12 hover:bg-white transition font-medium"
              >
                <Printer className="w-3.5 h-3.5 text-[#0F52BA]" />
                <span>Print View</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadMarkdown}
                className="text-[#475569] hover:text-[#0F172A] flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-[#F8FAFC] border border-[#0F172A]/12 hover:bg-white transition font-medium"
              >
                <FileCode className="w-3.5 h-3.5 text-[#0F172A]" />
                <span>Markdown (.md)</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadCsv}
                className="text-[#475569] hover:text-[#0F172A] flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-[#F8FAFC] border border-[#0F172A]/12 hover:bg-white transition font-medium"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-[#15803D]" />
                <span>Scorecard (.csv)</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadJson}
                className="text-[#475569] hover:text-[#0F172A] flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-[#F8FAFC] border border-[#0F172A]/12 hover:bg-white transition font-medium"
              >
                <Database className="w-3.5 h-3.5 text-[#475569]" />
                <span>Full Data (.json)</span>
              </button>
            </div>

            <span className="text-[11px] text-[#475569] font-mono">
              Case ID: {profile.caseId}
            </span>
          </div>

          <div className="p-3 bg-[#F8FAFC] rounded border border-[#0F172A]/10 text-[11px] text-[#475569] flex items-start gap-2">
            <Activity className="w-4 h-4 text-[#0F52BA] shrink-0 mt-0.5" />
            <span>
              All exports compile strictly from <strong>{profile.name}</strong> and never mix figures from other saved businesses.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
