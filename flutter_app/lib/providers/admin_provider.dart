import 'dart:convert';
import 'package:flutter/foundation.dart';
import '../core/constants/api_endpoints.dart';
import '../core/network/api_client.dart';
import '../models/device.dart';
import '../models/employee.dart';

class AdminProvider with ChangeNotifier {
  final ApiClient _api = ApiClient();

  List<AuthorizedDevice> _devices = [];
  List<Employee> _staffList = [];
  Map<String, dynamic>? _salesSummary;
  List<Map<String, dynamic>> _auditLogs = [];
  int _maxDevicesPerEmployee = 2;

  bool _isLoading = false;
  String? _errorMessage;
  String _selectedPeriod = 'today'; // 'today', 'week', 'month', 'all'

  List<AuthorizedDevice> get devices => _devices;
  List<Employee> get staffList => _staffList;
  Map<String, dynamic>? get salesSummary => _salesSummary;
  List<Map<String, dynamic>> get auditLogs => _auditLogs;
  int get maxDevicesPerEmployee => _maxDevicesPerEmployee;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;
  String get selectedPeriod => _selectedPeriod;

  Future<void> loadDashboardData() async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      await Future.wait([
        fetchDevices(),
        fetchStaff(),
        fetchSalesSummary(_selectedPeriod),
      ]);
    } catch (e) {
      _errorMessage = 'Failed to load admin data: $e';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> fetchDevices() async {
    try {
      final res = await _api.get(ApiEndpoints.adminDevices);
      if (res.statusCode == 200) {
        final List list = jsonDecode(res.body);
        _devices = list.map((d) => AuthorizedDevice.fromJson(d)).toList();
        notifyListeners();
      }
    } catch (_) {}
  }

  Future<void> fetchStaff() async {
    try {
      final res = await _api.get(ApiEndpoints.staff);
      if (res.statusCode == 200) {
        final List list = jsonDecode(res.body);
        _staffList = list.map((e) => Employee.fromJson(e)).toList();
        notifyListeners();
      }
    } catch (_) {}
  }

  Future<void> fetchSalesSummary(String period) async {
    _selectedPeriod = period;
    try {
      final res = await _api.get('${ApiEndpoints.reportsSummary}?period=$period');
      if (res.statusCode == 200) {
        _salesSummary = jsonDecode(res.body);
        notifyListeners();
      }
    } catch (_) {}
  }

  Future<void> fetchAuditLogs() async {
    try {
      final res = await _api.get(ApiEndpoints.adminAuditLogs);
      if (res.statusCode == 200) {
        final List list = jsonDecode(res.body);
        _auditLogs = List<Map<String, dynamic>>.from(list);
        notifyListeners();
      }
    } catch (_) {}
  }

  Future<bool> approveDevice({
    required String deviceId,
    required List<String> permittedRoles,
    String? assignedEmployeeId,
  }) async {
    try {
      final body = {
        'permitted_roles': permittedRoles,
        if (assignedEmployeeId != null) 'assigned_employee_id': assignedEmployeeId,
      };
      final res = await _api.post('${ApiEndpoints.adminDevices}/$deviceId/approve', body: body);
      if (res.statusCode == 200) {
        await fetchDevices();
        return true;
      }
      return false;
    } catch (_) {
      return false;
    }
  }

  Future<bool> rejectDevice(String deviceId, {String? reason}) async {
    try {
      final body = {'reason': reason ?? 'Rejected by administrator'};
      final res = await _api.post('${ApiEndpoints.adminDevices}/$deviceId/reject', body: body);
      if (res.statusCode == 200) {
        await fetchDevices();
        return true;
      }
      return false;
    } catch (_) {
      return false;
    }
  }

  Future<bool> revokeDevice(String deviceId, {String? reason}) async {
    try {
      final body = {'reason': reason ?? 'Revoked by administrator'};
      final res = await _api.post('${ApiEndpoints.adminDevices}/$deviceId/revoke', body: body);
      if (res.statusCode == 200) {
        await fetchDevices();
        return true;
      }
      return false;
    } catch (_) {
      return false;
    }
  }

  Future<bool> createStaff({
    required String username,
    required String fullName,
    required String email,
    required String role,
    String? pin,
    String? password,
  }) async {
    try {
      final body = {
        'username': username,
        'full_name': fullName,
        'email': email,
        'role': role,
        if (pin != null) 'pin': pin,
        if (password != null) 'password': password,
      };
      final res = await _api.post(ApiEndpoints.staff, body: body);
      if (res.statusCode == 201) {
        await fetchStaff();
        return true;
      }
      return false;
    } catch (_) {
      return false;
    }
  }
}
