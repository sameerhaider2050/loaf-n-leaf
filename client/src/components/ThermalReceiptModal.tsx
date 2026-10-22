import React from 'react';
import { Printer, Check, X } from 'lucide-react';
import { ReceiptData } from '../types';
import { formatCurrency, formatDateTime } from '../utils/formatters';

interface ThermalReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  receipt: ReceiptData | null;
}

export const ThermalReceiptModal: React.FC<ThermalReceiptModalProps> = ({
  isOpen,
  onClose,
  receipt,
}) => {
  if (!isOpen || !receipt) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-[1px]">
      <div 
        className="bg-white rounded-lg border border-[#E5E7EB] shadow-modal w-full max-w-sm overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Bar (hidden when printing) */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#E5E7EB] bg-[#F8F9FA]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#16A34A]" />
            <span className="text-xs font-semibold text-[#171717]">Receipt Preview (80mm Thermal)</span>
          </div>
          <button
            onClick={onClose}
            className="text-[#737373] hover:text-[#171717] p-1 rounded hover:bg-[#E5E7EB]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 80mm Printable Receipt Content */}
        <div className="overflow-y-auto p-4 flex-1 bg-white">
          <div 
            id="thermal-receipt-print"
            className="w-full text-black font-mono text-[11px] leading-[1.35] tracking-tight bg-white p-3 border border-dashed border-[#E5E7EB] rounded"
          >
            {/* Header */}
            <div className="text-center space-y-0.5 mb-2">
              <div className="text-sm font-bold tracking-normal uppercase">
                {receipt.restaurant.name || 'LOAF N LEAF'}
              </div>
              <div className="text-[10px]">
                {receipt.restaurant.tagline || 'Artisan Cafe & Charcoal Grill'}
              </div>
              <div className="text-[10px] text-gray-700">
                {receipt.restaurant.address}
              </div>
              <div className="text-[10px]">
                Tel: {receipt.restaurant.phone} | NTN: {receipt.restaurant.ntn}
              </div>
              <div className="font-semibold mt-1 uppercase tracking-wide">
                *** TAX INVOICE ***
              </div>
            </div>

            <div className="border-t border-dashed border-gray-400 my-1.5" />

            {/* Metadata */}
            <div className="space-y-0.5 text-[10px]">
              <div className="flex justify-between">
                <span>ORDER: #{receipt.order.order_number}</span>
                <span>{receipt.order.order_type}</span>
              </div>
              <div className="flex justify-between">
                <span>TABLE: {receipt.order.table_number}</span>
                <span>CASHIER: {receipt.order.cashier}</span>
              </div>
              <div className="flex justify-between">
                <span>DATE: {formatDateTime(receipt.order.created_at)}</span>
              </div>
            </div>

            <div className="border-t border-dashed border-gray-400 my-1.5" />

            {/* Items Table */}
            <div className="text-[10px]">
              <div className="flex justify-between font-bold mb-1 border-b border-gray-300 pb-0.5">
                <span className="w-1/2">ITEM</span>
                <span className="w-12 text-center">QTY</span>
                <span className="w-16 text-right">TOTAL</span>
              </div>
              <div className="space-y-1">
                {receipt.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between">
                    <div className="w-1/2 pr-1">
                      <div className="truncate font-medium">{item.name}</div>
                      <div className="text-[9px] text-gray-500">@{formatCurrency(item.unit_price)}</div>
                    </div>
                    <span className="w-12 text-center self-start">{item.qty}</span>
                    <span className="w-16 text-right font-medium self-start">{formatCurrency(item.total)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-dashed border-gray-400 my-2" />

            {/* Summary */}
            <div className="space-y-1 text-[10px]">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>{formatCurrency(receipt.summary.subtotal)}</span>
              </div>
              {receipt.summary.discount > 0 && (
                <div className="flex justify-between text-gray-700">
                  <span>Discount:</span>
                  <span>-{formatCurrency(receipt.summary.discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-gray-700">
                <span>Sales Tax ({receipt.summary.tax_rate}%):</span>
                <span>{formatCurrency(receipt.summary.tax_amount)}</span>
              </div>
              <div className="flex justify-between font-bold text-xs border-t border-black pt-1 mt-1">
                <span>GRAND TOTAL:</span>
                <span>{formatCurrency(receipt.summary.grand_total)}</span>
              </div>
            </div>

            <div className="border-t border-dashed border-gray-400 my-2" />

            {/* Payment Details */}
            <div className="space-y-0.5 text-[10px]">
              <div className="flex justify-between">
                <span>PAYMENT METHOD:</span>
                <span className="font-semibold">{receipt.summary.payment_method}</span>
              </div>
              {receipt.summary.payment_method === 'CASH' ? (
                <>
                  <div className="flex justify-between">
                    <span>Tendered / Received:</span>
                    <span>{formatCurrency(receipt.summary.received_amount)}</span>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span>Change Returned:</span>
                    <span>{formatCurrency(receipt.summary.change_given)}</span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between">
                  <span>Reference:</span>
                  <span>{receipt.summary.transaction_ref}</span>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-dashed border-gray-400 my-2" />
            <div className="text-center text-[9px] text-gray-600 space-y-0.5">
              <div>{receipt.restaurant.footer || 'Thank you for your visit!'}</div>
              <div>Loaf n Leaf Restaurant Management</div>
            </div>
          </div>
        </div>

        {/* Modal Action Buttons (hidden when printing) */}
        <div className="px-4 py-3 bg-[#F8F9FA] border-t border-[#E5E7EB] flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#171717] rounded border border-[#E5E7EB] bg-white hover:bg-[#F3F4F6] transition-colors"
          >
            <Check className="w-3.5 h-3.5 text-[#16A34A]" />
            <span>Next Order</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded shadow-sm transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Receipt</span>
          </button>
        </div>
      </div>
    </div>
  );
};
