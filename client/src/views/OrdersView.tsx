import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  Eye, 
  Printer, 
  RefreshCw, 
  ChevronRight,
  Clock,
  ArrowUpDown
} from 'lucide-react';
import { Order, OrderStatus, ReceiptData, Settings } from '../types';
import { api } from '../services/api';
import { formatCurrency, formatDateTime, formatTime, getStatusBadgeClass } from '../utils/formatters';
import { OrderDetailsModal } from '../components/OrderDetailsModal';
import { ThermalReceiptModal } from '../components/ThermalReceiptModal';

interface OrdersViewProps {
  settings: Settings;
  onRefreshTrigger?: () => void;
}

export const OrdersView: React.FC<OrdersViewProps> = ({ settings }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState<boolean>(false);
  const [receiptToPrint, setReceiptToPrint] = useState<ReceiptData | null>(null);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const data = await api.getOrders({
        status: statusFilter !== 'all' ? statusFilter : undefined,
        search: searchQuery.trim() || undefined,
      });
      setOrders(data);
    } catch (err) {
      console.error('Failed to fetch orders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchOrders();
  };

  const handleViewOrder = async (orderId: string) => {
    try {
      const fullOrder = await api.getOrder(orderId);
      setSelectedOrder(fullOrder);
      setIsDetailsOpen(true);
    } catch (err) {
      alert('Failed to load order details');
    }
  };

  const handleUpdateStatus = async (orderId: string, newStatus: OrderStatus) => {
    try {
      await api.updateOrderStatus(orderId, newStatus);
      fetchOrders();
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder({ ...selectedOrder, status: newStatus });
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update order status');
    }
  };

  const handleReprint = async (order: Order) => {
    try {
      const full = await api.getOrder(order.id);
      const receiptData: ReceiptData = {
        restaurant: {
          name: settings.restaurant_name || 'Loaf n Leaf',
          tagline: settings.restaurant_tagline || 'Artisan Cafe & Charcoal Grill',
          address: settings.address || 'Zamzama Commercial, Clifton, Karachi',
          phone: settings.phone || '+92 21 3583 8920',
          ntn: settings.ntn_number || '7829104-5',
          header: settings.receipt_header || 'Tax Invoice',
          footer: settings.receipt_footer || 'Thank you for your visit!',
        },
        order: {
          id: full.id,
          order_number: full.order_number,
          order_type: full.order_type === 'dine_in' ? 'DINE IN' : 'TAKEAWAY',
          table_number: full.table_number || 'N/A',
          created_at: full.created_at,
          cashier: full.cashier_name,
        },
        items: (full.items || []).map(it => ({
          name: it.product_name,
          qty: it.quantity,
          unit_price: it.unit_price,
          total: it.total_price,
        })),
        summary: {
          subtotal: full.subtotal,
          discount: full.discount,
          tax_rate: full.tax_rate,
          tax_amount: full.tax_amount,
          grand_total: full.grand_total,
          payment_method: full.payments && full.payments.length > 0 ? full.payments[0].payment_method.toUpperCase() : 'PENDING',
          received_amount: full.payments && full.payments.length > 0 ? full.payments[0].received_amount : full.grand_total,
          change_given: full.payments && full.payments.length > 0 ? full.payments[0].change_given : 0,
          transaction_ref: full.payments && full.payments.length > 0 ? (full.payments[0].transaction_ref || '') : '',
        },
      };
      setReceiptToPrint(receiptData);
    } catch (err) {
      alert('Failed to generate receipt');
    }
  };

  const statusTabs: Array<{ id: string; label: string }> = [
    { id: 'all', label: 'All Orders' },
    { id: 'pending', label: 'Pending' },
    { id: 'preparing', label: 'Preparing' },
    { id: 'ready', label: 'Ready' },
    { id: 'completed', label: 'Completed' },
    { id: 'cancelled', label: 'Cancelled' },
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F8F9FA] overflow-hidden">
      {/* Top Bar with Filter & Search */}
      <div className="bg-white border-b border-[#E5E7EB] p-4 space-y-3 shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-[#171717] tracking-tight">
              Orders Management
            </h2>
            <p className="text-xs text-[#737373]">
              View, track, and manage all dining and takeaway orders
            </p>
          </div>

          {/* Search Form */}
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#737373]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Order # or Table..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-[#F8F9FA] border border-[#E5E7EB] rounded focus:bg-white focus:outline-none focus:border-leaf-600"
              />
            </div>
            <button
              type="submit"
              className="px-3 py-1.5 text-xs font-semibold text-white bg-leaf-800 hover:bg-leaf-900 rounded transition-colors shrink-0"
            >
              Search
            </button>
            <button
              type="button"
              onClick={fetchOrders}
              className="p-1.5 rounded border border-[#E5E7EB] hover:bg-leaf-50 text-[#737373] hover:text-leaf-800"
              title="Refresh Orders"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </form>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
          {statusTabs.map((tab) => {
            const isSelected = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded text-xs font-medium whitespace-nowrap transition-colors ${
                  isSelected
                    ? 'bg-leaf-800 text-white shadow-sm'
                    : 'bg-[#F3F4F6] text-[#737373] hover:text-[#171717] hover:bg-[#E5E7EB]'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Orders Table */}
      <div className="flex-1 overflow-auto p-4">
        <div className="bg-white rounded border border-[#E5E7EB] overflow-hidden shadow-subtle">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F8F9FA] border-b border-[#E5E7EB] text-[#737373] font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-2.5 px-4">Order ID</th>
                <th className="py-2.5 px-4">Time</th>
                <th className="py-2.5 px-4">Order Type</th>
                <th className="py-2.5 px-4">Table</th>
                <th className="py-2.5 px-4">Amount</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E7EB]">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[#737373]">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-leaf-700" />
                      <span>Loading orders...</span>
                    </div>
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[#737373]">
                    No orders found matching the filter criteria.
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id} className="hover:bg-[#F8F9FA] transition-colors">
                    {/* Order ID */}
                    <td className="py-3 px-4 font-bold text-[#171717]">
                      #{order.order_number}
                    </td>

                    {/* Time */}
                    <td className="py-3 px-4 text-[#737373]">
                      <div className="font-medium text-[#171717]">{formatTime(order.created_at)}</div>
                      <div className="text-[10px]">{order.created_at.slice(0, 10)}</div>
                    </td>

                    {/* Order Type */}
                    <td className="py-3 px-4">
                      <span className="font-medium text-[#171717]">
                        {order.order_type === 'dine_in' ? 'Dine In' : 'Takeaway'}
                      </span>
                    </td>

                    {/* Table */}
                    <td className="py-3 px-4 text-[#737373]">
                      {order.table_number ? (
                        <span className="font-semibold text-[#171717] bg-[#F3F4F6] px-2 py-0.5 rounded border border-[#E5E7EB]">
                          {order.table_number}
                        </span>
                      ) : (
                        <span>—</span>
                      )}
                    </td>

                    {/* Amount */}
                    <td className="py-3 px-4 font-bold text-[#171717]">
                      {formatCurrency(order.grand_total)}
                    </td>

                    {/* Status Badge */}
                    <td className="py-3 px-4">
                      <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold border uppercase tracking-wider ${getStatusBadgeClass(order.status)}`}>
                        {order.status}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleViewOrder(order.id)}
                          className="px-2.5 py-1 text-[11px] font-medium text-[#171717] bg-white hover:bg-[#F3F4F6] border border-[#E5E7EB] rounded transition-colors flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5 text-[#737373]" />
                          <span>View</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleReprint(order)}
                          className="p-1 text-[#737373] hover:text-[#171717] hover:bg-[#F3F4F6] rounded border border-[#E5E7EB] transition-colors"
                          title="Reprint Receipt"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      <OrderDetailsModal
        isOpen={isDetailsOpen}
        onClose={() => setIsDetailsOpen(false)}
        order={selectedOrder}
        onUpdateStatus={handleUpdateStatus}
        onReprintReceipt={handleReprint}
      />

      <ThermalReceiptModal
        isOpen={!!receiptToPrint}
        onClose={() => setReceiptToPrint(null)}
        receipt={receiptToPrint}
      />
    </div>
  );
};
