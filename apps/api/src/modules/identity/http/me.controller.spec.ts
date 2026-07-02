import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateNameDto } from './me.controller';

describe('UpdateNameDto (PATCH /me validation)', () => {
  it('trims leading/trailing whitespace from a legitimate name', async () => {
    const dto = plainToInstance(UpdateNameDto, { name: '  Gabryel  ' });
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.name).toBe('Gabryel');
  });

  it('rejects a whitespace-only name after trimming', async () => {
    const dto = plainToInstance(UpdateNameDto, { name: '   ' });
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('name');
    expect(errors[0].constraints).toHaveProperty('isNotEmpty');
  });

  it('rejects an empty string', async () => {
    const dto = plainToInstance(UpdateNameDto, { name: '' });
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('accepts a normal name unchanged', async () => {
    const dto = plainToInstance(UpdateNameDto, { name: 'Gabryel' });
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.name).toBe('Gabryel');
  });
});
