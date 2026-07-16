import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import { TeamMembersController } from './team-members.controller';
import { InviteTeamMemberUseCase } from '../application/use-cases/invite-team-member.use-case';
import { ListTeamMembersUseCase } from '../application/use-cases/list-team-members.use-case';
import { DeactivateTeamMemberUseCase } from '../application/use-cases/deactivate-team-member.use-case';
import { User } from '../domain/entities/user.entity';

describe('TeamMembersController (http)', () => {
  let app: INestApplication;
  const admin = User.createInvited({ tenantId: 't1', name: 'A', phone: '+551', role: 'ADMIN' });
  const invite = { execute: jest.fn().mockResolvedValue(admin) };
  const list = { execute: jest.fn().mockResolvedValue([admin]) };
  const deactivate = { execute: jest.fn().mockResolvedValue(undefined) };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [TeamMembersController],
      providers: [
        { provide: InviteTeamMemberUseCase, useValue: invite },
        { provide: ListTeamMembersUseCase, useValue: list },
        { provide: DeactivateTeamMemberUseCase, useValue: deactivate },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
    app.use((req: Request, _res: Response, next: NextFunction) => {
      req.user = { sub: 'admin-1', tenantId: 't1', role: 'ADMIN', userId: 'admin-1' } as never;
      next();
    });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => jest.clearAllMocks());

  it('200 lists team members', async () => {
    const res = await request(app.getHttpServer()).get('/team-members').expect(200);
    expect(res.body).toHaveLength(1);
  });

  it('201 invites a new team member', async () => {
    await request(app.getHttpServer())
      .post('/team-members/invite')
      .send({ name: 'Nova Recepção', phone: '+5511988887777', role: 'RECEPTIONIST' })
      .expect(201);
    expect(invite.execute).toHaveBeenCalledWith({
      tenantId: 't1',
      name: 'Nova Recepção',
      phone: '+5511988887777',
      role: 'RECEPTIONIST',
    });
  });

  it('400 when invite role is not ADMIN or RECEPTIONIST', async () => {
    await request(app.getHttpServer())
      .post('/team-members/invite')
      .send({ name: 'X', phone: '+551', role: 'CLIENT' })
      .expect(400);
  });

  it('400 when invite is missing required fields', async () => {
    await request(app.getHttpServer())
      .post('/team-members/invite')
      .send({ name: '', phone: '', role: 'ADMIN' })
      .expect(400);
  });

  it('204 deactivates a team member', async () => {
    await request(app.getHttpServer()).patch('/team-members/00000000-0000-0000-0000-000000000001/deactivate').expect(204);
    expect(deactivate.execute).toHaveBeenCalledWith({
      tenantId: 't1',
      targetId: '00000000-0000-0000-0000-000000000001',
      requestedByUserId: 'admin-1',
    });
  });
});
