import React, { useState } from 'react';
import { 
  Users, 
  Plus, 
  ExternalLink, 
  Clock, 
  Utensils, 
  CheckCircle,
  AlertCircle,
  Trash2,
  X
} from 'lucide-react';
import { RestaurantTable, TableStatus, Order } from '../types';
import { api } from '../services/api';
import { formatCurrency, formatTime, getStatusBadgeClass } from '../utils/formatters';

interface TablesViewProps {
  tables: RestaurantTable[];
  onRefreshData: () => void;
  onOpenTableOrderInPos: (table: RestaurantTable) => void;
}

export const TablesView: React.FC<TablesViewProps> = ({
  tables,
  onRefreshData,
  onOpenTableOrderInPos,
}) => {
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [isAddTableOpen, setIsAddTableOpen] = useState<boolean>(false);
  const [tableNumberInput, setTableNumberInput] = useState<string>('');
  const [tableNameInput, setTableNameInput] = useState<string>('');
  const [capacityInput, setCapacityInput] = useState<number>(4);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const filteredTables = tables.filter((t) => {
    if (filterStatus === 'all') return true;
    return t.status === filterStatus;
  });

  const availableCount = tables.filter(t => t.status === 'available').length;
  const occupiedCount = tables.filter(t => t.status === 'occupied').length;
  const reservedCount = tables.filter(t => t.status === 'reserved').length;

  const handleUpdateStatus = async (tableId: string, newStatus: TableStatus) => {
    try {
      await api.updateTableStatus(tableId, newStatus);
      onRefreshData();
    } catch (err: any) {
      alert(err.message || 'Failed to update table status');
    }
  };

  const handleAddTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tableNumberInput.trim()) {
      setError('Table number is required (e.g. T-13)');
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');
      await api.createTable({
        table_number: tableNumberInput.trim(),
        name: tableNameInput.trim() || `Table ${tableNumberInput.trim()}`,
        capacity: Number(capacityInput) || 4,
      });
      setIsAddTableOpen(false);
      setTableNumberInput('');
      setTableNameInput('');
      onRefreshData();
    } catch (err: any) {
      setError(err.message || 'Failed to create table');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTable = async (table: RestaurantTable) => {
    if (table.status === 'occupied') {
      alert('Cannot delete an occupied table. Complete or cancel order first.');
      return;
    }
    if (window.confirm(`Delete table ${table.table_number}?`)) {
      try {
        await api.deleteTable(table.id);
        onRefreshData();
      } catch (err: any) {
        alert(err.message || 'Failed to delete table');
      }
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F8F9FA] overflow-hidden">
      {/* Top Header & Status Overview */}
      <div className="bg-white border-b border-[#E5E7EB] p-4 space-y-3 shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-[#171717] tracking-tight">
              Table Management
            </h2>
            <p className="text-xs text-[#737373]">
              Monitor seating capacity, occupied dining tables, and active bills
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setError('');
              setIsAddTableOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-leaf-800 hover:bg-leaf-900 rounded shadow-sm transition-colors self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Add Table</span>
          </button>
        </div>

        {/* Status Counts & Filter Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-0.5 no-scrollbar text-xs">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-3 py-1.5 rounded font-medium transition-colors ${
              filterStatus === 'all'
                ? 'bg-[#171717] text-white'
                : 'bg-[#F3F4F6] text-[#737373] hover:text-[#171717]'
            }`}
          >
            All Tables ({tables.length})
          </button>
          <button
            onClick={() => setFilterStatus('available')}
            className={`px-3 py-1.5 rounded font-medium transition-colors flex items-center gap-1.5 ${
              filterStatus === 'available'
                ? 'bg-emerald-600 text-white'
                : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>Available ({availableCount})</span>
          </button>
          <button
            onClick={() => setFilterStatus('occupied')}
            className={`px-3 py-1.5 rounded font-medium transition-colors flex items-center gap-1.5 ${
              filterStatus === 'occupied'
                ? 'bg-amber-600 text-white'
                : 'bg-amber-50 text-amber-800 border border-amber-200'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            <span>Occupied ({occupiedCount})</span>
          </button>
          <button
            onClick={() => setFilterStatus('reserved')}
            className={`px-3 py-1.5 rounded font-medium transition-colors flex items-center gap-1.5 ${
              filterStatus === 'reserved'
                ? 'bg-purple-600 text-white'
                : 'bg-purple-50 text-purple-800 border border-purple-200'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
            <span>Reserved ({reservedCount})</span>
          </button>
        </div>
      </div>

      {/* Tables Grid */}
      <div className="flex-1 overflow-auto p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-6 gap-3">
          {filteredTables.map((table) => {
            const isOccupied = table.status === 'occupied';
            const isAvailable = table.status === 'available';
            const isReserved = table.status === 'reserved';

            return (
              <div
                key={table.id}
                className={`bg-white rounded border p-3 flex flex-col justify-between transition-shadow duration-100 ${
                  isOccupied
                    ? 'border-amber-300 bg-amber-50/20 shadow-subtle'
                    : isAvailable
                    ? 'border-[#E5E7EB] hover:border-leaf-600 shadow-subtle'
                    : 'border-purple-200 bg-purple-50/20'
                }`}
              >
                <div>
                  {/* Card Header: Table Number & Capacity */}
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-bold text-[#171717] tracking-tight">
                      {table.table_number}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] text-[#737373]">
                      <Users className="w-3 h-3" />
                      <span>{table.capacity}</span>
                    </span>
                  </div>

                  <div className="text-[11px] text-[#737373] truncate font-medium">
                    {table.name}
                  </div>

                  {/* Status Badge */}
                  <div className="mt-2">
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold border uppercase tracking-wider ${getStatusBadgeClass(table.status)}`}>
                      {table.status}
                    </span>
                  </div>

                  {/* Active Order Details if Occupied */}
                  {isOccupied && (
                    <div className="mt-2.5 pt-2 border-t border-amber-200/60 text-xs space-y-1">
                      <div className="flex justify-between text-[#737373] text-[11px]">
                        <span>Active Order:</span>
                        <span className="font-bold text-[#171717]">
                          #{table.active_order_number || 'Live'}
                        </span>
                      </div>
                      <div className="flex justify-between text-[#737373] text-[11px]">
                        <span>Current Total:</span>
                        <span className="font-bold text-[#171717]">
                          {formatCurrency(table.active_order_total || 0)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Table Actions */}
                <div className="mt-3 pt-2 border-t border-[#F3F4F6] flex items-center justify-between gap-1">
                  {/* Open Order Button */}
                  <button
                    type="button"
                    onClick={() => onOpenTableOrderInPos(table)}
                    className="flex-1 py-1 px-2 text-[11px] font-semibold text-white bg-leaf-800 hover:bg-leaf-900 rounded flex items-center justify-center gap-1 transition-colors"
                  >
                    <span>{isOccupied ? 'Open Order' : 'New Order'}</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>

                  {/* Quick Status Dropdown */}
                  <select
                    value={table.status}
                    onChange={(e) => handleUpdateStatus(table.id, e.target.value as TableStatus)}
                    className="text-[10px] bg-white border border-[#E5E7EB] rounded px-1.5 py-1 text-[#737373] font-medium focus:outline-none focus:border-leaf-600"
                  >
                    <option value="available">Available</option>
                    <option value="occupied">Occupied</option>
                    <option value="reserved">Reserved</option>
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add Table Modal */}
      {isAddTableOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[1px]">
          <div 
            className="bg-white rounded-lg border border-[#E5E7EB] shadow-modal w-full max-w-sm overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#E5E7EB] bg-[#F8F9FA]">
              <h3 className="text-xs font-semibold text-[#171717]">Add Restaurant Table</h3>
              <button
                onClick={() => setIsAddTableOpen(false)}
                className="text-[#737373] hover:text-[#171717] p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddTable} className="p-4 space-y-3 text-xs">
              {error && (
                <div className="p-2 rounded bg-[#FEF2F2] border border-[#FCA5A5] text-[#DC2626]">
                  {error}
                </div>
              )}

              <div>
                <label className="block font-medium text-[#171717] mb-1">
                  Table Number (e.g. T-13) *
                </label>
                <input
                  type="text"
                  required
                  value={tableNumberInput}
                  onChange={(e) => setTableNumberInput(e.target.value)}
                  placeholder="T-13"
                  className="w-full px-3 py-1.5 border border-[#E5E7EB] rounded uppercase focus:outline-none focus:border-leaf-600"
                  autoFocus
                />
              </div>

              <div>
                <label className="block font-medium text-[#171717] mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  value={tableNameInput}
                  onChange={(e) => setTableNameInput(e.target.value)}
                  placeholder="e.g. Window Booth"
                  className="w-full px-3 py-1.5 border border-[#E5E7EB] rounded focus:outline-none focus:border-leaf-600"
                />
              </div>

              <div>
                <label className="block font-medium text-[#171717] mb-1">
                  Seating Capacity (Guests)
                </label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={capacityInput}
                  onChange={(e) => setCapacityInput(parseInt(e.target.value) || 4)}
                  className="w-full px-3 py-1.5 border border-[#E5E7EB] rounded focus:outline-none focus:border-leaf-600"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-[#E5E7EB]">
                <button
                  type="button"
                  onClick={() => setIsAddTableOpen(false)}
                  className="px-3 py-1.5 text-xs text-[#737373] border border-[#E5E7EB] rounded hover:bg-[#F3F4F6]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-3.5 py-1.5 text-xs font-semibold text-white bg-leaf-800 hover:bg-leaf-900 rounded shadow-sm transition-colors"
                >
                  {isSubmitting ? 'Adding...' : 'Add Table'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
