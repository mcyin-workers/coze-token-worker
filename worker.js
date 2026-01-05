// Cloudflare Workers 环境下的扣子动态令牌生成器
export default {
  async fetch(request, env) {
    try {
      // 1. 从环境变量获取配置（生产环境需通过 Workers Secrets 管理）
      const config = {
        clientId: String(env.CLIENT_ID), // OAuth 应用ID
        privateKey: String(env.PRIVATE_KEY), // 私钥（PEM格式）
        kid: String(env.KID), // 公钥指纹
        audience: String(env.AUDIENCE || "api.coze.cn"), //Oauth 应用 API端点
        tokenEndpoint: String(env.TOKEN_ENDPOINT || "https://api.coze.cn/api/permission/oauth2/token"), //获取 Oauth Access Token API端点
        tokenDuration: Number.parseInt(env.TOKEN_DURATION || 900) //令牌有效期（秒）
      };

      // 2. 生成 JWT（使用 Web Crypto API 适配边缘环境）
      const jwt = await generateJWT(config, request);

      // 3. 调用扣子 API 获取访问令牌
      const tokenResponse = await fetch(config.tokenEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${jwt}`
        },
        body: JSON.stringify({
          grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
          duration_seconds: config.tokenDuration  //令牌有效期
        })
      });

      // 4. 处理响应并返回 JSON 结果
      if (!tokenResponse.ok) {
        const error = await tokenResponse.json();
        return new Response(JSON.stringify({
          error: error.msg || "获取令牌失败",
          code: error.code || tokenResponse.status
        }), { status: 401 });
      }

      const { access_token, expires_in } = await tokenResponse.json();
      return new Response(JSON.stringify({
        access_token,
        expires_in,
        token_type: "Bearer"
      }), {
        headers: { "Content-Type": "application/json" }
      });

    } catch (e) {
      return new Response(JSON.stringify({
        error: e.message,
        code: "WORKER_ERROR"
      }), { status: 500 });
    }
  }
};

// JWT 生成核心函数（适配 Cloudflare Workers 加密环境）
async function generateJWT(config, request) {
  // 解析 PEM 格式私钥
  const privateKey = await parsePrivateKey(config.privateKey);

  // 构建 JWT Payload（支持会话隔离）
  const payload = {
    iss: config.clientId,
    aud: config.audience,
    iat: Math.floor(Date.now() / 1000), // JWT有效期开始
    exp: Math.floor(Date.now() / 1000) + 3600, // JWT有效期1小时
    jti: crypto.randomUUID(),
    // 会话隔离：从请求头获取业务用户ID（需前端配合传入）
    session_name: request.headers.get("X-User-ID") || "default-session"
  };

  // 构建 JWT Header
  const header = {
    alg: "RS256",
    typ: "JWT",
    kid: config.kid
  };

  // 生成签名
  const encoder = new TextEncoder();
  const input = `${b64url(encoder.encode(JSON.stringify(header)))}.${b64url(encoder.encode(JSON.stringify(payload)))}`;
  const signature = await crypto.subtle.sign(
    { name: "RSASSA-PKCS1-v1_5" },
    privateKey,
    encoder.encode(input)
  );

  return `${input}.${b64url(signature)}`;
}

// 工具函数：PEM 私钥解析
async function parsePrivateKey(pem) {
  const keyData = pem.replace(/-----BEGIN (?:RSA )?PRIVATE KEY-----/, "")
    .replace(/-----END (?:RSA )?PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const binaryKey = Uint8Array.from(atob(keyData), c => c.charCodeAt(0));
  return await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

// 工具函数：Base64URL 编码
function b64url(data) {
  if (typeof data === "string") data = new TextEncoder().encode(data);
  return btoa(String.fromCharCode(...new Uint8Array(data)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}