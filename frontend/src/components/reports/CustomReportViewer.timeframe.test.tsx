import { beforeEach, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@/test/render';
import { customReportsApi } from '@/lib/custom-reports';
import { GroupByType, ReportViewType, type ReportResult } from '@/types/custom-report';
import { downloadBlob } from '@/lib/download';
import { CustomReportViewer } from './CustomReportViewer';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/lib/custom-reports', () => ({
  customReportsApi: {
    getById: vi.fn().mockResolvedValue({
      id: 'monthly',
      name: 'Monthly movement',
      viewType: 'TABLE',
      groupBy: 'MONTH',
      config: { metric: 'TOTAL_AMOUNT', direction: 'BOTH' },
      filters: {},
    }),
    getAll: vi.fn().mockResolvedValue([]),
    execute: vi.fn(),
  },
}));
vi.mock('@/lib/investment-reports', () => ({
  investmentReportsApi: { getAll: vi.fn().mockResolvedValue([]) },
}));
vi.mock('@/lib/download', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/download')>()),
  downloadBlob: vi.fn(),
}));

function monthlyResult(label: string, startDate: string, value: number, count: number): ReportResult {
  return {
    reportId: 'monthly',
    name: 'Monthly movement',
    currency: 'USD',
    missingCurrencies: [],
    excludedCount: 0,
    viewType: ReportViewType.TABLE,
    groupBy: GroupByType.MONTH,
    signedTotal: true,
    data: [{ id: startDate, label, value, count }],
    summary: { total: value, knownTotal: value, average: value / count, count },
    timeframe: { label, startDate, endDate: startDate },
  };
}

const december = monthlyResult('December 2025', '2025-12-31', -32, 1);
const january = monthlyResult('January 2026', '2026-01-02', 52, 2);

function pendingMonth() {
  let resolve!: (value: ReportResult) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<ReportResult>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

async function selectPeriod(value: string) {
  await act(async () => {
    fireEvent.change(screen.getByRole('combobox'), { target: { value } });
  });
}

async function switchPeriods() {
  const older = pendingMonth();
  const latest = pendingMonth();
  vi.mocked(customReportsApi.execute)
    .mockResolvedValueOnce(december)
    .mockReturnValueOnce(older.promise)
    .mockReturnValueOnce(latest.promise);
  await act(async () => { render(<CustomReportViewer reportId="monthly" />); });
  expect(screen.getByRole('table')).toHaveTextContent('December 2025');
  await selectPeriod('LAST_YEAR');
  await selectPeriod('YEAR_TO_DATE');
  expect(customReportsApi.execute).toHaveBeenLastCalledWith('monthly', { timeframeType: 'YEAR_TO_DATE' });
  return { older, latest };
}

beforeEach(() => vi.clearAllMocks());

it.each([true, false])('exports January for Year to Date (December responds last: %s)', async (lateDecember) => {
  const { older, latest } = await switchPeriods();
  if (lateDecember) {
    await act(async () => latest.resolve(january));
    await act(async () => older.resolve(december));
  } else {
    await act(async () => older.resolve(december));
    expect(screen.queryByRole('button', { name: 'Export' })).toBeNull();
    expect(screen.queryByRole('table')).toBeNull();
    await act(async () => latest.resolve(january));
  }
  expect(screen.getByRole('table')).toHaveTextContent('January 2026');
  expect(screen.getByRole('table')).toHaveTextContent('52.00');
  fireEvent.click(screen.getByRole('button', { name: 'Export' }));
  fireEvent.click(screen.getByRole('button', { name: 'CSV' }));
  const [blob] = vi.mocked(downloadBlob).mock.lastCall!;
  const csv = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.readAsText(blob);
  });
  expect(csv).toContain('January 2026,52,,2');
  expect(csv).toContain('Net amount,52,,2');
  expect(csv).not.toContain('December 2025');
});

it('keeps the previous period out of exports after the selected request fails', async () => {
  const { older, latest } = await switchPeriods();
  await act(async () => latest.reject(new Error('Could not load January')));
  await act(async () => older.resolve(december));
  expect(screen.getByText('Could not load January')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Export' })).toBeNull();
  expect(screen.queryByRole('table')).toBeNull();
});
