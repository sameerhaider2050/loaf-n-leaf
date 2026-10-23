import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class ApiClient {
  static final ApiClient _instance = ApiClient._internal();
  factory ApiClient() => _instance;
  ApiClient._internal();

  String? _jwtToken;
  String? _deviceSessionToken;

  Future<void> initTokens() async {
    final prefs = await SharedPreferences.getInstance();
    _jwtToken = prefs.getString('jwt_token');
    _deviceSessionToken = prefs.getString('device_session_token');
  }

  void setTokens({String? jwtToken, String? sessionToken}) async {
    final prefs = await SharedPreferences.getInstance();
    if (jwtToken != null) {
      _jwtToken = jwtToken;
      await prefs.setString('jwt_token', jwtToken);
    }
    if (sessionToken != null) {
      _deviceSessionToken = sessionToken;
      await prefs.setString('device_session_token', sessionToken);
    }
  }

  void clearTokens() async {
    _jwtToken = null;
    _deviceSessionToken = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('jwt_token');
    await prefs.remove('device_session_token');
  }

  Map<String, String> _buildHeaders([Map<String, String>? customHeaders]) {
    final headers = <String, String>{
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (_jwtToken != null) {
      headers['Authorization'] = 'Bearer $_jwtToken';
    }
    if (_deviceSessionToken != null) {
      headers['x-device-session-token'] = _deviceSessionToken!;
    }
    if (customHeaders != null) {
      headers.addAll(customHeaders);
    }
    return headers;
  }

  Future<http.Response> get(String url, {Map<String, String>? headers}) async {
    return await http.get(Uri.parse(url), headers: _buildHeaders(headers));
  }

  Future<http.Response> post(String url, {dynamic body, Map<String, String>? headers}) async {
    return await http.post(
      Uri.parse(url),
      headers: _buildHeaders(headers),
      body: body is String ? body : jsonEncode(body),
    );
  }

  Future<http.Response> put(String url, {dynamic body, Map<String, String>? headers}) async {
    return await http.put(
      Uri.parse(url),
      headers: _buildHeaders(headers),
      body: body is String ? body : jsonEncode(body),
    );
  }

  Future<http.Response> delete(String url, {Map<String, String>? headers}) async {
    return await http.delete(Uri.parse(url), headers: _buildHeaders(headers));
  }
}
