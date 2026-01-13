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
