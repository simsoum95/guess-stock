import { NextResponse } from "next/server";
import { Resend } from "resend";

export async function GET() {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json({ 
        error: "RESEND_API_KEY not configured",
        hasKey: false 
      }, { status: 500 });
    }

    const resend = new Resend(apiKey);
    
    const { data, error } = await resend.emails.send({
      from: "GUESS Israel <onboarding@resend.dev>",
      to: ["shimonhaliwa@gmail.com"],
      subject: "🧪 Test - Notification GUESS Israel",
      html: `
        <div dir="rtl" style="font-family: Arial, sans-serif; padding: 20px;">
          <h1>✅ הבדיקה הצליחה!</h1>
          <p>אם אתם רואים את ההודעה הזו, המערכת עובדת כמו שצריך.</p>
          <p>מעכשיו תקבלו התראה על כל הזמנה חדשה.</p>
        </div>
      `,
    });

    if (error) {
      return NextResponse.json({ 
        error: error.message,
        details: error 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: "Email sent successfully!",
      emailId: data?.id 
    });
  } catch (error) {
    return NextResponse.json({ 
      error: String(error),
      type: "exception"
    }, { status: 500 });
  }
}

