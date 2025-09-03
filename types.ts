import type React from 'react';

export type MenuKey =
  | 'dashboard'
  | 'sales'
  | 'receivables'
  | 'expenses'
  | 'payroll'
  | 'masterData'
  | 'managementData'
  | 'inventory'
  | 'production'
  | 'reports'
  | 'settings';

export interface TabItem {
  key: string;
  label: string;
}

export interface MenuItem {
  key: MenuKey;
  label: string;
  icon: React.ReactNode;
  tabs?: TabItem[];
}

// Tipe data untuk kartu pesanan di papan produksi
export interface CardData {
  id: string;
  customer: string;
  details: string;
}

// Tipe data untuk setiap kolom di papan produksi
export type ProductionStatus = 'queue' | 'printing' | 'warehouse' | 'delivered';

// Tipe data untuk seluruh papan kanban produksi
export interface KanbanData {
  queue: CardData[];
  printing: CardData[];
  warehouse: CardData[];
  delivered: CardData[];
}

// --- Master Data Types ---
export interface CustomerData {
  id: number;
  name: string;
  contact: string;
  level: 'End Customer' | 'Retail' | 'Grosir' | 'Reseller' | 'Corporate';
  joinDate: string;
}

export interface FinishingData {
  id: number;
  name: string;
  price: number;
  categoryIds?: number[];
}

export interface CategoryData {
  id: number;
  name: string;
  unitType: 'Per Luas' | 'Per Buah';
}

export interface ProductData {
  id: number;
  name: string;
  category: string;
  price: {
    endCustomer: number;
    retail: number;
    grosir: number;
    reseller: number;
    corporate: number;
  };
}

export interface SupplierData {
  id: number;
  name: string;
  contactPerson: string;
  phone: string;
  specialty: string;
}

export interface EmployeeData {
  id: number;
  name: string;
  contact: string;
  division: 'Kasir' | 'Office' | 'Produksi';
  joinDate: string;
}

export interface SalaryData {
  id: number;
  employeeId: number;
  division: 'Kasir' | 'Office' | 'Produksi';
  regularRate: number;
  overtimeRate: number;
}


// --- Sales & Order Types ---

// Tipe data untuk setiap item dalam order di form penjualan
export interface OrderItemData {
  id: number;
  productId: number | null;
  finishing: string;
  description: string;
  length: string;
  width: string;
  qty: number;
  customPrice?: number; // Field baru untuk harga kustom
}

// Tipe data untuk order yang disimpan di halaman penjualan (sebelum diproses)
// Menyimpan semua detail untuk keperluan edit
export interface SavedOrder {
  id: string;
  customer: string;
  orderDate: string;
  orderItems: OrderItemData[];
  details: string; // Ringkasan untuk tampilan cepat
  totalPrice: number;
}

// Tipe data untuk status pembayaran di halaman piutang
export type PaymentStatus = 'Belum Lunas' | 'Lunas';

// Tipe data untuk status produksi di halaman piutang
export type ProductionStatusDisplay = 'Dalam Antrian' | 'Proses Cetak' | 'Siap Ambil' | 'Telah Dikirim';

// Tipe data untuk setiap transaksi pembayaran
export interface Payment {
  amount: number;
  date: string;
  methodId: string;
  methodName: string;
}

// Tipe data untuk setiap item di halaman piutang
export interface ReceivableItem {
    id: string;
    customer: string;
    amount: number;
    due: string;
    paymentStatus: PaymentStatus;
    productionStatus: ProductionStatusDisplay;
    payments?: Payment[];
    discount?: number;
    deliveryDate?: string;
    deliveryNote?: string;
}

// Tipe data untuk setiap item di halaman pengeluaran
export interface ExpenseItem {
    id: number;
    name: string;
    category: string;
    amount: number;
    date: string;
}

// --- Inventory & Formula Types ---
export interface StockUsageRecord {
  date: string;
  amountUsed: number;
}

