// Configuración de la guía 10 (bloque 3)
export default {
  // Jest no entiende TypeScript: ts-jest transforma los .ts antes de
  // ejecutarlos. La variante "-esm" respeta "type": "module".
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  // Solo los .ts de src/: si no, después de un build también corre las copias compiladas de dist/
  roots: ['<rootDir>/src'],
  // Nuestros imports dicen './usuario.service.js' y el archivo es .ts:
  // se le saca el .js para que Jest encuentre el .ts.
  moduleNameMapper: {
    '^(\.{1,2}/.*)\.js$': '$1',
  },
};
