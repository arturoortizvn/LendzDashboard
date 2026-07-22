# Infrastructure — Azure Container Apps

LendzDashboard runs as a single Docker image (`lendz-dashboard`) on Azure
Container Apps in two roles:

- **Web app** — default `CMD node dist-server/server/index.js`, HTTP on port 3000,
  serves the SPA and `GET /api/readiness`.
- **Refresh job** — same image, command overridden to
  `node dist-server/server/refresh-job.js`, run on a schedule (one-shot).

Blob storage is reached through a **user-assigned managed identity** using
`DefaultAzureCredential` — no connection strings, no SAS. The identity holds
`AcrPull` on the registry and `Storage Blob Data Contributor` on the storage
account. CI pushes new images and rolls them out; the identity, roles, and
resources are stood up once by `provision.sh`.

## Prerequisites

- [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli) installed.
- Logged in: `az login`, and `az account set --subscription <SUBSCRIPTION_ID>`.
- The `containerapp` extension (the CLI installs it on first use, or run
  `az extension add --name containerapp --upgrade`).
- Your operator identity needs a data-plane role on the storage account
  (e.g. **Storage Blob Data Contributor** or **Owner**) so `provision.sh` can
  create the blob container with `--auth-mode login`.

## 1. Provision the infrastructure (one-time)

Edit the parameters at the top of `provision.sh` (names must be globally unique
for ACR and the storage account), then run it. Provide the Monday token via the
environment so it never lands in shell history verbatim:

```bash
export MONDAY_API_TOKEN="<your-monday-token>"
bash infra/provision.sh
```

The script, in order: creates the resource group, ACR, storage account + the
`readiness` blob container, the user-assigned managed identity, both role
assignments, seeds the initial image (`az acr build`), the Container Apps
environment, the web container app (external ingress on port 3000,
`--min-replicas 1 --max-replicas 3`), and the scheduled refresh job
(`--cron-expression "*/15 * * * *"`). It prints the web app FQDN at the end.

## 2. Set up GitHub OIDC federated credentials

CI authenticates with `azure/login@v2` using OIDC — **no client secret**. Create
an app registration + service principal, grant it Contributor on the resource
group, and add a federated credential scoped to pushes on `main`.

```bash
# Names/ids used below
APP_NAME="lendz-dashboard-github-oidc"
SUBSCRIPTION_ID="$(az account show --query id -o tsv)"
RESOURCE_GROUP="lendz-dashboard-rg"   # match provision.sh
GITHUB_OWNER="<owner>"                 # e.g. Viewnear
GITHUB_REPO="<repo>"                   # e.g. LendzDashboard

# App registration + service principal
APP_ID="$(az ad app create --display-name "$APP_NAME" --query appId -o tsv)"
az ad sp create --id "$APP_ID"

# Let CI update the container app + job and push images (Contributor on the RG)
az role assignment create \
  --assignee "$APP_ID" \
  --role "Contributor" \
  --scope "/subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP"

# Federated credential: trust GitHub's OIDC token for pushes to main
az ad app federated-credential create \
  --id "$APP_ID" \
  --parameters "{
    \"name\": \"github-main\",
    \"issuer\": \"https://token.actions.githubusercontent.com\",
    \"subject\": \"repo:${GITHUB_OWNER}/${GITHUB_REPO}:ref:refs/heads/main\",
    \"audiences\": [\"api://AzureADTokenExchange\"]
  }"

# Values you need for the GitHub secrets below
echo "AZURE_CLIENT_ID       = $APP_ID"
echo "AZURE_TENANT_ID       = $(az account show --query tenantId -o tsv)"
echo "AZURE_SUBSCRIPTION_ID = $SUBSCRIPTION_ID"
```

> The federated credential `subject` must be exactly
> `repo:<owner>/<repo>:ref:refs/heads/main`. To also allow `workflow_dispatch`
> from other branches, add extra federated credentials with the matching subject.

## 3. Configure GitHub repository variables and secrets

`.github/workflows/deploy.yml` reads non-secret names from **variables** and the
Azure OIDC ids from **secrets** (Settings → Secrets and variables → Actions).

**Variables** (Variables tab) — match `provision.sh`:

| Variable            | Example                    |
| ------------------- | -------------------------- |
| `RESOURCE_GROUP`    | `lendz-dashboard-rg`       |
| `ACR_NAME`          | `lendzdashboardacr`        |
| `CONTAINERAPP_NAME` | `lendz-dashboard`          |
| `JOB_NAME`          | `lendz-dashboard-refresh`  |

**Secrets** (Secrets tab) — from the OIDC setup above:

| Secret                  | Source                          |
| ----------------------- | ------------------------------- |
| `AZURE_CLIENT_ID`       | app registration `appId`        |
| `AZURE_TENANT_ID`       | `az account show --query tenantId` |
| `AZURE_SUBSCRIPTION_ID` | `az account show --query id`    |

On every push to `main` (or a manual `workflow_dispatch`) the workflow builds the
image with `az acr build`, then rolls it out to both the container app and the job.

## 4. Set / rotate the `MONDAY_API_TOKEN` secret

The token is stored as a Container Apps **secret** named `monday-api-token` and
referenced by the env var `MONDAY_API_TOKEN=secretref:monday-api-token`. To
update it later on both the app and the job:

```bash
RESOURCE_GROUP="lendz-dashboard-rg"
az containerapp secret set \
  --name lendz-dashboard \
  --resource-group "$RESOURCE_GROUP" \
  --secrets "monday-api-token=<new-token>"

az containerapp job secret set \
  --name lendz-dashboard-refresh \
  --resource-group "$RESOURCE_GROUP" \
  --secrets "monday-api-token=<new-token>"
```

## 5. Trigger the refresh job manually ("Run now")

The scheduled job runs every 15 minutes. To force an immediate run:

```bash
az containerapp job start \
  --name lendz-dashboard-refresh \
  --resource-group lendz-dashboard-rg
```

Check recent executions:

```bash
az containerapp job execution list \
  --name lendz-dashboard-refresh \
  --resource-group lendz-dashboard-rg -o table
```
