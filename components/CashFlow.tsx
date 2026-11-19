import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import {
    type CashFlowProps,
    type PaymentMethod,
    type CashTransferRecord,
    type CashTransferType,
    type AccountBalanceMeta,
} from '../types';
import {
    ReceiptTaxIcon,
    ChartBarIcon,
    TrashIcon,
    ArrowDownTrayIcon,
    PrinterIcon,
    ArrowUpTrayIcon,
    ArrowPathIcon,
} from './Icons';
import { exportToExcel } from './reportUtils';
import { calculateGlobalFinancialRecap, getUtcDateStr, getUtcMonthDateRange } from './cashFlowUtils';
import Pagination from './Pagination';

const ITEMS_PER_PAGE = 20;

const formatCurrency = (value: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);

const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });

const ProminentStatCard: React.FC<{
    icon: React.ReactElement<{ className?: string }>;
    title: string;
    value: string;
    gradient: string;
}> = ({ icon, title, value, gradient }) => (
    <div className={`p-6 rounded-xl shadow-lg text-white ${gradient} transition-all duration-300 hover:shadow-xl hover:-translate-y-1`}>
        <div className="flex justify-between items-start">
            <div>
                <p className="text-lg font-medium text-white/90">{title}</p>
                <p className="text-3xl lg:text-4xl font-bold text-white mt-1">{value}</p>
            </div>
            <div className="p-3 rounded-full bg-black/20">
                {React.cloneElement(icon, { className: 'h-7 w-7 text-white' })}
            </div>
        </div>
    </div>
);

