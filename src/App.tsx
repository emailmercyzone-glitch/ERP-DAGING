import React, { useState, useEffect } from 'react';
import { 
  Database, 
  ShieldCheck, 
  Layers, 
  FileCode, 
  Cpu, 
  CheckCircle2, 
  AlertTriangle, 
  Scale, 
  Banknote, 
  FolderTree, 
  Flame,
  Search,
  BookOpen,
  ShoppingCart,
  UserCheck,
  Wallet,
  Lock,
  Plus,
  Minus,
  Trash2,
  Truck,
  FileCheck,
  AlertOctagon,
  Printer,
  X,
  RefreshCw,
  Box,
  Split,
  History,
  Activity,
  ArrowRight,
  Cloud,
  CloudUpload,
  ArrowDownUp,
  Server,
  Key,
  FileText,
  Download,
  Bluetooth,
  FileSpreadsheet,
  RotateCcw,
  Receipt,
  Percent,
  TrendingUp,
  Camera,
  Archive,
  Droplet,
  Mic,
  MicOff,
  Sparkles,
  Bot,
  Send,
  Volume2,
  Play,
  Square,
  ChevronRight,
  ChevronDown,
  Bell,
  SlidersHorizontal,
  CreditCard,
  Building2,
  Calendar,
  Check,
  Zap,
  Tag
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
  Cell, 
  Legend 
} from 'recharts';
import { exportFinancialReportPdf, exportJournalReportPdf } from './utils/pdfExport';

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
    imageBg: 'from-rose-950 to-red-900',
    iconColor: 'text-rose-400',
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
    imageBg: 'from-amber-950 to-orange-900',
    iconColor: 'text-amber-400',
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
    imageBg: 'from-emerald-950 to-teal-900',
    iconColor: 'text-emerald-400',
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
    imageBg: 'from-purple-950 to-violet-900',
    iconColor: 'text-purple-400',
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
    imageBg: 'from-sky-950 to-blue-900',
    iconColor: 'text-sky-400',
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

