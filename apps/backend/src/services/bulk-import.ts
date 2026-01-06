// TODO: Bulk import needs to be updated for new catalog architecture
// - Requires period_id
// - Images should be uploaded to ImageStorage, not assumed to exist
// - CSV format needs to include image files or reference existing image IDs

export const BulkImportService = {
  processCsv: async (_csvContent: string, _userId: string) => {
    return {
      successCount: 0,
      errors: [
        "Bulk import is temporarily disabled. Please add products individually or contact support.",
      ],
    };
  },
};
