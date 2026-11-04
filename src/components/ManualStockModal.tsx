import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Package,
  Plus,
  Calendar,
  Tag,
  Barcode,
  Sparkles,
  Check,
  Search,
  Scale,
  FileSpreadsheet,
  RotateCcw,
} from 'lucide-react';
import { InventoryItem, CategoryItem, formatUnitLabel } from '../types/inventory';
import { addBatchToItem, normalizeItem, formatBatchDate, loadUnits, saveUnit } from '../services/storage';
import { BarcodeIntakeSelector } from './BarcodeIntakeSelector';

interface ManualStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: InventoryItem[];
  categories: CategoryItem[];
  onStockAdded: (updatedItem: InventoryItem) => void;
  onNewProductCreated: (newItem: InventoryItem) => void;
  onOpenCSVImport?: () => void;
  defaultCategory?: string;
  onAddCategory?: (newCat: Omit<CategoryItem, 'id' | 'createdAt'>) => CategoryItem | void;
}

export const ManualStockModal: React.FC<ManualStockModalProps> = ({
  isOpen,
  onClose,
  items,
  categories,
  onStockAdded,
  onNewProductCreated,
  onOpenCSVImport,
  defaultCategory,
  onAddCategory,
}) => {
  // Tab: 'existing' (restock existing item) vs 'new' (register brand new item)
  const [tab, setTab] = useState<'existing' | 'new'>('existing');

  // Existing item mode states
  // Existing item mode states
  const [selectedItemId, setSelectedItemId] = useState(items[0]?.id || '');
  const [existingDateMode, setExistingDateMode] = useState<'pick' | 'new'>('new');
  const [selectedBatchDate, setSelectedBatchDate] = useState('');
  const [manualBatchDate, setManualBatchDate] = useState('');
  const [addQty, setAddQty] = useState(1);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');


  // Units list loaded from persistent storage
  const [unitsList, setUnitsList] = useState<string[]>(() => loadUnits());
  const [isAddingNewUnit, setIsAddingNewUnit] = useState(false);
  const [inlineNewUnitName, setInlineNewUnitName] = useState('');

  // Category addition states
  const [isAddingNewCategory, setIsAddingNewCategory] = useState(false);
  const [inlineNewCategoryName, setInlineNewCategoryName] = useState('');

  // New item mode states - starts completely blank
  const [newBarcode, setNewBarcode] = useState('');
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState(defaultCategory || categories[0]?.name || 'Pantry');
  const [newUnit, setNewUnit] = useState('tins');
  const [newBestByDate, setNewBestByDate] = useState('');
  const [newInitialQty, setNewInitialQty] = useState(1);
  const [newLocation, setNewLocation] = useState('');
  const [newNotes, setNewNotes] = useState('');

  const [error, setError] = useState<string | null>(null);

  // Function to completely reset the new product form to blank state
  const resetNewForm = useCallback(() => {
    setNewBarcode('');
    setNewName('');
    setNewCategory(defaultCategory || categories[0]?.name || 'Pantry');
    setIsAddingNewCategory(false);
    setInlineNewCategoryName('');
    const freshUnits = loadUnits();
    setUnitsList(freshUnits);
    setNewUnit(freshUnits[0] || 'units');
    setIsAddingNewUnit(false);
    setInlineNewUnitName('');
    setNewBestByDate('');
    setNewInitialQty(1);
    setNewLocation('');
    setNewNotes('');
    setError(null);
  }, [defaultCategory, categories]);

  // Reset existing item restock form
  const resetExistingForm = useCallback(() => {
    setSelectedItemId(items[0]?.id || '');
    setExistingDateMode('new');
    setSelectedBatchDate('');
    setManualBatchDate('');
    setAddQty(1);
    setError(null);
  }, [items]);

    // Safe listener to close search results when you click outside the window
    useEffect(() => {
      const handleOutsideClick = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (!target.closest('.relative')) {
          setIsDropdownOpen(false);
        }
      };
      document.addEventListener('mousedown', handleOutsideClick);
      return () => document.removeEventListener('mousedown', handleOutsideClick);
    }, []);

  // Whenever modal opens or defaultCategory changes, reset to clean blank state
  useEffect(() => {
    if (isOpen) {
      resetNewForm();
      resetExistingForm();
      setError(null);
      if (items.length === 0 || defaultCategory) {
        setTab('new');
      } else {
        setTab('existing');
      }
    }
  }, [isOpen, defaultCategory, items.length, resetNewForm, resetExistingForm]);

  const handleClose = () => {
    resetNewForm();
    resetExistingForm();
    onClose();
  };

  // Add new Category to list and select it
  const handleConfirmNewCategory = () => {
    const clean = inlineNewCategoryName.trim();
    if (!clean) return;

    const existing = categories.find((c) => c.name.toLowerCase() === clean.toLowerCase());
    if (existing) {
      setNewCategory(existing.name);
      setIsAddingNewCategory(false);
      setInlineNewCategoryName('');
      return;
    }

    if (onAddCategory) {
      const created = onAddCategory({
        name: clean,
        color: 'indigo',
        description: `Custom category: ${clean}`,
      });
      setNewCategory(created ? created.name : clean);
    } else {
      setNewCategory(clean);
    }

    setIsAddingNewCategory(false);
    setInlineNewCategoryName('');
  };

  // Add new Unit to list and select it
  const handleConfirmNewUnit = () => {
    const clean = inlineNewUnitName.trim().toLowerCase();
    if (!clean) return;

    const updated = saveUnit(clean);
    setUnitsList(updated);
    setNewUnit(clean);
    setIsAddingNewUnit(false);
    setInlineNewUnitName('');
  };

  if (!isOpen) return null;

  const selectedItem = items.find((i) => i.id === selectedItemId) || items[0];

  const handleGenerateBarcode = () => {
    const randomCode = `MAN-${Math.floor(100000 + Math.random() * 900000)}`;
    setNewBarcode(randomCode);
    setError(null);
  };

  const handleAddStockExisting = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) {
      setError('Please select an item to restock.');
      return;
    }

    const targetDate = (existingDateMode === 'pick' ? selectedBatchDate : manualBatchDate).trim();
    const updated = addBatchToItem(selectedItem, targetDate, Math.max(1, addQty));
    onStockAdded(updated);
    resetExistingForm();
    onClose();
  };

  const handleCreateNewProduct = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanBarcode = newBarcode.trim();
    const cleanName = newName.trim();

    if (!cleanBarcode) {
      setError('Barcode ID is required. (Tap "Auto Generate" if none exists)');
      return;
    }
    if (!cleanName) {
      setError('Product name is required.');
      return;
    }

    const duplicate = items.some((i) => i.id.toLowerCase() === cleanBarcode.toLowerCase());
    if (duplicate) {
      setError('A product with this Barcode ID already exists. Switch to "Restock Existing" tab.');
      return;
    }

    // Resolve Category (create if new category was typed in inline input)
    let finalCategory = newCategory;
    if (isAddingNewCategory && inlineNewCategoryName.trim()) {
      const cleanCat = inlineNewCategoryName.trim();
      const existing = categories.find((c) => c.name.toLowerCase() === cleanCat.toLowerCase());
      if (existing) {
        finalCategory = existing.name;
      } else if (onAddCategory) {
        const created = onAddCategory({
          name: cleanCat,
          color: 'indigo',
          description: `Custom category: ${cleanCat}`,
        });
        finalCategory = created ? created.name : cleanCat;
      } else {
        finalCategory = cleanCat;
      }
    } else if (finalCategory && !categories.some((c) => c.name.toLowerCase() === finalCategory.toLowerCase()) && onAddCategory) {
      onAddCategory({
        name: finalCategory,
        color: 'indigo',
        description: `Custom category: ${finalCategory}`,
      });
    }

    // Resolve Unit (save to unit list if new unit was typed in)
    let finalUnit = newUnit.trim().toLowerCase();
    if (isAddingNewUnit && inlineNewUnitName.trim()) {
      const cleanUnit = inlineNewUnitName.trim().toLowerCase();
      saveUnit(cleanUnit);
      finalUnit = cleanUnit;
    } else if (finalUnit) {
      saveUnit(finalUnit);
    }

    const initQty = Math.max(1, newInitialQty);
    const dateStr = newBestByDate.trim();

    const newItem = normalizeItem({
      id: cleanBarcode,
      name: cleanName,
      category: finalCategory,
      unit: finalUnit || 'units',
      quantity: initQty,
      bestByDate: dateStr,
      batches: [
        {
          id: `batch-${Date.now()}`,
          bestByDate: dateStr,
          quantity: initQty,
          createdAt: new Date().toISOString(),
        },
      ],
      location: newLocation.trim() || undefined,
      notes: newNotes.trim() || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    onNewProductCreated(newItem);
    // Reset all form inputs to blank for next use
    resetNewForm();
    onClose();
  };

  const setDatePreset = (days: number, target: 'existing' | 'new', years?: number) => {
    const d = new Date();
    if (years) {
      d.setFullYear(d.getFullYear() + years);
    } else {
      d.setDate(d.getDate() + days);
    }
    const dateStr = d.toISOString().split('T')[0];
    if (target === 'existing') {
      setManualBatchDate(dateStr);
      setExistingDateMode('new');
    } else {
      setNewBestByDate(dateStr);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-4 backdrop-blur-xs animate-in fade-in overflow-y-auto">
      <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden text-slate-100 my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60 shrink-0">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <Package className="w-5 h-5 text-sky-400" />
              Add Item to Pantry
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Restock existing products or register a new item with use-by dates
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher: Restock Existing vs New Product vs CSV Import */}
        <div className="p-3 border-b border-slate-800 bg-slate-950/40 flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              resetExistingForm();
              setTab('existing');
            }}
            className={`flex-1 min-w-[120px] py-2 rounded-xl text-xs font-semibold transition ${
              tab === 'existing'
                ? 'bg-sky-500 text-white shadow-xs'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            Restock Existing Item
          </button>
          <button
            type="button"
            onClick={() => {
              resetNewForm();
              setTab('new');
            }}
            className={`flex-1 min-w-[120px] py-2 rounded-xl text-xs font-semibold transition ${
              tab === 'new'
                ? 'bg-sky-500 text-white shadow-xs'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            + Register New Product
          </button>
          {onOpenCSVImport && (
            <button
              type="button"
              onClick={() => {
                handleClose();
                onOpenCSVImport();
              }}
              className="py-2 px-3 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-emerald-400 hover:text-emerald-300 border border-slate-800 transition flex items-center justify-center gap-1.5"
              title="Upload and import items from a CSV file"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Import CSV</span>
            </button>
          )}
        </div>

        {/* Form Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1">
          {error && (
            <div className="mb-3 p-2.5 rounded-xl bg-rose-950/70 border border-rose-800 text-rose-200 text-xs">
              {error}
            </div>
          )}

          {/* TAB 1: Restock Existing Item */}
          {tab === 'existing' && (
            <form onSubmit={handleAddStockExisting} className="space-y-4">
              {items.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-400">
                  No items in inventory yet. Switch to "Register New Product" tab above.
                </div>
              ) : (
                <>
              {/* --- RESTORED SELECTION PANEL WITH SEARCHABLE BOX --- */}
              <div className="relative">
                <div className="relative">
                  <input
                    type="text"
                    placeholder={selectedItem ? `${selectedItem.name} (ID: ${selectedItem.id})` : "Type to filter items..."}
                    value={isDropdownOpen ? searchQuery : selectedItem ? selectedItem.name : ''}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setIsDropdownOpen(true);
                    }}
                    onFocus={() => {
                      setIsDropdownOpen(true);
                      setSearchQuery('');
                    }}
                    className="w-full pl-9 pr-4 py-2.5 text-sm bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-hidden focus:ring-2 focus:ring-sky-500 cursor-pointer"
                  />
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                </div>
                  {isDropdownOpen && (
                    <ul className="absolute z-50 w-full mt-1 max-h-60 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950 p-1.5 shadow-2xl space-y-0.5">
                      {items.filter(it => 
                        it.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                        it.id.toLowerCase().includes(searchQuery.toLowerCase())
                      ).length > 0 ? (
                        items
                          .filter(it => 
                            it.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            it.id.toLowerCase().includes(searchQuery.toLowerCase())
                          )
                          .map((it) => {
                            const isSelected = it.id === selectedItemId;
                            return (
                              <li
                                key={it.id}
                                onClick={() => {
                                  setSelectedItemId(it.id);
                                  if (it.batches && it.batches[0]) {
                                    setSelectedBatchDate(it.batches[0].bestByDate);
                                  }
                                  setIsDropdownOpen(false);
                                  setSearchQuery('');
                                }}
                                className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs cursor-pointer transition select-none ${
                                  isSelected 
                                    ? 'bg-sky-500 text-white font-semibold' 
                                    : 'text-slate-300 hover:bg-slate-900 hover:text-white'
                                }`}
                              >
                                <div className="flex flex-col">
                                  <span>{it.name}</span>
                                  <span className={`text-[10px] font-mono mt-0.5 ${isSelected ? 'text-sky-100' : 'text-slate-500'}`}>
                                    ID: {it.id} · {it.quantity} {formatUnitLabel(it.quantity, it.unit)}
                                  </span>
                                </div>
                                {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                              </li>
                            );
                          })
                      ) : (
                        <li className="px-3 py-3 text-xs text-center text-slate-500 font-medium">
                          No matching inventory products found
                        </li>
                      )}
                    </ul>
                  )}
                </div>
                  {/* Assign to Date Batch */}
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Target Use-By Date Batch
                    </label>

                    {selectedItem && selectedItem.batches.length > 0 && (
                      <div className="flex items-center gap-2 mb-2">
                        <button
                          type="button"
                          onClick={() => setExistingDateMode('pick')}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition ${
                            existingDateMode === 'pick'
                              ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                              : 'bg-slate-950 text-slate-400 border-slate-800'
                          }`}
                        >
                          Select Existing Batch Date
                        </button>
                        <button
                          type="button"
                          onClick={() => setExistingDateMode('new')}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition ${
                            existingDateMode === 'new'
                              ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                              : 'bg-slate-950 text-slate-400 border-slate-800'
                          }`}
                        >
                          Specify New Date
                        </button>
                      </div>
                    )}

                    {existingDateMode === 'pick' && selectedItem && selectedItem.batches.length > 0 ? (
                      <select
                        value={selectedBatchDate}
                        onChange={(e) => setSelectedBatchDate(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white font-mono"
                      >
                        {selectedItem.batches.map((b) => (
                          <option key={b.id} value={b.bestByDate}>
                            {formatBatchDate(b.bestByDate)} ({b.quantity} {formatUnitLabel(b.quantity, selectedItem.unit)} currently)
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="space-y-1.5">
                        <input
                          type="date"
                          value={manualBatchDate}
                          onChange={(e) => setManualBatchDate(e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white font-mono"
                        />
                        <div className="flex flex-wrap gap-1 text-[10px]">
                          <span className="text-slate-500 self-center mr-1">Presets:</span>
                          <button
                            type="button"
                            onClick={() => setDatePreset(7, 'existing')}
                            className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300"
                          >
                            +1w
                          </button>
                          <button
                            type="button"
                            onClick={() => setDatePreset(30, 'existing')}
                            className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300"
                          >
                            +1m
                          </button>
                          <button
                            type="button"
                            onClick={() => setDatePreset(90, 'existing')}
                            className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300"
                          >
                            +3m
                          </button>
                          <button
                            type="button"
                            onClick={() => setDatePreset(180, 'existing')}
                            className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300"
                          >
                            +6m
                          </button>
                          <button
                            type="button"
                            onClick={() => setDatePreset(0, 'existing', 1)}
                            className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300"
                          >
                            +1yr
                          </button>
                          <button
                            type="button"
                            onClick={() => setDatePreset(0, 'existing', 2)}
                            className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300"
                          >
                            +2yr
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Quantity to Add */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                      {selectedItem ? `Amount to Add (+${formatUnitLabel(addQty, selectedItem.unit)})` : 'Units to Add (+Qty)'}
                    </label>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setAddQty(Math.max(1, addQty - 1))}
                        className="w-12 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-lg"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="1"
                        value={addQty}
                        onChange={(e) => setAddQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                        className="w-full text-center py-2 rounded-xl font-mono text-xl font-bold bg-slate-950 border border-slate-800 text-white"
                      />
                      <button
                        type="button"
                        onClick={() => setAddQty(addQty + 1)}
                        className="w-12 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-lg"
                      >
                        +
                      </button>
                    </div>

                    {selectedItem && (
                      <span className="text-[11px] text-emerald-400 mt-1 block text-right font-medium">
                        Stock will increase from {selectedItem.quantity} {formatUnitLabel(selectedItem.quantity, selectedItem.unit)} → {selectedItem.quantity + addQty} {formatUnitLabel(selectedItem.quantity + addQty, selectedItem.unit)}
                      </span>
                    )}
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-3.5 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-semibold text-xs shadow-md transition active:scale-95"
                    >
                      <Check className="w-4 h-4" />
                      <span>Add +{addQty} {formatUnitLabel(addQty, selectedItem?.unit)} to Stock</span>
                    </button>
                  </div>
                </>
              )}
            </form>
          )}

          {/* TAB 2: Register & Stock a Brand New Product */}
          {tab === 'new' && (
            <form onSubmit={handleCreateNewProduct} className="space-y-3.5">
              {/* Barcode ID: Either Manual Input or Scanned in via Camera */}
              <div>
                <BarcodeIntakeSelector
                  value={newBarcode}
                  onChange={(val) => {
                    setNewBarcode(val);
                    setError(null);
                  }}
                  idPrefix="manual-stock-reg"
                />
              </div>

              {/* Product Name */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Product Name
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Pasta Penne, Can of Beans, Fresh Whole Milk"
                  className="w-full px-3 py-2 text-sm bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                  required
                />
              </div>

              {/* Category & Unit of Measurement */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Category Selection */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                      <Tag className="w-3.5 h-3.5 text-indigo-400" />
                      Category
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingNewCategory(true);
                        setInlineNewCategoryName('');
                      }}
                      className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-0.5 transition"
                    >
                      + New Category
                    </button>
                  </div>
                  <select
                    value={isAddingNewCategory ? '__NEW_CATEGORY__' : newCategory}
                    onChange={(e) => {
                      if (e.target.value === '__NEW_CATEGORY__') {
                        setIsAddingNewCategory(true);
                        setInlineNewCategoryName('');
                      } else {
                        setIsAddingNewCategory(false);
                        setNewCategory(e.target.value);
                      }
                    }}
                    className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                    <option value="__NEW_CATEGORY__">+ New Category...</option>
                  </select>

                  {/* Inline New Category Creation Input */}
                  {isAddingNewCategory && (
                    <div className="mt-1.5 flex items-center gap-1.5 animate-in fade-in">
                      <input
                        type="text"
                        value={inlineNewCategoryName}
                        onChange={(e) => setInlineNewCategoryName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleConfirmNewCategory();
                          }
                        }}
                        placeholder="Type new category name..."
                        className="flex-1 px-2.5 py-1.5 text-xs bg-slate-900 border border-indigo-500 rounded-lg text-white placeholder-slate-500 focus:outline-hidden"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={handleConfirmNewCategory}
                        className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shrink-0 transition"
                      >
                        Add
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddingNewCategory(false);
                          setInlineNewCategoryName('');
                        }}
                        className="px-2 py-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white text-xs shrink-0 transition"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>

                {/* Unit of Measurement Selection */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                      <Scale className="w-3.5 h-3.5 text-sky-400" />
                      Unit of Measurement
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingNewUnit(true);
                        setInlineNewUnitName('');
                      }}
                      className="text-[11px] text-sky-400 hover:text-sky-300 font-medium flex items-center gap-0.5 transition"
                    >
                      + New Unit
                    </button>
                  </div>
                  <select
                    value={isAddingNewUnit ? '__NEW_UNIT__' : newUnit}
                    onChange={(e) => {
                      if (e.target.value === '__NEW_UNIT__') {
                        setIsAddingNewUnit(true);
                        setInlineNewUnitName('');
                      } else {
                        setIsAddingNewUnit(false);
                        setNewUnit(e.target.value);
                      }
                    }}
                    className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                  >
                    {unitsList.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                    <option value="__NEW_UNIT__">+ New Unit...</option>
                  </select>

                  {/* Inline New Unit Creation Input */}
                  {isAddingNewUnit && (
                    <div className="mt-1.5 flex items-center gap-1.5 animate-in fade-in">
                      <input
                        type="text"
                        value={inlineNewUnitName}
                        onChange={(e) => setInlineNewUnitName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleConfirmNewUnit();
                          }
                        }}
                        placeholder="e.g. rolls, crates, trays..."
                        className="flex-1 px-2.5 py-1.5 text-xs bg-slate-900 border border-sky-500 rounded-lg text-white placeholder-slate-500 focus:outline-hidden"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={handleConfirmNewUnit}
                        className="px-2.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shrink-0 transition"
                      >
                        Add
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddingNewUnit(false);
                          setInlineNewUnitName('');
                        }}
                        className="px-2 py-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white text-xs shrink-0 transition"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Unit Chips from loaded persistent units */}
              <div className="flex flex-wrap gap-1 items-center">
                <span className="text-[10px] text-slate-500">Quick unit:</span>
                {[...unitsList].reverse().slice(0, 12).map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => {
                      setNewUnit(u);
                      setIsAddingNewUnit(false);
                    }}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition ${
                      !isAddingNewUnit && newUnit === u
                        ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 font-bold'
                        : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
                    }`}
                  >
                    {u}
                  </button>
                ))}
              </div>

              {/* Use-By Date & Initial Quantity */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-amber-400" />
                    Initial Use-By Date
                  </label>
                  <input
                    type="date"
                    value={newBestByDate}
                    onChange={(e) => setNewBestByDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white font-mono"
                  />
                  <div className="flex gap-1 mt-1 text-[10px]">
                    <button
                      type="button"
                      onClick={() => setDatePreset(30, 'new')}
                      className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300"
                    >
                      +1m
                    </button>
                    <button
                      type="button"
                      onClick={() => setDatePreset(90, 'new')}
                      className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300"
                    >
                      +3m
                    </button>
                    <button
                      type="button"
                      onClick={() => setDatePreset(180, 'new')}
                      className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300"
                    >
                      +6m
                    </button>
                    <button
                      type="button"
                      onClick={() => setDatePreset(0, 'new', 1)}
                      className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300"
                    >
                      +1yr
                    </button>
                    <button
                      type="button"
                      onClick={() => setDatePreset(0, 'new', 2)}
                      className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300"
                    >
                      +2yr
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                    Initial Quantity ({isAddingNewUnit ? inlineNewUnitName || 'units' : newUnit})
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setNewInitialQty(Math.max(1, newInitialQty - 1))}
                      className="w-10 h-9 rounded-xl bg-slate-800 text-white font-bold"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min="1"
                      value={newInitialQty}
                      onChange={(e) => setNewInitialQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      className="w-full text-center py-1.5 rounded-xl font-mono text-base font-bold bg-slate-950 border border-slate-800 text-white"
                    />
                    <button
                      type="button"
                      onClick={() => setNewInitialQty(newInitialQty + 1)}
                      className="w-10 h-9 rounded-xl bg-slate-800 text-white font-bold"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              {/* Shelf location */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Shelf / Storage Bin (Optional)
                </label>
                <input
                  type="text"
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  placeholder="e.g. Aisle 3, Shelf B2"
                  className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white"
                />
              </div>

              <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={resetNewForm}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-amber-300 hover:bg-slate-800 transition"
                  title="Reset form fields to blank"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Clear to Blank</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="px-3.5 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-semibold text-xs shadow-md transition active:scale-95"
                  >
                    <Check className="w-4 h-4" />
                    <span>Register & Add Stock ({newInitialQty} {formatUnitLabel(newInitialQty, isAddingNewUnit && inlineNewUnitName.trim() ? inlineNewUnitName.trim() : newUnit)})</span>
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
