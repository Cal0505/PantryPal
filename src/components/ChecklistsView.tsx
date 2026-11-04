import React, { useState, useEffect, useMemo } from 'react';
import { CheckCircle2, ListPlus, Trash2, ArrowUp, ArrowDown, ClipboardList, Clock, AlertTriangle, PackagePlus, Plus, Settings, Edit3, ArrowLeft } from 'lucide-react';
import { InventoryItem } from '../types/inventory';

interface ChecklistTask {
  id: string;
  text: string;
}

interface Checklist {
  id: string;
  title: string;
  category: 'daily' | 'weekly' | 'monthly' | 'events';
  tasks: ChecklistTask[];
  createdAt: string;
  lastCompletedAt?: string;
}

interface HistoryLog {
  id: string;
  checklistTitle: string;
  category: string;
  timestamp: string;
  reason?: string;
  additionalInfo?: string;
  usedItems?: { name: string; amount: number }[];
}

interface ChecklistsViewProps {
  items: InventoryItem[];
  onUpdateItem: (updated: InventoryItem) => void;
}
const DEFAULT_CHECKLISTS: Checklist[] = [
  {
    id: 'sys-chk-1',
    title: 'Daily General Operations',
    category: 'daily',
    tasks: [
      { id: 't1', text: 'Water plants and check indoor environment' },
      { id: 't2', text: 'Feed dog and monitor water bowl' },
      { id: 't3', text: 'Listen to radio emergency frequency updates' },
      { id: 't4', text: 'Verify bug-out bag gear seals' }
    ],
    createdAt: new Date().toISOString()
  },
  {
    id: 'sys-chk-2',
    title: 'Medical Emergency Protocol',
    category: 'events',
    tasks: [
      { id: 'me1', text: 'Assess casualty and stabilize vital metrics' },
      { id: 'me2', text: 'Apply sterile gauze dressings or compression wraps' },
      { id: 'me3', text: 'Replenish consumed medical supplies' },
      { id: 'me4', text: 'Clean and sterilize all emergency instruments' }
    ],
    createdAt: new Date().toISOString()
  }
];
export const ChecklistsView: React.FC<ChecklistsViewProps> = ({ items, onUpdateItem }) => {
  const [activeTab, setActiveTab] = useState<'all' | 'daily' | 'weekly' | 'monthly' | 'events'>('all');
  
  const [checklists, setChecklists] = useState<Checklist[]>(() => {
    const raw = localStorage.getItem('pantrypal_custom_checklists');
    return raw ? JSON.parse(raw) : DEFAULT_CHECKLISTS;
  });

  const [historyLogs, setHistoryLogs] = useState<HistoryLog[]>(() => {
    const raw = localStorage.getItem('pantrypal_checklist_history');
    return raw ? JSON.parse(raw) : [];
  });

  const [selectedChecklist, setSelectedGuide] = useState<Checklist | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [isManagingAll, setIsManagingAll] = useState(false);

  const [formTitle, setNewTitle] = useState('');
  const [formCategory, setFormCategory] = useState<'daily' | 'weekly' | 'monthly' | 'events'>('daily');
  const [formTasks, setFormTasks] = useState<ChecklistTask[]>([{ id: 'init-1', text: '' }]);
  const [checkedTaskIds, setCheckedTaskIds] = useState<Set<string>>(new Set());

  const [eventReason, setEventReason] = useState('');
  const [eventAddInfo, setEventAddInfo] = useState('');
  const [selectedInventoryId, setSelectedInventoryId] = useState('');
  const [deductionQty, setDeductionQty] = useState(1);
  const [usedItemsList, setUsedItemsList] = useState<{ id: string; name: string; amount: number }[]>([]);
  useEffect(() => {
    localStorage.setItem('pantrypal_custom_checklists', JSON.stringify(checklists));
  }, [checklists]);

  useEffect(() => {
    localStorage.setItem('pantrypal_checklist_history', JSON.stringify(historyLogs));
  }, [historyLogs]);

  useEffect(() => {
    const today = new Date();
    const lastResetDay = localStorage.getItem('pantrypal_last_reset_day') || '';
    const currentDayStr = today.toDateString();
    let updatedChecklists = [...checklists];
    let dataChanged = false;

    if (lastResetDay !== currentDayStr) {
      updatedChecklists = updatedChecklists.map(c => c.category === 'daily' ? { ...c } : c);
      localStorage.setItem('pantrypal_last_reset_day', currentDayStr);
      dataChanged = true;
    }

    updatedChecklists = updatedChecklists.map(c => {
      if (c.category === 'monthly' && c.lastCompletedAt) {
        const lastDone = new Date(c.lastCompletedAt);
        const nextResetDue = new Date(lastDone);
        nextResetDue.setMonth(nextResetDue.getMonth() + 1);
        if (today >= nextResetDue) {
          dataChanged = true;
          return { ...c, lastCompletedAt: undefined };
        }
      }
      return c;
    });

    if (dataChanged) {
      setChecklists(updatedChecklists);
      localStorage.setItem('pantrypal_custom_checklists', JSON.stringify(updatedChecklists));
      setCheckedTaskIds(new Set());
    }
  }, [checklists]);
  const progressPercentage = useMemo(() => {
    if (!selectedChecklist || selectedChecklist.tasks.length === 0) return 0;
    const currentListTaskIds = selectedChecklist.tasks.map(t => t.id);
    const completedCount = currentListTaskIds.filter(id => checkedTaskIds.has(id)).length;
    return Math.round((completedCount / selectedChecklist.tasks.length) * 100);
  }, [selectedChecklist, checkedTaskIds]);

  const filteredChecklists = useMemo(() => {
    const now = new Date().getTime();
    const twentyFourHours = 24 * 60 * 60 * 1000;
    const sevenDays = 7 * twentyFourHours;

    return checklists.filter(c => {
      if (activeTab !== 'all' && c.category !== activeTab) return false;
      if (!c.lastCompletedAt) return true;

      const completionTime = new Date(c.lastCompletedAt).getTime();
      const elapsed = now - completionTime;

      if (c.category === 'daily') return elapsed >= twentyFourHours;
      if (c.category === 'weekly') return elapsed >= sevenDays;
      if (c.category === 'monthly') {
        const nextResetDue = new Date(c.lastCompletedAt);
        nextResetDue.setMonth(nextResetDue.getMonth() + 1);
        return new Date() >= nextResetDue;
      }
      return true;
    });
  }, [checklists, activeTab]);
  const moveTaskRow = (index: number, direction: 'up' | 'down') => {
    const nextIndex = direction === 'up' ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= formTasks.length) return;
    const updated = [...formTasks];
    const temporary = updated[index];
    updated[index] = updated[nextIndex];
    updated[nextIndex] = temporary;
    setFormTasks(updated);
  };

  const handleAddNewTaskRowField = () => {
    setFormTasks(prev => [...prev, { id: `task-row-${Date.now()}-${Math.random()}`, text: '' }]);
  };

  const handleRemoveTaskRowField = (index: number) => {
    if (formTasks.length <= 1) return;
    setFormTasks(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleTaskFieldTextChange = (index: number, val: string) => {
    const updated = [...formTasks];
    updated[index] = { ...updated[index], text: val };
    setFormTasks(updated);
  };

  const handleSaveFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = formTitle.trim();
    const validatedTasks = formTasks.filter(t => t.text.trim() !== '');
    if (!cleanTitle || validatedTasks.length === 0) return;

    if (isEditing && selectedChecklist) {
      const updatedList = checklists.map(c => c.id === selectedChecklist.id ? {
        ...c, title: cleanTitle, category: formCategory, tasks: validatedTasks
      } : c);
      setChecklists(updatedList);
      const matchedInstance = updatedList.find(c => c.id === selectedChecklist.id);
      if (matchedInstance) setSelectedGuide(matchedInstance);
      setIsEditing(false);
    } else {
      const created: Checklist = {
        id: `chk-${Date.now()}`, title: cleanTitle, category: formCategory, tasks: validatedTasks, createdAt: new Date().toISOString()
      };
      setChecklists(prev => [created, ...prev]);
      setSelectedGuide(created);
      setIsAddingNew(false);
    }
    setCheckedTaskIds(new Set());
    setIsManagingAll(false);
  };
  const triggerOpenEditMode = (customChecklist?: Checklist) => {
    const target = customChecklist || selectedChecklist;
    if (!target) return;
    setSelectedGuide(target);
    setNewTitle(target.title);
    setFormCategory(target.category);
    setFormTasks(target.tasks.map(t => ({ ...t })));
    setIsEditing(true);
    setIsAddingNew(false);
    setIsManagingAll(false);
  };

  const triggerOpenCreateMode = () => {
    setNewTitle('');
    setFormCategory(activeTab === 'all' ? 'daily' : activeTab);
    setFormTasks([{ id: `task-row-${Date.now()}`, text: '' }]);
    setIsAddingNew(true);
    setSelectedGuide(null);
    setIsEditing(false);
    setIsManagingAll(false);
  };

  const handleDeleteChecklist = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedChecklist?.id === id) setSelectedGuide(null);
    setChecklists(prev => prev.filter(c => c.id !== id));
  };

  const handleAddUsedItemToSection = () => {
    if (!selectedInventoryId) return;
    const targetItem = items.find(i => i.id === selectedInventoryId);
    if (!targetItem) return;

    setUsedItemsList(prev => {
      const exists = prev.find(i => i.id === selectedInventoryId);
      if (exists) {
        return prev.map(i => i.id === selectedInventoryId ? { ...i, amount: i.amount + deductionQty } : i);
      }
      return [...prev, { id: selectedInventoryId, name: targetItem.name, amount: deductionQty }];
    });
    setDeductionQty(1);
  };

  const handleToggleCheckboxIdValue = (id: string) => {
    setCheckedTaskIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const handleLogCompletionSubmit = () => {
    if (!selectedChecklist) return;

    usedItemsList.forEach(used => {
      const nativeItem = items.find(i => i.id === used.id);
      if (nativeItem) {
        const updatedStock: InventoryItem = {
          ...nativeItem, quantity: Math.max(0, nativeItem.quantity - used.amount), updatedAt: new Date().toISOString()
        };
        onUpdateItem(updatedStock);
      }
    });

    const nowISOString = new Date().toISOString();
    const newHistoryEntry: HistoryLog = {
      id: `log-${Date.now()}`,
      checklistTitle: selectedChecklist.title,
      category: selectedChecklist.category,
      timestamp: new Date().toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
      reason: selectedChecklist.category === 'events' ? eventReason.trim() : undefined,
      additionalInfo: selectedChecklist.category === 'events' ? eventAddInfo.trim() : undefined,
      usedItems: usedItemsList.length > 0 ? usedItemsList.map(u => ({ name: u.name, amount: u.amount })) : undefined
    };

    setHistoryLogs(prev => {
      const base = [newHistoryEntry, ...prev];
      const sectionFilter = base.filter(l => l.category === selectedChecklist.category);
      if (sectionFilter.length > 7) {
        const oldestAllowed = sectionFilter[sectionFilter.length - 1];
        return base.filter(l => l.category !== selectedChecklist.category || l.id !== oldestAllowed.id);
      }
      return base;
    });

    const updatedChecklistsList = checklists.map(c => c.id === selectedChecklist.id ? { ...c, lastCompletedAt: nowISOString } : c);
    setChecklists(updatedChecklistsList);

    if (selectedChecklist.category === 'events' && usedItemsList.length > 0) {
      const restockTasks: ChecklistTask[] = [
        { id: `re-t1-${Date.now()}`, text: 'Replenish and restock raw medical/incident supplies consumed' },
        { id: `re-t2-${Date.now()}`, text: 'Clean and completely wipe down the medical trauma staging area' }
      ];
      if (eventReason.toLowerCase().includes('carl')) {
        restockTasks.push({ id: `re-t3-${Date.now()}`, text: 'Check on Carl\'s ankle / injury recovery progress in 2 days' });
      }

      const autoGeneratedProtocol: Checklist = {
        id: `auto-chk-${Date.now()}`, title: `Post-Event Restock & Follow-Up: ${eventReason || 'Incident Routine'}`, category: 'events', tasks: restockTasks, createdAt: new Date().toISOString()
      };
      setChecklists([autoGeneratedProtocol, ...updatedChecklistsList]);
    }

    setCheckedTaskIds(new Set());
    setEventReason('');
    setEventAddInfo('');
    setUsedItemsList([]);
    setSelectedGuide(null);
  };

  return (
    <div className="space-y-4 max-w-5xl mx-auto p-1 font-sans text-slate-100 flex flex-col md:flex-row items-start gap-4 w-full">
      <div className="w-full md:w-80 space-y-2.5 shrink-0">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-2 grid grid-cols-5 gap-1 text-center shrink-0">
          {(['all', 'daily', 'weekly', 'monthly', 'events'] as const).map(tab => (
            <button key={tab} type="button" onClick={() => { setActiveTab(tab); setSelectedGuide(null); setIsAddingNew(false); setIsEditing(false); setIsManagingAll(false); }} className={`py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition ${activeTab === tab ? 'bg-sky-500 text-slate-950 font-extrabold' : 'text-slate-400 hover:text-slate-200'}`}>{tab}</button>
          ))}
        </div>

        <div className="space-y-1.5">
          <button type="button" onClick={triggerOpenCreateMode} className="w-full py-2.5 bg-gradient-to-r from-sky-500 to-blue-600 text-slate-950 text-xs font-extrabold rounded-xl flex items-center justify-center gap-1.5"><ListPlus className="w-4 h-4" /><span>Add New Checklist</span></button>
          <button type="button" onClick={() => { setIsManagingAll(true); setSelectedGuide(null); setIsAddingNew(false); setIsEditing(false); }} className={`w-full py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-slate-300 text-xs font-bold flex items-center justify-center gap-1.5 transition ${isManagingAll ? 'border-sky-500 text-sky-400 bg-sky-950/20' : ''}`}><Settings className="w-3.5 h-3.5" /><span>Manage Tasks</span></button>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 space-y-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-1">Tasks</span>
          <div className="space-y-1.5 max-h-[30vh] overflow-y-auto pr-0.5">
            {filteredChecklists.map(chk => (
              <div key={chk.id} onClick={() => { setSelectedGuide(chk); setIsEditing(false); setIsAddingNew(false); setIsManagingAll(false); setCheckedTaskIds(new Set()); setUsedItemsList([]); }} className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 text-xs cursor-pointer ${selectedChecklist?.id === chk.id ? 'bg-sky-500/10 border-sky-500/30 font-bold' : 'bg-slate-950/40 border-slate-800/60'}`}><div className="min-w-0"><span className="text-[9px] font-mono text-sky-400 block uppercase">{chk.category}</span><span className="block truncate text-slate-200 mt-0.5">{chk.title}</span></div></div>
            ))}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 space-y-2">
          <div className="flex items-center gap-1 text-slate-400 px-1"><Clock className="w-3.5 h-3.5 text-slate-500" /><span className="text-[10px] font-bold uppercase tracking-wider">Rolling Audit History (Last 7)</span></div>
          <div className="space-y-1.5 max-h-[15vh] overflow-y-auto text-[10px]">
            {historyLogs.filter(l => activeTab === 'all' || l.category === activeTab).map(log => (
              <div key={log.id} className="p-2 bg-slate-950/50 border border-slate-800 rounded-lg text-slate-400 font-mono"><div className="flex justify-between font-sans text-[11px] font-bold"><span className="truncate max-w-[130px]">{log.checklistTitle}</span><span className="text-emerald-400 text-[9px]">{log.timestamp}</span></div>{log.reason && <div className="text-slate-500 truncate mt-0.5">Reason: "{log.reason}"</div>}</div>
            ))}
          </div>
        </div>
      </div>
      <div className="flex-1 w-full space-y-4">
        {isManagingAll ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4 min-h-[60vh] w-full">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2.5">
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5"><Settings className="w-4 h-4 text-sky-400" /><span>Master Task Control Directory</span></h3>
              <button type="button" onClick={() => setIsManagingAll(false)} className="flex items-center gap-1 text-xs text-slate-400 hover:text-white"><ArrowLeft className="w-3.5 h-3.5" /><span>Back</span></button>
            </div>
            <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
              {checklists.map(chk => (
                <div key={chk.id} className="p-3 bg-slate-950/40 border border-slate-800 rounded-xl flex items-center justify-between gap-4">
                  <div className="min-w-0"><div className="flex items-center gap-2"><span className="text-[9px] font-mono font-bold bg-slate-800 border border-slate-700/60 text-slate-400 px-1.5 py-0.5 rounded uppercase">{chk.category}</span><span className="text-[10px] text-slate-500 font-mono">Steps: {chk.tasks.length}</span></div><span className="block font-bold text-slate-200 truncate mt-1.5">{chk.title}</span></div>
                  <div className="flex items-center gap-1.5 shrink-0"><button type="button" onClick={() => triggerOpenEditMode(chk)} className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-sky-400 hover:text-sky-300 rounded-lg transition"><Edit3 className="w-3.5 h-3.5" /></button><button type="button" onClick={(e) => handleDeleteChecklist(chk.id, e)} className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-500 hover:text-rose-400 rounded-lg transition"><Trash2 className="w-3.5 h-3.5" /></button></div>
                </div>
              ))}
            </div>
          </div>
        ) : (isAddingNew || isEditing) ? (
          <form onSubmit={handleSaveFormSubmit} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4 w-full">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <h3 className="text-sm font-bold text-white">{isEditing ? '⚙️ Edit' : '📝 Configure New System Protocol'}</h3>
              <button type="button" onClick={() => { setIsAddingNew(false); setIsEditing(false); }} className="text-xs text-slate-500 hover:text-white underline">Cancel</button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2"><label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Protocol Sheet Title</label><input type="text" value={formTitle} onChange={(e) => setNewTitle(e.target.value)} className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white" required /></div>
              <div><label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Frequency Group</label><select value={formCategory} onChange={(e) => setFormCategory(e.target.value as any)} className="w-full px-2.5 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-200 cursor-pointer"><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="events">Events</option></select></div>
            </div>
            <div className="space-y-2 pt-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Sequential Step Hierarchy Configuration</span>
              {formTasks.map((task, idx) => (
                <div key={task.id} className="flex items-center gap-2 bg-slate-950/40 p-2 rounded-xl border border-slate-800/60"><div className="flex items-center gap-1 shrink-0 font-mono text-xs font-bold text-slate-500 w-16"><span>{idx + 1}.</span><button type="button" onClick={() => moveTaskRow(idx, 'up')} disabled={idx === 0} className="p-0.5 rounded hover:bg-slate-800 disabled:opacity-20"><ArrowUp className="w-3 h-3" /></button><button type="button" onClick={() => moveTaskRow(idx, 'down')} disabled={idx === formTasks.length - 1} className="p-0.5 rounded hover:bg-slate-800 disabled:opacity-20"><ArrowDown className="w-3 h-3" /></button></div><input type="text" value={task.text} onChange={(e) => handleTaskFieldTextChange(idx, e.target.value)} className="flex-1 px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200" required /><button type="button" onClick={() => handleRemoveTaskRowField(idx)} disabled={formTasks.length <= 1} className="p-1.5 text-slate-600 hover:text-rose-400 disabled:opacity-20"><Trash2 className="w-3.5 h-3.5" /></button></div>
              ))}
              <button type="button" onClick={handleAddNewTaskRowField} className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-dashed border-slate-700 text-slate-400 hover:text-white text-xs font-bold mt-2 bg-slate-950/20"><Plus className="w-3.5 h-3.5" /><span>Append Next Step Row</span></button>
            </div>
            <button type="submit" className="w-full py-2.5 bg-emerald-500 text-slate-950 text-xs font-bold rounded-xl shadow-md">Save Active Protocol Book Page</button>
          </form>
        ) : selectedChecklist ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 min-h-[60vh] flex flex-col justify-between w-full">
            <div className="space-y-4">
              <div className="border-b border-slate-800 pb-3 flex justify-between items-start gap-4">
                <div>
                  <span className="text-[10px] font-mono font-bold bg-sky-500/10 border border-sky-500/20 text-sky-400 px-2 py-0.5 rounded-md uppercase tracking-wider">{selectedChecklist.category} Section</span>
                  <h2 className="text-base font-bold text-white tracking-tight mt-2">{selectedChecklist.title}</h2>
                  {selectedChecklist.category === 'monthly' && selectedChecklist.lastCompletedAt && (
                    <span className="text-[10px] text-emerald-400 font-mono mt-1 block">🗓️ Next rolling anniversary reset: {new Date(new Date(selectedChecklist.lastCompletedAt).setMonth(new Date(selectedChecklist.lastCompletedAt).getMonth() + 1)).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  )}
                </div>
                <button type="button" onClick={() => triggerOpenEditMode()} className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold border border-slate-700/80">Edit</button>
              </div>
              <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl flex items-center justify-between gap-4 shadow-inner">
                <div className="flex-1"><span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Execution Metrics Dashboard</span><div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800"><div className="h-full bg-emerald-500 transition-all duration-300 rounded-full" style={{ width: `${progressPercentage}%` }} /></div></div>
                <div className="text-right shrink-0"><span className="text-xl font-mono font-extrabold text-white leading-none block">{progressPercentage}%</span><span className="text-[9px] font-semibold text-slate-400 uppercase mt-0.5 block">Complete</span></div>
              </div>
              <div className="space-y-2 pt-1">
                {selectedChecklist.tasks.map((task, idx) => {
                  const isDone = checkedTaskIds.has(task.id);
                  return (
                    <div key={task.id} onClick={() => handleToggleCheckboxIdValue(task.id)} className={`p-3 flex items-center gap-3 bg-slate-950/40 border rounded-xl cursor-pointer select-none ${isDone ? 'border-emerald-500/20 bg-emerald-500/5 opacity-40' : 'border-slate-800/80 hover:bg-slate-800/20'}`}><span className="font-mono text-xs font-bold text-slate-500 shrink-0 w-5">{idx + 1}.</span><div className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 ${isDone ? 'bg-emerald-500 border-emerald-400 text-slate-950' : 'border-slate-700 bg-slate-950'}`}>{isDone && <CheckCircle2 className="w-3.5 h-3.5" />}</div><span className={`text-xs sm:text-sm text-slate-200 truncate ${isDone ? 'line-through text-slate-500' : ''}`}>{task.text}</span></div>
                  );
                })}
              </div>
              {selectedChecklist.category === 'events' && (
                <div className="mt-5 p-4 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-4">
                  <div className="flex items-center gap-1.5 border-b border-slate-800 pb-2 text-amber-400"><AlertTriangle className="w-4 h-4" /><span className="text-[11px] font-bold uppercase tracking-wider">Dynamic Incident Logging Matrix</span></div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div><label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Reason for Event Trigger</label><input type="text" placeholder="e.g., Carl was injured..." value={eventReason} onChange={(e) => setEventReason(e.target.value)} className="w-full px-2.5 py-2 text-xs bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-hidden" /></div>
                    <div><label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Additional Details</label><input type="text" placeholder="e.g., Strained ankle..." value={eventAddInfo} onChange={(e) => setEventAddInfo(e.target.value)} className="w-full px-2.5 py-2 text-xs bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-hidden" /></div>
                  </div>
                  <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 space-y-2">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5 opacity-0" /> Log Items Consumed From Catalog DB</span>
                    <div className="flex flex-wrap items-center gap-2">
                      <select value={selectedInventoryId} onChange={(e) => setSelectedInventoryId(e.target.value)} className="flex-1 min-w-[140px] px-2.5 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 cursor-pointer"><option value="">-- Choose Stock Item --</option>{items.map(i => (<option key={i.id} value={i.id}>{i.name} (Stock: {i.quantity})</option>))}</select>
                      <input type="number" min="1" value={deductionQty} onChange={(e) => setDeductionQty(Math.max(1, parseInt(e.target.value, 10) || 1))} className="w-12 px-2 py-1.5 text-center text-xs bg-slate-950 border border-slate-800 rounded-lg text-white" /><button type="button" onClick={handleAddUsedItemToSection} className="p-1.5 bg-sky-600 text-white rounded-lg"><Plus className="w-3.5 h-3.5" /></button>
                    </div>
                    {usedItemsList.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1.5 border-t border-slate-800 mt-2">
                        {usedItemsList.map(u => (<span key={u.id} className="text-[10px] font-mono font-bold bg-slate-950 border border-slate-800 text-slate-300 px-2 py-0.5 rounded-md flex items-center gap-1.5"><span>{u.name} x{u.amount}</span><button type="button" onClick={() => setUsedItemsList(prev => prev.filter(i => i.id !== u.id))} className="text-slate-500 font-sans">×</button></span>))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="pt-5 border-t border-slate-800 mt-6 shrink-0"><button type="button" onClick={handleLogCompletionSubmit} className="w-full py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 text-xs font-extrabold rounded-xl shadow-md flex items-center justify-center gap-1.5"><CheckCircle2 className="w-4 h-4" /><span>Log Completion & Process Incident Actions</span></button></div>
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 min-h-[60vh] flex flex-col items-center justify-center text-center text-slate-500 w-full"><ClipboardList className="w-10 h-10 text-slate-700" /><h3 className="text-slate-400 font-bold text-sm mt-3">No Operational Protocol Sheet Open</h3><p className="text-[11px] text-slate-500 max-w-xs mt-1">Select any maintenance checklist or event trigger routine from your left side library index list panel to deploy your execution worksheet tools.</p></div>
        )}
      </div>
    </div>
  );
};
