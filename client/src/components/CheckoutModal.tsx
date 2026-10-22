import React, { useState } from 'react';
import { 
  X, 
  Banknote, 
  CreditCard, 
  Smartphone, 
  Check, 
  AlertCircle,
  Loader2
} from 'lucide-react';
import { PaymentMethod, ReceiptData } from '../types';
import { formatCurrency } from '../utils/formatters';
import { api } from '../services/api';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  grandTotal: number;
  subtotal: number;
  discount: number;
  discountType: 'fixed' | 'percent';
  discountValue: number;
  taxRate: number;
  taxAmount: number;
  orderType: 'dine_in' | 'takeaway';
  tableNumber: string | null;
  items: Array<{
    product_id?: string;
    product_name: string;
    unit_price: number;
    quantity: number;
    total_price: number;
    notes?: string;
  }>;
  orderId?: string | null;
  cashierName: string;
  onPaymentComplete: (receipt: ReceiptData) => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  grandTotal,
  subtotal,
  discount,
  discountType,
  discountValue,
  taxRate,
  taxAmount,
  orderType,
  tableNumber,
  items,
  orderId,
  cashierName,
  onPaymentComplete,
}) => {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [receivedInput, setReceivedInput] = useState<string>('');
  const [reference, setReference] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  if (!isOpen) return null;

  const totalAmount = Math.round(grandTotal);
  const receivedAmount = paymentMethod === 'cash' 
    ? (parseFloat(receivedInput) || 0) 
    : totalAmount;
  
  const changeGiven = Math.max(0, receivedAmount - totalAmount);
  const isCashShort = paymentMethod === 'cash' && receivedAmount < totalAmount;

  // Preset quick cash buttons
  const cashPresets = [
    { label: 'Exact', value: totalAmount },
    { label: 'Rs. 500', value: 500 },
    { label: 'Rs. 1,000', value: 1000 },
    { label: 'Rs. 2,000', value: 2000 },
    { label: 'Rs. 5,000', value: 5000 },
  ];

  const handleQuickCash = (value: number) => {
    setReceivedInput(String(value));
    setErrorMessage('');
  };

  const handleConfirmPayment = async () => {
    if (isSubmitting) return;

    if (paymentMethod === 'cash' && isCashShort) {
      setErrorMessage(`Received amount is less than total by ${formatCurrency(totalAmount - receivedAmount)}`);
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage('');

      // Generate a unique idempotency token for this payment submission
      const clientToken = `chk-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const payload = {
        order_id: orderId || null,
        order_type: orderType,
        table_number: tableNumber,
        items,
        subtotal,
        discount,
        discount_type: discountType,
        discount_value: discountValue,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        grand_total: totalAmount,
        cashier_name: cashierName,
        payment_method: paymentMethod,
        received_amount: receivedAmount,
        transaction_ref: reference.trim() || undefined,
        client_token: clientToken,
      };

      const result = await api.checkout(payload);
      onPaymentComplete(result.receipt);
    } catch (err: any) {
      console.error('Payment checkout failed:', err);
      setErrorMessage(err.message || 'Payment processing failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[1px]">
      <div 
        className="bg-white rounded-lg border border-[#E5E7EB] shadow-modal w-full max-w-md overflow-hidden animate-in fade-in duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E7EB]">
          <div>
            <h3 className="text-sm font-semibold text-[#171717]">
              Complete Payment
            </h3>
            <p className="text-xs text-[#737373]">
              {orderType === 'dine_in' ? `Dine In — Table ${tableNumber || 'Unassigned'}` : 'Takeaway Order'}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="text-[#737373] hover:text-[#171717] p-1 rounded hover:bg-[#F3F4F6] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Total Amount Banner */}
        <div className="bg-[#F8F9FA] px-5 py-4 border-b border-[#E5E7EB] text-center">
          <span className="text-xs text-[#737373] uppercase tracking-wider font-medium">
            Total Payable Amount
          </span>
          <div className="text-2xl font-bold text-[#171717] mt-0.5 tracking-tight">
            {formatCurrency(totalAmount)}
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Payment Method Selector */}
          <div>
            <label className="block text-xs font-medium text-[#737373] mb-2">
              Select Payment Method
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => { setPaymentMethod('cash'); setErrorMessage(''); }}
                className={`flex flex-col items-center justify-center py-2.5 px-3 rounded-lg border text-xs font-semibold transition-colors ${
                  paymentMethod === 'cash'
                    ? 'border-leaf-700 bg-leaf-50 text-leaf-900 ring-1 ring-leaf-700'
                    : 'border-[#E5E7EB] hover:bg-[#F8F9FA] text-[#171717]'
                }`}
              >
                <Banknote className="w-5 h-5 mb-1 text-inherit" />
                <span>Cash</span>
              </button>

              <button
                type="button"
                onClick={() => { setPaymentMethod('card'); setErrorMessage(''); }}
                className={`flex flex-col items-center justify-center py-2.5 px-3 rounded-lg border text-xs font-semibold transition-colors ${
                  paymentMethod === 'card'
                    ? 'border-leaf-700 bg-leaf-50 text-leaf-900 ring-1 ring-leaf-700'
                    : 'border-[#E5E7EB] hover:bg-[#F8F9FA] text-[#171717]'
                }`}
              >
                <CreditCard className="w-5 h-5 mb-1 text-inherit" />
                <span>Card Payment</span>
              </button>

              <button
                type="button"
                onClick={() => { setPaymentMethod('other'); setErrorMessage(''); }}
                className={`flex flex-col items-center justify-center py-2.5 px-3 rounded-lg border text-xs font-semibold transition-colors ${
                  paymentMethod === 'other'
                    ? 'border-leaf-700 bg-leaf-50 text-leaf-900 ring-1 ring-leaf-700'
                    : 'border-[#E5E7EB] hover:bg-[#F8F9FA] text-[#171717]'
                }`}
              >
                <Smartphone className="w-5 h-5 mb-1 text-inherit" />
                <span>Wallet / Other</span>
              </button>
            </div>
          </div>

          {/* Cash Details */}
          {paymentMethod === 'cash' && (
            <div className="space-y-3 pt-1">
              <div>
                <label className="block text-xs font-medium text-[#171717] mb-1">
                  Received Amount (PKR)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-[#737373] font-medium">
                    Rs.
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="10"
                    value={receivedInput}
                    onChange={(e) => {
                      setReceivedInput(e.target.value);
                      setErrorMessage('');
                    }}
                    placeholder={String(totalAmount)}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-[#E5E7EB] rounded font-medium focus:outline-none focus:border-leaf-600"
                    autoFocus
                  />
                </div>
              </div>

              {/* Quick Cash Presets */}
              <div className="flex flex-wrap gap-1.5">
                {cashPresets.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => handleQuickCash(preset.value)}
                    className="px-2.5 py-1 text-xs border border-[#E5E7EB] rounded bg-[#F8F9FA] hover:bg-leaf-50 hover:border-leaf-300 text-[#171717] font-medium transition-colors"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {/* Live Change Calculation Box */}
              <div className="bg-[#F8F9FA] p-3 rounded border border-[#E5E7EB] space-y-1.5 text-xs">
                <div className="flex justify-between text-[#737373]">
                  <span>Total Amount:</span>
                  <span className="font-medium text-[#171717]">{formatCurrency(totalAmount)}</span>
                </div>
                <div className="flex justify-between text-[#737373]">
                  <span>Received Amount:</span>
                  <span className="font-medium text-[#171717]">{formatCurrency(receivedAmount)}</span>
                </div>
                <div className="border-t border-[#E5E7EB] pt-1.5 flex justify-between font-semibold">
                  <span className={isCashShort ? 'text-[#DC2626]' : 'text-leaf-800'}>
                    {isCashShort ? 'Remaining Shortfall:' : 'Change to Return:'}
                  </span>
                  <span className={`text-sm ${isCashShort ? 'text-[#DC2626]' : 'text-leaf-800'}`}>
                    {isCashShort 
                      ? formatCurrency(totalAmount - receivedAmount) 
                      : formatCurrency(changeGiven)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Card / Other Details */}
          {(paymentMethod === 'card' || paymentMethod === 'other') && (
            <div className="space-y-2 pt-1">
              <label className="block text-xs font-medium text-[#171717]">
                {paymentMethod === 'card' ? 'Card Auth / Approval Code' : 'Transaction / Reference ID (Optional)'}
              </label>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder={paymentMethod === 'card' ? 'e.g. 849204' : 'e.g. JazzCash / EasyPaisa TID'}
                className="w-full px-3 py-2 text-xs border border-[#E5E7EB] rounded focus:outline-none focus:border-leaf-600"
              />
              <p className="text-[11px] text-[#737373]">
                {paymentMethod === 'card' ? 'Customer will tap/insert card on terminal.' : 'Verify transfer on merchant app.'}
              </p>
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="p-2.5 rounded bg-[#FEF2F2] border border-[#FCA5A5] flex items-center gap-2 text-xs text-[#DC2626]">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Modal Actions */}
        <div className="px-5 py-3.5 bg-[#F8F9FA] border-t border-[#E5E7EB] flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-3.5 py-2 text-xs font-medium text-[#737373] hover:text-[#171717] rounded border border-[#E5E7EB] bg-white hover:bg-[#F3F4F6] transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleConfirmPayment}
            disabled={isSubmitting || isCashShort}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-leaf-800 hover:bg-leaf-900 disabled:opacity-50 disabled:cursor-not-allowed rounded shadow-sm transition-colors"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Confirm & Print Receipt</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
