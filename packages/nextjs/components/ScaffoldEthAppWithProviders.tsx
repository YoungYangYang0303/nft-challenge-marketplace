"use client";

import React from "react";
import dynamic from "next/dynamic";

const ScaffoldEthAppWithProviders = dynamic(() => import("~~/app/ScaffoldEthApp"), {
  ssr: false,
});

export default ScaffoldEthAppWithProviders;

