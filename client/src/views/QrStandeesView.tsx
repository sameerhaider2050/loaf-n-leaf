import React, { useState, useEffect } from 'react';
import { 
  QrCode, 
  Printer, 
  ExternalLink, 
  Scan, 
  Sparkles, 
  Wifi, 
  Utensils, 
  Smartphone,
  Eye,
  Check,
  Copy
} from 'lucide-react';
import QRCode from 'qrcode';
import { RestaurantTable } from '../types';

interface QrStandeesViewProps {
  tables: RestaurantTable[];
  onOpenCustomerMenu: (tableNumber: string) => void;
}

export const QrStandeesView: React.FC<QrStandeesViewProps> = ({
  tables,
  onOpenCustomerMenu,
}) => {
  const [qrCodeUrls, setQrCodeUrls] = useState<Record<string, string>>({});
  const [selectedTableForPrint, setSelectedTableForPrint] = useState<RestaurantTable | null>(null);
  const [copiedTable, setCopiedTable] = useState<string | null>(null);
  const [scannerSimulationInput, setScannerSimulationInput] = useState<string>('T-03');

  // Generate QR codes for all tables
  useEffect(() => {
    const generateAllQrs = async () => {
      const urls: Record<string, string> = {};
      const baseUrl = window.location.origin;

      for (const table of tables) {
        try {
          const menuUrl = `${baseUrl}/#menu?table=${table.table_number}`;
          const dataUrl = await QRCode.toDataURL(menuUrl, {
            width: 260,
            margin: 1.5,
            color: {
              dark: '#14532D', // Deep botanical forest leaf green
              light: '#FFFFFF',
            },
          });
          urls[table.table_number] = dataUrl;
        } catch (err) {
          console.error('Error generating QR code for', table.table_number, err);
        }
      }
      setQrCodeUrls(urls);
    };

    if (tables.length > 0) {
      generateAllQrs();
    }
  }, [tables]);

  const handlePrintSingle = (table: RestaurantTable) => {
    setSelectedTableForPrint(table);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const handlePrintAll = () => {
    setSelectedTableForPrint(null); // Print all
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const handleCopyLink = (tableNumber: string) => {
    const url = `${window.location.origin}/#menu?table=${tableNumber}`;
    navigator.clipboard.writeText(url);
    setCopiedTable(tableNumber);
    setTimeout(() => setCopiedTable(null), 2000);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F8FAF8] overflow-y-auto">
      {/* Top Header */}
      <div className="bg-white border-b border-border-color p-4 shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-primary-text tracking-tight">
              Table Barcodes & QR Standees
            </h2>
            <span className="text-[10px] font-semibold text-leaf-800 bg-leaf-100 px-2 py-0.5 rounded-full border border-leaf-300">
              Self-Ordering
            </span>
          </div>
          <p className="text-xs text-secondary-text mt-0.5">
            Place scannable QR cards on every dining table. Guests scan with their phone camera to open the menu & order automatically!
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrintAll}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-leaf-700 hover:bg-leaf-800 rounded-lg shadow-sm transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print All Standees</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-4 space-y-4">
        {/* Banner Explaining Feature */}
        <div className="bg-gradient-to-r from-leaf-900 via-leaf-800 to-leaf-900 rounded-xl p-4 text-white shadow-subtle flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-leaf-700/80 border border-leaf-500/40 flex items-center justify-center shrink-0">
              <QrCode className="w-5 h-5 text-leaf-200" />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-tight">Automated Table Menu & Direct Kitchen Ordering</h3>
              <p className="text-xs text-leaf-200 mt-0.5 max-w-xl leading-relaxed">
                When a customer scans any table card below with their smartphone camera, the Loaf n Leaf digital menu opens automatically for that exact table. Orders placed go straight to the kitchen order queue!
              </p>
            </div>
          </div>

          {/* Quick Scanner Simulator */}
          <div className="bg-leaf-950/60 p-2.5 rounded-lg border border-leaf-700/50 flex items-center gap-2 shrink-0">
            <span className="text-xs text-leaf-200 font-medium">Scan Test:</span>
            <select
              value={scannerSimulationInput}
              onChange={(e) => setScannerSimulationInput(e.target.value)}
              className="bg-leaf-900 text-white border border-leaf-600 rounded px-2 py-1 text-xs focus:outline-none"
            >
              {tables.map(t => (
                <option key={t.id} value={t.table_number}>{t.table_number} ({t.name})</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => onOpenCustomerMenu(scannerSimulationInput)}
              className="px-2.5 py-1 bg-loaf-600 hover:bg-loaf-500 text-white rounded text-xs font-semibold transition-colors flex items-center gap-1 shadow-sm"
            >
              <Smartphone className="w-3 h-3" />
              <span>Simulate Scan</span>
            </button>
          </div>
        </div>

        {/* Table Standees Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {tables.map((table) => {
            const qrSrc = qrCodeUrls[table.table_number];
            const isCopied = copiedTable === table.table_number;

            return (
              <div
                key={table.id}
                className="bg-white rounded-xl border border-leaf-200 shadow-subtle overflow-hidden flex flex-col justify-between hover:border-leaf-500 transition-all group"
              >
                {/* Standee Visual Card */}
                <div className="p-4 text-center bg-gradient-to-b from-leaf-50/60 via-white to-white border-b border-border-color">
                  {/* Brand Header on Card */}
                  <div className="flex items-center justify-center gap-1.5 text-leaf-800 font-bold text-xs uppercase tracking-wider">
                    <span>🌿</span>
                    <span>Loaf n Leaf</span>
                  </div>
                  <div className="text-[10px] text-secondary-text tracking-tight">Artisan Bakery & Charcoal Grill</div>

                  {/* Table Badge */}
                  <div className="my-2.5 inline-block bg-leaf-700 text-white font-extrabold text-sm px-3.5 py-1 rounded-full shadow-sm">
                    {table.table_number}
                  </div>
                  <div className="text-xs font-semibold text-primary-text">{table.name}</div>

                  {/* QR Code Container */}
                  <div className="my-3 flex justify-center">
                    <div className="p-2 bg-white rounded-xl border-2 border-dashed border-leaf-300 shadow-sm inline-block group-hover:border-leaf-600 transition-colors">
                      {qrSrc ? (
                        <img 
                          src={qrSrc} 
                          alt={`QR for ${table.table_number}`} 
                          className="w-36 h-36 object-contain"
                        />
                      ) : (
                        <div className="w-36 h-36 flex items-center justify-center text-xs text-secondary-text">
                          Generating QR...
                        </div>
                      )}
                    </div>
                  </div>

                  <p className="text-xs font-bold text-leaf-900 leading-tight">
                    Scan to View Menu & Order
                  </p>
                  <p className="text-[10px] text-secondary-text mt-0.5">
                    Order directly to this table from your phone
                  </p>

                  {/* Wi-Fi Details on Standee */}
                  <div className="mt-2.5 pt-2 border-t border-border-color/80 flex items-center justify-center gap-2 text-[10px] text-secondary-text">
                    <Wifi className="w-3 h-3 text-leaf-600" />
                    <span>Free Wi-Fi: <strong className="text-primary-text font-mono">LoafAndLeaf_Guest</strong></span>
                  </div>
                </div>

                {/* Actions Footer */}
                <div className="p-3 bg-surface-subtle flex items-center justify-between gap-1.5 text-xs">
                  <button
                    type="button"
                    onClick={() => onOpenCustomerMenu(table.table_number)}
                    className="flex-1 py-1.5 px-2.5 bg-leaf-700 hover:bg-leaf-800 text-white rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-sm text-[11px]"
                    title="Open customer digital menu in live preview"
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>Live Preview</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handlePrintSingle(table)}
                    className="py-1.5 px-2 bg-white hover:bg-surface border border-border-color rounded-lg text-primary-text font-medium flex items-center justify-center transition-colors text-[11px]"
                    title="Print Table Tent Standee"
                  >
                    <Printer className="w-3.5 h-3.5 text-secondary-text" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCopyLink(table.table_number)}
                    className="py-1.5 px-2 bg-white hover:bg-surface border border-border-color rounded-lg text-primary-text font-medium flex items-center justify-center transition-colors text-[11px]"
                    title="Copy Menu Web Link"
                  >
                    {isCopied ? <Check className="w-3.5 h-3.5 text-leaf-600" /> : <Copy className="w-3.5 h-3.5 text-secondary-text" />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* HIDDEN PRINT CONTAINER (Formats Standees for Printing)                    */}
      {/* ========================================================================= */}
      <div id="table-standee-print" className="hidden print:block">
        <div className="grid grid-cols-2 gap-8 p-6">
          {(selectedTableForPrint ? [selectedTableForPrint] : tables).map((table) => {
            const qrSrc = qrCodeUrls[table.table_number];
            return (
              <div 
                key={table.id}
                className="border-2 border-black rounded-2xl p-6 text-center page-break-inside-avoid flex flex-col items-center justify-between min-h-[360px]"
              >
                <div>
                  <div className="text-xl font-extrabold uppercase tracking-widest text-black">
                    🌿 LOAF N LEAF
                  </div>
                  <div className="text-xs uppercase tracking-wider text-gray-700 font-semibold mt-0.5">
                    Artisan Cafe & Charcoal Grill
                  </div>

                  <div className="my-4 py-1.5 px-6 border-2 border-black rounded-full inline-block text-lg font-black tracking-wide">
                    {table.table_number} — {table.name.toUpperCase()}
                  </div>
                </div>

                <div className="my-2 p-3 border-2 border-black rounded-xl inline-block">
                  {qrSrc && (
                    <img src={qrSrc} alt={`QR for ${table.table_number}`} className="w-48 h-48 object-contain" />
                  )}
                </div>

                <div className="space-y-1">
                  <div className="text-sm font-black uppercase tracking-wide">
                    POINT PHONE CAMERA TO SCAN
                  </div>
                  <div className="text-xs font-medium text-gray-800">
                    Browse Menu & Order Food Directly to Your Table
                  </div>
                  <div className="text-[10px] text-gray-600 pt-2 border-t border-gray-400 mt-2 font-mono">
                    Guest Wi-Fi: LoafAndLeaf_Guest | Pass: freshbake
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
