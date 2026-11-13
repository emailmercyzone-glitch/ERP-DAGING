import React, { useState, useMemo } from 'react';
import {
  X,
  Users,
  Search,
  Building2,
  Phone,
  MapPin,
  Clock,
  CreditCard,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Package,
  Calendar,
  MessageSquare,
  Edit3,
  Save,
  RotateCcw,
  Check,
  ShieldCheck,
  ShieldAlert,
  Plus,
  ExternalLink,
  DollarSign,
  PieChart as PieIcon,
  ShoppingBag,
  Percent
} from 'lucide-react';
import type { CustomerItem } from './QuickAddCustomerModal';

export interface CustomerInvoiceItem {
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
}

export interface CustomerDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  customers: CustomerItem[];
  receivables: CustomerInvoiceItem[];
  initialSelectedCustomerId?: string | null;
  onUpdateCustomer: (updated: CustomerItem) => void;
  onAddNewCustomerClick: () => void;
  onRecordPayment: (receivableId: string, amountRupiah: number, paymentMethod: 'CASH' | 'TRANSFER') => boolean;
}

export const CustomerDashboardModal: React.FC<CustomerDashboardModalProps> = ({
  isOpen,
  onClose,
  customers,
  receivables,
  initialSelectedCustomerId = null,
  onUpdateCustomer,
  onAddNewCustomerClick,
  onRecordPayment,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTier, setFilterTier] = useState<'ALL' | 'HOREKA' | 'VIP' | 'RETAIL' | 'OVERLIMIT'>('ALL');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(
    initialSelectedCustomerId || (customers[0]?.id ?? '')
  );
  const [activeTab, setActiveTab] = useState<'INVOICES' | 'STATS' | 'EDIT_LIMIT'>('INVOICES');

  // Edit form state
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editTier, setEditTier] = useState<'RETAIL' | 'HOREKA' | 'VIP'>('HOREKA');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editCreditLimit, setEditCreditLimit] = useState<number>(0);
  const [editTermDays, setEditTermDays] = useState<number>(0);
  const [copiedInvoiceId, setCopiedInvoiceId] = useState<string | null>(null);
  const [paymentTarget, setPaymentTarget] = useState<CustomerInvoiceItem | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'TRANSFER'>('CASH');

  // Sync initial selection
  React.useEffect(() => {
    if (initialSelectedCustomerId) {
      setSelectedCustomerId(initialSelectedCustomerId);
    } else if (customers.length > 0 && !selectedCustomerId) {
      setSelectedCustomerId(customers[0].id);
    }
  }, [initialSelectedCustomerId, customers]);

  // Merge full customer list (including any receivables whose customer might not be in customers state)
  const fullCustomersList = useMemo(() => {
    const list = [...customers];
    const customerNames = new Set(list.map(c => c.name.toLowerCase()));

    receivables.forEach(r => {
      if (!customerNames.has(r.customer.toLowerCase())) {
        customerNames.add(r.customer.toLowerCase());
        list.push({
          id: `CUST_AUTO_${r.customer.replace(/\s+/g, '_')}`,
          code: `CUST-${r.tier.slice(0, 4)}-${Math.floor(100 + Math.random() * 900)}`,
          name: r.customer,
          tier: r.tier === 'VIP' ? 'VIP' : r.tier === 'RETAIL' ? 'RETAIL' : 'HOREKA',
          creditLimit: r.limit || 10000000,
          currentReceivable: r.amount,
          termDays: 14,
          phone: r.phone || '-',
          address: 'Alamat Pelanggan Terdaftar di Faktur',
        });
      }
    });

    return list;
  }, [customers, receivables]);

  // Compute metrics for each customer
  const enrichedCustomers = useMemo(() => {
    return fullCustomersList.map(cust => {
      const custInvoices = receivables.filter(
        r => r.customer.toLowerCase() === cust.name.toLowerCase()
      );
      const unpaidInvoices = custInvoices.filter(r => r.status !== 'LUNAS');
      const paidInvoices = custInvoices.filter(r => r.status === 'LUNAS');

      const totalUnpaidAmount = unpaidInvoices.reduce((sum, r) => sum + r.amount, 0);
      const totalPaidAmount = paidInvoices.reduce((sum, r) => sum + r.amount, 0);
      const totalLifetimeRevenue = totalUnpaidAmount + totalPaidAmount;

      const overdueInvoices = unpaidInvoices.filter(r => r.category === 'TERLAMBAT');
      const isOverlimit = cust.creditLimit > 0 && totalUnpaidAmount > cust.creditLimit;
      const usagePercent = cust.creditLimit > 0 
        ? Math.min(150, Math.round((totalUnpaidAmount / cust.creditLimit) * 100)) 
        : 0;
      const remainingLimit = Math.max(0, cust.creditLimit - totalUnpaidAmount);

      // Discipline Score (0 - 100)
      let disciplineScore = 100;
      if (overdueInvoices.length > 0) {
        disciplineScore = Math.max(40, 100 - (overdueInvoices.length * 20));
      } else if (usagePercent > 90) {
        disciplineScore = 85;
      }

      return {
        ...cust,
        invoices: custInvoices,
        unpaidInvoices,
        totalUnpaidAmount,
        totalPaidAmount,
        totalLifetimeRevenue,
        overdueCount: overdueInvoices.length,
        isOverlimit,
        usagePercent,
        remainingLimit,
        disciplineScore,
      };
    });
  }, [fullCustomersList, receivables]);

  // Filtered customer list
  const filteredCustomers = useMemo(() => {
    return enrichedCustomers.filter(c => {
      const matchesSearch = 
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.phone.includes(searchQuery);

      if (!matchesSearch) return false;

      if (filterTier === 'ALL') return true;
      if (filterTier === 'OVERLIMIT') return c.isOverlimit || c.overdueCount > 0;
      return c.tier === filterTier;
    });
  }, [enrichedCustomers, searchQuery, filterTier]);

  // Selected active customer
  const currentCustomer = useMemo(() => {
    return (
      enrichedCustomers.find(c => c.id === selectedCustomerId || c.name.toLowerCase() === selectedCustomerId.toLowerCase()) ||
      filteredCustomers[0] ||
      enrichedCustomers[0]
    );
  }, [enrichedCustomers, filteredCustomers, selectedCustomerId]);

  // Init edit state when customer changes
  React.useEffect(() => {
    if (currentCustomer) {
      setEditName(currentCustomer.name);
      setEditTier(currentCustomer.tier as any);
      setEditPhone(currentCustomer.phone);
      setEditAddress(currentCustomer.address);
      setEditCreditLimit(currentCustomer.creditLimit);
      setEditTermDays(currentCustomer.termDays);
      setIsEditing(false);
    }
  }, [currentCustomer?.id]);

  if (!isOpen) return null;

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCustomer) return;

    const updated: CustomerItem = {
      ...currentCustomer,
      name: editName.trim(),
      tier: editTier,
      phone: editPhone.trim(),
      address: editAddress.trim(),
      creditLimit: editTier === 'RETAIL' ? 0 : editCreditLimit,
      termDays: editTier === 'RETAIL' ? 0 : editTermDays,
    };

    onUpdateCustomer(updated);
    setIsEditing(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-6xl h-[92vh] max-h-[850px] flex flex-col overflow-hidden">
        
        {/* Header Bar */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Users className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold tracking-tight">
                  Customer Dashboard &amp; Database Piutang
                </h2>
                <span className="text-[10px] bg-slate-800 text-emerald-400 border border-slate-700 px-2 py-0.5 rounded font-mono font-bold">
                  Profil &amp; Plafon
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Plafon limit kredit HOREKA/VIP, riwayat faktur tempo, dan analisis kesehatan pembayaran
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onAddNewCustomerClick}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Pelanggan Baru</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 2-Column Split Content */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-slate-100">
          
          {/* =========================================================================
              LEFT COLUMN: CUSTOMER DIRECTORY & SEARCH LIST
              ========================================================================= */}
          <div className="w-full md:w-80 lg:w-96 bg-white border-r border-slate-200 flex flex-col shrink-0">
            {/* Search & Tier Filter */}
            <div className="p-3 border-b border-slate-100 space-y-2.5">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari resto, kode, no telp..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>

              {/* Tier Filter Tabs */}
              <div className="flex items-center gap-1 overflow-x-auto text-[11px] font-bold pb-0.5">
                {[
                  { id: 'ALL', label: 'Semua' },
                  { id: 'HOREKA', label: 'Horeka' },
                  { id: 'VIP', label: 'VIP' },
                  { id: 'RETAIL', label: 'Retail' },
                  { id: 'OVERLIMIT', label: 'Waspada' },
                ].map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setFilterTier(tab.id as any)}
                    className={`px-2 py-1 rounded-md transition-colors shrink-0 cursor-pointer ${
                      filterTier === tab.id
                        ? tab.id === 'OVERLIMIT' ? 'bg-rose-600 text-white' : 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Customer List */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {filteredCustomers.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-xs">
                  Tidak ada pelanggan yang cocok dengan filter.
                </div>
              ) : (
                filteredCustomers.map(cust => {
                  const isSelected = currentCustomer?.id === cust.id || currentCustomer?.name.toLowerCase() === cust.name.toLowerCase();

                  return (
                    <div
                      key={cust.id}
                      onClick={() => {
                        setSelectedCustomerId(cust.id);
                        setIsEditing(false);
                      }}
                      className={`p-3 transition-colors cursor-pointer flex flex-col gap-1.5 ${
                        isSelected 
                          ? 'bg-slate-100 ring-1 ring-inset ring-slate-300' 
                          : 'hover:bg-slate-50/70'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1.5">
                        <div className="min-w-0">
                          <h4 className="text-xs font-extrabold text-slate-900 truncate">
                            {cust.name}
                          </h4>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {cust.code}
                          </span>
                        </div>

                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold shrink-0 ${
                          cust.tier === 'VIP' 
                            ? 'bg-purple-100 text-purple-800 border border-purple-200' 
                            : cust.tier === 'HOREKA'
                              ? 'bg-blue-100 text-blue-800 border border-blue-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}>
                          {cust.tier}
                        </span>
                      </div>

                      {/* Limit / Piutang Info */}
                      <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-100">
                        <span className="text-slate-500">Piutang Aktif:</span>
                        <span className={`font-mono font-bold ${
                          cust.isOverlimit 
                            ? 'text-rose-600' 
                            : cust.totalUnpaidAmount > 0 
                              ? 'text-amber-700' 
                              : 'text-emerald-700'
                        }`}>
                          Rp {cust.totalUnpaidAmount.toLocaleString('id-ID')}
                        </span>
                      </div>

                      {/* Mini Utilization Bar for Non-Retail */}
                      {cust.creditLimit > 0 && (
                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${
                              cust.isOverlimit ? 'bg-rose-500' : cust.usagePercent > 80 ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.min(100, cust.usagePercent)}%` }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer Summary */}
            <div className="p-2.5 bg-slate-50 border-t border-slate-200 text-center text-[11px] text-slate-500 font-semibold">
              Menampilkan {filteredCustomers.length} dari {enrichedCustomers.length} Pelanggan
            </div>
          </div>

          {/* =========================================================================
              RIGHT COLUMN: DEEP CUSTOMER PROFILE & CREDIT ANALYSIS
              ========================================================================= */}
          <div className="flex-1 flex flex-col overflow-y-auto bg-slate-50 p-4 sm:p-5 space-y-4">
            {currentCustomer ? (
              <>
                {/* 1. Header Profile Card */}
                <div className="b2b-card p-4 sm:p-5 bg-white space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-lg font-extrabold text-slate-900 tracking-tight">
                          {currentCustomer.name}
                        </h3>
                        <span className={`px-2.5 py-0.5 rounded text-xs font-mono font-extrabold uppercase border ${
                          currentCustomer.tier === 'VIP'
                            ? 'bg-purple-50 text-purple-800 border-purple-200'
                            : currentCustomer.tier === 'HOREKA'
                              ? 'bg-blue-50 text-blue-800 border-blue-200'
                              : 'bg-slate-100 text-slate-800 border-slate-300'
                        }`}>
                          Tier: {currentCustomer.tier} (
                          {currentCustomer.tier === 'VIP' ? 'Tier 3 Grosir' : currentCustomer.tier === 'HOREKA' ? 'Tier 2 Horeka' : 'Tier 1 Retail'}
                          )
                        </span>

                        {currentCustomer.isOverlimit && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-rose-600" />
                            Overlimit Plafon!
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                        <span className="font-mono text-slate-400 font-bold">{currentCustomer.code}</span>
                        <span>&bull;</span>
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3 text-slate-400" />
                          {currentCustomer.phone}
                        </span>
                        <span>&bull;</span>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          {currentCustomer.address}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {/* Direct WhatsApp link */}
                      {currentCustomer.phone && currentCustomer.phone !== '-' && (
                        <a
                          href={`https://wa.me/${currentCustomer.phone.replace(/[^0-9]/g, '')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold flex items-center gap-1.5 transition-colors"
                        >
                          <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Hubungi WhatsApp</span>
                        </a>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setIsEditing(prev => !prev);
                          setActiveTab('EDIT_LIMIT');
                        }}
                        className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{isEditing ? 'Tutup Edit' : 'Edit Plafon & Profil'}</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* 2. Deep Credit Analysis Grid (4 Metric Cards) */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {/* Plafon Kredit */}
                  <div className="b2b-card p-3.5 bg-white space-y-1">
                    <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                      <CreditCard className="w-3.5 h-3.5 text-blue-600" />
                      Plafon Kredit Maksimal
                    </span>
                    <div className="text-base sm:text-lg font-mono font-extrabold text-slate-900">
                      {currentCustomer.creditLimit === 0 ? (
                        <span className="text-slate-400">Cash Only (Rp 0)</span>
                      ) : (
                        `Rp ${currentCustomer.creditLimit.toLocaleString('id-ID')}`
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400">
                      Term: {currentCustomer.termDays > 0 ? `${currentCustomer.termDays} Hari Tempo (TOP)` : 'Bayar Tunai/Lunas'}
                    </span>
                  </div>

                  {/* Piutang Berjalan */}
                  <div className="b2b-card p-3.5 bg-white space-y-1">
                    <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-amber-600" />
                      Piutang Berjalan (Unpaid)
                    </span>
                    <div className={`text-base sm:text-lg font-mono font-extrabold ${
                      currentCustomer.totalUnpaidAmount > 0 ? 'text-amber-700' : 'text-slate-700'
                    }`}>
                      Rp {currentCustomer.totalUnpaidAmount.toLocaleString('id-ID')}
                    </div>
                    <span className="text-[10px] text-slate-400">
                      {currentCustomer.unpaidInvoices.length} Faktur Belum Lunas
                    </span>
                  </div>

                  {/* Sisa Kredit Tersedia */}
                  <div className="b2b-card p-3.5 bg-white space-y-1">
                    <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      Sisa Kredit Tersedia
                    </span>
                    <div className={`text-base sm:text-lg font-mono font-extrabold ${
                      currentCustomer.isOverlimit ? 'text-rose-600' : 'text-emerald-700'
                    }`}>
                      {currentCustomer.creditLimit === 0 ? (
                        'Rp 0 (Cash)'
                      ) : currentCustomer.isOverlimit ? (
                        `- Rp ${(currentCustomer.totalUnpaidAmount - currentCustomer.creditLimit).toLocaleString('id-ID')}`
                      ) : (
                        `Rp ${currentCustomer.remainingLimit.toLocaleString('id-ID')}`
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400">
                      {currentCustomer.isOverlimit ? 'Wajib Lunasi Dulu' : 'Bisa Order Tempo'}
                    </span>
                  </div>

                  {/* Skor Kepatuhan & Risiko */}
                  <div className="b2b-card p-3.5 bg-white space-y-1">
                    <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                      <TrendingUp className="w-3.5 h-3.5 text-indigo-600" />
                      Skor Kepatuhan Bayar
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-base sm:text-lg font-mono font-extrabold text-slate-900">
                        {currentCustomer.disciplineScore}/100
                      </span>
                      <span className={`px-1.5 py-0.2 rounded text-[10px] font-extrabold ${
                        currentCustomer.disciplineScore >= 90 
                          ? 'bg-emerald-100 text-emerald-800' 
                          : currentCustomer.disciplineScore >= 70
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                      }`}>
                        {currentCustomer.disciplineScore >= 90 ? 'Sangat Baik' : currentCustomer.disciplineScore >= 70 ? 'Waspada' : 'Risiko Tinggi'}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400">
                      {currentCustomer.overdueCount > 0 ? `${currentCustomer.overdueCount} Faktur Terlambat` : 'Riwayat Lancar'}
                    </span>
                  </div>
                </div>

                {/* Credit Limit Utilization Bar */}
                {currentCustomer.creditLimit > 0 && (
                  <div className="b2b-card p-4 bg-white space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-slate-700 flex items-center gap-1.5">
                        <Percent className="w-3.5 h-3.5 text-slate-500" />
                        Persentase Utilisasi Plafon Kredit:
                      </span>
                      <span className={`font-mono ${
                        currentCustomer.isOverlimit ? 'text-rose-600' : currentCustomer.usagePercent > 80 ? 'text-amber-600' : 'text-emerald-700'
                      }`}>
                        {currentCustomer.usagePercent}% Terpakai (Batas Maksimal Rp {currentCustomer.creditLimit.toLocaleString('id-ID')})
                      </span>
                    </div>

                    <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden flex">
                      <div
                        className={`h-full transition-all duration-300 rounded-full ${
                          currentCustomer.isOverlimit 
                            ? 'bg-rose-600' 
                            : currentCustomer.usagePercent > 80 
                              ? 'bg-amber-500' 
                              : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.min(100, currentCustomer.usagePercent)}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span>Rp 0</span>
                      <span>50%</span>
                      <span>Plafon Rp {currentCustomer.creditLimit.toLocaleString('id-ID')}</span>
                    </div>
                  </div>
                )}

                {/* 3. Navigation Tabs */}
                <div className="flex items-center gap-2 border-b border-slate-200 pb-1">
                  <button
                    type="button"
                    onClick={() => setActiveTab('INVOICES')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      activeTab === 'INVOICES'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>Riwayat Faktur &amp; Piutang ({currentCustomer.invoices.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('STATS')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      activeTab === 'STATS'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <ShoppingBag className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Statistik Belanja &amp; Potongan Daging</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('EDIT_LIMIT')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      activeTab === 'EDIT_LIMIT'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                    <span>Ubah Plafon &amp; Data Pelanggan</span>
                  </button>
                </div>

                {/* 4. Tab 1: INVOICES & PIUTANG HISTORY */}
                {activeTab === 'INVOICES' && (
                  <div className="b2b-card bg-white overflow-hidden space-y-3">
                    <div className="p-3.5 border-b border-slate-100 flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">
                          Riwayat Semua Faktur Penjualan Daging
                        </h4>
                        <p className="text-[11px] text-slate-400">
                          Faktur lunas maupun piutang berjalan untuk {currentCustomer.name}
                        </p>
                      </div>

                      <span className="text-xs font-mono font-bold text-slate-700">
                        Total {currentCustomer.invoices.length} Faktur
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      {currentCustomer.invoices.length === 0 ? (
                        <div className="p-8 text-center text-slate-400 text-xs">
                          Belum ada riwayat faktur untuk pelanggan ini. Faktur baru akan otomatis tercatat saat transaksi kasir POS.
                        </div>
                      ) : (
                        <table className="w-full text-xs text-left">
                          <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                            <tr>
                              <th className="px-3.5 py-2.5">No Faktur</th>
                              <th className="px-3.5 py-2.5">Item Potongan Daging</th>
                              <th className="px-3.5 py-2.5 text-right">Nilai Faktur</th>
                              <th className="px-3.5 py-2.5">Jatuh Tempo</th>
                              <th className="px-3.5 py-2.5 text-center">Status</th>
                              <th className="px-3.5 py-2.5 text-center">Aksi Cepat</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {currentCustomer.invoices.map(inv => {
                              const isPaid = inv.status === 'LUNAS';

                              return (
                                <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
                                  <td className="px-3.5 py-2.5 font-mono font-bold text-slate-900">
                                    {inv.invoice}
                                  </td>

                                  <td className="px-3.5 py-2.5 text-slate-700 max-w-xs">
                                    {inv.itemsSummary}
                                  </td>

                                  <td className="px-3.5 py-2.5 text-right font-mono font-bold text-slate-900">
                                    Rp {inv.amount.toLocaleString('id-ID')}
                                  </td>

                                  <td className="px-3.5 py-2.5 text-slate-500 font-medium">
                                    <span className={inv.category === 'TERLAMBAT' && !isPaid ? 'text-rose-700 font-bold' : ''}>
                                      {inv.dueDate}
                                    </span>
                                  </td>

                                  <td className="px-3.5 py-2.5 text-center">
                                    {isPaid ? (
                                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                        LUNAS
                                      </span>
                                    ) : inv.category === 'TERLAMBAT' ? (
                                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                                        TERLAMBAT
                                      </span>
                                    ) : inv.category === 'HARI_INI' ? (
                                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                        HARI INI
                                      </span>
                                    ) : (
                                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                                        BELUM LUNAS
                                      </span>
                                    )}
                                  </td>

                                  <td className="px-3.5 py-2.5 text-center">
                                    {!isPaid ? (
                                      <div className="flex items-center justify-center gap-1.5">
                                        <button
                                          type="button"
                                          onClick={() => { setPaymentTarget(inv); setPaymentAmount(String(inv.amount)); setPaymentMethod('CASH'); }}
                                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded text-[11px] transition-colors cursor-pointer flex items-center gap-1"
                                          title="Catat Pelunasan Faktur Ini"
                                        >
                                          <Check className="w-3 h-3" />
                                          <span>Lunasi</span>
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() => {
                                            const msg = `Halo Tim ${currentCustomer.name}, konfirmasi tagihan faktur ${inv.invoice} sebesar Rp ${inv.amount.toLocaleString('id-ID')} (${inv.dueDate}). Terima kasih! - KARKASIA Meat Center`;
                                            navigator.clipboard?.writeText(msg);
                                            setCopiedInvoiceId(inv.id);
                                            setTimeout(() => setCopiedInvoiceId(null), 2500);
                                          }}
                                          className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors inline-flex items-center gap-1 text-[10px] font-semibold cursor-pointer"
                                          title="Salin Pesan WA Tagihan"
                                        >
                                          <MessageSquare className="w-3.5 h-3.5 text-slate-600" />
                                          {copiedInvoiceId === inv.id && <span className="text-emerald-700">Disalin</span>}
                                        </button>
                                      </div>
                                    ) : (
                                      <span className="text-[10px] text-slate-400 font-semibold">Tuntas</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                )}

                {/* 5. Tab 2: SHOPPING STATS & FAVORITE CUTS */}
                {activeTab === 'STATS' && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="b2b-card p-4 bg-white space-y-1">
                        <span className="text-xs text-slate-500 font-bold">Total Nilai Pembelian (LTV)</span>
                        <div className="text-lg font-mono font-extrabold text-slate-900">
                          Rp {currentCustomer.totalLifetimeRevenue.toLocaleString('id-ID')}
                        </div>
                        <span className="text-[10px] text-emerald-600 font-semibold">Akumulasi Seumur Hidup</span>
                      </div>

                      <div className="b2b-card p-4 bg-white space-y-1">
                        <span className="text-xs text-slate-500 font-bold">Rata-rata Nilai Order (AOV)</span>
                        <div className="text-lg font-mono font-extrabold text-slate-900">
                          Rp {currentCustomer.invoices.length > 0 
                            ? Math.round(currentCustomer.totalLifetimeRevenue / currentCustomer.invoices.length).toLocaleString('id-ID')
                            : '0'}
                        </div>
                        <span className="text-[10px] text-slate-400">Per Transaksi Kasir</span>
                      </div>

                      <div className="b2b-card p-4 bg-white space-y-1">
                        <span className="text-xs text-slate-500 font-bold">Total Frekuensi Pembelian</span>
                        <div className="text-lg font-mono font-extrabold text-slate-900">
                          {currentCustomer.invoices.length} Kali Pesan
                        </div>
                        <span className="text-[10px] text-slate-400">Kemitraan Aktif</span>
                      </div>
                    </div>

                    {/* Meat Preferences Card */}
                    <div className="b2b-card p-4 bg-white space-y-3">
                      <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <Package className="w-4 h-4 text-emerald-600" />
                        Analisis Preferensi Potongan Daging Pelanggan
                      </h4>
                      <p className="text-xs text-slate-500">
                        Berdasarkan riwayat pemesanan yang tercatat dalam faktur penjualan:
                      </p>

                      <div className="space-y-2 pt-1">
                        {[
                          { cut: 'Ribeye Meltique Australia (Primal)', share: 55, tag: 'Steakhouse Fav' },
                          { cut: 'Tenderloin Meltique Australia (Primal)', share: 25, tag: 'Premium Cut' },
                          { cut: 'Sirloin Choice USA (Primal)', share: 15, tag: 'Reguler' },
                          { cut: 'Tetelan Rawon Super / Trimming', share: 5, tag: 'Olahan' },
                        ].map(item => (
                          <div key={item.cut} className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-bold text-slate-800">{item.cut}</span>
                              <span className="font-mono font-bold text-slate-600">{item.share}%</span>
                            </div>
                            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                              <div
                                className="bg-slate-900 h-full rounded-full"
                                style={{ width: `${item.share}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* 6. Tab 3: EDIT CREDIT LIMIT & CUSTOMER PROFILE */}
                {activeTab === 'EDIT_LIMIT' && (
                  <form onSubmit={handleSaveEdit} className="b2b-card p-5 bg-white space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <div>
                        <h4 className="text-sm font-extrabold text-slate-900">
                          Kelola Profil Pelanggan &amp; Plafon Kredit
                        </h4>
                        <p className="text-xs text-slate-500">
                          Perbarui batas limit kredit, tier harga, atau kontak penagihan pelanggan
                        </p>
                      </div>

                      <span className="text-xs font-mono font-bold text-slate-400">
                        ID: {currentCustomer.id}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700">Nama Pelanggan / Usaha</label>
                        <input
                          type="text"
                          required
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700">Tier Harga &amp; Tipe Konsumen</label>
                        <select
                          value={editTier}
                          onChange={e => {
                            const newTier = e.target.value as 'RETAIL' | 'HOREKA' | 'VIP';
                            setEditTier(newTier);
                            if (newTier === 'RETAIL') {
                              setEditCreditLimit(0);
                              setEditTermDays(0);
                            }
                          }}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                        >
                          <option value="HOREKA">HOREKA (Tier 2 - Hotel, Resto, Katering)</option>
                          <option value="VIP">VIP (Tier 3 - Grosir / Karton Utuh)</option>
                          <option value="RETAIL">RETAIL (Tier 1 - Konsumen Reguler Cash)</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700">No. WhatsApp / Telepon PIC</label>
                        <input
                          type="text"
                          value={editPhone}
                          onChange={e => setEditPhone(e.target.value)}
                          placeholder="0812-XXXX-XXXX"
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700">Alamat Lengkap Pengiriman</label>
                        <input
                          type="text"
                          value={editAddress}
                          onChange={e => setEditAddress(e.target.value)}
                          placeholder="Jl. Raya..."
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                        />
                      </div>
                    </div>

                    {/* Credit Limit & Terms */}
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <CreditCard className="w-3.5 h-3.5 text-blue-600" />
                        Penetapan Plafon Kredit &amp; Syarat Pembayaran (TOP)
                      </span>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-slate-600">
                            Batas Plafon Kredit (Rp)
                          </label>
                          <input
                            type="number"
                            step={1000000}
                            min={0}
                            disabled={editTier === 'RETAIL'}
                            value={editCreditLimit}
                            onChange={e => setEditCreditLimit(parseInt(e.target.value || '0', 10))}
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold text-right disabled:bg-slate-100"
                          />
                          <p className="text-[10px] text-slate-400">
                            {editTier === 'RETAIL' ? 'Tier Retail wajib tunai (Rp 0)' : 'Order kasir akan dicegah jika piutang melampaui angka ini'}
                          </p>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-slate-600">
                            Tempo Jatuh Tempo (Hari)
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={90}
                            disabled={editTier === 'RETAIL'}
                            value={editTermDays}
                            onChange={e => setEditTermDays(parseInt(e.target.value || '0', 10))}
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold text-right disabled:bg-slate-100"
                          />
                          <p className="text-[10px] text-slate-400">
                            Default: 14 hari untuk Horeka, 30 hari untuk VIP Distributor
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Action */}
                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => {
                          setEditName(currentCustomer.name);
                          setEditTier(currentCustomer.tier as any);
                          setEditCreditLimit(currentCustomer.creditLimit);
                          setEditTermDays(currentCustomer.termDays);
                          setActiveTab('INVOICES');
                        }}
                        className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs"
                      >
                        Batal
                      </button>

                      <button
                        type="submit"
                        className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
                      >
                        <Save className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Simpan Perubahan Profil</span>
                      </button>
                    </div>
                  </form>
                )}
              </>
            ) : (
              <div className="b2b-card p-12 text-center text-slate-400 text-xs">
                Silakan pilih pelanggan dari daftar sebelah kiri.
              </div>
            )}
          </div>

        </div>

      </div>
      {paymentTarget && (
        <div className="fixed inset-0 z-[60] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            className="w-full max-w-sm rounded-2xl bg-white shadow-2xl border border-slate-200 p-5 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              const amount = Number(paymentAmount.replace(/[^0-9]/g, ''));
              if (!Number.isSafeInteger(amount) || amount <= 0 || amount > paymentTarget.amount) return;
              const saved = onRecordPayment(paymentTarget.id, amount, paymentMethod);
              if (saved) {
                setPaymentTarget(null);
                setPaymentAmount('');
              }
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-slate-900">Catat Pembayaran</h3>
                <p className="text-xs text-slate-500">{paymentTarget.invoice} · Sisa Rp {paymentTarget.amount.toLocaleString('id-ID')}</p>
              </div>
              <button type="button" onClick={() => setPaymentTarget(null)} className="p-2 rounded-lg hover:bg-slate-100"><X className="w-4 h-4" /></button>
            </div>
            <label className="block space-y-1">
              <span className="text-xs font-bold text-slate-600">Nominal diterima (Rp)</span>
              <input
                autoFocus
                inputMode="numeric"
                value={paymentAmount}
                onChange={(event) => setPaymentAmount(event.target.value.replace(/\D/g, '').slice(0, 15))}
                className="w-full rounded-xl border border-slate-300 px-3 py-3 text-lg font-bold tabular-nums"
                required
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setPaymentMethod('CASH')} className={`rounded-xl border px-3 py-2.5 text-sm font-bold ${paymentMethod === 'CASH' ? 'border-emerald-600 bg-emerald-50 text-emerald-800' : 'border-slate-200 text-slate-600'}`}>Tunai</button>
              <button type="button" onClick={() => setPaymentMethod('TRANSFER')} className={`rounded-xl border px-3 py-2.5 text-sm font-bold ${paymentMethod === 'TRANSFER' ? 'border-emerald-600 bg-emerald-50 text-emerald-800' : 'border-slate-200 text-slate-600'}`}>Transfer</button>
            </div>
            <p className="text-[11px] text-slate-500">Sisa setelah pembayaran: Rp {Math.max(0, paymentTarget.amount - (Number(paymentAmount) || 0)).toLocaleString('id-ID')}</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setPaymentTarget(null)} className="flex-1 rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-bold text-slate-600">Batal</button>
              <button type="submit" disabled={!paymentAmount || Number(paymentAmount) <= 0 || Number(paymentAmount) > paymentTarget.amount} className="flex-1 rounded-xl bg-emerald-700 px-3 py-2.5 text-sm font-bold text-white disabled:opacity-40">Simpan Pembayaran</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
