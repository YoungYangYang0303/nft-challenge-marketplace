"use server";

import { addJSONToIPFS } from "~~/utils/simpleNFT/ipfs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const res = await addJSONToIPFS(body);
    return Response.json({ path: res.IpfsHash, ...res });
  } catch (error) {
    console.log("Error adding to ipfs", error);
    return Response.json({ error: "Error adding to ipfs" });
  }
}
