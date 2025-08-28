
import React, { useState, useEffect, useMemo } from 'react';
import { type SalaryData, type EmployeeData, type AttendanceData, type PayrollRecord, type Bonus, type Deduction } from '../types';
import { TrashIcon, PencilIcon, PrinterIcon, FilterIcon } from './Icons';

type PayrollTab = 'attendance' | 'summary';

const TABS = [
    { key: 'attendance', label: 'Absensi Kerja' },
    { key: 'summary', label: 'Ringkasan Gaji' },
];

// --- Helper Functions ---
const timeToMinutes = (time: string): number => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
};

const formatCurrency = (amount: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);

// --- Modal Components ---
const ReusableModal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode; maxWidth?: string }> = ({ title, onClose, children, maxWidth = 'max-w-lg' }) => (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" onClick={onClose}>
        <div className={`bg-white rounded-xl shadow-2xl p-6 w-full ${maxWidth} max-h-[90vh] flex flex-col`} onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b pb-3 mb-5">
                <h3 className="text-xl font-bold text-gray-800">{title}</h3>
                <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-2xl leading-none">&times;</button>
            </div>
            <div className="flex-1 overflow-y-auto pr-2">{children}</div>
        </div>
    </div>
);

const BonusDeductionModal: React.FC<{ type: 'Bonus' | 'Potongan'; onClose: () => void; onSave: (item: Bonus | Deduction) => void; initialData?: Bonus | Deduction; }> = ({ type, onClose, onSave, initialData }) => {
    const [amount, setAmount] = useState(initialData?.amount.toString() || '');
    const [notes, setNotes] = useState(initialData?.notes || '');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({ amount: Number(amount), notes });
    };

    return (
        <ReusableModal title={`${initialData ? 'Edit' : 'Tambah'} ${type}`} onClose={onClose} maxWidth="max-w-md">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium">Nilai {type} (Rp)</label>
                    <input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="mt-1 w-full p-2 border rounded-md" required min="0" />
                </div>
                <div>
                    <label className="block text-sm font-medium">Catatan</label>
                    <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="mt-1 w-full p-2 border rounded-md" required></textarea>
                </div>
                <div className="border-t pt-4 flex justify-end">
                    <button type="submit" className="bg-pink-600 text-white py-2 px-6 rounded-lg font-bold hover:bg-pink-700">Simpan</button>
                </div>
            </form>
        </ReusableModal>
    );
};

