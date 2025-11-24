
import React, { useState, useMemo, useEffect } from 'react';
import { type SavedOrder, type OrderItemData, type ProductData, type FinishingData, type CustomerData, type CategoryData, type InventoryItem, type SupplierData, type ExpenseItem, type EmployeeData, type SalaryData } from '../types';
import { PencilIcon, TrashIcon, PlusCircleIcon, MagnifyingGlassIcon } from './Icons';
import Pagination from './Pagination';

const ITEMS_PER_PAGE = 20;

// --- START: MODAL COMPONENTS ---

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

const EditInventoryModal: React.FC<{ 
    item?: InventoryItem | null; 
    onSave: (data: InventoryItem | Omit<InventoryItem, 'id'>) => void; 
    onClose: () => void;
}> = ({ item, onSave, onClose }) => {
    const [formData, setFormData] = useState({
        name: item?.name || '',
        sku: item?.sku || '',
        stock: item?.stock?.toString() || '0',
        unit: item?.unit || 'pcs',
        type: item?.type || 'Bahan Baku'
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const dataToSave = {
            ...formData,
            stock: Number(formData.stock),
            type: formData.type as 'Bahan Baku' | 'Barang Jadi',
        };
        if (item?.id) {
            onSave({ ...dataToSave, id: item.id });
        } else {
            onSave(dataToSave);
        }
    };

    return (
        <ReusableModal title={item ? "Edit Item Stok" : "Tambah Item Stok"} onClose={onClose}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div><label className="block text-sm font-medium">Nama Item</label><input name="name" value={formData.name} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" required /></div>
                <div><label className="block text-sm font-medium">SKU</label><input name="sku" value={formData.sku} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" required /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-sm font-medium">Stok</label><input name="stock" type="number" value={formData.stock} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" required /></div>
                  <div><label className="block text-sm font-medium">Satuan</label><input name="unit" value={formData.unit} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" required /></div>
                </div>
                <div>
                    <label className="block text-sm font-medium">Tipe</label>
                    <select name="type" value={formData.type} onChange={handleChange} className="mt-1 w-full p-2 border bg-white rounded-md">
                        <option value="Bahan Baku">Bahan Baku</option>
                        <option value="Barang Jadi">Barang Jadi</option>
                    </select>
                </div>
                <div className="border-t pt-4 flex justify-end"><button type="submit" className="bg-pink-600 text-white py-2 px-6 rounded-lg font-bold hover:bg-pink-700">Simpan</button></div>
            </form>
        </ReusableModal>
    );
};


const EditCategoryModal: React.FC<{ category: CategoryData; onSave: (data: CategoryData) => void; onClose: () => void }> = ({ category, onSave, onClose }) => {
    const [name, setName] = useState(category.name);
    const [unitType, setUnitType] = useState(category.unitType);
    const handleSubmit = (e: React.FormEvent) => { 
        e.preventDefault(); 
        onSave({ ...category, name, unitType }); 
    };
    return (
        <ReusableModal title="Edit Kategori" onClose={onClose}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium">Nama Kategori</label>
                    <input value={name} onChange={e => setName(e.target.value)} className="mt-1 w-full p-2 border border-gray-300 rounded-md" required />
                </div>
                 <div>
                    <label className="block text-sm font-medium">Tipe Satuan</label>
                    <select value={unitType} onChange={e => setUnitType(e.target.value as CategoryData['unitType'])} className="mt-1 w-full p-2 border border-gray-300 rounded-md bg-white" required>
                      <option value="Per Buah">Per Buah (Contoh: pcs, box, rim)</option>
                      <option value="Per Luas">Per Luas (Contoh: m²)</option>
                    </select>
                </div>
                <div className="border-t pt-4 flex justify-end"><button type="submit" className="bg-pink-600 text-white py-2 px-6 rounded-lg font-bold hover:bg-pink-700">Simpan</button></div>
            </form>
        </ReusableModal>
    );
};

const EditFinishingModal: React.FC<{ finishing: FinishingData; categories: CategoryData[]; onSave: (data: FinishingData) => void; onClose: () => void }> = ({ finishing, categories, onSave, onClose }) => {
    const [formData, setFormData] = useState(finishing);
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: name === 'price' ? Number(value) : value }));
    };
    const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const selectedIds = Array.from(e.target.selectedOptions, (option: HTMLOptionElement) => Number(option.value));
        setFormData(prev => ({ ...prev, categoryIds: selectedIds }));
    };
    const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); onSave(formData); };
    return (
        <ReusableModal title="Edit Finishing" onClose={onClose}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium">Nama Finishing</label>
                    <input name="name" value={formData.name} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" required />
                </div>
                <div>
                    <label className="block text-sm font-medium">Harga</label>
                    <input name="price" type="number" value={formData.price} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" required />
                </div>
                <div>
                    <label className="block text-sm font-medium">Kategori Terkait (opsional)</label>
                    <select multiple value={formData.categoryIds?.map(String) || []} onChange={handleCategoryChange} className="mt-1 w-full h-32 p-2 border rounded-md">
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>
                <div className="border-t pt-4 flex justify-end"><button type="submit" className="bg-pink-600 text-white py-2 px-6 rounded-lg font-bold hover:bg-pink-700">Simpan</button></div>
            </form>
        </ReusableModal>
    );
};

const EditCustomerModal: React.FC<{ customer: CustomerData; onSave: (data: CustomerData) => void; onClose: () => void }> = ({ customer, onSave, onClose }) => {
    const [formData, setFormData] = useState(customer);
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };
    const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); onSave(formData); };
    return (
        <ReusableModal title="Edit Pelanggan" onClose={onClose}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div><label className="block text-sm font-medium">Nama</label><input name="name" value={formData.name} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" required /></div>
                <div><label className="block text-sm font-medium">Kontak</label><input name="contact" value={formData.contact} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" required /></div>
                <div>
                    <label className="block text-sm font-medium">Level Harga</label>
                    <select name="level" value={formData.level} onChange={handleChange} className="mt-1 w-full p-2 border bg-white rounded-md">
                         <option value="End Customer">End Customer</option><option value="Retail">Retail</option><option value="Grosir">Grosir</option><option value="Reseller">Reseller</option><option value="Corporate">Corporate</option>
                    </select>
                </div>
                <div className="border-t pt-4 flex justify-end"><button type="submit" className="bg-pink-600 text-white py-2 px-6 rounded-lg font-bold hover:bg-pink-700">Simpan</button></div>
            </form>
        </ReusableModal>
    );
};

