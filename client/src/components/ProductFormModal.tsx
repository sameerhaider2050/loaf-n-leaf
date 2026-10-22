import React, { useState, useEffect } from 'react';
import { X, Check, AlertCircle } from 'lucide-react';
import { Product, Category } from '../types';

interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (product: Partial<Product>) => Promise<void>;
  product?: Product | null;
  categories: Category[];
}

export const ProductFormModal: React.FC<ProductFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  product,
  categories,
}) => {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [category, setCategory] = useState('burgers');
  const [price, setPrice] = useState('');
  const [cost, setCost] = useState('');
  const [available, setAvailable] = useState(true);
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (product) {
      setName(product.name);
      setCode(product.code);
      setCategory(product.category);
      setPrice(String(product.price));
      setCost(String(product.cost || 0));
      setAvailable(product.available === 1);
      setDescription(product.description || '');
    } else {
      setName('');
      setCode('');
      setCategory(categories.length > 1 ? categories[1].slug : 'burgers');
      setPrice('');
      setCost('');
      setAvailable(true);
      setDescription('');
    }
    setError('');
  }, [product, categories, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Product name is required');
      return;
    }
    const numPrice = parseFloat(price);
    if (isNaN(numPrice) || numPrice < 0) {
      setError('Valid price is required');
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');
      await onSave({
        name: name.trim(),
        code: code.trim(),
        category,
        price: numPrice,
        cost: parseFloat(cost) || 0,
        available: available ? 1 : 0,
        description: description.trim(),
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save product');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[1px]">
      <div 
        className="bg-white rounded-lg border border-[#E5E7EB] shadow-modal w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E7EB] bg-[#F8F9FA]">
          <h3 className="text-sm font-semibold text-[#171717]">
            {product ? 'Edit Product' : 'Add New Product'}
          </h3>
          <button
            onClick={onClose}
            className="text-[#737373] hover:text-[#171717] p-1 rounded hover:bg-[#E5E7EB]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3.5 text-xs">
          {error && (
            <div className="p-2.5 rounded bg-[#FEF2F2] border border-[#FCA5A5] text-[#DC2626] flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block font-medium text-[#171717] mb-1">
              Product Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Gourmet Beef Smash Burger"
              className="w-full px-3 py-2 border border-[#E5E7EB] rounded focus:outline-none focus:border-[#2563EB]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-[#171717] mb-1">
                Product Code / SKU
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. BRG-06"
                className="w-full px-3 py-2 border border-[#E5E7EB] rounded focus:outline-none focus:border-[#2563EB]"
              />
            </div>

            <div>
              <label className="block font-medium text-[#171717] mb-1">
                Category *
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 border border-[#E5E7EB] rounded focus:outline-none focus:border-[#2563EB] bg-white capitalize"
              >
                {categories.filter(c => c.slug !== 'all').map((cat) => (
                  <option key={cat.id} value={cat.slug}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-[#171717] mb-1">
                Selling Price (PKR) *
              </label>
              <input
                type="number"
                min="0"
                step="10"
                required
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="e.g. 950"
                className="w-full px-3 py-2 border border-[#E5E7EB] rounded focus:outline-none focus:border-[#2563EB]"
              />
            </div>

            <div>
              <label className="block font-medium text-[#171717] mb-1">
                Cost Price (PKR)
              </label>
              <input
                type="number"
                min="0"
                step="10"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                placeholder="e.g. 450"
                className="w-full px-3 py-2 border border-[#E5E7EB] rounded focus:outline-none focus:border-[#2563EB]"
              />
            </div>
          </div>

          <div>
            <label className="block font-medium text-[#171717] mb-1">
              Description / Ingredients
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short description for cashier reference..."
              className="w-full px-3 py-2 border border-[#E5E7EB] rounded focus:outline-none focus:border-[#2563EB] resize-none"
            />
          </div>

          {/* Availability Toggle */}
          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="product-avail-toggle"
              checked={available}
              onChange={(e) => setAvailable(e.target.checked)}
              className="w-4 h-4 text-[#2563EB] rounded border-[#E5E7EB] focus:ring-[#2563EB]"
            />
            <label htmlFor="product-avail-toggle" className="font-medium text-[#171717] cursor-pointer">
              Item is In Stock & Available for Sale
            </label>
          </div>

          <div className="pt-3 border-t border-[#E5E7EB] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-3.5 py-1.5 text-xs font-medium text-[#737373] hover:text-[#171717] rounded border border-[#E5E7EB] bg-white hover:bg-[#F3F4F6]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded shadow-sm disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Save Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