export interface InventoryItem {
  id: number;
  name: string;
  sku: string;
  stock: number;
  unit: string;
  type: 'Bahan Baku' | 'Barang Jadi';
  usageHistory?: StockUsageRecord[];
}

// --- Payroll Types ---
export interface AttendanceData {
  id: number;
  salaryId: number; // Links to SalaryData to get employee and rate info
  date: string;
  shift: 'Pagi' | 'Sore';
  clockIn: string;
  clockOut: string;
  isOvertime: boolean;
  overtimeHours?: number;
  overtimeMinutes?: number;
  overtimeNotes?: string;
}

export interface Deduction {
  amount: number;
  notes: string;
}

export interface Bonus {
  amount: number;
  notes: string;
}

export interface PayrollRecord {
  id: number;
  employeeId: number;
  startDate: string;
  endDate: string;
  baseSalary: number;
  overtimePay: number;
  deductions: Deduction[];
  bonuses: Bonus[];
  totalSalary: number;
  processedAttendance: AttendanceData[];
}

// --- User Management Types ---
export type UserLevel = 'Kasir' | 'Office' | 'Produksi' | 'Admin';

// This maps to the `profiles` table in Supabase
export interface Profile {
  id: string; // This is a UUID from auth.users
  name: string;
  level: UserLevel;
}

export type MenuPermissions = Record<UserLevel, string[]>;

// --- Legacy Data Import Types ---
export interface LegacyIncome {
  lastDate: string;
  amount: number;
}

export interface LegacyExpense {
  lastDate: string;
  amount: number;
}

export interface LegacyReceivable {
  id: number; // Simple numeric ID for legacy items
  customer: string;
  date: string;
  amount: number;
}

// --- Assets and Debts ---
export interface AssetItem {
  id: number;
  name: string;
  value: number;
}

export interface DebtItem {
  id: number;
  name: string;
  value: number;
}

// --- Settings Types ---
export interface NotificationSettings {
  lowStockAlert: boolean;
  lowStockThreshold: number;
  receivableDueSoonAlert: boolean;
  receivableDueSoonDays: number;
  receivableOverdueAlert: boolean;
  newOrderInQueueAlert: boolean;
  defaultDueDateDays: number;
}

export interface StoreInfo {
  name: string;
  address: string;
  phone: string;
  email: string;
}

export interface PaymentMethod {
  id: string;
  name: string;
  type: 'Tunai' | 'Transfer Bank' | 'QRIS' | 'E-Wallet';
  details: string;
}

// --- Notification Types ---
// Defines the structure for a notification item, used for display in the header.
export interface NotificationItem {
  id: string;
  icon: React.ReactNode;
  text: string;
  time: string; // ISO String for consistent time calculation
  type: 'warning' | 'info';
  onNavigate?: () => void;
}

// --- Component Props ---
export interface ReportsProps {
  allOrders: SavedOrder[];
  expenses: ExpenseItem[];
  receivables: ReceivableItem[];
  products: ProductData[];
  customers: CustomerData[];
  inventory: InventoryItem[];
  categories: CategoryData[];
  finishings: FinishingData[];
  menuPermissions: string[];
  legacyIncome: LegacyIncome | null;
  legacyExpense: LegacyExpense | null;
  legacyReceivables: LegacyReceivable[];
  assets: AssetItem[];
  debts: DebtItem[];
  notificationSettings: NotificationSettings;
  onSetLegacyIncome: (data: LegacyIncome | null) => void;
  onSetLegacyExpense: (data: LegacyExpense | null) => void;
  onAddLegacyReceivable: (data: Omit<LegacyReceivable, 'id'>) => void;
  onUpdateLegacyReceivable: (data: LegacyReceivable) => void;
  onDeleteLegacyReceivable: (id: number) => void;
  onSettleLegacyReceivable: (item: LegacyReceivable) => void;
  onAddAsset: (data: Omit<AssetItem, 'id'>) => void;
  onAddDebt: (data: Omit<DebtItem, 'id'>) => void;
}