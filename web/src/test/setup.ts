// Los tests nunca hablan con PocketBase ni con la red: el PocketBase de desarrollo
// tiene una copia de datos reales. Cualquier fetch hace fallar el test.
globalThis.fetch = () => {
	throw new Error('Los tests no pueden usar la red (fetch bloqueado en src/test/setup.ts)');
};
