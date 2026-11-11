import React, { useState, useMemo } from 'react';
import {
  type SavedOrder,
  type OrderItemData,
  type ProductData,
  type FinishingData,
  type CategoryData,
  type CustomerData
} from '../types';
import {
  PrinterIcon,
  ArrowDownTrayIcon,
  MagnifyingGlassIcon,
  PencilIcon,
  ArrowUturnLeftIcon,
  CheckIcon,
  TagIcon,
  CurrencyDollarIcon
} from './Icons';

export interface MarkupItemData {
  id: number;
  productId: number | null;
  productName: string;
  categoryName: string;
  description: string;
  finishing: string;
  length: string;
  width: string;
  qty: number;
  isAreaBased: boolean;
  multiplier: number; // area (length * width) jika per luas, 1 jika per buah
  originalUnitPrice: number; // Harga satuan dasar per m2 atau per pcs
  originalSubtotal: number;  // Subtotal modal reseller (Nalamedia)
  markupUnitPrice: number;   // Harga satuan jual baru (editable)
  markupSubtotal: number;    // Subtotal jual baru (editable)
}

interface MarkupInvoiceProps {
  allOrders: SavedOrder[];
  unprocessedOrders: SavedOrder[];
  products: ProductData[];
  categories: CategoryData[];
  finishings: FinishingData[];
  customers: CustomerData[];
}

