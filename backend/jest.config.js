module.exports = {
    testEnvironment: 'node',
    setupFiles: ['<rootDir>/tests/setupEnv.js'],
    testMatch: ['<rootDir>/tests/**/*.test.js'],
    collectCoverageFrom: [
        'src/services/claimEngine.service.js',
        'src/services/security.service.js',
        'src/utils/mappers.js',
        'src/middleware/validate.js',
    ],
};
