import { Money } from './money.vo';

describe('Money', () => {
  it('soma mantendo centavos inteiros', () => {
    const total = Money.fromCents(1500).add(Money.fromCents(2500));
    expect(total.amountCents).toBe(4000);
  });

  it('rejeita centavos não-inteiros', () => {
    expect(() => Money.fromCents(10.5)).toThrow();
  });

  it('rejeita valor negativo', () => {
    expect(() => Money.fromCents(-1)).toThrow();
  });

  it('rejeita soma de moedas diferentes', () => {
    expect(() => Money.fromCents(100, 'BRL').add(Money.fromCents(100, 'USD'))).toThrow();
  });
});
