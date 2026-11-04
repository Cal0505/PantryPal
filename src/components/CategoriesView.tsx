import React, { useState } from 'react';
import {
  Layers,
  Plus,
  Edit2,
  Trash2,
  Package,
  Check,
  X,
  AlertTriangle,
  FolderOpen,
} from 'lucide-react';
import { CategoryItem, InventoryItem } from '../types/inventory';

interface CategoriesViewProps {
  categories: CategoryItem[];
  items: InventoryItem[];
  onAddCategory: (category: Omit<CategoryItem, 'id' | 'createdAt'>) => void;
  onEditCategory: (id: string, updated: Partial<CategoryItem>, oldName: string) => void;
  onDeleteCategory: (id: string, categoryName: string, reassignTo: string) => void;
  onSelectCategoryFilter: (categoryName: string) => void;
}

const COLOR_OPTIONS = [
  { name: 'Amber', value: 'amber', bg: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
  { name: 'Sky Blue', value: 'sky', bg: 'bg-sky-500/20 text-sky-300 border-sky-500/40' },
  { name: 'Emerald', value: 'emerald', bg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
  { name: 'Rose', value: 'rose', bg: 'bg-rose-500/20 text-rose-300 border-rose-500/40' },
  { name: 'Purple', value: 'purple', bg: 'bg-purple-500/20 text-purple-300 border-purple-500/40' },
  { name: 'Blue', value: 'blue', bg: 'bg-blue-500/20 text-blue-300 border-blue-500/40' },
  { name: 'Orange', value: 'orange', bg: 'bg-orange-500/20 text-orange-300 border-orange-500/40' },
  { name: 'Slate', value: 'slate', bg: 'bg-slate-500/20 text-slate-300 border-slate-500/40' },
];

export const CategoriesView: React.FC<CategoriesViewProps> = ({
  categories,
  items,
  onAddCategory,
  onEditCategory,
  onDeleteCategory,
  onSelectCategoryFilter,
}) => {
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'delete' | null>(null);
  const [activeCategory, setActiveCategory] = useState<CategoryItem | null>(null);

  // Form inputs
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formColor, setFormColor] = useState('sky');
  const [reassignTarget, setReassignTarget] = useState('General');
  const [error, setError] = useState<string | null>(null);

  // Calculate stats per category
  const categoryStats = React.useMemo(() => {
    const stats: Record<string, { itemCount: number; totalUnits: number }> = {};
    categories.forEach((cat) => {
      stats[cat.name] = { itemCount: 0, totalUnits: 0 };
    });

    items.forEach((item) => {
      const catName = item.category || 'General';
      if (!stats[catName]) {
        stats[catName] = { itemCount: 0, totalUnits: 0 };
      }
      stats[catName].itemCount += 1;
      stats[catName].totalUnits += item.quantity;
    });

    return stats;
  }, [categories, items]);

  const openCreateModal = () => {
    setFormName('');
    setFormDescription('');
    setFormColor('sky');
    setError(null);
    setModalMode('create');
  };

  const openEditModal = (cat: CategoryItem) => {
    setActiveCategory(cat);
    setFormName(cat.name);
    setFormDescription(cat.description || '');
    setFormColor(cat.color || 'sky');
    setError(null);
    setModalMode('edit');
  };

  const openDeleteModal = (cat: CategoryItem) => {
    setActiveCategory(cat);
    // Find a fallback category that is not the one being deleted
    const other = categories.find((c) => c.id !== cat.id);
    setReassignTarget(other ? other.name : 'General');
    setError(null);
    setModalMode('delete');
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = formName.trim();
    if (!cleanName) {
      setError('Category name cannot be empty.');
      return;
    }

    if (modalMode === 'create') {
      const duplicate = categories.some((c) => c.name.toLowerCase() === cleanName.toLowerCase());
      if (duplicate) {
        setError('A category with this name already exists.');
        return;
      }
      onAddCategory({
        name: cleanName,
        description: formDescription.trim(),
        color: formColor,
      });
    } else if (modalMode === 'edit' && activeCategory) {
      const duplicate = categories.some(
        (c) => c.id !== activeCategory.id && c.name.toLowerCase() === cleanName.toLowerCase()
      );
      if (duplicate) {
        setError('Another category with this name already exists.');
        return;
      }
      onEditCategory(
        activeCategory.id,
        {
          name: cleanName,
          description: formDescription.trim(),
          color: formColor,
        },
        activeCategory.name
      );
    }

    setModalMode(null);
    setActiveCategory(null);
  };

  const handleConfirmDelete = () => {
    if (!activeCategory) return;
    onDeleteCategory(activeCategory.id, activeCategory.name, reassignTarget);
    setModalMode(null);
    setActiveCategory(null);
  };

  return (
    <div className="space-y-4">
      {/* Header with Title and Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <Layers className="w-5 h-5 text-sky-400" />
            Category Management
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Organize inventory items into categories. Add, edit names, or delete with safe item reassignment.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-semibold text-xs transition active:scale-95 shadow-md shadow-sky-500/20 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>New Category</span>
        </button>
      </div>

      {/* Categories Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {categories.map((cat) => {
          const stats = categoryStats[cat.name] || { itemCount: 0, totalUnits: 0 };
          const colorObj = COLOR_OPTIONS.find((c) => c.value === cat.color) || COLOR_OPTIONS[1];

          return (
            <div
              key={cat.id}
              className="p-4 rounded-xl bg-slate-900 border border-slate-800 shadow-xs hover:border-slate-700 transition flex flex-col justify-between group"
            >
              <div>
                {/* Header line: Tag & Action icons */}
                <div className="flex items-start justify-between gap-2">
                  <span
                    className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-md border ${colorObj.bg}`}
                  >
                    {cat.name}
                  </span>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEditModal(cat)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                      title="Edit Category Name & Details"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => openDeleteModal(cat)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
                      title="Delete Category"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Description */}
                <p className="text-xs text-slate-400 mt-2 line-clamp-2 min-h-[32px]">
                  {cat.description || 'No description provided.'}
                </p>
              </div>

              {/* Bottom stats & Inventory shortcut */}
              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block">
                      SKUs
                    </span>
                    <span className="font-mono font-bold text-white">{stats.itemCount}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block">
                      Stock
                    </span>
                    <span className="font-mono font-bold text-sky-400">{stats.totalUnits} units</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onSelectCategoryFilter(cat.name)}
                  className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-sky-300 transition"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  <span>View Items</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Create / Edit Category Modal */}
      {(modalMode === 'create' || modalMode === 'edit') && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-5 text-slate-100 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-semibold text-base text-white">
                {modalMode === 'create' ? 'Create New Category' : `Edit Category: ${activeCategory?.name}`}
              </h3>
              <button
                type="button"
                onClick={() => setModalMode(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveForm} className="space-y-3.5">
              {error && (
                <div className="p-2.5 rounded-lg bg-rose-950/70 border border-rose-800 text-rose-200 text-xs">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Category Name
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Frozen Foods, Condiments"
                  className="w-full px-3 py-2 text-sm bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                  autoFocus
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Badge Color
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {COLOR_OPTIONS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setFormColor(c.value)}
                      className={`px-2 py-1.5 rounded-lg text-xs font-medium border text-center transition ${
                        formColor === c.value
                          ? `${c.bg} ring-2 ring-white/60`
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Description (Optional)
                </label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="e.g. Items kept in the deep freezer below -18°C"
                  rows={2}
                  className="w-full px-3 py-2 text-sm bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-hidden focus:ring-2 focus:ring-sky-500 resize-none"
                />
              </div>

              {modalMode === 'edit' && activeCategory && (
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-slate-400">
                  Renaming will automatically update all existing products cataloged under <strong className="text-white">"{activeCategory.name}"</strong>.
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalMode(null)}
                  className="px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-semibold text-xs transition active:scale-95 shadow-sm"
                >
                  {modalMode === 'create' ? 'Create Category' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Category Modal */}
      {modalMode === 'delete' && activeCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-5 text-slate-100 shadow-2xl space-y-4">
            <div className="flex items-center gap-2.5 text-rose-400">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="font-semibold text-base text-white">
                Delete Category: {activeCategory.name}
              </h3>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to delete the <strong className="text-white">"{activeCategory.name}"</strong> category?
            </p>

            {/* Check if items are affected */}
            {(categoryStats[activeCategory.name]?.itemCount || 0) > 0 ? (
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
                <span className="text-amber-400 font-semibold block">
                  {categoryStats[activeCategory.name].itemCount} products currently belong to this category.
                </span>
                <label className="block text-[11px] text-slate-400 uppercase font-semibold">
                  Reassign existing products to:
                </label>
                <select
                  value={reassignTarget}
                  onChange={(e) => setReassignTarget(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-800 rounded-lg text-white"
                >
                  {categories
                    .filter((c) => c.id !== activeCategory.id)
                    .map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  <option value="General">General / Uncategorized</option>
                </select>
              </div>
            ) : (
              <p className="text-xs text-slate-400">
                No items currently belong to this category. It will be removed immediately.
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setModalMode(null)}
                className="px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition active:scale-95 shadow-sm"
              >
                Delete Category
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
