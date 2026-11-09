

import React, { useState, useCallback, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Sales from './components/Sales';
import Receivables from './components/Receivables';
import Expenses from './components/Expenses';
import MasterData from './components/MasterData';
import Management from './components/Management';
import Inventory from './components/Inventory';
import Production from './components/Production';
import Reports from './components/Reports';
import Settings from './components/Settings';
import Header from './components/Header';
import Payroll from './components/Payroll';
import Login from './components/Login';
import { supabase } from './supabaseClient';
// @FIX: The 'Session' type is not exported in older versions of '@supabase/supabase-js'. It's removed to prevent type errors.
import { type MenuKey, type KanbanData, type SavedOrder, type ReceivableItem, type ProductionStatus, type ProductionStatusDisplay, type ProductData, type CategoryData, type FinishingData, type Payment, type CustomerData, type ExpenseItem, type InventoryItem, type SupplierData, type EmployeeData, type SalaryData, type AttendanceData, type PayrollRecord, type StockUsageRecord, type MenuPermissions, type LegacyMonthlyIncome, type LegacyMonthlyExpense, type LegacyReceivable, type AssetItem, type DebtItem, type NotificationSettings, type Profile, type UserLevel, type PaymentStatus, type Bonus, type Deduction, type StoreInfo, type PaymentMethod, type OrderItemData, type NotificationItem, CardData } from './types';
import { MENU_ITEMS, ALL_PERMISSIONS_LIST } from './constants';
import { ShoppingCartIcon, ExclamationTriangleIcon, CreditCardIcon } from './components/Icons';

console.log("Build: Script is being parsed and component is about to be created.");

const DEFAULT_MENU_PERMISSIONS: MenuPermissions = {
    Kasir: ["dashboard", "dashboard/penjualan", "sales", "receivables", "reports", "reports/dataPiutangLama"],
    Office: ["dashboard", "dashboard/penjualan", "dashboard/produksi", "sales", "receivables", "expenses", "payroll", "payroll/attendance", "payroll/summary", "masterData", "masterData/products", "masterData/categories", "masterData/finishings", "masterData/customers", "masterData/suppliers", "masterData/karyawan", "reports", "reports/sales", "reports/receivables", "reports/inventory", "reports/assetsDebts", "reports/dataPenjualanLama", "reports/finalRecap", "reports/dataPiutangLama", "reports/categorySales"],
    Produksi: ["dashboard", "dashboard/produksi", "production", "inventory"],
    Admin: ALL_PERMISSIONS_LIST
};

const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
    lowStockAlert: true,
    lowStockThreshold: 10,
    receivableDueSoonAlert: true,
    receivableDueSoonDays: 3,
    receivableOverdueAlert: true,
    newOrderInQueueAlert: false,
    defaultDueDateDays: 7,
};

const DEFAULT_STORE_INFO: StoreInfo = {
    name: "Nala Media Digital Printing",
    address: "Jl. Prof. Moh. Yamin, Cerbonan, Karanganyar",
    phone: "0813-9872-7722",
    email: "nalamedia.kra@gmail.com",
};

const DEFAULT_PAYMENT_METHODS: PaymentMethod[] = [
    { id: 'cash-default', name: 'Tunai', type: 'Tunai', details: 'Pembayaran tunai di kasir' }
];

// Helper function to fetch all data from a table with pagination
const fetchAllWithPagination = async (tableName: string) => {
    const BATCH_SIZE = 1000;
    let allData: any[] = [];
    let from = 0;
    
    while (true) {
        const { data, error } = await supabase
            .from(tableName)
            .select('*')
            .range(from, from + BATCH_SIZE - 1);
            
        if (error) {
            console.error(`Error fetching paginated data for ${tableName}:`, error);
            return { data: null, error };
        }

        if (data) {
            allData = allData.concat(data);
        }
        
        if (!data || data.length < BATCH_SIZE) {
            break; // Last page
        }
        
        from += BATCH_SIZE;
    }
    
    return { data: allData, error: null };
};


