import { useMutation, useQueryClient } from '@tanstack/react-query';
import { providerControllerCreateImport } from '@/lib/api-client';
import { ApiError } from '@/lib/api-error';
import { mpKeys } from './keys';

/** 后端完整导入用例，成功或部分成功后刷新模型与供应商计数。 */
export function useCreateImport(providerId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (
      body: Parameters<typeof providerControllerCreateImport>[0]['body'],
    ) => {
      const { data, error } = await providerControllerCreateImport({
        path: { id: providerId },
        body,
      });
      if (error) throw new ApiError(error, '导入失败');
      return data;
    },
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: mpKeys.modelsListRoot }),
        client.invalidateQueries({ queryKey: mpKeys.modelRoot }),
        client.invalidateQueries({ queryKey: mpKeys.providerRoot }),
        client.invalidateQueries({ queryKey: ['table-view', 'mp-models'] }),
      ]);
    },
  });
}
