import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  Download, 
  TrendingUp, 
  CreditCard, 
  Banknote, 
  ShoppingBag, 
  Receipt,
  RefreshCw
} from 'lucide-react';
import { SalesReportSummary } from '../types';
import { api } from '../services/api';
import { formatCurrency, formatDateTime, formatTime } from '../utils/formatters';

export const ReportsView: React.FC = () => {
  const [period, setPeriod] = useState<string>('today');
  const [report, setReport] = useState<SalesReportSummary | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const [summaryData, historyData] = await Promise.all([
        api.getReportsSummary({ period }),
        api.getReportsHistory({ period }),
      ]);
      setReport(summaryData);
      setHistory(historyData);
    } catch (err) {
      console.error('Failed to load sales report:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [period]);

  const handleExportCSV = () => {
    if (history.length === 0) {
      alert('No sales records to export');
      return;
    }

    const headers = ['Order Number', 'Date & Time', 'Order Type', 'Table', 'Subtotal', 'Discount', 'Tax', 'Grand Total', 'Payment Method', 'Cashier', 'Reference'];
    const rows = history.map(h => [
      h.order_number,
      `"${formatDateTime(h.created_at)}"`,
      h.order_type,
      h.table_number || 'Takeaway',
      h.subtotal,
      h.discount,
      h.tax_amount,
      h.grand_total,
      h.payment_method,
      `"${h.cashier_name}"`,
      h.transaction_ref || ''
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `loaf_and_leaf_sales_${period}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const metrics = report?.metrics || {
    totalSales: 0,
    totalOrders: 0,
    averageOrderValue: 0,
    cashSales: 0,
    cardSales: 0,
    otherSales: 0,
  };

  const trendData = report?.trend || [];
  const maxTrendSale = Math.max(...trendData.map(t => t.sales), 1000);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F8F9FA] overflow-y-auto">
      {/* Top Controls */}
      <div className="bg-white border-b border-[#E5E7EB] p-4 space-y-3 shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-[#171717] tracking-tight">
              Sales & Financial Reports
            </h2>
            <p className="text-xs text-[#737373]">
              Daily revenue, payment channels, order volumes, and sales history
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#171717] bg-white border border-[#E5E7EB] hover:bg-[#F3F4F6] rounded transition-colors shadow-subtle"
            >
              <Download className="w-3.5 h-3.5 text-[#737373]" />
              <span>Export CSV</span>
            </button>
            <button
              type="button"
              onClick={fetchReports}
              className="p-1.5 rounded border border-[#E5E7EB] hover:bg-[#F3F4F6] text-[#737373]"
              title="Refresh"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Date Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
          {[
            { id: 'today', label: "Today's Sales" },
            { id: 'yesterday', label: 'Yesterday' },
            { id: '7days', label: 'Last 7 Days' },
            { id: '30days', label: 'This Month (30 Days)' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setPeriod(item.id)}
              className={`px-3 py-1.5 rounded text-xs font-medium whitespace-nowrap transition-colors ${
                period === item.id
                  ? 'bg-[#171717] text-white shadow-sm'
                  : 'bg-[#F3F4F6] text-[#737373] hover:text-[#171717] hover:bg-[#E5E7EB]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="p-4 space-y-4">
        {/* Key Metrics Row */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
          {/* Total Sales */}
          <div className="bg-white p-3.5 rounded border border-[#E5E7EB] shadow-subtle">
            <span className="text-[11px] font-medium text-[#737373] uppercase tracking-wide block">
              Gross Sales (PKR)
            </span>
            <div className="text-xl font-bold text-[#171717] mt-1 tracking-tight">
              {formatCurrency(metrics.totalSales)}
            </div>
            <span className="text-[10px] text-[#737373] mt-1 block">
              {period === 'today' ? "Today's total revenue" : 'Total period revenue'}
            </span>
          </div>

          {/* Total Orders */}
          <div className="bg-white p-3.5 rounded border border-[#E5E7EB] shadow-subtle">
            <span className="text-[11px] font-medium text-[#737373] uppercase tracking-wide block">
              Total Orders
            </span>
            <div className="text-xl font-bold text-[#171717] mt-1 tracking-tight">
              {metrics.totalOrders}
            </div>
            <span className="text-[10px] text-[#737373] mt-1 block">
              Completed transactions
            </span>
          </div>

          {/* Average Order Value */}
          <div className="bg-white p-3.5 rounded border border-[#E5E7EB] shadow-subtle">
            <span className="text-[11px] font-medium text-[#737373] uppercase tracking-wide block">
              Average Order Value
            </span>
            <div className="text-xl font-bold text-[#171717] mt-1 tracking-tight">
              {formatCurrency(metrics.averageOrderValue)}
            </div>
            <span className="text-[10px] text-[#737373] mt-1 block">
              Revenue per ticket
            </span>
          </div>

          {/* Cash Sales */}
          <div className="bg-white p-3.5 rounded border border-[#E5E7EB] shadow-subtle">
            <span className="text-[11px] font-medium text-[#737373] uppercase tracking-wide block">
              Cash Sales
            </span>
            <div className="text-xl font-bold text-[#16A34A] mt-1 tracking-tight">
              {formatCurrency(metrics.cashSales)}
            </div>
            <span className="text-[10px] text-[#737373] mt-1 block">
              Physical cash tendered
            </span>
          </div>

          {/* Card & Digital Sales */}
          <div className="bg-white p-3.5 rounded border border-[#E5E7EB] shadow-subtle col-span-2 md:col-span-1">
            <span className="text-[11px] font-medium text-[#737373] uppercase tracking-wide block">
              Card & Digital Sales
            </span>
            <div className="text-xl font-bold text-[#2563EB] mt-1 tracking-tight">
              {formatCurrency(metrics.cardSales + metrics.otherSales)}
            </div>
            <span className="text-[10px] text-[#737373] mt-1 block">
              Card terminal & mobile wallets
            </span>
          </div>
        </div>

        {/* Sales Trend Chart & Top Items */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Sales Trend Chart (Clean SVG Bar/Column Chart) */}
          <div className="lg:col-span-2 bg-white p-4 rounded border border-[#E5E7EB] shadow-subtle">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xs font-bold text-[#171717]">
                  Sales Volume Trend
                </h3>
                <p className="text-[11px] text-[#737373]">
                  {period === 'today' || period === 'yesterday' ? 'Hourly revenue distribution' : 'Daily revenue distribution'}
                </p>
              </div>
            </div>

            {trendData.length === 0 ? (
              <div className="h-44 flex items-center justify-center text-xs text-[#737373]">
                No sales data available for this period.
              </div>
            ) : (
              <div className="h-48 flex items-end gap-1.5 pt-4 pb-2 px-2 overflow-x-auto">
                {trendData.map((point, index) => {
                  const heightPercent = maxTrendSale > 0 ? (point.sales / maxTrendSale) * 100 : 0;
                  return (
                    <div
                      key={index}
                      className="flex-1 flex flex-col items-center gap-1 group min-w-[20px]"
                      title={`${point.label}: ${formatCurrency(point.sales)}`}
                    >
                      <div className="text-[9px] font-bold text-[#737373] opacity-0 group-hover:opacity-100 transition-opacity">
                        {point.sales > 0 ? formatCurrency(point.sales) : ''}
                      </div>
                      <div className="w-full bg-[#E5E7EB] rounded-t flex items-end justify-center h-32 overflow-hidden">
                        <div
                          className="w-full bg-[#2563EB] hover:bg-[#1D4ED8] rounded-t transition-all duration-200"
                          style={{ height: `${Math.max(4, heightPercent)}%` }}
                        />
                      </div>
                      <span className="text-[9px] text-[#737373] truncate w-full text-center">
                        {point.label.slice(0, 5)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Top Selling Products */}
          <div className="bg-white p-4 rounded border border-[#E5E7EB] shadow-subtle flex flex-col justify-between">
            <div>
              <h3 className="text-xs font-bold text-[#171717]">
                Top Selling Items
              </h3>
              <p className="text-[11px] text-[#737373] mb-3">
                Most popular menu items by quantity
              </p>

              {(!report?.topItems || report.topItems.length === 0) ? (
                <div className="py-6 text-center text-xs text-[#737373]">
                  No sales recorded in this period.
                </div>
              ) : (
                <div className="space-y-2">
                  {report.topItems.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-[#F3F4F6] last:border-0">
                      <div className="overflow-hidden pr-2">
                        <span className="font-medium text-[#171717] block truncate">
                          {idx + 1}. {item.product_name}
                        </span>
                        <span className="text-[10px] text-[#737373]">
                          {item.total_qty} units sold
                        </span>
                      </div>
                      <span className="font-bold text-[#171717] shrink-0">
                        {formatCurrency(item.total_revenue)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-[#E5E7EB] text-[11px] text-[#737373]">
              Prices inclusive of SRB / Sales Tax.
            </div>
          </div>
        </div>

        {/* Sales History Table */}
        <div className="bg-white rounded border border-[#E5E7EB] shadow-subtle overflow-hidden">
          <div className="px-4 py-3 border-b border-[#E5E7EB] flex items-center justify-between">
            <h3 className="text-xs font-bold text-[#171717]">
              Transaction History
            </h3>
            <span className="text-[11px] text-[#737373]">
              {history.length} {history.length === 1 ? 'record' : 'records'}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8F9FA] border-b border-[#E5E7EB] text-[#737373] font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-2.5 px-4">Order #</th>
                  <th className="py-2.5 px-4">Date & Time</th>
                  <th className="py-2.5 px-4">Type</th>
                  <th className="py-2.5 px-4">Table</th>
                  <th className="py-2.5 px-4">Payment Method</th>
                  <th className="py-2.5 px-4">Cashier</th>
                  <th className="py-2.5 px-4 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB]">
                {history.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-[#737373]">
                      No completed transactions found for this period.
                    </td>
                  </tr>
                ) : (
                  history.map((record, index) => (
                    <tr key={index} className="hover:bg-[#F8F9FA] transition-colors">
                      <td className="py-3 px-4 font-bold text-[#171717]">
                        #{record.order_number}
                      </td>
                      <td className="py-3 px-4 text-[#737373]">
                        {formatDateTime(record.created_at)}
                      </td>
                      <td className="py-3 px-4 font-medium text-[#171717]">
                        {record.order_type === 'dine_in' ? 'Dine In' : 'Takeaway'}
                      </td>
                      <td className="py-3 px-4 text-[#737373]">
                        {record.table_number || '—'}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold uppercase text-[#171717]">
                          {record.payment_method}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-[#737373]">
                        {record.cashier_name}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-[#171717]">
                        {formatCurrency(record.grand_total)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
