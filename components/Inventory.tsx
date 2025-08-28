

import React, { useState, useMemo } from 'react';
import { type InventoryItem, type StockUsageRecord } from '../types';
import { MagnifyingGlassIcon } from './Icons';

// Modal for viewing history
const StockHistoryModal: React.FC<{
    item: InventoryItem;
    onClose: () => void;
}> = ({ item, onClose }) => {
    const history = (item.usageHistory || []).slice(-10).reverse(); // last 10, newest first

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center border-b pb-3 mb-5">
                    <h3 className="text-xl font-bold text-gray-800">Riwayat Pemakaian: {item.name}</h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-2xl leading-none">&times;</button>
                </div>
                <div className="flex-1 overflow-y-auto pr-2">
                    {history.length > 0 ? (
                        <table className="min-w-full">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase">Tanggal</th>
                                    <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase">Jumlah Pemakaian</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {history.map((record, index) => (
                                    <tr key={index}>
                                        <td className="py-2 px-3 text-sm">{new Date(record.date).toLocaleDateString('id-ID')}</td>
                                        <td className="py-2 px-3 text-sm font-semibold">{record.amountUsed} {item.unit}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <p className="text-center text-gray-500 py-8">Belum ada riwayat pemakaian.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

// Modal for using stock
const UseStockModal: React.FC<{
    item: InventoryItem;
    onClose: () => void;
    onConfirm: (amount: number, usageDate: string) => void;
}> = ({ item, onClose, onConfirm }) => {
    const [amount, setAmount] = useState('');
    const [usageDate, setUsageDate] = useState(new Date().toISOString().substring(0, 10));

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const numAmount = parseFloat(amount);
        if (numAmount > 0) {
            onConfirm(numAmount, usageDate);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center border-b pb-3 mb-5">
                    <h3 className="text-xl font-bold text-gray-800">Pakai Stok: {item.name}</h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-2xl leading-none">&times;</button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="bg-gray-50 p-3 rounded-md">
                        <p className="text-sm text-gray-600">Stok Saat Ini</p>
                        <p className="text-lg font-bold">{item.stock} {item.unit}</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Jumlah Pemakaian</label>
                        <input
                            type="number"
                            value={amount}
                            onChange={e => setAmount(e.target.value)}
                            className="mt-1 w-full p-2 border rounded-md"
                            required
                            min="0.01"
                            step="0.01"
                            max={item.stock}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Tanggal Pemakaian</label>
                        <input
                            type="date"
                            value={usageDate}
                            onChange={e => setUsageDate(e.target.value)}
                            className="mt-1 w-full p-2 border rounded-md"
                            required
                        />
                    </div>
                    <div className="border-t pt-4 flex justify-end">
                        <button type="submit" className="bg-pink-600 text-white py-2 px-6 rounded-lg font-bold hover:bg-pink-700">Simpan</button>
                    </div>
                </form>
            </div>
        </div>
    );
};


interface InventoryProps {
    inventory: InventoryItem[];
    onUseStock: (itemId: number, amountUsed: number, usageDate: string) => void;
}

const Inventory: React.FC<InventoryProps> = ({ inventory, onUseStock }) => {
    const [historyItem, setHistoryItem] = useState<InventoryItem | null>(null);
    const [useStockItem, setUseStockItem] = useState<InventoryItem | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const handleConfirmUseStock = (item: InventoryItem, amount: number, usageDate: string) => {
        onUseStock(item.id, amount, usageDate);
        setUseStockItem(null);
    };

    const getStatus = (stock: number) => {
        if (stock <= 5) return { text: 'Stok Menipis', color: 'bg-red-100 text-red-800' };
        return { text: 'Tersedia', color: 'bg-cyan-100 text-cyan-800' };
    };

    const filteredInventory = useMemo(() => {
        if (!searchQuery) {
            return inventory;
        }
        const lowerCaseQuery = searchQuery.toLowerCase();
        return inventory.filter(item => 
            item.name.toLowerCase().includes(lowerCaseQuery) ||
            item.sku.toLowerCase().includes(lowerCaseQuery)
        );
    }, [inventory, searchQuery]);

    return (
        <>
            <div className="bg-white p-6 rounded-xl shadow-md">
                <h2 className="text-xl font-bold mb-4">Manajemen Stok / Inventori</h2>
                <div className="relative mb-4">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                        type="text"
                        placeholder="Cari nama produk atau SKU..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full md:w-1/3 pl-10 pr-4 py-2 border rounded-lg focus:ring-pink-500 focus:border-pink-500"
                    />
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full bg-white">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nama Produk</th>
                                <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU</th>
                                <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipe</th>
                                <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stok Saat Ini</th>
                                <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {filteredInventory.map(item => {
                                const status = getStatus(item.stock);
                                return (
                                    <tr key={item.id}>
                                        <td className="py-4 px-4 whitespace-nowrap">{item.name}</td>
                                        <td className="py-4 px-4 whitespace-nowrap">{item.sku}</td>
                                        <td className="py-4 px-4 whitespace-nowrap">
                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${item.type === 'Bahan Baku' ? 'bg-cyan-100 text-cyan-800' : 'bg-fuchsia-100 text-fuchsia-800'}`}>
                                                {item.type}
                                            </span>
                                        </td>
                                        <td className="py-4 px-4 whitespace-nowrap font-semibold">{`${item.stock} ${item.unit}`}</td>
                                        <td className="py-4 px-4 whitespace-nowrap">
                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${status.color}`}>
                                                {status.text}
                                            </span>
                                        </td>
                                        <td className="py-4 px-4 whitespace-nowrap space-x-4">
                                            <button 
                                                onClick={() => setHistoryItem(item)} 
                                                className="text-blue-600 hover:text-blue-900 font-medium"
                                                title="Lihat Riwayat Stok"
                                            >
                                                Lihat
                                            </button>
                                            <button 
                                                onClick={() => setUseStockItem(item)} 
                                                className="text-pink-600 hover:text-pink-900 font-medium"
                                                title="Pakai Stok Barang"
                                            >
                                                Pakai
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                     {filteredInventory.length === 0 && (
                        <div className="text-center py-16 text-gray-500">
                            <p>Tidak ada data inventori yang cocok.</p>
                        </div>
                    )}
                </div>
            </div>
            {historyItem && <StockHistoryModal item={historyItem} onClose={() => setHistoryItem(null)} />}
            {useStockItem && <UseStockModal item={useStockItem} onClose={() => setUseStockItem(null)} onConfirm={(amount, usageDate) => handleConfirmUseStock(useStockItem, amount, usageDate)} />}
        </>
    );
};

export default Inventory;