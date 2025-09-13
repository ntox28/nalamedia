import React, { useState, useEffect, useMemo } from 'react';
import { type SalaryData, type EmployeeData, type AttendanceData, type PayrollRecord, type Bonus, type Deduction } from '../types';
import { TrashIcon, PencilIcon, PrinterIcon, FilterIcon, CalendarDaysIcon, ArrowUturnLeftIcon } from './Icons';
import Pagination from './Pagination';

const ITEMS_PER_PAGE = 20;

type PayrollTab = 'attendance' | 'summary';

const TABS = [
    { key: 'attendance', label: 'Absensi Kerja' },
    { key: 'summary', label: 'Ringkasan Gaji' },
];

// --- Helper Functions ---
const timeToMinutes = (time: string): number => {
    if (!time || !time.includes(':')) return 0;
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
};

const formatCurrency = (amount: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
const formatDuration = (totalMinutes: number) => {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = Math.round(totalMinutes % 60);
    return `${hours} Jam ${minutes} Menit`;
};

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

const AttendanceFormModal: React.FC<{
    employee: { name: string; salaryId: number, division: string },
    recordToEdit?: AttendanceData,
    onSave: (data: Omit<AttendanceData, 'id'> | AttendanceData) => void,
    onClose: () => void,
    allAttendanceForEmployee: AttendanceData[],
}> = ({ employee, recordToEdit, onSave, onClose, allAttendanceForEmployee }) => {
    const [attendanceDate, setAttendanceDate] = useState(recordToEdit?.date || new Date().toISOString().substring(0, 10));
    const [shift, setShift] = useState<'Pagi' | 'Sore'>(recordToEdit?.shift || 'Pagi');
    const [clockIn, setClockIn] = useState(recordToEdit?.clockIn || '');
    const [clockOut, setClockOut] = useState(recordToEdit?.clockOut || '');
    const [isOvertime, setIsOvertime] = useState(recordToEdit?.isOvertime || false);
    const [overtimeHours, setOvertimeHours] = useState<string>(recordToEdit?.overtimeHours?.toString() || '0');
    const [overtimeMinutes, setOvertimeMinutes] = useState<string>(recordToEdit?.overtimeMinutes?.toString() || '0');
    const [overtimeNotes, setOvertimeNotes] = useState(recordToEdit?.overtimeNotes || '');
    
    useEffect(() => {
        if (!recordToEdit) {
            if (shift === 'Pagi') { setClockIn('09:00'); setClockOut('17:00'); }
            else { setClockIn('17:00'); setClockOut('01:00'); }
        }
    }, [shift, recordToEdit]);
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const isDuplicateDate = allAttendanceForEmployee.some(
            att => att.date === attendanceDate && att.id !== recordToEdit?.id
        );
        if (isDuplicateDate) {
            alert(`Karyawan ini sudah memiliki data absen pada tanggal ${new Date(attendanceDate).toLocaleDateString('id-ID')}.`);
            return;
        }

        const data = {
            salaryId: employee.salaryId,
            date: attendanceDate,
            shift, clockIn, clockOut, isOvertime,
            overtimeHours: isOvertime ? Number(overtimeHours) : 0,
            overtimeMinutes: isOvertime ? Number(overtimeMinutes) : 0,
            overtimeNotes: isOvertime ? overtimeNotes : '',
        };

        if (recordToEdit) {
            onSave({ ...data, id: recordToEdit.id });
        } else {
            onSave(data);
        }
    };

    return (
        <ReusableModal title={recordToEdit ? `Edit Absen ${employee.name}` : `Tambah Absen ${employee.name}`} onClose={onClose}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-sm font-medium text-gray-700">Tanggal Absen</label><input type="date" value={attendanceDate} onChange={e => setAttendanceDate(e.target.value)} className="mt-1 w-full p-2 border rounded-md" /></div>
                    <div><label className="block text-sm font-medium text-gray-700">Shift</label><select value={shift} onChange={e => setShift(e.target.value as 'Pagi' | 'Sore')} className="mt-1 w-full p-2 border bg-white rounded-md"><option value="Pagi">Pagi</option><option value="Sore">Sore</option></select></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-sm font-medium text-gray-700">Jam Masuk</label><input type="time" value={clockIn} onChange={e => setClockIn(e.target.value)} className="mt-1 w-full p-2 border rounded-md" /></div>
                    <div><label className="block text-sm font-medium text-gray-700">Jam Keluar</label><input type="time" value={clockOut} onChange={e => setClockOut(e.target.value)} className="mt-1 w-full p-2 border rounded-md" /></div>
                </div>
                <div><label className="flex items-center space-x-2"><input type="checkbox" checked={isOvertime} onChange={e => setIsOvertime(e.target.checked)} className="h-4 w-4 rounded text-pink-600 focus:ring-pink-500" /><span className="text-sm font-medium text-gray-700">Lembur</span></label></div>
                {isOvertime && (<div className="p-4 border rounded-md bg-gray-50 space-y-4"><div className="grid grid-cols-2 gap-4"><div><label className="block text-sm font-medium text-gray-700">Jam Lembur</label><input type="number" value={overtimeHours} onChange={e => setOvertimeHours(e.target.value)} className="mt-1 w-full p-2 border rounded-md" min="0" /></div><div><label className="block text-sm font-medium text-gray-700">Menit Lembur</label><input type="number" value={overtimeMinutes} onChange={e => setOvertimeMinutes(e.target.value)} className="mt-1 w-full p-2 border rounded-md" min="0" max="59" /></div></div><div><label className="block text-sm font-medium text-gray-700">Catatan Lembur</label><textarea value={overtimeNotes} onChange={e => setOvertimeNotes(e.target.value)} rows={2} className="mt-1 w-full p-2 border rounded-md" placeholder="e.g., Menyelesaikan pekerjaan..."></textarea></div></div>)}
                <div className="border-t pt-4 flex justify-end"><button type="submit" className="w-full bg-pink-600 text-white py-2.5 rounded-lg font-bold hover:bg-pink-700">Simpan Absensi</button></div>
            </form>
        </ReusableModal>
    );
};

