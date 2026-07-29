export const SERVICE_PRICE_LOOKUP = Symbol('IServicePriceLookup');

/** Anti-corruption layer over the catalog bounded context — loyalty only ever needs a service's current price. */
export interface IServicePriceLookup {
  findPriceInCents(serviceId: string, tenantId: string): Promise<number | null>;
}
