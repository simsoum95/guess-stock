import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const modelRef = searchParams.get("modelRef") || "PD760221";
  
  // Use service role to access storage.objects directly
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: "Missing Supabase credentials" });
  }
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  try {
    // Direct SQL query to find ALL images matching modelRef
    const { data, error } = await supabase
      .from('storage.objects')
      .select('name')
      .eq('bucket_id', 'guess-images')
      .ilike('name', `%${modelRef}%`)
      .limit(100);
    
    if (error) {
      // Try RPC approach
      const { data: rpcData, error: rpcError } = await supabase.rpc('search_images', { 
        search_prefix: modelRef 
      });
      
      if (rpcError) {
        // Fallback: list files with search
        const { data: listData, error: listError } = await supabase.storage
          .from("guess-images")
          .list("products", { 
            limit: 100, 
            search: modelRef 
          });
        
        if (listError) {
          return NextResponse.json({ 
            error: "All methods failed", 
            details: { 
              sqlError: error.message, 
              rpcError: rpcError.message, 
              listError: listError.message 
            } 
          });
        }
        
        return NextResponse.json({
          method: "Storage list with search",
          modelRef,
          count: listData?.length || 0,
          files: listData?.map(f => f.name) || []
        });
      }
      
      return NextResponse.json({
        method: "RPC search_images",
        modelRef,
        count: rpcData?.length || 0,
        files: rpcData || []
      });
    }
    
    return NextResponse.json({
      method: "Direct SQL",
      modelRef,
      count: data?.length || 0,
      files: data?.map((r: any) => r.name) || []
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) });
  }
}

