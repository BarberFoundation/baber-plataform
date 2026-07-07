# Mobile Catálogo + Agendamento Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **IMPORTANT:** Do NOT add `Co-Authored-By` trailers to any commit message.
>
> **Depends on:** `docs/superpowers/plans/2026-07-07-scheduling-auto-assign.md` and `docs/superpowers/plans/2026-07-07-scheduling-my-appointments.md` (must be merged and deployed to the backend the mobile app points at — `POST /appointments` now requires login and `barberId` is optional).

**Goal:** Let a logged-in customer browse services and book an appointment without choosing a barber (backend auto-assigns), pre-filling their name/phone from their profile.

**Architecture:** New `catalog` feature (services list, read-only) and new `booking` feature (single `BookingBloc` driving a 4-screen flow: date → slots → confirm → success), following the existing repository/bloc/screen layering from `tenant_selection`. Backend gap: `GET /me` currently returns only `{userId, tenantId, role}` — needs `name`/`phone` so the booking form can pre-fill them (Task 1, small backend addition).

**Tech Stack:** Flutter, `flutter_bloc`, `go_router`, `dio`, `dartz` (Either). Tests: `flutter_test`, `bloc_test`, `mocktail`. Backend addition: NestJS 11, Jest.

**Repos:** `C:\Users\gabry\Documents\baber` (`apps/api`, Task 1 only), `C:\Users\gabry\Documents\baber-mobile` (everything else).

**Design ref:** `docs/superpowers/specs/2026-07-07-mobile-app-full-design.md` §4, §5.

---

## Task 1 (backend): `GET /me` returns name and phone

**Files:**
- Create: `apps/api/src/modules/identity/application/use-cases/get-user-profile.use-case.ts`
- Test: `apps/api/src/modules/identity/application/use-cases/get-user-profile.use-case.spec.ts`
- Modify: `apps/api/src/modules/identity/http/me.controller.ts`
- Modify: `apps/api/src/modules/identity/identity.module.ts`

- [ ] **Step 1: Write the failing test**

Create `get-user-profile.use-case.spec.ts`:

```ts
import { GetUserProfileUseCase } from './get-user-profile.use-case';
import { IUserRepository } from '../../domain/repositories/user.repository';
import { User } from '../../domain/entities/user.entity';
import { UserNotFoundError } from '../../domain/errors/identity.errors';

describe('GetUserProfileUseCase', () => {
  it('returns id, name, role, phone, email for an existing user', async () => {
    const user = User.reconstitute({
      id: 'user-1', tenantId: 'tenant-1', name: 'João', role: 'CLIENT',
      phone: '+5511999999999', email: null, firebaseUid: null,
      createdAt: new Date(), updatedAt: new Date(),
    });
    const repo: IUserRepository = {
      findByFirebaseUid: jest.fn(),
      findByPhone: jest.fn(),
      findById: jest.fn().mockResolvedValue(user),
      save: jest.fn(),
    };
    const uc = new GetUserProfileUseCase(repo);
    const result = await uc.execute({ userId: 'user-1', tenantId: 'tenant-1' });
    expect(result).toEqual({ id: 'user-1', name: 'João', role: 'CLIENT', phone: '+5511999999999', email: null });
  });

  it('throws UserNotFoundError when user does not exist', async () => {
    const repo: IUserRepository = {
      findByFirebaseUid: jest.fn(),
      findByPhone: jest.fn(),
      findById: jest.fn().mockResolvedValue(null),
      save: jest.fn(),
    };
    const uc = new GetUserProfileUseCase(repo);
    await expect(uc.execute({ userId: 'user-1', tenantId: 'tenant-1' })).rejects.toBeInstanceOf(UserNotFoundError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest apps/api/src/modules/identity/application/use-cases/get-user-profile.use-case.spec.ts`
Expected: FAIL — file doesn't exist yet.

- [ ] **Step 3: Implement**

Create `get-user-profile.use-case.ts`:

```ts
import { Injectable, Inject } from '@nestjs/common';
import { USER_REPOSITORY, IUserRepository } from '../../domain/repositories/user.repository';
import { UserNotFoundError } from '../../domain/errors/identity.errors';

export interface GetUserProfileInput {
  userId: string;
  tenantId: string;
}

export interface GetUserProfileOutput {
  id: string;
  name: string | null;
  role: string;
  phone: string | null;
  email: string | null;
}

@Injectable()
export class GetUserProfileUseCase {
  constructor(@Inject(USER_REPOSITORY) private readonly userRepo: IUserRepository) {}

  async execute(input: GetUserProfileInput): Promise<GetUserProfileOutput> {
    const user = await this.userRepo.findById(input.userId, input.tenantId);
    if (!user) throw new UserNotFoundError();
    return { id: user.id, name: user.name, role: user.role, phone: user.phone, email: user.email };
  }
}
```

