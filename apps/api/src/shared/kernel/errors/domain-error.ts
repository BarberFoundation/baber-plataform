/**
 * Erro de domínio: invariante de negócio violada.
 * Camada de domínio lança isto — nunca exceções HTTP do Nest.
 * Um exception filter na borda traduz para o status HTTP adequado.
 */
export abstract class DomainError extends Error {
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}
