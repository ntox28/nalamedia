

import React, { useState, useMemo, useEffect } from 'react';
import { type ProductData, type CategoryData, type FinishingData, type CustomerData, type SupplierData, type EmployeeData } from '../types';
import * as XLSX from 'xlsx';
import { ArrowDownTrayIcon, ArrowUpTrayIcon, MagnifyingGlassIcon } from './Icons';
import Pagination from './Pagination';

const ITEMS_PER_PAGE = 20;

const TABS = [
    { key: 'products', label: 'Produk & Layanan' },
    { key: 'categories', label: 'Kategori' },
    { key: 'finishings', label: 'Finishing' },
    { key: 'customers', label: 'Pelanggan' },
    { key: 'suppliers', label: 'Supplier' },
    { key: 'karyawan', label: 'Karyawan' },
];

interface MasterDataProps {
  products: ProductData[];
  categories: CategoryData[];
  finishings: FinishingData[];
  customers: CustomerData[];
  suppliers: SupplierData[];
  employees: EmployeeData[];
  menuPermissions: string[];
  onAddProduct: (newProduct: Omit<ProductData, 'id'>) => void;
  onAddCategory: (newCategory: Omit<CategoryData, 'id'>) => void;
  onAddFinishing: (newFinishing: Omit<FinishingData, 'id'>) => void;
  onAddCustomer: (newCustomer: Omit<CustomerData, 'id' | 'joinDate'>) => void;
  onAddSupplier: (newSupplier: Omit<SupplierData, 'id'>) => void;
  onAddEmployee: (newEmployee: Omit<EmployeeData, 'id' | 'joinDate'>) => void;
}


// Reusable Modal Component
const Modal: React.FC<{ show: boolean; onClose: () => void; title: string; children: React.ReactNode }> = ({ show, onClose, title, children }) => {
  if (!show) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center border-b pb-3">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-2xl leading-none">&times;</button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
};

const ProductForm: React.FC<{
    categories: CategoryData[];
    onSubmit: (data: any) => void;
}> = ({ categories, onSubmit }) => {
    
    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const data: any = { price: {} };
        formData.forEach((value, key) => {
            if (key.includes('.')) {
                const [parent, child] = key.split('.');
                data[parent][child] = value;
            } else {
                data[key] = value;
            }
        });
        onSubmit(data);
    };

    const commonInputClass = "mt-1 w-full p-2 border border-gray-300 rounded-md";

    return (
        <form onSubmit={handleSubmit} className="space-y-3">
            <input name="name" placeholder="Nama Produk/Layanan" className={commonInputClass} required />
            <select name="category" defaultValue={categories[0]?.name || ''} className={commonInputClass} required>
                <option value="" disabled>Pilih Kategori</option>
                {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
            <div>
              <label className="text-sm font-medium">Harga</label>
              <div className="grid grid-cols-3 gap-2 mt-1">
                <input name="price.endCustomer" type="number" placeholder="End Customer" className="w-full p-2 border border-gray-300 rounded-md" required />
                <input name="price.retail" type="number" placeholder="Retail" className="w-full p-2 border border-gray-300 rounded-md" required />
                <input name="price.grosir" type="number" placeholder="Grosir" className="w-full p-2 border border-gray-300 rounded-md" required />
                <input name="price.reseller" type="number" placeholder="Reseller" className="w-full p-2 border border-gray-300 rounded-md" required />
                <input name="price.corporate" type="number" placeholder="Corporate" className="w-full p-2 border border-gray-300 rounded-md" required />
              </div>
            </div>
            <button type="submit" className="w-full bg-pink-600 text-white py-2 rounded-lg font-semibold hover:bg-pink-700 mt-4">Simpan</button>
        </form>
    );
}

