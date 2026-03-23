"use client";

import dynamic from "next/dynamic";

const ScaffoldEthAppWithProviders = dynamic(() => import("~~/app/ScaffoldEthApp"), {
  ssr: false,
});

export default ScaffoldEthAppWithProviders;
