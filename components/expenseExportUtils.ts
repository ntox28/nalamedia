import * as XLSX from 'xlsx';
import type {
  BankInstallment,
  BillPayment,
  ExpenseItem,
  ExpenseMetadata,
  PrivateExpenseItem,
  StoreInfo,
  SupplierBill,
} from '../types';

export const formatCurrencyIdr = (value: number): string =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(value);

export const formatDateId = (dateStr?: string): string => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

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

export interface BillPaymentWithBalance {
  payment: BillPayment;
  runningBalance: number;
}

/**
 * Mengurutkan riwayat pembayaran tagihan pemasok secara kronologis (tanggal terlama -> terbaru)
 * dan menghitung sisa tagihan berjalan setelah setiap cicilan.
 */
export const computeSupplierBillPaymentLedger = (bill: SupplierBill): BillPaymentWithBalance[] => {
  const indexed = bill.payments.map((payment, idx) => ({ payment, idx }));
  indexed.sort((a, b) => {
    const timeDiff = new Date(a.payment.date).getTime() - new Date(b.payment.date).getTime();
    if (timeDiff !== 0) return timeDiff;
    return a.idx - b.idx;
  });

  let running = bill.totalAmount;
  return indexed.map(({ payment }) => {
    running = Math.max(0, running - payment.amount);
    return { payment, runningBalance: running };
  });
};