(Check `apps/api/src/modules/identity/domain/errors/identity.errors.ts` first — `UserNotFoundError` should already exist there since `UpdateUserNameUseCase` doesn't reference it today but similarly-named errors exist for other identity flows; if it's genuinely missing, add `export class UserNotFoundError extends DomainError { readonly code = 'USER_NOT_FOUND'; constructor(message = 'Usuário não encontrado.') { super(message); } }` — `USER_NOT_FOUND` is already mapped to 404 in `domain-exception.filter.ts`.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest apps/api/src/modules/identity/application/use-cases/get-user-profile.use-case.spec.ts`
Expected: PASS

- [ ] **Step 5: Wire into `MeController` and the module**

In `me.controller.ts`, replace the `me()` handler:

```ts
@Controller('me')
export class MeController {
  constructor(
    private readonly updateUserNameUseCase: UpdateUserNameUseCase,
    private readonly getUserProfileUseCase: GetUserProfileUseCase,
  ) {}

  @Get()
  async me(@CurrentUser() user: JwtPayload) {
    return this.getUserProfileUseCase.execute({ userId: user.userId, tenantId: user.tenantId });
  }

  @Patch()
  async updateName(@CurrentUser() user: JwtPayload, @Body() dto: UpdateNameDto) {
    return this.updateUserNameUseCase.execute({
      userId: user.userId,
      tenantId: user.tenantId,
      name: dto.name,
    });
  }
}
```

Add the import: `import { GetUserProfileUseCase } from '../application/use-cases/get-user-profile.use-case';`

In `identity.module.ts`, add `GetUserProfileUseCase` to `providers` (next to `UpdateUserNameUseCase`).

- [ ] **Step 6: Run the full identity suite + typecheck**

Run: `npx jest apps/api/src/modules/identity`
Expected: PASS

Run: `cd apps/api && npx tsc --noEmit`
Expected: no type errors

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/identity/application/use-cases/get-user-profile.use-case.ts apps/api/src/modules/identity/application/use-cases/get-user-profile.use-case.spec.ts apps/api/src/modules/identity/http/me.controller.ts apps/api/src/modules/identity/identity.module.ts
git commit -m "feat(identity): GET /me returns name, phone and email"
```

---

## Task 2 (mobile): `Service` domain entity + repository port

**Files:**
- Create: `lib/features/catalog/domain/service.dart`
- Create: `lib/features/catalog/domain/service_repository.dart`

- [ ] **Step 1: Implement the entity**

Create `lib/features/catalog/domain/service.dart`:

```dart
import 'package:equatable/equatable.dart';

class Service extends Equatable {
  final String id;
  final String name;
  final String? description;
  final int priceInCents;
  final int durationMinutes;

  const Service({
    required this.id,
    required this.name,
    this.description,
    required this.priceInCents,
    required this.durationMinutes,
  });

  factory Service.fromJson(Map<String, dynamic> json) => Service(
        id: json['id'] as String,
        name: json['name'] as String,
        description: json['description'] as String?,
        priceInCents: json['priceInCents'] as int,
        durationMinutes: json['durationMinutes'] as int,
      );

  String get formattedPrice {
    final reais = priceInCents / 100;
    return 'R\$ ${reais.toStringAsFixed(2).replaceAll('.', ',')}';
  }

  @override
  List<Object?> get props => [id, name, description, priceInCents, durationMinutes];
}
```

- [ ] **Step 2: Implement the repository port**

Create `lib/features/catalog/domain/service_repository.dart`:

```dart
import 'package:dartz/dartz.dart';
import '../../../core/error/failure.dart';
import 'service.dart';

abstract class ServiceRepository {
  Future<Either<Failure, List<Service>>> listServices();
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/features/catalog/domain/service.dart lib/features/catalog/domain/service_repository.dart
git commit -m "feat(catalog): add Service entity and repository port"
```

---

## Task 3 (mobile): `ServiceRepositoryImpl`

**Files:**
- Create: `lib/features/catalog/data/service_repository_impl.dart`
- Test: `test/features/catalog/data/service_repository_impl_test.dart`

- [ ] **Step 1: Write the failing tests**

Create `test/features/catalog/data/service_repository_impl_test.dart`:

```dart
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:baber_mobile/core/error/failure.dart';
import 'package:baber_mobile/features/catalog/data/service_repository_impl.dart';

class MockDio extends Mock implements Dio {}

void main() {
  late MockDio dio;
  late ServiceRepositoryImpl repository;

  setUp(() {
    dio = MockDio();
    repository = ServiceRepositoryImpl(dio);
  });

  test('listServices returns Right with parsed services on 200', () async {
    when(() => dio.get('/services')).thenAnswer((_) async => Response(
          requestOptions: RequestOptions(path: '/services'),
          statusCode: 200,
          data: [
            {'id': 's1', 'name': 'Corte', 'description': null, 'priceInCents': 4000, 'durationMinutes': 30},
          ],
        ));

    final result = await repository.listServices();

    result.fold((_) => fail('expected right'), (services) {
      expect(services, hasLength(1));
      expect(services[0].name, 'Corte');
      expect(services[0].formattedPrice, 'R\$ 40,00');
    });
  });

  test('listServices maps DioException to ApiFailure', () async {
    when(() => dio.get('/services')).thenThrow(DioException(
      requestOptions: RequestOptions(path: '/services'),
      response: Response(
        requestOptions: RequestOptions(path: '/services'),
        statusCode: 500,
        data: {'message': 'erro interno'},
      ),
    ));

    final result = await repository.listServices();

    result.fold((failure) {
      expect(failure, isA<ApiFailure>());
      expect((failure as ApiFailure).statusCode, 500);
    }, (_) => fail('expected left'));
  });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `flutter test test/features/catalog/data/service_repository_impl_test.dart`
Expected: FAIL with "Target of URI doesn't exist"

- [ ] **Step 3: Implement**

Create `lib/features/catalog/data/service_repository_impl.dart`:

```dart
import 'package:dartz/dartz.dart';
import 'package:dio/dio.dart';
import '../../../core/error/failure.dart';
import '../domain/service.dart';
import '../domain/service_repository.dart';

class ServiceRepositoryImpl implements ServiceRepository {
  final Dio _dio;
  const ServiceRepositoryImpl(this._dio);

  @override
  Future<Either<Failure, List<Service>>> listServices() async {
    try {
      final response = await _dio.get('/services');
      final services = (response.data as List)
          .map((json) => Service.fromJson(json as Map<String, dynamic>))
          .toList();
      return Right(services);
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

Run: `flutter test test/features/catalog/data/service_repository_impl_test.dart`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/features/catalog/data/service_repository_impl.dart test/features/catalog/data/service_repository_impl_test.dart
git commit -m "feat(catalog): add ServiceRepositoryImpl"
```

---

## Task 4 (mobile): `ServicesBloc`

**Files:**
- Create: `lib/features/catalog/presentation/services_event.dart`
- Create: `lib/features/catalog/presentation/services_state.dart`
- Create: `lib/features/catalog/presentation/services_bloc.dart`
- Test: `test/features/catalog/presentation/services_bloc_test.dart`

- [ ] **Step 1: Write the failing tests**

Create `test/features/catalog/presentation/services_bloc_test.dart`:

```dart
import 'package:bloc_test/bloc_test.dart';
import 'package:dartz/dartz.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:baber_mobile/core/error/failure.dart';
import 'package:baber_mobile/features/catalog/domain/service.dart';
import 'package:baber_mobile/features/catalog/domain/service_repository.dart';
import 'package:baber_mobile/features/catalog/presentation/services_bloc.dart';
import 'package:baber_mobile/features/catalog/presentation/services_event.dart';
import 'package:baber_mobile/features/catalog/presentation/services_state.dart';

class MockServiceRepository extends Mock implements ServiceRepository {}

void main() {
  late MockServiceRepository repository;

  setUp(() {
    repository = MockServiceRepository();
  });

  const service = Service(id: 's1', name: 'Corte', priceInCents: 4000, durationMinutes: 30);

  blocTest<ServicesBloc, ServicesState>(
    'emits [loading, loaded] when LoadServices succeeds',
    build: () {
      when(() => repository.listServices()).thenAnswer((_) async => const Right([service]));
      return ServicesBloc(repository: repository);
    },
    act: (bloc) => bloc.add(LoadServices()),
    expect: () => [
      const ServicesState.loading(),
      const ServicesState.loaded([service]),
    ],
  );

  blocTest<ServicesBloc, ServicesState>(
    'emits [loading, error] when LoadServices fails',
    build: () {
      when(() => repository.listServices())
          .thenAnswer((_) async => const Left(ApiFailure(statusCode: 500, message: 'erro interno')));
      return ServicesBloc(repository: repository);
    },
    act: (bloc) => bloc.add(LoadServices()),
    expect: () => [
      const ServicesState.loading(),
      const ServicesState.error('erro interno'),
    ],
  );
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `flutter test test/features/catalog/presentation/services_bloc_test.dart`
Expected: FAIL with "Target of URI doesn't exist"

- [ ] **Step 3: Implement**

Create `lib/features/catalog/presentation/services_event.dart`:

```dart
import 'package:equatable/equatable.dart';

sealed class ServicesEvent extends Equatable {
  const ServicesEvent();
  @override
  List<Object?> get props => [];
}

class LoadServices extends ServicesEvent {}
```

Create `lib/features/catalog/presentation/services_state.dart`:

```dart
import 'package:equatable/equatable.dart';
import '../domain/service.dart';

class ServicesState extends Equatable {
  final List<Service>? services;
  final String? errorMessage;
  final bool isLoading;

  const ServicesState({this.services, this.errorMessage, this.isLoading = false});

  const ServicesState.initial() : this();
  const ServicesState.loading() : this(isLoading: true);
  const ServicesState.loaded(List<Service> services) : this(services: services);
  const ServicesState.error(String message) : this(errorMessage: message);

  @override
  List<Object?> get props => [services, errorMessage, isLoading];
}
```

Create `lib/features/catalog/presentation/services_bloc.dart`:

```dart
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/error/failure_message.dart';
import '../domain/service_repository.dart';
import 'services_event.dart';
import 'services_state.dart';

class ServicesBloc extends Bloc<ServicesEvent, ServicesState> {
  final ServiceRepository repository;

  ServicesBloc({required this.repository}) : super(const ServicesState.initial()) {
    on<LoadServices>(_onLoadServices);
  }

  Future<void> _onLoadServices(LoadServices event, Emitter<ServicesState> emit) async {
    emit(const ServicesState.loading());
    final result = await repository.listServices();
    result.fold(
      (failure) => emit(ServicesState.error(failureMessage(failure))),
      (services) => emit(ServicesState.loaded(services)),
    );
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `flutter test test/features/catalog/presentation/services_bloc_test.dart`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/features/catalog/presentation/services_event.dart lib/features/catalog/presentation/services_state.dart lib/features/catalog/presentation/services_bloc.dart test/features/catalog/presentation/services_bloc_test.dart
git commit -m "feat(catalog): add ServicesBloc"
```

---

## Task 5 (mobile): `ServicesListScreen`

**Files:**
- Create: `lib/features/catalog/presentation/services_list_screen.dart`
- Test: `test/features/catalog/presentation/services_list_screen_test.dart`

- [ ] **Step 1: Write the failing tests**

Create `test/features/catalog/presentation/services_list_screen_test.dart`:

```dart
import 'package:bloc_test/bloc_test.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:baber_mobile/features/catalog/domain/service.dart';
import 'package:baber_mobile/features/catalog/presentation/services_bloc.dart';
import 'package:baber_mobile/features/catalog/presentation/services_event.dart';
import 'package:baber_mobile/features/catalog/presentation/services_list_screen.dart';
import 'package:baber_mobile/features/catalog/presentation/services_state.dart';

class MockServicesBloc extends MockBloc<ServicesEvent, ServicesState> implements ServicesBloc {}

void main() {
  late MockServicesBloc bloc;

  setUpAll(() {
    registerFallbackValue(LoadServices());
  });

  setUp(() {
    bloc = MockServicesBloc();
  });

  Widget wrap(Widget child) => MaterialApp(
        home: BlocProvider<ServicesBloc>.value(value: bloc, child: child),
      );

  testWidgets('dispatches LoadServices on init', (tester) async {
    whenListen(bloc, const Stream<ServicesState>.empty(), initialState: const ServicesState.initial());

    await tester.pumpWidget(wrap(const ServicesListScreen()));

    verify(() => bloc.add(LoadServices())).called(1);
  });

  testWidgets('shows spinner while loading', (tester) async {
    whenListen(bloc, const Stream<ServicesState>.empty(), initialState: const ServicesState.loading());

    await tester.pumpWidget(wrap(const ServicesListScreen()));

    expect(find.byType(CircularProgressIndicator), findsOneWidget);
  });

  testWidgets('renders service list with name and formatted price', (tester) async {
    const service = Service(id: 's1', name: 'Corte', priceInCents: 4000, durationMinutes: 30);
    whenListen(bloc, const Stream<ServicesState>.empty(), initialState: const ServicesState.loaded([service]));

    await tester.pumpWidget(wrap(const ServicesListScreen()));

    expect(find.text('Corte'), findsOneWidget);
    expect(find.textContaining('R\$ 40,00'), findsOneWidget);
  });

  testWidgets('shows error SnackBar when errorMessage present', (tester) async {
    whenListen(
      bloc,
      Stream.fromIterable([const ServicesState.error('falha ao carregar')]),
      initialState: const ServicesState.initial(),
    );

    await tester.pumpWidget(wrap(const ServicesListScreen()));
    await tester.pump();

    expect(find.text('falha ao carregar'), findsOneWidget);
  });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `flutter test test/features/catalog/presentation/services_list_screen_test.dart`
Expected: FAIL with "Target of URI doesn't exist"

- [ ] **Step 3: Implement**

Create `lib/features/catalog/presentation/services_list_screen.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../domain/service.dart';
import 'services_bloc.dart';
import 'services_event.dart';
import 'services_state.dart';

class ServicesListScreen extends StatefulWidget {
  const ServicesListScreen({super.key});

  @override
  State<ServicesListScreen> createState() => _ServicesListScreenState();
}

class _ServicesListScreenState extends State<ServicesListScreen> {
  @override
  void initState() {
    super.initState();
    context.read<ServicesBloc>().add(LoadServices());
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Serviços')),
      body: BlocConsumer<ServicesBloc, ServicesState>(
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
          final services = state.services ?? [];
          return ListView.builder(
            itemCount: services.length,
            itemBuilder: (context, index) {
              final service = services[index];
              return ListTile(
                title: Text(service.name),
                subtitle: Text('${service.durationMinutes} min · ${service.formattedPrice}'),
                onTap: () => context.push('/booking/date', extra: service),
              );
            },
          );
        },
      ),
    );
  }
}
```

Note: `Service` is unused as an explicit import here beyond the type annotation implied by `extra: service` — keep the import since `service` is typed as `Service` from the loop variable.

- [ ] **Step 4: Run test to verify it passes**

Run: `flutter test test/features/catalog/presentation/services_list_screen_test.dart`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/features/catalog/presentation/services_list_screen.dart test/features/catalog/presentation/services_list_screen_test.dart
git commit -m "feat(catalog): add ServicesListScreen"
```

---

## Task 6 (mobile): `TimeSlot` + `BookingRepository`

**Files:**
- Create: `lib/features/booking/domain/time_slot.dart`
- Create: `lib/features/booking/domain/booking_repository.dart`

- [ ] **Step 1: Implement**

Create `lib/features/booking/domain/time_slot.dart`:

```dart
import 'package:equatable/equatable.dart';

class TimeSlot extends Equatable {
  final String startTime;
  final String endTime;
  const TimeSlot({required this.startTime, required this.endTime});

  factory TimeSlot.fromJson(Map<String, dynamic> json) => TimeSlot(
        startTime: json['startTime'] as String,
        endTime: json['endTime'] as String,
      );

  @override
  List<Object?> get props => [startTime, endTime];
}
```

Create `lib/features/booking/domain/booking_repository.dart`:

```dart
import 'package:dartz/dartz.dart';
import '../../../core/error/failure.dart';
import 'time_slot.dart';

abstract class BookingRepository {
  Future<Either<Failure, List<TimeSlot>>> getAvailableSlots({
    required String serviceId,
    required String date,
  });

  Future<Either<Failure, void>> bookAppointment({
    required String serviceId,
    required String clientName,
    required String clientPhone,
    required String date,
    required String startTime,
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/features/booking/domain/time_slot.dart lib/features/booking/domain/booking_repository.dart
git commit -m "feat(booking): add TimeSlot entity and BookingRepository port"
```

---

## Task 7 (mobile): `BookingRepositoryImpl`

**Files:**
- Create: `lib/features/booking/data/booking_repository_impl.dart`
- Test: `test/features/booking/data/booking_repository_impl_test.dart`

- [ ] **Step 1: Write the failing tests**

Create `test/features/booking/data/booking_repository_impl_test.dart`:

```dart
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:baber_mobile/core/error/failure.dart';
import 'package:baber_mobile/features/booking/data/booking_repository_impl.dart';

class MockDio extends Mock implements Dio {}

void main() {
  late MockDio dio;
  late BookingRepositoryImpl repository;

  setUp(() {
    dio = MockDio();
    repository = BookingRepositoryImpl(dio);
  });

  test('getAvailableSlots returns Right with parsed slots on 200', () async {
    when(() => dio.get('/appointments/available-slots', queryParameters: {
          'serviceId': 's1',
          'date': '2026-08-01',
        })).thenAnswer((_) async => Response(
          requestOptions: RequestOptions(path: '/appointments/available-slots'),
          statusCode: 200,
          data: [
            {'startTime': '09:00', 'endTime': '09:30'},
          ],
        ));

    final result = await repository.getAvailableSlots(serviceId: 's1', date: '2026-08-01');

    result.fold((_) => fail('expected right'), (slots) {
      expect(slots, hasLength(1));
      expect(slots[0].startTime, '09:00');
    });
  });

  test('bookAppointment posts without barberId and returns Right on 201', () async {
    when(() => dio.post('/appointments', data: {
          'serviceId': 's1',
          'clientName': 'João',
          'clientPhone': '+5511999999999',
          'date': '2026-08-01',
          'startTime': '09:00',
        })).thenAnswer((_) async => Response(
          requestOptions: RequestOptions(path: '/appointments'),
          statusCode: 201,
          data: {'id': 'appt-1'},
        ));

    final result = await repository.bookAppointment(
      serviceId: 's1',
      clientName: 'João',
      clientPhone: '+5511999999999',
      date: '2026-08-01',
      startTime: '09:00',
    );

    expect(result.isRight(), isTrue);
  });

  test('bookAppointment maps 409 (no barber available) to ApiFailure', () async {
    when(() => dio.post('/appointments', data: any(named: 'data'))).thenThrow(DioException(
      requestOptions: RequestOptions(path: '/appointments'),
      response: Response(
        requestOptions: RequestOptions(path: '/appointments'),
        statusCode: 409,
        data: {'message': 'Nenhum barbeiro disponível neste horário.'},
      ),
    ));

    final result = await repository.bookAppointment(
      serviceId: 's1',
      clientName: 'João',
      clientPhone: '+5511999999999',
      date: '2026-08-01',
      startTime: '09:00',
    );

    result.fold((failure) {
      expect(failure, isA<ApiFailure>());
      expect((failure as ApiFailure).statusCode, 409);
    }, (_) => fail('expected left'));
  });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `flutter test test/features/booking/data/booking_repository_impl_test.dart`
Expected: FAIL with "Target of URI doesn't exist"

- [ ] **Step 3: Implement**

Create `lib/features/booking/data/booking_repository_impl.dart`:

```dart
import 'package:dartz/dartz.dart';
import 'package:dio/dio.dart';
import '../../../core/error/failure.dart';
import '../domain/booking_repository.dart';
import '../domain/time_slot.dart';

class BookingRepositoryImpl implements BookingRepository {
  final Dio _dio;
  const BookingRepositoryImpl(this._dio);

  @override
  Future<Either<Failure, List<TimeSlot>>> getAvailableSlots({
    required String serviceId,
    required String date,
  }) async {
    try {
      final response = await _dio.get(
        '/appointments/available-slots',
        queryParameters: {'serviceId': serviceId, 'date': date},
      );
      final slots = (response.data as List)
          .map((json) => TimeSlot.fromJson(json as Map<String, dynamic>))
          .toList();
      return Right(slots);
    } on DioException catch (e) {
      return Left(_mapError(e));
    }
  }

  @override
  Future<Either<Failure, void>> bookAppointment({
    required String serviceId,
    required String clientName,
    required String clientPhone,
    required String date,
    required String startTime,
  }) async {
    try {
      await _dio.post('/appointments', data: {
        'serviceId': serviceId,
        'clientName': clientName,
        'clientPhone': clientPhone,
        'date': date,
        'startTime': startTime,
      });
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

Run: `flutter test test/features/booking/data/booking_repository_impl_test.dart`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/features/booking/data/booking_repository_impl.dart test/features/booking/data/booking_repository_impl_test.dart
git commit -m "feat(booking): add BookingRepositoryImpl"
```

---

## Task 8 (mobile): `BookingBloc`

**Files:**
- Create: `lib/features/booking/presentation/booking_event.dart`
- Create: `lib/features/booking/presentation/booking_state.dart`
- Create: `lib/features/booking/presentation/booking_bloc.dart`
- Test: `test/features/booking/presentation/booking_bloc_test.dart`

- [ ] **Step 1: Write the failing tests**

Create `test/features/booking/presentation/booking_bloc_test.dart`:

```dart
import 'package:bloc_test/bloc_test.dart';
import 'package:dartz/dartz.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:baber_mobile/core/error/failure.dart';
import 'package:baber_mobile/features/booking/domain/booking_repository.dart';
import 'package:baber_mobile/features/booking/domain/time_slot.dart';
import 'package:baber_mobile/features/booking/presentation/booking_bloc.dart';
import 'package:baber_mobile/features/booking/presentation/booking_event.dart';
import 'package:baber_mobile/features/booking/presentation/booking_state.dart';
import 'package:baber_mobile/features/catalog/domain/service.dart';

class MockBookingRepository extends Mock implements BookingRepository {}

void main() {
  late MockBookingRepository repository;
  const service = Service(id: 's1', name: 'Corte', priceInCents: 4000, durationMinutes: 30);

  setUp(() {
    repository = MockBookingRepository();
  });

  blocTest<BookingBloc, BookingState>(
    'DateSelected loads and emits available slots',
    build: () {
      when(() => repository.getAvailableSlots(serviceId: 's1', date: '2026-08-01'))
          .thenAnswer((_) async => const Right([TimeSlot(startTime: '09:00', endTime: '09:30')]));
      return BookingBloc(repository: repository, service: service);
    },
    act: (bloc) => bloc.add(const DateSelected('2026-08-01')),
    expect: () => [
      const BookingState(service: service, selectedDate: '2026-08-01', isLoading: true),
      const BookingState(
        service: service,
        selectedDate: '2026-08-01',
        slots: [TimeSlot(startTime: '09:00', endTime: '09:30')],
      ),
    ],
  );

  blocTest<BookingBloc, BookingState>(
    'SlotSelected updates selectedSlot',
    build: () => BookingBloc(repository: repository, service: service),
    act: (bloc) => bloc.add(const SlotSelected(TimeSlot(startTime: '09:00', endTime: '09:30'))),
    expect: () => [
      const BookingState(service: service, selectedSlot: TimeSlot(startTime: '09:00', endTime: '09:30')),
    ],
  );

  blocTest<BookingBloc, BookingState>(
    'BookingConfirmed books the appointment and emits success',
    build: () {
      when(() => repository.bookAppointment(
            serviceId: 's1',
            clientName: 'João',
            clientPhone: '+5511999999999',
            date: '2026-08-01',
            startTime: '09:00',
          )).thenAnswer((_) async => const Right(null));
      return BookingBloc(repository: repository, service: service)
        ..emit(const BookingState(
          service: service,
          selectedDate: '2026-08-01',
          selectedSlot: TimeSlot(startTime: '09:00', endTime: '09:30'),
        ));
    },
    act: (bloc) => bloc.add(const BookingConfirmed(clientName: 'João', clientPhone: '+5511999999999')),
    skip: 1,
    expect: () => [
      const BookingState(
        service: service,
        selectedDate: '2026-08-01',
        selectedSlot: TimeSlot(startTime: '09:00', endTime: '09:30'),
        isLoading: true,
      ),
      const BookingState(
        service: service,
        selectedDate: '2026-08-01',
        selectedSlot: TimeSlot(startTime: '09:00', endTime: '09:30'),
        bookingSucceeded: true,
      ),
    ],
  );

  blocTest<BookingBloc, BookingState>(
    'BookingConfirmed emits error message on failure (e.g. no barber available)',
    build: () {
      when(() => repository.bookAppointment(
            serviceId: 's1',
            clientName: 'João',
            clientPhone: '+5511999999999',
            date: '2026-08-01',
            startTime: '09:00',
          )).thenAnswer((_) async => const Left(ApiFailure(statusCode: 409, message: 'Nenhum barbeiro disponível.')));
      return BookingBloc(repository: repository, service: service)
        ..emit(const BookingState(
          service: service,
          selectedDate: '2026-08-01',
          selectedSlot: TimeSlot(startTime: '09:00', endTime: '09:30'),
        ));
    },
    act: (bloc) => bloc.add(const BookingConfirmed(clientName: 'João', clientPhone: '+5511999999999')),
    skip: 1,
    expect: () => [
      const BookingState(
        service: service,
        selectedDate: '2026-08-01',
        selectedSlot: TimeSlot(startTime: '09:00', endTime: '09:30'),
        isLoading: true,
      ),
      const BookingState(
        service: service,
        selectedDate: '2026-08-01',
        selectedSlot: TimeSlot(startTime: '09:00', endTime: '09:30'),
        errorMessage: 'Nenhum barbeiro disponível.',
      ),
    ],
  );
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `flutter test test/features/booking/presentation/booking_bloc_test.dart`
Expected: FAIL with "Target of URI doesn't exist"

- [ ] **Step 3: Implement**

Create `lib/features/booking/presentation/booking_event.dart`:

```dart
import 'package:equatable/equatable.dart';
import '../domain/time_slot.dart';

sealed class BookingEvent extends Equatable {
  const BookingEvent();
  @override
  List<Object?> get props => [];
}

class DateSelected extends BookingEvent {
  final String date;
  const DateSelected(this.date);
  @override
  List<Object?> get props => [date];
}

class SlotSelected extends BookingEvent {
  final TimeSlot slot;
  const SlotSelected(this.slot);
  @override
  List<Object?> get props => [slot];
}

class BookingConfirmed extends BookingEvent {
  final String clientName;
  final String clientPhone;
  const BookingConfirmed({required this.clientName, required this.clientPhone});
  @override
  List<Object?> get props => [clientName, clientPhone];
}
```

Create `lib/features/booking/presentation/booking_state.dart`:

```dart
import 'package:equatable/equatable.dart';
import '../../catalog/domain/service.dart';
import '../domain/time_slot.dart';

class BookingState extends Equatable {
  final Service service;
  final String? selectedDate;
  final List<TimeSlot>? slots;
  final TimeSlot? selectedSlot;
  final bool isLoading;
  final bool bookingSucceeded;
  final String? errorMessage;

  const BookingState({
    required this.service,
    this.selectedDate,
    this.slots,
    this.selectedSlot,
    this.isLoading = false,
    this.bookingSucceeded = false,
    this.errorMessage,
  });

  BookingState copyWith({
    String? selectedDate,
    List<TimeSlot>? slots,
    TimeSlot? selectedSlot,
    bool? isLoading,
    bool? bookingSucceeded,
    String? errorMessage,
  }) {
    return BookingState(
      service: service,
      selectedDate: selectedDate ?? this.selectedDate,
      slots: slots ?? this.slots,
      selectedSlot: selectedSlot ?? this.selectedSlot,
      isLoading: isLoading ?? false,
      bookingSucceeded: bookingSucceeded ?? false,
      errorMessage: errorMessage,
    );
  }

  @override
  List<Object?> get props =>
      [service, selectedDate, slots, selectedSlot, isLoading, bookingSucceeded, errorMessage];
}
```

Create `lib/features/booking/presentation/booking_bloc.dart`:

```dart
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/error/failure_message.dart';
import '../../catalog/domain/service.dart';
import '../domain/booking_repository.dart';
import 'booking_event.dart';
import 'booking_state.dart';

class BookingBloc extends Bloc<BookingEvent, BookingState> {
  final BookingRepository repository;

  BookingBloc({required this.repository, required Service service})
      : super(BookingState(service: service)) {
    on<DateSelected>(_onDateSelected);
    on<SlotSelected>(_onSlotSelected);
    on<BookingConfirmed>(_onBookingConfirmed);
  }

  Future<void> _onDateSelected(DateSelected event, Emitter<BookingState> emit) async {
    emit(state.copyWith(selectedDate: event.date, isLoading: true));
    final result = await repository.getAvailableSlots(serviceId: state.service.id, date: event.date);
    result.fold(
      (failure) => emit(state.copyWith(errorMessage: failureMessage(failure))),
      (slots) => emit(state.copyWith(slots: slots)),
    );
  }

  void _onSlotSelected(SlotSelected event, Emitter<BookingState> emit) {
    emit(state.copyWith(selectedSlot: event.slot));
  }

  Future<void> _onBookingConfirmed(BookingConfirmed event, Emitter<BookingState> emit) async {
    final slot = state.selectedSlot;
    final date = state.selectedDate;
    if (slot == null || date == null) return;

    emit(state.copyWith(isLoading: true));
    final result = await repository.bookAppointment(
      serviceId: state.service.id,
      clientName: event.clientName,
      clientPhone: event.clientPhone,
      date: date,
      startTime: slot.startTime,
    );
    result.fold(
      (failure) => emit(state.copyWith(errorMessage: failureMessage(failure))),
      (_) => emit(state.copyWith(bookingSucceeded: true)),
    );
  }
}
```

Note on `copyWith`: `isLoading` and `bookingSucceeded` always reset to `false` unless explicitly passed `true` in the same call — this mirrors the one-shot nature of loading/success flags (never "sticky" across unrelated state updates), consistent with how `errorMessage` is deliberately *not* preserved across calls that don't set it (each `copyWith` call either sets a fresh error or clears it), avoiding stale error banners after a subsequent successful action.

- [ ] **Step 4: Run test to verify it passes**

Run: `flutter test test/features/booking/presentation/booking_bloc_test.dart`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/features/booking/presentation/booking_event.dart lib/features/booking/presentation/booking_state.dart lib/features/booking/presentation/booking_bloc.dart test/features/booking/presentation/booking_bloc_test.dart
git commit -m "feat(booking): add BookingBloc"
```

---

## Task 9 (mobile): `DateSelectionScreen`

**Files:**
- Create: `lib/features/booking/presentation/date_selection_screen.dart`
- Test: `test/features/booking/presentation/date_selection_screen_test.dart`

- [ ] **Step 1: Write the failing tests**

Create `test/features/booking/presentation/date_selection_screen_test.dart`:

```dart
import 'package:bloc_test/bloc_test.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:baber_mobile/features/booking/presentation/booking_bloc.dart';
import 'package:baber_mobile/features/booking/presentation/booking_event.dart';
import 'package:baber_mobile/features/booking/presentation/booking_state.dart';
import 'package:baber_mobile/features/booking/presentation/date_selection_screen.dart';
import 'package:baber_mobile/features/catalog/domain/service.dart';

class MockBookingBloc extends MockBloc<BookingEvent, BookingState> implements BookingBloc {}

void main() {
  late MockBookingBloc bloc;
  const service = Service(id: 's1', name: 'Corte', priceInCents: 4000, durationMinutes: 30);

  setUpAll(() {
    registerFallbackValue(const DateSelected('2026-08-01'));
  });

  setUp(() {
    bloc = MockBookingBloc();
  });

  Widget wrap(Widget child) => MaterialApp(
        home: BlocProvider<BookingBloc>.value(value: bloc, child: child),
      );

  testWidgets('renders 30 selectable upcoming days', (tester) async {
    whenListen(bloc, const Stream<BookingState>.empty(), initialState: const BookingState(service: service));

    await tester.pumpWidget(wrap(const DateSelectionScreen()));

    expect(find.byType(ListTile), findsNWidgets(30));
  });

  testWidgets('tapping a day dispatches DateSelected', (tester) async {
    whenListen(bloc, const Stream<BookingState>.empty(), initialState: const BookingState(service: service));

    await tester.pumpWidget(wrap(const DateSelectionScreen()));
    await tester.tap(find.byType(ListTile).first);

    verify(() => bloc.add(any(that: isA<DateSelected>()))).called(1);
  });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `flutter test test/features/booking/presentation/date_selection_screen_test.dart`
Expected: FAIL with "Target of URI doesn't exist"

- [ ] **Step 3: Implement**

Create `lib/features/booking/presentation/date_selection_screen.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'booking_bloc.dart';
import 'booking_event.dart';

class DateSelectionScreen extends StatelessWidget {
  const DateSelectionScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final today = DateTime.now();
    final days = List.generate(30, (i) => today.add(Duration(days: i)));

    return Scaffold(
      appBar: AppBar(title: const Text('Escolha a data')),
      body: ListView.builder(
        itemCount: days.length,
        itemBuilder: (context, index) {
          final day = days[index];
          final iso = '${day.year.toString().padLeft(4, '0')}-'
              '${day.month.toString().padLeft(2, '0')}-'
              '${day.day.toString().padLeft(2, '0')}';
          return ListTile(
            title: Text('${day.day}/${day.month}/${day.year}'),
            onTap: () {
              context.read<BookingBloc>().add(DateSelected(iso));
              context.push('/booking/slots');
            },
          );
        },
      ),
    );
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `flutter test test/features/booking/presentation/date_selection_screen_test.dart`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/features/booking/presentation/date_selection_screen.dart test/features/booking/presentation/date_selection_screen_test.dart
git commit -m "feat(booking): add DateSelectionScreen"
```

---

## Task 10 (mobile): `SlotSelectionScreen`

**Files:**
- Create: `lib/features/booking/presentation/slot_selection_screen.dart`
- Test: `test/features/booking/presentation/slot_selection_screen_test.dart`

- [ ] **Step 1: Write the failing tests**

Create `test/features/booking/presentation/slot_selection_screen_test.dart`:

```dart
import 'package:bloc_test/bloc_test.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:baber_mobile/features/booking/domain/time_slot.dart';
import 'package:baber_mobile/features/booking/presentation/booking_bloc.dart';
import 'package:baber_mobile/features/booking/presentation/booking_event.dart';
import 'package:baber_mobile/features/booking/presentation/booking_state.dart';
import 'package:baber_mobile/features/booking/presentation/slot_selection_screen.dart';
import 'package:baber_mobile/features/catalog/domain/service.dart';

class MockBookingBloc extends MockBloc<BookingEvent, BookingState> implements BookingBloc {}

void main() {
  late MockBookingBloc bloc;
  const service = Service(id: 's1', name: 'Corte', priceInCents: 4000, durationMinutes: 30);
  const slot = TimeSlot(startTime: '09:00', endTime: '09:30');

  setUpAll(() {
    registerFallbackValue(const SlotSelected(slot));
  });

  setUp(() {
    bloc = MockBookingBloc();
  });

  Widget wrap(Widget child) => MaterialApp(
        home: BlocProvider<BookingBloc>.value(value: bloc, child: child),
      );

  testWidgets('shows spinner while loading', (tester) async {
    whenListen(bloc, const Stream<BookingState>.empty(),
        initialState: const BookingState(service: service, selectedDate: '2026-08-01', isLoading: true));

    await tester.pumpWidget(wrap(const SlotSelectionScreen()));

    expect(find.byType(CircularProgressIndicator), findsOneWidget);
  });

  testWidgets('renders available slots and dispatches SlotSelected on tap', (tester) async {
    whenListen(bloc, const Stream<BookingState>.empty(),
        initialState: const BookingState(service: service, selectedDate: '2026-08-01', slots: [slot]));

    await tester.pumpWidget(wrap(const SlotSelectionScreen()));
    await tester.tap(find.text('09:00'));

    verify(() => bloc.add(const SlotSelected(slot))).called(1);
  });

  testWidgets('shows message when no slots are available', (tester) async {
    whenListen(bloc, const Stream<BookingState>.empty(),
        initialState: const BookingState(service: service, selectedDate: '2026-08-01', slots: []));

    await tester.pumpWidget(wrap(const SlotSelectionScreen()));

    expect(find.text('Nenhum horário disponível nesta data.'), findsOneWidget);
  });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `flutter test test/features/booking/presentation/slot_selection_screen_test.dart`
Expected: FAIL with "Target of URI doesn't exist"

- [ ] **Step 3: Implement**

Create `lib/features/booking/presentation/slot_selection_screen.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'booking_bloc.dart';
import 'booking_event.dart';
import 'booking_state.dart';

class SlotSelectionScreen extends StatelessWidget {
  const SlotSelectionScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Escolha o horário')),
      body: BlocBuilder<BookingBloc, BookingState>(
        builder: (context, state) {
          if (state.isLoading) {
            return const Center(child: CircularProgressIndicator());
          }
          final slots = state.slots ?? [];
          if (slots.isEmpty) {
            return const Center(child: Text('Nenhum horário disponível nesta data.'));
          }
          return GridView.builder(
            padding: const EdgeInsets.all(16),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 3),
            itemCount: slots.length,
            itemBuilder: (context, index) {
              final slot = slots[index];
              return OutlinedButton(
                onPressed: () {
                  context.read<BookingBloc>().add(SlotSelected(slot));
                  context.push('/booking/confirm');
                },
                child: Text(slot.startTime),
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

Run: `flutter test test/features/booking/presentation/slot_selection_screen_test.dart`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/features/booking/presentation/slot_selection_screen.dart test/features/booking/presentation/slot_selection_screen_test.dart
git commit -m "feat(booking): add SlotSelectionScreen"
```

---

## Task 11 (mobile): `ConfirmBookingScreen`

**Files:**
- Create: `lib/features/booking/presentation/confirm_booking_screen.dart`
- Test: `test/features/booking/presentation/confirm_booking_screen_test.dart`

- [ ] **Step 1: Write the failing tests**

Create `test/features/booking/presentation/confirm_booking_screen_test.dart`:

```dart
import 'package:bloc_test/bloc_test.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:baber_mobile/features/booking/domain/time_slot.dart';
import 'package:baber_mobile/features/booking/presentation/booking_bloc.dart';
import 'package:baber_mobile/features/booking/presentation/booking_event.dart';
import 'package:baber_mobile/features/booking/presentation/booking_state.dart';
import 'package:baber_mobile/features/booking/presentation/confirm_booking_screen.dart';
import 'package:baber_mobile/features/catalog/domain/service.dart';

class MockBookingBloc extends MockBloc<BookingEvent, BookingState> implements BookingBloc {}

void main() {
  late MockBookingBloc bloc;
  const service = Service(id: 's1', name: 'Corte', priceInCents: 4000, durationMinutes: 30);
  const slot = TimeSlot(startTime: '09:00', endTime: '09:30');
  const initialState = BookingState(
    service: service,
    selectedDate: '2026-08-01',
    selectedSlot: slot,
  );

  setUpAll(() {
    registerFallbackValue(const BookingConfirmed(clientName: '', clientPhone: ''));
  });

  setUp(() {
    bloc = MockBookingBloc();
  });

  Widget wrap(Widget child) => MaterialApp(
        home: BlocProvider<BookingBloc>.value(value: bloc, child: child),
      );

  testWidgets('shows service name, date and slot summary', (tester) async {
    whenListen(bloc, const Stream<BookingState>.empty(), initialState: initialState);

    await tester.pumpWidget(wrap(const ConfirmBookingScreen(initialName: 'João', initialPhone: '+5511999999999')));

    expect(find.textContaining('Corte'), findsOneWidget);
    expect(find.textContaining('09:00'), findsOneWidget);
  });

  testWidgets('pre-fills name and phone fields, tapping Confirmar dispatches BookingConfirmed', (tester) async {
    whenListen(bloc, const Stream<BookingState>.empty(), initialState: initialState);

    await tester.pumpWidget(wrap(const ConfirmBookingScreen(initialName: 'João', initialPhone: '+5511999999999')));
    await tester.tap(find.text('Confirmar'));

    verify(() => bloc.add(const BookingConfirmed(clientName: 'João', clientPhone: '+5511999999999'))).called(1);
  });

  testWidgets('shows error SnackBar when errorMessage present', (tester) async {
    whenListen(
      bloc,
      Stream.fromIterable([
        BookingState(
          service: initialState.service,
          selectedDate: initialState.selectedDate,
          selectedSlot: initialState.selectedSlot,
          errorMessage: 'Nenhum barbeiro disponível.',
        ),
      ]),
      initialState: initialState,
    );

    await tester.pumpWidget(wrap(const ConfirmBookingScreen(initialName: 'João', initialPhone: '+5511999999999')));
    await tester.pump();

    expect(find.text('Nenhum barbeiro disponível.'), findsOneWidget);
  });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `flutter test test/features/booking/presentation/confirm_booking_screen_test.dart`
Expected: FAIL with "Target of URI doesn't exist"

- [ ] **Step 3: Implement**

Create `lib/features/booking/presentation/confirm_booking_screen.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'booking_bloc.dart';
import 'booking_event.dart';
import 'booking_state.dart';

class ConfirmBookingScreen extends StatefulWidget {
  final String initialName;
  final String initialPhone;

  const ConfirmBookingScreen({super.key, required this.initialName, required this.initialPhone});

  @override
  State<ConfirmBookingScreen> createState() => _ConfirmBookingScreenState();
}

class _ConfirmBookingScreenState extends State<ConfirmBookingScreen> {
  late final TextEditingController _nameController;
  late final TextEditingController _phoneController;

  @override
  void initState() {
    super.initState();
    _nameController = TextEditingController(text: widget.initialName);
    _phoneController = TextEditingController(text: widget.initialPhone);
  }

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Confirmar agendamento')),
      body: BlocConsumer<BookingBloc, BookingState>(
        listener: (context, state) {
          if (state.errorMessage != null) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text(state.errorMessage!)),
            );
          }
          if (state.bookingSucceeded) {
            context.go('/booking/success');
          }
        },
        builder: (context, state) {
          final slot = state.selectedSlot;
          return Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Serviço: ${state.service.name}'),
                Text('Data: ${state.selectedDate ?? ''}'),
                Text('Horário: ${slot?.startTime ?? ''}'),
                Text('Preço: ${state.service.formattedPrice}'),
                const SizedBox(height: 16),
                TextField(
                  controller: _nameController,
                  decoration: const InputDecoration(labelText: 'Nome'),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _phoneController,
                  keyboardType: TextInputType.phone,
                  decoration: const InputDecoration(labelText: 'Telefone'),
                ),
                const SizedBox(height: 16),
                ElevatedButton(
                  onPressed: state.isLoading
                      ? null
                      : () => context.read<BookingBloc>().add(BookingConfirmed(
                            clientName: _nameController.text,
                            clientPhone: _phoneController.text,
                          )),
                  child: state.isLoading
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Text('Confirmar'),
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

Run: `flutter test test/features/booking/presentation/confirm_booking_screen_test.dart`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/features/booking/presentation/confirm_booking_screen.dart test/features/booking/presentation/confirm_booking_screen_test.dart
git commit -m "feat(booking): add ConfirmBookingScreen with pre-filled name/phone"
```

---

## Task 12 (mobile): `BookingSuccessScreen`

**Files:**
- Create: `lib/features/booking/presentation/booking_success_screen.dart`

No dedicated widget test — this is a static confirmation screen with a single button, consistent with how `SplashScreen` (Task 5 of the auth-ui plan) skipped a widget test for a screen with no branching logic.

- [ ] **Step 1: Implement**

Create `lib/features/booking/presentation/booking_success_screen.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class BookingSuccessScreen extends StatelessWidget {
  const BookingSuccessScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.check_circle, color: Colors.green, size: 64),
            const SizedBox(height: 16),
            const Text('Agendamento confirmado!'),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: () => context.go('/appointments'),
              child: const Text('Ver minhas consultas'),
            ),
          ],
        ),
      ),
    );
  }
}
```

Note: `context.go('/appointments')` targets the route added by the next plan (`2026-07-07-mobile-my-appointments.md`). Until that plan is merged, this button will 404 in `go_router` — acceptable for this plan's scope since Task 13 wires the booking routes standalone and the target route doesn't exist yet; re-verify this navigation manually once the next plan lands.

- [ ] **Step 2: Commit**

```bash
git add lib/features/booking/presentation/booking_success_screen.dart
git commit -m "feat(booking): add BookingSuccessScreen"
```

---

## Task 13 (mobile): Wire routes into `app_router.dart`

**Files:**
- Modify: `lib/core/router/app_router.dart`
- Modify: `lib/baber_app.dart`
- Modify: `lib/main.dart`

- [ ] **Step 1: Add a `ShellRoute` for `/booking/*` and a plain route for `/services`**

In `app_router.dart`, add the new imports:

```dart
import 'package:dio/dio.dart';
import '../../features/catalog/domain/service.dart';
import '../../features/catalog/domain/service_repository.dart';
import '../../features/catalog/presentation/services_bloc.dart';
import '../../features/catalog/presentation/services_list_screen.dart';
import '../../features/booking/domain/booking_repository.dart';
import '../../features/booking/presentation/booking_bloc.dart';
import '../../features/booking/presentation/confirm_booking_screen.dart';
import '../../features/booking/presentation/date_selection_screen.dart';
import '../../features/booking/presentation/slot_selection_screen.dart';
import '../../features/booking/presentation/booking_success_screen.dart';
```

Add `serviceRepository` and `bookingRepository` (and a way to fetch the current user's name/phone for pre-fill — via a new `ApiClient.dio.get('/me')` call inline, since no dedicated "user profile" feature exists yet) as parameters to `buildAppRouter`:

```dart
GoRouter buildAppRouter({
  required TokenStorage tokenStorage,
  required TenantStorage tenantStorage,
  required AuthRepository authRepository,
  required TenantRepository tenantRepository,
  required ServiceRepository serviceRepository,
  required BookingRepository bookingRepository,
  required Dio dio,
  required AppLinks appLinks,
}) {
```

Add the routes (place them as siblings of the existing `/home` route, i.e. inside the top-level `routes` list, not nested under the auth `ShellRoute`):

```dart
      GoRoute(
        path: '/services',
        builder: (context, state) => BlocProvider(
          create: (_) => ServicesBloc(repository: serviceRepository),
          child: const ServicesListScreen(),
        ),
      ),
      ShellRoute(
        builder: (context, state, child) => BlocProvider(
          create: (_) => BookingBloc(repository: bookingRepository, service: state.extra as Service),
          child: child,
        ),
        routes: [
          GoRoute(path: '/booking/date', builder: (context, state) => const DateSelectionScreen()),
          GoRoute(path: '/booking/slots', builder: (context, state) => const SlotSelectionScreen()),
          GoRoute(
            path: '/booking/confirm',
            builder: (context, state) => FutureBuilder<Response>(
              future: dio.get('/me'),
              builder: (context, snapshot) {
                if (!snapshot.hasData) return const Center(child: CircularProgressIndicator());
                final data = snapshot.data!.data as Map<String, dynamic>;
                return ConfirmBookingScreen(
                  initialName: (data['name'] as String?) ?? '',
                  initialPhone: (data['phone'] as String?) ?? '',
                );
              },
            ),
          ),
          GoRoute(path: '/booking/success', builder: (context, state) => const BookingSuccessScreen()),
        ],
      ),
```

- [ ] **Step 2: Update `BaberApp` and `main.dart` to construct and pass the new repositories**

In `lib/baber_app.dart`, add `serviceRepository`, `bookingRepository` fields/params (mirroring `authRepository`/`tenantRepository`) and pass `dio: /* the shared Dio instance */` — the app already has one `ApiClient` instance in `main.dart`; thread its `.dio` through.

In `lib/main.dart`, after constructing `apiClient`, add:

```dart
  final serviceRepository = ServiceRepositoryImpl(apiClient.dio);
  final bookingRepository = BookingRepositoryImpl(apiClient.dio);
```

Pass both plus `dio: apiClient.dio` into `BaberApp(...)`, and thread them through `BaberApp.build()` into `buildAppRouter(...)`.

Add the imports to `main.dart`:

```dart
import 'features/catalog/data/service_repository_impl.dart';
import 'features/booking/data/booking_repository_impl.dart';
```

- [ ] **Step 3: Run the full test suite + analyze**

Run: `flutter test`
Expected: PASS, no regressions (the widget-level tests for these new screens use `BlocProvider.value` with mocked blocs, so they don't depend on the router wiring).

Run: `flutter analyze`
Expected: "No issues found!"

- [ ] **Step 4: Commit**

```bash
git add lib/core/router/app_router.dart lib/baber_app.dart lib/main.dart
git commit -m "feat(booking): wire catalog and booking routes into go_router"
```

---

## Task 14: Manual smoke check

- [ ] **Step 1: Run the app against a local backend**

Ensure `apps/api` is running locally with the two backend plans (`scheduling-auto-assign`, `scheduling-my-appointments`) applied and migrated, and that a tenant has at least one active service and one active barber with a work schedule.

Run: `flutter run`

Manually verify: from Home (still the placeholder — Task navigation entry point is `context.push('/services')`, not yet wired to a Home button until the next plans; navigate directly via a temporary deep link or by adding a debug button if needed for this manual check only, do not commit a throwaway button) tapping a service shows 30 selectable dates, picking a date shows real available slots from the running backend, picking a slot pre-fills name/phone from `/me` and books successfully, landing on the success screen.

- [ ] **Step 2: Note results**

Report what was actually observed — don't claim the full flow works unless it was actually exercised against a running backend.
