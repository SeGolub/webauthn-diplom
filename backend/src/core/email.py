import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from src.core.config import settings

logger = logging.getLogger("bioauth.email")


def send_otp_email(receiver_email: str, otp_code: str) -> None:
   
    sender_email = settings.SMTP_EMAIL
    sender_password = settings.SMTP_PASSWORD

    if not sender_email or not sender_password:
        logger.warning(
            receiver_email,
            otp_code,
        )
        return

    subject = "🔐 BioAuth — Ваш код подтверждения"

    html_body = f"""\
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
</head>
<body style="margin:0; padding:0; font-family:'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif; background-color:#0f172a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f172a; padding:40px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0"
               style="background:linear-gradient(145deg,#1e293b,#0f172a);
                      border:1px solid #334155; border-radius:16px;
                      overflow:hidden; box-shadow:0 20px 60px rgba(0,0,0,0.5);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#0ea5e9,#10b981);
                        padding:28px 32px; text-align:center;">
              <h1 style="margin:0; color:#ffffff; font-size:24px; font-weight:700;
                          letter-spacing:-0.5px;">
                🛡️ BioAuth
              </h1>
              <p style="margin:6px 0 0; color:rgba(255,255,255,0.85); font-size:13px;">
                Двухфакторная аутентификация
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 32px;">
              <p style="margin:0 0 8px; color:#e2e8f0; font-size:16px; font-weight:600;">
                Здравствуйте!
              </p>
              <p style="margin:0 0 28px; color:#94a3b8; font-size:14px; line-height:1.6;">
                Мы получили запрос на вход в вашу учётную запись.
                Используйте код ниже для завершения аутентификации:
              </p>

              <!-- OTP Code Block -->
              <div style="text-align:center; margin-bottom:28px;">
                <div style="display:inline-block;
                            background:linear-gradient(135deg,rgba(14,165,233,0.15),rgba(16,185,129,0.15));
                            border:2px solid rgba(14,165,233,0.4);
                            border-radius:12px; padding:20px 48px;">
                  <span style="font-family:'JetBrains Mono','Courier New',monospace;
                               font-size:36px; font-weight:700; letter-spacing:10px;
                               color:#0ea5e9;">
                    {otp_code}
                  </span>
                </div>
              </div>

              <p style="margin:0 0 6px; color:#94a3b8; font-size:13px; text-align:center;">
                ⏱ Код действителен <strong style="color:#e2e8f0;">{settings.OTP_TTL_SECONDS // 60} минут</strong>
              </p>

              <!-- Divider -->
              <hr style="border:none; border-top:1px solid #334155; margin:28px 0;">

              <!-- Warning -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                     style="background:rgba(239,68,68,0.08); border:1px solid rgba(239,68,68,0.25);
                            border-radius:8px; padding:14px 16px;">
                <tr>
                  <td style="color:#f87171; font-size:13px; line-height:1.5;">
                    ⚠️ Если вы <strong>не запрашивали</strong> этот код — просто
                    проигнорируйте это письмо. Никому не сообщайте код.
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px; border-top:1px solid #1e293b; text-align:center;">
              <p style="margin:0; color:#475569; font-size:12px;">
                © BioAuth · Корпоративная система аутентификации
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = sender_email
    msg["To"] = receiver_email

    plain_text = (
        f"Ваш код подтверждения BioAuth: {otp_code}\n"
        f"Код действителен {settings.OTP_TTL_SECONDS // 60} минут.\n\n"
        "Если вы не запрашивали этот код — проигнорируйте это письмо."
    )
    msg.attach(MIMEText(plain_text, "plain", "utf-8"))
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    try:
        with smtplib.SMTP(
            settings.SMTP_HOST, settings.SMTP_PORT
        ) as server:
            server.starttls()
            server.login(sender_email, sender_password)
            server.sendmail(sender_email, receiver_email, msg.as_string())

        logger.info("[EMAIL] OTP-письмо успешно отправлено на %s", receiver_email)

    except smtplib.SMTPAuthenticationError:
        logger.error(
            "[EMAIL] Ошибка аутентификации SMTP. "
            "Проверьте SMTP_EMAIL и SMTP_PASSWORD (используйте App Password для Gmail)."
        )
    except Exception as exc:
        logger.error("[EMAIL] Не удалось отправить письмо на %s: %s", receiver_email, exc)
