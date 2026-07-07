# Mobile Notificações + Home Dashboard + Navegação Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **IMPORTANT:** Do NOT add `Co-Authored-By` trailers to any commit message.
>
> **Depends on:** `docs/superpowers/plans/2026-07-07-notifications-my-notifications.md` (backend `GET /notifications/my`), `docs/superpowers/plans/2026-07-07-mobile-catalog-booking.md`, `docs/superpowers/plans/2026-07-07-mobile-my-appointments.md` (all mobile routes/repositories from those plans must already be wired).

**Goal:** Add a read-only in-app notifications list, turn `HomeScreen` into a real dashboard (next appointment + shortcuts), and switch top-level navigation to a 3-tab bottom nav bar (Início / Consultas / Notificações), finishing the "app mobile completo" design.

**Architecture:** New `notifications` feature (entity, repository, bloc, screen) mirroring `appointments`. `HomeScreen` becomes stateful with its own `HomeBloc` that loads the user's profile name (`GET /me`, added in the catalog-booking plan) and next upcoming appointment. Navigation switches from flat `GoRoute`s to `StatefulShellRoute.indexedStack` (already available in `go_router: ^14.6.2`) for the three bottom-nav tabs, while `/tenant-selection`, the auth `ShellRoute`, `/services`, and `/booking/*` remain top-level routes pushed on top of the shell (they're not tabs — they're stacked flows entered *from* Início).

**Tech Stack:** Flutter, `flutter_bloc`, `go_router`, `dio`, `dartz`. Tests: `flutter_test`, `bloc_test`, `mocktail`.

**Repo:** `C:\Users\gabry\Documents\baber-mobile`.

**Design ref:** `docs/superpowers/specs/2026-07-07-mobile-app-full-design.md` §7, §8, §9.

---

## Task 1: `NotificationItem` domain entity + repository

**Files:**
- Create: `lib/features/notifications/domain/notification_item.dart`
- Create: `lib/features/notifications/domain/notifications_repository.dart`
- Create: `lib/features/notifications/data/notifications_repository_impl.dart`
- Test: `test/features/notifications/data/notifications_repository_impl_test.dart`

- [ ] **Step 1: Write the failing test**

Create `test/features/notifications/data/notifications_repository_impl_test.dart`:

```dart
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:baber_mobile/core/error/failure.dart';
import 'package:baber_mobile/features/notifications/data/notifications_repository_impl.dart';

class MockDio extends Mock implements Dio {}

void main() {
  late MockDio dio;
  late NotificationsRepositoryImpl repository;

  setUp(() {
    dio = MockDio();
    repository = NotificationsRepositoryImpl(dio);
  });

  test('listMine returns Right with parsed notifications on 200', () async {
    when(() => dio.get('/notifications/my')).thenAnswer((_) async => Response(
          requestOptions: RequestOptions(path: '/notifications/my'),
          statusCode: 200,
          data: [
            {
              'appointmentId': 'appt-1', 'type': 'CONFIRMATION', 'message': 'Confirmado!',
              'status': 'SENT', 'sentAt': '2026-01-01T10:00:00.000Z', 'createdAt': '2026-01-01T10:00:00.000Z',
            },
          ],
        ));

    final result = await repository.listMine();

    result.fold((_) => fail('expected right'), (items) {
      expect(items, hasLength(1));
      expect(items[0].message, 'Confirmado!');
    });
  });

  test('listMine maps DioException to ApiFailure', () async {
    when(() => dio.get('/notifications/my')).thenThrow(DioException(
      requestOptions: RequestOptions(path: '/notifications/my'),
      response: Response(
        requestOptions: RequestOptions(path: '/notifications/my'),
        statusCode: 500,
        data: {'message': 'erro interno'},
      ),
    ));

    final result = await repository.listMine();

    result.fold((failure) {
      expect(failure, isA<ApiFailure>());
    }, (_) => fail('expected left'));
  });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `flutter test test/features/notifications/data/notifications_repository_impl_test.dart`
Expected: FAIL with "Target of URI doesn't exist"

- [ ] **Step 3: Implement the entity**

Create `lib/features/notifications/domain/notification_item.dart`:

```dart
import 'package:equatable/equatable.dart';

enum NotificationItemType { confirmation, cancellation, reminder }

NotificationItemType _typeFromString(String value) {
  switch (value) {
    case 'CONFIRMATION':
      return NotificationItemType.confirmation;
    case 'CANCELLATION':
      return NotificationItemType.cancellation;
    case 'REMINDER':
      return NotificationItemType.reminder;
    default:
      throw ArgumentError('Unknown notification type: $value');
  }
}

class NotificationItem extends Equatable {
  final String appointmentId;
  final NotificationItemType type;
  final String message;
  final String status;
  final DateTime? sentAt;
  final DateTime createdAt;