const App: React.FC = () => {
  console.log("Render: Component is rendering.");
  const [isLoading, setIsLoading] = useState(true);
  // @FIX: Using `any` for session state because `Session` type is not exported in the assumed older Supabase library version.
  const [session, setSession] = useState<any | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [activeMenu, setActiveMenu] = useState<MenuKey>('dashboard');
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  
  // All data states
  const [allOrders, setAllOrders] = useState<SavedOrder[]>([]);
  const [unprocessedOrders, setUnprocessedOrders] = useState<SavedOrder[]>([]);
  const [boardData, setBoardData] = useState<KanbanData>({ queue: [], printing: [], warehouse: [], delivered: [] });
  const [receivables, setReceivables] = useState<ReceivableItem[]>([]);
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [products, setProducts] = useState<ProductData[]>([]);
  const [categories, setCategories] = useState<CategoryData[]>([]);
  const [finishings, setFinishings] = useState<FinishingData[]>([]);
  const [customers, setCustomers] = useState<CustomerData[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierData[]>([]);
  const [employees, setEmployees] = useState<EmployeeData[]>([]);
  const [salaries, setSalaries] = useState<SalaryData[]>([]);
  const [attendance, setAttendance] = useState<AttendanceData[]>([]);
  const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [menuPermissions, setMenuPermissions] = useState<MenuPermissions>(DEFAULT_MENU_PERMISSIONS);
  const [legacyMonthlyIncomes, setLegacyMonthlyIncomes] = useState<LegacyMonthlyIncome[]>([]);
  const [legacyMonthlyExpenses, setLegacyMonthlyExpenses] = useState<LegacyMonthlyExpense[]>([]);
  const [legacyReceivables, setLegacyReceivables] = useState<LegacyReceivable[]>([]);
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [debts, setDebts] = useState<DebtItem[]>([]);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);
  const [storeInfo, setStoreInfo] = useState<StoreInfo>(DEFAULT_STORE_INFO);
  const [noteCounter, setNoteCounter] = useState(1);
  const [notePrefix, setNotePrefix] = useState('INV-');
  const [initialCash, setInitialCash] = useState<number>(0);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>(DEFAULT_PAYMENT_METHODS);


  const clearAllData = useCallback(() => {
    console.log("Clearing all application data.");
    setProfile(null);
    setAllOrders([]);
    setUnprocessedOrders([]);
    setBoardData({ queue: [], printing: [], warehouse: [], delivered: [] });
    setReceivables([]);
    setExpenses([]);
    setProducts([]);
    setCategories([]);
    setFinishings([]);
    setCustomers([]);
    setSuppliers([]);
    setEmployees([]);
    setSalaries([]);
    setAttendance([]);
    setPayrollRecords([]);
    setInventory([]);
    setUsers([]);
    setMenuPermissions(DEFAULT_MENU_PERMISSIONS);
    setNotificationSettings(DEFAULT_NOTIFICATION_SETTINGS);
    setStoreInfo(DEFAULT_STORE_INFO);
    setPaymentMethods(DEFAULT_PAYMENT_METHODS);
    setLegacyMonthlyIncomes([]);
    setLegacyMonthlyExpenses([]);
    setLegacyReceivables([]);
    setAssets([]);
    setDebts([]);
    setNoteCounter(1);
    setNotePrefix('INV-');
    setInitialCash(0);
    setNotifications([]);
  }, []);

  const fetchAllData = useCallback(async () => {
    console.log("Fetching all data from Supabase...");
    const tableFetchPromises = {
        orders: fetchAllWithPagination('orders'),
        receivables: fetchAllWithPagination('receivables'),
        products: fetchAllWithPagination('products'),
        categories: fetchAllWithPagination('categories'),
        finishings: fetchAllWithPagination('finishings'),
        customers: fetchAllWithPagination('customers'),
        suppliers: fetchAllWithPagination('suppliers'),
        employees: fetchAllWithPagination('employees'),
        salaries: fetchAllWithPagination('salaries'),
        attendance: fetchAllWithPagination('attendance'),
        payroll_records: fetchAllWithPagination('payroll_records'),
        inventory: fetchAllWithPagination('inventory'),
        expenses: fetchAllWithPagination('expenses'),
        profiles: fetchAllWithPagination('profiles'),
        legacy_data: fetchAllWithPagination('legacy_data'),
        legacy_expense: fetchAllWithPagination('legacy_expense'),
        legacy_receivables: fetchAllWithPagination('legacy_receivables'),
        assets: fetchAllWithPagination('assets'),
        debts: fetchAllWithPagination('debts'),
        app_settings: fetchAllWithPagination('app_settings'),
        app_sequences: supabase.from('app_sequences').select('current_value, prefix').eq('name', 'order_nota').single(),
    };

    const results = await Promise.all(Object.values(tableFetchPromises));
    const dataMap: { [key: string]: any } = {};
    Object.keys(tableFetchPromises).forEach((key, index) => {
        const { data, error } = results[index];
        if (error) console.error(`Error fetching ${key}:`, error.message);
        dataMap[key] = data || (Array.isArray(data) ? [] : null);
    });
    
    setAllOrders(dataMap.orders);
    setReceivables(dataMap.receivables);
    setProducts(dataMap.products);
    setCategories(dataMap.categories);
    setFinishings(dataMap.finishings);
    setCustomers(dataMap.customers);
    setSuppliers(dataMap.suppliers);
    setEmployees(dataMap.employees);
    setSalaries(dataMap.salaries);
    setAttendance(dataMap.attendance);
    setPayrollRecords(dataMap.payroll_records);
    setInventory(dataMap.inventory);
    setExpenses(dataMap.expenses);
    
    if (dataMap.app_sequences) {
        setNoteCounter(dataMap.app_sequences.current_value);
        setNotePrefix(dataMap.app_sequences.prefix || 'INV-');
    }
    
    const profilesFromDB = dataMap.profiles as { id: number, uuid: string | null, name: string, level: UserLevel }[];
    const mappedProfiles: Profile[] = profilesFromDB.map(p => ({
        id: p.uuid || `temp-id-${p.id}`,
        name: p.name,
        level: p.level,
    }));
    setUsers(mappedProfiles);

    setLegacyMonthlyIncomes(dataMap.legacy_data);
    setLegacyMonthlyExpenses(dataMap.legacy_expense);
    setLegacyReceivables(dataMap.legacy_receivables);
    setAssets(dataMap.assets);
    setDebts(dataMap.debts);
    
    // Process settings
    const settings = dataMap.app_settings;
    const menuPermsSetting = settings.find((s:any) => s.key === 'menuPermissions');
    const notifSetting = settings.find((s:any) => s.key === 'notificationSettings');
    const storeInfoSetting = settings.find((s:any) => s.key === 'storeInfo');
    const initialCashSetting = settings.find((s:any) => s.key === 'initialCash');
    const paymentMethodsSetting = settings.find((s:any) => s.key === 'paymentMethods');

    if (menuPermsSetting && menuPermsSetting.value) {
        const dbPermissions = menuPermsSetting.value as MenuPermissions;
        dbPermissions.Admin = ALL_PERMISSIONS_LIST;
        setMenuPermissions(dbPermissions);
    }
    if (notifSetting && notifSetting.value) {
        setNotificationSettings({ ...DEFAULT_NOTIFICATION_SETTINGS, ...notifSetting.value });
    }
    if (storeInfoSetting) setStoreInfo(storeInfoSetting.value);
    if (paymentMethodsSetting && Array.isArray(paymentMethodsSetting.value)) {
        setPaymentMethods(paymentMethodsSetting.value);
    }
    if (initialCashSetting && typeof initialCashSetting.value === 'number') {
        setInitialCash(initialCashSetting.value);
    } else {
        setInitialCash(0);
    }
    console.log("All data fetched and processed.");
  }, []);

  useEffect(() => {
    const initializeSession = async () => {
      try {
        // @FIX: Replaced `getSession` with `session` for compatibility with older Supabase versions.
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error("Error getting session, possibly invalid token. Signing out.", sessionError);
          // @FIX: Corrected method call for compatibility.
          await supabase.auth.signOut();
          clearAllData();
          return;
        }

        setSession(session);
        
        if (session?.user) {
          const { data: userProfile, error: profileError } = await supabase
            .from('profiles')
            .select('id, uuid, name, level')
            .eq('uuid', session.user.id)
            .single();

          if (profileError || !userProfile) {
            console.error("Profile not found for session, signing out:", profileError?.message);
            // @FIX: Corrected method call for compatibility.
            await supabase.auth.signOut();
            clearAllData();
          } else {
            const mappedProfile: Profile = {
                id: userProfile.uuid,
                name: userProfile.name,
                level: userProfile.level
            };
            setProfile(mappedProfile);
            await fetchAllData();
          }
        } else {
          clearAllData();
        }
      } catch (error) {
        console.error("Error initializing session:", error);
        clearAllData();
      } finally {
        setIsLoading(false);
      }
    };

    initializeSession();

    // @FIX: Corrected method call for compatibility.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log("Auth state changed, event:", _event);
      setSession(session);
      if (_event === 'SIGNED_OUT') {
        clearAllData();
      } else if (_event === 'SIGNED_IN') {
        initializeSession();
      }
    });

    console.log("End: useEffect for auth has run.");
    
    return () => {
      console.log("Cleaning up auth subscription.");
      subscription.unsubscribe();
    };
  }, [fetchAllData, clearAllData]);

  // --- Recalculate Derived State ---
  useEffect(() => {
    if (isLoading) return; // Don't run on initial empty arrays

    const processedReceivables = receivables.filter(r => r.productionStatus !== 'Dalam Antrian');
    const processedOrderIds = new Set(processedReceivables.map(r => r.id));
    setUnprocessedOrders(allOrders.filter(o => !processedOrderIds.has(o.id)));

    const newBoardData: KanbanData = { queue: [], printing: [], warehouse: [], delivered: [] };
    receivables.forEach(r => {
        const order = allOrders.find(o => o.id === r.id);
        if (order) {
            const cardData: CardData = { id: order.id, customer: order.customer, details: order.details };
            switch (r.productionStatus) {
                case 'Dalam Antrian': newBoardData.queue.push(cardData); break;
                case 'Proses Cetak': newBoardData.printing.push(cardData); break;
                case 'Siap Ambil': newBoardData.warehouse.push(cardData); break;
                case 'Telah Dikirim': newBoardData.delivered.push(cardData); break;
            }
        }
    });
    setBoardData(newBoardData);
  }, [allOrders, receivables, isLoading]);


  // --- Real-time Subscription ---
  useEffect(() => {
    if (!profile) return;

    const handleRealtimeUpdate = (payload: any) => {
        console.log('Real-time change received!', payload);
        const { table, eventType, new: newRecord, old: oldRecord } = payload;
        
        const genericUpdate = <T extends { id: any }>(
            setter: React.Dispatch<React.SetStateAction<T[]>>
        ) => {
            switch (eventType) {
                case 'INSERT':
                    setter(prev => [...prev, newRecord as T]);
                    break;
                case 'UPDATE':
                    setter(prev => prev.map(item => item.id === newRecord.id ? (newRecord as T) : item));
                    break;
                case 'DELETE':
                    setter(prev => prev.filter(item => item.id !== oldRecord.id));
                    break;
            }
        };
        
        switch (table) {
            case 'orders': genericUpdate(setAllOrders); break;
            case 'receivables': genericUpdate(setReceivables); break;
            case 'products': genericUpdate(setProducts); break;
            case 'categories': genericUpdate(setCategories); break;
            case 'finishings': genericUpdate(setFinishings); break;
            case 'customers': genericUpdate(setCustomers); break;
            case 'suppliers': genericUpdate(setSuppliers); break;
            case 'employees': genericUpdate(setEmployees); break;
            case 'salaries': genericUpdate(setSalaries); break;
            case 'attendance': genericUpdate(setAttendance); break;
            case 'payroll_records': genericUpdate(setPayrollRecords); break;
            case 'inventory': genericUpdate(setInventory); break;
            case 'expenses': genericUpdate(setExpenses); break;
            case 'legacy_data': genericUpdate(setLegacyMonthlyIncomes); break;
            case 'legacy_expense': genericUpdate(setLegacyMonthlyExpenses); break;
            case 'legacy_receivables': genericUpdate(setLegacyReceivables); break;
            case 'assets': genericUpdate(setAssets); break;
            case 'debts': genericUpdate(setDebts); break;

            case 'profiles':
                switch (eventType) {
                    case 'INSERT':
                        setUsers(prev => [...prev, { id: newRecord.uuid, name: newRecord.name, level: newRecord.level }]);
                        break;
                    case 'UPDATE':
                        setUsers(prev => prev.map(u => u.id === newRecord.uuid ? { ...u, name: newRecord.name, level: newRecord.level } : u));
                        if (profile?.id === newRecord.uuid) {
                            setProfile(prev => prev ? { ...prev, name: newRecord.name, level: newRecord.level } : null);
                        }
                        break;
                    case 'DELETE':
                        setUsers(prev => prev.filter(u => u.id !== oldRecord.uuid));
                        break;
                }
                break;
            
            case 'app_settings':
                if (eventType === 'INSERT' || eventType === 'UPDATE') {
                    const { key, value } = newRecord;
                    switch (key) {
                        case 'menuPermissions':
                            const dbPermissions = value as MenuPermissions;
                            dbPermissions.Admin = ALL_PERMISSIONS_LIST;
                            setMenuPermissions(dbPermissions);
                            break;
                        case 'notificationSettings':
                            setNotificationSettings(prev => ({ ...prev, ...value }));
                            break;
                        case 'storeInfo': setStoreInfo(value); break;
                        case 'paymentMethods': setPaymentMethods(Array.isArray(value) ? value : DEFAULT_PAYMENT_METHODS); break;
                        case 'initialCash': setInitialCash(typeof value === 'number' ? value : 0); break;
                    }
                }
                break;

            case 'app_sequences':
                if (eventType === 'UPDATE' && newRecord.name === 'order_nota') {
                    setNoteCounter(newRecord.current_value);
                    setNotePrefix(newRecord.prefix || 'INV-');
                }
                break;
        }
    };

    console.log("Setting up optimized real-time subscription...");

    const channel = supabase
        .channel('public-changes')
        .on(
            'postgres_changes',
            { event: '*', schema: 'public' },
            handleRealtimeUpdate
        )
        .subscribe();

    return () => {
        console.log("Removing real-time subscription.");
        supabase.removeChannel(channel);
    };
  }, [profile]);


  // --- Notification Generation ---
  // This section generates notifications based on current app state and user settings.
  const navigateTo = useCallback((menu: MenuKey) => setActiveMenu(menu), []);

  useEffect(() => {
      if (!profile) return;

      const generateNotifications = () => {
          const newNotifications: NotificationItem[] = [];
          const now = new Date();

          // 1. Low Stock Alert
          if (notificationSettings.lowStockAlert) {
              inventory.forEach(item => {
                  if (item.stock <= notificationSettings.lowStockThreshold) {
                      newNotifications.push({
                          id: `low-stock-${item.id}`,
                          icon: <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />,
                          text: `Stok '${item.name}' menipis! Sisa ${item.stock} ${item.unit}.`,
                          time: now.toISOString(),
                          type: 'warning',
                          onNavigate: () => navigateTo('inventory'),
                      });
                  }
              });
          }
          
          // 2. Receivables Alerts moved to Receivables.tsx
          
          // 3. New Orders in Queue Alert
          if (notificationSettings.newOrderInQueueAlert && unprocessedOrders.length > 0) {
              newNotifications.push({
                  id: 'new-orders-summary',
                  icon: <ShoppingCartIcon className="h-5 w-5 text-blue-500" />,
                  text: `Ada ${unprocessedOrders.length} order baru di antrian produksi.`,
                  time: now.toISOString(),
                  type: 'info',
                  onNavigate: () => navigateTo('production'),
              });
          }
          
          setNotifications(newNotifications.sort((a,b) => b.time.localeCompare(a.time)));
      };

      generateNotifications();
  }, [inventory, unprocessedOrders, notificationSettings, profile, navigateTo]);

  const handleDismissNotification = useCallback((id: string) => {
      setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  // --- Data Handlers ---
  const handleAddProfile = useCallback(async (newProfileData: { name: string; level: UserLevel }) => {
    const tempUuid = crypto.randomUUID();
    const newProfile = { ...newProfileData, uuid: tempUuid };

    const { data, error } = await supabase.from('profiles').insert(newProfile).select('id, uuid, name, level').single();

    if (error) {
        console.error("Error adding profile:", error);
        alert(`Gagal menambahkan profil: ${error.message}.`);
    } else if (data) {
        // State will be updated by real-time subscription
        alert("Profil baru berhasil ditambahkan dengan ID sementara. Silakan perbarui UUID di dasbor Supabase.");
    }
  }, []);

  const handleUpdateUser = useCallback(async (updatedUser: Profile) => {
    const { error } = await supabase
        .from('profiles')
        .update({ name: updatedUser.name, level: updatedUser.level })
        .eq('uuid', updatedUser.id);

    if (error) {
        console.error("Error updating user profile:", error);
        alert(`Gagal memperbarui profil: ${error.message}`);
    } else {
        // State will be updated by real-time subscription
        alert("Profil pengguna berhasil diperbarui.");
    }
  }, []);

  const handleUpdateMenuPermissions = useCallback(async (newPermissions: MenuPermissions) => {
    const { error } = await supabase
        .from('app_settings')
        .upsert({ key: 'menuPermissions', value: newPermissions }, { onConflict: 'key' });

    if (error) {
        console.error("Error updating menu permissions:", error);
        alert(`Gagal menyimpan hak akses menu: ${error.message}`);
    } else {
        // State will be updated by real-time subscription
        alert("Hak akses menu berhasil diperbarui.");
    }
  }, []);

  const handleUpdateNotificationSettings = useCallback(async (newSettings: NotificationSettings) => {
    const { error } = await supabase
        .from('app_settings')
        .upsert({ key: 'notificationSettings', value: newSettings }, { onConflict: 'key' });
        
    if (error) {
        console.error("Error updating notification settings:", error);
        alert(`Gagal menyimpan pengaturan notifikasi: ${error.message}`);
    } else {
        // State will be updated by real-time subscription
        alert("Pengaturan notifikasi berhasil diperbarui.");
    }
  }, []);

  const handleUpdateStoreInfo = useCallback(async (newInfo: StoreInfo) => {
    const { error } = await supabase
        .from('app_settings')
        .upsert({ key: 'storeInfo', value: newInfo }, { onConflict: 'key' });

    if (error) {
        console.error("Error updating store info:", error);
        alert(`Gagal menyimpan info toko: ${error.message}`);
    } else {
        // State will be updated by real-time subscription
        alert("Informasi toko berhasil diperbarui.");
    }
  }, []);
  
  const handleUpdatePaymentMethods = useCallback(async (newMethods: PaymentMethod[]) => {
    const { error } = await supabase
        .from('app_settings')
        .upsert({ key: 'paymentMethods', value: newMethods }, { onConflict: 'key' });

    if (error) {
        console.error("Error updating payment methods:", error);
        alert(`Gagal menyimpan metode pembayaran: ${error.message}`);
    } else {
        // State will be updated by real-time subscription
        alert("Metode pembayaran berhasil diperbarui.");
    }
  }, []);

  const handleUpdateInitialCash = useCallback(async (amount: number) => {
    const { error } = await supabase
        .from('app_settings')
        .upsert({ key: 'initialCash', value: amount }, { onConflict: 'key' });

    if (error) {
        console.error("Error updating initial cash:", error);
        alert(`Gagal menyimpan kas awal: ${error.message}`);
    } else {
        // State will be updated by real-time subscription
        alert("Kas awal berhasil diperbarui.");
    }
  }, []);

  const handleSaveOrder = useCallback(async (newOrder: SavedOrder) => {
      const { data, error } = await supabase.from('orders').insert(newOrder).select().single();
      if (error || !data) {
          alert(`Gagal menyimpan order: ${error?.message}`); return;
      }
      const { error: seqError } = await supabase.from('app_sequences').update({ current_value: noteCounter + 1 }).eq('name', 'order_nota');
      if (seqError) console.error('Failed to update sequence');

      // State will be updated by real-time subscription
  }, [noteCounter]);

  const handleSaveLegacyOrder = useCallback(async (legacyOrder: SavedOrder) => {
    // 1. Save the order
    const { data: orderData, error: orderError } = await supabase.from('orders').insert(legacyOrder).select().single();
    if (orderError || !orderData) {
        alert(`Gagal menyimpan order data lama: ${orderError?.message}`);
        return;
    }

    // 2. Increment nota counter
    const { error: seqError } = await supabase.from('app_sequences').update({ current_value: noteCounter + 1 }).eq('name', 'order_nota');
    if (seqError) console.error('Failed to update sequence for legacy order');
    
    // 3. Create a receivable with 'Data Lama' status
    const dueDate = new Date(legacyOrder.orderDate);
    dueDate.setDate(dueDate.getDate() + notificationSettings.defaultDueDateDays);
    const newDueDate = dueDate.toISOString().substring(0, 10);

    const newReceivable: Omit<ReceivableItem, 'payments'> = {
        id: legacyOrder.id,
        customer: legacyOrder.customer,
        amount: legacyOrder.totalPrice,
        due: newDueDate,
        paymentStatus: 'Belum Lunas',
        productionStatus: 'Data Lama'
    };

    const { error: receivableError } = await supabase.from('receivables').insert(newReceivable);
    if (receivableError) {
        alert(`Order data lama berhasil disimpan, tapi gagal membuat data piutang: ${receivableError.message}`);
        return;
    }
    
    // State will be updated by real-time subscription
    alert(`Piutang lama ${legacyOrder.id} berhasil disimpan dan ditambahkan ke halaman Pembayaran.`);

  }, [noteCounter, notificationSettings]);

  const handleUpdateOrder = useCallback(async (updatedOrder: SavedOrder) => {
      // First, update the order itself
      const { error: orderError } = await supabase
        .from('orders')
        .update(updatedOrder)
        .eq('id', updatedOrder.id);
      
      if (orderError) { 
        alert(`Gagal update order: ${orderError?.message}`); 
        return; 
      }

      // Now, check if a corresponding receivable exists and update its amount and status to sync.
      const existingReceivable = receivables.find(r => r.id === updatedOrder.id);
      if (existingReceivable) {
        const totalPaid = existingReceivable.payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
        const discount = existingReceivable.discount || 0;
        const newPaymentStatus: PaymentStatus = (totalPaid + discount >= updatedOrder.totalPrice) ? 'Lunas' : 'Belum Lunas';

        const updatePayload = {
            amount: updatedOrder.totalPrice,
            paymentStatus: newPaymentStatus,
        };

        const { error: receivableError } = await supabase
            .from('receivables')
            .update(updatePayload)
            .eq('id', updatedOrder.id);
        
        if (receivableError) {
            alert(`Order berhasil diupdate, tetapi gagal sinkronisasi harga & status ke data pembayaran: ${receivableError.message}`);
        }
      }
      
      // The real-time subscription will handle updating the local state automatically.
  }, [receivables]);

  const handleProcessOrder = useCallback(async (orderId: string) => {
    const existingReceivable = receivables.find(r => r.id === orderId);

    if (existingReceivable) {
        const { error } = await supabase
            .from('receivables')
            .update({ productionStatus: 'Proses Cetak' })
            .eq('id', orderId);
        if (error) { alert(`Gagal update status produksi: ${error.message}`); }
    } else {
        const order = allOrders.find(o => o.id === orderId);
        if (!order) return;

        const dueDate = new Date(order.orderDate);
        dueDate.setDate(dueDate.getDate() + notificationSettings.defaultDueDateDays);
        const newDueDate = dueDate.toISOString().substring(0, 10);

        const newReceivable: Omit<ReceivableItem, 'payments'> = {
            id: order.id,
            customer: order.customer,
            amount: order.totalPrice,
            due: newDueDate,
            paymentStatus: 'Belum Lunas',
            productionStatus: 'Proses Cetak'
        };
        const { error } = await supabase.from('receivables').insert(newReceivable);
        if (error) { alert(`Gagal proses order: ${error?.message}`); }
    }
  }, [allOrders, receivables, notificationSettings]);

  const handleDeleteOrder = useCallback(async (orderId: string) => {
      const { error } = await supabase.from('orders').delete().eq('id', orderId);
      if (error) { alert(`Gagal hapus order: ${error.message}`); }
      // State updates will be handled by real-time subscription.
  }, []);

  const handleUpdateNoteSettings = useCallback(async (prefix: string, startNumber: number) => {
    const { error } = await supabase
        .from('app_sequences')
        .update({ prefix, current_value: startNumber })
        .eq('name', 'order_nota');
        
    if (error) { 
        alert(`Gagal update pengaturan nota: ${error.message}`); 
    } else { 
        // State updates will be handled by real-time subscription
        alert('Pengaturan nomor nota berhasil diperbarui.');
    }
  }, []);
  
  const handleProcessPayment = useCallback(async (orderId: string, paymentDetails: Payment, newDiscount?: number, updatedItems?: OrderItemData[], newTotalAmount?: number) => {
    const receivable = receivables.find(r => r.id === orderId);
    if (!receivable) return;
    
    const finalTotalAmount = newTotalAmount !== undefined ? newTotalAmount : receivable.amount;
    
    if (updatedItems) {
        const { error: orderUpdateError } = await supabase
            .from('orders')
            .update({ orderItems: updatedItems, totalPrice: finalTotalAmount })
            .eq('id', orderId);

        if (orderUpdateError) {
            alert(`Gagal memperbarui detail order: ${orderUpdateError.message}`);
            return;
        }
    }

    const existingPayments = receivable.payments || [];
    const updatedPayments = [...existingPayments, paymentDetails];
    const totalPaid = updatedPayments.reduce((sum, p) => sum + p.amount, 0);
    
    const discount = newDiscount !== undefined ? newDiscount : (receivable.discount || 0);
    
    let newPaymentStatus: PaymentStatus = receivable.paymentStatus;
    if (totalPaid + discount >= finalTotalAmount) {
        newPaymentStatus = 'Lunas';
    }
    
    const updatePayload: any = {
        amount: finalTotalAmount,
        payments: updatedPayments,
        paymentStatus: newPaymentStatus,
    };

    if (newDiscount !== undefined) {
        updatePayload.discount = newDiscount;
    }

    const { error } = await supabase.from('receivables').update(updatePayload).eq('id', orderId);
    
    if (error) { alert(`Gagal proses bayar: ${error?.message}`); }
    // State updates will be handled by real-time subscription.
  }, [receivables]);
  
  const handlePayUnprocessedOrder = useCallback(async (orderId: string, paymentDetails: Payment, newDiscount: number, updatedItems?: OrderItemData[], newTotalAmount?: number) => {
    const order = allOrders.find(o => o.id === orderId);
    if (!order) {
        alert('Order tidak ditemukan!');
        return;
    }

    const finalTotalAmount = newTotalAmount !== undefined ? newTotalAmount : order.totalPrice;
    
    if (updatedItems) {
        const { error: orderUpdateError } = await supabase
            .from('orders')
            .update({ orderItems: updatedItems, totalPrice: finalTotalAmount })
            .eq('id', orderId);

        if (orderUpdateError) {
            alert(`Gagal memperbarui detail order: ${orderUpdateError.message}`);
            return;
        }
    }
    
    const totalPaid = paymentDetails.amount;
    let newPaymentStatus: PaymentStatus = 'Belum Lunas';
    if (totalPaid + newDiscount >= finalTotalAmount) {
        newPaymentStatus = 'Lunas';
    }

    const dueDate = new Date(order.orderDate);
    dueDate.setDate(dueDate.getDate() + notificationSettings.defaultDueDateDays);
    const newDueDate = dueDate.toISOString().substring(0, 10);

    const newReceivable: ReceivableItem = {
        id: order.id, customer: order.customer, amount: finalTotalAmount,
        due: newDueDate, paymentStatus: newPaymentStatus,
        productionStatus: 'Dalam Antrian', payments: [paymentDetails],
        discount: newDiscount,
    };

    const { error } = await supabase.from('receivables').insert(newReceivable);
    if (error) {
        alert(`Gagal memproses pembayaran untuk order baru: ${error?.message}`);
    }
  }, [allOrders, notificationSettings]);

  const handleUpdateReceivableDueDate = useCallback(async (orderId: string, newDueDate: string) => {
    const { error } = await supabase.from('receivables').update({ due: newDueDate }).eq('id', orderId);
    if (error) { alert(`Gagal memperbarui tanggal jatuh tempo: ${error.message}`); }
  }, []);

  const handleBulkUpdateReceivableDueDate = useCallback(async (orderIds: string[], newDueDate: string) => {
    if (orderIds.length === 0) return;
    const { error } = await supabase.from('receivables').update({ due: newDueDate }).in('id', orderIds);
    if (error) { alert(`Gagal memperbarui tanggal jatuh tempo secara massal: ${error.message}`);
    } else { alert(`${orderIds.length} nota berhasil diperbarui tanggal jatuh temponya.`); }
  }, []);


  const handleBulkProcessPayment = useCallback(async (orderIds: string[], paymentDate: string, paymentMethodId: string) => {
    const method = paymentMethods.find(m => m.id === paymentMethodId);
    if (!method) return;

    const receivableIds = new Set(receivables.map(r => r.id));
    const operations: any[] = [];

    orderIds.forEach(id => {
        if (receivableIds.has(id)) {
            const receivable = receivables.find(r => r.id === id)!;
            const totalPaid = receivable.payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
            const remainingAmount = receivable.amount - (receivable.discount || 0) - totalPaid;
            if (remainingAmount > 0) {
                const newPayment: Payment = { amount: remainingAmount, date: paymentDate, methodId: method.id, methodName: method.name };
                const updatedPayments = [...(receivable.payments || []), newPayment];
                operations.push(supabase.from('receivables').update({ payments: updatedPayments, paymentStatus: 'Lunas' }).eq('id', id));
            }
        } else {
            const order = allOrders.find(o => o.id === id);
            if (order) {
                const payment: Payment = { amount: order.totalPrice, date: paymentDate, methodId: method.id, methodName: method.name };
                
                const dueDate = new Date(order.orderDate);
                dueDate.setDate(dueDate.getDate() + notificationSettings.defaultDueDateDays);
                const newDueDate = dueDate.toISOString().substring(0, 10);

                const newReceivable: ReceivableItem = {
                    id: order.id, customer: order.customer, amount: order.totalPrice,
                    due: newDueDate, paymentStatus: 'Lunas', productionStatus: 'Dalam Antrian',
                    payments: [payment], discount: 0,
                };
                operations.push(supabase.from('receivables').insert(newReceivable));
            }
        }
    });

    await Promise.all(operations);
  }, [receivables, allOrders, paymentMethods, notificationSettings]);

  const handleAddExpense = useCallback(async (newExpense: Omit<ExpenseItem, 'id'>) => {
    const { error } = await supabase.from('expenses').insert(newExpense);
    if (error) { alert(`Gagal tambah pengeluaran: ${error?.message}`); }
  }, []);
  
  const handleProductionMove = useCallback(async (orderId: string, from: ProductionStatus, to: ProductionStatus) => {
    const statusMap: Record<ProductionStatus, ProductionStatusDisplay> = { queue: 'Dalam Antrian', printing: 'Proses Cetak', warehouse: 'Siap Ambil', delivered: 'Telah Dikirim' };
    const { error } = await supabase.from('receivables').update({ productionStatus: statusMap[to] }).eq('id', orderId);
    if (error) { alert(`Gagal pindah status: ${error.message}`); }
  }, []);

  const handleDeliverOrder = useCallback(async (orderId: string, deliveryNote: string) => {
    const updatePayload = {
      productionStatus: 'Telah Dikirim' as ProductionStatusDisplay,
      deliveryDate: new Date().toISOString().substring(0, 10),
      deliveryNote: deliveryNote,
    };
    const { error } = await supabase.from('receivables').update(updatePayload).eq('id', orderId);
    if (error) { alert(`Gagal menyerahkan order: ${error.message}`); }
  }, []);

  const handleCancelQueue = useCallback(async (orderId: string) => {
    const { error } = await supabase.from('receivables').delete().eq('id', orderId);
    if (error) { alert(`Gagal batal antrian: ${error.message}`); }
  }, []);

  const handleUseStock = useCallback(async (itemId: number, amountUsed: number, usageDate: string) => {
      const item = inventory.find(i => i.id === itemId);
      if (!item) return;
      const newStock = item.stock - amountUsed;
      const newHistory: StockUsageRecord = { date: usageDate, amountUsed };
      const updatedHistory = [...(item.usageHistory || []), newHistory];
      const { error } = await supabase.from('inventory').update({ stock: newStock, usageHistory: updatedHistory }).eq('id', itemId);
      if (error) { alert(`Gagal update stok: ${error.message}`); }
  }, [inventory]);

    const genericAddHandler = useCallback(async (table: string, newItem: any) => {
        const { error } = await supabase.from(table).insert(newItem);
        if (error) { alert(`Gagal menambah data: ${error.message}`); }
    }, []);
    
  const handleAddProduct = (p: Omit<ProductData, 'id'>) => genericAddHandler('products', p);
  const handleAddCategory = (c: Omit<CategoryData, 'id'>) => genericAddHandler('categories', c);
  const handleAddFinishing = (f: Omit<FinishingData, 'id'>) => genericAddHandler('finishings', f);
  const handleAddCustomer = (c: Omit<CustomerData, 'id' | 'joinDate'>) => genericAddHandler('customers', { ...c, joinDate: new Date().toISOString() });
  const handleAddSupplier = (s: Omit<SupplierData, 'id'>) => genericAddHandler('suppliers', s);
  const handleAddEmployee = (e: Omit<EmployeeData, 'id' | 'joinDate'>) => genericAddHandler('employees', { ...e, joinDate: new Date().toISOString() });

  const genericUpdateHandler = useCallback(async (table: string, updatedItem: {id: any}) => {
      const { error } = await supabase.from(table).update(updatedItem).eq('id', updatedItem.id);
      if (error) { alert(`Gagal update data: ${error.message}`); }
  }, []);

  const genericDeleteHandler = useCallback(async (table: string, id: number) => {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) { alert(`Gagal hapus data: ${error.message}`); }
  }, []);

  const handleUpdateProduct = (p: ProductData) => genericUpdateHandler('products', p);
  const handleDeleteProduct = (id: number) => genericDeleteHandler('products', id);
  const handleUpdateInventoryItem = (i: InventoryItem) => genericUpdateHandler('inventory', i);
  const handleAddInventoryItem = (i: Omit<InventoryItem, 'id'>) => genericAddHandler('inventory', i);
  const handleDeleteInventoryItem = (id: number) => genericDeleteHandler('inventory', id);
  const handleUpdateCategory = (c: CategoryData) => genericUpdateHandler('categories', c);
  const handleDeleteCategory = (id: number) => genericDeleteHandler('categories', id);
  const handleUpdateFinishing = (f: FinishingData) => genericUpdateHandler('finishings', f);
  const handleDeleteFinishing = (id: number) => genericDeleteHandler('finishings', id);
  const handleUpdateCustomer = (c: CustomerData) => genericUpdateHandler('customers', c);
  const handleDeleteCustomer = (id: number) => genericDeleteHandler('customers', id);
  const handleUpdateSupplier = (s: SupplierData) => genericUpdateHandler('suppliers', s);
  const handleDeleteSupplier = (id: number) => genericDeleteHandler('suppliers', id);
  const handleUpdateExpense = (e: ExpenseItem) => genericUpdateHandler('expenses', e);
  const handleDeleteExpense = (id: number) => genericDeleteHandler('expenses', id);
  const handleUpdateEmployee = (e: EmployeeData) => genericUpdateHandler('employees', e);
  const handleDeleteEmployee = (id: number) => genericDeleteHandler('employees', id);
  const handleAddSalary = (s: Omit<SalaryData, 'id'>) => genericAddHandler('salaries', s);
  const handleUpdateSalary = (s: SalaryData) => genericUpdateHandler('salaries', s);
  const handleDeleteSalary = (id: number) => genericDeleteHandler('salaries', id);

  const handleAddAttendance = (a: Omit<AttendanceData, 'id'>) => genericAddHandler('attendance', a);
  const handleUpdateAttendance = (a: AttendanceData) => genericUpdateHandler('attendance', a);
  const handleDeleteAttendance = (id: number) => genericDeleteHandler('attendance', id);
  const handleBulkDeleteAttendance = useCallback(async (ids: number[]) => {
      if (ids.length === 0) return;
      const { error } = await supabase.from('attendance').delete().in('id', ids);
      if (error) { alert(`Gagal mereset absensi: ${error.message}`); }
  }, []);

  const handleProcessPayroll = useCallback(async (employeeId: number, startDate: string, endDate: string, baseSalary: number, overtimePay: number, bonuses: Bonus[], deductions: Deduction[], processedAttendance: AttendanceData[]) => {
      const totalSalary = baseSalary + overtimePay + bonuses.reduce((s, b) => s + b.amount, 0) - deductions.reduce((s, d) => s + d.amount, 0);
      const newRecord: Omit<PayrollRecord, 'id'> = { employeeId, startDate, endDate, baseSalary, overtimePay, bonuses, deductions, totalSalary, processedAttendance };
      const { error } = await supabase.from('payroll_records').insert(newRecord);
      if (error) { alert(`Gagal proses gaji: ${error?.message}`); }
  }, []);
  
  const handleUpdatePayroll = (p: PayrollRecord) => genericUpdateHandler('payroll_records', p);
  const handleRevertPayroll = (id: number) => genericDeleteHandler('payroll_records', id);
  const handleDeletePayrollPermanently = useCallback(async (record: PayrollRecord) => {
    if (!window.confirm("Anda yakin ingin menghapus riwayat Gaji Ini? Tindakan ini akan menghapus data absensi terkait secara permanen dan tidak dapat dibatalkan.")) {
        return;
    }

    const attendanceIds = record.processedAttendance.map(a => a.id);

    if (attendanceIds.length > 0) {
        const { error: attError } = await supabase.from('attendance').delete().in('id', attendanceIds);
        if (attError) {
            alert(`Gagal menghapus data absensi terkait: ${attError.message}`);
            return;
        }
    }

    const { error: payrollError } = await supabase.from('payroll_records').delete().eq('id', record.id);
    if (payrollError) {
        alert(`Gagal menghapus riwayat gaji: ${payrollError.message}`);
        return;
    }
    
    alert("Riwayat gaji dan data absensi terkait berhasil dihapus permanen.");
  }, []);

  const handleAddLegacyMonthlyIncome = (i: Omit<LegacyMonthlyIncome, 'id'>) => genericAddHandler('legacy_data', i);
  const handleUpdateLegacyMonthlyIncome = (i: LegacyMonthlyIncome) => genericUpdateHandler('legacy_data', i);
  const handleDeleteLegacyMonthlyIncome = (id: number) => genericDeleteHandler('legacy_data', id);
  
  const handleAddLegacyMonthlyExpense = (e: Omit<LegacyMonthlyExpense, 'id'>) => genericAddHandler('legacy_expense', e);
  const handleUpdateLegacyMonthlyExpense = (e: LegacyMonthlyExpense) => genericUpdateHandler('legacy_expense', e);
  const handleDeleteLegacyMonthlyExpense = (id: number) => genericDeleteHandler('legacy_expense', id);

  const handleAddLegacyReceivable = (r: Omit<LegacyReceivable, 'id'>) => genericAddHandler('legacy_receivables', r);
  const handleUpdateLegacyReceivable = (r: LegacyReceivable) => genericUpdateHandler('legacy_receivables', r);
  const handleDeleteLegacyReceivable = (id: number) => genericDeleteHandler('legacy_receivables', id);

  const handlePayLegacyReceivable = useCallback(async (legacyItem: LegacyReceivable, paymentDetails: Payment, newDiscount: number) => {
    // 1. Create a corresponding new order with a custom "Nota-XXXXX" ID
    const notaNumber = legacyItem.nota_id.toString().padStart(5, '0');
    const newNotaId = `Nota-${notaNumber}`;

    const newOrder: SavedOrder = {
        id: newNotaId, customer: legacyItem.customer, orderDate: legacyItem.order_date,
        orderItems: [{
            id: Date.now(), productId: null, finishing: 'Tanpa Finishing',
            description: legacyItem.description,
            length: legacyItem.length ? legacyItem.length.toString() : '0',
            width: legacyItem.width ? legacyItem.width.toString() : '0',
            qty: legacyItem.qty,
        }],
        details: legacyItem.description, totalPrice: legacyItem.amount,
    };
    
    const { error: orderError } = await supabase.from('orders').insert(newOrder);
    if (orderError) { alert(`Gagal membuat order baru dari data lama: ${orderError?.message}`); return; }
    
    // 2. Create a new receivable with payment info
    const totalPaid = paymentDetails.amount;
    let newPaymentStatus: PaymentStatus = totalPaid + newDiscount >= legacyItem.amount ? 'Lunas' : 'Belum Lunas';

    const dueDate = new Date(legacyItem.order_date);
    dueDate.setDate(dueDate.getDate() + notificationSettings.defaultDueDateDays);

    const newReceivable: ReceivableItem = {
        id: newOrder.id, customer: newOrder.customer, amount: newOrder.totalPrice,
        due: dueDate.toISOString().substring(0, 10),
        paymentStatus: newPaymentStatus,
        productionStatus: 'Telah Dikirim', // Set as delivered since it's legacy data
        payments: [paymentDetails],
        discount: newDiscount,
    };

    const { error: receivableError } = await supabase.from('receivables').insert(newReceivable);
    if (receivableError) { alert(`Order baru dibuat, tapi gagal membuat data pembayaran: ${receivableError.message}`); return; }

    // 3. Delete the legacy receivable
    const { error: deleteError } = await supabase.from('legacy_receivables').delete().eq('id', legacyItem.id);
    if (deleteError) { alert(`Pembayaran berhasil, tapi gagal menghapus data piutang lama: ${deleteError.message}`); }

  }, [notificationSettings]);

  const handleAddAsset = (a: Omit<AssetItem, 'id'>) => genericAddHandler('assets', a);
  const handleUpdateAsset = (a: AssetItem) => genericUpdateHandler('assets', a);
  const handleDeleteAsset = (id: number) => genericDeleteHandler('assets', id);
  const handleAddDebt = (d: Omit<DebtItem, 'id'>) => genericAddHandler('debts', d);
  const handleUpdateDebt = (d: DebtItem) => genericUpdateHandler('debts', d);
  const handleDeleteDebt = (id: number) => genericDeleteHandler('debts', id);
  
  const handleToggleSidebar = () => setSidebarOpen(prev => !prev);
  const handleMenuClick = (menu: MenuKey) => setActiveMenu(menu);
  const handleLogout = async () => {
    // @FIX: Corrected method call for compatibility.
    await supabase.auth.signOut();
  };

  const renderContent = () => {
    const userPermissions = profile ? menuPermissions[profile.level] : [];
    if (!userPermissions.includes(activeMenu)) {
        const firstAccessible = MENU_ITEMS.find(item => userPermissions.includes(item.key));
        if (firstAccessible) setActiveMenu(firstAccessible.key);
        return <div>Mengalihkan...</div>;
    }
    switch (activeMenu) {
      case 'dashboard': return <Dashboard onNavigate={handleMenuClick} allOrders={allOrders} boardData={boardData} menuPermissions={userPermissions} expenses={expenses} receivables={receivables} products={products} legacyReceivables={legacyReceivables} />;
      case 'sales': return <Sales unprocessedOrders={unprocessedOrders} onSaveOrder={handleSaveOrder} onUpdateOrder={handleUpdateOrder} onProcessOrder={handleProcessOrder} onDeleteOrder={handleDeleteOrder} products={products} categories={categories} finishings={finishings} customers={customers} allOrders={allOrders} boardData={boardData} noteCounter={noteCounter} notePrefix={notePrefix} onUpdateNoteSettings={handleUpdateNoteSettings} receivables={receivables} profile={profile} onSaveLegacyOrder={handleSaveLegacyOrder} />;
      case 'receivables': return <Receivables receivables={receivables} unprocessedOrders={unprocessedOrders} legacyReceivables={legacyReceivables} allOrders={allOrders} boardData={boardData} products={products} finishings={finishings} customers={customers} categories={categories} onProcessPayment={handleProcessPayment} onPayUnprocessedOrder={handlePayUnprocessedOrder} onPayLegacyReceivable={handlePayLegacyReceivable} onBulkProcessPayment={handleBulkProcessPayment} expenses={expenses} initialCash={initialCash} onUpdateInitialCash={handleUpdateInitialCash} paymentMethods={paymentMethods} onUpdateDueDate={handleUpdateReceivableDueDate} onBulkUpdateDueDate={handleBulkUpdateReceivableDueDate} notificationSettings={notificationSettings} />;
      case 'expenses': return <Expenses expenses={expenses} onAddExpense={handleAddExpense} />;
      case 'inventory': return <Inventory inventory={inventory} onUseStock={handleUseStock} notificationSettings={notificationSettings} />;
      case 'production': return <Production boardData={boardData} allOrders={allOrders} unprocessedOrders={unprocessedOrders} receivables={receivables} products={products} categories={categories} onProductionMove={handleProductionMove} onDeliverOrder={handleDeliverOrder} onCancelQueue={handleCancelQueue} />;
      case 'payroll': return <Payroll salaries={salaries} employees={employees} attendance={attendance} payrollRecords={payrollRecords} menuPermissions={userPermissions} onAddAttendance={handleAddAttendance} onUpdateAttendance={handleUpdateAttendance} onDeleteAttendance={handleDeleteAttendance} onBulkDeleteAttendance={handleBulkDeleteAttendance} onProcessPayroll={handleProcessPayroll} onUpdatePayroll={handleUpdatePayroll} onRevertPayroll={handleRevertPayroll} onDeletePayrollPermanently={handleDeletePayrollPermanently} />;
      case 'masterData': return <MasterData products={products} categories={categories} finishings={finishings} customers={customers} suppliers={suppliers} employees={employees} menuPermissions={userPermissions} onAddProduct={handleAddProduct} onAddCategory={handleAddCategory} onAddFinishing={handleAddFinishing} onAddCustomer={handleAddCustomer} onAddSupplier={handleAddSupplier} onAddEmployee={handleAddEmployee} />;
      case 'managementData': return <Management allOrders={allOrders} products={products} finishings={finishings} customers={customers} categories={categories} inventory={inventory} suppliers={suppliers} expenses={expenses} employees={employees} salaries={salaries} menuPermissions={userPermissions} onUpdateOrder={handleUpdateOrder} onDeleteOrder={handleDeleteOrder} onUpdateProduct={handleUpdateProduct} onDeleteProduct={handleDeleteProduct} onUpdateCategory={handleUpdateCategory} onDeleteCategory={handleDeleteCategory} onUpdateFinishing={handleUpdateFinishing} onDeleteFinishing={handleDeleteFinishing} onUpdateCustomer={handleUpdateCustomer} onDeleteCustomer={handleDeleteCustomer} onUpdateSupplier={handleUpdateSupplier} onDeleteSupplier={handleDeleteSupplier} onUpdateExpense={handleUpdateExpense} onDeleteExpense={handleDeleteExpense} onUpdateEmployee={handleUpdateEmployee} onDeleteEmployee={handleDeleteEmployee} onAddSalary={handleAddSalary} onUpdateSalary={handleUpdateSalary} onDeleteSalary={handleDeleteSalary} onAddInventoryItem={handleAddInventoryItem} onUpdateInventoryItem={handleUpdateInventoryItem} onDeleteInventoryItem={handleDeleteInventoryItem} />;
      case 'reports': return <Reports allOrders={allOrders} expenses={expenses} receivables={receivables} products={products} customers={customers} inventory={inventory} categories={categories} finishings={finishings} menuPermissions={userPermissions} legacyMonthlyIncomes={legacyMonthlyIncomes} legacyMonthlyExpenses={legacyMonthlyExpenses} legacyReceivables={legacyReceivables} assets={assets} debts={debts} notificationSettings={notificationSettings} onAddLegacyMonthlyIncome={handleAddLegacyMonthlyIncome} onUpdateLegacyMonthlyIncome={handleUpdateLegacyMonthlyIncome} onDeleteLegacyMonthlyIncome={handleDeleteLegacyMonthlyIncome} onAddLegacyMonthlyExpense={handleAddLegacyMonthlyExpense} onUpdateLegacyMonthlyExpense={handleUpdateLegacyMonthlyExpense} onDeleteLegacyMonthlyExpense={handleDeleteLegacyMonthlyExpense} onAddLegacyReceivable={handleAddLegacyReceivable} onUpdateLegacyReceivable={handleUpdateLegacyReceivable} onDeleteLegacyReceivable={handleDeleteLegacyReceivable} onAddAsset={handleAddAsset} onUpdateAsset={handleUpdateAsset} onDeleteAsset={handleDeleteAsset} onAddDebt={handleAddDebt} onUpdateDebt={handleUpdateDebt} onDeleteDebt={handleDeleteDebt} />;
      case 'settings': return <Settings users={users} menuPermissions={menuPermissions} currentUser={profile} currentUserLevel={profile!.level} notificationSettings={notificationSettings} storeInfo={storeInfo} paymentMethods={paymentMethods} onAddUser={handleAddProfile} onUpdateUser={handleUpdateUser} onUpdateMenuPermissions={handleUpdateMenuPermissions} onUpdateNotificationSettings={handleUpdateNotificationSettings} onUpdateStoreInfo={handleUpdateStoreInfo} onUpdatePaymentMethods={handleUpdatePaymentMethods} />;
      default: return <Dashboard onNavigate={handleMenuClick} allOrders={allOrders} boardData={boardData} menuPermissions={userPermissions} expenses={expenses} receivables={receivables} products={products} legacyReceivables={legacyReceivables} />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="text-center">
          <img src="https://wqgbkwujfxdwlywxrjup.supabase.co/storage/v1/object/public/publik/android-chrome-512x512%20cmyk.png" alt="Loading..." className="h-52 w-52 animate-pulse mx-auto" />
          <p className="mt-4 text-gray-600">Sabar Cuk Loading iki . . .</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Login />;
  }

  const activeMenuItem = [...MENU_ITEMS, {key: 'settings', label: 'Pengaturan'}].find(item => item.key === activeMenu) || { label: 'Dashboard' };

  return (
    <div className="flex h-screen bg-gray-100 font-sans">
      <Sidebar 
        activeMenu={activeMenu}
        onMenuClick={handleMenuClick}
        isOpen={isSidebarOpen}
        currentUser={profile}
        onLogout={handleLogout}
        menuPermissions={menuPermissions}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header 
          title={activeMenuItem.label}
          onToggleSidebar={handleToggleSidebar}
          currentUser={profile}
          onLogout={handleLogout}
          onNavigateToSettings={() => setActiveMenu('settings')}
          onNavigateToPage={handleMenuClick}
          allOrders={allOrders}
          customers={customers}
          products={products}
          expenses={expenses}
          employees={employees}
          menuPermissions={profile ? menuPermissions[profile.level] : []}
          notifications={notifications}
          onDismissNotification={handleDismissNotification}
        />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 p-4 sm:p-6 lg:p-8">
          {profile && renderContent()}
        </main>
      </div>
    </div>
  );
};

export default App;