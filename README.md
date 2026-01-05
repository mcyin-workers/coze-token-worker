# 扣子动态令牌生成器 - Cloudflare Workers

Cloudflare Workers 环境下的扣子（Coze）动态令牌生成器，用于生成访问扣子 API 的 OAuth 2.0 访问令牌。

## 功能特性

- ✅ 基于 Cloudflare Workers 边缘计算平台
- ✅ 使用 RSA256 算法生成 JWT
- ✅ 自动调用扣子 API 获取访问令牌
- ✅ 支持会话隔离（通过 X-User-ID 请求头）
- ✅ 环境变量配置，安全可靠
- ✅ 可配置令牌有效期，默认15分钟

## 部署指南

### 1. 安装 Wrangler CLI

```bash
npm install -g wrangler
```

### 2. 登录 Cloudflare

```bash
wrangler login
```

### 3. 初始化项目（可选）

如果您还没有创建项目，可以使用以下命令初始化：

```bash
wrangler init coze-token-worker
```

### 4. 部署 Workers

```bash
wrangler deploy worker.js
```

## 绑定域名

### 前提条件

- 您需要拥有一个在 Cloudflare 上托管的域名
- 该域名已添加到您的 Cloudflare 账户中

### 绑定步骤

1. 登录 [Cloudflare 控制台](https://dash.cloudflare.com/)
2. 进入 **Workers & Pages**
3. 选择您部署的 Worker
4. 在导航栏中点击 **设置**
5. 找到 **域和路由** 部分，点击 **添加**
6. 在弹窗里点击**自定义域**，然后在输入框中输入您要绑定的域名（例如：`token.example.com`）
7. 点击 **添加域名**
8. 等待 Cloudflare 完成域名验证和 SSL 证书颁发（通常需要几分钟）

### 验证域名绑定

绑定完成后，您可以使用以下命令验证域名是否正常工作：

```bash
curl -X POST https://token.example.com/
```

如果返回包含 `access_token` 的 JSON 响应，则说明域名绑定成功。

## 环境变量配置

### 获取配置信息

要配置环境变量，您需要先从扣子开放平台获取以下信息：

#### 1. 登录扣子开放平台

访问 [扣子开放平台](https://www.coze.cn/open/oauth/apps) 并使用您的账号登录。

#### 2. 创建或选择 OAuth 应用

- 如果您还没有创建应用，点击 "创建应用"，填写应用信息并提交
- 如果您已有应用，在应用列表中选择需要使用的应用

#### 3. 获取 CLIENT_ID

在应用详情页面的 "基本信息" 或 "OAuth 配置" 部分，找到并复制 `应用ID`（即 CLIENT_ID）。

#### 4. 生成和获取密钥对

1. 进入应用的 "API 配置" 或 "OAuth 配置" 页面
2. 找到 "公钥管理" 或 "密钥管理" 部分
3. 点击 "生成密钥对" 或 "创建公钥"
4. 系统会生成一对 RSA 密钥（公钥和私钥）
5. 复制并保存私钥（PEM格式），这将作为您的 `PRIVATE_KEY`
6. 复制并保存公钥指纹（KID），这将作为您的 `KID`

> **注意**：私钥只会显示一次，请务必妥善保存，不要泄露给他人。

#### 5. 参考文档

更多详细信息，请参考 [扣子官方文档](https://www.coze.cn/open/docs/developer_guides/oauth_jwt)。

### 配置环境变量

在 Cloudflare Workers 控制台中配置以下环境变量：

| 变量名 | 类型 | 描述 | 必填 |
|--------|------|------|------|
| CLIENT_ID | String | OAuth 应用 ID | ✅ |
| PRIVATE_KEY | String | 私钥（PEM格式） | ✅ |
| KID | String | 公钥指纹 | ✅ |
| AUDIENCE | String | OAuth 应用 API 端点，默认：api.coze.cn | ❌ |
| TOKEN_ENDPOINT | String | 获取 OAuth Access Token API 端点，默认：https://api.coze.cn/api/permission/oauth2/token | ❌ |
| TOKEN_DURATION | Integer | 申请的 AccessToken 有效期，单位为秒，默认 900 秒，即 15 分钟。最大可设置为 86399 秒，即 24 小时。 | ❌ |

### 配置方法

1. 登录 [Cloudflare 控制台](https://dash.cloudflare.com/)
2. 进入 Workers & Pages
3. 选择您的 Worker
4. 点击 "设置" -> "变量"
5. 在 "环境变量" 或 "机密变量" 中添加上述变量

## 使用方法

### 发送请求

```bash
curl -X POST https://your-worker-url.workers.dev/
```

### 带会话隔离

```bash
curl -X POST https://your-worker-url.workers.dev/ -H "X-User-ID: user123"
```

### 响应示例

```json
{
  "access_token": "czs_RQOhsc7vmUzK4bNgb7hn4wqOgRBYAO6xvpFHNbnl6RiQJX3cSXSguIhFDzgy****",
  "expires_in": 1721135859,
  "token_type": "Bearer"
}
```

## 工作原理

1. **生成 JWT**：使用环境变量中的私钥和配置生成 JWT
2. **调用扣子 API**：使用生成的 JWT 调用扣子的 OAuth 2.0 令牌端点
3. **返回令牌**：将获取到的访问令牌返回给客户端

## 注意事项

1. **私钥安全**：请务必将私钥存储在 Cloudflare Workers 机密变量中，不要直接硬编码在代码中
2. **令牌有效期**：JWT 有效期为 1 小时，访问令牌有效期可通过 TOKEN_DURATION 环境变量配置，默认15分钟
3. **会话隔离**：通过 X-User-ID 请求头可以实现不同用户的会话隔离
4. **错误处理**：当获取令牌失败时，会返回详细的错误信息

## 技术栈

- Cloudflare Workers
- Web Crypto API
- OAuth 2.0 JWT Bearer Grant

## 许可证

MIT License
