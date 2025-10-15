const loadEnv = async () => {
  try {
    await import('dotenv/config');
    return;
  } catch (error) {
    if (error?.code !== 'ERR_MODULE_NOT_FOUND') {
      throw error;
    }
  }

  if (typeof process.loadEnvFile === 'function') {
    process.loadEnvFile();
    return;
  }

  console.warn(
    'dotenv package not found and process.loadEnvFile is unavailable. Environment variables from .env will not be loaded.',
  );
};

await loadEnv();
