import React, { useState, useMemo, useEffect } from 'react';
import { type Profile, type UserLevel, type MenuPermissions, type NotificationSettings, type StoreInfo } from '../types';
import { PencilIcon, TrashIcon, PlusCircleIcon, EyeIcon, EyeSlashIcon } from './Icons';
import { ALL_MENU_ITEMS } from '../constants';

// --- Modal Component ---
const EditProfileModal: React.FC<{
    profile: Profile;
    onSave: (data: Profile) => void;
    onClose: () => void;
    isLevelEditable: boolean;
}> = ({ profile, onSave, onClose, isLevelEditable }) => {
    const [formData, setFormData] = useState({
        name: profile.name || '',
        level: profile.level || 'Kasir',
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name.trim()) {
            alert('Silakan isi nama pengguna.');
            return;
        }
        onSave({
            ...profile,
            name: formData.name,
            level: formData.level as UserLevel,
        });
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center border-b pb-3 mb-5">
                    <h3 className="text-xl font-bold text-gray-800">Edit Profil Pengguna</h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-2xl leading-none">&times;</button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium">Nama Pengguna</label>
                        <input
                            type="text"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            className="mt-1 w-full p-2 border rounded-md"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Level Pengguna</label>
                        <select
                            name="level"
                            value={formData.level}
                            onChange={handleChange}
                            className={`mt-1 w-full p-2 border bg-white rounded-md ${!isLevelEditable && 'bg-gray-100 cursor-not-allowed'}`}
                            required
                            disabled={!isLevelEditable}
                        >
                            <option value="Kasir">Kasir</option>
                            <option value="Office">Office</option>
                            <option value="Produksi">Produksi</option>
                            <option value="Admin">Admin</option>
                        </select>
                        {!isLevelEditable && (
                            <p className="text-xs text-gray-500 mt-1">Hanya Admin yang dapat mengubah level pengguna.</p>
                        )}
                    </div>
                    <div className="border-t pt-4 flex justify-end">
                        <button type="submit" className="bg-pink-600 text-white py-2 px-6 rounded-lg font-bold hover:bg-pink-700">Simpan Perubahan</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const AddProfileModal: React.FC<{
    onSave: (data: { name: string; level: UserLevel }) => void;
    onClose: () => void;
}> = ({ onSave, onClose }) => {
    const [name, setName] = useState('');
    const [level, setLevel] = useState<UserLevel>('Kasir');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({ name, level });
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center border-b pb-3 mb-5">
                    <h3 className="text-xl font-bold text-gray-800">Tambah Profil Baru</h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-2xl leading-none">&times;</button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium">Nama Pengguna</label>
                        <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full p-2 border rounded-md" required />
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Level Pengguna</label>
                        <select value={level} onChange={(e) => setLevel(e.target.value as UserLevel)} className="mt-1 w-full p-2 border bg-white rounded-md" required>
                            <option value="Kasir">Kasir</option>
                            <option value="Office">Office</option>
                            <option value="Produksi">Produksi</option>
                            <option value="Admin">Admin</option>
                        </select>
                    </div>
                     <p className="text-xs text-amber-700 bg-amber-50 p-2 rounded-md">
                        <strong>Catatan:</strong> Fitur ini hanya membuat data profil. Anda harus membuat pengguna di sistem otentikasi Supabase secara manual dan menyalin UUID-nya ke profil ini agar dapat login.
                    </p>
                    <div className="border-t pt-4 flex justify-end">
                        <button type="submit" className="bg-pink-600 text-white py-2 px-6 rounded-lg font-bold hover:bg-pink-700">Simpan Profil</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// --- Menu Access Manager Component ---
const allUserLevels: UserLevel[] = ['Kasir', 'Office', 'Produksi', 'Admin'];

const MenuAccessManager: React.FC<{
    permissions: MenuPermissions;
    onSave: (newPermissions: MenuPermissions) => void;
}> = ({ permissions, onSave }) => {
    const [localPermissions, setLocalPermissions] = useState<MenuPermissions>(permissions);

    useEffect(() => {
        setLocalPermissions(permissions);
    }, [permissions]);

    const handlePermissionChange = (level: UserLevel, permissionKey: string, isChecked: boolean) => {
        if (level === 'Admin') return;

        setLocalPermissions(prev => {
            const currentPermissions = new Set(prev[level] || []);
            const [mainKey, subKey] = permissionKey.split('/');
            const menu = ALL_MENU_ITEMS.find(m => m.key === mainKey);

            if (subKey) { // It's a tab
                if (isChecked) {
                    currentPermissions.add(permissionKey);
                    currentPermissions.add(mainKey); // Also grant access to parent
                } else {
                    currentPermissions.delete(permissionKey);
                    const hasOtherTabs = menu?.tabs?.some(t => currentPermissions.has(`${mainKey}/${t.key}`));
                    if (!hasOtherTabs) {
                        currentPermissions.delete(mainKey);
                    }
                }
            } else { // It's a main menu
                if (isChecked) {
                    currentPermissions.add(mainKey);
                    menu?.tabs?.forEach(t => currentPermissions.add(`${mainKey}/${t.key}`));
                } else {
                    currentPermissions.delete(mainKey);
                    menu?.tabs?.forEach(t => currentPermissions.delete(`${mainKey}/${t.key}`));
                }
            }
            return { ...prev, [level]: Array.from(currentPermissions) };
        });
    };

    return (
        <div className="mt-8 border-t pt-6">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-gray-700">Pengaturan Akses Menu per Level</h3>
                <button
                    onClick={() => onSave(localPermissions)}
                    className="bg-pink-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-pink-700 transition-colors"
                >
                    Simpan Akses
                </button>
            </div>
            <div className="overflow-x-auto">
                <table className="min-w-full bg-white border">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Menu / Tab Menu</th>
                            {allUserLevels.map(level => (
                                <th key={level} className="py-3 px-4 text-center text-xs font-medium text-gray-500 uppercase">{level}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {ALL_MENU_ITEMS.map(menu => (
                           <React.Fragment key={menu.key}>
                             <tr className="bg-gray-50/50">
                                <td className="py-3 px-4 whitespace-nowrap text-sm font-bold text-gray-800">{menu.label}</td>
                                {allUserLevels.map(level => {
                                    const isChecked = localPermissions[level]?.includes(menu.key) ?? false;
                                    const isDisabled = level === 'Admin';
                                    return (
                                        <td key={`${level}-${menu.key}`} className="py-3 px-4 text-center">
                                            <input
                                                type="checkbox"
                                                className={`h-5 w-5 rounded ${isDisabled ? 'text-gray-400 cursor-not-allowed' : 'text-pink-600 focus:ring-pink-500'}`}
                                                checked={isChecked}
                                                disabled={isDisabled}
                                                onChange={(e) => handlePermissionChange(level, menu.key, e.target.checked)}
                                            />
                                        </td>
                                    );
                                })}
                             </tr>
                             {menu.tabs && menu.tabs.map(tab => (
                                <tr key={tab.key}>
                                    <td className="py-2 px-4 whitespace-nowrap text-sm text-gray-600 pl-10">{tab.label}</td>
                                    {allUserLevels.map(level => {
                                        const permissionKey = `${menu.key}/${tab.key}`;
                                        const isChecked = localPermissions[level]?.includes(permissionKey) ?? false;
                                        const isDisabled = level === 'Admin';
                                        return (
                                            <td key={`${level}-${permissionKey}`} className="py-2 px-4 text-center">
                                                <input
                                                    type="checkbox"
                                                    className={`h-5 w-5 rounded ${isDisabled ? 'text-gray-400 cursor-not-allowed' : 'text-pink-600 focus:ring-pink-500'}`}
                                                    checked={isChecked}
                                                    disabled={isDisabled}
                                                    onChange={(e) => handlePermissionChange(level, permissionKey, e.target.checked)}
                                                />
                                            </td>
                                        );
                                    })}
                                </tr>
                             ))}
                           </React.Fragment>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// --- Notification Settings Manager Component ---
const NotificationSettingsManager: React.FC<{
    settings: NotificationSettings;
    onSave: (settings: NotificationSettings) => void;
}> = ({ settings, onSave }) => {
    const [localSettings, setLocalSettings] = useState(settings);

    useEffect(() => {
        setLocalSettings(settings);
    }, [settings]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;
        setLocalSettings(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : Number(value),
        }));
    };

    const handleSave = () => {
        onSave(localSettings);
    };

    const ToggleSwitch: React.FC<{ checked: boolean; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; name: string; }> = ({ checked, onChange, name }) => (
        <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" name={name} checked={checked} onChange={onChange} className="sr-only peer" />
            <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-focus:ring-2 peer-focus:ring-pink-300 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-pink-600"></div>
        </label>
    );

    return (
        <div className="max-w-3xl">
             <h3 className="text-lg font-bold text-gray-700 mb-4">Pengaturan Notifikasi</h3>
             <div className="space-y-6">
                
                <div className="flex justify-between items-center p-4 border rounded-lg">
                    <div>
                        <h4 className="font-semibold text-gray-800">Peringatan Stok Menipis</h4>
                        <p className="text-sm text-gray-500">Dapatkan notifikasi saat stok barang mencapai batas minimum.</p>
                    </div>
                    <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-2">
                             <input
                                type="number"
                                name="lowStockThreshold"
                                value={localSettings.lowStockThreshold}
                                onChange={handleChange}
                                className="w-20 p-1 border rounded-md text-sm text-center"
                                disabled={!localSettings.lowStockAlert}
                            />
                            <span className="text-sm text-gray-600">item</span>
                        </div>
                        <ToggleSwitch name="lowStockAlert" checked={localSettings.lowStockAlert} onChange={handleChange} />
                    </div>
                </div>

                <div className="flex justify-between items-center p-4 border rounded-lg">
                    <div>
                        <h4 className="font-semibold text-gray-800">Peringatan Piutang Akan Jatuh Tempo</h4>
                        <p className="text-sm text-gray-500">Dapatkan pengingat beberapa hari sebelum piutang jatuh tempo.</p>
                    </div>
                    <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-2">
                            <input
                                type="number"
                                name="receivableDueSoonDays"
                                value={localSettings.receivableDueSoonDays}
                                onChange={handleChange}
                                className="w-20 p-1 border rounded-md text-sm text-center"
                                disabled={!localSettings.receivableDueSoonAlert}
                            />
                            <span className="text-sm text-gray-600">hari sebelumnya</span>
                        </div>
                       <ToggleSwitch name="receivableDueSoonAlert" checked={localSettings.receivableDueSoonAlert} onChange={handleChange} />
                    </div>
                </div>
                
                <div className="flex justify-between items-center p-4 border rounded-lg">
                    <div>
                        <h4 className="font-semibold text-gray-800">Peringatan Piutang Telah Jatuh Tempo</h4>
                        <p className="text-sm text-gray-500">Dapatkan notifikasi saat piutang melewati tanggal pembayaran.</p>
                    </div>
                    <ToggleSwitch name="receivableOverdueAlert" checked={localSettings.receivableOverdueAlert} onChange={handleChange} />
                </div>
                
                <div className="flex justify-between items-center p-4 border rounded-lg">
                    <div>
                        <h4 className="font-semibold text-gray-800">Notifikasi Order Baru Masuk Antrian</h4>
                        <p className="text-sm text-gray-500">Terima notifikasi setiap kali order baru masuk ke antrian produksi.</p>
                    </div>
                     <ToggleSwitch name="newOrderInQueueAlert" checked={localSettings.newOrderInQueueAlert} onChange={handleChange} />
                </div>

             </div>
             <div className="flex justify-end mt-8 border-t pt-4">
                <button
                    onClick={handleSave}
                    className="bg-pink-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-pink-700 transition-colors"
                >
                    Simpan Perubahan
                </button>
            </div>
        </div>
    );
};

interface SettingsProps {
    users: Profile[];
    menuPermissions: MenuPermissions;
    currentUser: Profile | null;
    currentUserLevel: UserLevel;
    notificationSettings: NotificationSettings;
    storeInfo: StoreInfo | null;
    onAddUser: (newUser: { name: string; level: UserLevel; }) => void;
    onUpdateUser: (updatedUser: Profile) => void;
    onUpdateMenuPermissions: (permissions: MenuPermissions) => void;
    onUpdateNotificationSettings: (settings: NotificationSettings) => void;
    onUpdateStoreInfo: (newInfo: StoreInfo) => void;
}

const TABS_ADMIN = [
    { key: 'storeInfo', label: 'Informasi Toko' },
    { key: 'userManagement', label: 'Manajemen Pengguna & Akses' },
    { key: 'notifications', label: 'Notifikasi' },
];

const TABS_USER = [
     { key: 'userManagement', label: 'Profil Saya' },
];


const Settings: React.FC<SettingsProps> = ({ users, menuPermissions, currentUser, currentUserLevel, notificationSettings, storeInfo, onAddUser, onUpdateUser, onUpdateMenuPermissions, onUpdateNotificationSettings, onUpdateStoreInfo }) => {
    const accessibleTabs = currentUserLevel === 'Admin' ? TABS_ADMIN : TABS_USER;
    const [activeTab, setActiveTab] = useState(accessibleTabs[0].key);
    const [modalState, setModalState] = useState<{ isOpen: boolean; user?: Profile | null }>({ isOpen: false });
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    
    const [localStoreInfo, setLocalStoreInfo] = useState<StoreInfo>({
        name: '', address: '', phone: '', email: ''
    });

    useEffect(() => {
        if (storeInfo) {
            setLocalStoreInfo(storeInfo);
        }
    }, [storeInfo]);
    
    const handleStoreInfoChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setLocalStoreInfo(prev => ({ ...prev, [name]: value }));
    };

    useEffect(() => {
        if (!accessibleTabs.some(t => t.key === activeTab)) {
            setActiveTab(accessibleTabs[0].key);
        }
    }, [accessibleTabs, activeTab]);

    const TabButton: React.FC<{ label: string; tabKey: string; }> = ({ label, tabKey }) => (
        <button
            onClick={() => setActiveTab(tabKey)}
            className={`${ activeTab === tabKey ? 'border-pink-500 text-pink-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300' } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
            aria-current={activeTab === tabKey ? 'page' : undefined}
        >
            {label}
        </button>
    );
    
    const handleSaveUser = (data: Profile) => {
        onUpdateUser(data);
        setModalState({ isOpen: false });
    };
    
    const handleAddProfile = (data: { name: string; level: UserLevel }) => {
        onAddUser(data);
        setIsAddModalOpen(false);
    };

    const isLevelEditable = currentUserLevel === 'Admin';

    return (
        <>
            {modalState.isOpen && modalState.user && (
                <EditProfileModal
                    profile={modalState.user}
                    onClose={() => setModalState({ isOpen: false })}
                    onSave={handleSaveUser}
                    isLevelEditable={isLevelEditable}
                />
            )}
            {isAddModalOpen && (
                <AddProfileModal 
                    onClose={() => setIsAddModalOpen(false)} 
                    onSave={handleAddProfile} 
                />
            )}

            <div className="bg-white p-6 rounded-xl shadow-md">
                <h2 className="text-xl font-bold">Pengaturan</h2>
                
                <div className="border-b border-gray-200 mt-4">
                    <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                        {accessibleTabs.map(tab => <TabButton key={tab.key} label={tab.label} tabKey={tab.key} />)}
                    </nav>
                </div>

                <div className="mt-6">
                    {activeTab === 'storeInfo' && (
                         <div className="space-y-4 max-w-2xl">
                            <div><label className="block text-sm font-medium text-gray-700">Nama Toko</label><input type="text" name="name" value={localStoreInfo.name} onChange={handleStoreInfoChange} className="mt-1 w-full p-2 border border-gray-300 rounded-md" /></div>
                            <div><label className="block text-sm font-medium text-gray-700">Alamat</label><textarea name="address" value={localStoreInfo.address} onChange={handleStoreInfoChange} className="mt-1 w-full p-2 border border-gray-300 rounded-md" rows={3}></textarea></div>
                            <div><label className="block text-sm font-medium text-gray-700">Telp/WA</label><input type="tel" name="phone" value={localStoreInfo.phone} onChange={handleStoreInfoChange} className="mt-1 w-full p-2 border border-gray-300 rounded-md" /></div>
                            <div><label className="block text-sm font-medium text-gray-700">Email</label><input type="email" name="email" value={localStoreInfo.email} onChange={handleStoreInfoChange} className="mt-1 w-full p-2 border border-gray-300 rounded-md" /></div>
                            <div className="flex justify-end mt-6 border-t pt-4"><button onClick={() => onUpdateStoreInfo(localStoreInfo)} className="bg-pink-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-pink-700 transition-colors">Simpan Perubahan</button></div>
                        </div>
                    )}
                    
                    {activeTab === 'userManagement' && (
                        <div>
                            {currentUserLevel === 'Admin' ? (
                                <>
                                    <div className="flex justify-between items-center mb-4">
                                        <p className="text-gray-600">Atur peran dan hak akses untuk setiap pengguna.</p>
                                        <button onClick={() => setIsAddModalOpen(true)} className="flex items-center bg-pink-600 text-white px-4 py-2 rounded-lg font-semibold text-sm hover:bg-pink-700 transition-colors">
                                            <PlusCircleIcon className="mr-2 h-4 w-4" />
                                            Tambah Profil
                                        </button>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full bg-white">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Nama</th>
                                                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Level Pengguna</th>
                                                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Aksi</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-200">
                                                {users.map(user => (
                                                    <tr key={user.id}>
                                                        <td className="py-4 px-4 whitespace-nowrap text-sm font-medium text-gray-800">{user.name}</td>
                                                        <td className="py-4 px-4 whitespace-nowrap text-sm">{user.level}</td>
                                                        <td className="py-4 px-4 whitespace-nowrap text-sm space-x-2">
                                                            <button onClick={() => setModalState({ isOpen: true, user })} className="p-1.5 text-gray-500 hover:text-blue-600" title="Edit"><PencilIcon className="h-4 w-4" /></button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    <MenuAccessManager permissions={menuPermissions} onSave={onUpdateMenuPermissions} />
                                </>
                            ) : (
                                currentUser && (
                                     <div className="max-w-md">
                                        <h3 className="text-lg font-bold text-gray-700 mb-4">Profil Saya</h3>
                                        <div className="bg-gray-50 p-4 rounded-lg border space-y-2">
                                            <div>
                                                <p className="text-sm text-gray-500">Nama Pengguna</p>
                                                <p className="font-semibold text-gray-800">{currentUser.name}</p>
                                            </div>
                                            <div>
                                                <p className="text-sm text-gray-500">Level</p>
                                                <p className="font-semibold text-gray-800">{currentUser.level}</p>
                                            </div>
                                             <div className="border-t pt-3">
                                                <button 
                                                    onClick={() => setModalState({ isOpen: true, user: currentUser })}
                                                    className="flex items-center text-sm text-pink-600 hover:underline font-semibold"
                                                >
                                                    <PencilIcon className="h-4 w-4 mr-1" />
                                                    Edit Profil
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )
                            )}
                        </div>
                    )}

                    {activeTab === 'notifications' && (
                        <NotificationSettingsManager
                            settings={notificationSettings}
                            onSave={onUpdateNotificationSettings}
                        />
                    )}
                </div>
            </div>
        </>
    );
};

export default Settings;