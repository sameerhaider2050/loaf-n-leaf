import React from 'react';
import { X, Printer, Clock, User, CheckCircle2, AlertCircle } from 'lucide-react';
import { Order, OrderStatus } from '../types';
import { formatCurrency, formatDateTime, getStatusBadgeClass } from '../utils/formatters';

interface OrderDetailsModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateStatus: (orderId: string, status: OrderStatus) => void;
  onReprintReceipt: (order: Order) => void;
}

export const OrderDetailsModal: React.FC<OrderDetailsModalProps> = ({
  order,
  isOpen,
  onClose,
  onUpdateStatus,
  onReprintReceipt,
}) => {
  if (!isOpen || !order) return null;

  const validStatuses: OrderStatus[] = ['pending', 'preparing', 'ready', 'completed', 'cancelled'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[1px]">
      <div 
        className="bg-white rounded-lg border border-[#E5E7EB] shadow-modal w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E7EB] bg-[#F8F9FA]">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-[#171717]">
                Order #{order.order_number}
              </span>
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded border uppercase ${getStatusBadgeClass(order.status)}`}>
                {order.status}
              </span>
            </div>
            <div className="text-xs text-[#737373] mt-0.5 flex items-center gap-3">
              <span>{order.order_type === 'dine_in' ? `Dine In — Table ${order.table_number || 'Unassigned'}` : 'Takeaway'}</span>
              <span>•</span>
              <span>{formatDateTime(order.created_at)}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#737373] hover:text-[#171717] p-1 rounded hover:bg-[#E5E7EB]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Cashier & Info */}
          <div className="grid grid-cols-2 gap-3 bg-[#F8F9FA] p-3 rounded border border-[#E5E7EB] text-xs">
            <div>
              <span className="text-[#737373] block text-[11px]">Server / Cashier:</span>
              <span className="font-semibold text-[#171717]">{order.cashier_name || 'Ahmed Khan'}</span>
            </div>
            <div>
              <span className="text-[#737373] block text-[11px]">Payment Method:</span>
              <span className="font-semibold text-[#171717] uppercase">{order.payment_method || 'Pending / Unpaid'}</span>
            </div>
          </div>

          {/* Items Table */}
          <div>
            <div className="text-xs font-semibold text-[#171717] mb-2">Order Items</div>
            <div className="border border-[#E5E7EB] rounded overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8F9FA] border-b border-[#E5E7EB] text-[#737373] font-medium">
                  <tr>
                    <th className="py-2 px-3">Item</th>
                    <th className="py-2 px-3 text-center">Qty</th>
                    <th className="py-2 px-3 text-right">Unit Price</th>
                    <th className="py-2 px-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3F4F6]">
                  {order.items && order.items.length > 0 ? (
                    order.items.map((item, idx) => (
                      <tr key={idx}>
                        <td className="py-2 px-3 font-medium text-[#171717]">{item.product_name}</td>
                        <td className="py-2 px-3 text-center text-[#737373]">{item.quantity}</td>
                        <td className="py-2 px-3 text-right text-[#737373]">{formatCurrency(item.unit_price)}</td>
                        <td className="py-2 px-3 text-right font-medium text-[#171717]">{formatCurrency(item.total_price)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-3 px-3 text-center text-[#737373]">No items recorded</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Financial Breakdown */}
          <div className="border border-[#E5E7EB] rounded p-3 bg-[#F8F9FA] space-y-1.5 text-xs">
            <div className="flex justify-between text-[#737373]">
              <span>Subtotal:</span>
              <span className="font-medium text-[#171717]">{formatCurrency(order.subtotal)}</span>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between text-[#737373]">
                <span>Discount:</span>
                <span className="font-medium text-[#16A34A]">-{formatCurrency(order.discount)}</span>
              </div>
            )}
            <div className="flex justify-between text-[#737373]">
              <span>Sales Tax ({order.tax_rate}%):</span>
              <span className="font-medium text-[#171717]">{formatCurrency(order.tax_amount)}</span>
            </div>
            <div className="border-t border-[#E5E7EB] pt-1.5 flex justify-between font-bold text-sm text-[#171717]">
              <span>Grand Total:</span>
              <span>{formatCurrency(order.grand_total)}</span>
            </div>
          </div>

          {/* Quick Status Workflow Changer */}
          <div>
            <label className="block text-xs font-semibold text-[#171717] mb-1.5">
              Update Order Status:
            </label>
            <div className="flex flex-wrap gap-1.5">
              {validStatuses.map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => onUpdateStatus(order.id, st)}
                  className={`px-3 py-1.5 rounded text-xs font-semibold border transition-colors capitalize ${
                    order.status === st
                      ? 'bg-leaf-800 text-white border-leaf-800 shadow-sm'
                      : 'bg-white hover:bg-leaf-50 text-[#737373] border-[#E5E7EB]'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3 bg-[#F8F9FA] border-t border-[#E5E7EB] flex items-center justify-between">
          <button
            type="button"
            onClick={() => onReprintReceipt(order)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#171717] rounded border border-[#E5E7EB] bg-white hover:bg-leaf-50 transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Reprint Receipt</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-white bg-leaf-800 hover:bg-leaf-900 rounded transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
