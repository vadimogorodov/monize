'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { ReportChart } from './ReportChart';
import { ReportDetailHeader } from '@/components/reports/ReportDetailHeader';
import { Button } from '@/components/ui/Button';
import { DateInput } from '@/components/ui/DateInput';
import { Select } from '@/components/ui/Select';
import { customReportsApi } from '@/lib/custom-reports';
import { colourReportRows } from './custom-report-colours';
import {
  ReportViewType,
  TimeframeType,
  GroupByType,
  TIMEFRAME_LABELS,
  MetricType,
} from '@/types/custom-report';
import { useNumberFormat } from '@/hooks/useNumberFormat';
import { useDateFormat } from '@/hooks/useDateFormat';
import { useReportData } from '@/hooks/useReportData';
import { ReportError } from './ReportError';
import { getErrorMessage } from '@/lib/errors';
import { useTranslations } from 'next-intl';
import { EmptyState } from '@/components/ui/EmptyState';
import { PartialTotal } from '@/components/ui/PartialTotal';
import { PartialDataNotice } from '@/components/reports/PartialDataNotice';
import { ProvisionalDataNotice } from '@/components/reports/ProvisionalDataNotice';
import { isComplete, reportTotal, type ConvertedTotal } from '@/lib/currency-total';
import { customReportMeasure } from '@/lib/custom-report-measure';
import { customReportDrillDownHref } from '@/lib/custom-report-links';
import { CARD_CLASS } from '@/components/ui/Card';

interface CustomReportViewerProps {
  reportId: string;
}

