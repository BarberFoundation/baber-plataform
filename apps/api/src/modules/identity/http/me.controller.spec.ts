import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { IsNotEmpty, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

// Mirrors the UpdateNameDto defined in me.controller.ts. It is not exported from that
// module, so we redeclare it here with the exact same decorators to exercise the
// same class-transformer/class-validator pipeline that Nest's global ValidationPipe
// (transform: true) runs against the real DTO.
class UpdateNameDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  name!: string;
}

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
