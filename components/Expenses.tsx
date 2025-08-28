
import React, { useState, useMemo, useEffect } from 'react';
import { type ExpenseItem } from '../types';
import { MagnifyingGlassIcon } from './Icons';
import Pagination from './Pagination';

const ITEMS_PER_PAGE = 20;

interface ExpensesProps {
  expenses: ExpenseItem[];
  onAddExpense: (newExpense: Omit<ExpenseItem, 'id'>) => void;
}

const formatCurrency = (value: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(value);

const Expenses: React.FC<ExpensesProps> = ({ expenses, onAddExpense }) => {
  const [expenseName, setExpenseName] = useState('');
  const [category, setCategory] = useState('Tinta & Bahan Cetak');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().substring(0, 10));
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseName || !amount) {
      alert('Nama pengeluaran dan jumlah tidak boleh kosong.');
      return;
    }
    
    onAddExpense({
      name: expenseName,
      category,
      amount: Number(amount),
      date,
    });
    
    // Reset form
    setExpenseName('');
    setCategory('Tinta & Bahan Cetak');
    setAmount('');
    setDate(new Date().toISOString().substring(0, 10));
  };

  const filteredExpenses = useMemo(() => {
    const sortedExpenses = [...expenses].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    if (!searchQuery) {
      return sortedExpenses;
    }
    const lowerCaseQuery = searchQuery.toLowerCase();
    return sortedExpenses.filter(expense =>
      expense.name.toLowerCase().includes(lowerCaseQuery) ||
      expense.category.toLowerCase().includes(lowerCaseQuery)
    );
  }, [expenses, searchQuery]);

  const paginatedExpenses = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredExpenses.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredExpenses, currentPage]);
  
  let lastDate: string | null = null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
      <div className="lg:col-span-2">
        <div className="bg-white p-6 rounded-xl shadow-md h-full">
          <h2 className="text-xl font-bold mb-4">Catat Pengeluaran Baru</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="expense-name" className="block text-sm font-medium text-gray-700">Nama Pengeluaran</label>
              <input 
                type="text" 
                id="expense-name"
                value={expenseName}
                onChange={(e) => setExpenseName(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-pink-500 focus:border-pink-500" 
                placeholder="e.g., Beli Tinta" 
                required
              />
            </div>
            <div>
              <label htmlFor="expense-category" className="block text-sm font-medium text-gray-700">Kategori</label>
              <select 
                id="expense-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)} 
                className="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-pink-500 focus:border-pink-500"
              >
                <option>Tinta & Bahan Cetak</option>
                <option>Kertas & Media</option>
                <option>Listrik & Air</option>
                <option>Gaji Karyawan</option>
                <option>Perawatan Mesin</option>
                <option>Lain-lain</option>
              </select>
            </div>
            <div>
              <label htmlFor="expense-amount" className="block text-sm font-medium text-gray-700">Jumlah</label>
              <input 
                type="number" 
                id="expense-amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-pink-500 focus:border-pink-500" 
                placeholder="e.g., 500000"
                required
                min="0"
              />
            </div>
            <div>
              <label htmlFor="expense-date" className="block text-sm font-medium text-gray-700">Tanggal</label>
              <input 
                type="date" 
                id="expense-date" 
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-pink-500 focus:border-pink-500" 
              />
            </div>
            <div className="pt-2">
              <button type="submit" className="w-full bg-pink-600 text-white py-2.5 rounded-lg font-bold hover:bg-pink-700 transition-colors">
                Simpan Pengeluaran
              </button>
            </div>
          </form>
        </div>
      </div>
      <div className="lg:col-span-3">
        <div className="bg-white p-6 rounded-xl shadow-md h-full flex flex-col">
          <h2 className="text-xl font-bold mb-4">Riwayat Pengeluaran</h2>
          <div className="relative mb-4">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
            </div>
            <input
                type="text"
                placeholder="Cari pengeluaran..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-pink-500 focus:border-pink-500"
            />
          </div>
          <div className="flex-1 overflow-y-auto pr-2">
            <table className="min-w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                    <tr>
                        <th className="py-2 px-3 text-left font-medium text-gray-600">Nama</th>
                        <th className="py-2 px-3 text-left font-medium text-gray-600">Kategori</th>
                        <th className="py-2 px-3 text-right font-medium text-gray-600">Jumlah</th>
                    </tr>
                </thead>
                <tbody>
                    {paginatedExpenses.length > 0 ? (
                        paginatedExpenses.map(expense => {
                            const showDateHeader = expense.date !== lastDate;
                            lastDate = expense.date;
                            return (
                                <React.Fragment key={expense.id}>
                                    {showDateHeader && (
                                    <tr className="bg-gray-100">
                                        <td colSpan={3} className="py-2 px-3 font-semibold text-gray-800">
                                            {new Date(expense.date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                                        </td>
                                    </tr>
                                    )}
                                    <tr className="border-b">
                                        <td className="py-3 px-3">{expense.name}</td>
                                        <td className="py-3 px-3 text-gray-600">{expense.category}</td>
                                        <td className="py-3 px-3 text-right font-semibold text-red-600">{formatCurrency(expense.amount)}</td>
                                    </tr>
                                </React.Fragment>
                            );
                        })
                    ) : (
                        <tr>
                            <td colSpan={3} className="text-center py-16 text-gray-500">
                                <p>Tidak ada data pengeluaran yang cocok.</p>
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
          </div>
          <Pagination
            totalItems={filteredExpenses.length}
            itemsPerPage={ITEMS_PER_PAGE}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
          />
        </div>
      </div>
    </div>
  );
};

export default Expenses;
