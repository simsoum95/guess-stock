"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function RefreshOnMount() {
  const router = useRouter();

  useEffect(() => {
    // Force refresh of server components when component mounts
    router.refresh();
  }, [router]);

  return null;
}

