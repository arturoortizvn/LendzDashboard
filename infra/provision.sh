#!/usr/bin/env bash
set -euo pipefail

# One-time provisioning for the LendzDashboard Azure Container Apps deployment.
# Idempotency is NOT guaranteed — this is meant to stand the environment up once.
# Re-running individual `az ... create` commands will error if the resource exists.

# ---------------------------------------------------------------------------
# Infrastructure parameters — edit these before running.
# ---------------------------------------------------------------------------
RESOURCE_GROUP="lendz-dashboard-rg"
LOCATION="eastus"
ACR_NAME="lendzdashboardacr"          # must be globally unique, alphanumeric only
STORAGE_ACCOUNT="lendzdashboardstore" # must be globally unique, 3-24 lowercase alnum
BLOB_CONTAINER="readiness"
ENVIRONMENT="lendz-dashboard-env"     # Container Apps environment
CONTAINERAPP_NAME="lendz-dashboard"
JOB_NAME="lendz-dashboard-refresh"
IDENTITY_NAME="lendz-dashboard-identity"
IMAGE="lendz-dashboard:latest"

# ---------------------------------------------------------------------------
# Monday.com configuration — MONDAY_API_TOKEN is stored as a Container Apps
# secret and referenced by both the app and the job; board ids are plain
# (non-secret) env vars. Export MONDAY_API_TOKEN before running, or edit here.
# ---------------------------------------------------------------------------
MONDAY_API_TOKEN="${MONDAY_API_TOKEN:-REPLACE_WITH_MONDAY_TOKEN}"
ID_MONDAY_PE="18420951236"
ID_MONDAY_UW="18420951193"
ID_MONDAY_BANK="18420951194"
ID_MONDAY_ID="18420951197"
ID_MONDAY_PL="18420951201"
ID_MONDAY_PAYSTUB="18420951200"
# The Broker LOS board is shared and feeds both the broker and lexi modules.
ID_MONDAY_LEXI="18420631446"
ID_MONDAY_BROKER="18420631446"
# Optional boards — set once the board exists, then add them to COMMON_ENV below:
# ID_MONDAY_VT=""
# ID_MONDAY_TAX=""

# Build context is the repo root regardless of where this script is invoked from.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

ACR_LOGIN_SERVER="$ACR_NAME.azurecr.io"

echo "==> [1/9] Creating resource group '$RESOURCE_GROUP' in '$LOCATION'"
az group create \
  --name "$RESOURCE_GROUP" \
  --location "$LOCATION"

echo "==> [2/9] Creating Azure Container Registry '$ACR_NAME'"
# admin-enabled is intentionally left off (default false): pulls authenticate via
# the managed identity below, so the registry never needs username/password.
az acr create \
  --name "$ACR_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --sku Basic \
  --location "$LOCATION"

echo "==> [3/9] Creating storage account '$STORAGE_ACCOUNT' + blob container '$BLOB_CONTAINER'"
az storage account create \
  --name "$STORAGE_ACCOUNT" \
  --resource-group "$RESOURCE_GROUP" \
  --location "$LOCATION" \
  --sku Standard_LRS \
  --kind StorageV2 \
  --allow-blob-public-access false
# --auth-mode login uses the operator's Azure AD identity (no account keys / SAS),
# which requires the operator to hold a data-plane role such as
# "Storage Blob Data Contributor" or "Owner" on the account.
az storage container create \
  --name "$BLOB_CONTAINER" \
  --account-name "$STORAGE_ACCOUNT" \
  --auth-mode login

echo "==> [4/9] Creating user-assigned managed identity '$IDENTITY_NAME'"
az identity create \
  --name "$IDENTITY_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --location "$LOCATION"

IDENTITY_RESOURCE_ID="$(az identity show --name "$IDENTITY_NAME" --resource-group "$RESOURCE_GROUP" --query id -o tsv)"
IDENTITY_PRINCIPAL_ID="$(az identity show --name "$IDENTITY_NAME" --resource-group "$RESOURCE_GROUP" --query principalId -o tsv)"
IDENTITY_CLIENT_ID="$(az identity show --name "$IDENTITY_NAME" --resource-group "$RESOURCE_GROUP" --query clientId -o tsv)"

