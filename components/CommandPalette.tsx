import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { type Profile, type MenuKey, type SavedOrder, type CustomerData, type ProductData, type ExpenseItem, type EmployeeData } from '../types';
import { ShoppingCartIcon, UserIcon, CubeIcon, ReceiptTaxIcon, ChartBarIcon, WrenchScrewdriverIcon, CreditCardIcon, HomeIcon, CalendarDaysIcon, CircleStackIcon } from './Icons';
import { ALL_MENU_ITEMS } from '../constants';

const useDebounce = <T,>(value: T, delay: number): T => {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);
        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);
    return debouncedValue;
};

interface SearchResultItem {
    id: string;
    icon: React.ReactNode;
    label: string;
    description?: string;
    action: () => void;
}

interface SearchResult {
    category: string;
    items: SearchResultItem[];
}

interface CommandPaletteProps {
    isOpen: boolean;
    onClose: () => void;
    onNavigate: (menu: MenuKey) => void;
    currentUser: Profile;
    allOrders: SavedOrder[];
    customers: CustomerData[];
    products: ProductData[];
    expenses: ExpenseItem[];
    employees: EmployeeData[];
    menuPermissions: string[];
}

const CommandPalette: React.FC<CommandPaletteProps> = ({
    isOpen, onClose, onNavigate, currentUser, allOrders, customers, products, expenses, employees, menuPermissions
}) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [activeIndex, setActiveIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const resultsRef = useRef<HTMLDivElement>(null);

    const debouncedQuery = useDebounce(query, 200);

    const flatResults = useMemo(() => results.flatMap(group => group.items), [results]);

    const performSearch = useCallback((currentQuery: string) => {
        if (!currentQuery) {
            setResults([]);
            return;
        }

        const lowerQuery = currentQuery.toLowerCase();
        const searchResults: SearchResult[] = [];

        // --- Data Search ---
        const orderResults: SearchResultItem[] = [];
        if (menuPermissions.includes('sales') || menuPermissions.includes('receivables')) {
             allOrders.forEach(order => {
                if (order.id.toLowerCase().includes(lowerQuery) || order.customer.toLowerCase().includes(lowerQuery)) {
                    orderResults.push({
                        id: `order-${order.id}`,
                        icon: <ShoppingCartIcon className="h-5 w-5 text-gray-500"/>,
                        label: order.id,
                        description: `Pelanggan: ${order.customer}`,
                        action: () => onNavigate('receivables'),
                    });
                }
            });
            if(orderResults.length > 0) searchResults.push({ category: 'Order', items: orderResults.slice(0, 5) });
        }
        
        const customerResults: SearchResultItem[] = [];
        if (menuPermissions.includes('masterData/customers')) {
             customers.forEach(customer => {
                if (customer.name.toLowerCase().includes(lowerQuery) || customer.contact.includes(lowerQuery)) {
                    customerResults.push({
                        id: `customer-${customer.id}`,
                        icon: <UserIcon className="h-5 w-5 text-gray-500"/>,
                        label: customer.name,
                        description: customer.contact,
                        action: () => onNavigate('masterData'),
                    });
                }
            });
            if(customerResults.length > 0) searchResults.push({ category: 'Pelanggan', items: customerResults.slice(0, 5) });
        }

        // Add more data searches here based on permissions (products, expenses, etc.)

        // --- Navigation & Actions Search ---
        const navActions: SearchResultItem[] = [];
        const permittedMenuItems = ALL_MENU_ITEMS.filter(item => menuPermissions.includes(item.key));
        
        permittedMenuItems.forEach(item => {
            if (item.label.toLowerCase().includes(lowerQuery)) {
                navActions.push({
                    id: `nav-${item.key}`,
                    icon: React.isValidElement<{ className?: string }>(item.icon) ? React.cloneElement(item.icon, { className: 'h-5 w-5 text-gray-500' }) : item.icon,
                    label: `Pergi ke ${item.label}`,
                    action: () => onNavigate(item.key)
                });
            }
        });
        if(navActions.length > 0) searchResults.push({ category: 'Navigasi', items: navActions });

        setResults(searchResults);
    }, [allOrders, customers, products, expenses, employees, menuPermissions, onNavigate]);

    useEffect(() => {
        if (isOpen) {
            performSearch(debouncedQuery);
        }
    }, [debouncedQuery, isOpen, performSearch]);

    useEffect(() => {
        if (isOpen) {
            inputRef.current?.focus();
            setActiveIndex(0);
        } else {
            setQuery('');
        }
    }, [isOpen]);
    
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;

            if (e.key === 'Escape') {
                onClose();
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActiveIndex(prev => (prev + 1) % flatResults.length);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActiveIndex(prev => (prev - 1 + flatResults.length) % flatResults.length);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (flatResults[activeIndex]) {
                    flatResults[activeIndex].action();
                    onClose();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, flatResults, activeIndex, onClose]);

    useEffect(() => {
        const activeElement = document.getElementById(`search-result-${activeIndex}`);
        activeElement?.scrollIntoView({ block: 'nearest' });
    }, [activeIndex]);

    const Highlight: React.FC<{ text: string; query: string }> = ({ text, query }) => {
        if (!query) return <>{text}</>;
        const parts = text.split(new RegExp(`(${query})`, 'gi'));
        return <>{parts.map((part, i) => part.toLowerCase() === query.toLowerCase() ? <strong key={i} className="text-pink-600">{part}</strong> : part)}</>;
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex justify-center items-start pt-20" onMouseDown={onClose}>
            <div className="relative bg-white w-full max-w-2xl rounded-xl shadow-2xl border" onMouseDown={e => e.stopPropagation()}>
                <div className="flex items-center p-4 border-b">
                     <svg className="h-5 w-5 text-gray-400 mr-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" /></svg>
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder="Cari nota, pelanggan, atau navigasi ke halaman..."
                        className="w-full text-lg bg-transparent focus:outline-none"
                    />
                </div>
                <div ref={resultsRef} className="max-h-[60vh] overflow-y-auto">
                    {results.length > 0 ? (
                        results.map(group => (
                            <div key={group.category} className="p-2">
                                <h3 className="text-xs font-semibold text-gray-500 uppercase px-3 pb-1">{group.category}</h3>
                                <ul>
                                    {group.items.map((item, index) => {
                                        const globalIndex = results.slice(0, results.indexOf(group)).reduce((acc, g) => acc + g.items.length, 0) + index;
                                        return (
                                            <li
                                                key={item.id}
                                                id={`search-result-${globalIndex}`}
                                                className={`flex items-center p-3 rounded-lg cursor-pointer ${activeIndex === globalIndex ? 'bg-pink-100' : 'hover:bg-gray-100'}`}
                                                onMouseMove={() => setActiveIndex(globalIndex)}
                                                onMouseDown={(e) => { e.preventDefault(); item.action(); onClose(); }}
                                            >
                                                {item.icon}
                                                <div className="ml-3">
                                                    <p className="text-sm font-medium text-gray-800"><Highlight text={item.label} query={query} /></p>
                                                    {item.description && <p className="text-xs text-gray-500"><Highlight text={item.description} query={query} /></p>}
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        ))
                    ) : debouncedQuery ? (
                        <div className="text-center text-gray-500 py-10">
                            <p>Tidak ada hasil untuk "{debouncedQuery}".</p>
                        </div>
                    ) : (
                         <div className="text-center text-gray-400 py-10">
                            <p>Cari berdasarkan No. Nota, nama pelanggan, atau navigasi halaman.</p>
                        </div>
                    )}
                </div>
                 <div className="p-2 border-t text-xs text-gray-500 flex justify-end space-x-4">
                    <span><kbd className="font-sans border rounded px-1.5 py-0.5 shadow-sm">↑↓</kbd> Navigasi</span>
                    <span><kbd className="font-sans border rounded px-1.5 py-0.5 shadow-sm">Enter</kbd> Pilih</span>
                    <span><kbd className="font-sans border rounded px-1.5 py-0.5 shadow-sm">Esc</kbd> Tutup</span>
                </div>
            </div>
        </div>
    );
};

export default CommandPalette;