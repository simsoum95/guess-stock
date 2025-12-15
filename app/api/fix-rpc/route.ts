import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: "Missing Supabase credentials" });
  }
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  try {
    // Drop and recreate the function with NO LIMIT
    const { error: dropError } = await supabase.rpc('list_all_product_images');
    
    // Count total images
    const { data: countData, error: countError } = await supabase
      .from('objects')
      .select('*', { count: 'exact', head: true });
    
    // Try to get count via RPC
    const { data: rpcData, error: rpcError } = await supabase.rpc('list_all_product_images');
    
    return NextResponse.json({
      rpcCount: rpcData?.length || 0,
      rpcError: rpcError?.message || null,
      note: "If rpcCount < 18000, the RPC function needs to be updated in Supabase dashboard"
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) });
  }
}