echo "==> [5/9] Assigning roles to the managed identity"
ACR_ID="$(az acr show --name "$ACR_NAME" --resource-group "$RESOURCE_GROUP" --query id -o tsv)"
STORAGE_ID="$(az storage account show --name "$STORAGE_ACCOUNT" --resource-group "$RESOURCE_GROUP" --query id -o tsv)"
# AcrPull lets Container Apps pull the image using the identity (no admin creds).
# --assignee-object-id + --assignee-principal-type skips a Graph lookup that can
# fail for a just-created identity that has not fully propagated.
az role assignment create \
  --assignee-object-id "$IDENTITY_PRINCIPAL_ID" \
  --assignee-principal-type ServicePrincipal \
  --role "AcrPull" \
  --scope "$ACR_ID"
# Storage Blob Data Contributor lets the app/job read & write the readiness blob
# via DefaultAzureCredential — the data-plane RBAC that replaces connection strings.
az role assignment create \
  --assignee-object-id "$IDENTITY_PRINCIPAL_ID" \
  --assignee-principal-type ServicePrincipal \
  --role "Storage Blob Data Contributor" \
  --scope "$STORAGE_ID"

echo "==> [6/9] Seeding initial image '$IMAGE' in ACR (app/job create need a pullable image)"
az acr build \
  --registry "$ACR_NAME" \
  --image "$IMAGE" \
  "$REPO_ROOT"

echo "==> [7/9] Creating Container Apps environment '$ENVIRONMENT'"
az containerapp env create \
  --name "$ENVIRONMENT" \
  --resource-group "$RESOURCE_GROUP" \
  --location "$LOCATION"

# Env vars shared by the web app and the refresh job. AZURE_CLIENT_ID pins
# DefaultAzureCredential to this user-assigned identity (without it, the credential
# has no way to know which identity to use when none is system-assigned).
COMMON_ENV=(
  "AZURE_STORAGE_ACCOUNT=$STORAGE_ACCOUNT"
  "AZURE_BLOB_CONTAINER=$BLOB_CONTAINER"
  "AZURE_CLIENT_ID=$IDENTITY_CLIENT_ID"
  "MONDAY_API_TOKEN=secretref:monday-api-token"
  "ID_MONDAY_PE=$ID_MONDAY_PE"
  "ID_MONDAY_UW=$ID_MONDAY_UW"
  "ID_MONDAY_BANK=$ID_MONDAY_BANK"
  "ID_MONDAY_ID=$ID_MONDAY_ID"
  "ID_MONDAY_PL=$ID_MONDAY_PL"
  "ID_MONDAY_PAYSTUB=$ID_MONDAY_PAYSTUB"
  "ID_MONDAY_LEXI=$ID_MONDAY_LEXI"
  "ID_MONDAY_BROKER=$ID_MONDAY_BROKER"
)

echo "==> [8/9] Creating container app '$CONTAINERAPP_NAME' (web, external ingress :3000)"
# --registry-identity tells Container Apps to authenticate ACR pulls with the
# user-assigned identity rather than stored registry credentials.
az containerapp create \
  --name "$CONTAINERAPP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --environment "$ENVIRONMENT" \
  --image "$ACR_LOGIN_SERVER/$IMAGE" \
  --user-assigned "$IDENTITY_RESOURCE_ID" \
  --registry-server "$ACR_LOGIN_SERVER" \
  --registry-identity "$IDENTITY_RESOURCE_ID" \
  --ingress external \
  --target-port 3000 \
  --min-replicas 1 \
  --max-replicas 3 \
  --secrets "monday-api-token=$MONDAY_API_TOKEN" \
  --env-vars "${COMMON_ENV[@]}"

echo "==> [9/9] Creating scheduled refresh job '$JOB_NAME' (cron */15 * * * *)"
# Same image and identity as the web app; the CMD is overridden to run the
# one-shot refresh entrypoint instead of the web server.
az containerapp job create \
  --name "$JOB_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --environment "$ENVIRONMENT" \
  --image "$ACR_LOGIN_SERVER/$IMAGE" \
  --trigger-type Schedule \
  --cron-expression "*/15 * * * *" \
  --replica-timeout 600 \
  --replica-retry-limit 1 \
  --user-assigned "$IDENTITY_RESOURCE_ID" \
  --registry-server "$ACR_LOGIN_SERVER" \
  --registry-identity "$IDENTITY_RESOURCE_ID" \
  --command "node" "dist-server/server/refresh-job.js" \
  --secrets "monday-api-token=$MONDAY_API_TOKEN" \
  --env-vars "${COMMON_ENV[@]}"

echo "==> Done. Web app + scheduled refresh job provisioned."
echo "    Web app FQDN:"
az containerapp show \
  --name "$CONTAINERAPP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query "properties.configuration.ingress.fqdn" -o tsv
