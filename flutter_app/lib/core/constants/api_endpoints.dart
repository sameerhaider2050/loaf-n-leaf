class ApiEndpoints {
  // Configurable Local Restaurant Server URL (LAN Mini-PC or Localhost)
  static String baseUrl = 'http://localhost:8000/api/v1';

  static String get login => '$baseUrl/auth/login';
  static String get me => '$baseUrl/auth/me';
  static String get staff => '$baseUrl/auth/staff';

  // Device-Based Access Control
  static String get deviceChallenge => '$baseUrl/devices/challenge';
  static String get deviceVerifyAndLogin => '$baseUrl/devices/verify-and-login';
  static String get deviceStatus => '$baseUrl/devices/status';
  static String get requestApproval => '$baseUrl/devices/request-approval';
  static String get adminDevices => '$baseUrl/devices/admin/devices';
  static String get adminPolicy => '$baseUrl/devices/admin/policy';
  static String get adminAuditLogs => '$baseUrl/devices/admin/audit-logs';

  // Catalog & Seating
  static String get categories => '$baseUrl/categories';
  static String get products => '$baseUrl/products';
  static String get tables => '$baseUrl/tables';

  // Orders & Kitchen Pipeline
  static String get orders => '$baseUrl/orders';

  // Payments & Checkout
  static String get checkout => '$baseUrl/payments/checkout';
  static String get receipt => '$baseUrl/payments/receipt';

  // Reports
  static String get reportsSummary => '$baseUrl/reports/summary';
  static String get exportCsv => '$baseUrl/reports/export-csv';

  // Sync Checkpoints
  static String get syncCheckpoints => '$baseUrl/sync/checkpoints';
}
