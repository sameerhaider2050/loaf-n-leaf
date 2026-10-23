import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'core/constants/app_colors.dart';
import 'providers/auth_provider.dart';
import 'providers/catalog_provider.dart';
import 'providers/pos_provider.dart';
import 'providers/waiter_provider.dart';
import 'providers/admin_provider.dart';

import 'views/auth/login_view.dart';
import 'views/auth/device_approval_view.dart';
import 'views/waiter/waiter_home_view.dart';
import 'views/cashier/cashier_pos_view.dart';
import 'views/admin/admin_dashboard_view.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const LoafNLeafApp());
}

class LoafNLeafApp extends StatelessWidget {
  const LoafNLeafApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()..initialize()),
        ChangeNotifierProvider(create: (_) => CatalogProvider()),
        ChangeNotifierProvider(create: (_) => PosProvider()),
        ChangeNotifierProvider(create: (_) => WaiterProvider()),
        ChangeNotifierProvider(create: (_) => AdminProvider()),
      ],
      child: MaterialApp(
        title: 'Loaf n Leaf POS',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(
          useMaterial3: true,
          colorScheme: ColorScheme.fromSeed(
            seedColor: AppColors.primary,
            primary: AppColors.primary,
            secondary: AppColors.wheat,
            background: AppColors.background,
            surface: AppColors.surface,
          ),
          scaffoldBackgroundColor: AppColors.background,
          fontFamily: 'Inter',
          appBarTheme: const AppBarTheme(
            backgroundColor: AppColors.primaryDark,
            foregroundColor: Colors.white,
            elevation: 0,
          ),
          cardTheme: CardTheme(
            color: AppColors.surface,
            elevation: 1,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
              side: const BorderSide(color: AppColors.border, width: 1),
            ),
          ),
          elevatedButtonTheme: ElevatedButtonThemeData(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              foregroundColor: Colors.white,
              elevation: 0,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(8),
              ),
            ),
          ),
        ),
        home: const RootRoleRouter(),
      ),
    );
  }
}

class RootRoleRouter extends StatelessWidget {
  const RootRoleRouter({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context);

    // Initial loading or authenticating
    if (auth.status == AuthStatus.initial) {
      return Scaffold(
        backgroundColor: AppColors.primaryDark,
        body: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.local_cafe, size: 64, color: AppColors.wheat),
              const SizedBox(height: 16),
              const Text(
                'LOAF N LEAF',
                style: TextStyle(
                  color: Colors.white,
                  letterSpacing: 3,
                  fontWeight: FontWeight.bold,
                  fontSize: 22,
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Starting POS Engine & Verifying Device Hardware...',
                style: TextStyle(color: Colors.white70, fontSize: 13),
              ),
              const SizedBox(height: 24),
              const CircularProgressIndicator(color: AppColors.wheat),
            ],
          ),
        ),
      );
    }

    // Unauthenticated state -> Login View
    if (auth.status == AuthStatus.unauthenticated || (auth.status == AuthStatus.authenticating && auth.currentUser == null)) {
      return const LoginView();
    }

    // Device Authorization Gate -> Device Approval View
    if (auth.status == AuthStatus.deviceApprovalRequired) {
      return const DeviceApprovalView();
    }

    // Authenticated state -> Route based on RBAC & Permitted Roles
    if (auth.status == AuthStatus.authenticated && auth.currentUser != null) {
      final role = auth.currentUser!.role.toLowerCase();

      if (role == 'admin') {
        return const AdminDashboardView();
      } else if (role == 'cashier') {
        return const CashierPosView();
      } else {
        // 'order_taker' / waiter
        return const WaiterHomeView();
      }
    }

    return const LoginView();
  }
}
