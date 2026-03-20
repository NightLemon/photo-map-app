# PhotoMap 部署指南

## 架构概览

```
浏览器
  ↓ HTTPS
Azure Static Web Apps (yellow-ground-0d72a2100.2.azurestaticapps.net)
  → React SPA (Vite 构建)
  → API 请求打到 ↓

Azure App Service (photomap-api.azurewebsites.net)
  → Docker 容器 (FastAPI + uvicorn)
  → 启动时自动跑 Alembic migration
  ↓
Azure PostgreSQL Flexible Server     Azure Blob Storage
(photomap-db.postgres.database...)    (photomapstorage)
  ↓                                    ↓
  users / media / albums / album_media  media + thumbnails 容器
```

## 需要的外部服务

| 服务 | 用途 | 费用 |
|------|------|------|
| Azure Storage Account | 存储照片和缩略图 | E5 额度覆盖 |
| Azure PostgreSQL Flexible Server (B1ms) | 数据库 | ~$15/月，E5 额度覆盖 |
| Azure App Service (B1) | 运行后端 Docker 容器 | E5 额度覆盖 |
| Azure Container Registry (Basic) | 存储 Docker 镜像 | E5 额度覆盖 |
| Azure Static Web Apps (Free) | 托管前端 SPA | 免费 |
| Auth0 (Free tier) | 用户认证 | 免费 |

## 首次部署步骤

### 1. Azure 资源创建

```powershell
# 登录 Azure（如需 MFA，指定 tenant）
az login --tenant <your-tenant-id>

# 注册资源提供商
az provider register --namespace Microsoft.ContainerRegistry --wait
az provider register --namespace Microsoft.Web --wait
az provider register --namespace Microsoft.DBforPostgreSQL --wait

# 创建 Storage Account + 容器
az storage account create --name photomapstorage --resource-group test --location eastasia --sku Standard_LRS
# 在 Portal 中手动创建 media 和 thumbnails 容器（Private 访问级别）

# 创建 ACR
az acr create --resource-group test --name photomapacr --sku Basic
az acr update --name photomapacr --admin-enabled true

# 创建 PostgreSQL
az postgres flexible-server create \
  --resource-group test --name photomap-db --location eastasia \
  --sku-name Standard_B1ms --tier Burstable --storage-size 32 --version 15 \
  --admin-user photomapuser --admin-password "YourSecurePassword" \
  --public-access 0.0.0.0 --yes

az postgres flexible-server db create \
  --resource-group test --server-name photomap-db --database-name photomap

# 创建 App Service
az appservice plan create --name photomap-plan --resource-group test --is-linux --sku B1 --location eastasia
az webapp create --resource-group test --plan photomap-plan --name photomap-api \
  --deployment-container-image-name photomapacr.azurecr.io/photomap-api:latest

# 配置 ACR 凭据
$acrUser = az acr credential show --name photomapacr --query username -o tsv
$acrPass = az acr credential show --name photomapacr --query "passwords[0].value" -o tsv
az webapp config container set --resource-group test --name photomap-api \
  --container-registry-url https://photomapacr.azurecr.io \
  --container-registry-user $acrUser --container-registry-password $acrPass

# 创建 Static Web App
az staticwebapp create --name photomap-frontend --resource-group test --location eastasia2 --sku Free
```

### 2. 配置后端环境变量

```powershell
az webapp config appsettings set --resource-group test --name photomap-api --settings \
  ENVIRONMENT=production \
  "DATABASE_URL=postgresql+asyncpg://photomapuser:YourPassword@photomap-db.postgres.database.azure.com:5432/photomap?ssl=require" \
  AUTH0_DOMAIN=your-tenant.us.auth0.com \
  AUTH0_API_AUDIENCE=https://photo-map-api.example.com \
  "AZURE_STORAGE_CONNECTION_STRING=<从 Portal 获取>" \
  AZURE_STORAGE_CONTAINER_NAME=media \
  AZURE_STORAGE_THUMBNAILS_CONTAINER=thumbnails \
  "CORS_ORIGINS=https://your-swa-domain.azurestaticapps.net" \
  DEV_AUTH_BYPASS=false \
  WEBSITES_PORT=8000
```

### 3. 构建并部署后端

```powershell
cd backend
az acr build --registry photomapacr --image photomap-api:latest .
az webapp restart --resource-group test --name photomap-api
```

### 4. 构建并部署前端

```powershell
cd frontend
# 确保 .env.production 配置正确
npm ci && npm run build

# 获取 SWA 部署 token
$token = az staticwebapp secrets list --name photomap-frontend --resource-group test --query "properties.apiKey" -o tsv
npx swa deploy ./dist --deployment-token $token --env production
```

### 5. 配置 Auth0

1. 创建 Application（类型：**Single Page Application**）
2. 创建 API（Identifier 与后端 `AUTH0_API_AUDIENCE` 一致）
3. API → Application Access → 将你的 App 的 **User Access** 设为 AUTHORIZED
4. Application → Settings → Allowed Callback URLs 填你的前端地址（如 `https://your-app.azurestaticapps.net`）
5. Application → Settings → Allowed Logout URLs 和 Allowed Web Origins 填同一地址
6. Application → Advanced Settings → Grant Types → 确认勾选 **Authorization Code**（PKCE），**不需要**也**不应该**勾选 Implicit