const SummaryEditModal: React.FC<{
    employee: EmployeeData;
    period: { start: string; end: string };
    initialData: Omit<PayrollRecord, 'id' | 'employeeId' | 'startDate' | 'endDate' | 'totalSalary'>;
    onSave: (bonuses: Bonus[], deductions: Deduction[]) => void;
    onClose: () => void;
}> = ({ employee, period, initialData, onSave, onClose }) => {
    const [bonuses, setBonuses] = useState<Bonus[]>(initialData.bonuses);
    const [deductions, setDeductions] = useState<Deduction[]>(initialData.deductions);
    const [modal, setModal] = useState<{type: 'bonus' | 'deduction', data?: Bonus | Deduction, index?: number} | null>(null);

    const totalBonus = bonuses.reduce((sum, b) => sum + b.amount, 0);
    const totalDeduction = deductions.reduce((sum, d) => sum + d.amount, 0);
    const totalSalary = initialData.baseSalary + initialData.overtimePay + totalBonus - totalDeduction;

    const handleSaveBonusDeduction = (item: Bonus | Deduction) => {
        if (!modal) return;
        if (modal.type === 'bonus') {
            if (modal.index !== undefined) {
                setBonuses(prev => prev.map((b, i) => i === modal.index ? (item as Bonus) : b));
            } else {
                setBonuses(prev => [...prev, item as Bonus]);
            }
        } else {
             if (modal.index !== undefined) {
                setDeductions(prev => prev.map((d, i) => i === modal.index ? (item as Deduction) : d));
            } else {
                setDeductions(prev => [...prev, item as Deduction]);
            }
        }
        setModal(null);
    };
    
    const handleDelete = (type: 'bonus' | 'deduction', index: number) => {
        if (type === 'bonus') {
            if (window.confirm('Anda yakin ingin menghapus bonus ini?')) {
                setBonuses(prev => prev.filter((_, i) => i !== index));
            }
        } else {
            if (window.confirm('Anda yakin ingin menghapus potongan ini?')) {
                setDeductions(prev => prev.filter((_, i) => i !== index));
            }
        }
    };

    return (
        <ReusableModal title="Ringkasan Gaji" onClose={onClose} maxWidth="max-w-2xl">
            {modal && <BonusDeductionModal type={modal.type === 'bonus' ? 'Bonus' : 'Potongan'} onClose={() => setModal(null)} onSave={handleSaveBonusDeduction} initialData={modal.data} />}
            <div className="space-y-4">
                <div className="text-center">
                    <h4 className="font-bold text-lg">{employee.name}</h4>
                    <p className="text-sm text-gray-500">Periode: {period.start} s/d {period.end}</p>
                </div>
                <div className="space-y-2">
                    <div className="flex justify-between p-2 rounded bg-gray-50"><span className="text-gray-600">Gaji Pokok</span><span className="font-semibold">{formatCurrency(initialData.baseSalary)}</span></div>
                    <div className="flex justify-between p-2 rounded bg-gray-50"><span className="text-gray-600">Lembur</span><span className="font-semibold">{formatCurrency(initialData.overtimePay)}</span></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <h5 className="font-semibold">Bonus</h5>
                            <button onClick={() => setModal({type: 'bonus'})} className="text-xs bg-cyan-500 text-white px-2 py-1 rounded hover:bg-cyan-600">+ Tambah</button>
                        </div>
                        <div className="space-y-1 text-sm border p-2 rounded min-h-[80px]">
                            {bonuses.map((b, i) => (
                                <div key={i} className="flex justify-between items-center group hover:bg-gray-50 p-1 rounded-md">
                                    <div>
                                        <p className="font-medium">{b.notes}</p>
                                        <p>{formatCurrency(b.amount)}</p>
                                    </div>
                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => setModal({ type: 'bonus', index: i, data: b })} className="p-1 text-blue-600 hover:text-blue-800"><PencilIcon className="h-4 w-4" /></button>
                                        <button onClick={() => handleDelete('bonus', i)} className="p-1 text-red-600 hover:text-red-800"><TrashIcon className="h-4 w-4" /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div>
                         <div className="flex justify-between items-center mb-2">
                            <h5 className="font-semibold">Potongan</h5>
                            <button onClick={() => setModal({type: 'deduction'})} className="text-xs bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600">+ Tambah</button>
                        </div>
                        <div className="space-y-1 text-sm border p-2 rounded min-h-[80px]">
                            {deductions.map((d, i) => (
                                 <div key={i} className="flex justify-between items-center group hover:bg-gray-50 p-1 rounded-md">
                                    <div>
                                        <p className="font-medium">{d.notes}</p>
                                        <p>({formatCurrency(d.amount)})</p>
                                    </div>
                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => setModal({ type: 'deduction', index: i, data: d })} className="p-1 text-blue-600 hover:text-blue-800"><PencilIcon className="h-4 w-4" /></button>
                                        <button onClick={() => handleDelete('deduction', i)} className="p-1 text-red-600 hover:text-red-800"><TrashIcon className="h-4 w-4" /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="border-t pt-3 mt-3">
                    <div className="flex justify-between items-center text-xl font-bold p-3 bg-pink-50 rounded-lg">
                        <span>Total Gaji</span>
                        <span className="text-pink-600">{formatCurrency(totalSalary)}</span>
                    </div>
                </div>
            </div>
            <div className="border-t pt-4 mt-4 flex justify-end">
                <button onClick={() => onSave(bonuses, deductions)} className="bg-pink-600 text-white py-2 px-8 rounded-lg font-bold hover:bg-pink-700">Simpan</button>
            </div>
        </ReusableModal>
    );
};

// --- Main Payroll Component ---

interface PayrollProps {
    salaries: SalaryData[];
    employees: EmployeeData[];
    attendance: AttendanceData[];
    payrollRecords: PayrollRecord[];
    menuPermissions: string[];
    onAddAttendance: (newAttendance: Omit<AttendanceData, 'id'>) => void;
    onDeleteAttendance: (id: number) => void;
    onProcessPayroll: (employeeId: number, startDate: string, endDate: string, baseSalary: number, overtimePay: number, bonuses: Bonus[], deductions: Deduction[], processedAttendance: AttendanceData[]) => void;
    onUpdatePayroll: (updatedRecord: PayrollRecord) => void;
    onRevertPayroll: (payrollRecordId: number) => void;
}

const Payroll: React.FC<PayrollProps> = ({ salaries, employees, attendance, payrollRecords, menuPermissions, onAddAttendance, onDeleteAttendance, onProcessPayroll, onUpdatePayroll, onRevertPayroll }) => {
    const accessibleTabs = useMemo(() => TABS.filter(tab => menuPermissions.includes(`payroll/${tab.key}`)), [menuPermissions]);
    const [activeTab, setActiveTab] = useState<string>(accessibleTabs.length > 0 ? accessibleTabs[0].key : '');

    // Attendance form state
    const [salaryId, setSalaryId] = useState<string>('');
    const [division, setDivision] = useState('');
    const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().substring(0, 10));
    const [shift, setShift] = useState<'Pagi' | 'Sore'>('Pagi');
    const [clockIn, setClockIn] = useState('');
    const [clockOut, setClockOut] = useState('');
    const [isOvertime, setIsOvertime] = useState(false);
    const [overtimeHours, setOvertimeHours] = useState<string>('0');
    const [overtimeMinutes, setOvertimeMinutes] = useState<string>('0');
    const [overtimeNotes, setOvertimeNotes] = useState('');
    
    // Summary tab state
    const [isFilterVisible, setIsFilterVisible] = useState(true);
    const [filterEmployeeId, setFilterEmployeeId] = useState('');
    const [filterStartDate, setFilterStartDate] = useState('');
    const [filterEndDate, setFilterEndDate] = useState('');
    const [summaryModal, setSummaryModal] = useState<{ isOpen: boolean; data: any | null; isEditing: boolean }>({ isOpen: false, data: null, isEditing: false });

    useEffect(() => {
        if (accessibleTabs.length > 0 && !accessibleTabs.some(t => t.key === activeTab)) {
            setActiveTab(accessibleTabs[0].key);
        }
    }, [accessibleTabs, activeTab]);

    const employeesWithSalary = useMemo(() => {
        return salaries.map(salary => {
            const employee = employees.find(emp => emp.id === salary.employeeId);
            return {
                salaryId: salary.id,
                employeeId: salary.employeeId,
                name: employee?.name || 'Karyawan Tidak Ditemukan',
                division: employee?.division || 'N/A',
            };
        });
    }, [salaries, employees]);

    useEffect(() => {
        if (salaryId) {
            const selected = employeesWithSalary.find(e => e.salaryId.toString() === salaryId);
            if (selected) {
                setDivision(selected.division);
                if (shift === 'Pagi') {
                    setClockIn('09:00');
                    setClockOut('17:00');
                } else {
                    setClockIn('17:00');
                    setClockOut('01:00');
                }
            }
        } else {
            setDivision('');
            setClockIn('');
            setClockOut('');
        }
    }, [salaryId, shift, employeesWithSalary]);

    const resetForm = () => {
        setSalaryId('');
        setDivision('');
        setAttendanceDate(new Date().toISOString().substring(0, 10));
        setShift('Pagi');
        setClockIn('');
        setClockOut('');
        setIsOvertime(false);
        setOvertimeHours('0');
        setOvertimeMinutes('0');
        setOvertimeNotes('');
    };

    const handleAddAttendanceSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!salaryId) {
            alert('Silakan pilih karyawan terlebih dahulu.');
            return;
        }
        onAddAttendance({
            salaryId: Number(salaryId), date: attendanceDate, shift, clockIn, clockOut, isOvertime,
            overtimeHours: isOvertime ? Number(overtimeHours) : 0,
            overtimeMinutes: isOvertime ? Number(overtimeMinutes) : 0,
            overtimeNotes: isOvertime ? overtimeNotes : '',
        });
        resetForm();
    };

    const availableAttendance = useMemo(() => {
        const processedAttendanceIds = new Set(
            payrollRecords.flatMap(record => record.processedAttendance.map(att => att.id))
        );
        return attendance.filter(att => !processedAttendanceIds.has(att.id));
    }, [attendance, payrollRecords]);

    const handleAmbilAbsen = () => {
        if (!filterEmployeeId || !filterStartDate || !filterEndDate) {
            alert('Silakan pilih karyawan dan tentukan periode tanggal.');
            return;
        }

        const employeeSalaryInfo = salaries.find(s => s.employeeId === Number(filterEmployeeId));
        if (!employeeSalaryInfo) {
            alert('Data gaji untuk karyawan ini tidak ditemukan.');
            return;
        }

        const filteredAttendance = availableAttendance.filter(a => {
            const salaryData = salaries.find(s => s.id === a.salaryId);
            return salaryData && salaryData.employeeId === Number(filterEmployeeId) && a.date >= filterStartDate && a.date <= filterEndDate;
        });

        if (filteredAttendance.length === 0) {
            alert('Tidak ada data absensi pada periode yang dipilih.');
            return;
        }
        
        let baseSalary = 0;
        let overtimePay = 0;

        filteredAttendance.forEach(att => {
            const clockInMinutes = timeToMinutes(att.clockIn);
            let clockOutMinutes = timeToMinutes(att.clockOut);
            
            // Handle overnight shifts
            if (clockOutMinutes < clockInMinutes) {
                clockOutMinutes += 24 * 60; // Add 24 hours
            }

            const durationMinutes = clockOutMinutes - clockInMinutes;
            baseSalary += (durationMinutes / 60) * employeeSalaryInfo.regularRate;

            if (att.isOvertime) {
                const overtimeTotalMinutes = (att.overtimeHours || 0) * 60 + (att.overtimeMinutes || 0);
                overtimePay += (overtimeTotalMinutes / 60) * employeeSalaryInfo.overtimeRate;
            }
        });
        
        setSummaryModal({
            isOpen: true, isEditing: false,
            data: {
                employeeId: Number(filterEmployeeId),
                startDate: filterStartDate,
                endDate: filterEndDate,
                baseSalary,
                overtimePay,
                bonuses: [],
                deductions: [],
                processedAttendance: filteredAttendance,
            }
        });
    };

    const handleSavePayroll = (bonuses: Bonus[], deductions: Deduction[]) => {
        if (!summaryModal.data) return;
        
        if (summaryModal.isEditing) {
            const updatedRecord = { ...summaryModal.data, bonuses, deductions, totalSalary: summaryModal.data.baseSalary + summaryModal.data.overtimePay + bonuses.reduce((s,b) => s+b.amount, 0) - deductions.reduce((s,d) => s+d.amount, 0) };
            onUpdatePayroll(updatedRecord);
        } else {
            onProcessPayroll(
                summaryModal.data.employeeId,
                summaryModal.data.startDate,
                summaryModal.data.endDate,
                summaryModal.data.baseSalary,
                summaryModal.data.overtimePay,
                bonuses,
                deductions,
                summaryModal.data.processedAttendance,
            );
        }
        setSummaryModal({ isOpen: false, data: null, isEditing: false });
    };
    
    const handleEditPayroll = (record: PayrollRecord) => {
        setSummaryModal({ isOpen: true, isEditing: true, data: record });
    };

    const handlePrintPayslip = (record: PayrollRecord) => {
        const employee = employees.find(e => e.id === record.employeeId);
        if (!employee) return;

        // --- Duration Calculations ---
        let totalWorkMinutes = 0;
        record.processedAttendance.forEach(att => {
            const clockInMinutes = timeToMinutes(att.clockIn);
            let clockOutMinutes = timeToMinutes(att.clockOut);
            if (clockOutMinutes < clockInMinutes) {
                clockOutMinutes += 24 * 60; // Add 24 hours for overnight shift
            }
            totalWorkMinutes += clockOutMinutes - clockInMinutes;
        });
        const totalWorkHours = Math.floor(totalWorkMinutes / 60);
        const remainingWorkMinutes = totalWorkMinutes % 60;
        const workDurationText = `(${totalWorkHours} Jam ${remainingWorkMinutes} Menit)`;

        let totalOvertimeMinutes = 0;
        record.processedAttendance.forEach(att => {
            if (att.isOvertime) {
                totalOvertimeMinutes += (att.overtimeHours || 0) * 60 + (att.overtimeMinutes || 0);
            }
        });
        const totalOvertimeHours = Math.floor(totalOvertimeMinutes / 60);
        const remainingOvertimeMinutes = totalOvertimeMinutes % 60;
        const overtimeDurationText = `(${totalOvertimeHours} Jam ${remainingOvertimeMinutes} Menit)`;
        // --- End of Calculations ---

        const totalBonus = record.bonuses.reduce((sum, b) => sum + b.amount, 0);
        const totalDeduction = record.deductions.reduce((sum, d) => sum + d.amount, 0);
        const totalPendapatan = record.baseSalary + record.overtimePay + totalBonus;

        const renderBonusRows = () => record.bonuses.map(b => `
            <tr>
                <td>${b.notes}</td>
                <td class="currency">${formatCurrency(b.amount)}</td>
            </tr>
        `).join('');

        const renderDeductionRows = () => record.deductions.map(d => `
            <tr>
                <td>${d.notes}</td>
                <td class="currency">(${formatCurrency(d.amount)})</td>
            </tr>
        `).join('');
        
        const content = `
        <html>
            <head>
                <title>Slip Gaji - ${employee.name}</title>
                <style>
                    body {
                        font-family: sans-serif;
                        font-size: 10pt;
                        color: #333;
                    }
                    .container {
                        width: 100%;
                        max-width: 800px;
                        margin: auto;
                    }
                    .header {
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-start;
                        padding-bottom: 10px;
                        border-bottom: 2px solid #000;
                    }
                    .header-left h1 {
                        font-size: 18pt;
                        font-weight: bold;
                        margin: 0;
                        line-height: 1;
                    }
                    .header-left p {
                        font-size: 9pt;
                        margin: 4px 0 0 0;
                        line-height: 1.3;
                    }
                    .header-right {
                        text-align: right;
                    }
                    .header-right h2 {
                        font-size: 16pt;
                        font-weight: bold;
                        margin: 0;
                    }
                    .header-right p {
                        font-size: 10pt;
                        margin: 2px 0 0 0;
                    }
                    .content {
                        margin-top: 10px;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-bottom: 20px;
                    }
                    th, td {
                        padding: 6px;
                        text-align: left;
                    }
                    th {
                        background-color: #f2f2f2;
                        border-bottom: 1px solid #ccc;
                    }
                    .details-table td {
                        border-bottom: 1px solid #eee;
                    }
                    .currency {
                        text-align: right;
                    }
                    .summary-section {
                        margin-top: 10px;
                        padding-top: 10px;
                        border-top: 1px solid #ccc;
                    }
                    .summary-item {
                        display: flex;
                        justify-content: space-between;
                        padding: 4px 0;
                    }
                    .total {
                        font-weight: bold;
                        font-size: 12pt;
                    }
                    .duration-text {
                        font-size: 8pt;
                        color: #555;
                        display: block;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <div class="header-left">
                            <h1>Nala Media Digital Printing</h1>
                            <p>
                                Jl. Prof. Moh. Yamin, Cerbonan, Karanganyar<br/>
                                Telp/WA: 0813-9872-7722
                            </p>
                        </div>
                        <div class="header-right">
                            <h2>SLIP GAJI</h2>
                            <p><strong>${employee.name}</strong></p>
                            <p>Periode: ${new Date(record.startDate).toLocaleDateString('id-ID')} - ${new Date(record.endDate).toLocaleDateString('id-ID')}</p>
                        </div>
                    </div>

                    <div class="content">
                        <div style="display: flex; justify-content: space-between; gap: 30px;">
                            <div style="flex: 1;">
                                <h3>Pendapatan</h3>
                                <table class="details-table">
                                    <tbody>
                                        <tr>
                                            <td>Gaji Pokok <span class="duration-text">${workDurationText}</span></td>
                                            <td class="currency">${formatCurrency(record.baseSalary)}</td>
                                        </tr>
                                        <tr>
                                            <td>Lembur <span class="duration-text">${overtimeDurationText}</span></td>
                                            <td class="currency">${formatCurrency(record.overtimePay)}</td>
                                        </tr>
                                        ${renderBonusRows()}
                                        <tr style="font-weight: bold; background-color: #f9f9f9;">
                                            <td>Total Pendapatan</td>
                                            <td class="currency">${formatCurrency(totalPendapatan)}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                            <div style="flex: 1;">
                                <h3>Potongan</h3>
                                <table class="details-table">
                                    <tbody>
                                        ${renderDeductionRows()}
                                        <tr style="font-weight: bold; background-color: #f9f9f9;">
                                            <td>Total Potongan</td>
                                            <td class="currency">(${formatCurrency(totalDeduction)})</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div class="summary-section">
                             <div class="summary-item total" style="background-color: #f0f0f0; padding: 10px; border-radius: 5px;">
                                <span>GAJI BERSIH (Take Home Pay)</span>
                                <span>${formatCurrency(record.totalSalary)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </body>
        </html>
        `;

        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(content);
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => { printWindow.print(); printWindow.close(); }, 250);
        }
    };

    const sortedAttendance = useMemo(() => [...availableAttendance].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()), [availableAttendance]);
    
    // UI RENDER METHODS
    const TabButton: React.FC<{ label: string; tabKey: string; }> = ({ label, tabKey }) => (
        <button onClick={() => setActiveTab(tabKey)} className={`${ activeTab === tabKey ? 'border-pink-500 text-pink-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300' } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}>{label}</button>
    );

    const renderAttendanceTab = () => (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
            <div className="lg:col-span-2"><h3 className="text-lg font-semibold text-gray-700 mb-4">Form Absensi</h3><form onSubmit={handleAddAttendanceSubmit} className="space-y-4"><div><label className="block text-sm font-medium text-gray-700">Karyawan</label><select value={salaryId} onChange={e => setSalaryId(e.target.value)} className="mt-1 w-full p-2 border bg-white rounded-md" required><option value="">Pilih Karyawan</option>{employeesWithSalary.map(e => <option key={e.salaryId} value={e.salaryId}>{e.name}</option>)}</select></div><div><label className="block text-sm font-medium text-gray-700">Devisi</label><input type="text" value={division} readOnly className="mt-1 w-full p-2 border rounded-md bg-gray-100" /></div><div className="grid grid-cols-2 gap-4"><div><label className="block text-sm font-medium text-gray-700">Tanggal Absen</label><input type="date" value={attendanceDate} onChange={e => setAttendanceDate(e.target.value)} className="mt-1 w-full p-2 border rounded-md" /></div><div><label className="block text-sm font-medium text-gray-700">Shift</label><select value={shift} onChange={e => setShift(e.target.value as 'Pagi' | 'Sore')} className="mt-1 w-full p-2 border bg-white rounded-md"><option value="Pagi">Pagi</option><option value="Sore">Sore</option></select></div></div><div className="grid grid-cols-2 gap-4"><div><label className="block text-sm font-medium text-gray-700">Jam Masuk</label><input type="time" value={clockIn} onChange={e => setClockIn(e.target.value)} className="mt-1 w-full p-2 border rounded-md" /></div><div><label className="block text-sm font-medium text-gray-700">Jam Keluar</label><input type="time" value={clockOut} onChange={e => setClockOut(e.target.value)} className="mt-1 w-full p-2 border rounded-md" /></div></div><div><label className="flex items-center space-x-2"><input type="checkbox" checked={isOvertime} onChange={e => setIsOvertime(e.target.checked)} className="h-4 w-4 rounded text-pink-600 focus:ring-pink-500" /><span className="text-sm font-medium text-gray-700">Lembur</span></label></div>{isOvertime && (<div className="p-4 border rounded-md bg-gray-50 space-y-4"><div className="grid grid-cols-2 gap-4"><div><label className="block text-sm font-medium text-gray-700">Jam Lembur</label><input type="number" value={overtimeHours} onChange={e => setOvertimeHours(e.target.value)} className="mt-1 w-full p-2 border rounded-md" min="0" /></div><div><label className="block text-sm font-medium text-gray-700">Menit Lembur</label><input type="number" value={overtimeMinutes} onChange={e => setOvertimeMinutes(e.target.value)} className="mt-1 w-full p-2 border rounded-md" min="0" max="59" /></div></div><div><label className="block text-sm font-medium text-gray-700">Catatan Lembur</label><textarea value={overtimeNotes} onChange={e => setOvertimeNotes(e.target.value)} rows={2} className="mt-1 w-full p-2 border rounded-md" placeholder="e.g., Menyelesaikan pekerjaan..."></textarea></div></div>)}<div className="pt-2"><button type="submit" className="w-full bg-pink-600 text-white py-2.5 rounded-lg font-bold hover:bg-pink-700">Simpan Absensi</button></div></form></div>
            <div className="lg:col-span-3"><h3 className="text-lg font-semibold text-gray-700 mb-4">Riwayat Absensi</h3><div className="space-y-3 max-h-[70vh] overflow-y-auto pr-2">{sortedAttendance.length > 0 ? (<div className="overflow-x-auto"><table className="min-w-full bg-white"><thead className="bg-gray-50"><tr><th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase">Tanggal</th><th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase">Nama</th><th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase">Shift</th><th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase">Jam Kerja</th><th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase">Lembur</th><th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase">Aksi</th></tr></thead><tbody className="divide-y divide-gray-200">{sortedAttendance.map(item => { const employeeData = employeesWithSalary.find(e => e.salaryId === item.salaryId); const overtimeText = item.isOvertime ? `${item.overtimeHours || 0}j ${item.overtimeMinutes || 0}m` : '-'; return (<tr key={item.id}><td className="py-2 px-3 text-sm">{new Date(item.date).toLocaleDateString('id-ID', {day:'2-digit', month:'short'})}</td><td className="py-2 px-3 text-sm font-medium">{employeeData?.name || 'N/A'}</td><td className="py-2 px-3 text-sm">{item.shift}</td><td className="py-2 px-3 text-sm">{item.clockIn} - {item.clockOut}</td><td className="py-2 px-3 text-sm">{overtimeText}</td><td className="py-2 px-3 text-sm"><button onClick={() => onDeleteAttendance(item.id)} className="text-red-500 hover:text-red-700"><TrashIcon className="h-4 w-4" /></button></td></tr>)})}</tbody></table></div>) : (<div className="flex items-center justify-center h-full text-center text-gray-500 py-16"><p>Belum ada data absensi yang perlu diproses.</p></div>)}</div></div>
        </div>
    );

    const renderSummaryTab = () => (
        <div>
            <div className="flex justify-between items-center mb-4"><h3 className="text-lg font-semibold text-gray-700">Ringkasan Gaji Karyawan</h3><button onClick={() => setIsFilterVisible(!isFilterVisible)} className="flex items-center space-x-2 text-gray-600 bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-lg text-sm font-semibold"><FilterIcon className="h-4 w-4" /><span>{isFilterVisible ? 'Sembunyikan' : 'Tampilkan'} Filter</span></button></div>
            {isFilterVisible && (<div className="bg-gray-50 p-4 rounded-lg mb-6 border"><div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end"><select value={filterEmployeeId} onChange={e => setFilterEmployeeId(e.target.value)} className="p-2 border rounded-md bg-white text-sm"><option value="">Pilih Karyawan</option>{employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select><input type="date" value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)} className="p-2 border rounded-md text-sm text-gray-500" /><input type="date" value={filterEndDate} onChange={e => setFilterEndDate(e.target.value)} className="p-2 border rounded-md text-sm text-gray-500" /><button onClick={handleAmbilAbsen} className="bg-cyan-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-cyan-700 w-full">Ambil Absen</button></div></div>)}
            <div className="overflow-x-auto"><table className="min-w-full bg-white"><thead className="bg-gray-50"><tr><th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Karyawan</th><th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Devisi</th><th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Periode</th><th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Total Gaji</th><th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Aksi</th></tr></thead><tbody className="divide-y divide-gray-200">{payrollRecords.map(record => { const emp = employees.find(e => e.id === record.employeeId); return (<tr key={record.id}><td className="py-4 px-4 font-medium">{emp?.name || 'N/A'}</td><td className="py-4 px-4">{emp?.division || 'N/A'}</td><td className="py-4 px-4 text-sm">{`${new Date(record.startDate).toLocaleDateString('id-ID')} - ${new Date(record.endDate).toLocaleDateString('id-ID')}`}</td><td className="py-4 px-4 font-semibold">{formatCurrency(record.totalSalary)}</td><td className="py-4 px-4 space-x-2"><button onClick={() => handleEditPayroll(record)} className="p-1.5 text-gray-500 hover:text-blue-600"><PencilIcon className="h-4 w-4"/></button><button onClick={() => handlePrintPayslip(record)} className="p-1.5 text-gray-500 hover:text-gray-800"><PrinterIcon className="h-4 w-4"/></button><button onClick={() => onRevertPayroll(record.id)} className="p-1.5 text-gray-500 hover:text-red-600"><TrashIcon className="h-4 w-4"/></button></td></tr>);})}</tbody></table>{payrollRecords.length === 0 && (<div className="text-center py-16 text-gray-500"><p>Belum ada data gaji yang diproses.</p></div>)}</div>
            {summaryModal.isOpen && summaryModal.data && (
                <SummaryEditModal
                    employee={employees.find(e => e.id === summaryModal.data.employeeId)!}
                    period={{ start: summaryModal.data.startDate, end: summaryModal.data.endDate }}
                    initialData={summaryModal.data}
                    onSave={handleSavePayroll}
                    onClose={() => setSummaryModal({ isOpen: false, data: null, isEditing: false })}
                />
            )}
        </div>
    );
    
    return (
        <div className="bg-white p-6 rounded-xl shadow-md">
            <h2 className="text-xl font-bold">Absensi dan Gaji</h2>
            {accessibleTabs.length > 1 && (
                 <div className="border-b border-gray-200 mt-4">
                    <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                        {accessibleTabs.map(tab => <TabButton key={tab.key} label={tab.label} tabKey={tab.key} />)}
                    </nav>
                </div>
            )}
            <div className="mt-6">
                {activeTab === 'attendance' && renderAttendanceTab()}
                {activeTab === 'summary' && renderSummaryTab()}
            </div>
        </div>
    );
};

export default Payroll;
