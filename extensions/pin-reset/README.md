# PIN Reset Extension

用于前端 PIN 码丢失情况下，恢复登录的 endpoint。

## 功能特性

✅ **恢复验证** - 邮箱 + OTP 二因素验证  
✅ **重置后登录** - 手动登录确认  
✅ **令牌管理** - 短期有效(10 分钟) + Server 端验证

## API 端点

### POST /pin-reset/request

请求 PIN 重置，发送重置邮件

**请求体:**

```json
{
  "email": "user@example.com"
}
```

**响应:**

```json
{
  "success": true,
  "message": "If the email exists, a reset link has been sent"
}
```

### GET /pin-reset/verify/:token

验证重置令牌是否有效

**查询参数:**

- `email`: 用户邮箱

**响应:**

```json
{
  "valid": true
}
```

### POST /pin-reset/complete

完成 PIN 重置，生成新密码

**请求体:**

```json
{
  "token": "reset_token",
  "email": "user@example.com"
}
```

**响应:**

```json
{
  "success": true,
  "message": "PIN reset successful",
  "email": "user@example.com",
  "password": "new_generated_password"
}
```

## 安全特性

- **Token 哈希存储**: 重置令牌使用 SHA-256 哈希后存储
- **短期有效**: 令牌 10 分钟后自动过期
- **一次性使用**: 令牌使用后自动标记为已使用
- **防邮箱枚举**: 无论邮箱是否存在都返回相同消息
- **Server 端验证**: 所有验证在服务端完成

## 工作流程

1. **用户请求重置**: 前端调用 `/pin-reset/request` 发送邮箱
2. **接收邮件**: 用户收到包含重置链接的邮件
3. **验证令牌**: 前端调用 `/pin-reset/verify/:token` 验证令牌
4. **完成重置**: 前端调用 `/pin-reset/complete` 获取新密码
5. **手动登录**: 用户使用邮箱和新密码手动登录

## 配置邮件服务

### 开发环境 - Mailpit (推荐)

已在 `docker-compose.yml` 中配置了 Mailpit 服务：

```yaml
mailpit:
  image: axllent/mailpit
  ports:
    - "8025:8025" # Web界面
    - "1025:1025" # SMTP端口
```

**使用方式:**

1. 启动服务: `docker compose up -d`
2. 访问邮件界面: http://localhost:8025
3. 所有邮件都会被捕获并显示在 Web 界面中

### 生产环境 - 真实 SMTP

在 `docker-compose.yml` 的 `directus` 服务中配置：

```yaml
# Gmail 示例
EMAIL_FROM: noreply@yourdomain.com
EMAIL_TRANSPORT: smtp
EMAIL_SMTP_HOST: smtp.gmail.com
EMAIL_SMTP_PORT: 587
EMAIL_SMTP_USER: your-email@gmail.com
EMAIL_SMTP_PASSWORD: your-app-password
EMAIL_SMTP_SECURE: true
```

**其他常用 SMTP 服务:**

- **Outlook**: smtp-mail.outlook.com:587
- **SendGrid**: smtp.sendgrid.net:587
- **阿里云邮件**: smtpdm.aliyun.com:465