// ==========================================
// SHARED PRINT HTML SHELL
// ==========================================
const buildPrintShell = (title: string, bodyHtml: string, storeInfo?: StoreInfo): string => {
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

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    @page { size: A4 portrait; margin: 14mm; }
    * { box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      color: #111827;
      margin: 0;
      padding: 18px;
      font-size: 12px;
      line-height: 1.45;
      background: #ffffff;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #1f2937;
      padding-bottom: 10px;
      margin-bottom: 14px;
    }
    .store-name {
      font-size: 17px;
      font-weight: 800;
      letter-spacing: 0.3px;
      color: #111827;
      margin: 0;
    }
    .store-meta {
      font-size: 11px;
      color: #4b5563;
      margin-top: 2px;
    }
    .doc-badge {
      text-align: right;
    }
    .doc-title {
      font-size: 14px;
      font-weight: 800;
      color: #be185d;
      text-transform: uppercase;
      margin: 0;
    }
    .doc-sub {
      font-size: 10.5px;
      color: #6b7280;
      margin-top: 2px;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      padding: 10px 12px;
      margin-bottom: 14px;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      font-size: 11.5px;
      padding: 2px 0;
    }
    .info-label { color: #6b7280; }
    .info-val { font-weight: 600; color: #111827; text-align: right; }
    .summary-cards {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      margin-bottom: 14px;
    }
    .summary-cards.cols-4 {
      grid-template-columns: repeat(4, 1fr);
    }
    .card {
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      padding: 9px 11px;
      background: #ffffff;
    }
    .card.highlight-red { border-color: #fecaca; background: #fef2f2; }
    .card.highlight-green { border-color: #bbf7d0; background: #f0fdf4; }
    .card.highlight-slate { border-color: #cbd5e1; background: #f8fafc; }
    .card-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.4px; color: #6b7280; font-weight: 600; }
    .card-value { font-size: 15px; font-weight: 800; margin-top: 3px; color: #111827; }
    .card.highlight-red .card-value { color: #dc2626; }
    .card.highlight-green .card-value { color: #15803d; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 14px;
      font-size: 11px;
    }
    th, td {
      border: 1px solid #d1d5db;
      padding: 6px 8px;
      vertical-align: top;
    }
    th {
      background: #f3f4f6;
      font-weight: 700;
      text-transform: uppercase;
      font-size: 10px;
      letter-spacing: 0.3px;
      color: #374151;
    }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .font-bold { font-weight: 700; }
    .text-red { color: #dc2626; }
    .text-green { color: #15803d; }
    .muted { color: #6b7280; font-size: 10px; }
    .pill {
      display: inline-block;
      padding: 1px 7px;
      border-radius: 9999px;
      font-size: 10px;
      font-weight: 700;
    }
    .pill-green { background: #dcfce7; color: #166534; }
    .pill-amber { background: #fef3c7; color: #92400e; }
    .pill-sky { background: #e0f2fe; color: #075985; }
    .total-row td {
      background: #f9fafb;
      font-weight: 800;
      font-size: 11.5px;
    }
    .sub-table {
      margin: 4px 0 0 0;
      font-size: 10px;
    }
    .sub-table th, .sub-table td {
      padding: 3px 6px;
      border-color: #e5e7eb;
    }
    .sign-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 40px;
      margin-top: 26px;
      page-break-inside: avoid;
    }
    .sign-box {
      text-align: center;
      font-size: 11px;
    }
    .sign-line {
      margin-top: 48px;
      border-top: 1px solid #9ca3af;
      padding-top: 4px;
      font-weight: 600;
    }
    .footer-note {
      margin-top: 16px;
      border-top: 1px dashed #d1d5db;
      padding-top: 8px;
      font-size: 10px;
      color: #6b7280;
      display: flex;
      justify-content: space-between;
    }
    @media print {
      body { padding: 0; }
      .no-print { display: none !important; }
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
      <p class="doc-title">${escapeHtml(title)}</p>
      <p class="doc-sub">Dicetak: ${escapeHtml(printedAt)}</p>
    </div>
  </div>
  ${bodyHtml}
  <div class="footer-note">
    <span>Dokumen resmi dicatat dari sistem keuangan ${escapeHtml(storeName)}</span>
    <span>Tanggal Cetak: ${escapeHtml(printedAt)}</span>
  </div>
</body>
</html>`;
};

// ==========================================
// 1. KARTU HUTANG & BUKTI PEMBAYARAN PER FAKTUR PEMASOK
// ==========================================
export const buildSupplierBillStatementHtml = (bill: SupplierBill, storeInfo?: StoreInfo): string => {
  const ledger = computeSupplierBillPaymentLedger(bill);
  const totalPaid = ledger.reduce((s, r) => s + r.payment.amount, 0);
  const remaining = Math.max(0, bill.totalAmount - totalPaid);
  const statusPill =
    bill.status === 'Lunas' || remaining <= 0
      ? '<span class="pill pill-green">LUNAS</span>'
      : '<span class="pill pill-amber">BELUM LUNAS</span>';

  const rowsHtml =
    ledger.length > 0
      ? ledger
          .map(({ payment, runningBalance }, index) => {
            const sourceText =
              payment.fundingSource +
              (payment.fundingAccountName ? ` (${payment.fundingAccountName})` : '');
            return `<tr>
              <td class="text-center">${index + 1}</td>
              <td>${escapeHtml(formatDateId(payment.date))}</td>
              <td>${escapeHtml(sourceText)}</td>
              <td>${escapeHtml(payment.notes || '-')}</td>
              <td>${escapeHtml(payment.paidBy || '-')}</td>
              <td class="text-right font-bold text-green">${escapeHtml(formatCurrencyIdr(payment.amount))}</td>
              <td class="text-right font-bold ${runningBalance > 0 ? 'text-red' : 'text-green'}">${escapeHtml(
              formatCurrencyIdr(runningBalance)
            )}</td>
            </tr>`;
          })
          .join('')
      : `<tr><td colspan="7" class="text-center muted" style="padding:14px;">Belum ada pembayaran / cicilan yang tercatat untuk faktur ini.</td></tr>`;

  const body = `
    <div class="info-grid">
      <div>
        <div class="info-row"><span class="info-label">Pemasok (Supplier)</span><span class="info-val">${escapeHtml(bill.supplierName)}</span></div>
        <div class="info-row"><span class="info-label">No. Faktur / Nota</span><span class="info-val">${escapeHtml(bill.invoiceNumber)}</span></div>
        <div class="info-row"><span class="info-label">Keterangan</span><span class="info-val">${escapeHtml(bill.description)}</span></div>
      </div>
      <div>
        <div class="info-row"><span class="info-label">Tanggal Faktur</span><span class="info-val">${escapeHtml(formatDateId(bill.date))}</span></div>
        <div class="info-row"><span class="info-label">Jatuh Tempo</span><span class="info-val">${escapeHtml(formatDateId(bill.dueDate))}</span></div>
        <div class="info-row"><span class="info-label">Status Tagihan</span><span class="info-val">${statusPill}</span></div>
      </div>
    </div>

    <div class="summary-cards">
      <div class="card highlight-slate">
        <div class="card-label">Total Tagihan Awal</div>
        <div class="card-value">${escapeHtml(formatCurrencyIdr(bill.totalAmount))}</div>
      </div>
      <div class="card highlight-green">
        <div class="card-label">Total Sudah Dibayar (${ledger.length}x)</div>
        <div class="card-value">${escapeHtml(formatCurrencyIdr(totalPaid))}</div>
      </div>
      <div class="card ${remaining > 0 ? 'highlight-red' : 'highlight-green'}">
        <div class="card-label">Sisa Tagihan Sah Saat Ini</div>
        <div class="card-value">${escapeHtml(formatCurrencyIdr(remaining))}</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th class="text-center" style="width:32px;">No</th>
          <th style="width:95px;">Tanggal Bayar</th>
          <th style="width:140px;">Sumber Dana</th>
          <th>Catatan / Keterangan</th>
          <th style="width:85px;">Dicatat Oleh</th>
          <th class="text-right" style="width:110px;">Nominal Cicilan</th>
          <th class="text-right" style="width:115px;">Sisa Tagihan</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td class="text-center">-</td>
          <td>${escapeHtml(formatDateId(bill.date))}</td>
          <td colspan="3"><i>Saldo Awal Tagihan Faktur ${escapeHtml(bill.invoiceNumber)}</i></td>
          <td class="text-right">-</td>
          <td class="text-right font-bold">${escapeHtml(formatCurrencyIdr(bill.totalAmount))}</td>
        </tr>
        ${rowsHtml}
        <tr class="total-row">
          <td colspan="5" class="text-right">TOTAL TERBAYAR &amp; SISA TAGIHAN AKHIR</td>
          <td class="text-right text-green">${escapeHtml(formatCurrencyIdr(totalPaid))}</td>
          <td class="text-right ${remaining > 0 ? 'text-red' : 'text-green'}">${escapeHtml(
    formatCurrencyIdr(remaining)
  )}</td>
        </tr>
      </tbody>
    </table>

    ${bill.notes ? `<p style="font-size:11px;color:#4b5563;margin-bottom:12px;"><b>Catatan Faktur:</b> ${escapeHtml(bill.notes)}</p>` : ''}

    <div class="sign-grid">
      <div class="sign-box">
        <div>Dibuat / Diperiksa Oleh,</div>
        <div class="sign-line">Pihak ${escapeHtml(storeInfo?.name || 'Toko')}</div>
      </div>
      <div class="sign-box">
        <div>Dikonfirmasi Oleh,</div>
        <div class="sign-line">Pihak Pemasok (${escapeHtml(bill.supplierName)})</div>
      </div>
    </div>
  `;

  return buildPrintShell(`Kartu Hutang & Riwayat Cicilan (${bill.invoiceNumber})`, body, storeInfo);
};

export const exportSupplierBillDetailExcel = (bill: SupplierBill): void => {
  const wb = XLSX.utils.book_new();
  const ledger = computeSupplierBillPaymentLedger(bill);
  const totalPaid = ledger.reduce((s, r) => s + r.payment.amount, 0);
  const remaining = Math.max(0, bill.totalAmount - totalPaid);

  const summaryRows = [
    { Keterangan: 'Pemasok (Supplier)', Nilai: bill.supplierName },
    { Keterangan: 'No. Faktur / Nota', Nilai: bill.invoiceNumber },
    { Keterangan: 'Tanggal Faktur', Nilai: formatDateShort(bill.date) },
    { Keterangan: 'Jatuh Tempo', Nilai: formatDateShort(bill.dueDate) },
    { Keterangan: 'Deskripsi Tagihan', Nilai: bill.description },
    { Keterangan: 'Status', Nilai: bill.status },
    { Keterangan: 'Total Tagihan Awal (Rp)', Nilai: bill.totalAmount },
    { Keterangan: `Total Sudah Dibayar (${ledger.length}x) (Rp)`, Nilai: totalPaid },
    { Keterangan: 'Sisa Tagihan Sah Saat Ini (Rp)', Nilai: remaining },
    { Keterangan: 'Catatan Faktur', Nilai: bill.notes || '-' },
  ];
  const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(wb, summarySheet, 'Ringkasan Faktur');

  const paymentRows: Array<Record<string, string | number>> = [
    {
      'No.': '-',
      'Tanggal Bayar': formatDateShort(bill.date),
      'Sumber Dana': '-',
      'Rekening': '-',
      'Dicatat Oleh': '-',
      'Catatan': `Saldo Awal Faktur ${bill.invoiceNumber}`,
      'Nominal Bayar (Rp)': 0,
      'Sisa Tagihan Berjalan (Rp)': bill.totalAmount,
    },
    ...ledger.map(({ payment, runningBalance }, idx) => ({
      'No.': idx + 1,
      'Tanggal Bayar': formatDateShort(payment.date),
      'Sumber Dana': payment.fundingSource,
      'Rekening': payment.fundingAccountName || '-',
      'Dicatat Oleh': payment.paidBy || '-',
      'Catatan': payment.notes || '-',
      'Nominal Bayar (Rp)': payment.amount,
      'Sisa Tagihan Berjalan (Rp)': runningBalance,
    })),
    {
      'No.': '',
      'Tanggal Bayar': '',
      'Sumber Dana': '',
      'Rekening': '',
      'Dicatat Oleh': '',
      'Catatan': 'TOTAL TERBAYAR & SISA AKHIR',
      'Nominal Bayar (Rp)': totalPaid,
      'Sisa Tagihan Berjalan (Rp)': remaining,
    },
  ];
  const paymentSheet = XLSX.utils.json_to_sheet(paymentRows);
  XLSX.utils.book_append_sheet(wb, paymentSheet, 'Rincian Cicilan');

  const fileName = `Kartu_Hutang_${sanitizeFilename(bill.supplierName)}_${sanitizeFilename(bill.invoiceNumber)}_${getTodaySlug()}.xlsx`;
  XLSX.writeFile(wb, fileName);
};

// ==========================================
// 2. REKAP & DAFTAR TAGIHAN PEMASOK (FILTERED)
// ==========================================
export const buildSupplierBillsRecapHtml = (
  bills: SupplierBill[],
  filterLabel: string,
  storeInfo?: StoreInfo
): string => {
  const totalBilled = bills.reduce((s, b) => s + b.totalAmount, 0);
  const totalPaid = bills.reduce((s, b) => s + b.payments.reduce((ps, p) => ps + p.amount, 0), 0);
  const totalRemaining = bills.reduce(
    (s, b) => s + Math.max(0, b.totalAmount - b.payments.reduce((ps, p) => ps + p.amount, 0)),
    0
  );

  const rowsHtml =
    bills.length > 0
      ? bills
          .map((bill, idx) => {
            const ledger = computeSupplierBillPaymentLedger(bill);
            const paid = ledger.reduce((s, r) => s + r.payment.amount, 0);
            const rem = Math.max(0, bill.totalAmount - paid);

            const paymentHistoryRows =
              ledger.length > 0
                ? `<table class="sub-table">
                    <thead>
                      <tr>
                        <th>Tgl Cicilan</th>
                        <th>Sumber Dana</th>
                        <th>Catatan</th>
                        <th class="text-right">Dibayar</th>
                        <th class="text-right">Sisa Berjalan</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${ledger
                        .map(
                          ({ payment, runningBalance }) => `<tr>
                            <td>${escapeHtml(formatDateId(payment.date))}</td>
                            <td>${escapeHtml(
                              payment.fundingSource +
                                (payment.fundingAccountName ? ` (${payment.fundingAccountName})` : '')
                            )}</td>
                            <td>${escapeHtml(payment.notes || '-')}</td>
                            <td class="text-right text-green font-bold">${escapeHtml(
                              formatCurrencyIdr(payment.amount)
                            )}</td>
                            <td class="text-right font-bold">${escapeHtml(
                              formatCurrencyIdr(runningBalance)
                            )}</td>
                          </tr>`
                        )
                        .join('')}
                    </tbody>
                  </table>`
                : '<span class="muted">Belum ada pembayaran cicilan</span>';

            return `<tr>
              <td class="text-center">${idx + 1}</td>
              <td>
                <b>${escapeHtml(bill.invoiceNumber)}</b><br/>
                <span class="muted">Tgl: ${escapeHtml(formatDateShort(bill.date))} &bull; JT: ${escapeHtml(
              formatDateShort(bill.dueDate)
            )}</span>
              </td>
              <td>
                <b>${escapeHtml(bill.supplierName)}</b><br/>
                <span class="muted">${escapeHtml(bill.description)}</span>
                ${paymentHistoryRows}
              </td>
              <td class="text-right">${escapeHtml(formatCurrencyIdr(bill.totalAmount))}</td>
              <td class="text-right text-green font-bold">${escapeHtml(formatCurrencyIdr(paid))}</td>
              <td class="text-right font-bold ${rem > 0 ? 'text-red' : 'text-green'}">${escapeHtml(
              formatCurrencyIdr(rem)
            )}</td>
              <td class="text-center">
                <span class="pill ${bill.status === 'Lunas' ? 'pill-green' : 'pill-amber'}">${escapeHtml(
              bill.status
            )}</span>
              </td>
            </tr>`;
          })
          .join('')
      : `<tr><td colspan="7" class="text-center muted" style="padding:16px;">Tidak ada tagihan pemasok pada filter ini.</td></tr>`;

  const body = `
    <p style="margin:0 0 10px 0;font-size:11.5px;"><b>Filter Laporan:</b> ${escapeHtml(filterLabel)}</p>
    <div class="summary-cards cols-4">
      <div class="card highlight-slate">
        <div class="card-label">Jumlah Faktur</div>
        <div class="card-value">${bills.length} Faktur</div>
      </div>
      <div class="card">
        <div class="card-label">Total Tagihan</div>
        <div class="card-value">${escapeHtml(formatCurrencyIdr(totalBilled))}</div>
      </div>
      <div class="card highlight-green">
        <div class="card-label">Total Sudah Dibayar</div>
        <div class="card-value">${escapeHtml(formatCurrencyIdr(totalPaid))}</div>
      </div>
      <div class="card ${totalRemaining > 0 ? 'highlight-red' : 'highlight-green'}">
        <div class="card-label">Total Sisa Hutang</div>
        <div class="card-value">${escapeHtml(formatCurrencyIdr(totalRemaining))}</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th class="text-center" style="width:28px;">No</th>
          <th style="width:120px;">Faktur &amp; Tanggal</th>
          <th>Pemasok, Keterangan &amp; Rincian Cicilan</th>
          <th class="text-right" style="width:95px;">Total Tagihan</th>
          <th class="text-right" style="width:95px;">Terbayar</th>
          <th class="text-right" style="width:95px;">Sisa Hutang</th>
          <th class="text-center" style="width:72px;">Status</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
        <tr class="total-row">
          <td colspan="3" class="text-right">TOTAL KESELURUHAN (${bills.length} FAKTUR)</td>
          <td class="text-right">${escapeHtml(formatCurrencyIdr(totalBilled))}</td>
          <td class="text-right text-green">${escapeHtml(formatCurrencyIdr(totalPaid))}</td>
          <td class="text-right ${totalRemaining > 0 ? 'text-red' : 'text-green'}">${escapeHtml(
    formatCurrencyIdr(totalRemaining)
  )}</td>
          <td></td>
        </tr>
      </tbody>
    </table>
  `;

  return buildPrintShell('Rekap Tagihan & Riwayat Cicilan Pemasok', body, storeInfo);
};

export const exportSupplierBillsExcel = (bills: SupplierBill[], filterLabel: string): void => {
  const wb = XLSX.utils.book_new();
  const totalBilled = bills.reduce((s, b) => s + b.totalAmount, 0);
  const totalPaid = bills.reduce((s, b) => s + b.payments.reduce((ps, p) => ps + p.amount, 0), 0);
  const totalRemaining = bills.reduce(
    (s, b) => s + Math.max(0, b.totalAmount - b.payments.reduce((ps, p) => ps + p.amount, 0)),
    0
  );

  const summaryRows: Array<Record<string, string | number>> = bills.map((b, idx) => {
    const paid = b.payments.reduce((s, p) => s + p.amount, 0);
    const rem = Math.max(0, b.totalAmount - paid);
    return {
      'No.': idx + 1,
      'Pemasok': b.supplierName,
      'No. Faktur': b.invoiceNumber,
      'Tanggal Faktur': formatDateShort(b.date),
      'Jatuh Tempo': formatDateShort(b.dueDate),
      'Keterangan': b.description,
      'Total Tagihan (Rp)': b.totalAmount,
      'Sudah Dibayar (Rp)': paid,
      'Sisa Tagihan (Rp)': rem,
      'Jumlah Cicilan': b.payments.length,
      'Status': b.status,
      'Catatan': b.notes || '-',
    };
  });

  summaryRows.push({
    'No.': '',
    'Pemasok': 'TOTAL KESELURUHAN',
    'No. Faktur': filterLabel,
    'Tanggal Faktur': '',
    'Jatuh Tempo': '',
    'Keterangan': `${bills.length} Faktur`,
    'Total Tagihan (Rp)': totalBilled,
    'Sudah Dibayar (Rp)': totalPaid,
    'Sisa Tagihan (Rp)': totalRemaining,
    'Jumlah Cicilan': bills.reduce((s, b) => s + b.payments.length, 0),
    'Status': '',
    'Catatan': '',
  });

  const billSheet = XLSX.utils.json_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(wb, billSheet, 'Rekap Tagihan');

  const paymentRows: Array<Record<string, string | number>> = [];
  let rowNo = 1;
  bills.forEach(bill => {
    const ledger = computeSupplierBillPaymentLedger(bill);
    ledger.forEach(({ payment, runningBalance }) => {
      paymentRows.push({
        'No.': rowNo++,
        'Pemasok': bill.supplierName,
        'No. Faktur': bill.invoiceNumber,
        'Total Faktur (Rp)': bill.totalAmount,
        'Tanggal Bayar': formatDateShort(payment.date),
        'Sumber Dana': payment.fundingSource,
        'Rekening': payment.fundingAccountName || '-',
        'Nominal Cicilan (Rp)': payment.amount,
        'Sisa Faktur Berjalan (Rp)': runningBalance,
        'Dicatat Oleh': payment.paidBy || '-',
        'Catatan': payment.notes || '-',
      });
    });
  });

  if (paymentRows.length === 0) {
    paymentRows.push({
      'No.': '',
      'Pemasok': '-',
      'No. Faktur': '-',
      'Total Faktur (Rp)': 0,
      'Tanggal Bayar': '-',
      'Sumber Dana': '-',
      'Rekening': '-',
      'Nominal Cicilan (Rp)': 0,
      'Sisa Faktur Berjalan (Rp)': 0,
      'Dicatat Oleh': '-',
      'Catatan': 'Belum ada rincian pembayaran cicilan',
    });
  }

  const paymentSheet = XLSX.utils.json_to_sheet(paymentRows);
  XLSX.utils.book_append_sheet(wb, paymentSheet, 'Rincian Cicilan');

  const fileName = `Rekap_Tagihan_Pemasok_${sanitizeFilename(filterLabel)}_${getTodaySlug()}.xlsx`;
  XLSX.writeFile(wb, fileName);
};

// ==========================================
// 3. PENGELUARAN OPERASIONAL
// ==========================================
export const buildOperationalExpensesHtml = (
  expenses: ExpenseItem[],
  metadata: Record<number, ExpenseMetadata>,
  filterLabel: string,
  storeInfo?: StoreInfo
): string => {
  const total = expenses.reduce((s, e) => s + e.amount, 0);
  const kasLaciTotal = expenses
    .filter(e => (metadata[e.id]?.fundingSource || 'Kas Laci') === 'Kas Laci')
    .reduce((s, e) => s + e.amount, 0);
  const kasDipegangOwnerTotal = expenses
    .filter(e => metadata[e.id]?.fundingSource === 'Kas Dipegang Owner')
    .reduce((s, e) => s + e.amount, 0);
  const bankTotal = total - kasLaciTotal - kasDipegangOwnerTotal;

  const rowsHtml =
    expenses.length > 0
      ? expenses
          .map((exp, idx) => {
            const meta = metadata[exp.id];
            const funding = meta?.fundingSource || 'Kas Laci';
            const sourceText = funding + (meta?.fundingAccountName ? ` • ${meta.fundingAccountName}` : '');
            return `<tr>
              <td class="text-center">${idx + 1}</td>
              <td>${escapeHtml(formatDateShort(exp.date))}</td>
              <td>
                <b>${escapeHtml(exp.name)}</b>
                ${meta?.purchaseId ? ' <span class="pill pill-sky">Barang Masuk</span>' : ''}
                ${meta?.notes ? `<br/><span class="muted">${escapeHtml(meta.notes)}</span>` : ''}
              </td>
              <td>${escapeHtml(exp.category)}</td>
              <td>${escapeHtml(sourceText)}</td>
              <td class="text-right font-bold text-red">${escapeHtml(formatCurrencyIdr(exp.amount))}</td>
            </tr>`;
          })
          .join('')
      : `<tr><td colspan="6" class="text-center muted" style="padding:14px;">Tidak ada data pengeluaran operasional pada filter ini.</td></tr>`;

  const body = `
    <p style="margin:0 0 10px 0;font-size:11.5px;"><b>Filter Laporan:</b> ${escapeHtml(filterLabel)}</p>
    <div class="summary-cards">
      <div class="card highlight-red">
        <div class="card-label">Total Pengeluaran (${expenses.length} Transaksi)</div>
        <div class="card-value">${escapeHtml(formatCurrencyIdr(total))}</div>
      </div>
      <div class="card highlight-slate">
        <div class="card-label">Sumber: Kas Laci (Tunai)</div>
        <div class="card-value">${escapeHtml(formatCurrencyIdr(kasLaciTotal))}</div>
      </div>
      <div class="card highlight-slate">
        <div class="card-label">Sumber: Transfer Bank / Non-Laci</div>
        <div class="card-value">${escapeHtml(formatCurrencyIdr(bankTotal))}</div>
      </div>
      ${kasDipegangOwnerTotal > 0 ? `<div class="card highlight-slate">
        <div class="card-label">Sumber: Kas Dipegang Owner</div>
        <div class="card-value">${escapeHtml(formatCurrencyIdr(kasDipegangOwnerTotal))}</div>
      </div>` : ''}
    </div>

    <table>
      <thead>
        <tr>
          <th class="text-center" style="width:30px;">No</th>
          <th style="width:82px;">Tanggal</th>
          <th>Nama Pengeluaran &amp; Catatan</th>
          <th style="width:140px;">Kategori</th>
          <th style="width:130px;">Sumber Dana</th>
          <th class="text-right" style="width:105px;">Jumlah</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
        <tr class="total-row">
          <td colspan="5" class="text-right">TOTAL PENGELUARAN OPERASIONAL</td>
          <td class="text-right text-red">${escapeHtml(formatCurrencyIdr(total))}</td>
        </tr>
      </tbody>
    </table>
  `;

  return buildPrintShell('Laporan Pengeluaran Operasional', body, storeInfo);
};

export const exportOperationalExpensesExcel = (
  expenses: ExpenseItem[],
  metadata: Record<number, ExpenseMetadata>,
  filterLabel: string
): void => {
  const wb = XLSX.utils.book_new();
  const total = expenses.reduce((s, e) => s + e.amount, 0);

  const rows: Array<Record<string, string | number>> = expenses.map((exp, idx) => {
    const meta = metadata[exp.id];
    const funding = meta?.fundingSource || 'Kas Laci';
    return {
      'No.': idx + 1,
      'Tanggal': formatDateShort(exp.date),
      'Nama Pengeluaran': exp.name,
      'Kategori': exp.category,
      'Sumber Dana': funding,
      'Rekening': meta?.fundingAccountName || '-',
      'Asal Transaksi': meta?.purchaseId ? 'Pembelian / Barang Masuk' : 'Input Manual',
      'Catatan': meta?.notes || '-',
      'Nominal (Rp)': exp.amount,
    };
  });

  rows.push({
    'No.': '',
    'Tanggal': '',
    'Nama Pengeluaran': 'TOTAL PENGELUARAN OPERASIONAL',
    'Kategori': filterLabel,
    'Sumber Dana': '',
    'Rekening': '',
    'Asal Transaksi': `${expenses.length} Transaksi`,
    'Catatan': '',
    'Nominal (Rp)': total,
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Pengeluaran Operasional');
  XLSX.writeFile(wb, `Pengeluaran_Operasional_${getTodaySlug()}.xlsx`);
};

// ==========================================
// 4. CICILAN BANK / LEASING
// ==========================================
export const buildBankInstallmentDetailHtml = (inst: BankInstallment, storeInfo?: StoreInfo): string => {
  const sortedPayments = [...inst.payments].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  const totalPaid = sortedPayments.reduce((s, p) => s + p.totalPaid, 0);
  const totalPrincipal = sortedPayments.reduce((s, p) => s + p.principalPaid, 0);
  const totalInterest = sortedPayments.reduce((s, p) => s + p.interestPaid, 0);

  const rowsHtml =
    sortedPayments.length > 0
      ? sortedPayments
          .map((p, idx) => {
            const src = p.fundingSource + (p.fundingAccountName ? ` (${p.fundingAccountName})` : '');
            return `<tr>
              <td class="text-center">${idx + 1}</td>
              <td>${escapeHtml(formatDateId(p.date))}</td>
              <td>${escapeHtml(src)}</td>
              <td class="text-right">${escapeHtml(formatCurrencyIdr(p.principalPaid))}</td>
              <td class="text-right">${escapeHtml(formatCurrencyIdr(p.interestPaid))}</td>
              <td class="text-right font-bold text-green">${escapeHtml(formatCurrencyIdr(p.totalPaid))}</td>
              <td>${escapeHtml(p.notes || '-')}</td>
            </tr>`;
          })
          .join('')
      : `<tr><td colspan="7" class="text-center muted" style="padding:14px;">Belum ada riwayat pembayaran angsuran.</td></tr>`;

  const body = `
    <div class="info-grid">
      <div>
        <div class="info-row"><span class="info-label">Nama Kredit / Bank</span><span class="info-val">${escapeHtml(inst.name)}</span></div>
        <div class="info-row"><span class="info-label">Status Cicilan</span><span class="info-val">${escapeHtml(inst.status)}</span></div>
      </div>
      <div>
        <div class="info-row"><span class="info-label">Jatuh Tempo Berikutnya</span><span class="info-val">${escapeHtml(formatDateId(inst.nextDueDate))}</span></div>
        <div class="info-row"><span class="info-label">Catatan</span><span class="info-val">${escapeHtml(inst.notes || '-')}</span></div>
      </div>
    </div>

    <div class="summary-cards cols-4">
      <div class="card highlight-slate">
        <div class="card-label">Kredit Awal</div>
        <div class="card-value">${escapeHtml(formatCurrencyIdr(inst.creditLimit))}</div>
      </div>
      <div class="card highlight-green">
        <div class="card-label">Total Angsuran (${sortedPayments.length}x)</div>
        <div class="card-value">${escapeHtml(formatCurrencyIdr(totalPaid))}</div>
      </div>
      <div class="card">
        <div class="card-label">Pokok / Bunga Terbayar</div>
        <div class="card-value" style="font-size:12px;">${escapeHtml(formatCurrencyIdr(totalPrincipal))} / ${escapeHtml(
    formatCurrencyIdr(totalInterest)
  )}</div>
      </div>
      <div class="card ${inst.remainingPrincipal > 0 ? 'highlight-red' : 'highlight-green'}">
        <div class="card-label">Sisa Pokok Kredit</div>
        <div class="card-value">${escapeHtml(formatCurrencyIdr(inst.remainingPrincipal))}</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th class="text-center" style="width:30px;">No</th>
          <th style="width:95px;">Tanggal Bayar</th>
          <th style="width:130px;">Sumber Dana</th>
          <th class="text-right" style="width:95px;">Pokok</th>
          <th class="text-right" style="width:95px;">Bunga/Admin</th>
          <th class="text-right" style="width:105px;">Total Bayar</th>
          <th>Catatan</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
        <tr class="total-row">
          <td colspan="3" class="text-right">TOTAL ANGSURAN TERBAYAR</td>
          <td class="text-right">${escapeHtml(formatCurrencyIdr(totalPrincipal))}</td>
          <td class="text-right">${escapeHtml(formatCurrencyIdr(totalInterest))}</td>
          <td class="text-right text-green">${escapeHtml(formatCurrencyIdr(totalPaid))}</td>
          <td></td>
        </tr>
      </tbody>
    </table>
  `;

  return buildPrintShell(`Kartu Angsuran Bank (${inst.name})`, body, storeInfo);
};

export const buildBankInstallmentsListHtml = (
  installments: BankInstallment[],
  storeInfo?: StoreInfo
): string => {
  const totalLimit = installments.reduce((s, b) => s + b.creditLimit, 0);
  const totalRemaining = installments.reduce((s, b) => s + Math.max(0, b.remainingPrincipal), 0);
  const totalPaid = installments.reduce(
    (s, b) => s + b.payments.reduce((ps, p) => ps + p.totalPaid, 0),
    0
  );

  const rowsHtml =
    installments.length > 0
      ? installments
          .map((inst, idx) => {
            const paidAll = inst.payments.reduce((s, p) => s + p.totalPaid, 0);
            const principalPaid = inst.payments.reduce((s, p) => s + p.principalPaid, 0);
            const interestPaid = inst.payments.reduce((s, p) => s + p.interestPaid, 0);
            return `<tr>
              <td class="text-center">${idx + 1}</td>
              <td><b>${escapeHtml(inst.name)}</b>${inst.notes ? `<br/><span class="muted">${escapeHtml(inst.notes)}</span>` : ''}</td>
              <td>${escapeHtml(formatDateShort(inst.nextDueDate))}</td>
              <td class="text-right">${escapeHtml(formatCurrencyIdr(inst.creditLimit))}</td>
              <td class="text-right">${escapeHtml(formatCurrencyIdr(principalPaid))}</td>
              <td class="text-right">${escapeHtml(formatCurrencyIdr(interestPaid))}</td>
              <td class="text-right text-green font-bold">${escapeHtml(formatCurrencyIdr(paidAll))}</td>
              <td class="text-right font-bold ${inst.remainingPrincipal > 0 ? 'text-red' : 'text-green'}">${escapeHtml(
              formatCurrencyIdr(inst.remainingPrincipal)
            )}</td>
              <td class="text-center"><span class="pill ${
                inst.status === 'Lunas' ? 'pill-green' : 'pill-amber'
              }">${escapeHtml(inst.status)}</span></td>
            </tr>`;
          })
          .join('')
      : `<tr><td colspan="9" class="text-center muted" style="padding:14px;">Belum ada data cicilan bank.</td></tr>`;

  const body = `
    <div class="summary-cards">
      <div class="card highlight-slate">
        <div class="card-label">Total Plafon Kredit Awal (${installments.length} Kredit)</div>
        <div class="card-value">${escapeHtml(formatCurrencyIdr(totalLimit))}</div>
      </div>
      <div class="card highlight-green">
        <div class="card-label">Total Angsuran Masuk (Pokok + Bunga)</div>
        <div class="card-value">${escapeHtml(formatCurrencyIdr(totalPaid))}</div>
      </div>
      <div class="card ${totalRemaining > 0 ? 'highlight-red' : 'highlight-green'}">
        <div class="card-label">Total Sisa Pokok Kredit</div>
        <div class="card-value">${escapeHtml(formatCurrencyIdr(totalRemaining))}</div>
      </div>
    </div>
    <table>
      <thead>
        <tr>
          <th class="text-center" style="width:28px;">No</th>
          <th>Nama Bank / Kredit</th>
          <th style="width:78px;">Jatuh Tempo</th>
          <th class="text-right" style="width:88px;">Kredit Awal</th>
          <th class="text-right" style="width:85px;">Pokok Bayar</th>
          <th class="text-right" style="width:80px;">Bunga/Adm</th>
          <th class="text-right" style="width:88px;">Total Bayar</th>
          <th class="text-right" style="width:90px;">Sisa Pokok</th>
          <th class="text-center" style="width:55px;">Status</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
        <tr class="total-row">
          <td colspan="3" class="text-right">TOTAL</td>
          <td class="text-right">${escapeHtml(formatCurrencyIdr(totalLimit))}</td>
          <td class="text-right">${escapeHtml(
            formatCurrencyIdr(
              installments.reduce((s, b) => s + b.payments.reduce((ps, p) => ps + p.principalPaid, 0), 0)
            )
          )}</td>
          <td class="text-right">${escapeHtml(
            formatCurrencyIdr(
              installments.reduce((s, b) => s + b.payments.reduce((ps, p) => ps + p.interestPaid, 0), 0)
            )
          )}</td>
          <td class="text-right text-green">${escapeHtml(formatCurrencyIdr(totalPaid))}</td>
          <td class="text-right text-red">${escapeHtml(formatCurrencyIdr(totalRemaining))}</td>
          <td></td>
        </tr>
      </tbody>
    </table>
  `;

  return buildPrintShell('Rekap Cicilan Bank & Leasing', body, storeInfo);
};

export const exportBankInstallmentDetailExcel = (inst: BankInstallment): void => {
  const wb = XLSX.utils.book_new();
  const sorted = [...inst.payments].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const summarySheet = XLSX.utils.json_to_sheet([
    { Keterangan: 'Nama Bank / Kredit', Nilai: inst.name },
    { Keterangan: 'Status', Nilai: inst.status },
    { Keterangan: 'Jatuh Tempo Berikutnya', Nilai: formatDateShort(inst.nextDueDate) },
    { Keterangan: 'Kredit Awal (Rp)', Nilai: inst.creditLimit },
    { Keterangan: 'Sisa Pokok Saat Ini (Rp)', Nilai: inst.remainingPrincipal },
    { Keterangan: 'Total Angsuran Terbayar (Rp)', Nilai: sorted.reduce((s, p) => s + p.totalPaid, 0) },
    { Keterangan: 'Total Pokok Terbayar (Rp)', Nilai: sorted.reduce((s, p) => s + p.principalPaid, 0) },
    { Keterangan: 'Total Bunga/Admin (Rp)', Nilai: sorted.reduce((s, p) => s + p.interestPaid, 0) },
    { Keterangan: 'Catatan', Nilai: inst.notes || '-' },
  ]);
  XLSX.utils.book_append_sheet(wb, summarySheet, 'Ringkasan Kredit');

  const rows: Array<Record<string, string | number>> = sorted.map((p, idx) => ({
    'No.': idx + 1,
    'Tanggal Bayar': formatDateShort(p.date),
    'Sumber Dana': p.fundingSource,
    'Rekening': p.fundingAccountName || '-',
    'Pokok (Rp)': p.principalPaid,
    'Bunga / Admin (Rp)': p.interestPaid,
    'Total Dibayar (Rp)': p.totalPaid,
    'Dicatat Oleh': p.paidBy || '-',
    'Catatan': p.notes || '-',
  }));
  const paySheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, paySheet, 'Riwayat Angsuran');

  XLSX.writeFile(wb, `Kartu_Angsuran_${sanitizeFilename(inst.name)}_${getTodaySlug()}.xlsx`);
};

export const exportBankInstallmentsExcel = (installments: BankInstallment[]): void => {
  const wb = XLSX.utils.book_new();

  const recapRows: Array<Record<string, string | number>> = installments.map((inst, idx) => ({
    'No.': idx + 1,
    'Nama Kredit / Bank': inst.name,
    'Status': inst.status,
    'Jatuh Tempo': formatDateShort(inst.nextDueDate),
    'Kredit Awal (Rp)': inst.creditLimit,
    'Pokok Terbayar (Rp)': inst.payments.reduce((s, p) => s + p.principalPaid, 0),
    'Bunga/Admin Terbayar (Rp)': inst.payments.reduce((s, p) => s + p.interestPaid, 0),
    'Total Dibayar (Rp)': inst.payments.reduce((s, p) => s + p.totalPaid, 0),
    'Sisa Pokok (Rp)': inst.remainingPrincipal,
    'Jumlah Angsuran': inst.payments.length,
    'Catatan': inst.notes || '-',
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(recapRows), 'Rekap Cicilan Bank');

  const paymentRows: Array<Record<string, string | number>> = [];
  let rowNo = 1;
  installments.forEach(inst => {
    [...inst.payments]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .forEach(p => {
        paymentRows.push({
          'No.': rowNo++,
          'Nama Kredit / Bank': inst.name,
          'Tanggal Bayar': formatDateShort(p.date),
          'Sumber Dana': p.fundingSource,
          'Rekening': p.fundingAccountName || '-',
          'Pokok (Rp)': p.principalPaid,
          'Bunga/Admin (Rp)': p.interestPaid,
          'Total Dibayar (Rp)': p.totalPaid,
          'Catatan': p.notes || '-',
        });
      });
  });
  if (paymentRows.length > 0) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(paymentRows), 'Rincian Angsuran');
  }

  XLSX.writeFile(wb, `Rekap_Cicilan_Bank_${getTodaySlug()}.xlsx`);
};

// ==========================================
// 5. PENGELUARAN PRIBADI / NON-OPERASIONAL
// ==========================================
export const buildPrivateExpensesHtml = (
  items: PrivateExpenseItem[],
  filterLabel: string,
  storeInfo?: StoreInfo
): string => {
  const total = items.reduce((s, p) => s + p.amount, 0);
  const fromStore = items
    .filter(p => p.fundingSource !== 'Uang Pribadi Owner')
    .reduce((s, p) => s + p.amount, 0);
  const pendingReimburse = items
    .filter(p => p.fundingSource === 'Uang Pribadi Owner' && p.needsReimburse && !p.reimbursed)
    .reduce((s, p) => s + p.amount, 0);

  const rowsHtml =
    items.length > 0
      ? items
          .map((item, idx) => {
            const src = item.fundingSource + (item.fundingAccountName ? ` • ${item.fundingAccountName}` : '');
            const reimburseLabel = item.needsReimburse
              ? item.reimbursed
                ? '<span class="pill pill-green">Sudah Reimburse</span>'
                : '<span class="pill pill-amber">Perlu Reimburse</span>'
              : '-';
            return `<tr>
              <td class="text-center">${idx + 1}</td>
              <td>${escapeHtml(formatDateShort(item.date))}</td>
              <td>
                <b>${escapeHtml(item.name)}</b>
                ${item.guestOrEvent ? `<br/><span class="muted">Tamu/Event: ${escapeHtml(item.guestOrEvent)}</span>` : ''}
                ${item.notes ? `<br/><span class="muted">${escapeHtml(item.notes)}</span>` : ''}
              </td>
              <td>${escapeHtml(item.category)}</td>
              <td>${escapeHtml(src)}</td>
              <td class="text-center">${reimburseLabel}</td>
              <td class="text-right font-bold">${escapeHtml(formatCurrencyIdr(item.amount))}</td>
            </tr>`;
          })
          .join('')
      : `<tr><td colspan="7" class="text-center muted" style="padding:14px;">Tidak ada data pengeluaran pribadi / non-operasional.</td></tr>`;

  const body = `
    <p style="margin:0 0 10px 0;font-size:11.5px;"><b>Filter Laporan:</b> ${escapeHtml(filterLabel)}</p>
    <div class="summary-cards">
      <div class="card highlight-slate">
        <div class="card-label">Total Pengeluaran Non-Opr (${items.length} Data)</div>
        <div class="card-value">${escapeHtml(formatCurrencyIdr(total))}</div>
      </div>
      <div class="card highlight-red">
        <div class="card-label">Keluar dari Kas / Rekening Toko</div>
        <div class="card-value">${escapeHtml(formatCurrencyIdr(fromStore))}</div>
      </div>
      <div class="card highlight-green">
        <div class="card-label">Dana Owner Perlu Reimburse</div>
        <div class="card-value">${escapeHtml(formatCurrencyIdr(pendingReimburse))}</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th class="text-center" style="width:28px;">No</th>
          <th style="width:78px;">Tanggal</th>
          <th>Keperluan, Tamu &amp; Catatan</th>
          <th style="width:120px;">Kategori</th>
          <th style="width:115px;">Sumber Dana</th>
          <th class="text-center" style="width:85px;">Reimburse</th>
          <th class="text-right" style="width:95px;">Jumlah</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
        <tr class="total-row">
          <td colspan="6" class="text-right">TOTAL PENGELUARAN PRIBADI / NON-OPERASIONAL</td>
          <td class="text-right">${escapeHtml(formatCurrencyIdr(total))}</td>
        </tr>
      </tbody>
    </table>
  `;

  return buildPrintShell('Laporan Pengeluaran Pribadi & Non-Operasional', body, storeInfo);
};

export const exportPrivateExpensesExcel = (items: PrivateExpenseItem[], filterLabel: string): void => {
  const wb = XLSX.utils.book_new();
  const total = items.reduce((s, p) => s + p.amount, 0);

  const rows: Array<Record<string, string | number>> = items.map((item, idx) => ({
    'No.': idx + 1,
    'Tanggal': formatDateShort(item.date),
    'Keperluan': item.name,
    'Kategori': item.category,
    'Tamu / Event': item.guestOrEvent || '-',
    'Sumber Dana': item.fundingSource,
    'Rekening': item.fundingAccountName || '-',
    'Status Reimburse': item.needsReimburse
      ? item.reimbursed
        ? 'Sudah Direimburse'
        : 'Perlu Reimburse'
      : 'Tidak Perlu',
    'Catatan': item.notes || '-',
    'Nominal (Rp)': item.amount,
  }));

  rows.push({
    'No.': '',
    'Tanggal': '',
    'Keperluan': 'TOTAL PENGELUARAN NON-OPERASIONAL',
    'Kategori': filterLabel,
    'Tamu / Event': `${items.length} Data`,
    'Sumber Dana': '',
    'Rekening': '',
    'Status Reimburse': '',
    'Catatan': '',
    'Nominal (Rp)': total,
  });

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Pengeluaran Pribadi');
  XLSX.writeFile(wb, `Pengeluaran_Pribadi_NonOpr_${getTodaySlug()}.xlsx`);
};
