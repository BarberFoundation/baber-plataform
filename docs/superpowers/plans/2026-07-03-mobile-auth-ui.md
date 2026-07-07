# Mobile Auth UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the missing UI/navigation layer of `baber-mobile`'s auth flow (splash, tenant selection, phone/OTP/name, home placeholder) on top of the already-implemented domain/data/bloc layer, per `docs/superpowers/specs/2026-07-03-mobile-auth-ui-design.md`.

**Architecture:** `go_router`-driven navigation with a stateless `SplashScreen` that resolves the initial route (home/phone/tenant-selection) by reading secure storage + cold-start deep link, then hands off to Bloc-backed screens (`TenantSelectionBloc`, `AuthBloc`) that already exist. Fixes a gap where `AuthRepositoryImpl` doesn't send the backend-required `tenantId`.

**Tech Stack:** Flutter, `flutter_bloc`, `go_router`, `dio`, `flutter_secure_storage`, `app_links`, `dartz` (Either). Tests: `flutter_test`, `bloc_test`, `mocktail`.

**Repo:** `C:\Users\gabry\Documents\baber-mobile` (already cloned locally, clean, on `main`, tracks `origin/main`).

---

## Task 1: Add `TenantStorage.clear()`

**Files:**
- Modify: `lib/core/tenancy/tenant_storage.dart`
- Test: `test/core/tenancy/tenant_storage_test.dart`

- [ ] **Step 1: Write the failing test**

Add to `test/core/tenancy/tenant_storage_test.dart` (inside the existing `main()`, after the `readTenantId` test):

