// Pin the test-runner timezone to match production (Brazilian business, always
// America/Sao_Paulo). Without this, tests that rely on local-time Date getters
// (see date.utils.ts) pass or fail depending on the machine's OS timezone —
// e.g. green on a dev machine set to America/Sao_Paulo, red on CI runners
// (which default to UTC).
process.env.TZ = 'America/Sao_Paulo';
