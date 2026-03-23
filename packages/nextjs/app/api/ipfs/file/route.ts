"use server";

import { addFileToIPFS } from "~~/utils/simpleNFT/ipfs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return Response.json({ error: "No file provided" }, { status: 400 });
    }

    const fileNameField = formData.get("fileName");
    const fileName = typeof fileNameField === "string" ? fileNameField : undefined;

    const uploadResult = await addFileToIPFS(file, { fileName });

    return Response.json({ path: uploadResult.IpfsHash, ...uploadResult }, { status: 201 });
  } catch (error) {
    console.error("Error uploading file to IPFS", error);
    return Response.json({ error: "Error uploading file to IPFS" }, { status: 500 });
  }
}