// --- Import/Export Modal ---
const ImportExportModal: React.FC<{
  show: boolean;
  onClose: () => void;
  products: ProductData[];
  categories: CategoryData[];
  finishings: FinishingData[];
  customers: CustomerData[];
  suppliers: SupplierData[];
  employees: EmployeeData[];
  onAddProduct: (newProduct: Omit<ProductData, 'id'>) => void;
  onAddCategory: (newCategory: Omit<CategoryData, 'id'>) => void;
  onAddFinishing: (newFinishing: Omit<FinishingData, 'id'>) => void;
  onAddCustomer: (newCustomer: Omit<CustomerData, 'id' | 'joinDate'>) => void;
  onAddSupplier: (newSupplier: Omit<SupplierData, 'id'>) => void;
  onAddEmployee: (newEmployee: Omit<EmployeeData, 'id' | 'joinDate'>) => void;
}> = ({ show, onClose, products, categories, finishings, customers, suppliers, employees, onAddProduct, onAddCategory, onAddFinishing, onAddCustomer, onAddSupplier, onAddEmployee }) => {
    
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files) {
            setUploadedFile(event.target.files[0]);
        }
    };
    
    const handleDownloadTemplate = () => {
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ nama: "Contoh Produk", kategori: "Cetak Kertas", harga_end_customer: 50000, harga_retail: 45000, harga_grosir: 42000, harga_reseller: 40000, harga_corporate: 38000 }]), "Produk & Layanan");
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ nama: "Cetak Kertas", tipe_satuan: "Per Buah" }]), "Kategori");
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ nama: "Laminasi Doff", harga: 5000 }]), "Finishing");
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ nama: "Pelanggan Baru", kontak: "08123456789", level: "End Customer" }]), "Pelanggan");
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ nama: "Supplier Kertas", kontak_person: "Bapak Budi", telepon: "021-555-123", spesialisasi: "Kertas" }]), "Supplier");
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ nama: "Andi", kontak: "08987654321", divisi: "Produksi" }]), "Karyawan");
        XLSX.writeFile(wb, "Template_Import_Data_Master.xlsx");
    };

    const handleExportData = () => {
        try {
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(products.map(p => ({ nama: p.name, kategori: p.category, harga_end_customer: p.price.endCustomer, harga_retail: p.price.retail, harga_grosir: p.price.grosir, harga_reseller: p.price.reseller, harga_corporate: p.price.corporate }))), "Produk & Layanan");
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(categories.map(c => ({ nama: c.name, tipe_satuan: c.unitType }))), "Kategori");
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(finishings.map(f => ({ nama: f.name, harga: f.price }))), "Finishing");
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(customers.map(c => ({ nama: c.name, kontak: c.contact, level: c.level }))), "Pelanggan");
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(suppliers.map(s => ({ nama: s.name, kontak_person: s.contactPerson, telepon: s.phone, spesialisasi: s.specialty }))), "Supplier");
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(employees.map(e => ({ nama: e.name, kontak: e.contact, divisi: e.division }))), "Karyawan");
            XLSX.writeFile(wb, "Data_Master_NalaMedia.xlsx");
        } catch (error) {
            console.error("Error exporting data:", error);
            alert("Terjadi kesalahan saat mengekspor data.");
        }
    };
    
    const handleImportData = () => {
        if (!uploadedFile) return;
        setIsLoading(true);
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                const wb = XLSX.read(data, { type: 'array' });
                let summaryParts: string[] = [];
                
                const newItems: {
                    categories: Omit<CategoryData, 'id'>[],
                    finishings: Omit<FinishingData, 'id'>[],
                    customers: Omit<CustomerData, 'id'|'joinDate'>[],
                    suppliers: Omit<SupplierData, 'id'>[],
                    employees: Omit<EmployeeData, 'id'|'joinDate'>[],
                    products: Omit<ProductData, 'id'>[]
                } = { categories: [], finishings: [], customers: [], suppliers: [], employees: [], products: [] };

                const failedProducts: string[] = [];

                const extractFromSheet = <T, U>(sheetName: string, existingData: T[], targetArray: U[], transform: (row: any) => U | null, nameKey: keyof U, importNameKey: string) => {
                    const ws = wb.Sheets[sheetName];
                    if (!ws) return;
                    const importedData: any[] = XLSX.utils.sheet_to_json(ws);
                    importedData.forEach(row => {
                        const rowName = row[importNameKey];
                        if (!rowName) return;

                        const nameStr = (rowName as any).toString().trim().toLowerCase();
                        const existsInOriginal = existingData.some(item => ((item as any)[nameKey] as string).trim().toLowerCase() === nameStr);
                        const existsInNew = targetArray.some(item => ((item as any)[nameKey] as string).trim().toLowerCase() === nameStr);

                        if (!existsInOriginal && !existsInNew) {
                            const newItem = transform(row);
                            if (newItem) targetArray.push(newItem);
                        }
                    });
                };

                // --- Stage 1: Extract all data into local arrays, maintaining dependency order ---
                extractFromSheet("Kategori", categories, newItems.categories, row => ({ name: row.nama, unitType: (row.tipe_satuan === 'Per Luas' || row.tipe_satuan === 'Per Buah') ? row.tipe_satuan : 'Per Buah' }), 'name', 'nama' );
                extractFromSheet("Finishing", finishings, newItems.finishings, row => ({ name: row.nama, price: Number(row.harga) || 0 }), 'name', 'nama' );
                extractFromSheet("Pelanggan", customers, newItems.customers, row => ({ name: row.nama, contact: String(row.kontak), level: row.level || 'End Customer' }), 'name', 'nama' );
                extractFromSheet("Supplier", suppliers, newItems.suppliers, row => ({ name: row.nama, contactPerson: row.kontak_person, phone: String(row.telepon), specialty: row.spesialisasi }), 'name', 'nama' );
                extractFromSheet("Karyawan", employees, newItems.employees, row => ({ name: row.nama, contact: String(row.kontak), division: row.divisi || 'Produksi' }), 'name', 'nama' );

                // Special handling for products to check against existing AND newly added categories
                const allAvailableCategories = [...categories, ...newItems.categories];
                const allProducts = [...products];
                const wsProducts = wb.Sheets["Produk & Layanan"];
                if (wsProducts) {
                    const importedProducts: any[] = XLSX.utils.sheet_to_json(wsProducts);
                    importedProducts.forEach(row => {
                        const rowName = row.nama;
                        if (!rowName || !row.kategori) return;

                        const nameStr = rowName.toString().trim().toLowerCase();
                        const productExists = allProducts.some(p => p.name.trim().toLowerCase() === nameStr);
                        
                        if (!productExists) {
                            const categoryStr = row.kategori.toString().trim().toLowerCase();
                            const categoryExists = allAvailableCategories.some(c => c.name.trim().toLowerCase() === categoryStr);
                            
                            if (categoryExists) {
                                newItems.products.push({
                                    name: row.nama, category: row.kategori,
                                    price: { 
                                        endCustomer: Number(row.harga_end_customer) || 0, retail: Number(row.harga_retail) || 0,
                                        grosir: Number(row.harga_grosir) || 0, reseller: Number(row.harga_reseller) || 0,
                                        corporate: Number(row.harga_corporate) || 0
                                    }
                                });
                            } else {
                                failedProducts.push(row.nama);
                            }
                        }
                    });
                }
                
                // --- Stage 2: Call onAdd props in dependency order ---
                if (newItems.categories.length > 0) { newItems.categories.forEach(onAddCategory); summaryParts.push(`${newItems.categories.length} kategori baru`); }
                if (newItems.finishings.length > 0) { newItems.finishings.forEach(onAddFinishing); summaryParts.push(`${newItems.finishings.length} finishing baru`); }
                if (newItems.customers.length > 0) { newItems.customers.forEach(onAddCustomer); summaryParts.push(`${newItems.customers.length} pelanggan baru`); }
                if (newItems.suppliers.length > 0) { newItems.suppliers.forEach(onAddSupplier); summaryParts.push(`${newItems.suppliers.length} supplier baru`); }
                if (newItems.employees.length > 0) { newItems.employees.forEach(onAddEmployee); summaryParts.push(`${newItems.employees.length} karyawan baru`); }
                if (newItems.products.length > 0) { newItems.products.forEach(onAddProduct); summaryParts.push(`${newItems.products.length} produk baru`); }

                let alertMessage = `Impor Selesai!\nRingkasan: ${summaryParts.join(', ') || "Tidak ada data baru yang ditambahkan."}`;
                if (failedProducts.length > 0) {
                    alertMessage += `\n\nProduk berikut gagal diimpor karena kategorinya tidak ditemukan: ${failedProducts.join(', ')}`;
                }
                alert(alertMessage);
                onClose();

            } catch (error) {
                console.error("Error importing data:", error);
                alert("Gagal mengimpor file. Pastikan format dan nama sheet (misal: 'Produk & Layanan') sudah benar sesuai template.");
            } finally {
                setIsLoading(false);
            }
        };
        reader.readAsArrayBuffer(uploadedFile);
    };

    if (!show) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-2xl" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center border-b pb-3 mb-5">
                    <h3 className="text-xl font-bold text-gray-800">Impor dan Ekspor Data Master</h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-2xl leading-none">&times;</button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Impor Section */}
                    <div className="space-y-4 p-4 border rounded-lg">
                        <h4 className="font-bold text-lg text-gray-700">Impor dari Excel</h4>
                        <p className="text-sm text-gray-600">Tambah data baru secara massal. Data dengan nama yang sama persis akan diabaikan.</p>
                        
                        <div className="flex items-start space-x-3">
                            <div className="flex-shrink-0 h-6 w-6 rounded-full bg-pink-600 text-white flex items-center justify-center font-bold text-sm">1</div>
                            <div>
                                <h5 className="font-semibold">Unduh Template</h5>
                                <p className="text-xs text-gray-500 mb-2">Dapatkan file Excel dengan format kolom yang benar.</p>
                                <button onClick={handleDownloadTemplate} className="flex items-center text-sm bg-gray-200 text-gray-700 px-3 py-1.5 rounded-md hover:bg-gray-300">
                                    <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
                                    Unduh Template
                                </button>
                            </div>
                        </div>

                        <div className="flex items-start space-x-3">
                            <div className="flex-shrink-0 h-6 w-6 rounded-full bg-pink-600 text-white flex items-center justify-center font-bold text-sm">2</div>
                            <div>
                                <h5 className="font-semibold">Isi & Unggah File</h5>
                                <p className="text-xs text-gray-500 mb-2">Salin data Anda ke template, simpan, lalu unggah di sini.</p>
                                <input type="file" accept=".xlsx, .xls" onChange={handleFileChange} className="text-sm file:mr-4 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-pink-50 file:text-pink-700 hover:file:bg-pink-100" />
                                {uploadedFile && <p className="text-xs text-green-600 mt-1">File dipilih: {uploadedFile.name}</p>}
                            </div>
                        </div>

                        <div className="flex items-start space-x-3">
                            <div className="flex-shrink-0 h-6 w-6 rounded-full bg-pink-600 text-white flex items-center justify-center font-bold text-sm">3</div>
                            <div>
                                <h5 className="font-semibold">Impor Data</h5>
                                <p className="text-xs text-gray-500 mb-2">Klik untuk memulai proses penambahan data baru ke sistem.</p>
                                <button onClick={handleImportData} disabled={!uploadedFile || isLoading} className="flex items-center text-sm bg-pink-600 text-white px-4 py-2 rounded-md hover:bg-pink-700 disabled:bg-pink-300">
                                    <ArrowUpTrayIcon className="h-4 w-4 mr-2" />
                                    {isLoading ? 'Memproses...' : 'Impor Data'}
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    {/* Ekspor Section */}
                    <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
                        <h4 className="font-bold text-lg text-gray-700">Ekspor ke Excel</h4>
                        <p className="text-sm text-gray-600">Unduh semua data master yang ada saat ini ke dalam satu file Excel. File ini bisa digunakan sebagai backup atau sebagai template untuk impor selanjutnya.</p>
                        <button onClick={handleExportData} className="flex items-center text-sm bg-cyan-600 text-white px-4 py-2 rounded-md hover:bg-cyan-700">
                           <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
                            Unduh Master Data (Excel)
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};


