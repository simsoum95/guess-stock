import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { Resend } from "resend";

// Email address to notify (Resend free tier only allows sending to account owner)
const NOTIFICATION_EMAILS = ["shimonhaliwa@gmail.com"];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { shopName, firstName, phone, salespersonName, items, totalPrice } = body;

    if (!shopName || !firstName || !items || items.length === 0) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Get IP address (if available)
    const ipAddress = request.headers.get("x-forwarded-for") || 
                     request.headers.get("x-real-ip") || 
                     null;

    // Insert into Supabase
    const { data, error } = await supabase
      .from("cart_exports")
      .insert({
        shop_name: shopName,
        first_name: firstName,
        phone: phone || null,
        salesperson_name: salespersonName || null,
        items: items,
        total_price: totalPrice,
        ip_address: ipAddress,
        viewed: false, // New orders are unread by default
        status: "pending", // New orders are pending by default
      })
      .select()
      .single();

    if (error) {
      console.error("[cart/export] Error inserting cart export:", error);
      return NextResponse.json(
        { error: "Failed to save cart export" },
        { status: 500 }
      );
    }

    // Send email notification
    try {
      const totalItems = items.reduce((sum: number, item: { quantity: number }) => sum + item.quantity, 0);
      
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: "GUESS Israel <notifications@resend.dev>",
        to: NOTIFICATION_EMAILS,
        subject: `🛒 בקשת הצעת מחיר חדשה - ${shopName}`,
        html: `
          <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #1a1a1a 0%, #333 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="margin: 0; font-size: 24px;">🛒 בקשת הצעת מחיר חדשה!</h1>
            </div>
            
            <div style="background: #f9f9f9; padding: 30px; border: 1px solid #eee;">
              <h2 style="color: #333; margin-top: 0;">פרטי הלקוח:</h2>
              
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #eee; font-weight: bold;">שם החנות:</td>
                  <td style="padding: 10px 0; border-bottom: 1px solid #eee;">${shopName}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #eee; font-weight: bold;">שם פרטי:</td>
                  <td style="padding: 10px 0; border-bottom: 1px solid #eee;">${firstName}</td>
                </tr>
                ${phone ? `
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #eee; font-weight: bold;">טלפון:</td>
                  <td style="padding: 10px 0; border-bottom: 1px solid #eee;">${phone}</td>
                </tr>
                ` : ''}
                ${salespersonName ? `
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #eee; font-weight: bold;">שם הסוכן:</td>
                  <td style="padding: 10px 0; border-bottom: 1px solid #eee;">${salespersonName}</td>
                </tr>
                ` : ''}
              </table>
              
              <div style="background: white; padding: 20px; margin-top: 20px; border-radius: 8px; border: 1px solid #eee;">
                <h3 style="margin-top: 0; color: #333;">סיכום ההזמנה:</h3>
                <p style="font-size: 18px; margin: 10px 0;">
                  <strong>${totalItems}</strong> פריטים
                </p>
                <p style="font-size: 24px; color: #2563eb; margin: 10px 0;">
                  <strong>₪${Number(totalPrice).toFixed(2)}</strong>
                </p>
              </div>
              
              <div style="text-align: center; margin-top: 30px; background: #f0f0f0; padding: 15px; border-radius: 8px;">
                <p style="margin: 0; font-weight: bold;">לצפייה בבקשה, היכנס לפאנל הניהול:</p>
                <p style="margin: 10px 0 0 0; color: #666;">gb-guess-stock.vercel.app/admin/orders</p>
              </div>
            </div>
            
            <div style="background: #333; color: #999; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; font-size: 12px;">
              הודעה זו נשלחה אוטומטית ממערכת GUESS Israel
            </div>
          </div>
        `,
      });
      console.log("[cart/export] Email notification sent successfully");
    } catch (emailError) {
      // Don't fail the request if email fails, just log it
      console.error("[cart/export] Error sending email notification:", emailError);
    }

    return NextResponse.json({ success: true, id: data.id });
  } catch (error) {
    console.error("[cart/export] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

