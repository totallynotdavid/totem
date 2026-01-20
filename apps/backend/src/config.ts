const requiredEnv = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Environment variable ${name} is required but not set`);
  }
  return value;
};

export const config = {
  get calidda() {
    return {
      baseUrl: requiredEnv("CALIDDA_BASE_URL"),
      credentials: {
        username: requiredEnv("CALIDDA_USERNAME"),
        password: requiredEnv("CALIDDA_PASSWORD"),
      },
    };
  },
  get powerbi() {
    return {
      datasetId: requiredEnv("POWERBI_DATASET_ID"),
      reportId: requiredEnv("POWERBI_REPORT_ID"),
      modelId: requiredEnv("POWERBI_MODEL_ID"),
      resourceKey: requiredEnv("POWERBI_RESOURCE_KEY"),
    };
  },
};