const MasterData: React.FC<MasterDataProps> = ({ 
    products, categories, finishings, customers, suppliers, employees, menuPermissions,
    onAddProduct, onAddCategory, onAddFinishing, onAddCustomer, onAddSupplier, onAddEmployee
}) => {
  const accessibleTabs = useMemo(() => TABS.filter(tab => menuPermissions.includes(`masterData/${tab.key}`)), [menuPermissions]);
  const [activeTab, setActiveTab] = useState(accessibleTabs.length > 0 ? accessibleTabs[0].key : '');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportExportModalOpen, setIsImportExportModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  
  useEffect(() => {
    if (accessibleTabs.length > 0 && !accessibleTabs.some(t => t.key === activeTab)) {
        setActiveTab(accessibleTabs[0].key);
    }
  }, [accessibleTabs, activeTab]);

  useEffect(() => {
      setSearchQuery('');
      setCurrentPage(1);
  }, [activeTab]);
  
  useEffect(() => {
      setCurrentPage(1);
  }, [searchQuery]);

  const handleAddData = (data: any) => {
    switch (activeTab) {
      case 'products':
        onAddProduct({
          name: data.name,
          category: data.category,
          price: {
            endCustomer: Number(data.price.endCustomer),
            retail: Number(data.price.retail),
            grosir: Number(data.price.grosir),
            reseller: Number(data.price.reseller),
            corporate: Number(data.price.corporate),
          }
        });
        break;
      case 'categories':
        onAddCategory({ name: data.name, unitType: data.unitType });
        break;
      case 'finishings':
        onAddFinishing({ name: data.name, price: Number(data.price), categoryIds: data.categoryIds });
        break;
      case 'customers':
        onAddCustomer({ name: data.name, contact: data.contact, level: data.level });
        break;
      case 'suppliers':
        onAddSupplier(data);
        break;
      case 'karyawan':
        onAddEmployee({ name: data.name, contact: data.contact, division: data.division });
        break;
    }
    setIsModalOpen(false);
  };
  
  const renderModalContent = () => {
    const commonSubmitButton = <button type="submit" className="w-full bg-pink-600 text-white py-2 rounded-lg font-semibold hover:bg-pink-700 mt-4">Simpan</button>;
    const commonInputClass = "mt-1 w-full p-2 border border-gray-300 rounded-md";

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const data: any = {};

        if (activeTab === 'finishings') {
            const categoryIds = formData.getAll('categoryIds').map(id => Number(id));
            data.categoryIds = categoryIds;
        }

        formData.forEach((value, key) => {
            if (key === 'categoryIds') return;

            if (key.includes('.')) {
                const [parent, child] = key.split('.');
                if (!data[parent]) data[parent] = {};
                data[parent][child] = value;
            } else {
                data[key] = value;
            }
        });
        handleAddData(data);
    };

    switch (activeTab) {
        case 'products':
            return <ProductForm categories={categories} onSubmit={handleAddData} />;
        case 'categories':
            return (
                <form onSubmit={handleSubmit} className="space-y-3">
                    <input name="name" placeholder="Nama Kategori Baru" className={commonInputClass} required />
                    <select name="unitType" className={`${commonInputClass} bg-white`} required>
                      <option value="Per Buah">Per Buah (Contoh: pcs, box, rim)</option>
                      <option value="Per Luas">Per Luas (Contoh: m²)</option>
                    </select>
                    {commonSubmitButton}
                </form>
            );
         case 'finishings':
            return (
                <form onSubmit={handleSubmit} className="space-y-3">
                    <input name="name" placeholder="Nama Finishing" className={commonInputClass} required />
                    <input name="price" type="number" placeholder="Harga" className={commonInputClass} required min="0" />
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Kategori Terkait (opsional)</label>
                        <p className="text-xs text-gray-500 mb-1">Pilih kategori spesifik. Kosongkan untuk umum.</p>
                        <select name="categoryIds" multiple className={`${commonInputClass} h-32`}>
                            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                         <p className="text-xs text-gray-500 mt-1">Tahan Ctrl (atau Cmd di Mac) untuk memilih lebih dari satu.</p>
                    </div>
                    {commonSubmitButton}
                </form>
            );
        case 'customers': 
            return (
                <form onSubmit={handleSubmit} className="space-y-3">
                    <input name="name" placeholder="Nama Pelanggan" className={commonInputClass} required />
                    <input name="contact" placeholder="Kontak" className={commonInputClass} required />
                    <select name="level" className={commonInputClass} required>
                        <option value="End Customer">End Customer</option>
                        <option value="Retail">Retail</option>
                        <option value="Grosir">Grosir</option>
                        <option value="Reseller">Reseller</option>
                        <option value="Corporate">Corporate</option>
                    </select>
                    {commonSubmitButton}
                </form> 
            );
        case 'suppliers': return ( <form onSubmit={handleSubmit} className="space-y-3"><input name="name" placeholder="Nama Supplier" className={commonInputClass} required /><input name="contactPerson" placeholder="Narahubung" className={commonInputClass} required /><input name="phone" placeholder="Telepon" className={commonInputClass} required /><input name="specialty" placeholder="Spesialisasi" className={commonInputClass} required />{commonSubmitButton}</form> );
        case 'karyawan': return (
            <form onSubmit={handleSubmit} className="space-y-3">
                <input name="name" placeholder="Nama Karyawan" className={commonInputClass} required />
                <input name="contact" placeholder="Kontak" className={commonInputClass} required />
                <select name="division" className={commonInputClass} required>
                    <option value="Kasir">Kasir</option>
                    <option value="Office">Office</option>
                    <option value="Produksi">Produksi</option>
                </select>
                {commonSubmitButton}
            </form> 
        );
        default: return null;
    }
  };

  const { paginatedData, totalItems } = useMemo(() => {
    const lowerCaseQuery = searchQuery.toLowerCase();
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    let data: { name: string, [key: string]: any }[] = [];

    switch (activeTab) {
        case 'products':
            data = products.filter(p => p.name.toLowerCase().includes(lowerCaseQuery) || p.category.toLowerCase().includes(lowerCaseQuery));
            break;
        case 'categories':
            data = categories.filter(c => c.name.toLowerCase().includes(lowerCaseQuery));
            break;
        case 'finishings':
            data = finishings.filter(f => f.name.toLowerCase().includes(lowerCaseQuery));
            break;
        case 'customers':
            data = customers.filter(c => c.name.toLowerCase().includes(lowerCaseQuery) || c.contact.toLowerCase().includes(lowerCaseQuery));
            break;
        case 'suppliers':
            data = suppliers.filter(s => s.name.toLowerCase().includes(lowerCaseQuery) || s.contactPerson.toLowerCase().includes(lowerCaseQuery));
            break;
        case 'karyawan':
            data = employees.filter(e => e.name.toLowerCase().includes(lowerCaseQuery) || e.contact.toLowerCase().includes(lowerCaseQuery));
            break;
    }

    // Sort the filtered data alphabetically by name
    data.sort((a, b) => a.name.localeCompare(b.name, 'id-ID', { sensitivity: 'base' }));

    return {
      paginatedData: data.slice(startIndex, startIndex + ITEMS_PER_PAGE),
      totalItems: data.length,
    };
  }, [activeTab, searchQuery, currentPage, products, categories, finishings, customers, suppliers, employees]);
  
  const renderContent = () => {
    // Reusable Table component
    const Table: React.FC<{headers: string[], children: React.ReactNode}> = ({headers, children}) => (
        <div className="overflow-x-auto"><table className="min-w-full bg-white"><thead className="bg-gray-100"><tr>{headers.map(h => (<th key={h} className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>))}</tr></thead><tbody className="divide-y divide-gray-200">{children}</tbody></table></div>
    );
    const Td: React.FC<{children:React.ReactNode, className?: string}> = ({children, className}) => (<td className={`py-4 px-4 whitespace-nowrap text-sm ${className}`}>{children}</td>);

    switch (activeTab) {
      case 'products':
        return (
            <Table headers={["Nama Layanan/Produk", "Kategori", "Harga (EC/R/G/S/C)"]}>
            {(paginatedData as ProductData[]).map((product) => (<tr key={product.id}><Td className="font-medium text-gray-900">{product.name}</Td><Td className="text-gray-500">{product.category}</Td><Td className="text-gray-500 text-xs">{`${product.price.endCustomer/1000}k / ${product.price.retail/1000}k / ${product.price.grosir/1000}k / ${product.price.reseller/1000}k / ${product.price.corporate/1000}k`}</Td></tr>))}
            </Table>
        );
      case 'categories':
        return (
          <Table headers={["Nama Kategori", "Tipe Satuan"]}>
              {(paginatedData as CategoryData[]).map((cat) => (<tr key={cat.id}><Td className="font-medium text-gray-900">{cat.name}</Td><Td className="text-gray-500">{cat.unitType}</Td></tr>))}
          </Table>
      );
      case 'finishings':
        return (
            <Table headers={["Nama Finishing", "Harga", "Kategori Terkait"]}>
                {(paginatedData as FinishingData[]).map((f) => {
                    const relatedCategories = f.categoryIds && f.categoryIds.length > 0
                        ? f.categoryIds.map(id => categories.find(c => c.id === id)?.name).filter(Boolean).join(', ')
                        : <span className="text-gray-400 italic">Semua Kategori</span>;

                    return (
                        <tr key={f.id}>
                            <Td className="font-medium text-gray-900">{f.name}</Td>
                            <Td className="text-gray-500">{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(f.price)}</Td>
                            <Td className="text-gray-500 text-xs">{relatedCategories}</Td>
                        </tr>
                    );
                })}
            </Table>
      );
      case 'customers':
        return (
            <Table headers={["Nama Pelanggan", "Kontak", "Level Harga", "Tanggal Bergabung"]}>
                {(paginatedData as CustomerData[]).map((c) => (<tr key={c.id}><Td className="font-medium text-gray-900">{c.name}</Td><Td className="text-gray-500">{c.contact}</Td><Td className="text-gray-500"><span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    c.level === 'Corporate' ? 'bg-cyan-100 text-cyan-800' :
                    c.level === 'Reseller' ? 'bg-teal-100 text-teal-800' :
                    c.level === 'Grosir' ? 'bg-yellow-100 text-yellow-800' :
                    c.level === 'Retail' ? 'bg-fuchsia-100 text-fuchsia-800' :
                    'bg-pink-100 text-pink-800'
                }`}>{c.level}</span></Td><Td className="text-gray-500">{new Date(c.joinDate).toLocaleDateString('id-ID')}</Td></tr>))}
            </Table>
      );
      case 'suppliers':
        return (
            <Table headers={["Nama Supplier", "Narahubung", "Telepon", "Spesialisasi"]}>
              {(paginatedData as SupplierData[]).map((s) => (<tr key={s.id}><Td className="font-medium text-gray-900">{s.name}</Td><Td className="text-gray-500">{s.contactPerson}</Td><Td className="text-gray-500">{s.phone}</Td><Td className="text-gray-500">{s.specialty}</Td></tr>))}
            </Table>
        );
      case 'karyawan':
        return (
            <Table headers={["Nama Karyawan", "Kontak", "Devisi", "Tanggal Bergabung"]}>
                {(paginatedData as EmployeeData[]).map((e) => (<tr key={e.id}>
                    <Td className="font-medium text-gray-900">{e.name}</Td>
                    <Td className="text-gray-500">{e.contact}</Td>
                    <Td className="text-gray-500">{e.division}</Td>
                    <Td className="text-gray-500">{new Date(e.joinDate).toLocaleDateString('id-ID')}</Td>
                </tr>))}
            </Table>
        );
    }
  };

  const TabButton: React.FC<{tabKey: string; label: string}> = ({ tabKey, label }) => (
    <button onClick={() => setActiveTab(tabKey)} className={`px-4 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${ activeTab === tabKey ? 'bg-pink-600 text-white shadow' : 'text-gray-600 hover:bg-gray-200' }`}>{label}</button>
  );
  
  const getModalTitle = () => {
      switch (activeTab) {
          case 'products': return 'Tambah Produk Baru';
          case 'categories': return 'Tambah Kategori Baru';
          case 'finishings': return 'Tambah Finishing Baru';
          case 'customers': return 'Tambah Pelanggan Baru';
          case 'suppliers': return 'Tambah Supplier Baru';
          case 'karyawan': return 'Tambah Karyawan Baru';
          default: return 'Tambah Baru';
      }
  }

  const getSearchPlaceholder = () => {
      switch(activeTab) {
          case 'products': return 'Cari produk atau kategori...';
          case 'customers': return 'Cari nama atau kontak pelanggan...';
          case 'suppliers': return 'Cari nama atau narahubung supplier...';
          case 'karyawan': return 'Cari nama atau kontak karyawan...';
          default: return 'Cari...';
      }
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-md flex flex-col">
      <div className="flex flex-wrap gap-2 justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Manajemen Data Master</h2>
        <div className="flex space-x-2">
            <button onClick={() => setIsImportExportModalOpen(true)} className="bg-gray-600 text-white px-4 py-2 rounded-lg font-semibold text-sm hover:bg-gray-700 transition-colors">Impor dan Ekspor Data</button>
            <button onClick={() => setIsModalOpen(true)} className="bg-pink-600 text-white px-4 py-2 rounded-lg font-semibold text-sm hover:bg-pink-700 transition-colors">+ Tambah Baru</button>
        </div>
      </div>
      
      <div className="flex space-x-2 border-b mb-4 flex-wrap">
        {accessibleTabs.map(tab => <TabButton key={tab.key} tabKey={tab.key} label={tab.label} />)}
      </div>

      <div className="relative mb-4">
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

      <div className="p-1 sm:p-4 bg-gray-50 rounded-lg min-h-[20rem] flex-1">
        {renderContent()}
      </div>

      <Pagination
        totalItems={totalItems}
        itemsPerPage={ITEMS_PER_PAGE}
        currentPage={currentPage}
        onPageChange={setCurrentPage}
      />

      <Modal show={isModalOpen} onClose={() => setIsModalOpen(false)} title={getModalTitle()}>
        {renderModalContent()}
      </Modal>

      <ImportExportModal
        show={isImportExportModalOpen}
        onClose={() => setIsImportExportModalOpen(false)}
        products={products}
        categories={categories}
        finishings={finishings}
        customers={customers}
        suppliers={suppliers}
        employees={employees}
        onAddProduct={onAddProduct}
        onAddCategory={onAddCategory}
        onAddFinishing={onAddFinishing}
        onAddCustomer={onAddCustomer}
        onAddSupplier={onAddSupplier}
        onAddEmployee={onAddEmployee}
       />
    </div>
  );
};

export default MasterData;