import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function GET() {
  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD;

  // Debug: Check if env vars are set
  console.log("[test-gmail] GMAIL_USER:", gmailUser ? "SET" : "NOT SET");
  console.log("[test-gmail] GMAIL_APP_PASSWORD:", gmailPass ? "SET (length: " + gmailPass.length + ")" : "NOT SET");

  if (!gmailUser || !gmailPass) {
    return NextResponse.json({
      error: "Missing Gmail credentials",
      details: {
        GMAIL_USER: gmailUser ? "SET" : "NOT SET",
        GMAIL_APP_PASSWORD: gmailPass ? "SET" : "NOT SET",
      },
    }, { status: 500 });
  }

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: gmailUser,
        pass: gmailPass,
      },
    });

    // Verify connection
    await transporter.verify();
    console.log("[test-gmail] SMTP connection verified");

    // Send test email
    const info = await transporter.sendMail({
      from: `"GUESS Israel Test" <${gmailUser}>`,
      to: "shiri@globalbg.co.il, shimon@globalbg.co.il",
      subject: `🧪 Test Email - ${new Date().toLocaleString("he-IL")}`,
      html: `
        <div style="font-family: Arial, sans-serif; direction: rtl; padding: 20px;">
          <h2>✅ בדיקת מערכת התראות</h2>
          <p>אם קיבלתם את המייל הזה, המערכת עובדת בהצלחה!</p>
          <p>נשלח בתאריך: ${new Date().toLocaleString("he-IL")}</p>
        </div>
      `,
    });

    console.log("[test-gmail] Email sent:", info.messageId);

    return NextResponse.json({
      success: true,
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
    });
  } catch (error: unknown) {
    console.error("[test-gmail] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({
      error: "Failed to send email",
      details: errorMessage,
    }, { status: 500 });
  }
}

