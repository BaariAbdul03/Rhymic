import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText


def send_recovery_email(to_email, pin):
    """Send a styled password recovery PIN email via Gmail SMTP.
    Falls back to console logging in dev mode (when SMTP_EMAIL is not set).
    """
    smtp_email = os.getenv("SMTP_EMAIL")
    smtp_password = os.getenv("SMTP_PASSWORD")

    if not smtp_email or not smtp_password:
        # Dev fallback — print to console
        print(f"\n{'='*50}")
        print(f"[DEV MODE] Recovery PIN for {to_email}: {pin}")
        print(f"{'='*50}\n")
        return True

    html = f"""
    <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 24px; background: #121212; color: #fff; border-radius: 16px;">
        <h1 style="color: #D4A843; margin: 0 0 8px 0;">Rhymic</h1>
        <p style="color: #888; margin: 0 0 32px 0;">Password Recovery</p>
        <p>Your 6-digit recovery PIN is:</p>
        <div style="background: #1a1a1a; border: 1px solid #D4A843; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
            <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #D4A843;">{pin}</span>
        </div>
        <p style="color: #888; font-size: 14px;">This code expires in 15 minutes. If you didn't request this, ignore this email.</p>
    </div>
    """

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = "Rhymic — Your Recovery PIN"
        msg["From"] = f"Rhymic <{smtp_email}>"
        msg["To"] = to_email
        msg.attach(MIMEText(html, "html"))

        with smtplib.SMTP("smtp.gmail.com", 587) as server:
            server.ehlo()
            server.starttls()
            server.login(smtp_email, smtp_password)
            server.sendmail(smtp_email, to_email, msg.as_string())

        print(f"[Email] Recovery PIN sent to {to_email}")
        return True

    except smtplib.SMTPAuthenticationError:
        print("[Email Error] Gmail authentication failed. Check SMTP_EMAIL and SMTP_PASSWORD (use an App Password, not your normal password).")
        return False
    except Exception as e:
        print(f"[Email Error] Failed to send to {to_email}: {e}")
        return False
