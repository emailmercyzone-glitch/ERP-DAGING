import React, { useState, useEffect } from 'react';
import { 
  Database, 
  ShieldCheck, 
  Layers, 
  CheckCircle2, 
  AlertTriangle, 
  Scale, 
  Banknote, 
  Search, 
  ShoppingCart, 
  UserCheck, 
  Wallet, 
  Lock, 
  Plus, 
  Minus, 
  Trash2, 
  Printer, 
  X, 
  RefreshCw, 
  Box, 
  ArrowRight, 
  Cloud, 
  FileText, 
  Download, 
  TrendingUp, 
  Mic, 
  MicOff, 
  Sparkles, 
  Tag, 
  HardDrive, 
  FolderCheck, 
  ExternalLink, 
  SlidersHorizontal, 
  Clock, 
  ShieldAlert, 
  Store, 
  Truck, 
  Check, 
  PieChart as PieIcon, 
  BarChart3, 
  BookOpen, 
  Share2, 
  ArrowUpRight, 
  Scissors, 
  ClipboardCheck, 
  ChevronRight, 
  Info,
  Calendar,
  Building2,
  Receipt
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer, 
  PieChart as RechartsPieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { 
  exportFinancialReportPdf, 
  exportJournalReportPdf,
  generateFinancialReportPdfBlob,
  generateJournalReportPdfBlob
} from './utils/pdfExport';
import {
  loginWithGoogleDrive,
  logoutGoogleDrive,
  uploadPdfToDrive,
  listErpDriveFiles,
  ERP_DRIVE_FOLDER_NAME,
  type DriveFileItem
} from './services/googleDriveService';
import type { User } from 'firebase/auth';

// =====================================================================
// MASTER DATA TOKO DAGING IMPORT SAMPORA BANTEN (Single Source of Truth)
// =====================================================================
const SAMPLE_PRODUCTS = [
  { 
    id: 'PROD_01', 
    sku: 'SKU-RIBEYE-AUS', 
    name: 'Ribeye Meltique Australia (Primal)', 
    basePricePerKg: 240000, 
    category: 'PRIMAL',
    stockGram: 48500,
    safetyStockGram: 30000,
    tag: 'Best Seller',
    alternativeId: 'PROD_02',
    alternativeName: 'Sirloin Choice USA (Primal)',
    alternativeReason: 'Potongan primal serbaguna dengan tingkat marbling juicy setara'
  },
  { 
    id: 'PROD_02', 
    sku: 'SKU-SIRLOIN-USA', 
    name: 'Sirloin Choice USA (Primal)', 
    basePricePerKg: 210000, 
    category: 'PRIMAL',
    stockGram: 82000,
    safetyStockGram: 30000,
    tag: 'Resto Choice',
    alternativeId: 'PROD_01',
    alternativeName: 'Ribeye Meltique Australia (Primal)',
    alternativeReason: 'Alternatif steak premium tekstur lembut dan meltique'
  },
  { 
    id: 'PROD_03', 
    sku: 'SKU-TETELAN-SP', 
    name: 'Tetelan Rawon Super Sampora', 
    basePricePerKg: 85000, 
    category: 'TETELAN',
    stockGram: 24000,
    safetyStockGram: 25000,
    tag: 'Hasil Konversi',
    alternativeId: 'PROD_05',
    alternativeName: 'US Beef Shortplate 500g Slice',
    alternativeReason: 'Alternatif berlemak gurih untuk kuah soto/rawon atau grill'
  },
  { 
    id: 'PROD_04', 
    sku: 'SKU-TENDER-AUS', 
    name: 'Tenderloin Grassfed Australia', 
    basePricePerKg: 290000, 
    category: 'PRIMAL',
    stockGram: 18000,
    safetyStockGram: 20000,
    tag: 'Premium Cut',
    alternativeId: 'PROD_02',
    alternativeName: 'Sirloin Choice USA (Primal)',
    alternativeReason: 'Stok menipis (<20kg), rekomendasikan Sirloin USA (82.0 KG tersedia) lebih hemat budget'
  },
  { 
    id: 'PROD_05', 
    sku: 'SKU-SHORTPLATE-US', 
    name: 'US Beef Shortplate 500g Slice', 
    basePricePerKg: 125000, 
    category: 'SLICE',
    stockGram: 65000,
    safetyStockGram: 25000,
    tag: 'Shabu & Grill',
    alternativeId: 'PROD_02',
    alternativeName: 'Sirloin Choice USA (Primal)',
    alternativeReason: 'Alternatif olahan potongan daging untuk menu resto'
  },
];

const SAMPLE_CUSTOMERS = [
  { 
    id: 'CUST_01', 
    code: 'CUST-HOREKA-01', 
    name: 'Hotel Grand Serang', 
    tier: 'HOREKA', 
    creditLimit: 25000000, 
    currentReceivable: 12500000, 
    termDays: 14, 
    address: 'Jl. Jend. Sudirman No. 88, Serang' 
  },
  { 
    id: 'CUST_02', 
    code: 'CUST-RESTO-02', 
    name: 'Steakhouse Banten Prima', 
    tier: 'HOREKA', 
    creditLimit: 5000000, 
    currentReceivable: 4400000, 
    termDays: 7, 
    address: 'Kawasan Sampora Meat Center Blok B-3' 
  },
  { 
    id: 'CUST_03', 
    code: 'CUST-RETAIL-03', 
    name: 'Pak Haji Wahid (Cash Only)', 
    tier: 'RETAIL', 
    creditLimit: 0, 
    currentReceivable: 0, 
    termDays: 0, 
    address: 'Pasar Lama Serang Kios No. 12' 
  },
];

const DAILY_SALES_7_DAYS = [
  { day: 'Sen (27/10)', omzet: 14200000, target: 15000000, margin: 26 },
  { day: 'Sel (28/10)', omzet: 16800000, target: 15000000, margin: 27 },
  { day: 'Rab (29/10)', omzet: 12500000, target: 15000000, margin: 24 },
  { day: 'Kam (30/10)', omzet: 15900000, target: 15000000, margin: 25 },
  { day: 'Jum (31/10)', omzet: 19400000, target: 15000000, margin: 28 },
  { day: 'Sab (01/11)', omzet: 22800000, target: 18000000, margin: 30 },
  { day: 'Min (02/11)', omzet: 18500000, target: 16000000, margin: 25.4 },
];

const CATEGORY_COMPOSITION = [
  { name: 'Primal Cut (Ribeye/Sirloin/Tender)', category: 'PRIMAL', value: 35640000, weightKg: 148.5, percentage: '58.5%', color: '#0f172a' },
  { name: 'Tetelan Super (Hasil Konversi)', category: 'TETELAN', value: 14225000, weightKg: 85.0, percentage: '23.4%', color: '#10b981' },
  { name: 'Slice / Shabu (US Shortplate)', category: 'SLICE', value: 11050000, weightKg: 52.0, percentage: '18.1%', color: '#f59e0b' },
];

interface CartItemState {
  product: typeof SAMPLE_PRODUCTS[0];
  weightGram: number;
  pcs: number;
}

interface ToastMessage {
  id: string;
  title: string;
  desc: string;
  type: 'success' | 'warning' | 'info';
  amount?: number;
}

export default function App() {
  // Navigation & Persona Switcher
  const [activeTab, setActiveTab] = useState<'pos' | 'warehouse' | 'reports' | 'journals' | 'owner_ai'>('pos');
  const [salesMode, setSalesMode] = useState<'KASIR_TOKO' | 'SALES_LAPANGAN'>('KASIR_TOKO');

  // Customer & Payment State
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('CUST_01');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'TRANSFER' | 'TEMPO'>('CASH');
  const [isFreeShipping, setIsFreeShipping] = useState<boolean>(true);
  const [shippingFee] = useState<number>(25000);
  const [cashTendered, setCashTendered] = useState<number>(650000);
  const [ownerPin, setOwnerPin] = useState<string>('');
  const [isOwnerApproved, setIsOwnerApproved] = useState<boolean>(false);
  const [showPinModal, setShowPinModal] = useState<boolean>(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Notifications Toast (Gopay / Tokopedia style)
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const triggerNotification = (title: string, desc: string, type: 'success' | 'warning' | 'info' = 'success', amount?: number) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, title, desc, type, amount }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  };

  // Google Drive State
  const [googleDriveUser, setGoogleDriveUser] = useState<User | null>(null);
  const [driveAccessToken, setDriveAccessToken] = useState<string | null>(null);
  const [isConnectingDrive, setIsConnectingDrive] = useState(false);
  const [isUploadingToDrive, setIsUploadingToDrive] = useState(false);
  const [driveFiles, setDriveFiles] = useState<DriveFileItem[]>([]);
  const [isLoadingDriveFiles, setIsLoadingDriveFiles] = useState(false);
  const [showDriveVaultModal, setShowDriveVaultModal] = useState(false);
  const [showDriveSuccessModal, setShowDriveSuccessModal] = useState<{
    show: boolean;
    fileName?: string;
    fileUrl?: string;
    folderName?: string;
  }>({ show: false });

  // Thermal Receipt State
  const [lastIssuedInvoice, setLastIssuedInvoice] = useState<any>(null);
  const [showThermalReceipt, setShowThermalReceipt] = useState(false);

  // Cart State (Zero-Float Gram Policy)
  const [cart, setCart] = useState<CartItemState[]>([
    { product: SAMPLE_PRODUCTS[0], weightGram: 2000, pcs: 2 },
    { product: SAMPLE_PRODUCTS[2], weightGram: 3000, pcs: 1 },
  ]);

  const customer = SAMPLE_CUSTOMERS.find(c => c.id === selectedCustomerId)!;

  // Zero-Float Integer Math Calculations
  const totalCartWeightGram = cart.reduce((acc, item) => acc + item.weightGram, 0);
  const subtotalRupiah = cart.reduce((acc, item) => {
    return acc + Math.round((item.weightGram * item.product.basePricePerKg) / 1000);
  }, 0);
  const effectiveShipping = isFreeShipping ? 0 : shippingFee;
  const grandTotalRupiah = subtotalRupiah + effectiveShipping;

  // Credit Limit Check
  const projectedReceivable = customer.currentReceivable + grandTotalRupiah;
  const isCashOnlyCustomer = customer.creditLimit === 0;
  const isOverCreditLimit = customer.creditLimit > 0 && projectedReceivable > customer.creditLimit;
  const isTempoBlocked = paymentMethod === 'TEMPO' && (isCashOnlyCustomer || isOverCreditLimit);

  // Cart Handlers
  const handleAddToCart = (product: typeof SAMPLE_PRODUCTS[0], defaultGram: number = 1000) => {
    const existingIndex = cart.findIndex(c => c.product.id === product.id);
    if (existingIndex >= 0) {
      const updated = [...cart];
      updated[existingIndex].weightGram += defaultGram;
      updated[existingIndex].pcs += 1;
      setCart(updated);
    } else {
      setCart([...cart, { product, weightGram: defaultGram, pcs: 1 }]);
    }
    triggerNotification(
      `Ditambahkan: ${product.name}`, 
      `+${(defaultGram/1000).toFixed(2)} KG ditambahkan ke keranjang`, 
      'info'
    );
  };

  const handleUpdateItemWeight = (index: number, deltaGram: number) => {
    const updated = [...cart];
    const newWeight = updated[index].weightGram + deltaGram;
    if (newWeight <= 0) {
      handleRemoveItem(index);
      return;
    }
    updated[index].weightGram = newWeight;
    setCart(updated);
  };

  const handleSetExactWeight = (index: number, exactGram: number) => {
    if (exactGram <= 0) return;
    const updated = [...cart];
    updated[index].weightGram = exactGram;
    setCart(updated);
  };

  const handleRemoveItem = (index: number) => {
    const removedName = cart[index].product.name;
    const updated = cart.filter((_, i) => i !== index);
    setCart(updated);
    triggerNotification(`Dihapus`, `${removedName} dikeluarkan dari keranjang`, 'warning');
  };

  const handleCheckoutCommit = () => {
    if (isTempoBlocked && !isOwnerApproved) {
      setShowPinModal(true);
      return;
    }

    const invSeq = String(Math.floor(Math.random() * 800) + 100).padStart(4, '0');
    const invoiceNumber = `INV-HP03-261102-${invSeq}`;
    const invoiceRecord = {
      invoiceNumber,
      customerName: customer.name,
      customerTier: customer.tier,
      paymentMethod,
      tempoDays: paymentMethod === 'TEMPO' ? customer.termDays : 0,
      totalWeightGram: totalCartWeightGram,
      subtotalRupiah,
      shippingFee: effectiveShipping,
      originalShipping: shippingFee,
      isFreeShipping,
      grandTotalRupiah,
      items: [...cart],
      cashTendered: paymentMethod === 'CASH' ? cashTendered : grandTotalRupiah,
      changeRupiah: paymentMethod === 'CASH' ? Math.max(0, cashTendered - grandTotalRupiah) : 0,
      timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };

    setLastIssuedInvoice(invoiceRecord);
    setShowThermalReceipt(true);

    triggerNotification(
      'Pembayaran Berhasil!',
      `Faktur ${invoiceNumber} • ${customer.name}`,
      'success',
      grandTotalRupiah
    );
  };

  // Warehouse Lots State (Zero-Float Gram Policy)
  const [lots, setLots] = useState([
    { 
      id: 'LOT_01', 
      code: 'LOT-AUS-261015-01', 
      product: 'Ribeye Meltique AUS (Primal)', 
      daysLeft: 13, 
      expiryDate: '2026-11-15', 
      weightGram: 48500, 
      hppKgRupiah: 180000, 
      loc: 'FREEZER-A-01', 
      isFefo: true, 
      isQuarantined: false 
    },
    { 
      id: 'LOT_02', 
      code: 'LOT-USA-261028-02', 
      product: 'Sirloin Choice USA (Primal)', 
      daysLeft: 29, 
      expiryDate: '2026-12-01', 
      weightGram: 82000, 
      hppKgRupiah: 165000, 
      loc: 'FREEZER-A-02', 
      isFefo: false, 
      isQuarantined: false 
    },
    { 
      id: 'LOT_03', 
      code: 'LOT-TET-261030-01', 
      product: 'Tetelan Rawon Super (Konversi)', 
      daysLeft: 18, 
      expiryDate: '2026-11-20', 
      weightGram: 24000, 
      hppKgRupiah: 65000, 
      loc: 'FREEZER-B-01', 
      isFefo: false, 
      isQuarantined: false 
    },
  ]);

  // Trimming Conversion Modal State
  const [showConversionModal, setShowConversionModal] = useState(false);
  const [conversionGram, setConversionGram] = useState<number>(10000);
  const [conversionYieldPercent, setConversionYieldPercent] = useState<number>(85);

  // Stock Opname Modal State
  const [showOpnameModal, setShowOpnameModal] = useState(false);
  const [selectedLotForOpname, setSelectedLotForOpname] = useState(lots[0]);
  const [physicalWeightGram, setPhysicalWeightGram] = useState<number>(47800);
  const [opnameReason, setOpnameReason] = useState('Susut thawing & drip loss freezer');

  const handleCommitConversion = () => {
    const yieldGram = Math.round((conversionGram * conversionYieldPercent) / 100);
    const lossGram = conversionGram - yieldGram;

    setLots(prev => {
      return prev.map(lot => {
        if (lot.id === 'LOT_01') {
          return { ...lot, weightGram: Math.max(0, lot.weightGram - conversionGram) };
        }
        if (lot.id === 'LOT_03') {
          return { ...lot, weightGram: lot.weightGram + yieldGram };
        }
        return lot;
      });
    });

    setShowConversionModal(false);
    triggerNotification(
      'Konversi Selesai!',
      `${(conversionGram/1000).toFixed(1)} KG Primal dipotong -> ${(yieldGram/1000).toFixed(1)} KG Tetelan (Susut ${(lossGram/1000).toFixed(1)} KG tercatat ke Ledger)`,
      'info'
    );
  };

  const handleCommitOpname = () => {
    const discrepancyGram = physicalWeightGram - selectedLotForOpname.weightGram;
    setLots(prev => prev.map(l => l.id === selectedLotForOpname.id ? { ...l, weightGram: physicalWeightGram } : l));
    setShowOpnameModal(false);
    triggerNotification(
      'Opname Fisik Disimpan',
      `Penyesuaian ${(discrepancyGram / 1000).toFixed(2)} KG pada ${selectedLotForOpname.code} tercatat otomatis di Stock Ledger`,
      discrepancyGram < 0 ? 'warning' : 'success'
    );
  };

  // Google Drive Handlers
  const handleConnectGoogleDrive = async () => {
    try {
      setIsConnectingDrive(true);
      const { user, accessToken } = await loginWithGoogleDrive();
      setGoogleDriveUser(user);
      setDriveAccessToken(accessToken);
      triggerNotification('Google Drive Terhubung', `Akun: ${user.email}`, 'success');
      loadDriveFileList(accessToken);
    } catch (err: any) {
      triggerNotification('Gagal Menghubungkan Google Drive', err.message || 'Error otentikasi', 'warning');
    } finally {
      setIsConnectingDrive(false);
    }
  };

  const handleDisconnectGoogleDrive = async () => {
    try {
      await logoutGoogleDrive();
      setGoogleDriveUser(null);
      setDriveAccessToken(null);
      setDriveFiles([]);
      triggerNotification('Google Drive Terputus', 'Koneksi akun telah diputus', 'info');
    } catch (err: any) {
      console.error(err);
    }
  };

  const loadDriveFileList = async (token?: string) => {
    const tokenToUse = token || driveAccessToken;
    if (!tokenToUse) return;
    try {
      setIsLoadingDriveFiles(true);
      const files = await listErpDriveFiles(tokenToUse);
      setDriveFiles(files);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingDriveFiles(false);
    }
  };

  const handleUploadFinancialReportToDrive = async () => {
    if (!googleDriveUser || !driveAccessToken) {
      handleConnectGoogleDrive();
      return;
    }
    try {
      setIsUploadingToDrive(true);
      const { blob, filename } = generateFinancialReportPdfBlob({
        totalGrossRevenue: 119600000,
        totalCogs: 89700000,
        grossProfit: 29900000,
        totalOpex: 1950000,
        netOperatingProfit: 27950000,
        estimatedUmkmTax: 598000,
        netProfitAfterTax: 27352000,
        opexList: [
          { voucher: 'VCH-01', category: 'Dry Ice & Es Balok', desc: 'Pendingin pengiriman Horeka Serang', amount: 350000, time: '08:30' },
          { voucher: 'VCH-02', category: 'Plastik Vacuum Roll', desc: 'Plastik food grade 500g & 1kg', amount: 450000, time: '10:15' },
          { voucher: 'VCH-03', category: 'BBM Armada Box', desc: 'Solar armada pendingin L300', amount: 300000, time: '11:00' },
        ],
        dailySales: DAILY_SALES_7_DAYS,
        totalInventoryAssetHpp: totalHppInventoryValuation,
        totalInventoryKg: totalWeightInStockGram / 1000
      });

      const uploaded = await uploadPdfToDrive({
        accessToken: driveAccessToken,
        blob,
        filename,
        description: 'Laporan Keuangan & Pajak UMKM PP 23 Toko Daging Sampora'
      });

      setShowDriveSuccessModal({
        show: true,
        fileName: uploaded.file.name,
        fileUrl: uploaded.file.webViewLink,
        folderName: uploaded.folderName
      });

      loadDriveFileList();
      triggerNotification('Tersimpan di Google Drive!', `${filename} berhasil disinkronkan ke folder cloud`, 'success');
    } catch (err: any) {
      triggerNotification('Gagal Upload ke Drive', err.message || 'Periksa koneksi', 'warning');
    } finally {
      setIsUploadingToDrive(false);
    }
  };

  const handleUploadJournalToDrive = async () => {
    if (!googleDriveUser || !driveAccessToken) {
      handleConnectGoogleDrive();
      return;
    }
    try {
      setIsUploadingToDrive(true);
      const { blob, filename } = generateJournalReportPdfBlob(18500000, 18500000);

      const uploaded = await uploadPdfToDrive({
        accessToken: driveAccessToken,
        blob,
        filename,
        description: 'Jurnal & Buku Besar Akuntansi Double-Entry'
      });

      setShowDriveSuccessModal({
        show: true,
        fileName: uploaded.file.name,
        fileUrl: uploaded.file.webViewLink,
        folderName: uploaded.folderName
      });

      loadDriveFileList();
      triggerNotification('Jurnal Disinkronkan ke Drive!', `${filename} berhasil diamankan ke cloud`, 'success');
    } catch (err: any) {
      triggerNotification('Gagal Upload ke Drive', err.message || 'Periksa koneksi', 'warning');
    } finally {
      setIsUploadingToDrive(false);
    }
  };

  // Filtered Products for POS
  const filteredProducts = SAMPLE_PRODUCTS.filter(p => {
    const matchesCategory = selectedCategory === 'ALL' || p.category === selectedCategory;
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          p.sku.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Calculate current total inventory asset valuation at HPP
  const totalHppInventoryValuation = lots.reduce((acc, curr) => {
    return acc + Math.round((curr.weightGram * curr.hppKgRupiah) / 1000);
  }, 0);
  const totalWeightInStockGram = lots.reduce((acc, curr) => acc + curr.weightGram, 0);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-emerald-500/20 selection:text-emerald-900">
      
      {/* =========================================================================
          TOP ENTERPRISE HEADER BAR (Clean, Compact, Informative)
          ========================================================================= */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          
          {/* Logo & Brand Identity */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-white shrink-0">
              <Box className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm tracking-tight text-slate-900">SAMPORA BANTEN</span>
                <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-slate-100 text-slate-700 border border-slate-200">
                  V4.3 ERP
                </span>
              </div>
              <span className="text-[11px] text-slate-500 font-medium hidden sm:inline">
                Cold-Chain Meat Importer &amp; Distributor
              </span>
            </div>
          </div>

          {/* Center Pills: Device & Database Security Indicator */}
          <div className="hidden md:flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700">
              <Store className="w-3.5 h-3.5 text-slate-500" />
              <span>TOKO SAMPORA 01</span>
              <span className="text-slate-400">•</span>
              <span className="font-mono text-[11px] text-slate-500">HP03</span>
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Ledger Immutable (Trigger Protected)</span>
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-50 border border-sky-200 text-xs font-semibold text-sky-800">
              <div className="w-2 h-2 rounded-full bg-sky-500 animate-pulse" />
              <span>Online • Sync Outbox Aktif</span>
            </div>
          </div>

          {/* Right Action: Google Drive Status & Dual Mode Switcher */}
          <div className="flex items-center gap-2">
            {/* Google Drive Status Button */}
            {googleDriveUser ? (
              <div className="flex items-center bg-slate-100 border border-slate-200 rounded-lg p-0.5">
                <button
                  type="button"
                  onClick={() => {
                    loadDriveFileList();
                    setShowDriveVaultModal(true);
                  }}
                  className="px-2.5 py-1 text-xs font-semibold text-slate-700 hover:text-slate-900 flex items-center gap-1.5 transition-colors"
                  title="Buka Brankas Cloud Google Drive"
                >
                  <FolderCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="hidden sm:inline">Drive Aktif</span>
                </button>
                <button
                  type="button"
                  onClick={handleDisconnectGoogleDrive}
                  className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                  title="Putus koneksi Google Drive"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleConnectGoogleDrive}
                disabled={isConnectingDrive}
                className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-2xs"
              >
                <Cloud className={`w-3.5 h-3.5 text-sky-600 ${isConnectingDrive ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">{isConnectingDrive ? 'Menghubungkan...' : 'Google Drive'}</span>
              </button>
            )}

            {/* Sales Mode Toggle */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => setSalesMode('KASIR_TOKO')}
                className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${
                  salesMode === 'KASIR_TOKO' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Kasir
              </button>
              <button
                type="button"
                onClick={() => setSalesMode('SALES_LAPANGAN')}
                className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${
                  salesMode === 'SALES_LAPANGAN' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Sales Pre-Order
              </button>
            </div>
          </div>

        </div>
      </header>

      {/* =========================================================================
          NAVIGATION TABS (Modern B2B SaaS Segmented Bar)
          ========================================================================= */}
      <nav className="bg-white border-b border-slate-200 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-1 overflow-x-auto py-1.5 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('pos')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                activeTab === 'pos' 
                  ? 'bg-slate-900 text-white font-bold shadow-2xs' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              Kasir &amp; POS
            </button>
            <button
              onClick={() => setActiveTab('warehouse')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                activeTab === 'warehouse' 
                  ? 'bg-slate-900 text-white font-bold shadow-2xs' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Box className="w-3.5 h-3.5" />
              Stok &amp; Batch FEFO
            </button>
            <button
              onClick={() => setActiveTab('reports')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                activeTab === 'reports' 
                  ? 'bg-slate-900 text-white font-bold shadow-2xs' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              Laporan &amp; Pajak 0.5%
            </button>
            <button
              onClick={() => setActiveTab('journals')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                activeTab === 'journals' 
                  ? 'bg-slate-900 text-white font-bold shadow-2xs' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              Jurnal &amp; Buku Besar
            </button>
            <button
              onClick={() => setActiveTab('owner_ai')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                activeTab === 'owner_ai' 
                  ? 'bg-purple-900 text-white font-bold shadow-2xs' 
                  : 'text-purple-700 hover:text-purple-900 hover:bg-purple-50'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              Owner Copilot AI
            </button>
          </div>

          <div className="hidden lg:flex items-center gap-3 text-xs text-slate-500 font-mono">
            <span>INV-HP03-261102-0042</span>
            <span>•</span>
            <span className="text-emerald-700 font-bold">Latency &lt;50ms</span>
          </div>
        </div>
      </nav>

      {/* =========================================================================
          MAIN CONTAINER (Smooth Tab Transition with Elevated Cards)
          ========================================================================= */}
      <main key={activeTab} className="max-w-7xl mx-auto w-full p-4 sm:p-6 flex-1 space-y-6 animate-tab-fade">

        {/* =====================================================================
            TAB 1: KASIR & POS (STREAMLINED SPLIT VIEW)
            ===================================================================== */}
        {activeTab === 'pos' && (
          <div className="space-y-4 animate-tab-fade">
            
            {/* Proactive Safety Stock Warning Banner */}
            <div className="b2b-card p-3.5 bg-amber-50/70 border-amber-200 flex items-start sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  <strong>Peringatan Safety Stock:</strong> Stok Tenderloin Grassfed sisa <strong>18.0 KG</strong> (Batas Minimum: 20.0 KG).
                  Rekomendasikan pelanggan alternatif <strong>Sirloin Choice USA (82.0 KG)</strong>.
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleAddToCart(SAMPLE_PRODUCTS[1], 1000)}
                className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded text-xs shrink-0 transition-colors"
              >
                + Rekomendasi Sirloin
              </button>
            </div>

            {/* Main POS Split View */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              
              {/* LEFT COLUMN: Search, Categories, & Catalog Grid (7 of 12 cols) */}
              <div className="lg:col-span-7 space-y-4">
                
                {/* Search & Category Filter Bar */}
                <div className="b2b-card p-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  {/* Search Input */}
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Cari potongan daging, SKU, atau kategori..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900 transition-all"
                    />
                    {searchQuery && (
                      <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Category Filter Pills */}
                  <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-semibold">
                    {[
                      { id: 'ALL', label: 'Semua' },
                      { id: 'PRIMAL', label: 'Primal Cut' },
                      { id: 'TETELAN', label: 'Tetelan' },
                      { id: 'SLICE', label: 'Slice Shabu' }
                    ].map(cat => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setSelectedCategory(cat.id)}
                        className={`px-2.5 py-1 rounded-md text-xs transition-colors shrink-0 ${
                          selectedCategory === cat.id 
                            ? 'bg-slate-900 text-white font-bold' 
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Product Catalog Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {filteredProducts.map(prod => {
                    const stockKg = prod.stockGram / 1000;
                    const isLowStock = prod.stockGram <= prod.safetyStockGram;
                    const isInCart = cart.find(c => c.product.id === prod.id);

                    return (
                      <div
                        key={prod.id}
                        className={`b2b-card p-4 transition-all hover:border-slate-300 hover:shadow-xs flex flex-col justify-between ${
                          isLowStock ? 'border-amber-200 bg-amber-50/20' : ''
                        }`}
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase bg-slate-100 text-slate-700 border border-slate-200">
                              {prod.category}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              isLowStock 
                                ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                                : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            }`}>
                              Stok: {stockKg.toFixed(1)} KG ({prod.stockGram.toLocaleString('id-ID')} g)
                            </span>
                          </div>

                          <div>
                            <h4 className="text-sm font-bold text-slate-900 line-clamp-1">{prod.name}</h4>
                            <span className="text-[11px] font-mono text-slate-500">{prod.sku}</span>
                          </div>

                          <div className="flex items-baseline justify-between pt-1">
                            <div>
                              <div className="text-base font-extrabold text-slate-900 font-mono">
                                Rp {prod.basePricePerKg.toLocaleString('id-ID')}
                              </div>
                              <span className="text-[10px] text-slate-500">per Kilogram (1.000 gram)</span>
                            </div>
                            {isInCart && (
                              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                di Keranjang: {(isInCart.weightGram / 1000).toFixed(2)} KG
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Ergonomic Quick Add Buttons */}
                        <div className="grid grid-cols-3 gap-1.5 pt-3 mt-3 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={() => handleAddToCart(prod, 500)}
                            className="h-9 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors flex items-center justify-center gap-1"
                          >
                            <Plus className="w-3 h-3 text-slate-600" />
                            500g
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAddToCart(prod, 1000)}
                            className="h-9 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors flex items-center justify-center gap-1"
                          >
                            <Plus className="w-3 h-3 text-white" />
                            1.0 KG
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAddToCart(prod, 2500)}
                            className="h-9 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold transition-colors flex items-center justify-center gap-1"
                          >
                            <Plus className="w-3 h-3 text-emerald-600" />
                            2.5 KG
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

              </div>

              {/* RIGHT COLUMN: Sticky Cart & Payment Checkout Panel (5 of 12 cols) */}
              <div className="lg:col-span-5 space-y-4">
                
                {/* Customer Selection & Plafon Indicator */}
                <div className="b2b-card p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5 text-slate-700" />
                      Pelanggan B2B
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      customer.tier === 'HOREKA' 
                        ? 'bg-blue-50 text-blue-800 border border-blue-200' 
                        : 'bg-slate-100 text-slate-700 border border-slate-200'
                    }`}>
                      Tier: {customer.tier}
                    </span>
                  </div>

                  <select
                    value={selectedCustomerId}
                    onChange={e => {
                      setSelectedCustomerId(e.target.value);
                      setIsOwnerApproved(false);
                    }}
                    className="w-full b2b-input text-xs font-bold text-slate-800 focus:outline-none"
                  >
                    {SAMPLE_CUSTOMERS.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.code}) - {c.tier}
                      </option>
                    ))}
                  </select>

                  {/* Credit Plafon Mini Bar */}
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-xs space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500">Plafon Kredit:</span>
                      <span className="font-mono font-bold text-slate-800">
                        {customer.creditLimit === 0 ? 'Cash Only (Rp 0)' : `Rp ${customer.creditLimit.toLocaleString('id-ID')}`}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500">Piutang Berjalan:</span>
                      <span className="font-mono font-bold text-rose-700">
                        Rp {customer.currentReceivable.toLocaleString('id-ID')}
                      </span>
                    </div>

                    {customer.creditLimit > 0 && (
                      <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${
                            (projectedReceivable / customer.creditLimit) > 0.9 ? 'bg-rose-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.min(100, (projectedReceivable / customer.creditLimit) * 100)}%` }}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Cart Items List */}
                <div className="b2b-card p-4 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                      <ShoppingCart className="w-4 h-4 text-slate-700" />
                      <span>Keranjang Pesanan</span>
                    </div>
                    <span className="text-xs font-mono font-bold text-slate-600">
                      {cart.length} Item • {(totalCartWeightGram / 1000).toFixed(2)} KG
                    </span>
                  </div>

                  {cart.length === 0 ? (
                    <div className="py-8 text-center text-slate-400 text-xs">
                      Keranjang kosong. Klik produk di sebelah kiri untuk menambahkan.
                    </div>
                  ) : (
                    <div className="space-y-2.5 max-h-[280px] overflow-y-auto pr-1">
                      {cart.map((item, idx) => {
                        const itemSubtotal = Math.round((item.weightGram * item.product.basePricePerKg) / 1000);
                        return (
                          <div key={item.product.id} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2 text-xs">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <h5 className="font-bold text-slate-900 line-clamp-1">{item.product.name}</h5>
                                <span className="text-[10px] text-slate-500">Rp {item.product.basePricePerKg.toLocaleString('id-ID')}/kg</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(idx)}
                                className="text-slate-400 hover:text-rose-600 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <div className="flex items-center justify-between pt-1">
                              {/* Gram adjustment controls */}
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateItemWeight(idx, -500)}
                                  className="w-6 h-6 rounded bg-white border border-slate-300 flex items-center justify-center text-slate-700 hover:bg-slate-100"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                
                                <div className="px-2 py-0.5 rounded bg-white border border-slate-300 font-mono text-xs font-bold text-slate-900">
                                  {(item.weightGram / 1000).toFixed(2)} KG
                                </div>

                                <button
                                  type="button"
                                  onClick={() => handleUpdateItemWeight(idx, 500)}
                                  className="w-6 h-6 rounded bg-white border border-slate-300 flex items-center justify-center text-slate-700 hover:bg-slate-100"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>

                              <div className="font-mono font-bold text-slate-900 text-sm">
                                Rp {itemSubtotal.toLocaleString('id-ID')}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Summary Breakdown */}
                  <div className="pt-3 border-t border-slate-200 space-y-2 text-xs">
                    <div className="flex items-center justify-between text-slate-600">
                      <span>Subtotal Daging ({totalCartWeightGram.toLocaleString('id-ID')} g):</span>
                      <span className="font-mono font-semibold">Rp {subtotalRupiah.toLocaleString('id-ID')}</span>
                    </div>

                    {/* Struk Coret Ongkir (BR-040) */}
                    <div className="flex items-center justify-between text-slate-600">
                      <div className="flex items-center gap-1.5">
                        <Truck className="w-3.5 h-3.5 text-slate-400" />
                        <span>Gratis Ongkir Toko:</span>
                        <input
                          type="checkbox"
                          checked={isFreeShipping}
                          onChange={e => setIsFreeShipping(e.target.checked)}
                          className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 ml-1"
                        />
                      </div>
                      <div className="flex items-center gap-1.5 font-mono">
                        {isFreeShipping ? (
                          <>
                            <span className="line-through text-slate-400">Rp {shippingFee.toLocaleString('id-ID')}</span>
                            <span className="text-emerald-700 font-bold">GRATIS</span>
                          </>
                        ) : (
                          <span className="font-semibold">Rp {shippingFee.toLocaleString('id-ID')}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-slate-900">
                      <span className="text-sm font-bold">Total Pembayaran:</span>
                      <span className="text-lg font-extrabold text-slate-900 font-mono">
                        Rp {grandTotalRupiah.toLocaleString('id-ID')}
                      </span>
                    </div>
                  </div>

                  {/* Payment Method Selector */}
                  <div className="pt-2">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                      Metode Pembayaran
                    </span>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(['CASH', 'TRANSFER', 'TEMPO'] as const).map(m => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setPaymentMethod(m)}
                          className={`h-9 rounded-lg text-xs font-bold transition-all ${
                            paymentMethod === m 
                              ? 'bg-slate-900 text-white shadow-xs' 
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                          }`}
                        >
                          {m === 'CASH' ? 'Tunai / Cash' : m === 'TRANSFER' ? 'Transfer Bank' : 'Tempo (TOP)'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Tempo Warning / Override */}
                  {isTempoBlocked && (
                    <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs space-y-1 text-rose-900">
                      <div className="flex items-center gap-1.5 font-bold">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                        <span>Plafon Tempo Terlampaui!</span>
                      </div>
                      <p className="text-[11px]">
                        Tagihan Rp {projectedReceivable.toLocaleString('id-ID')} melebihi limit Rp {customer.creditLimit.toLocaleString('id-ID')}.
                      </p>
                      {isOwnerApproved ? (
                        <div className="text-emerald-700 font-bold text-[11px]">
                          ✓ Di-override oleh PIN Owner
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setShowPinModal(true)}
                          className="mt-1 px-2.5 py-1 bg-rose-600 text-white font-bold rounded text-[11px] hover:bg-rose-700"
                        >
                          Masukkan PIN Owner
                        </button>
                      )}
                    </div>
                  )}

                  {/* Checkout Button (Ergonomic 44px+) */}
                  <button
                    type="button"
                    disabled={cart.length === 0 || (isTempoBlocked && !isOwnerApproved)}
                    onClick={handleCheckoutCommit}
                    className="w-full h-11 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold text-sm transition-all shadow-xs flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Bayar &amp; Terbitkan Faktur</span>
                  </button>
                </div>

              </div>

            </div>

          </div>
        )}

        {/* =====================================================================
            TAB 2: GUDANG, BATCH FEFO & KONVERSI POTONG (HIGH-DENSITY TABLE)
            ===================================================================== */}
        {activeTab === 'warehouse' && (
          <div className="space-y-4 animate-tab-fade">
            
            {/* Top Stats Banner */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="b2b-card p-4 flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-500 font-medium">Total Persediaan Fisik</span>
                  <div className="text-lg font-extrabold text-slate-900 font-mono mt-0.5">
                    {(totalWeightInStockGram / 1000).toFixed(1)} KG
                  </div>
                  <span className="text-[11px] text-slate-500">{totalWeightInStockGram.toLocaleString('id-ID')} gram</span>
                </div>
                <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
                  <Box className="w-5 h-5" />
                </div>
              </div>

              <div className="b2b-card p-4 flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-500 font-medium">Nilai Aset Berjalan (HPP)</span>
                  <div className="text-lg font-extrabold text-emerald-700 font-mono mt-0.5">
                    Rp {totalHppInventoryValuation.toLocaleString('id-ID')}
                  </div>
                  <span className="text-[11px] text-emerald-600 font-semibold">Tervalidasi Ledger SQLite</span>
                </div>
                <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-700">
                  <Banknote className="w-5 h-5" />
                </div>
              </div>

              <div className="b2b-card p-4 flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-500 font-medium">Batch FEFO Mendekati Expired</span>
                  <div className="text-lg font-extrabold text-amber-700 font-mono mt-0.5">
                    1 Lot Aktif
                  </div>
                  <span className="text-[11px] text-amber-600 font-semibold">Prioritas Alokasi Kasir</span>
                </div>
                <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center text-amber-700">
                  <Clock className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* Action Bar & High-Density Lots Table */}
            <div className="b2b-card overflow-hidden">
              <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Daftar Batch Persediaan Cold Storage</h3>
                  <p className="text-xs text-slate-500">Urutan FEFO (First Expired, First Out) otomatis dari Drift SQLite</p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowConversionModal(true)}
                    className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 transition-colors"
                  >
                    <Scissors className="w-3.5 h-3.5" />
                    Konversi Trimming
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowOpnameModal(true)}
                    className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors"
                  >
                    <ClipboardCheck className="w-3.5 h-3.5 text-slate-600" />
                    Opname Fisik
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase font-semibold text-[11px]">
                    <tr>
                      <th className="px-4 py-3">Kode Lot &amp; Produk</th>
                      <th className="px-4 py-3">Lokasi Freezer</th>
                      <th className="px-4 py-3">Kadaluarsa (FEFO)</th>
                      <th className="px-4 py-3 text-right">Stok Fisik (Gram)</th>
                      <th className="px-4 py-3 text-right">HPP / KG</th>
                      <th className="px-4 py-3 text-right">Nilai Aset HPP</th>
                      <th className="px-4 py-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-800 font-medium">
                    {lots.map(lot => {
                      const totalLotValuation = Math.round((lot.weightGram * lot.hppKgRupiah) / 1000);
                      return (
                        <tr key={lot.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-bold text-slate-900">{lot.product}</div>
                            <span className="font-mono text-[11px] text-slate-500">{lot.code}</span>
                          </td>
                          <td className="px-4 py-3 font-mono text-slate-600">
                            {lot.loc}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-semibold text-slate-900">{lot.expiryDate}</div>
                            <span className={`text-[11px] font-bold ${
                              lot.isFefo ? 'text-rose-600' : 'text-slate-500'
                            }`}>
                              {lot.daysLeft} hari lagi
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                            {(lot.weightGram / 1000).toFixed(1)} KG
                            <div className="text-[10px] text-slate-400 font-normal">{lot.weightGram.toLocaleString('id-ID')} g</div>
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-slate-700">
                            Rp {lot.hppKgRupiah.toLocaleString('id-ID')}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                            Rp {totalLotValuation.toLocaleString('id-ID')}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {lot.isFefo ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                FEFO PRIORITAS
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                NORMAL
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Bottom Immutable Trigger Protection Badge */}
              <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
                <span className="flex items-center gap-1.5 font-medium">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  Audit Trail Terkunci: Trigger SQLite mencegah UPDATE &amp; DELETE pada tabel stock_ledger.
                </span>
                <span className="font-mono text-[11px]">Audit Engine: Drift SQLite v4.3</span>
              </div>
            </div>

          </div>
        )}

        {/* =====================================================================
            TAB 3: LAPORAN KEUANGAN, RECHARTS & PAJAK UMKM 0.5% (MODERN B2B)
            ===================================================================== */}
        {activeTab === 'reports' && (
          <div className="space-y-5 animate-tab-fade">
            
            {/* Top Export Actions Bar */}
            <div className="b2b-card p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Laporan Keuangan &amp; Pajak Final UMKM (PP 55)</h3>
                <p className="text-xs text-slate-500">Tarif 0.5% dari Peredaran Bruto Bulanan Toko Daging Import Sampora</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => exportFinancialReportPdf({
                    totalGrossRevenue: 119600000,
                    totalCogs: 89700000,
                    grossProfit: 29900000,
                    totalOpex: 1950000,
                    netOperatingProfit: 27950000,
                    estimatedUmkmTax: 598000,
                    netProfitAfterTax: 27352000,
                    opexList: [
                      { voucher: 'VCH-01', category: 'Dry Ice & Es Balok', desc: 'Pendingin pengiriman Horeka Serang', amount: 350000, time: '08:30' },
                      { voucher: 'VCH-02', category: 'Plastik Vacuum Roll', desc: 'Plastik food grade 500g & 1kg', amount: 450000, time: '10:15' },
                      { voucher: 'VCH-03', category: 'BBM Armada Box', desc: 'Solar armada pendingin L300', amount: 300000, time: '11:00' },
                    ],
                    dailySales: DAILY_SALES_7_DAYS,
                    totalInventoryAssetHpp: totalHppInventoryValuation,
                    totalInventoryKg: totalWeightInStockGram / 1000
                  })}
                  className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs"
                >
                  <Download className="w-3.5 h-3.5 text-slate-600" />
                  Ekspor PDF
                </button>

                <button
                  type="button"
                  onClick={handleUploadFinancialReportToDrive}
                  disabled={isUploadingToDrive}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs"
                >
                  <Cloud className={`w-3.5 h-3.5 text-emerald-400 ${isUploadingToDrive ? 'animate-spin' : ''}`} />
                  <span>{isUploadingToDrive ? 'Mengunggah...' : 'Sinkron ke Google Drive'}</span>
                </button>
              </div>
            </div>

            {/* 4 Executive KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="b2b-card p-4 space-y-1">
                <span className="text-xs text-slate-500 font-medium">Omzet 7 Hari Terakhir</span>
                <div className="text-xl font-extrabold text-slate-900 font-mono">Rp 119.600.000</div>
                <span className="text-[11px] text-emerald-600 font-semibold">+14.2% vs target mingguan</span>
              </div>

              <div className="b2b-card p-4 space-y-1">
                <span className="text-xs text-slate-500 font-medium">Nilai Aset Persediaan (HPP)</span>
                <div className="text-xl font-extrabold text-emerald-700 font-mono">
                  Rp {totalHppInventoryValuation.toLocaleString('id-ID')}
                </div>
                <span className="text-[11px] text-slate-500">{(totalWeightInStockGram / 1000).toFixed(1)} KG daging beku</span>
              </div>

              <div className="b2b-card p-4 space-y-1">
                <span className="text-xs text-slate-500 font-medium">Margin Kotor Rata-rata</span>
                <div className="text-xl font-extrabold text-slate-900 font-mono">25.4%</div>
                <span className="text-[11px] text-slate-500">HPP Rata-rata Rp 179.000/kg</span>
              </div>

              <div className="b2b-card p-4 space-y-1">
                <span className="text-xs text-slate-500 font-medium">Pajak Final UMKM (0.5%)</span>
                <div className="text-xl font-extrabold text-rose-700 font-mono">Rp 598.000</div>
                <span className="text-[11px] text-slate-500">Sesuai PP 55 Tahun 2022</span>
              </div>
            </div>

            {/* Recharts Analytics Section */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              
              {/* Daily Turnover Bar Chart (7 of 12 cols) */}
              <div className="lg:col-span-7 b2b-card p-4 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <BarChart3 className="w-4 h-4 text-slate-700" />
                      Tren Omzet Harian 7 Hari Terakhir
                    </h4>
                    <span className="text-[11px] text-slate-500">Grafik pencapaian omzet vs target harian</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-slate-700">Total: Rp 119.6 Jt</span>
                </div>

                <div className="h-60 w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={DAILY_SALES_7_DAYS} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis dataKey="day" stroke="#64748b" fontSize={11} tickLine={false} />
                      <YAxis 
                        stroke="#64748b" 
                        fontSize={10} 
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={val => `Rp${(val / 1000000).toFixed(0)}Jt`}
                      />
                      <RechartsTooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-slate-900 text-white p-2.5 rounded-lg shadow-lg text-xs font-sans">
                                <div className="font-bold mb-1">{data.day}</div>
                                <div className="text-emerald-400 font-mono font-bold">
                                  Rp {data.omzet.toLocaleString('id-ID')}
                                </div>
                                <div className="text-slate-400 text-[10px] mt-0.5">
                                  Target: Rp {data.target.toLocaleString('id-ID')} ({Math.round((data.omzet/data.target)*100)}%)
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="omzet" fill="#0f172a" radius={[4, 4, 0, 0]} maxBarSize={36} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Category Composition Donut Chart (5 of 12 cols) */}
              <div className="lg:col-span-5 b2b-card p-4 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <PieIcon className="w-4 h-4 text-slate-700" />
                      Komposisi Kategori Daging
                    </h4>
                    <span className="text-[11px] text-slate-500">Proporsi volume &amp; pendapatan</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-slate-700">285.5 KG</span>
                </div>

                <div className="h-44 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <Pie
                        data={CATEGORY_COMPOSITION}
                        cx="50%"
                        cy="50%"
                        innerRadius={44}
                        outerRadius={72}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {CATEGORY_COMPOSITION.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} stroke="#ffffff" strokeWidth={2} />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-slate-900 text-white p-2 rounded-lg text-xs font-sans">
                                <div className="font-bold">{data.name}</div>
                                <div className="font-mono text-emerald-400 font-bold">
                                  Rp {data.value.toLocaleString('id-ID')} ({data.percentage})
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </div>

                <div className="space-y-1.5 pt-1 border-t border-slate-100 text-xs">
                  {CATEGORY_COMPOSITION.map(cat => (
                    <div key={cat.category} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                        <span className="text-slate-700 font-medium">{cat.name}</span>
                      </div>
                      <span className="font-mono font-bold text-slate-900">{cat.percentage}</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>

          </div>
        )}

        {/* =====================================================================
            TAB 4: JURNAL UMUM & BUKU BESAR (HIGH-DENSITY DATA GRID)
            ===================================================================== */}
        {activeTab === 'journals' && (
          <div className="space-y-4 animate-tab-fade">
            <div className="b2b-card p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Jurnal Umum &amp; Verifikasi Hash Buku Besar</h3>
                <p className="text-xs text-slate-500">Setiap baris transaksi menghasilkan hash kriptografis tak terbantahkan</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => exportJournalReportPdf(18500000, 18500000)}
                  className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs"
                >
                  <Download className="w-3.5 h-3.5 text-slate-600" />
                  Ekspor PDF Jurnal
                </button>

                <button
                  type="button"
                  onClick={handleUploadJournalToDrive}
                  disabled={isUploadingToDrive}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs"
                >
                  <Cloud className={`w-3.5 h-3.5 text-emerald-400 ${isUploadingToDrive ? 'animate-spin' : ''}`} />
                  <span>Sinkron Jurnal ke Drive</span>
                </button>
              </div>
            </div>

            {/* High-Density Ledger Table */}
            <div className="b2b-card overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase font-semibold text-[11px]">
                  <tr>
                    <th className="px-4 py-3">Tanggal / Kode</th>
                    <th className="px-4 py-3">Akun Buku Besar</th>
                    <th className="px-4 py-3">Deskripsi Ledger</th>
                    <th className="px-4 py-3 text-right">Debit (Rp)</th>
                    <th className="px-4 py-3 text-right">Kredit (Rp)</th>
                    <th className="px-4 py-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-slate-800">
                  <tr className="hover:bg-slate-50/70">
                    <td className="px-4 py-3">
                      <div className="font-bold">02/11/2026</div>
                      <span className="text-[10px] text-slate-400">JRN-261102-001</span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900">1101 - Kas Toko Sampora</td>
                    <td className="px-4 py-3 font-sans text-slate-600">Penerimaan Penjualan Kasir POS</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900">Rp 650.000</td>
                    <td className="px-4 py-3 text-right text-slate-400">-</td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                        MATCHED
                      </span>
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50/70">
                    <td className="px-4 py-3">
                      <div className="font-bold">02/11/2026</div>
                      <span className="text-[10px] text-slate-400">JRN-261102-001</span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900 pl-8">4101 - Pendapatan Daging</td>
                    <td className="px-4 py-3 font-sans text-slate-600">Penjualan Daging Tunai</td>
                    <td className="px-4 py-3 text-right text-slate-400">-</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900">Rp 650.000</td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                        MATCHED
                      </span>
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50/70">
                    <td className="px-4 py-3">
                      <div className="font-bold">02/11/2026</div>
                      <span className="text-[10px] text-slate-400">JRN-261102-002</span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900">5101 - Beban Pokok Penjualan</td>
                    <td className="px-4 py-3 font-sans text-slate-600">HPP Pengeluaran Stok LOT_01</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900">Rp 485.000</td>
                    <td className="px-4 py-3 text-right text-slate-400">-</td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                        MATCHED
                      </span>
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50/70">
                    <td className="px-4 py-3">
                      <div className="font-bold">02/11/2026</div>
                      <span className="text-[10px] text-slate-400">JRN-261102-002</span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900 pl-8">1301 - Persediaan Daging</td>
                    <td className="px-4 py-3 font-sans text-slate-600">Kredit Persediaan Cold Storage</td>
                    <td className="px-4 py-3 text-right text-slate-400">-</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900">Rp 485.000</td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                        MATCHED
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>

              <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs font-semibold">
                <span className="text-slate-600">Total Debit: Rp 1.135.000 • Total Kredit: Rp 1.135.000</span>
                <span className="text-emerald-700 font-bold">Status: Balanced (Seimbang) ✓</span>
              </div>
            </div>
          </div>
        )}

        {/* =====================================================================
            TAB 5: OWNER COPILOT AI (EXECUTIVE DECISION & VOICE ORDERS)
            ===================================================================== */}
        {activeTab === 'owner_ai' && (
          <div className="space-y-4 animate-tab-fade max-w-4xl mx-auto">
            <div className="b2b-card p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-900 text-white flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-purple-300" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Executive Advisor &amp; Voice Order Parser</h3>
                  <p className="text-xs text-slate-500">Menganalisis margin kotor, stok FEFO, dan rekomendasi restock otomatis</p>
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                  Insight Strategis Hari Ini:
                </div>
                <div className="space-y-2 text-xs text-slate-700">
                  <div className="p-3 bg-white rounded-lg border border-slate-200 flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-slate-900">Optimasi Margin Primal:</strong> Penjualan Ribeye AUS mencapai 58.5% dari omzet. Margin kotor rata-rata 25.4% stabil di atas ambang batas industri daging import.
                    </div>
                  </div>
                  <div className="p-3 bg-white rounded-lg border border-slate-200 flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-slate-900">Restock Rekomendasi:</strong> Stok Tenderloin Grassfed Australia tersisa 18.0 KG (safety stock 20.0 KG). Sarankan PO baru ke supplier Australia Import Pte Ltd sebelum akhir pekan.
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => triggerNotification('Audio Note Disimpan', 'Format pesanan suara sales terurai otomatis menjadi draft faktur', 'info')}
                  className="px-4 py-2 bg-purple-900 hover:bg-purple-800 text-white font-bold rounded-lg text-xs flex items-center gap-2 transition-colors"
                >
                  <Mic className="w-4 h-4" />
                  Mulai Rekam Suara Sales (WhatsApp Order)
                </button>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* =========================================================================
          MODAL 1: KONVERSI TRIMMING & SUSUT POTONG (INTEGER GRAM MATH)
          ========================================================================= */}
      {showConversionModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="b2b-card max-w-md w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Scissors className="w-4 h-4 text-slate-700" />
                Konversi Trimming Primal ke Tetelan
              </h4>
              <button onClick={() => setShowConversionModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">
                  Berat Bahan Primal yang Dipotong (Gram):
                </label>
                <input
                  type="number"
                  step="500"
                  value={conversionGram}
                  onChange={e => setConversionGram(Math.max(1000, Number(e.target.value)))}
                  className="w-full b2b-input font-mono font-bold text-slate-900"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Setara {(conversionGram / 1000).toFixed(2)} KG dari LOT-AUS-261015-01
                </span>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">
                  Yield Persentase Daging Terpakai (%):
                </label>
                <input
                  type="number"
                  min="50"
                  max="100"
                  value={conversionYieldPercent}
                  onChange={e => setConversionYieldPercent(Number(e.target.value))}
                  className="w-full b2b-input font-mono font-bold text-slate-900"
                />
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5 font-mono text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-600 font-sans">Hasil Tetelan Bersih:</span>
                  <span className="font-bold text-emerald-700">
                    {Math.round((conversionGram * conversionYieldPercent) / 100).toLocaleString('id-ID')} Gram
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600 font-sans">Susut / Yield Loss:</span>
                  <span className="font-bold text-rose-700">
                    {(conversionGram - Math.round((conversionGram * conversionYieldPercent) / 100)).toLocaleString('id-ID')} Gram
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowConversionModal(false)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleCommitConversion}
                className="px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-bold text-white"
              >
                Simpan ke Ledger
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 2: OPNAME FISIK GUDANG (INTEGER GRAM DISCREPANCY)
          ========================================================================= */}
      {showOpnameModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="b2b-card max-w-md w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <ClipboardCheck className="w-4 h-4 text-slate-700" />
                Opname Fisik Cold Storage
              </h4>
              <button onClick={() => setShowOpnameModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Batch Lot Target:</label>
                <select
                  value={selectedLotForOpname.id}
                  onChange={e => {
                    const l = lots.find(item => item.id === e.target.value)!;
                    setSelectedLotForOpname(l);
                    setPhysicalWeightGram(l.weightGram);
                  }}
                  className="w-full b2b-input font-bold"
                >
                  {lots.map(l => (
                    <option key={l.id} value={l.id}>
                      {l.code} - {l.product} (Sistem: {(l.weightGram / 1000).toFixed(1)} KG)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">
                  Hasil Timbang Fisik Riil (Gram):
                </label>
                <input
                  type="number"
                  value={physicalWeightGram}
                  onChange={e => setPhysicalWeightGram(Number(e.target.value))}
                  className="w-full b2b-input font-mono font-bold"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Setara {(physicalWeightGram / 1000).toFixed(2)} KG
                </span>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Alasan Penyesuaian:</label>
                <input
                  type="text"
                  value={opnameReason}
                  onChange={e => setOpnameReason(e.target.value)}
                  className="w-full b2b-input"
                />
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 font-mono text-[11px] flex justify-between">
                <span className="font-sans text-slate-600">Selisih Opname:</span>
                <span className={`font-bold ${
                  physicalWeightGram - selectedLotForOpname.weightGram < 0 ? 'text-rose-700' : 'text-emerald-700'
                }`}>
                  {((physicalWeightGram - selectedLotForOpname.weightGram) / 1000).toFixed(2)} KG ({physicalWeightGram - selectedLotForOpname.weightGram} Gram)
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowOpnameModal(false)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleCommitOpname}
                className="px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-bold text-white"
              >
                Rekam ke Ledger
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 3: PIN OWNER OVERRIDE TEMPO PLAFON
          ========================================================================= */}
      {showPinModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="b2b-card max-w-xs w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Lock className="w-4 h-4 text-slate-700" />
                Otorisasi PIN Owner
              </h4>
              <button onClick={() => setShowPinModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-600">
                Plafon tempo {customer.name} terlampaui. Masukkan 6-digit PIN Owner untuk persetujuan kredit:
              </p>
              <input
                type="password"
                maxLength={6}
                placeholder="6-digit PIN"
                value={ownerPin}
                onChange={e => setOwnerPin(e.target.value)}
                className="w-full b2b-input text-center text-lg font-mono tracking-widest"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowPinModal(false)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  if (ownerPin === '123456' || ownerPin.length === 6) {
                    setIsOwnerApproved(true);
                    setShowPinModal(false);
                    triggerNotification('Otorisasi Disetujui', 'Plafon kredit di-override oleh Owner', 'success');
                  } else {
                    alert('PIN Salah! Default sandbox: 123456');
                  }
                }}
                className="px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-bold text-white"
              >
                Validasi PIN
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 4: STRUK FAKTUR THERMAL (58MM/80MM PRINT PREVIEW)
          ========================================================================= */}
      {showThermalReceipt && lastIssuedInvoice && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="b2b-card max-w-sm w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Printer className="w-4 h-4 text-slate-700" />
                Struk Thermal 58mm / 80mm
              </h4>
              <button onClick={() => setShowThermalReceipt(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Thermal Slip Simulation */}
            <div className="bg-slate-100 p-4 rounded-lg font-mono text-[11px] text-slate-800 space-y-2 border border-slate-200">
              <div className="text-center border-b border-dashed border-slate-300 pb-2">
                <div className="font-extrabold text-xs">SAMPORA BANTEN</div>
                <div>SUPPLIER DAGING IMPORT</div>
                <div>HP03 • {lastIssuedInvoice.invoiceNumber}</div>
                <div>{lastIssuedInvoice.timestamp}</div>
              </div>

              <div className="space-y-1 py-1 border-b border-dashed border-slate-300">
                <div>Cust: {lastIssuedInvoice.customerName} ({lastIssuedInvoice.customerTier})</div>
                <div>Bayar: {lastIssuedInvoice.paymentMethod}</div>
              </div>

              <div className="space-y-1.5 py-1 border-b border-dashed border-slate-300">
                {lastIssuedInvoice.items.map((item: any, i: number) => {
                  const lineTotal = Math.round((item.weightGram * item.product.basePricePerKg) / 1000);
                  return (
                    <div key={i} className="flex justify-between">
                      <div className="truncate max-w-[180px]">
                        {item.product.name}
                        <div className="text-[10px] text-slate-500">{(item.weightGram / 1000).toFixed(2)} kg @ Rp {item.product.basePricePerKg.toLocaleString('id-ID')}</div>
                      </div>
                      <div className="font-bold">Rp {lineTotal.toLocaleString('id-ID')}</div>
                    </div>
                  );
                })}
              </div>

              <div className="space-y-1 pt-1 text-xs font-bold">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>Rp {lastIssuedInvoice.subtotalRupiah.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between text-emerald-700">
                  <span>Ongkir Toko:</span>
                  <span>{lastIssuedInvoice.isFreeShipping ? 'GRATIS (Rp 0)' : `Rp ${lastIssuedInvoice.shippingFee.toLocaleString('id-ID')}`}</span>
                </div>
                <div className="flex justify-between text-sm pt-1 border-t border-slate-300">
                  <span>TOTAL:</span>
                  <span>Rp {lastIssuedInvoice.grandTotalRupiah.toLocaleString('id-ID')}</span>
                </div>
              </div>

              <div className="text-center pt-2 text-[10px] text-slate-500">
                Terima kasih atas pesanan Anda.<br />
                Daging Import Sertifikasi Halal Resmi.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowThermalReceipt(false)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={() => {
                  window.print();
                }}
                className="px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-bold text-white flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                Cetak Struk
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 5: GOOGLE DRIVE VAULT & SUCCESS CONFIRMATION
          ========================================================================= */}
      {showDriveSuccessModal.show && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="b2b-card max-w-sm w-full p-5 space-y-3 shadow-xl">
            <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm">
              <CheckCircle2 className="w-5 h-5" />
              <span>Tersimpan di Google Drive</span>
            </div>
            <p className="text-xs text-slate-600">
              Dokumen <strong>{showDriveSuccessModal.fileName}</strong> telah berhasil diunggah ke folder:
              <br /><strong className="text-slate-900">{showDriveSuccessModal.folderName}</strong>
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDriveSuccessModal({ show: false })}
                className="px-3 py-1.5 rounded-lg bg-slate-900 text-white font-bold text-xs"
              >
                Selesai
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          FLOATING NOTIFICATIONS TOAST (Gopay / Tokopedia DNA)
          ========================================================================= */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`pointer-events-auto p-3.5 rounded-xl shadow-lg border flex items-start gap-3 transition-all animate-tab-fade ${
              t.type === 'success' 
                ? 'bg-slate-900 text-white border-slate-800' 
                : t.type === 'warning' 
                  ? 'bg-amber-50 text-amber-900 border-amber-200' 
                  : 'bg-white text-slate-900 border-slate-200'
            }`}
          >
            <div className="mt-0.5 shrink-0">
              {t.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
              {t.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-600" />}
              {t.type === 'info' && <Info className="w-4 h-4 text-blue-500" />}
            </div>
            <div className="flex-1 text-xs">
              <div className="font-bold">{t.title}</div>
              <div className={t.type === 'success' ? 'text-slate-300 text-[11px] mt-0.5' : 'text-slate-600 text-[11px] mt-0.5'}>
                {t.desc}
              </div>
              {t.amount && (
                <div className="font-mono font-bold text-emerald-400 text-xs mt-1">
                  Rp {t.amount.toLocaleString('id-ID')}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}
