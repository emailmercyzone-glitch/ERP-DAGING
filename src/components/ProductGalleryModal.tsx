import React, { useState, useEffect } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Camera,
  Upload,
  ShoppingCart,
  Check,
  Tag,
  Scale,
  Sparkles,
  Layers,
  Plus,
  Trash2,
  Eye,
  Box
} from 'lucide-react';

export interface ProductGalleryItem {
  url: string;
  title: string;
  tag: string;
}

export interface ProductGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: {
    id: string;
    sku: string;
    name: string;
    basePricePerKg: number;
    imageUrl?: string;
    category?: string;
    stockGram?: number;
    safetyStockGram?: number;
    tag?: string;
    gallery?: ProductGalleryItem[];
    tierPrices?: {
      RETAIL: number;
      HOREKA: number;
      VIP: number;
    };
  } | null;
  customerTier?: string;
  onAddToCart?: (product: any, weightGram: number) => void;
  onUpdateGallery?: (productId: string, newGallery: ProductGalleryItem[]) => void;
}

const DEFAULT_MEAT_ANGLES: ProductGalleryItem[] = [
  {
    url: 'https://images.unsplash.com/photo-1603048588665-791ca8aea617?w=900&auto=format&fit=crop&q=80',
    title: 'Tampak Depan Cut View (Marbling Level 4+)',
    tag: 'Marbling Cut'
  },
  {
    url: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=900&auto=format&fit=crop&q=80',
    title: 'Kemasan Vacuum Pack Master Carton Box 20 KG',
    tag: 'Vacuum Pack'
  },
  {
    url: 'https://images.unsplash.com/photo-1558030006-450675393462?w=900&auto=format&fit=crop&q=80',
    title: 'Sajian Pan-Seared Steak / Hasil Masak',
    tag: 'Grill / Cooking'
  },
  {
    url: 'https://images.unsplash.com/photo-1588168333986-5078d3ae3976?w=900&auto=format&fit=crop&q=80',
    title: 'Label Sertifikasi Halal, Batch Code & Expiry',
    tag: 'Label & Karton'
  }
];