> **说明**：前端使用 Auth0 SPA SDK（`@auth0/auth0-react`），走 Authorization Code + PKCE 登录流程，Token 通过 silent refresh（iframe）或 redirect 方式续期。Implicit flow 已弃用，勾选它不会有帮助，反而可能带来安全隐患。

## CI/CD Pipeline

项目已配置 GitHub Actions（`.github/workflows/deploy.yml`），push 到 `master` 自动部署。

### 配置 GitHub Secrets

在 GitHub repo → Settings → Secrets and variables → Actions 中添加：

**Secrets:**
| Name | 值 | 来源 |
|------|------|------|
| `AZURE_CREDENTIALS` | Azure Service Principal JSON | `az ad sp create-for-rbac --name photomap-cicd --role contributor --scopes /subscriptions/<sub-id>/resourceGroups/test --json-auth` |
| `SWA_DEPLOYMENT_TOKEN` | SWA 部署 token | `az staticwebapp secrets list --name photomap-frontend --resource-group test --query "properties.apiKey" -o tsv` |

**Variables (非敏感):**
| Name | 值 |
|------|------|
| `VITE_API_BASE_URL` | `https://photomap-api.azurewebsites.net/api` |
| `VITE_AUTH0_DOMAIN` | `dev-ubyv1lpm1a4fqugf.us.auth0.com` |
| `VITE_AUTH0_CLIENT_ID` | `Pxlwa498YrbrgJhjK63UrijcMfvcuqAb` |
| `VITE_AUTH0_AUDIENCE` | `https://photo-map-api.example.com` |


## 部署过程中踩到的坑

### 1. Alembic migration revision ID 超过 32 字符

**现象**: `alembic upgrade head` 报 `StringDataRightTruncationError: value too long for type character varying(32)`

**原因**: Alembic 的 `alembic_version` 表的 `version_num` 列是 `varchar(32)`，revision ID 不能超过 32 字符。

**解决**: 缩短 revision ID，如 `002_drop_redundant_album_media_unique` → `002_drop_redundant_uq`。

### 2. 数据库密码含特殊字符导致连接失败

**现象**: `InvalidPasswordError: password authentication failed`

**原因**: 密码含 `@` 字符，在 URL 格式连接串中会被解析为主机名分隔符；在 App Service 环境变量中 `%40` 可能被二次解码。

**解决**: 数据库密码不要包含 `@`、`%`、`/`、`#` 等 URL 特殊字符。改为纯字母数字密码。

### 3. Alembic env.py 中 `%` 触发 configparser 插值错误

**现象**: `ValueError: invalid interpolation syntax in '...' at position 36`

**原因**: `configparser` 把连接串中的 `%` 当作插值语法。

**解决**: 在 `alembic/env.py` 中 escape：
```python
config.set_main_option("sqlalchemy.url", settings.database_url.replace("%", "%%"))
```

### 4. Docker 容器启动报 `ModuleNotFoundError: No module named 'app'`

**现象**: App Service 容器启动后立即退出，exit code 1。

**原因**: `start.sh` 中执行 `alembic upgrade head` 时，Python 找不到 `app` 模块（PYTHONPATH 未设置）。

**解决**: 在 `start.sh` 中添加 `export PYTHONPATH=/app`。

### 5. OpenStreetMap 瓦片服务 403 Blocked

**现象**: 地图显示 "Access blocked - Referer is required by tile usage policy"

**原因**: OSM 官方瓦片服务对生产环境有 Referer 和使用量限制。

**解决**: 换用 CARTO Voyager 免费瓦片：
```
https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png
```

### 6. Auth0 登录跳转后无反应

**现象**: 点击登录，跳转到 Auth0，但回来后停在登录页。

**排查步骤**:
1. 看 URL hash 里是 `#access_token=...` 还是 `#error=...`
2. 如果是 `error=invalid_request`，检查 Auth0 API 的 Application Access 是否授权了你的应用
3. 确认 Auth0 Application → Advanced Settings → Grant Types 勾选了 **Implicit**

**解决**: API → Application Access → 将应用的 User Access 设为 AUTHORIZED。

### 7. Android 手机上传照片丢失 GPS 位置

**现象**: 手机相册显示有位置，上传到平台后 GPS 为空。

**原因**: Android 13+ 的 Photo Picker 默认剥离 GPS 数据（隐私保护）。通过 Chrome 文件选择器从相册选照片时触发此机制。

**解决**:
- 选照片时切换到「文件管理器」模式而非相册模式
- 或从电脑传，绕过 Android Photo Picker

### 8. Supabase 数据库只有 IPv6 地址

**现象**: 本地和 Azure App Service 都连不上 Supabase 数据库，DNS 只返回 IPv6。

**原因**: Supabase 免费版默认只提供 IPv6 连接。大多数网络和 Azure App Service 不支持出站 IPv6。

**解决**: 改用 Azure Database for PostgreSQL Flexible Server（同区域，延迟更低，E5 额度覆盖）。

### 9. Azure 资源提供商未注册

**现象**: 创建 ACR / PostgreSQL 时报 `MissingSubscriptionRegistration`。

**解决**: 提前注册：
```powershell
az provider register --namespace Microsoft.ContainerRegistry --wait
az provider register --namespace Microsoft.Web --wait
az provider register --namespace Microsoft.DBforPostgreSQL --wait
```
