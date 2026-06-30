import { DomainError } from '../errors/domain-error';

class InvalidMoneyError extends DomainError {
  readonly code = 'INVALID_MONEY';
}

/**
 * Valor monetário em centavos (inteiro) para evitar erro de ponto flutuante.
 * Imutável.
 */
export class Money {
  private constructor(
    readonly amountCents: number,
    readonly currency: string,
  ) {}

  static fromCents(amountCents: number, currency = 'BRL'): Money {
    if (!Number.isInteger(amountCents)) {
      throw new InvalidMoneyError('amountCents deve ser inteiro (centavos).');
    }
    if (amountCents < 0) {
      throw new InvalidMoneyError('amountCents não pode ser negativo.');
    }
    return new Money(amountCents, currency);
  }

  static zero(currency = 'BRL'): Money {
    return new Money(0, currency);
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amountCents + other.amountCents, this.currency);
  }

  equals(other: Money): boolean {
    return this.amountCents === other.amountCents && this.currency === other.currency;
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new InvalidMoneyError(
        `Moedas diferentes: ${this.currency} vs ${other.currency}.`,
      );
    }
  }
}