const CashTransferModal: React.FC<{
    show: boolean;
    onClose: () => void;
    paymentMethods: PaymentMethod[];
    onSave: (payload: Omit<CashTransferRecord, 'id' | 'timestamp' | 'createdBy'>) => Promise<void>;
}> = ({ show, onClose, paymentMethods, onSave }) => {
    const [transferType, setTransferType] = useState<CashTransferType>('Pindah Akun');
    const [date, setDate] = useState(getUtcDateStr());
    const [fromAccountId, setFromAccountId] = useState('');
    const [toAccountId, setToAccountId] = useState('');
    const [amount, setAmount] = useState('');
    const [adminFee, setAdminFee] = useState('0');
    const [notes, setNotes] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (show) {
            const qrisAcc = paymentMethods.find(m => m.type === 'QRIS');
            const bankAccs = paymentMethods.filter(m => m.type === 'Transfer Bank');
            const cashAcc = paymentMethods.find(m => m.type === 'Tunai');
            setTransferType('Pindah Akun');
            setDate(getUtcDateStr());
            setFromAccountId(qrisAcc?.id || cashAcc?.id || paymentMethods[0]?.id || '');
            setToAccountId(bankAccs[0]?.id || paymentMethods[1]?.id || paymentMethods[0]?.id || '');
            setAmount('');
            setAdminFee('0');
            setNotes('');
        }
    }, [show, paymentMethods]);

    if (!show) return null;

    const applyPreset = (preset: 'qrisToBank' | 'bankToBank' | 'bankToCash' | 'cashToBank') => {
        setTransferType('Pindah Akun');
        const qrisAcc = paymentMethods.find(m => m.type === 'QRIS');
        const bankAccs = paymentMethods.filter(m => m.type === 'Transfer Bank');
        const cashAcc = paymentMethods.find(m => m.type === 'Tunai');
        if (preset === 'qrisToBank') {
            if (qrisAcc) setFromAccountId(qrisAcc.id);
            if (bankAccs[0]) setToAccountId(bankAccs[0].id);
            setNotes('Pencairan QRIS ke Rekening Bank');
        } else if (preset === 'bankToBank') {
            if (bankAccs[0]) setFromAccountId(bankAccs[0].id);
            if (bankAccs[1]) setToAccountId(bankAccs[1].id);
            setNotes('Mutasi antar rekening bank');
        } else if (preset === 'bankToCash') {
            if (bankAccs[0]) setFromAccountId(bankAccs[0].id);
            if (cashAcc) setToAccountId(cashAcc.id);
            setNotes('Tarik tunai dari bank untuk kas laci');
        } else if (preset === 'cashToBank') {
            if (cashAcc) setFromAccountId(cashAcc.id);
            if (bankAccs[0]) setToAccountId(bankAccs[0].id);
            setNotes('Setor uang tunai laci ke bank');
        }
    };

    const numAmount = Number(amount) || 0;
    const numFee = transferType === 'Pindah Akun' ? Math.max(0, Number(adminFee) || 0) : 0;
    const netAmount = Math.max(0, numAmount - numFee);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (numAmount <= 0) {
            alert('Nominal mutasi harus lebih dari 0.');
            return;
        }
        if (transferType === 'Pindah Akun') {
            if (!fromAccountId || !toAccountId) {
                alert('Pilih akun asal dan akun tujuan.');
                return;
            }
            if (fromAccountId === toAccountId) {
                alert('Akun asal dan akun tujuan tidak boleh sama.');
                return;
            }
            if (numFee >= numAmount) {
                alert('Biaya admin/potongan harus lebih kecil dari nominal.');
                return;
            }
        } else if (transferType === 'Suntik Modal' && !toAccountId) {
            alert('Pilih akun tujuan yang menerima modal.');
            return;
        } else if (transferType === 'Tarik Owner' && !fromAccountId) {
            alert('Pilih akun sumber dana yang ditarik.');
            return;
        }

        const fromAcc = paymentMethods.find(m => m.id === fromAccountId);
        const toAcc = paymentMethods.find(m => m.id === toAccountId);

        setIsSaving(true);
        try {
            await onSave({
                date,
                transferType,
                fromAccountId: transferType !== 'Suntik Modal' ? fromAccountId : undefined,
                fromAccountName: transferType !== 'Suntik Modal' ? fromAcc?.name : undefined,
                toAccountId: transferType !== 'Tarik Owner' ? toAccountId : undefined,
                toAccountName: transferType !== 'Tarik Owner' ? toAcc?.name : undefined,
                amount: numAmount,
                adminFee: numFee > 0 ? numFee : undefined,
                netAmount: transferType === 'Pindah Akun' ? netAmount : numAmount,
                notes: notes.trim() || undefined,
            });
            onClose();
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center border-b pb-3 mb-4">
                    <h3 className="text-lg font-bold text-gray-800">Catat Mutasi / Pindah Dana Antar Akun</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">&times;</button>
                </div>

                <div className="mb-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-1.5">Template Cepat:</p>
                    <div className="flex flex-wrap gap-1.5">
                        <button type="button" onClick={() => applyPreset('qrisToBank')} className="px-2.5 py-1 text-xs rounded-md bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100 font-medium">Cairkan QRIS → Bank</button>
                        <button type="button" onClick={() => applyPreset('bankToBank')} className="px-2.5 py-1 text-xs rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 font-medium">Bank → Bank Lain</button>
                        <button type="button" onClick={() => applyPreset('cashToBank')} className="px-2.5 py-1 text-xs rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 font-medium">Setor Tunai → Bank</button>
                        <button type="button" onClick={() => applyPreset('bankToCash')} className="px-2.5 py-1 text-xs rounded-md bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 font-medium">Tarik Bank → Laci Tunai</button>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1">Jenis Mutasi</label>
                            <select value={transferType} onChange={e => setTransferType(e.target.value as CashTransferType)} className="w-full p-2 border rounded-lg text-sm bg-white">
                                <option value="Pindah Akun">Pindah Antar Akun Toko</option>
                                <option value="Suntik Modal">Suntik Modal / Tambah Saldo</option>
                                <option value="Tarik Owner">Tarik Dana Owner (Prive)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1">Tanggal</label>
                            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full p-2 border rounded-lg text-sm" required />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {transferType !== 'Suntik Modal' && (
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">Dari Akun / Metode</label>
                                <select value={fromAccountId} onChange={e => setFromAccountId(e.target.value)} className="w-full p-2 border rounded-lg text-sm bg-white" required>
                                    <option value="">-- Pilih Akun Asal --</option>
                                    {paymentMethods.map(m => (
                                        <option key={m.id} value={m.id}>{m.name} ({m.type})</option>
                                    ))}
                                </select>
                            </div>
                        )}
                        {transferType !== 'Tarik Owner' && (
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">Ke Akun / Metode</label>
                                <select value={toAccountId} onChange={e => setToAccountId(e.target.value)} className="w-full p-2 border rounded-lg text-sm bg-white" required>
                                    <option value="">-- Pilih Akun Tujuan --</option>
                                    {paymentMethods.map(m => (
                                        <option key={m.id} value={m.id}>{m.name} ({m.type})</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1">
                                {transferType === 'Pindah Akun' ? 'Nominal Keluar / Bruto (Rp)' : 'Nominal (Rp)'}
                            </label>
                            <input type="number" min="1" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Contoh: 1500000" className="w-full p-2 border rounded-lg text-sm font-semibold" required />
                        </div>
                        {transferType === 'Pindah Akun' && (
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">Potongan Admin / MDR QRIS (Rp)</label>
                                <input type="number" min="0" value={adminFee} onChange={e => setAdminFee(e.target.value)} placeholder="0" className="w-full p-2 border rounded-lg text-sm" />
                            </div>
                        )}
                    </div>

                    {transferType === 'Pindah Akun' && numAmount > 0 && (
                        <div className="bg-sky-50 border border-sky-200 rounded-lg p-3 text-xs text-sky-900 flex justify-between items-center">
                            <span>Dana bersih yang masuk ke akun tujuan:</span>
                            <span className="font-bold text-sm">{formatCurrency(netAmount)}</span>
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">Catatan (Opsional)</label>
                        <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Contoh: Settlement QRIS ke BCA / Pindah saldo BRI ke BCA" className="w-full p-2 border rounded-lg text-sm" />
                    </div>

                    <div className="flex justify-end gap-2 pt-2 border-t">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">Batal</button>
                        <button type="submit" disabled={isSaving} className="px-5 py-2 text-sm font-semibold bg-pink-600 text-white rounded-lg hover:bg-pink-700 disabled:bg-pink-300">
                            {isSaving ? 'Menyimpan...' : 'Simpan Mutasi'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const AccountReconcileModal: React.FC<{
    account: PaymentMethod | null;
    systemBalance: number;
    meta?: AccountBalanceMeta;
    todayStr: string;
    computeAccountNet: (methodId: string, startDate?: string, endDate?: string) => number;
    onClose: () => void;
    onSave: (methodId: string, meta: AccountBalanceMeta) => Promise<void>;
}> = ({ account, systemBalance, meta, todayStr, computeAccountNet, onClose, onSave }) => {
    const [openingBalance, setOpeningBalance] = useState('0');
    const [openingDate, setOpeningDate] = useState('');
    const [realBalance, setRealBalance] = useState('');
    const [notes, setNotes] = useState('');
    const [settledTodayMode, setSettledTodayMode] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (account) {
            setOpeningBalance((meta?.openingBalance ?? 0).toString());
            setOpeningDate(meta?.openingDate ?? '');
            setRealBalance(meta?.lastRealBalance !== undefined ? meta.lastRealBalance.toString() : '');
            setNotes(meta?.notes ?? '');
            setSettledTodayMode(false);
        }
    }, [account, meta]);

    if (!account) return null;

    const isCash = account.type === 'Tunai';
    const hasRealInput = realBalance.trim() !== '';
    const numReal = hasRealInput ? Number(realBalance) : 0;
    const numOpening = Number(openingBalance) || 0;

    const netOnToday = !isCash ? computeAccountNet(account.id, todayStr, todayStr) : 0;
    const isUnchangedOpening =
        numOpening === (meta?.openingBalance ?? 0) &&
        openingDate === (meta?.openingDate ?? '');

    const effectiveSettledOffset = isCash
        ? 0
        : settledTodayMode && openingDate === todayStr
            ? netOnToday
            : isUnchangedOpening
                ? (meta?.settledNetOnOpeningDate || 0)
                : 0;

    const projectedSystemBalance = isCash
        ? systemBalance
        : numOpening + computeAccountNet(account.id, openingDate || undefined, todayStr) - effectiveSettledOffset;

    const diff = numReal - projectedSystemBalance;

    const handleApplyResetNow = () => {
        const targetVal = hasRealInput ? realBalance : '0';
        if (!hasRealInput) setRealBalance('0');
        setOpeningBalance(targetVal);
        setOpeningDate(todayStr);
        setSettledTodayMode(true);
        if (!notes.trim()) {
            setNotes(`Reset saldo awal sesuai kondisi real per ${formatDate(todayStr)}`);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            await onSave(account.id, {
                openingBalance: isCash ? (meta?.openingBalance ?? 0) : numOpening,
                openingDate: isCash ? (meta?.openingDate ?? '') : openingDate,
                settledNetOnOpeningDate: isCash ? undefined : effectiveSettledOffset,
                lastRealBalance: hasRealInput ? numReal : undefined,
                lastRealCheckedAt: hasRealInput ? new Date().toISOString() : meta?.lastRealCheckedAt,
                notes: notes.trim() || undefined,
            });
            onClose();
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center border-b pb-3 mb-4">
                    <div>
                        <h3 className="text-lg font-bold text-gray-800">Cek Saldo Real &amp; Saldo Awal</h3>
                        <p className="text-xs text-gray-500">{account.name} ({account.type})</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">&times;</button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="bg-gray-50 border rounded-lg p-3 flex justify-between items-center">
                        <span className="text-xs font-medium text-gray-600">Saldo Sistem Saat Ini</span>
                        <span className="text-base font-bold text-gray-900">{formatCurrency(systemBalance)}</span>
                    </div>

                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label className="block text-xs font-semibold text-gray-700">Saldo Real di Mutasi Bank / Fisik (Rp)</label>
                            <button type="button" onClick={() => setRealBalance(systemBalance.toString())} className="text-[11px] text-pink-600 hover:underline font-medium">
                                Samakan dengan Sistem
                            </button>
                        </div>
                        <input type="number" value={realBalance} onChange={e => setRealBalance(e.target.value)} placeholder="Contoh: 0 atau saldo aktual di m-banking" className="w-full p-2 border rounded-lg text-sm font-semibold" />
                    </div>

                    {!isCash ? (
                        <div className="p-3 border rounded-lg bg-sky-50/50 space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-xs font-bold text-sky-900">Pengaturan Saldo Awal &amp; Cut-off</p>
                                <button
                                    type="button"
                                    onClick={handleApplyResetNow}
                                    className="px-2.5 py-1 text-[11px] font-semibold bg-sky-600 text-white rounded-md hover:bg-sky-700 shadow-sm"
                                >
                                    Reset ke Saldo Real Mulai Sekarang
                                </button>
                            </div>
                            <p className="text-[11px] text-sky-800">
                                Gunakan tombol <strong>Reset ke Saldo Real Mulai Sekarang</strong> jika saldo di kartu membengkak karena transaksi lama, agar sistem mulai menghitung ulang dari angka real saat ini (data riwayat lama tetap aman).
                            </p>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Saldo Awal Rekening / Dompet (Rp)</label>
                                <input
                                    type="number"
                                    value={openingBalance}
                                    onChange={e => {
                                        setOpeningBalance(e.target.value);
                                        setSettledTodayMode(false);
                                    }}
                                    className="w-full p-2 border rounded-md text-sm bg-white"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Mulai Hitung Transaksi Sejak Tanggal</label>
                                <input
                                    type="date"
                                    value={openingDate}
                                    onChange={e => {
                                        setOpeningDate(e.target.value);
                                        setSettledTodayMode(false);
                                    }}
                                    className="w-full p-2 border rounded-md text-sm bg-white"
                                />
                                {!openingDate && numOpening !== 0 ? (
                                    <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 mt-1.5">
                                        <strong>Perhatian:</strong> Tanggal cut-off masih kosong, sehingga Saldo Awal akan <strong>ditambahkan</strong> ke seluruh riwayat transaksi lama. Klik tombol <strong>Reset ke Saldo Real Mulai Sekarang</strong> di atas atau isi tanggal hari ini untuk memotong riwayat lama.
                                    </p>
                                ) : (
                                    <p className="text-[11px] text-gray-500 mt-1">
                                        {settledTodayMode && openingDate === todayStr
                                            ? 'Transaksi sebelum momen reset hari ini sudah diabaikan; transaksi baru setelah ini akan langsung menambah/mengurangi saldo.'
                                            : 'Kosongkan untuk menghitung seluruh riwayat transaksi, atau isi tanggal cut-off saat mulai mencatat saldo awal.'}
                                    </p>
                                )}
                            </div>
                            <div className="bg-white border border-sky-200 rounded-md px-3 py-2 flex justify-between items-center text-xs">
                                <span className="text-gray-600 font-medium">Preview Saldo Sistem Baru:</span>
                                <span className={`font-bold text-sm ${projectedSystemBalance >= 0 ? 'text-sky-700' : 'text-rose-600'}`}>
                                    {formatCurrency(projectedSystemBalance)}
                                </span>
                            </div>
                        </div>
                    ) : (
                        <div className="p-3 border rounded-lg bg-emerald-50/60 text-xs text-emerald-800">
                            Saldo awal &amp; setor kas <strong>Tunai (Laci)</strong> otomatis mengikuti pengaturan di halaman <strong>Pembayaran → Kas Akhir (Laci)</strong>. Di sini Anda dapat mencatat hasil hitung fisik uang laci (Saldo Real).
                        </div>
                    )}

                    {hasRealInput && (
                        <div className={`p-3 rounded-lg border text-xs flex justify-between items-center ${
                            diff === 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : diff > 0 ? 'bg-blue-50 border-blue-200 text-blue-800' : 'bg-rose-50 border-rose-200 text-rose-800'
                        }`}>
                            <span className="font-semibold">
                                {diff === 0 ? 'Status: Cocok (Klop)' : diff > 0 ? 'Status: Saldo Real Lebih' : 'Status: Saldo Real Kurang'}
                            </span>
                            <span className="font-bold text-sm">
                                {diff === 0 ? 'Rp 0' : `${diff > 0 ? '+' : ''}${formatCurrency(diff)}`}
                            </span>
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">Catatan Pemeriksaan</label>
                        <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Contoh: Cek mutasi BCA pagi / reset saldo awal" className="w-full p-2 border rounded-lg text-sm" />
                    </div>

                    <div className="flex justify-end gap-2 pt-2 border-t">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">Batal</button>
                        <button type="submit" disabled={isSaving} className="px-5 py-2 text-sm font-semibold bg-pink-600 text-white rounded-lg hover:bg-pink-700 disabled:bg-pink-300">
                            {isSaving ? 'Menyimpan...' : 'Simpan Rekonsiliasi'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

type CashFlowWallet = 'Kas Laci' | 'Bank / Non-Tunai' | 'Uang Pribadi Owner' | 'Data Lama';
type CashFlowActivity = 'Operasional' | 'Kewajiban' | 'Owner' | 'Mutasi';

interface CashFlowEntry {
    id: string;
    date: string;
    sortKey: string;
    type: 'Masuk' | 'Keluar' | 'Talangan Owner' | 'Mutasi';
    activity: CashFlowActivity;
    category: string;
    description: string;
    methodOrSource: string;
    wallet: CashFlowWallet;
    amount: number;
    adminFee?: number;
    netAmount?: number;
    accountId?: string;
    fromAccountId?: string;
    toAccountId?: string;
    transferId?: string;
    isSetor?: boolean;
    note?: string;
}

const CashFlow: React.FC<CashFlowProps> = ({
    receivables,
    expenses,
    expenseMetadata = {},
    supplierBills,
    bankInstallments,
    privateExpenses,
    paymentMethods = [],
    cashDrawerState,
    cashDrawerLogs = [],
    cashTransfers = [],
    accountBalancesMeta = {},
    legacyMonthlyIncomes,
    legacyMonthlyExpenses,
    onAddCashTransfer,
    onDeleteCashTransfer,
    onSaveAccountBalanceMeta,
}) => {
    const { firstDay, lastDay } = getUtcMonthDateRange();

    const [cashFlowStartDate, setCashFlowStartDate] = useState(firstDay);
    const [cashFlowEndDate, setCashFlowEndDate] = useState(lastDay);
    const [cashFlowWalletFilter, setCashFlowWalletFilter] = useState<string>('Semua');
    const [cashFlowActivityFilter, setCashFlowActivityFilter] = useState<'Semua' | 'Operasional' | 'Kewajiban' | 'Owner' | 'Mutasi'>('Semua');
    const [cashFlowSearch, setCashFlowSearch] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
    const [reconcileAccount, setReconcileAccount] = useState<PaymentMethod | null>(null);

    const effectivePaymentMethods = useMemo<PaymentMethod[]>(() => {
        return paymentMethods.length > 0
            ? paymentMethods
            : [{ id: 'cash-default', name: 'Tunai', type: 'Tunai', details: 'Pembayaran tunai di kasir' }];
    }, [paymentMethods]);

    const cashMethodIds = useMemo(
        () => new Set(effectivePaymentMethods.filter(m => m.type === 'Tunai').map(m => m.id)),
        [effectivePaymentMethods]
    );

    const primaryCashMethod = useMemo(
        () => effectivePaymentMethods.find(m => m.type === 'Tunai'),
        [effectivePaymentMethods]
    );

    useEffect(() => {
        setCurrentPage(1);
    }, [cashFlowStartDate, cashFlowEndDate, cashFlowWalletFilter, cashFlowActivityFilter, cashFlowSearch]);

    const applyCashFlowPreset = (preset: 'today' | '7days' | 'month' | 'year') => {
        const now = new Date();
        const todayStr = getUtcDateStr(now);
        if (preset === 'today') {
            setCashFlowStartDate(todayStr);
            setCashFlowEndDate(todayStr);
        } else if (preset === '7days') {
            const d = new Date(now);
            d.setUTCDate(d.getUTCDate() - 6);
            setCashFlowStartDate(getUtcDateStr(d));
            setCashFlowEndDate(todayStr);
        } else if (preset === 'month') {
            setCashFlowStartDate(firstDay);
            setCashFlowEndDate(lastDay);
        } else {
            const y = now.getUTCFullYear();
            setCashFlowStartDate(`${y}-01-01`);
            setCashFlowEndDate(`${y}-12-31`);
        }
    };

    const isCashMethod = useCallback((methodId?: string, methodName?: string): boolean => {
        if (methodId) {
            const found = effectivePaymentMethods.find(m => m.id === methodId);
            if (found) return found.type === 'Tunai';
        }
        if (methodName) {
            const foundByName = effectivePaymentMethods.find(m => m.name.toLowerCase() === methodName.toLowerCase());
            if (foundByName) return foundByName.type === 'Tunai';
            const lower = methodName.toLowerCase();
            return lower.includes('tunai') || lower.includes('cash');
        }
        return true;
    }, [effectivePaymentMethods]);

    const matchPaymentMethodId = useCallback((methodId?: string, methodName?: string): string | undefined => {
        if (methodId && effectivePaymentMethods.some(m => m.id === methodId)) {
            return methodId;
        }
        if (methodName) {
            const byName = effectivePaymentMethods.find(m => m.name.toLowerCase() === methodName.toLowerCase());
            if (byName) return byName.id;
        }
        if (isCashMethod(methodId, methodName) && primaryCashMethod) {
            return primaryCashMethod.id;
        }
        return undefined;
    }, [effectivePaymentMethods, isCashMethod, primaryCashMethod]);

    const globalFinancialRecap = useMemo(
        () =>
            calculateGlobalFinancialRecap({
                legacyMonthlyIncomes,
                legacyMonthlyExpenses,
                receivables,
                expenses,
                supplierBills,
                bankInstallments,
                privateExpenses,
                cashDrawerLogs,
                cashTransfers,
            }),
        [
            legacyMonthlyIncomes,
            legacyMonthlyExpenses,
            receivables,
            expenses,
            supplierBills,
            bankInstallments,
            privateExpenses,
            cashDrawerLogs,
            cashTransfers,
        ]
    );

    const allCashFlowEntries = useMemo<CashFlowEntry[]>(() => {
        const list: CashFlowEntry[] = [];

        // 0. Data Lama Bulanan (Pemasukan & Pengeluaran Historis)
        legacyMonthlyIncomes.forEach(item => {
            const amt = Number(item.amount || 0);
            if (!amt) return;
            const d = item.month_date || getUtcDateStr();
            list.push({
                id: `leg-in-${item.id}`,
                date: d,
                sortKey: `${d}-0-leg-in-${item.id}`,
                type: 'Masuk',
                activity: 'Operasional',
                category: 'Pemasukan Data Lama (Bulanan)',
                description: item.description || `Pemasukan Bulanan ${new Date(d).toLocaleString('id-ID', { month: 'long', year: 'numeric' })}`,
                methodOrSource: 'Data Lama (Bulanan)',
                wallet: 'Data Lama',
                amount: amt,
            });
        });

        legacyMonthlyExpenses.forEach(item => {
            const amt = Number(item.amount || 0);
            if (!amt) return;
            const d = item.month_date || getUtcDateStr();
            list.push({
                id: `leg-out-${item.id}`,
                date: d,
                sortKey: `${d}-0-leg-out-${item.id}`,
                type: 'Keluar',
                activity: 'Operasional',
                category: 'Pengeluaran Data Lama (Bulanan)',
                description: item.description || `Pengeluaran Bulanan ${new Date(d).toLocaleString('id-ID', { month: 'long', year: 'numeric' })}`,
                methodOrSource: 'Data Lama (Bulanan)',
                wallet: 'Data Lama',
                amount: amt,
            });
        });

        // 1. Pembayaran Masuk (Order / Piutang / Piutang Lama)
        receivables.forEach(r => {
            r.payments?.forEach((p, idx) => {
                if (!p.amount) return;
                const pDate = p.date || r.due || getUtcDateStr();
                const cash = isCashMethod(p.methodId, p.methodName);
                const matchedId = matchPaymentMethodId(p.methodId, p.methodName);
                list.push({
                    id: `pay-${r.id}-${idx}`,
                    date: pDate,
                    sortKey: `${pDate}-1-${r.id}-${idx}`,
                    type: 'Masuk',
                    activity: 'Operasional',
                    category: r.id.startsWith('Nota-') ? 'Pelunasan Piutang Lama' : 'Pembayaran Order / Piutang',
                    description: `${r.customer} (${r.id})`,
                    methodOrSource: p.methodName || 'Tunai',
                    wallet: cash ? 'Kas Laci' : 'Bank / Non-Tunai',
                    amount: p.amount,
                    accountId: matchedId,
                });
            });
        });

        // 2. Pengeluaran Operasional (+ Pembelian Barang Lunas)
        expenses.forEach(e => {
            const eDate = e.date || getUtcDateStr();
            const meta = expenseMetadata[e.id];
            const funding = meta?.fundingSource || 'Kas Laci';
            const accId = funding === 'Kas Laci' ? primaryCashMethod?.id : meta?.fundingAccountId;
            list.push({
                id: `exp-${e.id}`,
                date: eDate,
                sortKey: `${eDate}-2-${e.id}`,
                type: 'Keluar',
                activity: 'Operasional',
                category: meta?.purchaseId ? 'Pembelian Bahan (Lunas)' : e.category,
                description: e.name,
                methodOrSource: meta?.fundingAccountName ? `${funding} • ${meta.fundingAccountName}` : funding,
                wallet: funding === 'Kas Laci' ? 'Kas Laci' : 'Bank / Non-Tunai',
                amount: e.amount,
                accountId: accId,
                note: meta?.notes,
            });
        });

        // 3. Pembayaran Tagihan Pemasok
        supplierBills.forEach(bill => {
            bill.payments.forEach((p, idx) => {
                if (!p.amount || p.fundingSource === 'Sistem Lama (Sudah Tercatat)') return;
                const pDate = p.date || bill.date || getUtcDateStr();
                const isOwner = p.fundingSource === 'Dana Owner';
                const accId = p.fundingSource === 'Kas Laci'
                    ? primaryCashMethod?.id
                    : p.fundingSource === 'Transfer Bank'
                        ? p.fundingAccountId
                        : undefined;
                list.push({
                    id: `sup-${bill.id}-${idx}`,
                    date: pDate,
                    sortKey: `${pDate}-3-${bill.id}-${idx}`,
                    type: isOwner ? 'Talangan Owner' : 'Keluar',
                    activity: 'Kewajiban',
                    category: 'Tagihan Pemasok',
                    description: `${bill.supplierName} (${bill.invoiceNumber})`,
                    methodOrSource: p.fundingAccountName ? `${p.fundingSource} • ${p.fundingAccountName}` : p.fundingSource,
                    wallet: p.fundingSource === 'Kas Laci' ? 'Kas Laci' : p.fundingSource === 'Transfer Bank' ? 'Bank / Non-Tunai' : 'Uang Pribadi Owner',
                    amount: p.amount,
                    accountId: accId,
                    note: p.notes,
                });
            });
        });

        // 4. Pembayaran Cicilan Bank
        bankInstallments.forEach(inst => {
            inst.payments.forEach((p, idx) => {
                if (!p.totalPaid || p.fundingSource === 'Sistem Lama (Sudah Tercatat)') return;
                const pDate = p.date || getUtcDateStr();
                const isOwner = p.fundingSource === 'Dana Owner';
                const accId = p.fundingSource === 'Kas Laci'
                    ? primaryCashMethod?.id
                    : p.fundingSource === 'Transfer Bank'
                        ? p.fundingAccountId
                        : undefined;
                list.push({
                    id: `bank-${inst.id}-${idx}`,
                    date: pDate,
                    sortKey: `${pDate}-4-${inst.id}-${idx}`,
                    type: isOwner ? 'Talangan Owner' : 'Keluar',
                    activity: 'Kewajiban',
                    category: 'Cicilan Bank',
                    description: `${inst.name} (Pokok ${formatCurrency(p.principalPaid)}${p.interestPaid > 0 ? ` + Bunga ${formatCurrency(p.interestPaid)}` : ''})`,
                    methodOrSource: p.fundingAccountName ? `${p.fundingSource} • ${p.fundingAccountName}` : p.fundingSource,
                    wallet: p.fundingSource === 'Kas Laci' ? 'Kas Laci' : p.fundingSource === 'Transfer Bank' ? 'Bank / Non-Tunai' : 'Uang Pribadi Owner',
                    amount: p.totalPaid,
                    accountId: accId,
                    note: p.notes,
                });
            });
        });

        // 5. Pengeluaran Pribadi / Jamuan / Lain-lain
        privateExpenses.forEach(pe => {
            if (!pe.amount) return;
            const peDate = pe.date || getUtcDateStr();
            const isOwner = pe.fundingSource === 'Uang Pribadi Owner';
            const reimburseInfo = isOwner && pe.needsReimburse
                ? (pe.reimbursed ? 'Sudah Reimburse' : 'Belum Reimburse')
                : undefined;
            const accId = pe.fundingSource === 'Kas Laci'
                ? primaryCashMethod?.id
                : pe.fundingSource === 'Transfer Bank'
                    ? pe.fundingAccountId
                    : undefined;
            list.push({
                id: `priv-${pe.id}`,
                date: peDate,
                sortKey: `${peDate}-5-${pe.id}`,
                type: isOwner ? 'Talangan Owner' : 'Keluar',
                activity: 'Owner',
                category: pe.category || 'Pengeluaran Pribadi / Lain-lain',
                description: `${pe.name}${pe.guestOrEvent ? ` • ${pe.guestOrEvent}` : ''}`,
                methodOrSource: pe.fundingAccountName ? `${pe.fundingSource} • ${pe.fundingAccountName}` : pe.fundingSource,
                wallet: pe.fundingSource === 'Kas Laci' ? 'Kas Laci' : pe.fundingSource === 'Transfer Bank' ? 'Bank / Non-Tunai' : 'Uang Pribadi Owner',
                amount: pe.amount,
                accountId: accId,
                note: [reimburseInfo, pe.notes].filter(Boolean).join(' — ') || undefined,
            });
        });

        // 6. Setoran Kas Laci (ke Owner atau Rekening Bank Toko)
        cashDrawerLogs.forEach(log => {
            if (log.type !== 'Setor' || !log.depositAmount) return;
            const logDate = log.timestamp ? getUtcDateStr(new Date(log.timestamp)) : log.periodEndDate;
            const isToBank = !!log.depositToAccountId;
            list.push({
                id: `setor-${log.id}`,
                date: logDate,
                sortKey: `${logDate}-6-${log.timestamp || log.id}`,
                type: isToBank ? 'Mutasi' : 'Keluar',
                activity: 'Owner',
                category: isToBank ? 'Setor Kas Laci ke Rekening' : 'Setor Kas ke Owner',
                description: `Setor ke ${log.recipient || 'Owner'}${log.depositToAccountName ? ` (${log.depositToAccountName})` : ''}${log.operator ? ` • Op: ${log.operator}` : ''}`,
                methodOrSource: isToBank ? `Kas Laci → ${log.depositToAccountName || 'Bank'}` : 'Kas Laci → Owner',
                wallet: 'Kas Laci',
                amount: log.depositAmount,
                netAmount: log.depositAmount,
                fromAccountId: primaryCashMethod?.id,
                toAccountId: log.depositToAccountId,
                isSetor: true,
                note: log.notes || `Periode laci ${formatDate(log.periodStartDate)} – ${formatDate(log.periodEndDate)}`,
            });
        });

        // 7. Mutasi Antar Akun / Suntik Modal / Tarik Owner
        cashTransfers.forEach(t => {
            if (!t.amount) return;
            const tDate = t.date || getUtcDateStr();
            const fromIsCash = !!t.fromAccountId && cashMethodIds.has(t.fromAccountId);
            const toIsCash = !!t.toAccountId && cashMethodIds.has(t.toAccountId);
            if (t.transferType === 'Pindah Akun') {
                list.push({
                    id: `trf-${t.id}`,
                    transferId: t.id,
                    date: tDate,
                    sortKey: `${tDate}-7-${t.timestamp || t.id}`,
                    type: 'Mutasi',
                    activity: 'Mutasi',
                    category: 'Pindah Dana Antar Akun',
                    description: `${t.fromAccountName || '-'} → ${t.toAccountName || '-'}${t.adminFee ? ` (Potongan MDR/Admin ${formatCurrency(t.adminFee)})` : ''}`,
                    methodOrSource: `${t.fromAccountName || '-'} → ${t.toAccountName || '-'}`,
                    wallet: fromIsCash ? 'Kas Laci' : 'Bank / Non-Tunai',
                    amount: t.amount,
                    adminFee: t.adminFee,
                    netAmount: t.netAmount,
                    fromAccountId: t.fromAccountId,
                    toAccountId: t.toAccountId,
                    note: t.notes,
                });
            } else if (t.transferType === 'Suntik Modal') {
                list.push({
                    id: `trf-${t.id}`,
                    transferId: t.id,
                    date: tDate,
                    sortKey: `${tDate}-7-${t.timestamp || t.id}`,
                    type: 'Masuk',
                    activity: 'Mutasi',
                    category: 'Suntik Modal / Tambah Saldo',
                    description: `Tambah Saldo ke ${t.toAccountName || 'Kas'}`,
                    methodOrSource: `Owner → ${t.toAccountName || 'Kas'}`,
                    wallet: toIsCash ? 'Kas Laci' : 'Bank / Non-Tunai',
                    amount: t.netAmount ?? t.amount,
                    accountId: t.toAccountId,
                    note: t.notes,
                });
            } else {
                list.push({
                    id: `trf-${t.id}`,
                    transferId: t.id,
                    date: tDate,
                    sortKey: `${tDate}-7-${t.timestamp || t.id}`,
                    type: 'Keluar',
                    activity: 'Mutasi',
                    category: 'Tarik Dana Owner (Prive)',
                    description: `Penarikan Dana dari ${t.fromAccountName || 'Kas'}`,
                    methodOrSource: `${t.fromAccountName || 'Kas'} → Owner`,
                    wallet: fromIsCash ? 'Kas Laci' : 'Bank / Non-Tunai',
                    amount: t.amount,
                    accountId: t.fromAccountId,
                    note: t.notes,
                });
            }
        });

        return list;
    }, [
        legacyMonthlyIncomes,
        legacyMonthlyExpenses,
        receivables,
        expenses,
        expenseMetadata,
        supplierBills,
        bankInstallments,
        privateExpenses,
        cashDrawerLogs,
        cashTransfers,
        isCashMethod,
        matchPaymentMethodId,
        primaryCashMethod,
        cashMethodIds,
    ]);

    const cashFlowDateEntries = useMemo(() => {
        return allCashFlowEntries.filter(entry => {
            if (cashFlowStartDate && entry.date < cashFlowStartDate) return false;
            if (cashFlowEndDate && entry.date > cashFlowEndDate) return false;
            return true;
        });
    }, [allCashFlowEntries, cashFlowStartDate, cashFlowEndDate]);

    const cashFlowSummary = useMemo(() => {
        let inLaci = 0;
        let inBank = 0;
        let inDataLama = 0;
        let outLaciBelanja = 0;
        let outBankBelanja = 0;
        let outDataLama = 0;
        let totalSetorOwner = 0;
        let totalSetorBank = 0;
        let ownerAdvancePeriod = 0;
        let transferInLaci = 0;
        let transferOutLaci = 0;
        let transferInBank = 0;
        let transferOutBank = 0;
        let transferAdminFeePeriod = 0;

        cashFlowDateEntries.forEach(e => {
            if (e.type === 'Masuk') {
                if (e.wallet === 'Kas Laci') inLaci += e.amount;
                else if (e.wallet === 'Bank / Non-Tunai') inBank += e.amount;
                else if (e.wallet === 'Data Lama') inDataLama += e.amount;
            } else if (e.type === 'Keluar') {
                if (e.isSetor) {
                    totalSetorOwner += e.amount;
                } else if (e.wallet === 'Kas Laci') {
                    outLaciBelanja += e.amount;
                } else if (e.wallet === 'Bank / Non-Tunai') {
                    outBankBelanja += e.amount;
                } else if (e.wallet === 'Data Lama') {
                    outDataLama += e.amount;
                }
            } else if (e.type === 'Mutasi') {
                if (e.isSetor) totalSetorBank += e.amount;
                transferAdminFeePeriod += e.adminFee || 0;
                const fromIsCash = !!e.fromAccountId && cashMethodIds.has(e.fromAccountId);
                const toIsCash = !!e.toAccountId && cashMethodIds.has(e.toAccountId);
                const incoming = e.netAmount ?? e.amount;
                if (e.fromAccountId) {
                    if (fromIsCash) transferOutLaci += e.amount;
                    else transferOutBank += e.amount;
                }
                if (e.toAccountId) {
                    if (toIsCash) transferInLaci += incoming;
                    else transferInBank += incoming;
                }
            } else if (e.type === 'Talangan Owner') {
                ownerAdvancePeriod += e.amount;
            }
        });

        const totalIn = inLaci + inBank + inDataLama;
        const totalOutBelanja = outLaciBelanja + outBankBelanja + outDataLama + transferAdminFeePeriod;
        const netBusinessCashFlow = totalIn - totalOutBelanja;
        const netLaciPeriod = inLaci - outLaciBelanja - totalSetorOwner + transferInLaci - transferOutLaci;
        const netBankPeriod = inBank - outBankBelanja + transferInBank - transferOutBank;

        const unreimbursedOwnerTotal = privateExpenses
            .filter(pe => pe.fundingSource === 'Uang Pribadi Owner' && pe.needsReimburse && !pe.reimbursed)
            .reduce((s, pe) => s + pe.amount, 0);

        return {
            inLaci,
            inBank,
            inDataLama,
            totalIn,
            outLaciBelanja,
            outBankBelanja,
            outDataLama,
            transferAdminFeePeriod,
            totalOutBelanja,
            totalSetorOwner,
            totalSetorBank,
            netBusinessCashFlow,
            netLaciPeriod,
            netBankPeriod,
            transferNetLaci: transferInLaci - transferOutLaci,
            transferNetBank: transferInBank - transferOutBank,
            ownerAdvancePeriod,
            unreimbursedOwnerTotal,
        };
    }, [cashFlowDateEntries, privateExpenses, cashMethodIds]);

    const activeCashDrawerBalance = useMemo(() => {
        const todayLocal = getUtcDateStr();
        const startDate = cashDrawerState?.periodStartDate || todayLocal;
        let rawCashIn = 0;
        receivables.forEach(r => {
            r.payments?.forEach(p => {
                if (p.date >= startDate && p.date <= todayLocal && isCashMethod(p.methodId, p.methodName)) {
                    rawCashIn += p.amount;
                }
            });
        });

        let rawCashOut = 0;
        expenses.forEach(e => {
            const funding = expenseMetadata[e.id]?.fundingSource || 'Kas Laci';
            if (funding === 'Kas Laci' && e.date >= startDate && e.date <= todayLocal) rawCashOut += e.amount;
        });
        supplierBills.forEach(b => b.payments.forEach(p => {
            if (p.fundingSource === 'Kas Laci' && p.date >= startDate && p.date <= todayLocal) rawCashOut += p.amount;
        }));
        bankInstallments.forEach(i => i.payments.forEach(p => {
            if (p.fundingSource === 'Kas Laci' && p.date >= startDate && p.date <= todayLocal) rawCashOut += p.totalPaid;
        }));
        privateExpenses.forEach(pe => {
            if (pe.fundingSource === 'Kas Laci' && pe.date >= startDate && pe.date <= todayLocal) rawCashOut += pe.amount;
        });

        let rawTransferIn = 0;
        let rawTransferOut = 0;
        cashTransfers.forEach(t => {
            const toIsCash = !!t.toAccountId && cashMethodIds.has(t.toAccountId);
            const fromIsCash = !!t.fromAccountId && cashMethodIds.has(t.fromAccountId);
            if (t.date >= startDate && t.date <= todayLocal) {
                if (toIsCash) rawTransferIn += t.netAmount;
                if (fromIsCash) rawTransferOut += t.amount;
            }
        });

        const cashIn = Math.max(0, rawCashIn - (cashDrawerState?.settledCashInOnStartDate || 0));
        const cashOut = Math.max(0, rawCashOut - (cashDrawerState?.settledCashOutOnStartDate || 0));
        const transferIn = Math.max(0, rawTransferIn - (cashDrawerState?.settledCashTransferInOnStartDate || 0));
        const transferOut = Math.max(0, rawTransferOut - (cashDrawerState?.settledCashTransferOutOnStartDate || 0));
        return (cashDrawerState?.openingCash || 0) + cashIn - cashOut + transferIn - transferOut;
    }, [cashDrawerState, receivables, expenses, expenseMetadata, supplierBills, bankInstallments, privateExpenses, cashTransfers, cashMethodIds, isCashMethod]);

    const { accountBalancesSummary, unallocatedBankOutflowsGlobal, unallocatedBankOutflowsPeriod } = useMemo(() => {
        const todayLocal = getUtcDateStr();
        const statsMap = new Map<string, {
            method: PaymentMethod;
            meta?: AccountBalanceMeta;
            systemBalance: number;
            periodIn: number;
            periodOut: number;
            periodTransferIn: number;
            periodTransferOut: number;
            periodNet: number;
            discrepancy: number | null;
        }>();

        effectivePaymentMethods.forEach(m => {
            statsMap.set(m.id, {
                method: m,
                meta: accountBalancesMeta[m.id],
                systemBalance: m.type === 'Tunai' ? 0 : (accountBalancesMeta[m.id]?.openingBalance || 0),
                periodIn: 0,
                periodOut: 0,
                periodTransferIn: 0,
                periodTransferOut: 0,
                periodNet: 0,
                discrepancy: null,
            });
        });

        let unallocatedGlobal = 0;
        let unallocatedPeriod = 0;

        const isAfterCutoff = (methodId: string, date: string) => {
            const cutoff = accountBalancesMeta[methodId]?.openingDate;
            return !cutoff || date >= cutoff;
        };

        const isInPeriod = (date: string) => {
            if (cashFlowStartDate && date < cashFlowStartDate) return false;
            if (cashFlowEndDate && date > cashFlowEndDate) return false;
            return true;
        };

        receivables.forEach(r => {
            r.payments?.forEach(p => {
                if (!p.date || !p.amount) return;
                const matchedId = matchPaymentMethodId(p.methodId, p.methodName);
                if (!matchedId) return;
                const stat = statsMap.get(matchedId);
                if (!stat) return;
                if (stat.method.type !== 'Tunai' && p.date <= todayLocal && isAfterCutoff(matchedId, p.date)) {
                    stat.systemBalance += p.amount;
                }
                if (isInPeriod(p.date)) {
                    stat.periodIn += p.amount;
                }
            });
        });

        expenses.forEach(e => {
            if (!e.date || !e.amount) return;
            const meta = expenseMetadata[e.id];
            const funding = meta?.fundingSource || 'Kas Laci';
            if (funding === 'Kas Laci') {
                const cashStat = primaryCashMethod ? statsMap.get(primaryCashMethod.id) : undefined;
                if (cashStat && isInPeriod(e.date)) cashStat.periodOut += e.amount;
            } else if (funding === 'Transfer Bank') {
                if (meta?.fundingAccountId && statsMap.has(meta.fundingAccountId)) {
                    const stat = statsMap.get(meta.fundingAccountId)!;
                    if (e.date <= todayLocal && isAfterCutoff(meta.fundingAccountId, e.date)) {
                        stat.systemBalance -= e.amount;
                    }
                    if (isInPeriod(e.date)) stat.periodOut += e.amount;
                } else {
                    if (e.date <= todayLocal) unallocatedGlobal += e.amount;
                    if (isInPeriod(e.date)) unallocatedPeriod += e.amount;
                }
            }
        });

        supplierBills.forEach(bill => {
            bill.payments.forEach(p => {
                if (!p.date || !p.amount || (p.fundingSource !== 'Kas Laci' && p.fundingSource !== 'Transfer Bank')) return;
                if (p.fundingSource === 'Kas Laci') {
                    const cashStat = primaryCashMethod ? statsMap.get(primaryCashMethod.id) : undefined;
                    if (cashStat && isInPeriod(p.date)) cashStat.periodOut += p.amount;
                } else if (p.fundingSource === 'Transfer Bank') {
                    if (p.fundingAccountId && statsMap.has(p.fundingAccountId)) {
                        const stat = statsMap.get(p.fundingAccountId)!;
                        if (p.date <= todayLocal && isAfterCutoff(p.fundingAccountId, p.date)) {
                            stat.systemBalance -= p.amount;
                        }
                        if (isInPeriod(p.date)) stat.periodOut += p.amount;
                    } else {
                        if (p.date <= todayLocal) unallocatedGlobal += p.amount;
                        if (isInPeriod(p.date)) unallocatedPeriod += p.amount;
                    }
                }
            });
        });

        bankInstallments.forEach(inst => {
            inst.payments.forEach(p => {
                if (!p.date || !p.totalPaid || (p.fundingSource !== 'Kas Laci' && p.fundingSource !== 'Transfer Bank')) return;
                if (p.fundingSource === 'Kas Laci') {
                    const cashStat = primaryCashMethod ? statsMap.get(primaryCashMethod.id) : undefined;
                    if (cashStat && isInPeriod(p.date)) cashStat.periodOut += p.totalPaid;
                } else if (p.fundingSource === 'Transfer Bank') {
                    if (p.fundingAccountId && statsMap.has(p.fundingAccountId)) {
                        const stat = statsMap.get(p.fundingAccountId)!;
                        if (p.date <= todayLocal && isAfterCutoff(p.fundingAccountId, p.date)) {
                            stat.systemBalance -= p.totalPaid;
                        }
                        if (isInPeriod(p.date)) stat.periodOut += p.totalPaid;
                    } else {
                        if (p.date <= todayLocal) unallocatedGlobal += p.totalPaid;
                        if (isInPeriod(p.date)) unallocatedPeriod += p.totalPaid;
                    }
                }
            });
        });

        privateExpenses.forEach(pe => {
            if (!pe.date || !pe.amount || pe.fundingSource === 'Uang Pribadi Owner') return;
            if (pe.fundingSource === 'Kas Laci') {
                const cashStat = primaryCashMethod ? statsMap.get(primaryCashMethod.id) : undefined;
                if (cashStat && isInPeriod(pe.date)) cashStat.periodOut += pe.amount;
            } else if (pe.fundingSource === 'Transfer Bank') {
                if (pe.fundingAccountId && statsMap.has(pe.fundingAccountId)) {
                    const stat = statsMap.get(pe.fundingAccountId)!;
                    if (pe.date <= todayLocal && isAfterCutoff(pe.fundingAccountId, pe.date)) {
                        stat.systemBalance -= pe.amount;
                    }
                    if (isInPeriod(pe.date)) stat.periodOut += pe.amount;
                } else {
                    if (pe.date <= todayLocal) unallocatedGlobal += pe.amount;
                    if (isInPeriod(pe.date)) unallocatedPeriod += pe.amount;
                }
            }
        });

        cashDrawerLogs.forEach(log => {
            if (log.type !== 'Setor' || !log.depositAmount) return;
            const logDate = log.timestamp ? getUtcDateStr(new Date(log.timestamp)) : log.periodEndDate;
            const cashStat = primaryCashMethod ? statsMap.get(primaryCashMethod.id) : undefined;
            if (cashStat && isInPeriod(logDate)) {
                if (log.depositToAccountId) cashStat.periodTransferOut += log.depositAmount;
                else cashStat.periodOut += log.depositAmount;
            }
            if (log.depositToAccountId && statsMap.has(log.depositToAccountId)) {
                const dest = statsMap.get(log.depositToAccountId)!;
                if (logDate <= todayLocal && isAfterCutoff(log.depositToAccountId, logDate)) {
                    dest.systemBalance += log.depositAmount;
                }
                if (isInPeriod(logDate)) dest.periodTransferIn += log.depositAmount;
            }
        });

        cashTransfers.forEach(t => {
            if (!t.date || !t.amount) return;
            if (t.fromAccountId && statsMap.has(t.fromAccountId)) {
                const fromStat = statsMap.get(t.fromAccountId)!;
                if (fromStat.method.type !== 'Tunai' && t.date <= todayLocal && isAfterCutoff(t.fromAccountId, t.date)) {
                    fromStat.systemBalance -= t.amount;
                }
                if (isInPeriod(t.date)) {
                    if (t.transferType === 'Tarik Owner') fromStat.periodOut += t.amount;
                    else fromStat.periodTransferOut += t.amount;
                }
            }
            if (t.toAccountId && statsMap.has(t.toAccountId)) {
                const toStat = statsMap.get(t.toAccountId)!;
                if (toStat.method.type !== 'Tunai' && t.date <= todayLocal && isAfterCutoff(t.toAccountId, t.date)) {
                    toStat.systemBalance += t.netAmount;
                }
                if (isInPeriod(t.date)) {
                    if (t.transferType === 'Suntik Modal') toStat.periodIn += t.netAmount;
                    else toStat.periodTransferIn += t.netAmount;
                }
            }
        });

        const summaryList = Array.from(statsMap.values()).map(stat => {
            if (stat.method.type === 'Tunai' && stat.method.id === primaryCashMethod?.id) {
                stat.systemBalance = activeCashDrawerBalance;
            } else if (stat.method.type !== 'Tunai' && stat.meta?.settledNetOnOpeningDate) {
                stat.systemBalance -= stat.meta.settledNetOnOpeningDate;
            }
            stat.periodNet = stat.periodIn - stat.periodOut + stat.periodTransferIn - stat.periodTransferOut;
            if (stat.meta?.lastRealBalance !== undefined) {
                stat.discrepancy = stat.meta.lastRealBalance - stat.systemBalance;
            }
            return stat;
        });

        return {
            accountBalancesSummary: summaryList,
            unallocatedBankOutflowsGlobal: unallocatedGlobal,
            unallocatedBankOutflowsPeriod: unallocatedPeriod,
        };
    }, [
        effectivePaymentMethods,
        accountBalancesMeta,
        receivables,
        expenses,
        expenseMetadata,
        supplierBills,
        bankInstallments,
        privateExpenses,
        cashDrawerLogs,
        cashTransfers,
        matchPaymentMethodId,
        primaryCashMethod,
        activeCashDrawerBalance,
        cashFlowStartDate,
        cashFlowEndDate,
    ]);

    const computeNonCashAccountNet = useCallback((methodId: string, startDate?: string, endDate?: string): number => {
        const todayLimit = endDate || getUtcDateStr();
        const inRange = (d?: string) => {
            if (!d) return false;
            if (startDate && d < startDate) return false;
            if (d > todayLimit) return false;
            return true;
        };
        let net = 0;

        receivables.forEach(r => {
            r.payments?.forEach(p => {
                if (!p.amount || !inRange(p.date)) return;
                if (matchPaymentMethodId(p.methodId, p.methodName) === methodId) {
                    net += p.amount;
                }
            });
        });

        expenses.forEach(e => {
            if (!e.amount || !inRange(e.date)) return;
            const meta = expenseMetadata[e.id];
            if (meta?.fundingSource === 'Transfer Bank' && meta.fundingAccountId === methodId) {
                net -= e.amount;
            }
        });

        supplierBills.forEach(bill => {
            bill.payments.forEach(p => {
                if (!p.amount || !inRange(p.date)) return;
                if (p.fundingSource === 'Transfer Bank' && p.fundingAccountId === methodId) {
                    net -= p.amount;
                }
            });
        });

        bankInstallments.forEach(inst => {
            inst.payments.forEach(p => {
                if (!p.totalPaid || !inRange(p.date)) return;
                if (p.fundingSource === 'Transfer Bank' && p.fundingAccountId === methodId) {
                    net -= p.totalPaid;
                }
            });
        });

        privateExpenses.forEach(pe => {
            if (!pe.amount || !inRange(pe.date)) return;
            if (pe.fundingSource === 'Transfer Bank' && pe.fundingAccountId === methodId) {
                net -= pe.amount;
            }
        });

        cashDrawerLogs.forEach(log => {
            if (log.type !== 'Setor' || !log.depositAmount || log.depositToAccountId !== methodId) return;
            const logDate = log.timestamp ? getUtcDateStr(new Date(log.timestamp)) : log.periodEndDate;
            if (inRange(logDate)) net += log.depositAmount;
        });

        cashTransfers.forEach(t => {
            if (!t.amount || !inRange(t.date)) return;
            if (t.fromAccountId === methodId) net -= t.amount;
            if (t.toAccountId === methodId) net += t.netAmount;
        });

        return net;
    }, [receivables, expenses, expenseMetadata, supplierBills, bankInstallments, privateExpenses, cashDrawerLogs, cashTransfers, matchPaymentMethodId]);

    const selectedAccountFilterId = cashFlowWalletFilter.startsWith('account:')
        ? cashFlowWalletFilter.slice('account:'.length)
        : null;

    const getEntryDeltaForFilter = useCallback((entry: CashFlowEntry, filter: string): { inAmt: number; outAmt: number; netDelta: number } => {
        if (filter.startsWith('account:')) {
            const targetId = filter.slice('account:'.length);
            if (entry.type === 'Mutasi') {
                if (entry.fromAccountId === targetId) {
                    return { inAmt: 0, outAmt: entry.amount, netDelta: -entry.amount };
                }
                if (entry.toAccountId === targetId) {
                    const inc = entry.netAmount ?? entry.amount;
                    return { inAmt: inc, outAmt: 0, netDelta: inc };
                }
                return { inAmt: 0, outAmt: 0, netDelta: 0 };
            }
            if (entry.type === 'Masuk') return { inAmt: entry.amount, outAmt: 0, netDelta: entry.amount };
            if (entry.type === 'Keluar') return { inAmt: 0, outAmt: entry.amount, netDelta: -entry.amount };
            return { inAmt: 0, outAmt: 0, netDelta: 0 };
        }

        if (filter === 'Kas Laci') {
            if (entry.type === 'Mutasi') {
                const fromIsCash = !!entry.fromAccountId && cashMethodIds.has(entry.fromAccountId);
                const toIsCash = !!entry.toAccountId && cashMethodIds.has(entry.toAccountId);
                if (fromIsCash && !toIsCash) return { inAmt: 0, outAmt: entry.amount, netDelta: -entry.amount };
                if (toIsCash && !fromIsCash) {
                    const inc = entry.netAmount ?? entry.amount;
                    return { inAmt: inc, outAmt: 0, netDelta: inc };
                }
                const fee = entry.adminFee || 0;
                return { inAmt: 0, outAmt: fee, netDelta: -fee };
            }
            if (entry.type === 'Masuk') return { inAmt: entry.amount, outAmt: 0, netDelta: entry.amount };
            if (entry.type === 'Keluar') return { inAmt: 0, outAmt: entry.amount, netDelta: -entry.amount };
            return { inAmt: 0, outAmt: 0, netDelta: 0 };
        }

        if (filter === 'Bank / Non-Tunai') {
            if (entry.type === 'Mutasi') {
                const fromIsBank = !!entry.fromAccountId && !cashMethodIds.has(entry.fromAccountId);
                const toIsBank = !!entry.toAccountId && !cashMethodIds.has(entry.toAccountId);
                if (fromIsBank && !toIsBank) return { inAmt: 0, outAmt: entry.amount, netDelta: -entry.amount };
                if (toIsBank && !fromIsBank) {
                    const inc = entry.netAmount ?? entry.amount;
                    return { inAmt: inc, outAmt: 0, netDelta: inc };
                }
                const fee = entry.adminFee || 0;
                return { inAmt: 0, outAmt: fee, netDelta: -fee };
            }
            if (entry.type === 'Masuk') return { inAmt: entry.amount, outAmt: 0, netDelta: entry.amount };
            if (entry.type === 'Keluar') return { inAmt: 0, outAmt: entry.amount, netDelta: -entry.amount };
            return { inAmt: 0, outAmt: 0, netDelta: 0 };
        }

        if (filter === 'Uang Pribadi Owner') {
            if (entry.type === 'Talangan Owner') return { inAmt: 0, outAmt: entry.amount, netDelta: entry.amount };
            return { inAmt: 0, outAmt: 0, netDelta: 0 };
        }

        if (entry.type === 'Masuk') return { inAmt: entry.amount, outAmt: 0, netDelta: entry.amount };
        if (entry.type === 'Keluar') return { inAmt: 0, outAmt: entry.amount, netDelta: -entry.amount };
        if (entry.type === 'Mutasi') {
            const fee = entry.adminFee || 0;
            return { inAmt: 0, outAmt: fee, netDelta: -fee };
        }
        return { inAmt: 0, outAmt: 0, netDelta: 0 };
    }, [cashMethodIds]);

    const cashFlowCumulativeBridge = useMemo(() => {
        let openingBeforePeriod = 0;
        let periodNet = 0;

        allCashFlowEntries.forEach(entry => {
            const delta = getEntryDeltaForFilter(entry, 'Semua').netDelta;
            if (cashFlowStartDate && entry.date < cashFlowStartDate) {
                openingBeforePeriod += delta;
            } else if (!cashFlowEndDate || entry.date <= cashFlowEndDate) {
                periodNet += delta;
            }
        });

        const endingAtPeriodEnd = openingBeforePeriod + periodNet;
        return {
            openingBeforePeriod,
            periodNet,
            endingAtPeriodEnd,
            endingGlobalToday: globalFinancialRecap.netEstimatedEndingCash,
        };
    }, [allCashFlowEntries, getEntryDeltaForFilter, cashFlowStartDate, cashFlowEndDate, globalFinancialRecap.netEstimatedEndingCash]);

    const filteredCashFlowEntries = useMemo(() => {
        const q = cashFlowSearch.trim().toLowerCase();
        return cashFlowDateEntries.filter(entry => {
            if (cashFlowWalletFilter !== 'Semua') {
                if (cashFlowWalletFilter.startsWith('account:')) {
                    const targetId = cashFlowWalletFilter.slice('account:'.length);
                    if (entry.accountId !== targetId && entry.fromAccountId !== targetId && entry.toAccountId !== targetId) {
                        return false;
                    }
                } else if (cashFlowWalletFilter === 'Kas Laci') {
                    const fromIsCash = !!entry.fromAccountId && cashMethodIds.has(entry.fromAccountId);
                    const toIsCash = !!entry.toAccountId && cashMethodIds.has(entry.toAccountId);
                    if (entry.wallet !== 'Kas Laci' && !fromIsCash && !toIsCash) return false;
                } else if (cashFlowWalletFilter === 'Bank / Non-Tunai') {
                    const fromIsBank = !!entry.fromAccountId && !cashMethodIds.has(entry.fromAccountId);
                    const toIsBank = !!entry.toAccountId && !cashMethodIds.has(entry.toAccountId);
                    if (entry.wallet !== 'Bank / Non-Tunai' && !fromIsBank && !toIsBank) return false;
                } else if (entry.wallet !== cashFlowWalletFilter) {
                    return false;
                }
            }
            if (cashFlowActivityFilter !== 'Semua' && entry.activity !== cashFlowActivityFilter) return false;
            if (q && !entry.description.toLowerCase().includes(q) && !entry.category.toLowerCase().includes(q) && !entry.methodOrSource.toLowerCase().includes(q) && !(entry.note || '').toLowerCase().includes(q)) {
                return false;
            }
            return true;
        });
    }, [cashFlowDateEntries, cashFlowWalletFilter, cashFlowActivityFilter, cashFlowSearch, cashMethodIds]);

    const cashFlowLedgerDesc = useMemo(() => {
        const asc = [...filteredCashFlowEntries].sort((a, b) => a.sortKey.localeCompare(b.sortKey));
        let running = 0;
        const withRunning = asc.map(item => {
            const delta = getEntryDeltaForFilter(item, cashFlowWalletFilter);
            running += delta.netDelta;
            return { ...item, displayIn: delta.inAmt, displayOut: delta.outAmt, runningBalance: running };
        });
        return withRunning.reverse();
    }, [filteredCashFlowEntries, cashFlowWalletFilter, getEntryDeltaForFilter]);

    const paginatedCashFlow = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return cashFlowLedgerDesc.slice(start, start + ITEMS_PER_PAGE);
    }, [cashFlowLedgerDesc, currentPage]);

    const cashFlowChartData = useMemo(() => {
        if (!cashFlowStartDate || !cashFlowEndDate) return [];
        const diffDays = Math.ceil((new Date(cashFlowEndDate).getTime() - new Date(cashFlowStartDate).getTime()) / (1000 * 60 * 60 * 24)) + 1;
        const useDaily = diffDays <= 45;
        const map = new Map<string, { name: string; 'Kas Masuk': number; 'Kas Keluar': number; 'Setor Owner': number }>();

        filteredCashFlowEntries.forEach(entry => {
            const key = useDaily ? entry.date : entry.date.substring(0, 7);
            const label = useDaily
                ? entry.date.substring(8, 10) + '/' + entry.date.substring(5, 7)
                : new Date(key + '-02').toLocaleDateString('id-ID', { month: 'short', year: '2-digit' });
            if (!map.has(key)) {
                map.set(key, { name: label, 'Kas Masuk': 0, 'Kas Keluar': 0, 'Setor Owner': 0 });
            }
            const bucket = map.get(key)!;
            const delta = getEntryDeltaForFilter(entry, cashFlowWalletFilter);
            if (entry.isSetor) {
                bucket['Setor Owner'] += entry.amount;
            } else {
                bucket['Kas Masuk'] += delta.inAmt;
                bucket['Kas Keluar'] += delta.outAmt;
            }
        });

        return Array.from(map.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([, val]) => val);
    }, [filteredCashFlowEntries, cashFlowStartDate, cashFlowEndDate, cashFlowWalletFilter, getEntryDeltaForFilter]);

    const handleExport = () => {
        const dateRange = { startDate: cashFlowStartDate, endDate: cashFlowEndDate };
        const cashFlowRows = cashFlowLedgerDesc.map(row => ({
            'Tanggal': formatDate(row.date),
            'Aktivitas': row.activity,
            'Jenis': row.type,
            'Kategori': row.category,
            'Keterangan': row.description,
            'Sumber / Kantong Dana': row.wallet,
            'Metode / Rute': row.methodOrSource,
            'Masuk (Rp)': row.displayIn,
            'Keluar (Rp)': row.displayOut,
            'Talangan Owner (Rp)': row.type === 'Talangan Owner' ? row.amount : 0,
            'Akumulasi Periode (Rp)': row.runningBalance,
            'Catatan': row.note || '',
        }));
        exportToExcel('cashFlow', cashFlowRows, dateRange);
    };

    const handlePrint = () => {
        const selectedAccountName = selectedAccountFilterId
            ? effectivePaymentMethods.find(m => m.id === selectedAccountFilterId)?.name || cashFlowWalletFilter
            : cashFlowWalletFilter;

        const period = `Periode: ${cashFlowStartDate ? formatDate(cashFlowStartDate) : '...'} - ${cashFlowEndDate ? formatDate(cashFlowEndDate) : '...'} (${selectedAccountName})`;

        const rowsHtml = cashFlowLedgerDesc.map(row => `
            <tr>
                <td>${formatDate(row.date)}</td>
                <td>${row.activity}</td>
                <td>${row.category}</td>
                <td>${row.description}${row.note ? `<br><small style="color:#666">${row.note}</small>` : ''}</td>
                <td>${row.wallet} (${row.methodOrSource})</td>
                <td class="currency" style="color:#047857">${row.displayIn > 0 ? formatCurrency(row.displayIn) : '-'}</td>
                <td class="currency" style="color:#be123c">${row.displayOut > 0 ? formatCurrency(row.displayOut) : (row.type === 'Mutasi' ? 'Mutasi ' + formatCurrency(row.amount) : '-')}</td>
                <td class="currency"><strong>${formatCurrency(row.runningBalance)}</strong></td>
            </tr>
        `).join('');

        const accountCardsHtml = accountBalancesSummary.map(s => `
            <tr>
                <td>${s.method.name} (${s.method.type})</td>
                <td class="currency">${formatCurrency(s.systemBalance)}</td>
                <td class="currency">${s.meta?.lastRealBalance !== undefined ? formatCurrency(s.meta.lastRealBalance) : '-'}</td>
                <td class="currency">${s.discrepancy !== null ? formatCurrency(s.discrepancy) : '-'}</td>
            </tr>
        `).join('');

        const printContent = `
            <html>
                <head>
                    <title>Laporan Arus Kas</title>
                    <style>
                        body { font-family: Arial, sans-serif; font-size: 10pt; color: #333; }
                        .page { width: 190mm; min-height: 270mm; padding: 10mm; margin: 5mm auto; background: white; }
                        .header, .customer-info { display: flex; justify-content: space-between; align-items: flex-start; }
                        .header h1 { font-size: 16pt; margin: 0; } .header h2 { font-size: 12pt; margin: 0; color: #555; }
                        hr { border: 0; border-top: 1px solid #ccc; margin: 8px 0; }
                        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                        th, td { border: 1px solid #ddd; padding: 6px; text-align: left; font-size: 9pt; }
                        th, tfoot th { background-color: #f2f2f2; }
                        .currency { text-align: right; }
                        .summary-box { text-align: right; margin-top: 10px; padding-top: 10px; border-top: 1px solid #ccc; }
                        .print-button-container { position: fixed; top: 20px; right: 20px; text-align: center; z-index: 100; }
                        .print-button-container button { background-color: #ec4899; color: white; font-weight: bold; padding: 8px 24px; border-radius: 8px; border: none; cursor: pointer; box-shadow: 0 2px 5px rgba(0,0,0,0.2); }
                        @media print {
                            .page { margin: 0; border: initial; width: initial; min-height: initial; box-shadow: initial; background: initial; }
                            .print-button-container { display: none; }
                        }
                    </style>
                </head>
                <body>
                    <div class="page">
                        <div class="header">
                            <div>
                                <h2>Nala Media Digital Printing</h2>
                                <p style="font-size:8pt; margin:0;">Jl. Prof. Moh. Yamin, Cerbonan, Karanganyar</p>
                                <p style="font-size:8pt; margin:0;">Telp/WA: 0813-9872-7722</p>
                            </div>
                            <h1>Laporan Arus Kas</h1>
                        </div>
                        <hr>
                        <div class="customer-info"><strong>&nbsp;</strong><span>${period}</span></div>
                        <hr>
                        <h3 style="margin:10px 0 4px;">Ringkasan Saldo Per Metode Pembayaran</h3>
                        <table>
                            <thead>
                                <tr>
                                    <th>Metode / Akun</th>
                                    <th class="currency">Saldo Sistem</th>
                                    <th class="currency">Saldo Real Terakhir</th>
                                    <th class="currency">Selisih</th>
                                </tr>
                            </thead>
                            <tbody>${accountCardsHtml}</tbody>
                        </table>
                        <h3 style="margin:14px 0 4px;">Buku Kas Gabungan</h3>
                        <table>
                            <thead>
                                <tr>
                                    <th>Tanggal</th>
                                    <th>Aktivitas</th>
                                    <th>Kategori</th>
                                    <th>Keterangan</th>
                                    <th>Kantong / Metode</th>
                                    <th class="currency">Masuk</th>
                                    <th class="currency">Keluar</th>
                                    <th class="currency">Akumulasi</th>
                                </tr>
                            </thead>
                            <tbody>${rowsHtml}</tbody>
                        </table>
                        <div class="summary-box">
                            <table style="width: 380px; float: right; border: none;">
                                <tr><td style="border:none;">Saldo Awal (Sebelum Periode):</td><td style="border:none;" class="currency"><strong>${formatCurrency(cashFlowCumulativeBridge.openingBeforePeriod)}</strong></td></tr>
                                <tr><td style="border:none;">Total Kas Masuk Periode:</td><td style="border:none;" class="currency"><strong>${formatCurrency(cashFlowSummary.totalIn)}</strong></td></tr>
                                <tr><td style="border:none;">Total Kas Keluar (Belanja & Cicilan):</td><td style="border:none;" class="currency"><strong>(${formatCurrency(cashFlowSummary.totalOutBelanja)})</strong></td></tr>
                                <tr><td style="border:none;">Disetor ke Owner (Periode):</td><td style="border:none;" class="currency"><strong>${formatCurrency(cashFlowSummary.totalSetorOwner)}</strong></td></tr>
                                <tr><td style="border:none;">Mutasi Bersih Periode:</td><td style="border:none;" class="currency"><strong>${formatCurrency(cashFlowCumulativeBridge.periodNet)}</strong></td></tr>
                                <tr><td style="border:none; border-top:1px solid #999; padding-top:6px;"><strong>Saldo Akhir (Estimasi Keseluruhan):</strong></td><td style="border:none; border-top:1px solid #999; padding-top:6px;" class="currency"><strong>${formatCurrency(cashFlowCumulativeBridge.endingGlobalToday)}</strong></td></tr>
                            </table>
                        </div>
                    </div>
                    <div class="print-button-container">
                        <button onclick="window.print()">Cetak atau Simpan PDF</button>
                    </div>
                </body>
            </html>`;

        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(printContent);
            printWindow.document.close();
            printWindow.focus();
        }
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-md flex flex-col h-full">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                    <h2 className="text-xl font-bold text-gray-800">Arus Kas &amp; Buku Kas Toko</h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                        Pantau arus uang masuk/keluar real-time per rekening, kas laci, mutasi antar akun, dan rekonsiliasi saldo.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={handlePrint}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm"
                    >
                        <PrinterIcon className="h-4 w-4" />
                        Cetak PDF
                    </button>
                    <button
                        type="button"
                        onClick={handleExport}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-green-600 text-white rounded-lg hover:bg-green-700 shadow-sm"
                    >
                        <ArrowDownTrayIcon className="h-4 w-4" />
                        Ekspor Excel
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto min-h-[50vh] pr-2 pb-20 space-y-6">
                {/* Filter Controls */}
                <div className="bg-gray-50 p-4 rounded-xl border space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide mr-1">Periode Cepat:</span>
                            <button onClick={() => applyCashFlowPreset('today')} className="px-2.5 py-1 text-xs font-semibold bg-white border rounded-md hover:bg-pink-50 hover:text-pink-700 hover:border-pink-200">Hari Ini</button>
                            <button onClick={() => applyCashFlowPreset('7days')} className="px-2.5 py-1 text-xs font-semibold bg-white border rounded-md hover:bg-pink-50 hover:text-pink-700 hover:border-pink-200">7 Hari Terakhir</button>
                            <button onClick={() => applyCashFlowPreset('month')} className="px-2.5 py-1 text-xs font-semibold bg-white border rounded-md hover:bg-pink-50 hover:text-pink-700 hover:border-pink-200">Bulan Ini</button>
                            <button onClick={() => applyCashFlowPreset('year')} className="px-2.5 py-1 text-xs font-semibold bg-white border rounded-md hover:bg-pink-50 hover:text-pink-700 hover:border-pink-200">Tahun Ini</button>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setIsTransferModalOpen(true)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-pink-600 text-white rounded-lg hover:bg-pink-700 shadow-sm"
                            >
                                <ArrowPathIcon className="h-3.5 w-3.5" />
                                Mutasi / Pindah Dana
                            </button>
                            <button
                                onClick={() => {
                                    setCashFlowStartDate(firstDay);
                                    setCashFlowEndDate(lastDay);
                                    setCashFlowWalletFilter('Semua');
                                    setCashFlowActivityFilter('Semua');
                                    setCashFlowSearch('');
                                }}
                                className="text-xs text-pink-600 hover:underline font-medium"
                            >
                                Reset Filter
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                        <div>
                            <label className="text-xs font-medium text-gray-600">Dari Tanggal</label>
                            <input type="date" value={cashFlowStartDate} onChange={e => setCashFlowStartDate(e.target.value)} className="mt-1 w-full p-2 border rounded-md text-sm bg-white" />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-gray-600">Sampai Tanggal</label>
                            <input type="date" value={cashFlowEndDate} onChange={e => setCashFlowEndDate(e.target.value)} className="mt-1 w-full p-2 border rounded-md text-sm bg-white" />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-gray-600">Kantong / Akun Metode</label>
                            <select value={cashFlowWalletFilter} onChange={e => setCashFlowWalletFilter(e.target.value)} className="mt-1 w-full p-2 border rounded-md text-sm bg-white">
                                <option value="Semua">Semua Kantong &amp; Akun</option>
                                <option value="Kas Laci">Kas Laci (Tunai)</option>
                                <option value="Bank / Non-Tunai">Semua Bank / Non-Tunai</option>
                                <option value="Uang Pribadi Owner">Uang Pribadi Owner</option>
                                <option value="Data Lama">Data Lama (Bulanan)</option>
                                {effectivePaymentMethods.length > 0 && (
                                    <optgroup label="Per Akun Pembayaran">
                                        {effectivePaymentMethods.map(m => (
                                            <option key={m.id} value={`account:${m.id}`}>{m.name} ({m.type})</option>
                                        ))}
                                    </optgroup>
                                )}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-medium text-gray-600">Jenis Aktivitas</label>
                            <select value={cashFlowActivityFilter} onChange={e => setCashFlowActivityFilter(e.target.value as any)} className="mt-1 w-full p-2 border rounded-md text-sm bg-white">
                                <option value="Semua">Semua Aktivitas</option>
                                <option value="Operasional">Operasional (Order &amp; Biaya)</option>
                                <option value="Kewajiban">Kewajiban (Pemasok &amp; Bank)</option>
                                <option value="Owner">Owner (Setor Laci &amp; Pribadi)</option>
                                <option value="Mutasi">Mutasi Antar Akun / Modal</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-medium text-gray-600">Cari Keterangan</label>
                            <input type="text" value={cashFlowSearch} onChange={e => setCashFlowSearch(e.target.value)} placeholder="Pelanggan, nota, bank, pemasok..." className="mt-1 w-full p-2 border rounded-md text-sm bg-white" />
                        </div>
                    </div>
                </div>

                {/* Rekap Saldo Akhir Kas (Estimasi) Sinkron Final Rekapitulasi */}
                <div className="bg-gradient-to-r from-cyan-50 via-blue-50 to-indigo-50 border border-cyan-200 rounded-xl p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                            <h4 className="font-bold text-sm text-cyan-950">Rekap Saldo Akhir Kas Keseluruhan (Sinkron Final Rekapitulasi)</h4>
                            <p className="text-xs text-cyan-800">
                                Menghubungkan akumulasi sejak Data Lama + Order + Operasional + Pemasok + Cicilan Bank + Non-Opr Kas Toko + Setor/Tarik Owner &amp; Suntik Modal.
                            </p>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="bg-white/90 border border-cyan-100 rounded-lg p-3">
                            <p className="text-[11px] font-medium text-gray-500">Saldo Awal (Sebelum {cashFlowStartDate ? formatDate(cashFlowStartDate) : 'Periode'})</p>
                            <p className={`text-base font-bold mt-1 ${cashFlowCumulativeBridge.openingBeforePeriod >= 0 ? 'text-gray-900' : 'text-rose-600'}`}>
                                {formatCurrency(cashFlowCumulativeBridge.openingBeforePeriod)}
                            </p>
                        </div>
                        <div className="bg-white/90 border border-cyan-100 rounded-lg p-3">
                            <p className="text-[11px] font-medium text-gray-500">Mutasi Bersih Periode Filter</p>
                            <p className={`text-base font-bold mt-1 ${cashFlowCumulativeBridge.periodNet >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                                {cashFlowCumulativeBridge.periodNet >= 0 ? '+ ' : ''}{formatCurrency(cashFlowCumulativeBridge.periodNet)}
                            </p>
                        </div>
                        <div className="bg-white/90 border border-cyan-100 rounded-lg p-3">
                            <p className="text-[11px] font-medium text-gray-500">Saldo s/d {cashFlowEndDate ? formatDate(cashFlowEndDate) : 'Akhir Periode'}</p>
                            <p className={`text-base font-bold mt-1 ${cashFlowCumulativeBridge.endingAtPeriodEnd >= 0 ? 'text-indigo-700' : 'text-rose-600'}`}>
                                {formatCurrency(cashFlowCumulativeBridge.endingAtPeriodEnd)}
                            </p>
                        </div>
                        <div className="bg-gradient-to-br from-cyan-600 to-blue-600 text-white rounded-lg p-3 shadow-sm">
                            <p className="text-[11px] font-medium text-white/90">Saldo Akhir (Estimasi Keseluruhan)</p>
                            <p className="text-lg font-extrabold mt-1">{formatCurrency(cashFlowCumulativeBridge.endingGlobalToday)}</p>
                            <p className="text-[10px] text-white/80 mt-0.5">= Sama dengan Final Rekapitulasi</p>
                        </div>
                    </div>
                </div>

                {/* Per-Payment-Method Saldo Sistem vs Real Grid */}
                <div className="bg-white border rounded-xl p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                            <h4 className="font-bold text-base text-gray-800">Saldo Semua Metode Pembayaran (Sistem vs Real)</h4>
                            <p className="text-xs text-gray-500">Klik kartu akun untuk menyaring buku kas, atau klik <strong>Cek Real / Saldo Awal</strong> untuk mencocokkan saldo aktual di bank / QRIS / laci.</p>
                        </div>
                        <div className="text-xs font-semibold bg-gray-100 text-gray-800 px-3 py-1.5 rounded-lg">
                            Total Saldo Sistem Semua Akun: {formatCurrency(accountBalancesSummary.reduce((s, a) => s + a.systemBalance, 0))}
                        </div>
                    </div>

                    {unallocatedBankOutflowsGlobal > 0 && (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800 flex items-center justify-between gap-2">
                            <span>
                                <strong>Info:</strong> Terdapat pengeluaran lama bertipe <em>Transfer Bank</em> sebesar <strong>{formatCurrency(unallocatedBankOutflowsGlobal)}</strong>
                                {unallocatedBankOutflowsPeriod > 0 ? ` (${formatCurrency(unallocatedBankOutflowsPeriod)} pada periode ini)` : ''} yang belum memilih nama rekening bank spesifik, sehingga tidak mengurangi saldo masing-masing bank di bawah.
                            </span>
                        </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                        {accountBalancesSummary.map(item => {
                            const isSelected = cashFlowWalletFilter === `account:${item.method.id}`;
                            const badgeClass =
                                item.method.type === 'Tunai'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : item.method.type === 'QRIS'
                                        ? 'bg-purple-100 text-purple-800'
                                        : item.method.type === 'E-Wallet'
                                            ? 'bg-amber-100 text-amber-800'
                                            : 'bg-sky-100 text-sky-800';
                            const hasChecked = item.meta?.lastRealBalance !== undefined;
                            return (
                                <div
                                    key={item.method.id}
                                    onClick={() => setCashFlowWalletFilter(isSelected ? 'Semua' : `account:${item.method.id}`)}
                                    className={`cursor-pointer rounded-xl border p-3.5 transition-all flex flex-col justify-between gap-2 ${
                                        isSelected
                                            ? 'border-pink-500 ring-2 ring-pink-200 bg-pink-50/30'
                                            : 'border-gray-200 bg-white hover:border-pink-300 hover:shadow-sm'
                                    }`}
                                >
                                    <div className="space-y-1.5">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <p className="font-bold text-gray-900 text-sm truncate" title={item.method.name}>{item.method.name}</p>
                                                <span className={`inline-block mt-0.5 text-[10px] font-semibold px-2 py-0.5 rounded-full ${badgeClass}`}>
                                                    {item.method.type}
                                                </span>
                                            </div>
                                            {hasChecked ? (
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${
                                                    item.discrepancy === 0
                                                        ? 'bg-emerald-100 text-emerald-800'
                                                        : (item.discrepancy || 0) > 0
                                                            ? 'bg-blue-100 text-blue-800'
                                                            : 'bg-rose-100 text-rose-800'
                                                }`}>
                                                    {item.discrepancy === 0
                                                        ? 'Cocok'
                                                        : (item.discrepancy || 0) > 0
                                                            ? `Lebih ${formatCurrency(item.discrepancy || 0)}`
                                                            : `Kurang ${formatCurrency(Math.abs(item.discrepancy || 0))}`}
                                                </span>
                                            ) : (
                                                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 whitespace-nowrap">
                                                    Belum Dicek
                                                </span>
                                            )}
                                        </div>

                                        <div className="pt-1">
                                            <p className="text-[11px] text-gray-500">Saldo Sistem</p>
                                            <p className={`text-lg font-extrabold ${item.systemBalance >= 0 ? 'text-gray-900' : 'text-rose-600'}`}>
                                                {formatCurrency(item.systemBalance)}
                                            </p>
                                        </div>

                                        {hasChecked && (
                                            <div className="text-[11px] flex justify-between items-center text-gray-600 bg-gray-50 px-2 py-1 rounded">
                                                <span>Saldo Real:</span>
                                                <span className="font-bold text-gray-800">{formatCurrency(item.meta!.lastRealBalance!)}</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="border-t pt-2 space-y-1.5 text-[11px]">
                                        <div className="flex justify-between text-gray-600">
                                            <span>Periode (+ / -):</span>
                                            <span>
                                                <span className="text-emerald-700 font-semibold">+{formatCurrency(item.periodIn + item.periodTransferIn)}</span>
                                                {' / '}
                                                <span className="text-rose-700 font-semibold">-{formatCurrency(item.periodOut + item.periodTransferOut)}</span>
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between gap-2 pt-0.5">
                                            <span className="text-[10px] text-gray-400 truncate">
                                                {item.meta?.lastRealCheckedAt ? `Cek: ${formatDate(item.meta.lastRealCheckedAt)}` : (item.meta?.openingDate ? `Sejak ${formatDate(item.meta.openingDate)}` : 'Semua periode')}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={e => {
                                                    e.stopPropagation();
                                                    setReconcileAccount(item.method);
                                                }}
                                                className="px-2 py-1 rounded-md bg-gray-100 hover:bg-pink-100 hover:text-pink-700 text-gray-700 font-semibold text-[11px] whitespace-nowrap"
                                            >
                                                Cek Real / Saldo Awal
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* 4 Top Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <ProminentStatCard
                        icon={<ArrowDownTrayIcon />}
                        title="Total Kas Masuk Riil"
                        value={formatCurrency(cashFlowSummary.totalIn)}
                        gradient="bg-gradient-to-br from-emerald-500 to-green-600"
                    />
                    <ProminentStatCard
                        icon={<ReceiptTaxIcon />}
                        title="Kas Keluar (Belanja & Cicilan)"
                        value={formatCurrency(cashFlowSummary.totalOutBelanja)}
                        gradient="bg-gradient-to-br from-rose-500 to-red-600"
                    />
                    <ProminentStatCard
                        icon={<ChartBarIcon />}
                        title="Arus Kas Bersih Usaha"
                        value={formatCurrency(cashFlowSummary.netBusinessCashFlow)}
                        gradient={cashFlowSummary.netBusinessCashFlow >= 0 ? 'bg-gradient-to-br from-blue-500 to-indigo-600' : 'bg-gradient-to-br from-amber-600 to-red-600'}
                    />
                    <ProminentStatCard
                        icon={<ArrowUpTrayIcon />}
                        title="Disetor ke Owner"
                        value={formatCurrency(cashFlowSummary.totalSetorOwner)}
                        gradient="bg-gradient-to-br from-purple-500 to-fuchsia-600"
                    />
                </div>

                {/* 3 Wallet Breakdown Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/40 space-y-2 text-sm">
                        <div className="flex items-center justify-between">
                            <h4 className="font-bold text-emerald-900">Kantong 1: Kas Laci (Tunai)</h4>
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">Fisik Kasir</span>
                        </div>
                        <div className="flex justify-between text-gray-700"><span>Masuk Tunai (Periode)</span><span className="font-semibold text-emerald-700">+ {formatCurrency(cashFlowSummary.inLaci)}</span></div>
                        <div className="flex justify-between text-gray-700"><span>Keluar Biaya/Cicilan Laci</span><span className="font-semibold text-rose-700">- {formatCurrency(cashFlowSummary.outLaciBelanja)}</span></div>
                        <div className="flex justify-between text-gray-700"><span>Disetor ke Owner</span><span className="font-semibold text-purple-700">- {formatCurrency(cashFlowSummary.totalSetorOwner)}</span></div>
                        {cashFlowSummary.transferNetLaci !== 0 && (
                            <div className="flex justify-between text-gray-700">
                                <span>Mutasi Antar Akun (Net)</span>
                                <span className={`font-semibold ${cashFlowSummary.transferNetLaci >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                                    {cashFlowSummary.transferNetLaci >= 0 ? '+ ' : '- '}{formatCurrency(Math.abs(cashFlowSummary.transferNetLaci))}
                                </span>
                            </div>
                        )}
                        <div className="border-t border-emerald-200 pt-2 flex justify-between font-bold text-emerald-950">
                            <span>Mutasi Bersih Periode</span>
                            <span>{formatCurrency(cashFlowSummary.netLaciPeriod)}</span>
                        </div>
                        <div className="bg-white/90 border border-emerald-200 rounded-lg px-3 py-2 flex justify-between items-center text-xs">
                            <span className="text-gray-600">Saldo Laci Aktif Saat Ini:</span>
                            <span className="font-bold text-emerald-700 text-sm">{formatCurrency(activeCashDrawerBalance)}</span>
                        </div>
                    </div>

                    <div className="p-4 rounded-xl border border-sky-200 bg-sky-50/40 space-y-2 text-sm">
                        <div className="flex items-center justify-between">
                            <h4 className="font-bold text-sky-900">Kantong 2: Bank / Non-Tunai</h4>
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-sky-100 text-sky-800">Transfer / QRIS</span>
                        </div>
                        <div className="flex justify-between text-gray-700"><span>Masuk Non-Tunai (Periode)</span><span className="font-semibold text-emerald-700">+ {formatCurrency(cashFlowSummary.inBank)}</span></div>
                        <div className="flex justify-between text-gray-700"><span>Keluar via Transfer Bank</span><span className="font-semibold text-rose-700">- {formatCurrency(cashFlowSummary.outBankBelanja)}</span></div>
                        {cashFlowSummary.transferNetBank !== 0 && (
                            <div className="flex justify-between text-gray-700">
                                <span>Mutasi / Cair QRIS / Setor Laci</span>
                                <span className={`font-semibold ${cashFlowSummary.transferNetBank >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                                    {cashFlowSummary.transferNetBank >= 0 ? '+ ' : '- '}{formatCurrency(Math.abs(cashFlowSummary.transferNetBank))}
                                </span>
                            </div>
                        )}
                        <div className="border-t border-sky-200 pt-2 flex justify-between font-bold text-sky-950">
                            <span>Surplus Rekening Periode</span>
                            <span>{formatCurrency(cashFlowSummary.netBankPeriod)}</span>
                        </div>
                        <p className="text-[11px] text-sky-700 pt-1">
                            Gunakan tombol <strong>Mutasi / Pindah Dana</strong> di atas untuk mencatat pencairan QRIS ke Bank atau transfer antar rekening BRI ↔ BCA.
                        </p>
                    </div>

                    <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/40 space-y-2 text-sm">
                        <div className="flex items-center justify-between">
                            <h4 className="font-bold text-amber-900">Kantong 3: Dana Pribadi Owner</h4>
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-800">Terpisah dari Kas Toko</span>
                        </div>
                        <div className="flex justify-between text-gray-700"><span>Talangan / Dana Owner (Periode)</span><span className="font-semibold text-amber-800">{formatCurrency(cashFlowSummary.ownerAdvancePeriod)}</span></div>
                        <div className="border-t border-amber-200 pt-2 flex justify-between font-bold text-rose-700">
                            <span>Total Belum Reimburse (Global)</span>
                            <span>{formatCurrency(cashFlowSummary.unreimbursedOwnerTotal)}</span>
                        </div>
                        <p className="text-[11px] text-amber-800 pt-1">
                            Pengeluaran pribadi/cicilan memakai Dana Owner dicatat terpisah agar saldo Kas Laci dan Rekening toko tetap murni.
                        </p>
                    </div>
                </div>

                {/* Chart */}
                <div className="bg-white border rounded-xl p-4">
                    <h4 className="font-bold text-base text-gray-800 mb-3">Grafik Arus Kas Masuk vs Keluar</h4>
                    {cashFlowChartData.length > 0 ? (
                        <div className="h-72">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={cashFlowChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                                    <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => v >= 1000000 ? `${(Number(v) / 1000000).toFixed(1)} Jt` : `${Math.round(Number(v) / 1000)} Rb`} />
                                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                                    <Legend />
                                    <Bar dataKey="Kas Masuk" fill="#10b981" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="Kas Keluar" fill="#ef4444" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="Setor Owner" fill="#9333ea" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <p className="text-center text-gray-500 py-10 text-sm">Belum ada mutasi arus kas pada filter tanggal ini.</p>
                    )}
                </div>

                {/* Unified Ledger Table */}
                <div>
                    <div className="flex flex-wrap justify-between items-center mb-2 gap-2">
                        <h4 className="font-bold text-base text-gray-800">
                            Buku Kas Gabungan ({cashFlowLedgerDesc.length} Transaksi)
                            {selectedAccountFilterId && (
                                <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-pink-100 text-pink-700">
                                    Filter Akun: {effectivePaymentMethods.find(m => m.id === selectedAccountFilterId)?.name}
                                </span>
                            )}
                        </h4>
                        <span className="text-xs text-gray-500">
                            Urutan terbaru di atas • Kolom <strong>Akumulasi Periode</strong> dihitung kronologis dari awal filter tanggal
                        </span>
                    </div>
                    <div className="overflow-x-auto border rounded-xl">
                        <table className="min-w-full text-sm">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="py-2.5 px-3 text-left text-xs font-semibold text-gray-600">Tanggal</th>
                                    <th className="py-2.5 px-3 text-left text-xs font-semibold text-gray-600">Aktivitas &amp; Kategori</th>
                                    <th className="py-2.5 px-3 text-left text-xs font-semibold text-gray-600">Keterangan</th>
                                    <th className="py-2.5 px-3 text-left text-xs font-semibold text-gray-600">Kantong / Metode</th>
                                    <th className="py-2.5 px-3 text-right text-xs font-semibold text-emerald-700">Masuk (+)</th>
                                    <th className="py-2.5 px-3 text-right text-xs font-semibold text-rose-700">Keluar (-)</th>
                                    <th className="py-2.5 px-3 text-right text-xs font-semibold text-gray-700">Akumulasi Periode</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {paginatedCashFlow.length > 0 ? paginatedCashFlow.map(row => (
                                    <tr key={row.id} className="hover:bg-gray-50">
                                        <td className="py-2.5 px-3 whitespace-nowrap text-xs text-gray-600">{formatDate(row.date)}</td>
                                        <td className="py-2.5 px-3 text-xs">
                                            <span className={`inline-block px-2 py-0.5 rounded-full font-semibold mr-1.5 ${
                                                row.activity === 'Operasional'
                                                    ? 'bg-blue-100 text-blue-800'
                                                    : row.activity === 'Kewajiban'
                                                        ? 'bg-amber-100 text-amber-800'
                                                        : row.activity === 'Mutasi'
                                                            ? 'bg-cyan-100 text-cyan-800'
                                                            : 'bg-purple-100 text-purple-800'
                                            }`}>
                                                {row.activity}
                                            </span>
                                            <div className="font-medium text-gray-800 mt-0.5">{row.category}</div>
                                        </td>
                                        <td className="py-2.5 px-3 text-xs text-gray-800">
                                            <div className="flex items-start justify-between gap-2">
                                                <div>
                                                    <div className="font-medium">{row.description}</div>
                                                    {row.note && <div className="text-[11px] text-gray-500 mt-0.5">{row.note}</div>}
                                                </div>
                                                {row.transferId && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            if (window.confirm('Hapus catatan mutasi ini?')) {
                                                                onDeleteCashTransfer(row.transferId!);
                                                            }
                                                        }}
                                                        className="p-1 text-gray-400 hover:text-rose-600 flex-shrink-0"
                                                        title="Hapus Mutasi"
                                                    >
                                                        <TrashIcon className="h-3.5 w-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                        <td className="py-2.5 px-3 whitespace-nowrap text-xs">
                                            <span className={`inline-block px-2 py-0.5 rounded font-semibold ${
                                                row.wallet === 'Kas Laci'
                                                    ? 'bg-emerald-100 text-emerald-800'
                                                    : row.wallet === 'Bank / Non-Tunai'
                                                        ? 'bg-sky-100 text-sky-800'
                                                        : row.wallet === 'Data Lama'
                                                            ? 'bg-slate-100 text-slate-700'
                                                            : 'bg-amber-100 text-amber-800'
                                            }`}>
                                                {row.wallet}
                                            </span>
                                            <div className="text-[11px] text-gray-500 mt-0.5">{row.methodOrSource}</div>
                                        </td>
                                        <td className="py-2.5 px-3 text-right whitespace-nowrap font-semibold text-emerald-700">
                                            {row.displayIn > 0 ? formatCurrency(row.displayIn) : '-'}
                                        </td>
                                        <td className="py-2.5 px-3 text-right whitespace-nowrap font-semibold text-rose-700">
                                            {row.displayOut > 0
                                                ? formatCurrency(row.displayOut)
                                                : row.type === 'Talangan Owner'
                                                    ? (
                                                        <span className="text-amber-700 text-xs font-medium" title="Menggunakan Uang Pribadi Owner">
                                                            Talangan {formatCurrency(row.amount)}
                                                        </span>
                                                    )
                                                    : row.type === 'Mutasi' && row.displayIn === 0
                                                        ? (
                                                            <span className="text-cyan-700 text-xs font-medium" title="Mutasi internal antar akun toko">
                                                                Pindah {formatCurrency(row.amount)}
                                                            </span>
                                                        )
                                                        : '-'}
                                        </td>
                                        <td className={`py-2.5 px-3 text-right whitespace-nowrap font-bold ${row.runningBalance >= 0 ? 'text-gray-800' : 'text-red-600'}`}>
                                            {formatCurrency(row.runningBalance)}
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={7} className="text-center py-10 text-gray-500 text-sm">
                                            Tidak ada transaksi arus kas yang cocok dengan filter.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    <Pagination
                        totalItems={cashFlowLedgerDesc.length}
                        itemsPerPage={ITEMS_PER_PAGE}
                        currentPage={currentPage}
                        onPageChange={setCurrentPage}
                    />
                </div>
            </div>

            <CashTransferModal
                show={isTransferModalOpen}
                onClose={() => setIsTransferModalOpen(false)}
                paymentMethods={effectivePaymentMethods}
                onSave={onAddCashTransfer}
            />

            <AccountReconcileModal
                account={reconcileAccount}
                systemBalance={reconcileAccount ? (accountBalancesSummary.find(s => s.method.id === reconcileAccount.id)?.systemBalance ?? 0) : 0}
                meta={reconcileAccount ? accountBalancesMeta[reconcileAccount.id] : undefined}
                todayStr={getUtcDateStr()}
                computeAccountNet={computeNonCashAccountNet}
                onClose={() => setReconcileAccount(null)}
                onSave={onSaveAccountBalanceMeta}
            />
        </div>
    );
};

export default CashFlow;
