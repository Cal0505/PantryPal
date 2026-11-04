import React, { useState } from 'react';
import {
  X,
  Plus,
  Minus,
  Calendar,
  Tag,
  MapPin,
  Clock,
  Edit2,
  Trash2,
  AlertTriangle,
  Copy,
  Check,
  Package,
} from 'lucide-react';
import { InventoryItem, DateBatch, formatUnitLabel } from '../types/inventory';
import { BarcodeDisplay } from './BarcodeDisplay';
import { getExpiryStatus, getDaysRemaining, formatBatchDate } from '../services/storage';

interface ItemDetailModalProps {
  item: InventoryItem | null;
  isOpen: boolean;
  onClose: () => void;
  onAddBatch: (item: InventoryItem, bestByDate: string, qty: number) => void;
  onIncrementBatch: (item: InventoryItem, batchId: string) => void;
  onDecrementBatch: (item: InventoryItem, batchId: string) => void;
  onDeleteBatch: (item: InventoryItem, batchId: string) => void;
  onEditItemInfo: (item: InventoryItem) => void;
  onDeleteItem: (itemId: string) => void;
}

export const ItemDetailModal: React.FC<ItemDetailModalProps> = ({
  item,
  isOpen,
  onClose,
  onAddBatch,
  onIncrementBatch,
  onDecrementBatch,
  onDeleteBatch,
  onEditItemInfo,
  onDeleteItem,
}) => {
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // New batch inline form state
  const [showAddBatch, setShowAddBatch] = useState(false);
  const [newBatchDate, setNewBatchDate] = useState('');
  const [newBatchQty, setNewBatchQty] = useState(1);

  if (!isOpen || !item) return null;

  const copyBarcode = () => {
    navigator.clipboard.writeText(item.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAddNewBatch = (e: React.FormEvent) => {
    e.preventDefault();
    onAddBatch(item, newBatchDate.trim(), Math.max(1, newBatchQty));
    setNewBatchDate('');
    setNewBatchQty(1);
    setShowAddBatch(false);
  };

  const setDatePreset = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    setNewBatchDate(d.toISOString().split('T')[0]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-4 backdrop-blur-xs animate-in fade-in overflow-y-auto">
      <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden text-slate-100 my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-950/60">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Tag className="w-3.5 h-3.5 text-indigo-400" />
            <span>{item.category || 'General'}</span>
            {item.location && (
              <>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {item.location}
                </span>
              </>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
          {/* Title & Barcode */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight leading-snug">
                {item.name}
              </h2>
              <span className="font-mono text-xs text-sky-400 font-semibold block mt-0.5">
                Barcode ID: {item.id}
              </span>
            </div>

            {/* Total Collective Quantity Badge */}
            <div className="p-2 sm:px-3 sm:py-2 rounded-xl bg-slate-950 border border-slate-800 text-left sm:text-right shrink-0">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block leading-tight">
                Collective Qty
              </span>
              <div className="font-mono font-bold text-2xl text-white flex items-baseline gap-1">
                <span>{item.quantity}</span>
                <span className="text-xs text-slate-400 font-normal">
                  {formatUnitLabel(item.quantity, item.unit)}
                </span>
              </div>
            </div>
          </div>

          {/* Barcode Graphic */}
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex flex-col items-center justify-center relative">
            <BarcodeDisplay code={item.id} height={46} />
            <button
              onClick={copyBarcode}
              className="absolute top-2 right-2 p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 text-[10px] flex items-center gap-1"
              title="Copy Barcode"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>

          {/* Central Feature: All Date Batches Breakdown */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider font-semibold text-slate-300 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-amber-400" />
                All Use-By Dates ({item.batches.length} {item.batches.length === 1 ? 'entry' : 'entries'})
              </span>
              <button
                type="button"
                onClick={() => setShowAddBatch(!showAddBatch)}
                className="text-xs font-semibold text-sky-400 hover:text-sky-300 flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Date Entry</span>
              </button>
            </div>

            {/* Inline Add Batch Form */}
            {showAddBatch && (
              <form onSubmit={handleAddNewBatch} className="p-3 rounded-xl bg-slate-950 border border-sky-500/40 space-y-2.5 animate-in fade-in">
                <div className="flex items-center justify-between text-xs text-slate-300 font-semibold">
                  <span>Add New Use-By Date Batch</span>
                  <button
                    type="button"
                    onClick={() => setShowAddBatch(false)}
                    className="text-slate-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-1">
                      Use-By Date
                    </label>
                    <input
                      type="date"
                      value={newBatchDate}
                      onChange={(e) => setNewBatchDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-slate-900 border border-slate-800 rounded-lg text-white font-mono"
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-1">
                      Quantity of this Date
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setNewBatchQty(Math.max(1, newBatchQty - 1))}
                        className="w-8 h-8 rounded-lg bg-slate-800 text-white font-bold"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="1"
                        value={newBatchQty}
                        onChange={(e) => setNewBatchQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                        className="w-16 text-center py-1 rounded-lg bg-slate-900 border border-slate-800 text-white font-mono font-bold text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => setNewBatchQty(newBatchQty + 1)}
                        className="w-8 h-8 rounded-lg bg-slate-800 text-white font-bold"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                {/* Date Presets */}
                <div className="flex flex-wrap gap-1 text-[10px] pt-1">
                  <span className="text-slate-500 self-center mr-1">Presets:</span>
                  <button
                    type="button"
                    onClick={() => setDatePreset(7)}
                    className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300"
                  >
                    +1 week
                  </button>
                  <button
                    type="button"
                    onClick={() => setDatePreset(30)}
                    className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300"
                  >
                    +1 month
                  </button>
                  <button
                    type="button"
                    onClick={() => setDatePreset(90)}
                    className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300"
                  >
                    +3 months
                  </button>
                  <button
                    type="button"
                    onClick={() => setDatePreset(180)}
                    className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300"
                  >
                    +6 months
                  </button>
                  <button
                    type="button"
                    onClick={() => setDatePreset(365)}
                    className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300"
                  >
                    +1 year
                  </button>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowAddBatch(false)}
                    className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-3.5 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-white font-semibold text-xs transition"
                  >
                    Add Batch Entry
                  </button>
                </div>
              </form>
            )}

            {/* List of batches with individual dates and quantities */}
            <div className="space-y-2">
              {item.batches.map((batch, index) => {
                const expiryStatus = getExpiryStatus(batch.bestByDate);
                const daysRemaining = getDaysRemaining(batch.bestByDate);

                return (
                  <div
                    key={batch.id || index}
                    className="p-3 rounded-xl bg-slate-950 border border-slate-800/90 flex items-center justify-between gap-3"
                  >
                    {/* Left: Date & Status */}
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-white font-mono">
                          {formatBatchDate(batch.bestByDate)}
                        </span>
                        {batch.bestByDate && (
                          <>
                            {expiryStatus === 'expired' && (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-rose-950/80 text-rose-300 border border-rose-800/60 flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3 text-rose-400" />
                                Expired {daysRemaining !== null ? `${Math.abs(daysRemaining)}d ago` : ''}
                              </span>
                            )}
                            {expiryStatus === 'expiring-soon' && (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-950/80 text-amber-300 border border-amber-800/60 flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3 text-amber-400" />
                                {daysRemaining}d left
                              </span>
                            )}
                            {expiryStatus === 'fresh' && (
                              <span className="text-[10px] font-medium text-emerald-400">
                                Fresh ({daysRemaining}d left)
                              </span>
                            )}
                          </>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-500 block">
                        Added: {new Date(batch.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    {/* Right: Quantity of this batch + Tactile [-] and [+] Stepper */}
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right min-w-[40px]">
                        <span className="font-mono font-extrabold text-xl text-white">
                          {batch.quantity}
                        </span>
                        <span className="text-[9px] text-slate-500 block">
                          {formatUnitLabel(batch.quantity, item.unit)}
                        </span>
                      </div>

                      {/* Steppers */}
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onDecrementBatch(item, batch.id)}
                          className="w-9 h-9 rounded-lg bg-slate-900 hover:bg-slate-800 text-rose-400 font-bold flex items-center justify-center transition active:scale-95 border border-slate-800"
                          title="Deduct 1 from this batch"
                        >
                          <Minus className="w-3.5 h-3.5 font-bold" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onIncrementBatch(item, batch.id)}
                          className="w-9 h-9 rounded-lg bg-slate-900 hover:bg-slate-800 text-emerald-400 font-bold flex items-center justify-center transition active:scale-95 border border-slate-800"
                          title="Add 1 to this batch"
                        >
                          <Plus className="w-3.5 h-3.5 font-bold" />
                        </button>
                        {item.batches.length > 1 && (
                          <button
                            type="button"
                            onClick={() => onDeleteBatch(item, batch.id)}
                            className="p-2 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-slate-900"
                            title="Remove this batch entry"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Notes if present */}
          {item.notes && (
            <div className="text-xs text-slate-400 bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="font-semibold text-slate-300 block mb-0.5">Notes:</span>
              <p className="whitespace-pre-line">{item.notes}</p>
            </div>
          )}

          {/* Timestamps */}
          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Updated: {new Date(item.updatedAt).toLocaleDateString()}
            </span>
            <span>Created: {new Date(item.createdAt).toLocaleDateString()}</span>
          </div>

          {/* Footer Actions: Edit Item Info & Delete Item */}
          <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
            {confirmDelete ? (
              <div className="flex items-center gap-2 w-full">
                <span className="text-xs text-rose-400 font-medium flex-1">Delete item and all batches?</span>
                <button
                  type="button"
                  onClick={() => onDeleteItem(item.id)}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold"
                >
                  Yes, Delete All
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="p-2 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition"
                  title="Delete Item"
                >
                  <Trash2 className="w-4 h-4" />
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onEditItemInfo(item)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Edit Info</span>
                  </button>

                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition"
                  >
                    Done
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
