import * as XLSX from 'xlsx';
import type {
  OwnerAllocationBucket,
  OwnerFinanceConfig,
  OwnerMonthlyClosing,
  OwnerTransaction,
  StoreInfo,
} from '../types';

export interface OwnerBucketReportStat {
  inflow: number;
  absorbedLoss?: number;
  used: number;
  balance: number;
}

export interface OwnerMonthlyIntakeRow {
  month: string;
  salaryPaid: number;
  salaryAccruedUnpaid: number;
  bonusPaid: number;
  privePaid: number;
  totalReceived: number;
}

export interface OwnerReportExportPayload {
  config: OwnerFinanceConfig;
  storeInfo?: StoreInfo;
  periodLabel: string;
  selectedMonth: string;
  intakeSummary: {
    salaryPaid: number;
    bonusPaid: number;
    privePaid: number;
    totalReceived: number;
    pendingAccruedSalary: number;
    availableBonusBalance: number;
  };
  bucketStats: Record<OwnerAllocationBucket, OwnerBucketReportStat>;
  cashSummary: {
    totalStoreLiquidCash: number;
    dueSoonSupplierBills: number;
    safeCashForBonus: number;
  };
  monthlyIntakeRows: OwnerMonthlyIntakeRow[];
  monthlyClosings: OwnerMonthlyClosing[];
  transactions: OwnerTransaction[];
}

const formatCurrencyIdr = (value: number): string =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(Math.round(value || 0));