export function CustomReportViewer({ reportId }: CustomReportViewerProps) {
  const t = useTranslations('reports');
  const tc = useTranslations('common');
  const router = useRouter();
  const { formatCurrency, formatNumber, defaultCurrency } = useNumberFormat();
  const { formatDate } = useDateFormat();
  const definition = useReportData(() => customReportsApi.getById(reportId), [reportId], {
    requestKey: reportId,
  });
  const report = definition.dataKey === reportId ? definition.data : null;
  const isLoading = definition.isLoading;
  const [overrideTimeframe, setOverrideTimeframe] = useState<TimeframeType | ''>('');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  useEffect(() => {
    if (definition.error) {
      toast.error(getErrorMessage(definition.error, t('customReportViewer.toasts.loadFailed')));
    }
  }, [definition.error, t]);

  const request = useMemo(() => {
    if (!report) return null;
    if (overrideTimeframe === TimeframeType.CUSTOM) {
      if (!customStartDate || !customEndDate) return null;
      return { timeframeType: overrideTimeframe, startDate: customStartDate, endDate: customEndDate };
    }
    return overrideTimeframe ? { timeframeType: overrideTimeframe } : {};
  }, [report, overrideTimeframe, customStartDate, customEndDate]);

  const execution = useReportData(async () => {
    if (!request) return null;
    return { request, result: await customReportsApi.execute(reportId, request) };
  }, [reportId, request]);

  // Returning to a previously selected period starts a fresh execution too.
  const current = execution.data?.request === request ? execution.data : null;
  const isExecuting = !!request && (execution.isLoading || (!current && !execution.error));
  const result = !isExecuting && !execution.error ? current?.result : null;

  // Into the register over the report's own filters and dates, narrowed to
  // what was clicked; a listed transaction is flashed on its page.
  const handleDataPointClick = (id: string) => {
    if (!result) return;
    router.push(
      customReportDrillDownHref(report?.filters, result, id, {
        transferMeasure: !!report?.config.transferMeasure,
      }),
    );
  };

  const timeframeOptions = [
    { value: '', label: t('customReportViewer.useSavedTimeframe') },
    ...Object.keys(TIMEFRAME_LABELS).map((value) => ({ value, label: t(`customReportLabels.timeframe.${value}`) })),
  ];

  // The headline, per metric: a count is a number, every other metric money. A
  // withheld total (a missing rate, or the row limit) is the known part, marked.
  const metric = report?.config.metric;
  const formatValue = (value: number) =>
    metric === MetricType.COUNT ? formatNumber(value, 0) : formatCurrency(value, result?.currency);
  // A plain "Total" does not say whether a both-direction figure is a signed
  // net or a sum of unsigned category amounts, so the headline names it.
  const measure = report ? customReportMeasure(report, result?.signedTotal) : null;
  const signed =
    measure === 'netAmount' || measure === 'netCashMovement' || measure === 'average' || measure === 'transfersNet';
  const signedTotal = result?.signedTotal && metric !== MetricType.AVERAGE;
  // A pie encodes only magnitudes, and a zero has no slice to hover or select.
  const signedPie = signed && result?.viewType === ReportViewType.PIE_CHART;
  const legendData = useMemo(() => {
    if (!result) return [];
    return colourReportRows(result.data, signedPie).filter(
      (item): item is typeof item & { value: number } => item.value !== null,
    );
  }, [result, signedPie]);
  const legendRows = signedPie ? legendData : legendData.slice(0, 15);
  const measureLabel = measure === 'average'
    ? t('customReportLabels.metric.AVERAGE')
    : measure ? t(`customReportViewer.measure.${measure}`) : null;
  const summaryTotal: ConvertedTotal | null = result
    ? (() => {
        const withheld = result.summary.total === null;
        const total = reportTotal(
          result.summary.total ?? result.summary.knownTotal ?? 0,
          withheld ? result : null,
        );
        // A withheld total is partial even if the response named no currency,
        // except when only the row limit withheld it: that is not an exclusion
        // for want of a rate, and the truncation marker below names it.
        return withheld && isComplete(total) && !result.truncated
          ? { ...total, excludedCount: 1 }
          : total;
      })()
    : null;
  // One source for the headline mark and the note, so the two cannot disagree.
  const provisionalCount = result ? (result.summary.provisionalCount ?? result.provisionalCount) : undefined;
  const truncatedOnly =
    !!result?.truncated && result.summary.total === null && !!summaryTotal && isComplete(summaryTotal);
  // A truncated total is partial too: the Total row (table and PDF) carries the marker.
  const partialTotal = !summaryTotal
    ? null
    : !isComplete(summaryTotal)
      ? summaryTotal
      : truncatedOnly
        ? { ...summaryTotal, excludedCount: 1 }
        : null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!report) {
    return (
      <EmptyState
        title={t('customReportViewer.notFound')}
        action={
          <Button variant="outline" onClick={() => router.push('/reports')}>
            {t('detailHeader.backToReports')}
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <ReportDetailHeader
        reportId={`custom/${reportId}`}
        title={report.name}
        subtitle={report.description ?? undefined}
        actions={
          <Button
            variant="outline"
            className="shrink-0"
            onClick={() => router.push(`/reports/custom/${reportId}/edit`)}
          >
            {tc('edit')}
          </Button>
        }
      />

      {/* Timeframe Override */}
      <div className={`${CARD_CLASS} p-6`}>
        <div className="flex flex-wrap items-end gap-4">
            <div className="w-64">
              <Select
                label={t('customReportViewer.labelTimeframe')}
                options={timeframeOptions}
                value={overrideTimeframe}
                onChange={(e) => setOverrideTimeframe(e.target.value as TimeframeType | '')}
              />
            </div>
            {overrideTimeframe === TimeframeType.CUSTOM && (
              <>
                <DateInput
                  label={t('customReportViewer.labelStartDate')}
                  value={customStartDate}
                  onDateChange={(date) => setCustomStartDate(date)}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                />
                <DateInput
                  label={t('customReportViewer.labelEndDate')}
                  value={customEndDate}
                  onDateChange={(date) => setCustomEndDate(date)}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                />
              </>
            )}
            {isExecuting && (
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span>{t('customReportViewer.updating')}</span>
              </div>
            )}
          </div>
      </div>

      {/* Results */}
      {isExecuting ? (
        <div className={`${CARD_CLASS} p-12`}>
          <div className="flex flex-col items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-gray-500 dark:text-gray-400">{t('customReportViewer.generating')}</p>
          </div>
        </div>
      ) : request && execution.error ? (
        <ReportError
          message={getErrorMessage(execution.error, t('customReportViewer.toasts.executeFailed'))}
          onRetry={execution.reload}
        />
      ) : result ? (
        <div className={`${CARD_CLASS} p-6`}>
          {/* Summary */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {result.timeframe.label}
                {result.timeframe.startDate && result.timeframe.endDate && (
                  <span className="ml-1">
                    ({formatDate(result.timeframe.startDate)} – {formatDate(result.timeframe.endDate)})
                  </span>
                )}
              </span>
              <span className="mx-2 text-gray-300 dark:text-gray-600">|</span>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {t(`customReportLabels.viewType.${result.viewType}`)}
              </span>
            </div>
            <div className="text-right">
              {measureLabel && (
                <div className="text-sm text-gray-500 dark:text-gray-400" data-testid="report-measure">
                  {measureLabel}
                </div>
              )}
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {/* A null total is withheld, not zero: show the part that converted
                    and mark it. The count metric's total is never null. */}
                <PartialTotal
                  total={
                    truncatedOnly
                      ? { ...(summaryTotal ?? reportTotal(0, null)), excludedCount: 1 }
                      : (summaryTotal ?? reportTotal(0, null))
                  }
                  displayCurrency={result.currency ?? defaultCurrency}
                  explanation={truncatedOnly ? t('customReportViewer.truncatedNotice') : undefined}
                  provisionalCount={provisionalCount}
                >
                  {formatValue(summaryTotal?.value ?? 0)}
                </PartialTotal>
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {t('customReportViewer.transactionCount', { count: result.summary.count })}
              </div>
            </div>
          </div>
          {result.truncated && (
            <p className="mb-4 text-xs text-amber-600 dark:text-amber-400" role="note" data-testid="truncated-notice">
              {t('customReportViewer.truncatedNotice')}
            </p>
          )}
          <div className="mb-4">
            <PartialDataNotice
              missingCurrencies={result.missingCurrencies ?? []}
              excludedCount={result.excludedCount ?? 0}
              displayCurrency={result.currency ?? defaultCurrency}
            />
            <ProvisionalDataNotice count={provisionalCount} />
          </div>

          {/* Chart */}
          {result.data.length > 0 ? (
            <ReportChart
              viewType={result.viewType as ReportViewType}
              data={result.data}
              groupBy={result.groupBy as GroupByType}
              onDataPointClick={handleDataPointClick}
              tableColumns={result.tableColumns}
              currency={result.currency}
              metric={metric}
              totalRowValue={summaryTotal?.value}
              totalRowCount={signedTotal ? result.summary.count : undefined}
              partialTotal={partialTotal}
              totalLabel={measureLabel ?? undefined}
              signed={signed}
              reportTitle={report.name}
              exportFilename={report.name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}
            />
          ) : (
            <div className="py-12 text-center text-gray-500 dark:text-gray-400">
              {t('customReportViewer.noData')}
            </div>
          )}

          {/* Legend for pie/bar charts */}
          {(result.viewType === ReportViewType.PIE_CHART || result.viewType === ReportViewType.BAR_CHART) &&
            legendData.length > 0 && (
              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                  {legendRows.map((item, index) => (
                    <button
                      key={index}
                      onClick={() => item.id && handleDataPointClick(item.id)}
                      className="flex items-center gap-2 text-sm text-left hover:bg-gray-50 dark:hover:bg-gray-700 p-1 rounded"
                    >
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-gray-600 dark:text-gray-400 truncate">
                        {item.label}
                      </span>{' '}
                      {signedPie && <span className="shrink-0 tabular-nums">{formatValue(item.value)}</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}
        </div>
      ) : null}
    </div>
  );
}
