import 'dart:convert';
import 'dart:math';
import 'dart:typed_data';
import 'package:crypto/crypto.dart' as crypto;
import 'package:pointycastle/api.dart';
import 'package:pointycastle/ecc/api.dart';
import 'package:pointycastle/ecc/curves/secp256r1.dart';
import 'package:pointycastle/key_generators/api.dart';
import 'package:pointycastle/key_generators/ec_key_generator.dart';
import 'package:pointycastle/random/fortuna_random.dart';
import 'package:pointycastle/signers/ecdsa_signer.dart';
import 'package:pointycastle/digests/sha256.dart';
import 'package:pointycastle/signers/hmac_dsa_k_calculator.dart';
import 'package:shared_preferences/shared_preferences.dart';

class DeviceCryptoService {
  static final DeviceCryptoService _instance = DeviceCryptoService._internal();
  factory DeviceCryptoService() => _instance;
  DeviceCryptoService._internal();

  static const String _keyPrivateD = 'device_private_d';
  static const String _keyPublicSpki = 'device_public_spki';
  static const String _keyFingerprint = 'device_fingerprint';
  static const String _keyDeviceName = 'device_name';
  static const String _keySession = 'device_session';

  ECPrivateKey? _privateKey;
  String? _publicKeySpki;
  String? _fingerprint;
  String? _deviceName;

  String? get fingerprint => _fingerprint;
  String? get publicKeySpki => _publicKeySpki;
  String? get deviceName => _deviceName;

  // SPKI DER prefix for ECDSA P-256 (27 bytes including 0x04 uncompressed marker)
  // 30 59 30 13 06 07 2a 86 48 ce 3d 02 01 06 08 2a 86 48 ce 3d 03 01 07 03 42 00 04
  static final Uint8List _spkiPrefix = Uint8List.fromList([
    0x30, 0x59, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01,
    0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07, 0x03, 0x42, 0x00, 0x04
  ]);

  Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    final dStr = prefs.getString(_keyPrivateD);
    _publicKeySpki = prefs.getString(_keyPublicSpki);
    _fingerprint = prefs.getString(_keyFingerprint);
    _deviceName = prefs.getString(_keyDeviceName);

    if (dStr != null) {
      final curve = ECCurve_secp256r1();
      final d = BigInt.parse(dStr, radix: 16);
      _privateKey = ECPrivateKey(d, curve);
    }
  }

  Future<Map<String, dynamic>> getOrCreateDeviceIdentity({String? customName}) async {
    if (_privateKey != null && _publicKeySpki != null && _fingerprint != null) {
      return {
        'fingerprint': _fingerprint!,
        'publicKeySpki': _publicKeySpki!,
        'deviceName': _deviceName ?? 'Loaf n Leaf Terminal',
        'isNew': false,
      };
    }

    final prefs = await SharedPreferences.getInstance();
    final curve = ECCurve_secp256r1();

    // Secure RNG seed for Fortuna
    final secureRandom = FortunaRandom();
    final random = Random.secure();
    final seeds = Uint8List(32);
    for (int i = 0; i < 32; i++) {
      seeds[i] = random.nextInt(256);
    }
    secureRandom.seed(KeyParameter(seeds));

    final keyGen = ECKeyGenerator();
    keyGen.init(ParametersWithRandom(ECKeyGeneratorParameters(curve), secureRandom));

    final pair = keyGen.generateKeyPair();
    _privateKey = pair.privateKey as ECPrivateKey;
    final pub = pair.publicKey as ECPublicKey;

    // Convert pub X and Y to 32 bytes each
    final xBytes = _bigIntTo32Bytes(pub.Q!.x!.toBigInteger()!);
    final yBytes = _bigIntTo32Bytes(pub.Q!.y!.toBigInteger()!);

    // Construct 91-byte SubjectPublicKeyInfo DER
    final spkiBytes = Uint8List(91);
    spkiBytes.setRange(0, _spkiPrefix.length, _spkiPrefix);
    spkiBytes.setRange(_spkiPrefix.length, _spkiPrefix.length + 32, xBytes);
    spkiBytes.setRange(_spkiPrefix.length + 32, _spkiPrefix.length + 64, yBytes);

    _publicKeySpki = base64Encode(spkiBytes);

    // Compute SHA-256 fingerprint hash
    final digest = crypto.sha256.convert(spkiBytes).toString();
    _fingerprint = digest.substring(0, 32);

    _deviceName = customName ?? 'Loaf n Leaf Terminal';

    // Persist
    await prefs.setString(_keyPrivateD, _privateKey!.d!.toRadixString(16));
    await prefs.setString(_keyPublicSpki, _publicKeySpki!);
    await prefs.setString(_keyFingerprint, _fingerprint!);
    await prefs.setString(_keyDeviceName, _deviceName!);

    return {
      'fingerprint': _fingerprint!,
      'publicKeySpki': _publicKeySpki!,
      'deviceName': _deviceName!,
      'isNew': true,
    };
  }

  Uint8List _bigIntTo32Bytes(BigInt number) {
    var hex = number.toRadixString(16);
    if (hex.length % 2 != 0) hex = '0$hex';
    while (hex.length < 64) hex = '0$hex';
    final result = Uint8List(32);
    for (int i = 0; i < 32; i++) {
      result[i] = int.parse(hex.substring(i * 2, i * 2 + 2), radix: 16);
    }
    return result;
  }

  Future<String> signChallenge(String nonce) async {
    if (_privateKey == null) {
      await getOrCreateDeviceIdentity();
    }
    if (_privateKey == null) {
      throw Exception('Device private key could not be initialized');
    }

    final signer = ECDSASigner(SHA256Digest(), HMacDSAKCalculator(SHA256Digest()));
    signer.init(true, PrivateKeyParameter<ECPrivateKey>(_privateKey!));

    final data = utf8.encode(nonce);
    final ecSignature = signer.generateSignature(Uint8List.fromList(data)) as ECSignature;

    final rBytes = _bigIntTo32Bytes(ecSignature.r);
    final sBytes = _bigIntTo32Bytes(ecSignature.s);

    final p1363Sig = Uint8List(64);
    p1363Sig.setRange(0, 32, rBytes);
    p1363Sig.setRange(32, 64, sBytes);

    return base64Encode(p1363Sig);
  }

  Future<void> saveSession(Map<String, dynamic> session) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_keySession, jsonEncode(session));
  }

  Future<Map<String, dynamic>?> getStoredSession() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_keySession);
    if (raw == null) return null;
    try {
      return jsonDecode(raw) as Map<String, dynamic>;
    } catch (_) {
      return null;
    }
  }

  Future<void> clearSession() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_keySession);
  }

  Future<void> resetDeviceVault() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_keyPrivateD);
    await prefs.remove(_keyPublicSpki);
    await prefs.remove(_keyFingerprint);
    await prefs.remove(_keyDeviceName);
    await prefs.remove(_keySession);
    _privateKey = null;
    _publicKeySpki = null;
    _fingerprint = null;
    _deviceName = null;
  }
}
