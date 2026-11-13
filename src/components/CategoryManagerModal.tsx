import React, { useState } from 'react';
import {
  X,
  Tags,
  Plus,
  Trash2,
  CheckCircle2,
  Layers,
  Palette,
  PackageCheck
} from 'lucide-react';

export interface ProductCategory {
  id: string;
  label: string;
  description?: string;
  color: 'emerald' | 'blue' | 'amber' | 'rose' | 'purple' | 'cyan' | 'indigo' | 'slate';
  isCore?: boolean;
}

export interface CategoryManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: ProductCategory[];
  onAddCategory: (category: ProductCategory) => void;
  onDeleteCategory: (categoryId: string) => void;
  productCountPerCategory?: Record<string, number>;
}

const COLOR_MAP: Record<ProductCategory['color'], { bg: string; text: string; border: string; dot: string }> = {
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  blue: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' },
  rose: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', dot: 'bg-rose-500' },
  purple: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', dot: 'bg-purple-500' },
  cyan: { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200', dot: 'bg-cyan-500' },
  indigo: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', dot: 'bg-indigo-500' },
  slate: { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300', dot: 'bg-slate-500' },
};

export const CategoryManagerModal: React.FC<CategoryManagerModalProps> = ({
  isOpen,
  onClose,
  categories,
  onAddCategory,
  onDeleteCategory,
  productCountPerCategory = {},
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newId, setNewId] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newColor, setNewColor] = useState<ProductCategory['color']>('blue');
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleLabelChange = (val: string) => {
    setNewLabel(val);
    if (!newId) {
      const code = val.trim().toUpperCase().replace(/[^A-Z0-9]/g, '_').slice(0, 16);
      setNewId(code);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLabel.trim()) return;

    const finalId = newId.trim().toUpperCase() || `CAT_${Date.now().toString().slice(-4)}`;
    
    // Check if ID exists
    if (categories.some(c => c.id === finalId)) {
      setFormError(`Kategori dengan kode '${finalId}' sudah terdaftar. Gunakan kode lain.`);
      return;
    }
    setFormError(null);

    onAddCategory({
      id: finalId,
      label: newLabel.trim(),
      description: newDesc.trim() || undefined,
      color: newColor,
      isCore: false,
    });

    setNewId('');
    setNewLabel('');
    setNewDesc('');
    setShowAddForm(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Tags className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-base font-extrabold tracking-tight">
                Kelola Kategori Master Produk
              </h2>
              <p className="text-xs text-slate-400">
                Tambah, atur, dan kelompokkan jenis potongan daging &amp; produk dingin
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          
          {/* Action to Toggle Form */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700">
                Total Kategori Terdaftar: {categories.length}
              </span>
            </div>

            {!showAddForm && (
              <button
                type="button"
                onClick={() => setShowAddForm(true)}
                className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-emerald-400" />
                <span>+ Kategori Baru</span>
              </button>
            )}
          </div>

          {/* Add Category Form */}
          {showAddForm && (
            <form onSubmit={handleFormSubmit} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 animate-fade-in">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-emerald-600" />
                  Tambah Kategori Baru
                </span>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="text-xs text-slate-500 hover:text-slate-800"
                >
                  Batal
                </button>
              </div>

              {formError && (
                <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700">
                    Nama Kategori <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newLabel}
                    onChange={e => handleLabelChange(e.target.value)}
                    placeholder="Contoh: Bone-In (Iga & Buntut)"
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold focus:ring-1 focus:ring-slate-900 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700">
                    Kode Kategori (ID) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newId}
                    onChange={e => setNewId(e.target.value.toUpperCase().replace(/\s+/g, '_'))}
                    placeholder="BONE_IN"
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold focus:ring-1 focus:ring-slate-900 focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700">Keterangan / Peruntukan</label>
                <input
                  type="text"
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                  placeholder="Contoh: Iga konro, short ribs, oxtail buntut, dan sumsum tulang"
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-slate-900 focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                  <Palette className="w-3.5 h-3.5 text-slate-500" />
                  Warna Label Badge
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  {(['emerald', 'blue', 'amber', 'rose', 'purple', 'cyan', 'indigo', 'slate'] as const).map(color => {
                    const style = COLOR_MAP[color];
                    const isSelected = newColor === color;
                    return (
                      <button
                        type="button"
                        key={color}
                        onClick={() => setNewColor(color)}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${style.bg} ${style.text} ${style.border} ${
                          isSelected ? 'ring-2 ring-slate-900 ring-offset-1 font-extrabold' : 'opacity-70 hover:opacity-100'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${style.dot}`} />
                        <span className="capitalize">{color}</span>
                        {isSelected && <CheckCircle2 className="w-3 h-3 text-slate-900 ml-0.5" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Simpan Kategori Baru
                </button>
              </div>
            </form>
          )}

          {/* Categories Grid Table */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {categories.map(cat => {
              const colorStyle = COLOR_MAP[cat.color] || COLOR_MAP.slate;
              const count = productCountPerCategory[cat.id] || 0;

              return (
                <div
                  key={cat.id}
                  className="p-3.5 bg-white border border-slate-200 rounded-xl hover:border-slate-300 transition-all flex flex-col justify-between gap-2 shadow-2xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-extrabold uppercase border ${colorStyle.bg} ${colorStyle.text} ${colorStyle.border}`}>
                          {cat.id}
                        </span>
                        {cat.isCore && (
                          <span className="text-[10px] text-slate-400 font-medium">Bawaan Sistem</span>
                        )}
                      </div>
                      <h3 className="text-xs font-bold text-slate-900 mt-1">
                        {cat.label}
                      </h3>
                      {cat.description && (
                        <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">
                          {cat.description}
                        </p>
                      )}
                    </div>

                    {!cat.isCore && (
                      confirmDeleteId === cat.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              onDeleteCategory(cat.id);
                              setConfirmDeleteId(null);
                            }}
                            className="min-h-[36px] px-2.5 py-1 rounded-md bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold cursor-pointer"
                          >
                            Hapus
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="min-h-[36px] px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold cursor-pointer"
                          >
                            Batal
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(cat.id)}
                          className="min-w-[36px] min-h-[36px] p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors flex items-center justify-center cursor-pointer"
                          title="Hapus Kategori"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[11px] pt-2 border-t border-slate-100 text-slate-500">
                    <span className="flex items-center gap-1 font-medium">
                      <PackageCheck className="w-3.5 h-3.5 text-slate-400" />
                      Jumlah Barang:
                    </span>
                    <span className="font-mono font-bold text-slate-800">
                      {count} barang
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <p className="text-xs text-slate-500">
            Kategori yang dibuat otomatis tampil di filter Kasir POS, Gudang, PO, dan Tambah Produk
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs"
          >
            Tutup
          </button>
        </div>

      </div>
    </div>
  );
};
