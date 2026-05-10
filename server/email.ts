import nodemailer from "nodemailer";

// To make this work, the user must run: npm install nodemailer @types/nodemailer
// And configure these variables in the .env file

const SMTP_CONFIG = {
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "465"),
  secure: process.env.SMTP_SECURE !== "false", // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
};

export async function sendEmail({ to, subject, text }: { to: string; subject: string; text: string }) {
  if (!SMTP_CONFIG.auth.user || !SMTP_CONFIG.auth.pass) {
    console.warn("[Email Service] SMTP credentials not configured. Email not sent.");
    console.log(`[Mock Email] To: ${to}\nSubject: ${subject}\nBody: ${text}`);
    return { success: false, message: "Credentials missing" };
  }

  try {
    const transporter = nodemailer.createTransport(SMTP_CONFIG);
    
    await transporter.sendMail({
      from: `"Hospital Monitor" <${SMTP_CONFIG.auth.user}>`,
      to,
      subject,
      text,
    });

    console.log(`[Email Service] Email sent successfully to ${to}`);
    return { success: true };
  } catch (error) {
    console.error("[Email Service] Failed to send email:", error);
    return { success: false, error };
  }
}
