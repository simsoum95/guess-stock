import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import nodemailer from "nodemailer";

// Configuration Gmail
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

// Destinataires des notifications
const NOTIFICATION_EMAILS = ["shiri@globalbg.co.il", "shimon@globalbg.co.il"];

async function sendNotificationEmail(orderData: {
  id: number;
  shopName: string;
  firstName: string;
  phone?: string;
  salespersonName?: string;
  items: Array<{ name: string; sku: string; quantity: number; price: number }>;
  totalPrice: number;
}) {
  const itemsList = orderData.items
    .map((item) => `• ${item.name} (${item.sku}) x${item.quantity} - ₪${item.price}`)
    .join("\n");

  const emailHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; direction: rtl;">
      <h2 style="color: #333; border-bottom: 2px solid #e5a00d; padding-bottom: 10px;">
        📦 בקשת הצעת מחיר חדשה #${orderData.id}
      </h2>
      
      <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 15px 0;">
        <h3 style="margin-top: 0; color: #555;">פרטי הלקוח:</h3>
        <p><strong>שם החנות:</strong> ${orderData.shopName}</p>
        <p><strong>שם פרטי:</strong> ${orderData.firstName}</p>
        ${orderData.phone ? `<p><strong>טלפון:</strong> ${orderData.phone}</p>` : ""}
        ${orderData.salespersonName ? `<p><strong>שם הסוכן:</strong> ${orderData.salespersonName}</p>` : ""}
      </div>
      
      <div style="background: #fff; border: 1px solid #ddd; padding: 15px; border-radius: 8px; margin: 15px 0;">
        <h3 style="margin-top: 0; color: #555;">פריטים בהזמנה:</h3>
        <pre style="white-space: pre-wrap; font-family: Arial, sans-serif;">${itemsList}</pre>
      </div>
      
      <div style="background: #e5a00d; color: #000; padding: 15px; border-radius: 8px; text-align: center;">
        <h3 style="margin: 0;">סה"כ: ₪${orderData.totalPrice.toLocaleString()}</h3>
      </div>
      
      <p style="color: #666; font-size: 12px; margin-top: 20px; text-align: center;">
        התחברו לפאנל הניהול לצפייה בפרטים המלאים
      </p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"GUESS Israel" <${process.env.GMAIL_USER}>`,
      to: NOTIFICATION_EMAILS.join(", "),
      subject: `📦 בקשת הצעת מחיר חדשה #${orderData.id} - ${orderData.shopName}`,
      html: emailHtml,
    });
    console.log("[cart/export] Email notification sent successfully");
    return true;
  } catch (error) {
    console.error("[cart/export] Error sending email:", error);
    return false;
  }
}

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
        viewed: false,
        status: "pending",
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

    // Send email notification (don't block the response)
    sendNotificationEmail({
      id: data.id,
      shopName,
      firstName,
      phone,
      salespersonName,
      items,
      totalPrice,
    });

    return NextResponse.json({ success: true, id: data.id });
  } catch (error) {
    console.error("[cart/export] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