const AttendanceDetailModal: React.FC<{
    employee: { name: string; salaryId: number, division: string, employeeId: number },
    attendanceRecords: AttendanceData[],
    onClose: () => void,
    onAdd: () => void,
    onEdit: (record: AttendanceData) => void,
    onDelete: (id: number) => void,
}> = ({ employee, attendanceRecords, onClose, onAdd, onEdit, onDelete }) => {
    return (
        <ReusableModal title={`Detail Absensi: ${employee.name}`} onClose={onClose} maxWidth="max-w-3xl">
            <div className="space-y-4">
                <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="py-2 px-3 text-left">Tanggal</th>
                            <th className="py-2 px-3 text-left">Shift</th>
                            <th className="py-2 px-3 text-left">Jam Kerja</th>
                            <th className="py-2 px-3 text-left">Lembur</th>
                            <th className="py-2 px-3 text-left">Aksi</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {attendanceRecords.map(att => (
                            <tr key={att.id}>
                                <td className="py-2 px-3">{new Date(att.date).toLocaleDateString('id-ID')}</td>
                                <td className="py-2 px-3">{att.shift}</td>
                                <td className="py-2 px-3">{att.clockIn} - {att.clockOut}</td>
                                <td className="py-2 px-3">{att.isOvertime ? `${att.overtimeHours || 0}j ${att.overtimeMinutes || 0}m` : '-'}</td>
                                <td className="py-2 px-3 space-x-2">
                                    <button onClick={() => onEdit(att)} className="p-1 text-blue-600 hover:text-blue-800"><PencilIcon className="h-4 w-4" /></button>
                                    <button onClick={() => onDelete(att.id)} className="p-1 text-red-600 hover:text-red-800"><TrashIcon className="h-4 w-4" /></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {attendanceRecords.length === 0 && <p className="text-center text-gray-500 py-4">Belum ada data absensi.</p>}
            </div>
            <div className="border-t pt-4 mt-4 flex justify-between">
                <button onClick={onClose} className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-semibold hover:bg-gray-300">Selesai</button>
                <button onClick={onAdd} className="bg-cyan-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-cyan-700">Tambah Absen</button>
            </div>
        </ReusableModal>
    );
};


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
    onUpdateAttendance: (updatedAttendance: AttendanceData) => void;
    onDeleteAttendance: (id: number) => void;
    onBulkDeleteAttendance: (ids: number[]) => void;
    onProcessPayroll: (employeeId: number, startDate: string, endDate: string, baseSalary: number, overtimePay: number, bonuses: Bonus[], deductions: Deduction[], processedAttendance: AttendanceData[]) => void;
    onUpdatePayroll: (updatedRecord: PayrollRecord) => void;
    onRevertPayroll: (payrollRecordId: number) => void;
    onDeletePayrollPermanently: (record: PayrollRecord) => void;
}

const Payroll: React.FC<PayrollProps> = ({ salaries, employees, attendance, payrollRecords, menuPermissions, onAddAttendance, onUpdateAttendance, onDeleteAttendance, onBulkDeleteAttendance, onProcessPayroll, onUpdatePayroll, onRevertPayroll, onDeletePayrollPermanently }) => {
    const accessibleTabs = useMemo(() => TABS.filter(tab => menuPermissions.includes(`payroll/${tab.key}`)), [menuPermissions]);
    const [activeTab, setActiveTab] = useState<string>(accessibleTabs.length > 0 ? accessibleTabs[0].key : '');

    // Modals state for Attendance tab
    const [detailModalEmployee, setDetailModalEmployee] = useState<any | null>(null);
    const [formModalState, setFormModalState] = useState<{ isOpen: boolean; employee: any, recordToEdit?: AttendanceData }>({ isOpen: false, employee: null });
    
    // Summary tab state
    const [isFilterVisible, setIsFilterVisible] = useState(true);
    const [filterEmployeeId, setFilterEmployeeId] = useState('');
    const [filterStartDate, setFilterStartDate] = useState('');
    const [filterEndDate, setFilterEndDate] = useState('');
    const [summaryModal, setSummaryModal] = useState<{ isOpen: boolean; data: any | null; isEditing: boolean }>({ isOpen: false, data: null, isEditing: false });
    const [currentPage, setCurrentPage] = useState(1);

    useEffect(() => {
        if (accessibleTabs.length > 0 && !accessibleTabs.some(t => t.key === activeTab)) {
            setActiveTab(accessibleTabs[0].key);
        }
    }, [accessibleTabs, activeTab]);
    
    useEffect(() => {
        setCurrentPage(1);
    }, [activeTab, filterEmployeeId, filterStartDate, filterEndDate]);

    const employeesWithSalary = useMemo(() => {
        return salaries.map(salary => {
            const employee = employees.find(emp => emp.id === salary.employeeId);
            return {
                salaryId: salary.id,
                employeeId: salary.employeeId,
                name: employee?.name || 'Karyawan Tidak Ditemukan',
                division: employee?.division || 'N/A',
            };
        }).sort((a,b) => a.name.localeCompare(b.name));
    }, [salaries, employees]);

    const availableAttendance = useMemo(() => {
        const processedAttendanceIds = new Set(
            payrollRecords.flatMap(record => record.processedAttendance.map(att => att.id))
        );
        return attendance.filter(att => !processedAttendanceIds.has(att.id));
    }, [attendance, payrollRecords]);

    const handleSaveAttendance = (data: Omit<AttendanceData, 'id'> | AttendanceData) => {
        if ('id' in data) {
            onUpdateAttendance(data);
        } else {
            onAddAttendance(data);
        }
        setFormModalState({ isOpen: false, employee: null });
        // After saving, reopen the detail modal to see the changes
        const updatedEmployee = employeesWithSalary.find(e => e.salaryId === data.salaryId);
        if(updatedEmployee) setDetailModalEmployee(updatedEmployee);
    };

    const handleDeleteSingleAttendance = (id: number) => {
        if (window.confirm('Yakin ingin menghapus data absen ini?')) {
            onDeleteAttendance(id);
        }
    };
    
    const handleResetAttendance = (employeeId: number) => {
        if(window.confirm('Anda Yakin ingin mereset semua Absen Ini?')) {
            const attendanceIdsToDelete = availableAttendance
                .filter(att => {
                    const salary = salaries.find(s => s.id === att.salaryId);
                    return salary?.employeeId === employeeId;
                })
                .map(att => att.id);
            if (attendanceIdsToDelete.length > 0) {
                onBulkDeleteAttendance(attendanceIdsToDelete);
            } else {
                alert('Tidak ada data absensi untuk direset.');
            }
        }
    };

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
        let totalWorkMinutes = 0;
        record.processedAttendance.forEach(att => {
            const clockInMinutes = timeToMinutes(att.clockIn);
            let clockOutMinutes = timeToMinutes(att.clockOut);
            if (clockOutMinutes < clockInMinutes) { clockOutMinutes += 24 * 60; }
            totalWorkMinutes += clockOutMinutes - clockInMinutes;
        });
        const workDurationText = `(${formatDuration(totalWorkMinutes)})`;
        let totalOvertimeMinutes = 0;
        record.processedAttendance.forEach(att => {
            if (att.isOvertime) { totalOvertimeMinutes += (att.overtimeHours || 0) * 60 + (att.overtimeMinutes || 0); }
        });
        const overtimeDurationText = `(${formatDuration(totalOvertimeMinutes)})`;
        const totalBonus = record.bonuses.reduce((sum, b) => sum + b.amount, 0);
        const totalDeduction = record.deductions.reduce((sum, d) => sum + d.amount, 0);
        const totalPendapatan = record.baseSalary + record.overtimePay + totalBonus;
        const renderBonusRows = () => record.bonuses.map(b => `<tr><td>${b.notes}</td><td class="currency">${formatCurrency(b.amount)}</td></tr>`).join('');
        const renderDeductionRows = () => record.deductions.map(d => `<tr><td>${d.notes}</td><td class="currency">(${formatCurrency(d.amount)})</td></tr>`).join('');
        const content = `<html><head><title>Slip Gaji - ${employee.name}</title><style>body{font-family:sans-serif;font-size:10pt;color:#333}.container{width:100%;max-width:800px;margin:auto}.header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:10px;border-bottom:2px solid #000}.header-left h1{font-size:18pt;font-weight:bold;margin:0;line-height:1}.header-left p{font-size:9pt;margin:4px 0 0 0;line-height:1.3}.header-right{text-align:right}.header-right h2{font-size:16pt;font-weight:bold;margin:0}.header-right p{font-size:10pt;margin:2px 0 0 0}.content{margin-top:10px}table{width:100%;border-collapse:collapse;margin-bottom:20px}th,td{padding:6px;text-align:left}th{background-color:#f2f2f2;border-bottom:1px solid #ccc}.details-table td{border-bottom:1px solid #eee}.currency{text-align:right}.summary-section{margin-top:10px;padding-top:10px;border-top:1px solid #ccc}.summary-item{display:flex;justify-content:space-between;padding:4px 0}.total{font-weight:bold;font-size:12pt}.duration-text{font-size:8pt;color:#555;display:block}</style></head><body><div class="container"><div class="header"><div class="header-left"><h1>Nala Media Digital Printing</h1><p>Jl. Prof. Moh. Yamin, Cerbonan, Karanganyar<br/>Telp/WA: 0813-9872-7722</p></div><div class="header-right"><h2>SLIP GAJI</h2><p><strong>${employee.name}</strong></p><p>Periode: ${new Date(record.startDate).toLocaleDateString('id-ID')} - ${new Date(record.endDate).toLocaleDateString('id-ID')}</p></div></div><div class="content"><div style="display:flex;justify-content:space-between;gap:30px"><div style="flex:1"><h3>Pendapatan</h3><table class="details-table"><tbody><tr><td>Gaji Pokok <span class="duration-text">${workDurationText}</span></td><td class="currency">${formatCurrency(record.baseSalary)}</td></tr><tr><td>Lembur <span class="duration-text">${overtimeDurationText}</span></td><td class="currency">${formatCurrency(record.overtimePay)}</td></tr>${renderBonusRows()}<tr style="font-weight:bold;background-color:#f9f9f9"><td>Total Pendapatan</td><td class="currency">${formatCurrency(totalPendapatan)}</td></tr></tbody></table></div><div style="flex:1"><h3>Potongan</h3><table class="details-table"><tbody>${renderDeductionRows()}<tr style="font-weight:bold;background-color:#f9f9f9"><td>Total Potongan</td><td class="currency">(${formatCurrency(totalDeduction)})</td></tr></tbody></table></div></div><div class="summary-section"><div class="summary-item total" style="background-color:#f0f0f0;padding:10px;border-radius:5px"><span>GAJI BERSIH (Take Home Pay)</span><span>${formatCurrency(record.totalSalary)}</span></div></div></div></div></body></html>`;
        const printWindow = window.open('', '_blank');
        if (printWindow) { printWindow.document.write(content); printWindow.document.close(); printWindow.focus(); setTimeout(() => { printWindow.print(); printWindow.close(); }, 250); }
    };
    
    const filteredPayrollRecords = useMemo(() => {
        return payrollRecords
            .filter(record => {
                if (filterEmployeeId && record.employeeId !== Number(filterEmployeeId)) return false;
                if (filterStartDate && record.endDate < filterStartDate) return false;
                if (filterEndDate && record.startDate > filterEndDate) return false;
                return true;
            })
            .sort((a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime());
    }, [payrollRecords, filterEmployeeId, filterStartDate, filterEndDate]);

    const paginatedPayrollRecords = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredPayrollRecords.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [filteredPayrollRecords, currentPage]);

    const handleResetFilters = () => {
        setFilterEmployeeId('');
        setFilterStartDate('');
        setFilterEndDate('');
    };

    const handleRevertClick = (recordId: number) => {
        if (window.confirm('Anda yakin ingin mengembalikan riwayat gaji ini? Tindakan ini akan menghapus catatan gaji dan mengembalikan data absensi ke daftar absensi kerja.')) {
            onRevertPayroll(recordId);
        }
    };
    
    // UI RENDER METHODS
    const TabButton: React.FC<{ label: string; tabKey: string; }> = ({ label, tabKey }) => (
        <button onClick={() => setActiveTab(tabKey)} className={`${ activeTab === tabKey ? 'border-pink-500 text-pink-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300' } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}>{label}</button>
    );

    const renderAttendanceTab = () => {
        const attendanceSummary = employeesWithSalary.map(emp => {
            const empAttendance = availableAttendance.filter(att => {
                const salary = salaries.find(s => s.id === att.salaryId);
                return salary?.employeeId === emp.employeeId;
            });
            let regularMinutes = 0;
            let overtimeMinutes = 0;
            empAttendance.forEach(att => {
                const clockInMins = timeToMinutes(att.clockIn);
                let clockOutMins = timeToMinutes(att.clockOut);
                if (clockOutMins < clockInMins) clockOutMins += 24 * 60;
                regularMinutes += clockOutMins - clockInMins;
                if (att.isOvertime) {
                    overtimeMinutes += (att.overtimeHours || 0) * 60 + (att.overtimeMinutes || 0);
                }
            });
            return { ...emp, regularMinutes, overtimeMinutes };
        });

        return (
            <div className="overflow-x-auto">
                <table className="min-w-full bg-white">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Nama</th>
                            <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Devisi</th>
                            <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Jumlah Jam Regular</th>
                            <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Jumlah Jam Lembur</th>
                            <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Aksi</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {attendanceSummary.map(summary => (
                            <tr key={summary.employeeId}>
                                <td className="py-4 px-4 font-medium">{summary.name}</td>
                                <td className="py-4 px-4">{summary.division}</td>
                                <td className="py-4 px-4">{formatDuration(summary.regularMinutes)}</td>
                                <td className="py-4 px-4">{formatDuration(summary.overtimeMinutes)}</td>
                                <td className="py-4 px-4 space-x-2">
                                    <button onClick={() => setDetailModalEmployee(summary)} className="bg-cyan-100 text-cyan-800 px-3 py-1 rounded-md text-xs font-semibold hover:bg-cyan-200">Perbarui</button>
                                    <button onClick={() => handleResetAttendance(summary.employeeId)} className="bg-red-100 text-red-800 px-3 py-1 rounded-md text-xs font-semibold hover:bg-red-200">Reset</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    };

    const renderSummaryTab = () => (
        <div>
            <div className="flex justify-between items-center mb-4"><h3 className="text-lg font-semibold text-gray-700">Ringkasan Gaji Karyawan</h3><button onClick={() => setIsFilterVisible(!isFilterVisible)} className="flex items-center space-x-2 text-gray-600 bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-lg text-sm font-semibold"><FilterIcon className="h-4 w-4" /><span>{isFilterVisible ? 'Sembunyikan' : 'Tampilkan'} Filter</span></button></div>
            {isFilterVisible && (<div className="bg-gray-50 p-4 rounded-lg mb-6 border"><div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end"><select value={filterEmployeeId} onChange={e => setFilterEmployeeId(e.target.value)} className="p-2 border rounded-md bg-white text-sm"><option value="">Pilih Karyawan</option>{employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select><input type="date" value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)} className="p-2 border rounded-md text-sm text-gray-500" /><input type="date" value={filterEndDate} onChange={e => setFilterEndDate(e.target.value)} className="p-2 border rounded-md text-sm text-gray-500" /><div className="flex space-x-2 md:col-span-1"><button onClick={handleAmbilAbsen} className="bg-cyan-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-cyan-700 w-full">Ambil Absen</button><button onClick={handleResetFilters} className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-300 w-full">Reset</button></div></div></div>)}
            <div className="overflow-x-auto"><table className="min-w-full bg-white"><thead className="bg-gray-50"><tr><th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Karyawan</th><th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Devisi</th><th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Periode</th><th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Total Gaji</th><th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Aksi</th></tr></thead><tbody className="divide-y divide-gray-200">{paginatedPayrollRecords.map(record => { const emp = employees.find(e => e.id === record.employeeId); return (<tr key={record.id}><td className="py-4 px-4 font-medium">{emp?.name || 'N/A'}</td><td className="py-4 px-4">{emp?.division || 'N/A'}</td><td className="py-4 px-4 text-sm">{`${new Date(record.startDate).toLocaleDateString('id-ID')} - ${new Date(record.endDate).toLocaleDateString('id-ID')}`}</td><td className="py-4 px-4 font-semibold">{formatCurrency(record.totalSalary)}</td><td className="py-4 px-4 space-x-2"><button onClick={() => handleEditPayroll(record)} className="p-1.5 text-gray-500 hover:text-blue-600" title="Edit Bonus/Potongan"><PencilIcon className="h-4 w-4"/></button><button onClick={() => handlePrintPayslip(record)} className="p-1.5 text-gray-500 hover:text-gray-800" title="Cetak Slip Gaji"><PrinterIcon className="h-4 w-4"/></button><button onClick={() => handleRevertClick(record.id)} className="p-1.5 text-gray-500 hover:text-green-600" title="Kembalikan ke Absen"><ArrowUturnLeftIcon className="h-4 w-4" /></button><button onClick={() => onDeletePayrollPermanently(record)} className="p-1.5 text-gray-500 hover:text-red-600" title="Hapus Permanen"><TrashIcon className="h-4 w-4"/></button></td></tr>);})}</tbody></table>{filteredPayrollRecords.length === 0 && (<div className="text-center py-16 text-gray-500"><p>Belum ada data gaji yang diproses.</p></div>)}</div>
             <Pagination
                totalItems={filteredPayrollRecords.length}
                itemsPerPage={ITEMS_PER_PAGE}
                currentPage={currentPage}
                onPageChange={setCurrentPage}
            />
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
            {detailModalEmployee && (
                <AttendanceDetailModal
                    employee={detailModalEmployee}
                    attendanceRecords={availableAttendance.filter(att => {
                        const salary = salaries.find(s => s.id === att.salaryId);
                        return salary?.employeeId === detailModalEmployee.employeeId;
                    })}
                    onClose={() => setDetailModalEmployee(null)}
                    onAdd={() => {
                        setDetailModalEmployee(null); // Close detail modal first
                        setFormModalState({ isOpen: true, employee: detailModalEmployee });
                    }}
                    onEdit={(record) => {
                        setDetailModalEmployee(null); // Close detail modal first
                        setFormModalState({ isOpen: true, employee: detailModalEmployee, recordToEdit: record });
                    }}
                    onDelete={handleDeleteSingleAttendance}
                />
            )}
            {formModalState.isOpen && (
                 <AttendanceFormModal
                    employee={formModalState.employee}
                    recordToEdit={formModalState.recordToEdit}
                    onClose={() => setFormModalState({ isOpen: false, employee: null })}
                    onSave={handleSaveAttendance}
                    allAttendanceForEmployee={availableAttendance.filter(att => {
                         const salary = salaries.find(s => s.id === att.salaryId);
                         return salary?.employeeId === formModalState.employee.employeeId;
                    })}
                />
            )}
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