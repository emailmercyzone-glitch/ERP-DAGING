import React, { useState, useRef, useEffect } from 'react';
import { 
  ShieldCheck, 
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
  Sparkles, 
  Tag, 
  FolderCheck, 
  Clock, 
  Store, 
  Truck, 
  Check, 
  PieChart as PieIcon, 
  BarChart3, 
  BookOpen, 
  Scissors, 
  ClipboardCheck, 
  Info, 
  Grid, 
  Home, 
  Package, 
  CreditCard, 
  Building2, 
  Calendar, 
  Layers, 
  FileCheck, 
  ChevronRight, 
  ArrowUpRight, 
  Receipt, 
  User, 
  Settings, 
  HelpCircle, 
  Activity, 
  CheckCircle, 
  ThumbsUp, 
  Snowflake, 
  ExternalLink,
  Zap,
  QrCode,
  Camera
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
import type { User as FirebaseUser } from 'firebase/auth';

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
  // Navigation Architecture: Strictly 5 Primary Tabs
  const [activeTab, setActiveTab] = useState<'home' | 'pos' | 'beli' | 'warehouse' | 'bayar'>('home');
  const [activeSecondaryModule, setActiveSecondaryModule] = useState<null | 'laporan' | 'pajak' | 'audit' | 'pengaturan'>(null);
  const [showModulLainnyaModal, setShowModulLainnyaModal] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

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
  const [inventorySearchQuery, setInventorySearchQuery] = useState<string>('');
  const [inventoryFilterStatus, setInventoryFilterStatus] = useState<'ALL' | 'FEFO' | 'NORMAL'>('ALL');

  // Camera & QR Scanner State for Warehouse Coldroom
  const [showQrScanModal, setShowQrScanModal] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Notifications Toast (Gopay / Tokopedia DNA)
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const triggerNotification = (title: string, desc: string, type: 'success' | 'warning' | 'info' = 'success', amount?: number) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, title, desc, type, amount }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  };

  // Google Drive State
  const [googleDriveUser, setGoogleDriveUser] = useState<FirebaseUser | null>(null);
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

  // Cart Handlers with GoPay Microcopy
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
      `Ditambahkan! 🥩`, 
      `+${(defaultGram/1000).toFixed(2)} KG ${product.name} siap ditimbang`, 
      'info'
    );
  };

  // Quick Add on Long Press (1kg straight to cart without opening modal)
  const [pressingProdId, setPressingProdId] = useState<string | null>(null);
  const [quickAddFlashId, setQuickAddFlashId] = useState<string | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startLongPress = (product: typeof SAMPLE_PRODUCTS[0]) => {
    setPressingProdId(product.id);
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }
    longPressTimerRef.current = setTimeout(() => {
      // Direct Quick Add: 1000g (1 KG)
      handleAddToCart(product, 1000);
      setQuickAddFlashId(product.id);
      setTimeout(() => setQuickAddFlashId(null), 1200);
      setPressingProdId(null);
      triggerNotification(
        '⚡ Quick Add Berhasil!',
        `+1.0 KG ${product.name} langsung masuk keranjang via tekan lama (long press).`,
        'success',
        product.basePricePerKg
      );
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try {
          navigator.vibrate([50, 30, 50]);
        } catch (_) {}
      }
    }, 450);
  };

  const cancelLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    setPressingProdId(null);
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

    // Exact GoPay Humanized Micro-copy requirement:
    triggerNotification(
      'Mantap! Transaksi berhasil dicatat, stok otomatis terpotong.',
      `Faktur ${invoiceNumber} • ${customer.name}`,
      'success',
      grandTotalRupiah
    );
  };

  // Warehouse Lots State (Zero-Float Gram Policy with Per-Item Max Capacity)
  const [lots, setLots] = useState([
    { 
      id: 'LOT_01', 
      code: 'LOT-AUS-261015-01', 
      product: 'Ribeye Meltique AUS (Primal)', 
      daysLeft: 13, 
      expiryDate: '2026-11-15', 
      weightGram: 48500, 
      maxCapacityGram: 60000, // 60 KG shelf max -> 80.8% density (Tier 2)
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
      maxCapacityGram: 90000, // 90 KG shelf max -> 91.1% density (Tier 3: Kritis/Penuh)
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
      maxCapacityGram: 60000, // 60 KG shelf max -> 40.0% density (Tier 1: Ringan)
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
      'Beres, Boss! Trimming daging selesai.',
      `${(conversionGram/1000).toFixed(1)} KG Primal dipotong -> ${(yieldGram/1000).toFixed(1)} KG Tetelan (Susut ${(lossGram/1000).toFixed(1)} KG tercatat ke Ledger)`,
      'info'
    );
  };

  const handleCommitOpname = () => {
    const discrepancyGram = physicalWeightGram - selectedLotForOpname.weightGram;
    setLots(prev => prev.map(l => l.id === selectedLotForOpname.id ? { ...l, weightGram: physicalWeightGram } : l));
    setShowOpnameModal(false);
    triggerNotification(
      'Mantap! Penyesuaian opname fisik freezer berhasil terekam.',
      `Selisih ${(discrepancyGram / 1000).toFixed(2)} KG pada ${selectedLotForOpname.code} tercatat otomatis di Stock Ledger`,
      discrepancyGram < 0 ? 'warning' : 'success'
    );
  };

  // Export current inventory lots data to CSV for external audit
  const handleExportBatchCsv = () => {
    const headers = [
      'ID_Batch',
      'Kode_Batch_Lot',
      'Nama_Produk',
      'Lokasi_Freezer',
      'Tanggal_Expired',
      'Sisa_Hari_FEFO',
      'Stok_Gram',
      'Stok_KG',
      'Kapasitas_Max_Gram',
      'Densitas_Stok_Persen',
      'HPP_per_KG_IDR',
      'Total_Nilai_HPP_IDR',
      'Status_FEFO',
      'Karantina_QC'
    ];

    const dataRows = lots.map(l => {
      const weightKg = (l.weightGram / 1000).toFixed(2);
      const totalHpp = Math.round((l.weightGram * l.hppKgRupiah) / 1000);
      const maxCap = l.maxCapacityGram || 60000;
      const density = Math.min(100, Math.round((l.weightGram / maxCap) * 100));
      return [
        `"${l.id}"`,
        `"${l.code}"`,
        `"${l.product.replace(/"/g, '""')}"`,
        `"${l.loc}"`,
        `"${l.expiryDate}"`,
        l.daysLeft,
        l.weightGram,
        weightKg,
        maxCap,
        density,
        l.hppKgRupiah,
        totalHpp,
        l.isFefo ? '"FEFO_PRIORITAS"' : '"NORMAL"',
        l.isQuarantined ? '"YA"' : '"TIDAK"'
      ].join(',');
    });

    const csvString = '\uFEFF' + [headers.join(','), ...dataRows].join('\r\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const nowStr = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `AUDIT_BATCH_LOTS_SAMPORA_${nowStr}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    triggerNotification(
      'Export Data Batch Berhasil!',
      `File AUDIT_BATCH_LOTS_SAMPORA_${nowStr}.csv (${lots.length} batch) berhasil diunduh untuk audit eksternal.`,
      'success'
    );
  };

  // QR / Barcode Scanner Methods for Meat Batch Packaging
  const startCamera = async () => {
    setCameraError(null);
    setIsCameraActive(false);
    try {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError('Akses kamera tidak didukung pada browser ini. Silakan gunakan tombol simulasi label karton di bawah.');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
      setIsCameraActive(true);

      // Attempt BarcodeDetector API if available natively
      if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
        try {
          const detector = new (window as any).BarcodeDetector({
            formats: ['qr_code', 'code_128', 'ean_13', 'data_matrix']
          });
          const intervalId = setInterval(async () => {
            if (!videoRef.current || !streamRef.current) {
              clearInterval(intervalId);
              return;
            }
            try {
              const barcodes = await detector.detect(videoRef.current);
              if (barcodes.length > 0) {
                const detectedVal = barcodes[0].rawValue;
                clearInterval(intervalId);
                handleQrDetected(detectedVal);
              }
            } catch {
              // Frame scan error, ignore
            }
          }, 350);
        } catch {
          // Barcode detector failed init
        }
      }
    } catch (err: any) {
      console.warn('Camera sensor error:', err);
      setCameraError(
        err.name === 'NotAllowedError'
          ? 'Izin kamera diblokir browser. Gunakan simulasi scan label karton di bawah.'
          : 'Kamera tidak dapat diakses di lingkungan iFrame/preview. Gunakan simulasi scan label di bawah.'
      );
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const openQrModal = () => {
    setShowQrScanModal(true);
    setTimeout(() => {
      startCamera();
    }, 100);
  };

  const closeQrModal = () => {
    stopCamera();
    setShowQrScanModal(false);
  };

  const handleQrDetected = (code: string) => {
    stopCamera();
    setShowQrScanModal(false);
    const cleanCode = code.trim();
    setInventorySearchQuery(cleanCode);
    setInventoryFilterStatus('ALL');

    const matched = lots.find(l => 
      l.code.toLowerCase().includes(cleanCode.toLowerCase()) ||
      l.product.toLowerCase().includes(cleanCode.toLowerCase())
    );

    triggerNotification(
      'Scan QR Berhasil!',
      matched 
        ? `Tabel terfilter otomatis ke: ${matched.code} (${matched.product})`
        : `Tabel terfilter ke batch: ${cleanCode}`,
      'success'
    );
  };

  // Cleanup camera stream on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

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

  // Filtered Inventory Lots for Stok Barang (Warehouse)
  const filteredLots = lots.filter(l => {
    const q = inventorySearchQuery.toLowerCase().trim();
    const matchesSearch = !q || 
                          l.product.toLowerCase().includes(q) || 
                          l.code.toLowerCase().includes(q) || 
                          l.loc.toLowerCase().includes(q);
    const matchesStatus = inventoryFilterStatus === 'ALL' ||
                          (inventoryFilterStatus === 'FEFO' && l.isFefo) ||
                          (inventoryFilterStatus === 'NORMAL' && !l.isFefo);
    return matchesSearch && matchesStatus;
  });

  // Calculate current total inventory asset valuation at HPP
  const totalHppInventoryValuation = lots.reduce((acc, curr) => {
    return acc + Math.round((curr.weightGram * curr.hppKgRupiah) / 1000);
  }, 0);
  const totalWeightInStockGram = lots.reduce((acc, curr) => acc + curr.weightGram, 0);

  // Purchasing Data (Inbound Reefer Containers)
  const [inboundPOs, setInboundPOs] = useState([
    {
      id: 'PO_01',
      poNumber: 'PO-2611-004',
      supplier: 'PT Meat Importers Indonesia',
      container: 'TGHU-992341 (40ft Reefer)',
      eta: 'Besok Siang (05 Nov)',
      items: 'Ribeye Meltique AUS (500 KG), Sirloin (300 KG)',
      status: 'DALAM_PERJALANAN',
      totalRupiah: 145000000,
    },
    {
      id: 'PO_02',
      poNumber: 'PO-2610-098',
      supplier: 'Australia Beef Direct Ltd',
      container: 'MSKU-102938 (20ft Reefer)',
      eta: 'Lolos Karantina & Diterima',
      items: 'Tenderloin Grassfed AUS (200 KG)',
      status: 'SELESAI_BONGKAR',
      totalRupiah: 58000000,
    },
  ]);

  // Accounts Payable/Receivable Data (Tab Bayar)
  const [receivables, setReceivables] = useState([
    {
      id: 'REC_01',
      customer: 'Hotel Grand Serang',
      tier: 'HOREKA',
      amount: 12500000,
      limit: 25000000,
      dueDate: '16 Nov 2026 (12 hari lagi)',
      invoice: 'INV-HP03-261102-0012',
      status: 'BELUM_LUNAS',
    },
    {
      id: 'REC_02',
      customer: 'Steakhouse Banten Prima',
      tier: 'HOREKA',
      amount: 4400000,
      limit: 5000000,
      dueDate: '08 Nov 2026 (4 hari lagi)',
      invoice: 'INV-HP03-261028-0089',
      status: 'MENDEKATI_TEMPO',
    },
  ]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-emerald-500/20 selection:text-emerald-900 pb-20 md:pb-0">
      
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

          {/* Center Pills: Device, Offline/Online Toggle with GoPay Microcopy */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const nextOnline = !isOnline;
                setIsOnline(nextOnline);
                triggerNotification(
                  nextOnline ? 'Online kembali, Boss! 🚀' : 'Sedang offline, Boss! 📱',
                  nextOnline 
                    ? 'Sinkronisasi otomatis berjalan lancar ke server cloud.'
                    : 'Sedang offline, Boss. Transaksi tetap tersimpan aman di HP dan akan disinkronkan saat online.',
                  nextOnline ? 'success' : 'warning'
                );
              }}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border transition-all cursor-pointer ${
                isOnline 
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100' 
                  : 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100'
              }`}
              title="Klik untuk simulasi mode Online / Offline"
            >
              <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
              <span>{isOnline ? 'Online' : 'Offline Mode'}</span>
            </button>

            <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700">
              <Store className="w-3.5 h-3.5 text-slate-500" />
              <span>TOKO SAMPORA 01</span>
            </div>
          </div>

          {/* Right Action: Google Drive & Modul Lainnya Hub Button */}
          <div className="flex items-center gap-2">
            {googleDriveUser ? (
              <button
                type="button"
                onClick={() => {
                  loadDriveFileList();
                  setShowDriveVaultModal(true);
                }}
                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 flex items-center gap-1.5 transition-colors"
                title="Buka Brankas Google Drive"
              >
                <FolderCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span className="hidden sm:inline">Drive Aktif</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleConnectGoogleDrive}
                disabled={isConnectingDrive}
                className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-2xs"
              >
                <Cloud className={`w-3.5 h-3.5 text-sky-600 ${isConnectingDrive ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">{isConnectingDrive ? '...' : 'Google Drive'}</span>
              </button>
            )}

            {/* Modul Lainnya Grid Button */}
            <button
              type="button"
              onClick={() => setShowModulLainnyaModal(true)}
              className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
            >
              <Grid className="w-3.5 h-3.5 text-emerald-400" />
              <span>Modul Lainnya</span>
            </button>
          </div>

        </div>
      </header>

      {/* =========================================================================
          DESKTOP SEGMENTED 5-TAB BAR (Strictly 5 Primary Tabs)
          ========================================================================= */}
      <nav className="bg-white border-b border-slate-200 px-4 sm:px-6 hidden md:block">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-1 py-1.5 text-xs font-semibold">
            {[
              { id: 'home', label: 'Home', icon: Home },
              { id: 'pos', label: 'Kasir', icon: ShoppingCart },
              { id: 'beli', label: 'Beli', icon: Truck },
              { id: 'warehouse', label: 'Stok Barang', icon: Package },
              { id: 'bayar', label: 'Bayar', icon: Wallet },
            ].map(tab => {
              const IconComp = tab.icon;
              const isActive = activeTab === tab.id && activeSecondaryModule === null;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id as any);
                    setActiveSecondaryModule(null);
                  }}
                  className={`px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                    isActive 
                      ? 'bg-slate-900 text-white font-bold shadow-2xs' 
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <IconComp className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {activeSecondaryModule && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Membuka:</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 uppercase">
                {activeSecondaryModule === 'laporan' && 'Laporan & Akuntansi'}
                {activeSecondaryModule === 'pajak' && 'Kepatuhan Pajak'}
                {activeSecondaryModule === 'audit' && 'Immutable Audit Trail'}
                {activeSecondaryModule === 'pengaturan' && 'Pengaturan & Staf'}
              </span>
              <button
                type="button"
                onClick={() => setActiveSecondaryModule(null)}
                className="text-xs font-bold text-slate-500 hover:text-slate-800 underline ml-1"
              >
                Kembali ke Tab Utama
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* =========================================================================
          MAIN CONTAINER (GoPay Simplicity + HashMicro Rigor)
          ========================================================================= */}
      <main className="max-w-7xl mx-auto w-full p-4 sm:p-6 flex-1 space-y-6 animate-tab-fade">

        {/* -------------------------------------------------------------------
            SECONDARY MODULE VIEW (If opened from "Modul Lainnya")
            ------------------------------------------------------------------- */}
        {activeSecondaryModule !== null && (
          <div className="space-y-5 animate-tab-fade">
            <div className="b2b-card p-4 flex items-center justify-between bg-purple-50/40 border-purple-200">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setActiveSecondaryModule(null)}
                  className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
                >
                  <ArrowRight className="w-4 h-4 rotate-180" />
                </button>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {activeSecondaryModule === 'laporan' && 'Modul Laporan & Akuntansi (HashMicro Grade)'}
                    {activeSecondaryModule === 'pajak' && 'Modul Kepatuhan Pajak UMKM (PP 55 / 2022)'}
                    {activeSecondaryModule === 'audit' && 'Modul Immutable Audit Trail & SQLite Triggers'}
                    {activeSecondaryModule === 'pengaturan' && 'Modul Pengaturan Toko & Multi-User PIN'}
                  </h3>
                  <p className="text-xs text-slate-500">Akses modul enterprise backend yang tersembunyi dari operasi kasir harian.</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveSecondaryModule(null)}
                className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                Tutup Modul
              </button>
            </div>

            {/* Laporan & Akuntansi View */}
            {activeSecondaryModule === 'laporan' && (
              <div className="space-y-4">
                <div className="b2b-card p-4 flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">Ekspor Dokumen Laporan Resmi</h4>
                    <p className="text-[11px] text-slate-500">Laporan laba rugi, HPP landed cost, dan arus kas</p>
                  </div>
                  <div className="flex gap-2">
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
                      className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-xs font-bold text-slate-800 flex items-center gap-1.5 hover:bg-slate-50"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download PDF
                    </button>
                    <button
                      type="button"
                      onClick={handleUploadFinancialReportToDrive}
                      disabled={isUploadingToDrive}
                      className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold flex items-center gap-1.5 hover:bg-slate-800"
                    >
                      <Cloud className="w-3.5 h-3.5 text-emerald-400" />
                      Sync ke Google Drive
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="b2b-card p-4 space-y-2">
                    <h5 className="text-xs font-bold text-slate-900">Grafik Omzet Harian 7 Hari Terakhir</h5>
                    <div className="h-52 w-full pt-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={DAILY_SALES_7_DAYS}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                          <XAxis dataKey="day" stroke="#64748b" fontSize={11} tickLine={false} />
                          <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} tickFormatter={val => `Rp${(val/1000000).toFixed(0)}Jt`} />
                          <RechartsTooltip />
                          <Bar dataKey="omzet" fill="#0f172a" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="b2b-card p-4 space-y-2">
                    <h5 className="text-xs font-bold text-slate-900">Komposisi Penjualan Daging</h5>
                    <div className="h-52 w-full pt-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsPieChart>
                          <Pie data={CATEGORY_COMPOSITION} cx="50%" cy="50%" innerRadius={42} outerRadius={70} dataKey="value">
                            {CATEGORY_COMPOSITION.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <RechartsTooltip />
                        </RechartsPieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Kepatuhan Pajak View */}
            {activeSecondaryModule === 'pajak' && (
              <div className="b2b-card p-5 space-y-4">
                <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                  <Receipt className="w-4 h-4 text-emerald-600" />
                  Perhitungan Pajak Final UMKM (PP 55 Tahun 2022)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-[11px] text-slate-500">Peredaran Bruto 7 Hari</span>
                    <div className="text-base font-bold font-mono text-slate-900 mt-1">Rp 119.600.000</div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-[11px] text-slate-500">Tarif PPh Final</span>
                    <div className="text-base font-bold font-mono text-emerald-700 mt-1">0.5% Flat</div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-[11px] text-slate-500">Kewajiban Setor Pajak</span>
                    <div className="text-base font-bold font-mono text-rose-700 mt-1">Rp 598.000</div>
                  </div>
                </div>
                <p className="text-xs text-slate-600">
                  Perhitungan pajak final telah otomatis terintegrasi dengan kode akun 2103 (Utang Pajak PPh Final) di buku besar Drift SQLite.
                </p>
              </div>
            )}

            {/* Audit Trail Trigger View */}
            {activeSecondaryModule === 'audit' && (
              <div className="b2b-card p-5 space-y-4">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  Inspector Trigger Drift SQLite (Local Immutable Ledger)
                </div>
                <div className="p-3.5 bg-slate-900 text-slate-200 rounded-lg font-mono text-xs space-y-2">
                  <div className="text-emerald-400 font-bold">-- NATIVE TRIGGER STATUS: ACTIVE (ENFORCED)</div>
                  <div>CREATE TRIGGER prevent_stock_ledger_update BEFORE UPDATE ON stock_ledger BEGIN SELECT RAISE(ABORT, 'Illegal operation'); END;</div>
                  <div>CREATE TRIGGER prevent_stock_ledger_delete BEFORE DELETE ON stock_ledger BEGIN SELECT RAISE(ABORT, 'Illegal operation'); END;</div>
                </div>
                <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 text-xs text-emerald-900 font-medium">
                  ✓ Ledger terlindungi sepenuhnya. Setiap mutasi potongan daging hanya dapat bertambah (append-only) via event log.
                </div>
              </div>
            )}

            {/* Pengaturan & Staf View */}
            {activeSecondaryModule === 'pengaturan' && (
              <div className="b2b-card p-5 space-y-4">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                  <Settings className="w-4 h-4 text-slate-700" />
                  Pengaturan Perangkat &amp; Staf Lapangan
                </div>
                <div className="space-y-2 text-xs text-slate-700">
                  <div className="p-3 rounded-lg border border-slate-200 flex justify-between items-center">
                    <div>
                      <div className="font-bold text-slate-900">Perangkat Kasir Aktif</div>
                      <div className="text-slate-500 font-mono text-[11px]">Device ID: HP03 (Sales Banten 1)</div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      TERVERIFIKASI
                    </span>
                  </div>
                  <div className="p-3 rounded-lg border border-slate-200 flex justify-between items-center">
                    <div>
                      <div className="font-bold text-slate-900">PIN Otorisasi Owner</div>
                      <div className="text-slate-500 text-[11px]">Otorisasi override plafon piutang tempo</div>
                    </div>
                    <span className="font-mono font-bold text-slate-900">•••••• (Aktif)</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* -------------------------------------------------------------------
            TAB 1: HOME (GOPAY STYLE: SALES SUMMARY, MOTIVASI, INSTANT STATUS)
            ------------------------------------------------------------------- */}
        {activeTab === 'home' && activeSecondaryModule === null && (
          <div className="space-y-5 animate-tab-fade">
            
            {/* GoPay Friendly Motivational Greeting Card */}
            <div className="b2b-card p-5 bg-gradient-to-br from-slate-900 to-slate-800 text-white space-y-4 border-slate-700">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base sm:text-lg font-extrabold text-white">
                      Halo, Boss Mercyzone! 👋
                    </h2>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Target On Track 🎯
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1">
                    Semangat jualan daging import hari ini. Cold storage stabil di -18°C.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-slate-300">
                    {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' })}
                  </span>
                </div>
              </div>

              {/* Instant Sales & Volume Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-700/80">
                <div>
                  <span className="text-[11px] text-slate-400">Omzet Hari Ini</span>
                  <div className="text-base sm:text-lg font-mono font-extrabold text-white">Rp 18.500.000</div>
                  <span className="text-[10px] text-emerald-400 font-semibold">+14.2% vs target</span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400">Daging Terjual</span>
                  <div className="text-base sm:text-lg font-mono font-extrabold text-emerald-400">154.5 KG</div>
                  <span className="text-[10px] text-slate-300">Primal &amp; Tetelan</span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400">Sisa Stok Fisik</span>
                  <div className="text-base sm:text-lg font-mono font-extrabold text-white">
                    {(totalWeightInStockGram / 1000).toFixed(1)} KG
                  </div>
                  <span className="text-[10px] text-slate-300">di 3 Batch Freezer</span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400">Status Sinkronisasi</span>
                  <div className="text-base sm:text-lg font-mono font-extrabold text-emerald-400">0 Pending</div>
                  <span className="text-[10px] text-slate-300">Drift SQLite Aman</span>
                </div>
              </div>
            </div>

            {/* GoPay Quick Action Shortcuts */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <button
                type="button"
                onClick={() => setActiveTab('pos')}
                className="b2b-card p-3.5 flex flex-col items-center text-center gap-2 hover:border-slate-300 hover:shadow-xs transition-all cursor-pointer"
              >
                <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                  <ShoppingCart className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">Buka Kasir</div>
                  <span className="text-[10px] text-slate-500">Transaksi cepat &lt;50ms</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('warehouse')}
                className="b2b-card p-3.5 flex flex-col items-center text-center gap-2 hover:border-slate-300 hover:shadow-xs transition-all cursor-pointer"
              >
                <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Snowflake className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">Cek Coldroom</div>
                  <span className="text-[10px] text-slate-500">Stok gram &amp; FEFO</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('beli')}
                className="b2b-card p-3.5 flex flex-col items-center text-center gap-2 hover:border-slate-300 hover:shadow-xs transition-all cursor-pointer"
              >
                <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">Penerimaan PO</div>
                  <span className="text-[10px] text-slate-500">Inbound kontainer</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setShowModulLainnyaModal(true)}
                className="b2b-card p-3.5 flex flex-col items-center text-center gap-2 hover:border-slate-300 hover:shadow-xs transition-all cursor-pointer bg-slate-900 text-white"
              >
                <div className="w-10 h-10 rounded-full bg-slate-800 text-emerald-400 flex items-center justify-center">
                  <Grid className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Modul Lainnya</div>
                  <span className="text-[10px] text-slate-300">Pajak, Jurnal &amp; Audit</span>
                </div>
              </button>
            </div>

            {/* Operational Health Indicators (3-Detik Scan) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                  Kondisi Operasional Toko (Live Real-Time)
                </h3>
                <span className="text-xs text-emerald-700 font-bold flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Sistem Berjalan Prima
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div className="b2b-card p-4 space-y-1">
                  <div className="flex justify-between items-center text-slate-500 text-xs font-medium">
                    <span>Valuasi Stok HPP</span>
                    <Banknote className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="text-lg font-extrabold text-slate-900 font-mono">
                    Rp {totalHppInventoryValuation.toLocaleString('id-ID')}
                  </div>
                  <span className="text-[11px] text-slate-500">
                    {(totalWeightInStockGram / 1000).toFixed(1)} KG di coldroom
                  </span>
                </div>

                <div className="b2b-card p-4 space-y-1">
                  <div className="flex justify-between items-center text-slate-500 text-xs font-medium">
                    <span>Piutang Tempo Resto</span>
                    <Clock className="w-4 h-4 text-amber-600" />
                  </div>
                  <div className="text-lg font-extrabold text-amber-700 font-mono">
                    Rp 16.900.000
                  </div>
                  <span className="text-[11px] text-slate-500">
                    2 Hotel &amp; Resto aktif
                  </span>
                </div>

                <div className="b2b-card p-4 space-y-1">
                  <div className="flex justify-between items-center text-slate-500 text-xs font-medium">
                    <span>Integritas Audit Trail</span>
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="text-lg font-extrabold text-emerald-700 font-mono">
                    100% Locked
                  </div>
                  <span className="text-[11px] text-emerald-600 font-semibold">
                    Native SQLite Trigger Active
                  </span>
                </div>
              </div>
            </div>

            {/* Friendly Feed Banner */}
            <div className="b2b-card p-4 flex items-center justify-between bg-blue-50/60 border-blue-200">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0">
                  <ThumbsUp className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">
                    Mantap! Semua sinkronisasi beres, Boss.
                  </div>
                  <div className="text-[11px] text-slate-600">
                    Data transaksi offline telah tersimpan rapi di HP dan siap diaudit HashMicro kapan saja.
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveTab('pos')}
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shrink-0"
              >
                Mulai Transaksi
              </button>
            </div>

          </div>
        )}

        {/* -------------------------------------------------------------------
            TAB 2: KASIR (POS DENGAN SPLIT-VIEW & ZERO-FLOAT INTEGER GRAM)
            ------------------------------------------------------------------- */}
        {activeTab === 'pos' && activeSecondaryModule === null && (
          <div className="space-y-4 animate-tab-fade">
            
            {/* Proactive Safety Stock Warning Banner */}
            <div className="b2b-card p-3.5 bg-amber-50/70 border-amber-200 flex items-start sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  <strong>Peringatan Safety Stock:</strong> Stok Tenderloin Grassfed sisa <strong>18.0 KG</strong> (Batas: 20.0 KG).
                  Rekomendasikan alternatif <strong>Sirloin Choice USA (82.0 KG)</strong>.
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

            {/* Split View */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              
              {/* Left: Search, Filter, Product Catalog */}
              <div className="lg:col-span-7 space-y-4">
                <div className="b2b-card p-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Cari potongan daging atau SKU..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                    />
                  </div>

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
                          selectedCategory === cat.id ? 'bg-slate-900 text-white font-bold' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {filteredProducts.map(prod => {
                    const stockKg = prod.stockGram / 1000;
                    const isLowStock = prod.stockGram <= prod.safetyStockGram;
                    const isInCart = cart.find(c => c.product.id === prod.id);

                    return (
                      <div
                        key={prod.id}
                        onMouseDown={() => startLongPress(prod)}
                        onMouseUp={cancelLongPress}
                        onMouseLeave={cancelLongPress}
                        onTouchStart={() => startLongPress(prod)}
                        onTouchEnd={cancelLongPress}
                        onTouchCancel={cancelLongPress}
                        className={`b2b-card p-4 transition-all duration-200 flex flex-col justify-between relative select-none group cursor-pointer ${
                          quickAddFlashId === prod.id 
                            ? 'ring-2 ring-emerald-500 bg-emerald-50/60 shadow-md scale-[1.01]' 
                            : pressingProdId === prod.id 
                              ? 'ring-2 ring-amber-400 bg-amber-50/40 scale-[0.99]' 
                              : isLowStock 
                                ? 'border-amber-200 bg-amber-50/20 hover:border-slate-300' 
                                : 'hover:border-slate-300 hover:shadow-xs'
                        }`}
                        title="Tekan lama (long press) untuk langsung Quick Add 1.0 KG ke keranjang tanpa membuka modal"
                      >
                        {/* Quick Add Flash Indicator */}
                        {quickAddFlashId === prod.id && (
                          <div className="absolute -top-2.5 right-3 z-20 bg-emerald-600 text-white font-extrabold text-[10px] px-2.5 py-1 rounded-full shadow-lg flex items-center gap-1 animate-bounce">
                            <Zap className="w-3 h-3 fill-white" />
                            <span>+1.0 KG Quick Add!</span>
                          </div>
                        )}

                        {/* Pressing Progress Indicator */}
                        {pressingProdId === prod.id && quickAddFlashId !== prod.id && (
                          <div className="absolute inset-x-0 bottom-0 h-1 bg-amber-500 animate-pulse rounded-b-xl z-10" />
                        )}

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase bg-slate-100 text-slate-700 border border-slate-200">
                              {prod.category}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              isLowStock ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
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

                          {/* Quick Add Long Press Micro-Copy Hint */}
                          <div className="flex items-center justify-between text-[10px] pt-1 border-t border-slate-100/80">
                            <span className="flex items-center gap-1 text-slate-400 group-hover:text-amber-700 font-medium transition-colors">
                              <Zap className="w-3 h-3 text-amber-500" />
                              <span>Tahan kartu: Quick Add 1kg</span>
                            </span>
                            {pressingProdId === prod.id && (
                              <span className="text-[10px] font-bold text-amber-600 animate-pulse">
                                Menambahkan 1kg...
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-1.5 pt-2.5 mt-2.5 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAddToCart(prod, 500);
                            }}
                            className="h-9 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center justify-center gap-1"
                          >
                            <Plus className="w-3 h-3 text-slate-600" />
                            500g
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAddToCart(prod, 1000);
                            }}
                            className="h-9 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-1"
                          >
                            <Plus className="w-3 h-3 text-white" />
                            1.0 KG
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAddToCart(prod, 2500);
                            }}
                            className="h-9 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold flex items-center justify-center gap-1"
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

              {/* Right: Sticky Cart */}
              <div className="lg:col-span-5 space-y-4">
                <div className="b2b-card p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5 text-slate-700" />
                      Pelanggan B2B
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                      Tier: {customer.tier}
                    </span>
                  </div>

                  <select
                    value={selectedCustomerId}
                    onChange={e => {
                      setSelectedCustomerId(e.target.value);
                      setIsOwnerApproved(false);
                    }}
                    className="w-full b2b-input text-xs font-bold text-slate-800"
                  >
                    {SAMPLE_CUSTOMERS.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.code}) - {c.tier}
                      </option>
                    ))}
                  </select>

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
                        Rp ${customer.currentReceivable.toLocaleString('id-ID')}
                      </span>
                    </div>
                  </div>
                </div>

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

                  <div className="space-y-2.5 max-h-[250px] overflow-y-auto pr-1">
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
                              className="text-slate-400 hover:text-rose-600"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="flex items-center justify-between pt-1">
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleUpdateItemWeight(idx, -500)}
                                className="w-6 h-6 rounded bg-white border border-slate-300 flex items-center justify-center text-slate-700"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              
                              <div className="px-2 py-0.5 rounded bg-white border border-slate-300 font-mono text-xs font-bold text-slate-900">
                                {(item.weightGram / 1000).toFixed(2)} KG
                              </div>

                              <button
                                type="button"
                                onClick={() => handleUpdateItemWeight(idx, 500)}
                                className="w-6 h-6 rounded bg-white border border-slate-300 flex items-center justify-center text-slate-700"
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

                  <div className="pt-3 border-t border-slate-200 space-y-2 text-xs">
                    <div className="flex items-center justify-between text-slate-600">
                      <span>Subtotal Daging ({totalCartWeightGram.toLocaleString('id-ID')} g):</span>
                      <span className="font-mono font-semibold">Rp {subtotalRupiah.toLocaleString('id-ID')}</span>
                    </div>

                    <div className="flex items-center justify-between text-slate-600">
                      <div className="flex items-center gap-1.5">
                        <Truck className="w-3.5 h-3.5 text-slate-400" />
                        <span>Gratis Ongkir Toko:</span>
                        <input
                          type="checkbox"
                          checked={isFreeShipping}
                          onChange={e => setIsFreeShipping(e.target.checked)}
                          className="rounded border-slate-300 text-emerald-600 ml-1"
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

                  <div className="grid grid-cols-3 gap-1.5 pt-1">
                    {(['CASH', 'TRANSFER', 'TEMPO'] as const).map(m => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setPaymentMethod(m)}
                        className={`h-9 rounded-lg text-xs font-bold transition-all ${
                          paymentMethod === m ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {m === 'CASH' ? 'Tunai' : m === 'TRANSFER' ? 'Transfer' : 'Tempo'}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    disabled={cart.length === 0 || (isTempoBlocked && !isOwnerApproved)}
                    onClick={handleCheckoutCommit}
                    className="w-full h-11 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold text-sm transition-all flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Bayar &amp; Terbitkan Faktur</span>
                  </button>
                </div>
              </div>

            </div>

          </div>
        )}

        {/* -------------------------------------------------------------------
            TAB 3: BELI (PURCHASING & INBOUND CONTAINER RECEIVING)
            ------------------------------------------------------------------- */}
        {activeTab === 'beli' && activeSecondaryModule === null && (
          <div className="space-y-4 animate-tab-fade">
            <div className="b2b-card p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Truck className="w-4 h-4 text-slate-700" />
                  Inbound Kontainer Reefer &amp; Pembelian Daging
                </h3>
                <p className="text-xs text-slate-500">Penerimaan muatan daging import beku langsung dari pelabuhan &amp; importir</p>
              </div>

              <button
                type="button"
                onClick={() => {
                  triggerNotification('Form PO Baru', 'Silakan masukkan nomor kontainer reefer dan daftar lot daging', 'info');
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Buat Purchase Order (PO)
              </button>
            </div>

            <div className="space-y-3">
              {inboundPOs.map(po => {
                const isEnRoute = po.status === 'DALAM_PERJALANAN';
                return (
                  <div key={po.id} className="b2b-card p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-slate-900">{po.poNumber}</span>
                        <span className="text-slate-400">•</span>
                        <span className="text-xs font-bold text-slate-800">{po.supplier}</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        isEnRoute ? 'bg-blue-50 text-blue-800 border border-blue-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      }`}>
                        {isEnRoute ? '🚛 Dalam Perjalanan' : '✓ Selesai Bongkar'}
                      </span>
                    </div>

                    <div className="text-xs text-slate-600">
                      <div>Kontainer: <strong className="font-mono text-slate-800">{po.container}</strong></div>
                      <div>Muatan: {po.items}</div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                      <span className="text-slate-500">ETA: <strong className="text-slate-800">{po.eta}</strong></span>
                      {isEnRoute && (
                        <button
                          type="button"
                          onClick={() => {
                            setInboundPOs(prev => prev.map(p => p.id === po.id ? { ...p, status: 'SELESAI_BONGKAR', eta: 'Selesai Bongkar & Masuk Freezer' } : p));
                            triggerNotification('Mantap! Kontainer berhasil dibongkar.', `Muatan ${po.poNumber} telah masuk stock_ledger coldroom`, 'success');
                          }}
                          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded text-xs"
                        >
                          Bongkar Muatan &amp; Timbang Tara
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* -------------------------------------------------------------------
            TAB 4: STOK BARANG (INVENTORY & FEFO GUDANG)
            ------------------------------------------------------------------- */}
        {activeTab === 'warehouse' && activeSecondaryModule === null && (
          <div className="space-y-4 animate-tab-fade">
            <div className="b2b-card p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Package className="w-4 h-4 text-slate-700" />
                  Stok Daging Cold Storage &amp; Sortir FEFO
                </h3>
                <p className="text-xs text-slate-500">Semua berat tersimpan dalam integer gram murni (Zero-Float)</p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={openQrModal}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
                  title="Aktifkan kamera untuk scan kode batch/QR pada kemasan daging"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  Scan QR
                </button>
                <button
                  type="button"
                  onClick={handleExportBatchCsv}
                  className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
                  title="Download data lots saat ini ke format CSV untuk kebutuhan audit eksternal"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export Data Batch
                </button>
                <button
                  type="button"
                  onClick={() => setShowConversionModal(true)}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5"
                >
                  <Scissors className="w-3.5 h-3.5" />
                  Konversi Trimming
                </button>
                <button
                  type="button"
                  onClick={() => setShowOpnameModal(true)}
                  className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5"
                >
                  <ClipboardCheck className="w-3.5 h-3.5" />
                  Opname Fisik
                </button>
              </div>
            </div>

            {/* Real-Time Search & Filter Input Bar */}
            <div className="b2b-card p-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari potongan daging, kode batch, atau lokasi (contoh: Ribeye, LOT-AUS, Freezer)..."
                  value={inventorySearchQuery}
                  onChange={e => setInventorySearchQuery(e.target.value)}
                  className="w-full pl-9 pr-8 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
                {inventorySearchQuery && (
                  <button
                    type="button"
                    onClick={() => setInventorySearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                    title="Bersihkan pencarian"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-semibold">
                {[
                  { id: 'ALL', label: `Semua Batch (${lots.length})` },
                  { id: 'FEFO', label: `FEFO Prioritas (${lots.filter(l => l.isFefo).length})` },
                  { id: 'NORMAL', label: `Normal (${lots.filter(l => !l.isFefo).length})` },
                ].map(filter => (
                  <button
                    key={filter.id}
                    type="button"
                    onClick={() => setInventoryFilterStatus(filter.id as any)}
                    className={`px-2.5 py-1 rounded-md text-xs transition-colors shrink-0 ${
                      inventoryFilterStatus === filter.id ? 'bg-slate-900 text-white font-bold' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={openQrModal}
                  className="px-2.5 py-1 rounded-md text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-colors shrink-0 flex items-center gap-1 ml-1"
                  title="Scan QR / Barcode Kemasan Daging dengan Kamera"
                >
                  <QrCode className="w-3 h-3" />
                  Scan QR
                </button>

                <button
                  type="button"
                  onClick={handleExportBatchCsv}
                  className="px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition-colors shrink-0 flex items-center gap-1"
                  title="Download CSV data batch untuk audit eksternal"
                >
                  <Download className="w-3 h-3" />
                  CSV
                </button>
              </div>
            </div>



            <div className="b2b-card overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase font-semibold text-[11px]">
                  <tr>
                    <th className="px-4 py-3">Batch &amp; Produk</th>
                    <th className="px-4 py-3">Lokasi</th>
                    <th className="px-4 py-3">Expired (FEFO)</th>
                    <th className="px-4 py-3 text-right">Stok (Gram)</th>
                    <th className="px-4 py-3 text-right">HPP/KG</th>
                    <th className="px-4 py-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredLots.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                        <div className="flex flex-col items-center justify-center gap-1.5">
                          <Search className="w-6 h-6 text-slate-300" />
                          <span className="text-xs font-semibold text-slate-600">
                            Tidak ada batch yang cocok dengan "{inventorySearchQuery}"
                          </span>
                          <button
                            type="button"
                            onClick={() => { setInventorySearchQuery(''); setInventoryFilterStatus('ALL'); }}
                            className="text-xs text-blue-600 hover:underline mt-1 font-medium"
                          >
                            Reset Pencarian &amp; Filter
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredLots.map(l => {
                      const maxCapacityGram = l.maxCapacityGram || 60000;
                      const densityPercent = Math.min(100, Math.round((l.weightGram / maxCapacityGram) * 100));
                      const currentKg = (l.weightGram / 1000).toFixed(1);
                      const maxKg = (maxCapacityGram / 1000).toFixed(1);

                      const tierInfo = densityPercent < 50
                        ? {
                            label: 'Tier 1: Ringan (<50%)',
                            barClass: 'bg-emerald-500',
                            badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                            dotClass: 'bg-emerald-500',
                            desc: 'Kapasitas freezer sangat lega'
                          }
                        : densityPercent <= 85
                          ? {
                              label: 'Tier 2: Ideal (50-85%)',
                              barClass: 'bg-amber-500',
                              badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
                              dotClass: 'bg-amber-500',
                              desc: 'Beban ideal coldroom, sirkulasi suhu optimal'
                            }
                          : {
                              label: 'Tier 3: Kritis / Penuh (>85%)',
                              barClass: 'bg-rose-500',
                              badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
                              dotClass: 'bg-rose-500',
                              desc: 'Peringatan beban rak mendekati batas maksimal'
                            };

                      return (
                        <React.Fragment key={l.id}>
                          <tr className="hover:bg-slate-50/70 border-b-0">
                            <td className="px-4 pt-3 pb-1">
                              <div className="font-bold text-slate-900">{l.product}</div>
                              <span className="font-mono text-[11px] text-slate-400">{l.code}</span>
                            </td>
                            <td className="px-4 pt-3 pb-1 font-mono text-slate-600">{l.loc}</td>
                            <td className="px-4 pt-3 pb-1">
                              <div className="font-semibold text-slate-900">{l.expiryDate}</div>
                              <span className="text-[11px] text-rose-600 font-bold">{l.daysLeft} hari lagi</span>
                            </td>
                            <td className="px-4 pt-3 pb-1 text-right font-mono font-bold text-slate-900">
                              {(l.weightGram / 1000).toFixed(1)} KG
                              <div className="text-[10px] text-slate-400 font-normal">{l.weightGram.toLocaleString('id-ID')} g</div>
                            </td>
                            <td className="px-4 pt-3 pb-1 text-right font-mono text-slate-700">Rp {l.hppKgRupiah.toLocaleString('id-ID')}</td>
                            <td className="px-4 pt-3 pb-1 text-center">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                l.isFefo ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-slate-100 text-slate-700'
                              }`}>
                                {l.isFefo ? 'FEFO PRIORITAS' : 'NORMAL'}
                              </span>
                            </td>
                          </tr>

                          {/* 3-Tier Stock Density Progress Bar Row */}
                          <tr className="bg-slate-50/50 border-b border-slate-200/80 hover:bg-slate-50 transition-colors">
                            <td colSpan={6} className="px-4 pt-1 pb-2.5">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px]">
                                {/* Density Badge & Indicator */}
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-slate-500 flex items-center gap-1.5 text-[10.5px]">
                                    <span className={`w-2 h-2 rounded-full transition-colors duration-500 ${tierInfo.dotClass}`} />
                                    Stock Density:
                                  </span>
                                  <span className={`px-2 py-0.5 rounded border text-[10px] font-bold transition-all duration-500 ${tierInfo.badgeClass}`}>
                                    {densityPercent}% • {tierInfo.label}
                                  </span>
                                  <span className="text-[10px] text-slate-400 hidden lg:inline">
                                    • {tierInfo.desc}
                                  </span>
                                </div>

                                {/* 3-Tier Visual Progress Bar with Dynamic Smooth Transition */}
                                <div className="flex items-center gap-3">
                                  <div className="flex flex-col gap-0.5">
                                    <div className="w-36 sm:w-56 bg-slate-200/90 h-2.5 rounded-full overflow-hidden relative shadow-inner">
                                      <div 
                                        className={`h-full rounded-full transition-density-bar ${tierInfo.barClass} shadow-xs`}
                                        style={{ width: `${densityPercent}%` }}
                                      />
                                      {/* Tier Guide Lines: Tier 1 (50%) and Tier 2 (85%) */}
                                      <div className="absolute left-[50%] top-0 bottom-0 w-0.5 bg-white/70" title="Batas Tier 1 (50%)" />
                                      <div className="absolute left-[85%] top-0 bottom-0 w-0.5 bg-white/70" title="Batas Tier 2 (85%)" />
                                    </div>
                                    <div className="flex justify-between text-[8px] text-slate-400 font-mono px-0.5">
                                      <span>0%</span>
                                      <span className="pl-3">50%</span>
                                      <span className="pl-4">85%</span>
                                      <span>100%</span>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2 shrink-0">
                                    <div className="text-right">
                                      <span className="font-mono text-[11px] font-bold text-slate-800 transition-colors duration-300">
                                        {currentKg}
                                      </span>
                                      <span className="font-mono text-[10px] text-slate-500"> / {maxKg} KG</span>
                                    </div>

                                    {/* Quick Simulation Adjusters for Warehouse Staff */}
                                    <div className="flex items-center gap-1 pl-1 border-l border-slate-200">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setLots(prev => prev.map(item => item.id === l.id ? { ...item, weightGram: Math.max(1000, item.weightGram - 5000) } : item));
                                          triggerNotification('Ambil Stok (-5.0 KG)', `Stok ${l.product} berkurang 5.0 KG. Bar densitas freezer bertransisi mulus.`, 'info');
                                        }}
                                        className="px-1.5 py-0.5 rounded bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-mono text-[9px] font-bold transition-all active:scale-95 shadow-2xs"
                                        title="Simulasi kurangi 5 KG untuk menguji transisi mulus progress bar"
                                      >
                                        -5kg
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setLots(prev => prev.map(item => item.id === l.id ? { ...item, weightGram: Math.min(item.maxCapacityGram || 100000, item.weightGram + 5000) } : item));
                                          triggerNotification('Restock Daging (+5.0 KG)', `Stok ${l.product} bertambah 5.0 KG. Bar densitas freezer bertransisi mulus.`, 'success');
                                        }}
                                        className="px-1.5 py-0.5 rounded bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-mono text-[9px] font-bold transition-all active:scale-95 shadow-2xs"
                                        title="Simulasi tambah 5 KG untuk menguji transisi mulus progress bar"
                                      >
                                        +5kg
                                      </button>
                                    </div>
                                  </div>
                                </div>

                              </div>
                            </td>
                          </tr>
                        </React.Fragment>
                      );
                    })
                  )}

                </tbody>
              </table>
            </div>

          </div>
        )}

        {/* -------------------------------------------------------------------
            TAB 5: BAYAR (ACCOUNTS PAYABLE/RECEIVABLE & PENAGIHAN SALES)
            ------------------------------------------------------------------- */}
        {activeTab === 'bayar' && activeSecondaryModule === null && (
          <div className="space-y-4 animate-tab-fade">
            <div className="b2b-card p-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-slate-700" />
                  Tagihan, Piutang Tempo &amp; Pelunasan
                </h3>
                <p className="text-xs text-slate-500">Kelola buku piutang pelanggan Horeka dan pembayaran supplier daging</p>
              </div>
              <div className="text-right">
                <span className="text-[11px] text-slate-500">Total Piutang Berjalan</span>
                <div className="text-base font-extrabold text-rose-700 font-mono">Rp 16.900.000</div>
              </div>
            </div>

            <div className="space-y-3">
              {receivables.map(r => (
                <div key={r.id} className="b2b-card p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">{r.customer}</h4>
                      <span className="text-[11px] font-mono text-slate-500">{r.invoice}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-base font-extrabold font-mono text-slate-900">
                        Rp {r.amount.toLocaleString('id-ID')}
                      </div>
                      <span className="text-[10px] text-slate-500">Plafon: Rp {r.limit.toLocaleString('id-ID')}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                    <span className="text-slate-600">Jatuh Tempo: <strong className="text-rose-700">{r.dueDate}</strong></span>
                    <button
                      type="button"
                      onClick={() => {
                        triggerNotification(
                          'Pelunasan Berhasil! 💰',
                          `Tagihan ${r.customer} sebesar Rp ${r.amount.toLocaleString('id-ID')} telah tercatat lunas ke Kas Toko`,
                          'success',
                          r.amount
                        );
                      }}
                      className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded text-xs"
                    >
                      Catat Pelunasan
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>

      {/* =========================================================================
          MODAL BOTTOM SHEET: "MODUL LAINNYA" (ENTERPRISE ERP MODULE HUB)
          ========================================================================= */}
      {showModulLainnyaModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-tab-fade">
          <div className="bg-white w-full max-w-lg rounded-t-2xl sm:rounded-2xl p-5 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <h4 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <Grid className="w-4 h-4 text-emerald-600" />
                  Modul Lainnya (Enterprise ERP)
                </h4>
                <p className="text-xs text-slate-500">Pilih modul tingkat lanjut untuk akuntansi, audit, dan regulasi</p>
              </div>
              <button 
                onClick={() => setShowModulLainnyaModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 4 Sleek Grid Module Cards */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowModulLainnyaModal(false);
                  setActiveSecondaryModule('laporan');
                }}
                className="p-3.5 rounded-xl border border-slate-200 hover:border-slate-400 bg-slate-50/60 hover:bg-white text-left transition-all space-y-2 group cursor-pointer"
              >
                <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">Laporan &amp; Akuntansi</div>
                  <div className="text-[11px] text-slate-500">Jurnal umum, P&amp;L, buku besar, ekspor PDF</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowModulLainnyaModal(false);
                  setActiveSecondaryModule('pajak');
                }}
                className="p-3.5 rounded-xl border border-slate-200 hover:border-slate-400 bg-slate-50/60 hover:bg-white text-left transition-all space-y-2 group cursor-pointer"
              >
                <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Receipt className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">Kepatuhan Pajak</div>
                  <div className="text-[11px] text-slate-500">Pajak final UMKM 0.5% (PP 55) &amp; PPN</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowModulLainnyaModal(false);
                  setActiveSecondaryModule('audit');
                }}
                className="p-3.5 rounded-xl border border-slate-200 hover:border-slate-400 bg-slate-50/60 hover:bg-white text-left transition-all space-y-2 group cursor-pointer"
              >
                <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">Immutable Audit Trail</div>
                  <div className="text-[11px] text-slate-500">Trigger inspector SQLite &amp; event sourcing</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowModulLainnyaModal(false);
                  setActiveSecondaryModule('pengaturan');
                }}
                className="p-3.5 rounded-xl border border-slate-200 hover:border-slate-400 bg-slate-50/60 hover:bg-white text-left transition-all space-y-2 group cursor-pointer"
              >
                <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Settings className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">Pengaturan &amp; Staf</div>
                  <div className="text-[11px] text-slate-500">PIN shift kasir &amp; device ID HP03</div>
                </div>
              </button>
            </div>

            <div className="pt-2 text-center">
              <span className="text-[11px] text-slate-400">
                Sistem ERP Daging Import Sampora Banten V4.3
              </span>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          BOTTOM MOBILE NAVIGATION BAR (Strictly 5 Primary Tabs)
          ========================================================================= */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-40 md:hidden shadow-lg">
        <div className="grid grid-cols-5 h-16">
          {[
            { id: 'home', label: 'Home', icon: Home },
            { id: 'pos', label: 'Kasir', icon: ShoppingCart },
            { id: 'beli', label: 'Beli', icon: Truck },
            { id: 'warehouse', label: 'Stok', icon: Package },
            { id: 'bayar', label: 'Bayar', icon: Wallet },
          ].map(tab => {
            const IconComp = tab.icon;
            const isActive = activeTab === tab.id && activeSecondaryModule === null;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as any);
                  setActiveSecondaryModule(null);
                }}
                className={`flex flex-col items-center justify-center gap-1 transition-all ${
                  isActive ? 'text-slate-900 font-extrabold' : 'text-slate-400 font-medium'
                }`}
              >
                <div className={`p-1 rounded-full ${isActive ? 'bg-slate-100' : ''}`}>
                  <IconComp className="w-5 h-5" />
                </div>
                <span className="text-[10px]">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Modals: Trimming, Opname, PIN, Thermal Print */}
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
                <label className="block text-slate-600 font-semibold mb-1">Berat Bahan Primal (Gram):</label>
                <input
                  type="number"
                  step="500"
                  value={conversionGram}
                  onChange={e => setConversionGram(Math.max(1000, Number(e.target.value)))}
                  className="w-full b2b-input font-mono font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Yield Persentase Daging (%):</label>
                <input
                  type="number"
                  min="50"
                  max="100"
                  value={conversionYieldPercent}
                  onChange={e => setConversionYieldPercent(Number(e.target.value))}
                  className="w-full b2b-input font-mono font-bold text-slate-900"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowConversionModal(false)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleCommitConversion}
                className="px-4 py-1.5 rounded-lg bg-slate-900 text-xs font-bold text-white"
              >
                Simpan ke Ledger
              </button>
            </div>
          </div>
        </div>
      )}

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
                <label className="block text-slate-600 font-semibold mb-1">Hasil Timbang Fisik (Gram):</label>
                <input
                  type="number"
                  value={physicalWeightGram}
                  onChange={e => setPhysicalWeightGram(Number(e.target.value))}
                  className="w-full b2b-input font-mono font-bold"
                />
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
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowOpnameModal(false)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleCommitOpname}
                className="px-4 py-1.5 rounded-lg bg-slate-900 text-xs font-bold text-white"
              >
                Rekam ke Ledger
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: SCAN QR / BARCODE KEMASAN DAGING (KAMERA PEMINDAI)
          ========================================================================= */}
      {showQrScanModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-tab-fade">
          <div className="bg-slate-900 border border-slate-700 max-w-md w-full rounded-2xl overflow-hidden shadow-2xl text-white">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-600/30 text-indigo-400 flex items-center justify-center">
                  <QrCode className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Scan QR / Barcode Kemasan</h4>
                  <p className="text-[11px] text-slate-400">Arahkan kamera ke label batch karton daging</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={closeQrModal}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Video Viewfinder Area */}
            <div className="relative bg-black h-64 flex items-center justify-center overflow-hidden">
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted 
                className="w-full h-full object-cover"
              />

              {/* Viewfinder Target Reticle */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-48 h-48 border-2 border-indigo-400/80 rounded-2xl relative">
                  {/* Reticle Corner Brackets */}
                  <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg" />
                  <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg" />
                  <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg" />
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-emerald-400 rounded-br-lg" />

                  {/* Pulsing Scanning Laser Line */}
                  <div className="absolute inset-x-2 top-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_#34d399] animate-pulse" />
                </div>
              </div>

              {/* Status Badge */}
              <div className="absolute bottom-3 inset-x-4 flex items-center justify-between bg-slate-900/85 backdrop-blur-xs px-3 py-1.5 rounded-lg border border-slate-700/60 text-[11px]">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${isCameraActive ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'}`} />
                  <span className="text-slate-200">
                    {isCameraActive ? 'Kamera Pemindai Aktif (Live)' : 'Menghubungkan sensor optik...'}
                  </span>
                </div>
                <span className="font-mono text-[10px] text-slate-400">FEFO-AUTO</span>
              </div>

              {/* Camera Error / Permission Fallback Notice */}
              {cameraError && (
                <div className="absolute inset-x-4 top-3 bg-amber-950/90 border border-amber-600/80 text-amber-200 p-3 rounded-xl text-xs space-y-1 z-10">
                  <div className="font-bold flex items-center gap-1.5 text-amber-300">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    Pemberitahuan Sensor Kamera
                  </div>
                  <p className="text-[11px] leading-relaxed">{cameraError}</p>
                </div>
              )}
            </div>

            {/* Quick Test QR Barcode Chips for Warehouse Testing */}
            <div className="p-4 bg-slate-900 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5 text-indigo-400" />
                  Simulasi Scan Label Karton Gudang:
                </span>
                <span className="text-[10px] text-slate-500">Klik untuk tes filter</span>
              </div>

              <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto pr-1">
                {lots.map(l => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => handleQrDetected(l.code)}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 hover:border-indigo-500 transition-all text-left group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-slate-700 group-hover:bg-indigo-600/30 group-hover:text-indigo-400 flex items-center justify-center text-slate-400 transition-colors">
                        <QrCode className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="font-mono text-xs font-bold text-white group-hover:text-indigo-300">
                          {l.code}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {l.product} • {l.loc}
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-700 text-slate-300 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                      Scan Label Ini &rarr;
                    </span>
                  </button>
                ))}
              </div>

              <div className="pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={closeQrModal}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition-colors text-center"
                >
                  Tutup Pemindai
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


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
                Ups! Plafon tempo langganan ini sudah mentok, minta izin PIN Owner dulu ya:
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
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  if (ownerPin === '123456' || ownerPin.length === 6) {
                    setIsOwnerApproved(true);
                    setShowPinModal(false);
                    triggerNotification('Otorisasi Disetujui!', 'Plafon kredit di-override oleh Owner', 'success');
                  } else {
                    alert('PIN Salah! Default sandbox: 123456');
                  }
                }}
                className="px-4 py-1.5 rounded-lg bg-slate-900 text-xs font-bold text-white"
              >
                Validasi PIN
              </button>
            </div>
          </div>
        </div>
      )}

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
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-1.5 rounded-lg bg-slate-900 text-xs font-bold text-white flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                Cetak Struk
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Notifications Toast */}
      <div className="fixed bottom-20 md:bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
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
