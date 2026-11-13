import React, { useState, useRef, useEffect, useMemo } from 'react';
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
  Users,
  Phone
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
  type CloudArchiveUser,
  type DriveFileItem
} from './services/googleDriveService';
import {
  BACKEND_ADAPTER_OPTIONS,
  createBackendAdapter,
  executeOutboxSyncWithAdapter,
  hydrateBackendConfigFromIdb,
  loadBackendConfig,
  saveBackendConfig,
} from './adapters/adapterRegistry';
import type { BackendAdapterConfig } from './adapters/backendAdapter';
import { StockLevelOverTimeChart } from './components/StockLevelOverTimeChart';
import { PettyCashModal, type OpexVoucher } from './components/PettyCashModal';
import { PurchaseOrderModal, type InboundPOItem } from './components/PurchaseOrderModal';
import { RestockPredictionCard, type RestockPredictionItem } from './components/RestockPredictionCard';
import {
  SupplierPayableModal,
  buildSupplierPaymentFollowUpUrl,
  type SupplierInvoice
} from './components/SupplierPayableModal';
import { BazarPromoModal, type BazarPromoItem, INITIAL_BAZAR_PROMOS } from './components/BazarPromoModal';
import { QuickPriceManagerModal, type ProductPriceItem } from './components/QuickPriceManagerModal';
import { QuickAddCustomerModal, type CustomerItem } from './components/QuickAddCustomerModal';
import { QuickAddProductModal, type NewProductData } from './components/QuickAddProductModal';
import { CategoryManagerModal, type ProductCategory } from './components/CategoryManagerModal';
import { CustomerDashboardModal } from './components/CustomerDashboardModal';
import { LotQrCodeModal } from './components/LotQrCodeModal';
import { ShelfLocationPromptModal } from './components/ShelfLocationPromptModal';
import { FefoCriticalWarningBanner } from './components/FefoCriticalWarningBanner';
import { EditProductPhotoModal } from './components/EditProductPhotoModal';
import { ProductGalleryModal, type ProductGalleryItem } from './components/ProductGalleryModal';
import { BulkQrScanModal } from './components/BulkQrScanModal';
import { QuickWeighSheet } from './components/QuickWeighSheet';
import { PWAInstallButton } from './components/PWAInstallButton';
import { SyncQueueStatusIndicator } from './components/SyncQueueStatusIndicator';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import {
  EnterpriseAccountabilityViews,
  type SecondaryViewId,
} from './components/EnterpriseAccountabilityViews';
import {
  createSeededEngineState,
  loadEngineState,
  hydrateEngineStateFromIdb,
  persistEngineState,
  subscribePersistenceErrors,
  addProductCategory,
  deleteProductCategory,
  addSupplierRecord,
  updateSupplierPhoneRecord,
  toggleBazarPromo,
  createBazarPromo,
  calculateProductTierPrice,
  commitSaleTransaction,
  voidSaleTransaction,
  receiveInboundPurchase,
  executeTrimmingConversion,
  executeStockOpname,
  executeCustomerReturn,
  recordCustomerReceivablePayment,
  revertCustomerReceivablePayment,
  recordSupplierPayablePayment,
  recordPettyCashOpex,
  resolveApprovalRequest,
  selectOperationalSummary,
  generateUUID,
  addProductWithOpeningLot,
  verifyOwnerPin,
  updateOwnerPin,
  checkPinAttemptGuard,
  recordPinAttemptOutcome,
} from './engine/businessEngine';
import { idbGetPreference, idbSetPreference } from './engine/indexedDbStorage';
import type { BusinessEngineState, ProductEntity } from './engine/types';

// =====================================================================
// MASTER DATA TOKO DAGING IMPORT KARKASIA (Single Source of Truth)
// =====================================================================
const DEFAULT_SUPPLIERS: string[] = [
  'PT Meat Importers Indonesia',
  'Australia Beef Direct Ltd',
  'JBS USA Beef Export Inc',
  'Teys Australia Meat Group',
];

const DEFAULT_SUPPLIER_PHONES: Record<string, string> = {
  'PT Meat Importers Indonesia': '0811-8822-3344',
  'Australia Beef Direct Ltd': '0812-7700-9911',
  'JBS USA Beef Export Inc': '0813-9944-5566',
  'Teys Australia Meat Group': '0815-6677-8899',
};

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
    movingAvgHppPerKg: 180000,
    imageUrl: 'https://images.unsplash.com/photo-1603048588665-791ca8aea617?w=800&auto=format&fit=crop&q=80',
    gallery: [
      { url: 'https://images.unsplash.com/photo-1603048588665-791ca8aea617?w=800&auto=format&fit=crop&q=80', title: 'Tampak Atas Potongan Ribeye Meltique (Marbling Grade 4+)', tag: 'Cut View' },
      { url: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800&auto=format&fit=crop&q=80', title: 'Kemasan Vacuum Karton Master Import 20 KG', tag: 'Vacuum Pack' },
      { url: 'https://images.unsplash.com/photo-1558030006-450675393462?w=800&auto=format&fit=crop&q=80', title: 'Hasil Masak Pan-Seared Ribeye Steak', tag: 'Grill / Cooking' },
      { url: 'https://images.unsplash.com/photo-1588168333986-5078d3ae3976?w=800&auto=format&fit=crop&q=80', title: 'Label Kemasan Sertifikat Halal & Lot Batch Code', tag: 'Label & Karton' }
    ],
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
    movingAvgHppPerKg: 165000,
    imageUrl: 'https://images.unsplash.com/photo-1558030006-450675393462?w=800&auto=format&fit=crop&q=80',
    gallery: [
      { url: 'https://images.unsplash.com/photo-1558030006-450675393462?w=800&auto=format&fit=crop&q=80', title: 'Potongan Samping Sirloin Choice (Tebal Fat Cap Sempurna)', tag: 'Side Cut' },
      { url: 'https://images.unsplash.com/photo-1603048588665-791ca8aea617?w=800&auto=format&fit=crop&q=80', title: 'Kemasan Sealed Thermoforming Box', tag: 'Thermo Pack' },
      { url: 'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=800&auto=format&fit=crop&q=80', title: 'Sajian Sirloin Steak Resto Horeka', tag: 'Plate View' }
    ],
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
    movingAvgHppPerKg: 65000,
    imageUrl: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800&auto=format&fit=crop&q=80',
    gallery: [
      { url: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800&auto=format&fit=crop&q=80', title: 'Daging Tetelan Trimming Super Ratio Daging 80/20', tag: 'Trimming Cut' },
      { url: 'https://images.unsplash.com/photo-1588168333986-5078d3ae3976?w=800&auto=format&fit=crop&q=80', title: 'Pack Plastik Frozen Vacuum 1 KG', tag: 'Frozen Pack' }
    ],
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
    movingAvgHppPerKg: 195000,
    imageUrl: 'https://images.unsplash.com/photo-1588168333986-5078d3ae3976?w=800&auto=format&fit=crop&q=80',
    gallery: [
      { url: 'https://images.unsplash.com/photo-1588168333986-5078d3ae3976?w=800&auto=format&fit=crop&q=80', title: 'Potongan Tenderloin Utuh Grassfed Ultra Lean', tag: 'Center Cut' },
      { url: 'https://images.unsplash.com/photo-1603048588665-791ca8aea617?w=800&auto=format&fit=crop&q=80', title: 'Hasil Pan Seared Medium Rare', tag: 'Cooking View' }
    ],
    tierPrices: {
      RETAIL: 290000,
      HOREKA: 265000,
      VIP: 245000
    },
    category: 'PRIMAL',
    stockGram: 18500,
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
    movingAvgHppPerKg: 95000,
    imageUrl: 'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=800&auto=format&fit=crop&q=80',
    gallery: [
      { url: 'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=800&auto=format&fit=crop&q=80', title: 'Irisan Tipis Shortplate Slice Shabu 1.5mm', tag: 'Slice Cut' },
      { url: 'https://images.unsplash.com/photo-1558030006-450675393462?w=800&auto=format&fit=crop&q=80', title: 'Tray Pack 500g Wrapped Shabu-Shabu', tag: 'Tray Pack' }
    ],
    tierPrices: {
      RETAIL: 125000,
      HOREKA: 110000,
      VIP: 98000
    },
    category: 'SLICE',
    stockGram: 32000,
    safetyStockGram: 25000,
    tag: 'Shabu & Grill',
    alternativeId: 'PROD_02',
    alternativeName: 'Sirloin Choice USA (Primal)',
    alternativeReason: 'Alternatif olahan potongan daging untuk menu resto'
  },
  {
    id: 'PROD_06',
    sku: 'SKU-WAGYU-RIB-MB7',
    name: 'Wagyu Ribeye MB7+ Australia (Fresh Inbound)',
    basePricePerKg: 520000,
    movingAvgHppPerKg: 380000,
    imageUrl: 'https://images.unsplash.com/photo-1558030006-450675393462?w=800&auto=format&fit=crop&q=80',
    tierPrices: {
      RETAIL: 520000,
      HOREKA: 470000,
      VIP: 430000,
    },
    category: 'PRIMAL',
    stockGram: 36000,
    safetyStockGram: 10000,
    tag: 'Wagyu Premium',
    alternativeId: 'PROD_01',
    alternativeName: 'Ribeye Meltique Australia (Primal)',
    alternativeReason: 'Alternatif Ribeye ekonomis dengan marbling tinggi',
  },
  {
    id: 'PROD_07',
    sku: 'SKU-OXTAIL-IMP',
    name: 'Oxtail Buntut Sapi Impor (Cold Storage Inbound)',
    basePricePerKg: 185000,
    movingAvgHppPerKg: 140000,
    imageUrl: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800&auto=format&fit=crop&q=80',
    tierPrices: {
      RETAIL: 185000,
      HOREKA: 168000,
      VIP: 155000,
    },
    category: 'BONE_IN',
    stockGram: 45000,
    safetyStockGram: 15000,
    tag: 'Sop Buntut Resto',
    alternativeId: 'PROD_03',
    alternativeName: 'Tetelan Rawon Super KARKASIA',
    alternativeReason: 'Alternatif olahan kuah kaldu gurih untuk katering',
  },
];

