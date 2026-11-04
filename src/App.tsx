import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Menu, PlusCircle, Package } from 'lucide-react';
import { InventoryItem, CategoryItem, StockMovement, NavTab, DateBatch } from './types/inventory';
import {
  loadInventory,
  saveInventory,
  loadCategories,
  saveCategories,
  renameCategoryInItems,
  reassignCategoryInItems,
  loadMovements,
  recordMovement,
  computeInventoryStats,
  getExpiryStatus,
  getDaysRemaining,
  formatBatchDate,
  addBatchToItem,
  removeBatchFromItem,
  normalizeItem,
  SAMPLE_DEMO_INVENTORY,
  INITIAL_CATEGORIES,
  purgeInitialTestingData,
} from './services/storage';
import { playAddBeep, playRemoveBeep } from './services/sound';
import { SideNav } from './components/SideNav';
import { DashboardView } from './components/DashboardView';
import { CategoriesView } from './components/CategoriesView';
import { AdminView } from './components/AdminView';
import { InventoryView } from './components/InventoryView';
import { ItemDetailModal } from './components/ItemDetailModal';
import { ItemFormModal } from './components/ItemFormModal';
import { ManualStockModal } from './components/ManualStockModal';
import { CSVImportModal } from './components/CSVImportModal';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';
import { ViewSortOption } from './types/inventory';
import { GuidesView } from './components/GuidesView';
import { ChecklistsView } from './components/ChecklistsView';


