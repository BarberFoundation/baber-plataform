import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateProfileDto } from './me.controller';

describe('UpdateProfileDto (PATCH /me validation)', () => {
  it('trims leading/trailing whitespace from a legitimate name', async () => {
    const dto = plainToInstance(UpdateProfileDto, { name: '  Gabryel  ' });
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.name).toBe('Gabryel');
  });

  it('rejects a whitespace-only name after trimming', async () => {
    const dto = plainToInstance(UpdateProfileDto, { name: '   ' });
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('name');
    expect(errors[0].constraints).toHaveProperty('isNotEmpty');
  });

  it('rejects an empty string name', async () => {
    const dto = plainToInstance(UpdateProfileDto, { name: '' });
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('accepts a normal name unchanged', async () => {
    const dto = plainToInstance(UpdateProfileDto, { name: 'Gabryel' });
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.name).toBe('Gabryel');
  });

  it('allows omitting name entirely (phone-only update)', async () => {
    const dto = plainToInstance(UpdateProfileDto, { phone: '+5511988887777' });
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('trims whitespace from phone', async () => {
    const dto = plainToInstance(UpdateProfileDto, { phone: '  +5511988887777  ' });
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.phone).toBe('+5511988887777');
  });

  it('allows omitting phone entirely (name-only update)', async () => {
    const dto = plainToInstance(UpdateProfileDto, { name: 'Gabryel' });
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });
});