  const NotificationItem({
    required this.appointmentId,
    required this.type,
    required this.message,
    required this.status,
    required this.sentAt,
    required this.createdAt,
  });

  factory NotificationItem.fromJson(Map<String, dynamic> json) => NotificationItem(
        appointmentId: json['appointmentId'] as String,
        type: _typeFromString(json['type'] as String),
        message: json['message'] as String,
        status: json['status'] as String,
        sentAt: json['sentAt'] != null ? DateTime.parse(json['sentAt'] as String) : null,
        createdAt: DateTime.parse(json['createdAt'] as String),
      );

  @override
  List<Object?> get props => [appointmentId, type, message, status, sentAt, createdAt];
}
```

- [ ] **Step 4: Implement the repository port**

Create `lib/features/notifications/domain/notifications_repository.dart`:

```dart
import 'package:dartz/dartz.dart';
import '../../../core/error/failure.dart';
import 'notification_item.dart';

abstract class NotificationsRepository {
  Future<Either<Failure, List<NotificationItem>>> listMine();
}
```

- [ ] **Step 5: Implement the Dio-backed repository**

Create `lib/features/notifications/data/notifications_repository_impl.dart`:

```dart
import 'package:dartz/dartz.dart';
import 'package:dio/dio.dart';
import '../../../core/error/failure.dart';
import '../domain/notification_item.dart';
import '../domain/notifications_repository.dart';

class NotificationsRepositoryImpl implements NotificationsRepository {
  final Dio _dio;
  const NotificationsRepositoryImpl(this._dio);

