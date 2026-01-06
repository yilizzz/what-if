import { defineEndpoint } from "@directus/extensions-sdk";
import crypto from "crypto";
import { Resend } from "resend";

/**
 * PIN Reset Endpoint
 *
 * Routes:
 * - POST /pin-reset/request - Request PIN reset email
 * - GET /pin-reset/verify/:token - Verify reset token validity
 * - POST /pin-reset/complete - Complete PIN reset and return new password
 */
export default defineEndpoint(
  (router, { services, getSchema, env, database }) => {
    const { ItemsService, UsersService } = services;
    const resend = new Resend(env.RESEND_API_KEY);

    /**
     * Generate secure random token
     */
    function generateResetToken() {
      return crypto.randomBytes(32).toString("hex");
    }

    /**
     * Generate secure random password
     */
    function generatePassword() {
      return crypto.randomBytes(32).toString("hex");
    }

    /**
     * Hash token for secure storage
     */
    function hashToken(token) {
      return crypto.createHash("sha256").update(token).digest("hex");
    }

    /**
     * POST /pin-reset/request
     * Request PIN reset - sends email with reset link
     */
    router.post("/request", async (req, res) => {
      try {
        const { email } = req.body;

        if (!email) {
          return res.status(400).json({ error: "Email is required" });
        }

        const schema = await getSchema({ database });
        const usersService = new UsersService({ schema, accountability: null });

        // Find user by email
        const users = await usersService.readByQuery({
          filter: { email: { _eq: email } },
          limit: 1,
        });

        // Always return success to prevent email enumeration
        if (!users || users.length === 0) {
          return res.json({
            message: "If the email exists, a reset link has been sent",
            success: true,
          });
        }

        const user = users[0];
        const resetToken = generateResetToken();
        const tokenHash = hashToken(resetToken);
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        // Create reset token record
        const tokensService = new ItemsService("pin_reset_tokens", {
          schema,
          accountability: null,
        });

        await tokensService.createOne({
          user: user.id,
          token_hash: tokenHash,
          expires_at: expiresAt,
          used: 0,
        });

        const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
        const resetLink = `${frontendUrl}/#/pin-reset?token=${resetToken}&email=${encodeURIComponent(
          email
        )}`;

        // 异步发送邮件，不阻塞主请求
        (async () => {
          try {
            const result = await Promise.race([
              resend.emails.send({
                from: process.env.EMAIL_FROM || "onboarding@resend.dev",
                to: email,
                subject: "What if---PIN Reset Request",
                html: `
					<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
						<h2 style="color: #2c3e50;">What if---PIN Reset Request</h2>
						<p style="color: #34495e; line-height: 1.6;">You requested to reset your PIN code. Click the link below to proceed:</p>
						<p style="color: #e74c3c; font-weight: bold; line-height: 1.6;">⚠️ If you have already installed PWA, please open this link in your app afterwards. Do not reset it in the browser embedded in the email, otherwise the data will not be synchronized.</p>
						<p style="margin: 30px 0;">
							<a href="${resetLink}" style="background-color: #3498db; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset PIN</a>
						</p>
						<p style="color: #7f8c8d; font-size: 14px;">This link will expire in 10 minutes.</p>
						<p style="color: #95a5a6; font-size: 12px;">If you did not request this, please ignore this email.</p>
					</div>
				`,
              }),
              // 邮件发送超时 10秒
              new Promise((_, reject) =>
                setTimeout(() => reject(new Error("Email send timeout")), 10000)
              ),
            ]);

            // 检查Resend返回的错误
            if (result.error) {
              console.warn(
                `[PIN Reset] Resend error: ${JSON.stringify(result.error)}`
              );
            } else {
              console.log(
                `[PIN Reset] Email sent successfully to ${email}, ID: ${result.data?.id}`
              );
            }
          } catch (emailError) {
            console.error(
              `[PIN Reset] Email send failed: ${emailError.message}`,
              emailError
            );
            console.log(`[PIN Reset] Reset link: ${resetLink}`);
          }
        })();

        res.json({
          message: "If the email exists, a reset link has been sent",
          success: true,
        });
      } catch (error) {
        console.error("PIN reset request error:", error);
        res.status(500).json({ error: "Failed to process reset request" });
      }
    });

    /**
     * GET /pin-reset/verify/:token
     * Verify if reset token is valid
     */
    router.get("/verify/:token", async (req, res) => {
      try {
        const { token } = req.params;
        const { email } = req.query;

        if (!token || !email) {
          return res.status(400).json({
            valid: false,
            error: "Token and email are required",
          });
        }

        const tokenHash = hashToken(token);
        const schema = await getSchema({ database });
        const usersService = new UsersService({ schema, accountability: null });

        // Find user by email
        const users = await usersService.readByQuery({
          filter: { email: { _eq: email } },
          limit: 1,
        });

        if (!users || users.length === 0) {
          return res.json({
            valid: false,
            error: "Invalid or expired token",
          });
        }

        const user = users[0];

        // Check token validity
        const tokensService = new ItemsService("pin_reset_tokens", {
          schema,
          accountability: null,
        });

        const tokens = await tokensService.readByQuery({
          filter: {
            user: { _eq: user.id },
            token_hash: { _eq: tokenHash },
            used: { _eq: 0 },
            expires_at: { _gt: new Date().toISOString() },
          },
          limit: 1,
        });

        if (!tokens || tokens.length === 0) {
          return res.json({
            valid: false,
            error: "Invalid or expired token",
          });
        }

        res.json({ valid: true });
      } catch (error) {
        console.error("PIN reset verify error:", error);
        res.status(500).json({
          valid: false,
          error: "Failed to verify token",
        });
      }
    });

    /**
     * POST /pin-reset/complete
     * Complete PIN reset - generates new password and returns it
     */
    router.post("/complete", async (req, res) => {
      try {
        const { token, email } = req.body;

        if (!token || !email) {
          return res.status(400).json({
            error: "Token and email are required",
          });
        }

        const tokenHash = hashToken(token);
        const schema = await getSchema({ database });
        const usersService = new UsersService({ schema, accountability: null });

        // Find user by email
        const users = await usersService.readByQuery({
          filter: { email: { _eq: email } },
          limit: 1,
        });

        if (!users || users.length === 0) {
          return res.status(400).json({
            error: "Invalid or expired token",
          });
        }

        const user = users[0];

        // Find and validate token
        const tokensService = new ItemsService("pin_reset_tokens", {
          schema,
          accountability: null,
        });

        const tokens = await tokensService.readByQuery({
          filter: {
            user: { _eq: user.id },
            token_hash: { _eq: tokenHash },
            used: { _eq: 0 },
            expires_at: { _gt: new Date().toISOString() },
          },
          limit: 1,
        });

        if (!tokens || tokens.length === 0) {
          return res.status(400).json({
            error: "Invalid or expired token",
          });
        }

        const tokenRecord = tokens[0];

        // // Generate new password
        // const newPassword = generatePassword();

        // // Update user password
        // await usersService.updateOne(user.id, {
        //   password: newPassword,
        // });

        // // Mark token as used
        // await tokensService.updateOne(tokenRecord.id, {
        //   used: 1,
        // });

        // // Return new password to client for re-encryption with new PIN
        // res.json({
        //   success: true,
        //   message: "PIN reset successful",
        //   email: user.email,
        //   password: newPassword,
        // });
        // 生成新密码
        const newPassword = generatePassword();
        console.log("[PIN Reset] Updating password for user:", user.id);

        // 更新用户密码
        try {
          await usersService.updateOne(user.id, {
            password: newPassword,
          });
          console.log(
            "[PIN Reset] Password updated successfully for user:",
            user.id
          );
        } catch (error) {
          console.error("[PIN Reset] Failed to update password:", error);
          throw error;
        }

        // 标记token为已使用
        try {
          await tokensService.updateOne(tokenRecord.id, {
            used: 1,
          });
          console.log("[PIN Reset] Token marked as used");
        } catch (error) {
          console.error("[PIN Reset] Failed to mark token as used:", error);
        }

        console.log("[PIN Reset] Returning new password for email:", email);
        // 返回新密码到客户端
        res.json({
          success: true,
          message: "PIN reset successful",
          email: user.email,
          password: newPassword,
        });
      } catch (error) {
        console.error("PIN reset complete error:", error);
        res.status(500).json({ error: "Failed to complete reset" });
      }
    });
  }
);