function seedRelativeYmd(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Helper kalkulasi harga bertingkat (MOD-05: Customer Tier & Quantity Break — delegated to core businessEngine)
export const getProductTierPrice = (
  product: any,
  customerTier: string = 'RETAIL',
  weightGram: number = 1000,
  bazarPromos: BazarPromoItem[] = []
) => calculateProductTierPrice(product, customerTier, weightGram, bazarPromos);

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
  // Navigation Architecture: Strictly 5 Primary Tabs + Progressive Disclosure Secondary Modules
  const [activeTab, setActiveTab] = useState<'home' | 'pos' | 'beli' | 'warehouse' | 'bayar'>('home');
  const [activeSecondaryModule, setActiveSecondaryModule] = useState<null | 'laporan' | SecondaryViewId>(null);
  const [showModulLainnyaModal, setShowModulLainnyaModal] = useState(false);
  const browserIsOnline = useOnlineStatus();
  const [isOnline, setIsOnline] = useState(browserIsOnline);
  const [pinError, setPinError] = useState<string | null>(null);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const [checkoutIdempotencyKey, setCheckoutIdempotencyKey] = useState<string>(() => generateUUID());
  const checkoutIdempotencyKeyRef = useRef<string>(checkoutIdempotencyKey);
  const isCheckoutSubmittingRef = useRef<boolean>(false);

  // Customer & Payment State (Smart Defaults: last payment method + exact cash "Uang Pas")
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('CUST_01');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'TRANSFER' | 'TEMPO'>(() => {
    try {
      const saved = localStorage.getItem('karkasia_last_payment_method');
      if (saved === 'CASH' || saved === 'TRANSFER' || saved === 'TEMPO') return saved;
    } catch {}
    return 'CASH';
  });
  const [isFreeShipping, setIsFreeShipping] = useState<boolean>(true);
  const [shippingFee] = useState<number>(25000);
  const [cashTendered, setCashTendered] = useState<number>(0);
  const [isCustomCash, setIsCustomCash] = useState<boolean>(false);
  const [confirmDeleteCategoryId, setConfirmDeleteCategoryId] = useState<string | null>(null);
  const [ownerPin, setOwnerPin] = useState<string>('');
  const [pinFailedAttempts, setPinFailedAttempts] = useState<number>(0);
  const lastSafetyWarnedTabRef = useRef<string | null>(null);
  const [isOwnerApproved, setIsOwnerApproved] = useState<boolean>(false);
  const [showPinModal, setShowPinModal] = useState<boolean>(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [inventorySearchQuery, setInventorySearchQuery] = useState<string>('');
  const [inventoryFilterStatus, setInventoryFilterStatus] = useState<'ALL' | 'KRITIS' | 'FEFO' | 'NORMAL'>('ALL');

  const paymentMethodHydratedRef = useRef(false);
  const [backendConfig, setBackendConfig] = useState<BackendAdapterConfig>(() => loadBackendConfig());
  const activeAdapter = useMemo(() => createBackendAdapter(backendConfig), [backendConfig]);
  const activeAdapterMeta = useMemo(
    () => BACKEND_ADAPTER_OPTIONS.find((o) => o.type === backendConfig.adapterType) || BACKEND_ADAPTER_OPTIONS[0],
    [backendConfig.adapterType]
  );
  const [isSyncingOutbox, setIsSyncingOutbox] = useState<boolean>(false);

  useEffect(() => {
    let active = true;
    hydrateBackendConfigFromIdb().then((saved) => {
      if (active && saved) {
        setBackendConfig(saved);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setIsOnline(browserIsOnline);
  }, [browserIsOnline]);

  useEffect(() => {
    let active = true;
    idbGetPreference<'CASH' | 'TRANSFER' | 'TEMPO'>('last_payment_method').then((saved) => {
      paymentMethodHydratedRef.current = true;
      if (!active) return;
      if (saved === 'CASH' || saved === 'TRANSFER' || saved === 'TEMPO') {
        setPaymentMethod(saved);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('karkasia_last_payment_method', paymentMethod);
    } catch {}
    if (paymentMethodHydratedRef.current) {
      void idbSetPreference('last_payment_method', paymentMethod);
    }
  }, [paymentMethod]);

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

  // Google Drive State (Optional Lazy-Loaded Archive)
  const [googleDriveUser, setGoogleDriveUser] = useState<CloudArchiveUser | null>(null);
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

  // Single Source of Truth: Decoupled Business Engine State (Offline-First)
  const initialEngineSeed = useMemo(
    () => ({
      products: SAMPLE_PRODUCTS as ProductEntity[],
      lots: [
        {
          id: 'LOT_01',
          code: 'LOT-AUS-261015-01',
          product: 'Ribeye Meltique AUS (Primal)',
          productId: 'PROD_01',
          daysLeft: 13,
          expiryDate: seedRelativeYmd(13),
          weightGram: 48500,
          maxCapacityGram: 60000,
          hppKgRupiah: 180000,
          loc: 'FREEZER-A-01',
          isFefo: false,
          isQuarantined: false,
        },
        {
          id: 'LOT_02',
          code: 'LOT-USA-261028-02',
          product: 'Sirloin Choice USA (Primal)',
          productId: 'PROD_02',
          daysLeft: 29,
          expiryDate: seedRelativeYmd(29),
          weightGram: 82000,
          maxCapacityGram: 90000,
          hppKgRupiah: 165000,
          loc: 'FREEZER-A-02',
          isFefo: false,
          isQuarantined: false,
        },
        {
          id: 'LOT_03',
          code: 'LOT-TET-261030-01',
          product: 'Tetelan Rawon Super (Konversi)',
          productId: 'PROD_03',
          daysLeft: 18,
          expiryDate: seedRelativeYmd(18),
          weightGram: 24000,
          maxCapacityGram: 60000,
          hppKgRupiah: 65000,
          loc: 'FREEZER-B-01',
          isFefo: false,
          isQuarantined: false,
        },
        {
          id: 'LOT_04',
          code: 'LOT-TND-261005-03',
          product: 'Tenderloin Grassfed Australia',
          productId: 'PROD_04',
          daysLeft: 3,
          expiryDate: seedRelativeYmd(3),
          weightGram: 18500,
          maxCapacityGram: 30000,
          hppKgRupiah: 195000,
          loc: 'FREEZER-A-01',
          isFefo: true,
          isQuarantined: false,
        },
        {
          id: 'LOT_05',
          code: 'LOT-SLI-261010-04',
          product: 'US Beef Shortplate 500g Slice',
          productId: 'PROD_05',
          daysLeft: 5,
          expiryDate: seedRelativeYmd(5),
          weightGram: 32000,
          maxCapacityGram: 50000,
          hppKgRupiah: 125000,
          loc: 'FREEZER-B-02',
          isFefo: true,
          isQuarantined: false,
        },
        {
          id: 'LOT_06',
          code: 'LOT-WGY-261102-05',
          product: 'Wagyu Ribeye MB7+ Australia (Fresh Inbound)',
          productId: 'PROD_06',
          daysLeft: 75,
          expiryDate: seedRelativeYmd(75),
          weightGram: 36000,
          maxCapacityGram: 50000,
          hppKgRupiah: 380000,
          loc: 'FREEZER-C-01',
          isFefo: false,
          isQuarantined: false,
        },
        {
          id: 'LOT_07',
          code: 'LOT-OX-261101-06',
          product: 'Oxtail Buntut Sapi Impor (Cold Storage Inbound)',
          productId: 'PROD_07',
          daysLeft: 45,
          expiryDate: seedRelativeYmd(45),
          weightGram: 45000,
          maxCapacityGram: 60000,
          hppKgRupiah: 140000,
          loc: 'FREEZER-B-01',
          isFefo: false,
          isQuarantined: false,
        },
      ],
      customers: SAMPLE_CUSTOMERS,
      receivables: [
        {
          id: 'REC_01',
          customer: 'Hotel Grand Serang',
          tier: 'HOREKA',
          amount: 12500000,
          limit: 25000000,
          dueDate: '16 Nov 2026 (11 hari lagi)',
          category: 'LEBIH_7_HARI' as const,
          daysDiff: 11,
          invoice: 'INV-HP03-261102-0012',
          itemsSummary: '50.0 KG Ribeye Meltique AUS, 30.0 KG Tenderloin',
          phone: '0812-8899-7711',
          status: 'BELUM_LUNAS' as const,
        },
        {
          id: 'REC_02',
          customer: 'Steakhouse Banten Prima',
          tier: 'HOREKA',
          amount: 4400000,
          limit: 5000000,
          dueDate: '05 Nov 2026 (Hari Ini)',
          category: 'HARI_INI' as const,
          daysDiff: 0,
          invoice: 'INV-HP03-261028-0089',
          itemsSummary: '25.0 KG Sirloin Choice USA',
          phone: '0813-1122-3344',
          status: 'BELUM_LUNAS' as const,
        },
        {
          id: 'REC_03',
          customer: 'Resto Padang Sederhana Cilegon',
          tier: 'RESTO',
          amount: 5800000,
          limit: 8000000,
          dueDate: '01 Nov 2026 (Terlambat 4 hari)',
          category: 'TERLAMBAT' as const,
          daysDiff: -4,
          invoice: 'INV-HP03-261018-0044',
          itemsSummary: '80.0 KG Tetelan Rawon Super',
          phone: '0819-5566-7788',
          status: 'BELUM_LUNAS' as const,
        },
        {
          id: 'REC_04',
          customer: 'Dapur Catering Krakatau',
          tier: 'CATERING',
          amount: 3200000,
          limit: 6000000,
          dueDate: '29 Okt 2026 (Terlambat 7 hari)',
          category: 'TERLAMBAT' as const,
          daysDiff: -7,
          invoice: 'INV-HP03-261015-0031',
          itemsSummary: '40.0 KG US Beef Shortplate',
          phone: '0857-4433-2211',
          status: 'BELUM_LUNAS' as const,
        },
        {
          id: 'REC_05',
          customer: 'Cafe & Grill Anyer Beach',
          tier: 'HOREKA',
          amount: 2750000,
          limit: 4000000,
          dueDate: '05 Nov 2026 (Hari Ini)',
          category: 'HARI_INI' as const,
          daysDiff: 0,
          invoice: 'INV-HP03-261029-0095',
          itemsSummary: '15.0 KG Ribeye Meltique AUS',
          phone: '0812-9988-1122',
          status: 'BELUM_LUNAS' as const,
        },
        {
          id: 'REC_06',
          customer: 'Hotel Swiss-Belinn Cikande',
          tier: 'HOREKA',
          amount: 8600000,
          limit: 15000000,
          dueDate: '09 Nov 2026 (4 hari lagi)',
          category: 'AKAN_DATANG' as const,
          daysDiff: 4,
          invoice: 'INV-HP03-261101-0005',
          itemsSummary: '35.0 KG Ribeye AUS, 25.0 KG Tenderloin',
          phone: '0821-3344-5566',
          status: 'BELUM_LUNAS' as const,
        },
        {
          id: 'REC_07',
          customer: 'Rumah Makan Sambal Belut Serang',
          tier: 'RESTO',
          amount: 1950000,
          limit: 3000000,
          dueDate: '11 Nov 2026 (6 hari lagi)',
          category: 'AKAN_DATANG' as const,
          daysDiff: 6,
          invoice: 'INV-HP03-261103-0019',
          itemsSummary: '30.0 KG Tetelan Rawon Super',
          phone: '0878-6655-4433',
          status: 'BELUM_LUNAS' as const,
        },
      ],
      inboundPOs: [
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
      ],
      supplierInvoices: [
        {
          id: 'SUP_INV_01',
          invoiceNumber: 'INV-SUP-TEYS-2610-098',
          poNumber: 'PO-2611-004',
          supplier: 'PT Meat Importers Indonesia',
          supplierPhone: '0811-8822-3344',
          originCountry: 'Australia',
          totalAmountRupiah: 145000000,
          paidAmountRupiah: 80000000,
          remainingAmountRupiah: 65000000,
          dueDate: '15 Nov 2026 (9 hari lagi)',
          daysDiff: 9,
          status: 'CICILAN' as const,
        },
        {
          id: 'SUP_INV_02',
          invoiceNumber: 'INV-SUP-JBS-2610-044',
          poNumber: 'PO-2610-098',
          supplier: 'Australia Beef Direct Ltd',
          supplierPhone: '0812-7700-9911',
          originCountry: 'Australia',
          totalAmountRupiah: 58000000,
          paidAmountRupiah: 0,
          remainingAmountRupiah: 58000000,
          dueDate: '08 Nov 2026 (2 hari lagi)',
          daysDiff: 2,
          status: 'BELUM_LUNAS' as const,
        },
        {
          id: 'SUP_INV_03',
          invoiceNumber: 'INV-SUP-AM-2609-001',
          poNumber: 'PO-2609-012',
          supplier: 'JBS USA Beef Export Inc',
          supplierPhone: '0813-9944-5566',
          originCountry: 'USA',
          totalAmountRupiah: 92000000,
          paidAmountRupiah: 92000000,
          remainingAmountRupiah: 0,
          dueDate: '25 Okt 2026 (Lunas)',
          daysDiff: -12,
          status: 'LUNAS' as const,
        },
      ],
      bazarPromos: INITIAL_BAZAR_PROMOS,
      categories: INITIAL_PRODUCT_CATEGORIES,
      suppliers: DEFAULT_SUPPLIERS,
      supplierPhones: DEFAULT_SUPPLIER_PHONES,
    }),
    []
  );

  const [engineState, setEngineState] = useState<BusinessEngineState>(() => loadEngineState(initialEngineSeed));
  const latestEngineStateRef = useRef<BusinessEngineState>(engineState);
  latestEngineStateRef.current = engineState;
  const hasMutatedEngineRef = useRef(false);
  const isSecondaryActionSubmittingRef = useRef(false);
  const operationalSummary = useMemo(() => selectOperationalSummary(engineState), [engineState]);

  useEffect(() => {
    return subscribePersistenceErrors((msg) => {
      triggerNotification('Peringatan Penyimpanan', msg, 'warning');
    });
  }, []);

  useEffect(() => {
    const flushState = () => {
      if (hasMutatedEngineRef.current) {
        persistEngineState(latestEngineStateRef.current);
      }
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        flushState();
      }
    };
    window.addEventListener('pagehide', flushState);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('pagehide', flushState);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  useEffect(() => {
    let active = true;
    const initialSnap = latestEngineStateRef.current;
    hydrateEngineStateFromIdb(initialSnap, {
      bazarPromos: INITIAL_BAZAR_PROMOS,
      categories: INITIAL_PRODUCT_CATEGORIES,
      suppliers: DEFAULT_SUPPLIERS,
      supplierPhones: DEFAULT_SUPPLIER_PHONES,
    }).then((result) => {
      if (!active || hasMutatedEngineRef.current) return;
      if (result.source === 'indexeddb' && result.state.lastUpdatedAt !== initialSnap.lastUpdatedAt) {
        latestEngineStateRef.current = result.state;
        setEngineState(result.state);
      }
    });
    return () => {
      active = false;
    };
    // Hydrate from IndexedDB once on initial mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const commitEngineResultState = (nextState: BusinessEngineState) => {
    hasMutatedEngineRef.current = true;
    latestEngineStateRef.current = nextState;
    setEngineState(nextState);
  };

  const updateEngineAndPersist = (updater: (prev: BusinessEngineState) => BusinessEngineState) => {
    hasMutatedEngineRef.current = true;
    const next = {
      ...updater(latestEngineStateRef.current),
      lastUpdatedAt: new Date().toISOString(),
    };
    latestEngineStateRef.current = next;
    persistEngineState(next);
    setEngineState(next);
  };

  // Projections derived from Single Source of Truth
  const products = engineState.products;
  const lots = engineState.lots;
  const customers = engineState.customers;
  const receivables = engineState.receivables;
  const inboundPOs = engineState.inboundPOs;
  const supplierInvoices = engineState.supplierInvoices;
  const bazarPromos = (engineState.bazarPromos ?? INITIAL_BAZAR_PROMOS) as BazarPromoItem[];
  const categories = (engineState.categories ?? INITIAL_PRODUCT_CATEGORIES) as ProductCategory[];
  const suppliers = engineState.suppliers ?? DEFAULT_SUPPLIERS;
  const supplierPhones = engineState.supplierPhones ?? DEFAULT_SUPPLIER_PHONES;

  const setProducts = (updater: any) =>
    updateEngineAndPersist((prev) => ({
      ...prev,
      products: typeof updater === 'function' ? updater(prev.products) : updater,
    }));
  const setLots = (updater: any) =>
    updateEngineAndPersist((prev) => ({
      ...prev,
      lots: typeof updater === 'function' ? updater(prev.lots) : updater,
    }));
  const setCustomers = (updater: any) =>
    updateEngineAndPersist((prev) => ({
      ...prev,
      customers: typeof updater === 'function' ? updater(prev.customers) : updater,
    }));
  const setReceivables = (updater: any) =>
    updateEngineAndPersist((prev) => ({
      ...prev,
      receivables: typeof updater === 'function' ? updater(prev.receivables) : updater,
    }));
  const setInboundPOs = (updater: any) =>
    updateEngineAndPersist((prev) => ({
      ...prev,
      inboundPOs: typeof updater === 'function' ? updater(prev.inboundPOs) : updater,
    }));
  const setSupplierInvoices = (updater: any) =>
    updateEngineAndPersist((prev) => ({
      ...prev,
      supplierInvoices: typeof updater === 'function' ? updater(prev.supplierInvoices) : updater,
    }));

  const [editingSupplierPhoneId, setEditingSupplierPhoneId] = useState<string | null>(null);
  const [supplierPhoneDraft, setSupplierPhoneDraft] = useState<string>('');

  const saveSupplierPhone = (supplierName: string, phone: string, invoiceId?: string) => {
    const trimmed = phone.trim();
    if (!trimmed) return;
    const res = updateSupplierPhoneRecord(latestEngineStateRef.current, supplierName, trimmed, invoiceId);
    if (!res.ok) {
      triggerNotification('Gagal Menyimpan Kontak', res.message, 'warning');
      return;
    }
    commitEngineResultState(res.state);
    const nextPhones = res.state.supplierPhones ?? {};
    try {
      localStorage.setItem('karkasia_supplier_phones', JSON.stringify(nextPhones));
    } catch {
      // ignore storage errors
    }
    void idbSetPreference('supplier_phones', nextPhones);
    setEditingSupplierPhoneId(null);
    setSupplierPhoneDraft('');
    triggerNotification('Nomor Kontak Supplier Disimpan', res.message, 'success');
  };

  // Warehouse View Mode
  const [warehouseSubTab, setWarehouseSubTab] = useState<'BATCH_LOTS' | 'PRICE_CATALOG' | 'CATEGORIES'>('BATCH_LOTS');

  // Master Kategori Produk Reactive State (persisted inside engineState)
  const [showCategoryManagerModal, setShowCategoryManagerModal] = useState<boolean>(false);

  const handleAddCategory = (newCat: ProductCategory) => {
    const res = addProductCategory(latestEngineStateRef.current, newCat);
    if (!res.ok) {
      triggerNotification('Kategori Tidak Ditambahkan', res.message, 'warning');
      return;
    }
    commitEngineResultState(res.state);
    triggerNotification('Kategori Baru Ditambahkan', `Kategori ${newCat.label} (${newCat.id}) aktif di Kasir, Gudang, & PO`, 'success');
  };

  const handleDeleteCategory = (catId: string) => {
    const res = deleteProductCategory(latestEngineStateRef.current, catId);
    if (!res.ok) {
      triggerNotification('Gagal Menghapus Kategori', res.message, 'warning');
      return;
    }
    commitEngineResultState(res.state);
    triggerNotification('Kategori Dihapus', res.message, 'info');
  };

  // Quick Action Modals State (In-Context / Tanpa Pindah Halaman)
  const [showPriceManagerModal, setShowPriceManagerModal] = useState<boolean>(false);
  const [priceManagerTargetId, setPriceManagerTargetId] = useState<string | null>(null);
  const [showQuickAddCustomerModal, setShowQuickAddCustomerModal] = useState<boolean>(false);
  const [showQuickAddProductModal, setShowQuickAddProductModal] = useState<boolean>(false);
  const [showCustomerDashboardModal, setShowCustomerDashboardModal] = useState<boolean>(false);
  const [selectedDashboardCustomerId, setSelectedDashboardCustomerId] = useState<string | null>(null);
  const [editingPhotoProduct, setEditingPhotoProduct] = useState<any | null>(null);
  const [viewingGalleryProduct, setViewingGalleryProduct] = useState<any | null>(null);
  const [weighingProduct, setWeighingProduct] = useState<any | null>(null);
  const [showBulkQrModal, setShowBulkQrModal] = useState<boolean>(false);

  const handleCommitBulkOpname = (updatedLots: Array<{ id: string; physicalWeightGram: number }>) => {
    let nextState = latestEngineStateRef.current;
    let succeededCount = 0;
    const failedMessages: string[] = [];
    for (const match of updatedLots) {
      const res = executeStockOpname(nextState, {
        lotId: match.id,
        physicalWeightGram: match.physicalWeightGram,
        reason: 'Bulk Stock Opname Scan QR Gudang',
        actorName: 'Staf Gudang',
        isOnline,
      });
      if (res.ok) {
        nextState = res.state;
        succeededCount += 1;
      } else {
        failedMessages.push(res.message);
      }
    }
    if (nextState !== latestEngineStateRef.current) {
      commitEngineResultState(nextState);
    }

    if (succeededCount === 0) {
      triggerNotification(
        'Bulk Stock Opname Tidak Tersimpan',
        failedMessages[0] || 'Tidak ada batch valid yang berhasil diperbarui.',
        'warning'
      );
      return;
    }

    triggerNotification(
      'Bulk Stock Opname Berhasil! 📦',
      failedMessages.length > 0
        ? `${succeededCount} batch diperbarui, ${failedMessages.length} batch dilewati (${failedMessages[0]}).`
        : `${succeededCount} batch karton daging berhasil diverifikasi dan diperbarui di stok cold storage.`,
      failedMessages.length > 0 ? 'warning' : 'success'
    );
  };

  const handleUpdateProductGallery = (productId: string, newGallery: ProductGalleryItem[]) => {
    setProducts(prev => prev.map(p => p.id === productId ? { ...p, gallery: newGallery } : p));
    triggerNotification('Galeri Foto Diperbarui 📸', `Sudut pandang foto produk berhasil disimpan (${newGallery.length} foto).`, 'success');
  };

  const handleSaveProductPhoto = (productId: string, newImageUrl: string) => {
    setProducts(prev => prev.map(p => p.id === productId ? { ...p, imageUrl: newImageUrl } : p));
    triggerNotification('Foto Produk Diperbarui 📸', 'Foto produk berhasil diubah.', 'success');
  };

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

  // Cart State (Zero-Float Gram Policy — starts clean on operational boot)
  const [cart, setCart] = useState<CartItemState[]>([]);

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

  // Smart Default: Uang Pas otomatis mengikuti total belanja kecuali kasir input manual
  useEffect(() => {
    if (!isCustomCash || paymentMethod !== 'CASH') {
      setCashTendered(grandTotalRupiah);
    }
  }, [grandTotalRupiah, isCustomCash, paymentMethod]);

  // Credit Limit Check
  const projectedReceivable = customer.currentReceivable + grandTotalRupiah;
  const isCashOnlyCustomer = customer.creditLimit === 0;
  const isOverCreditLimit = customer.creditLimit > 0 && projectedReceivable > customer.creditLimit;
  const isTempoBlocked = paymentMethod === 'TEMPO' && (isCashOnlyCustomer || isOverCreditLimit);

  // Cart Handlers with GoPay Microcopy
  const handleAddToCart = (product: any, defaultGram: number = 1000) => {
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

  const startLongPress = (product: any) => {
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
    if (isCheckoutSubmittingRef.current) {
      return;
    }
    isCheckoutSubmittingRef.current = true;
    try {
      if (isTempoBlocked && !isOwnerApproved) {
        setShowPinModal(true);
        return;
      }

      const currentState = latestEngineStateRef.current;
      const activePromos = (currentState.bazarPromos ?? INITIAL_BAZAR_PROMOS) as BazarPromoItem[];
      const lineItems = cart.map((item) => {
        const liveProd =
          currentState.products.find((p) => p.id === item.product.id) || (item.product as ProductEntity);
        const pricing = getProductTierPrice(liveProd, customer.tier, item.weightGram, activePromos);
        return {
          product: liveProd,
          weightGram: item.weightGram,
          effectivePricePerKg: pricing.effectivePricePerKg,
          appliedPromoId: pricing.appliedPromoId,
        };
      });

      const result = commitSaleTransaction(currentState, {
        idempotencyKey: checkoutIdempotencyKeyRef.current,
        customerId: customer.id,
        paymentMethod,
        isFreeShipping,
        shippingFee,
        cashTendered,
        items: lineItems,
        bazarPromos: activePromos,
        ownerApprovedOverride: isOwnerApproved,
        isOnline,
        actorName: 'Kasir Toko',
      });

      if (result.state !== currentState) {
        commitEngineResultState(result.state);
      }

      if (!result.ok) {
        if (result.errorCode === 'DUPLICATE') {
          const rotatedKey = generateUUID();
          checkoutIdempotencyKeyRef.current = rotatedKey;
          setCheckoutIdempotencyKey(rotatedKey);
          triggerNotification('Transaksi Sudah Tercatat', result.message, 'info');
          return;
        }
        if (result.errorCode === 'APPROVAL_REQUIRED') {
          setShowPinModal(true);
        }
        triggerNotification('Periksa Transaksi', result.message, 'warning');
        return;
      }

      if (result.createdInvoice) {
        const invoiceRecord = {
          invoiceNumber: result.createdInvoice.invoiceNumber,
          customerName: result.createdInvoice.customerName,
          customerTier: result.createdInvoice.customerTier,
          paymentMethod: result.createdInvoice.paymentMethod,
          tempoDays: result.createdInvoice.tempoDays,
          totalWeightGram: result.createdInvoice.totalWeightGram,
          subtotalRupiah: result.createdInvoice.subtotalRupiah,
          discountRupiah: result.createdInvoice.discountRupiah ?? 0,
          shippingFee: result.createdInvoice.shippingFee,
          originalShipping: shippingFee,
          isFreeShipping: result.createdInvoice.isFreeShipping,
          grandTotalRupiah: result.createdInvoice.grandTotalRupiah,
          items: result.createdInvoice.items,
          paidAmountRupiah: result.createdInvoice.paidAmountRupiah ?? result.createdInvoice.grandTotalRupiah,
          balanceDueRupiah: result.createdInvoice.balanceDueRupiah ?? 0,
          cashTendered: result.createdInvoice.cashTendered ?? (paymentMethod === 'CASH' ? cashTendered : result.createdInvoice.grandTotalRupiah),
          changeRupiah: result.createdInvoice.changeRupiah ?? 0,
          timestamp: new Date(result.createdInvoice.timestamp).toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          }),
        };

        const rotatedKey = generateUUID();
        checkoutIdempotencyKeyRef.current = rotatedKey;
        setCheckoutIdempotencyKey(rotatedKey);
        setLastIssuedInvoice(invoiceRecord);
        setShowThermalReceipt(true);
        setIsOwnerApproved(false);
        setIsCustomCash(false);

        triggerNotification(
          'Transaksi Berhasil Dicatat',
          `Faktur ${result.createdInvoice.invoiceNumber} · ${customer.name}. Stok dan catatan keuangan otomatis diperbarui.`,
          'success',
          result.createdInvoice.grandTotalRupiah
        );
      }
    } finally {
      isCheckoutSubmittingRef.current = false;
    }
  };

  // QR Code Generation & Shelf Relocation State
  const [selectedLotForQr, setSelectedLotForQr] = useState<any | null>(null);
  const [showLotQrModal, setShowLotQrModal] = useState<boolean>(false);
  const [scannedLotForLocationPrompt, setScannedLotForLocationPrompt] = useState<any | null>(null);
  const [showShelfLocationPromptModal, setShowShelfLocationPromptModal] = useState<boolean>(false);

  // Critical FEFO Lots (< 7 Days Shelf-life)
  const criticalFefoLots = useMemo(() => {
    return lots.filter(l => l.daysLeft <= 7 && !l.isQuarantined && l.weightGram > 0);
  }, [lots]);

  // Trimming Conversion Modal State
  const [showConversionModal, setShowConversionModal] = useState(false);
  const [conversionGram, setConversionGram] = useState<number>(10000);
  const [conversionYieldPercent, setConversionYieldPercent] = useState<number>(85);

  // Stock Opname Modal State
  const [showOpnameModal, setShowOpnameModal] = useState(false);
  const [selectedLotForOpname, setSelectedLotForOpname] = useState(lots[0]);
  const [physicalWeightGram, setPhysicalWeightGram] = useState<number>(47800);
  const [opnameReason, setOpnameReason] = useState('Susut pencairan & selisih timbang freezer');

  const handleCommitConversion = () => {
    const primaryGram = Math.round((conversionGram * conversionYieldPercent) / 100);
    const secondaryGram = Math.max(0, conversionGram - primaryGram);
    const res = executeTrimmingConversion(latestEngineStateRef.current, {
      sourceLotId: 'LOT_01',
      inputGram: conversionGram,
      primaryGram,
      secondaryGram,
      actorName: 'Staf Potong Daging',
      isOnline,
    });
    commitEngineResultState(res.state);
    setShowConversionModal(false);
    triggerNotification(
      res.ok ? 'Pemotongan Daging Selesai' : 'Gagal Memproses Pemotongan',
      res.message,
      res.ok ? 'info' : 'warning'
    );
  };

  const handleCommitOpname = () => {
    const res = executeStockOpname(latestEngineStateRef.current, {
      lotId: selectedLotForOpname.id,
      physicalWeightGram,
      reason: opnameReason,
      actorName: 'Staf Gudang',
      isOnline,
    });
    commitEngineResultState(res.state);
    setShowOpnameModal(false);
    triggerNotification(
      res.ok ? 'Hasil Cek Fisik Disimpan' : 'Gagal Menyimpan Cek Fisik',
      res.message,
      res.ok ? 'success' : 'warning'
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

    // Check if code matches a lot directly, partially, or via JSON payload
    let matched = lots.find(l => 
      l.code.toLowerCase() === cleanCode.toLowerCase() ||
      cleanCode.includes(l.code) ||
      l.product.toLowerCase().includes(cleanCode.toLowerCase())
    );

    if (!matched && cleanCode.startsWith('{') && cleanCode.endsWith('}')) {
      try {
        const parsed = JSON.parse(cleanCode);
        if (parsed.batch) {
          matched = lots.find(l => l.code === parsed.batch);
        }
      } catch {
        // ignore parse error
      }
    }

    if (matched) {
      setScannedLotForLocationPrompt(matched);
      setShowShelfLocationPromptModal(true);
    } else {
      setInventorySearchQuery(cleanCode);
      setInventoryFilterStatus('ALL');
      setActiveTab('warehouse');
      setWarehouseSubTab('BATCH_LOTS');
      triggerNotification(
        'Scan QR Terdeteksi',
        `Menampilkan hasil filter untuk batch: ${cleanCode}`,
        'info'
      );
    }
  };

  const handleConfirmLocation = (lotId: string, newLocation: string, isMoved: boolean) => {
    if (isMoved) {
      setLots(prev => prev.map(l => l.id === lotId ? { ...l, loc: newLocation } : l));
      const targetLot = lots.find(l => l.id === lotId);
      triggerNotification(
        'Perpindahan Rak Disimpan! 📍',
        `Batch ${targetLot?.code || lotId} berhasil dipindahkan ke rak ${newLocation}`,
        'success'
      );
    } else {
      triggerNotification(
        'Lokasi Rak Terkonfirmasi! ✅',
        `Posisi rak tetap di ${newLocation}. Menampilkan detail stok lot.`,
        'info'
      );
    }

    const targetLot = lots.find(l => l.id === lotId);
    if (targetLot) {
      setInventorySearchQuery(targetLot.code);
    }
    setInventoryFilterStatus('ALL');
    setActiveTab('warehouse');
    setWarehouseSubTab('BATCH_LOTS');
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
      console.error('Google Drive auth failed:', err);
      triggerNotification('Gagal Menghubungkan Google Drive', 'Periksa koneksi atau coba masuk ulang beberapa saat lagi.', 'warning');
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
        totalGrossRevenue: operationalSummary.weeklyRevenue,
        totalCogs: operationalSummary.weeklyCogs,
        grossProfit: operationalSummary.weeklyGrossProfit,
        totalOpex: operationalSummary.weeklyOpex,
        netOperatingProfit: operationalSummary.netOperatingProfit,
        estimatedUmkmTax: operationalSummary.estimatedUmkmTax,
        netProfitAfterTax: operationalSummary.netProfitAfterTax,
        opexList: [
          { voucher: 'VCH-01', category: 'Dry Ice & Es Balok', desc: 'Pendingin pengiriman Horeka Serang', amount: 350000, time: '08:30' },
          { voucher: 'VCH-02', category: 'Plastik Vacuum Roll', desc: 'Plastik food grade 500g & 1kg', amount: 450000, time: '10:15' },
          { voucher: 'VCH-03', category: 'BBM Armada Box', desc: 'Solar armada pendingin L300', amount: 300000, time: '11:00' },
        ],
        dailySales: DAILY_SALES_7_DAYS,
        totalInventoryAssetHpp: operationalSummary.totalInventoryValueRupiah,
        totalInventoryKg: operationalSummary.totalInventoryWeightGram / 1000
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
      console.error('Drive financial upload failed:', err);
      triggerNotification('Gagal Menyimpan ke Drive', 'Periksa koneksi internet Anda lalu coba simpan ulang.', 'warning');
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
      const totalDebit = engineState.journals.reduce((acc, j) => acc + j.totalDebit, 0);
      const totalCredit = engineState.journals.reduce((acc, j) => acc + j.totalCredit, 0);
      const { blob, filename } = generateJournalReportPdfBlob(totalDebit, totalCredit);

      const uploaded = await uploadPdfToDrive({
        accessToken: driveAccessToken,
        blob,
        filename,
        description: 'Catatan Akuntansi Otomatis Toko Daging KARKASIA'
      });

      setShowDriveSuccessModal({
        show: true,
        fileName: uploaded.file.name,
        fileUrl: uploaded.file.webViewLink,
        folderName: uploaded.folderName
      });

      loadDriveFileList();
      triggerNotification('Catatan Akuntansi Disinkronkan ke Drive', `${filename} berhasil diamankan ke cloud`, 'success');
    } catch (err: any) {
      console.error('Drive journal upload failed:', err);
      triggerNotification('Gagal Menyimpan ke Drive', 'Periksa koneksi internet Anda lalu coba simpan ulang.', 'warning');
    } finally {
      setIsUploadingToDrive(false);
    }
  };

  const handleDownloadFinancialReportPdf = () => {
    try {
      const { blob, filename } = generateFinancialReportPdfBlob({
        totalGrossRevenue: operationalSummary.weeklyRevenue,
        totalCogs: operationalSummary.weeklyCogs,
        grossProfit: operationalSummary.weeklyGrossProfit,
        totalOpex: operationalSummary.weeklyOpex,
        netOperatingProfit: operationalSummary.netOperatingProfit,
        estimatedUmkmTax: operationalSummary.estimatedUmkmTax,
        netProfitAfterTax: operationalSummary.netProfitAfterTax,
        opexList: [
          { voucher: 'VCH-01', category: 'Dry Ice & Es Balok', desc: 'Pendingin pengiriman Horeka Serang', amount: 350000, time: '08:30' },
          { voucher: 'VCH-02', category: 'Plastik Vacuum Roll', desc: 'Plastik food grade 500g & 1kg', amount: 450000, time: '10:15' },
          { voucher: 'VCH-03', category: 'BBM Armada Box', desc: 'Solar armada pendingin L300', amount: 300000, time: '11:00' },
        ],
        dailySales: DAILY_SALES_7_DAYS,
        totalInventoryAssetHpp: operationalSummary.totalInventoryValueRupiah,
        totalInventoryKg: operationalSummary.totalInventoryWeightGram / 1000
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      triggerNotification('Laporan PDF Diunduh', `${filename} berhasil diunduh ke perangkat Anda`, 'success');
    } catch (err: any) {
      console.error('PDF generation failed:', err);
      triggerNotification('Gagal Mengunduh Laporan', 'Laporan PDF belum dapat dibuat saat ini. Silakan coba lagi.', 'warning');
    }
  };

  // Filtered Products for POS
  const filteredProducts = products.filter(p => {
    const matchesCategory = selectedCategory === 'ALL' || 
                          (selectedCategory === 'SAFETY_CRITICAL' ? p.stockGram <= p.safetyStockGram : p.category === selectedCategory);
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
                          (inventoryFilterStatus === 'KRITIS' && !l.isQuarantined && l.daysLeft <= 30) ||
                          (inventoryFilterStatus === 'FEFO' && !l.isQuarantined && l.isFefo) ||
                          (inventoryFilterStatus === 'NORMAL' && !l.isQuarantined && !l.isFefo);
    return matchesSearch && matchesStatus;
  });

  // Calculate current total sellable inventory asset valuation at HPP (excludes quarantined return lots)
  const totalHppInventoryValuation = lots
    .filter((l) => !l.isQuarantined)
    .reduce((acc, curr) => {
      return acc + Math.round((curr.weightGram * curr.hppKgRupiah) / 1000);
    }, 0);
  const totalWeightInStockGram = lots
    .filter((l) => !l.isQuarantined)
    .reduce((acc, curr) => acc + curr.weightGram, 0);

  // Purchasing & Payables projections are managed by engineState above
  const [purchasingSubTab, setPurchasingSubTab] = useState<'INBOUND' | 'AP_DEBT'>('INBOUND');
  const [showCreatePOModal, setShowCreatePOModal] = useState<boolean>(false);
  const [poInitialData, setPoInitialData] = useState<any>(null);

  // Automated Visual & Toast Notification Alert for Safety Stock Warning (fires once per tab visit)
  useEffect(() => {
    if (activeTab !== 'pos') {
      lastSafetyWarnedTabRef.current = null;
      return;
    }
    if (lastSafetyWarnedTabRef.current === 'pos') return;
    const criticalProds = products.filter(p => p.stockGram <= p.safetyStockGram);
    if (criticalProds.length > 0) {
      lastSafetyWarnedTabRef.current = 'pos';
      const prodNames = criticalProds.map(p => `${p.name} (${(p.stockGram/1000).toFixed(1)} KG)`).join(', ');
      triggerNotification(
        'Peringatan Stok Menipis',
        `${criticalProds.length} produk berada di bawah batas aman: ${prodNames}.`,
        'warning'
      );
    }
  }, [activeTab, products]);
  const [showSupplierPayableModal, setShowSupplierPayableModal] = useState<boolean>(false);
  const [selectedSupplierInvoice, setSelectedSupplierInvoice] = useState<SupplierInvoice | null>(null);

  // Kasir Kecil & Biaya Toko
  const [showPettyCashModal, setShowPettyCashModal] = useState<boolean>(false);

  // Promo Bazar Berjadwal
  const [showBazarPromoModal, setShowBazarPromoModal] = useState<boolean>(false);

  const [receivableFilter, setReceivableFilter] = useState<'ALL' | 'HARI_INI' | 'TERLAMBAT' | 'AKAN_DATANG' | 'LEBIH_7_HARI'>('ALL');
  const [receivableSearch, setReceivableSearch] = useState('');

  // Potong & Olah Daging
  const [showYieldModal, setShowYieldModal] = useState(false);
  const [yieldSourceLotId, setYieldSourceLotId] = useState('LOT_01');
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
  const [returnProduct, setReturnProduct] = useState(SAMPLE_PRODUCTS[0].name);
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
    if (isSecondaryActionSubmittingRef.current) return;
    isSecondaryActionSubmittingRef.current = true;
    try {
      const inputGram = Math.round(yieldInputWeightKg * 1000);
      const primaryGram = Math.round(yieldPrimaryWeightKg * 1000);
      const secondaryGram = Math.round(yieldSecondaryWeightKg * 1000);

      const res = executeTrimmingConversion(latestEngineStateRef.current, {
        sourceLotId: yieldSourceLotId,
        inputGram,
        primaryGram,
        secondaryGram,
        actorName: 'Staf Potong Daging',
        isOnline,
      });

      commitEngineResultState(res.state);
      if (!res.ok) {
        triggerNotification('Stok Kurang', res.message, 'warning');
        return;
      }

      setShowYieldModal(false);
      triggerNotification('Pemotongan Daging Selesai', res.message, 'success');
    } finally {
      isSecondaryActionSubmittingRef.current = false;
    }
  };

  // -------------------------------------------------------------
  // Handlers for Voice Note Order Assistant
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

  const handleSyncOutboxNow = async (silent = false) => {
    if (isSyncingOutbox) return;
    if (!isOnline) {
      if (!silent) {
        triggerNotification(
          'Mode Offline Aktif',
          'Transaksi tetap tersimpan aman di Outbox perangkat (PENDING) dan belum dikirim ke server.',
          'info'
        );
      }
      return;
    }

    if (activeAdapter.type === 'LOCAL_ONLY') {
      if (!silent) {
        triggerNotification(
          'Mode Lokal Mandiri Aktif',
          'Transaksi tetap berstatus PENDING di Outbox perangkat. Hubungkan adapter server di menu Backup & Sinkronisasi jika ingin mengirim ke server eksternal.',
          'info'
        );
      }
      return;
    }

    setIsSyncingOutbox(true);
    try {
      const { state: nextState, result } = await executeOutboxSyncWithAdapter(latestEngineStateRef.current, activeAdapter);
      commitEngineResultState(nextState);
      if (!silent) {
        triggerNotification(
          result.ok ? 'Sinkronisasi Dikonfirmasi Server' : 'Sinkronisasi Belum Lengkap',
          result.message,
          result.ok ? 'success' : 'warning'
        );
      }
    } finally {
      setIsSyncingOutbox(false);
    }
  };

  const handleParseVoiceNote = async () => {
    if (!voiceTranscript.trim()) {
      triggerNotification('Pesan Suara Kosong', 'Silakan rekam audio atau pilih salah satu sampel pesan suara sales.', 'warning');
      return;
    }

    setIsParsingVoice(true);
    try {
      const parsed = await activeAdapter.parseVoiceOrder(voiceTranscript);
      setVoiceParseResult(parsed);
      triggerNotification(
        parsed.source === 'local-nlp-engine'
          ? 'Ekstraksi Lokal Berhasil 🎙️'
          : 'Adapter Berhasil Mengekstrak Pesan Suara 🎙️',
        `Terdeteksi pelanggan "${parsed.customerName}" dengan metode ${parsed.paymentMethod}.`,
        'success'
      );
    } catch (err: any) {
      console.warn('Voice parse error:', err);
      triggerNotification('Gagal Memproses Suara', 'Silakan ulangi atau input item pesanan secara manual.', 'warning');
    } finally {
      setIsParsingVoice(false);
    }
  };

  const handleApplyVoiceOrderToCart = () => {
    if (!voiceParseResult) return;

    const liveCustomers = latestEngineStateRef.current.customers;
    const liveProducts = latestEngineStateRef.current.products;

    const matchedCust = liveCustomers.find(c =>
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
      const prod = liveProducts.find(p =>
        p.sku === item.productSku ||
        p.name.toLowerCase().includes(item.productName.toLowerCase()) ||
        item.productName.toLowerCase().includes(p.name.toLowerCase())
      ) || liveProducts[0] || SAMPLE_PRODUCTS[0];

      newCartItems.push({
        product: prod as typeof SAMPLE_PRODUCTS[0],
        weightGram: item.weightGram || 1000,
        pcs: item.quantityPcs || 1
      });
    });

    if (newCartItems.length > 0) {
      setCart(newCartItems);
    }

    setShowVoiceNoteModal(false);
    triggerNotification(
      'Keranjang Terisi Otomatis! 🛒',
      `${newCartItems.length} produk dan metode bayar ${voiceParseResult.paymentMethod} otomatis diterapkan ke Kasir.`,
      'success'
    );
  };

  // -------------------------------------------------------------
  // Handlers for Return Meat & Camera Capture
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
    if (isSecondaryActionSubmittingRef.current) return;
    isSecondaryActionSubmittingRef.current = true;
    try {
      const returnGram = Math.round(returnWeightKg * 1000);
      const currentState = latestEngineStateRef.current;
      const matchedProd = currentState.products.find(
        (p) => p.name.trim().toLowerCase() === returnProduct.trim().toLowerCase()
      );
      const res = executeCustomerReturn(currentState, {
        customerName: returnCustomer,
        invoiceNo: returnInvoice,
        productId: matchedProd?.id,
        productName: returnProduct,
        weightGram: returnGram,
        reason: returnReason,
        resolution: returnResolution,
        actorName: 'Admin Toko',
        isOnline,
      });
      commitEngineResultState(res.state);
      if (!res.ok) {
        triggerNotification('Periksa Data Retur', res.message, 'warning');
        return;
      }
      stopReturnCamera();
      setShowReturnModal(false);

      triggerNotification('Retur Barang Diproses', res.message, 'warning');
    } finally {
      isSecondaryActionSubmittingRef.current = false;
    }
  };

  // Strictly 3 visible operational statuses across all primary operational screens
  const operationalStatus = useMemo(() => {
    if (operationalSummary.pendingApprovalCount > 0) {
      return {
        label: 'Menunggu persetujuan',
        className: 'bg-amber-50 text-amber-800 border-amber-200',
        icon: 'pending' as const,
      };
    }
    const hasCriticalStock = products.some(p => p.stockGram <= p.safetyStockGram);
    const hasOverdueReceivable = receivables.some(r => r.category === 'TERLAMBAT' && r.status !== 'LUNAS');
    if (criticalFefoLots.length > 0 || hasCriticalStock || hasOverdueReceivable) {
      return {
        label: 'Perlu dicek',
        className: 'bg-rose-50 text-rose-800 border-rose-200',
        icon: 'check' as const,
      };
    }
    return {
      label: 'Tersimpan ✓',
      className: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      icon: 'saved' as const,
    };
  }, [operationalSummary.pendingApprovalCount, criticalFefoLots.length, products, receivables]);

  const renderPageSoulHeader = (
    pageTitle: string,
    summaryText: string,
    primaryActionLabel?: string,
    onPrimaryAction?: () => void
  ) => (
    <div className="b2b-card p-3.5 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white">
      <div className="space-y-0.5 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-semibold text-slate-500">Toko Sampora</span>
          <span className="text-slate-300">·</span>
          <h1 className="text-sm font-extrabold text-slate-900">{pageTitle}</h1>
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-semibold ${operationalStatus.className}`}
          >
            {operationalStatus.icon === 'pending' && <Clock className="w-3 h-3" />}
            {operationalStatus.icon === 'check' && <AlertTriangle className="w-3 h-3" />}
            {operationalStatus.icon === 'saved' && <CheckCircle2 className="w-3 h-3" />}
            <span>{operationalStatus.label}</span>
          </span>
        </div>
        <p className="text-xs text-slate-600">{summaryText}</p>
      </div>
      {primaryActionLabel && onPrimaryAction && (
        <button
          type="button"
          onClick={onPrimaryAction}
          className="min-h-[40px] px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 shrink-0 cursor-pointer transition-colors"
        >
          <span>{primaryActionLabel}</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );

  const renderPageSoulFooter = (contextTitle: string) => {
    const recentLogs = engineState.auditTrail.slice(0, 3);
    return (
      <div className="b2b-card p-4 space-y-3 bg-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h4 className="text-xs font-bold text-slate-900">Aktivitas Terbaru · {contextTitle}</h4>
            <p className="text-[11px] text-slate-500">Setiap perubahan tercatat rapi dan bisa ditelusuri kapan saja.</p>
          </div>
          <button
            type="button"
            onClick={() => setActiveSecondaryModule('audit')}
            className="min-h-[40px] px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold inline-flex items-center justify-center gap-1.5 shrink-0 cursor-pointer transition-colors"
          >
            <FileCheck className="w-3.5 h-3.5 text-slate-600" />
            <span>Lihat Rincian &amp; Bukti</span>
          </button>
        </div>
        <div className="divide-y divide-slate-100 border-t border-slate-100">
          {recentLogs.map((log) => (
            <div key={log.uuid} className="py-2 flex items-center justify-between gap-3 text-xs">
              <div className="min-w-0">
                <div className="font-semibold text-slate-800 truncate">{log.humanSummary}</div>
                <div className="text-[11px] text-slate-500">{log.actorName}</div>
              </div>
              <span className="text-[11px] font-mono text-slate-400 shrink-0 tabular-nums">
                {new Date(log.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-emerald-500/20 selection:text-emerald-900 pb-24 md:pb-0">
      
      {/* =========================================================================
          TOP HEADER BAR (Clean, Compact, Everyday Indonesian)
          ========================================================================= */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          
          {/* Logo & Brand Identity */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-slate-900 flex items-center justify-center text-white shrink-0">
              <Box className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-sm tracking-tight text-slate-900 leading-tight">KARKASIA</span>
              <span className="text-[11px] text-slate-500 font-medium hidden sm:inline">
                Toko Daging Sampora
              </span>
            </div>
          </div>

          {/* Center Controls: Persistent Connectivity & Sync Queue Visualizer + Store Name */}
          <div className="flex items-center gap-2">
            <SyncQueueStatusIndicator
              isOnline={isOnline}
              syncOutbox={engineState.syncOutbox}
              adapterType={backendConfig.adapterType}
              adapterLabel={activeAdapterMeta.shortLabel}
              isSyncing={isSyncingOutbox}
              onToggleOfflineSimulation={() => {
                const nextOnline = !isOnline;
                setIsOnline(nextOnline);
                triggerNotification(
                  nextOnline ? 'Terhubung Kembali' : 'Mode Offline Aktif',
                  nextOnline
                    ? activeAdapter.type === 'LOCAL_ONLY'
                      ? 'Perangkat online. Mode Lokal Mandiri aktif — catatan tetap tersimpan aman di perangkat.'
                      : `Perangkat online. Siap mengirim antrean ke ${activeAdapter.displayName}.`
                    : 'Transaksi tetap berjalan normal di perangkat dan tercatat di antrean Outbox (PENDING).',
                  nextOnline ? 'success' : 'info'
                );
              }}
              onSyncNow={() => {
                void handleSyncOutboxNow(false);
              }}
              onOpenBackendSettings={() => setActiveSecondaryModule('backup')}
            />

            <div className="hidden md:flex items-center gap-1.5 px-3 min-h-[40px] rounded-lg bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 whitespace-nowrap shrink-0">
              <Store className="w-3.5 h-3.5 text-slate-500" />
              <span>Kasir Sampora</span>
            </div>
          </div>

          {/* Right Action: PWA Install, Google Drive & Menu Lainnya Hub Button */}
          <div className="flex items-center gap-2">
            <PWAInstallButton />
            {googleDriveUser ? (
              <button
                type="button"
                onClick={() => {
                  loadDriveFileList();
                  setShowDriveVaultModal(true);
                }}
                className="min-h-[40px] px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                title="Buka Penyimpanan Google Drive"
              >
                <FolderCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span className="hidden sm:inline">Drive Aktif</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleConnectGoogleDrive}
                disabled={isConnectingDrive}
                className="min-h-[40px] px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Cloud className={`w-3.5 h-3.5 text-sky-600 ${isConnectingDrive ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">{isConnectingDrive ? '...' : 'Google Drive'}</span>
              </button>
            )}

            {/* Menu Lainnya Grid Button */}
            <button
              type="button"
              onClick={() => setShowModulLainnyaModal(true)}
              className="min-h-[40px] px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap shrink-0"
            >
              <Grid className="w-3.5 h-3.5 text-emerald-400" />
              <span>Menu Lainnya</span>
              {operationalSummary.pendingApprovalCount > 0 && (
                <span className="px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 text-[10px] font-extrabold font-mono leading-none">
                  {operationalSummary.pendingApprovalCount}
                </span>
              )}
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
              { id: 'home', label: 'Ringkasan', icon: Home },
              { id: 'pos', label: 'Kasir', icon: ShoppingCart },
              { id: 'beli', label: 'Beli Stok', icon: Truck },
              { id: 'warehouse', label: 'Stok & Harga', icon: Package },
              { id: 'bayar', label: 'Tagihan', icon: Wallet },
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
                  className={`px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
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
              <span className="text-xs text-slate-500">Sedang membuka:</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200 whitespace-nowrap">
                {activeSecondaryModule === 'laporan' && 'Laporan & Laba Bersih'}
                {activeSecondaryModule === 'approval' && 'Persetujuan Pemilik'}
                {activeSecondaryModule === 'jurnal' && 'Catatan Akuntansi Otomatis'}
                {activeSecondaryModule === 'audit' && 'Riwayat Stok & Pembatalan'}
                {activeSecondaryModule === 'backup' && 'Backup & Sinkronisasi'}
                {activeSecondaryModule === 'pajak' && 'Pajak Usaha (0,5%)'}
                {activeSecondaryModule === 'pengaturan' && 'Pengaturan Toko'}
              </span>
              <button
                type="button"
                onClick={() => setActiveSecondaryModule(null)}
                className="text-xs font-bold text-slate-600 hover:text-slate-900 underline ml-1 whitespace-nowrap cursor-pointer"
              >
                Kembali
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* =========================================================================
          MAIN CONTAINER (Simple Human Experience + Reliable Engine)
          ========================================================================= */}
      <main className="max-w-7xl mx-auto w-full p-4 sm:p-6 flex-1 space-y-6 animate-tab-fade">

        {/* -------------------------------------------------------------------
            SECONDARY MODULE VIEW (Progressive Disclosure from "Menu Lainnya")
            ------------------------------------------------------------------- */}
        {activeSecondaryModule === 'laporan' && (
          <div className="space-y-5 animate-tab-fade">
            <div className="b2b-card p-4 flex items-center justify-between bg-white border-slate-200">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setActiveSecondaryModule(null)}
                  className="p-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer"
                >
                  <ArrowRight className="w-4 h-4 rotate-180" />
                </button>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Laporan Penjualan &amp; Laba Bersih</h3>
                  <p className="text-xs text-slate-500">Ringkasan omzet, harga modal rata-rata, biaya operasional, dan estimasi laba bersih.</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveSecondaryModule(null)}
                className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 whitespace-nowrap cursor-pointer"
              >
                Kembali ke Operasional
              </button>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="b2b-card p-4 space-y-1">
                <span className="text-xs text-slate-500">Total Penjualan (7 Hari)</span>
                <div className="text-base font-extrabold font-mono tabular-nums text-slate-900">
                  Rp {operationalSummary.weeklyRevenue.toLocaleString('id-ID')}
                </div>
              </div>
              <div className="b2b-card p-4 space-y-1">
                <span className="text-xs text-slate-500">Modal Daging Terjual</span>
                <div className="text-base font-extrabold font-mono tabular-nums text-slate-800">
                  Rp {operationalSummary.weeklyCogs.toLocaleString('id-ID')}
                </div>
              </div>
              <div className="b2b-card p-4 space-y-1">
                <span className="text-xs text-slate-500">Keuntungan Kotor</span>
                <div className="text-base font-extrabold font-mono tabular-nums text-emerald-700">
                  Rp {operationalSummary.weeklyGrossProfit.toLocaleString('id-ID')}
                </div>
              </div>
              <div className="b2b-card p-4 space-y-1">
                <span className="text-xs text-slate-500">Laba Bersih (Setelah Pajak)</span>
                <div className="text-base font-extrabold font-mono tabular-nums text-emerald-700">
                  Rp {operationalSummary.netProfitAfterTax.toLocaleString('id-ID')}
                </div>
              </div>
            </div>

            <div className="b2b-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-bold text-slate-900">Unduh atau Simpan Laporan PDF</h4>
                <p className="text-[11px] text-slate-500">Laporan lengkap laba rugi, nilai stok gudang, dan ringkasan pajak usaha</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => exportFinancialReportPdf({
                    totalGrossRevenue: operationalSummary.weeklyRevenue,
                    totalCogs: operationalSummary.weeklyCogs,
                    grossProfit: operationalSummary.weeklyGrossProfit,
                    totalOpex: operationalSummary.weeklyOpex,
                    netOperatingProfit: operationalSummary.netOperatingProfit,
                    estimatedUmkmTax: operationalSummary.estimatedUmkmTax,
                    netProfitAfterTax: operationalSummary.netProfitAfterTax,
                    opexList: [
                      { voucher: 'VCH-01', category: 'Dry Ice & Es Balok', desc: 'Pendingin pengiriman Horeka Serang', amount: 350000, time: '08:30' },
                      { voucher: 'VCH-02', category: 'Plastik Vacuum Roll', desc: 'Plastik food grade 500g & 1kg', amount: 450000, time: '10:15' },
                      { voucher: 'VCH-03', category: 'BBM Armada Box', desc: 'Solar armada pendingin L300', amount: 300000, time: '11:00' },
                    ],
                    dailySales: DAILY_SALES_7_DAYS,
                    totalInventoryAssetHpp: operationalSummary.totalInventoryValueRupiah,
                    totalInventoryKg: operationalSummary.totalInventoryWeightGram / 1000
                  })}
                  className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-xs font-bold text-slate-800 flex items-center gap-1.5 hover:bg-slate-50 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Unduh PDF
                </button>
                <button
                  type="button"
                  onClick={handleUploadFinancialReportToDrive}
                  disabled={isUploadingToDrive}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold flex items-center gap-1.5 hover:bg-slate-800 cursor-pointer"
                >
                  <Cloud className="w-3.5 h-3.5 text-emerald-400" />
                  Simpan ke Google Drive
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="b2b-card p-4 space-y-2">
                <h5 className="text-xs font-bold text-slate-900">Grafik Penjualan 7 Hari Terakhir</h5>
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
                <h5 className="text-xs font-bold text-slate-900">Komposisi Jenis Daging Terjual</h5>
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

        {activeSecondaryModule !== null && activeSecondaryModule !== 'laporan' && (
          <EnterpriseAccountabilityViews
            activeView={activeSecondaryModule}
            engineState={engineState}
            isOnline={isOnline}
            backendConfig={backendConfig}
            isSyncing={isSyncingOutbox}
            onBack={() => setActiveSecondaryModule(null)}
            onResolveApproval={(uuid, decision, pin) => {
              const guard = checkPinAttemptGuard();
              if (!guard.allowed) {
                return {
                  ok: false,
                  message: `Terlalu banyak percobaan PIN salah. Tunggu ${guard.remainingSeconds} detik sebelum mencoba lagi.`,
                };
              }
              const res = resolveApprovalRequest(latestEngineStateRef.current, uuid, decision, pin, 'Pemilik Usaha', isOnline);
              if (!res.ok && res.message.includes('PIN Pemilik')) {
                const outcome = recordPinAttemptOutcome(false);
                if (outcome.locked) {
                  return {
                    ok: false,
                    message: `PIN Pemilik salah ${outcome.failedAttempts}x. Tunggu ${outcome.remainingSeconds} detik sebelum mencoba lagi.`,
                  };
                }
                return { ok: false, message: res.message };
              }
              if (res.ok) {
                recordPinAttemptOutcome(true);
              }
              commitEngineResultState(res.state);
              if (res.ok) {
                triggerNotification(
                  decision === 'APPROVED' ? 'Izin Disetujui' : 'Izin Ditolak',
                  res.message,
                  'success'
                );
              }
              return { ok: res.ok, message: res.message };
            }}
            onVoidTransaction={(txUuid, reason, pin) => {
              const guard = checkPinAttemptGuard();
              if (!guard.allowed) {
                return {
                  ok: false,
                  message: `Terlalu banyak percobaan PIN salah. Tunggu ${guard.remainingSeconds} detik sebelum mencoba lagi.`,
                };
              }
              const currentState = latestEngineStateRef.current;
              const currentPromos = (currentState.bazarPromos ?? INITIAL_BAZAR_PROMOS) as BazarPromoItem[];
              const res = voidSaleTransaction(currentState, txUuid, reason, 'Pemilik Usaha', isOnline, currentPromos, {
                ownerPin: pin,
              });
              if (!res.ok && res.message.includes('PIN Pemilik')) {
                const outcome = recordPinAttemptOutcome(false);
                const msg = outcome.locked
                  ? `PIN Pemilik salah ${outcome.failedAttempts}x. Tunggu ${outcome.remainingSeconds} detik sebelum mencoba lagi.`
                  : res.message;
                triggerNotification('Gagal Membatalkan', msg, 'warning');
                return { ok: false, message: msg };
              }
              if (res.ok) {
                recordPinAttemptOutcome(true);
              }
              if (res.state !== currentState) {
                commitEngineResultState(res.state);
              }
              triggerNotification(
                res.ok ? 'Transaksi Dibatalkan Resmi' : 'Gagal Membatalkan',
                res.message,
                res.ok ? 'info' : 'warning'
              );
              return { ok: res.ok, message: res.message };
            }}
            onRestoreState={(nextState, pin) => {
              const guard = checkPinAttemptGuard();
              if (!guard.allowed) {
                return {
                  ok: false,
                  message: `Terlalu banyak percobaan PIN salah. Tunggu ${guard.remainingSeconds} detik sebelum mencoba lagi.`,
                };
              }
              const pinValid = verifyOwnerPin(latestEngineStateRef.current, pin);
              const outcome = recordPinAttemptOutcome(pinValid);
              if (!pinValid) {
                return {
                  ok: false,
                  message: outcome.locked
                    ? `PIN Pemilik salah ${outcome.failedAttempts}x. Tunggu ${outcome.remainingSeconds} detik sebelum mencoba lagi.`
                    : 'PIN Pemilik salah. Pemulihan file cadangan dibatalkan.',
                };
              }
              const safeRestoredState: BusinessEngineState = { ...nextState, ownerPin: undefined, ownerPinHash: latestEngineStateRef.current.ownerPinHash, ownerPinSalt: latestEngineStateRef.current.ownerPinSalt, ownerPinNeedsChange: latestEngineStateRef.current.ownerPinNeedsChange };
              persistEngineState(safeRestoredState);
              commitEngineResultState(safeRestoredState);
              setCart([]);
              setIsOwnerApproved(false);
              setOwnerPin('');
              setPinError(null);
              const restoredPhones = nextState.supplierPhones ?? DEFAULT_SUPPLIER_PHONES;
              try {
                localStorage.setItem('karkasia_supplier_phones', JSON.stringify(restoredPhones));
              } catch {
                // ignore storage errors
              }
              void idbSetPreference('supplier_phones', restoredPhones);
              triggerNotification('Data Berhasil Dipulihkan', 'Seluruh stok, tagihan, dan riwayat dari file cadangan telah aktif.', 'success');
              return { ok: true, message: 'Data berhasil dipulihkan.' };
            }}
            restoreFallbackDefaults={{
              bazarPromos: INITIAL_BAZAR_PROMOS,
              categories: INITIAL_PRODUCT_CATEGORIES,
              suppliers: DEFAULT_SUPPLIERS,
              supplierPhones: DEFAULT_SUPPLIER_PHONES,
              preserveOwnerPinHash: engineState.ownerPinHash,
              preserveOwnerPinSalt: engineState.ownerPinSalt,
            }}
            onResetSandbox={(pin) => {
              const guard = checkPinAttemptGuard();
              if (!guard.allowed) {
                return {
                  ok: false,
                  message: `Terlalu banyak percobaan PIN salah. Tunggu ${guard.remainingSeconds} detik sebelum mencoba lagi.`,
                };
              }
              const pinValid = verifyOwnerPin(latestEngineStateRef.current, pin);
              const outcome = recordPinAttemptOutcome(pinValid);
              if (!pinValid) {
                return {
                  ok: false,
                  message: outcome.locked
                    ? `PIN Pemilik salah ${outcome.failedAttempts}x. Tunggu ${outcome.remainingSeconds} detik sebelum mencoba lagi.`
                    : 'PIN Pemilik salah. Reset data contoh dibatalkan.',
                };
              }
              const seeded: BusinessEngineState = {
                ...createSeededEngineState(initialEngineSeed),
                ownerPin: undefined,
                ownerPinHash: latestEngineStateRef.current.ownerPinHash,
                ownerPinSalt: latestEngineStateRef.current.ownerPinSalt,
                ownerPinNeedsChange: latestEngineStateRef.current.ownerPinNeedsChange,
              };
              persistEngineState(seeded);
              commitEngineResultState(seeded);
              setCart([]);
              setIsOwnerApproved(false);
              setOwnerPin('');
              setPinError(null);
              try {
                localStorage.setItem('karkasia_supplier_phones', JSON.stringify(DEFAULT_SUPPLIER_PHONES));
              } catch {
                // ignore storage errors
              }
              void idbSetPreference('supplier_phones', DEFAULT_SUPPLIER_PHONES);
              triggerNotification('Data Contoh Dipulihkan', 'Seluruh catatan kembali ke data awal contoh.', 'info');
              return { ok: true, message: 'Data contoh berhasil dipulihkan.' };
            }}
            onUpdateOwnerPin={(currentPin, newPin) => {
              const guard = checkPinAttemptGuard();
              if (!guard.allowed) {
                return {
                  ok: false,
                  message: `Terlalu banyak percobaan PIN salah. Tunggu ${guard.remainingSeconds} detik sebelum mencoba lagi.`,
                };
              }
              const res = updateOwnerPin(latestEngineStateRef.current, currentPin, newPin, 'Pemilik Usaha');
              if (!res.ok && res.message.includes('PIN lama')) {
                const outcome = recordPinAttemptOutcome(false);
                if (outcome.locked) {
                  return {
                    ok: false,
                    message: `PIN lama salah ${outcome.failedAttempts}x. Tunggu ${outcome.remainingSeconds} detik sebelum mencoba lagi.`,
                  };
                }
                return { ok: false, message: res.message };
              }
              if (res.ok) {
                recordPinAttemptOutcome(true);
                commitEngineResultState(res.state);
                triggerNotification('Keamanan Diperbarui', res.message, 'success');
              }
              return { ok: res.ok, message: res.message };
            }}
            onSyncNow={() => {
              void handleSyncOutboxNow(false);
            }}
            onUpdateBackendConfig={(nextConfig) => {
              const saved = saveBackendConfig(nextConfig);
              setBackendConfig(saved);
              const meta = BACKEND_ADAPTER_OPTIONS.find((o) => o.type === saved.adapterType);
              triggerNotification(
                'Adapter Server Diperbarui',
                `Adapter aktif kini: ${meta?.label || saved.adapterType}. Aturan bisnis ERP tidak berubah.`,
                'success'
              );
            }}
            onTestBackendConnection={async (candidateConfig) => {
              const tempAdapter = createBackendAdapter(candidateConfig);
              return tempAdapter.checkHealth();
            }}
            onNotify={triggerNotification}
          />
        )}

        {/* -------------------------------------------------------------------
            TAB 1: RINGKASAN (HUMAN-CENTERED HOME DASHBOARD)
            ------------------------------------------------------------------- */}
        {activeTab === 'home' && activeSecondaryModule === null && (
          <div className="space-y-5 animate-tab-fade">
            {renderPageSoulHeader(
              'Ringkasan Usaha',
              'Pantau penjualan hari ini, stok siap jual, dan tagihan berjalan dari satu tempat.',
              'Buka Kasir',
              () => setActiveTab('pos')
            )}

            {/* Pending Owner Approval Subtle Alert */}
            {operationalSummary.pendingApprovalCount > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start sm:items-center gap-2.5 text-xs text-amber-950">
                  <Lock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5 sm:mt-0" />
                  <div>
                    <span className="font-bold">
                      Ada {operationalSummary.pendingApprovalCount} permintaan izin menunggu persetujuan pemilik.
                    </span>{' '}
                    <span className="text-amber-800">
                      Tinjau pesanan tempo yang melebihi batas pelanggan sebelum dikirim.
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveSecondaryModule('approval')}
                  className="min-h-[40px] px-3.5 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold whitespace-nowrap shrink-0 self-end sm:self-auto cursor-pointer"
                >
                  Tinjau Sekarang
                </button>
              </div>
            )}

            {/* Banner Barang Perlu Segera Dijual (< 7 Hari) */}
            <FefoCriticalWarningBanner
              criticalLots={criticalFefoLots}
              onOpenFlashSale={(prodName) => {
                setActiveTab('pos');
                setSelectedCategory('ALL');
                setSearchQuery(prodName);
                setShowBazarPromoModal(true);
              }}
              onOpenTrimmingConversion={(lotId, weightKg) => {
                setActiveTab('warehouse');
                setWarehouseSubTab('BATCH_LOTS');
                setShowConversionModal(true);
                setConversionGram(Math.round(weightKg * 1000));
              }}
              onViewInWarehouse={(lotCode) => {
                setActiveTab('warehouse');
                setWarehouseSubTab('BATCH_LOTS');
                setInventorySearchQuery(lotCode);
                setInventoryFilterStatus('ALL');
              }}
              onFilterCriticalLotsInWarehouse={() => {
                setActiveTab('warehouse');
                setWarehouseSubTab('BATCH_LOTS');
                setInventorySearchQuery('');
                setInventoryFilterStatus('KRITIS');
                triggerNotification(
                  'Filter Masa Simpan Aktif',
                  'Menampilkan barang dengan sisa masa simpan <= 30 hari agar lebih cepat didahulukan.',
                  'info'
                );
              }}
            />

            {/* Hero Ringkasan Usaha Card */}
            <div className="b2b-card p-5 bg-slate-900 text-white space-y-4 border-slate-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="text-base sm:text-lg font-extrabold text-white">
                    Ringkasan Usaha Hari Ini
                  </h2>
                  <p className="text-xs text-slate-300 mt-1">
                    Semua penjualan kasir, stok gudang, dan modal otomatis dihitung rapi di belakang layar.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadFinancialReportPdf}
                    className="min-h-[40px] px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs rounded-xl flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    title="Unduh Laporan Penjualan & Laba Bersih (PDF)"
                  >
                    <Download className="w-4 h-4" />
                    <span>Unduh Laporan PDF</span>
                  </button>
                  <span className="text-xs font-mono text-slate-300 hidden md:inline whitespace-nowrap">
                    {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' })}
                  </span>
                </div>
              </div>

              {/* Live Single-Source-of-Truth KPI Row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-700/80">
                <div>
                  <span className="text-[11px] text-slate-400">Penjualan Hari Ini</span>
                  <div className="text-base sm:text-lg font-mono tabular-nums font-extrabold text-white">
                    Rp {operationalSummary.todaySalesRupiah.toLocaleString('id-ID')}
                  </div>
                  <span className="text-[10px] text-emerald-400 font-semibold font-mono tabular-nums">
                    {(operationalSummary.todayWeightGram / 1000).toFixed(1)} kg terjual
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400">Stok Siap Jual</span>
                  <div className="text-base sm:text-lg font-mono tabular-nums font-extrabold text-emerald-400">
                    {(operationalSummary.totalInventoryWeightGram / 1000).toFixed(1)} kg
                  </div>
                  <span className="text-[10px] text-slate-300">
                    {lots.filter(l => !l.isQuarantined && l.weightGram > 0).length} batch aktif
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400">Tagihan Pelanggan</span>
                  <div className="text-base sm:text-lg font-mono tabular-nums font-extrabold text-white">
                    Rp {operationalSummary.totalReceivablesRupiah.toLocaleString('id-ID')}
                  </div>
                  <span className="text-[10px] text-slate-300">
                    {operationalSummary.unpaidReceivablesCount} faktur berjalan
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400">Penyimpanan Data</span>
                  <div className="text-base sm:text-lg font-mono font-extrabold text-emerald-400">
                    {operationalSummary.pendingSyncCount === 0
                      ? 'Aman'
                      : `${operationalSummary.pendingSyncCount} Antre`}
                  </div>
                  <span className="text-[10px] text-slate-300">
                    {operationalSummary.pendingSyncCount === 0 ? 'Tersimpan di perangkat' : 'Menunggu koneksi'}
                  </span>
                </div>
              </div>
            </div>

            {/* Operational Health Indicators (Zero-Jargon + Contextual Help) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                  Kondisi Keuangan &amp; Stok Saat Ini
                </h3>
                <span
                  className="text-xs text-slate-600 font-medium flex items-center gap-1 cursor-help"
                  title="Setiap transaksi langsung memperbarui nilai stok, modal rata-rata, dan laporan laba secara otomatis."
                >
                  <HelpCircle className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Semua tercatat otomatis</span>
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div className="b2b-card p-4 space-y-1">
                  <div className="flex justify-between items-center text-slate-500 text-xs font-medium">
                    <span title="Total nilai modal daging yang masih ada di ruang pendingin berdasarkan harga modal rata-rata.">
                      Nilai Modal Stok Gudang
                    </span>
                    <Banknote className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="text-lg font-extrabold text-slate-900 font-mono tabular-nums">
                    Rp {operationalSummary.totalInventoryValueRupiah.toLocaleString('id-ID')}
                  </div>
                  <span className="text-[11px] text-slate-500">
                    Dari {(operationalSummary.totalInventoryWeightGram / 1000).toFixed(1)} kg daging di gudang
                  </span>
                </div>

                <div className="b2b-card p-4 space-y-1">
                  <div className="flex justify-between items-center text-slate-500 text-xs font-medium">
                    <span title="Keuntungan bersih 7 hari setelah dipotong modal daging, biaya operasional toko, dan estimasi pajak 0,5%.">
                      Estimasi Laba Bersih (7 Hari)
                    </span>
                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="text-lg font-extrabold text-emerald-700 font-mono tabular-nums">
                    Rp {operationalSummary.netProfitAfterTax.toLocaleString('id-ID')}
                  </div>
                  <span className="text-[11px] text-slate-500">
                    Sudah dipotong modal, biaya toko &amp; pajak 0,5%
                  </span>
                </div>

                <div className="b2b-card p-4 space-y-1">
                  <div className="flex justify-between items-center text-slate-500 text-xs font-medium">
                    <span title="Total tagihan pembelian daging impor dari pemasok yang belum dilunasi.">
                      Utang ke Supplier
                    </span>
                    <Clock className="w-4 h-4 text-amber-600" />
                  </div>
                  <div className="text-lg font-extrabold text-amber-700 font-mono tabular-nums">
                    Rp {operationalSummary.totalSupplierDebtRupiah.toLocaleString('id-ID')}
                  </div>
                  <span className="text-[11px] text-slate-500">
                    {supplierInvoices.filter(i => i.status !== 'LUNAS').length} faktur belum lunas
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
              {/* Header Analitik Penjualan */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <BarChart3 className="w-4 h-4" />
                    </span>
                    <h3 className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight">
                      Analitik Penjualan &amp; Keuntungan Barang
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Pantau tren penjualan, berat terjual (kg), harga modal beli, dan selisih untung tiap barang.
                  </p>
                </div>

                {/* View Switcher: Tren vs Keuntungan vs Strategi */}
                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl text-xs font-semibold self-start lg:self-auto overflow-x-auto">
                  <button
                    type="button"
                    onClick={() => setAnalyticsViewMode('TREND')}
                    className={`min-h-[36px] px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                      analyticsViewMode === 'TREND'
                        ? 'bg-white text-slate-900 font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Tren Penjualan</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAnalyticsViewMode('MARGIN')}
                    className={`min-h-[36px] px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                      analyticsViewMode === 'MARGIN'
                        ? 'bg-white text-slate-900 font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <PieIcon className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Perbandingan Untung</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAnalyticsViewMode('MATRIX')}
                    className={`min-h-[36px] px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                      analyticsViewMode === 'MATRIX'
                        ? 'bg-white text-slate-900 font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Activity className="w-3.5 h-3.5 text-amber-600" />
                    <span>Barang Unggulan</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAnalyticsViewMode('STOCK')}
                    className={`min-h-[36px] px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                      analyticsViewMode === 'STOCK'
                        ? 'bg-white text-slate-900 font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Package className="w-3.5 h-3.5 text-blue-600" />
                    <span>Stok Gudang Terlaris</span>
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
                                  Keuntungan Kotor: <strong className="text-indigo-300">Rp {data.grossProfitRupiah.toLocaleString('id-ID')}</strong> ({data.marginPercent}%)
                                </div>
                                <div className="text-[10.5px] text-emerald-400 font-semibold pt-1 border-t border-slate-800 flex items-center justify-between">
                                  <span>▲ Pertumbuhan: +{data.growthPercent}%</span>
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
                            </div>
                            <span className="text-[11px] text-slate-500">
                              {p.transactions} transaksi • Kontribusi {p.sharePercent}% dari omzet toko
                            </span>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="text-xs font-extrabold font-mono tabular-nums text-slate-900">
                            Rp {p.omzetRupiah.toLocaleString('id-ID')}
                          </div>
                          <div className="text-[10px] text-emerald-600 font-semibold font-mono tabular-nums flex items-center justify-end gap-1.5">
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
                  VIEW 2: PERBANDINGAN UNTUNG PER BARANG
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
                          Perbandingan Keuntungan Kotor per Barang:
                        </span>
                        <p className="text-[11px] text-slate-500">
                          Dihitung dari selisih harga jual per kg terhadap harga modal beli gudang KARKASIA.
                        </p>
                      </div>

                      <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg text-xs font-semibold self-start sm:self-auto">
                        <span className="text-[10px] text-slate-500 px-1 font-bold">Urutkan:</span>
                        <button
                          type="button"
                          onClick={() => setAnalyticsMarginSort('PERCENT')}
                          className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                            analyticsMarginSort === 'PERCENT'
                              ? 'bg-white text-slate-900 font-bold'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Persentase (%)
                        </button>
                        <button
                          type="button"
                          onClick={() => setAnalyticsMarginSort('PROFIT')}
                          className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                            analyticsMarginSort === 'PROFIT'
                              ? 'bg-white text-slate-900 font-bold'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Total Untung (Rp)
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
                                      Untung {d.marginPercent}%
                                    </span>
                                  </div>
                                  <div className="text-slate-300 font-mono text-[11px]">
                                    Harga Jual: Rp {d.pricePerKg.toLocaleString('id-ID')}/KG &bull; Modal: Rp {d.hppPerKg.toLocaleString('id-ID')}/KG
                                  </div>
                                  <div className="text-slate-300 font-mono text-[11px]">
                                    Untung Per KG: <strong className="text-emerald-400">Rp {d.marginPerKg.toLocaleString('id-ID')}/KG</strong>
                                  </div>
                                  <div className="text-slate-300 font-mono text-[11px]">
                                    Total Keuntungan: <strong className="text-indigo-300">Rp {d.grossProfitRupiah.toLocaleString('id-ID')}</strong> ({d.profitSharePercent}% porsi untung)
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
                            <th className="px-3.5 py-2.5">Nama &amp; Kode Barang</th>
                            <th className="px-3.5 py-2.5 text-right">Harga Jual / KG</th>
                            <th className="px-3.5 py-2.5 text-right">Harga Modal / KG</th>
                            <th className="px-3.5 py-2.5 text-right">Untung / KG</th>
                            <th className="px-3.5 py-2.5 text-center">Persen Untung</th>
                            <th className="px-3.5 py-2.5 text-right">Terjual (KG)</th>
                            <th className="px-3.5 py-2.5 text-right">Total Keuntungan</th>
                            <th className="px-3.5 py-2.5 text-center">Porsi Untung</th>
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
                            <td className="px-3.5 py-2.5 text-slate-900">TOTAL 5 BARANG TERLARIS</td>
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
                        Kombinasi penjualan tertinggi (Rp 38.4 Jt) dan keuntungan prima (25.0%). Menjadi penyumbang untung terbesar toko KARKASIA (Rp 9.600.000). Jaga ketersediaan stok prioritas di gudang agar tidak kehabisan bagi pelanggan resto.
                      </p>
                    </div>

                    {/* Kuadran 2: Margin Booster */}
                    <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/40 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-600 text-white">
                          UNTUNG TERBESAR
                        </span>
                        <span className="font-mono text-xs font-bold text-amber-800">27.6% Untung</span>
                      </div>
                      <div className="font-bold text-xs text-slate-900">Tenderloin Grassfed Australia</div>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        Persentase keuntungan tertinggi di antara semua barang (Rp 80.000/KG). Penjualan masih 40 KG, berpeluang besar ditingkatkan lewat paket steak ke resto mitra dan hotel di Serang-Cilegon.
                      </p>
                    </div>

                    {/* Kuadran 3: Volume Engine */}
                    <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/40 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-600 text-white">
                          PALING LARIS
                        </span>
                        <span className="font-mono text-xs font-bold text-blue-800">+22.0% Naik</span>
                      </div>
                      <div className="font-bold text-xs text-slate-900">US Beef Shortplate 500g Slice</div>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        Penjualan tertinggi (180 KG) dengan perputaran stok tercepat (36 transaksi). Keuntungan 24.0% sangat sehat untuk daging slice shabu/grill, menjaga uang masuk harian tetap stabil.
                      </p>
                    </div>

                    {/* Kuadran 4: Conversion Stabilizer */}
                    <div className="p-4 rounded-xl border border-slate-300 bg-slate-50 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-white">
                          HASIL OLAHAN POTONG
                        </span>
                        <span className="font-mono text-xs font-bold text-slate-800">Rp 3.6 Jt Untung</span>
                      </div>
                      <div className="font-bold text-xs text-slate-900">Tetelan Rawon Super KARKASIA</div>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        Hasil potongan sampingan daging utuh. Mengubah sisa potongan menjadi penjualan Rp 15.3 Jt dengan keuntungan 23.5%, membantu memulihkan modal pembelian daging utuh.
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
                      triggerNotification('Rencana Belanja Disiapkan', `Rencana pembelian untuk barang ${sku} sudah disiapkan`, 'info');
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
                    Semua data penjualan dan stok aman tersimpan di perangkat
                  </div>
                  <div className="text-[11px] text-slate-600">
                    Catatan tetap berjalan normal meski internet terputus, dan rapi saat diperiksa kapan saja.
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveTab('pos')}
                className="min-h-[40px] px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shrink-0 whitespace-nowrap cursor-pointer"
              >
                Buka Kasir
              </button>
            </div>

            {renderPageSoulFooter('Ringkasan Usaha')}
          </div>
        )}

        {/* -------------------------------------------------------------------
            TAB 2: KASIR (POS DENGAN SPLIT-VIEW & TIMBANGAN OTOMATIS)
            ------------------------------------------------------------------- */}
        {activeTab === 'pos' && activeSecondaryModule === null && (
          <div className="space-y-4 animate-tab-fade">
            {renderPageSoulHeader(
              'Kasir Penjualan',
              'Pilih atau timbang barang, tentukan cara bayar, lalu selesaikan transaksi dengan cepat.'
            )}

            {/* Peringatan Stok Menipis */}
            <div className="b2b-card p-3.5 bg-amber-50/70 border-amber-200 flex items-start sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  <strong>Stok Menipis:</strong> Stok Tenderloin Grassfed sisa <strong>18.0 KG</strong> (Batas aman: 20.0 KG).
                  Tawarkan alternatif <strong>Sirloin Choice USA (82.0 KG)</strong>.
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleAddToCart(SAMPLE_PRODUCTS[1], 1000)}
                className="min-h-[40px] px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs shrink-0 transition-colors cursor-pointer"
              >
                + Rekomendasi Sirloin
              </button>
            </div>

            {/* Split View */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              
              {/* Left: Search, Filter, Product Catalog */}
              <div className="lg:col-span-7 space-y-4">
                {/* Voice Note Order & Retur Barang Toolbar */}
                <div className="bg-slate-900 text-white p-3.5 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-2.5">
                  <div>
                    <div className="text-xs font-bold">Layanan Sales &amp; Retur</div>
                    <div className="text-[11px] text-slate-300">Ubah pesan suara WhatsApp jadi pesanan atau catat barang retur</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowVoiceNoteModal(true)}
                      className="min-h-[40px] px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Rekam pesan suara sales untuk langsung masuk keranjang"
                    >
                      <Mic className="w-3.5 h-3.5" />
                      <span>Pesan Suara</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowReturnModal(true)}
                      className="min-h-[40px] px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/40 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Catat pengembalian daging bermasalah dengan foto bukti"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Retur Barang</span>
                    </button>
                  </div>
                </div>

                {/* Peringatan Stok Di Bawah Batas Aman */}
                {(() => {
                  const criticalProducts = products.filter(p => p.stockGram <= p.safetyStockGram);
                  if (criticalProducts.length === 0) return null;
                  return (
                    <div className="p-3.5 bg-rose-700 text-white rounded-xl border border-rose-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fade-in">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-white/15 rounded-lg shrink-0 text-white">
                          <AlertTriangle className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-xs font-extrabold tracking-wide">
                            Stok Menipis: {criticalProducts.length} barang di bawah batas aman
                          </h4>
                          <p className="text-[11px] text-rose-100 mt-0.5">
                            Barang: {criticalProducts.map(p => `${p.name} (${(p.stockGram/1000).toFixed(1)} KG / Min: ${(p.safetyStockGram/1000).toFixed(1)} KG)`).join(', ')}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            setSearchQuery('');
                            setSelectedCategory('SAFETY_CRITICAL');
                          }}
                          className="min-h-[40px] px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold text-xs border border-white/30 transition-colors cursor-pointer"
                        >
                          Lihat Stok Menipis ({criticalProducts.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setPoInitialData({
                              supplierName: 'PT Meat Importers Indonesia',
                              items: criticalProducts.map(p => ({
                                sku: p.sku,
                                name: p.name,
                                category: p.category,
                                orderKg: 50,
                                unitPricePerKg: Math.round(p.basePricePerKg * 0.7),
                                totalEstimate: Math.round(p.basePricePerKg * 0.7) * 50
                              }))
                            });
                            setShowCreatePOModal(true);
                          }}
                          className="min-h-[40px] px-3 py-1.5 rounded-lg bg-white text-rose-950 hover:bg-rose-50 font-extrabold text-xs transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <PackagePlus className="w-3.5 h-3.5 text-rose-800" />
                          <span>Pesan Stok Ulang</span>
                        </button>
                      </div>
                    </div>
                  );
                })()}

                <div className="b2b-card p-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Cari nama atau kode daging..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="w-full min-h-[40px] pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                    />
                  </div>

                  <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-semibold py-0.5">
                    <button
                      type="button"
                      onClick={() => setSelectedCategory('ALL')}
                      className={`min-h-[36px] px-2.5 py-1 rounded-md text-xs transition-colors shrink-0 cursor-pointer ${
                        selectedCategory === 'ALL' ? 'bg-slate-900 text-white font-bold' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Semua ({products.length})
                    </button>

                    {products.some(p => p.stockGram <= p.safetyStockGram) && (
                      <button
                        type="button"
                        onClick={() => setSelectedCategory('SAFETY_CRITICAL')}
                        className={`min-h-[36px] px-2.5 py-1 rounded-md text-xs transition-colors shrink-0 flex items-center gap-1 cursor-pointer ${
                          selectedCategory === 'SAFETY_CRITICAL' 
                            ? 'bg-rose-600 text-white font-bold' 
                            : 'bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100 font-bold'
                        }`}
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Stok Menipis ({products.filter(p => p.stockGram <= p.safetyStockGram).length})</span>
                      </button>
                    )}

                    {categories.map(cat => {
                      const count = products.filter(p => p.category === cat.id).length;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setSelectedCategory(cat.id)}
                          className={`min-h-[36px] px-2.5 py-1 rounded-md text-xs transition-colors shrink-0 flex items-center gap-1 cursor-pointer ${
                            selectedCategory === cat.id ? 'bg-slate-900 text-white font-bold' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          <span>{cat.label}</span>
                          <span className={`text-[10px] px-1 rounded font-mono ${
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
                      className="min-h-[36px] px-2.5 py-1 rounded-md text-xs font-bold border border-dashed border-slate-300 text-slate-600 hover:text-slate-900 hover:border-slate-400 bg-white transition-colors shrink-0 flex items-center gap-1 cursor-pointer"
                      title="Atur kelompok barang"
                    >
                      <Tags className="w-3 h-3 text-emerald-600" />
                      <span>+ Kategori</span>
                    </button>
                  </div>

                  {/* Quick Action Buttons: Tambah Barang & Atur Harga */}
                  <div className="flex items-center gap-1.5 shrink-0 border-t sm:border-t-0 sm:border-l border-slate-200 sm:pl-3 pt-2 sm:pt-0">
                    <button
                      type="button"
                      onClick={() => setShowQuickAddProductModal(true)}
                      className="min-h-[40px] px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                      title="Tambah barang baru tanpa keluar kasir"
                    >
                      <PackagePlus className="w-3.5 h-3.5 text-emerald-600" />
                      <span>+ Barang</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setPriceManagerTargetId(null);
                        setShowPriceManagerModal(true);
                      }}
                      className="min-h-[40px] px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                      title="Ubah harga jual barang"
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
                            ? 'ring-2 ring-emerald-500 bg-emerald-50/60' 
                            : pressingProdId === prod.id 
                              ? 'ring-2 ring-amber-400 bg-amber-50/40' 
                              : isLowStock 
                                ? 'border-rose-300 bg-rose-50/60 hover:border-rose-400 text-rose-950' 
                                : 'hover:border-slate-300'
                        }`}
                        title="Tekan dan tahan untuk langsung tambah 1.0 KG ke keranjang"
                      >
                        {/* Quick Add Flash Indicator */}
                        {quickAddFlashId === prod.id && (
                          <div className="mb-1.5 px-2.5 py-1 rounded-md bg-emerald-600 text-white font-bold text-[10px] inline-flex items-center gap-1 self-start">
                            <Zap className="w-3 h-3" />
                            <span>+1.0 KG Ditambah</span>
                          </div>
                        )}

                        {/* Pressing Progress Indicator */}
                        {pressingProdId === prod.id && quickAddFlashId !== prod.id && (
                          <div className="absolute inset-x-0 bottom-0 h-1 bg-amber-500 rounded-b-xl z-10" />
                        )}

                        <div className="space-y-2">
                          <div className="flex items-center justify-between pt-0.5">
                            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                              {prod.category}
                            </span>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold font-mono tabular-nums ${
                              isLowStock ? 'bg-rose-600 text-white' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            }`}>
                              {isLowStock && <AlertTriangle className="w-3 h-3" />}
                              <span>Stok: {stockKg.toFixed(1)} KG {isLowStock ? `(Min ${(prod.safetyStockGram / 1000).toFixed(1)})` : ''}</span>
                            </span>
                          </div>

                          <div className="flex gap-2.5 items-center">
                            <div 
                              onClick={(e) => {
                                e.stopPropagation();
                                setViewingGalleryProduct(prod);
                              }}
                              className="relative group/img flex-shrink-0 cursor-pointer"
                              title="Klik untuk lihat Galeri Foto Produk"
                            >
                              {failedImages[prod.id] || !prod.imageUrl ? (
                                <div className={`w-12 h-12 rounded-lg border flex flex-col items-center justify-center bg-slate-100 text-slate-600 ${
                                  isLowStock ? 'border-rose-400' : 'border-slate-200'
                                }`}>
                                  <Package className="w-5 h-5 text-slate-500" />
                                </div>
                              ) : (
                                <img
                                  src={prod.imageUrl}
                                  alt={prod.name}
                                  onError={() => setFailedImages(prev => ({ ...prev, [prod.id]: true }))}
                                  className={`w-12 h-12 object-cover rounded-lg border bg-slate-100 shadow-2xs group-hover/img:scale-105 transition-transform ${
                                    isLowStock ? 'border-rose-400 ring-2 ring-rose-300' : 'border-slate-200'
                                  }`}
                                />
                              )}
                              <span className="absolute -top-1 -right-1 px-1 py-0.2 rounded-full bg-slate-900 text-emerald-400 font-extrabold text-[8px] border border-slate-700 flex items-center gap-0.5 shadow-2xs">
                                <Layers className="w-2.5 h-2.5" />
                                {prod.gallery?.length || 4}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingPhotoProduct(prod);
                                }}
                                className="absolute -bottom-1 -right-1 p-0.5 bg-white hover:bg-slate-100 text-slate-700 rounded-full border border-slate-300 shadow-xs cursor-pointer z-10"
                                title="Ubah / Upload Foto Utama"
                              >
                                <Camera className="w-2.5 h-2.5 text-slate-700" />
                              </button>
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between">
                                <h4 className={`text-sm font-bold line-clamp-1 ${isLowStock ? 'text-rose-950 font-black' : 'text-slate-900'}`}>{prod.name}</h4>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setViewingGalleryProduct(prod);
                                  }}
                                  className="px-1.5 py-0.5 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[10px] font-bold flex items-center gap-1 border border-emerald-200 shrink-0 cursor-pointer"
                                  title="Lihat Carousel Galeri Foto Sudut Pandang"
                                >
                                  <Layers className="w-3 h-3" />
                                  <span>Galeri</span>
                                </button>
                              </div>
                              <span className="text-[11px] font-mono text-slate-500">{prod.sku}</span>
                            </div>
                          </div>

                          {/* Critical Safety Stock Warning Callout Box */}
                          {isLowStock && (
                            <div className="mt-2 p-2 rounded-lg bg-rose-100/90 border border-rose-300 text-rose-950 text-[10px] font-bold flex items-center justify-between shadow-2xs">
                              <div className="flex items-center gap-1 min-w-0">
                                <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                                <span className="truncate">Defisit: -{((prod.safetyStockGram - prod.stockGram) / 1000).toFixed(1)} KG dari batas aman!</span>
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPoInitialData({
                                    supplierName: 'PT Meat Importers Indonesia',
                                    items: [{
                                      sku: prod.sku,
                                      name: prod.name,
                                      category: prod.category,
                                      orderKg: 50,
                                      unitPricePerKg: Math.round(prod.basePricePerKg * 0.7),
                                      totalEstimate: Math.round(prod.basePricePerKg * 0.7) * 50
                                    }]
                                  });
                                  setShowCreatePOModal(true);
                                }}
                                className="px-2 py-0.5 rounded bg-rose-700 hover:bg-rose-800 text-white font-extrabold text-[9px] shrink-0 cursor-pointer shadow-2xs transition-colors"
                                title="Buat PO Reorder stok untuk produk ini"
                              >
                                + Reorder PO
                              </button>
                            </div>
                          )}

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

                          {/* Petunjuk Tambah Cepat */}
                          <div className="flex items-center justify-between text-[10px] pt-1 border-t border-slate-100/80">
                            <span className="flex items-center gap-1 text-slate-400 group-hover:text-amber-700 font-medium transition-colors">
                              <Zap className="w-3 h-3 text-amber-500" />
                              <span>Tahan kartu: Tambah cepat 1 kg</span>
                            </span>
                            {pressingProdId === prod.id && (
                              <span className="text-[10px] font-bold text-amber-700">
                                Menambahkan 1 kg...
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-4 gap-1.5 pt-2.5 mt-2.5 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAddToCart(prod, 250);
                            }}
                            className="h-10 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-bold flex items-center justify-center cursor-pointer"
                            title="Tambah 250g"
                          >
                            +250g
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAddToCart(prod, 500);
                            }}
                            className="h-10 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-bold flex items-center justify-center cursor-pointer"
                            title="Tambah 500g"
                          >
                            +500g
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAddToCart(prod, 1000);
                            }}
                            className="h-10 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold flex items-center justify-center cursor-pointer"
                            title="Tambah 1.0 KG"
                          >
                            +1.0KG
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setWeighingProduct(prod);
                            }}
                            className="h-10 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-[11px] font-extrabold flex items-center justify-center gap-1 cursor-pointer"
                            title="Timbang berat barang"
                          >
                            <Scale className="w-3.5 h-3.5 text-emerald-100" />
                            <span>Timbang</span>
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
                    <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5 text-slate-700" />
                      Pembeli
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowQuickAddCustomerModal(true)}
                        className="min-h-[36px] px-2 text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-0.5 transition-colors cursor-pointer"
                        title="Tambah pembeli baru tanpa menutup transaksi kasir"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        + Pembeli
                      </button>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                        {customer.tier === 'VIP' ? 'Grosir VIP' : customer.tier === 'HOREKA' ? 'Resto / Hotel' : 'Eceran'}
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
                        {c.name} ({c.tier === 'VIP' ? 'Grosir VIP' : c.tier === 'HOREKA' ? 'Resto/Hotel' : 'Eceran'})
                      </option>
                    ))}
                  </select>

                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-xs space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500 font-medium">Sisa Batas Tempo:</span>
                      <span className="font-mono tabular-nums font-extrabold text-emerald-700">
                        {customer.creditLimit === 0 ? 'Pembeli Tunai' : `Rp ${Math.max(0, customer.creditLimit - customer.currentReceivable).toLocaleString('id-ID')}`}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500 font-medium">Tagihan Belum Lunas:</span>
                      <span className="font-mono tabular-nums font-bold text-slate-800">
                        Rp {customer.currentReceivable.toLocaleString('id-ID')}
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
                    <span className="text-xs font-mono tabular-nums font-bold text-slate-600">
                      {cart.length} Item • {(totalCartWeightGram / 1000).toFixed(2)} KG
                    </span>
                  </div>

                  <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1">
                    {cart.map((item, idx) => {
                      const liveProd = products.find(p => p.id === item.product.id) || item.product;
                      const pricing = getProductTierPrice(liveProd, customer.tier, item.weightGram, bazarPromos);
                      const itemSubtotal = Math.round((item.weightGram * pricing.effectivePricePerKg) / 1000);
                      return (
                        <div key={item.product.id} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2 text-xs">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              {failedImages[liveProd.id] || !liveProd.imageUrl ? (
                                <div className="w-9 h-9 rounded border border-slate-200 bg-slate-100 flex items-center justify-center flex-shrink-0">
                                  <Package className="w-4 h-4 text-slate-500" />
                                </div>
                              ) : (
                                <img
                                  src={liveProd.imageUrl}
                                  alt={liveProd.name}
                                  onError={() => setFailedImages(prev => ({ ...prev, [liveProd.id]: true }))}
                                  className="w-9 h-9 object-cover rounded border border-slate-200 bg-slate-100 flex-shrink-0"
                                />
                              )}
                              <div className="min-w-0">
                                <h5 className="font-bold text-slate-900 line-clamp-1">{item.product.name}</h5>
                                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                  <span className="text-[10px] text-slate-600 font-mono tabular-nums font-bold">
                                    Rp {pricing.effectivePricePerKg.toLocaleString('id-ID')}/kg
                                  </span>
                                  {pricing.savingsPerKg > 0 && (
                                    <span className="text-[10px] text-emerald-600 font-semibold">
                                      Hemat Rp {((pricing.savingsPerKg * item.weightGram) / 1000).toLocaleString('id-ID')}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer shrink-0"
                              aria-label="Hapus barang"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="flex items-center justify-between pt-1">
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleUpdateItemWeight(idx, -500)}
                                className="w-10 h-10 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 flex items-center justify-center text-slate-700 cursor-pointer"
                                aria-label="Kurangi 500 gram"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              
                              <div className="px-2.5 py-2 rounded-lg bg-white border border-slate-300 font-mono tabular-nums text-xs font-bold text-slate-900">
                                {(item.weightGram / 1000).toFixed(2)} KG
                              </div>

                              <button
                                type="button"
                                onClick={() => handleUpdateItemWeight(idx, 500)}
                                className="w-10 h-10 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 flex items-center justify-center text-slate-700 cursor-pointer"
                                aria-label="Tambah 500 gram"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <div className="font-mono tabular-nums font-bold text-slate-900 text-sm">
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
                      <span className="font-mono tabular-nums font-semibold">Rp {subtotalRupiah.toLocaleString('id-ID')}</span>
                    </div>

                    <div className="flex items-center justify-between text-slate-600">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <Truck className="w-3.5 h-3.5 text-slate-400" />
                        <span>Gratis Ongkir Toko</span>
                        <input
                          type="checkbox"
                          checked={isFreeShipping}
                          onChange={e => setIsFreeShipping(e.target.checked)}
                          className="w-4 h-4 rounded border-slate-300 text-emerald-600 ml-1"
                        />
                      </label>
                      <div className="flex items-center gap-1.5 font-mono tabular-nums">
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
                      <span className="text-lg font-extrabold text-slate-900 font-mono tabular-nums">
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
                        className={`h-10 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          paymentMethod === m ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {m === 'CASH' ? 'Tunai' : m === 'TRANSFER' ? 'Transfer' : 'Tempo'}
                      </button>
                    ))}
                  </div>

                  {/* Smart Default Uang Pas untuk Pembayaran Tunai */}
                  {paymentMethod === 'CASH' && (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <label htmlFor="cash-tendered-input" className="font-semibold text-slate-700">
                          Uang Diterima
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setIsCustomCash(false);
                            setCashTendered(grandTotalRupiah);
                          }}
                          className={`min-h-[32px] px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                            !isCustomCash || cashTendered === grandTotalRupiah
                              ? 'bg-emerald-600 text-white'
                              : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          Uang Pas
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          id="cash-tendered-input"
                          type="number"
                          min={0}
                          step={5000}
                          value={cashTendered}
                          onChange={(e) => {
                            setIsCustomCash(true);
                            setCashTendered(Math.max(0, Number(e.target.value) || 0));
                          }}
                          className="w-full b2b-input font-mono tabular-nums font-bold text-slate-900"
                        />
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-500">Kembalian:</span>
                        <span className={`font-mono tabular-nums font-bold ${
                          cashTendered < grandTotalRupiah ? 'text-rose-600' : 'text-emerald-700'
                        }`}>
                          {cashTendered < grandTotalRupiah
                            ? `Kurang Rp ${(grandTotalRupiah - cashTendered).toLocaleString('id-ID')}`
                            : `Rp ${(cashTendered - grandTotalRupiah).toLocaleString('id-ID')}`}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="sticky bottom-16 md:static z-20 pt-1 bg-white">
                    <button
                      type="button"
                      disabled={cart.length === 0}
                      onClick={handleCheckoutCommit}
                      className={`w-full h-11 rounded-lg disabled:bg-slate-300 text-white font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer ${
                        isTempoBlocked && !isOwnerApproved
                          ? 'bg-amber-600 hover:bg-amber-700'
                          : 'bg-emerald-600 hover:bg-emerald-700'
                      }`}
                    >
                      {isTempoBlocked && !isOwnerApproved ? (
                        <>
                          <Lock className="w-4 h-4" />
                          <span>Minta PIN Pemilik untuk Tempo</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Bayar &amp; Terbitkan Faktur</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

            </div>

            {renderPageSoulFooter('Kasir Penjualan')}
          </div>
        )}

        {/* -------------------------------------------------------------------
            TAB 3: BELI STOK (BARANG MASUK & TAGIHAN SUPPLIER)
            ------------------------------------------------------------------- */}
        {activeTab === 'beli' && activeSecondaryModule === null && (
          <div className="space-y-4 animate-tab-fade">
            {renderPageSoulHeader(
              'Beli Stok',
              'Catat kiriman barang masuk ke gudang dan pantau tagihan ke pemasok.',
              'Catat Pembelian Baru',
              () => setShowCreatePOModal(true)
            )}

            {/* Subtab Switcher: Kiriman Masuk vs Tagihan Supplier */}
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
              <button
                type="button"
                onClick={() => setPurchasingSubTab('INBOUND')}
                className={`min-h-[40px] px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  purchasingSubTab === 'INBOUND'
                    ? 'bg-slate-900 text-white'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Truck className="w-3.5 h-3.5" />
                <span>Kiriman Masuk ({inboundPOs.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setPurchasingSubTab('AP_DEBT')}
                className={`min-h-[40px] px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  purchasingSubTab === 'AP_DEBT'
                    ? 'bg-slate-900 text-white'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <CreditCard className="w-3.5 h-3.5 text-indigo-500" />
                <span>Tagihan Supplier ({supplierInvoices.filter(i => i.status !== 'LUNAS').length})</span>
                <span className="font-mono tabular-nums text-[10px] bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded font-bold">
                  Rp {(supplierInvoices.reduce((acc, i) => acc + i.remainingAmountRupiah, 0) / 1000000).toFixed(1)} Jt
                </span>
              </button>
            </div>

            {/* SUBTAB 1: KIRIMAN MASUK */}
            {purchasingSubTab === 'INBOUND' && (
              <div className="space-y-3 animate-tab-fade">
                {inboundPOs.map(po => {
                  const isEnRoute = po.status === 'DALAM_PERJALANAN';
                  return (
                    <div key={po.id} className="b2b-card p-4 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-xs text-slate-900">{po.poNumber}</span>
                          <span className="text-slate-400">•</span>
                          <span className="text-xs font-bold text-slate-800">{po.supplier}</span>
                        </div>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${
                          isEnRoute ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        }`}>
                          {isEnRoute ? <Clock className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                          <span>{isEnRoute ? 'Dalam Perjalanan' : 'Selesai Bongkar'}</span>
                        </span>
                      </div>

                      <div className="text-xs text-slate-600 space-y-0.5">
                        <div>Pengiriman: <strong className="font-mono text-slate-800">{po.container}</strong></div>
                        <div>Barang: {po.items}</div>
                        <div className="text-slate-500 font-mono tabular-nums text-[11px]">
                          Nilai Pembelian: Rp {po.totalRupiah.toLocaleString('id-ID')}
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs gap-2">
                        <span className="text-slate-500">Perkiraan Tiba: <strong className="text-slate-800">{po.eta}</strong></span>
                        {isEnRoute && (
                          <button
                            type="button"
                            onClick={() => {
                              const weightGram = Math.round((po.orderWeightKg || 500) * 1000);
                              const res = receiveInboundPurchase(latestEngineStateRef.current, po.id, weightGram, 0, 'Kepala Gudang', isOnline);
                              commitEngineResultState(res.state);
                              triggerNotification(
                                res.ok ? 'Barang Diterima & Masuk Stok' : 'Gagal Menerima Barang',
                                res.message,
                                res.ok ? 'success' : 'warning'
                              );
                            }}
                            className="min-h-[40px] px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition-colors cursor-pointer"
                          >
                            Terima Barang &amp; Masuk Stok
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* SUBTAB 2: TAGIHAN KE SUPPLIER */}
            {purchasingSubTab === 'AP_DEBT' && (
              <div className="space-y-4 animate-tab-fade">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="b2b-card p-3.5 space-y-1">
                    <span className="text-[11px] font-semibold text-slate-500">Total Tagihan Belum Lunas</span>
                    <div className="text-lg font-mono tabular-nums font-extrabold text-rose-600">
                      Rp {supplierInvoices.reduce((acc, i) => acc + i.remainingAmountRupiah, 0).toLocaleString('id-ID')}
                    </div>
                    <span className="text-[10px] text-slate-500">Dari {supplierInvoices.length} tagihan pemasok</span>
                  </div>

                  <div className="b2b-card p-3.5 space-y-1">
                    <span className="text-[11px] font-semibold text-slate-500">Jatuh Tempo Pekan Ini</span>
                    <div className="text-lg font-mono tabular-nums font-extrabold text-amber-600">
                      Rp {supplierInvoices.filter(i => i.daysDiff <= 7 && i.status !== 'LUNAS').reduce((acc, i) => acc + i.remainingAmountRupiah, 0).toLocaleString('id-ID')}
                    </div>
                    <span className="text-[10px] text-amber-700 font-semibold">Segera jadwalkan transfer</span>
                  </div>

                  <div className="b2b-card p-3.5 space-y-1">
                    <span className="text-[11px] font-semibold text-slate-500">Sudah Dibayar Bulan Ini</span>
                    <div className="text-lg font-mono tabular-nums font-extrabold text-emerald-600">
                      Rp {supplierInvoices.reduce((acc, i) => acc + i.paidAmountRupiah, 0).toLocaleString('id-ID')}
                    </div>
                    <span className="text-[10px] text-emerald-700 font-semibold">Tercatat rapi di kas</span>
                  </div>
                </div>

                {/* Supplier Invoices List Table */}
                <div className="b2b-card overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase font-semibold text-[11px]">
                      <tr>
                        <th className="px-4 py-3">No. Tagihan &amp; Pemasok</th>
                        <th className="px-4 py-3">Jatuh Tempo</th>
                        <th className="px-4 py-3 text-right">Total Tagihan</th>
                        <th className="px-4 py-3 text-right">Sisa Tagihan</th>
                        <th className="px-4 py-3 text-center">Status</th>
                        <th className="px-4 py-3 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {supplierInvoices.map(inv => {
                        const isLunas = inv.status === 'LUNAS';
                        const resolvedPhone = inv.supplierPhone || supplierPhones[inv.supplier] || '';
                        const waUrl = buildSupplierPaymentFollowUpUrl(inv, resolvedPhone);
                        const isEditingPhone = editingSupplierPhoneId === inv.id;

                        return (
                          <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="px-4 py-3">
                              <div className="font-mono font-bold text-slate-900">{inv.invoiceNumber}</div>
                              <div className="text-slate-600 text-[11px]">{inv.supplier} ({inv.originCountry})</div>
                              <div className="text-[10px] text-slate-400 font-mono">No. Pesanan: {inv.poNumber}</div>
                              {isEditingPhone ? (
                                <div className="mt-1.5 flex items-center gap-1.5">
                                  <input
                                    type="tel"
                                    value={supplierPhoneDraft}
                                    onChange={(e) => setSupplierPhoneDraft(e.target.value)}
                                    placeholder="08xx / 628xx..."
                                    className="w-36 min-h-[36px] px-2 py-1 text-[11px] font-mono bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-900"
                                    autoFocus
                                  />
                                  <button
                                    type="button"
                                    onClick={() => saveSupplierPhone(inv.supplier, supplierPhoneDraft, inv.id)}
                                    className="min-h-[36px] px-2.5 py-1 rounded-md bg-slate-900 text-white text-[11px] font-bold cursor-pointer"
                                  >
                                    Simpan
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingSupplierPhoneId(null);
                                      setSupplierPhoneDraft('');
                                    }}
                                    className="min-h-[36px] px-2 py-1 rounded-md border border-slate-200 bg-white text-slate-600 text-[11px] font-semibold cursor-pointer"
                                  >
                                    Batal
                                  </button>
                                </div>
                              ) : (
                                <div className="mt-1 flex items-center gap-1.5 text-[10.5px] text-slate-500">
                                  <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                                  <span className="font-mono">{resolvedPhone || 'Belum ada nomor WA'}</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingSupplierPhoneId(inv.id);
                                      setSupplierPhoneDraft(resolvedPhone);
                                    }}
                                    className="text-indigo-600 hover:underline font-semibold cursor-pointer"
                                  >
                                    {resolvedPhone ? 'Ubah' : 'Tambah'}
                                  </button>
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <div className={`font-semibold ${inv.daysDiff <= 3 && !isLunas ? 'text-amber-700' : 'text-slate-700'}`}>
                                {inv.dueDate}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-600">
                              Rp {inv.totalAmountRupiah.toLocaleString('id-ID')}
                            </td>
                            <td className="px-4 py-3 text-right font-mono tabular-nums font-bold text-rose-600">
                              Rp {inv.remainingAmountRupiah.toLocaleString('id-ID')}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${
                                isLunas
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : inv.status === 'CICILAN'
                                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                                  : 'bg-rose-50 text-rose-800 border-rose-200'
                              }`}>
                                {inv.status === 'LUNAS' ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                                <span>{inv.status === 'LUNAS' ? 'Lunas' : inv.status === 'CICILAN' ? 'Cicilan' : 'Belum Bayar'}</span>
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <div className="flex flex-wrap items-center justify-center gap-1.5">
                                {waUrl ? (
                                  <a
                                    href={waUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={() => {
                                      triggerNotification(
                                        'Pesan Follow-Up Siap',
                                        `Membuka draf WhatsApp ke ${inv.supplier} (${resolvedPhone}).`,
                                        'info'
                                      );
                                    }}
                                    className="min-h-[40px] px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold text-xs inline-flex items-center gap-1.5 transition-colors"
                                    title={`Kirim pesan WhatsApp ke ${resolvedPhone}`}
                                  >
                                    <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>Quick Contact</span>
                                  </a>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingSupplierPhoneId(inv.id);
                                      setSupplierPhoneDraft('');
                                      triggerNotification(
                                        'Nomor Supplier Belum Tersimpan',
                                        `Masukkan nomor WhatsApp ${inv.supplier} terlebih dahulu.`,
                                        'info'
                                      );
                                    }}
                                    className="min-h-[40px] px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-bold text-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                                  >
                                    <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
                                    <span>Quick Contact</span>
                                  </button>
                                )}

                                {!isLunas ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedSupplierInvoice({
                                        ...inv,
                                        supplierPhone: resolvedPhone,
                                      });
                                      setShowSupplierPayableModal(true);
                                    }}
                                    className="min-h-[40px] px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-colors cursor-pointer"
                                  >
                                    Bayar / Lunasi
                                  </button>
                                ) : (
                                  <span className="text-[11px] text-emerald-600 font-semibold inline-flex items-center justify-center gap-1 px-2">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    Lunas
                                  </span>
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
            )}

            {renderPageSoulFooter('Pembelian Stok')}
          </div>
        )}

        {/* -------------------------------------------------------------------
            TAB 4: STOK BARANG (INVENTORY & FEFO GUDANG)
            ------------------------------------------------------------------- */}
        {activeTab === 'warehouse' && activeSecondaryModule === null && (
          <div className="space-y-4 animate-tab-fade">
            {renderPageSoulHeader(
              'Stok & Harga',
              'Pantau stok gudang per batch, urutan prioritas keluar, dan daftar harga jual.',
              'Potong & Olah',
              () => setShowConversionModal(true)
            )}

            <div className="b2b-card p-3.5 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-slate-600">
                Barang dengan masa simpan paling pendek otomatis didahulukan saat penjualan.
              </p>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={openQrModal}
                  className="min-h-[40px] px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Aktifkan kamera untuk scan kode label barang"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  Scan QR
                </button>
                <button
                  type="button"
                  onClick={handleExportBatchCsv}
                  className="min-h-[40px] px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Unduh data stok ke format CSV"
                >
                  <Download className="w-3.5 h-3.5" />
                  Unduh CSV
                </button>
                <button
                  type="button"
                  onClick={() => setShowOpnameModal(true)}
                  className="min-h-[40px] px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <ClipboardCheck className="w-3.5 h-3.5" />
                  Cek Stok Fisik
                </button>
              </div>
            </div>

            {/* Subtab Switcher: Stok Gudang vs Daftar Barang & Harga */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setWarehouseSubTab('BATCH_LOTS')}
                  className={`min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    warehouseSubTab === 'BATCH_LOTS'
                      ? 'bg-slate-900 text-white'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Package className="w-3.5 h-3.5" />
                  <span>Stok Gudang ({lots.length} Batch)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setWarehouseSubTab('PRICE_CATALOG')}
                  className={`min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    warehouseSubTab === 'PRICE_CATALOG'
                      ? 'bg-slate-900 text-white'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Tag className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Daftar Barang &amp; Harga ({products.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setWarehouseSubTab('CATEGORIES')}
                  className={`min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    warehouseSubTab === 'CATEGORIES'
                      ? 'bg-slate-900 text-white'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Tags className="w-3.5 h-3.5 text-blue-500" />
                  <span>Kategori Barang ({categories.length})</span>
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowCategoryManagerModal(true)}
                  className="min-h-[40px] px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                  title="Tambah dan kelola kategori barang"
                >
                  <Tags className="w-3.5 h-3.5 text-blue-600" />
                  <span>+ Kategori</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowQuickAddProductModal(true)}
                  className="min-h-[40px] px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                  title="Tambah jenis barang baru"
                >
                  <PackagePlus className="w-3.5 h-3.5 text-emerald-600" />
                  <span>+ Tambah Barang</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPriceManagerTargetId(null);
                    setShowPriceManagerModal(true);
                  }}
                  className="min-h-[40px] px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                  title="Ubah harga jual barang"
                >
                  <DollarSign className="w-3.5 h-3.5 text-slate-500" />
                  <span>Edit Semua Harga</span>
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
                  { id: 'ALL', label: `Semua (${lots.length})` },
                  { 
                    id: 'KRITIS', 
                    label: `Masa Simpan <=30 Hari (${lots.filter(l => l.daysLeft <= 30 && !l.isQuarantined).length})`,
                    tooltip: 'Tampilkan stok dengan sisa masa simpan <= 30 hari agar lebih cepat didahulukan',
                    isCritical: true,
                  },
                  { id: 'FEFO', label: `Prioritas Keluar (${lots.filter(l => l.isFefo).length})` },
                  { id: 'NORMAL', label: `Normal (${lots.filter(l => !l.isFefo).length})` },
                ].map(filter => {
                  const isActive = inventoryFilterStatus === filter.id;
                  const isCritical = (filter as any).isCritical;

                  let btnClass = 'min-h-[36px] px-2.5 py-1 rounded-md text-xs transition-all shrink-0 flex items-center gap-1 cursor-pointer ';
                  if (isActive) {
                    btnClass += isCritical
                      ? 'bg-rose-600 text-white font-bold'
                      : 'bg-slate-900 text-white font-bold';
                  } else {
                    btnClass += isCritical
                      ? 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 font-semibold'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200';
                  }

                  return (
                    <button
                      key={filter.id}
                      type="button"
                      title={(filter as any).tooltip}
                      onClick={() => {
                        setInventoryFilterStatus(filter.id as any);
                        if (filter.id === 'KRITIS') {
                          triggerNotification(
                            'Filter Masa Simpan Aktif',
                            'Menampilkan stok dengan sisa masa simpan <= 30 hari agar lebih cepat dijual.',
                            'info'
                          );
                        }
                      }}
                      className={btnClass}
                    >
                      {isCritical && (
                        <AlertTriangle className="w-3.5 h-3.5" />
                      )}
                      {filter.label}
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={() => setShowBulkQrModal(true)}
                  className="min-h-[36px] px-2.5 py-1 rounded-md text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white transition-colors shrink-0 flex items-center gap-1.5 ml-1 cursor-pointer"
                  title="Scan beberapa label QR barang secara beruntun"
                >
                  <Layers className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Scan Banyak</span>
                </button>

                <button
                  type="button"
                  onClick={openQrModal}
                  className="min-h-[36px] px-2.5 py-1 rounded-md text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-colors shrink-0 flex items-center gap-1 cursor-pointer"
                  title="Scan satu label kemasan dengan kamera"
                >
                  <QrCode className="w-3 h-3" />
                  Scan Satu
                </button>

                <button
                  type="button"
                  onClick={handleExportBatchCsv}
                  className="min-h-[36px] px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition-colors shrink-0 flex items-center gap-1 cursor-pointer"
                  title="Unduh data stok ke CSV"
                >
                  <Download className="w-3 h-3" />
                  CSV
                </button>

                <button
                  type="button"
                  onClick={() => setShowYieldModal(true)}
                  className="min-h-[36px] px-2.5 py-1 rounded-md text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition-colors shrink-0 flex items-center gap-1 cursor-pointer"
                  title="Potong daging utuh jadi bagian jual & hitung susut"
                >
                  <Scissors className="w-3 h-3 text-amber-600" />
                  Hitung Hasil Potong
                </button>
              </div>
            </div>

            {/* Banner Khusus Ketika Filter Masa Simpan Aktif */}
            {inventoryFilterStatus === 'KRITIS' && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2 animate-fade-in">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-rose-600 text-white shrink-0">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-rose-900">Filter Masa Simpan &lt;= 30 Hari ({filteredLots.length} Batch)</span>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      Menyembunyikan {lots.filter(l => l.daysLeft > 30).length} stok dengan masa simpan panjang agar barang yang mendekati batas simpan segera terjual.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('pos');
                      setShowBazarPromoModal(true);
                    }}
                    className="min-h-[36px] px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Zap className="w-3 h-3 text-amber-300" />
                    <span>Promo di Kasir</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setInventoryFilterStatus('ALL')}
                    className="min-h-[36px] px-3 py-1 rounded-lg bg-white border border-rose-300 text-rose-700 hover:bg-rose-50 text-xs font-bold transition-colors cursor-pointer"
                  >
                    Tampilkan Semua
                  </button>
                </div>
              </div>
            )}

            <div className="b2b-card overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase font-semibold text-[11px]">
                  <tr>
                    <th className="px-4 py-3">Batch &amp; Barang</th>
                    <th className="px-4 py-3">Lokasi</th>
                    <th className="px-4 py-3">Batas Simpan</th>
                    <th className="px-4 py-3 text-right">Stok (Gram)</th>
                    <th className="px-4 py-3 text-right">Harga Modal/KG</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-center">Label QR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredLots.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
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
                                {l.isFefo ? 'PRIORITAS KELUAR' : 'NORMAL'}
                              </span>
                            </td>
                            <td className="px-4 pt-3 pb-1 text-center">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedLotForQr(l);
                                  setShowLotQrModal(true);
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-[11px] shadow-2xs transition-colors cursor-pointer"
                                title="Generate QR code dan cetak label batch karton"
                              >
                                <QrCode className="w-3.5 h-3.5 text-emerald-400" />
                                <span>QR Code</span>
                              </button>
                            </td>
                          </tr>

                          {/* 3-Tier Stock Density Progress Bar Row */}
                          <tr className="bg-slate-50/50 border-b border-slate-200/80 hover:bg-slate-50 transition-colors">
                            <td colSpan={7} className="px-4 pt-1 pb-2.5">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px]">
                                {/* Density Badge & Indicator */}
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-slate-500 flex items-center gap-1.5 text-[10.5px]">
                                    <span className={`w-2 h-2 rounded-full transition-colors duration-500 ${tierInfo.dotClass}`} />
                                    Isi Freezer:
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
                                      {/* Guide Lines: 50% and 85% */}
                                      <div className="absolute left-[50%] top-0 bottom-0 w-0.5 bg-white/70" title="Batas 50%" />
                                      <div className="absolute left-[85%] top-0 bottom-0 w-0.5 bg-white/70" title="Batas 85%" />
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

                                  {/* Penyesuaian Stok Cepat */}
                                    <div className="flex items-center gap-1 pl-1 border-l border-slate-200">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const targetWeight = Math.max(0, l.weightGram - 5000);
                                          const res = executeStockOpname(latestEngineStateRef.current, {
                                            lotId: l.id,
                                            physicalWeightGram: targetWeight,
                                            reason: 'Penyesuaian cepat gudang (-5.0 KG)',
                                            actorName: 'Staf Gudang',
                                            isOnline,
                                          });
                                          commitEngineResultState(res.state);
                                          triggerNotification('Ambil Stok (-5.0 KG)', `Stok ${l.product} disesuaikan ke ${(targetWeight / 1000).toFixed(1)} KG.`, 'info');
                                        }}
                                        className="min-h-[40px] px-2.5 py-1 rounded bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-mono text-[11px] font-bold transition-all cursor-pointer"
                                        title="Kurangi 5 KG"
                                      >
                                        -5kg
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const targetWeight = Math.min(l.maxCapacityGram || 100000, l.weightGram + 5000);
                                          const res = executeStockOpname(latestEngineStateRef.current, {
                                            lotId: l.id,
                                            physicalWeightGram: targetWeight,
                                            reason: 'Penyesuaian cepat gudang (+5.0 KG)',
                                            actorName: 'Staf Gudang',
                                            isOnline,
                                          });
                                          commitEngineResultState(res.state);
                                          triggerNotification('Tambah Stok (+5.0 KG)', `Stok ${l.product} disesuaikan ke ${(targetWeight / 1000).toFixed(1)} KG.`, 'success');
                                        }}
                                        className="min-h-[40px] px-2.5 py-1 rounded bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-mono text-[11px] font-bold transition-all cursor-pointer"
                                        title="Tambah 5 KG"
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

            {/* SUBTAB 2: DAFTAR BARANG & HARGA JUAL */}
            {warehouseSubTab === 'PRICE_CATALOG' && (
              <div className="space-y-4 animate-tab-fade">
                {/* Metrics Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="b2b-card p-3.5 space-y-1">
                    <span className="text-[11px] text-slate-500 font-medium">Total Barang</span>
                    <div className="text-xl font-extrabold text-slate-900 font-mono tabular-nums">
                      {products.length} Barang
                    </div>
                    <span className="text-[10px] text-emerald-600 font-semibold">Aktif di Kasir</span>
                  </div>

                  <div className="b2b-card p-3.5 space-y-1">
                    <span className="text-[11px] text-slate-500 font-medium">Total Berat Stok</span>
                    <div className="text-xl font-extrabold text-slate-900 font-mono tabular-nums">
                      {(products.reduce((acc, p) => acc + p.stockGram, 0) / 1000).toFixed(1)} KG
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono tabular-nums">
                      {products.reduce((acc, p) => acc + p.stockGram, 0).toLocaleString('id-ID')} g
                    </span>
                  </div>

                  <div className="b2b-card p-3.5 space-y-1">
                    <span className="text-[11px] text-slate-500 font-medium">Di Bawah Batas Aman</span>
                    <div className="text-xl font-extrabold text-amber-700 font-mono tabular-nums">
                      {products.filter(p => p.stockGram <= p.safetyStockGram).length} Barang
                    </div>
                    <span className="text-[10px] text-amber-600 font-semibold">Perlu belanja ulang</span>
                  </div>

                  <div className="b2b-card p-3.5 space-y-1">
                    <span className="text-[11px] text-slate-500 font-medium">Atur Harga Cepat</span>
                    <div className="flex items-center gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setPriceManagerTargetId(null);
                          setShowPriceManagerModal(true);
                        }}
                        className="min-h-[40px] px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer"
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
                        Daftar Barang, Harga Jual &amp; Selisih Untung
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Klik tombol edit harga untuk memperbarui harga jual seketika.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowQuickAddProductModal(true)}
                      className="min-h-[40px] px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <PackagePlus className="w-3.5 h-3.5" />
                      + Tambah Barang Baru
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100/80 text-slate-600 font-bold border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-3">Barang &amp; Kategori</th>
                          <th className="px-3 py-3 text-right">Stok Fisik</th>
                          <th className="px-3 py-3 text-right">Est. Harga Modal</th>
                          <th className="px-3 py-3 text-right">Harga Eceran</th>
                          <th className="px-3 py-3 text-right bg-blue-50/50 text-blue-900">Resto / Hotel</th>
                          <th className="px-3 py-3 text-right bg-emerald-50/50 text-emerald-900">Grosir VIP</th>
                          <th className="px-4 py-3 text-center">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {products.map(prod => {
                          const stockKg = (prod.stockGram / 1000).toFixed(1);
                          const isLow = prod.stockGram <= prod.safetyStockGram;
                          const hppEst = prod.movingAvgHppPerKg || Math.round(prod.basePricePerKg * 0.65);
                          const retailPrice = prod.tierPrices?.RETAIL || prod.basePricePerKg;
                          const horekaPrice = prod.tierPrices?.HOREKA || Math.round(prod.basePricePerKg * 0.9);
                          const vipPrice = prod.tierPrices?.VIP || Math.round(prod.basePricePerKg * 0.82);
                          const isEditingThis = inlineEditingProductId === prod.id;

                          return (
                            <tr key={prod.id} className="hover:bg-slate-50/70 transition-colors">
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2.5">
                                  <div className="relative group/img flex-shrink-0">
                                    {failedImages[prod.id] || !prod.imageUrl ? (
                                      <div className="w-10 h-10 rounded-lg border border-slate-200 bg-slate-100 flex items-center justify-center">
                                        <Package className="w-4 h-4 text-slate-500" />
                                      </div>
                                    ) : (
                                      <img
                                        src={prod.imageUrl}
                                        alt={prod.name}
                                        onError={() => setFailedImages(prev => ({ ...prev, [prod.id]: true }))}
                                        className="w-10 h-10 object-cover rounded-lg border border-slate-200 bg-slate-100 shadow-2xs"
                                      />
                                    )}
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingPhotoProduct(prod);
                                      }}
                                      className="absolute -bottom-1 -right-1 p-0.5 bg-white hover:bg-slate-100 text-slate-700 rounded-full border border-slate-300 shadow-xs cursor-pointer"
                                      title="Ubah Foto Produk"
                                    >
                                      <Camera className="w-2.5 h-2.5 text-slate-700" />
                                    </button>
                                  </div>
                                  <div>
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
                                  </div>
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
                                    onClick={() => setViewingGalleryProduct(prod)}
                                    className="min-h-[40px] px-2.5 py-1.5 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[11px] font-bold flex items-center gap-1 transition-colors border border-emerald-200 cursor-pointer"
                                    title="Lihat galeri foto daging"
                                  >
                                    <Layers className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>Galeri ({prod.gallery?.length || 4})</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => setEditingPhotoProduct(prod)}
                                    className="min-h-[40px] px-2.5 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                                    title="Ubah foto barang"
                                  >
                                    <Camera className="w-3.5 h-3.5 text-slate-500" />
                                    <span>Edit Foto</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setPriceManagerTargetId(prod.id);
                                      setShowPriceManagerModal(true);
                                    }}
                                    className="min-h-[40px] px-2.5 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                                    title="Ubah harga eceran, resto, dan grosir"
                                  >
                                    <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                                    <span>Edit Harga</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      const matched = lots.find(l => l.product.toLowerCase().includes(prod.name.toLowerCase()) || prod.name.toLowerCase().includes(l.product.toLowerCase())) || {
                                        id: `LOT_${prod.id}`,
                                        code: `LOT-${prod.sku.replace('SKU-', '')}-2611`,
                                        product: prod.name,
                                        sku: prod.sku,
                                        daysLeft: 21,
                                        expiryDate: '2026-11-28',
                                        weightGram: prod.stockGram,
                                        loc: 'FREEZER-A-01',
                                        hppKgRupiah: (prod as any).estimatedHppPerKg || 170000,
                                      };
                                      setSelectedLotForQr(matched);
                                      setShowLotQrModal(true);
                                    }}
                                    className="min-h-[40px] px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-white font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
                                    title="Lihat dan cetak kode QR barang ini"
                                  >
                                    <QrCode className="w-3.5 h-3.5 text-emerald-400" />
                                    <span>QR</span>
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
                                    className="min-h-[40px] px-3 py-1.5 rounded bg-slate-900 hover:bg-slate-800 text-white font-bold text-[11px] transition-colors cursor-pointer"
                                    title="Buat pesanan beli stok barang ini"
                                  >
                                    Beli
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

            {/* SUBTAB 3: KATEGORI BARANG */}
            {warehouseSubTab === 'CATEGORIES' && (
              <div className="space-y-4 animate-tab-fade">
                {/* Metric Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="b2b-card p-3.5 space-y-1">
                    <span className="text-[11px] text-slate-500 font-medium">Total Kategori</span>
                    <div className="text-xl font-extrabold text-slate-900 font-mono tabular-nums">
                      {categories.length} Kategori
                    </div>
                    <span className="text-[10px] text-emerald-600 font-semibold">Aktif di Kasir &amp; Pembelian</span>
                  </div>

                  <div className="b2b-card p-3.5 space-y-1">
                    <span className="text-[11px] text-slate-500 font-medium">Total Barang</span>
                    <div className="text-xl font-extrabold text-slate-900 font-mono tabular-nums">
                      {products.length} Barang
                    </div>
                    <span className="text-[10px] text-slate-500">
                      Rata-rata {(products.length / Math.max(1, categories.length)).toFixed(1)} barang / kategori
                    </span>
                  </div>

                  <div className="b2b-card p-3.5 space-y-1">
                    <span className="text-[11px] text-slate-500 font-medium">Kategori Ada Stok</span>
                    <div className="text-xl font-extrabold text-emerald-700 font-mono tabular-nums">
                      {categories.filter(c => products.some(p => p.category === c.id && p.stockGram > 0)).length} Kategori
                    </div>
                    <span className="text-[10px] text-emerald-600 font-semibold">Siap di gudang dingin</span>
                  </div>

                  <div className="b2b-card p-3.5 flex flex-col justify-between">
                    <div>
                      <span className="text-[11px] text-slate-500 font-medium">Tambah Kategori</span>
                      <p className="text-[10px] text-slate-400">Buat kelompok potongan baru</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowCategoryManagerModal(true)}
                      className="mt-2 min-h-[40px] w-full py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
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
                        Daftar Kategori Barang
                      </h3>
                      <p className="text-xs text-slate-500">
                        Kategori otomatis muncul sebagai pilihan filter di Kasir, Gudang, dan Pembelian.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowQuickAddProductModal(true)}
                        className="min-h-[40px] px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <PackagePlus className="w-3.5 h-3.5 text-emerald-600" />
                        <span>+ Tambah Barang ke Kategori</span>
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-3">Kode</th>
                          <th className="px-4 py-3">Nama Kategori</th>
                          <th className="px-4 py-3">Keterangan</th>
                          <th className="px-3 py-3 text-center">Jumlah Barang</th>
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
                                    <span className="text-[10px] text-slate-400 font-medium">Utama</span>
                                  )}
                                </div>
                              </td>

                              <td className="px-4 py-3 font-bold text-slate-900">
                                {cat.label}
                              </td>

                              <td className="px-4 py-3 text-slate-500 max-w-xs">
                                {cat.description || '-'}
                              </td>

                              <td className="px-3 py-3 text-center font-mono tabular-nums font-bold text-slate-800">
                                {catProducts.length} Barang
                              </td>

                              <td className="px-3 py-3 text-right font-mono tabular-nums font-bold text-slate-900">
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
                                    className="min-h-[36px] px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold transition-colors cursor-pointer"
                                    title="Buka kategori ini di Kasir"
                                  >
                                    Buka di Kasir
                                  </button>

                                  {!cat.isCore && (
                                    confirmDeleteCategoryId === cat.id ? (
                                      <div className="flex items-center gap-1">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            handleDeleteCategory(cat.id);
                                            setConfirmDeleteCategoryId(null);
                                          }}
                                          className="min-h-[36px] px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold transition-colors cursor-pointer"
                                        >
                                          Ya, Hapus
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setConfirmDeleteCategoryId(null)}
                                          className="min-h-[36px] px-2.5 py-1 rounded border border-slate-300 bg-white text-slate-700 text-[11px] font-bold transition-colors cursor-pointer"
                                        >
                                          Batal
                                        </button>
                                      </div>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => setConfirmDeleteCategoryId(cat.id)}
                                        className="min-h-[36px] px-2.5 py-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 text-[11px] font-bold transition-colors cursor-pointer"
                                        title="Hapus kategori tambahan"
                                      >
                                        Hapus
                                      </button>
                                    )
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

            {renderPageSoulFooter('Stok & Harga')}
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
              {renderPageSoulHeader(
                'Tagihan & Kas',
                'Pantau tagihan pelanggan yang berjalan, tagihan supplier, dan biaya operasional toko.'
              )}

              {/* HERO CARD: TOTAL TAGIHAN BELUM LUNAS */}
              <div className="b2b-card p-5 bg-slate-900 text-white space-y-4 border-slate-800">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-semibold text-slate-300 tracking-wide uppercase">
                      Total Tagihan Pelanggan Belum Lunas
                    </span>
                    <div className="text-3xl sm:text-4xl font-black font-mono tabular-nums text-emerald-400 mt-1">
                      Rp {totalAllPiutang.toLocaleString('id-ID')}
                    </div>
                    <p className="text-xs text-slate-300 mt-1">
                      {countAllPiutang} tagihan berjalan dari pelanggan resto &amp; grosir
                    </p>
                  </div>

                  {/* Ringkasan Tempo Tanpa Pill Bertumpuk */}
                  <div className="grid grid-cols-2 sm:grid-cols-1 gap-2 shrink-0 text-xs">
                    <div className="px-3 py-2 rounded-lg bg-slate-800/80 border border-slate-700 flex items-center justify-between gap-3">
                      <span className="text-amber-300 font-semibold">Perlu Ditagih Minggu Ini</span>
                      <span className="font-mono tabular-nums font-extrabold text-white">
                        Rp {(totalTerlambat + totalHariIni + totalAkanDatang).toLocaleString('id-ID')}
                      </span>
                    </div>
                    <div className="px-3 py-2 rounded-lg bg-slate-800/80 border border-slate-700 flex items-center justify-between gap-3">
                      <span className="text-emerald-300 font-semibold">Tempo &gt; 7 Hari</span>
                      <span className="font-mono tabular-nums font-extrabold text-white">
                        Rp {totalLebih7Hari.toLocaleString('id-ID')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 4 TOMBOL AKSI UTAMA */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3 border-t border-slate-700/80">
                  <button
                    type="button"
                    onClick={() => setShowCustomerDashboardModal(true)}
                    className="min-h-[48px] p-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 font-extrabold text-xs flex items-center gap-2 transition-all cursor-pointer border border-emerald-200"
                  >
                    <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                      <Wallet className="w-4 h-4" />
                    </div>
                    <div className="text-left min-w-0">
                      <div className="leading-none text-emerald-950 font-black">Catat Bayar</div>
                      <div className="text-[10px] text-emerald-700 font-medium leading-tight mt-0.5">Pelunasan Tagihan</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setReceivableFilter('HARI_INI');
                      triggerNotification('Filter Jatuh Tempo Hari Ini', 'Menampilkan tagihan yang jatuh tempo hari ini.', 'info');
                    }}
                    className="min-h-[48px] p-3 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 font-extrabold text-xs flex items-center gap-2 transition-all cursor-pointer border border-amber-200"
                  >
                    <div className="w-7 h-7 rounded-lg bg-amber-600 text-white flex items-center justify-center shrink-0">
                      <MessageSquare className="w-4 h-4" />
                    </div>
                    <div className="text-left min-w-0">
                      <div className="leading-none text-amber-950 font-black">Tagih WA</div>
                      <div className="text-[10px] text-amber-700 font-medium leading-tight mt-0.5">Kirim Pesan WA</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('beli');
                      setPurchasingSubTab('AP_DEBT');
                    }}
                    className="min-h-[48px] p-3 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-900 font-extrabold text-xs flex items-center gap-2 transition-all cursor-pointer border border-blue-200"
                  >
                    <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <div className="text-left min-w-0">
                      <div className="leading-none text-blue-950 font-black">Tagihan Supplier</div>
                      <div className="text-[10px] text-blue-700 font-medium leading-tight mt-0.5">Bayar ke Pemasok</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowPettyCashModal(true)}
                    className="min-h-[48px] p-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-900 font-extrabold text-xs flex items-center gap-2 transition-all cursor-pointer border border-indigo-200"
                  >
                    <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0">
                      <Receipt className="w-4 h-4" />
                    </div>
                    <div className="text-left min-w-0">
                      <div className="leading-none text-indigo-950 font-black">Biaya Toko</div>
                      <div className="text-[10px] text-indigo-700 font-medium leading-tight mt-0.5">Kas Kecil Harian</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* -------------------------------------------------------------
                  RINGKASAN TAGIHAN PER KATEGORI JATUH TEMPO
                  ------------------------------------------------------------- */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                
                {/* 1. Jatuh Tempo Hari Ini */}
                <div 
                  onClick={() => setReceivableFilter(prev => prev === 'HARI_INI' ? 'ALL' : 'HARI_INI')}
                  className={`b2b-card p-3.5 space-y-2 cursor-pointer transition-all duration-200 ${
                    receivableFilter === 'HARI_INI' 
                      ? 'ring-2 ring-amber-500 bg-amber-50/50' 
                      : 'hover:border-amber-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-800 flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-amber-600" />
                      Jatuh Tempo Hari Ini
                    </span>
                  </div>
                  <div>
                    <div className="text-lg font-extrabold font-mono tabular-nums text-amber-700">
                      Rp {totalHariIni.toLocaleString('id-ID')}
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
                      <span>{countHariIni} Tagihan Hari Ini</span>
                      <span className="text-[10px] font-semibold text-amber-700 underline">
                        {receivableFilter === 'HARI_INI' ? 'Aktif' : 'Filter'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 2. Terlambat */}
                <div 
                  onClick={() => setReceivableFilter(prev => prev === 'TERLAMBAT' ? 'ALL' : 'TERLAMBAT')}
                  className={`b2b-card p-3.5 space-y-2 cursor-pointer transition-all duration-200 ${
                    receivableFilter === 'TERLAMBAT' 
                      ? 'ring-2 ring-rose-500 bg-rose-50/50' 
                      : 'hover:border-rose-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-rose-800 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-rose-600" />
                      Terlambat
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
                  BAR CHART: JADWAL JATUH TEMPO TAGIHAN
                  ------------------------------------------------------------- */}
              <div className="b2b-card p-4 space-y-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                  <div>
                    <h4 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-slate-700" />
                      Jadwal Jatuh Tempo Tagihan Pelanggan
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Sebaran total tagihan untuk menentukan prioritas penagihan kas toko
                    </p>
                  </div>
                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                      Total Tagihan: <strong className="font-mono tabular-nums text-slate-900">Rp {totalAllPiutang.toLocaleString('id-ID')}</strong> ({countAllPiutang} Faktur)
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
                    className={`min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                      receivableFilter === 'ALL'
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    <span>Semua Tagihan</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      receivableFilter === 'ALL' ? 'bg-slate-700 text-white' : 'bg-slate-200 text-slate-700'
                    }`}>
                      {receivables.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setReceivableFilter('HARI_INI')}
                    className={`min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                      receivableFilter === 'HARI_INI'
                        ? 'bg-amber-600 text-white'
                        : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
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
                    className={`min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                      receivableFilter === 'TERLAMBAT'
                        ? 'bg-rose-600 text-white'
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
                    className={`min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                      receivableFilter === 'AKAN_DATANG'
                        ? 'bg-blue-600 text-white'
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
                    className={`min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                      receivableFilter === 'LEBIH_7_HARI'
                        ? 'bg-emerald-700 text-white'
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
                    placeholder="Cari pelanggan / no. nota..."
                    className="w-full min-h-[40px] pl-8 pr-8 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-slate-400 focus:bg-white"
                  />
                  {receivableSearch && (
                    <button
                      type="button"
                      onClick={() => setReceivableSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* -------------------------------------------------------------
                  DAFTAR TAGIHAN PELANGGAN
                  ------------------------------------------------------------- */}
              {filteredReceivables.length === 0 ? (
                <div className="b2b-card p-8 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                    <CheckCheck className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">
                      Tidak Ada Tagihan untuk Kategori Ini
                    </h4>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                      Semua tagihan pada kategori ini sudah lunas atau tidak cocok dengan kata kunci pencarian.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setReceivableFilter('ALL');
                      setReceivableSearch('');
                    }}
                    className="min-h-[40px] px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    Tampilkan Semua Tagihan
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
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
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
                            <div className={`text-base sm:text-lg font-extrabold font-mono tabular-nums ${
                              isPaid ? 'text-slate-400 line-through' : r.category === 'TERLAMBAT' ? 'text-rose-700' : 'text-slate-900'
                            }`}>
                              Rp {r.amount.toLocaleString('id-ID')}
                            </div>
                            <span className="text-[10px] text-slate-500">
                              Batas Tempo: Rp {r.limit.toLocaleString('id-ID')} ({creditUsagePct}%)
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

                          <div className="flex flex-wrap items-center gap-2 self-end sm:self-auto">
                            {/* Profil & Batas Tempo Button */}
                            <button
                              type="button"
                              onClick={() => {
                                const found = customers.find(c => c.name.toLowerCase() === r.customer.toLowerCase());
                                setSelectedDashboardCustomerId(found ? found.id : r.customer);
                                setShowCustomerDashboardModal(true);
                              }}
                              className="min-h-[40px] px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer"
                              title="Lihat profil pembeli dan batas tempo"
                            >
                              <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                              <span>Profil &amp; Batas</span>
                            </button>

                            {/* WhatsApp Friendly Reminder */}
                            {!isPaid && (
                              <button
                                type="button"
                                onClick={() => {
                                  const greeting = r.category === 'TERLAMBAT' 
                                    ? `Halo Tim ${r.customer}, mohon konfirmasi pelunasan faktur ${r.invoice} sebesar Rp ${r.amount.toLocaleString('id-ID')} yang telah melewati batas tempo (${r.dueDate}). Terima kasih! - Toko Daging KARKASIA`
                                    : r.category === 'HARI_INI'
                                      ? `Halo Bpk/Ibu ${r.customer}, sekadar mengingatkan faktur ${r.invoice} sebesar Rp ${r.amount.toLocaleString('id-ID')} jatuh tempo hari ini. Mohon info jika sudah transfer ya. - Toko Daging KARKASIA`
                                      : `Halo Bpk/Ibu ${r.customer}, faktur ${r.invoice} sebesar Rp ${r.amount.toLocaleString('id-ID')} akan jatuh tempo pada ${r.dueDate}. Salam hangat dari Toko Daging KARKASIA.`;
                                  navigator.clipboard?.writeText(greeting);
                                  triggerNotification(
                                    'Pesan Pengingat WA Disalin',
                                    `Draft pesan penagihan untuk ${r.customer} (${r.invoice}) disalin ke clipboard.`,
                                    'info'
                                  );
                                }}
                                className="min-h-[40px] px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer"
                                title="Salin pesan WhatsApp untuk follow up penagihan"
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
                                  const res = recordCustomerReceivablePayment(latestEngineStateRef.current, r.id, 'Kasir Toko', isOnline);
                                  commitEngineResultState(res.state);
                                  triggerNotification(
                                    res.ok ? 'Pelunasan Dicatat' : 'Gagal Mencatat',
                                    res.message,
                                    res.ok ? 'success' : 'warning',
                                    res.ok ? r.amount : undefined
                                  );
                                }}
                                className="min-h-[40px] px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition-colors cursor-pointer flex items-center gap-1"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Catat Pelunasan</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  const res = revertCustomerReceivablePayment(latestEngineStateRef.current, r.id, 'Kasir Toko');
                                  commitEngineResultState(res.state);
                                  triggerNotification(
                                    res.ok ? 'Status Diubah' : 'Tidak Dapat Diubah',
                                    res.message,
                                    res.ok ? 'info' : 'warning'
                                  );
                                }}
                                className="min-h-[40px] px-2.5 py-1 text-slate-500 hover:text-slate-800 text-[11px] font-semibold underline cursor-pointer"
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

              {renderPageSoulFooter('Tagihan & Kas')}
            </div>
          );
        })()}

      </main>

      {/* =========================================================================
          MODAL BOTTOM SHEET: "MENU LAINNYA" (PROGRESSIVE DISCLOSURE HUB)
          ========================================================================= */}
      {showModulLainnyaModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-tab-fade">
          <div className="bg-white w-full max-w-2xl rounded-t-2xl sm:rounded-2xl p-5 space-y-4 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <h4 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <Grid className="w-4 h-4 text-emerald-600" />
                  Menu Lainnya
                </h4>
                <p className="text-xs text-slate-500">Laporan, persetujuan pemilik, cadangan data, dan alat bantu tambahan</p>
              </div>
              <button 
                onClick={() => setShowModulLainnyaModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Section 1: Kontrol Pemilik & Keuangan */}
            <div className="space-y-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Laporan, Izin &amp; Keamanan Data</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setShowModulLainnyaModal(false);
                    setActiveSecondaryModule('approval');
                  }}
                  className="p-3 rounded-xl border border-amber-200 hover:border-amber-400 bg-amber-50/40 hover:bg-white text-left transition-all flex items-start gap-3 cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                    <Lock className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-slate-900 flex items-center justify-between gap-2">
                      <span>Persetujuan Pemilik</span>
                      {operationalSummary.pendingApprovalCount > 0 && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-600 text-white text-[10px] font-mono">
                          {operationalSummary.pendingApprovalCount}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500">Tinjau izin tempo melebihi batas</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowModulLainnyaModal(false);
                    setActiveSecondaryModule('laporan');
                  }}
                  className="p-3 rounded-xl border border-slate-200 hover:border-slate-400 bg-slate-50/60 hover:bg-white text-left transition-all flex items-start gap-3 cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">Laporan &amp; Laba Bersih</div>
                    <div className="text-[11px] text-slate-500">Omzet, modal daging &amp; ekspor PDF</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowModulLainnyaModal(false);
                    setActiveSecondaryModule('jurnal');
                  }}
                  className="p-3 rounded-xl border border-slate-200 hover:border-slate-400 bg-slate-50/60 hover:bg-white text-left transition-all flex items-start gap-3 cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">Catatan Akuntansi Otomatis</div>
                    <div className="text-[11px] text-slate-500">Jurnal pemasukan &amp; modal seimbang otomatis</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowModulLainnyaModal(false);
                    setActiveSecondaryModule('audit');
                  }}
                  className="p-3 rounded-xl border border-slate-200 hover:border-slate-400 bg-slate-50/60 hover:bg-white text-left transition-all flex items-start gap-3 cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">Riwayat &amp; Pembatalan</div>
                    <div className="text-[11px] text-slate-500">Keluar-masuk stok, batal faktur &amp; jejak staf</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowModulLainnyaModal(false);
                    setActiveSecondaryModule('backup');
                  }}
                  className="p-3 rounded-xl border border-slate-200 hover:border-slate-400 bg-slate-50/60 hover:bg-white text-left transition-all flex items-start gap-3 cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-lg bg-sky-50 text-sky-700 flex items-center justify-center shrink-0">
                    <Cloud className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">Backup &amp; Sinkronisasi</div>
                    <div className="text-[11px] text-slate-500">Unduh cadangan, pulihkan file &amp; antrean sync</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowModulLainnyaModal(false);
                    setActiveSecondaryModule('pajak');
                  }}
                  className="p-3 rounded-xl border border-slate-200 hover:border-slate-400 bg-slate-50/60 hover:bg-white text-left transition-all flex items-start gap-3 cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                    <Receipt className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">Pajak Usaha (0,5%)</div>
                    <div className="text-[11px] text-slate-500">Estimasi pajak final UMKM otomatis</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowModulLainnyaModal(false);
                    setActiveSecondaryModule('pengaturan');
                  }}
                  className="p-3 rounded-xl border border-slate-200 hover:border-slate-400 bg-slate-50/60 hover:bg-white text-left transition-all flex items-start gap-3 cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                    <Settings className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">Pengaturan Toko</div>
                    <div className="text-[11px] text-slate-500">Identitas usaha &amp; keamanan PIN pemilik</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Section 2: Alat Bantu Operasional */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Alat Bantu Harian</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setShowModulLainnyaModal(false);
                    setShowYieldModal(true);
                  }}
                  className="p-3 rounded-xl border border-slate-200 hover:border-slate-400 bg-white text-left transition-all flex items-start gap-3 cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                    <Scissors className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">Potong &amp; Olah Daging</div>
                    <div className="text-[11px] text-slate-500">Ubah daging utuh jadi steak, tetelan &amp; hitung susut</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowModulLainnyaModal(false);
                    setShowVoiceNoteModal(true);
                  }}
                  className="p-3 rounded-xl border border-slate-200 hover:border-slate-400 bg-white text-left transition-all flex items-start gap-3 cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <Mic className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">Catat Pesanan Suara</div>
                    <div className="text-[11px] text-slate-500">Ubah pesan suara sales langsung jadi keranjang</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowModulLainnyaModal(false);
                    setShowReturnModal(true);
                  }}
                  className="p-3 rounded-xl border border-slate-200 hover:border-slate-400 bg-white text-left transition-all flex items-start gap-3 cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                    <RotateCcw className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">Retur Barang Komplain</div>
                    <div className="text-[11px] text-slate-500">Foto bukti &amp; pisahkan ke ruang karantina</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowModulLainnyaModal(false);
                    setShowPettyCashModal(true);
                  }}
                  className="p-3 rounded-xl border border-slate-200 hover:border-slate-400 bg-white text-left transition-all flex items-start gap-3 cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <Wallet className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">Biaya Operasional Toko</div>
                    <div className="text-[11px] text-slate-500">Es balok, plastik vakum, bensin armada</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowModulLainnyaModal(false);
                    setShowBazarPromoModal(true);
                  }}
                  className="p-3 rounded-xl border border-slate-200 hover:border-slate-400 bg-white text-left transition-all flex items-start gap-3 cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                    <Tag className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">Promo Bazar &amp; Diskon</div>
                    <div className="text-[11px] text-slate-500">Atur harga promo khusus stok menumpuk</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowModulLainnyaModal(false);
                    setActiveTab('beli');
                    setPurchasingSubTab('AP_DEBT');
                  }}
                  className="p-3 rounded-xl border border-slate-200 hover:border-slate-400 bg-white text-left transition-all flex items-start gap-3 cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">Tagihan ke Supplier</div>
                    <div className="text-[11px] text-slate-500">Pantau &amp; bayar faktur pembelian daging</div>
                  </div>
                </button>
              </div>
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
            { id: 'home', label: 'Ringkasan', icon: Home },
            { id: 'pos', label: 'Kasir', icon: ShoppingCart },
            { id: 'beli', label: 'Beli', icon: Truck },
            { id: 'warehouse', label: 'Stok', icon: Package },
            { id: 'bayar', label: 'Tagihan', icon: Wallet },
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
                    <h3 className="text-base font-extrabold tracking-tight">Potong &amp; Olah Daging</h3>
                    <p className="text-xs text-slate-300">Catat hasil potongan daging utuh jadi potongan siap jual &amp; susutnya</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowYieldModal(false)}
                  className="w-10 h-10 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                  aria-label="Tutup"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 sm:p-6 space-y-5 text-xs max-h-[80vh] overflow-y-auto">
                {/* Source Lot Selector */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                  <label className="block text-slate-700 font-bold">1. Pilih Stok Daging Utuh (Bahan Asal):</label>
                  <select
                    value={yieldSourceLotId}
                    onChange={e => setYieldSourceLotId(e.target.value)}
                    className="w-full min-h-[40px] bg-white border border-slate-300 rounded-lg p-2.5 font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  >
                    {lots.filter(l => !l.isQuarantined).map(l => (
                      <option key={l.id} value={l.id}>
                        {l.code} &bull; {l.product} (Stok: {(l.weightGram / 1000).toFixed(1)} KG &bull; Modal: Rp {l.hppKgRupiah.toLocaleString('id-ID')}/KG)
                      </option>
                    ))}
                  </select>
                </div>

                {/* Weight Inputs Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1.5">
                    <label className="block font-bold text-slate-700">Berat Bahan Asal (KG):</label>
                    <input
                      type="number"
                      step="0.5"
                      min="1"
                      value={yieldInputWeightKg}
                      onChange={e => setYieldInputWeightKg(Math.max(1, Number(e.target.value)))}
                      className="w-full min-h-[40px] bg-white border border-slate-300 rounded-lg p-2 text-sm font-mono font-bold text-slate-900 focus:ring-2 focus:ring-slate-900"
                    />
                    <div className="text-[10px] text-slate-500 font-medium">Daging utuh yang akan dipotong</div>
                  </div>

                  <div className="bg-emerald-50/60 p-3.5 rounded-xl border border-emerald-200 space-y-1.5">
                    <label className="block font-bold text-emerald-900">Hasil Potongan Utama (KG):</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.5"
                      value={yieldPrimaryWeightKg}
                      onChange={e => setYieldPrimaryWeightKg(Math.max(0, Number(e.target.value)))}
                      className="w-full min-h-[40px] bg-white border border-emerald-300 rounded-lg p-2 text-sm font-mono font-bold text-emerald-800 focus:ring-2 focus:ring-emerald-600"
                    />
                    <div className="text-[10px] text-emerald-700 font-bold">Hasil: {primaryPct}% dari bahan asal</div>
                  </div>

                  <div className="bg-amber-50/60 p-3.5 rounded-xl border border-amber-200 space-y-1.5">
                    <label className="block font-bold text-amber-900">Hasil Tetelan / Cincang (KG):</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={yieldSecondaryWeightKg}
                      onChange={e => setYieldSecondaryWeightKg(Math.max(0, Number(e.target.value)))}
                      className="w-full min-h-[40px] bg-white border border-amber-300 rounded-lg p-2 text-sm font-mono font-bold text-amber-800 focus:ring-2 focus:ring-amber-600"
                    />
                    <div className="text-[10px] text-amber-700 font-bold">Hasil: {secondaryPct}% (Daging Cincang)</div>
                  </div>
                </div>

                {/* 3-Tier Multi-Segment Yield Bar */}
                <div className="space-y-2 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                    <span>Rincian Hasil Potong &amp; Susut Pisau:</span>
                    <span className="font-mono text-rose-600">Susut: {lossKg.toFixed(2)} KG ({lossPct}%)</span>
                  </div>
                  
                  {/* Progress multi-segment */}
                  <div className="w-full h-5 rounded-full bg-slate-200 overflow-hidden flex shadow-inner">
                    <div 
                      style={{ width: `${Math.min(100, Math.max(0, Number(primaryPct)))}%` }} 
                      className="bg-emerald-500 h-full transition-all duration-300 flex items-center justify-center text-[10px] font-extrabold text-white"
                      title={`Potongan Utama: ${primaryPct}%`}
                    >
                      {Number(primaryPct) > 15 ? `${primaryPct}% Utama` : ''}
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
                      title={`Susut Potong: ${lossPct}%`}
                    >
                      {Number(lossPct) > 8 ? `${lossPct}% Susut` : ''}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 font-medium">
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Potongan Utama ({primaryKg.toFixed(1)} KG)</span>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Tetelan Super ({secondaryKg.toFixed(1)} KG)</span>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Susut Pisau ({lossKg.toFixed(2)} KG)</span>
                  </div>
                </div>

                {/* HPP Redistribution Card */}
                <div className="bg-slate-900 text-white p-4 rounded-xl space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="font-extrabold text-xs text-amber-400 flex items-center gap-1.5">
                      <Scale className="w-4 h-4" />
                      Hitung Ulang Harga Modal Otomatis
                    </span>
                    <span className="text-[10px] text-slate-400">Menjaga harga pokok tetap akurat</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                    <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700/60">
                      <div className="text-[10px] text-slate-400">Total Modal Bahan</div>
                      <div className="font-mono font-bold text-xs text-white">Rp {totalRawCost.toLocaleString('id-ID')}</div>
                    </div>
                    <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700/60">
                      <div className="text-[10px] text-slate-400">Nilai Hasil Tetelan</div>
                      <div className="font-mono font-bold text-xs text-amber-300">Rp {tetelanValue.toLocaleString('id-ID')}</div>
                    </div>
                    <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700/60">
                      <div className="text-[10px] text-slate-400">Modal Potongan Utama</div>
                      <div className="font-mono font-bold text-xs text-emerald-300">Rp {steakNetCost.toLocaleString('id-ID')}</div>
                    </div>
                    <div className="bg-emerald-950/60 p-2.5 rounded-lg border border-emerald-500/40">
                      <div className="text-[10px] text-emerald-400 font-bold">Harga Modal Baru / KG</div>
                      <div className="font-mono font-extrabold text-sm text-emerald-300">
                        Rp {effectiveSteakHpp.toLocaleString('id-ID')}
                      </div>
                    </div>
                  </div>

                  <p className="text-[10px] text-slate-400 leading-relaxed italic">
                    *Susut pisau {lossKg.toFixed(2)} KG ({lossPct}%) diserap langsung ke harga modal potongan utama agar keuntungan tetap terjaga.
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2">
                <div className="text-[11px] text-slate-500 font-medium">
                  Otomatis memperbarui stok &amp; harga modal barang
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowYieldModal(false)}
                    className="min-h-[40px] px-3.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleProcessYieldConversion}
                    className="min-h-[40px] px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Simpan Hasil Potongan</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* =========================================================================
          ASISTEN PESAN SUARA SALES (AI VOICE NOTE ORDER)
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
                  <h3 className="text-base font-extrabold tracking-tight">Catat Pesanan Suara</h3>
                  <p className="text-xs text-slate-300">Ubah pesan suara atau catatan teks menjadi pesanan kasir</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowVoiceNoteModal(false)}
                className="w-10 h-10 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                aria-label="Tutup"
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
                      ? 'bg-rose-600 text-white ring-8 ring-rose-500/30' 
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white ring-4 ring-emerald-500/20'
                  }`}
                  title={isRecordingVoice ? 'Klik untuk berhenti merekam' : 'Klik untuk mulai merekam suara'}
                >
                  {isRecordingVoice ? <MicOff className="w-7 h-7" /> : <Mic className="w-7 h-7" />}
                </button>

                <div>
                  <div className="font-bold text-sm text-white">
                    {isRecordingVoice ? 'Sedang Merekam Pesanan...' : 'Tekan Mikrofon untuk Bicara'}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {isRecordingVoice 
                      ? 'Sebutkan nama pembeli, jenis daging, berat kiloan, dan cara bayar.'
                      : 'Atau pilih salah satu contoh catatan pesanan di bawah ini.'}
                  </p>
                </div>

                {/* Calm Waveform Indicator */}
                {isRecordingVoice && (
                  <div className="flex items-center gap-1.5 h-6">
                    {[16, 24, 12, 28, 20, 32, 18, 26, 14, 22].map((h, i) => (
                      <span 
                        key={i} 
                        style={{ height: `${h}px` }} 
                        className="w-1 bg-emerald-400 rounded-full" 
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Sample Voice Notes (Quick Chips) */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                  <Volume2 className="w-3.5 h-3.5 text-slate-400" />
                  <span>Contoh Pesan Order WhatsApp:</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  {[
                    {
                      label: 'Hotel Grand Serang (Tempo 14 Hari)',
                      text: 'Hotel Grand Serang minta Australian Ribeye 5 kilo sama Saikoro Meltique 3 kilo bayar tempo 14 hari',
                    },
                    {
                      label: 'Steakhouse Banten Prima (Tunai)',
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
                      className="min-h-[40px] text-left p-2.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors text-[11px] text-slate-700 flex items-start justify-between group cursor-pointer"
                    >
                      <span className="font-semibold text-slate-900 group-hover:text-emerald-700">{preset.label}: <span className="font-normal text-slate-600 italic">"{preset.text}"</span></span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Transcript Text Box */}
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-700">Isi Catatan Pesanan:</label>
                <textarea
                  rows={3}
                  value={voiceTranscript}
                  onChange={e => setVoiceTranscript(e.target.value)}
                  placeholder="Hasil suara akan muncul di sini atau ketik manual..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              {/* Action Button: Parse Voice */}
              <button
                type="button"
                onClick={handleParseVoiceNote}
                disabled={isParsingVoice || !voiceTranscript.trim()}
                className="w-full min-h-[44px] py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                {isParsingVoice ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                    <span>Sedang membaca isi pesanan...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    <span>Baca &amp; Susun Pesanan</span>
                  </>
                )}
              </button>

              {/* Parsed Result Card */}
              {voiceParseResult && (
                <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-emerald-200 pb-2">
                    <span className="font-extrabold text-xs text-emerald-950 flex items-center gap-1.5">
                      <CheckCircle className="w-4 h-4 text-emerald-600" />
                      Ringkasan Pesanan Terbaca
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-200 text-emerald-900">
                      Kecocokan: {Math.round((voiceParseResult.confidenceScore || 0.95) * 100)}%
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-500 text-[11px]">Pembeli:</span>
                      <div className="font-bold text-slate-900">{voiceParseResult.customerName}</div>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[11px]">Cara Bayar:</span>
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
                          <th className="px-3 py-2">Barang</th>
                          <th className="px-3 py-2 text-right">Berat (KG)</th>
                          <th className="px-3 py-2 text-right">Perkiraan Total</th>
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
                    className="w-full min-h-[44px] py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <ShoppingCart className="w-4 h-4" />
                    <span>Masukkan ke Keranjang Kasir</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          FORMULIR RETUR KOMPLAIN PELANGGAN + KAMERA BUKTI
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
                  <h3 className="text-base font-extrabold tracking-tight">Formulir Retur Daging Komplain</h3>
                  <p className="text-xs text-slate-300">Catat barang komplain, foto bukti, dan pisahkan dari stok jual</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  stopReturnCamera();
                  setShowReturnModal(false);
                }}
                className="w-10 h-10 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                aria-label="Tutup"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 sm:p-6 space-y-4 text-xs max-h-[80vh] overflow-y-auto">
              {/* Form Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block font-bold text-slate-700">Pembeli yang Mengembalikan:</label>
                  <select
                    value={returnCustomer}
                    onChange={e => setReturnCustomer(e.target.value)}
                    className="w-full min-h-[40px] bg-slate-50 border border-slate-300 rounded-lg p-2 font-semibold text-slate-900"
                  >
                    {customers.map(c => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-slate-700">No. Nota Penjualan:</label>
                  <input
                    type="text"
                    value={returnInvoice}
                    onChange={e => setReturnInvoice(e.target.value)}
                    className="w-full min-h-[40px] bg-slate-50 border border-slate-300 rounded-lg p-2 font-mono font-semibold text-slate-900"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-slate-700">Barang yang Dikomplain:</label>
                  <select
                    value={returnProduct}
                    onChange={e => setReturnProduct(e.target.value)}
                    className="w-full min-h-[40px] bg-slate-50 border border-slate-300 rounded-lg p-2 font-semibold text-slate-900"
                  >
                    {products.map(p => (
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
                    className="w-full min-h-[40px] bg-slate-50 border border-slate-300 rounded-lg p-2 font-mono font-bold text-slate-900"
                  />
                </div>
              </div>

              {/* Defect Reason Selection */}
              <div className="space-y-1">
                <label className="block font-bold text-slate-700">Alasan Komplain / Kondisi Barang:</label>
                <select
                  value={returnReason}
                  onChange={e => setReturnReason(e.target.value)}
                  className="w-full min-h-[40px] bg-slate-50 border border-slate-300 rounded-lg p-2 font-semibold text-slate-900"
                >
                  <option value="Bau Asam / Off-Odor (Suhu Reefer Rusak)">Bau Asam / Tidak Segar (Suhu Pengiriman Naik)</option>
                  <option value="Discoloration / Daging Menghitam Keabuan">Warna Daging Berubah Menghitam</option>
                  <option value="Kemasan Vakum Bocor / Freezer Burn Kering">Kemasan Vakum Bocor / Kering Terbakar Dingin</option>
                  <option value="Kelebihan Lemak / Fat Excess diluar toleransi spesifikasi (>25%)">Lemak Terlalu Banyak (Di Atas Batas Normal)</option>
                  <option value="Selisih Timbangan Tiba di Dapur Pelanggan">Selisih Timbangan Saat Diterima</option>
                </select>
              </div>

              {/* Resolution Type */}
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-700">Pilihan Penyelesaian:</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'CREDIT_NOTE', label: 'Potong Tagihan', desc: 'Kurangi sisa tagihan' },
                    { id: 'TUKAR_BARANG', label: 'Tukar Barang', desc: 'Kirim stok pengganti' },
                    { id: 'REFUND_KAS', label: 'Kembalikan Uang', desc: 'Bayar balik tunai/transfer' },
                  ].map(res => (
                    <button
                      key={res.id}
                      type="button"
                      onClick={() => setReturnResolution(res.id as any)}
                      className={`min-h-[48px] p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                        returnResolution === res.id 
                          ? 'border-slate-900 bg-slate-900 text-white font-bold' 
                          : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 font-medium'
                      }`}
                    >
                      <div className="text-xs">{res.label}</div>
                      <div className={`text-[10px] ${returnResolution === res.id ? 'text-slate-300' : 'text-slate-500'}`}>{res.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Camera Capture Section */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Camera className="w-4 h-4 text-slate-600" />
                    Bukti Foto Barang (Wajib Diambil):
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
                        className="min-h-[40px] px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg flex items-center gap-1.5 cursor-pointer"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        <span>Ambil Foto Bukti</span>
                      </button>
                      <button
                        type="button"
                        onClick={stopReturnCamera}
                        className="min-h-[40px] px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer"
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
                        className="min-h-[40px] px-3 py-1.5 rounded-lg bg-white text-slate-900 text-xs font-bold shadow-md flex items-center gap-1 cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Ambil Ulang Foto
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-2 py-4 border-2 border-dashed border-slate-300 rounded-xl bg-white px-3">
                    <button
                      type="button"
                      onClick={startReturnCamera}
                      className="min-h-[40px] px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Camera className="w-4 h-4 text-emerald-400" />
                      <span>Buka Kamera Bukti</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setReturnPhotoUrl('https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=600&auto=format&fit=crop&q=80')}
                      className="min-h-[40px] px-3 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer"
                    >
                      Gunakan Foto Contoh
                    </button>
                  </div>
                )}
              </div>

              {/* Quarantine Warning */}
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 flex items-start gap-2.5">
                <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div className="text-[11px] text-amber-900 leading-relaxed">
                  <span className="font-bold">Barang Dipisahkan:</span> Barang retur akan otomatis dipindahkan ke rak terpisah (<strong>CHILLER-ISOLASI-01</strong>) dengan status tidak dijual kembali agar tidak masuk ke kasir.
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2">
              <span className="text-[11px] text-slate-500 font-medium">
                Otomatis sesuaikan tagihan &amp; pisahkan stok rusak
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    stopReturnCamera();
                    setShowReturnModal(false);
                  }}
                  className="min-h-[40px] px-3.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleProcessReturn}
                  className="min-h-[40px] px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Simpan Retur</span>
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
                Cek Stok Fisik Gudang
              </h4>
              <button
                type="button"
                onClick={() => setShowOpnameModal(false)}
                className="w-10 h-10 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
                aria-label="Tutup"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Pilih Lot Barang:</label>
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
                      {l.code} - {l.product} (Tercatat: {(l.weightGram / 1000).toFixed(1)} KG)
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
                className="min-h-[40px] px-3.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleCommitOpname}
                className="min-h-[40px] px-4 py-1.5 rounded-lg bg-slate-900 text-xs font-bold text-white cursor-pointer"
              >
                Simpan Hasil Cek
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
                className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                aria-label="Tutup"
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

                  {/* Scanning Guide Line */}
                  <div className="absolute inset-x-2 top-1/2 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent" />
                </div>
              </div>

              {/* Status Badge */}
              <div className="absolute bottom-3 inset-x-4 flex items-center justify-between bg-slate-900/85 backdrop-blur-xs px-3 py-1.5 rounded-lg border border-slate-700/60 text-[11px]">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${isCameraActive ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                  <span className="text-slate-200">
                    {isCameraActive ? 'Kamera Pemindai Aktif' : 'Menghubungkan kamera...'}
                  </span>
                </div>
                <span className="font-mono text-[10px] text-slate-400">PRIORITAS OTOMATIS</span>
              </div>

              {/* Camera Error / Permission Fallback Notice */}
              {cameraError && (
                <div className="absolute inset-x-4 top-3 bg-amber-950/90 border border-amber-600/80 text-amber-200 p-3 rounded-xl text-xs space-y-1 z-10">
                  <div className="font-bold flex items-center gap-1.5 text-amber-300">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    Info Kamera
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
                <span className="text-[10px] text-slate-500">Klik untuk pilih</span>
              </div>

              <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto pr-1">
                {lots.map(l => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => handleQrDetected(l.code)}
                    className="min-h-[44px] flex items-center justify-between p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 hover:border-indigo-500 transition-all text-left group cursor-pointer"
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
                      Pilih Label &rarr;
                    </span>
                  </button>
                ))}
              </div>

              <div className="pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={closeQrModal}
                  className="w-full min-h-[40px] py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition-colors text-center cursor-pointer"
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
                Izin PIN Pemilik
              </h4>
              <button
                onClick={() => {
                  setPinError(null);
                  setShowPinModal(false);
                }}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-600">
                Batas tagihan tempo pelanggan ini sudah penuh. Masukkan 6 digit PIN pemilik untuk memberi izin transaksi:
              </p>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                placeholder="Masukkan 6 digit PIN"
                value={ownerPin}
                onChange={e => {
                  setOwnerPin(e.target.value.replace(/\D/g, '').slice(0, 6));
                  if (pinError) setPinError(null);
                }}
                className="w-full b2b-input text-center text-lg font-mono tracking-widest"
              />
              {pinError && (
                <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-medium">
                  {pinError}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setPinError(null);
                  setOwnerPin('');
                  setShowPinModal(false);
                }}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  const guard = checkPinAttemptGuard();
                  if (!guard.allowed) {
                    setPinError(`Terlalu banyak percobaan PIN salah. Tunggu ${guard.remainingSeconds} detik sebelum mencoba lagi.`);
                    return;
                  }
                  const pinValid = verifyOwnerPin(latestEngineStateRef.current, ownerPin);
                  const outcome = recordPinAttemptOutcome(pinValid);
                  if (pinValid) {
                    setIsOwnerApproved(true);
                    setPinError(null);
                    setPinFailedAttempts(0);
                    setOwnerPin('');
                    setShowPinModal(false);
                    triggerNotification('Izin Pemilik Disetujui', 'Transaksi tempo diizinkan untuk sekali checkout ini.', 'success');
                  } else {
                    const nextFail = outcome.failedAttempts || pinFailedAttempts + 1;
                    setPinFailedAttempts(nextFail);
                    setPinError(
                      outcome.locked
                        ? `PIN Pemilik salah (${nextFail}x). Akses PIN dikunci sementara ${outcome.remainingSeconds} detik.`
                        : nextFail >= 3
                        ? `PIN Pemilik salah (${nextFail}x). Hubungi pemilik usaha untuk verifikasi PIN resmi.`
                        : 'PIN Pemilik salah. Masukkan 6 digit PIN otorisasi pemilik.'
                    );
                  }
                }}
                className="px-4 py-1.5 rounded-lg bg-slate-900 text-xs font-bold text-white cursor-pointer"
              >
                Setujui Izin
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
                  const unitPrice = item.effectivePricePerKg ?? item.product?.basePricePerKg ?? 0;
                  const itemName = item.productName ?? item.product?.name ?? 'Produk';
                  const lineTotal = item.lineTotalRupiah ?? Math.round((item.weightGram * unitPrice) / 1000);
                  return (
                    <div key={i} className="flex justify-between">
                      <div className="truncate max-w-[180px]">
                        {itemName}
                        <div className="text-[10px] text-slate-500">{(item.weightGram / 1000).toFixed(2)} kg @ Rp {unitPrice.toLocaleString('id-ID')}</div>
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
                {(lastIssuedInvoice.discountRupiah ?? 0) > 0 && (
                  <div className="flex justify-between text-amber-700">
                    <span>Diskon:</span>
                    <span>-Rp {lastIssuedInvoice.discountRupiah.toLocaleString('id-ID')}</span>
                  </div>
                )}
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
        onRecordOpexSuccess={(newVoucher, _newBalance) => {
          const res = recordPettyCashOpex(
            latestEngineStateRef.current,
            {
              voucherNo: newVoucher.voucherNo,
              categoryLabel: newVoucher.categoryLabel,
              desc: newVoucher.description || newVoucher.recipient || 'Biaya operasional toko',
              amountRupiah: newVoucher.amountRupiah,
            },
            'Kasir Toko',
            isOnline
          );
          commitEngineResultState(res.state);
          triggerNotification(
            'Biaya Toko Dicatat',
            res.message,
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
        onAddNewSupplier={(newSup, contactPhone) => {
          const res = addSupplierRecord(latestEngineStateRef.current, newSup, contactPhone);
          if (!res.ok) {
            triggerNotification('Gagal Menambah Supplier', res.message, 'warning');
            return;
          }
          commitEngineResultState(res.state);
          if (contactPhone) {
            const nextPhones = res.state.supplierPhones ?? {};
            try {
              localStorage.setItem('karkasia_supplier_phones', JSON.stringify(nextPhones));
            } catch {
              // ignore storage errors
            }
            void idbSetPreference('supplier_phones', nextPhones);
          }
          triggerNotification('Supplier Baru Terdaftar', `${newSup} berhasil ditambahkan ke daftar pemasok`, 'success');
        }}
        availableProducts={products as any}
        availableCategories={categories}
        onAddNewProductCut={(newCut) => {
          const created: ProductEntity = {
            id: `PROD_${Date.now()}`,
            sku: newCut.sku,
            name: newCut.name,
            category: newCut.category,
            basePricePerKg: newCut.basePricePerKg,
            movingAvgHppPerKg: Math.round(newCut.basePricePerKg * 0.72),
            tierPrices: {
              RETAIL: newCut.basePricePerKg,
              HOREKA: Math.round(newCut.basePricePerKg * 0.9),
              VIP: Math.round(newCut.basePricePerKg * 0.82),
            },
            stockGram: 0,
            safetyStockGram: 20000,
            tag: 'Produk Baru',
            alternativeId: 'PROD_02',
            alternativeName: 'Sirloin Choice USA (Primal)',
            alternativeReason: 'Pilihan potongan daging alternatif',
          };
          setProducts((prev: ProductEntity[]) => [created, ...prev]);
          triggerNotification('Produk Daging Terdaftar', `${newCut.name} otomatis ditambahkan ke katalog toko`, 'success');
        }}
        onClose={() => {
          setShowCreatePOModal(false);
          setPoInitialData(null);
        }}
        onCreatePOSuccess={(newPO) => {
          setPoInitialData(null);
          const newInv: SupplierInvoice = {
            id: `SUP_INV_${Date.now()}`,
            invoiceNumber: `INV-SUP-${newPO.poNumber.slice(3)}`,
            poNumber: newPO.poNumber,
            supplier: newPO.supplier,
            supplierPhone: supplierPhones[newPO.supplier] || '',
            originCountry: newPO.supplier.includes('Australia') ? 'Australia' : newPO.supplier.includes('USA') ? 'USA' : 'Impor',
            totalAmountRupiah: newPO.totalRupiah,
            paidAmountRupiah: newPO.paymentTerm === 'CASH' ? newPO.totalRupiah : 0,
            remainingAmountRupiah: newPO.paymentTerm === 'CASH' ? 0 : newPO.totalRupiah,
            dueDate: newPO.invoiceDueDate,
            daysDiff: 30,
            status: newPO.paymentTerm === 'CASH' ? 'LUNAS' : 'BELUM_LUNAS',
          };
          updateEngineAndPersist((prev) => ({
            ...prev,
            inboundPOs: [newPO, ...prev.inboundPOs],
            supplierInvoices: [newInv, ...prev.supplierInvoices],
          }));
          triggerNotification(
            'Pesanan Pembelian Diterbitkan',
            `${newPO.poNumber} untuk kontainer ${newPO.container} telah dicatat`,
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
        supplierPhone={
          selectedSupplierInvoice
            ? selectedSupplierInvoice.supplierPhone || supplierPhones[selectedSupplierInvoice.supplier] || ''
            : ''
        }
        onPaymentSuccess={(invoiceId, amountPaid, _newRemaining) => {
          const res = recordSupplierPayablePayment(latestEngineStateRef.current, invoiceId, amountPaid, 'Admin Keuangan', isOnline);
          commitEngineResultState(res.state);
          triggerNotification(
            res.ok ? 'Pembayaran ke Supplier Dicatat' : 'Gagal Mencatat Pembayaran',
            res.message,
            res.ok ? 'success' : 'warning',
            res.ok ? amountPaid : undefined
          );
        }}
      />

      {/* =========================================================================
          MODAL QUICK ACTION: MASTER KELOLA HARGA JUAL DAGING (SEAMLESS PRICE EDITOR)
          ========================================================================= */}
      <QuickPriceManagerModal
        isOpen={showPriceManagerModal}
        targetProductId={priceManagerTargetId}
        products={products as any}
        onClose={() => {
          setShowPriceManagerModal(false);
          setPriceManagerTargetId(null);
        }}
        onSavePrices={(updated) => {
          setProducts((prev: ProductEntity[]) =>
            prev.map(p => {
              const match = updated.find(u => u.id === p.id);
              return match ? { ...p, ...match } : p;
            })
          );
          triggerNotification('Daftar Harga Disimpan', `${updated.length} harga produk berhasil diperbarui`, 'success');
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
          triggerNotification('Pelanggan Baru Terdaftar', `${newCust.name} (${newCust.code}) langsung aktif di kasir`, 'success');
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
          const res = addProductWithOpeningLot(latestEngineStateRef.current, newProd, 'Admin Toko', isOnline);
          if (!res.ok) {
            triggerNotification('Produk Gagal Ditambahkan', res.message, 'warning');
            return;
          }
          commitEngineResultState(res.state);
          triggerNotification('Produk Baru Ditambahkan', res.message, 'success');
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
          const res = toggleBazarPromo(latestEngineStateRef.current, promoId);
          commitEngineResultState(res.state);
        }}
        onCreatePromo={(newPromo) => {
          const res = createBazarPromo(latestEngineStateRef.current, newPromo);
          commitEngineResultState(res.state);
          triggerNotification(
            'Promo Bazar Diaktifkan',
            `${newPromo.title} untuk ${newPromo.productName} telah aktif di kasir`,
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
        customers={customers as any}
        receivables={receivables}
        initialSelectedCustomerId={selectedDashboardCustomerId}
        onUpdateCustomer={handleUpdateCustomer}
        onAddNewCustomerClick={() => {
          setShowCustomerDashboardModal(false);
          setShowQuickAddCustomerModal(true);
        }}
        onRecordPayment={(recId) => {
          const target = receivables.find(r => r.id === recId);
          const res = recordCustomerReceivablePayment(latestEngineStateRef.current, recId, 'Kasir Toko', isOnline);
          commitEngineResultState(res.state);
          triggerNotification(
            res.ok ? 'Pelunasan Dicatat' : 'Gagal Mencatat',
            res.message,
            res.ok ? 'success' : 'warning',
            res.ok ? target?.amount : undefined
          );
        }}
      />

      {/* =========================================================================
          MODAL: GENERATOR QR CODE & LABEL BATCH KARTON DAGING (MOD-03 & MOD-07)
          ========================================================================= */}
      <LotQrCodeModal
        isOpen={showLotQrModal}
        onClose={() => {
          setShowLotQrModal(false);
          setSelectedLotForQr(null);
        }}
        lot={selectedLotForQr}
        onSimulateScan={(code) => {
          setShowLotQrModal(false);
          handleQrDetected(code);
        }}
      />

      {/* =========================================================================
          MODAL: PROMPT KONFIRMASI / PERPINDAHAN LOKASI RAK COLD STORAGE
          ========================================================================= */}
      <ShelfLocationPromptModal
        isOpen={showShelfLocationPromptModal}
        onClose={() => {
          setShowShelfLocationPromptModal(false);
          setScannedLotForLocationPrompt(null);
        }}
        lot={scannedLotForLocationPrompt}
        onConfirmLocation={handleConfirmLocation}
      />

      {/* =========================================================================
          MODAL: EDIT & UPLOAD FOTO PRODUK DAGING
          ========================================================================= */}
      <EditProductPhotoModal
        isOpen={!!editingPhotoProduct}
        product={editingPhotoProduct}
        onClose={() => setEditingPhotoProduct(null)}
        onSavePhoto={handleSaveProductPhoto}
      />

      {/* =========================================================================
          MODAL: CAROUSEL GALERI & MULTI-SUDUT FOTO PRODUK DAGING IMPORT
          ========================================================================= */}
      <ProductGalleryModal
        isOpen={!!viewingGalleryProduct}
        product={viewingGalleryProduct}
        onClose={() => setViewingGalleryProduct(null)}
        customerTier={customer.tier}
        onAddToCart={(prod, weightGram) => {
          handleAddToCart(prod, weightGram);
        }}
        onUpdateGallery={handleUpdateProductGallery}
      />

      {/* =========================================================================
          MODAL: BULK QR SCANNER & CONTINUOUS STOCK OPNAME
          ========================================================================= */}
      <BulkQrScanModal
        isOpen={showBulkQrModal}
        onClose={() => setShowBulkQrModal(false)}
        availableLots={lots}
        onCommitBulkOpname={handleCommitBulkOpname}
      />

      {/* =========================================================================
          MODAL: QUICK WEIGH SHEET (BLUETOOTH DIGITAL SCALE WEIGHING)
          ========================================================================= */}
      <QuickWeighSheet
        isOpen={!!weighingProduct}
        product={weighingProduct}
        onClose={() => setWeighingProduct(null)}
        customerTier={customer.tier}
        onAddToCart={(prod, weightGram) => {
          handleAddToCart(prod, weightGram);
          triggerNotification(
            'Hasil Penimbangan Masuk Keranjang! ⚖️',
            `${prod.name} (${(weightGram/1000).toFixed(3)} KG) berhasil ditambahkan ke keranjang POS.`,
            'success'
          );
        }}
      />



    </div>
  );
}
