import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import nodemailer from "nodemailer";

// Destinataires des notifications
const NOTIFICATION_EMAILS = ["shiri@globalbg.co.il", "shimon@globalbg.co.il"];

// Create transporter only when needed (lazy initialization)
function getTransporter() {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.warn("[cart/export] Gmail credentials not configured");
    return null;
  }
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
}

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
    const transporter = getTransporter();
    if (!transporter) {
      console.log("[cart/export] Email skipped - no Gmail credentials");
      return false;
    }
    
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
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/abcd0fcc-8bc2-4074-8e73-2150e224011f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'route.ts:POST',message:'API called',data:{timestamp:new Date().toISOString()},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H1'})}).catch(()=>{});
  // #endregion
  
  try {
    let body;
    try {
      body = await request.json();
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/abcd0fcc-8bc2-4074-8e73-2150e224011f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'route.ts:body',message:'Body parsed',data:{hasBody:!!body,keys:Object.keys(body||{})},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H2'})}).catch(()=>{});
      // #endregion
    } catch (parseError: any) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/abcd0fcc-8bc2-4074-8e73-2150e224011f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'route.ts:parseError',message:'JSON parse failed',data:{error:parseError?.message},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H2'})}).catch(()=>{});
      // #endregion
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    
    const { shopName, firstName, phone, salespersonName, items, totalPrice } = body;

    if (!shopName || !firstName || !items || items.length === 0) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/abcd0fcc-8bc2-4074-8e73-2150e224011f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'route.ts:validation',message:'Validation failed',data:{shopName:!!shopName,firstName:!!firstName,itemsLen:items?.length},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H2'})}).catch(()=>{});
      // #endregion
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
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/abcd0fcc-8bc2-4074-8e73-2150e224011f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'route.ts:beforeInsert',message:'Before Supabase insert',data:{shopName,firstName,itemsCount:items.length},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H3'})}).catch(()=>{});
    // #endregion
    
    const { data, error } = await supabaseServer
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
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/abcd0fcc-8bc2-4074-8e73-2150e224011f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'route.ts:supabaseError',message:'Supabase insert failed',data:{error:error.message,code:error.code},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H3'})}).catch(()=>{});
      // #endregion
      console.error("[cart/export] Error inserting cart export:", error);
      return NextResponse.json(
        { error: "Failed to save cart export", details: `Supabase: ${error.message} (${error.code})` },
        { status: 500 }
      );
    }
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/abcd0fcc-8bc2-4074-8e73-2150e224011f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'route.ts:insertSuccess',message:'Supabase insert OK',data:{id:data.id},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H3'})}).catch(()=>{});
    // #endregion

    // Send email notification (non-blocking - order is already saved)
    try {
      await sendNotificationEmail({
        id: data.id,
        shopName,
        firstName,
        phone,
        salespersonName,
        items,
        totalPrice,
      });
    } catch (emailError) {
      // Email failed but order is saved - don't fail the request
      console.error("[cart/export] Email notification failed:", emailError);
    }

    return NextResponse.json({ success: true, id: data.id });
  } catch (error: any) {
    console.error("[cart/export] Error:", error);
    // Return detailed error for debugging
    return NextResponse.json(
      { 
        error: "Internal server error", 
        details: error?.message || "Unknown error",
        stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined
      },
      { status: 500 }
    );
  }
}