export default function App() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Active navigation view: dashboard | inventory | categories | admin
  const [activeTab, setActiveTab] = useState<NavTab>('inventory');
  const [sideNavOpen, setSideNavOpen] = useState(false);

  // Search & Filter state (for Inventory view)
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [viewSortFilter, setViewSortFilter] = useState<ViewSortOption>('all');

  // Modals state
  const [manualStockOpen, setManualStockOpen] = useState(false);
  const [manualStockCategory, setManualStockCategory] = useState<string | undefined>(undefined);
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [detailItem, setDetailItem] = useState<InventoryItem | null>(null);

  // Initialize data on mount
  useEffect(() => {
    async function init() {
      try {
        await purgeInitialTestingData();
        const [loadedItems, loadedCats, loadedMovs] = await Promise.all([
          loadInventory(),
          loadCategories(),
          loadMovements(),
        ]);
        setItems(loadedItems);
        setCategories(loadedCats);
        setMovements(loadedMovs);
      } catch (err) {
        console.error('Failed to load local offline database:', err);
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, []);

  // Persist items
  const updateItems = useCallback((newItems: InventoryItem[]) => {
    setItems(newItems);
    saveInventory(newItems);
  }, []);

  // Persist categories
  const updateCategories = useCallback((newCats: CategoryItem[]) => {
    setCategories(newCats);
    saveCategories(newCats);
  }, []);

  //  THE FIX: All parameter values now cleanly share the exact same variable name!
  const handleUpdateItem = useCallback(
    (updatedItem: InventoryItem) => {
      const normalized = normalizeItem(updatedItem);
      setItems((currentItems) => {
        const nextList = currentItems.map((i) => (i.id === normalized.id ? normalized : i));
        saveInventory(nextList);
        return nextList;
      });

      if (detailItem && detailItem.id === normalized.id) {
        setDetailItem(normalized);
      }
    },
    [detailItem]
  );




  // Quick increment (+1)
  const handleQuickIncrement = useCallback(
    (item: InventoryItem) => {
      playAddBeep();
      const targetDate = item.batches[0]?.bestByDate || '';
      const updated = addBatchToItem(item, targetDate, 1);
      handleUpdateItem(updated);

      // Record movement
      recordMovement({
        itemId: item.id,
        itemName: item.name,
        barcode: item.id,
        type: 'in',
        unit: item.unit,
        batchDate: targetDate,
        quantity: 1,
        resultingTotal: updated.quantity,
      }).then(setMovements);
    },
    [handleUpdateItem]
  );

  // Quick decrement (-1)
  const handleQuickDecrement = useCallback(
    (item: InventoryItem) => {
      if (item.quantity <= 0) return;
      playRemoveBeep();
      const { updatedItem, deductedBatch } = removeBatchFromItem(item);
      handleUpdateItem(updatedItem);

      recordMovement({
        itemId: item.id,
        itemName: item.name,
        barcode: item.id,
        type: 'out',
        unit: item.unit,
        batchDate: deductedBatch?.bestByDate,
        quantity: 1,
        resultingTotal: updatedItem.quantity,
      }).then(setMovements);
    },
    [handleUpdateItem]
  );

  // Batch actions in Detail Modal
  const handleAddBatch = useCallback(
    (item: InventoryItem, bestByDate: string, qty: number) => {
      playAddBeep();
      const updated = addBatchToItem(item, bestByDate, qty);
      handleUpdateItem(updated);

      recordMovement({
        itemId: item.id,
        itemName: item.name,
        barcode: item.id,
        type: 'in',
        unit: item.unit,
        batchDate: bestByDate,
        quantity: qty,
        resultingTotal: updated.quantity,
      }).then(setMovements);
    },
    [handleUpdateItem]
  );

  const handleIncrementBatch = useCallback(
    (item: InventoryItem, batchId: string) => {
      playAddBeep();
      const targetBatch = item.batches.find((b) => b.id === batchId);
      if (!targetBatch) return;
      const updated = addBatchToItem(item, targetBatch.bestByDate, 1);
      handleUpdateItem(updated);

      recordMovement({
        itemId: item.id,
        itemName: item.name,
        barcode: item.id,
        type: 'in',
        unit: item.unit,
        batchDate: targetBatch.bestByDate,
        quantity: 1,
        resultingTotal: updated.quantity,
      }).then(setMovements);
    },
    [handleUpdateItem]
  );

  const handleDecrementBatch = useCallback(
    (item: InventoryItem, batchId: string) => {
      playRemoveBeep();
      const targetBatch = item.batches.find((b) => b.id === batchId);
      const { updatedItem } = removeBatchFromItem(item, batchId, 1);
      handleUpdateItem(updatedItem);

      recordMovement({
        itemId: item.id,
        itemName: item.name,
        barcode: item.id,
        type: 'out',
        unit: item.unit,
        batchDate: targetBatch?.bestByDate,
        quantity: 1,
        resultingTotal: updatedItem.quantity,
      }).then(setMovements);
    },
    [handleUpdateItem]
  );

  const handleDeleteBatch = useCallback(
    (item: InventoryItem, batchId: string) => {
      const remainingBatches = item.batches.filter((b) => b.id !== batchId);
      const updated: InventoryItem = {
        ...item,
        batches:
          remainingBatches.length > 0
            ? remainingBatches
            : [{ id: `batch-${Date.now()}`, bestByDate: '', quantity: 0, createdAt: new Date().toISOString() }],
        quantity: remainingBatches.reduce((sum, b) => sum + b.quantity, 0),
        bestByDate: remainingBatches[0]?.bestByDate || '',
        updatedAt: new Date().toISOString(),
      };
      handleUpdateItem(updated);
    },
    [handleUpdateItem]
  );

  //  FIXED CATALOG METADATA WRITER:
  const handleSaveItem = useCallback(
    (savedItem: InventoryItem) => {
      setItems((currentItems) => {
        const exists = currentItems.some((i) => i.id.toLowerCase() === savedItem.id.toLowerCase());
        let nextList: InventoryItem[];
        
        if (exists) {
          nextList = currentItems.map((i) => (i.id.toLowerCase() === savedItem.id.toLowerCase() ? savedItem : i));
        } else {
          nextList = [savedItem, ...currentItems];
        }
        
        saveInventory(nextList); // Persists to storage layers securely
        return nextList;
      });

      setEditingItem(null);
      setFormOpen(false);

      if (detailItem && detailItem.id.toLowerCase() === savedItem.id.toLowerCase()) {
        setDetailItem(savedItem);
      }
    },
    [detailItem]
  );

  const handleDeleteItem = useCallback(
    (itemId: string) => {
      const updated = items.filter((i) => i.id !== itemId);
      updateItems(updated);
      if (detailItem && detailItem.id === itemId) {
        setDetailItem(null);
      }
    },
    [items, detailItem, updateItems]
  );

  // ======================== CATEGORY HANDLERS ========================
  const handleAddCategory = useCallback(
    (newCatData: Omit<CategoryItem, 'id' | 'createdAt'>) => {
      const cleanName = newCatData.name.trim();
      const existing = categories.find(
        (c) => c.name.trim().toLowerCase() === cleanName.toLowerCase()
      );
      if (existing) return existing;

      const newCat: CategoryItem = {
        ...newCatData,
        name: cleanName,
        id: `cat-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        createdAt: new Date().toISOString(),
      };
      updateCategories([...categories, newCat]);
      return newCat;
    },
    [categories, updateCategories]
  );

  const handleEditCategory = useCallback(
    (id: string, updatedData: Partial<CategoryItem>, oldName: string) => {
      const updatedCats = categories.map((c) => (c.id === id ? { ...c, ...updatedData } : c));
      updateCategories(updatedCats);

      // If category name was renamed, update all items automatically
      if (updatedData.name && updatedData.name.trim() !== oldName.trim()) {
        const renamedItems = renameCategoryInItems(items, oldName, updatedData.name);
        updateItems(renamedItems);
      }
    },
    [categories, items, updateCategories, updateItems]
  );

  const handleDeleteCategory = useCallback(
    (id: string, categoryName: string, reassignTo: string) => {
      const remainingCats = categories.filter((c) => c.id !== id);
      updateCategories(remainingCats);

      // Reassign products to target category
      const reassignedItems = reassignCategoryInItems(items, categoryName, reassignTo);
      updateItems(reassignedItems);
    },
    [categories, items, updateCategories, updateItems]
  );

  // Dynamic statistics
  const stats = useMemo(() => computeInventoryStats(items), [items]);

  // Categories list for filter chips
  const categoryNames = useMemo(() => {
    const list = ['All'];
    categories.forEach((c) => {
      if (!list.includes(c.name)) list.push(c.name);
    });
    items.forEach((i) => {
      if (i.category && !list.includes(i.category.trim())) {
        list.push(i.category.trim());
      }
    });
    return list;
  }, [categories, items]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col lg:flex-row font-sans selection:bg-sky-500 selection:text-white">
      {/* 1. Side Navigation (Mobile Drawer & Desktop Rail) */}
      <SideNav
        isOpen={sideNavOpen}
        onClose={() => setSideNavOpen(false)}
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          setSideNavOpen(false);
        }}
        totalItems={items.length}
        collectiveQty={stats.collectiveQty}
        categoriesCount={categories.length}
      />

      {/* 2. Main App Content Wrapper */}
      <div className="flex-1 flex flex-col min-w-0 pb-12">
        {/* Top App Bar */}
        <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-3.5 sm:px-6 py-2.5">
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
            {/* Hamburger button on mobile & App identity */}
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setSideNavOpen(true)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition active:scale-95 lg:hidden"
                aria-label="Open Navigation Menu"
              >
                <Menu className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-400 to-sky-500 flex items-center justify-center text-white shadow-xs shrink-0">
                  <Package className="w-4 h-4" />
                </div>
                <span className="font-bold text-base text-white tracking-tight">PantryPal</span>
                <span className="text-slate-600 hidden sm:inline">/</span>
                <span className="text-xs text-slate-400 uppercase font-semibold tracking-wider font-mono hidden sm:inline">
                  {activeTab === 'dashboard' && 'Dashboard'}
                  {(activeTab === 'inventory' || activeTab === 'categories') && 'Inventory & Categories'}
                  {activeTab === 'admin' && 'Admin & Backup'}
                </span>
                <OfflineIndicator />
              </div>
            </div>

            {/* Top Bar Actions: PWA install */}
            <div className="flex items-center gap-2">
              <PWAInstallButton />
            </div>
          </div>
        </header>

        {/* Tab-Switched View Body */}
        <main className="flex-1 max-w-5xl w-full mx-auto px-3.5 sm:px-6 py-4 sm:py-6">
          {/* ======================= DASHBOARD TAB ======================= */}
          {activeTab === 'dashboard' && (
            <DashboardView
              stats={stats}
              items={items}
              categories={categories}
              movements={movements}
              onNavigate={(tab) => setActiveTab(tab)}
              onOpenManualStock={() => {
                setManualStockCategory(undefined);
                setManualStockOpen(true);
              }}
              onOpenItemDetail={(item) => setDetailItem(item)}
            />
          )}

          {/* ======================= ADMIN TAB ======================= */}
          {activeTab === 'admin' && (
            <AdminView
              items={items}
              categories={categories}
              movementsCount={movements.length}
              onImportData={(importedItems, importedCats) => {
                updateItems(importedItems);
                if (importedCats) updateCategories(importedCats);
              }}
              onResetDemoData={() => {
                updateItems(SAMPLE_DEMO_INVENTORY);
                updateCategories(INITIAL_CATEGORIES);
              }}
              onClearAllData={() => {
                updateItems([]);
              }}
              onOpenCSVImport={() => setCsvModalOpen(true)}
            />
          )}

          {/* ======================= OFFLINE EMERGENCY KNOWLEDGE TAB ======================= */}
          {activeTab === 'guides' && (
            <GuidesView />
          )}

                    {/* ======================= STANDALONE PROTOCOL CHECKLISTS SYSTEM ======================= */}
          {activeTab === 'checklists' && (
            <ChecklistsView 
              items={items}
              onUpdateItem={handleUpdateItem}
            />
          )}

          {/* ======================= MERGED INVENTORY & CATEGORIES TAB ======================= */}
          {(activeTab === 'inventory' || activeTab === 'categories') && (
            <InventoryView
              items={items}
              categories={categories}
              stats={stats}
              isLoading={isLoading}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              selectedCategory={selectedCategory}
              setSelectedCategory={setSelectedCategory}
              viewSortFilter={viewSortFilter}
              setViewSortFilter={setViewSortFilter}
              onUpdateItem={handleUpdateItem}
              onRegisterNewItem={handleSaveItem}
              onDeleteItem={handleDeleteItem}
              onOpenDetail={(item) => setDetailItem(item)}
              onOpenEditItem={(item) => {
                setEditingItem(item);
                setFormOpen(true);
              }}
              onOpenManualStock={(preselectedCat) => {
                setManualStockCategory(preselectedCat);
                setManualStockOpen(true);
              }}
              onOpenCSVImport={() => setCsvModalOpen(true)}
              onAddCategory={handleAddCategory}
              onEditCategory={handleEditCategory}
              onDeleteCategory={handleDeleteCategory}
            />
          )}
        </main>
      </div>

      {/* Manual Stock Intake Modal (Restock existing or register new manually) */}
      <ManualStockModal
        isOpen={manualStockOpen}
        onClose={() => {
          setManualStockOpen(false);
          setManualStockCategory(undefined);
        }}
        items={items}
        categories={categories}
        defaultCategory={manualStockCategory}
        onAddCategory={handleAddCategory}
        onOpenCSVImport={() => setCsvModalOpen(true)}
        onStockAdded={(updated) => {
          handleUpdateItem(updated);
          recordMovement({
            itemId: updated.id,
            itemName: updated.name,
            barcode: updated.id,
            type: 'in',
            unit: updated.unit,
            quantity: 1,
            resultingTotal: updated.quantity,
          }).then(setMovements);
        }}
        onNewProductCreated={(created) => {
          handleSaveItem(created);
          recordMovement({
            itemId: created.id,
            itemName: created.name,
            barcode: created.id,
            type: 'in',
            unit: created.unit,
            quantity: created.quantity,
            resultingTotal: created.quantity,
          }).then(setMovements);
        }}
      />

      {/* CSV Bulk Import Modal */}
      <CSVImportModal
        isOpen={csvModalOpen}
        onClose={() => setCsvModalOpen(false)}
        existingItems={items}
        existingCategories={categories}
        onImportComplete={(importedItems, allCategories) => {
          updateItems(importedItems);
          if (allCategories) {
            updateCategories(allCategories);
          }
        }}
      />

      {/* Edit Item Modal */}
      <ItemFormModal
        isOpen={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditingItem(null);
        }}
        onSave={handleSaveItem}
        initialItem={editingItem}
        existingItems={items}
        categories={categories}
        onAddCategory={handleAddCategory}
      />

      {/* Item Detail Modal (All use-by date entries) */}
      <ItemDetailModal
        item={detailItem}
        isOpen={Boolean(detailItem)}
        onClose={() => setDetailItem(null)}
        onAddBatch={handleAddBatch}
        onIncrementBatch={handleIncrementBatch}
        onDecrementBatch={handleDecrementBatch}
        onDeleteBatch={handleDeleteBatch}
        onEditItemInfo={(item) => {
          setDetailItem(null);
          setEditingItem(item);
          setFormOpen(true);
        }}
        onDeleteItem={handleDeleteItem}
      />
    </div>
  );
}