// Data Grafik Recharts untuk Tab Laporan
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
  { name: 'Primal Cut (Ribeye/Sirloin/Tender)', category: 'PRIMAL', value: 35640000, weightKg: 148.5, percentage: '58.5%', color: '#e11d48' },
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
  const [personaMode, setPersonaMode] = useState<'SALES_KILAT' | 'PRO_ERP'>('SALES_KILAT');
  const [productCategoryFilter, setProductCategoryFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Interactive Gopay/Tokopedia-style Toast Notification
  const [activeToast, setActiveToast] = useState<ToastMessage | null>({
    id: 'INIT',
    title: 'Sistem ERP Daging Sampora Siap',
    desc: 'Database SQLite Lokal Aktif • Mode Qasir Pro Cepat & Ringkas',
    type: 'success'
  });

  const triggerNotification = (title: string, desc: string, type: 'success' | 'warning' | 'info' = 'success', amount?: number) => {
    const newToast: ToastMessage = { id: `T_${Date.now()}`, title, desc, type, amount };
    setActiveToast(newToast);
    setTimeout(() => {
      setActiveToast((prev) => (prev?.id === newToast.id ? null : prev));
    }, 4500);
  };

  // ===================== POS & CHECKOUT STATE (Qasir Pro DNA) =====================
  const [selectedCustomerId, setSelectedCustomerId] = useState('CUST_02');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'TRANSFER' | 'TEMPO'>('TEMPO');
  const [cashTendered, setCashTendered] = useState<number>(1000000);
  const [isFreeShipping, setIsFreeShipping] = useState(true);
  const [shippingFee, setShippingFee] = useState(25000);
  const [isOwnerApproved, setIsOwnerApproved] = useState(false);
  const [ownerPinInput, setOwnerPinInput] = useState('');
  const [showCheckoutSheet, setShowCheckoutSheet] = useState(false);
  const [showThermalReceipt, setShowThermalReceipt] = useState(false);
  const [lastIssuedInvoice, setLastIssuedInvoice] = useState<any>(null);

  const [cart, setCart] = useState<CartItemState[]>([
    { product: SAMPLE_PRODUCTS[0], weightGram: 2000, pcs: 2 }, // 2.0 kg Ribeye
    { product: SAMPLE_PRODUCTS[2], weightGram: 3000, pcs: 1 }, // 3.0 kg Tetelan
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
      alert(`Plafon Kredit Terlampaui! Batas utang: Rp ${customer.creditLimit.toLocaleString('id-ID')}. Butuh PIN Owner untuk override.`);
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
    setShowCheckoutSheet(false);
    setShowThermalReceipt(true);

    // Update Cash-in-hand if cash
    if (paymentMethod === 'CASH') {
      setCashInHand(prev => prev + grandTotalRupiah);
    }

    // Trigger Tokopedia/GoPay style success toast
    triggerNotification(
      'Pembayaran Berhasil! 🥩',
      `Faktur ${invoiceNumber} • ${customer.name}`,
      'success',
      grandTotalRupiah
    );
  };

  // ===================== WAREHOUSE, LOTS & FEFO (MOD-07 & MOD-07B) =====================
  const [lots, setLots] = useState([
    { id: 'LOT_01', code: 'LOT-AUS-261015-01', product: 'Ribeye Meltique AUS (Primal)', daysLeft: 13, expiryDate: '2026-11-15', currentKg: 48.5, hppKg: 180000, loc: 'FREEZER-A-01', isFefo: true, isQuarantined: false },
    { id: 'LOT_02', code: 'LOT-USA-261028-02', product: 'Sirloin Choice USA (Primal)', daysLeft: 29, expiryDate: '2026-12-01', currentKg: 82.0, hppKg: 165000, loc: 'FREEZER-A-02', isFefo: false, isQuarantined: false },
    { id: 'LOT_03', code: 'LOT-TET-261030-01', product: 'Tetelan Rawon Super (Konversi)', daysLeft: 18, expiryDate: '2026-11-20', currentKg: 24.0, hppKg: 65000, loc: 'FREEZER-B-01', isFefo: false, isQuarantined: false },
    { id: 'LOT_04', code: 'LOT-TND-261020-01', product: 'Tenderloin Grassfed Australia', daysLeft: 22, expiryDate: '2026-11-24', currentKg: 18.0, hppKg: 220000, loc: 'FREEZER-A-03', isFefo: false, isQuarantined: false },
  ]);

  // Conversion Trimming Modal
  const [showConversionModal, setShowConversionModal] = useState(false);
  const [conversionKg, setConversionKg] = useState(10);
  const [conversionYield, setConversionYield] = useState(85);

  const handleCommitConversion = () => {
    const targetLot = lots[0];
    if (targetLot.currentKg < conversionKg) {
      alert('Stok lot tidak mencukupi untuk dipotong!');
      return;
    }
    const tetelanKg = (conversionKg * conversionYield) / 100;
    const lossKg = conversionKg - tetelanKg;

    setLots(lots.map(l => {
      if (l.id === targetLot.id) {
        return { ...l, currentKg: l.currentKg - conversionKg };
      }
      if (l.id === 'LOT_03') {
        return { ...l, currentKg: l.currentKg + tetelanKg };
      }
      return l;
    }));

    setShowConversionModal(false);
    triggerNotification(
      'Konversi Trimming Berhasil! 🔪',
      `Hasil: +${tetelanKg.toFixed(2)} KG Tetelan • Susut: ${lossKg.toFixed(2)} KG`,
      'success'
    );
  };

  // Stock Opname & Drip Loss
  const [selectedLotOpname, setSelectedLotOpname] = useState('LOT_01');
  const [physicalWeightKg, setPhysicalWeightKg] = useState(47.8);
  const [opnameReason, setOpnameReason] = useState('DRIP_LOSS_THAWING');

  const handleCommitOpname = () => {
    const targetLot = lots.find(l => l.id === selectedLotOpname)!;
    const diffKg = physicalWeightKg - targetLot.currentKg;
    setLots(lots.map(l => l.id === selectedLotOpname ? { ...l, currentKg: physicalWeightKg } : l));
    const movement = diffKg < 0 ? (opnameReason === 'DRIP_LOSS_THAWING' ? 'OUT_DRIP_LOSS' : 'ADJ_OPNAME_MINUS') : 'ADJ_OPNAME_PLUS';
    triggerNotification(
      'Opname & Drip Loss Dicatat ❄️',
      `Mutasi ${movement}: ${Math.abs(diffKg).toFixed(2)} KG dicatat ke stock_ledger`,
      diffKg < 0 ? 'warning' : 'info'
    );
  };

  // ===================== KAS, OPEX & FINANCIALS (MOD-11, 12, 13) =====================
  const [cashInHand, setCashInHand] = useState(3850000);
  const softLimit = 3000000;
  const isSoftLimitExceeded = cashInHand >= softLimit;

  const [opexList, setOpexList] = useState([
    { id: 'OP_01', voucher: 'OPEX-261102-001', category: 'ES_PACKING', desc: 'Es Balok 10 Batang untuk Cold Chain', amount: 120000, time: '08:30' },
    { id: 'OP_02', voucher: 'OPEX-261102-002', category: 'PLASTIK_VAKUM', desc: 'Plastik Vakum Roll Emboss Tebal 100pcs', amount: 85000, time: '10:15' },
    { id: 'OP_03', voucher: 'OPEX-261102-003', category: 'BENSIN_PENGIRIMAN', desc: 'Bensin Motor Kurir Kirim Resto Serang', amount: 45000, time: '13:00' },
  ]);
  const [newOpexCategory, setNewOpexCategory] = useState('ES_PACKING');
  const [newOpexDesc, setNewOpexDesc] = useState('');
  const [newOpexAmount, setNewOpexAmount] = useState(50000);

  const handleAddOpex = () => {
    if (!newOpexDesc || newOpexAmount <= 0) {
      alert('Deskripsi dan nominal wajib diisi!');
      return;
    }
    const newEntry = {
      id: `OP_${Date.now()}`,
      voucher: `OPEX-261102-${String(Math.floor(Math.random() * 800) + 100).padStart(3, '0')}`,
      category: newOpexCategory,
      desc: newOpexDesc,
      amount: newOpexAmount,
      time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
    };
    setOpexList([newEntry, ...opexList]);
    setNewOpexDesc('');
    setNewOpexAmount(50000);
    triggerNotification('Biaya OPEX Dicatat', `Voucher ${newEntry.voucher} (-Rp ${newEntry.amount.toLocaleString('id-ID')})`, 'info');
  };

  // Micro-Hierarchy Financials
  const totalGrossRevenue = 18500000; // Omzet riil berjalan
  const totalCogs = 13800000; // HPP daging riil
  const grossProfit = totalGrossRevenue - totalCogs;
  const totalOpex = opexList.reduce((acc, curr) => acc + curr.amount, 0);
  const netOperatingProfit = grossProfit - totalOpex;
  const estimatedUmkmTax = Math.round((totalGrossRevenue * 5) / 1000); // PP 23/2018 0.5%
  const netProfitAfterTax = netOperatingProfit - estimatedUmkmTax;

  // Total Nilai Aset Persediaan Daging Berjalan (Inventory Asset Value at Landed Cost / HPP)
  const totalInventoryKg = lots.reduce((acc, curr) => acc + curr.currentKg, 0);
  const totalInventoryAssetHpp = lots.reduce((acc, curr) => acc + Math.round(curr.currentKg * curr.hppKg), 0);
  const avgInventoryHppPerKg = totalInventoryKg > 0 ? Math.round(totalInventoryAssetHpp / totalInventoryKg) : 0;
  const criticalExpiryLots = lots.filter(l => l.daysLeft <= 14);
  const criticalExpiryKg = criticalExpiryLots.reduce((acc, curr) => acc + curr.currentKg, 0);
  const criticalExpiryValueHpp = criticalExpiryLots.reduce((acc, curr) => acc + Math.round(curr.currentKg * curr.hppKg), 0);

  // ===================== FASE 3 AI: GEMINI ADVISOR & VOICE PARSER =====================
  const [aiAdvisorLoading, setAiAdvisorLoading] = useState(false);
  const [aiAdvisorData, setAiAdvisorData] = useState<any>(null);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [voiceSeconds, setVoiceSeconds] = useState(4);
  const [voiceTranscript, setVoiceTranscript] = useState('Halo Ndoro, tolong siapkan orderan Steakhouse Banten Prima, Ribeye 2 kilo sama Tetelan 3 kilo, bayar tempo seminggu ya! Kirim besok sore.');
  const [isParsingVoice, setIsParsingVoice] = useState(false);
  const [voiceParsedResult, setVoiceParsedResult] = useState<any>(null);

  const handleToggleRecordVoice = () => {
    if (isRecordingVoice) {
      setIsRecordingVoice(false);
    } else {
      setIsRecordingVoice(true);
      setVoiceSeconds(1);
      let count = 0;
      const interval = setInterval(() => {
        count += 1;
        setVoiceSeconds(count);
        if (count >= 3) {
          clearInterval(interval);
          setIsRecordingVoice(false);
          setVoiceTranscript('Halo Ndoro, tolong siapkan orderan Steakhouse Banten Prima, Ribeye 2 kilo sama Tetelan 3 kilo, bayar tempo seminggu ya! Kirim besok sore.');
          triggerNotification('Suara Berhasil Direkam 🎙️', 'Transkrip suara siap diekstrak oleh Gemini AI', 'info');
        }
      }, 700);
    }
  };

  const handleFetchAiAdvisor = async () => {
    setAiAdvisorLoading(true);
    try {
      const res = await fetch('/api/ai/advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          healthScore: 92,
          totalSalesToday: totalGrossRevenue,
          cashInHand: cashInHand,
          cashSoftLimit: softLimit,
          overdueReceivables: 12000000,
          lotsNearingExpiry: lots.filter(l => l.daysLeft <= 14).map(l => ({
            lotCode: l.code,
            product: l.product,
            weightKg: l.currentKg,
            daysLeft: l.daysLeft,
            landedCostPerKg: l.hppKg,
          })),
          pendingConflicts: 0,
          opexToday: totalOpex,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setAiAdvisorData(data.data);
        triggerNotification('Audit AI Selesai 🤖', 'Rekomendasi eksekutif Gemini 3.8 Flash diperbarui', 'success');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setAiAdvisorLoading(false);
    }
  };

  const handleParseVoiceOrder = async (overrideText?: string) => {
    const textToParse = overrideText || voiceTranscript;
    setIsParsingVoice(true);
    try {
      const res = await fetch('/api/ai/voice-parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: textToParse }),
      });
      const data = await res.json();
      if (data.success) {
        setVoiceParsedResult(data.data);
        triggerNotification('Pesanan Suara Berhasil Diekstrak! ⚡', `${data.data.customerName} • ${data.data.items?.length} Item`, 'success');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsParsingVoice(false);
    }
  };

  const handleApplyVoiceOrderToCart = (parsed: any) => {
    const foundCustomer = SAMPLE_CUSTOMERS.find(c => 
      c.name.toLowerCase().includes(parsed.customerName.toLowerCase()) ||
      parsed.customerName.toLowerCase().includes(c.name.toLowerCase())
    );
    if (foundCustomer) {
      setSelectedCustomerId(foundCustomer.id);
    }
    
    if (parsed.paymentMethod === 'TEMPO') setPaymentMethod('TEMPO');
    else if (parsed.paymentMethod === 'TRANSFER') setPaymentMethod('TRANSFER');
    else setPaymentMethod('CASH');

    const newCartItems: CartItemState[] = (parsed.items || []).map((it: any) => {
      const matchedProd = SAMPLE_PRODUCTS.find(p => p.sku === it.productSku) || SAMPLE_PRODUCTS[0];
      return {
        product: matchedProd,
        weightGram: it.weightGram || 1000,
        pcs: it.quantityPcs || 1,
      };
    });

    if (newCartItems.length > 0) {
      setCart(newCartItems);
    }

    triggerNotification(
      'Keranjang Terisi dari Suara! 🛒',
      `${parsed.customerName} • ${newCartItems.length} Produk Daging dimasukkan`,
      'success'
    );
    setActiveTab('pos');
  };

  // Handlers Ekspor PDF
  const handleExportFinancialPdf = () => {
    try {
      exportFinancialReportPdf({
        totalGrossRevenue,
        totalCogs,
        grossProfit,
        totalOpex,
        netOperatingProfit,
        estimatedUmkmTax,
        netProfitAfterTax,
        opexList,
        dailySales: DAILY_SALES_7_DAYS,
        totalInventoryAssetHpp,
        totalInventoryKg,
      });
      triggerNotification('PDF Berhasil Diunduh 📄', 'Laporan Laba Rugi & Pajak PP 23 siap dicetak', 'success');
    } catch (e) {
      console.error(e);
      alert('Gagal mengekspor PDF laporan');
    }
  };

  const handleExportJournalPdf = () => {
    try {
      exportJournalReportPdf(32300000, 32300000);
      triggerNotification('PDF Berhasil Diunduh 📄', 'Buku Jurnal Umum Double-Entry siap dicetak', 'success');
    } catch (e) {
      console.error(e);
      alert('Gagal mengekspor PDF jurnal');
    }
  };

  // Filtered Products
  const filteredProducts = SAMPLE_PRODUCTS.filter(p => {
    const matchCategory = productCategoryFilter === 'ALL' || p.category === productCategoryFilter;
    const matchSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.sku.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCategory && matchSearch;
  });

  // Proactive Safety Stock Alert List (Triggered when stockGram <= safetyStockGram)
  const lowStockProducts = SAMPLE_PRODUCTS.filter(p => p.stockGram <= p.safetyStockGram);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-rose-900 selection:text-white pb-24 md:pb-8">
      
      {/* =========================================================================
          GOPAY / TOKOPEDIA FLOATING TOAST NOTIFICATION (Interactive Audio/Visual DNA)
          ========================================================================= */}
      {activeToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4 transition-all duration-300">
          <div className="bg-slate-900/95 border border-slate-700/80 shadow-2xl shadow-black/80 rounded-2xl p-3.5 backdrop-blur-md flex items-center justify-between gap-3 animate-in slide-in-from-top-4">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                activeToast.type === 'success' 
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                  : activeToast.type === 'warning'
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
              }`}>
                {activeToast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
              </div>
              <div>
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  {activeToast.title}
                  {activeToast.amount && (
                    <span className="text-emerald-400 font-mono">
                      +Rp {activeToast.amount.toLocaleString('id-ID')}
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">{activeToast.desc}</div>
              </div>
            </div>
            <button
              onClick={() => setActiveToast(null)}
              className="text-slate-500 hover:text-slate-300 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          TOP WALLET & STATUS BAR (GOPAY DNA: Ringkas, Informatif, Saldo Riil)
          ========================================================================= */}
      <header className="border-b border-slate-800 bg-slate-900/95 sticky top-0 z-40 px-4 md:px-8 py-2.5 backdrop-blur">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          
          {/* Logo & Toko Sampora Header */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-600 to-rose-900 flex items-center justify-center shadow-md shadow-red-950/60 border border-red-500/30 shrink-0">
              <Flame className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm text-white tracking-tight">SAMPORA MEAT ERP</span>
                <span className="text-[10px] text-slate-400 font-mono bg-slate-800 px-1.5 py-0.5 rounded">
                  TOKO_SAMPORA_01
                </span>
              </div>
              <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <span>Cold Chain Banten</span>
                <span>•</span>
                <span className="text-emerald-400 font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Offline First
                </span>
              </div>
            </div>
          </div>

          {/* Quick Wallet Bar (GoPay DNA) */}
          <div className="flex items-center gap-2 overflow-x-auto py-1">
            
            {/* Kas Sales Lapangan */}
            <div className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 text-xs font-mono transition-colors ${
              isSoftLimitExceeded 
                ? 'bg-amber-950/40 border-amber-600/50 text-amber-200' 
                : 'bg-slate-950/80 border-slate-800 text-slate-300'
            }`}>
              <Wallet className="w-3.5 h-3.5 text-amber-400" />
              <div>
                <span className="text-[9px] text-slate-400 block font-sans uppercase">Kas di Sales</span>
                <span className="font-bold">Rp {cashInHand.toLocaleString('id-ID')}</span>
              </div>
              {isSoftLimitExceeded && (
                <span className="text-[9px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded font-sans font-bold">
                  &gt;3Jt
                </span>
              )}
            </div>

            {/* Health Score Toko */}
            <div className="px-3 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center gap-2 text-xs font-mono text-slate-300">
              <Activity className="w-3.5 h-3.5 text-rose-500" />
              <div>
                <span className="text-[9px] text-slate-400 block font-sans uppercase">Health Score</span>
                <span className="font-bold text-emerald-400">92/100 (PRIMA)</span>
              </div>
            </div>

            {/* Aset Persediaan Daging (HPP) */}
            <div className="px-3 py-1.5 rounded-xl bg-slate-950/80 border border-cyan-900/60 flex items-center gap-2 text-xs font-mono text-slate-300">
              <Box className="w-3.5 h-3.5 text-cyan-400" />
              <div>
                <span className="text-[9px] text-slate-400 block font-sans uppercase">Aset Daging (HPP)</span>
                <span className="font-bold text-cyan-300">Rp {(totalInventoryAssetHpp / 1000000).toFixed(2)} Jt</span>
              </div>
            </div>

            {/* Persona Switcher (Bisa Diajak Profesional, Bisa Dijadikan Simpel Sales) */}
            <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-medium">
              <button
                onClick={() => {
                  setPersonaMode('SALES_KILAT');
                  triggerNotification('Mode Sales Aktif ⚡', 'Tampilan Qasir Pro ringkas & cepat untuk jualan lapangan', 'info');
                }}
                className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 ${
                  personaMode === 'SALES_KILAT'
                    ? 'bg-rose-600 text-white font-bold shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Zap className="w-3 h-3" />
                Sales Kilat
              </button>
              <button
                onClick={() => {
                  setPersonaMode('PRO_ERP');
                  triggerNotification('Mode Pro ERP Aktif 📑', 'Audit trail, jurnal akuntansi, & pajak PP 23 lengkap', 'info');
                }}
                className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 ${
                  personaMode === 'PRO_ERP'
                    ? 'bg-purple-600 text-white font-bold shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Building2 className="w-3 h-3" />
                Pro ERP
              </button>
            </div>

          </div>

        </div>
      </header>

      {/* =========================================================================
          DESKTOP & TABLET NAVIGATION TABS (Qasir Pro & Tokopedia Desktop Bar)
          ========================================================================= */}
      <nav className="border-b border-slate-800/80 bg-slate-900/60 px-4 md:px-8 py-2 overflow-x-auto">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-1 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('pos')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors ${
                activeTab === 'pos' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              Kasir &amp; POS (Qasir Pro)
            </button>
            <button
              onClick={() => setActiveTab('warehouse')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors ${
                activeTab === 'warehouse' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Box className="w-3.5 h-3.5" />
              Stok &amp; FEFO Gudang
            </button>
            <button
              onClick={() => setActiveTab('reports')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors ${
                activeTab === 'reports' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              Laporan &amp; Pajak 0.5% (Micro Hash)
            </button>
            <button
              onClick={() => setActiveTab('journals')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors ${
                activeTab === 'journals' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              Jurnal &amp; Buku Besar
            </button>
            <button
              onClick={() => setActiveTab('owner_ai')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors ${
                activeTab === 'owner_ai' ? 'bg-gradient-to-r from-purple-600 to-rose-600 text-white shadow-sm' : 'text-purple-300 hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              Owner Copilot (Gemini AI)
            </button>
          </div>

          <div className="hidden lg:flex items-center gap-3 text-xs text-slate-400">
            <span className="font-mono">Device: HP03 (Sales Banten 1)</span>
            <span>•</span>
            <span className="text-rose-400 font-mono font-bold">INV-HP03-261102-0042</span>
          </div>
        </div>
      </nav>

      {/* =========================================================================
          MAIN CONTAINER
          ========================================================================= */}
      <main className="max-w-7xl mx-auto w-full p-4 md:p-6 flex-1 space-y-6">

        {/* =====================================================================
            TAB 1: KASIR & POS (QASIR PRO DNA: CEPAT, RINGKAS, TOUCH-FRIENDLY)
            ===================================================================== */}
        {activeTab === 'pos' && (
          <div className="space-y-4">
            
            {/* Quick Customer & Voice Note Assistant Banner */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
              
              {/* Selected Customer Card */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center text-rose-400 shrink-0">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Pelanggan Aktif:</span>
                    <select
                      value={selectedCustomerId}
                      onChange={(e) => setSelectedCustomerId(e.target.value)}
                      className="bg-slate-950 border border-slate-700 text-white text-xs font-bold rounded-lg px-2.5 py-1 focus:outline-none"
                    >
                      {SAMPLE_CUSTOMERS.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.tier}) - Limit Rp {c.creditLimit.toLocaleString('id-ID')}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-2">
                    <span>Piutang Berjalan: <strong className="text-white">Rp {customer.currentReceivable.toLocaleString('id-ID')}</strong></span>
                    <span>•</span>
                    <span>Tempo: <strong className="text-emerald-400">{customer.termDays} Hari</strong></span>
                  </div>
                </div>
              </div>

              {/* MOD-21 Voice Note Quick Button */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleToggleRecordVoice}
                  className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                    isRecordingVoice
                      ? 'bg-red-600 text-white animate-pulse shadow-lg shadow-red-900/50'
                      : 'bg-gradient-to-r from-purple-600 to-rose-600 hover:from-purple-500 text-white shadow'
                  }`}
                  title="Klik untuk rekam suara sales"
                >
                  {isRecordingVoice ? <Square className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                  <span>{isRecordingVoice ? `Merekam (${voiceSeconds}s)...` : 'Voice Note Pesanan'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleParseVoiceOrder()}
                  disabled={isParsingVoice}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-purple-300 text-xs font-semibold rounded-xl border border-purple-800/40 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                  <span>{isParsingVoice ? 'Gemini Parsing...' : 'AI Parse Order'}</span>
                </button>
              </div>

            </div>

            {/* Voice Parsed Success Card */}
            {voiceParsedResult && (
              <div className="bg-emerald-950/40 border border-emerald-500/50 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <div>
                    <span className="font-bold text-white">Pesanan Suara Sales Terdeteksi: </span>
                    <span className="text-emerald-300">
                      {voiceParsedResult.customerName} • {voiceParsedResult.paymentMethod} ({voiceParsedResult.tempoDays} Hari) • {voiceParsedResult.items?.length || 0} Item
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleApplyVoiceOrderToCart(voiceParsedResult)}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow cursor-pointer transition-colors"
                >
                  Terapkan ke Keranjang POS
                </button>
              </div>
            )}

            {/* Proactive Safety Stock Alert Banner (Sales Recommendation Trigger) */}
            {lowStockProducts.length > 0 && (
              <div className="bg-gradient-to-r from-amber-950/40 via-amber-900/20 to-slate-900 border border-amber-500/40 rounded-2xl p-4 shadow-lg space-y-3 animate-in fade-in">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                      <AlertTriangle className="w-5 h-5 animate-pulse" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-amber-300">Peringatan Proaktif: Safety Stock Kritis!</span>
                        <span className="text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full">
                          {lowStockProducts.length} Produk Menipis
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300 mt-0.5">
                        Stok daging berikut telah mencapai atau di bawah batas minimum (Safety Stock). Segera tawarkan produk alternatif ke pelanggan sebelum kehabisan!
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  {lowStockProducts.map(p => {
                    const altProduct = SAMPLE_PRODUCTS.find(item => item.id === p.alternativeId);
                    return (
                      <div 
                        key={p.id} 
                        className="bg-slate-950/90 border border-amber-700/50 rounded-xl p-3 flex flex-col justify-between gap-2.5 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-mono text-amber-400 bg-amber-950/80 border border-amber-800 px-1.5 py-0.5 rounded font-bold">
                                LIMIT {((p.safetyStockGram)/1000).toFixed(0)}KG
                              </span>
                              <span className="text-xs font-bold text-white">{p.name}</span>
                            </div>
                            <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-2 font-mono">
                              <span>Sisa Stok: <strong className="text-rose-400 font-bold">{(p.stockGram / 1000).toFixed(1)} KG</strong></span>
                              <span>•</span>
                              <span>Batas Aman: <strong className="text-slate-300">{(p.safetyStockGram / 1000).toFixed(1)} KG</strong></span>
                            </div>
                          </div>
                        </div>

                        {altProduct && (
                          <div className="bg-slate-900/90 rounded-lg p-2.5 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="text-[11px] min-w-0">
                              <div className="text-slate-400 text-[10px] flex items-center gap-1">
                                <Zap className="w-3 h-3 text-amber-400 shrink-0" />
                                <span className="font-semibold text-amber-300">Rekomendasi Alternatif:</span>
                              </div>
                              <div className="font-bold text-white text-xs mt-0.5 truncate">
                                {altProduct.name}
                              </div>
                              <div className="text-[10px] text-emerald-400 font-mono">
                                Stok Tersedia: {(altProduct.stockGram / 1000).toFixed(1)} KG • Rp {altProduct.basePricePerKg.toLocaleString('id-ID')}/kg
                              </div>
                              <div className="text-[10px] text-slate-400 italic mt-0.5 line-clamp-1">
                                "{p.alternativeReason}"
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                handleAddToCart(altProduct, 1000);
                                triggerNotification(
                                  'Substitusi Cepat Ditambahkan! ⚡',
                                  `Menawarkan ${altProduct.name} (+1.00 KG) pengganti ${p.name}`,
                                  'success'
                                );
                              }}
                              className="px-3 py-1.5 bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 text-white text-[11px] font-bold rounded-lg shadow shrink-0 flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Tawarkan +1kg</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* POS Main Grid: Product Catalog (Left) + Live Cart (Right) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Product Catalog Section (Qasir Pro DNA: 7 cols) */}
              <div className="lg:col-span-7 space-y-4">
                
                {/* Search & Category Filter Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  {/* Category Pills */}
                  <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs font-medium">
                    {['ALL', 'PRIMAL', 'TETELAN', 'SLICE'].map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setProductCategoryFilter(cat)}
                        className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                          productCategoryFilter === cat
                            ? 'bg-rose-600 text-white font-bold shadow'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {cat === 'ALL' ? 'Semua Daging' : cat}
                      </button>
                    ))}
                  </div>

                  {/* Search Input */}
                  <div className="relative flex-1 max-w-xs">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Cari SKU atau nama daging..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-rose-500"
                    />
                  </div>
                </div>

                {/* Product Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {filteredProducts.map((prod) => {
                    const isLowStock = prod.stockGram <= prod.safetyStockGram;
                    const altProduct = SAMPLE_PRODUCTS.find(item => item.id === prod.alternativeId);
                    return (
                      <div
                        key={prod.id}
                        className={`bg-slate-900 border rounded-2xl p-4 transition-all flex flex-col justify-between shadow-sm hover:shadow-md group ${
                          isLowStock 
                            ? 'border-amber-600/60 bg-gradient-to-b from-amber-950/20 to-slate-900 ring-1 ring-amber-500/30' 
                            : 'border-slate-800/80 hover:border-rose-500/50'
                        }`}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-[10px] font-mono text-slate-400">{prod.sku}</span>
                            <div className="flex items-center gap-1.5 flex-wrap justify-end">
                              {isLowStock && (
                                <span className="text-[9px] font-bold text-amber-300 bg-amber-950/80 border border-amber-600/70 px-1.5 py-0.5 rounded flex items-center gap-1 animate-pulse">
                                  <AlertTriangle className="w-2.5 h-2.5" />
                                  Safety Stock
                                </span>
                              )}
                              <span className="text-[10px] font-semibold text-rose-300 bg-rose-950/60 border border-rose-800/40 px-2 py-0.5 rounded-full">
                                {prod.tag}
                              </span>
                            </div>
                          </div>
                          <h4 className="font-bold text-sm text-white mt-1 group-hover:text-rose-400 transition-colors">
                            {prod.name}
                          </h4>
                          <div className="mt-2 text-xs text-slate-400 flex items-center justify-between">
                            <span>
                              Stok Gudang: <strong className={isLowStock ? 'text-amber-400 font-bold' : 'text-slate-200'}>{(prod.stockGram / 1000).toFixed(1)} KG</strong>
                            </span>
                            <span className="text-[10px] text-slate-500">
                              Min: {(prod.safetyStockGram / 1000).toFixed(0)} KG
                            </span>
                          </div>
                          <div className="mt-1 text-base font-extrabold text-white font-mono">
                            Rp {prod.basePricePerKg.toLocaleString('id-ID')}
                            <span className="text-xs font-normal text-slate-400"> / kg</span>
                          </div>
                        </div>

                        {/* Quick Weight Increment Chips (Qasir Pro DNA) */}
                        <div className="mt-4 pt-3 border-t border-slate-800 space-y-2">
                          <div className="text-[10px] text-slate-400 font-semibold uppercase">Tambah Cepat:</div>
                          <div className="grid grid-cols-4 gap-1.5">
                            {[
                              { label: '+500g', gram: 500 },
                              { label: '+1kg', gram: 1000 },
                              { label: '+2kg', gram: 2000 },
                              { label: '+5kg', gram: 5000 },
                            ].map((chip) => (
                              <button
                                key={chip.gram}
                                type="button"
                                onClick={() => handleAddToCart(prod, chip.gram)}
                                className="py-1.5 bg-slate-950 hover:bg-rose-600 hover:text-white border border-slate-800 rounded-lg text-xs font-bold text-slate-300 transition-colors cursor-pointer"
                              >
                                {chip.label}
                              </button>
                            ))}
                          </div>

                          {/* Quick Alternative Product Recommendation If Low Stock */}
                          {isLowStock && altProduct && (
                            <div className="mt-2 pt-2 border-t border-amber-900/40 bg-amber-950/30 rounded-xl p-2 border border-amber-800/40 flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <div className="text-[9px] text-amber-300 font-bold flex items-center gap-1">
                                  <Zap className="w-2.5 h-2.5" />
                                  Alternatif Sales:
                                </div>
                                <div className="text-[11px] font-bold text-white truncate">
                                  {altProduct.name}
                                </div>
                                <div className="text-[10px] text-emerald-400 font-mono">
                                  {(altProduct.stockGram / 1000).toFixed(1)} KG ready
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  handleAddToCart(altProduct, 1000);
                                  triggerNotification(
                                    'Substitusi Cepat Ditambahkan! ⚡',
                                    `Menawarkan ${altProduct.name} (+1.00 KG) pengganti ${prod.name}`,
                                    'success'
                                  );
                                }}
                                className="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-[10px] font-bold shrink-0 flex items-center gap-1 shadow cursor-pointer transition-colors active:scale-95"
                              >
                                <Plus className="w-3 h-3" />
                                <span>+1kg Alt</span>
                              </button>
                            </div>
                          )}
                        </div>

                      </div>
                    );
                  })}
                </div>

              </div>

              {/* Live POS Cart (Qasir Pro DNA: 5 cols) */}
              <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between space-y-4">
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2">
                      <ShoppingCart className="w-4 h-4 text-rose-500" />
                      <h3 className="font-bold text-sm text-white">Keranjang Penjualan (Catch-Weight)</h3>
                    </div>
                    <span className="text-xs text-slate-400 font-mono">
                      {cart.length} Item • {(totalCartWeightGram / 1000).toFixed(2)} KG
                    </span>
                  </div>

                  {/* Cart Items List */}
                  {cart.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 text-xs">
                      Keranjang kosong. Pilih daging di sebelah kiri atau gunakan Voice Note.
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                      {cart.map((item, idx) => {
                        const itemSubtotal = Math.round((item.weightGram * item.product.basePricePerKg) / 1000);
                        return (
                          <div
                            key={idx}
                            className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2.5"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="font-bold text-xs text-white">{item.product.name}</div>
                                <div className="text-[11px] text-slate-400 font-mono">
                                  @Rp {item.product.basePricePerKg.toLocaleString('id-ID')}/kg
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(idx)}
                                className="text-slate-500 hover:text-red-400 p-1"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {/* Weight Controls (Timbangan Aktual Gram) */}
                            <div className="flex items-center justify-between bg-slate-900 p-2 rounded-lg border border-slate-800">
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateItemWeight(idx, -500)}
                                  className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center text-xs font-bold"
                                >
                                  -
                                </button>
                                <span className="font-mono text-xs font-bold text-white px-2">
                                  {(item.weightGram / 1000).toFixed(2)} KG
                                  <span className="text-[10px] text-slate-400 block">({item.weightGram} g)</span>
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateItemWeight(idx, 500)}
                                  className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center text-xs font-bold"
                                >
                                  +
                                </button>
                              </div>

                              <div className="font-mono text-xs font-bold text-emerald-400 text-right">
                                Rp {itemSubtotal.toLocaleString('id-ID')}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Cart Summary & Sticky Checkout Button (Qasir Pro DNA) */}
                <div className="space-y-3 pt-3 border-t border-slate-800">
                  
                  {/* Ongkir & Diskon */}
                  <div className="flex items-center justify-between text-xs">
                    <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                      <input
                        type="checkbox"
                        checked={isFreeShipping}
                        onChange={(e) => setIsFreeShipping(e.target.checked)}
                        className="rounded border-slate-700 text-rose-600 focus:ring-0"
                      />
                      <span>Bebas Ongkir Sampora (Struk Coret BR-040)</span>
                    </label>
                    <span className="font-mono text-xs">
                      {isFreeShipping ? (
                        <span className="text-emerald-400 font-bold">GRATIS (Rp 0)</span>
                      ) : (
                        <span>Rp {shippingFee.toLocaleString('id-ID')}</span>
                      )}
                    </span>
                  </div>

                  {/* Grand Total */}
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Total Tagihan:</span>
                      <span className="text-xl font-black text-white font-mono">
                        Rp {grandTotalRupiah.toLocaleString('id-ID')}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Total Timbangan:</span>
                      <span className="text-sm font-bold text-rose-400 font-mono">
                        {(totalCartWeightGram / 1000).toFixed(2)} KG
                      </span>
                    </div>
                  </div>

                  {/* Checkout Button */}
                  <button
                    type="button"
                    onClick={() => setShowCheckoutSheet(true)}
                    disabled={cart.length === 0}
                    className="w-full py-3.5 bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-500 hover:to-red-600 disabled:opacity-50 text-white font-extrabold rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-rose-950/60 cursor-pointer transition-all"
                  >
                    <span>Lanjut ke Pembayaran</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                </div>

              </div>

            </div>

          </div>
        )}

        {/* =====================================================================
            TAB 2: STOK & FEFO GUDANG (COLD STORAGE SAMPORA)
            ===================================================================== */}
        {activeTab === 'warehouse' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Box className="w-5 h-5 text-rose-500" />
                  Persediaan Gudang, FEFO &amp; Susut Drip Loss
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  First Expired First Out • Zero Float Gram Math • Trimming Konversi Daging Primal ke Tetelan
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowConversionModal(true)}
                  className="px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow"
                >
                  <Split className="w-3.5 h-3.5" />
                  Konversi Primal &rarr; Tetelan
                </button>
              </div>
            </div>

            {/* Matrix Lot Daging */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {lots.map((lot) => (
                <div
                  key={lot.id}
                  className={`bg-slate-900 border rounded-2xl p-4 space-y-3 ${
                    lot.daysLeft <= 14 ? 'border-red-600/60 bg-red-950/20' : 'border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-white">{lot.code}</span>
                    {lot.isFefo && (
                      <span className="text-[10px] font-bold bg-red-600 text-white px-2 py-0.5 rounded">
                        FEFO Prioritas
                      </span>
                    )}
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-slate-200">{lot.product}</h4>
                    <div className="text-[11px] text-slate-400 mt-1">Lokasi: {lot.loc}</div>
                    <div className="text-[11px] text-slate-400">HPP: Rp {lot.hppKg.toLocaleString('id-ID')}/kg</div>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-500 block">SISA STOK</span>
                      <span className="font-mono text-base font-bold text-white">{lot.currentKg.toFixed(1)} KG</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-500 block">KEDALUWARSA</span>
                      <span className={`text-xs font-mono font-bold ${lot.daysLeft <= 14 ? 'text-red-400' : 'text-emerald-400'}`}>
                        {lot.daysLeft} Hari Lagi
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Quick Opname & Drip Loss Panel */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
              <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                <Droplet className="w-4 h-4" /> MOD-07B: Stock Opname &amp; Susut Thawing Drip Loss
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="text-slate-400 block mb-1">Pilih Lot:</label>
                  <select
                    value={selectedLotOpname}
                    onChange={(e) => setSelectedLotOpname(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                  >
                    {lots.map(l => (
                      <option key={l.id} value={l.id}>{l.code} - {l.product}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Berat Fisik Aktual (KG):</label>
                  <input
                    type="number"
                    step={0.1}
                    value={physicalWeightKg}
                    onChange={(e) => setPhysicalWeightKg(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Alasan Penyesuaian:</label>
                  <select
                    value={opnameReason}
                    onChange={(e) => setOpnameReason(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                  >
                    <option value="DRIP_LOSS_THAWING">Susut Drip Loss Thawing (OUT_DRIP_LOSS)</option>
                    <option value="OPNAME_DEFISIT">Selisih Fisik Opname (ADJ_OPNAME_MINUS)</option>
                  </select>
                </div>

                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={handleCommitOpname}
                    className="w-full py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg text-xs transition-colors cursor-pointer"
                  >
                    Rekam ke Stock Ledger
                  </button>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* =====================================================================
            TAB 3: LAPORAN & PAJAK 0.5% (MICRO HASH & ERP EKSEKUTIF HIERARCHY)
            ===================================================================== */}
        {activeTab === 'reports' && (
          <div className="space-y-6">
            
            {/* Header Laporan */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-emerald-400" />
                  Hierarki Keuangan Riil Toko &amp; Kalkulator Pajak PP 23
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Micro-Hierarchy: Omzet Kotor &rarr; HPP Lot &rarr; Beban OPEX &rarr; PPh Final 0.5% &rarr; Laba Bersih
                </p>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400 font-mono hidden sm:inline">
                  Periode: <strong className="text-white">Hari Ini (Realtime)</strong>
                </span>
                <button
                  type="button"
                  onClick={handleExportFinancialPdf}
                  className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-rose-950/50 transition-all cursor-pointer"
                  title="Unduh Laporan Laba Rugi & Perhitungan Pajak PP 23 dalam format PDF"
                >
                  <Download className="w-4 h-4" />
                  <span>Ekspor PDF Laporan</span>
                </button>
              </div>
            </div>

            {/* =========================================================================
                KARTU RINGKASAN NILAI ASET PERSEDIAAN DAGING (BERDASARKAN HPP RIIL)
                ========================================================================= */}
            <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-cyan-950/40 border border-cyan-800/40 rounded-2xl p-6 shadow-xl space-y-5 animate-in fade-in">
              
              {/* Header Kartu Aset */}
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0 shadow-inner">
                    <Box className="w-6 h-6 text-cyan-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-extrabold text-base text-white tracking-tight">
                        Ringkasan Nilai Aset Persediaan Daging (HPP / Landed Cost)
                      </h3>
                      <span className="text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 px-2 py-0.5 rounded-full">
                        Aset Lancar Berjalan
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Monitoring valuasi riil modal tertanam pada stok daging beku di Cold Storage Sampora berdasarkan harga perolehan (HPP).
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('warehouse')}
                    className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 hover:text-white rounded-xl text-xs font-semibold border border-cyan-800/40 flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span>Audit Lot Gudang</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* 4 Pilar Metrik Aset Utama */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                
                {/* 1. Total Nilai Aset HPP */}
                <div className="bg-slate-950/80 p-4 rounded-xl border border-cyan-900/50 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-full blur-xl pointer-events-none" />
                  <span className="text-[10px] text-cyan-400 uppercase font-bold tracking-wider block">
                    Total Nilai Aset (HPP Riil)
                  </span>
                  <div className="text-2xl font-black font-mono text-white mt-1.5 tracking-tight">
                    Rp {totalInventoryAssetHpp.toLocaleString('id-ID')}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                    <span>Valuasi modal persediaan berjalan</span>
                  </div>
                </div>

                {/* 2. Total Bobot Stok */}
                <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 relative">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                    Total Bobot Stok Fisik
                  </span>
                  <div className="text-2xl font-black font-mono text-cyan-300 mt-1.5">
                    {totalInventoryKg.toFixed(1)} <span className="text-sm font-bold text-slate-400">KG</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    Tersebar di {lots.length} Lot Aktif Cold Storage
                  </div>
                </div>

                {/* 3. Rata-rata Landed Cost */}
                <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 relative">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                    Rata-Rata HPP / KG
                  </span>
                  <div className="text-2xl font-black font-mono text-slate-200 mt-1.5">
                    Rp {avgInventoryHppPerKg.toLocaleString('id-ID')}
                    <span className="text-xs font-normal text-slate-400"> / kg</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    Bobot tertimbang seluruh kategori
                  </div>
                </div>

                {/* 4. Resiko FEFO Kedaluwarsa */}
                <div className={`p-4 rounded-xl border relative ${
                  criticalExpiryKg > 0 
                    ? 'bg-amber-950/30 border-amber-600/50' 
                    : 'bg-slate-950/80 border-slate-800'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-amber-400 uppercase font-bold block">
                      Aset Kritis FEFO (&le;14 Hari)
                    </span>
                    {criticalExpiryKg > 0 && (
                      <span className="text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.5 rounded">
                        Perlu Obral
                      </span>
                    )}
                  </div>
                  <div className="text-2xl font-black font-mono text-amber-300 mt-1.5">
                    Rp {criticalExpiryValueHpp.toLocaleString('id-ID')}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    {criticalExpiryKg.toFixed(1)} KG ({criticalExpiryLots.length} Lot prioritas rotasi)
                  </div>
                </div>

              </div>

              {/* Rincian Valuasi per Lot Daging */}
              <div className="bg-slate-950/90 rounded-xl border border-slate-800 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-slate-300 flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Rincian Valuasi Aset per Lot Daging Aktif</span>
                  </div>
                  <span className="text-[11px] text-slate-500 font-mono">
                    Lokasi: Freezer A-01 s.d B-01 (-18&deg;C)
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                  {lots.map((lot) => {
                    const lotAssetValue = Math.round(lot.currentKg * lot.hppKg);
                    const percentage = totalInventoryAssetHpp > 0 
                      ? ((lotAssetValue / totalInventoryAssetHpp) * 100).toFixed(1) 
                      : '0';
                    return (
                      <div 
                        key={lot.id} 
                        className={`p-3 rounded-xl border space-y-2 transition-all ${
                          lot.daysLeft <= 14 
                            ? 'bg-red-950/20 border-red-800/60' 
                            : 'bg-slate-900/80 border-slate-800/80'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-mono font-bold text-slate-200">{lot.code}</span>
                          <span className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded ${
                            lot.daysLeft <= 14 
                              ? 'bg-red-900/50 text-red-300' 
                              : 'bg-slate-800 text-slate-400'
                          }`}>
                            {lot.daysLeft} Hari Lagi
                          </span>
                        </div>
                        <div>
                          <div className="font-bold text-xs text-white truncate">{lot.product}</div>
                          <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                            {lot.currentKg.toFixed(1)} KG &times; Rp {lot.hppKg.toLocaleString('id-ID')}/kg
                          </div>
                        </div>
                        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                          <span className="text-[10px] text-slate-500 font-semibold">{percentage}% Total Aset</span>
                          <span className="font-mono text-xs font-bold text-cyan-300">
                            Rp {lotAssetValue.toLocaleString('id-ID')}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>

            {/* Micro-Hierarchy PnL Breakdown (Informatif, Padat, Kondisi Real) */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
              
              <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">1. Omzet Kotor</span>
                <span className="text-lg font-bold font-mono text-white block mt-1">
                  Rp {totalGrossRevenue.toLocaleString('id-ID')}
                </span>
                <span className="text-[10px] text-emerald-400 mt-1 block">Penjualan Daging</span>
              </div>

              <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">2. HPP (COGS)</span>
                <span className="text-lg font-bold font-mono text-rose-400 block mt-1">
                  -Rp {totalCogs.toLocaleString('id-ID')}
                </span>
                <span className="text-[10px] text-slate-400 mt-1 block">Landed Cost Daging</span>
              </div>

              <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">3. Laba Kotor</span>
                <span className="text-lg font-bold font-mono text-emerald-400 block mt-1">
                  Rp {grossProfit.toLocaleString('id-ID')}
                </span>
                <span className="text-[10px] text-slate-400 mt-1 block">Margin ~25.4%</span>
              </div>

              <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">4. Total OPEX</span>
                <span className="text-lg font-bold font-mono text-amber-400 block mt-1">
                  -Rp {totalOpex.toLocaleString('id-ID')}
                </span>
                <span className="text-[10px] text-slate-400 mt-1 block">{opexList.length} Voucher Kas Kecil</span>
              </div>

              <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">5. Pajak 0.5% UMKM</span>
                <span className="text-lg font-bold font-mono text-purple-400 block mt-1">
                  -Rp {estimatedUmkmTax.toLocaleString('id-ID')}
                </span>
                <span className="text-[10px] text-slate-400 mt-1 block">PPh PP 23/2018</span>
              </div>

              <div className="bg-gradient-to-br from-emerald-950 to-slate-900 p-4 rounded-xl border border-emerald-600/50 shadow-md">
                <span className="text-[10px] text-emerald-400 uppercase font-bold block">6. Laba Bersih Riil</span>
                <span className="text-lg font-extrabold font-mono text-white block mt-1">
                  Rp {netProfitAfterTax.toLocaleString('id-ID')}
                </span>
                <span className="text-[10px] text-emerald-300 mt-1 block">Bersih Masuk Kantong</span>
              </div>

            </div>

            {/* ================= RECHARTS: GRAFIK OMZET 7 HARI & KOMPOSISI KATEGORI ================= */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Grafik Batang Omzet Harian 7 Hari Terakhir (7 cols) */}
              <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="font-bold text-sm text-white flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-rose-500" />
                      Tren Omzet Harian 7 Hari Terakhir (Senin - Minggu)
                    </h3>
                    <p className="text-[11px] text-slate-400">Total Omzet Minggu Ini: Rp 120.100.000 (Rata-rata Rp 17.1Jt / hari)</p>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800/40">
                    +14.8% vs Minggu Lalu
                  </span>
                </div>

                <div className="h-64 w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={DAILY_SALES_7_DAYS} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis 
                        dataKey="day" 
                        stroke="#64748b" 
                        fontSize={11} 
                        tickLine={false}
                        axisLine={{ stroke: '#334155' }}
                      />
                      <YAxis 
                        stroke="#64748b" 
                        fontSize={10} 
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(val) => `Rp${(val / 1000000).toFixed(0)}Jt`}
                      />
                      <RechartsTooltip 
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-slate-900 border border-slate-700 p-3 rounded-xl shadow-2xl text-xs font-sans">
                                <div className="font-bold text-white mb-1">{data.day}</div>
                                <div className="text-emerald-400 font-mono font-bold text-sm">
                                  Rp {Number(data.omzet).toLocaleString('id-ID')}
                                </div>
                                <div className="text-slate-400 text-[10px] mt-1">
                                  Target: Rp {Number(data.target).toLocaleString('id-ID')} ({((data.omzet / data.target) * 100).toFixed(0)}%)
                                </div>
                                <div className="text-rose-400 text-[10px]">
                                  Estimasi Margin Kotor: {data.margin}%
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }} 
                      />
                      <Bar dataKey="omzet" fill="#e11d48" radius={[6, 6, 0, 0]} maxBarSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800/80 font-mono">
                  <span>Hari Tertinggi: <strong className="text-white">Sabtu (Rp 22.8Jt)</strong></span>
                  <span>Target Tercapai: <strong className="text-emerald-400">6 dari 7 Hari</strong></span>
                </div>
              </div>

              {/* Grafik Komposisi Kategori Daging (5 cols) */}
              <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div>
                      <h3 className="font-bold text-sm text-white flex items-center gap-2">
                        <Tag className="w-4 h-4 text-purple-400" />
                        Komposisi Penjualan Daging
                      </h3>
                      <p className="text-[11px] text-slate-400">Volume &amp; Kontribusi Omzet per Kategori</p>
                    </div>
                    <span className="text-xs text-slate-400 font-mono font-bold">285.5 KG</span>
                  </div>

                  <div className="h-48 w-full pt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPieChart>
                        <Pie
                          data={CATEGORY_COMPOSITION}
                          cx="50%"
                          cy="50%"
                          innerRadius={45}
                          outerRadius={75}
                          paddingAngle={4}
                          dataKey="value"
                        >
                          {CATEGORY_COMPOSITION.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} stroke="#0f172a" strokeWidth={2} />
                          ))}
                        </Pie>
                        <RechartsTooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload;
                              return (
                                <div className="bg-slate-900 border border-slate-700 p-2.5 rounded-xl shadow-2xl text-xs font-sans">
                                  <div className="font-bold text-white mb-1" style={{ color: data.color }}>{data.name}</div>
                                  <div className="text-white font-mono font-bold">
                                    Rp {Number(data.value).toLocaleString('id-ID')} ({data.percentage})
                                  </div>
                                  <div className="text-slate-400 text-[10px] mt-0.5">
                                    Total Berat Terjual: {data.weightKg} KG
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
                </div>

                {/* Custom Legend Cards */}
                <div className="space-y-2 pt-2 border-t border-slate-800">
                  {CATEGORY_COMPOSITION.map((cat, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs p-2 bg-slate-950 rounded-lg border border-slate-800">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                        <span className="text-slate-200 font-medium">{cat.category} ({cat.weightKg} KG)</span>
                      </div>
                      <div className="text-right font-mono">
                        <span className="font-bold text-white">{cat.percentage}</span>
                        <span className="text-[10px] text-slate-500 block">Rp {(cat.value / 1000000).toFixed(1)}Jt</span>
                      </div>
                    </div>
                  ))}
                </div>

              </div>

            </div>

            {/* Rincian Kas Kecil OPEX (Es, Plastik, BBM) */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-white flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-amber-400" />
                  Buku Kasir Kecil &amp; Pengeluaran Operasional (MOD-12)
                </h3>
                <span className="text-xs font-mono text-amber-400 font-bold">
                  Total Hari Ini: Rp {totalOpex.toLocaleString('id-ID')}
                </span>
              </div>

              {/* Form Input OPEX Cepat */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs">
                <div>
                  <label className="text-slate-400 block mb-1">Kategori:</label>
                  <select
                    value={newOpexCategory}
                    onChange={(e) => setNewOpexCategory(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
                  >
                    <option value="ES_PACKING">ES_PACKING (Es Balok Cold Chain)</option>
                    <option value="PLASTIK_VAKUM">PLASTIK_VAKUM (Plastik Emboss)</option>
                    <option value="BENSIN_PENGIRIMAN">BENSIN_PENGIRIMAN (BBM Kurir)</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Keterangan:</label>
                  <input
                    type="text"
                    placeholder="Contoh: Es Balok 5 Batang..."
                    value={newOpexDesc}
                    onChange={(e) => setNewOpexDesc(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Nominal (Rp):</label>
                  <input
                    type="number"
                    step={5000}
                    value={newOpexAmount}
                    onChange={(e) => setNewOpexAmount(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white font-mono font-bold"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={handleAddOpex}
                    className="w-full py-2 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold rounded-lg text-xs transition-colors cursor-pointer"
                  >
                    Tambah Pengeluaran
                  </button>
                </div>
              </div>

              {/* Riwayat OPEX */}
              <div className="space-y-2 font-mono text-xs">
                {opexList.map((op) => (
                  <div key={op.id} className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-amber-400">{op.voucher}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">
                          {op.category}
                        </span>
                        <span className="text-[10px] text-slate-500">{op.time}</span>
                      </div>
                      <div className="text-slate-300 text-xs mt-1">{op.desc}</div>
                    </div>
                    <div className="font-bold text-rose-400 text-sm">
                      -Rp {op.amount.toLocaleString('id-ID')}
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* =====================================================================
            TAB 4: JURNAL & BUKU BESAR (ERP PROFESIONAL DOUBLE-ENTRY)
            ===================================================================== */}
        {activeTab === 'journals' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-purple-400" />
                    Jurnal Umum Otomatis &amp; Event Sourcing Audit Trail
                  </h2>
                  <p className="text-xs text-slate-400">
                    Double-Entry Otomatis: Kas, Piutang, Pendapatan Penjualan, HPP, &amp; Persediaan Daging
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-lg text-emerald-400 font-bold hidden sm:inline">
                    Balance: Rp 32.300.000 (DEBIT = KREDIT)
                  </span>
                  <button
                    type="button"
                    onClick={handleExportJournalPdf}
                    className="px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-purple-950/50 transition-all cursor-pointer"
                    title="Unduh Buku Jurnal Umum Double-Entry dalam format PDF resmi"
                  >
                    <Download className="w-4 h-4" />
                    <span>Ekspor PDF Jurnal</span>
                  </button>
                </div>
              </div>

              {/* Jurnal List */}
              <div className="space-y-3 font-mono text-xs">
                
                {/* Entry 1: Penjualan Daging */}
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-900 pb-2">
                    <span className="text-rose-400 font-bold">JRN-261102-0042 (Penjualan Faktur INV-HP03-0042)</span>
                    <span className="text-slate-500">2026-11-02 14:20:15</span>
                  </div>
                  <div className="grid grid-cols-12 gap-2 text-slate-300 pt-1">
                    <div className="col-span-8">[D] Piutang Usaha Pelanggan (Steakhouse Banten Prima)</div>
                    <div className="col-span-2 text-right text-emerald-400 font-bold">Rp 726.500</div>
                    <div className="col-span-2 text-right text-slate-600">-</div>
                  </div>
                  <div className="grid grid-cols-12 gap-2 text-slate-300">
                    <div className="col-span-8 pl-4">[K] Pendapatan Penjualan Daging Import</div>
                    <div className="col-span-2 text-right text-slate-600">-</div>
                    <div className="col-span-2 text-right text-emerald-400 font-bold">Rp 726.500</div>
                  </div>
                  <div className="grid grid-cols-12 gap-2 text-slate-400 pt-1 border-t border-slate-900">
                    <div className="col-span-8">[D] Beban Pokok Penjualan (HPP Daging)</div>
                    <div className="col-span-2 text-right text-rose-400">Rp 520.000</div>
                    <div className="col-span-2 text-right text-slate-600">-</div>
                  </div>
                  <div className="grid grid-cols-12 gap-2 text-slate-400">
                    <div className="col-span-8 pl-4">[K] Persediaan Daging (Stock Ledger OUT_SALE)</div>
                    <div className="col-span-2 text-right text-slate-600">-</div>
                    <div className="col-span-2 text-right text-rose-400">Rp 520.000</div>
                  </div>
                </div>

                {/* Entry 2: Pengeluaran OPEX */}
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-900 pb-2">
                    <span className="text-amber-400 font-bold">JRN-261102-0038 (Beban Operasional Es Balok)</span>
                    <span className="text-slate-500">2026-11-02 08:30:00</span>
                  </div>
                  <div className="grid grid-cols-12 gap-2 text-slate-300 pt-1">
                    <div className="col-span-8">[D] Beban Packing Cold Chain (Es Balok 10 Batang)</div>
                    <div className="col-span-2 text-right text-amber-400 font-bold">Rp 120.000</div>
                    <div className="col-span-2 text-right text-slate-600">-</div>
                  </div>
                  <div className="grid grid-cols-12 gap-2 text-slate-300">
                    <div className="col-span-8 pl-4">[K] Kas Kecil Toko Sampora</div>
                    <div className="col-span-2 text-right text-slate-600">-</div>
                    <div className="col-span-2 text-right text-amber-400 font-bold">Rp 120.000</div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}

        {/* =====================================================================
            TAB 5: OWNER COPILOT & GEMINI AI (MOD-14 & MOD-21 AI SUITE)
            ===================================================================== */}
        {activeTab === 'owner_ai' && (
          <div className="space-y-6">
            
            {/* Top Banner AI Suite */}
            <div className="bg-gradient-to-r from-purple-950/70 via-slate-900 to-rose-950/70 border border-purple-500/40 rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-purple-950/80 border border-purple-700/60 rounded-xl text-purple-400">
                  <Sparkles className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Owner Executive Copilot &amp; Gemini 3.8 Flash AI</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Diagnosis Kilat 3-Detik • Audit Stok Kritis FEFO • Pengawasan Kas Sales Lapangan
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleFetchAiAdvisor}
                disabled={aiAdvisorLoading}
                className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-rose-600 hover:from-purple-500 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-lg cursor-pointer disabled:opacity-50"
              >
                {aiAdvisorLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Bot className="w-4 h-4" />}
                <span>{aiAdvisorLoading ? 'Memproses Audit...' : 'Jalankan Audit AI Toko Sampora'}</span>
              </button>
            </div>

            {/* Quick Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              <div className="bg-slate-900 p-4 rounded-xl border border-amber-800/40">
                <div className="text-xs text-slate-400 flex items-center justify-between">
                  <span>Kas Fisik di Sales</span>
                  <span className="text-amber-400 font-bold">Perlu Setoran</span>
                </div>
                <div className="text-xl font-bold font-mono text-white mt-1">
                  Rp {cashInHand.toLocaleString('id-ID')}
                </div>
                <div className="text-[11px] text-amber-300 mt-1">Melebihi batas aman Rp 3.000.000</div>
              </div>

              <div className="bg-slate-900 p-4 rounded-xl border border-emerald-800/40">
                <div className="text-xs text-slate-400 flex items-center justify-between">
                  <span>Piutang Jatuh Tempo</span>
                  <span className="text-emerald-400 font-bold">Aman</span>
                </div>
                <div className="text-xl font-bold font-mono text-white mt-1">Rp 16.900.000</div>
                <div className="text-[11px] text-slate-400 mt-1">Seluruh pelanggan dalam batas tempo normal</div>
              </div>

              <div className="bg-slate-900 p-4 rounded-xl border border-red-800/40">
                <div className="text-xs text-slate-400 flex items-center justify-between">
                  <span>Lot Kritis FEFO</span>
                  <span className="text-red-400 font-bold">1 Lot Kritis</span>
                </div>
                <div className="text-xl font-bold font-mono text-white mt-1">48.5 KG Ribeye</div>
                <div className="text-[11px] text-red-300 mt-1">Sisa 13 hari kedaluwarsa</div>
              </div>

            </div>

            {/* AI Advisor Diagnosis Box */}
            {aiAdvisorData ? (
              <div className="bg-slate-900 p-6 rounded-2xl border border-purple-500/40 space-y-4 font-sans text-xs">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    <span className="font-bold text-white text-sm">Diagnosis Gemini AI untuk Ndoro Juragan</span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-950 text-amber-400 border border-amber-800">
                    STATUS: {aiAdvisorData.urgencyLevel}
                  </span>
                </div>

                <p className="text-slate-200 leading-relaxed bg-slate-950 p-3 rounded-lg border border-slate-800 italic">
                  "{aiAdvisorData.summary}"
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="p-3 bg-amber-950/30 rounded-lg border border-amber-800/40 text-amber-200">
                    <strong className="text-amber-400 block mb-1">💰 Kas Sales Lapangan:</strong>
                    {aiAdvisorData.cashAlert}
                  </div>
                  <div className="p-3 bg-red-950/30 rounded-lg border border-red-800/40 text-rose-200">
                    <strong className="text-rose-400 block mb-1">🥩 Rotasi Stok FEFO:</strong>
                    {aiAdvisorData.fefoStrategy}
                  </div>
                  <div className="p-3 bg-sky-950/30 rounded-lg border border-sky-800/40 text-sky-200">
                    <strong className="text-sky-400 block mb-1">📋 Piutang &amp; Tempo:</strong>
                    {aiAdvisorData.receivableWarning}
                  </div>
                </div>

                {/* Priority Action Checklist */}
                <div className="space-y-2 pt-2">
                  <span className="text-[11px] font-bold text-white uppercase tracking-wider block">
                    Checklist Tindakan Prioritas Hari Ini:
                  </span>
                  {aiAdvisorData.actionItems?.map((act: any, idx: number) => (
                    <div key={idx} className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex items-start gap-3">
                      <span className="w-5 h-5 rounded-full bg-purple-900/60 text-purple-300 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <div className="flex-1">
                        <div className="font-bold text-white">{act.title}</div>
                        <div className="text-slate-400 text-[11px] mt-0.5">{act.detail}</div>
                        <span className="inline-block mt-1 text-[9px] px-2 py-0.5 bg-slate-800 text-purple-300 rounded font-mono">
                          PIC: {act.pic}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-slate-900 p-8 rounded-2xl border border-slate-800 text-center space-y-3">
                <Bot className="w-8 h-8 text-purple-400 mx-auto opacity-70" />
                <h4 className="font-bold text-xs text-white">Konsultan AI Siap Mengaudit Bisnis</h4>
                <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                  Klik tombol di atas untuk menjalankan diagnosis kesehatan toko, evaluasi lot FEFO, dan mitigasi risiko kas sales.
                </p>
              </div>
            )}

          </div>
        )}

      </main>

      {/* =========================================================================
          BOTTOM STICKY BAR FOR MOBILE (Qasir Pro DNA: Checkout Cepat di HP)
          ========================================================================= */}
      {cart.length > 0 && activeTab === 'pos' && (
        <div className="fixed bottom-0 left-0 right-0 bg-slate-900/95 border-t border-slate-800 p-3.5 px-6 z-40 backdrop-blur-md flex items-center justify-between gap-4 md:hidden shadow-2xl">
          <div>
            <div className="text-[10px] text-slate-400 font-semibold uppercase">
              {cart.length} Item • {(totalCartWeightGram / 1000).toFixed(2)} KG
            </div>
            <div className="text-base font-black text-white font-mono">
              Rp {grandTotalRupiah.toLocaleString('id-ID')}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowCheckoutSheet(true)}
            className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-rose-950/60"
          >
            <span>Bayar</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* =========================================================================
          CHECKOUT MODAL / BOTTOM SHEET (QASIR PRO & GOPAY DNA)
          ========================================================================= */}
      {showCheckoutSheet && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg p-6 space-y-5 shadow-2xl relative animate-in zoom-in-95">
            <button
              onClick={() => setShowCheckoutSheet(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider block">Konfirmasi Pembayaran</span>
              <h3 className="font-extrabold text-base text-white">{customer.name}</h3>
              <p className="text-xs text-slate-400 mt-0.5">Faktur: INV-HP03-261102-0042</p>
            </div>

            {/* Metode Bayar */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300">Pilih Metode Pembayaran:</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'CASH', label: 'Tunai (Cash)', icon: Banknote },
                  { id: 'TRANSFER', label: 'Transfer Bank', icon: CreditCard },
                  { id: 'TEMPO', label: `Tempo (${customer.termDays} Hari)`, icon: Calendar },
                ].map((m) => {
                  const Icon = m.icon;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setPaymentMethod(m.id as any)}
                      className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                        paymentMethod === m.id
                          ? 'bg-rose-600 border-rose-500 text-white shadow'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{m.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Jika Bayar Tunai: Tombol Uang Pas Qasir Pro */}
            {paymentMethod === 'CASH' && (
              <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                <label className="text-xs text-slate-400 block">Uang Tunai Diterima:</label>
                <div className="flex gap-2">
                  {[grandTotalRupiah, 1000000, 1500000, 2000000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setCashTendered(amt)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold border ${
                        cashTendered === amt
                          ? 'bg-emerald-600 border-emerald-500 text-white'
                          : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      {amt === grandTotalRupiah ? 'Uang Pas' : `Rp ${(amt/1000)}k`}
                    </button>
                  ))}
                </div>
                <div className="flex justify-between items-center text-xs font-mono pt-1 text-slate-300">
                  <span>Kembalian:</span>
                  <span className="font-bold text-emerald-400">
                    Rp {Math.max(0, cashTendered - grandTotalRupiah).toLocaleString('id-ID')}
                  </span>
                </div>
              </div>
            )}

            {/* Warning Plafon Kredit Tempo */}
            {isTempoBlocked && (
              <div className="p-3 bg-red-950/60 border border-red-800/80 rounded-xl text-xs text-red-200 space-y-2">
                <div className="font-bold flex items-center gap-1.5 text-red-300">
                  <AlertOctagon className="w-4 h-4" /> Plafon Kredit Terlampaui!
                </div>
                <div>
                  Plafon: Rp {customer.creditLimit.toLocaleString('id-ID')} • Piutang Berjalan + Order: Rp {projectedReceivable.toLocaleString('id-ID')}.
                </div>
                {!isOwnerApproved && (
                  <div className="flex gap-2 pt-1">
                    <input
                      type="password"
                      maxLength={6}
                      placeholder="PIN 6-digit Owner"
                      value={ownerPinInput}
                      onChange={(e) => setOwnerPinInput(e.target.value)}
                      className="bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs text-white w-32"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (ownerPinInput === '123456' || ownerPinInput.length === 6) {
                          setIsOwnerApproved(true);
                          triggerNotification('PIN Valid', 'Persetujuan kredit disetujui Owner', 'success');
                        } else {
                          alert('PIN salah!');
                        }
                      }}
                      className="px-3 py-1 bg-red-600 text-white font-bold rounded text-xs"
                    >
                      Buka Kunci
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Total Pembayaran */}
            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Total yang Harus Dibayar:</span>
                <span className="text-xl font-black text-white font-mono">
                  Rp {grandTotalRupiah.toLocaleString('id-ID')}
                </span>
              </div>
              <div className="text-right text-xs text-slate-400">
                <span>{(totalCartWeightGram / 1000).toFixed(2)} KG Daging</span>
              </div>
            </div>

            {/* Tombol Eksekusi Bayar */}
            <button
              type="button"
              onClick={handleCheckoutCommit}
              className="w-full py-3.5 bg-rose-600 hover:bg-rose-500 text-white font-extrabold rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-rose-950/60 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Selesaikan Transaksi &amp; Cetak Struk 58mm</span>
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL STRUK THERMAL 58MM (ESC/POS SIMULATOR)
          ========================================================================= */}
      {showThermalReceipt && lastIssuedInvoice && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white text-black rounded-3xl w-full max-w-sm p-6 shadow-2xl space-y-4 font-mono text-xs relative">
            <button
              onClick={() => setShowThermalReceipt(false)}
              className="absolute top-4 right-4 p-1 rounded-full hover:bg-slate-100 text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="text-center space-y-1 border-b border-dashed border-slate-400 pb-3">
              <div className="font-extrabold text-sm tracking-tight">TOKO DAGING SAMPORA</div>
              <div className="text-[10px] text-slate-600">Supplier Daging Import Cold Chain</div>
              <div className="text-[10px] text-slate-500">Jl. Raya Sampora Blok B-3, Banten</div>
              <div className="text-[10px] text-slate-500">Telp: (0254) 8923-4567 • NKV: RPHU-3604010</div>
            </div>

            <div className="space-y-1 text-[11px] border-b border-dashed border-slate-400 pb-2">
              <div className="flex justify-between">
                <span>FAKTUR:</span>
                <span className="font-bold">{lastIssuedInvoice.invoiceNumber}</span>
              </div>
              <div className="flex justify-between">
                <span>PELANGGAN:</span>
                <span>{lastIssuedInvoice.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span>METODE:</span>
                <span className="font-bold">{lastIssuedInvoice.paymentMethod} {lastIssuedInvoice.tempoDays > 0 ? `(${lastIssuedInvoice.tempoDays} Hari)` : ''}</span>
              </div>
              <div className="flex justify-between">
                <span>WAKTU:</span>
                <span>{lastIssuedInvoice.timestamp}</span>
              </div>
            </div>

            <div className="space-y-2 border-b border-dashed border-slate-400 pb-3">
              {lastIssuedInvoice.items.map((item: CartItemState, idx: number) => {
                const sub = Math.round((item.weightGram * item.product.basePricePerKg) / 1000);
                return (
                  <div key={idx} className="space-y-0.5">
                    <div className="font-bold text-[11px]">{item.product.name}</div>
                    <div className="flex justify-between text-[10px] text-slate-700">
                      <span>{(item.weightGram / 1000).toFixed(2)} KG @Rp {item.product.basePricePerKg.toLocaleString('id-ID')}</span>
                      <span>Rp {sub.toLocaleString('id-ID')}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span>SUBTOTAL:</span>
                <span>Rp {lastIssuedInvoice.subtotalRupiah.toLocaleString('id-ID')}</span>
              </div>
              {lastIssuedInvoice.isFreeShipping && (
                <div className="flex justify-between text-slate-600">
                  <span>ONGKIR CORET (BR-040):</span>
                  <span className="line-through">Rp {lastIssuedInvoice.originalShipping.toLocaleString('id-ID')}</span>
                </div>
              )}
              <div className="flex justify-between font-extrabold text-sm border-t border-slate-300 pt-1">
                <span>TOTAL AKHIR:</span>
                <span>Rp {lastIssuedInvoice.grandTotalRupiah.toLocaleString('id-ID')}</span>
              </div>
            </div>

            <div className="text-center text-[10px] text-slate-500 pt-3 border-t border-dashed border-slate-400 space-y-1">
              <div>Simpan daging beku pada suhu -18°C</div>
              <div>Terima kasih atas kepercayaan Anda!</div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  triggerNotification('Struk Dicetak 🖨️', 'Kirim ke Bluetooth ESC/POS 58mm', 'info');
                  setShowThermalReceipt(false);
                }}
                className="flex-1 py-2 bg-slate-900 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                Cetak Bluetooth
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL KONVERSI TRIMMING & TETELAN (MOD-07)
          ========================================================================= */}
      {showConversionModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 space-y-4 text-xs font-sans">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <Split className="w-4 h-4 text-rose-400" />
                Konversi Trimming &rarr; Daging Tetelan (MOD-07)
              </h3>
              <button onClick={() => setShowConversionModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Daging Asal Primal:</label>
              <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 font-bold text-white">
                LOT-AUS-261015-01 (Ribeye Meltique AUS)
              </div>
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Jumlah Berat Daging yang Dipotong (KG):</label>
              <input
                type="number"
                min={1}
                max={48}
                value={conversionKg}
                onChange={(e) => setConversionKg(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-mono font-bold"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Estimasi Yield Daging Bersih (%):</label>
              <input
                type="number"
                min={50}
                max={99}
                value={conversionYield}
                onChange={(e) => setConversionYield(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-mono font-bold"
              />
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1 text-slate-300 font-mono">
              <div className="flex justify-between">
                <span>Hasil Tetelan (IN_CONVERSION):</span>
                <span className="font-bold text-emerald-400">{((conversionKg * conversionYield)/100).toFixed(2)} KG</span>
              </div>
              <div className="flex justify-between">
                <span>Susut Lemak (OUT_CUTTING_LOSS):</span>
                <span className="font-bold text-rose-400">{(conversionKg - (conversionKg * conversionYield)/100).toFixed(2)} KG</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCommitConversion}
              className="w-full py-3 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
            >
              Eksekusi Potong &amp; Catat ke Stock Ledger
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