export const ProductGalleryModal: React.FC<ProductGalleryModalProps> = ({
  isOpen,
  onClose,
  product,
  customerTier = 'RETAIL',
  onAddToCart,
  onUpdateGallery,
}) => {
  const [gallery, setGallery] = useState<ProductGalleryItem[]>(DEFAULT_MEAT_ANGLES);
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [selectedGram, setSelectedGram] = useState<number>(1000);
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [newPhotoUrl, setNewPhotoUrl] = useState<string>('');
  const [newPhotoTitle, setNewPhotoTitle] = useState<string>('');
  const [newPhotoTag, setNewPhotoTag] = useState<string>('Sudut Pandang Lain');

  useEffect(() => {
    if (product) {
      if (product.gallery && product.gallery.length > 0) {
        setGallery(product.gallery);
      } else {
        // Construct standard 4-angle gallery based on main image
        const mainImg = product.imageUrl || 'https://images.unsplash.com/photo-1603048588665-791ca8aea617?w=900&auto=format&fit=crop&q=80';
        setGallery([
          { url: mainImg, title: `Potongan Utama ${product.name}`, tag: 'Potongan Utama' },
          ...DEFAULT_MEAT_ANGLES.slice(1)
        ]);
      }
      setActiveIndex(0);
      setSelectedGram(1000);
    }
  }, [product]);

  if (!isOpen || !product) return null;

  const currentItem = gallery[activeIndex] || gallery[0] || {
    url: product.imageUrl || 'https://images.unsplash.com/photo-1603048588665-791ca8aea617?w=900&auto=format&fit=crop&q=80',
    title: product.name,
    tag: 'Utama'
  };

  const handleNext = () => {
    setActiveIndex((prev) => (prev + 1) % gallery.length);
  };

  const handlePrev = () => {
    setActiveIndex((prev) => (prev - 1 + gallery.length) % gallery.length);
  };

  const handleAddPhoto = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPhotoUrl.trim()) return;
    const newItem: ProductGalleryItem = {
      url: newPhotoUrl.trim(),
      title: newPhotoTitle.trim() || `Sudut Foto ${gallery.length + 1}`,
      tag: newPhotoTag.trim() || 'Sudut Baru'
    };
    const updated = [...gallery, newItem];
    setGallery(updated);
    if (onUpdateGallery) {
      onUpdateGallery(product.id, updated);
    }
    setActiveIndex(updated.length - 1);
    setNewPhotoUrl('');
    setNewPhotoTitle('');
    setShowAddForm(false);
  };

  const handleDeletePhoto = (indexToDelete: number) => {
    if (gallery.length <= 1) return;
    const updated = gallery.filter((_, idx) => idx !== indexToDelete);
    setGallery(updated);
    if (onUpdateGallery) {
      onUpdateGallery(product.id, updated);
    }
    setActiveIndex(Math.min(activeIndex, updated.length - 1));
  };

  const stockKg = ((product.stockGram || 45000) / 1000).toFixed(1);
  const retailPrice = product.tierPrices?.RETAIL || product.basePricePerKg;
  const horekaPrice = product.tierPrices?.HOREKA || Math.round(product.basePricePerKg * 0.9);
  const vipPrice = product.tierPrices?.VIP || Math.round(product.basePricePerKg * 0.82);

  const activePricePerKg = customerTier === 'VIP' ? vipPrice : customerTier === 'HOREKA' ? horekaPrice : retailPrice;
  const totalPrice = Math.round((selectedGram * activePricePerKg) / 1000);

  return (
    <>
      <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-fade-in">
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh]">
          
          {/* Header Bar */}
          <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <span className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <Layers className="w-5 h-5" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-extrabold tracking-tight">{product.name}</h3>
                  {product.category && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-800 text-emerald-400 border border-slate-700">
                      {product.category}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 font-mono">
                  {product.sku} • Stok: {stockKg} KG ({(product.stockGram || 45000).toLocaleString('id-ID')} g)
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Tutup Modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Main Body Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 overflow-y-auto divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
            
            {/* LEFT / TOP: CAROUSEL GALLERY VIEWER (7 COLS) */}
            <div className="lg:col-span-7 p-4 sm:p-5 flex flex-col justify-between space-y-4 bg-slate-950 text-white">
              
              {/* Main Image Display Box */}
              <div className="relative aspect-4/3 w-full rounded-xl bg-slate-900 overflow-hidden border border-slate-800 group shadow-lg flex items-center justify-center">
                <img
                  src={currentItem.url}
                  alt={currentItem.title}
                  className="w-full h-full object-cover transition-all duration-300 group-hover:scale-102"
                />

                {/* Overlaid Angle Tag & Counter */}
                <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2 z-10">
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-900/90 text-emerald-400 border border-emerald-500/30 backdrop-blur-md flex items-center gap-1.5 shadow-md">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{currentItem.tag}</span>
                  </span>
                  
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-mono font-bold bg-slate-900/80 text-white backdrop-blur-md border border-slate-700">
                    {activeIndex + 1} / {gallery.length}
                  </span>
                </div>

                {/* Title Overlay at Bottom */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950 via-slate-950/70 to-transparent p-4 pt-8 text-xs font-medium text-slate-200">
                  <p className="line-clamp-2">{currentItem.title}</p>
                </div>

                {/* Prev & Next Carousel Arrow Buttons */}
                {gallery.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={handlePrev}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 p-2 rounded-full bg-slate-900/80 hover:bg-emerald-600 text-white backdrop-blur-md border border-slate-700 transition-all cursor-pointer shadow-lg hover:scale-110"
                      title="Foto Sebelum-nya"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      type="button"
                      onClick={handleNext}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-2 rounded-full bg-slate-900/80 hover:bg-emerald-600 text-white backdrop-blur-md border border-slate-700 transition-all cursor-pointer shadow-lg hover:scale-110"
                      title="Foto Berikut-nya"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </>
                )}

                {/* Fullscreen Zoom Trigger Button */}
                <button
                  type="button"
                  onClick={() => setIsFullscreen(true)}
                  className="absolute bottom-3 right-3 p-2 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-white backdrop-blur-md border border-slate-700 transition-all cursor-pointer text-xs font-bold flex items-center gap-1.5 shadow-md"
                  title="Lihat Fullscreen Zoom Detail"
                >
                  <Maximize2 className="w-4 h-4 text-emerald-400" />
                  <span className="hidden sm:inline">Zoom Fullscreen</span>
                </button>
              </div>

              {/* Thumbnails Carousel Bar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-bold flex items-center gap-1.5 text-slate-300">
                    <Camera className="w-4 h-4 text-emerald-400" />
                    Sudut Pandang Produk ({gallery.length} Foto)
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowAddForm(!showAddForm)}
                    className="text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 transition-colors text-[11px]"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Tambah Sudut Foto</span>
                  </button>
                </div>

                {/* Thumbnail List */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1.5 pt-0.5 scrollbar-thin">
                  {gallery.map((item, idx) => (
                    <div key={idx} className="relative group shrink-0">
                      <button
                        type="button"
                        onClick={() => setActiveIndex(idx)}
                        className={`relative w-16 h-16 rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                          activeIndex === idx
                            ? 'border-emerald-500 ring-2 ring-emerald-500/50 scale-105'
                            : 'border-slate-800 hover:border-slate-600 opacity-70 hover:opacity-100'
                        }`}
                      >
                        <img src={item.url} alt={item.title} className="w-full h-full object-cover" />
                        <span className="absolute bottom-0 inset-x-0 bg-slate-900/80 text-[8px] font-bold text-center py-0.5 truncate text-slate-300">
                          {item.tag}
                        </span>
                      </button>

                      {gallery.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleDeletePhoto(idx)}
                          className="absolute -top-1 -right-1 p-0.5 rounded-full bg-rose-600 text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shadow-xs"
                          title="Hapus sudut foto ini"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Add Photo Form Inline */}
                {showAddForm && (
                  <form onSubmit={handleAddPhoto} className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-2.5 text-xs animate-fade-in">
                    <div className="font-bold text-emerald-400 flex items-center justify-between">
                      <span>Tambah Sudut Pandang Foto Daging Baru</span>
                      <button type="button" onClick={() => setShowAddForm(false)} className="text-slate-500 hover:text-white">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <input
                      type="url"
                      required
                      value={newPhotoUrl}
                      onChange={e => setNewPhotoUrl(e.target.value)}
                      placeholder="URL Gambar (https://...)"
                      className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs font-mono focus:ring-1 focus:ring-emerald-500"
                    />

                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={newPhotoTitle}
                        onChange={e => setNewPhotoTitle(e.target.value)}
                        placeholder="Keterangan (mis: Tampak Samping)"
                        className="px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs"
                      />
                      <input
                        type="text"
                        value={newPhotoTag}
                        onChange={e => setNewPhotoTag(e.target.value)}
                        placeholder="Tag (mis: Side View)"
                        className="px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Simpan Sudut Foto ke Galeri</span>
                    </button>
                  </form>
                )}
              </div>

            </div>

            {/* RIGHT: PRODUCT DETAILS & QUICK ORDER PANEL (5 COLS) */}
            <div className="lg:col-span-5 p-5 flex flex-col justify-between space-y-5 bg-white">
              
              <div className="space-y-4">
                {/* Product Name & SKU */}
                <div>
                  <h4 className="text-lg font-black text-slate-900 leading-tight">{product.name}</h4>
                  <p className="text-xs font-mono text-slate-500 mt-0.5 flex items-center gap-2">
                    <span>{product.sku}</span>
                    <span>•</span>
                    <span className="text-emerald-700 font-bold">KARKASIA Import Grade</span>
                  </p>
                </div>

                {/* Price Tiers Matrix */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                    <span>Struktur Harga Bertingkat</span>
                    <span className="text-emerald-700 font-extrabold">Per KG</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className={`p-2 rounded-lg border text-center transition-all ${
                      customerTier === 'RETAIL' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-800 border-slate-200'
                    }`}>
                      <div className="text-[10px] opacity-75 font-bold">RETAIL</div>
                      <div className="text-xs font-mono font-extrabold mt-0.5">
                        Rp {retailPrice.toLocaleString('id-ID')}
                      </div>
                    </div>

                    <div className={`p-2 rounded-lg border text-center transition-all ${
                      customerTier === 'HOREKA' ? 'bg-blue-600 text-white border-blue-600' : 'bg-blue-50/70 text-blue-900 border-blue-200'
                    }`}>
                      <div className="text-[10px] opacity-75 font-bold">HOREKA</div>
                      <div className="text-xs font-mono font-extrabold mt-0.5">
                        Rp {horekaPrice.toLocaleString('id-ID')}
                      </div>
                    </div>

                    <div className={`p-2 rounded-lg border text-center transition-all ${
                      customerTier === 'VIP' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-emerald-50/70 text-emerald-900 border-emerald-200'
                    }`}>
                      <div className="text-[10px] opacity-75 font-bold">VIP GROSIR</div>
                      <div className="text-xs font-mono font-extrabold mt-0.5">
                        Rp {vipPrice.toLocaleString('id-ID')}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Meat Information Highlights */}
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500 flex items-center gap-1.5">
                      <Box className="w-3.5 h-3.5 text-slate-400" /> Kategori Stock
                    </span>
                    <span className="font-bold text-slate-900">{product.category || 'PRIMAL'}</span>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500 flex items-center gap-1.5">
                      <Scale className="w-3.5 h-3.5 text-slate-400" /> Sisa Stok Cold Storage
                    </span>
                    <span className="font-mono font-bold text-slate-900">
                      {stockKg} KG ({(product.stockGram || 45000).toLocaleString('id-ID')} gram)
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500 flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-slate-400" /> Status Penjualan
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                      {product.tag || 'Best Seller'}
                    </span>
                  </div>
                </div>

                {/* Weight Selector for POS Checkout Direct */}
                <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-2.5">
                  <div className="flex items-center justify-between text-xs font-bold text-emerald-950">
                    <span className="flex items-center gap-1.5">
                      <Scale className="w-4 h-4 text-emerald-700" />
                      Pilih Bobot Timbangan Kasir:
                    </span>
                    <span className="font-mono text-emerald-800">{(selectedGram / 1000).toFixed(2)} KG</span>
                  </div>

                  {/* Preset Gram Chips */}
                  <div className="grid grid-cols-4 gap-1.5">
                    {[500, 1000, 2000, 5000].map((gram) => (
                      <button
                        key={gram}
                        type="button"
                        onClick={() => setSelectedGram(gram)}
                        className={`py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                          selectedGram === gram
                            ? 'bg-emerald-700 text-white shadow-xs'
                            : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {gram >= 1000 ? `${gram / 1000} KG` : `${gram}g`}
                      </button>
                    ))}
                  </div>

                  {/* Manual Input Slider or Number */}
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step={100}
                      min={100}
                      max={100000}
                      value={selectedGram}
                      onChange={e => setSelectedGram(Math.max(100, parseInt(e.target.value || '1000', 10)))}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 focus:ring-1 focus:ring-emerald-600"
                    />
                    <span className="text-xs font-mono text-slate-500 font-bold shrink-0">gram</span>
                  </div>

                  {/* Total price readout */}
                  <div className="pt-1.5 border-t border-emerald-200 flex items-center justify-between text-xs">
                    <span className="text-slate-600 font-bold">Subtotal Timbangan:</span>
                    <span className="text-base font-mono font-black text-emerald-900">
                      Rp {totalPrice.toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons Footer */}
              <div className="space-y-2 pt-3 border-t border-slate-200">
                {onAddToCart && (
                  <button
                    type="button"
                    onClick={() => {
                      onAddToCart(product, selectedGram);
                      onClose();
                    }}
                    className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
                  >
                    <ShoppingCart className="w-4 h-4 text-emerald-400" />
                    <span>Tambah {(selectedGram / 1000).toFixed(1)} KG ke Keranjang Kasir</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={onClose}
                  className="w-full py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs transition-colors"
                >
                  Tutup Galeri
                </button>
              </div>

            </div>

          </div>

        </div>
      </div>

      {/* FULLSCREEN LIGHTBOX ZOOM MODAL */}
      {isFullscreen && (
        <div className="fixed inset-0 z-60 bg-black/95 backdrop-blur-md flex flex-col items-center justify-between p-4 animate-fade-in">
          <div className="w-full flex items-center justify-between text-white px-4 py-2">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-600 text-white">
                {currentItem.tag}
              </span>
              <span className="text-sm font-bold text-slate-300">{currentItem.title}</span>
            </div>

            <button
              type="button"
              onClick={() => setIsFullscreen(false)}
              className="p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-white transition-colors cursor-pointer"
              title="Keluar Fullscreen"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="relative flex-1 w-full max-w-5xl flex items-center justify-center p-2">
            <img
              src={currentItem.url}
              alt={currentItem.title}
              className="max-h-[82vh] max-w-full object-contain rounded-lg shadow-2xl"
            />

            {gallery.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={handlePrev}
                  className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-slate-900/80 hover:bg-emerald-600 text-white border border-slate-700 shadow-xl cursor-pointer"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-slate-900/80 hover:bg-emerald-600 text-white border border-slate-700 shadow-xl cursor-pointer"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </>
            )}
          </div>

          <div className="text-center text-xs text-slate-400 font-mono py-2">
            Foto {activeIndex + 1} dari {gallery.length} • Gunakan panah atau thumbnail untuk berpindah sudut foto
          </div>
        </div>
      )}
    </>
  );
};
