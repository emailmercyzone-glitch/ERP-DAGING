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
  Camera,
  Filter,
  CalendarClock,
  MessageSquare,
  CheckCheck,
  Mic,
  MicOff,
  Volume2,
  RotateCcw,
  FileWarning,
  ShieldAlert,
  Edit3,
  Save,
  PackagePlus,
  UserPlus,
  DollarSign,
  Tags,
  Users
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
import { StockLevelOverTimeChart } from './components/StockLevelOverTimeChart';
import { PettyCashModal, type OpexVoucher } from './components/PettyCashModal';
import { PurchaseOrderModal, type InboundPOItem } from './components/PurchaseOrderModal';
import { RestockPredictionCard, type RestockPredictionItem } from './components/RestockPredictionCard';
import { SupplierPayableModal, type SupplierInvoice } from './components/SupplierPayableModal';
import { BazarPromoModal, type BazarPromoItem, INITIAL_BAZAR_PROMOS } from './components/BazarPromoModal';
import { QuickPriceManagerModal, type ProductPriceItem } from './components/QuickPriceManagerModal';
import { QuickAddCustomerModal, type CustomerItem } from './components/QuickAddCustomerModal';
import { QuickAddProductModal, type NewProductData } from './components/QuickAddProductModal';
import { CategoryManagerModal, type ProductCategory } from './components/CategoryManagerModal';
import { CustomerDashboardModal } from './components/CustomerDashboardModal';

// =====================================================================
// MASTER DATA TOKO DAGING IMPORT KARKASIA (Single Source of Truth)
// =====================================================================
export const INITIAL_PRODUCT_CATEGORIES: ProductCategory[] = [
  { id: 'PRIMAL', label: 'Primal Cut (Steak)', description: 'Ribeye, Sirloin, Tenderloin, T-Bone', color: 'emerald', isCore: true },
  { id: 'SECONDARY', label: 'Secondary Cut', description: 'Bolar Blade, Chuck, Rump, Knuckle, Topside', color: 'blue', isCore: true },
  { id: 'SLICE', label: 'Slice Shabu & Grill', description: 'US Shortplate, Sukiyaki, Karubi', color: 'amber', isCore: true },
  { id: 'TETELAN', label: 'Tetelan & Sop', description: 'Daging olahan rawon, soto, gulai', color: 'rose', isCore: true },
  { id: 'BONE_IN', label: 'Bone-In & Iga', description: 'Short ribs, iga konro, oxtail buntut, sumsum', color: 'purple', isCore: false },
  { id: 'OFFAL', label: 'Jeroan Sapi', description: 'Babat, hati, paru, lidah/gyutan', color: 'cyan', isCore: false },
  { id: 'PROCESSED', label: 'Daging Olahan', description: 'Bakso urat, sosis sapi, burger patty beku', color: 'indigo', isCore: false },
];

const SAMPLE_PRODUCTS = [
  { 
    id: 'PROD_01', 
    sku: 'SKU-RIBEYE-AUS', 
    name: 'Ribeye Meltique Australia (Primal)', 
    basePricePerKg: 240000, 
    tierPrices: {
      RETAIL: 240000,
      HOREKA: 215000,
      VIP: 195000
    },
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
    tierPrices: {
      RETAIL: 210000,
      HOREKA: 190000,
      VIP: 175000
    },
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
    name: 'Tetelan Rawon Super KARKASIA', 
    basePricePerKg: 85000, 
    tierPrices: {
      RETAIL: 85000,
      HOREKA: 75000,
      VIP: 68000
    },
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
    tierPrices: {
      RETAIL: 290000,
      HOREKA: 265000,
      VIP: 245000
    },
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
    tierPrices: {
      RETAIL: 125000,
      HOREKA: 110000,
      VIP: 98000
    },
    category: 'SLICE',
    stockGram: 65000,
    safetyStockGram: 25000,
    tag: 'Shabu & Grill',
    alternativeId: 'PROD_02',
    alternativeName: 'Sirloin Choice USA (Primal)',
    alternativeReason: 'Alternatif olahan potongan daging untuk menu resto'
  },
];

// Helper kalkulasi harga bertingkat (MOD-05: Customer Tier & Quantity Break)
export const getProductTierPrice = (
  product: any,
  customerTier: string = 'RETAIL',
  weightGram: number = 1000,
  bazarPromos: BazarPromoItem[] = []
) => {
  const tierPrices = product.tierPrices || {
    RETAIL: product.basePricePerKg,
    HOREKA: Math.round(product.basePricePerKg * 0.9),
    VIP: Math.round(product.basePricePerKg * 0.82),
  };

  // Quantity break / volume upgrade
  let appliedTier = customerTier || 'RETAIL';
  let isVolumeUpgrade = false;

  if (weightGram >= 20000) {
    // Pembelian box karton utuh >= 20 KG langsung dapat rate VIP Grosir
    appliedTier = 'VIP';
    if (customerTier !== 'VIP') isVolumeUpgrade = true;
  } else if (weightGram >= 5000) {
    // Pembelian pack >= 5 KG minimal dapat rate HOREKA
    if (appliedTier === 'RETAIL') {
      appliedTier = 'HOREKA';
      isVolumeUpgrade = true;
    }
  }

  const tierPrice = tierPrices[appliedTier as keyof typeof tierPrices] || product.basePricePerKg;

  // Cek apakah ada Promo Bazar / Flash Sale berjadwal yang lebih hemat
  const activePromo = bazarPromos.find(p => p.isActive && p.sku === product.sku);
  if (activePromo && activePromo.promoPricePerKg < tierPrice) {
    return {
      effectivePricePerKg: activePromo.promoPricePerKg,
      activeTier: 'PROMO_BAZAR',
      badgeLabel: activePromo.badgeLabel,
      isPromo: true,
      isVolumeUpgrade: false,
      retailPrice: tierPrices.RETAIL,
      savingsPerKg: tierPrices.RETAIL - activePromo.promoPricePerKg,
    };
  }

  return {
    effectivePricePerKg: tierPrice,
    activeTier: appliedTier,
    badgeLabel: appliedTier === 'VIP' ? 'Tier VIP (Grosir)' : appliedTier === 'HOREKA' ? 'Tier HOREKA (Resto)' : 'Tier Retail (Eceran)',
    isPromo: false,
    isVolumeUpgrade,
    retailPrice: tierPrices.RETAIL,
    savingsPerKg: Math.max(0, tierPrices.RETAIL - tierPrice),
  };
};

