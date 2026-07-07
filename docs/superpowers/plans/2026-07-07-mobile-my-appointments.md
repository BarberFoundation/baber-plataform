# Mobile Minhas Consultas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **IMPORTANT:** Do NOT add `Co-Authored-By` trailers to any commit message.
>
> **Depends on:** `docs/superpowers/plans/2026-07-07-scheduling-my-appointments.md` (backend `GET /appointments/my` and `PATCH /:id/cancel` ownership check), `docs/superpowers/plans/2026-07-07-mobile-catalog-booking.md` (reuses the `catalog` feature's `ServiceRepository` to resolve service names).

**Goal:** Customer can see their upcoming and past appointments, and cancel a future one that hasn't started yet.

**Architecture:** New `appointments` feature: `Appointment` domain entity, `AppointmentRepository` (list mine, cancel), `MyAppointmentsBloc` that loads appointments and the tenant's services in parallel (to resolve `serviceId` → service name for display, avoiding a backend join), and `MyAppointmentsScreen` with pull-to-refresh and a status-grouped list (Próximas / Histórico).

**Tech Stack:** Flutter, `flutter_bloc`, `go_router`, `dio`, `dartz`. Tests: `flutter_test`, `bloc_test`, `mocktail`.

**Repo:** `C:\Users\gabry\Documents\baber-mobile`.

**Design ref:** `docs/superpowers/specs/2026-07-07-mobile-app-full-design.md` §6.

---

## Task 1: `Appointment` domain entity + repository port

**Files:**
- Create: `lib/features/appointments/domain/appointment.dart`
- Create: `lib/features/appointments/domain/appointment_repository.dart`

- [ ] **Step 1: Implement**

Create `lib/features/appointments/domain/appointment.dart`:

```dart
import 'package:equatable/equatable.dart';

enum AppointmentStatus { pending, confirmed, completed, cancelled }

AppointmentStatus appointmentStatusFromString(String value) {
  switch (value) {
    case 'PENDING':
      return AppointmentStatus.pending;
    case 'CONFIRMED':
      return AppointmentStatus.confirmed;
    case 'COMPLETED':
      return AppointmentStatus.completed;
    case 'CANCELLED':
      return AppointmentStatus.cancelled;
    default:
      throw ArgumentError('Unknown appointment status: $value');
  }
}

class Appointment extends Equatable {
  final String id;
  final String serviceId;
  final String date;
  final String startTime;
  final String endTime;
  final AppointmentStatus status;

  const Appointment({
    required this.id,
    required this.serviceId,
    required this.date,
    required this.startTime,
    required this.endTime,
    required this.status,
  });

  factory Appointment.fromJson(Map<String, dynamic> json) => Appointment(
        id: json['id'] as String,
        serviceId: json['serviceId'] as String,
        date: json['date'] as String,
        startTime: json['startTime'] as String,
        endTime: json['endTime'] as String,
        status: appointmentStatusFromString(json['status'] as String),
      );

  bool get isCancellable {
    if (status != AppointmentStatus.pending && status != AppointmentStatus.confirmed) return false;
    final startsAt = DateTime.parse('${date}T$startTime:00');
    return startsAt.isAfter(DateTime.now());
  }

  @override
  List<Object?> get props => [id, serviceId, date, startTime, endTime, status];
}
```

- [ ] **Step 2: Implement the repository port**

Create `lib/features/appointments/domain/appointment_repository.dart`:

```dart
import 'package:dartz/dartz.dart';
import '../../../core/error/failure.dart';
import 'appointment.dart';

abstract class AppointmentRepository {
  Future<Either<Failure, List<Appointment>>> listMine();
  Future<Either<Failure, void>> cancel(String id);
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/features/appointments/domain/appointment.dart lib/features/appointments/domain/appointment_repository.dart
git commit -m "feat(appointments): add Appointment entity and repository port"
```

---

## Task 2: `AppointmentRepositoryImpl`

**Files:**
- Create: `lib/features/appointments/data/appointment_repository_impl.dart`
- Test: `test/features/appointments/data/appointment_repository_impl_test.dart`

- [ ] **Step 1: Write the failing tests**

Create `test/features/appointments/data/appointment_repository_impl_test.dart`:

```dart
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:baber_mobile/core/error/failure.dart';
import 'package:baber_mobile/features/appointments/data/appointment_repository_impl.dart';

class MockDio extends Mock implements Dio {}

void main() {
  late MockDio dio;
  late AppointmentRepositoryImpl repository;

  setUp(() {
    dio = MockDio();
    repository = AppointmentRepositoryImpl(dio);
  });

  test('listMine returns Right with parsed appointments on 200', () async {
    when(() => dio.get('/appointments/my')).thenAnswer((_) async => Response(
          requestOptions: RequestOptions(path: '/appointments/my'),
          statusCode: 200,
          data: [
            {
              'id': 'appt-1', 'serviceId': 's1', 'date': '2026-08-01',
              'startTime': '09:00', 'endTime': '09:30', 'status': 'PENDING',
            },
          ],
        ));

    final result = await repository.listMine();

    result.fold((_) => fail('expected right'), (appointments) {
      expect(appointments, hasLength(1));
      expect(appointments[0].id, 'appt-1');
    });
  });

  test('cancel returns Right(null) on 204', () async {
    when(() => dio.patch('/appointments/appt-1/cancel')).thenAnswer((_) async => Response(
          requestOptions: RequestOptions(path: '/appointments/appt-1/cancel'),
          statusCode: 204,
        ));

    final result = await repository.cancel('appt-1');

    expect(result.isRight(), isTrue);
  });

  test('cancel maps 403 to ApiFailure', () async {
    when(() => dio.patch('/appointments/appt-1/cancel')).thenThrow(DioException(
      requestOptions: RequestOptions(path: '/appointments/appt-1/cancel'),
      response: Response(
        requestOptions: RequestOptions(path: '/appointments/appt-1/cancel'),
        statusCode: 403,
        data: {'message': 'Você não pode cancelar este agendamento.'},
      ),
    ));

    final result = await repository.cancel('appt-1');

    result.fold((failure) {
      expect(failure, isA<ApiFailure>());
      expect((failure as ApiFailure).statusCode, 403);
    }, (_) => fail('expected left'));
  });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `flutter test test/features/appointments/data/appointment_repository_impl_test.dart`
Expected: FAIL with "Target of URI doesn't exist"

- [ ] **Step 3: Implement**

Create `lib/features/appointments/data/appointment_repository_impl.dart`:

```dart
import 'package:dartz/dartz.dart';
import 'package:dio/dio.dart';
import '../../../core/error/failure.dart';
import '../domain/appointment.dart';
import '../domain/appointment_repository.dart';

class AppointmentRepositoryImpl implements AppointmentRepository {
  final Dio _dio;
  const AppointmentRepositoryImpl(this._dio);

  @override
  Future<Either<Failure, List<Appointment>>> listMine() async {
    try {
      final response = await _dio.get('/appointments/my');
      final appointments = (response.data as List)
          .map((json) => Appointment.fromJson(json as Map<String, dynamic>))
          .toList();
      return Right(appointments);
    } on DioException catch (e) {
      return Left(_mapError(e));
    }
  }

  @override
  Future<Either<Failure, void>> cancel(String id) async {
    try {
      await _dio.patch('/appointments/$id/cancel');
      return const Right(null);
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

Run: `flutter test test/features/appointments/data/appointment_repository_impl_test.dart`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/features/appointments/data/appointment_repository_impl.dart test/features/appointments/data/appointment_repository_impl_test.dart
git commit -m "feat(appointments): add AppointmentRepositoryImpl"
```

---

## Task 3: `MyAppointmentsBloc`

**Files:**
- Create: `lib/features/appointments/presentation/my_appointments_event.dart`
- Create: `lib/features/appointments/presentation/my_appointments_state.dart`
- Create: `lib/features/appointments/presentation/my_appointments_bloc.dart`
- Test: `test/features/appointments/presentation/my_appointments_bloc_test.dart`

- [ ] **Step 1: Write the failing tests**

Create `test/features/appointments/presentation/my_appointments_bloc_test.dart`:

```dart
import 'package:bloc_test/bloc_test.dart';
import 'package:dartz/dartz.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:baber_mobile/core/error/failure.dart';
import 'package:baber_mobile/features/appointments/domain/appointment.dart';
import 'package:baber_mobile/features/appointments/domain/appointment_repository.dart';
import 'package:baber_mobile/features/appointments/presentation/my_appointments_bloc.dart';
import 'package:baber_mobile/features/appointments/presentation/my_appointments_event.dart';
import 'package:baber_mobile/features/appointments/presentation/my_appointments_state.dart';
import 'package:baber_mobile/features/catalog/domain/service.dart';
import 'package:baber_mobile/features/catalog/domain/service_repository.dart';

class MockAppointmentRepository extends Mock implements AppointmentRepository {}
class MockServiceRepository extends Mock implements ServiceRepository {}

void main() {
  late MockAppointmentRepository appointmentRepository;
  late MockServiceRepository serviceRepository;

  const appointment = Appointment(
    id: 'appt-1', serviceId: 's1', date: '2026-08-01',
    startTime: '09:00', endTime: '09:30', status: AppointmentStatus.pending,
  );
  const service = Service(id: 's1', name: 'Corte', priceInCents: 4000, durationMinutes: 30);

  setUp(() {
    appointmentRepository = MockAppointmentRepository();
    serviceRepository = MockServiceRepository();
  });

  blocTest<MyAppointmentsBloc, MyAppointmentsState>(
    'emits [loading, loaded] with a serviceId->name map on LoadMyAppointments',
    build: () {
      when(() => appointmentRepository.listMine()).thenAnswer((_) async => const Right([appointment]));
      when(() => serviceRepository.listServices()).thenAnswer((_) async => const Right([service]));
      return MyAppointmentsBloc(
        appointmentRepository: appointmentRepository,
        serviceRepository: serviceRepository,
      );
    },
    act: (bloc) => bloc.add(LoadMyAppointments()),
    expect: () => [
      const MyAppointmentsState.loading(),
      const MyAppointmentsState.loaded(
        appointments: [appointment],
        serviceNames: {'s1': 'Corte'},
      ),
    ],
  );

  blocTest<MyAppointmentsBloc, MyAppointmentsState>(
    'emits error when appointments fail to load',
    build: () {
      when(() => appointmentRepository.listMine())
          .thenAnswer((_) async => const Left(ApiFailure(statusCode: 500, message: 'erro interno')));
      when(() => serviceRepository.listServices()).thenAnswer((_) async => const Right([service]));
      return MyAppointmentsBloc(
        appointmentRepository: appointmentRepository,
        serviceRepository: serviceRepository,
      );
    },
    act: (bloc) => bloc.add(LoadMyAppointments()),
    expect: () => [
      const MyAppointmentsState.loading(),
      const MyAppointmentsState.error('erro interno'),
    ],
  );

  blocTest<MyAppointmentsBloc, MyAppointmentsState>(
    'CancelAppointmentRequested cancels then reloads the list',
    build: () {
      when(() => appointmentRepository.cancel('appt-1')).thenAnswer((_) async => const Right(null));
      when(() => appointmentRepository.listMine()).thenAnswer((_) async => const Right([]));
      when(() => serviceRepository.listServices()).thenAnswer((_) async => const Right([service]));
      return MyAppointmentsBloc(
        appointmentRepository: appointmentRepository,
        serviceRepository: serviceRepository,
      );
    },
    seed: () => const MyAppointmentsState.loaded(appointments: [appointment], serviceNames: {'s1': 'Corte'}),
    act: (bloc) => bloc.add(const CancelAppointmentRequested('appt-1')),
    expect: () => [
      const MyAppointmentsState.loading(),
      const MyAppointmentsState.loaded(appointments: [], serviceNames: {'s1': 'Corte'}),
    ],
    verify: (_) {
      verify(() => appointmentRepository.cancel('appt-1')).called(1);
    },
  );
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `flutter test test/features/appointments/presentation/my_appointments_bloc_test.dart`
Expected: FAIL with "Target of URI doesn't exist"

- [ ] **Step 3: Implement**

Create `lib/features/appointments/presentation/my_appointments_event.dart`:

```dart
import 'package:equatable/equatable.dart';

sealed class MyAppointmentsEvent extends Equatable {
  const MyAppointmentsEvent();
  @override
  List<Object?> get props => [];
}

class LoadMyAppointments extends MyAppointmentsEvent {}

class CancelAppointmentRequested extends MyAppointmentsEvent {
  final String appointmentId;
  const CancelAppointmentRequested(this.appointmentId);
  @override
  List<Object?> get props => [appointmentId];
}
```

Create `lib/features/appointments/presentation/my_appointments_state.dart`:

```dart
import 'package:equatable/equatable.dart';
import '../domain/appointment.dart';

class MyAppointmentsState extends Equatable {
  final List<Appointment>? appointments;
  final Map<String, String> serviceNames;
  final String? errorMessage;
  final bool isLoading;

  const MyAppointmentsState({
    this.appointments,
    this.serviceNames = const {},
    this.errorMessage,
    this.isLoading = false,
  });

  const MyAppointmentsState.initial() : this();
  const MyAppointmentsState.loading() : this(isLoading: true);
  const MyAppointmentsState.loaded({required List<Appointment> appointments, required Map<String, String> serviceNames})
      : this(appointments: appointments, serviceNames: serviceNames);
  const MyAppointmentsState.error(String message) : this(errorMessage: message);

  @override
  List<Object?> get props => [appointments, serviceNames, errorMessage, isLoading];
}
```

Create `lib/features/appointments/presentation/my_appointments_bloc.dart`:

```dart
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/error/failure_message.dart';
import '../../catalog/domain/service_repository.dart';
import '../domain/appointment.dart';
import '../domain/appointment_repository.dart';
import 'my_appointments_event.dart';
import 'my_appointments_state.dart';

class MyAppointmentsBloc extends Bloc<MyAppointmentsEvent, MyAppointmentsState> {
  final AppointmentRepository appointmentRepository;
  final ServiceRepository serviceRepository;

  MyAppointmentsBloc({required this.appointmentRepository, required this.serviceRepository})
      : super(const MyAppointmentsState.initial()) {
    on<LoadMyAppointments>(_onLoad);
    on<CancelAppointmentRequested>(_onCancel);
  }

  Future<void> _onLoad(LoadMyAppointments event, Emitter<MyAppointmentsState> emit) async {
    emit(const MyAppointmentsState.loading());
    final appointmentsResult = await appointmentRepository.listMine();
    final servicesResult = await serviceRepository.listServices();

    List<Appointment>? appointments;
    String? errorMsg;
    appointmentsResult.fold(
      (failure) => errorMsg = failureMessage(failure),
      (value) => appointments = value,
    );
    if (errorMsg != null) {
      emit(MyAppointmentsState.error(errorMsg!));
      return;
    }

    final serviceNames = servicesResult.fold(
      (_) => <String, String>{},
      (services) => {for (final s in services) s.id: s.name},
    );

    emit(MyAppointmentsState.loaded(appointments: appointments!, serviceNames: serviceNames));
  }

  Future<void> _onCancel(CancelAppointmentRequested event, Emitter<MyAppointmentsState> emit) async {
    emit(const MyAppointmentsState.loading());
    final result = await appointmentRepository.cancel(event.appointmentId);
    final failure = result.fold((f) => f, (_) => null);
    if (failure != null) {
      emit(MyAppointmentsState.error(failureMessage(failure)));
      return;
    }
    add(LoadMyAppointments());
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `flutter test test/features/appointments/presentation/my_appointments_bloc_test.dart`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/features/appointments/presentation/my_appointments_event.dart lib/features/appointments/presentation/my_appointments_state.dart lib/features/appointments/presentation/my_appointments_bloc.dart test/features/appointments/presentation/my_appointments_bloc_test.dart
git commit -m "feat(appointments): add MyAppointmentsBloc"
```

---

## Task 4: `MyAppointmentsScreen`

**Files:**
- Create: `lib/features/appointments/presentation/my_appointments_screen.dart`
- Test: `test/features/appointments/presentation/my_appointments_screen_test.dart`

- [ ] **Step 1: Write the failing tests**

Create `test/features/appointments/presentation/my_appointments_screen_test.dart`:

```dart
import 'package:bloc_test/bloc_test.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:baber_mobile/features/appointments/domain/appointment.dart';
import 'package:baber_mobile/features/appointments/presentation/my_appointments_bloc.dart';
import 'package:baber_mobile/features/appointments/presentation/my_appointments_event.dart';
import 'package:baber_mobile/features/appointments/presentation/my_appointments_screen.dart';
import 'package:baber_mobile/features/appointments/presentation/my_appointments_state.dart';

class MockMyAppointmentsBloc extends MockBloc<MyAppointmentsEvent, MyAppointmentsState>
    implements MyAppointmentsBloc {}

void main() {
  late MockMyAppointmentsBloc bloc;

  setUpAll(() {
    registerFallbackValue(LoadMyAppointments());
    registerFallbackValue(const CancelAppointmentRequested(''));
  });

  setUp(() {
    bloc = MockMyAppointmentsBloc();
  });

  Widget wrap(Widget child) => MaterialApp(
        home: BlocProvider<MyAppointmentsBloc>.value(value: bloc, child: child),
      );

  const future = Appointment(
    id: 'appt-1', serviceId: 's1', date: '2999-01-01',
    startTime: '09:00', endTime: '09:30', status: AppointmentStatus.confirmed,
  );
  const past = Appointment(
    id: 'appt-2', serviceId: 's1', date: '2000-01-01',
    startTime: '09:00', endTime: '09:30', status: AppointmentStatus.completed,
  );

  testWidgets('dispatches LoadMyAppointments on init', (tester) async {
    whenListen(bloc, const Stream<MyAppointmentsState>.empty(), initialState: const MyAppointmentsState.initial());

    await tester.pumpWidget(wrap(const MyAppointmentsScreen()));

    verify(() => bloc.add(LoadMyAppointments())).called(1);
  });

  testWidgets('splits appointments into Próximas and Histórico sections', (tester) async {
    whenListen(
      bloc,
      const Stream<MyAppointmentsState>.empty(),
      initialState: const MyAppointmentsState.loaded(appointments: [future, past], serviceNames: {'s1': 'Corte'}),
    );

    await tester.pumpWidget(wrap(const MyAppointmentsScreen()));

    expect(find.text('Próximas'), findsOneWidget);
    expect(find.text('Histórico'), findsOneWidget);
    expect(find.text('Corte'), findsNWidgets(2));
  });

  testWidgets('shows Cancelar button only for a cancellable future appointment', (tester) async {
    whenListen(
      bloc,
      const Stream<MyAppointmentsState>.empty(),
      initialState: const MyAppointmentsState.loaded(appointments: [future, past], serviceNames: {'s1': 'Corte'}),
    );

    await tester.pumpWidget(wrap(const MyAppointmentsScreen()));

    expect(find.text('Cancelar'), findsOneWidget);
  });

  testWidgets('tapping Cancelar then confirming dispatches CancelAppointmentRequested', (tester) async {
    whenListen(
      bloc,
      const Stream<MyAppointmentsState>.empty(),
      initialState: const MyAppointmentsState.loaded(appointments: [future], serviceNames: {'s1': 'Corte'}),
    );

    await tester.pumpWidget(wrap(const MyAppointmentsScreen()));
    await tester.tap(find.text('Cancelar'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Sim, cancelar'));
    await tester.pumpAndSettle();

    verify(() => bloc.add(const CancelAppointmentRequested('appt-1'))).called(1);
  });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `flutter test test/features/appointments/presentation/my_appointments_screen_test.dart`
Expected: FAIL with "Target of URI doesn't exist"

- [ ] **Step 3: Implement**

Create `lib/features/appointments/presentation/my_appointments_screen.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../domain/appointment.dart';
import 'my_appointments_bloc.dart';
import 'my_appointments_event.dart';
import 'my_appointments_state.dart';

class MyAppointmentsScreen extends StatefulWidget {
  const MyAppointmentsScreen({super.key});

  @override
  State<MyAppointmentsScreen> createState() => _MyAppointmentsScreenState();
}

class _MyAppointmentsScreenState extends State<MyAppointmentsScreen> {
  @override
  void initState() {
    super.initState();
    context.read<MyAppointmentsBloc>().add(LoadMyAppointments());
  }

  Color _statusColor(AppointmentStatus status) {
    switch (status) {
      case AppointmentStatus.pending:
        return Colors.amber;
      case AppointmentStatus.confirmed:
        return Colors.green;
      case AppointmentStatus.completed:
        return Colors.grey;
      case AppointmentStatus.cancelled:
        return Colors.red;
    }
  }

  Future<void> _confirmCancel(BuildContext context, String appointmentId) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Cancelar agendamento?'),
        content: const Text('Essa ação não pode ser desfeita.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialogContext, false), child: const Text('Voltar')),
          TextButton(onPressed: () => Navigator.pop(dialogContext, true), child: const Text('Sim, cancelar')),
        ],
      ),
    );
    if (confirmed == true && context.mounted) {
      context.read<MyAppointmentsBloc>().add(CancelAppointmentRequested(appointmentId));
    }
  }

  Widget _buildItem(BuildContext context, Appointment appointment, Map<String, String> serviceNames) {
    final serviceName = serviceNames[appointment.serviceId] ?? appointment.serviceId;
    return ListTile(
      title: Text(serviceName),
      subtitle: Text('${appointment.date} ${appointment.startTime}'),
      leading: CircleAvatar(backgroundColor: _statusColor(appointment.status), radius: 6),
      trailing: appointment.isCancellable
          ? TextButton(
              onPressed: () => _confirmCancel(context, appointment.id),
              child: const Text('Cancelar'),
            )
          : null,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Minhas Consultas')),
      body: BlocConsumer<MyAppointmentsBloc, MyAppointmentsState>(
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
          final appointments = state.appointments ?? [];
          final upcoming = appointments
              .where((a) =>
                  a.status != AppointmentStatus.cancelled &&
                  a.status != AppointmentStatus.completed &&
                  DateTime.parse('${a.date}T${a.startTime}:00').isAfter(DateTime.now()))
              .toList();
          final history = appointments.where((a) => !upcoming.contains(a)).toList();

          return RefreshIndicator(
            onRefresh: () async => context.read<MyAppointmentsBloc>().add(LoadMyAppointments()),
            child: ListView(
              children: [
                const Padding(padding: EdgeInsets.all(16), child: Text('Próximas', style: TextStyle(fontWeight: FontWeight.bold))),
                ...upcoming.map((a) => _buildItem(context, a, state.serviceNames)),
                const Padding(padding: EdgeInsets.all(16), child: Text('Histórico', style: TextStyle(fontWeight: FontWeight.bold))),
                ...history.map((a) => _buildItem(context, a, state.serviceNames)),
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

Run: `flutter test test/features/appointments/presentation/my_appointments_screen_test.dart`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/features/appointments/presentation/my_appointments_screen.dart test/features/appointments/presentation/my_appointments_screen_test.dart
git commit -m "feat(appointments): add MyAppointmentsScreen with cancel"
```

---

## Task 5: Wire `/appointments` route

**Files:**
- Modify: `lib/core/router/app_router.dart`
- Modify: `lib/baber_app.dart`
- Modify: `lib/main.dart`

- [ ] **Step 1: Add the route**

In `app_router.dart`, add imports:

```dart
import '../../features/appointments/domain/appointment_repository.dart';
import '../../features/appointments/presentation/my_appointments_bloc.dart';
import '../../features/appointments/presentation/my_appointments_screen.dart';
```

Add `appointmentRepository` to `buildAppRouter`'s parameters, and add the route (sibling of `/services`):

```dart
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
```

- [ ] **Step 2: Update `BaberApp` and `main.dart`**

In `main.dart`, add:

```dart
  final appointmentRepository = AppointmentRepositoryImpl(apiClient.dio);
```

with import `import 'features/appointments/data/appointment_repository_impl.dart';`, and thread it through `BaberApp` into `buildAppRouter` the same way `serviceRepository`/`bookingRepository` were threaded in the previous plan.

Also update `BookingSuccessScreen`'s `context.go('/appointments')` call (from the previous plan) — this route now exists, so no further change is needed there; just confirm it resolves.

- [ ] **Step 3: Run the full test suite + analyze**

Run: `flutter test`
Expected: PASS

Run: `flutter analyze`
Expected: "No issues found!"

- [ ] **Step 4: Commit**

```bash
git add lib/core/router/app_router.dart lib/baber_app.dart lib/main.dart
git commit -m "feat(appointments): wire /appointments route"
```

---

## Task 6: Manual smoke check

- [ ] **Step 1: Run the app against a local backend**

Run: `flutter run`. Book an appointment (via the booking flow from the previous plan), then navigate to `/appointments` (temporary debug entry point until the home-dashboard plan wires a proper nav button) and confirm it appears under "Próximas" with a working "Cancelar" button, and disappears from cancellable state (moves under "Histórico" with a red status dot) after confirming cancellation.

- [ ] **Step 2: Note results**

Report what was actually observed — don't claim the full flow works unless it was actually exercised against a running backend.
