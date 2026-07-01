// Barrel das tabelas. Cada bounded context adiciona seu schema aqui
// conforme for implementado (catalog, team, scheduling, identity, notifications).
export * from './tenants';
export * from './users';
export * from './refresh-tokens';
export * from './services';
export * from './barbers';
