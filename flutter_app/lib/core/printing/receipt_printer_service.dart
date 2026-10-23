import 'dart:io';
import 'dart:typed_data';
import 'dart:convert';
import 'package:flutter/foundation.dart';

class ReceiptPrinterService {
  static final ReceiptPrinterService _instance = ReceiptPrinterService._internal();
  factory ReceiptPrinterService() => _instance;
  ReceiptPrinterService._internal();

  // Standard ESC/POS Command Byte Constants
  static const List<int> _escInit = [0x1B, 0x40]; // Initialize printer
  static const List<int> _escAlignLeft = [0x1B, 0x61, 0x00];
  static const List<int> _escAlignCenter = [0x1B, 0x61, 0x01];
  static const List<int> _escAlignRight = [0x1B, 0x61, 0x02];
  static const List<int> _escBoldOn = [0x1B, 0x45, 0x01];
  static const List<int> _escBoldOff = [0x1B, 0x45, 0x00];
  static const List<int> _escCutPaper = [0x1D, 0x56, 0x42, 0x00]; // GS V B 0 (Full/Partial cut)
  static const List<int> _escFeed3Lines = [0x1B, 0x64, 0x03];

  /// Send formatted 80mm receipt text directly to network thermal printer over raw TCP socket.
  Future<bool> printOverNetwork({
    required String printerIp,
    int port = 9100,
    required String receiptText,
  }) async {
    try {
      final socket = await Socket.connect(
        printerIp,
        port,
        timeout: const Duration(seconds: 4),
      );

      final builder = BytesBuilder();
      builder.add(_escInit);
      builder.add(utf8.encode(receiptText));
      builder.add(_escFeed3Lines);
      builder.add(_escCutPaper);

      socket.add(builder.toBytes());
      await socket.flush();
      await socket.close();
      return true;
    } catch (e) {
      debugPrint('ESC/POS Network Print Error: $e');
      return false;
    }
  }

  /// Format raw thermal receipt text for 80mm paper (42-48 monospace characters per line)
  String format80mmLine(String left, String right, {int width = 42}) {
    final available = width - left.length - right.length;
    if (available <= 0) {
      return '$left $right\n';
    }
    return '$left${' ' * available}$right\n';
  }

  String formatDottedSeparator({int width = 42}) {
    return '${'-' * width}\n';
  }
}