```dart
  test('clear deletes id and slug', () async {
    when(() => storage.delete(key: any(named: 'key'))).thenAnswer((_) async {});

    await tenantStorage.clear();

    verify(() => storage.delete(key: 'tenant_id')).called(1);
    verify(() => storage.delete(key: 'tenant_slug')).called(1);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `flutter test test/core/tenancy/tenant_storage_test.dart`
Expected: FAIL with "The method 'clear' isn't defined for the type 'TenantStorage'"

- [ ] **Step 3: Implement `clear()`**

In `lib/core/tenancy/tenant_storage.dart`, add after `readTenantSlug`:

```dart
  Future<void> clear() async {
    await _storage.delete(key: _idKey);
    await _storage.delete(key: _slugKey);
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `flutter test test/core/tenancy/tenant_storage_test.dart`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/core/tenancy/tenant_storage.dart test/core/tenancy/tenant_storage_test.dart
git commit -m "feat: add TenantStorage.clear()"
```

---

## Task 2: Fix `AuthRepositoryImpl` to send `tenantId` (gap fix)

Backend `RequestOtpDto`/`VerifyOtpDto` require `tenantId` in the body (`apps/api/src/modules/identity/http/otp-auth.controller.ts`). Current impl doesn't send it.

**Files:**
- Modify: `lib/features/auth/data/auth_repository_impl.dart`
- Test: `test/features/auth/data/auth_repository_impl_test.dart`

- [ ] **Step 1: Write the failing test**

Replace the full contents of `test/features/auth/data/auth_repository_impl_test.dart`:

```dart
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:baber_mobile/core/error/failure.dart';
import 'package:baber_mobile/core/tenancy/tenant_storage.dart';
import 'package:baber_mobile/features/auth/data/auth_repository_impl.dart';

class MockDio extends Mock implements Dio {}
class MockTenantStorage extends Mock implements TenantStorage {}

void main() {
  late MockDio dio;
  late MockTenantStorage tenantStorage;
  late AuthRepositoryImpl repository;

  setUp(() {
    dio = MockDio();
    tenantStorage = MockTenantStorage();
    when(() => tenantStorage.readTenantId()).thenAnswer((_) async => 't1');
    repository = AuthRepositoryImpl(dio, tenantStorage);
  });

  test('requestOtp posts phone + tenantId and returns Right on 200/204', () async {
    when(() => dio.post('/auth/otp/request', data: {'phone': '+5511999999999', 'tenantId': 't1'}))
        .thenAnswer((_) async => Response(
              requestOptions: RequestOptions(path: '/auth/otp/request'),
              statusCode: 204,
            ));

    final result = await repository.requestOtp('+5511999999999');

    expect(result.isRight(), isTrue);
  });

  test('requestOtp maps 429 to ApiFailure', () async {
    when(() => dio.post('/auth/otp/request', data: {'phone': '+5511999999999', 'tenantId': 't1'}))
        .thenThrow(DioException(
      requestOptions: RequestOptions(path: '/auth/otp/request'),
      response: Response(
        requestOptions: RequestOptions(path: '/auth/otp/request'),
        statusCode: 429,
        data: {'message': 'rate limited'},
      ),
    ));

    final result = await repository.requestOtp('+5511999999999');

    result.fold(
      (failure) {
        expect(failure, isA<ApiFailure>());
        expect((failure as ApiFailure).statusCode, 429);
      },
      (_) => fail('expected left'),
    );
  });

  test('verifyOtp posts phone + code + tenantId and returns AuthUser with tokens', () async {
    when(() => dio.post('/auth/otp/verify', data: {'phone': '+5511999999999', 'code': '123456', 'tenantId': 't1'}))
        .thenAnswer((_) async => Response(
              requestOptions: RequestOptions(path: '/auth/otp/verify'),
              statusCode: 200,
              data: {
                'accessToken': 'a',
                'refreshToken': 'r',
                'user': {'id': 'u1', 'name': null, 'phone': '+5511999999999'},
              },
            ));

    final result = await repository.verifyOtp(phone: '+5511999999999', code: '123456');

    result.fold((_) => fail('expected right'), (authResult) {
      expect(authResult.accessToken, 'a');
      expect(authResult.refreshToken, 'r');
      expect(authResult.user.name, isNull);
      expect(authResult.user.needsName, isTrue);
    });
  });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `flutter test test/features/auth/data/auth_repository_impl_test.dart`
Expected: FAIL — `AuthRepositoryImpl(dio, tenantStorage)` doesn't match the current 1-arg constructor, and stubbed `dio.post` calls (with `tenantId` in data) never match what the old impl sends.

- [ ] **Step 3: Update `AuthRepositoryImpl`**

Replace the full contents of `lib/features/auth/data/auth_repository_impl.dart`:

```dart
import 'package:dartz/dartz.dart';
import 'package:dio/dio.dart';
import '../../../core/error/failure.dart';
import '../../../core/tenancy/tenant_storage.dart';
import '../domain/auth_repository.dart';
import '../domain/auth_user.dart';

class AuthRepositoryImpl implements AuthRepository {
  final Dio _dio;
  final TenantStorage _tenantStorage;
  const AuthRepositoryImpl(this._dio, this._tenantStorage);

  @override
  Future<Either<Failure, Unit>> requestOtp(String phone) async {
    try {
      final tenantId = (await _tenantStorage.readTenantId())!;
      await _dio.post('/auth/otp/request', data: {'phone': phone, 'tenantId': tenantId});
      return const Right(unit);
    } on DioException catch (e) {
      return Left(_mapError(e));
    }
  }

  @override
  Future<Either<Failure, AuthResult>> verifyOtp({required String phone, required String code}) async {
    try {
      final tenantId = (await _tenantStorage.readTenantId())!;
      final response = await _dio.post(
        '/auth/otp/verify',
        data: {'phone': phone, 'code': code, 'tenantId': tenantId},
      );
      return Right(AuthResult.fromJson(response.data as Map<String, dynamic>));
    } on DioException catch (e) {
      return Left(_mapError(e));
    }
  }

  @override
  Future<Either<Failure, AuthUser>> updateName(String name) async {
    try {
      final response = await _dio.patch('/me', data: {'name': name});
      return Right(AuthUser.fromJson(response.data as Map<String, dynamic>));
    } on DioException catch (e) {
      return Left(_mapError(e));
    }
  }

  Failure _mapError(DioException e) {
    final statusCode = e.response?.statusCode;
    if (statusCode == null) return NetworkFailure(e.message ?? 'network error');
    final data = e.response?.data;
    final message = (data is Map) ? (data['message']?.toString() ?? 'api error') : 'api error';
    return ApiFailure(statusCode: statusCode, message: message);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `flutter test test/features/auth/data/auth_repository_impl_test.dart`
Expected: PASS (3 tests)

- [ ] **Step 5: Find and update the constructor's other call site**

Run: `grep -rn "AuthRepositoryImpl(" lib`
Expected: no matches yet (only wired in Task 10's `main.dart`) — if any match appears, update it to pass `tenantStorage` as the second argument.

- [ ] **Step 6: Commit**

```bash
git add lib/features/auth/data/auth_repository_impl.dart test/features/auth/data/auth_repository_impl_test.dart
git commit -m "fix: send tenantId in OTP request/verify body per backend contract"
```

---

## Task 3: App theme

**Files:**
- Create: `lib/shared/theme/app_theme.dart`
- Test: `test/shared/theme/app_theme_test.dart`

- [ ] **Step 1: Write the failing test**

```dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:baber_mobile/shared/theme/app_theme.dart';

void main() {
  test('appTheme uses Material 3 with a dark amber-seeded color scheme', () {
    expect(appTheme.useMaterial3, isTrue);
    expect(appTheme.brightness, Brightness.dark);
    expect(appTheme.colorScheme.brightness, Brightness.dark);
  });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `flutter test test/shared/theme/app_theme_test.dart`
Expected: FAIL with "Target of URI doesn't exist: 'package:baber_mobile/shared/theme/app_theme.dart'"

- [ ] **Step 3: Implement**

```dart
import 'package:flutter/material.dart';

final ThemeData appTheme = ThemeData(
  useMaterial3: true,
  colorScheme: ColorScheme.fromSeed(
    seedColor: Colors.amber,
    brightness: Brightness.dark,
  ),
);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `flutter test test/shared/theme/app_theme_test.dart`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/shared/theme/app_theme.dart test/shared/theme/app_theme_test.dart
git commit -m "feat: add app theme (Material 3, dark, amber seed)"
```

---

## Task 4: `InitialRouteResolver`

Decides the splash screen's target route from stored session + cold-start deep link.

**Files:**
- Create: `lib/features/splash/presentation/initial_route_resolver.dart`
- Test: `test/features/splash/presentation/initial_route_resolver_test.dart`

- [ ] **Step 1: Write the failing tests**

```dart
import 'package:app_links/app_links.dart';
import 'package:dartz/dartz.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:baber_mobile/core/auth/token_storage.dart';
import 'package:baber_mobile/core/error/failure.dart';
import 'package:baber_mobile/core/tenancy/tenant_storage.dart';
import 'package:baber_mobile/features/splash/presentation/initial_route_resolver.dart';
import 'package:baber_mobile/features/tenant_selection/domain/tenant.dart';
import 'package:baber_mobile/features/tenant_selection/domain/tenant_repository.dart';

class MockTokenStorage extends Mock implements TokenStorage {}
class MockTenantStorage extends Mock implements TenantStorage {}
class MockTenantRepository extends Mock implements TenantRepository {}
class MockAppLinks extends Mock implements AppLinks {}

void main() {
  late MockTokenStorage tokenStorage;
  late MockTenantStorage tenantStorage;
  late MockTenantRepository tenantRepository;
  late MockAppLinks appLinks;
  late InitialRouteResolver resolver;

  setUp(() {
    tokenStorage = MockTokenStorage();
    tenantStorage = MockTenantStorage();
    tenantRepository = MockTenantRepository();
    appLinks = MockAppLinks();
    resolver = InitialRouteResolver(
      tokenStorage: tokenStorage,
      tenantStorage: tenantStorage,
      tenantRepository: tenantRepository,
      appLinks: appLinks,
    );
  });

  test('tenant + token present -> /home', () async {
    when(() => tenantStorage.readTenantId()).thenAnswer((_) async => 't1');
    when(() => tokenStorage.readAccessToken()).thenAnswer((_) async => 'access-token');

    expect(await resolver.resolve(), '/home');
  });

  test('tenant present, no token -> /phone', () async {
    when(() => tenantStorage.readTenantId()).thenAnswer((_) async => 't1');
    when(() => tokenStorage.readAccessToken()).thenAnswer((_) async => null);

    expect(await resolver.resolve(), '/phone');
  });

  test('no tenant, deep link resolves -> saves tenant, /phone', () async {
    when(() => tenantStorage.readTenantId()).thenAnswer((_) async => null);
    when(() => tokenStorage.readAccessToken()).thenAnswer((_) async => null);
    when(() => appLinks.getInitialLink())
        .thenAnswer((_) async => Uri.parse('baber://t/barbearia-do-amigo'));
    when(() => tenantRepository.findBySlug('barbearia-do-amigo')).thenAnswer(
      (_) async => const Right(Tenant(id: 't2', slug: 'barbearia-do-amigo', name: 'Barbearia do Amigo')),
    );
    when(() => tenantStorage.saveTenant(id: any(named: 'id'), slug: any(named: 'slug')))
        .thenAnswer((_) async {});

    expect(await resolver.resolve(), '/phone');
    verify(() => tenantStorage.saveTenant(id: 't2', slug: 'barbearia-do-amigo')).called(1);
  });

  test('no tenant, no deep link -> /tenant-selection', () async {
    when(() => tenantStorage.readTenantId()).thenAnswer((_) async => null);
    when(() => tokenStorage.readAccessToken()).thenAnswer((_) async => null);
    when(() => appLinks.getInitialLink()).thenAnswer((_) async => null);

    expect(await resolver.resolve(), '/tenant-selection');
  });

  test('no tenant, deep link slug not found -> /tenant-selection', () async {
    when(() => tenantStorage.readTenantId()).thenAnswer((_) async => null);
    when(() => tokenStorage.readAccessToken()).thenAnswer((_) async => null);
    when(() => appLinks.getInitialLink()).thenAnswer((_) async => Uri.parse('baber://t/unknown'));
    when(() => tenantRepository.findBySlug('unknown'))
        .thenAnswer((_) async => const Left(ApiFailure(statusCode: 404, message: 'not found')));

    expect(await resolver.resolve(), '/tenant-selection');
  });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `flutter test test/features/splash/presentation/initial_route_resolver_test.dart`
Expected: FAIL with "Target of URI doesn't exist"

- [ ] **Step 3: Implement**

```dart
import 'package:app_links/app_links.dart';
import '../../../core/auth/token_storage.dart';
import '../../../core/tenancy/deep_link_parser.dart';
import '../../../core/tenancy/tenant_storage.dart';
import '../../tenant_selection/domain/tenant_repository.dart';

class InitialRouteResolver {
  final TokenStorage tokenStorage;
  final TenantStorage tenantStorage;
  final TenantRepository tenantRepository;
  final AppLinks appLinks;

  const InitialRouteResolver({
    required this.tokenStorage,
    required this.tenantStorage,
    required this.tenantRepository,
    required this.appLinks,
  });

  Future<String> resolve() async {
    final tenantId = await tenantStorage.readTenantId();
    final accessToken = await tokenStorage.readAccessToken();

    if (tenantId != null && accessToken != null) return '/home';
    if (tenantId != null) return '/phone';

    final initialUri = await appLinks.getInitialLink();
    final slug = initialUri == null ? null : DeepLinkParser.extractTenantSlug(initialUri);
    if (slug == null) return '/tenant-selection';

    final result = await tenantRepository.findBySlug(slug);
    String? nextRoute;
    await result.fold(
      (_) async => nextRoute = null,
      (tenant) async {
        await tenantStorage.saveTenant(id: tenant.id, slug: tenant.slug);
        nextRoute = '/phone';
      },
    );
    return nextRoute ?? '/tenant-selection';
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `flutter test test/features/splash/presentation/initial_route_resolver_test.dart`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/features/splash/presentation/initial_route_resolver.dart test/features/splash/presentation/initial_route_resolver_test.dart
git commit -m "feat: add InitialRouteResolver for splash routing logic"
```

---

## Task 5: `SplashScreen`

**Files:**
- Create: `lib/features/splash/presentation/splash_screen.dart`

No dedicated widget test — routing logic is fully covered by Task 4's `InitialRouteResolver` tests per the spec (integration of splash → router is exercised manually in Task 10).

- [ ] **Step 1: Implement**

```dart
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'initial_route_resolver.dart';

class SplashScreen extends StatefulWidget {
  final InitialRouteResolver resolver;

  const SplashScreen({super.key, required this.resolver});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  @override
  void initState() {
    super.initState();
    _resolve();
  }

  Future<void> _resolve() async {
    final route = await widget.resolver.resolve();
    if (mounted) context.go(route);
  }

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(child: CircularProgressIndicator()),
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/features/splash/presentation/splash_screen.dart
git commit -m "feat: add SplashScreen"
```

---

## Task 6: `TenantSelectionScreen`

**Files:**
- Create: `lib/features/tenant_selection/presentation/tenant_selection_screen.dart`
- Test: `test/features/tenant_selection/presentation/tenant_selection_screen_test.dart`

- [ ] **Step 1: Write the failing tests**

```dart
import 'package:bloc_test/bloc_test.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:baber_mobile/features/tenant_selection/domain/tenant.dart';
import 'package:baber_mobile/features/tenant_selection/presentation/tenant_selection_bloc.dart';
import 'package:baber_mobile/features/tenant_selection/presentation/tenant_selection_event.dart';
import 'package:baber_mobile/features/tenant_selection/presentation/tenant_selection_screen.dart';
import 'package:baber_mobile/features/tenant_selection/presentation/tenant_selection_state.dart';

class MockTenantSelectionBloc extends MockBloc<TenantSelectionEvent, TenantSelectionState>
    implements TenantSelectionBloc {}

void main() {
  late MockTenantSelectionBloc bloc;

  setUpAll(() {
    registerFallbackValue(LoadTenants());
    registerFallbackValue(
      const SelectTenant(Tenant(id: 't1', slug: 's', name: 'n')),
    );
  });

  setUp(() {
    bloc = MockTenantSelectionBloc();
  });

  Widget wrap(Widget child) => MaterialApp(
        home: BlocProvider<TenantSelectionBloc>.value(value: bloc, child: child),
      );

  testWidgets('dispatches LoadTenants on init', (tester) async {
    whenListen(bloc, const Stream<TenantSelectionState>.empty(), initialState: const TenantSelectionState.initial());

    await tester.pumpWidget(wrap(const TenantSelectionScreen()));

    verify(() => bloc.add(LoadTenants())).called(1);
  });

  testWidgets('shows spinner while loading', (tester) async {
    whenListen(bloc, const Stream<TenantSelectionState>.empty(), initialState: const TenantSelectionState.loading());

    await tester.pumpWidget(wrap(const TenantSelectionScreen()));

    expect(find.byType(CircularProgressIndicator), findsOneWidget);
  });

  testWidgets('renders tenant list and dispatches SelectTenant on tap', (tester) async {
    const tenant = Tenant(id: 't1', slug: 'barbearia-do-amigo', name: 'Barbearia do Amigo');
    whenListen(
      bloc,
      const Stream<TenantSelectionState>.empty(),
      initialState: const TenantSelectionState.loaded([tenant]),
    );

    await tester.pumpWidget(wrap(const TenantSelectionScreen()));
    await tester.tap(find.text('Barbearia do Amigo'));

    verify(() => bloc.add(const SelectTenant(tenant))).called(1);
  });

  testWidgets('shows error SnackBar when errorMessage present', (tester) async {
    whenListen(
      bloc,
      Stream.fromIterable([const TenantSelectionState.error('falha ao carregar')]),
      initialState: const TenantSelectionState.initial(),
    );

    await tester.pumpWidget(wrap(const TenantSelectionScreen()));
    await tester.pump();

    expect(find.text('falha ao carregar'), findsOneWidget);
  });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `flutter test test/features/tenant_selection/presentation/tenant_selection_screen_test.dart`
Expected: FAIL with "Target of URI doesn't exist"

- [ ] **Step 3: Implement**

```dart
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'tenant_selection_bloc.dart';
import 'tenant_selection_event.dart';
import 'tenant_selection_state.dart';

class TenantSelectionScreen extends StatefulWidget {
  const TenantSelectionScreen({super.key});

  @override
  State<TenantSelectionScreen> createState() => _TenantSelectionScreenState();
}

class _TenantSelectionScreenState extends State<TenantSelectionScreen> {
  @override
  void initState() {
    super.initState();
    context.read<TenantSelectionBloc>().add(LoadTenants());
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Escolha a barbearia')),
      body: BlocConsumer<TenantSelectionBloc, TenantSelectionState>(
        listener: (context, state) {
          if (state.errorMessage != null) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text(state.errorMessage!)),
            );
          }
          if (state.selectedTenant != null) {
            context.go('/phone');
          }
        },
        builder: (context, state) {
          if (state.isLoading) {
            return const Center(child: CircularProgressIndicator());
          }
          final tenants = state.tenants ?? [];
          return ListView.builder(
            itemCount: tenants.length,
            itemBuilder: (context, index) {
              final tenant = tenants[index];
              return ListTile(
                title: Text(tenant.name),
                onTap: () => context.read<TenantSelectionBloc>().add(SelectTenant(tenant)),
              );
            },
          );
        },
      ),
    );
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `flutter test test/features/tenant_selection/presentation/tenant_selection_screen_test.dart`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/features/tenant_selection/presentation/tenant_selection_screen.dart test/features/tenant_selection/presentation/tenant_selection_screen_test.dart
git commit -m "feat: add TenantSelectionScreen"
```

---

## Task 7: `PhoneScreen`

**Files:**
- Create: `lib/features/auth/presentation/phone_screen.dart`
- Test: `test/features/auth/presentation/phone_screen_test.dart`

- [ ] **Step 1: Write the failing tests**

```dart
import 'package:bloc_test/bloc_test.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:baber_mobile/features/auth/presentation/auth_bloc.dart';
import 'package:baber_mobile/features/auth/presentation/auth_event.dart';
import 'package:baber_mobile/features/auth/presentation/auth_state.dart';
import 'package:baber_mobile/features/auth/presentation/phone_screen.dart';

class MockAuthBloc extends MockBloc<AuthEvent, AuthState> implements AuthBloc {}

void main() {
  late MockAuthBloc bloc;

  setUpAll(() {
    registerFallbackValue(const PhoneSubmitted(''));
  });

  setUp(() {
    bloc = MockAuthBloc();
  });

  Widget wrap(Widget child) => MaterialApp(
        home: BlocProvider<AuthBloc>.value(value: bloc, child: child),
      );

  testWidgets('tapping Continuar dispatches PhoneSubmitted', (tester) async {
    whenListen(bloc, const Stream<AuthState>.empty(), initialState: const AuthState.initial());

    await tester.pumpWidget(wrap(const PhoneScreen()));
    await tester.enterText(find.byType(TextField), '+5511999999999');
    await tester.tap(find.text('Continuar'));

    verify(() => bloc.add(const PhoneSubmitted('+5511999999999'))).called(1);
  });

  testWidgets('shows spinner and disables button when loading', (tester) async {
    whenListen(bloc, const Stream<AuthState>.empty(), initialState: const AuthState.loading());

    await tester.pumpWidget(wrap(const PhoneScreen()));

    expect(find.byType(CircularProgressIndicator), findsOneWidget);
    final button = tester.widget<ElevatedButton>(find.byType(ElevatedButton));
    expect(button.onPressed, isNull);
  });

  testWidgets('shows error SnackBar when errorMessage present', (tester) async {
    whenListen(
      bloc,
      Stream.fromIterable([const AuthState.error('telefone inválido')]),
      initialState: const AuthState.initial(),
    );

    await tester.pumpWidget(wrap(const PhoneScreen()));
    await tester.pump();

    expect(find.text('telefone inválido'), findsOneWidget);
  });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `flutter test test/features/auth/presentation/phone_screen_test.dart`
Expected: FAIL with "Target of URI doesn't exist"

- [ ] **Step 3: Implement**

```dart
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'auth_bloc.dart';
import 'auth_event.dart';
import 'auth_state.dart';

class PhoneScreen extends StatefulWidget {
  const PhoneScreen({super.key});

  @override
  State<PhoneScreen> createState() => _PhoneScreenState();
}

class _PhoneScreenState extends State<PhoneScreen> {
  final _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Entrar')),
      body: BlocConsumer<AuthBloc, AuthState>(
        listener: (context, state) {
          if (state.errorMessage != null) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text(state.errorMessage!)),
            );
          }
          if (state.codeSentToPhone != null) {
            context.go('/otp');
          }
        },
        builder: (context, state) {
          return Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                TextField(
                  controller: _controller,
                  keyboardType: TextInputType.phone,
                  decoration: const InputDecoration(labelText: 'Telefone'),
                ),
                const SizedBox(height: 16),
                ElevatedButton(
                  onPressed: state.isLoading
                      ? null
                      : () => context.read<AuthBloc>().add(PhoneSubmitted(_controller.text)),
                  child: state.isLoading
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Text('Continuar'),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `flutter test test/features/auth/presentation/phone_screen_test.dart`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/features/auth/presentation/phone_screen.dart test/features/auth/presentation/phone_screen_test.dart
git commit -m "feat: add PhoneScreen"
```

---

## Task 8: `OtpScreen` (with resend countdown)

**Files:**
- Create: `lib/features/auth/presentation/otp_screen.dart`
- Test: `test/features/auth/presentation/otp_screen_test.dart`

- [ ] **Step 1: Write the failing tests**

```dart
import 'package:bloc_test/bloc_test.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:baber_mobile/features/auth/presentation/auth_bloc.dart';
import 'package:baber_mobile/features/auth/presentation/auth_event.dart';
import 'package:baber_mobile/features/auth/presentation/auth_state.dart';
import 'package:baber_mobile/features/auth/presentation/otp_screen.dart';

class MockAuthBloc extends MockBloc<AuthEvent, AuthState> implements AuthBloc {}

void main() {
  late MockAuthBloc bloc;

  setUpAll(() {
    registerFallbackValue(const PhoneSubmitted(''));
    registerFallbackValue(const CodeSubmitted(phone: '', code: ''));
  });

  setUp(() {
    bloc = MockAuthBloc();
  });

  Widget wrap(Widget child) => MaterialApp(
        home: BlocProvider<AuthBloc>.value(value: bloc, child: child),
      );

  testWidgets('tapping Confirmar dispatches CodeSubmitted with phone from state', (tester) async {
    whenListen(bloc, const Stream<AuthState>.empty(), initialState: const AuthState.codeSent('+5511999999999'));

    await tester.pumpWidget(wrap(const OtpScreen()));
    await tester.enterText(find.byType(TextField), '123456');
    await tester.tap(find.text('Confirmar'));

    verify(() => bloc.add(const CodeSubmitted(phone: '+5511999999999', code: '123456'))).called(1);
  });

  testWidgets('resend button starts disabled with 30s countdown', (tester) async {
    whenListen(bloc, const Stream<AuthState>.empty(), initialState: const AuthState.codeSent('+5511999999999'));

    await tester.pumpWidget(wrap(const OtpScreen()));

    expect(find.text('Reenviar em 30 s'), findsOneWidget);
  });

  testWidgets('resend button enables after 30s and dispatches PhoneSubmitted on tap', (tester) async {
    whenListen(bloc, const Stream<AuthState>.empty(), initialState: const AuthState.codeSent('+5511999999999'));

    await tester.pumpWidget(wrap(const OtpScreen()));
    await tester.pump(const Duration(seconds: 30));

    expect(find.text('Reenviar código'), findsOneWidget);

    await tester.tap(find.text('Reenviar código'));

    verify(() => bloc.add(const PhoneSubmitted('+5511999999999'))).called(1);
  });

  testWidgets('shows error SnackBar when errorMessage present', (tester) async {
    whenListen(
      bloc,
      Stream.fromIterable([const AuthState.error('código inválido')]),
      initialState: const AuthState.codeSent('+5511999999999'),
    );

    await tester.pumpWidget(wrap(const OtpScreen()));
    await tester.pump();

    expect(find.text('código inválido'), findsOneWidget);
  });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `flutter test test/features/auth/presentation/otp_screen_test.dart`
Expected: FAIL with "Target of URI doesn't exist"

- [ ] **Step 3: Implement**

```dart
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'auth_bloc.dart';
import 'auth_event.dart';
import 'auth_state.dart';

class OtpScreen extends StatefulWidget {
  const OtpScreen({super.key});

  @override
  State<OtpScreen> createState() => _OtpScreenState();
}

class _OtpScreenState extends State<OtpScreen> {
  final _controller = TextEditingController();
  Timer? _timer;
  int _secondsLeft = 30;

  @override
  void initState() {
    super.initState();
    _startCountdown();
  }

  void _startCountdown() {
    _secondsLeft = 30;
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_secondsLeft == 0) {
        timer.cancel();
        return;
      }
      setState(() => _secondsLeft--);
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Código')),
      body: BlocConsumer<AuthBloc, AuthState>(
        listener: (context, state) {
          if (state.errorMessage != null) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text(state.errorMessage!)),
            );
          }
          if (state.userNeedingName != null) {
            context.go('/name');
          } else if (state.authenticatedUser != null) {
            context.go('/home', extra: state.authenticatedUser!.name);
          }
        },
        builder: (context, state) {
          final phone = state.codeSentToPhone ?? '';
          return Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text('Código enviado para $phone'),
                const SizedBox(height: 16),
                TextField(
                  controller: _controller,
                  keyboardType: TextInputType.number,
                  maxLength: 6,
                  decoration: const InputDecoration(labelText: 'Código'),
                ),
                const SizedBox(height: 16),
                ElevatedButton(
                  onPressed: state.isLoading
                      ? null
                      : () => context.read<AuthBloc>().add(
                            CodeSubmitted(phone: phone, code: _controller.text),
                          ),
                  child: state.isLoading
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Text('Confirmar'),
                ),
                TextButton(
                  onPressed: _secondsLeft == 0
                      ? () {
                          context.read<AuthBloc>().add(PhoneSubmitted(phone));
                          _startCountdown();
                        }
                      : null,
                  child: Text(_secondsLeft == 0 ? 'Reenviar código' : 'Reenviar em $_secondsLeft s'),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `flutter test test/features/auth/presentation/otp_screen_test.dart`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/features/auth/presentation/otp_screen.dart test/features/auth/presentation/otp_screen_test.dart
git commit -m "feat: add OtpScreen with resend countdown"
```

---

## Task 9: `NameScreen`

**Files:**
- Create: `lib/features/auth/presentation/name_screen.dart`
- Test: `test/features/auth/presentation/name_screen_test.dart`

- [ ] **Step 1: Write the failing tests**

```dart
import 'package:bloc_test/bloc_test.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:baber_mobile/features/auth/presentation/auth_bloc.dart';
import 'package:baber_mobile/features/auth/presentation/auth_event.dart';
import 'package:baber_mobile/features/auth/presentation/auth_state.dart';
import 'package:baber_mobile/features/auth/domain/auth_user.dart';
import 'package:baber_mobile/features/auth/presentation/name_screen.dart';

class MockAuthBloc extends MockBloc<AuthEvent, AuthState> implements AuthBloc {}

void main() {
  late MockAuthBloc bloc;

  setUpAll(() {
    registerFallbackValue(const NameSubmitted(''));
  });

  setUp(() {
    bloc = MockAuthBloc();
  });

  Widget wrap(Widget child) => MaterialApp(
        home: BlocProvider<AuthBloc>.value(value: bloc, child: child),
      );

  testWidgets('tapping Continuar dispatches NameSubmitted', (tester) async {
    const user = AuthUser(id: 'u1', name: null, phone: '+5511999999999');
    whenListen(bloc, const Stream<AuthState>.empty(), initialState: AuthState.needsName(user));

    await tester.pumpWidget(wrap(const NameScreen()));
    await tester.enterText(find.byType(TextField), 'João');
    await tester.tap(find.text('Continuar'));

    verify(() => bloc.add(const NameSubmitted('João'))).called(1);
  });

  testWidgets('shows spinner and disables button when loading', (tester) async {
    whenListen(bloc, const Stream<AuthState>.empty(), initialState: const AuthState.loading());

    await tester.pumpWidget(wrap(const NameScreen()));

    expect(find.byType(CircularProgressIndicator), findsOneWidget);
    final button = tester.widget<ElevatedButton>(find.byType(ElevatedButton));
    expect(button.onPressed, isNull);
  });

  testWidgets('shows error SnackBar when errorMessage present', (tester) async {
    whenListen(
      bloc,
      Stream.fromIterable([const AuthState.error('nome inválido')]),
      initialState: const AuthState.initial(),
    );

    await tester.pumpWidget(wrap(const NameScreen()));
    await tester.pump();

    expect(find.text('nome inválido'), findsOneWidget);
  });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `flutter test test/features/auth/presentation/name_screen_test.dart`
Expected: FAIL with "Target of URI doesn't exist"

- [ ] **Step 3: Implement**

```dart
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'auth_bloc.dart';
import 'auth_event.dart';
import 'auth_state.dart';

class NameScreen extends StatefulWidget {
  const NameScreen({super.key});

  @override
  State<NameScreen> createState() => _NameScreenState();
}

class _NameScreenState extends State<NameScreen> {
  final _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Seu nome')),
      body: BlocConsumer<AuthBloc, AuthState>(
        listener: (context, state) {
          if (state.errorMessage != null) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text(state.errorMessage!)),
            );
          }
          if (state.authenticatedUser != null) {
            context.go('/home', extra: state.authenticatedUser!.name);
          }
        },
        builder: (context, state) {
          return Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                TextField(
                  controller: _controller,
                  decoration: const InputDecoration(labelText: 'Nome'),
                ),
                const SizedBox(height: 16),
                ElevatedButton(
                  onPressed: state.isLoading
                      ? null
                      : () => context.read<AuthBloc>().add(NameSubmitted(_controller.text)),
                  child: state.isLoading
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Text('Continuar'),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `flutter test test/features/auth/presentation/name_screen_test.dart`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/features/auth/presentation/name_screen.dart test/features/auth/presentation/name_screen_test.dart
git commit -m "feat: add NameScreen"
```

---

## Task 10: `HomeScreen`

**Files:**
- Create: `lib/features/home/presentation/home_screen.dart`
- Test: `test/features/home/presentation/home_screen_test.dart`

- [ ] **Step 1: Write the failing tests**

```dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mocktail/mocktail.dart';
import 'package:baber_mobile/core/auth/token_storage.dart';
import 'package:baber_mobile/core/tenancy/tenant_storage.dart';
import 'package:baber_mobile/features/home/presentation/home_screen.dart';

class MockTokenStorage extends Mock implements TokenStorage {}
class MockTenantStorage extends Mock implements TenantStorage {}

void main() {
  late MockTokenStorage tokenStorage;
  late MockTenantStorage tenantStorage;

  setUp(() {
    tokenStorage = MockTokenStorage();
    tenantStorage = MockTenantStorage();
    when(() => tokenStorage.clear()).thenAnswer((_) async {});
    when(() => tenantStorage.clear()).thenAnswer((_) async {});
  });

  Future<GoRouter> pumpHome(WidgetTester tester, {String? userName}) async {
    final router = GoRouter(
      initialLocation: '/home',
      routes: [
        GoRoute(
          path: '/home',
          builder: (context, state) => HomeScreen(
            tokenStorage: tokenStorage,
            tenantStorage: tenantStorage,
            userName: userName,
          ),
        ),
        GoRoute(
          path: '/tenant-selection',
          builder: (context, state) => const Scaffold(body: Text('tenant selection')),
        ),
      ],
    );
    await tester.pumpWidget(MaterialApp.router(routerConfig: router));
    return router;
  }

  testWidgets('renders welcome text with user name', (tester) async {
    await pumpHome(tester, userName: 'João');

    expect(find.text('Bem-vindo, João'), findsOneWidget);
  });

  testWidgets('tapping logout clears storages and navigates to tenant-selection', (tester) async {
    await pumpHome(tester, userName: 'João');

    await tester.tap(find.byIcon(Icons.logout));
    await tester.pumpAndSettle();

    verify(() => tokenStorage.clear()).called(1);
    verify(() => tenantStorage.clear()).called(1);
    expect(find.text('tenant selection'), findsOneWidget);
  });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `flutter test test/features/home/presentation/home_screen_test.dart`
Expected: FAIL with "Target of URI doesn't exist"

- [ ] **Step 3: Implement**

```dart
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../core/auth/token_storage.dart';
import '../../../core/tenancy/tenant_storage.dart';

class HomeScreen extends StatelessWidget {
  final TokenStorage tokenStorage;
  final TenantStorage tenantStorage;
  final String? userName;

  const HomeScreen({
    super.key,
    required this.tokenStorage,
    required this.tenantStorage,
    this.userName,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Início'),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () async {
              await tokenStorage.clear();
              await tenantStorage.clear();
              if (context.mounted) context.go('/tenant-selection');
            },
          ),
        ],
      ),
      body: Center(child: Text('Bem-vindo, ${userName ?? ''}')),
    );
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `flutter test test/features/home/presentation/home_screen_test.dart`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/features/home/presentation/home_screen.dart test/features/home/presentation/home_screen_test.dart
git commit -m "feat: add HomeScreen placeholder"
```

---

## Task 11: Wire router + `main.dart`, remove counter demo

**Files:**
- Create: `lib/core/router/app_router.dart`
- Create: `lib/baber_app.dart`
- Modify: `lib/main.dart`
- Modify: `test/widget_test.dart`

- [ ] **Step 1: Implement the router builder**

Create `lib/core/router/app_router.dart`:

```dart
import 'package:app_links/app_links.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../auth/token_storage.dart';
import '../tenancy/tenant_storage.dart';
import '../../features/auth/domain/auth_repository.dart';
import '../../features/auth/presentation/auth_bloc.dart';
import '../../features/auth/presentation/name_screen.dart';
import '../../features/auth/presentation/otp_screen.dart';
import '../../features/auth/presentation/phone_screen.dart';
import '../../features/home/presentation/home_screen.dart';
import '../../features/splash/presentation/initial_route_resolver.dart';
import '../../features/splash/presentation/splash_screen.dart';
import '../../features/tenant_selection/domain/tenant_repository.dart';
import '../../features/tenant_selection/presentation/tenant_selection_bloc.dart';
import '../../features/tenant_selection/presentation/tenant_selection_screen.dart';

GoRouter buildAppRouter({
  required TokenStorage tokenStorage,
  required TenantStorage tenantStorage,
  required AuthRepository authRepository,
  required TenantRepository tenantRepository,
  required AppLinks appLinks,
}) {
  final resolver = InitialRouteResolver(
    tokenStorage: tokenStorage,
    tenantStorage: tenantStorage,
    tenantRepository: tenantRepository,
    appLinks: appLinks,
  );

  return GoRouter(
    initialLocation: '/',
    routes: [
      GoRoute(
        path: '/',
        builder: (context, state) => SplashScreen(resolver: resolver),
      ),
      GoRoute(
        path: '/tenant-selection',
        builder: (context, state) => BlocProvider(
          create: (_) => TenantSelectionBloc(repository: tenantRepository, tenantStorage: tenantStorage),
          child: const TenantSelectionScreen(),
        ),
      ),
      ShellRoute(
        builder: (context, state, child) => BlocProvider(
          create: (_) => AuthBloc(repository: authRepository, tokenStorage: tokenStorage),
          child: child,
        ),
        routes: [
          GoRoute(path: '/phone', builder: (context, state) => const PhoneScreen()),
          GoRoute(path: '/otp', builder: (context, state) => const OtpScreen()),
          GoRoute(path: '/name', builder: (context, state) => const NameScreen()),
        ],
      ),
      GoRoute(
        path: '/home',
        builder: (context, state) => HomeScreen(
          tokenStorage: tokenStorage,
          tenantStorage: tenantStorage,
          userName: state.extra as String?,
        ),
      ),
    ],
  );
}
```

- [ ] **Step 2: Implement `BaberApp`**

Create `lib/baber_app.dart`:

```dart
import 'package:app_links/app_links.dart';
import 'package:flutter/material.dart';
import 'core/auth/token_storage.dart';
import 'core/router/app_router.dart';
import 'core/tenancy/tenant_storage.dart';
import 'features/auth/domain/auth_repository.dart';
import 'features/tenant_selection/domain/tenant_repository.dart';
import 'shared/theme/app_theme.dart';

class BaberApp extends StatelessWidget {
  final TokenStorage tokenStorage;
  final TenantStorage tenantStorage;
  final AuthRepository authRepository;
  final TenantRepository tenantRepository;
  final AppLinks appLinks;

  const BaberApp({
    super.key,
    required this.tokenStorage,
    required this.tenantStorage,
    required this.authRepository,
    required this.tenantRepository,
    required this.appLinks,
  });

  @override
  Widget build(BuildContext context) {
    final router = buildAppRouter(
      tokenStorage: tokenStorage,
      tenantStorage: tenantStorage,
      authRepository: authRepository,
      tenantRepository: tenantRepository,
      appLinks: appLinks,
    );
    return MaterialApp.router(
      title: 'Baber',
      theme: appTheme,
      routerConfig: router,
    );
  }
}
```

- [ ] **Step 3: Replace `main.dart`**

Replace the full contents of `lib/main.dart`:

```dart
import 'package:app_links/app_links.dart';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'baber_app.dart';
import 'core/api/api_client.dart';
import 'core/auth/token_storage.dart';
import 'core/tenancy/tenant_storage.dart';
import 'features/auth/data/auth_repository_impl.dart';
import 'features/tenant_selection/data/tenant_repository_impl.dart';

void main() {
  const storage = FlutterSecureStorage();
  final tokenStorage = TokenStorage(storage);
  final tenantStorage = TenantStorage(storage);
  final apiClient = ApiClient(
    baseUrl: const String.fromEnvironment('API_BASE_URL', defaultValue: 'http://localhost:3000'),
    tokenStorage: tokenStorage,
    tenantStorage: tenantStorage,
  );
  final authRepository = AuthRepositoryImpl(apiClient.dio, tenantStorage);
  final tenantRepository = TenantRepositoryImpl(apiClient.dio);

  runApp(BaberApp(
    tokenStorage: tokenStorage,
    tenantStorage: tenantStorage,
    authRepository: authRepository,
    tenantRepository: tenantRepository,
    appLinks: AppLinks(),
  ));
}
```

- [ ] **Step 4: Replace the stale counter smoke test**

Replace the full contents of `test/widget_test.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:baber_mobile/baber_app.dart';
import 'package:baber_mobile/core/auth/token_storage.dart';
import 'package:baber_mobile/core/tenancy/tenant_storage.dart';
import 'package:app_links/app_links.dart';
import 'package:mocktail/mocktail.dart';
import 'package:baber_mobile/features/auth/domain/auth_repository.dart';
import 'package:baber_mobile/features/tenant_selection/domain/tenant_repository.dart';

class MockTokenStorage extends Mock implements TokenStorage {}
class MockTenantStorage extends Mock implements TenantStorage {}
class MockAuthRepository extends Mock implements AuthRepository {}
class MockTenantRepository extends Mock implements TenantRepository {}
class MockAppLinks extends Mock implements AppLinks {}

void main() {
  testWidgets('app boots to tenant selection when no session or deep link is stored', (tester) async {
    final tokenStorage = MockTokenStorage();
    final tenantStorage = MockTenantStorage();
    final appLinks = MockAppLinks();
    when(() => tenantStorage.readTenantId()).thenAnswer((_) async => null);
    when(() => tokenStorage.readAccessToken()).thenAnswer((_) async => null);
    when(() => appLinks.getInitialLink()).thenAnswer((_) async => null);

    await tester.pumpWidget(BaberApp(
      tokenStorage: tokenStorage,
      tenantStorage: tenantStorage,
      authRepository: MockAuthRepository(),
      tenantRepository: MockTenantRepository(),
      appLinks: appLinks,
    ));
    await tester.pumpAndSettle();

    expect(find.text('Escolha a barbearia'), findsOneWidget);
  });
}
```

- [ ] **Step 5: Run the full test suite**

Run: `flutter test`
Expected: PASS, all tests across every file green (no failures)

- [ ] **Step 6: Static analysis**

Run: `flutter analyze`
Expected: "No issues found!"

- [ ] **Step 7: Commit**

```bash
git add lib/core/router/app_router.dart lib/baber_app.dart lib/main.dart test/widget_test.dart
git commit -m "feat: wire go_router navigation and replace counter demo with BaberApp"
```

---

## Task 12: Manual smoke check

- [ ] **Step 1: Run the app**

Run: `flutter run` (pick a connected device/emulator; if none, run `flutter emulators --launch <id>` first or skip and rely on Task 11's widget test as the verification of this plan)
Expected: App boots to "Escolha a barbearia" (no stored session in a fresh install). Manually verify: tapping a tenant (once `GET /tenants` returns data from a running `apps/api`) navigates to the phone screen, and the OTP resend button is disabled with a visible countdown.

- [ ] **Step 2: Note results**

If `apps/api` isn't running locally, this step is a visual check of the tenant-selection/phone/OTP/name screens only (network calls will show the SnackBar error, which itself confirms the error-handling wiring works). Report what was actually observed — don't claim the full network flow works unless it was actually exercised against a running backend.
