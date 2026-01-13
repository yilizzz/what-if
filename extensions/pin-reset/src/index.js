import { defineEndpoint } from "@directus/extensions-sdk";
import crypto from "crypto";
import { send as sendEmailJs } from "@emailjs/nodejs";

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

    /**
     * Generate secure random token
     */
    function generateResetToken() {
      return crypto.randomBytes(32).toString("hex");
    }

    /**
     * Send reset email via EmailJS
     */
    async function sendResetEmail({ to, resetLink }) {
      if (
        !process.env.EMAIL_SERVICE_ID ||
        !process.env.EMAIL_TEMPLATE_PIN_RESET ||
        !process.env.EMAIL_PUBLIC_KEY
      ) {
        throw new Error(
          "EmailJS config missing: EMAIL_SERVICE_ID, EMAIL_TEMPLATE_PIN_RESET, EMAIL_PUBLIC_KEY required"
        );
      }

      const templateParams = {
        email_address: to,
        reset_link: resetLink,
      };

      const sendOptions = process.env.EMAIL_PRIVATE_KEY
        ? {
            publicKey: process.env.EMAIL_PUBLIC_KEY,
            privateKey: process.env.EMAIL_PRIVATE_KEY,
          }
        : { publicKey: process.env.EMAIL_PUBLIC_KEY };

      return Promise.race([
        sendEmailJs(
          process.env.EMAIL_SERVICE_ID,
          process.env.EMAIL_TEMPLATE_PIN_RESET,
          templateParams,
          sendOptions
        ),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Email send timeout")), 10000)
        ),
      ]);
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
            const result = await sendResetEmail({
              to: email,
              resetLink,
            });
            console.log(`[PIN Reset] Email sent to ${email}`, result);
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
