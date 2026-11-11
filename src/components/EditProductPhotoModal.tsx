import React, { useState, useRef } from 'react';
import {
  X,
  Camera,
  Upload,
  Save,
  Check,
  Image as ImageIcon
} from 'lucide-react';

export interface EditProductPhotoModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: {
    id: string;
    name: string;
    sku: string;
    imageUrl?: string;
  } | null;
  onSavePhoto: (productId: string, newImageUrl: string) => void;
}

const PRESET_MEAT_IMAGES = [
  { name: 'Ribeye Steak', url: 'https://images.unsplash.com/photo-1603048297172-c92544798d5a?w=400&auto=format&fit=crop&q=80' },
  { name: 'Sirloin USA', url: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=400&auto=format&fit=crop&q=80' },
  { name: 'Shortplate Slice', url: 'https://images.unsplash.com/photo-1588168333986-5078d3ae3976?w=400&auto=format&fit=crop&q=80' },
  { name: 'Tetelan Rawon', url: 'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=400&auto=format&fit=crop&q=80' },
  { name: 'Wagyu Beef', url: 'https://images.unsplash.com/photo-1558030006-450675393462?w=400&auto=format&fit=crop&q=80' },
];

export const EditProductPhotoModal: React.FC<EditProductPhotoModalProps> = ({
  isOpen,
  onClose,
  product,
  onSavePhoto,
}) => {
  const [imageUrl, setImageUrl] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    if (product) {
      setImageUrl(product.imageUrl || 'https://images.unsplash.com/photo-1603048297172-c92544798d5a?w=400&auto=format&fit=crop&q=80');
    }
  }, [product]);

  if (!isOpen || !product) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setImageUrl(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    onSavePhoto(product.id, imageUrl.trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
        
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Camera className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-base font-extrabold tracking-tight">
                Kelola Foto Produk Daging
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                {product.sku} • {product.name}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Batal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          <div className="flex flex-col items-center justify-center gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="relative w-32 h-32 rounded-xl bg-slate-200 border-2 border-slate-300 overflow-hidden shadow-md group">
              {imageUrl ? (
                <img src={imageUrl} alt="Foto Produk" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                  <ImageIcon className="w-8 h-8 mb-1" />
                  <span className="text-xs">Belum ada foto</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept="image/*"
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Foto dari Perangkat</span>
              </button>

              {imageUrl && (
                <button
                  type="button"
                  onClick={() => setImageUrl('')}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 text-xs font-semibold"
                >
                  Hapus
                </button>
              )}
            </div>
          </div>

          {/* URL Input */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">Link URL Foto</label>
            <input
              type="url"
              value={imageUrl}
              onChange={e => setImageUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono focus:bg-white focus:ring-1 focus:ring-slate-900 focus:outline-none"
            />
          </div>

          {/* Presets */}
          <div className="space-y-1.5 pt-1 border-t border-slate-100">
            <label className="text-[11px] font-bold text-slate-500">Pilih dari Sampel Foto Daging Import:</label>
            <div className="grid grid-cols-2 gap-1.5">
              {PRESET_MEAT_IMAGES.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setImageUrl(preset.url)}
                  className={`p-1.5 rounded-lg border text-left flex items-center gap-2 transition-all cursor-pointer ${
                    imageUrl === preset.url
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-bold'
                      : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <img src={preset.url} alt={preset.name} className="w-7 h-7 rounded object-cover shrink-0" />
                  <span className="text-[10px] truncate flex-1">{preset.name}</span>
                  {imageUrl === preset.url && <Check className="w-3 h-3 text-emerald-600 shrink-0" />}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs transition-colors"
            >
              Batal
            </button>

            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs transition-all flex items-center gap-2 shadow-sm"
            >
              <Save className="w-3.5 h-3.5 text-emerald-400" />
              Simpan Foto Produk
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