const EditSupplierModal: React.FC<{ supplier: SupplierData; onSave: (data: SupplierData) => void; onClose: () => void }> = ({ supplier, onSave, onClose }) => {
    const [formData, setFormData] = useState(supplier);
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };
    const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); onSave(formData); };
    return (
        <ReusableModal title="Edit Supplier" onClose={onClose}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div><label className="block text-sm font-medium">Nama</label><input name="name" value={formData.name} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" required /></div>
                <div><label className="block text-sm font-medium">Narahubung</label><input name="contactPerson" value={formData.contactPerson} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" required /></div>
                <div><label className="block text-sm font-medium">Telepon</label><input name="phone" value={formData.phone} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" required /></div>
                <div><label className="block text-sm font-medium">Spesialisasi</label><input name="specialty" value={formData.specialty} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" required /></div>
                <div className="border-t pt-4 flex justify-end"><button type="submit" className="bg-pink-600 text-white py-2 px-6 rounded-lg font-bold hover:bg-pink-700">Simpan</button></div>
            </form>
        </ReusableModal>
    );
};

const EditExpenseModal: React.FC<{ expense: ExpenseItem; onSave: (data: ExpenseItem) => void; onClose: () => void }> = ({ expense, onSave, onClose }) => {
    const [formData, setFormData] = useState(expense);
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: name === 'amount' ? Number(value) : value }));
    };
    const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); onSave(formData); };
    return (
        <ReusableModal title="Edit Pengeluaran" onClose={onClose}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div><label className="block text-sm font-medium">Nama</label><input name="name" value={formData.name} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" required /></div>
                <div>
                    <label className="block text-sm font-medium">Kategori</label>
                    <select name="category" value={formData.category} onChange={handleChange} className="mt-1 w-full p-2 border bg-white rounded-md">
                        <option>Tinta & Bahan Cetak</option>
                        <option>Kertas & Media</option>
                        <option>Listrik & Air</option>
                        <option>Gaji Karyawan</option>
                        <option>Perawatan Mesin</option>
                        <option>Lain-lain</option>
                    </select>
                </div>
                <div><label className="block text-sm font-medium">Jumlah</label><input name="amount" type="number" value={formData.amount} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" required /></div>
                <div><label className="block text-sm font-medium">Tanggal</label><input name="date" type="date" value={formData.date} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" required /></div>
                <div className="border-t pt-4 flex justify-end"><button type="submit" className="bg-pink-600 text-white py-2 px-6 rounded-lg font-bold hover:bg-pink-700">Simpan</button></div>
            </form>
        </ReusableModal>
    );
};

const EditEmployeeModal: React.FC<{ employee: EmployeeData; onSave: (data: EmployeeData) => void; onClose: () => void }> = ({ employee, onSave, onClose }) => {
    const [formData, setFormData] = useState(employee);
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };
    const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); onSave(formData); };
    return (
        <ReusableModal title="Edit Karyawan" onClose={onClose}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div><label className="block text-sm font-medium">Nama</label><input name="name" value={formData.name} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" required /></div>
                <div><label className="block text-sm font-medium">Kontak</label><input name="contact" value={formData.contact} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" required /></div>
                <div>
                    <label className="block text-sm font-medium">Devisi</label>
                    <select name="division" value={formData.division} onChange={handleChange} className="mt-1 w-full p-2 border bg-white rounded-md">
                        <option value="Kasir">Kasir</option>
                        <option value="Office">Office</option>
                        <option value="Produksi">Produksi</option>
                    </select>
                </div>
                <div className="border-t pt-4 flex justify-end"><button type="submit" className="bg-pink-600 text-white py-2 px-6 rounded-lg font-bold hover:bg-pink-700">Simpan</button></div>
            </form>
        </ReusableModal>
    );
};

const SalaryModal: React.FC<{
    salary?: SalaryData | null;
    employees: EmployeeData[];
    onSave: (data: SalaryData | Omit<SalaryData, 'id'>) => void;
    onClose: () => void;
}> = ({ salary, employees, onSave, onClose }) => {
    const [employeeId, setEmployeeId] = useState<string>(salary?.employeeId.toString() || '');
    const [division, setDivision] = useState<'Kasir' | 'Office' | 'Produksi' | ''>(salary?.division || '');
    const [regularRate, setRegularRate] = useState<string>(salary?.regularRate.toString() || '');
    const [overtimeRate, setOvertimeRate] = useState<string>(salary?.overtimeRate.toString() || '');

    useEffect(() => {
        if (employeeId) {
            const selectedEmployee = employees.find(e => e.id === Number(employeeId));
            if (selectedEmployee) {
                setDivision(selectedEmployee.division);
            }
        } else {
            setDivision('');
        }
    }, [employeeId, employees]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!employeeId || !division) {
            alert("Pilih karyawan terlebih dahulu.");
            return;
        }
        const dataToSave = {
            employeeId: Number(employeeId),
            division,
            regularRate: Number(regularRate),
            overtimeRate: Number(overtimeRate),
        };
        if (salary?.id) {
            onSave({ ...dataToSave, id: salary.id });
        } else {
            onSave(dataToSave);
        }
    };

    return (
        <ReusableModal title={salary ? "Edit Gaji" : "Tambah Gaji"} onClose={onClose}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium">Karyawan</label>
                    <select
                        value={employeeId}
                        onChange={e => setEmployeeId(e.target.value)}
                        className="mt-1 w-full p-2 border bg-white rounded-md"
                        required
                        disabled={!!salary} // Disable changing employee on edit
                    >
                        <option value="">Pilih Karyawan</option>
                        {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium">Devisi</label>
                    <input
                        type="text"
                        value={division}
                        readOnly
                        className="mt-1 w-full p-2 border rounded-md bg-gray-100"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium">Gaji Regular/Jam (Rp.)</label>
                    <input
                        type="number"
                        value={regularRate}
                        onChange={e => setRegularRate(e.target.value)}
                        className="mt-1 w-full p-2 border rounded-md"
                        required
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium">Gaji Lembur/Jam (Rp.)</label>
                    <input
                        type="number"
                        value={overtimeRate}
                        onChange={e => setOvertimeRate(e.target.value)}
                        className="mt-1 w-full p-2 border rounded-md"
                        required
                    />
                </div>
                <div className="border-t pt-4 flex justify-end">
                    <button type="submit" className="bg-pink-600 text-white py-2 px-6 rounded-lg font-bold hover:bg-pink-700">
                        Simpan
                    </button>
                </div>
            </form>
        </ReusableModal>
    );
};