  @override
  Future<Either<Failure, List<NotificationItem>>> listMine() async {
    try {
      final response = await _dio.get('/notifications/my');
      final items = (response.data as List)
          .map((json) => NotificationItem.fromJson(json as Map<String, dynamic>))
          .toList();
      return Right(items);
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

- [ ] **Step 6: Run test to verify it passes**

Run: `flutter test test/features/notifications/data/notifications_repository_impl_test.dart`
Expected: PASS (2 tests)

- [ ] **Step 7: Commit**

```bash
git add lib/features/notifications/domain/notification_item.dart lib/features/notifications/domain/notifications_repository.dart lib/features/notifications/data/notifications_repository_impl.dart test/features/notifications/data/notifications_repository_impl_test.dart
git commit -m "feat(notifications): add NotificationItem entity and repository"
```

---

## Task 2: `NotificationsBloc`

**Files:**
- Create: `lib/features/notifications/presentation/notifications_event.dart`
- Create: `lib/features/notifications/presentation/notifications_state.dart`
- Create: `lib/features/notifications/presentation/notifications_bloc.dart`
- Test: `test/features/notifications/presentation/notifications_bloc_test.dart`

- [ ] **Step 1: Write the failing tests**

Create `test/features/notifications/presentation/notifications_bloc_test.dart`:

```dart
import 'package:bloc_test/bloc_test.dart';
import 'package:dartz/dartz.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:baber_mobile/core/error/failure.dart';
import 'package:baber_mobile/features/notifications/domain/notification_item.dart';
import 'package:baber_mobile/features/notifications/domain/notifications_repository.dart';
import 'package:baber_mobile/features/notifications/presentation/notifications_bloc.dart';
import 'package:baber_mobile/features/notifications/presentation/notifications_event.dart';
import 'package:baber_mobile/features/notifications/presentation/notifications_state.dart';

class MockNotificationsRepository extends Mock implements NotificationsRepository {}

void main() {
  late MockNotificationsRepository repository;

  final item = NotificationItem(
    appointmentId: 'appt-1', type: NotificationItemType.confirmation,
    message: 'Confirmado!', status: 'SENT', sentAt: DateTime(2026, 1, 1), createdAt: DateTime(2026, 1, 1),
  );

  setUp(() {
    repository = MockNotificationsRepository();
  });

  blocTest<NotificationsBloc, NotificationsState>(
    'emits [loading, loaded] when LoadNotifications succeeds',
    build: () {
      when(() => repository.listMine()).thenAnswer((_) async => Right([item]));
      return NotificationsBloc(repository: repository);
    },
    act: (bloc) => bloc.add(LoadNotifications()),
    expect: () => [
      const NotificationsState.loading(),
      NotificationsState.loaded([item]),
    ],
  );

  blocTest<NotificationsBloc, NotificationsState>(
    'emits [loading, error] when LoadNotifications fails',
    build: () {
      when(() => repository.listMine())
          .thenAnswer((_) async => const Left(ApiFailure(statusCode: 500, message: 'erro interno')));
      return NotificationsBloc(repository: repository);
    },
    act: (bloc) => bloc.add(LoadNotifications()),
    expect: () => [
      const NotificationsState.loading(),
      const NotificationsState.error('erro interno'),
    ],
  );
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `flutter test test/features/notifications/presentation/notifications_bloc_test.dart`
Expected: FAIL with "Target of URI doesn't exist"

- [ ] **Step 3: Implement**

Create `lib/features/notifications/presentation/notifications_event.dart`:

```dart
import 'package:equatable/equatable.dart';

sealed class NotificationsEvent extends Equatable {
  const NotificationsEvent();
  @override
  List<Object?> get props => [];
}

class LoadNotifications extends NotificationsEvent {}
```

Create `lib/features/notifications/presentation/notifications_state.dart`:

```dart
import 'package:equatable/equatable.dart';
import '../domain/notification_item.dart';

class NotificationsState extends Equatable {
  final List<NotificationItem>? items;
  final String? errorMessage;
  final bool isLoading;

  const NotificationsState({this.items, this.errorMessage, this.isLoading = false});

  const NotificationsState.initial() : this();
  const NotificationsState.loading() : this(isLoading: true);
  const NotificationsState.loaded(List<NotificationItem> items) : this(items: items);
  const NotificationsState.error(String message) : this(errorMessage: message);

  @override
  List<Object?> get props => [items, errorMessage, isLoading];
}
```

Create `lib/features/notifications/presentation/notifications_bloc.dart`:

```dart
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/error/failure_message.dart';
import '../domain/notifications_repository.dart';
import 'notifications_event.dart';
import 'notifications_state.dart';

class NotificationsBloc extends Bloc<NotificationsEvent, NotificationsState> {
  final NotificationsRepository repository;

  NotificationsBloc({required this.repository}) : super(const NotificationsState.initial()) {
    on<LoadNotifications>(_onLoad);
  }

  Future<void> _onLoad(LoadNotifications event, Emitter<NotificationsState> emit) async {
    emit(const NotificationsState.loading());
    final result = await repository.listMine();
    result.fold(
      (failure) => emit(NotificationsState.error(failureMessage(failure))),
      (items) => emit(NotificationsState.loaded(items)),
    );
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `flutter test test/features/notifications/presentation/notifications_bloc_test.dart`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/features/notifications/presentation/notifications_event.dart lib/features/notifications/presentation/notifications_state.dart lib/features/notifications/presentation/notifications_bloc.dart test/features/notifications/presentation/notifications_bloc_test.dart
git commit -m "feat(notifications): add NotificationsBloc"
```

---

## Task 3: `relativeTime` helper

**Files:**
- Create: `lib/shared/utils/relative_time.dart`
- Test: `test/shared/utils/relative_time_test.dart`

No new dependency is added for this (`timeago`/`intl` aren't in `pubspec.yaml` and pulling one in for a single label would be overkill) — a small pure function covers the four buckets the design needs.

- [ ] **Step 1: Write the failing tests**

Create `test/shared/utils/relative_time_test.dart`:

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:baber_mobile/shared/utils/relative_time.dart';

void main() {
  test('formats seconds/minutes as "agora"', () {
    final now = DateTime(2026, 1, 1, 12, 0, 0);
    expect(relativeTime(now.subtract(const Duration(seconds: 30)), now: now), 'agora');
  });

  test('formats hours as "há Xh"', () {
    final now = DateTime(2026, 1, 1, 12, 0, 0);
    expect(relativeTime(now.subtract(const Duration(hours: 2)), now: now), 'há 2h');
  });

  test('formats days as "há X dias"', () {
    final now = DateTime(2026, 1, 5, 12, 0, 0);
    expect(relativeTime(now.subtract(const Duration(days: 3)), now: now), 'há 3 dias');
  });

  test('formats more than 30 days as a date', () {
    final now = DateTime(2026, 2, 1, 12, 0, 0);
    final past = DateTime(2026, 1, 1, 12, 0, 0);
    expect(relativeTime(past, now: now), '01/01/2026');
  });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `flutter test test/shared/utils/relative_time_test.dart`
Expected: FAIL with "Target of URI doesn't exist"

- [ ] **Step 3: Implement**

Create `lib/shared/utils/relative_time.dart`:

```dart
String relativeTime(DateTime dateTime, {DateTime? now}) {
  final reference = now ?? DateTime.now();
  final diff = reference.difference(dateTime);

  if (diff.inMinutes < 1) return 'agora';
  if (diff.inHours < 1) return 'há ${diff.inMinutes} min';
  if (diff.inHours < 24) return 'há ${diff.inHours}h';
  if (diff.inDays < 30) return 'há ${diff.inDays} dias';

  final d = dateTime.day.toString().padLeft(2, '0');
  final m = dateTime.month.toString().padLeft(2, '0');
  return '$d/$m/${dateTime.year}';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `flutter test test/shared/utils/relative_time_test.dart`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/shared/utils/relative_time.dart test/shared/utils/relative_time_test.dart
git commit -m "feat(shared): add relativeTime formatting helper"
```

---

## Task 4: `NotificationsScreen`

**Files:**
- Create: `lib/features/notifications/presentation/notifications_screen.dart`
- Test: `test/features/notifications/presentation/notifications_screen_test.dart`

- [ ] **Step 1: Write the failing tests**

Create `test/features/notifications/presentation/notifications_screen_test.dart`:

```dart
import 'package:bloc_test/bloc_test.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:baber_mobile/features/notifications/domain/notification_item.dart';
import 'package:baber_mobile/features/notifications/presentation/notifications_bloc.dart';
import 'package:baber_mobile/features/notifications/presentation/notifications_event.dart';
import 'package:baber_mobile/features/notifications/presentation/notifications_screen.dart';
import 'package:baber_mobile/features/notifications/presentation/notifications_state.dart';

class MockNotificationsBloc extends MockBloc<NotificationsEvent, NotificationsState>
    implements NotificationsBloc {}

void main() {
  late MockNotificationsBloc bloc;

  setUpAll(() {
    registerFallbackValue(LoadNotifications());
  });

  setUp(() {
    bloc = MockNotificationsBloc();
  });

  Widget wrap(Widget child) => MaterialApp(
        home: BlocProvider<NotificationsBloc>.value(value: bloc, child: child),
      );

  testWidgets('dispatches LoadNotifications on init', (tester) async {
    whenListen(bloc, const Stream<NotificationsState>.empty(), initialState: const NotificationsState.initial());

    await tester.pumpWidget(wrap(const NotificationsScreen()));

    verify(() => bloc.add(LoadNotifications())).called(1);
  });

  testWidgets('renders notification message', (tester) async {
    final item = NotificationItem(
      appointmentId: 'appt-1', type: NotificationItemType.confirmation,
      message: 'Confirmado!', status: 'SENT', sentAt: DateTime.now(), createdAt: DateTime.now(),
    );
    whenListen(bloc, const Stream<NotificationsState>.empty(), initialState: NotificationsState.loaded([item]));

    await tester.pumpWidget(wrap(const NotificationsScreen()));

    expect(find.text('Confirmado!'), findsOneWidget);
  });

  testWidgets('shows empty message when there are no notifications', (tester) async {
    whenListen(bloc, const Stream<NotificationsState>.empty(), initialState: const NotificationsState.loaded([]));

    await tester.pumpWidget(wrap(const NotificationsScreen()));

    expect(find.text('Nenhuma notificação ainda.'), findsOneWidget);
  });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `flutter test test/features/notifications/presentation/notifications_screen_test.dart`
Expected: FAIL with "Target of URI doesn't exist"

- [ ] **Step 3: Implement**

Create `lib/features/notifications/presentation/notifications_screen.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../shared/utils/relative_time.dart';
import '../domain/notification_item.dart';
import 'notifications_bloc.dart';
import 'notifications_event.dart';
import 'notifications_state.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  @override
  void initState() {
    super.initState();
    context.read<NotificationsBloc>().add(LoadNotifications());
  }

  IconData _iconFor(NotificationItemType type) {
    switch (type) {
      case NotificationItemType.confirmation:
        return Icons.check_circle_outline;
      case NotificationItemType.cancellation:
        return Icons.cancel_outlined;
      case NotificationItemType.reminder:
        return Icons.alarm;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Notificações')),
      body: BlocConsumer<NotificationsBloc, NotificationsState>(
        listener: (context, state) {
          if (state.errorMessage != null) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text(state.errorMessage!)),
            );
          }
        },
        builder: (context, state) {
          if (state.isLoading) {
            return const Center(child: CircularProgressIndicator());
          }
          final items = state.items ?? [];
          if (items.isEmpty) {
            return const Center(child: Text('Nenhuma notificação ainda.'));
          }
          return ListView.builder(
            itemCount: items.length,
            itemBuilder: (context, index) {
              final item = items[index];
              return ListTile(
                leading: Icon(_iconFor(item.type)),
                title: Text(item.message),
                subtitle: Text(relativeTime(item.createdAt)),
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

Run: `flutter test test/features/notifications/presentation/notifications_screen_test.dart`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/features/notifications/presentation/notifications_screen.dart test/features/notifications/presentation/notifications_screen_test.dart
git commit -m "feat(notifications): add NotificationsScreen"
```

---

## Task 5: `HomeBloc` (profile name + next appointment)

**Files:**
- Create: `lib/features/home/presentation/home_event.dart`
- Create: `lib/features/home/presentation/home_state.dart`
- Create: `lib/features/home/presentation/home_bloc.dart`
- Test: `test/features/home/presentation/home_bloc_test.dart`

- [ ] **Step 1: Write the failing tests**

Create `test/features/home/presentation/home_bloc_test.dart`:

```dart
import 'package:bloc_test/bloc_test.dart';
import 'package:dartz/dartz.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:baber_mobile/features/appointments/domain/appointment.dart';
import 'package:baber_mobile/features/appointments/domain/appointment_repository.dart';
import 'package:baber_mobile/features/catalog/domain/service.dart';
import 'package:baber_mobile/features/catalog/domain/service_repository.dart';
import 'package:baber_mobile/features/home/presentation/home_bloc.dart';
import 'package:baber_mobile/features/home/presentation/home_event.dart';
import 'package:baber_mobile/features/home/presentation/home_state.dart';

class MockDio extends Mock implements Dio {}
class MockAppointmentRepository extends Mock implements AppointmentRepository {}
class MockServiceRepository extends Mock implements ServiceRepository {}

void main() {
  late MockDio dio;
  late MockAppointmentRepository appointmentRepository;
  late MockServiceRepository serviceRepository;

  const service = Service(id: 's1', name: 'Corte', priceInCents: 4000, durationMinutes: 30);
  final future = Appointment(
    id: 'appt-1', serviceId: 's1', date: '2999-01-01',
    startTime: '09:00', endTime: '09:30', status: AppointmentStatus.confirmed,
  );
  final past = Appointment(
    id: 'appt-2', serviceId: 's1', date: '2000-01-01',
    startTime: '09:00', endTime: '09:30', status: AppointmentStatus.completed,
  );

  setUp(() {
    dio = MockDio();
    appointmentRepository = MockAppointmentRepository();
    serviceRepository = MockServiceRepository();
  });

  blocTest<HomeBloc, HomeState>(
    'loads profile name and the earliest upcoming appointment',
    build: () {
      when(() => dio.get('/me')).thenAnswer((_) async => Response(
            requestOptions: RequestOptions(path: '/me'),
            statusCode: 200,
            data: {'name': 'João', 'phone': '+55'},
          ));
      when(() => appointmentRepository.listMine()).thenAnswer((_) async => Right([past, future]));
      when(() => serviceRepository.listServices()).thenAnswer((_) async => const Right([service]));
      return HomeBloc(dio: dio, appointmentRepository: appointmentRepository, serviceRepository: serviceRepository);
    },
    act: (bloc) => bloc.add(LoadHome()),
    expect: () => [
      const HomeState(isLoading: true),
      HomeState(userName: 'João', nextAppointment: future, nextAppointmentServiceName: 'Corte'),
    ],
  );

  blocTest<HomeBloc, HomeState>(
    'nextAppointment is null when there are no upcoming appointments',
    build: () {
      when(() => dio.get('/me')).thenAnswer((_) async => Response(
            requestOptions: RequestOptions(path: '/me'),
            statusCode: 200,
            data: {'name': 'João', 'phone': '+55'},
          ));
      when(() => appointmentRepository.listMine()).thenAnswer((_) async => Right([past]));
      when(() => serviceRepository.listServices()).thenAnswer((_) async => const Right([service]));
      return HomeBloc(dio: dio, appointmentRepository: appointmentRepository, serviceRepository: serviceRepository);
    },
    act: (bloc) => bloc.add(LoadHome()),
    expect: () => [
      const HomeState(isLoading: true),
      const HomeState(userName: 'João'),
    ],
  );
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `flutter test test/features/home/presentation/home_bloc_test.dart`
Expected: FAIL with "Target of URI doesn't exist"

- [ ] **Step 3: Implement**

Create `lib/features/home/presentation/home_event.dart`:

```dart
import 'package:equatable/equatable.dart';

sealed class HomeEvent extends Equatable {
  const HomeEvent();
  @override
  List<Object?> get props => [];
}

class LoadHome extends HomeEvent {}
```

Create `lib/features/home/presentation/home_state.dart`:

```dart
import 'package:equatable/equatable.dart';
import '../../appointments/domain/appointment.dart';

class HomeState extends Equatable {
  final String? userName;
  final Appointment? nextAppointment;
  final String? nextAppointmentServiceName;
  final bool isLoading;

  const HomeState({
    this.userName,
    this.nextAppointment,
    this.nextAppointmentServiceName,
    this.isLoading = false,
  });

  @override
  List<Object?> get props => [userName, nextAppointment, nextAppointmentServiceName, isLoading];
}
```

Create `lib/features/home/presentation/home_bloc.dart`:

```dart
import 'package:dio/dio.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../appointments/domain/appointment.dart';
import '../../appointments/domain/appointment_repository.dart';
import '../../catalog/domain/service_repository.dart';
import 'home_event.dart';
import 'home_state.dart';

class HomeBloc extends Bloc<HomeEvent, HomeState> {
  final Dio dio;
  final AppointmentRepository appointmentRepository;
  final ServiceRepository serviceRepository;

  HomeBloc({required this.dio, required this.appointmentRepository, required this.serviceRepository})
      : super(const HomeState()) {
    on<LoadHome>(_onLoad);
  }

  Future<void> _onLoad(LoadHome event, Emitter<HomeState> emit) async {
    emit(const HomeState(isLoading: true));

    final profileResponse = await dio.get('/me');
    final userName = (profileResponse.data as Map<String, dynamic>)['name'] as String?;

    final appointmentsResult = await appointmentRepository.listMine();
    final servicesResult = await serviceRepository.listServices();

    final appointments = appointmentsResult.fold((_) => <Appointment>[], (a) => a);
    final now = DateTime.now();
    final upcoming = appointments
        .where((a) =>
            a.status != AppointmentStatus.cancelled &&
            a.status != AppointmentStatus.completed &&
            DateTime.parse('${a.date}T${a.startTime}:00').isAfter(now))
        .toList()
      ..sort((a, b) =>
          DateTime.parse('${a.date}T${a.startTime}:00').compareTo(DateTime.parse('${b.date}T${b.startTime}:00')));

    final next = upcoming.isEmpty ? null : upcoming.first;
    final serviceNames = servicesResult.fold(
      (_) => <String, String>{},
      (services) => {for (final s in services) s.id: s.name},
    );

    emit(HomeState(
      userName: userName,
      nextAppointment: next,
      nextAppointmentServiceName: next == null ? null : serviceNames[next.serviceId],
    ));
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `flutter test test/features/home/presentation/home_bloc_test.dart`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/features/home/presentation/home_event.dart lib/features/home/presentation/home_state.dart lib/features/home/presentation/home_bloc.dart test/features/home/presentation/home_bloc_test.dart
git commit -m "feat(home): add HomeBloc loading profile name and next appointment"
```

---

## Task 6: `HomeScreen` becomes a dashboard

**Files:**
- Modify: `lib/features/home/presentation/home_screen.dart`
- Modify: `test/features/home/presentation/home_screen_test.dart`

- [ ] **Step 1: Replace the failing/outdated tests**

Replace the full contents of `test/features/home/presentation/home_screen_test.dart`:

```dart
import 'package:bloc_test/bloc_test.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mocktail/mocktail.dart';
import 'package:baber_mobile/core/auth/token_storage.dart';
import 'package:baber_mobile/core/tenancy/tenant_storage.dart';
import 'package:baber_mobile/features/appointments/domain/appointment.dart';
import 'package:baber_mobile/features/home/presentation/home_bloc.dart';
import 'package:baber_mobile/features/home/presentation/home_event.dart';
import 'package:baber_mobile/features/home/presentation/home_screen.dart';
import 'package:baber_mobile/features/home/presentation/home_state.dart';

class MockTokenStorage extends Mock implements TokenStorage {}
class MockTenantStorage extends Mock implements TenantStorage {}
class MockHomeBloc extends MockBloc<HomeEvent, HomeState> implements HomeBloc {}

void main() {
  late MockTokenStorage tokenStorage;
  late MockTenantStorage tenantStorage;
  late MockHomeBloc bloc;

  setUpAll(() {
    registerFallbackValue(LoadHome());
  });

  setUp(() {
    tokenStorage = MockTokenStorage();
    tenantStorage = MockTenantStorage();
    bloc = MockHomeBloc();
    when(() => tokenStorage.clear()).thenAnswer((_) async {});
    when(() => tenantStorage.clear()).thenAnswer((_) async {});
  });

  Future<GoRouter> pumpHome(WidgetTester tester) async {
    final router = GoRouter(
      initialLocation: '/home',
      routes: [
        GoRoute(
          path: '/home',
          builder: (context, state) => BlocProvider<HomeBloc>.value(
            value: bloc,
            child: HomeScreen(tokenStorage: tokenStorage, tenantStorage: tenantStorage),
          ),
        ),
        GoRoute(path: '/tenant-selection', builder: (context, state) => const Scaffold(body: Text('tenant selection'))),
        GoRoute(path: '/services', builder: (context, state) => const Scaffold(body: Text('services'))),
        GoRoute(path: '/appointments', builder: (context, state) => const Scaffold(body: Text('appointments'))),
        GoRoute(path: '/notifications', builder: (context, state) => const Scaffold(body: Text('notifications'))),
      ],
    );
    await tester.pumpWidget(MaterialApp.router(routerConfig: router));
    return router;
  }

  testWidgets('dispatches LoadHome on init', (tester) async {
    whenListen(bloc, const Stream<HomeState>.empty(), initialState: const HomeState());

    await pumpHome(tester);

    verify(() => bloc.add(LoadHome())).called(1);
  });

  testWidgets('renders welcome text with user name', (tester) async {
    whenListen(bloc, const Stream<HomeState>.empty(), initialState: const HomeState(userName: 'João'));

    await pumpHome(tester);

    expect(find.text('Bem-vindo, João'), findsOneWidget);
  });

  testWidgets('renders next appointment card when present', (tester) async {
    final appointment = Appointment(
      id: 'appt-1', serviceId: 's1', date: '2999-01-01',
      startTime: '09:00', endTime: '09:30', status: AppointmentStatus.confirmed,
    );
    whenListen(
      bloc,
      const Stream<HomeState>.empty(),
      initialState: HomeState(userName: 'João', nextAppointment: appointment, nextAppointmentServiceName: 'Corte'),
    );

    await pumpHome(tester);

    expect(find.textContaining('Corte'), findsOneWidget);
  });

  testWidgets('tapping shortcuts navigates to services/appointments/notifications', (tester) async {
    whenListen(bloc, const Stream<HomeState>.empty(), initialState: const HomeState(userName: 'João'));

    await pumpHome(tester);
    await tester.tap(find.text('Serviços'));
    await tester.pumpAndSettle();

    expect(find.text('services'), findsOneWidget);
  });

  testWidgets('tapping logout clears storages and navigates to tenant-selection', (tester) async {
    whenListen(bloc, const Stream<HomeState>.empty(), initialState: const HomeState(userName: 'João'));

    await pumpHome(tester);
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
Expected: FAIL — `HomeScreen` doesn't yet take a `HomeBloc` via context, still requires `userName` constructor param.

- [ ] **Step 3: Implement**

Replace the full contents of `lib/features/home/presentation/home_screen.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../core/auth/token_storage.dart';
import '../../../core/tenancy/tenant_storage.dart';
import 'home_bloc.dart';
import 'home_event.dart';
import 'home_state.dart';

class HomeScreen extends StatefulWidget {
  final TokenStorage tokenStorage;
  final TenantStorage tenantStorage;

  const HomeScreen({super.key, required this.tokenStorage, required this.tenantStorage});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  @override
  void initState() {
    super.initState();
    context.read<HomeBloc>().add(LoadHome());
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Início'),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () async {
              await widget.tokenStorage.clear();
              await widget.tenantStorage.clear();
              if (context.mounted) context.go('/tenant-selection');
            },
          ),
        ],
      ),
      body: BlocBuilder<HomeBloc, HomeState>(
        builder: (context, state) {
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Text('Bem-vindo, ${state.userName ?? ''}', style: Theme.of(context).textTheme.headlineSmall),
              const SizedBox(height: 16),
              if (state.nextAppointment != null)
                Card(
                  child: ListTile(
                    title: Text('Próxima consulta: ${state.nextAppointmentServiceName ?? ''}'),
                    subtitle: Text('${state.nextAppointment!.date} ${state.nextAppointment!.startTime}'),
                  ),
                ),
              const SizedBox(height: 24),
              ListTile(
                leading: const Icon(Icons.content_cut),
                title: const Text('Serviços'),
                onTap: () => context.push('/services'),
              ),
              ListTile(
                leading: const Icon(Icons.event),
                title: const Text('Minhas Consultas'),
                onTap: () => context.go('/appointments'),
              ),
              ListTile(
                leading: const Icon(Icons.notifications),
                title: const Text('Notificações'),
                onTap: () => context.go('/notifications'),
              ),
            ],
          );
        },
      ),
    );
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `flutter test test/features/home/presentation/home_screen_test.dart`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/features/home/presentation/home_screen.dart test/features/home/presentation/home_screen_test.dart
git commit -m "feat(home): turn HomeScreen into a dashboard with next appointment and shortcuts"
```

---

## Task 7: Bottom-nav shell (`StatefulShellRoute.indexedStack`)

**Files:**
- Create: `lib/shared/widgets/main_shell.dart`
- Modify: `lib/core/router/app_router.dart`
- Modify: `lib/baber_app.dart`
- Modify: `lib/main.dart`
- Modify: `test/widget_test.dart`

- [ ] **Step 1: Implement the bottom-nav shell widget**

Create `lib/shared/widgets/main_shell.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class MainShell extends StatelessWidget {
  final StatefulNavigationShell navigationShell;
  const MainShell({super.key, required this.navigationShell});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: navigationShell,
      bottomNavigationBar: NavigationBar(
        selectedIndex: navigationShell.currentIndex,
        onDestinationSelected: (index) => navigationShell.goBranch(
          index,
          initialLocation: index == navigationShell.currentIndex,
        ),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home), label: 'Início'),
          NavigationDestination(icon: Icon(Icons.event_outlined), selectedIcon: Icon(Icons.event), label: 'Consultas'),
          NavigationDestination(icon: Icon(Icons.notifications_outlined), selectedIcon: Icon(Icons.notifications), label: 'Notificações'),
        ],
      ),
    );
  }
}
```

- [ ] **Step 2: Replace `/home`, `/appointments`, `/notifications` with a `StatefulShellRoute`**

In `app_router.dart`, add the imports:

```dart
import '../../features/notifications/domain/notifications_repository.dart';
import '../../features/notifications/presentation/notifications_bloc.dart';
import '../../features/notifications/presentation/notifications_screen.dart';
import '../../features/home/presentation/home_bloc.dart';
import '../../shared/widgets/main_shell.dart';
```

Add `notificationsRepository` and `dio` (if not already added by the catalog-booking plan — `dio` was added there for `/me` in the booking confirm screen) to `buildAppRouter`'s parameters.

Replace the standalone `/home` `GoRoute` (and, if the previous plans placed `/appointments` as a standalone `GoRoute`, remove that too — it moves into this shell) with:

```dart
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) => MainShell(navigationShell: navigationShell),
        branches: [
          StatefulShellBranch(routes: [
            GoRoute(
              path: '/home',
              builder: (context, state) => BlocProvider(
                create: (_) => HomeBloc(
                  dio: dio,
                  appointmentRepository: appointmentRepository,
                  serviceRepository: serviceRepository,
                ),
                child: HomeScreen(tokenStorage: tokenStorage, tenantStorage: tenantStorage),
              ),
            ),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(
              path: '/appointments',
              builder: (context, state) => BlocProvider(
                create: (_) => MyAppointmentsBloc(
                  appointmentRepository: appointmentRepository,
                  serviceRepository: serviceRepository,
                ),
                child: const MyAppointmentsScreen(),
              ),
            ),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(
              path: '/notifications',
              builder: (context, state) => BlocProvider(
                create: (_) => NotificationsBloc(repository: notificationsRepository),
                child: const NotificationsScreen(),
              ),
            ),
          ]),
        ],
      ),
```

`/services` and the `/booking/*` `ShellRoute` stay exactly where the catalog-booking plan put them — as top-level routes, reached via `context.push(...)` from `HomeScreen`, so they stack on top of the bottom-nav shell rather than replacing it (matching the design's "Serviços acessado a partir do Início, não é aba").

- [ ] **Step 3: Update `BaberApp`, `main.dart`, and the stale root widget test**

In `main.dart`, add:

```dart
  final notificationsRepository = NotificationsRepositoryImpl(apiClient.dio);
```

with import `import 'features/notifications/data/notifications_repository_impl.dart';`, threaded through `BaberApp` into `buildAppRouter` alongside the other repositories.

Update `test/widget_test.dart`'s single test — since `/home` is now nested in a `StatefulShellRoute`, the boot destination assertion (`'Escolha a barbearia'` when no session exists) is unaffected, but if the test also exercises the authenticated path, adjust any `find.text(...)` that referenced the old plain `HomeScreen` welcome text to match `'Bem-vindo, '` with no name (since `/me` isn't stubbed in that root test — check the existing mocks and stub `dio.get('/me')` on the `MockAppLinks`-adjacent mock setup, or add a `MockDio` there if the test reaches `/home`). If the existing test only reaches `/tenant-selection` (as the file currently does per the auth-ui plan), no change is needed.

- [ ] **Step 4: Run the full test suite + analyze**

Run: `flutter test`
Expected: PASS

Run: `flutter analyze`
Expected: "No issues found!"

- [ ] **Step 5: Commit**

```bash
git add lib/shared/widgets/main_shell.dart lib/core/router/app_router.dart lib/baber_app.dart lib/main.dart test/widget_test.dart
git commit -m "feat(nav): switch to bottom-nav StatefulShellRoute for Início/Consultas/Notificações"
```

---

## Task 8: Manual smoke check

- [ ] **Step 1: Run the app against a local backend**

Ensure all three backend plans and the two prior mobile plans are applied. Run: `flutter run`.

Manually verify: logging in lands on Início with a bottom nav bar showing 3 tabs; the welcome name loads from the real profile; booking an appointment (via Início → Serviços) and returning shows it as the next-appointment card on Início and in the Consultas tab; the Notificações tab shows the confirmation message sent for that booking; switching tabs preserves each tab's scroll/state (`IndexedStack` behavior); logout still returns to tenant selection.

- [ ] **Step 2: Note results**

Report what was actually observed — don't claim the full flow works unless it was actually exercised against a running backend.