export const MarkupInvoice: React.FC<MarkupInvoiceProps> = ({
  allOrders,
  unprocessedOrders,
  products,
  categories,
  finishings,
  customers
}) => {
  // Search & Navigation States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<SavedOrder | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Editable Form States for Markup Invoice
  const [notaNumber, setNotaNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [orderDate, setOrderDate] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'Lunas' | 'Belum Lunas' | 'DP'>('Lunas');
  const [downPayment, setDownPayment] = useState<number>(0);
  const [notaNotes, setNotaNotes] = useState('Terima kasih atas pesanan dan kepercayaannya.');
  const [items, setItems] = useState<MarkupItemData[]>([]);

  const priceLevelMap: Record<CustomerData['level'], keyof ProductData['price']> = {
    'End Customer': 'endCustomer',
    'Retail': 'retail',
    'Grosir': 'grosir',
    'Reseller': 'reseller',
    'Corporate': 'corporate'
  };

  const getCustomerLevel = (name: string): CustomerData['level'] => {
    const match = name.match(/\(([^)]+)\)/);
    if (match) {
      const level = match[1] as CustomerData['level'];
      if (['End Customer', 'Retail', 'Grosir', 'Reseller', 'Corporate'].includes(level)) {
        return level;
      }
    }
    const realCustomer = customers.find(c => c.name === name);
    return realCustomer ? realCustomer.level : 'End Customer';
  };

  // Combine and deduplicate orders from memory (client-side 0-latency)
  const combinedOrders = useMemo(() => {
    const map = new Map<string, SavedOrder>();
    unprocessedOrders.forEach(o => map.set(o.id, o));
    allOrders.forEach(o => map.set(o.id, o));
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime()
    );
  }, [unprocessedOrders, allOrders]);

  // Instant filter when user types in search box
  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return [];
    return combinedOrders.filter(
      o => o.id.toLowerCase().includes(query) || o.customer.toLowerCase().includes(query)
    ).slice(0, 10);
  }, [searchQuery, combinedOrders]);

  // Convert an OrderItemData into a MarkupItemData
  const convertToMarkupItem = (item: OrderItemData, custName: string): MarkupItemData => {
    const customerLevel = getCustomerLevel(custName);
    const priceKey = priceLevelMap[customerLevel];

    const product = products.find(p => p.id === item.productId);
    const finishing = finishings.find(f => f.name === item.finishing);
    const category = categories.find(c => c.name === product?.category);
    const isAreaBased = category?.unitType === 'Per Luas';

    let multiplier = 1;
    if (isAreaBased) {
      const l = parseFloat(item.length) || 0;
      const w = parseFloat(item.width) || 0;
      multiplier = l * w;
    }

    const materialBasePrice = product ? (product.price[priceKey] || product.price.endCustomer || 0) : 0;
    const finishingPrice = finishing ? finishing.price : 0;

    const originalSubtotal = (materialBasePrice * multiplier + finishingPrice) * item.qty;
    const effectiveUnitPrice = multiplier > 0
      ? materialBasePrice + (finishingPrice / multiplier)
      : materialBasePrice + finishingPrice;

    return {
      id: item.id,
      productId: item.productId,
      productName: product?.name || 'Produk Cetak',
      categoryName: category?.name || '-',
      description: item.description || product?.name || 'Pesanan Cetak',
      finishing: item.finishing || 'Tanpa Finishing',
      length: item.length || '1',
      width: item.width || '1',
      qty: item.qty || 1,
      isAreaBased,
      multiplier,
      originalUnitPrice: Math.round(effectiveUnitPrice),
      originalSubtotal: Math.round(originalSubtotal),
      markupUnitPrice: Math.round(effectiveUnitPrice),
      markupSubtotal: Math.round(originalSubtotal)
    };
  };

  // Handle selecting an order from search
  const handleSelectOrder = (order: SavedOrder) => {
    setSelectedOrder(order);
    setNotaNumber(order.id);
    setCustomerName(order.customer);
    setOrderDate(order.orderDate);
    setPaymentStatus('Lunas');
    setNotaNotes('Terima kasih atas pesanan dan kepercayaannya.');

    const markupItems = order.orderItems.map(item => convertToMarkupItem(item, order.customer));
    setItems(markupItems);
    setIsEditing(false); // Show the review/confirmation card first
  };

  const handleStartEditing = () => {
    setIsEditing(true);
  };

  const handleCancelSelection = () => {
    setSelectedOrder(null);
    setIsEditing(false);
    setSearchQuery('');
  };

  // Edit single item unit price (and automatically update subtotal)
  const handleItemUnitPriceChange = (id: number, newUnitPrice: number) => {
    setItems(prevItems =>
      prevItems.map(item => {
        if (item.id !== id) return item;
        const validPrice = Math.max(0, newUnitPrice);
        const newSubtotal = Math.round(validPrice * (item.isAreaBased ? item.multiplier : 1) * item.qty);
        return {
          ...item,
          markupUnitPrice: validPrice,
          markupSubtotal: newSubtotal
        };
      })
    );
  };

  // Edit single item subtotal directly (and automatically calculate unit price)
  const handleItemSubtotalChange = (id: number, newSubtotal: number) => {
    setItems(prevItems =>
      prevItems.map(item => {
        if (item.id !== id) return item;
        const validSubtotal = Math.max(0, newSubtotal);
        const unitsTotal = (item.isAreaBased ? item.multiplier : 1) * item.qty;
        const newUnitPrice = unitsTotal > 0 ? Math.round(validSubtotal / unitsTotal) : validSubtotal;
        return {
          ...item,
          markupSubtotal: validSubtotal,
          markupUnitPrice: newUnitPrice
        };
      })
    );
  };

  // Quick Markup helper across ALL items (+10%, +20%, +30%, +50%, +100%)
  const handleApplyQuickMarkupPercent = (percent: number) => {
    setItems(prevItems =>
      prevItems.map(item => {
        const factor = 1 + percent / 100;
        // Round to nearest 500 for clean print price
        const newUnitPrice = Math.ceil((item.originalUnitPrice * factor) / 500) * 500;
        const unitsTotal = (item.isAreaBased ? item.multiplier : 1) * item.qty;
        const newSubtotal = Math.round(newUnitPrice * unitsTotal);
        return {
          ...item,
          markupUnitPrice: newUnitPrice,
          markupSubtotal: newSubtotal
        };
      })
    );
  };

  // Reset prices back to Nalamedia original reseller price
  const handleResetToOriginal = () => {
    setItems(prevItems =>
      prevItems.map(item => ({
        ...item,
        markupUnitPrice: item.originalUnitPrice,
        markupSubtotal: item.originalSubtotal
      }))
    );
  };

  // Totals & Reseller Margin Calculations
  const totalOriginal = useMemo(() => items.reduce((sum, i) => sum + i.originalSubtotal, 0), [items]);
  const totalMarkup = useMemo(() => items.reduce((sum, i) => sum + i.markupSubtotal, 0), [items]);
  const resellerMargin = totalMarkup - totalOriginal;
  const marginPercent = totalOriginal > 0 ? Math.round((resellerMargin / totalOriginal) * 100) : 0;

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);

  // --- PRINT FUNCTION 1: Cetak Struk Thermal 80mm (Sama Persis Bawaan Nalamedia) ---
  const handlePrintThermal = () => {
    const totalPaid = paymentStatus === 'Lunas' ? totalMarkup : paymentStatus === 'DP' ? downPayment : 0;
    const remainingAmount = Math.max(0, totalMarkup - totalPaid);

    const itemsHtml = items.map((item, index) => {
      const detailsParts = [];
      if (item.isAreaBased && parseFloat(item.length) > 0 && parseFloat(item.width) > 0) {
        detailsParts.push(`${item.length}m X ${item.width}m`);
      }
      detailsParts.push(`${item.qty} Pcs`);

      const detailsLine = detailsParts.join(' | ');

      const materialAndFinishing = [
        item.productName || 'N/A',
        (item.finishing && item.finishing !== 'Tanpa Finishing') ? item.finishing : ''
      ].filter(Boolean).join(' | ');

      return `
        <div style="margin-bottom: 4px;">
          <div class="bold">${index + 1}. ${item.description || item.productName || 'N/A'}</div>
          <div class="details-line">&nbsp;&nbsp;&nbsp;${materialAndFinishing}</div>
          <div class="details-line">&nbsp;&nbsp;&nbsp;${detailsLine} = ${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(item.markupSubtotal)}</div>
        </div>
      `;
    }).join('');

    const printContent = `
      <html>
        <head>
          <title>Struk ${notaNumber}</title>
          <style>
            @page { size: 80mm auto; margin: 0; }
            body {
              font-family: sans-serif;
              font-size: 12px;
              color: #000;
              margin: 0;
              padding: 0;
              width: 80mm;
              line-height: 1.3;
            }
            .container { width: 100%; }
            .center { text-align: center; }
            .bold { font-weight: bold; }
            .uppercase { text-transform: uppercase; }
            .h1 { font-size: 40px; font-weight: bold; margin: 0; }
            .larger-text { font-size: 14px; }
            .address { font-size: 11px; }
            .divider { border: 0; border-top: 1px dashed black; margin: 5px 0; }
            .details-line { line-height: 1.2; }
            .summary-table { width: 100%; }
            .summary-table td { padding: 1px 0; }
            .summary-table .label { text-align: left; }
            .summary-table .value { text-align: right; }
            p, div { margin: 0; padding: 0; word-wrap: break-word; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="center">
              <div class="h1">NALAMEDIA</div>
            </div>
            <div class="center">
              <p class="address">Jl. Prof. Moh. Yamin Cerbonan, Karanganyar</p>
              <p>Whatsapp: <b>0813 9872 7722</b></p>
              <p>Email: nalamedia.kra@gmail.com</p>
            </div>
            <div class="divider"></div>
            <div class="center">
              <p class="larger-text bold uppercase">${customerName}</p>
            </div>
            <div class="divider"></div>
            <div>No. Nota : ${notaNumber}</div>
            <div>Tanggal : ${new Date(orderDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
            <div>Kasir : Admin</div>
            <div class="divider"></div>
            <p class="bold">No. Detail Pesanan</p>
            <div class="divider"></div>
            ${itemsHtml}
            <div class="divider"></div>
            <table class="summary-table">
              <tr>
                <td class="label bold">Subtotal:</td>
                <td class="value bold">${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(totalMarkup)}</td>
              </tr>
            </table>
            <div class="divider"></div>
            <table class="summary-table">
              <tr>
                <td class="label">Bayar:</td>
                <td class="value">${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(totalPaid)}</td>
              </tr>
              <tr>
                <td class="label bold">Sisa:</td>
                <td class="value bold">${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(remainingAmount)}</td>
              </tr>
            </table>
            <div class="divider"></div>
            <div class="center">
              <p class="bold">Pembayaran Via Transfer</p>
              <p>BRI: 6707-01-02-8864-537</p>
              <p>BCA: 0154-361801</p>
              <p>BPD JATENG: 3142-069325</p>
              <p class="bold">a/n Ariska Prima Diastari</p>
            </div>
            <div class="divider"></div>
            <div class="center">
              <p class="bold">PERHATIAN</p>
              <p>Komplain lebih dari 1 hari tidak kami layani</p>
              <p>Pembayaran hanya melalui rekening di atas.</p>
              <p class="bold">Terima Kasih</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const printWin = window.open('', '_blank');
    if (printWin) {
      printWin.document.write(printContent);
      printWin.document.close();
      printWin.focus();
      setTimeout(() => {
        printWin.print();
        printWin.close();
      }, 250);
    }
  };

  // --- PRINT FUNCTION 2: Cetak Nota Faktur Standar / Dot-Matrix & Simpan PDF (No, Deskripsi, Bahan, Ukuran, Qty (Pcs), Total) ---
  const handlePrintInvoice = () => {
    const totalPaid = paymentStatus === 'Lunas' ? totalMarkup : paymentStatus === 'DP' ? downPayment : 0;
    const remainingAmount = Math.max(0, totalMarkup - totalPaid);

    const itemsRows = items.map((item, index) => {
      const isArea = item.isAreaBased;
      const sizeDisplay = isArea && parseFloat(item.length) > 0 && parseFloat(item.width) > 0
        ? `${item.length}x${item.width}`
        : '-';

      const materialAndFinishing = [
        item.productName || 'N/A',
        (item.finishing && item.finishing !== 'Tanpa Finishing') ? item.finishing : ''
      ].filter(Boolean).join(' - ');

      return `
        <tr>
          <td style="text-align: center;">${index + 1}</td>
          <td>${item.description || '-'}</td>
          <td>${materialAndFinishing}</td>
          <td style="text-align: center;">${sizeDisplay}</td>
          <td style="text-align: center;">${item.qty} Pcs</td>
          <td class="currency" style="text-align: right;">${new Intl.NumberFormat('id-ID').format(item.markupSubtotal)}</td>
        </tr>
      `;
    }).join('');

    const printContent = `
      <html>
        <head>
          <title>Nota ${notaNumber}</title>
          <style>
            @page {
              size: 241mm 279mm;
              margin: 0;
            }
            body {
              font-family: sans-serif;
              font-size: 9pt;
              color: #000;
              line-height: 1.2;
              margin: 0;
              padding: 10px;
            }
            .nota-container {
              width: 100%;
              max-width: 220mm;
              margin: auto;
            }
            .sub-header, .footer, .signatures {
              display: flex;
              justify-content: space-between;
            }
            .divider {
              border: 0;
              border-top: 1px dashed black;
              margin: 0;
            }
            .sub-header { font-size: 8pt; margin-top: 4px; }
            .sub-header .nota-no {
              font-weight: bold;
              text-align: right;
            }
            table {
              margin-top: 0;
              width: 100%;
              border-collapse: collapse;
              margin: 8px 0;
              font-size: 8pt;
            }
            th {
              border: 1px solid #555;
              padding: 3px 4px;
              text-align: left;
              vertical-align: top;
              background-color: #f0f0f0;
            }
            td {
              border: 1px solid transparent;
              padding: 3px 4px;
              text-align: left;
              vertical-align: top;
            }
            td.currency { text-align: right; }
            .footer {
              align-items: flex-end;
              margin-top: 0;
            }
            .footer-left {
              font-size: 7pt;
              max-width: 60%;
            }
            .footer-left p { margin: 0; }
            .footer-right {
              text-align: right;
              font-size: 8pt;
              min-width: 160px;
            }
            .summary-item {
              display: flex;
              justify-content: space-between;
              margin-bottom: 1px;
            }
            .summary-divider {
              border-top: 1px solid black;
              margin: 4px 0;
              width: 100%;
            }
            .signatures {
              margin-top: 12px;
              display: flex;
              justify-content: space-around;
              text-align: center;
              font-size: 8pt;
            }
          </style>
        </head>
        <body>
          <div class="nota-container">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 8px; border-bottom: 1px dashed black;">
              <div style="width: 60%;">
                <h1 style="font-size: 18pt; font-weight: bold; margin: 0; padding: 0; line-height: 1;">
                  <span style="color: #000000;">NALA</span>
                  <span style="color: #000000;">MEDIA</span>
                  <span style="font-size: 10pt; font-weight: normal; color: #000000;"> Digital Printing</span>
                </h1>
                <p style="font-size: 8pt; margin-top: 4px; line-height: 1.2; margin: 0;">
                  Jl. Prof. Moh. Yamin, Cerbonan, Karanganyar<br/>
                  Email: nalamedia.kra@gmail.com | Telp/WA: 0813-9872-7722
                </p>
              </div>
              <div style="width: 40%; text-align: right; font-size: 10pt; line-height: 1.4;">
                <p style="margin: 0;">Tanggal: ${new Date(orderDate).toLocaleDateString('id-ID')}</p>
                <p style="margin: 4px 0 0 0;">Kepada Yth,</p>
                <p style="font-weight: bold; margin: 0; color: #000000;">${customerName}</p>
              </div>
            </div>

            <div class="sub-header">
              <div class="kasir-info">
                <p>NOTA :</p>
              </div>
              <div class="nota-no">
                <p>${notaNumber}</p>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th style="text-align: center; width: 4%;">No</th>
                  <th style="width: 32%;">Deskripsi</th>
                  <th style="width: 26%;">Bahan</th>
                  <th style="width: 16%; text-align: center;">Ukuran</th>
                  <th style="text-align: center; width: 8%;">Qty</th>
                  <th class="currency" style="width: 14%;">Total</th>
                </tr>
              </thead>
              <tbody>${itemsRows}</tbody>
            </table>

            <div class="summary-divider"></div>

            <div class="footer">
              <div class="footer-left">
                <p><strong>PERHATIAN:</strong></p>
                <p>Pembayaran Resmi hanya melalui Bank A/n Ariska Prima Diastari</p>
                <p><strong>BRI:</strong> 670-70-10-28864537 | <strong>BCA:</strong> 0154361801 | <strong>BPD JATENG:</strong> 3142069325</p>
                <p>Pembayaran selain Nomor Rekening di atas bukan tanggung jawab kami.</p>
              </div>
              <div class="footer-right">
                <div class="summary-item">
                  <span>Sub Total :</span>
                  <span>${new Intl.NumberFormat('id-ID').format(totalMarkup)}</span>
                </div>
                <div class="summary-item">
                  <span>Bayar :</span>
                  <span>${new Intl.NumberFormat('id-ID').format(totalPaid)}</span>
                </div>
                <div class="summary-divider"></div>
                <div class="summary-item">
                  <span>Sisa :</span>
                  <span>${new Intl.NumberFormat('id-ID').format(remainingAmount)}</span>
                </div>
              </div>
            </div>

            <div class="signatures">
              <div>
                <p style="margin-bottom: 40px;">Hormat Kami,</p>
                <p>( ................................ )</p>
              </div>
              <div>
                <p style="margin-bottom: 40px;">Penerima,</p>
                <p>( ................................ )</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    const printWin = window.open('', '_blank');
    if (printWin) {
      printWin.document.write(printContent);
      printWin.document.close();
      printWin.focus();
      setTimeout(() => {
        printWin.print();
        printWin.close();
      }, 250);
    }
  };

  return (
    <div className="space-y-6">
      {/* TAHAP 1: SEARCH & SELECTION (Jika belum mengedit) */}
      {!isEditing ? (
        <div className="space-y-6">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
            <div className="flex items-start">
              <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700 mr-3 mt-0.5">
                <TagIcon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-emerald-900 text-base">Cari Nota Asli Reseller</h3>
                <p className="text-emerald-700 text-sm mt-1">
                  Ketik nomor nota (contoh: <span className="font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-emerald-300">INV-12345</span>) atau nama pelanggan. Pencarian ini berlangsung instan di aplikasi tanpa membebani server.
                </p>
              </div>
            </div>

            <div className="relative mt-4">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-emerald-600">
                <MagnifyingGlassIcon className="h-5 w-5" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (searchResults.length > 0) {
                      handleSelectOrder(searchResults[0]);
                    }
                  }
                }}
                placeholder="Ketik nomor nota (cth: INV-12345) atau nama reseller..."
                className="w-full pl-10 pr-4 py-3 border-2 border-emerald-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white shadow-sm text-gray-800 placeholder-gray-400 font-medium"
                autoFocus
              />
            </div>
          </div>

          {/* Quick List / Hasil Pencarian List */}
          {searchQuery.trim() === '' && !selectedOrder && combinedOrders.length > 0 && (
            <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
              <div className="bg-gray-50 px-4 py-2.5 border-b font-semibold text-xs text-gray-500 uppercase tracking-wider flex justify-between items-center">
                <span>10 Pesanan Terbaru (Klik untuk Pilih Langsung)</span>
                <span className="text-gray-400 font-normal">atau ketik di atas</span>
              </div>
              <div className="divide-y divide-gray-100 max-h-60 overflow-y-auto">
                {combinedOrders.slice(0, 10).map(order => (
                  <div
                    key={order.id}
                    onClick={() => handleSelectOrder(order)}
                    className="p-3.5 cursor-pointer hover:bg-emerald-50/70 transition-colors flex justify-between items-center"
                  >
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-bold text-gray-900 bg-gray-100 px-2 py-0.5 rounded text-xs">
                          {order.id}
                        </span>
                        <span className="font-semibold text-sm text-purple-700">{order.customer}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1 line-clamp-1">{order.details}</p>
                    </div>
                    <div className="text-right ml-4 flex-shrink-0">
                      <p className="text-sm font-bold text-pink-600 font-mono">{formatCurrency(order.totalPrice)}</p>
                      <p className="text-xs text-gray-400">{new Date(order.orderDate).toLocaleDateString('id-ID')}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Hasil Pencarian List */}
          {searchQuery.trim() !== '' && (
            <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
              <div className="bg-gray-50 px-4 py-2.5 border-b font-semibold text-xs text-gray-500 uppercase tracking-wider flex justify-between items-center">
                <span>Ditemukan {searchResults.length} Nota</span>
                <span className="text-gray-400 font-normal">Tekan Enter atau klik untuk memilih</span>
              </div>
              <div className="divide-y divide-gray-100 max-h-72 overflow-y-auto">
                {searchResults.length > 0 ? (
                  searchResults.map(order => (
                    <div
                      key={order.id}
                      onClick={() => handleSelectOrder(order)}
                      className={`p-4 cursor-pointer hover:bg-emerald-50/70 transition-colors flex justify-between items-center ${
                        selectedOrder?.id === order.id ? 'bg-emerald-100/60 border-l-4 border-emerald-600' : ''
                      }`}
                    >
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-mono font-bold text-gray-900 bg-gray-100 px-2 py-0.5 rounded text-sm">
                            {order.id}
                          </span>
                          <span className="font-semibold text-purple-700">{order.customer}</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1 line-clamp-1">{order.details}</p>
                      </div>
                      <div className="text-right ml-4 flex-shrink-0">
                        <p className="text-sm font-bold text-pink-600 font-mono">{formatCurrency(order.totalPrice)}</p>
                        <p className="text-xs text-gray-400">{new Date(order.orderDate).toLocaleDateString('id-ID')}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center text-gray-400 text-sm">
                    Tidak ditemukan nota dengan kata kunci <span className="font-semibold">"{searchQuery}"</span>.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Kartu Nota Terpilih & Konfirmasi Masuk Edit */}
          {selectedOrder && (
            <div className="border-2 border-emerald-500 bg-white rounded-xl p-5 shadow-md space-y-4 animate-fade-in">
              <div className="flex justify-between items-start border-b pb-3">
                <div>
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full uppercase">
                    Nota Asli Terpilih
                  </span>
                  <h4 className="text-xl font-bold text-gray-900 mt-1 font-mono">{selectedOrder.id}</h4>
                  <p className="text-sm text-gray-600">Pelanggan: <span className="font-semibold">{selectedOrder.customer}</span></p>
                  <p className="text-xs text-gray-500">Tanggal: {new Date(selectedOrder.orderDate).toLocaleDateString('id-ID')}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">Total Harga Asli (Nalamedia)</p>
                  <p className="text-2xl font-bold text-pink-600 font-mono">{formatCurrency(selectedOrder.totalPrice)}</p>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Item dalam Nota Ini ({items.length} Item):</p>
                <div className="space-y-1.5">
                  {items.map((item, idx) => (
                    <div key={item.id} className="text-xs bg-gray-50 p-2 rounded border flex justify-between">
                      <span>{idx + 1}. {item.description} ({item.productName})</span>
                      <span className="font-mono text-gray-600">
                        {item.isAreaBased ? `${item.length}x${item.width}m | ` : ''}{item.qty} Pcs = {formatCurrency(item.originalSubtotal)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={handleCancelSelection}
                  className="px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 font-medium text-sm transition-colors"
                >
                  Batal / Cari Lain
                </button>
                <button
                  type="button"
                  onClick={handleStartEditing}
                  className="flex items-center px-6 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow transition-colors"
                >
                  <PencilIcon className="h-4 w-4 mr-2" />
                  Edit & Buat Nota Markup
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* TAHAP 2: FORM PENGEDITAN NOTA MARKUP */
        <div className="space-y-6">
          {/* Header Bar */}
          <div className="flex justify-between items-center bg-gray-50 p-3 rounded-lg border">
            <div>
              <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">
                Mode Nota Markup (Client-Side Only)
              </span>
              <p className="text-xs text-gray-500">Perubahan harga ini TIDAK akan disimpan di database Supabase Anda.</p>
            </div>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="flex items-center px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-100"
            >
              <ArrowUturnLeftIcon className="h-3.5 w-3.5 mr-1" />
              Ganti Nota
            </button>
          </div>

          {/* Form Header Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white p-4 rounded-xl border border-gray-200">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase">No. Nota di Cetak</label>
              <input
                type="text"
                value={notaNumber}
                onChange={e => setNotaNumber(e.target.value)}
                className="mt-1 w-full p-2 border rounded-md font-mono text-sm font-semibold bg-gray-50"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase">Tanggal Nota</label>
              <input
                type="date"
                value={orderDate}
                onChange={e => setOrderDate(e.target.value)}
                className="mt-1 w-full p-2 border rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase">
                Nama Pelanggan (Klien Reseller)
              </label>
              <input
                type="text"
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                placeholder="Bisa diganti nama klien reseller..."
                className="mt-1 w-full p-2 border-2 border-emerald-300 rounded-md text-sm font-semibold focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase">Status Pembayaran di Struk</label>
              <select
                value={paymentStatus}
                onChange={e => setPaymentStatus(e.target.value as any)}
                className="mt-1 w-full p-2 border rounded-md text-sm bg-white font-medium"
              >
                <option value="Lunas">Lunas (Rekomendasi Reseller)</option>
                <option value="Belum Lunas">Belum Lunas</option>
                <option value="DP">Uang Muka / DP</option>
              </select>
            </div>

            {paymentStatus === 'DP' ? (
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase">Jumlah DP (Rp)</label>
                <input
                  type="number"
                  value={downPayment}
                  onChange={e => setDownPayment(parseFloat(e.target.value) || 0)}
                  className="mt-1 w-full p-2 border rounded-md text-sm font-mono"
                />
              </div>
            ) : (
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-gray-700 uppercase">Catatan Kaki Struk</label>
                <input
                  type="text"
                  value={notaNotes}
                  onChange={e => setNotaNotes(e.target.value)}
                  className="mt-1 w-full p-2 border rounded-md text-sm"
                  placeholder="e.g., Terima kasih atas kerjasamanya..."
                />
              </div>
            )}
          </div>

          {/* Quick Markup Toolbar */}
          <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <span className="text-xs font-bold text-emerald-900 uppercase tracking-wide flex items-center">
                <CurrencyDollarIcon className="h-4 w-4 mr-1 text-emerald-600" />
                Quick Markup (Terapkan ke Semua Item):
              </span>
              <button
                type="button"
                onClick={handleResetToOriginal}
                className="text-xs text-gray-600 hover:text-gray-900 underline font-medium"
              >
                Reset ke Harga Asli
              </button>
            </div>
            <div className="flex flex-wrap gap-2 mt-2.5">
              {[10, 20, 25, 30, 40, 50, 100].map(pct => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => handleApplyQuickMarkupPercent(pct)}
                  className="px-3 py-1.5 bg-white border border-emerald-300 hover:bg-emerald-600 hover:text-white text-emerald-800 text-xs font-bold rounded-lg shadow-sm transition-all"
                >
                  +{pct}%
                </button>
              ))}
            </div>
          </div>

          {/* Tabel Pengeditan Item */}
          <div className="space-y-4">
            <h4 className="font-bold text-sm text-gray-800 uppercase tracking-wider">
              Daftar Item Pesanan ({items.length} Item)
            </h4>

            {items.map((item, index) => {
              const itemMargin = item.markupSubtotal - item.originalSubtotal;
              const itemMarginPercent = item.originalSubtotal > 0 ? Math.round((itemMargin / item.originalSubtotal) * 100) : 0;
              const unitLabel = item.isAreaBased ? '/m²' : '/pcs';

              return (
                <div key={item.id} className="bg-white border rounded-xl p-4 shadow-sm space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-xs font-bold text-gray-400 mr-2">#{index + 1}</span>
                      <span className="font-bold text-gray-800">{item.description}</span>
                      <p className="text-xs text-gray-500">
                        {item.productName}
                        {item.finishing !== 'Tanpa Finishing' ? ` • Finishing: ${item.finishing}` : ''}
                      </p>
                    </div>
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-mono">
                      {item.isAreaBased ? `${item.length} x ${item.width} m (${item.multiplier.toFixed(2)} m²) | ` : ''}
                      {item.qty} Pcs
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-gray-50 p-3 rounded-lg text-xs">
                    <div>
                      <span className="text-gray-500 block">Harga Satuan Asli:</span>
                      <span className="font-mono font-bold text-gray-700">
                        {formatCurrency(item.originalUnitPrice)}{unitLabel}
                      </span>
                      <span className="text-gray-400 block mt-0.5">
                        Total Asli: {formatCurrency(item.originalSubtotal)}
                      </span>
                    </div>

                    <div>
                      <label className="text-emerald-800 font-bold block mb-1">
                        Harga Satuan Baru ({unitLabel}):
                      </label>
                      <input
                        type="number"
                        value={item.markupUnitPrice}
                        onChange={e => handleItemUnitPriceChange(item.id, parseFloat(e.target.value) || 0)}
                        className="w-full p-2 border-2 border-emerald-300 rounded font-mono font-bold text-sm bg-white focus:border-emerald-500"
                        min="0"
                        step="500"
                      />
                    </div>

                    <div>
                      <label className="text-emerald-800 font-bold block mb-1">Subtotal Item Baru (Rp):</label>
                      <input
                        type="number"
                        value={item.markupSubtotal}
                        onChange={e => handleItemSubtotalChange(item.id, parseFloat(e.target.value) || 0)}
                        className="w-full p-2 border-2 border-emerald-300 rounded font-mono font-bold text-sm bg-white focus:border-emerald-500"
                        min="0"
                      />
                    </div>
                  </div>

                  {/* Indicator Margin Baris */}
                  <div className="flex justify-between items-center text-xs pt-1 px-1">
                    <span className="text-gray-400">Selisih Margin Item:</span>
                    <span
                      className={`font-semibold ${
                        itemMargin >= 0 ? 'text-emerald-600' : 'text-red-500'
                      }`}
                    >
                      {itemMargin >= 0 ? '+' : ''}
                      {formatCurrency(itemMargin)} ({itemMarginPercent >= 0 ? '+' : ''}{itemMarginPercent}%)
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom Summary & Print Action Buttons */}
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 p-5 rounded-2xl shadow space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center sm:text-left border-b border-emerald-200/80 pb-4">
              <div>
                <p className="text-xs text-gray-500">Harga Modal Reseller (Asli):</p>
                <p className="text-lg font-bold text-gray-700 font-mono">{formatCurrency(totalOriginal)}</p>
              </div>
              <div>
                <p className="text-xs text-emerald-800 font-semibold">Total Tagihan Nota Markup:</p>
                <p className="text-2xl font-black text-emerald-600 font-mono">{formatCurrency(totalMarkup)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Keuntungan / Margin Reseller:</p>
                <p className="text-lg font-bold text-purple-700 font-mono">
                  +{formatCurrency(resellerMargin)} ({marginPercent >= 0 ? '+' : ''}{marginPercent}%)
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={handlePrintThermal}
                className="flex items-center justify-center px-5 py-3 bg-gray-900 hover:bg-black text-white font-bold rounded-xl text-sm shadow transition-colors"
                title="Cetak format kertas thermal 80mm"
              >
                <PrinterIcon className="h-4 w-4 mr-2" />
                Cetak Struk Thermal (80mm)
              </button>

              <button
                type="button"
                onClick={handlePrintInvoice}
                className="flex items-center justify-center px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm shadow transition-colors"
                title="Cetak format faktur nota standar A4 / dot-matrix"
              >
                <PrinterIcon className="h-4 w-4 mr-2" />
                Cetak Nota / Invoice (A4)
              </button>

              <button
                type="button"
                onClick={handlePrintInvoice}
                className="flex items-center justify-center px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm shadow transition-colors"
                title="Simpan atau download nota sebagai file PDF via print dialog"
              >
                <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
                Simpan PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MarkupInvoice;
