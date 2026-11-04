import React, { useState, useEffect } from 'react';
import { X, Calendar, Tag, MapPin, FileText, Check, Scale, AlertTriangle } from 'lucide-react';
import { InventoryItem, DateBatch, CategoryItem } from '../types/inventory';
import { PRESET_CATEGORIES, normalizeItem, loadUnits, saveUnit } from '../services/storage';
import { BarcodeIntakeSelector } from './BarcodeIntakeSelector';

interface ItemFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (item: InventoryItem) => void;
  initialItem?: Partial<InventoryItem> | null;
  existingItems?: InventoryItem[];
  categories?: CategoryItem[];
  onAddCategory?: (newCat: Omit<CategoryItem, 'id' | 'createdAt'>) => CategoryItem | void;
}

export const ItemFormModal: React.FC<ItemFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialItem,
  existingItems = [],
  categories = [],
  onAddCategory,
}) => {
  const [barcodeId, setBarcodeId] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState(PRESET_CATEGORIES[1]);
  const [customCategory, setCustomCategory] = useState('');
  const [unitsList, setUnitsList] = useState<string[]>(() => loadUnits());
  const [unit, setUnit] = useState('units');
  const [customUnit, setCustomUnit] = useState('');
  const [bestByDate, setBestByDate] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [minStockLevel, setMinStockLevel] = useState<number>(2);
  const [error, setError] = useState<string | null>(null);

  const isEditing = Boolean(initialItem && initialItem.id && existingItems.some((i) => i.id === initialItem.id));
  useEffect(() => {
    if (isOpen) {
      setError(null);
      const freshUnits = loadUnits();
      setUnitsList(freshUnits);

      if (initialItem) {
        setBarcodeId(initialItem.id || '');
        setName(initialItem.name || '');
        setMinStockLevel(typeof initialItem.minStockLevel === 'number' ? initialItem.minStockLevel : 2);
        
        const cat = initialItem.category || PRESET_CATEGORIES[1];
        if (categories.some((c) => c.name.toLowerCase() === cat.toLowerCase()) || PRESET_CATEGORIES.includes(cat)) {
          setCategory(cat);
          setCustomCategory('');
        } else {
          setCategory('Custom');
          setCustomCategory(cat);
        }
        const itemUnit = (initialItem.unit || 'units').toLowerCase();
        if (freshUnits.includes(itemUnit)) {
          setUnit(itemUnit);
          setCustomUnit('');
        } else {
          setUnit('custom');
          setCustomUnit(itemUnit);
        }
        setBestByDate(initialItem.bestByDate || initialItem.batches?.[0]?.bestByDate || '');
        setQuantity(typeof initialItem.quantity === 'number' ? initialItem.quantity : 1);
        setLocation(initialItem.location || '');
        setNotes(initialItem.notes || '');
      } else {
        setBarcodeId('');
        setName('');
        setCategory(categories[0]?.name || PRESET_CATEGORIES[1]);
        setCustomCategory('');
        setUnit(freshUnits[0] || 'units');
        setCustomUnit('');
        setBestByDate('');
        setQuantity(1);
        setLocation('');
        setNotes('');
        setMinStockLevel(2);
      }
    }
  }, [isOpen, initialItem, categories]);

  const setQuickExpiry = (days: number, years?: number) => {
    const d = new Date();
    if (years) {
      d.setFullYear(d.getFullYear() + years);
    } else {
      d.setDate(d.getDate() + days);
    }
    setBestByDate(d.toISOString().split('T')[0]);
  };

  const handleAddCustomUnit = () => {
    const clean = customUnit.trim().toLowerCase();
    if (!clean) return;
    const updated = saveUnit(clean);
    setUnitsList(updated);
    setUnit(clean);
    setCustomUnit('');
  };

  const handleAddCustomCategory = () => {
    const clean = customCategory.trim();
    if (!clean) return;
    if (onAddCategory && !categories.some((c) => c.name.toLowerCase() === clean.toLowerCase())) {
      onAddCategory({
        name: clean,
        color: 'indigo',
        description: `Custom category: ${clean}`,
      });
    }
    setCategory(clean);
    setCustomCategory('');
  };
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = barcodeId.trim();
    const cleanName = name.trim();

    if (!cleanId) {
      setError('Barcode ID is required.');
      return;
    }
    if (!cleanName) {
      setError('Item name is required.');
      return;
    }

    if (!isEditing && existingItems.some((i) => i.id.toLowerCase() === cleanId.toLowerCase())) {
      setError('An item with this Barcode ID already exists. You can adjust its quantity or add date batches directly.');
      return;
    }

    let finalCategory = category === 'Custom' ? (customCategory.trim() || 'General') : category;
    if (finalCategory && onAddCategory && !categories.some((c) => c.name.toLowerCase() === finalCategory.toLowerCase())) {
      onAddCategory({
        name: finalCategory,
        color: 'indigo',
        description: `Custom category: ${finalCategory}`,
      });
    }

    const resolvedUnit = (unit === 'custom' ? customUnit : unit).trim().toLowerCase() || 'units';
    saveUnit(resolvedUnit);

    let batches: DateBatch[] = [];
    if (isEditing && initialItem && Array.isArray(initialItem.batches) && initialItem.batches.length > 0) {
      batches = initialItem.batches;
    } else {
      batches = [
        {
          id: `batch-${Date.now()}`,
          bestByDate: bestByDate.trim(),
          quantity: Math.max(1, quantity),
          createdAt: new Date().toISOString(),
        },
      ];
    }

    const itemToSave = normalizeItem({
      id: cleanId,
      name: cleanName,
      category: finalCategory,
      unit: resolvedUnit,
      batches,
      quantity: Math.max(0, quantity),
      bestByDate: bestByDate.trim(),
      location: location.trim(),
      notes: notes.trim(),
      minStockLevel: minStockLevel,
      createdAt: initialItem?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    onSave(itemToSave);
    setBarcodeId('');
    setName('');
    setCategory(PRESET_CATEGORIES[1]);
    setCustomCategory('');
    setUnit('units');
    setCustomUnit('');
    setBestByDate('');
    setQuantity(1);
    setLocation('');
    setNotes('');
    setError(null);
    onClose();
  };

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-4 backdrop-blur-xs animate-in fade-in overflow-y-auto">
      <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden text-slate-100 my-auto">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-base sm:text-lg font-semibold text-white">
              {isEditing ? 'Edit Item Details' : 'Register New Item'}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {isEditing ? 'Update item metadata (dates managed in batches)' : 'Add product to your offline catalog'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800/80 text-rose-200 text-xs flex items-center gap-2">
              <span>{error}</span>
            </div>
          )}

          <div>
            <BarcodeIntakeSelector
              value={barcodeId}
              onChange={(val) => {
                setBarcodeId(val);
                setError(null);
              }}
              disabled={isEditing}
              idPrefix="form-reg"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
              Item Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Can of Black Beans"
              className="w-full px-3 py-2.5 rounded-xl text-sm bg-slate-950 border border-slate-800 text-white placeholder-slate-600 focus:outline-hidden focus:ring-2 focus:ring-sky-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-indigo-400" />
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2.5 text-sm bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-sky-500 cursor-pointer"
            >
              {(categories.length > 0 ? categories.map((c) => c.name) : PRESET_CATEGORIES.filter((c) => c !== 'All')).map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
              <option value="Custom">+ New Category...</option>
            </select>

            {category === 'Custom' && (
              <div className="flex items-center gap-1.5 mt-2.5">
                <input
                  type="text"
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  placeholder="Enter new category name..."
                  className="flex-1 px-3 py-2 text-xs bg-slate-950 border border-indigo-500 rounded-xl text-white placeholder-slate-600 focus:outline-hidden"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleAddCustomCategory}
                  className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shrink-0"
                >
                  Add
                </button>
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1.5">
              <Scale className="w-3.5 h-3.5 text-sky-400" />
              Unit of Measurement
            </label>
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="w-full px-3 py-2.5 text-sm bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-sky-500 cursor-pointer"
            >
              {unitsList.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
              <option value="custom">+ New Unit...</option>
            </select>

            {unit === 'custom' && (
              <div className="flex items-center gap-1.5 mt-2.5">
                <input
                  type="text"
                  value={customUnit}
                  onChange={(e) => setCustomUnit(e.target.value)}
                  placeholder="Enter new unit..."
                  className="flex-1 px-3 py-2 text-xs bg-slate-950 border border-sky-500 rounded-xl text-white placeholder-slate-600 focus:outline-hidden"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleAddCustomUnit}
                  className="px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shrink-0"
                >
                  Add
                </button>
              </div>
            )}
          </div>

          {!isEditing && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-amber-400" />
                Initial Use-By Date
              </label>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={bestByDate}
                  onChange={(e) => setBestByDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-sm bg-slate-950 border border-slate-800 text-white focus:outline-hidden focus:ring-2 focus:ring-sky-500 font-mono"
                />
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                <button type="button" onClick={() => setQuickExpiry(7)} className="px-2 py-0.5 rounded-md text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300">+1w</button>
                <button type="button" onClick={() => setQuickExpiry(30)} className="px-2 py-0.5 rounded-md text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300">+1m</button>
                <button type="button" onClick={() => setQuickExpiry(90)} className="px-2 py-0.5 rounded-md text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300">+3m</button>
                <button type="button" onClick={() => setQuickExpiry(365)} className="px-2 py-0.5 rounded-md text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300">+1y</button>
              </div>
            </div>
          )}

          {!isEditing && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Initial Quantity
              </label>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-11 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-lg flex items-center justify-center">-</button>
                <input type="number" min="1" value={quantity} onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))} className="w-full text-center py-2 rounded-xl font-mono text-xl font-bold bg-slate-950 border border-slate-800 text-white" />
                <button type="button" onClick={() => setQuantity(quantity + 1)} className="w-11 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-lg flex items-center justify-center">+</button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                Min Alert Qty
              </label>
              <input
                type="number"
                min="0"
                value={minStockLevel}
                onChange={(e) => setMinStockLevel(Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="w-full px-3 py-2 text-sm bg-slate-950 border border-slate-800 rounded-xl text-white font-mono focus:outline-hidden focus:ring-2 focus:ring-sky-500"
              />
            </div>
            
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-500" />
                Shelf Location
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Shelf A1"
                className="w-full px-3 py-2 text-sm bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-slate-500" />
                Notes
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Organic"
                className="w-full px-3 py-2 text-sm bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl border border-slate-800 text-slate-300 hover:bg-slate-800 text-sm font-medium transition">Cancel</button>
            <button type="submit" className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-sm font-semibold shadow-lg transition">Save Changes</button>
          </div>
        </form>
      </div>
    </div>
  );
};
