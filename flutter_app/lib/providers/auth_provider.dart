import 'dart:convert';
import 'package:flutter/foundation.dart';
import '../core/constants/api_endpoints.dart';
import '../core/network/api_client.dart';
import '../core/security/device_crypto_service.dart';
import '../models/employee.dart';

enum AuthStatus {
  initial,
  authenticating,
  deviceApprovalRequired,
  authenticated,
  unauthenticated,
  error
}

class AuthProvider with ChangeNotifier {
  final ApiClient _api = ApiClient();
  final DeviceCryptoService _crypto = DeviceCryptoService();

  AuthStatus _status = AuthStatus.initial;
  Employee? _currentUser;
  String? _errorMessage;
  String? _deviceFingerprint;
  String? _deviceStatus;
  List<String> _permittedRoles = [];
  String? _tempJwtToken;

  AuthStatus get status => _status;
  Employee? get currentUser => _currentUser;
  String? get errorMessage => _errorMessage;
  String? get deviceFingerprint => _deviceFingerprint;
  String? get deviceStatus => _deviceStatus;
  List<String> get permittedRoles => _permittedRoles;

  bool get isAdmin => _currentUser?.isAdmin ?? false;
  bool get isCashier => _currentUser?.isCashier ?? false;
  bool get isWaiter => _currentUser?.isWaiter ?? false;

  Future<void> initialize() async {
    await _crypto.init();
    await _api.initTokens();

    final identity = await _crypto.getOrCreateDeviceIdentity();
    _deviceFingerprint = identity['fingerprint'];

    // Check if we have an existing session
    final storedSession = await _crypto.getStoredSession();
    if (storedSession != null && storedSession['user'] != null) {
      _currentUser = Employee.fromJson(storedSession['user']);
      if (storedSession['permitted_roles'] is List) {
        _permittedRoles = List<String>.from(storedSession['permitted_roles']);
      }
      _status = AuthStatus.authenticated;
      notifyListeners();
      return;
    }

    _status = AuthStatus.unauthenticated;
    notifyListeners();
  }

  Future<bool> loginWithPin(String pin) async {
    return _authenticate({'pin': pin});
  }

  Future<bool> loginWithCredentials(String username, String password) async {
    return _authenticate({'username': username, 'password': password});
  }

  Future<bool> _authenticate(Map<String, dynamic> credentials) async {
    try {
      _status = AuthStatus.authenticating;
      _errorMessage = null;
      notifyListeners();

      // Step 1: Request JWT from /auth/login
      final loginRes = await _api.post(ApiEndpoints.login, body: credentials);
      if (loginRes.statusCode != 200) {
        final err = jsonDecode(loginRes.body);
        _errorMessage = err['detail'] ?? 'Invalid employee credentials';
        _status = AuthStatus.unauthenticated;
        notifyListeners();
        return false;
      }

      final loginData = jsonDecode(loginRes.body);
      _tempJwtToken = loginData['access_token'];
      _currentUser = Employee.fromJson(loginData['user']);
      _api.setTokens(jwtToken: _tempJwtToken);

      // Step 2: Fetch cryptographic challenge nonce
      final challengeRes = await _api.post(
        ApiEndpoints.deviceChallenge,
        headers: {'Authorization': 'Bearer $_tempJwtToken'},
      );
      if (challengeRes.statusCode != 200) {
        _errorMessage = 'Failed to obtain security challenge from server';
        _status = AuthStatus.unauthenticated;
        notifyListeners();
        return false;
      }

      final challengeData = jsonDecode(challengeRes.body);
      final nonce = challengeData['nonce'];

      // Step 3: Sign challenge using non-extractable device key
      final identity = await _crypto.getOrCreateDeviceIdentity();
      final signature = await _crypto.signChallenge(nonce);

      // Step 4: Verify and authorize device
      final verifyRes = await _api.post(
        ApiEndpoints.deviceVerifyAndLogin,
        headers: {'Authorization': 'Bearer $_tempJwtToken'},
        body: {
          'device_fingerprint': identity['fingerprint'],
          'public_key_spki': identity['publicKeySpki'],
          'nonce': nonce,
          'signature': signature,
          'device_name': identity['deviceName'],
        },
      );

      final verifyData = jsonDecode(verifyRes.body);

      if (verifyRes.statusCode == 200 && verifyData['authorized'] == true) {
        // Device Approved! Save session tokens
        final sessionToken = verifyData['session_token'];
        if (verifyData['permitted_roles'] is List) {
          _permittedRoles = List<String>.from(verifyData['permitted_roles']);
        }
        _deviceStatus = 'approved';

        _api.setTokens(jwtToken: _tempJwtToken, sessionToken: sessionToken);
        await _crypto.saveSession({
          'session_token': sessionToken,
          'user': _currentUser!.toJson(),
          'permitted_roles': _permittedRoles,
          'device_id': verifyData['device_id'],
        });

        _status = AuthStatus.authenticated;
        notifyListeners();
        return true;
      } else {
        // Device is pending, rejected, or revoked
        _deviceStatus = verifyData['device_status'] ?? 'pending';
        _status = AuthStatus.deviceApprovalRequired;
        _errorMessage = verifyData['detail'] ?? 'Device authorization required by administrator';
        notifyListeners();
        return false;
      }
    } catch (e) {
      _errorMessage = 'Connection failed: ${e.toString()}';
      _status = AuthStatus.error;
      notifyListeners();
      return false;
    }
  }

  Future<bool> submitDeviceApprovalRequest({
    required String terminalName,
    String? requestedRole,
    String? contactInfo,
  }) async {
    try {
      final identity = await _crypto.getOrCreateDeviceIdentity(customName: terminalName);
      final res = await _api.post(
        ApiEndpoints.requestApproval,
        headers: _tempJwtToken != null ? {'Authorization': 'Bearer $_tempJwtToken'} : null,
        body: {
          'device_fingerprint': identity['fingerprint'],
          'public_key_spki': identity['publicKeySpki'],
          'device_name': terminalName,
          'requested_role': requestedRole ?? _currentUser?.role ?? 'cashier',
          'contact_info': contactInfo,
        },
      );

      if (res.statusCode == 200) {
        _deviceStatus = 'pending';
        notifyListeners();
        return true;
      }
      return false;
    } catch (_) {
      return false;
    }
  }

  Future<void> logout() async {
    _api.clearTokens();
    await _crypto.clearSession();
    _currentUser = null;
    _permittedRoles = [];
    _status = AuthStatus.unauthenticated;
    notifyListeners();
  }
}
