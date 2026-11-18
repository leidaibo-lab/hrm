-- 保留原有数据并将存量表调整为已登记的领域前缀。
ALTER TABLE "users" RENAME TO "iam_users";
ALTER TABLE "roles" RENAME TO "iam_roles";
ALTER TABLE "permission_points" RENAME TO "iam_permission_points";
ALTER TABLE "user_roles" RENAME TO "iam_user_roles";
ALTER TABLE "role_permission_points" RENAME TO "iam_role_permission_points";
ALTER TABLE "navigation_nodes" RENAME TO "iam_navigation_nodes";
ALTER TABLE "model_providers" RENAME TO "model_gateway_model_providers";
ALTER TABLE "provider_models" RENAME TO "model_gateway_provider_models";
ALTER TABLE "model_pricings" RENAME TO "model_gateway_model_pricings";
ALTER TABLE "model_usages" RENAME TO "model_gateway_model_usages";
-- AlterTable
ALTER TABLE "iam_navigation_nodes" RENAME CONSTRAINT "navigation_nodes_pkey" TO "iam_navigation_nodes_pkey";

-- AlterTable
ALTER TABLE "iam_permission_points" RENAME CONSTRAINT "permission_points_pkey" TO "iam_permission_points_pkey";

-- AlterTable
ALTER TABLE "iam_role_permission_points" RENAME CONSTRAINT "role_permission_points_pkey" TO "iam_role_permission_points_pkey";

-- AlterTable
ALTER TABLE "iam_roles" RENAME CONSTRAINT "roles_pkey" TO "iam_roles_pkey";

-- AlterTable
ALTER TABLE "iam_user_roles" RENAME CONSTRAINT "user_roles_pkey" TO "iam_user_roles_pkey";

-- AlterTable
ALTER TABLE "iam_users" RENAME CONSTRAINT "users_pkey" TO "iam_users_pkey";

-- AlterTable
ALTER TABLE "model_gateway_model_pricings" RENAME CONSTRAINT "model_pricings_pkey" TO "model_gateway_model_pricings_pkey";

-- AlterTable
ALTER TABLE "model_gateway_model_providers" RENAME CONSTRAINT "model_providers_pkey" TO "model_gateway_model_providers_pkey";

-- AlterTable
ALTER TABLE "model_gateway_model_usages" RENAME CONSTRAINT "model_usages_pkey" TO "model_gateway_model_usages_pkey";

-- AlterTable
ALTER TABLE "model_gateway_provider_models" RENAME CONSTRAINT "provider_models_pkey" TO "model_gateway_provider_models_pkey";

-- RenameForeignKey
ALTER TABLE "iam_role_permission_points" RENAME CONSTRAINT "role_permission_points_permissionCode_fkey" TO "iam_role_permission_points_permissionCode_fkey";

-- RenameForeignKey
ALTER TABLE "iam_role_permission_points" RENAME CONSTRAINT "role_permission_points_roleId_fkey" TO "iam_role_permission_points_roleId_fkey";

-- RenameForeignKey
ALTER TABLE "iam_user_roles" RENAME CONSTRAINT "user_roles_roleId_fkey" TO "iam_user_roles_roleId_fkey";

-- RenameForeignKey
ALTER TABLE "iam_user_roles" RENAME CONSTRAINT "user_roles_userId_fkey" TO "iam_user_roles_userId_fkey";

-- RenameForeignKey
ALTER TABLE "model_gateway_model_pricings" RENAME CONSTRAINT "model_pricings_modelId_fkey" TO "model_gateway_model_pricings_modelId_fkey";

-- RenameForeignKey
ALTER TABLE "model_gateway_model_usages" RENAME CONSTRAINT "model_usages_modelId_fkey" TO "model_gateway_model_usages_modelId_fkey";

-- RenameForeignKey
ALTER TABLE "model_gateway_model_usages" RENAME CONSTRAINT "model_usages_pricingId_fkey" TO "model_gateway_model_usages_pricingId_fkey";

-- RenameForeignKey
ALTER TABLE "model_gateway_provider_models" RENAME CONSTRAINT "provider_models_providerId_fkey" TO "model_gateway_provider_models_providerId_fkey";

-- RenameIndex
ALTER INDEX "navigation_nodes_parentCode_idx" RENAME TO "iam_navigation_nodes_parentCode_idx";

-- RenameIndex
ALTER INDEX "permission_points_resource_idx" RENAME TO "iam_permission_points_resource_idx";

-- RenameIndex
ALTER INDEX "roles_code_key" RENAME TO "iam_roles_code_key";

-- RenameIndex
ALTER INDEX "users_email_key" RENAME TO "iam_users_email_key";

-- RenameIndex
ALTER INDEX "users_username_key" RENAME TO "iam_users_username_key";

-- RenameIndex
ALTER INDEX "model_pricings_modelId_effectiveFrom_idx" RENAME TO "model_gateway_model_pricings_modelId_effectiveFrom_idx";

-- RenameIndex
ALTER INDEX "model_providers_slug_key" RENAME TO "model_gateway_model_providers_slug_key";

-- RenameIndex
ALTER INDEX "model_usages_modelId_createdAt_idx" RENAME TO "model_gateway_model_usages_modelId_createdAt_idx";

-- RenameIndex
ALTER INDEX "model_usages_traceId_idx" RENAME TO "model_gateway_model_usages_traceId_idx";

-- RenameIndex
ALTER INDEX "provider_models_logicalKey_key" RENAME TO "model_gateway_provider_models_logicalKey_key";

-- RenameIndex
ALTER INDEX "provider_models_providerId_idx" RENAME TO "model_gateway_provider_models_providerId_idx";

-- RenameIndex
ALTER INDEX "provider_models_providerId_modelId_key" RENAME TO "model_gateway_provider_models_providerId_modelId_key";