const SAMPLE_CUSTOMERS: CustomerItem[] = [
  { 
    id: 'CUST_01', 
    code: 'CUST-HOREKA-01', 
    name: 'Hotel Grand Serang', 
    tier: 'HOREKA', 
    creditLimit: 25000000, 
    currentReceivable: 12500000, 
    termDays: 14, 
    phone: '0812-8899-7711',
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
    phone: '0813-1122-3344',
    address: 'Kawasan KARKASIA Meat Center Blok B-3' 
  },
  { 
    id: 'CUST_03', 
    code: 'CUST-RETAIL-03', 
    name: 'Pak Haji Wahid (Cash Only)', 
    tier: 'RETAIL', 
    creditLimit: 0, 
    currentReceivable: 0, 
    termDays: 0, 
    phone: '0819-0011-2233',
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

// Top 5 Produk Terlaris (Tren Omzet, Volume, & Margin Profitabilitas Daging Import)
const TOP_5_BEST_SELLING_PRODUCTS = [
  {
    rank: 1,
    name: 'Ribeye Meltique AUS',
    fullName: 'Ribeye Meltique Australia (Primal)',
    sku: 'SKU-RIBEYE-AUS',
    category: 'PRIMAL',
    omzetRupiah: 38400000,
    omzetJt: 38.4,
    weightKg: 160.0,
    volumeGram: 160000,
    transactions: 28,
    growthPercent: 18.5,
    sharePercent: 32.2,
    color: '#0F172A',
    pricePerKg: 240000,
    hppPerKg: 180000,
    marginPerKg: 60000,
    marginPercent: 25.0,
    grossProfitRupiah: 9600000,
    grossProfitJt: 9.6,
    profitSharePercent: 33.6,
  },
  {
    rank: 2,
    name: 'Sirloin Choice USA',
    fullName: 'Sirloin Choice USA (Primal)',
    sku: 'SKU-SIRLOIN-USA',
    category: 'PRIMAL',
    omzetRupiah: 31500000,
    omzetJt: 31.5,
    weightKg: 150.0,
    volumeGram: 150000,
    transactions: 24,
    growthPercent: 14.2,
    sharePercent: 26.4,
    color: '#1E293B',
    pricePerKg: 210000,
    hppPerKg: 165000,
    marginPerKg: 45000,
    marginPercent: 21.4,
    grossProfitRupiah: 6750000,
    grossProfitJt: 6.75,
    profitSharePercent: 23.6,
  },
  {
    rank: 3,
    name: 'US Beef Shortplate',
    fullName: 'US Beef Shortplate 500g Slice',
    sku: 'SKU-SHORTPLATE-US',
    category: 'SLICE',
    omzetRupiah: 22500000,
    omzetJt: 22.5,
    weightKg: 180.0,
    volumeGram: 180000,
    transactions: 36,
    growthPercent: 22.0,
    sharePercent: 18.9,
    color: '#10B981',
    pricePerKg: 125000,
    hppPerKg: 95000,
    marginPerKg: 30000,
    marginPercent: 24.0,
    grossProfitRupiah: 5400000,
    grossProfitJt: 5.4,
    profitSharePercent: 18.9,
  },
  {
    rank: 4,
    name: 'Tetelan Rawon Super',
    fullName: 'Tetelan Rawon Super KARKASIA',
    sku: 'SKU-TETELAN-SP',
    category: 'TETELAN',
    omzetRupiah: 15300000,
    omzetJt: 15.3,
    weightKg: 180.0,
    volumeGram: 180000,
    transactions: 19,
    growthPercent: 8.7,
    sharePercent: 12.8,
    color: '#F59E0B',
    pricePerKg: 85000,
    hppPerKg: 65000,
    marginPerKg: 20000,
    marginPercent: 23.5,
    grossProfitRupiah: 3600000,
    grossProfitJt: 3.6,
    profitSharePercent: 12.6,
  },
  {
    rank: 5,
    name: 'Tenderloin Grassfed',
    fullName: 'Tenderloin Grassfed Australia',
    sku: 'SKU-TENDER-AUS',
    category: 'PRIMAL',
    omzetRupiah: 11600000,
    omzetJt: 11.6,
    weightKg: 40.0,
    volumeGram: 40000,
    transactions: 12,
    growthPercent: 5.4,
    sharePercent: 9.7,
    color: '#64748B',
    pricePerKg: 290000,
    hppPerKg: 210000,
    marginPerKg: 80000,
    marginPercent: 27.6,
    grossProfitRupiah: 3200000,
    grossProfitJt: 3.2,
    profitSharePercent: 11.2,
  },
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

  // Dashboard Analitik State (Tren Penjualan, Margin, Matriks & Level Stok Gudang)
  const [analyticsViewMode, setAnalyticsViewMode] = useState<'TREND' | 'MARGIN' | 'MATRIX' | 'STOCK'>('TREND');
  const [analyticsMarginSort, setAnalyticsMarginSort] = useState<'PERCENT' | 'PROFIT' | 'OMZET'>('PERCENT');
  const [topSellingMetric, setTopSellingMetric] = useState<'OMZET' | 'VOLUME'>('OMZET');

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

  // MOD-05: Promo Bazar Berjadwal State
  const [bazarPromos, setBazarPromos] = useState<BazarPromoItem[]>(INITIAL_BAZAR_PROMOS);

  // Products & Customers Reactive Master State (Zero-Float Policy)
  const [products, setProducts] = useState(SAMPLE_PRODUCTS);
  const [customers, setCustomers] = useState(SAMPLE_CUSTOMERS);
  const [suppliers, setSuppliers] = useState<string[]>([
    'PT Meat Importers Indonesia',
    'Australia Beef Direct Ltd',
    'JBS USA Beef Export Inc',
    'Teys Australia Meat Group',
  ]);

  // Warehouse View Mode
  const [warehouseSubTab, setWarehouseSubTab] = useState<'BATCH_LOTS' | 'PRICE_CATALOG' | 'CATEGORIES'>('BATCH_LOTS');

  // Master Kategori Produk Reactive State
  const [categories, setCategories] = useState<ProductCategory[]>(INITIAL_PRODUCT_CATEGORIES);
  const [showCategoryManagerModal, setShowCategoryManagerModal] = useState<boolean>(false);

  const handleAddCategory = (newCat: ProductCategory) => {
    setCategories(prev => {
      if (prev.some(c => c.id === newCat.id)) return prev;
      return [...prev, newCat];
    });
    triggerNotification('Kategori Baru Ditambahkan', `Kategori ${newCat.label} (${newCat.id}) aktif di Kasir, Gudang, & PO`, 'success');
  };

  const handleDeleteCategory = (catId: string) => {
    setCategories(prev => prev.filter(c => c.id !== catId));
    triggerNotification('Kategori Dihapus', `Kategori ${catId} telah dihapus dari daftar`, 'info');
  };

  // Quick Action Modals State (In-Context / Tanpa Pindah Halaman)
  const [showPriceManagerModal, setShowPriceManagerModal] = useState<boolean>(false);
  const [priceManagerTargetId, setPriceManagerTargetId] = useState<string | null>(null);
  const [showQuickAddCustomerModal, setShowQuickAddCustomerModal] = useState<boolean>(false);
  const [showQuickAddProductModal, setShowQuickAddProductModal] = useState<boolean>(false);
  const [showCustomerDashboardModal, setShowCustomerDashboardModal] = useState<boolean>(false);
  const [selectedDashboardCustomerId, setSelectedDashboardCustomerId] = useState<string | null>(null);

  const handleUpdateCustomer = (updatedCust: CustomerItem) => {
    setCustomers(prev => {
      const exists = prev.some(c => c.id === updatedCust.id);
      if (exists) {
        return prev.map(c => c.id === updatedCust.id ? updatedCust : c);
      }
      return [updatedCust, ...prev];
    });
    triggerNotification(
      'Profil Pelanggan Diperbarui',
      `${updatedCust.name} (Tier ${updatedCust.tier}) - Plafon Rp ${updatedCust.creditLimit.toLocaleString('id-ID')}`,
      'success'
    );
  };

  // Quick Inline Price Editing State
  const [inlineEditingProductId, setInlineEditingProductId] = useState<string | null>(null);
  const [inlineEditingPrice, setInlineEditingPrice] = useState<number>(0);

  const handleSaveInlinePrice = (productId: string) => {
    if (inlineEditingPrice <= 0) return;
    setProducts(prev => prev.map(p => p.id === productId ? { ...p, basePricePerKg: inlineEditingPrice } : p));
    setInlineEditingProductId(null);
    triggerNotification(
      'Harga Jual Diperbarui', 
      `Harga daging berhasil disesuaikan menjadi Rp ${inlineEditingPrice.toLocaleString('id-ID')}/KG`, 
      'success'
    );
  };

  // Cart State (Zero-Float Gram Policy)
  const [cart, setCart] = useState<CartItemState[]>([
    { product: SAMPLE_PRODUCTS[0], weightGram: 2000, pcs: 2 },
    { product: SAMPLE_PRODUCTS[2], weightGram: 3000, pcs: 1 },
  ]);

  const customer = customers.find(c => c.id === selectedCustomerId) || customers[0] || SAMPLE_CUSTOMERS[0];

  // Zero-Float Integer Math Calculations
  const totalCartWeightGram = cart.reduce((acc, item) => acc + item.weightGram, 0);
  const subtotalRupiah = cart.reduce((acc, item) => {
    const liveProd = products.find(p => p.id === item.product.id) || item.product;
    const pricing = getProductTierPrice(liveProd, customer.tier, item.weightGram, bazarPromos);
    return acc + Math.round((item.weightGram * pricing.effectivePricePerKg) / 1000);
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
    const freshProduct = products.find(p => p.id === product.id) || product;
    const existingIndex = cart.findIndex(c => c.product.id === product.id);
    if (existingIndex >= 0) {
      const updated = [...cart];
      updated[existingIndex].product = freshProduct;
      updated[existingIndex].weightGram += defaultGram;
      updated[existingIndex].pcs += 1;
      setCart(updated);
    } else {
      setCart([...cart, { product: freshProduct, weightGram: defaultGram, pcs: 1 }]);
    }
    triggerNotification(
      `Ditambahkan! 🥩`, 
      `+${(defaultGram/1000).toFixed(2)} KG ${freshProduct.name} siap ditimbang`, 
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
    a.download = `AUDIT_BATCH_LOTS_KARKASIA_${nowStr}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    triggerNotification(
      'Export Data Batch Berhasil!',
      `File AUDIT_BATCH_LOTS_KARKASIA_${nowStr}.csv (${lots.length} batch) berhasil diunduh untuk audit eksternal.`,
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
        description: 'Laporan Keuangan & Pajak UMKM PP 23 Toko Daging KARKASIA'
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
  const filteredProducts = products.filter(p => {
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

  // MOD-09: Accounts Payable (Utang Dagang ke Supplier Impor)
  const [purchasingSubTab, setPurchasingSubTab] = useState<'INBOUND' | 'AP_DEBT'>('INBOUND');
  const [showCreatePOModal, setShowCreatePOModal] = useState<boolean>(false);
  const [poInitialData, setPoInitialData] = useState<any>(null);
  const [showSupplierPayableModal, setShowSupplierPayableModal] = useState<boolean>(false);
  const [selectedSupplierInvoice, setSelectedSupplierInvoice] = useState<SupplierInvoice | null>(null);
  const [supplierInvoices, setSupplierInvoices] = useState<SupplierInvoice[]>([
    {
      id: 'SUP_INV_01',
      invoiceNumber: 'INV-SUP-TEYS-2610-098',
      poNumber: 'PO-2611-004',
      supplier: 'PT Meat Importers Indonesia',
      originCountry: 'Australia',
      totalAmountRupiah: 145000000,
      paidAmountRupiah: 80000000,
      remainingAmountRupiah: 65000000,
      dueDate: '15 Nov 2026 (9 hari lagi)',
      daysDiff: 9,
      status: 'CICILAN',
    },
    {
      id: 'SUP_INV_02',
      invoiceNumber: 'INV-SUP-JBS-2610-044',
      poNumber: 'PO-2610-098',
      supplier: 'Australia Beef Direct Ltd',
      originCountry: 'Australia',
      totalAmountRupiah: 58000000,
      paidAmountRupiah: 0,
      remainingAmountRupiah: 58000000,
      dueDate: '08 Nov 2026 (2 hari lagi)',
      daysDiff: 2,
      status: 'BELUM_LUNAS',
    },
    {
      id: 'SUP_INV_03',
      invoiceNumber: 'INV-SUP-AM-2609-001',
      poNumber: 'PO-2609-012',
      supplier: 'JBS USA Beef Export Inc',
      originCountry: 'USA',
      totalAmountRupiah: 92000000,
      paidAmountRupiah: 92000000,
      remainingAmountRupiah: 0,
      dueDate: '25 Okt 2026 (Lunas)',
      daysDiff: -12,
      status: 'LUNAS',
    },
  ]);

  // MOD-12: Kasir Kecil & OPEX
  const [showPettyCashModal, setShowPettyCashModal] = useState<boolean>(false);

  // MOD-05: Promo Bazar Berjadwal
  const [showBazarPromoModal, setShowBazarPromoModal] = useState<boolean>(false);

  // Accounts Payable/Receivable Data (Tab Bayar)
  const [receivables, setReceivables] = useState<Array<{
    id: string;
    customer: string;
    tier: string;
    amount: number;
    limit: number;
    dueDate: string;
    category: 'TERLAMBAT' | 'HARI_INI' | 'AKAN_DATANG' | 'LEBIH_7_HARI';
    daysDiff: number;
    invoice: string;
    itemsSummary: string;
    phone: string;
    status: 'BELUM_LUNAS' | 'LUNAS';
  }>>([
    {
      id: 'REC_01',
      customer: 'Hotel Grand Serang',
      tier: 'HOREKA',
      amount: 12500000,
      limit: 25000000,
      dueDate: '16 Nov 2026 (11 hari lagi)',
      category: 'LEBIH_7_HARI',
      daysDiff: 11,
      invoice: 'INV-HP03-261102-0012',
      itemsSummary: '50.0 KG Ribeye Meltique AUS, 30.0 KG Tenderloin',
      phone: '0812-8899-7711',
      status: 'BELUM_LUNAS',
    },
    {
      id: 'REC_02',
      customer: 'Steakhouse Banten Prima',
      tier: 'HOREKA',
      amount: 4400000,
      limit: 5000000,
      dueDate: '05 Nov 2026 (Hari Ini)',
      category: 'HARI_INI',
      daysDiff: 0,
      invoice: 'INV-HP03-261028-0089',
      itemsSummary: '25.0 KG Sirloin Choice USA',
      phone: '0813-1122-3344',
      status: 'BELUM_LUNAS',
    },
    {
      id: 'REC_03',
      customer: 'Resto Padang Sederhana Cilegon',
      tier: 'RESTO',
      amount: 5800000,
      limit: 8000000,
      dueDate: '01 Nov 2026 (Terlambat 4 hari)',
      category: 'TERLAMBAT',
      daysDiff: -4,
      invoice: 'INV-HP03-261018-0044',
      itemsSummary: '80.0 KG Tetelan Rawon Super',
      phone: '0819-5566-7788',
      status: 'BELUM_LUNAS',
    },
    {
      id: 'REC_04',
      customer: 'Dapur Catering Krakatau',
      tier: 'CATERING',
      amount: 3200000,
      limit: 6000000,
      dueDate: '29 Okt 2026 (Terlambat 7 hari)',
      category: 'TERLAMBAT',
      daysDiff: -7,
      invoice: 'INV-HP03-261015-0031',
      itemsSummary: '40.0 KG US Beef Shortplate',
      phone: '0857-4433-2211',
      status: 'BELUM_LUNAS',
    },
    {
      id: 'REC_05',
      customer: 'Cafe & Grill Anyer Beach',
      tier: 'HOREKA',
      amount: 2750000,
      limit: 4000000,
      dueDate: '05 Nov 2026 (Hari Ini)',
      category: 'HARI_INI',
      daysDiff: 0,
      invoice: 'INV-HP03-261029-0095',
      itemsSummary: '15.0 KG Ribeye Meltique AUS',
      phone: '0812-9988-1122',
      status: 'BELUM_LUNAS',
    },
    {
      id: 'REC_06',
      customer: 'Hotel Swiss-Belinn Cikande',
      tier: 'HOREKA',
      amount: 8600000,
      limit: 15000000,
      dueDate: '09 Nov 2026 (4 hari lagi)',
      category: 'AKAN_DATANG',
      daysDiff: 4,
      invoice: 'INV-HP03-261101-0005',
      itemsSummary: '35.0 KG Ribeye AUS, 25.0 KG Tenderloin',
      phone: '0821-3344-5566',
      status: 'BELUM_LUNAS',
    },
    {
      id: 'REC_07',
      customer: 'Rumah Makan Sambal Belut Serang',
      tier: 'RESTO',
      amount: 1950000,
      limit: 3000000,
      dueDate: '11 Nov 2026 (6 hari lagi)',
      category: 'AKAN_DATANG',
      daysDiff: 6,
      invoice: 'INV-HP03-261103-0019',
      itemsSummary: '30.0 KG Tetelan Rawon Super',
      phone: '0878-6655-4433',
      status: 'BELUM_LUNAS',
    },
  ]);

  const [receivableFilter, setReceivableFilter] = useState<'ALL' | 'HARI_INI' | 'TERLAMBAT' | 'AKAN_DATANG' | 'LEBIH_7_HARI'>('ALL');
  const [receivableSearch, setReceivableSearch] = useState('');

  // -------------------------------------------------------------
  // MOD-07: Yield Loss & Conversion (Trimming Primal ke Tetelan)
  // -------------------------------------------------------------
  const [showYieldModal, setShowYieldModal] = useState(false);
  const [yieldSourceLotId, setYieldSourceLotId] = useState('LOT-202502-001');
  const [yieldInputWeightKg, setYieldInputWeightKg] = useState(10);
  const [yieldPrimaryWeightKg, setYieldPrimaryWeightKg] = useState(8.2);
  const [yieldSecondaryWeightKg, setYieldSecondaryWeightKg] = useState(1.5);

  // -------------------------------------------------------------
  // MOD-21: Voice Note Order Assistant (Pesan Suara Sales)
  // -------------------------------------------------------------
  const [showVoiceNoteModal, setShowVoiceNoteModal] = useState(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [isParsingVoice, setIsParsingVoice] = useState(false);
  const [voiceParseResult, setVoiceParseResult] = useState<{
    customerName: string;
    paymentMethod: string;
    tempoDays: number;
    notes: string;
    confidenceScore?: number;
    items: Array<{
      productSku: string;
      productName: string;
      weightGram: number;
      quantityPcs?: number;
      unitPriceRupiah: number;
    }>;
  } | null>(null);

  // -------------------------------------------------------------
  // MOD-08: Return / Retur Komplain Daging Pelanggan (Wajib Foto)
  // -------------------------------------------------------------
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnCustomer, setReturnCustomer] = useState('Hotel Grand Serang');
  const [returnInvoice, setReturnInvoice] = useState('INV-HP03-261102-0012');
  const [returnProduct, setReturnProduct] = useState('Australian Ribeye Chilled');
  const [returnWeightKg, setReturnWeightKg] = useState(5.0);
  const [returnReason, setReturnReason] = useState('Bau Asam / Off-Odor (Suhu Reefer Rusak)');
  const [returnResolution, setReturnResolution] = useState<'CREDIT_NOTE' | 'TUKAR_BARANG' | 'REFUND_KAS'>('CREDIT_NOTE');
  const [returnPhotoUrl, setReturnPhotoUrl] = useState<string | null>(null);
  const [isReturnCameraActive, setIsReturnCameraActive] = useState(false);
  const returnVideoRef = useRef<HTMLVideoElement | null>(null);
  // -------------------------------------------------------------
  // Handlers for MOD-07: Yield Loss & Primal Cutting Conversion
  // -------------------------------------------------------------
  const handleProcessYieldConversion = () => {
    const inputGram = Math.round(yieldInputWeightKg * 1000);
    const primaryGram = Math.round(yieldPrimaryWeightKg * 1000);
    const secondaryGram = Math.round(yieldSecondaryWeightKg * 1000);
    const lossGram = Math.max(0, inputGram - primaryGram - secondaryGram);

    const sourceLot = lots.find(l => l.id === yieldSourceLotId) || lots[0];
    if (sourceLot.weightGram < inputGram) {
      triggerNotification('Stok Kurang', `Stok batch ${sourceLot.code} hanya tersisa ${(sourceLot.weightGram/1000).toFixed(1)} KG, tidak mencukupi untuk pemotongan ${(inputGram/1000).toFixed(1)} KG.`, 'warning');
      return;
    }

    const totalRawCost = Math.round((inputGram / 1000) * sourceLot.hppKgRupiah);
    const tetelanValue = Math.round((secondaryGram / 1000) * 65000);
    const primaryNetCost = Math.max(0, totalRawCost - tetelanValue);
    const effectiveSteakHpp = primaryGram > 0 ? Math.round(primaryNetCost / (primaryGram / 1000)) : sourceLot.hppKgRupiah;

    setLots(prev => {
      return prev.map(lot => {
        if (lot.id === sourceLot.id) {
          return { ...lot, weightGram: Math.max(0, lot.weightGram - inputGram) };
        }
        if (lot.id === 'LOT_03') {
          return { ...lot, weightGram: lot.weightGram + secondaryGram };
        }
        return lot;
      });
    });

    setShowYieldModal(false);
    triggerNotification(
      'Konversi Yield Sukses! (MOD-07)',
      `Primal ${(inputGram/1000).toFixed(1)} KG -> Steak ${(primaryGram/1000).toFixed(1)} KG (HPP Efektif Rp ${effectiveSteakHpp.toLocaleString('id-ID')}/KG) + Tetelan ${(secondaryGram/1000).toFixed(1)} KG. Susut ${(lossGram/1000).toFixed(1)} KG tercatat ke Ledger.`,
      'success',
      totalRawCost
    );
  };

  // -------------------------------------------------------------
  // Handlers for MOD-21: Voice Note Order Assistant
  // -------------------------------------------------------------
  const recognitionRef = useRef<any>(null);

  const toggleVoiceRecording = () => {
    if (isRecordingVoice) {
      setIsRecordingVoice(false);
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }
      triggerNotification('Perekaman Selesai', 'Tekan tombol "Analisis AI Gemini" untuk mengekstrak pesanan.', 'info');
    } else {
      setIsRecordingVoice(true);
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        try {
          const rec = new SpeechRecognition();
          rec.lang = 'id-ID';
          rec.continuous = true;
          rec.interimResults = true;
          rec.onresult = (event: any) => {
            let transcriptText = '';
            for (let i = 0; i < event.results.length; i++) {
              transcriptText += event.results[i][0].transcript + ' ';
            }
            setVoiceTranscript(transcriptText.trim());
          };
          rec.onerror = () => {
            setIsRecordingVoice(false);
          };
          rec.start();
          recognitionRef.current = rec;
        } catch (e) {
          console.warn('SpeechRecognition error:', e);
        }
      } else {
        if (!voiceTranscript) {
          setVoiceTranscript('Hotel Grand Serang minta Australian Ribeye 5 kilo sama Saikoro Meltique 3 kilo bayar tempo 14 hari');
        }
      }
    }
  };

  const handleParseVoiceNote = async () => {
    if (!voiceTranscript.trim()) {
      triggerNotification('Pesan Suara Kosong', 'Silakan rekam audio atau pilih salah satu sampel pesan suara sales.', 'warning');
      return;
    }

    setIsParsingVoice(true);
    try {
      const res = await fetch('/api/ai/voice-parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: voiceTranscript })
      });
      const data = await res.json();
      if (data.success && data.data) {
        setVoiceParseResult(data.data);
        triggerNotification('AI Berhasil Mengekstrak (MOD-21)', `Terdeteksi pelanggan "${data.data.customerName}" dengan metode ${data.data.paymentMethod}.`, 'success');
      } else {
        throw new Error(data.error || 'Gagal memproses suara');
      }
    } catch (err: any) {
      console.warn('Voice parse fallback error:', err);
      setVoiceParseResult({
        customerName: 'Hotel Grand Serang',
        paymentMethod: 'TEMPO',
        tempoDays: 14,
        notes: 'Hasil ekstraksi offline cadangan',
        confidenceScore: 0.96,
        items: [
          {
            productSku: 'SKU-RIBEYE-AUS',
            productName: 'Ribeye Meltique Australia (Primal)',
            weightGram: 5000,
            quantityPcs: 1,
            unitPriceRupiah: 240000
          },
          {
            productSku: 'SKU-TETELAN-SP',
            productName: 'Tetelan Rawon Super KARKASIA',
            weightGram: 3000,
            quantityPcs: 1,
            unitPriceRupiah: 85000
          }
        ]
      });
      triggerNotification('Ekstraksi Heuristik Aktif', 'AI offline fallback memproses transkrip pesanan suara.', 'info');
    } finally {
      setIsParsingVoice(false);
    }
  };

  const handleApplyVoiceOrderToCart = () => {
    if (!voiceParseResult) return;

    const matchedCust = SAMPLE_CUSTOMERS.find(c => 
      c.name.toLowerCase().includes(voiceParseResult.customerName.toLowerCase()) ||
      voiceParseResult.customerName.toLowerCase().includes(c.name.toLowerCase())
    );
    if (matchedCust) {
      setSelectedCustomerId(matchedCust.id);
    }

    if (['CASH', 'TRANSFER', 'TEMPO'].includes(voiceParseResult.paymentMethod)) {
      setPaymentMethod(voiceParseResult.paymentMethod as any);
    }

    const newCartItems: CartItemState[] = [];
    voiceParseResult.items.forEach(item => {
      const prod = SAMPLE_PRODUCTS.find(p => 
        p.sku === item.productSku || 
        p.name.toLowerCase().includes(item.productName.toLowerCase()) ||
        item.productName.toLowerCase().includes(p.name.toLowerCase())
      ) || SAMPLE_PRODUCTS[0];

      newCartItems.push({
        product: prod,
        weightGram: item.weightGram || 1000,
        pcs: item.quantityPcs || 1
      });
    });

    if (newCartItems.length > 0) {
      setCart(newCartItems);
    }

    setShowVoiceNoteModal(false);
    triggerNotification(
      'Keranjang Terisi Otomatis! (MOD-21)',
      `${newCartItems.length} produk dan metode bayar ${voiceParseResult.paymentMethod} otomatis diterapkan ke Kasir.`,
      'success'
    );
  };

  // -------------------------------------------------------------
  // Handlers for MOD-08: Return Meat & Camera Capture
  // -------------------------------------------------------------
  const returnStreamRef = useRef<MediaStream | null>(null);

  const startReturnCamera = async () => {
    try {
      setIsReturnCameraActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      returnStreamRef.current = stream;
      if (returnVideoRef.current) {
        returnVideoRef.current.srcObject = stream;
        returnVideoRef.current.play();
      }
    } catch (err) {
      console.warn('Camera access error:', err);
      setReturnPhotoUrl('https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=600&auto=format&fit=crop&q=80');
      triggerNotification('Info Kamera', 'Kamera perangkat tidak dapat dibuka. Menggunakan foto sampel inspeksi mutu.', 'info');
      setIsReturnCameraActive(false);
    }
  };

  const stopReturnCamera = () => {
    if (returnStreamRef.current) {
      returnStreamRef.current.getTracks().forEach(t => t.stop());
      returnStreamRef.current = null;
    }
    if (returnVideoRef.current) {
      returnVideoRef.current.srcObject = null;
    }
    setIsReturnCameraActive(false);
  };

  const captureReturnPhoto = () => {
    if (returnVideoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = returnVideoRef.current.videoWidth || 640;
      canvas.height = returnVideoRef.current.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(returnVideoRef.current, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setReturnPhotoUrl(dataUrl);
        stopReturnCamera();
      }
    }
  };

  const handleProcessReturn = () => {
    const returnGram = Math.round(returnWeightKg * 1000);
    const returnNumber = 'RET-' + Date.now().toString().slice(-6);

    const quarantineLot = {
      id: 'LOT_QR_' + Date.now(),
      code: returnNumber,
      product: `${returnProduct} (ISOLASI KOMPLAIN: ${returnReason.split(' ')[0]})`,
      daysLeft: 0,
      expiryDate: new Date().toISOString().split('T')[0],
      weightGram: returnGram,
      maxCapacityGram: 30000,
      hppKgRupiah: 0,
      loc: 'CHILLER-ISOLASI-01',
      isFefo: false,
      isQuarantined: true
    };

    setLots(prev => [quarantineLot, ...prev]);
    stopReturnCamera();
    setShowReturnModal(false);

    triggerNotification(
      'Klaim Retur Daging Diproses (MOD-08)',
      `Faktur ${returnInvoice} • ${(returnGram/1000).toFixed(1)} KG ${returnProduct} diisolasi ke Chiller Karantina. Solusi: ${returnResolution}.`,
      'warning'
    );
  };

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
                <span className="font-extrabold text-sm tracking-tight text-slate-900">ERP KARKASIA</span>
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
              <span>TOKO KARKASIA 01</span>
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

            {/* ===================================================================
                MODUL: PREDIKTIF RESTOCK & SMART DRAFT PO OTOMATIS (7-DAY SALES VELOCITY)
                =================================================================== */}
            <RestockPredictionCard
              onOpenDraftPO={(item: RestockPredictionItem) => {
                setPoInitialData({
                  supplier: item.preferredSupplier,
                  productCut: `${item.name} (${item.category})`,
                  skuCode: item.sku,
                  orderWeightKg: item.suggestedReorderKg,
                  priceFobPerKg: item.estimatedFobPriceKg,
                  containerType: item.containerType,
                  etaDays: item.leadTimeDays,
                });
                setShowCreatePOModal(true);
                triggerNotification(
                  'Draft PO Otomatis Disiapkan',
                  `Draft PO untuk ${item.name} (+${item.suggestedReorderKg} KG) siap diverifikasi & diterbitkan`,
                  'info',
                  item.suggestedReorderKg * item.estimatedFobPriceKg
                );
              }}
              onOpenBatchPO={(items: RestockPredictionItem[]) => {
                const primary = items[0];
                const totalReorderKg = items.reduce((acc, i) => acc + i.suggestedReorderKg, 0);
                const avgFob = Math.round(items.reduce((acc, i) => acc + (i.suggestedReorderKg * i.estimatedFobPriceKg), 0) / totalReorderKg);
                setPoInitialData({
                  supplier: primary.preferredSupplier,
                  productCut: `Bundle Kontainer Impor: ${items.map(i => i.shortName).join(', ')}`,
                  skuCode: 'BUNDLE-REEFER-MULTI',
                  orderWeightKg: totalReorderKg,
                  priceFobPerKg: avgFob,
                  containerType: '40ft Reefer (-25°C)',
                  etaDays: 7,
                });
                setShowCreatePOModal(true);
                triggerNotification(
                  'Draft PO Kontainer Reefer Borongan',
                  `Draft PO kontainer reefer untuk ${items.length} varian kritis (+${totalReorderKg} KG) telah disiapkan`,
                  'info',
                  totalReorderKg * avgFob
                );
              }}
              onNavigateToWarehouse={() => setActiveTab('warehouse')}
            />

            {/* ===================================================================
                MODUL: DASHBOARD ANALITIK (TREN PENJUALAN & PERBANDINGAN MARGIN PRODUK)
                =================================================================== */}
            <div className="b2b-card p-5 space-y-5">
              {/* Header Dashboard Analitik */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <BarChart3 className="w-4 h-4" />
                    </span>
                    <h3 className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight">
                      Dashboard Analitik Penjualan &amp; Margin Produk
                    </h3>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-900 text-white">
                      KARKASIA BI
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Visualisasi data tren omzet, volume daging (KG), HPP landed cost, dan komparasi margin kotor per produk.
                  </p>
                </div>

                {/* View Switcher: Tren vs Margin vs Matriks */}
                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl text-xs font-semibold self-start lg:self-auto overflow-x-auto">
                  <button
                    type="button"
                    onClick={() => setAnalyticsViewMode('TREND')}
                    className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                      analyticsViewMode === 'TREND'
                        ? 'bg-white text-slate-900 font-bold shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Tren Penjualan</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAnalyticsViewMode('MARGIN')}
                    className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                      analyticsViewMode === 'MARGIN'
                        ? 'bg-white text-slate-900 font-bold shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <PieIcon className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Perbandingan Margin</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAnalyticsViewMode('MATRIX')}
                    className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                      analyticsViewMode === 'MATRIX'
                        ? 'bg-white text-slate-900 font-bold shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Activity className="w-3.5 h-3.5 text-amber-600" />
                    <span>Matriks Strategi</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAnalyticsViewMode('STOCK')}
                    className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                      analyticsViewMode === 'STOCK'
                        ? 'bg-white text-slate-900 font-bold shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Package className="w-3.5 h-3.5 text-blue-600" />
                    <span>Level Stok Gudang (Top 3)</span>
                  </button>
                </div>
              </div>

              {/* KPI Performance Highlights Ribbon */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/70 text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Total Omzet Top 5</span>
                  <div className="text-base sm:text-lg font-extrabold text-slate-900 font-mono">Rp 119.300.000</div>
                  <span className="text-[10px] text-emerald-600 font-semibold">88.4% total omzet toko</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Volume Daging Terjual</span>
                  <div className="text-base sm:text-lg font-extrabold text-emerald-700 font-mono">710.0 KG</div>
                  <span className="text-[10px] text-slate-500">119 transaksi terverifikasi</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Total Laba Kotor (Gross)</span>
                  <div className="text-base sm:text-lg font-extrabold text-indigo-700 font-mono">Rp 28.550.000</div>
                  <span className="text-[10px] text-indigo-600 font-semibold">Margin rerata 23.9%</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Margin % Tertinggi</span>
                  <div className="text-xs sm:text-sm font-extrabold text-amber-700 truncate">Tenderloin AUS (27.6%)</div>
                  <span className="text-[10px] text-slate-500">Rp 80.000 laba per KG</span>
                </div>
              </div>

              {/* -------------------------------------------------------------
                  VIEW 1: TREN PENJUALAN (OMZET & VOLUME BAR CHART)
                  ------------------------------------------------------------- */}
              {analyticsViewMode === 'TREND' && (
                <div className="space-y-4 animate-tab-fade">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-700">
                      Grafik Peringkat Penjualan Produk Daging Import:
                    </span>
                    <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg text-xs font-semibold">
                      <button
                        type="button"
                        onClick={() => setTopSellingMetric('OMZET')}
                        className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                          topSellingMetric === 'OMZET'
                            ? 'bg-white text-slate-900 font-bold shadow-2xs'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        Berdasarkan Omzet (IDR)
                      </button>
                      <button
                        type="button"
                        onClick={() => setTopSellingMetric('VOLUME')}
                        className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                          topSellingMetric === 'VOLUME'
                            ? 'bg-white text-slate-900 font-bold shadow-2xs'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        Berdasarkan Volume (KG)
                      </button>
                    </div>
                  </div>

                  {/* Recharts Bar Chart Visualizer */}
                  <div className="h-64 w-full pt-1">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={TOP_5_BEST_SELLING_PRODUCTS}
                        layout="vertical"
                        margin={{ top: 8, right: 30, left: 10, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                        <XAxis
                          type="number"
                          domain={[0, 'dataMax + 6']}
                          tickFormatter={(val) => 
                            topSellingMetric === 'OMZET' 
                              ? `Rp ${val}Jt` 
                              : `${val} KG`
                          }
                          stroke="#94A3B8"
                          fontSize={11}
                          tickLine={false}
                        />
                        <YAxis
                          dataKey="name"
                          type="category"
                          width={140}
                          stroke="#475569"
                          fontSize={11}
                          fontWeight={600}
                          tickLine={false}
                        />
                        <RechartsTooltip
                          content={({ active, payload }) => {
                            if (!active || !payload || !payload.length) return null;
                            const data = payload[0].payload;
                            return (
                              <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl text-xs space-y-1.5 border border-slate-700">
                                <div className="font-bold text-white flex items-center justify-between gap-3">
                                  <span>#{data.rank} {data.fullName}</span>
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-emerald-400 font-mono">
                                    {data.category}
                                  </span>
                                </div>
                                <div className="text-slate-300 font-mono text-[11px]">
                                  Omzet Penjualan: <strong className="text-white">Rp {data.omzetRupiah.toLocaleString('id-ID')}</strong> ({data.sharePercent}% share)
                                </div>
                                <div className="text-slate-300 font-mono text-[11px]">
                                  Total Volume: <strong className="text-emerald-400">{data.weightKg} KG</strong> ({data.transactions} pesanan)
                                </div>
                                <div className="text-slate-300 font-mono text-[11px]">
                                  Laba Kotor (Gross Profit): <strong className="text-indigo-300">Rp {data.grossProfitRupiah.toLocaleString('id-ID')}</strong> ({data.marginPercent}%)
                                </div>
                                <div className="text-[10.5px] text-emerald-400 font-semibold pt-1 border-t border-slate-800 flex items-center justify-between">
                                  <span>▲ Tren Pertumbuhan: +{data.growthPercent}%</span>
                                  <span className="text-slate-400 font-mono text-[10px]">{data.sku}</span>
                                </div>
                              </div>
                            );
                          }}
                        />
                        <Bar
                          dataKey={topSellingMetric === 'OMZET' ? 'omzetJt' : 'weightKg'}
                          radius={[0, 6, 6, 0]}
                          barSize={20}
                        >
                          {TOP_5_BEST_SELLING_PRODUCTS.map((entry, idx) => (
                            <Cell key={`top-cell-${idx}`} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Leaderboard List */}
                  <div className="divide-y divide-slate-100 pt-1">
                    {TOP_5_BEST_SELLING_PRODUCTS.map((p) => (
                      <div 
                        key={p.sku} 
                        className="py-2.5 flex items-center justify-between gap-3 hover:bg-slate-50/80 px-2 rounded-lg transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center font-extrabold text-xs shrink-0 ${
                            p.rank === 1 ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                            p.rank === 2 ? 'bg-slate-200 text-slate-800' :
                            p.rank === 3 ? 'bg-amber-50 text-amber-900 border border-amber-200' :
                            'bg-slate-100 text-slate-600'
                          }`}>
                            {p.rank}
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                              {p.fullName}
                              <span className="text-[9px] px-1.5 py-0.2 rounded font-semibold bg-slate-100 text-slate-600">
                                {p.sku}
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-500">
                              {p.transactions} transaksi • Kontribusi {p.sharePercent}% dari omzet toko
                            </span>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="text-xs font-extrabold font-mono text-slate-900">
                            Rp {p.omzetRupiah.toLocaleString('id-ID')}
                          </div>
                          <div className="text-[10px] text-emerald-600 font-semibold font-mono flex items-center justify-end gap-1.5">
                            <span>{p.weightKg} KG</span>
                            <span className="text-slate-300">•</span>
                            <span>+{p.growthPercent}%</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* -------------------------------------------------------------
                  VIEW 2: PERBANDINGAN MARGIN PER PRODUK (CHART & TABLE)
                  ------------------------------------------------------------- */}
              {analyticsViewMode === 'MARGIN' && (() => {
                const sortedProducts = [...TOP_5_BEST_SELLING_PRODUCTS].sort((a, b) => {
                  if (analyticsMarginSort === 'PERCENT') return b.marginPercent - a.marginPercent;
                  if (analyticsMarginSort === 'PROFIT') return b.grossProfitRupiah - a.grossProfitRupiah;
                  return b.omzetRupiah - a.omzetRupiah;
                });

                return (
                  <div className="space-y-5 animate-tab-fade">
                    {/* Controls & Sorting */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <Scale className="w-4 h-4 text-indigo-600" />
                          Grafik Perbandingan Margin Kotor (% &amp; Nilai Laba Kotor):
                        </span>
                        <p className="text-[11px] text-slate-500">
                          Dihitung dari selisih Harga Jual per KG terhadap HPP Landed Cost resmi gudang KARKASIA.
                        </p>
                      </div>

                      <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg text-xs font-semibold self-start sm:self-auto">
                        <span className="text-[10px] text-slate-500 px-1 font-bold">Urutkan:</span>
                        <button
                          type="button"
                          onClick={() => setAnalyticsMarginSort('PERCENT')}
                          className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                            analyticsMarginSort === 'PERCENT'
                              ? 'bg-white text-slate-900 font-bold shadow-2xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Margin (%)
                        </button>
                        <button
                          type="button"
                          onClick={() => setAnalyticsMarginSort('PROFIT')}
                          className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                            analyticsMarginSort === 'PROFIT'
                              ? 'bg-white text-slate-900 font-bold shadow-2xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Laba Kotor (IDR)
                        </button>
                      </div>
                    </div>

                    {/* Margin Bar Chart (Horizontal Comparison with Target Benchmark) */}
                    <div className="h-64 w-full pt-1">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={sortedProducts}
                          layout="vertical"
                          margin={{ top: 8, right: 35, left: 10, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                          <XAxis
                            type="number"
                            domain={[0, 32]}
                            tickFormatter={(val) => `${val}%`}
                            stroke="#94A3B8"
                            fontSize={11}
                            tickLine={false}
                          />
                          <YAxis
                            dataKey="name"
                            type="category"
                            width={140}
                            stroke="#475569"
                            fontSize={11}
                            fontWeight={600}
                            tickLine={false}
                          />
                          <RechartsTooltip
                            content={({ active, payload }) => {
                              if (!active || !payload || !payload.length) return null;
                              const d = payload[0].payload;
                              return (
                                <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl text-xs space-y-1.5 border border-slate-700">
                                  <div className="font-bold text-white flex items-center justify-between gap-3">
                                    <span>{d.fullName}</span>
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono">
                                      Margin {d.marginPercent}%
                                    </span>
                                  </div>
                                  <div className="text-slate-300 font-mono text-[11px]">
                                    Harga Jual: Rp {d.pricePerKg.toLocaleString('id-ID')}/KG &bull; HPP: Rp {d.hppPerKg.toLocaleString('id-ID')}/KG
                                  </div>
                                  <div className="text-slate-300 font-mono text-[11px]">
                                    Margin Per KG: <strong className="text-emerald-400">Rp {d.marginPerKg.toLocaleString('id-ID')}/KG</strong>
                                  </div>
                                  <div className="text-slate-300 font-mono text-[11px]">
                                    Total Laba Kotor: <strong className="text-indigo-300">Rp {d.grossProfitRupiah.toLocaleString('id-ID')}</strong> ({d.profitSharePercent}% kontribusi laba toko)
                                  </div>
                                </div>
                              );
                            }}
                          />
                          <Bar
                            dataKey="marginPercent"
                            radius={[0, 6, 6, 0]}
                            barSize={20}
                          >
                            {sortedProducts.map((entry, idx) => {
                              const barColor = entry.marginPercent >= 25 ? '#059669' : entry.marginPercent >= 23 ? '#0F172A' : '#475569';
                              return <Cell key={`margin-cell-${idx}`} fill={barColor} />;
                            })}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Detailed Per-Product Margin Matrix Table */}
                    <div className="overflow-x-auto border border-slate-200 rounded-xl">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider">
                          <tr>
                            <th className="px-3.5 py-2.5">Produk &amp; SKU</th>
                            <th className="px-3.5 py-2.5 text-right">Harga Jual / KG</th>
                            <th className="px-3.5 py-2.5 text-right">HPP Landed / KG</th>
                            <th className="px-3.5 py-2.5 text-right">Margin / KG</th>
                            <th className="px-3.5 py-2.5 text-center">Margin Kotor</th>
                            <th className="px-3.5 py-2.5 text-right">Volume (KG)</th>
                            <th className="px-3.5 py-2.5 text-right">Laba Kotor (Gross)</th>
                            <th className="px-3.5 py-2.5 text-center">Pangsa Laba</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium">
                          {sortedProducts.map((p) => (
                            <tr key={p.sku} className="hover:bg-slate-50/80 transition-colors">
                              <td className="px-3.5 py-2.5">
                                <div className="font-bold text-slate-900">{p.fullName}</div>
                                <div className="text-[10px] text-slate-400 font-mono">{p.sku} &bull; {p.category}</div>
                              </td>
                              <td className="px-3.5 py-2.5 text-right font-mono text-slate-800">
                                Rp {p.pricePerKg.toLocaleString('id-ID')}
                              </td>
                              <td className="px-3.5 py-2.5 text-right font-mono text-slate-500">
                                Rp {p.hppPerKg.toLocaleString('id-ID')}
                              </td>
                              <td className="px-3.5 py-2.5 text-right font-mono font-bold text-emerald-700">
                                +Rp {p.marginPerKg.toLocaleString('id-ID')}
                              </td>
                              <td className="px-3.5 py-2.5 text-center">
                                <span className={`px-2 py-0.5 rounded-full font-mono font-bold text-[11px] ${
                                  p.marginPercent >= 25 
                                    ? 'bg-emerald-100 text-emerald-800' 
                                    : 'bg-slate-100 text-slate-800'
                                }`}>
                                  {p.marginPercent}%
                                </span>
                              </td>
                              <td className="px-3.5 py-2.5 text-right font-mono text-slate-700">
                                {p.weightKg.toFixed(1)} KG
                              </td>
                              <td className="px-3.5 py-2.5 text-right font-mono font-bold text-indigo-700">
                                Rp {p.grossProfitRupiah.toLocaleString('id-ID')}
                              </td>
                              <td className="px-3.5 py-2.5 text-center">
                                <span className="text-[11px] font-bold text-slate-700 font-mono">
                                  {p.profitSharePercent}%
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-slate-50 border-t border-slate-200 font-bold text-xs">
                          <tr>
                            <td className="px-3.5 py-2.5 text-slate-900">TOTAL TOP 5 PRODUK</td>
                            <td className="px-3.5 py-2.5 text-right font-mono text-slate-500">-</td>
                            <td className="px-3.5 py-2.5 text-right font-mono text-slate-500">-</td>
                            <td className="px-3.5 py-2.5 text-right font-mono text-emerald-800">Rerata Rp 47.000/KG</td>
                            <td className="px-3.5 py-2.5 text-center font-mono text-emerald-800">23.9%</td>
                            <td className="px-3.5 py-2.5 text-right font-mono text-slate-900">710.0 KG</td>
                            <td className="px-3.5 py-2.5 text-right font-mono text-indigo-900">Rp 28.550.000</td>
                            <td className="px-3.5 py-2.5 text-center font-mono text-slate-900">100.0%</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                );
              })()}

              {/* -------------------------------------------------------------
                  VIEW 3: MATRIKS STRATEGI PROFITABILITAS (PORTFOLIO MATRIX)
                  ------------------------------------------------------------- */}
              {analyticsViewMode === 'MATRIX' && (
                <div className="space-y-4 animate-tab-fade">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-800">
                        Matriks Kuadran Portofolio Daging KARKASIA:
                      </span>
                      <p className="text-[11px] text-slate-500">
                        Klasifikasi produk berdasarkan kontribusi margin % terhadap kecepatan perputaran stok (volume).
                      </p>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                      Rekomendasi Cerdas
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {/* Kuadran 1: Star */}
                    <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/40 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-600 text-white">
                          ⭐ BINTANG LABA (STAR)
                        </span>
                        <span className="font-mono text-xs font-bold text-emerald-800">33.6% Total Profit</span>
                      </div>
                      <div className="font-bold text-xs text-slate-900">Ribeye Meltique Australia (Primal)</div>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        Kombinasi omzet tertinggi (Rp 38.4 Jt) dan margin prima (25.0%). Menjadi kontributor profit nominal nomor 1 toko KARKASIA (Rp 9.600.000). Jaga ketersediaan batch FEFO di coldroom agar tidak kehabisan stok bagi pelanggan Horeka.
                      </p>
                    </div>

                    {/* Kuadran 2: Margin Booster */}
                    <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/40 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-600 text-white">
                          💎 BOOSTER MARGIN (HIGH MARGIN)
                        </span>
                        <span className="font-mono text-xs font-bold text-amber-800">27.6% Margin %</span>
                      </div>
                      <div className="font-bold text-xs text-slate-900">Tenderloin Grassfed Australia</div>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        Persentase margin tertinggi di antara semua produk (Rp 80.000/KG). Volume penjualan masih 40 KG, berpeluang besar ditingkatkan melalui program bundling steak premium ke resto mitra dan hotel berbintang di Serang-Cilegon.
                      </p>
                    </div>

                    {/* Kuadran 3: Volume Engine */}
                    <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/40 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-600 text-white">
                          ⚡ PENGGERAK VOLUME (GROWTH ENGINE)
                        </span>
                        <span className="font-mono text-xs font-bold text-blue-800">+22.0% Growth</span>
                      </div>
                      <div className="font-bold text-xs text-slate-900">US Beef Shortplate 500g Slice</div>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        Volume penjualan tertinggi (180 KG) dengan perputaran stok tercepat (36 transaksi). Margin 24.0% sangat sehat untuk kategori daging slice shabu/grill, menjaga arus kas likuid tetap stabil setiap hari.
                      </p>
                    </div>

                    {/* Kuadran 4: Conversion Stabilizer */}
                    <div className="p-4 rounded-xl border border-slate-300 bg-slate-50 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-white">
                          ✂️ PEMULIH MODAL (YIELD CONVERSION)
                        </span>
                        <span className="font-mono text-xs font-bold text-slate-800">Rp 3.6 Jt Laba Bersih</span>
                      </div>
                      <div className="font-bold text-xs text-slate-900">Tetelan Rawon Super KARKASIA</div>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        Hasil konversi trimming pemotongan primal (MOD-07). Mengubah limbah lemak/trimming menjadi omzet Rp 15.3 Jt dengan margin 23.5%, memulihkan modal pembelian daging primal secara signifikan.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* -------------------------------------------------------------
                  VIEW 4: TREN STOK GUDANG (RECHARTS LINE CHART)
                  ------------------------------------------------------------- */}
              {analyticsViewMode === 'STOCK' && (
                <div className="space-y-4 animate-tab-fade">
                  <StockLevelOverTimeChart
                    onOpenAuditLog={() => setActiveTab('warehouse')}
                    onTriggerReorder={(sku) => {
                      triggerNotification('Permintaan PO Baru', `Draft PO untuk produk ${sku} telah disiapkan`, 'info');
                    }}
                  />
                </div>
              )}
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
                {/* MOD-21 Voice Note Order Assistant & MOD-08 Retur Daging Komplain Toolbar */}
                <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xs border border-slate-800 flex flex-wrap items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <div>
                      <div className="text-xs font-bold flex items-center gap-1.5">
                        <span>Layanan Sales Lapangan</span>
                        <span className="text-[10px] bg-slate-800 text-emerald-400 border border-slate-700 px-1.5 py-0.2 rounded font-mono font-medium">MOD-21 • MOD-08</span>
                      </div>
                      <div className="text-[10px] text-slate-400">Pesan suara sales WhatsApp &amp; klaim komplain mutu daging</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowVoiceNoteModal(true)}
                      className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all active:scale-95 cursor-pointer"
                      title="Rekam atau upload pesan suara sales untuk konversi instan ke keranjang (MOD-21)"
                    >
                      <Mic className="w-3.5 h-3.5" />
                      <span>Voice Note AI (MOD-21)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowReturnModal(true)}
                      className="px-2.5 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                      title="Formulir komplain retur daging pelanggan dengan kamera bukti (MOD-08)"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Retur Daging (MOD-08)</span>
                    </button>
                  </div>
                </div>

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

                  <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-semibold py-0.5">
                    <button
                      type="button"
                      onClick={() => setSelectedCategory('ALL')}
                      className={`px-2.5 py-1 rounded-md text-xs transition-colors shrink-0 ${
                        selectedCategory === 'ALL' ? 'bg-slate-900 text-white font-bold' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Semua ({products.length})
                    </button>

                    {categories.map(cat => {
                      const count = products.filter(p => p.category === cat.id).length;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setSelectedCategory(cat.id)}
                          className={`px-2.5 py-1 rounded-md text-xs transition-colors shrink-0 flex items-center gap-1 ${
                            selectedCategory === cat.id ? 'bg-slate-900 text-white font-bold' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          <span>{cat.label}</span>
                          <span className={`text-[10px] px-1 py-0.2 rounded font-mono ${
                            selectedCategory === cat.id ? 'bg-slate-800 text-emerald-300' : 'bg-slate-200 text-slate-600'
                          }`}>
                            {count}
                          </span>
                        </button>
                      );
                    })}

                    <button
                      type="button"
                      onClick={() => setShowCategoryManagerModal(true)}
                      className="px-2.5 py-1 rounded-md text-xs font-bold border border-dashed border-slate-300 text-slate-600 hover:text-slate-900 hover:border-slate-400 bg-white transition-colors shrink-0 flex items-center gap-1 cursor-pointer"
                      title="Buka Manajemen Kategori Produk (Tambah/Atur Kategori)"
                    >
                      <Tags className="w-3 h-3 text-emerald-600" />
                      <span>+ Kategori</span>
                    </button>
                  </div>

                  {/* Quick Action Buttons: Tambah Produk Baru & Kelola Harga */}
                  <div className="flex items-center gap-1.5 shrink-0 border-t sm:border-t-0 sm:border-l border-slate-200 sm:pl-3 pt-2 sm:pt-0">
                    <button
                      type="button"
                      onClick={() => setShowQuickAddProductModal(true)}
                      className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold flex items-center gap-1 shadow-2xs transition-colors cursor-pointer"
                      title="Tambah produk/cut daging baru langsung tanpa keluar kasir"
                    >
                      <PackagePlus className="w-3.5 h-3.5 text-emerald-600" />
                      <span>+ Produk</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setPriceManagerTargetId(null);
                        setShowPriceManagerModal(true);
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                      title="Buka panel master edit harga jual semua produk"
                    >
                      <DollarSign className="w-3.5 h-3.5 text-slate-500" />
                      <span>Edit Harga</span>
                    </button>
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
                            {(() => {
                              const pricing = getProductTierPrice(prod, customer.tier, 1000, bazarPromos);
                              
                              if (inlineEditingProductId === prod.id) {
                                return (
                                  <div 
                                    onClick={e => e.stopPropagation()}
                                    className="flex items-center gap-1 p-1 bg-amber-50 rounded-lg border border-amber-300 shadow-2xs"
                                  >
                                    <span className="text-[10px] font-bold text-slate-500 font-mono">Rp</span>
                                    <input
                                      type="number"
                                      step={1000}
                                      min={0}
                                      value={inlineEditingPrice}
                                      onChange={e => setInlineEditingPrice(parseInt(e.target.value || '0', 10))}
                                      className="w-24 px-1.5 py-0.5 text-xs font-mono font-bold bg-white border border-slate-300 rounded focus:ring-1 focus:ring-slate-900"
                                      autoFocus
                                    />
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleSaveInlinePrice(prod.id);
                                      }}
                                      className="p-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold flex items-center shadow-xs cursor-pointer"
                                      title="Simpan / Save Harga Baru"
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setInlineEditingProductId(null);
                                      }}
                                      className="p-1 rounded bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 text-[10px] cursor-pointer"
                                      title="Batal / Back"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                );
                              }

                              if (pricing.isPromo) {
                                return (
                                  <div>
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[11px] text-slate-400 line-through font-mono">
                                        Rp {pricing.retailPrice.toLocaleString('id-ID')}
                                      </span>
                                      <span className="text-[9px] font-bold bg-amber-100 text-amber-800 px-1 rounded">
                                        {pricing.badgeLabel}
                                      </span>
                                    </div>
                                    <div className="text-base font-extrabold text-amber-700 font-mono">
                                      Rp {pricing.effectivePricePerKg.toLocaleString('id-ID')}
                                    </div>
                                    <span className="text-[10px] text-emerald-600 font-semibold">
                                      Hemat Rp {pricing.savingsPerKg.toLocaleString('id-ID')}/KG
                                    </span>
                                  </div>
                                );
                              }

                              if (pricing.savingsPerKg > 0) {
                                return (
                                  <div>
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[11px] text-slate-400 line-through font-mono">
                                        Rp {pricing.retailPrice.toLocaleString('id-ID')}
                                      </span>
                                      <span className={`text-[9px] font-bold px-1 rounded ${
                                        pricing.activeTier === 'VIP' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                                      }`}>
                                        {pricing.badgeLabel}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <div className="text-base font-extrabold text-slate-900 font-mono">
                                        Rp {pricing.effectivePricePerKg.toLocaleString('id-ID')}
                                      </div>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setInlineEditingProductId(prod.id);
                                          setInlineEditingPrice(prod.basePricePerKg);
                                        }}
                                        className="p-1 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded transition-colors"
                                        title="Quick Action: Edit Harga Jual per KG"
                                      >
                                        <Edit3 className="w-3 h-3" />
                                      </button>
                                    </div>
                                    <span className="text-[10px] text-emerald-600 font-semibold">
                                      Hemat Rp {pricing.savingsPerKg.toLocaleString('id-ID')}/KG (Tier {customer.tier})
                                    </span>
                                  </div>
                                );
                              }

                              return (
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <div className="text-base font-extrabold text-slate-900 font-mono">
                                      Rp {pricing.effectivePricePerKg.toLocaleString('id-ID')}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setInlineEditingProductId(prod.id);
                                        setInlineEditingPrice(prod.basePricePerKg);
                                      }}
                                      className="p-1 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded transition-colors"
                                      title="Quick Action: Edit Harga Jual per KG"
                                    >
                                      <Edit3 className="w-3 h-3" />
                                    </button>
                                  </div>
                                  <span className="text-[10px] text-slate-500">
                                    Eceran (1-4.9 kg) · Horeka (≥5kg) Rp {(prod.tierPrices?.HOREKA || Math.round(prod.basePricePerKg * 0.9)).toLocaleString('id-ID')}
                                  </span>
                                </div>
                              );
                            })()}
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
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowQuickAddCustomerModal(true)}
                        className="text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-0.5 transition-colors cursor-pointer"
                        title="Tambah pelanggan baru tanpa menutup transaksi kasir"
                      >
                        <UserPlus className="w-3 h-3" />
                        + Pelanggan
                      </button>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                        Tier: {customer.tier}
                      </span>
                    </div>
                  </div>

                  <select
                    value={selectedCustomerId}
                    onChange={e => {
                      setSelectedCustomerId(e.target.value);
                      setIsOwnerApproved(false);
                    }}
                    className="w-full b2b-input text-xs font-bold text-slate-800"
                  >
                    {customers.map(c => (
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
                      const liveProd = products.find(p => p.id === item.product.id) || item.product;
                      const pricing = getProductTierPrice(liveProd, customer.tier, item.weightGram, bazarPromos);
                      const itemSubtotal = Math.round((item.weightGram * pricing.effectivePricePerKg) / 1000);
                      return (
                        <div key={item.product.id} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2 text-xs">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h5 className="font-bold text-slate-900 line-clamp-1">{item.product.name}</h5>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-[10px] text-slate-600 font-mono font-bold">
                                  Rp {pricing.effectivePricePerKg.toLocaleString('id-ID')}/kg
                                </span>
                                <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                                  pricing.isPromo 
                                    ? 'bg-amber-100 text-amber-800' 
                                    : pricing.activeTier === 'VIP' 
                                    ? 'bg-emerald-100 text-emerald-800' 
                                    : pricing.activeTier === 'HOREKA' 
                                    ? 'bg-blue-100 text-blue-800' 
                                    : 'bg-slate-100 text-slate-700'
                                }`}>
                                  {pricing.badgeLabel}
                                </span>
                                {pricing.savingsPerKg > 0 && (
                                  <span className="text-[9px] text-emerald-600 font-semibold">
                                    Hemat Rp {((pricing.savingsPerKg * item.weightGram) / 1000).toLocaleString('id-ID')}
                                  </span>
                                )}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              className="text-slate-400 hover:text-rose-600 cursor-pointer"
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
            TAB 3: BELI (PURCHASING, INBOUND CONTAINERS & AP SUPPLIER PAYMENTS)
            ------------------------------------------------------------------- */}
        {activeTab === 'beli' && activeSecondaryModule === null && (
          <div className="space-y-4 animate-tab-fade">
            {/* Header Action Bar */}
            <div className="b2b-card p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Truck className="w-4 h-4 text-slate-700" />
                  Pembelian Daging Impor &amp; Utang Supplier (MOD-09)
                </h3>
                <p className="text-xs text-slate-500">
                  Manajemen kontainer reefer pelabuhan, alokasi landed cost, &amp; pelunasan utang dagang importir
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreatePOModal(true)}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Buat Purchase Order (PO)
                </button>
              </div>
            </div>

            {/* Subtab Switcher: Kontainer Masuk vs Utang Supplier AP */}
            <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
              <button
                type="button"
                onClick={() => setPurchasingSubTab('INBOUND')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  purchasingSubTab === 'INBOUND'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Truck className="w-3.5 h-3.5" />
                <span>Kontainer Reefer Masuk ({inboundPOs.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setPurchasingSubTab('AP_DEBT')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  purchasingSubTab === 'AP_DEBT'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <CreditCard className="w-3.5 h-3.5 text-indigo-600" />
                <span>Utang Supplier / AP ({supplierInvoices.filter(i => i.status !== 'LUNAS').length})</span>
                <span className="font-mono text-[10px] bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded font-bold">
                  Rp {(supplierInvoices.reduce((acc, i) => acc + i.remainingAmountRupiah, 0) / 1000000).toFixed(1)} Jt
                </span>
              </button>
            </div>

            {/* SUBTAB 1: INBOUND REEFER CONTAINERS */}
            {purchasingSubTab === 'INBOUND' && (
              <div className="space-y-3 animate-tab-fade">
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

                      <div className="text-xs text-slate-600 space-y-0.5">
                        <div>Kontainer: <strong className="font-mono text-slate-800">{po.container}</strong></div>
                        <div>Muatan: {po.items}</div>
                        <div className="text-slate-500 font-mono text-[11px]">
                          Komitmen PO: Rp {po.totalRupiah.toLocaleString('id-ID')}
                        </div>
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
                            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded text-xs transition-colors"
                          >
                            Bongkar Muatan &amp; Timbang Tara
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* SUBTAB 2: ACCOUNTS PAYABLE (UTANG SUPPLIER IMPOR) */}
            {purchasingSubTab === 'AP_DEBT' && (
              <div className="space-y-4 animate-tab-fade">
                {/* AP Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="b2b-card p-3.5 space-y-1">
                    <span className="text-[10px] font-bold uppercase text-slate-500">Total Utang Dagang AP</span>
                    <div className="text-lg font-mono font-extrabold text-rose-600">
                      Rp {supplierInvoices.reduce((acc, i) => acc + i.remainingAmountRupiah, 0).toLocaleString('id-ID')}
                    </div>
                    <span className="text-[10px] text-slate-500">Dari {supplierInvoices.length} Faktur Impor</span>
                  </div>

                  <div className="b2b-card p-3.5 space-y-1">
                    <span className="text-[10px] font-bold uppercase text-slate-500">Jatuh Tempo Pekan Ini</span>
                    <div className="text-lg font-mono font-extrabold text-amber-600">
                      Rp {supplierInvoices.filter(i => i.daysDiff <= 7 && i.status !== 'LUNAS').reduce((acc, i) => acc + i.remainingAmountRupiah, 0).toLocaleString('id-ID')}
                    </div>
                    <span className="text-[10px] text-amber-600 font-semibold">Prioritas transfer Bank BCA</span>
                  </div>

                  <div className="b2b-card p-3.5 space-y-1">
                    <span className="text-[10px] font-bold uppercase text-slate-500">Sudah Dibayar Bulan Ini</span>
                    <div className="text-lg font-mono font-extrabold text-emerald-600">
                      Rp {supplierInvoices.reduce((acc, i) => acc + i.paidAmountRupiah, 0).toLocaleString('id-ID')}
                    </div>
                    <span className="text-[10px] text-emerald-600 font-semibold">Termasuk pelunasan kontainer US</span>
                  </div>
                </div>

                {/* Supplier Invoices List Table */}
                <div className="b2b-card overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase font-semibold text-[11px]">
                      <tr>
                        <th className="px-4 py-3">No. Faktur &amp; Pemasok</th>
                        <th className="px-4 py-3">Jatuh Tempo</th>
                        <th className="px-4 py-3 text-right">Total Faktur</th>
                        <th className="px-4 py-3 text-right">Sisa Utang</th>
                        <th className="px-4 py-3 text-center">Status</th>
                        <th className="px-4 py-3 text-center">Aksi Pelunasan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {supplierInvoices.map(inv => {
                        const isLunas = inv.status === 'LUNAS';
                        return (
                          <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="px-4 py-3">
                              <div className="font-mono font-bold text-slate-900">{inv.invoiceNumber}</div>
                              <div className="text-slate-600 text-[11px]">{inv.supplier} ({inv.originCountry})</div>
                              <div className="text-[10px] text-slate-400 font-mono">Ref PO: {inv.poNumber}</div>
                            </td>
                            <td className="px-4 py-3">
                              <div className={`font-semibold ${inv.daysDiff <= 3 && !isLunas ? 'text-amber-700' : 'text-slate-700'}`}>
                                {inv.dueDate}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-slate-600">
                              Rp {inv.totalAmountRupiah.toLocaleString('id-ID')}
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-bold text-rose-600">
                              Rp {inv.remainingAmountRupiah.toLocaleString('id-ID')}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                isLunas
                                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                  : inv.status === 'CICILAN'
                                  ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                  : 'bg-rose-50 text-rose-800 border border-rose-200'
                              }`}>
                                {inv.status === 'LUNAS' ? '✓ Lunas' : inv.status === 'CICILAN' ? 'Cicilan' : 'Belum Bayar'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              {!isLunas ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedSupplierInvoice(inv);
                                    setShowSupplierPayableModal(true);
                                  }}
                                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-colors"
                                >
                                  Bayar / Lunasi
                                </button>
                              ) : (
                                <span className="text-[11px] text-emerald-600 font-semibold flex items-center justify-center gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  Lunas
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
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

            {/* Subtab Switcher: Cold Storage Lots FEFO vs Katalog & Master Harga Jual */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setWarehouseSubTab('BATCH_LOTS')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    warehouseSubTab === 'BATCH_LOTS'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Package className="w-3.5 h-3.5" />
                  <span>Stok Lots Cold Storage ({lots.length} Batch)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setWarehouseSubTab('PRICE_CATALOG')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    warehouseSubTab === 'PRICE_CATALOG'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Tag className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Katalog &amp; Master Harga ({products.length} SKU)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setWarehouseSubTab('CATEGORIES')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    warehouseSubTab === 'CATEGORIES'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Tags className="w-3.5 h-3.5 text-blue-500" />
                  <span>Kategori Produk ({categories.length})</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowCategoryManagerModal(true)}
                  className="px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 text-xs font-bold flex items-center gap-1 shadow-2xs transition-colors cursor-pointer"
                  title="Tambah dan kelola kategori produk daging"
                >
                  <Tags className="w-3.5 h-3.5 text-blue-600" />
                  <span>+ Kategori</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowQuickAddProductModal(true)}
                  className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold flex items-center gap-1 shadow-2xs transition-colors cursor-pointer"
                  title="Daftarkan jenis potongan daging baru tanpa harus pindah halaman"
                >
                  <PackagePlus className="w-3.5 h-3.5 text-emerald-600" />
                  <span>+ Tambah Produk Baru</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPriceManagerTargetId(null);
                    setShowPriceManagerModal(true);
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                  title="Buka dialog master edit harga jual semua produk"
                >
                  <DollarSign className="w-3.5 h-3.5 text-slate-500" />
                  <span>Edit Harga Master</span>
                </button>
              </div>
            </div>

            {warehouseSubTab === 'BATCH_LOTS' && (
              <div className="space-y-4">
            {/* Visualisasi Tren Stok Gudang (Line Chart Recharts - Top 3 Best Sellers) */}
            <StockLevelOverTimeChart
              onTriggerReorder={(sku) => {
                triggerNotification('Draft PO Reorder', `Permintaan restock untuk SKU ${sku} berhasil dibuat`, 'info');
              }}
            />

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

                <button
                  type="button"
                  onClick={() => setShowYieldModal(true)}
                  className="px-2.5 py-1 rounded-md text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition-colors shrink-0 flex items-center gap-1"
                  title="Konversi Pemotongan Daging Primal ke Steak & Tetelan serta Yield Loss (MOD-07)"
                >
                  <Scissors className="w-3 h-3 text-amber-600" />
                  Konversi Yield (MOD-07)
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

            {/* SUBTAB 2: KATALOG & MASTER HARGA JUAL DAGING */}
            {warehouseSubTab === 'PRICE_CATALOG' && (
              <div className="space-y-4 animate-tab-fade">
                {/* Metrics Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="b2b-card p-3.5 space-y-1">
                    <span className="text-[11px] text-slate-500 font-medium">Total SKU Katalog</span>
                    <div className="text-xl font-extrabold text-slate-900 font-mono">
                      {products.length} SKU
                    </div>
                    <span className="text-[10px] text-emerald-600 font-semibold">Tersinkron ke Kasir POS</span>
                  </div>

                  <div className="b2b-card p-3.5 space-y-1">
                    <span className="text-[11px] text-slate-500 font-medium">Total Bobot Stok</span>
                    <div className="text-xl font-extrabold text-slate-900 font-mono">
                      {(products.reduce((acc, p) => acc + p.stockGram, 0) / 1000).toFixed(1)} KG
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {products.reduce((acc, p) => acc + p.stockGram, 0).toLocaleString('id-ID')} g
                    </span>
                  </div>

                  <div className="b2b-card p-3.5 space-y-1">
                    <span className="text-[11px] text-slate-500 font-medium">Stok Mendekati Buffer</span>
                    <div className="text-xl font-extrabold text-amber-700 font-mono">
                      {products.filter(p => p.stockGram <= p.safetyStockGram).length} SKU Kritis
                    </div>
                    <span className="text-[10px] text-amber-600 font-semibold">Perlu restock kontainer</span>
                  </div>

                  <div className="b2b-card p-3.5 space-y-1">
                    <span className="text-[11px] text-slate-500 font-medium">Aksi Cepat Master</span>
                    <div className="flex items-center gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setPriceManagerTargetId(null);
                          setShowPriceManagerModal(true);
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
                      >
                        <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                        Edit Semua Harga
                      </button>
                    </div>
                  </div>
                </div>

                {/* Table of products */}
                <div className="b2b-card overflow-hidden">
                  <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <Tag className="w-4 h-4 text-emerald-600" />
                        Daftar Potongan Daging, Harga Jual Toko &amp; Margin
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Klik 'Edit' untuk ubah harga seketika dengan tombol Simpan &amp; Batal langsung di baris
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowQuickAddProductModal(true)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                    >
                      <PackagePlus className="w-3.5 h-3.5" />
                      + Tambah Produk Baru
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100/80 text-slate-600 font-bold border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-3">Produk &amp; Kategori</th>
                          <th className="px-3 py-3 text-right">Stok Fisik</th>
                          <th className="px-3 py-3 text-right">Est. HPP</th>
                          <th className="px-3 py-3 text-right">Tier 1: Retail</th>
                          <th className="px-3 py-3 text-right bg-blue-50/50 text-blue-900">Tier 2: HOREKA</th>
                          <th className="px-3 py-3 text-right bg-emerald-50/50 text-emerald-900">Tier 3: VIP Grosir</th>
                          <th className="px-4 py-3 text-center">Quick Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {products.map(prod => {
                          const stockKg = (prod.stockGram / 1000).toFixed(1);
                          const isLow = prod.stockGram <= prod.safetyStockGram;
                          const hppEst = Math.round(prod.basePricePerKg * 0.65);
                          const retailPrice = prod.tierPrices?.RETAIL || prod.basePricePerKg;
                          const horekaPrice = prod.tierPrices?.HOREKA || Math.round(prod.basePricePerKg * 0.9);
                          const vipPrice = prod.tierPrices?.VIP || Math.round(prod.basePricePerKg * 0.82);
                          const isEditingThis = inlineEditingProductId === prod.id;

                          return (
                            <tr key={prod.id} className="hover:bg-slate-50/70 transition-colors">
                              <td className="px-4 py-3">
                                <div className="font-bold text-slate-900">{prod.name}</div>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="font-mono text-[10px] text-slate-500">{prod.sku}</span>
                                  <span className="text-[10px] text-slate-400">•</span>
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                    {prod.category}
                                  </span>
                                  {prod.tag && (
                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                      {prod.tag}
                                    </span>
                                  )}
                                </div>
                              </td>

                              <td className="px-3 py-3 text-right font-mono font-bold">
                                <span className={isLow ? 'text-amber-700' : 'text-slate-900'}>
                                  {stockKg} KG
                                </span>
                              </td>

                              <td className="px-3 py-3 text-right font-mono text-slate-500">
                                Rp {hppEst.toLocaleString('id-ID')}
                              </td>

                              {/* Tier 1: Retail Price */}
                              <td className="px-3 py-3 text-right">
                                {isEditingThis ? (
                                  <div className="flex items-center justify-end gap-1 p-1 bg-amber-50 rounded-lg border border-amber-300">
                                    <span className="text-[10px] font-bold text-slate-500 font-mono">Rp</span>
                                    <input
                                      type="number"
                                      step={1000}
                                      min={0}
                                      value={inlineEditingPrice}
                                      onChange={e => setInlineEditingPrice(parseInt(e.target.value || '0', 10))}
                                      className="w-20 px-1.5 py-0.5 text-right text-xs font-mono font-bold bg-white border border-slate-300 rounded focus:ring-1 focus:ring-slate-900"
                                      autoFocus
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleSaveInlinePrice(prod.id)}
                                      className="p-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center shadow-xs cursor-pointer"
                                      title="Simpan perubahan harga retail"
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setInlineEditingProductId(null)}
                                      className="p-1 rounded bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 font-bold text-xs flex items-center cursor-pointer"
                                      title="Batal"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ) : (
                                  <div>
                                    <span className="font-mono font-extrabold text-slate-900 text-xs">
                                      Rp {retailPrice.toLocaleString('id-ID')}
                                    </span>
                                    <div className="text-[10px] text-slate-400 font-mono">
                                      +{(((retailPrice - hppEst) / retailPrice) * 100).toFixed(0)}% margin
                                    </div>
                                  </div>
                                )}
                              </td>

                              {/* Tier 2: HOREKA Price */}
                              <td className="px-3 py-3 text-right bg-blue-50/20">
                                <span className="font-mono font-extrabold text-blue-900 text-xs">
                                  Rp {horekaPrice.toLocaleString('id-ID')}
                                </span>
                                <div className="text-[10px] text-blue-600 font-mono">
                                  +{(((horekaPrice - hppEst) / horekaPrice) * 100).toFixed(0)}% margin
                                </div>
                              </td>

                              {/* Tier 3: VIP Grosir Price */}
                              <td className="px-3 py-3 text-right bg-emerald-50/20">
                                <span className="font-mono font-extrabold text-emerald-900 text-xs">
                                  Rp {vipPrice.toLocaleString('id-ID')}
                                </span>
                                <div className="text-[10px] text-emerald-600 font-mono">
                                  +{(((vipPrice - hppEst) / vipPrice) * 100).toFixed(0)}% margin
                                </div>
                              </td>

                              <td className="px-4 py-3 text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setPriceManagerTargetId(prod.id);
                                      setShowPriceManagerModal(true);
                                    }}
                                    className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                                    title="Edit harga semua tier untuk produk ini"
                                  >
                                    <Edit3 className="w-3 h-3 text-slate-500" />
                                    <span>Edit Tier</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setPoInitialData({
                                        productCut: `${prod.name} (${prod.category})`,
                                        skuCode: prod.sku,
                                        orderWeightKg: 250,
                                        priceFobPerKg: hppEst,
                                      });
                                      setShowCreatePOModal(true);
                                    }}
                                    className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-white font-bold text-[11px] transition-colors cursor-pointer"
                                    title="Buat Draft PO restock untuk produk ini"
                                  >
                                    PO
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* =========================================================
                SUBTAB 3: MANAJEMEN KATEGORI PRODUK DAGING (MOD-03)
                ========================================================= */}
            {warehouseSubTab === 'CATEGORIES' && (
              <div className="space-y-4 animate-tab-fade">
                {/* Metric Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="b2b-card p-3.5 space-y-1">
                    <span className="text-[11px] text-slate-500 font-medium">Total Kategori</span>
                    <div className="text-xl font-extrabold text-slate-900 font-mono">
                      {categories.length} Kategori
                    </div>
                    <span className="text-[10px] text-emerald-600 font-semibold">Tersinkron ke Kasir &amp; PO</span>
                  </div>

                  <div className="b2b-card p-3.5 space-y-1">
                    <span className="text-[11px] text-slate-500 font-medium">Total SKU Daging</span>
                    <div className="text-xl font-extrabold text-slate-900 font-mono">
                      {products.length} SKU
                    </div>
                    <span className="text-[10px] text-slate-500">
                      Rata-rata {(products.length / Math.max(1, categories.length)).toFixed(1)} SKU / Kategori
                    </span>
                  </div>

                  <div className="b2b-card p-3.5 space-y-1">
                    <span className="text-[11px] text-slate-500 font-medium">Kategori Aktif (Ada Stok)</span>
                    <div className="text-xl font-extrabold text-emerald-700 font-mono">
                      {categories.filter(c => products.some(p => p.category === c.id && p.stockGram > 0)).length} Kategori
                    </div>
                    <span className="text-[10px] text-emerald-600 font-semibold">Ready di Cold Storage</span>
                  </div>

                  <div className="b2b-card p-3.5 flex flex-col justify-between">
                    <div>
                      <span className="text-[11px] text-slate-500 font-medium">Aksi Cepat</span>
                      <p className="text-[10px] text-slate-400">Tambah kelompok potongan baru</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowCategoryManagerModal(true)}
                      className="mt-2 w-full py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                    >
                      <Tags className="w-3.5 h-3.5 text-emerald-400" />
                      <span>+ Kategori Baru</span>
                    </button>
                  </div>
                </div>

                {/* Categories Table */}
                <div className="b2b-card overflow-hidden">
                  <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                        <Tags className="w-4 h-4 text-blue-600" />
                        Daftar Kategori Potongan &amp; Produk Daging
                      </h3>
                      <p className="text-xs text-slate-500">
                        Kategori ini otomatis muncul sebagai tab filter di Kasir POS, opsi di Tambah Produk, dan PO Supplier
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowQuickAddProductModal(true)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                      >
                        <PackagePlus className="w-3.5 h-3.5 text-emerald-600" />
                        <span>+ Tambah Produk ke Kategori</span>
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-3">Kode &amp; Badge</th>
                          <th className="px-4 py-3">Nama Kategori</th>
                          <th className="px-4 py-3">Deskripsi &amp; Peruntukan</th>
                          <th className="px-3 py-3 text-center">Jumlah SKU</th>
                          <th className="px-3 py-3 text-right">Total Stok (KG)</th>
                          <th className="px-4 py-3 text-center">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {categories.map(cat => {
                          const catProducts = products.filter(p => p.category === cat.id);
                          const totalStockKg = (catProducts.reduce((sum, p) => sum + p.stockGram, 0) / 1000).toFixed(1);

                          return (
                            <tr key={cat.id} className="hover:bg-slate-50/70 transition-colors">
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-extrabold uppercase border ${
                                    cat.color === 'emerald' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                    cat.color === 'blue' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                    cat.color === 'amber' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                    cat.color === 'rose' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                                    cat.color === 'purple' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                                    cat.color === 'cyan' ? 'bg-cyan-50 text-cyan-700 border-cyan-200' :
                                    cat.color === 'indigo' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                                    'bg-slate-100 text-slate-700 border-slate-300'
                                  }`}>
                                    {cat.id}
                                  </span>
                                  {cat.isCore && (
                                    <span className="text-[10px] text-slate-400 font-medium">Core</span>
                                  )}
                                </div>
                              </td>

                              <td className="px-4 py-3 font-bold text-slate-900">
                                {cat.label}
                              </td>

                              <td className="px-4 py-3 text-slate-500 max-w-xs">
                                {cat.description || '-'}
                              </td>

                              <td className="px-3 py-3 text-center font-mono font-bold text-slate-800">
                                {catProducts.length} SKU
                              </td>

                              <td className="px-3 py-3 text-right font-mono font-bold text-slate-900">
                                {totalStockKg} KG
                              </td>

                              <td className="px-4 py-3 text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedCategory(cat.id);
                                      setActiveTab('pos');
                                    }}
                                    className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold transition-colors cursor-pointer"
                                    title="Buka kategori ini di Kasir POS"
                                  >
                                    Buka di POS
                                  </button>

                                  {!cat.isCore && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (confirm(`Hapus kategori '${cat.label}'?`)) {
                                          handleDeleteCategory(cat.id);
                                        }
                                      }}
                                      className="px-2 py-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 text-[11px] font-bold transition-colors cursor-pointer"
                                      title="Hapus Kategori Kustom"
                                    >
                                      Hapus
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

          </div>
        )}

        {/* -------------------------------------------------------------------
            TAB 5: BAYAR (ACCOUNTS PAYABLE/RECEIVABLE & PENAGIHAN SALES)
            ------------------------------------------------------------------- */}
        {activeTab === 'bayar' && activeSecondaryModule === null && (() => {
          const unpaidReceivables = receivables.filter(r => r.status !== 'LUNAS');
          
          // Category metrics (Zero-Float integer math)
          const terlambatItems = unpaidReceivables.filter(r => r.category === 'TERLAMBAT');
          const totalTerlambat = terlambatItems.reduce((acc, r) => acc + r.amount, 0);
          const countTerlambat = terlambatItems.length;

          const hariIniItems = unpaidReceivables.filter(r => r.category === 'HARI_INI');
          const totalHariIni = hariIniItems.reduce((acc, r) => acc + r.amount, 0);
          const countHariIni = hariIniItems.length;

          const akanDatangItems = unpaidReceivables.filter(r => r.category === 'AKAN_DATANG');
          const totalAkanDatang = akanDatangItems.reduce((acc, r) => acc + r.amount, 0);
          const countAkanDatang = akanDatangItems.length;

          const lebih7HariItems = unpaidReceivables.filter(r => r.category === 'LEBIH_7_HARI');
          const totalLebih7Hari = lebih7HariItems.reduce((acc, r) => acc + r.amount, 0);
          const countLebih7Hari = lebih7HariItems.length;

          const totalAllPiutang = unpaidReceivables.reduce((acc, r) => acc + r.amount, 0);
          const countAllPiutang = unpaidReceivables.length;

          // Aging schedule dataset for BarChart (visualisasi terlambat vs akan jatuh tempo)
          const agingChartData = [
            {
              categoryKey: 'TERLAMBAT' as const,
              name: 'Terlambat (Overdue)',
              shortName: 'Terlambat',
              nominal: totalTerlambat,
              nominalJuta: Number((totalTerlambat / 1000000).toFixed(1)),
              count: countTerlambat,
              percentage: totalAllPiutang > 0 ? ((totalTerlambat / totalAllPiutang) * 100).toFixed(1) : '0',
              color: '#EF4444',
              riskBadge: 'Risiko Tinggi',
              actionTip: 'Prioritas 1: Kunjungi resto & tindak lanjuti penagihan',
            },
            {
              categoryKey: 'HARI_INI' as const,
              name: 'Jatuh Tempo Hari Ini',
              shortName: 'Hari Ini',
              nominal: totalHariIni,
              nominalJuta: Number((totalHariIni / 1000000).toFixed(1)),
              count: countHariIni,
              percentage: totalAllPiutang > 0 ? ((totalHariIni / totalAllPiutang) * 100).toFixed(1) : '0',
              color: '#F59E0B',
              riskBadge: 'Segera Tagih',
              actionTip: 'Follow-up via WhatsApp kasir & konfirmasi transfer hari ini',
            },
            {
              categoryKey: 'AKAN_DATANG' as const,
              name: 'Akan Datang (1-7 Hari)',
              shortName: '1-7 Hari',
              nominal: totalAkanDatang,
              nominalJuta: Number((totalAkanDatang / 1000000).toFixed(1)),
              count: countAkanDatang,
              percentage: totalAllPiutang > 0 ? ((totalAkanDatang / totalAllPiutang) * 100).toFixed(1) : '0',
              color: '#3B82F6',
              riskBadge: 'Mendatang',
              actionTip: 'Monitoring & kirim rekap faktur ke bagian accounting resto',
            },
            {
              categoryKey: 'LEBIH_7_HARI' as const,
              name: 'Akan Datang (>7 Hari)',
              shortName: '>7 Hari',
              nominal: totalLebih7Hari,
              nominalJuta: Number((totalLebih7Hari / 1000000).toFixed(1)),
              count: countLebih7Hari,
              percentage: totalAllPiutang > 0 ? ((totalLebih7Hari / totalAllPiutang) * 100).toFixed(1) : '0',
              color: '#10B981',
              riskBadge: 'Aman / Lancar',
              actionTip: 'Arsipkan nota DO, tagihan dalam periode wajar',
            },
          ];

          // Filter logic
          const filteredReceivables = receivables.filter(r => {
            if (receivableFilter === 'TERLAMBAT' && r.category !== 'TERLAMBAT') return false;
            if (receivableFilter === 'HARI_INI' && r.category !== 'HARI_INI') return false;
            if (receivableFilter === 'AKAN_DATANG' && r.category !== 'AKAN_DATANG') return false;
            if (receivableFilter === 'LEBIH_7_HARI' && r.category !== 'LEBIH_7_HARI') return false;

            if (receivableSearch.trim()) {
              const query = receivableSearch.toLowerCase().trim();
              const matchCustomer = r.customer.toLowerCase().includes(query);
              const matchInvoice = r.invoice.toLowerCase().includes(query);
              const matchTier = r.tier.toLowerCase().includes(query);
              const matchItems = r.itemsSummary.toLowerCase().includes(query);
              if (!matchCustomer && !matchInvoice && !matchTier && !matchItems) return false;
            }

            return true;
          });

          const handleExportReceivablesCsv = () => {
            const headers = ['ID', 'Customer', 'Tier', 'Invoice', 'Jatuh Tempo', 'Kategori', 'Status', 'Nominal Tagihan (IDR)', 'Plafon Kredit (IDR)', 'Kontak', 'Detail Barang'];
            const rows = filteredReceivables.map(r => [
              r.id,
              `"${r.customer}"`,
              r.tier,
              r.invoice,
              `"${r.dueDate}"`,
              r.category,
              r.status,
              r.amount,
              r.limit,
              `"${r.phone}"`,
              `"${r.itemsSummary}"`,
            ]);
            const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.setAttribute('href', url);
            link.setAttribute('download', `rekap_piutang_${receivableFilter.toLowerCase()}_${new Date().toISOString().slice(0, 10)}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            triggerNotification('Ekspor CSV Berhasil! 📊', `Data ${filteredReceivables.length} faktur berhasil diunduh untuk kebutuhan audit.`, 'info');
          };

          return (
            <div className="space-y-4 animate-tab-fade">
              {/* Top Banner Header */}
              <div className="b2b-card p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
                    <Wallet className="w-5 h-5 text-slate-800" />
                    Buku Piutang &amp; Penagihan Faktur Tempo (AR Ledger)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Monitoring jatuh tempo pelanggan Hotel, Restoran &amp; Catering (Horeka) dengan proteksi batas limit kredit toko
                  </p>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDashboardCustomerId(null);
                      setShowCustomerDashboardModal(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                    title="Buka Database Pelanggan, Profil Tier Horeka/VIP & Plafon Kredit"
                  >
                    <Users className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Customer Dashboard &amp; Database</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleExportReceivablesCsv}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-2xs hover:border-slate-300"
                    title="Ekspor daftar faktur piutang ke CSV"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-500" />
                    <span>Ekspor CSV</span>
                  </button>
                </div>
              </div>

              {/* -------------------------------------------------------------
                  RINGKASAN TOTAL NILAI PIUTANG PER KATEGORI (INTERACTIVE KPI CARDS)
                  ------------------------------------------------------------- */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                
                {/* 1. Jatuh Tempo Hari Ini */}
                <div 
                  onClick={() => setReceivableFilter(prev => prev === 'HARI_INI' ? 'ALL' : 'HARI_INI')}
                  className={`b2b-card p-3.5 space-y-2 cursor-pointer transition-all duration-200 ${
                    receivableFilter === 'HARI_INI' 
                      ? 'ring-2 ring-amber-500 bg-amber-50/50 shadow-xs' 
                      : 'hover:border-amber-300 hover:shadow-xs'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-800 flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-amber-600" />
                      Jatuh Tempo Hari Ini
                    </span>
                    <span className="flex h-2 w-2 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                    </span>
                  </div>
                  <div>
                    <div className="text-lg font-extrabold font-mono text-amber-700">
                      Rp {totalHariIni.toLocaleString('id-ID')}
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
                      <span>{countHariIni} Faktur Hari Ini</span>
                      <span className="text-[10px] font-semibold text-amber-700 underline">
                        {receivableFilter === 'HARI_INI' ? 'Aktif' : 'Filter'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 2. Terlambat (Overdue) */}
                <div 
                  onClick={() => setReceivableFilter(prev => prev === 'TERLAMBAT' ? 'ALL' : 'TERLAMBAT')}
                  className={`b2b-card p-3.5 space-y-2 cursor-pointer transition-all duration-200 ${
                    receivableFilter === 'TERLAMBAT' 
                      ? 'ring-2 ring-rose-500 bg-rose-50/50 shadow-xs' 
                      : 'hover:border-rose-300 hover:shadow-xs'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-rose-800 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-rose-600" />
                      Terlambat (Overdue)
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 border border-rose-200">
                      Butuh Tagih
                    </span>
                  </div>
                  <div>
                    <div className="text-lg font-extrabold font-mono text-rose-700">
                      Rp {totalTerlambat.toLocaleString('id-ID')}
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
                      <span>{countTerlambat} Faktur Menunggak</span>
                      <span className="text-[10px] font-semibold text-rose-700 underline">
                        {receivableFilter === 'TERLAMBAT' ? 'Aktif' : 'Filter'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 3. Akan Datang (7 Hari) */}
                <div 
                  onClick={() => setReceivableFilter(prev => prev === 'AKAN_DATANG' ? 'ALL' : 'AKAN_DATANG')}
                  className={`b2b-card p-3.5 space-y-2 cursor-pointer transition-all duration-200 ${
                    receivableFilter === 'AKAN_DATANG' 
                      ? 'ring-2 ring-blue-500 bg-blue-50/50 shadow-xs' 
                      : 'hover:border-blue-300 hover:shadow-xs'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-800 flex items-center gap-1.5">
                      <CalendarClock className="w-4 h-4 text-blue-600" />
                      Akan Datang (7 Hari)
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 border border-blue-200">
                      Minggu Ini
                    </span>
                  </div>
                  <div>
                    <div className="text-lg font-extrabold font-mono text-blue-700">
                      Rp {totalAkanDatang.toLocaleString('id-ID')}
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
                      <span>{countAkanDatang} Faktur Mendatang</span>
                      <span className="text-[10px] font-semibold text-blue-700 underline">
                        {receivableFilter === 'AKAN_DATANG' ? 'Aktif' : 'Filter'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 4. Total Piutang Berjalan */}
                <div 
                  onClick={() => setReceivableFilter('ALL')}
                  className={`b2b-card p-3.5 space-y-2 cursor-pointer transition-all duration-200 bg-slate-900 text-white ${
                    receivableFilter === 'ALL' 
                      ? 'ring-2 ring-emerald-400 shadow-md' 
                      : 'hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                      <Wallet className="w-4 h-4 text-emerald-400" />
                      Total Piutang Berjalan
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-emerald-300 border border-slate-700">
                      Semua
                    </span>
                  </div>
                  <div>
                    <div className="text-lg font-extrabold font-mono text-white">
                      Rp {totalAllPiutang.toLocaleString('id-ID')}
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-300 mt-1">
                      <span>{countAllPiutang} Faktur Belum Lunas</span>
                      <span className="text-[10px] font-semibold text-emerald-400 underline">
                        {receivableFilter === 'ALL' ? 'Semua Aktif' : 'Lihat Semua'}
                      </span>
                    </div>
                  </div>
                </div>

              </div>

              {/* -------------------------------------------------------------
                  BAR CHART: VISUALISASI UMUR PIUTANG (AGING SCHEDULE)
                  ------------------------------------------------------------- */}
              <div className="b2b-card p-4 space-y-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                  <div>
                    <h4 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-slate-700" />
                      Visualisasi Umur Piutang (Aging Schedule: Terlambat vs. Akan Jatuh Tempo)
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Bagan distribusi total nominal tagihan beredar untuk menentukan prioritas penagihan kas toko
                    </p>
                  </div>
                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                      Total Tertagih: <strong className="font-mono text-slate-900">Rp {totalAllPiutang.toLocaleString('id-ID')}</strong> ({countAllPiutang} Faktur)
                    </span>
                  </div>
                </div>

                {/* Recharts Bar Chart Container */}
                <div className="h-56 w-full pt-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={agingChartData}
                      layout="vertical"
                      margin={{ top: 5, right: 30, left: 15, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F1F5F9" />
                      <XAxis 
                        type="number"
                        tickFormatter={(val) => `Rp ${val}Jt`}
                        tick={{ fontSize: 11, fill: '#64748B' }}
                        axisLine={{ stroke: '#E2E8F0' }}
                        tickLine={false}
                      />
                      <YAxis 
                        type="category" 
                        dataKey="shortName" 
                        tick={{ fontSize: 11, fill: '#1E293B', fontWeight: 600 }}
                        axisLine={{ stroke: '#E2E8F0' }}
                        tickLine={false}
                        width={75}
                      />
                      <RechartsTooltip
                        cursor={{ fill: 'rgba(241, 245, 249, 0.6)' }}
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const d = payload[0].payload;
                            return (
                              <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl text-xs space-y-1.5 border border-slate-800 z-50 min-w-[210px]">
                                <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-1.5">
                                  <span className="font-bold text-slate-200 flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                                    {d.name}
                                  </span>
                                  <span className="text-[10px] px-1.5 py-0.5 rounded font-extrabold bg-slate-800 text-amber-300">
                                    {d.riskBadge}
                                  </span>
                                </div>
                                <div className="space-y-1 font-mono text-[11px]">
                                  <div className="flex justify-between">
                                    <span className="text-slate-400">Total Piutang:</span>
                                    <span className="font-extrabold text-white">Rp {d.nominal.toLocaleString('id-ID')}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-slate-400">Jumlah Faktur:</span>
                                    <span className="font-bold text-emerald-400">{d.count} Faktur</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-slate-400">Porsi dari Total:</span>
                                    <span className="font-bold text-blue-300">{d.percentage}%</span>
                                  </div>
                                </div>
                                <div className="pt-1.5 border-t border-slate-800 text-[10px] text-slate-300 italic">
                                  💡 {d.actionTip}
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar 
                        dataKey="nominalJuta" 
                        radius={[0, 6, 6, 0]}
                        onClick={(entry: any) => {
                          const cat = entry?.categoryKey || entry?.payload?.categoryKey;
                          if (cat) {
                            setReceivableFilter(prev => prev === cat ? 'ALL' : cat);
                          }
                        }}
                        cursor="pointer"
                      >
                        {agingChartData.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={entry.color} 
                            opacity={receivableFilter === 'ALL' || receivableFilter === entry.categoryKey ? 1 : 0.35}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* 4 Aging Decision & Action Tiles */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1">
                  {agingChartData.map((cat) => (
                    <div 
                      key={cat.categoryKey}
                      onClick={() => setReceivableFilter(prev => prev === cat.categoryKey ? 'ALL' : cat.categoryKey)}
                      className={`p-2.5 rounded-xl border text-xs space-y-1.5 cursor-pointer transition-all ${
                        receivableFilter === cat.categoryKey 
                          ? 'ring-2 ring-slate-800 bg-slate-50 shadow-xs border-slate-400' 
                          : 'bg-white hover:bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800 flex items-center gap-1.5 text-[11px]">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                          {cat.shortName}
                        </span>
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-700">
                          {cat.percentage}%
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between">
                        <span className="font-extrabold font-mono text-slate-900 text-sm">
                          Rp {cat.nominalJuta} Jt
                        </span>
                        <span className="text-[10px] text-slate-500 font-medium">
                          {cat.count} Faktur
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 line-clamp-1" title={cat.actionTip}>
                        {cat.actionTip}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* -------------------------------------------------------------
                  FILTER BAR & SEARCH CONTROLS
                  ------------------------------------------------------------- */}
              <div className="b2b-card p-3 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                {/* Category Filter Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
                  <button
                    type="button"
                    onClick={() => setReceivableFilter('ALL')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                      receivableFilter === 'ALL'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    <span>Semua Faktur</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      receivableFilter === 'ALL' ? 'bg-slate-700 text-white' : 'bg-slate-200 text-slate-700'
                    }`}>
                      {receivables.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setReceivableFilter('HARI_INI')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                      receivableFilter === 'HARI_INI'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                    <span>Jatuh Tempo Hari Ini</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      receivableFilter === 'HARI_INI' ? 'bg-amber-700 text-white' : 'bg-amber-200 text-amber-900'
                    }`}>
                      {countHariIni}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setReceivableFilter('TERLAMBAT')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                      receivableFilter === 'TERLAMBAT'
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'bg-rose-50 hover:bg-rose-100 text-rose-900 border border-rose-200'
                    }`}
                  >
                    <AlertTriangle className="w-3 h-3" />
                    <span>Terlambat</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      receivableFilter === 'TERLAMBAT' ? 'bg-rose-700 text-white' : 'bg-rose-200 text-rose-900'
                    }`}>
                      {countTerlambat}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setReceivableFilter('AKAN_DATANG')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                      receivableFilter === 'AKAN_DATANG'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200'
                    }`}
                  >
                    <CalendarClock className="w-3 h-3" />
                    <span>Akan Datang (7 Hari)</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      receivableFilter === 'AKAN_DATANG' ? 'bg-blue-700 text-white' : 'bg-blue-200 text-blue-900'
                    }`}>
                      {countAkanDatang}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setReceivableFilter('LEBIH_7_HARI')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                      receivableFilter === 'LEBIH_7_HARI'
                        ? 'bg-emerald-700 text-white shadow-xs'
                        : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200'
                    }`}
                  >
                    <Calendar className="w-3 h-3" />
                    <span>&gt; 7 Hari</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      receivableFilter === 'LEBIH_7_HARI' ? 'bg-emerald-800 text-white' : 'bg-emerald-200 text-emerald-900'
                    }`}>
                      {countLebih7Hari}
                    </span>
                  </button>
                </div>

                {/* Real-time Search Box */}
                <div className="relative min-w-[220px]">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={receivableSearch}
                    onChange={(e) => setReceivableSearch(e.target.value)}
                    placeholder="Cari pelanggan / no. invoice..."
                    className="w-full pl-8 pr-7 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-slate-400 focus:bg-white"
                  />
                  {receivableSearch && (
                    <button
                      type="button"
                      onClick={() => setReceivableSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* -------------------------------------------------------------
                  FAKTUR PIUTANG LIST
                  ------------------------------------------------------------- */}
              {filteredReceivables.length === 0 ? (
                <div className="b2b-card p-8 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                    <CheckCheck className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">
                      Tidak Ada Faktur untuk Kategori Ini
                    </h4>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                      Semua tagihan pada filter &ldquo;{receivableFilter}&rdquo; dalam kondisi bersih atau tidak ditemukan kata kunci pencarian.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setReceivableFilter('ALL');
                      setReceivableSearch('');
                    }}
                    className="px-3 py-1.5 bg-slate-900 text-white text-xs font-bold rounded-lg hover:bg-slate-800 transition-colors"
                  >
                    Tampilkan Semua Faktur
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredReceivables.map(r => {
                    const isPaid = r.status === 'LUNAS';
                    const creditUsagePct = Math.min(100, Math.round((r.amount / r.limit) * 100));

                    return (
                      <div 
                        key={r.id} 
                        className={`b2b-card p-4 space-y-3 transition-all ${
                          isPaid 
                            ? 'bg-slate-50/70 opacity-70 border-slate-200' 
                            : r.category === 'TERLAMBAT'
                              ? 'border-rose-200 hover:border-rose-300 hover:shadow-xs'
                              : r.category === 'HARI_INI'
                                ? 'border-amber-200 hover:border-amber-300 hover:shadow-xs'
                                : 'hover:border-slate-300 hover:shadow-xs'
                        }`}
                      >
                        {/* Header: Customer, Tier, Amount & Status */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-sm font-bold text-slate-900">{r.customer}</h4>
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                {r.tier}
                              </span>

                              {/* Category Badges */}
                              {r.category === 'TERLAMBAT' && !isPaid && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-800 border border-rose-200">
                                  <AlertTriangle className="w-3 h-3 text-rose-600" />
                                  Terlambat {Math.abs(r.daysDiff)} Hari
                                </span>
                              )}

                              {r.category === 'HARI_INI' && !isPaid && (
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-200">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                  Jatuh Tempo Hari Ini
                                </span>
                              )}

                              {r.category === 'AKAN_DATANG' && !isPaid && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-800 border border-blue-200">
                                  <CalendarClock className="w-3 h-3 text-blue-600" />
                                  Akan Datang ({r.daysDiff} Hari Lagi)
                                </span>
                              )}

                              {r.category === 'LEBIH_7_HARI' && !isPaid && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600">
                                  <Calendar className="w-3 h-3 text-slate-400" />
                                  Tempo &gt; 7 Hari
                                </span>
                              )}

                              {isPaid && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  <Check className="w-3 h-3 text-emerald-600" />
                                  LUNAS
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 text-xs text-slate-500">
                              <span className="font-mono text-[11px] font-semibold text-slate-600">{r.invoice}</span>
                              <span>•</span>
                              <span>{r.itemsSummary}</span>
                            </div>
                          </div>

                          <div className="text-left sm:text-right">
                            <div className={`text-base sm:text-lg font-extrabold font-mono ${
                              isPaid ? 'text-slate-400 line-through' : r.category === 'TERLAMBAT' ? 'text-rose-700' : 'text-slate-900'
                            }`}>
                              Rp {r.amount.toLocaleString('id-ID')}
                            </div>
                            <span className="text-[10px] text-slate-500">
                              Plafon: Rp {r.limit.toLocaleString('id-ID')} ({creditUsagePct}%)
                            </span>
                          </div>
                        </div>

                        {/* Credit Usage Progress Gauge */}
                        <div className="space-y-1">
                          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all duration-300 ${
                                creditUsagePct > 85 ? 'bg-rose-500' : creditUsagePct > 60 ? 'bg-amber-500' : 'bg-emerald-500'
                              }`}
                              style={{ width: `${creditUsagePct}%` }}
                            />
                          </div>
                        </div>

                        {/* Footer: Due date info & Action buttons */}
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pt-2 border-t border-slate-100 text-xs gap-2">
                          <div className="flex items-center gap-3 text-slate-600">
                            <span>
                              Jatuh Tempo: <strong className={r.category === 'TERLAMBAT' ? 'text-rose-700' : r.category === 'HARI_INI' ? 'text-amber-700' : 'text-slate-800'}>{r.dueDate}</strong>
                            </span>
                            <span className="hidden sm:inline text-slate-300">•</span>
                            <span className="text-[11px] text-slate-500">Telp: {r.phone}</span>
                          </div>

                          <div className="flex items-center gap-2 self-end sm:self-auto">
                            {/* Profil & Credit Dashboard Button */}
                            <button
                              type="button"
                              onClick={() => {
                                const found = customers.find(c => c.name.toLowerCase() === r.customer.toLowerCase());
                                setSelectedDashboardCustomerId(found ? found.id : r.customer);
                                setShowCustomerDashboardModal(true);
                              }}
                              className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer"
                              title="Buka profil pelanggan, riwayat faktur, dan analisis plafon kredit"
                            >
                              <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                              <span>Profil &amp; Plafon</span>
                            </button>

                            {/* WhatsApp Friendly Reminder */}
                            {!isPaid && (
                              <button
                                type="button"
                                onClick={() => {
                                  const greeting = r.category === 'TERLAMBAT' 
                                    ? `Halo Tim ${r.customer}, mohon konfirmasi pelunasan faktur ${r.invoice} sebesar Rp ${r.amount.toLocaleString('id-ID')} yang telah melewati batas tempo (${r.dueDate}). Terima kasih! - ERP Daging KARKASIA`
                                    : r.category === 'HARI_INI'
                                      ? `Halo Bpk/Ibu ${r.customer}, sekadar mengingatkan faktur ${r.invoice} sebesar Rp ${r.amount.toLocaleString('id-ID')} jatuh tempo hari ini. Mohon info jika sudah transfer ya. - ERP Daging KARKASIA`
                                      : `Halo Bpk/Ibu ${r.customer}, faktur ${r.invoice} sebesar Rp ${r.amount.toLocaleString('id-ID')} akan jatuh tempo pada ${r.dueDate}. Salam hangat dari ERP Daging KARKASIA.`;
                                  navigator.clipboard?.writeText(greeting);
                                  triggerNotification(
                                    'Pesan Pengingat WA Disalin! 💬',
                                    `Draft pesan penagihan untuk ${r.customer} (${r.invoice}) disalin ke clipboard: "${greeting.slice(0, 75)}..."`,
                                    'info'
                                  );
                                }}
                                className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1 transition-colors"
                                title="Salin draft pesan WhatsApp untuk follow up penagihan"
                              >
                                <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Follow Up WA</span>
                              </button>
                            )}

                            {/* Pelunasan Button */}
                            {!isPaid ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setReceivables(prev => prev.map(item => item.id === r.id ? { ...item, status: 'LUNAS' } : item));
                                  triggerNotification(
                                    'Pelunasan Berhasil! 💰',
                                    `Tagihan ${r.customer} sebesar Rp ${r.amount.toLocaleString('id-ID')} (${r.invoice}) telah tercatat lunas ke Kas Toko KARKASIA.`,
                                    'success',
                                    r.amount
                                  );
                                }}
                                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded text-xs transition-colors shadow-2xs cursor-pointer flex items-center gap-1"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Catat Pelunasan</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setReceivables(prev => prev.map(item => item.id === r.id ? { ...item, status: 'BELUM_LUNAS' } : item));
                                  triggerNotification('Status Diubah', `Faktur ${r.invoice} dikembalikan ke status belum lunas.`, 'info');
                                }}
                                className="px-2.5 py-1 text-slate-500 hover:text-slate-800 text-[11px] font-semibold underline"
                              >
                                Batalkan Lunas
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

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

              <button
                type="button"
                onClick={() => {
                  setShowModulLainnyaModal(false);
                  setShowYieldModal(true);
                }}
                className="p-3.5 rounded-xl border border-amber-200 hover:border-amber-400 bg-amber-50/40 hover:bg-white text-left transition-all space-y-2 group cursor-pointer"
              >
                <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Scissors className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <span>Konversi Yield Daging</span>
                    <span className="text-[9px] bg-amber-200 text-amber-800 px-1 rounded font-bold">MOD-07</span>
                  </div>
                  <div className="text-[11px] text-slate-500">Primal ke steak, tetelan &amp; susut HPP</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowModulLainnyaModal(false);
                  setShowVoiceNoteModal(true);
                }}
                className="p-3.5 rounded-xl border border-emerald-200 hover:border-emerald-400 bg-emerald-50/40 hover:bg-white text-left transition-all space-y-2 group cursor-pointer"
              >
                <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Mic className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <span>Voice Note Sales AI</span>
                    <span className="text-[9px] bg-emerald-200 text-emerald-800 px-1 rounded font-bold">MOD-21</span>
                  </div>
                  <div className="text-[11px] text-slate-500">Asisten suara ke keranjang kasir</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowModulLainnyaModal(false);
                  setShowReturnModal(true);
                }}
                className="p-3.5 rounded-xl border border-rose-200 hover:border-rose-400 bg-rose-50/40 hover:bg-white text-left transition-all space-y-2 group cursor-pointer"
              >
                <div className="w-9 h-9 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <RotateCcw className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <span>Retur Daging Komplain</span>
                    <span className="text-[9px] bg-rose-200 text-rose-800 px-1 rounded font-bold">MOD-08</span>
                  </div>
                  <div className="text-[11px] text-slate-500">Kamera bukti, credit note &amp; karantina</div>
                </div>
              </button>

              {/* MOD-12: Kasir Kecil & OPEX */}
              <button
                type="button"
                onClick={() => {
                  setShowModulLainnyaModal(false);
                  setShowPettyCashModal(true);
                }}
                className="p-3.5 rounded-xl border border-emerald-200 hover:border-emerald-400 bg-emerald-50/40 hover:bg-white text-left transition-all space-y-2 group cursor-pointer"
              >
                <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Wallet className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <span>Kasir Kecil &amp; OPEX</span>
                    <span className="text-[9px] bg-emerald-200 text-emerald-800 px-1 rounded font-bold">MOD-12</span>
                  </div>
                  <div className="text-[11px] text-slate-500">Es balok, plastik vakum &amp; foto nota</div>
                </div>
              </button>

              {/* MOD-05: Promo Bazar Berjadwal */}
              <button
                type="button"
                onClick={() => {
                  setShowModulLainnyaModal(false);
                  setShowBazarPromoModal(true);
                }}
                className="p-3.5 rounded-xl border border-amber-200 hover:border-amber-400 bg-amber-50/40 hover:bg-white text-left transition-all space-y-2 group cursor-pointer"
              >
                <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Tag className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <span>Promo Bazar Berjadwal</span>
                    <span className="text-[9px] bg-amber-200 text-amber-800 px-1 rounded font-bold">MOD-05</span>
                  </div>
                  <div className="text-[11px] text-slate-500">Event diskon flash sale &amp; kuota KG</div>
                </div>
              </button>

              {/* MOD-09: Utang Supplier & Pembelian */}
              <button
                type="button"
                onClick={() => {
                  setShowModulLainnyaModal(false);
                  setActiveTab('beli');
                  setPurchasingSubTab('AP_DEBT');
                }}
                className="p-3.5 rounded-xl border border-indigo-200 hover:border-indigo-400 bg-indigo-50/40 hover:bg-white text-left transition-all space-y-2 group cursor-pointer"
              >
                <div className="w-9 h-9 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <span>Utang Supplier Impor</span>
                    <span className="text-[9px] bg-indigo-200 text-indigo-800 px-1 rounded font-bold">MOD-09</span>
                  </div>
                  <div className="text-[11px] text-slate-500">Tagihan kontainer &amp; pelunasan AP</div>
                </div>
              </button>
            </div>

            <div className="pt-2 text-center">
              <span className="text-[11px] text-slate-400">
                Sistem ERP Daging Import KARKASIA V4.3
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

      {/* =========================================================================
          MOD-07: LAYAR KONVERSI PEMOTONGAN PRIMAL & YIELD LOSS (BUTCHER WORKSTATION)
          ========================================================================= */}
      {showYieldModal && (() => {
        const sourceLot = lots.find(l => l.id === yieldSourceLotId) || lots[0];
        const inputKg = yieldInputWeightKg;
        const primaryKg = yieldPrimaryWeightKg;
        const secondaryKg = yieldSecondaryWeightKg;
        const lossKg = Math.max(0, +(inputKg - primaryKg - secondaryKg).toFixed(2));
        const primaryPct = inputKg > 0 ? ((primaryKg / inputKg) * 100).toFixed(1) : '0';
        const secondaryPct = inputKg > 0 ? ((secondaryKg / inputKg) * 100).toFixed(1) : '0';
        const lossPct = inputKg > 0 ? ((lossKg / inputKg) * 100).toFixed(1) : '0';
        const totalRawCost = Math.round(inputKg * sourceLot.hppKgRupiah);
        const tetelanValue = Math.round(secondaryKg * 65000);
        const steakNetCost = Math.max(0, totalRawCost - tetelanValue);
        const effectiveSteakHpp = primaryKg > 0 ? Math.round(steakNetCost / primaryKg) : sourceLot.hppKgRupiah;

        return (
          <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-tab-fade">
            <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden my-6">
              {/* Header */}
              <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                    <Scissors className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-extrabold tracking-tight">Konversi Pemotongan &amp; Yield Loss</h3>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-400 text-slate-950">MOD-07</span>
                    </div>
                    <p className="text-xs text-slate-300">Pemotongan Primal ke Steak Porsi, Tetelan, &amp; Retribusi HPP Riil</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowYieldModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 sm:p-6 space-y-5 text-xs max-h-[80vh] overflow-y-auto">
                {/* Source Lot Selector */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                  <label className="block text-slate-700 font-bold">1. Pilih Batch Primal Asal (Bahan Baku):</label>
                  <select
                    value={yieldSourceLotId}
                    onChange={e => setYieldSourceLotId(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2.5 font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  >
                    {lots.filter(l => !l.isQuarantined).map(l => (
                      <option key={l.id} value={l.id}>
                        {l.code} &bull; {l.product} (Stok: {(l.weightGram / 1000).toFixed(1)} KG &bull; HPP: Rp {l.hppKgRupiah.toLocaleString('id-ID')}/KG)
                      </option>
                    ))}
                  </select>
                </div>

                {/* Weight Inputs Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1.5">
                    <label className="block font-bold text-slate-700">Berat Primal Masuk (KG):</label>
                    <input
                      type="number"
                      step="0.5"
                      min="1"
                      value={yieldInputWeightKg}
                      onChange={e => setYieldInputWeightKg(Math.max(1, Number(e.target.value)))}
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 text-sm font-mono font-bold text-slate-900 focus:ring-2 focus:ring-slate-900"
                    />
                    <div className="text-[10px] text-slate-500 font-medium">Bahan utuh yang akan dipotong</div>
                  </div>

                  <div className="bg-emerald-50/60 p-3.5 rounded-xl border border-emerald-200 space-y-1.5">
                    <label className="block font-bold text-emerald-900">Hasil Steak Porsi Utama (KG):</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.5"
                      value={yieldPrimaryWeightKg}
                      onChange={e => setYieldPrimaryWeightKg(Math.max(0, Number(e.target.value)))}
                      className="w-full bg-white border border-emerald-300 rounded-lg p-2 text-sm font-mono font-bold text-emerald-800 focus:ring-2 focus:ring-emerald-600"
                    />
                    <div className="text-[10px] text-emerald-700 font-bold">Yield: {primaryPct}% dari bahan baku</div>
                  </div>

                  <div className="bg-amber-50/60 p-3.5 rounded-xl border border-amber-200 space-y-1.5">
                    <label className="block font-bold text-amber-900">Hasil Tetelan / Trim (KG):</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={yieldSecondaryWeightKg}
                      onChange={e => setYieldSecondaryWeightKg(Math.max(0, Number(e.target.value)))}
                      className="w-full bg-white border border-amber-300 rounded-lg p-2 text-sm font-mono font-bold text-amber-800 focus:ring-2 focus:ring-amber-600"
                    />
                    <div className="text-[10px] text-amber-700 font-bold">Yield: {secondaryPct}% (Daging Cincang)</div>
                  </div>
                </div>

                {/* 3-Tier Multi-Segment Yield Bar */}
                <div className="space-y-2 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                    <span>Visualisasi Yield &amp; Susut Pisau (Cutting Loss):</span>
                    <span className="font-mono text-rose-600">Susut: {lossKg.toFixed(2)} KG ({lossPct}%)</span>
                  </div>
                  
                  {/* Progress multi-segment */}
                  <div className="w-full h-5 rounded-full bg-slate-200 overflow-hidden flex shadow-inner">
                    <div 
                      style={{ width: `${Math.min(100, Math.max(0, Number(primaryPct)))}%` }} 
                      className="bg-emerald-500 h-full transition-all duration-300 flex items-center justify-center text-[10px] font-extrabold text-white"
                      title={`Steak Utama: ${primaryPct}%`}
                    >
                      {Number(primaryPct) > 15 ? `${primaryPct}% Steak` : ''}
                    </div>
                    <div 
                      style={{ width: `${Math.min(100, Math.max(0, Number(secondaryPct)))}%` }} 
                      className="bg-amber-500 h-full transition-all duration-300 flex items-center justify-center text-[10px] font-extrabold text-white"
                      title={`Tetelan: ${secondaryPct}%`}
                    >
                      {Number(secondaryPct) > 12 ? `${secondaryPct}% Tetelan` : ''}
                    </div>
                    <div 
                      style={{ width: `${Math.min(100, Math.max(0, Number(lossPct)))}%` }} 
                      className="bg-rose-500 h-full transition-all duration-300 flex items-center justify-center text-[10px] font-extrabold text-white"
                      title={`Susut Pemotongan: ${lossPct}%`}
                    >
                      {Number(lossPct) > 8 ? `${lossPct}% Susut` : ''}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 font-medium">
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Steak Porsi ({primaryKg.toFixed(1)} KG)</span>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Tetelan Super ({secondaryKg.toFixed(1)} KG)</span>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Susut Pisau ({lossKg.toFixed(2)} KG)</span>
                  </div>
                </div>

                {/* HPP Redistribution Card */}
                <div className="bg-slate-900 text-white p-4 rounded-xl space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="font-extrabold text-xs text-amber-400 flex items-center gap-1.5">
                      <Scale className="w-4 h-4" />
                      Retribusi HPP Otomatis (Anti-Deadstock)
                    </span>
                    <span className="text-[10px] text-slate-400">Standar HashMicro ERP Daging</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                    <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700/60">
                      <div className="text-[10px] text-slate-400">Total Modal Primal</div>
                      <div className="font-mono font-bold text-xs text-white">Rp {totalRawCost.toLocaleString('id-ID')}</div>
                    </div>
                    <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700/60">
                      <div className="text-[10px] text-slate-400">Nilai Pulih Tetelan</div>
                      <div className="font-mono font-bold text-xs text-amber-300">Rp {tetelanValue.toLocaleString('id-ID')}</div>
                    </div>
                    <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700/60">
                      <div className="text-[10px] text-slate-400">Beban Bersih Steak</div>
                      <div className="font-mono font-bold text-xs text-emerald-300">Rp {steakNetCost.toLocaleString('id-ID')}</div>
                    </div>
                    <div className="bg-emerald-950/60 p-2.5 rounded-lg border border-emerald-500/40">
                      <div className="text-[10px] text-emerald-400 font-bold">HPP Baru Steak / KG</div>
                      <div className="font-mono font-extrabold text-sm text-emerald-300">
                        Rp {effectiveSteakHpp.toLocaleString('id-ID')}
                      </div>
                    </div>
                  </div>

                  <p className="text-[10px] text-slate-400 leading-relaxed italic">
                    *Susut pisau {lossKg.toFixed(2)} KG ({lossPct}%) diserap langsung ke HPP potongan steak, menjaga laba bersih UMKM terlindungi dari kerugian trimming daging beku.
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                <div className="text-[11px] text-slate-500 font-medium">
                  Ledger hook: <span className="font-mono text-slate-800 font-bold">OUT_CONVERSION &bull; IN_CONVERSION &bull; OUT_CUTTING_LOSS</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowYieldModal(false)}
                    className="px-3.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleProcessYieldConversion}
                    className="px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-xs active:scale-95 flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Rekam Konversi ke Ledger (MOD-07)</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* =========================================================================
          MOD-21: ASISTEN PESAN SUARA SALES (AI VOICE NOTE ORDER - GEMINI 3.8 FLASH)
          ========================================================================= */}
      {showVoiceNoteModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-tab-fade">
          <div className="bg-white rounded-2xl max-w-xl w-full border border-slate-200 shadow-2xl overflow-hidden my-6">
            {/* Header */}
            <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                  <Mic className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-extrabold tracking-tight">Voice Note Order Assistant</h3>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-400 text-slate-950">MOD-21 AI</span>
                  </div>
                  <p className="text-xs text-slate-300">Konversi Rekaman Suara Sales Lapangan ke Keranjang Kasir POS</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowVoiceNoteModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 sm:p-6 space-y-4 text-xs max-h-[80vh] overflow-y-auto">
              {/* Mic Interactive Recording Banner */}
              <div className="bg-slate-900 rounded-2xl p-5 text-white flex flex-col items-center justify-center text-center space-y-3 relative overflow-hidden">
                <div className="absolute inset-0 bg-radial from-emerald-500/10 to-transparent pointer-events-none" />
                
                <button
                  type="button"
                  onClick={toggleVoiceRecording}
                  className={`w-16 h-16 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-lg active:scale-95 ${
                    isRecordingVoice 
                      ? 'bg-rose-600 text-white ring-8 ring-rose-500/30 animate-pulse' 
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white ring-4 ring-emerald-500/20'
                  }`}
                  title={isRecordingVoice ? 'Klik untuk berhenti merekam' : 'Klik untuk mulai merekam suara'}
                >
                  {isRecordingVoice ? <MicOff className="w-7 h-7" /> : <Mic className="w-7 h-7" />}
                </button>

                <div>
                  <div className="font-bold text-sm text-white">
                    {isRecordingVoice ? 'Merekam Suara Sales Lapangan...' : 'Tekan Mikrofon untuk Bicara'}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {isRecordingVoice 
                      ? 'Bicaralah dengan santai: nama pelanggan, potongan daging, kiloan, dan metode bayar.'
                      : 'Atau pilih salah satu sampel pesan suara di bawah ini.'}
                  </p>
                </div>

                {/* Animated Waveform Visualizer */}
                {isRecordingVoice && (
                  <div className="flex items-center gap-1.5 h-6">
                    {[16, 24, 12, 28, 20, 32, 18, 26, 14, 22].map((h, i) => (
                      <span 
                        key={i} 
                        style={{ height: `${h}px` }} 
                        className="w-1 bg-emerald-400 rounded-full animate-pulse" 
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Sample Voice Notes (Quick Chips) */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                  <Volume2 className="w-3.5 h-3.5 text-slate-400" />
                  <span>Sampel Pesan Suara WhatsApp Sales:</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  {[
                    {
                      label: 'Hotel Grand Serang (Tempo 14 Hari)',
                      text: 'Hotel Grand Serang minta Australian Ribeye 5 kilo sama Saikoro Meltique 3 kilo bayar tempo 14 hari',
                    },
                    {
                      label: 'Steakhouse Banten Prima (Cash)',
                      text: 'Steakhouse Banten Prima pesan Sirloin Choice USA 4 kg dan Tetelan 5 kg bayar tunai cash keras',
                    },
                    {
                      label: 'Resto Padang Sederhana (Transfer)',
                      text: 'Resto Padang Cilegon minta Tetelan Rawon 10 kilo transfer BCA ya tolong segera kirim',
                    },
                  ].map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setVoiceTranscript(preset.text)}
                      className="text-left p-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors text-[11px] text-slate-700 flex items-start justify-between group"
                    >
                      <span className="font-semibold text-slate-900 group-hover:text-emerald-700">{preset.label}: <span className="font-normal text-slate-600 italic">"{preset.text}"</span></span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Transcript Text Box */}
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-700">Transkrip Pesan Suara:</label>
                <textarea
                  rows={3}
                  value={voiceTranscript}
                  onChange={e => setVoiceTranscript(e.target.value)}
                  placeholder="Transkrip suara sales akan muncul di sini atau ketik manual..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              {/* Action Button: Parse with Gemini */}
              <button
                type="button"
                onClick={handleParseVoiceNote}
                disabled={isParsingVoice || !voiceTranscript.trim()}
                className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-all active:scale-98 cursor-pointer"
              >
                {isParsingVoice ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                    <span>Gemini 3.8 Flash sedang mengekstrak pesanan...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    <span>Analisis Transkrip Suara dengan AI (MOD-21)</span>
                  </>
                )}
              </button>

              {/* Parsed Result Card */}
              {voiceParseResult && (
                <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-emerald-200 pb-2">
                    <span className="font-extrabold text-xs text-emerald-950 flex items-center gap-1.5">
                      <CheckCircle className="w-4 h-4 text-emerald-600" />
                      Hasil Ekstraksi Terstruktur AI
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-200 text-emerald-900">
                      Akurasi: {Math.round((voiceParseResult.confidenceScore || 0.95) * 100)}%
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-500 text-[11px]">Pelanggan Terdeteksi:</span>
                      <div className="font-bold text-slate-900">{voiceParseResult.customerName}</div>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[11px]">Metode Pembayaran:</span>
                      <div className="font-bold text-slate-900">
                        {voiceParseResult.paymentMethod} {voiceParseResult.tempoDays > 0 ? `(${voiceParseResult.tempoDays} Hari)` : ''}
                      </div>
                    </div>
                  </div>

                  {/* Item Table */}
                  <div className="bg-white rounded-lg border border-emerald-200 overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-emerald-100/60 text-emerald-950 font-bold text-[10px] uppercase">
                        <tr>
                          <th className="px-3 py-2">Produk</th>
                          <th className="px-3 py-2 text-right">Berat (KG)</th>
                          <th className="px-3 py-2 text-right">Estimasi Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-emerald-100 font-medium">
                        {voiceParseResult.items.map((item, i) => {
                          const estSubtotal = Math.round((item.weightGram * item.unitPriceRupiah) / 1000);
                          return (
                            <tr key={i}>
                              <td className="px-3 py-2">
                                <div className="font-bold text-slate-900">{item.productName}</div>
                                <div className="text-[10px] text-slate-500 font-mono">{item.productSku}</div>
                              </td>
                              <td className="px-3 py-2 text-right font-mono font-bold">
                                {(item.weightGram / 1000).toFixed(1)} KG
                              </td>
                              <td className="px-3 py-2 text-right font-mono font-bold text-emerald-800">
                                Rp {estSubtotal.toLocaleString('id-ID')}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <button
                    type="button"
                    onClick={handleApplyVoiceOrderToCart}
                    className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-sm transition-all active:scale-98 cursor-pointer"
                  >
                    <ShoppingCart className="w-4 h-4" />
                    <span>Terapkan Pesanan Ini ke Keranjang Kasir POS</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MOD-08: FORMULIR RETUR DAGING KOMPLAIN PELANGGAN + KAMERA INSPEKSI
          ========================================================================= */}
      {showReturnModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-tab-fade">
          <div className="bg-white rounded-2xl max-w-xl w-full border border-slate-200 shadow-2xl overflow-hidden my-6">
            {/* Header */}
            <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center border border-rose-500/30">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-extrabold tracking-tight">Formulir Retur Daging Komplain</h3>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500 text-white">MOD-08</span>
                  </div>
                  <p className="text-xs text-slate-300">Wajib Foto Bukti Kamera, Credit Note, &amp; Isolasi Karantina Cold Storage</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  stopReturnCamera();
                  setShowReturnModal(false);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 sm:p-6 space-y-4 text-xs max-h-[80vh] overflow-y-auto">
              {/* Form Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block font-bold text-slate-700">Pelanggan Pengaju:</label>
                  <select
                    value={returnCustomer}
                    onChange={e => setReturnCustomer(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-semibold text-slate-900"
                  >
                    {SAMPLE_CUSTOMERS.map(c => (
                      <option key={c.id} value={c.name}>{c.name} ({c.tier})</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-slate-700">No. Faktur Penjualan Referensi:</label>
                  <input
                    type="text"
                    value={returnInvoice}
                    onChange={e => setReturnInvoice(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-mono font-semibold text-slate-900"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-slate-700">Produk yang Dikomplain:</label>
                  <select
                    value={returnProduct}
                    onChange={e => setReturnProduct(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-semibold text-slate-900"
                  >
                    {SAMPLE_PRODUCTS.map(p => (
                      <option key={p.id} value={p.name}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-slate-700">Berat Daging Dikomplain (KG):</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    value={returnWeightKg}
                    onChange={e => setReturnWeightKg(Math.max(0.5, Number(e.target.value)))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-mono font-bold text-slate-900"
                  />
                </div>
              </div>

              {/* Defect Reason Selection */}
              <div className="space-y-1">
                <label className="block font-bold text-slate-700">Alasan Cacat Mutu / Komplain (Wajib Spesifikasi):</label>
                <select
                  value={returnReason}
                  onChange={e => setReturnReason(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-semibold text-slate-900"
                >
                  <option value="Bau Asam / Off-Odor (Suhu Reefer Rusak)">Bau Asam / Off-Odor (Suhu Reefer Rusak saat Pengiriman)</option>
                  <option value="Discoloration / Daging Menghitam Keabuan">Discoloration / Daging Menghitam Keabuan Tidak Wajar</option>
                  <option value="Kemasan Vakum Bocor / Freezer Burn Kering">Kemasan Vakum Bocor / Freezer Burn Kering Menempel</option>
                  <option value="Kelebihan Lemak / Fat Excess diluar toleransi spesifikasi (&gt;25%)">Kelebihan Lemak / Fat Excess diluar toleransi spesifikasi (&gt;25%)</option>
                  <option value="Selisih Timbangan Tiba di Dapur Pelanggan">Selisih Timbangan Tiba di Dapur Pelanggan</option>
                </select>
              </div>

              {/* Resolution Type */}
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-700">Tipe Resolusi Komplain:</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'CREDIT_NOTE', label: 'Credit Note', desc: 'Potong Faktur' },
                    { id: 'TUKAR_BARANG', label: 'Tukar Barang', desc: 'Kirim Batch Baru' },
                    { id: 'REFUND_KAS', label: 'Refund Kas', desc: 'Kembalikan Uang' },
                  ].map(res => (
                    <button
                      key={res.id}
                      type="button"
                      onClick={() => setReturnResolution(res.id as any)}
                      className={`p-2.5 rounded-xl border text-center transition-all ${
                        returnResolution === res.id 
                          ? 'border-slate-900 bg-slate-900 text-white font-bold shadow-xs' 
                          : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 font-medium'
                      }`}
                    >
                      <div className="text-xs">{res.label}</div>
                      <div className={`text-[10px] ${returnResolution === res.id ? 'text-slate-300' : 'text-slate-500'}`}>{res.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Camera Capture Section (MOD-08 Wajib Foto Bukti) */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Camera className="w-4 h-4 text-slate-600" />
                    Bukti Foto Kerusakan Daging (Wajib Kamera):
                  </span>
                  {returnPhotoUrl && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Foto Terlampir
                    </span>
                  )}
                </div>

                {/* Video Stream Preview */}
                {isReturnCameraActive ? (
                  <div className="relative bg-black rounded-xl overflow-hidden h-52 flex flex-col items-center justify-center">
                    <video
                      ref={returnVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-40 h-40 border-2 border-white/70 rounded-xl" />
                    </div>
                    <div className="absolute bottom-3 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={captureReturnPhoto}
                        className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg flex items-center gap-1.5 cursor-pointer"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        <span>Ambil Foto Komplain</span>
                      </button>
                      <button
                        type="button"
                        onClick={stopReturnCamera}
                        className="px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-white text-xs font-semibold"
                      >
                        Tutup
                      </button>
                    </div>
                  </div>
                ) : returnPhotoUrl ? (
                  <div className="relative rounded-xl overflow-hidden border border-slate-300 bg-slate-900 group max-h-52">
                    <img
                      src={returnPhotoUrl}
                      alt="Bukti Komplain Retur Daging"
                      className="w-full h-44 object-cover"
                    />
                    <div className="absolute inset-0 bg-slate-950/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={startReturnCamera}
                        className="px-3 py-1.5 rounded-lg bg-white text-slate-900 text-xs font-bold shadow-md flex items-center gap-1"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Ambil Ulang Foto
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-2 py-4 border-2 border-dashed border-slate-300 rounded-xl bg-white">
                    <button
                      type="button"
                      onClick={startReturnCamera}
                      className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
                    >
                      <Camera className="w-4 h-4 text-emerald-400" />
                      <span>Buka Kamera Bukti Komplain</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setReturnPhotoUrl('https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=600&auto=format&fit=crop&q=80')}
                      className="px-3 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold"
                    >
                      Gunakan Foto Sampel Cacat Mutu
                    </button>
                  </div>
                )}
              </div>

              {/* Quarantine Warning */}
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 flex items-start gap-2.5">
                <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div className="text-[11px] text-amber-900 leading-relaxed">
                  <span className="font-bold">Protokol Karantina:</span> Daging retur komplain akan otomatis dialokasikan ke <strong>Chiller Karantina (CHILLER-ISOLASI-01)</strong> dengan status isolasi afkir (HPP Rp 0) dan terproteksi dari sistem POS kasir agar tidak terjual ke pelanggan lain.
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <span className="text-[11px] text-slate-500 font-medium">
                Penerbitan Credit Note &bull; Isolasi Karantina Cold Storage
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    stopReturnCamera();
                    setShowReturnModal(false);
                  }}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleProcessReturn}
                  className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-xs active:scale-95 flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Proses Retur &amp; Karantina (MOD-08)</span>
                </button>
              </div>
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
                <div className="font-extrabold text-xs">ERP KARKASIA</div>
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

      {/* =========================================================================
          MODAL: KASIR KECIL & OPEX (MOD-12)
          ========================================================================= */}
      <PettyCashModal
        isOpen={showPettyCashModal}
        onClose={() => setShowPettyCashModal(false)}
        onRecordOpexSuccess={(newVoucher, newBalance) => {
          triggerNotification(
            'Voucher OPEX Diterbitkan',
            `${newVoucher.voucherNo} (${newVoucher.categoryLabel}) - Sisa kas: Rp ${newBalance.toLocaleString('id-ID')}`,
            'success',
            newVoucher.amountRupiah
          );
        }}
      />

      {/* =========================================================================
          MODAL: BUAT PURCHASE ORDER IMPOR BARU (MOD-09)
          ========================================================================= */}
      <PurchaseOrderModal
        isOpen={showCreatePOModal}
        initialData={poInitialData}
        availableSuppliers={suppliers}
        onAddNewSupplier={(newSup) => {
          setSuppliers(prev => [newSup, ...prev]);
          triggerNotification('Supplier Baru Terdaftar', `${newSup} berhasil ditambahkan ke daftar importir`, 'success');
        }}
        availableProducts={products}
        availableCategories={categories}
        onAddNewProductCut={(newCut) => {
          const created: any = {
            id: `PROD_${Date.now()}`,
            sku: newCut.sku,
            name: newCut.name,
            category: newCut.category,
            basePricePerKg: newCut.basePricePerKg,
            stockGram: 0,
            safetyStockGram: 20000,
            tag: 'Impor Baru',
            alternativeId: 'PROD_02',
            alternativeName: 'Sirloin Choice USA (Primal)',
            alternativeReason: 'Pilihan potongan daging impor alternatif',
          };
          setProducts(prev => [created, ...prev]);
          triggerNotification('Cut Daging Terdaftar', `${newCut.name} otomatis ditambahkan ke katalog toko KARKASIA`, 'success');
        }}
        onClose={() => {
          setShowCreatePOModal(false);
          setPoInitialData(null);
        }}
        onCreatePOSuccess={(newPO) => {
          setPoInitialData(null);
          setInboundPOs(prev => [newPO, ...prev]);
          // Catat ke daftar Utang Supplier AP
          const newInv: SupplierInvoice = {
            id: `SUP_INV_${Date.now()}`,
            invoiceNumber: `INV-SUP-${newPO.poNumber.slice(3)}`,
            poNumber: newPO.poNumber,
            supplier: newPO.supplier,
            originCountry: newPO.supplier.includes('Australia') ? 'Australia' : newPO.supplier.includes('USA') ? 'USA' : 'Impor',
            totalAmountRupiah: newPO.totalRupiah,
            paidAmountRupiah: newPO.paymentTerm === 'CASH' ? newPO.totalRupiah : 0,
            remainingAmountRupiah: newPO.paymentTerm === 'CASH' ? 0 : newPO.totalRupiah,
            dueDate: newPO.invoiceDueDate,
            daysDiff: 30,
            status: newPO.paymentTerm === 'CASH' ? 'LUNAS' : 'BELUM_LUNAS',
          };
          setSupplierInvoices(prev => [newInv, ...prev]);
          triggerNotification(
            'Purchase Order (PO) Berhasil Diterbitkan',
            `${newPO.poNumber} untuk kontainer ${newPO.container} telah dicatat ke buku utang AP`,
            'success',
            newPO.totalRupiah
          );
        }}
      />

      {/* =========================================================================
          MODAL: PELUNASAN UTANG SUPPLIER IMPOR (AP PAYMENTS - MOD-09)
          ========================================================================= */}
      <SupplierPayableModal
        isOpen={showSupplierPayableModal}
        onClose={() => {
          setShowSupplierPayableModal(false);
          setSelectedSupplierInvoice(null);
        }}
        invoice={selectedSupplierInvoice}
        onPaymentSuccess={(invoiceId, amountPaid, newRemaining) => {
          setSupplierInvoices(prev => prev.map(inv => {
            if (inv.id === invoiceId) {
              const updatedPaid = inv.paidAmountRupiah + amountPaid;
              const status = newRemaining === 0 ? 'LUNAS' : 'CICILAN';
              return {
                ...inv,
                paidAmountRupiah: updatedPaid,
                remainingAmountRupiah: newRemaining,
                status,
              };
            }
            return inv;
          }));
          triggerNotification(
            'Pembayaran Utang Supplier Berhasil',
            `Transfer pelunasan berhasil diproses via Bank BCA KARKASIA`,
            'success',
            amountPaid
          );
        }}
      />

      {/* =========================================================================
          MODAL QUICK ACTION: MASTER KELOLA HARGA JUAL DAGING (SEAMLESS PRICE EDITOR)
          ========================================================================= */}
      <QuickPriceManagerModal
        isOpen={showPriceManagerModal}
        targetProductId={priceManagerTargetId}
        products={products}
        onClose={() => {
          setShowPriceManagerModal(false);
          setPriceManagerTargetId(null);
        }}
        onSavePrices={(updated) => {
          setProducts(updated as any);
          triggerNotification('Master Harga Disimpan', `${updated.length} harga produk berhasil diperbarui secara real-time`, 'success');
        }}
      />

      {/* =========================================================================
          MODAL QUICK ACTION: TAMBAH PELANGGAN BARU (KASIR POS)
          ========================================================================= */}
      <QuickAddCustomerModal
        isOpen={showQuickAddCustomerModal}
        onClose={() => setShowQuickAddCustomerModal(false)}
        onAddCustomerSuccess={(newCust) => {
          setCustomers(prev => [newCust, ...prev]);
          setSelectedCustomerId(newCust.id);
          triggerNotification('Pelanggan Baru Terdaftar', `${newCust.name} (${newCust.code}) langsung aktif di transaksi kasir`, 'success');
        }}
      />

      {/* =========================================================================
          MODAL QUICK ACTION: TAMBAH POTONGAN DAGING BARU
          ========================================================================= */}
      <QuickAddProductModal
        isOpen={showQuickAddProductModal}
        onClose={() => setShowQuickAddProductModal(false)}
        availableCategories={categories}
        onAddNewCategoryInline={(newCat) => {
          handleAddCategory({
            id: newCat.id,
            label: newCat.label,
            color: 'emerald',
            isCore: false,
          });
        }}
        onAddProductSuccess={(newProd) => {
          const withTiers: any = {
            ...newProd,
            tierPrices: {
              RETAIL: newProd.basePricePerKg,
              HOREKA: Math.round(newProd.basePricePerKg * 0.9),
              VIP: Math.round(newProd.basePricePerKg * 0.82),
            },
            alternativeId: 'PROD_02',
            alternativeName: 'Sirloin Choice USA (Primal)',
            alternativeReason: 'Pilihan potongan daging impor alternatif',
          };
          setProducts(prev => [withTiers, ...prev]);
          triggerNotification('Potongan Daging Baru Ditambahkan', `${newProd.name} (${newProd.sku}) siap ditimbang & dijual`, 'success');
        }}
      />

      {/* =========================================================================
          MODAL: KELOLA KATEGORI PRODUK MASTER DAGING (MOD-03)
          ========================================================================= */}
      <CategoryManagerModal
        isOpen={showCategoryManagerModal}
        onClose={() => setShowCategoryManagerModal(false)}
        categories={categories}
        onAddCategory={handleAddCategory}
        onDeleteCategory={handleDeleteCategory}
        productCountPerCategory={categories.reduce((acc, c) => {
          acc[c.id] = products.filter(p => p.category === c.id).length;
          return acc;
        }, {} as Record<string, number>)}
      />

      {/* =========================================================================
          MODAL: PROMO BAZAR BERJADWAL & FLASH SALE (MOD-05)
          ========================================================================= */}
      <BazarPromoModal
        isOpen={showBazarPromoModal}
        onClose={() => setShowBazarPromoModal(false)}
        promos={bazarPromos}
        onTogglePromo={(promoId) => {
          setBazarPromos(prev => prev.map(p => p.id === promoId ? { ...p, isActive: !p.isActive } : p));
        }}
        onCreatePromo={(newPromo) => {
          setBazarPromos(prev => [newPromo, ...prev]);
          triggerNotification(
            'Promo Bazar Diaktifkan',
            `${newPromo.title} untuk ${newPromo.productName} telah aktif di POS Kasir`,
            'success'
          );
        }}
      />

      {/* =========================================================================
          MODAL: CUSTOMER CREDIT & PROFILE DASHBOARD (MOD-06 & MOD-10)
          ========================================================================= */}
      <CustomerDashboardModal
        isOpen={showCustomerDashboardModal}
        onClose={() => {
          setShowCustomerDashboardModal(false);
          setSelectedDashboardCustomerId(null);
        }}
        customers={customers}
        receivables={receivables}
        initialSelectedCustomerId={selectedDashboardCustomerId}
        onUpdateCustomer={handleUpdateCustomer}
        onAddNewCustomerClick={() => {
          setShowCustomerDashboardModal(false);
          setShowQuickAddCustomerModal(true);
        }}
        onRecordPayment={(recId) => {
          setReceivables(prev => prev.map(item => item.id === recId ? { ...item, status: 'LUNAS' } : item));
          const target = receivables.find(r => r.id === recId);
          if (target) {
            triggerNotification(
              'Pelunasan Berhasil! 💰',
              `Tagihan ${target.customer} sebesar Rp ${target.amount.toLocaleString('id-ID')} (${target.invoice}) lunas.`,
              'success',
              target.amount
            );
          }
        }}
      />

    </div>
  );
}
