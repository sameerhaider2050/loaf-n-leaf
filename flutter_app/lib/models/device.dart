class AuthorizedDevice {
  final String id;
  final String fingerprint;
  final String name;
  final String? assignedEmployeeId;
  final String? assignedEmployeeName;
  final List<String> permittedRoles;
  final String status; // 'pending', 'approved', 'rejected', 'revoked'
  final DateTime? lastActiveAt;

  AuthorizedDevice({
    required this.id,
    required this.fingerprint,
    required this.name,
    this.assignedEmployeeId,
    this.assignedEmployeeName,
    required this.permittedRoles,
    required this.status,
    this.lastActiveAt,
  });

  factory AuthorizedDevice.fromJson(Map<String, dynamic> json) {
    List<String> roles = [];
    if (json['permitted_roles'] is List) {
      roles = List<String>.from(json['permitted_roles']);
    } else if (json['permitted_roles'] is String) {
      roles = [json['permitted_roles']];
    }

    return AuthorizedDevice(
      id: json['id'] ?? '',
      fingerprint: json['device_fingerprint_hash'] ?? json['fingerprint'] ?? '',
      name: json['device_name'] ?? json['name'] ?? 'Unnamed Terminal',
      assignedEmployeeId: json['assigned_employee_id'],
      assignedEmployeeName: json['assigned_employee_name'],
      permittedRoles: roles,
      status: json['status'] ?? 'pending',
      lastActiveAt: json['last_active_at'] != null 
          ? DateTime.tryParse(json['last_active_at']) 
          : null,
    );
  }

  bool get isApproved => status == 'approved';
  bool get isPending => status == 'pending';
  bool get isRevoked => status == 'revoked';
}