const formatDateShort = (dateStr?: string): string => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const formatMonthLabel = (ym: string): string => {
  if (!ym || !/^\d{4}-\d{2}$/.test(ym)) return ym || '-';
  const [y, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString('id-ID', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
};

const escapeHtml = (raw?: string | number | null): string => {
  const s = raw === undefined || raw === null ? '' : String(raw);
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

const sanitizeFilename = (raw: string): string =>
  raw
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'Dokumen';

const getTodaySlug = (): string => new Date().toISOString().substring(0, 10);

const BUCKET_LABELS: Record<OwnerAllocationBucket, string> = {
  reserve: 'Cadangan Usaha',
  equipment: 'Investasi Mesin',
  bonus: 'Bonus Owner',
  buffer: 'Buffer Kewajiban & Kas',
};

const getTxLabel = (tx: OwnerTransaction): string => {
  switch (tx.type) {
    case 'salary_paid':
      return 'Gaji Dibayar';
    case 'salary_accrual':
      return 'Gaji Terhutang';
    case 'bonus_payout':
      return 'Pencairan Bonus';
    case 'prive':
      return 'Prive Darurat';
    case 'reserve_usage':
      return `Pakai ${tx.bucket ? BUCKET_LABELS[tx.bucket] : 'Pos Alokasi'}`;
    default:
      return tx.type;
  }
};

export const buildOwnerFinanceReportHtml = (payload: OwnerReportExportPayload): string => {
  const {
    config,
    storeInfo,
    periodLabel,
    intakeSummary,
    bucketStats,
    cashSummary,
    monthlyIntakeRows,
    monthlyClosings,
    transactions,
  } = payload;

  const storeName = storeInfo?.name?.trim() || 'NALA MEDIA DIGITAL PRINTING';
  const storeAddress = storeInfo?.address?.trim() || '';
  const storeContact = [storeInfo?.phone?.trim(), storeInfo?.email?.trim()].filter(Boolean).join(' • ');
  const printedAt = new Date().toLocaleString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const bucketRowsHtml = (['reserve', 'equipment', 'bonus', 'buffer'] as OwnerAllocationBucket[])
    .map(b => {
      const stat = bucketStats[b];
      const pct = config.allocationPercents[b];
      const extraLoss = b === 'reserve' && (stat.absorbedLoss || 0) > 0
        ? ` (+ Serap Rugi ${formatCurrencyIdr(stat.absorbedLoss || 0)})`
        : '';
      return `
        <tr>
          <td><strong>${escapeHtml(BUCKET_LABELS[b])}</strong> (${pct}%)</td>
          <td class="right">${formatCurrencyIdr(stat.inflow)}</td>
          <td class="right">${formatCurrencyIdr(stat.used)}${escapeHtml(extraLoss)}</td>
          <td class="right bold">${formatCurrencyIdr(stat.balance)}</td>
        </tr>
      `;
    })
    .join('');

  const monthlyIntakeHtml = monthlyIntakeRows.length === 0
    ? `<tr><td colspan="6" class="center muted">Belum ada transaksi penerimaan owner pada cakupan ini.</td></tr>`
    : monthlyIntakeRows
        .map(
          r => `
        <tr>
          <td><strong>${escapeHtml(formatMonthLabel(r.month))}</strong></td>
          <td class="right">${formatCurrencyIdr(r.salaryPaid)}</td>
          <td class="right">${formatCurrencyIdr(r.bonusPaid)}</td>
          <td class="right">${formatCurrencyIdr(r.privePaid)}</td>
          <td class="right bold">${formatCurrencyIdr(r.totalReceived)}</td>
          <td class="right muted">${formatCurrencyIdr(r.salaryAccruedUnpaid)}</td>
        </tr>`
        )
        .join('');

  const closingsHtml = monthlyClosings.length === 0
    ? `<tr><td colspan="7" class="center muted">Belum ada periode tutup buku bulanan.</td></tr>`
    : monthlyClosings
        .map(
          c => `
        <tr>
          <td><strong>${escapeHtml(formatMonthLabel(c.month))}</strong></td>
          <td class="right">${formatCurrencyIdr(c.accrualSales)}</td>
          <td class="right">${formatCurrencyIdr(c.rawProfit)}</td>
          <td class="right bold">${formatCurrencyIdr(c.distributableProfit)}</td>
          <td class="right">${formatCurrencyIdr(c.allocations.reserve)}</td>
          <td class="right">${formatCurrencyIdr(c.allocations.equipment)}</td>
          <td class="right">${formatCurrencyIdr(c.allocations.bonus)}</td>
        </tr>`
        )
        .join('');

  const txRowsHtml = transactions.length === 0
    ? `<tr><td colspan="6" class="center muted">Tidak ada rincian transaksi pada periode ini.</td></tr>`
    : transactions
        .map(tx => {
          const sourceText =
            tx.type === 'salary_accrual'
              ? 'Belum memotong kas (Terhutang)'
              : tx.type === 'reserve_usage' && !tx.linkedExpenseId
              ? 'Hanya potong saldo pos alokasi'
              : [tx.fundingSource, tx.fundingAccountName].filter(Boolean).join(' • ') || '-';
          return `
            <tr>
              <td>${escapeHtml(formatDateShort(tx.date))}</td>
              <td>${escapeHtml(formatMonthLabel(tx.month))}</td>
              <td><strong>${escapeHtml(getTxLabel(tx))}</strong></td>
              <td>${escapeHtml(sourceText)}</td>
              <td>${escapeHtml(tx.notes || '-')}</td>
              <td class="right bold">${formatCurrencyIdr(tx.amount)}</td>
            </tr>
          `;
        })
        .join('');

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <title>Laporan Owner Dashboard - ${escapeHtml(config.ownerName)}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    * { box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      color: #0f172a;
      margin: 0;
      padding: 16px;
      font-size: 11px;
      line-height: 1.45;
      background: #ffffff;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 10px;
      margin-bottom: 14px;
    }
    .store-name { font-size: 16px; font-weight: 800; margin: 0; }
    .store-meta { font-size: 10px; color: #475569; margin-top: 2px; }
    .doc-badge { text-align: right; }
    .doc-title { font-size: 13px; font-weight: 800; text-transform: uppercase; margin: 0; color: #be185d; }
    .doc-sub { font-size: 10px; color: #475569; margin-top: 2px; }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin-bottom: 14px;
    }
    .kpi-box {
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 8px 10px;
      background: #f8fafc;
    }
    .kpi-box.highlight {
      border-color: #fbcfe8;
      background: #fdf2f8;
    }
    .kpi-label { font-size: 9.5px; color: #475569; text-transform: uppercase; font-weight: 700; }
    .kpi-value { font-size: 13px; font-weight: 800; color: #0f172a; margin-top: 3px; font-variant-numeric: tabular-nums; }
    .kpi-sub { font-size: 9.5px; color: #64748b; margin-top: 2px; }
    .section-title {
      font-size: 11.5px;
      font-weight: 800;
      color: #0f172a;
      margin: 14px 0 6px 0;
      padding-bottom: 3px;
      border-bottom: 1px solid #e2e8f0;
      text-transform: uppercase;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 10px;
      font-variant-numeric: tabular-nums;
    }
    th, td {
      border: 1px solid #cbd5e1;
      padding: 5px 7px;
      text-align: left;
      vertical-align: top;
    }
    th {
      background: #f1f5f9;
      font-size: 10px;
      font-weight: 700;
      color: #334155;
    }
    .right { text-align: right; }
    .center { text-align: center; }
    .bold { font-weight: 700; }
    .muted { color: #64748b; }
    .footer-sign {
      margin-top: 20px;
      display: flex;
      justify-content: space-between;
      font-size: 10px;
      color: #475569;
    }
    .sign-box { text-align: center; min-width: 160px; }
    .sign-space { height: 48px; }
    .sign-line { border-top: 1px solid #334155; padding-top: 4px; font-weight: 700; color: #0f172a; }
    @media print {
      body { padding: 0; }
      .section-title { page-break-after: avoid; }
      tr { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <p class="store-name">${escapeHtml(storeName)}</p>
      ${storeAddress ? `<p class="store-meta">${escapeHtml(storeAddress)}</p>` : ''}
      ${storeContact ? `<p class="store-meta">${escapeHtml(storeContact)}</p>` : ''}
    </div>
    <div class="doc-badge">
      <p class="doc-title">Laporan Owner Dashboard</p>
      <p class="doc-sub">Owner: ${escapeHtml(config.ownerName)} • Gaji Tgl ${config.salaryPayDay}/bln</p>
      <p class="doc-sub">Cakupan: ${escapeHtml(periodLabel)}</p>
      <p class="doc-sub">Dicetak: ${escapeHtml(printedAt)}</p>
    </div>
  </div>

  <div class="kpi-grid">
    <div class="kpi-box">
      <div class="kpi-label">Gaji Diterima</div>
      <div class="kpi-value">${formatCurrencyIdr(intakeSummary.salaryPaid)}</div>
      <div class="kpi-sub">Masuk Laba Rugi (Gaji Owner)</div>
    </div>
    <div class="kpi-box">
      <div class="kpi-label">Bonus Dicairkan</div>
      <div class="kpi-value">${formatCurrencyIdr(intakeSummary.bonusPaid)}</div>
      <div class="kpi-sub">Dari porsi ${config.allocationPercents.bonus}% laba</div>
    </div>
    <div class="kpi-box">
      <div class="kpi-label">Prive Darurat</div>
      <div class="kpi-value">${formatCurrencyIdr(intakeSummary.privePaid)}</div>
      <div class="kpi-sub">Penarikan non-operasional</div>
    </div>
    <div class="kpi-box highlight">
      <div class="kpi-label">Total Uang Diterima Owner</div>
      <div class="kpi-value">${formatCurrencyIdr(intakeSummary.totalReceived)}</div>
      <div class="kpi-sub">Gaji + Bonus + Prive</div>
    </div>
  </div>

  <p class="kpi-sub" style="margin-bottom: 10px;">
    <strong>Hak Belum Cair (Semua Bulan):</strong> Gaji Terhutang ${formatCurrencyIdr(intakeSummary.pendingAccruedSalary)}
    &nbsp;•&nbsp; Bonus Siap Cair ${formatCurrencyIdr(intakeSummary.availableBonusBalance)}
    &nbsp;•&nbsp; <strong>Kas Toko Riil:</strong> ${formatCurrencyIdr(cashSummary.totalStoreLiquidCash)}
    &nbsp;•&nbsp; <strong>Batas Kas Aman:</strong> ${formatCurrencyIdr(cashSummary.safeCashForBonus)}
  </p>

  <h4 class="section-title">1. Posisi Saldo 4 Kantong Alokasi (Kumulatif)</h4>
  <table>
    <thead>
      <tr>
        <th>Pos Alokasi</th>
        <th class="right">Total Dialokasikan</th>
        <th class="right">Terpakai / Dicairkan</th>
        <th class="right">Sisa Saldo</th>
      </tr>
    </thead>
    <tbody>${bucketRowsHtml}</tbody>
  </table>

  <h4 class="section-title">2. Rekap Penerimaan Uang Owner Per Bulan (${escapeHtml(periodLabel)})</h4>
  <table>
    <thead>
      <tr>
        <th>Periode Bulan</th>
        <th class="right">Gaji Dibayar</th>
        <th class="right">Bonus Dicairkan</th>
        <th class="right">Prive Darurat</th>
        <th class="right">Total Diterima Owner</th>
        <th class="right">Sisa Gaji Terhutang</th>
      </tr>
    </thead>
    <tbody>${monthlyIntakeHtml}</tbody>
  </table>

  <h4 class="section-title">3. Arsip Tutup Buku Bulanan (Terkunci)</h4>
  <table>
    <thead>
      <tr>
        <th>Periode</th>
        <th class="right">Omzet Akrual</th>
        <th class="right">Laba Kinerja</th>
        <th class="right">Laba Dibagi</th>
        <th class="right">Cadangan (${config.allocationPercents.reserve}%)</th>
        <th class="right">Mesin (${config.allocationPercents.equipment}%)</th>
        <th class="right">Bonus (${config.allocationPercents.bonus}%)</th>
      </tr>
    </thead>
    <tbody>${closingsHtml}</tbody>
  </table>

  <h4 class="section-title">4. Rincian Riwayat Transaksi Owner (${escapeHtml(periodLabel)})</h4>
  <table>
    <thead>
      <tr>
        <th>Tanggal</th>
        <th>Bulan Hak</th>
        <th>Jenis Transaksi</th>
        <th>Sumber Dana</th>
        <th>Catatan</th>
        <th class="right">Nominal</th>
      </tr>
    </thead>
    <tbody>${txRowsHtml}</tbody>
  </table>

  <div class="footer-sign">
    <div>
      <p>Dicetak dari Owner Dashboard • ${escapeHtml(storeName)}</p>
      <p>Gaji Owner tercatat ke Pengeluaran Operasional; Bonus &amp; Prive tercatat sebagai Tarik Owner di Arus Kas.</p>
    </div>
    <div class="sign-box">
      <p>Mengetahui,</p>
      <div class="sign-space"></div>
      <div class="sign-line">${escapeHtml(config.ownerName)}</div>
    </div>
  </div>
</body>
</html>`;
};

export const exportOwnerFinanceExcel = (payload: OwnerReportExportPayload): void => {
  const {
    config,
    periodLabel,
    intakeSummary,
    bucketStats,
    cashSummary,
    monthlyIntakeRows,
    monthlyClosings,
    transactions,
  } = payload;

  const wb = XLSX.utils.book_new();

  const summaryRows = [
    { Bagian: 'Profil Owner', Keterangan: 'Nama Owner', Nilai: config.ownerName },
    { Bagian: 'Profil Owner', Keterangan: 'Gaji Pokok Bulanan', Nilai: config.monthlySalary },
    { Bagian: 'Profil Owner', Keterangan: 'Tanggal Gaji Rutin', Nilai: `Tanggal ${config.salaryPayDay}` },
    { Bagian: 'Profil Owner', Keterangan: 'Cakupan Laporan', Nilai: periodLabel },
    { Bagian: 'Penerimaan Owner', Keterangan: 'Gaji Bulanan Diterima', Nilai: intakeSummary.salaryPaid },
    { Bagian: 'Penerimaan Owner', Keterangan: 'Bonus Laba Dicairkan', Nilai: intakeSummary.bonusPaid },
    { Bagian: 'Penerimaan Owner', Keterangan: 'Prive Darurat Ditarik', Nilai: intakeSummary.privePaid },
    { Bagian: 'Penerimaan Owner', Keterangan: 'TOTAL UANG DITERIMA OWNER', Nilai: intakeSummary.totalReceived },
    { Bagian: 'Hak Tertahan (Semua Bulan)', Keterangan: 'Gaji Terhutang Belum Dibayar', Nilai: intakeSummary.pendingAccruedSalary },
    { Bagian: 'Hak Tertahan (Semua Bulan)', Keterangan: 'Saldo Bonus Siap Cair', Nilai: intakeSummary.availableBonusBalance },
    { Bagian: 'Saldo Pos Alokasi', Keterangan: `Cadangan Usaha (${config.allocationPercents.reserve}%)`, Nilai: bucketStats.reserve.balance },
    { Bagian: 'Saldo Pos Alokasi', Keterangan: `Investasi Mesin (${config.allocationPercents.equipment}%)`, Nilai: bucketStats.equipment.balance },
    { Bagian: 'Saldo Pos Alokasi', Keterangan: `Bonus Owner (${config.allocationPercents.bonus}%)`, Nilai: bucketStats.bonus.balance },
    { Bagian: 'Saldo Pos Alokasi', Keterangan: `Buffer Kewajiban & Kas (${config.allocationPercents.buffer}%)`, Nilai: bucketStats.buffer.balance },
    { Bagian: 'Likuiditas Toko', Keterangan: 'Total Kas Toko Riil Saat Ini', Nilai: cashSummary.totalStoreLiquidCash },
    { Bagian: 'Likuiditas Toko', Keterangan: 'Hutang Pemasok Jatuh Tempo <= 14 Hari', Nilai: cashSummary.dueSoonSupplierBills },
    { Bagian: 'Likuiditas Toko', Keterangan: 'Batas Kas Aman Pencairan', Nilai: cashSummary.safeCashForBonus },
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), 'Ringkasan Owner');

  const monthlySheetRows = monthlyIntakeRows.map(r => ({
    Periode: formatMonthLabel(r.month),
    'Kode Bulan': r.month,
    'Gaji Dibayar (Rp)': r.salaryPaid,
    'Bonus Dicairkan (Rp)': r.bonusPaid,
    'Prive Darurat (Rp)': r.privePaid,
    'Total Uang Diterima (Rp)': r.totalReceived,
    'Sisa Gaji Terhutang (Rp)': r.salaryAccruedUnpaid,
  }));
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      monthlySheetRows.length > 0
        ? monthlySheetRows
        : [{ Info: 'Belum ada data penerimaan owner pada cakupan ini.' }]
    ),
    'Rekap Per Bulan'
  );

  const closingSheetRows = monthlyClosings.map(c => ({
    Periode: formatMonthLabel(c.month),
    'Tanggal Tutup Buku': formatDateShort(c.closedAt),
    'Omzet Akrual (Rp)': c.accrualSales,
    'Total Beban Akrual (Rp)': c.totalAccrualCosts,
    'Laba/Rugi Kinerja (Rp)': c.rawProfit,
    'Tutup Rugi Sebelumnya (Rp)': c.priorLossApplied,
    'Serap Cadangan (Rp)': c.absorbedFromReserve,
    'Laba Dibagi (Rp)': c.distributableProfit,
    'Cadangan Usaha (Rp)': c.allocations.reserve,
    'Investasi Mesin (Rp)': c.allocations.equipment,
    'Bonus Owner (Rp)': c.allocations.bonus,
    'Buffer Kewajiban (Rp)': c.allocations.buffer,
    'Arus Kas Riil (Rp)': c.cashNetInMonth,
    Catatan: c.notes || '',
  }));
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      closingSheetRows.length > 0 ? closingSheetRows : [{ Info: 'Belum ada periode tutup buku.' }]
    ),
    'Tutup Buku Bulanan'
  );

  const txSheetRows = transactions.map(tx => ({
    Tanggal: tx.date,
    'Bulan Hak': tx.month,
    Jenis: getTxLabel(tx),
    Pos: tx.bucket ? BUCKET_LABELS[tx.bucket] : '-',
    'Sumber Dana':
      tx.type === 'salary_accrual'
        ? 'Terhutang (Belum potong kas)'
        : tx.type === 'reserve_usage' && !tx.linkedExpenseId
        ? 'Pos Alokasi Virtual'
        : [tx.fundingSource, tx.fundingAccountName].filter(Boolean).join(' - ') || '-',
    'Nominal (Rp)': tx.amount,
    Catatan: tx.notes || '',
    'Dicatat Oleh': tx.createdBy || '',
  }));
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      txSheetRows.length > 0 ? txSheetRows : [{ Info: 'Tidak ada rincian transaksi.' }]
    ),
    'Riwayat Transaksi'
  );

  const fileName = `Laporan_Owner_Dashboard_${sanitizeFilename(config.ownerName)}_${getTodaySlug()}.xlsx`;
  XLSX.writeFile(wb, fileName);
};