// --- END: MODAL COMPONENTS ---


// Sub-komponen untuk Modal Edit Order
const EditOrderModal: React.FC<{
    order: SavedOrder;
    products: ProductData[];
    finishings: FinishingData[];
    customers: CustomerData[];
    categories: CategoryData[];
    onClose: () => void;
    onSave: (updatedOrder: SavedOrder) => void;
}> = ({ order, products, finishings, customers, categories, onClose, onSave }) => {

    const [orderItems, setOrderItems] = useState<OrderItemData[]>(order.orderItems);
    const [customer, setCustomer] = useState(order.customer);
    const [orderDate, setOrderDate] = useState(order.orderDate);
    const [totalPrice, setTotalPrice] = useState(0);
    
    const priceLevelMap: Record<CustomerData['level'], keyof ProductData['price']> = {
        'End Customer': 'endCustomer',
        'Retail': 'retail',
        'Grosir': 'grosir',
        'Reseller': 'reseller',
        'Corporate': 'corporate'
    };
    
    useEffect(() => {
        const calculateTotal = () => {
            const ROUNDING_AMOUNT = 500;
            const roundUpToNearest = (num: number, nearest: number) => {
                if (nearest <= 0) return num;
                return Math.ceil(num / nearest) * nearest;
            };

            const currentCustomer = customers.find(c => c.name === customer);
            const customerLevel = currentCustomer ? currentCustomer.level : 'End Customer';
            const priceKey = priceLevelMap[customerLevel];
            let total = 0;
            orderItems.forEach(item => {
                if (!item.productId) return;
                const productInfo = products.find(p => p.id === item.productId);
                const finishingInfo = finishings.find(f => f.name === item.finishing);
                if (!productInfo) return;

                const categoryInfo = categories.find(c => c.name === productInfo.category);
                const isAreaBased = categoryInfo?.unitType === 'Per Luas';

                let materialPrice = (productInfo.price[priceKey] || productInfo.price.endCustomer);
                const finishingPrice = finishingInfo ? finishingInfo.price : 0;
                let priceMultiplier = 1;
                
                if (isAreaBased) {
                    const length = parseFloat(item.length) || 0;
                    const width = parseFloat(item.width) || 0;
                    priceMultiplier = length * width;
                }
                const itemMaterialTotal = materialPrice * priceMultiplier * item.qty;
                const itemFinishingTotal = finishingPrice * item.qty; // Finishing price is always per item quantity, not affected by area.
                total += itemMaterialTotal + itemFinishingTotal;
            });
            const roundedTotal = roundUpToNearest(total, ROUNDING_AMOUNT);
            setTotalPrice(roundedTotal);
        };
        calculateTotal();
    }, [orderItems, customer, products, finishings, customers, categories]);

    const handleItemChange = (id: number, field: keyof Omit<OrderItemData, 'id'>, value: string | number) => {
        let newItems = orderItems.map(item => item.id === id ? { ...item, [field]: value } : item);
        if (field === 'productId') {
            const selectedProduct = products.find(p => p.id === value);
            const categoryInfo = categories.find(c => c.name === selectedProduct?.category);
            const isAreaBased = categoryInfo?.unitType === 'Per Luas';
            if (!isAreaBased) {
                newItems = newItems.map(item => item.id === id ? { ...item, length: '1', width: '1' } : item);
            }
        }
        setOrderItems(newItems);
    };

    const addItem = () => setOrderItems([...orderItems, { 
        id: Date.now(), 
        productId: products.length > 0 ? products[0].id : null, 
        finishing: 'Tanpa Finishing', 
        description: '', 
        length: '1', 
        width: '1', 
        qty: 1 
    }]);

    const removeItem = (id: number) => { if (orderItems.length > 1) setOrderItems(orderItems.filter(item => item.id !== id)); };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const orderDetails = orderItems.map(item => {
            const product = products.find(p => p.id === item.productId);
            if (!product) return '';
            
            const categoryInfo = categories.find(c => c.name === product.category);
            const isArea = categoryInfo?.unitType === 'Per Luas';

            const description = item.description || 'Tanpa deskripsi';
            const material = product.name;
            const size = isArea ? `${item.length}X${item.width}` : '-';
            const quantity = `${item.qty} Pcs`;
            
            return `${description} - ${material} - ${size} - ${quantity}`;
        }).filter(Boolean).join('\n');

        const updatedOrder: SavedOrder = {
            id: order.id,
            customer,
            orderDate,
            orderItems,
            details: orderDetails || 'Tidak ada detail',
            totalPrice,
        };
        onSave(updatedOrder);
    };

    return (
        <ReusableModal title={`Edit Order ${order.id}`} onClose={onClose} maxWidth="max-w-3xl">
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="order-date" className="block text-sm font-medium">Tanggal</label>
                        <input type="date" id="order-date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} className="mt-1 w-full p-2 border rounded-md" />
                    </div>
                    <div>
                        <label htmlFor="customer" className="block text-sm font-medium">Pelanggan</label>
                        <select id="customer" value={customer} onChange={(e) => setCustomer(e.target.value)} className="mt-1 w-full p-2 border bg-white rounded-md">
                            {customers.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                        </select>
                    </div>
                </div>

                {orderItems.map((item, index) => {
                    const selectedProduct = products.find(p => p.id === item.productId);
                    const category = categories.find(c => c.name === selectedProduct?.category);
                    const isAreaBased = category?.unitType === 'Per Luas';
                    return (
                        <div key={item.id} className="border-t pt-6 space-y-4 relative">
                            <h3 className="font-semibold text-gray-700">Detail Pesanan #{index + 1}</h3>
                            {orderItems.length > 1 && (<button type="button" onClick={() => removeItem(item.id)} className="absolute top-4 right-0 text-red-500 hover:text-red-700 p-1"><TrashIcon /></button>)}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium">Bahan</label>
                                    <select value={item.productId ?? ''} onChange={(e) => handleItemChange(item.id, 'productId', parseInt(e.target.value))} className="mt-1 w-full p-2 border bg-white rounded-md" required>
                                        <option value="">Pilih Bahan</option>
                                        {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium">Finishing</label>
                                    <select value={item.finishing} onChange={(e) => handleItemChange(item.id, 'finishing', e.target.value)} className="mt-1 w-full p-2 border bg-white rounded-md">
                                        {finishings.map(f => <option key={f.id} value={f.name}>{f.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div><label className="block text-sm font-medium">Deskripsi</label><textarea value={item.description} onChange={(e) => handleItemChange(item.id, 'description', e.target.value)} rows={2} className="mt-1 w-full p-2 border rounded-md"></textarea></div>
                            <div className="grid grid-cols-3 gap-4">
                                <div><label className="block text-sm font-medium">Panjang (m)</label><input type="number" value={item.length} onChange={(e) => handleItemChange(item.id, 'length', e.target.value)} className={`mt-1 w-full p-2 border rounded-md ${!isAreaBased && 'bg-gray-100'}`} step="0.01" min="0" disabled={!isAreaBased}/></div>
                                <div><label className="block text-sm font-medium">Lebar (m)</label><input type="number" value={item.width} onChange={(e) => handleItemChange(item.id, 'width', e.target.value)} className={`mt-1 w-full p-2 border rounded-md ${!isAreaBased && 'bg-gray-100'}`} step="0.01" min="0" disabled={!isAreaBased}/></div>
                                <div><label className="block text-sm font-medium">Qty</label><input type="number" value={item.qty} onChange={(e) => handleItemChange(item.id, 'qty', parseInt(e.target.value, 10) || 1)} className="mt-1 w-full p-2 border rounded-md" min="1" /></div>
                            </div>
                        </div>
                    );
                })}
                
                <div><button type="button" onClick={addItem} className="w-full flex items-center justify-center py-2 px-4 border-2 border-dashed rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50"><PlusCircleIcon className="mr-2"/>Tambah Item</button></div>
                
                <div className="border-t pt-6 flex justify-between items-center">
                    <div><p className="text-sm">Estimasi Total</p><p className="text-2xl font-bold text-pink-600">{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(totalPrice)}</p></div>
                    <button type="submit" className="bg-pink-600 text-white py-3 px-8 rounded-lg font-bold hover:bg-pink-700">Simpan Perubahan</button>
                </div>
            </form>
        </ReusableModal>
    );
};

// Sub-komponen untuk Modal Edit Produk
const EditProductModal: React.FC<{
    product: ProductData;
    categories: CategoryData[];
    onClose: () => void;
    onSave: (updatedProduct: ProductData) => void;
}> = ({ product, categories, onClose, onSave }) => {
    const [formData, setFormData] = useState<ProductData>(product);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        const priceLevel = name as keyof ProductData['price'];
        setFormData(prev => ({
            ...prev,
            price: {
                ...prev.price,
                [priceLevel]: Number(value) || 0,
            }
        }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
    };

    const commonInputClass = "mt-1 w-full p-2 border border-gray-300 rounded-md";

    return (
        <ReusableModal title={`Edit Produk ${product.name}`} onClose={onClose}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium">Nama Produk/Layanan</label>
                    <input name="name" value={formData.name} onChange={handleChange} className={commonInputClass} required />
                </div>
                <div>
                    <label className="block text-sm font-medium">Kategori</label>
                    <select name="category" value={formData.category} onChange={handleChange} className={commonInputClass} required>
                        {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Harga</label>
                  <div className="grid grid-cols-3 gap-2 mt-1">
                    <input name="endCustomer" type="number" placeholder="End Customer" value={formData.price.endCustomer} onChange={handlePriceChange} className="w-full p-2 border border-gray-300 rounded-md" required />
                    <input name="retail" type="number" placeholder="Retail" value={formData.price.retail} onChange={handlePriceChange} className="w-full p-2 border border-gray-300 rounded-md" required />
                    <input name="grosir" type="number" placeholder="Grosir" value={formData.price.grosir} onChange={handlePriceChange} className="w-full p-2 border border-gray-300 rounded-md" required />
                    <input name="reseller" type="number" placeholder="Reseller" value={formData.price.reseller} onChange={handlePriceChange} className="w-full p-2 border border-gray-300 rounded-md" required />
                    <input name="corporate" type="number" placeholder="Corporate" value={formData.price.corporate} onChange={handlePriceChange} className="w-full p-2 border border-gray-300 rounded-md" required />
                  </div>
                </div>
                <div className="border-t pt-4 flex justify-end">
                    <button type="submit" className="bg-pink-600 text-white py-2 px-6 rounded-lg font-bold hover:bg-pink-700">Simpan Perubahan</button>
                </div>
            </form>
        </ReusableModal>
    );
};


// Komponen Utama
interface ManagementProps {
  allOrders: SavedOrder[];
  products: ProductData[];
  finishings: FinishingData[];
  customers: CustomerData[];
  categories: CategoryData[];
  inventory: InventoryItem[];
  suppliers: SupplierData[];
  expenses: ExpenseItem[];
  employees: EmployeeData[];
  salaries: SalaryData[];
  menuPermissions: string[];
  onUpdateOrder: (updatedOrder: SavedOrder) => void;
  onDeleteOrder: (orderId: string) => void;
  onUpdateProduct: (updatedProduct: ProductData) => void;
  onDeleteProduct: (productId: number) => void;
  onUpdateCategory: (data: CategoryData) => void;
  onDeleteCategory: (id: number) => void;
  onUpdateFinishing: (data: FinishingData) => void;
  onDeleteFinishing: (id: number) => void;
  onUpdateCustomer: (data: CustomerData) => void;
  onDeleteCustomer: (id: number) => void;
  onUpdateSupplier: (data: SupplierData) => void;
  onDeleteSupplier: (id: number) => void;
  onUpdateExpense: (data: ExpenseItem) => void;
  onDeleteExpense: (id: number) => void;
  onUpdateEmployee: (data: EmployeeData) => void;
  onDeleteEmployee: (id: number) => void;
  onAddSalary: (data: Omit<SalaryData, 'id'>) => void;
  onUpdateSalary: (data: SalaryData) => void;
  onDeleteSalary: (id: number) => void;
  onAddInventoryItem: (newItem: Omit<InventoryItem, 'id'>) => void;
  onUpdateInventoryItem: (updatedItem: InventoryItem) => void;
  onDeleteInventoryItem: (itemId: number) => void;
}

const TABS = [
    { key: 'penjualan', label: 'Order' },
    { key: 'produk', label: 'Produk' },
    { key: 'stok', label: 'Stok' },
    { key: 'kategori', label: 'Kategori' },
    { key: 'finishing', label: 'Finishing' },
    { key: 'pelanggan', label: 'Pelanggan' },
    { key: 'supplier', label: 'Supplier' },
    { key: 'pengeluaran', label: 'Pengeluaran' },
    { key: 'karyawan', label: 'Karyawan' },
    { key: 'gaji', label: 'Gaji' },
];

const Management: React.FC<ManagementProps> = ({ 
    allOrders, products, finishings, customers, categories, 
    inventory, suppliers, expenses, employees, salaries,
    menuPermissions, onUpdateOrder, onDeleteOrder, onUpdateProduct, onDeleteProduct,
    onUpdateCategory, onDeleteCategory,
    onUpdateFinishing, onDeleteFinishing, onUpdateCustomer,
    onDeleteCustomer, onUpdateSupplier, onDeleteSupplier,
    onUpdateExpense, onDeleteExpense, onUpdateEmployee, onDeleteEmployee,
    onAddSalary, onUpdateSalary, onDeleteSalary,
    onAddInventoryItem, onUpdateInventoryItem, onDeleteInventoryItem
}) => {
    const accessibleTabs = useMemo(() => TABS.filter(tab => menuPermissions.includes(`managementData/${tab.key}`)), [menuPermissions]);
    const [activeTab, setActiveTab] = useState(accessibleTabs.length > 0 ? accessibleTabs[0].key : '');
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [sortConfig, setSortConfig] = useState<{ key: string; order: 'asc' | 'desc' } | null>(null);

    const [editingOrder, setEditingOrder] = useState<SavedOrder | null>(null);
    const [editingProduct, setEditingProduct] = useState<ProductData | null>(null);
    const [editingCategory, setEditingCategory] = useState<CategoryData | null>(null);
    const [editingFinishing, setEditingFinishing] = useState<FinishingData | null>(null);
    const [editingCustomer, setEditingCustomer] = useState<CustomerData | null>(null);
    const [editingSupplier, setEditingSupplier] = useState<SupplierData | null>(null);
    const [editingExpense, setEditingExpense] = useState<ExpenseItem | null>(null);
    const [editingEmployee, setEditingEmployee] = useState<EmployeeData | null>(null);
    const [salaryModalState, setSalaryModalState] = useState<{ isOpen: boolean, data?: SalaryData | null }>({ isOpen: false });
    const [editingInventory, setEditingInventory] = useState<InventoryItem | null>(null);
    const [isAddingInventory, setIsAddingInventory] = useState(false);
    
    useEffect(() => {
        if (accessibleTabs.length > 0 && !accessibleTabs.some(t => t.key === activeTab)) {
            setActiveTab(accessibleTabs[0].key);
        }
    }, [accessibleTabs, activeTab]);

    useEffect(() => {
        setSearchQuery('');
        setCurrentPage(1);
        setSortConfig(null);
    }, [activeTab]);
    
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, sortConfig]);

    const requestSort = (key: string) => {
        let order: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.order === 'asc') {
            order = 'desc';
        }
        setSortConfig({ key, order });
    };

    // --- Handlers ---
    const handleSaveOrder = (updatedOrder: SavedOrder) => {
        onUpdateOrder(updatedOrder);
        setEditingOrder(null);
        alert(`Order ${updatedOrder.id} berhasil diperbarui.`);
    };
    const handleDeleteOrder = (orderId: string) => {
        if (window.confirm(`Apakah Anda yakin ingin menghapus seluruh order ${orderId}? Tindakan ini tidak dapat dibatalkan.`)) {
            onDeleteOrder(orderId);
        }
    };
    const handleSaveProduct = (updatedProduct: ProductData) => {
        onUpdateProduct(updatedProduct);
        setEditingProduct(null);
        alert(`Produk ${updatedProduct.name} berhasil diperbarui.`);
    };
     const handleDeleteItem = (type: string, id: number | string, name: string) => {
        if (window.confirm(`Apakah Anda yakin ingin menghapus ${type} "${name}"?`)) {
            switch(activeTab) {
                case 'produk': onDeleteProduct(id as number); break;
                case 'stok': onDeleteInventoryItem(id as number); break;
                case 'kategori': onDeleteCategory(id as number); break;
                case 'finishing': onDeleteFinishing(id as number); break;
                case 'pelanggan': onDeleteCustomer(id as number); break;
                case 'supplier': onDeleteSupplier(id as number); break;
                case 'pengeluaran': onDeleteExpense(id as number); break;
                case 'karyawan': onDeleteEmployee(id as number); break;
                case 'gaji': onDeleteSalary(id as number); break;
            }
        }
    };
    const handleSaveInventory = (data: InventoryItem | Omit<InventoryItem, 'id'>) => {
        if ('id' in data) {
            onUpdateInventoryItem(data);
        } else {
            onAddInventoryItem(data as Omit<InventoryItem, 'id'>);
        }
        setEditingInventory(null);
        setIsAddingInventory(false);
    };

    const handleSaveCategory = (data: CategoryData) => { onUpdateCategory(data); setEditingCategory(null); };
    const handleSaveFinishing = (data: FinishingData) => { onUpdateFinishing(data); setEditingFinishing(null); };
    const handleSaveCustomer = (data: CustomerData) => { onUpdateCustomer(data); setEditingCustomer(null); };
    const handleSaveSupplier = (data: SupplierData) => { onUpdateSupplier(data); setEditingSupplier(null); };
    const handleSaveExpense = (data: ExpenseItem) => { onUpdateExpense(data); setEditingExpense(null); };
    const handleSaveEmployee = (data: EmployeeData) => { onUpdateEmployee(data); setEditingEmployee(null); };
    
    const handleSaveSalary = (data: SalaryData | Omit<SalaryData, 'id'>) => {
        if ('id' in data) {
            onUpdateSalary(data);
        } else {
            const existing = salaries.find(s => s.employeeId === data.employeeId);
            if (existing) {
                alert('Data gaji untuk karyawan ini sudah ada. Silakan edit data yang sudah ada.');
                return;
            }
            onAddSalary(data);
        }
        setSalaryModalState({ isOpen: false });
    };

    
    const TabButton: React.FC<{ tabKey: string; label: string }> = ({ tabKey, label }) => (
        <button
            onClick={() => setActiveTab(tabKey)}
            className={`${ activeTab === tabKey ? 'border-pink-500 text-pink-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300' } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
        >
            {label}
        </button>
    );
    
    const getSearchPlaceholder = () => {
        switch(activeTab) {
            case 'penjualan': return 'Cari nota, pelanggan, atau deskripsi...';
            case 'produk': return 'Cari nama atau kategori produk...';
            case 'stok': return 'Cari nama atau SKU item...';
            case 'pelanggan': return 'Cari nama atau kontak pelanggan...';
            case 'supplier': return 'Cari nama atau narahubung supplier...';
            case 'pengeluaran': return 'Cari nama atau kategori pengeluaran...';
            case 'karyawan': return 'Cari nama atau kontak karyawan...';
            case 'gaji': return 'Cari nama karyawan...';
            default: return 'Cari...';
        }
    };
    
    const ActionButtons: React.FC<{ onEdit: () => void, onDelete: () => void }> = ({ onEdit, onDelete }) => (
        <td className="py-4 px-4 whitespace-nowrap text-sm space-x-2">
            <button onClick={onEdit} className="p-1.5 text-gray-500 hover:text-blue-600"><PencilIcon className="h-4 w-4" /></button>
            <button onClick={onDelete} className="p-1.5 text-gray-500 hover:text-red-600"><TrashIcon className="h-4 w-4" /></button>
        </td>
    );

    const { paginatedData, totalItems } = useMemo(() => {
        const lowerCaseQuery = searchQuery.toLowerCase();
        let data: any[] = [];

        switch (activeTab) {
            case 'penjualan': data = [...allOrders].filter(order => order.id.toLowerCase().includes(lowerCaseQuery) || order.customer.toLowerCase().includes(lowerCaseQuery) || order.details.toLowerCase().includes(lowerCaseQuery)); break;
            case 'produk': data = products.filter(p => p.name.toLowerCase().includes(lowerCaseQuery) || p.category.toLowerCase().includes(lowerCaseQuery)); break;
            case 'stok': data = inventory.filter(i => i.name.toLowerCase().includes(lowerCaseQuery) || i.sku.toLowerCase().includes(lowerCaseQuery)); break;
            case 'kategori': data = categories.filter(c => c.name.toLowerCase().includes(lowerCaseQuery)); break;
            case 'finishing': data = finishings.filter(f => f.name.toLowerCase().includes(lowerCaseQuery)); break;
            case 'pelanggan': data = customers.filter(c => c.name.toLowerCase().includes(lowerCaseQuery) || c.contact.toLowerCase().includes(lowerCaseQuery)); break;
            case 'supplier': data = suppliers.filter(s => s.name.toLowerCase().includes(lowerCaseQuery) || s.contactPerson.toLowerCase().includes(lowerCaseQuery)); break;
            case 'pengeluaran': data = expenses.filter(e => e.name.toLowerCase().includes(lowerCaseQuery) || e.category.toLowerCase().includes(lowerCaseQuery)); break;
            case 'karyawan': data = employees.filter(e => e.name.toLowerCase().includes(lowerCaseQuery) || e.contact.toLowerCase().includes(lowerCaseQuery)); break;
            case 'gaji': data = salaries.filter(s => employees.find(e => e.id === s.employeeId)?.name.toLowerCase().includes(lowerCaseQuery)); break;
        }
        
        if (sortConfig) {
            data.sort((a, b) => {
                let aValue: any; let bValue: any;
                if (activeTab === 'gaji' && sortConfig.key === 'employeeName') {
                    aValue = employees.find(e => e.id === a.employeeId)?.name ?? '';
                    bValue = employees.find(e => e.id === b.employeeId)?.name ?? '';
                } else {
                    aValue = a[sortConfig.key]; bValue = b[sortConfig.key];
                }
                if (aValue == null || bValue == null) return aValue == null ? 1 : -1;
                const order = sortConfig.order === 'asc' ? 1 : -1;
                if (typeof aValue === 'number' && typeof bValue === 'number') return (aValue - bValue) * order;
                return String(aValue).localeCompare(String(bValue), 'id-ID', { numeric: true }) * order;
            });
        } else if (activeTab === 'penjualan') {
            data.sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());
        }


        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return { paginatedData: data.slice(startIndex, startIndex + ITEMS_PER_PAGE), totalItems: data.length };
    }, [activeTab, searchQuery, currentPage, sortConfig, allOrders, products, inventory, categories, finishings, customers, suppliers, expenses, employees, salaries]);
    
    const SortableHeader: React.FC<{ label: string; sortKey: string; className?: string; }> = ({ label, sortKey, className }) => {
        const isSorted = sortConfig?.key === sortKey;
        const sortIcon = isSorted ? (sortConfig.order === 'asc' ? '▲' : '▼') : '↕';
        const iconColor = isSorted ? 'text-gray-800' : 'text-gray-300';
    
        return (
            <th className={`py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none ${className || ''}`} onClick={() => requestSort(sortKey)}>
                <div className="flex items-center">
                    <span>{label}</span>
                    <span className={`ml-2 text-xs ${iconColor}`}>{sortIcon}</span>
                </div>
            </th>
        );
    };

    const renderContent = () => {
        const NonSortableHeader: React.FC<{ label: string }> = ({ label }) => <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</th>;
        switch (activeTab) {
            case 'penjualan':
                return (
                     <table className="min-w-full bg-white"><thead className="bg-gray-50"><tr><SortableHeader label="No. Nota" sortKey="id" /><SortableHeader label="Pelanggan" sortKey="customer" /><SortableHeader label="Detail" sortKey="details" /><SortableHeader label="Total" sortKey="totalPrice" /><NonSortableHeader label="Aksi" /></tr></thead><tbody className="divide-y divide-gray-200">{(paginatedData as SavedOrder[]).map(order => (<tr key={order.id}><td className="py-4 px-4 whitespace-nowrap text-sm font-medium">{order.id}</td><td className="py-4 px-4 whitespace-nowrap text-sm">{order.customer}</td><td className="py-4 px-4 text-sm max-w-sm truncate" title={order.details}>{order.details}</td><td className="py-4 px-4 whitespace-nowrap text-sm">{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(order.totalPrice)}</td><ActionButtons onEdit={() => setEditingOrder(order)} onDelete={() => handleDeleteOrder(order.id)} /></tr>))}</tbody></table>
                );
            case 'produk':
                return <table className="min-w-full bg-white"><thead className="bg-gray-50"><tr><SortableHeader label="Nama" sortKey="name" /><SortableHeader label="Kategori" sortKey="category" /><NonSortableHeader label="Harga" /><NonSortableHeader label="Aksi" /></tr></thead><tbody className="divide-y divide-gray-200">{(paginatedData as ProductData[]).map(p => (<tr key={p.id}><td className="py-4 px-4 text-sm font-medium">{p.name}</td><td className="py-4 px-4 text-sm">{p.category}</td><td className="py-4 px-4 text-xs">{`${p.price.endCustomer/1000}k / ${p.price.retail/1000}k / ${p.price.grosir/1000}k / ...`}</td><ActionButtons onEdit={() => setEditingProduct(p)} onDelete={() => handleDeleteItem('produk', p.id, p.name)} /></tr>))}</tbody></table>;
            case 'stok':
                return <> <div className="flex justify-end mb-4"><button onClick={() => setIsAddingInventory(true)} className="flex items-center bg-pink-600 text-white px-4 py-2 rounded-lg font-semibold text-sm hover:bg-pink-700"><PlusCircleIcon className="mr-2 h-4 w-4" />Tambah Stok</button></div> <table className="min-w-full bg-white"><thead className="bg-gray-50"><tr><SortableHeader label="Nama" sortKey="name" /><SortableHeader label="SKU" sortKey="sku" /><SortableHeader label="Stok" sortKey="stock" /><NonSortableHeader label="Aksi" /></tr></thead><tbody className="divide-y divide-gray-200">{(paginatedData as InventoryItem[]).map(i => (<tr key={i.id}><td className="py-4 px-4 text-sm font-medium">{i.name}</td><td className="py-4 px-4 text-sm">{i.sku}</td><td className="py-4 px-4 text-sm">{i.stock} {i.unit}</td><ActionButtons onEdit={() => setEditingInventory(i)} onDelete={() => handleDeleteItem('stok', i.id, i.name)} /></tr>))}</tbody></table></>;
            case 'kategori':
                return <table className="min-w-full bg-white"><thead className="bg-gray-50"><tr><SortableHeader label="Nama" sortKey="name" /><SortableHeader label="Tipe Satuan" sortKey="unitType" /><NonSortableHeader label="Aksi" /></tr></thead><tbody className="divide-y divide-gray-200">{(paginatedData as CategoryData[]).map(c => (<tr key={c.id}><td className="py-4 px-4 text-sm font-medium">{c.name}</td><td className="py-4 px-4 text-sm">{c.unitType}</td><ActionButtons onEdit={() => setEditingCategory(c)} onDelete={() => handleDeleteItem('kategori', c.id, c.name)} /></tr>))}</tbody></table>;
            case 'finishing':
                return <table className="min-w-full bg-white"><thead className="bg-gray-50"><tr><SortableHeader label="Nama" sortKey="name" /><SortableHeader label="Harga" sortKey="price" /><NonSortableHeader label="Aksi" /></tr></thead><tbody className="divide-y divide-gray-200">{(paginatedData as FinishingData[]).map(f => (<tr key={f.id}><td className="py-4 px-4 text-sm font-medium">{f.name}</td><td className="py-4 px-4 text-sm">{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(f.price)}</td><ActionButtons onEdit={() => setEditingFinishing(f)} onDelete={() => handleDeleteItem('finishing', f.id, f.name)} /></tr>))}</tbody></table>;
            case 'pelanggan':
                return <table className="min-w-full bg-white"><thead className="bg-gray-50"><tr><SortableHeader label="Nama" sortKey="name" /><SortableHeader label="Kontak" sortKey="contact" /><SortableHeader label="Level" sortKey="level" /><NonSortableHeader label="Aksi" /></tr></thead><tbody className="divide-y divide-gray-200">{(paginatedData as CustomerData[]).map(c => (<tr key={c.id}><td className="py-4 px-4 text-sm font-medium">{c.name}</td><td className="py-4 px-4 text-sm">{c.contact}</td><td className="py-4 px-4 text-sm">{c.level}</td><ActionButtons onEdit={() => setEditingCustomer(c)} onDelete={() => handleDeleteItem('pelanggan', c.id, c.name)} /></tr>))}</tbody></table>;
            case 'supplier':
                return <table className="min-w-full bg-white"><thead className="bg-gray-50"><tr><SortableHeader label="Nama" sortKey="name" /><SortableHeader label="Narahubung" sortKey="contactPerson" /><SortableHeader label="Telepon" sortKey="phone" /><NonSortableHeader label="Aksi" /></tr></thead><tbody className="divide-y divide-gray-200">{(paginatedData as SupplierData[]).map(s => (<tr key={s.id}><td className="py-4 px-4 text-sm font-medium">{s.name}</td><td className="py-4 px-4 text-sm">{s.contactPerson}</td><td className="py-4 px-4 text-sm">{s.phone}</td><ActionButtons onEdit={() => setEditingSupplier(s)} onDelete={() => handleDeleteItem('supplier', s.id, s.name)} /></tr>))}</tbody></table>;
            case 'pengeluaran':
                return <table className="min-w-full bg-white"><thead className="bg-gray-50"><tr><SortableHeader label="Nama" sortKey="name" /><SortableHeader label="Kategori" sortKey="category" /><SortableHeader label="Jumlah" sortKey="amount" /><NonSortableHeader label="Aksi" /></tr></thead><tbody className="divide-y divide-gray-200">{(paginatedData as ExpenseItem[]).map(e => (<tr key={e.id}><td className="py-4 px-4 text-sm font-medium">{e.name}</td><td className="py-4 px-4 text-sm">{e.category}</td><td className="py-4 px-4 text-sm">{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(e.amount)}</td><ActionButtons onEdit={() => setEditingExpense(e)} onDelete={() => handleDeleteItem('pengeluaran', e.id, e.name)} /></tr>))}</tbody></table>;
            case 'karyawan':
                return <table className="min-w-full bg-white"><thead className="bg-gray-50"><tr><SortableHeader label="Nama" sortKey="name" /><SortableHeader label="Kontak" sortKey="contact" /><SortableHeader label="Devisi" sortKey="division" /><NonSortableHeader label="Aksi" /></tr></thead><tbody className="divide-y divide-gray-200">{(paginatedData as EmployeeData[]).map(e => (<tr key={e.id}><td className="py-4 px-4 text-sm font-medium">{e.name}</td><td className="py-4 px-4 text-sm">{e.contact}</td><td className="py-4 px-4 text-sm">{e.division}</td><ActionButtons onEdit={() => setEditingEmployee(e)} onDelete={() => handleDeleteItem('karyawan', e.id, e.name)} /></tr>))}</tbody></table>;
            case 'gaji':
                return <> <div className="flex justify-end mb-4"><button onClick={() => setSalaryModalState({ isOpen: true })} className="flex items-center bg-pink-600 text-white px-4 py-2 rounded-lg font-semibold text-sm hover:bg-pink-700"><PlusCircleIcon className="mr-2 h-4 w-4" />Tambah Gaji</button></div> <table className="min-w-full bg-white"><thead className="bg-gray-50"><tr><SortableHeader label="Karyawan" sortKey="employeeName" /><SortableHeader label="Regular/Jam" sortKey="regularRate" /><SortableHeader label="Lembur/Jam" sortKey="overtimeRate" /><NonSortableHeader label="Aksi" /></tr></thead><tbody className="divide-y divide-gray-200">{(paginatedData as SalaryData[]).map(s => { const emp = employees.find(e => e.id === s.employeeId); return (<tr key={s.id}><td className="py-4 px-4 text-sm font-medium">{emp?.name || 'N/A'}</td><td className="py-4 px-4 text-sm">{new Intl.NumberFormat('id-ID').format(s.regularRate)}</td><td className="py-4 px-4 text-sm">{new Intl.NumberFormat('id-ID').format(s.overtimeRate)}</td><ActionButtons onEdit={() => setSalaryModalState({ isOpen: true, data: s })} onDelete={() => handleDeleteItem('gaji', s.id, emp?.name || `ID ${s.id}`)} /></tr>);})}</tbody></table></>;
            default: return <div className="text-center py-16 text-gray-500"><p>Pilih tab untuk melihat data.</p></div>;
        }
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-md flex flex-col">
            <h2 className="text-xl font-bold mb-4">Manajemen Data</h2>
            {accessibleTabs.length > 1 && (
                <div className="border-b border-gray-200">
                    <nav className="-mb-px flex space-x-6 overflow-x-auto" aria-label="Tabs">
                        {accessibleTabs.map(tab => <TabButton key={tab.key} tabKey={tab.key} label={tab.label} />)}
                    </nav>
                </div>
            )}
            
            <div className="relative my-4">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
                </div>
                <input
                    type="text"
                    placeholder={getSearchPlaceholder()}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full md:w-1/2 pl-10 pr-4 py-2 border rounded-lg focus:ring-pink-500 focus:border-pink-500"
                />
            </div>

            <div className="overflow-x-auto min-h-[50vh] flex-1">
                {renderContent()}
            </div>
            
            <Pagination
                totalItems={totalItems}
                itemsPerPage={ITEMS_PER_PAGE}
                currentPage={currentPage}
                onPageChange={setCurrentPage}
            />

            {editingOrder && (
                <EditOrderModal
                    order={editingOrder}
                    products={products}
                    finishings={finishings}
                    customers={customers}
                    categories={categories}
                    onClose={() => setEditingOrder(null)}
                    onSave={handleSaveOrder}
                />
            )}
            {editingProduct && (
                <EditProductModal 
                    product={editingProduct}
                    categories={categories}
                    onClose={() => setEditingProduct(null)}
                    onSave={handleSaveProduct}
                />
            )}
             {(editingInventory || isAddingInventory) && (
                <EditInventoryModal
                    item={editingInventory}
                    onSave={handleSaveInventory}
                    onClose={() => { setEditingInventory(null); setIsAddingInventory(false); }}
                />
            )}
            {editingCategory && <EditCategoryModal category={editingCategory} onSave={handleSaveCategory} onClose={() => setEditingCategory(null)} />}
            {editingFinishing && <EditFinishingModal finishing={editingFinishing} categories={categories} onSave={handleSaveFinishing} onClose={() => setEditingFinishing(null)} />}
            {editingCustomer && <EditCustomerModal customer={editingCustomer} onSave={handleSaveCustomer} onClose={() => setEditingCustomer(null)} />}
            {editingSupplier && <EditSupplierModal supplier={editingSupplier} onSave={handleSaveSupplier} onClose={() => setEditingSupplier(null)} />}
            {editingExpense && <EditExpenseModal expense={editingExpense} onSave={handleSaveExpense} onClose={() => setEditingExpense(null)} />}
            {editingEmployee && <EditEmployeeModal employee={editingEmployee} onSave={handleSaveEmployee} onClose={() => setEditingEmployee(null)} />}
            {salaryModalState.isOpen && <SalaryModal salary={salaryModalState.data} employees={employees} onSave={handleSaveSalary} onClose={() => setSalaryModalState({ isOpen: false })} />}
        </div>
    );
};

export default Management;
