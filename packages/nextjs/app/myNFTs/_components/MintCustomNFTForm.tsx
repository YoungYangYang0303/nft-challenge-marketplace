"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useAccount } from "wagmi";
import { useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";
import { addToIPFS, uploadFileToIPFS } from "~~/utils/simpleNFT/ipfs-fetch";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

const DEFAULT_DESCRIPTION = "Minted with the Simple NFT custom uploader.";

export const MintCustomNFTForm = () => {
  const { address: connectedAddress, isConnected, isConnecting } = useAccount();
  const { writeContractAsync } = useScaffoldWriteContract({ contractName: "YourCollectible" });

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isMinting, setIsMinting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
    };
  }, [imagePreviewUrl]);

  const formattedFileSize = useMemo(() => {
    if (!selectedFile) return "";
    if (selectedFile.size >= 1024 * 1024) {
      return `${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB`;
    }
    return `${(selectedFile.size / 1024).toFixed(1)} KB`;
  }, [selectedFile]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setSelectedFile(null);
      setImagePreviewUrl(null);
      return;
    }

    if (!file.type.startsWith("image/")) {
      notification.error("请选择图片文件");
      event.target.value = "";
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      notification.error("图片过大，请选择 10MB 以内的文件");
      event.target.value = "";
      return;
    }

    setSelectedFile(file);
    const preview = URL.createObjectURL(file);
    setImagePreviewUrl(preview);
  };

  const resetForm = () => {
    setSelectedFile(null);
    setImagePreviewUrl(null);
    setName("");
    setDescription("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleMint = async (event: FormEvent) => {
    event.preventDefault();
    if (!connectedAddress) {
      notification.error("请先连接钱包");
      return;
    }
    if (!selectedFile) {
      notification.error("请选择要上传的图片");
      return;
    }

    setIsMinting(true);
    let uploadingImageNotification: string | null = null;
    let uploadingMetadataNotification: string | null = null;
    let mintingNotification: string | null = null;

    try {
      uploadingImageNotification = notification.loading("图片上传至 IPFS 中...");
      const uploadResult = await uploadFileToIPFS(selectedFile, { fileName: name || selectedFile.name });
      if (uploadingImageNotification) notification.remove(uploadingImageNotification);
      notification.success("图片上传成功");

      const imageCid = uploadResult.path || uploadResult.IpfsHash;
      const metadata = {
        name: name.trim() || selectedFile.name,
        description: description.trim() || DEFAULT_DESCRIPTION,
        image: `ipfs://${imageCid}`,
      };

      uploadingMetadataNotification = notification.loading("Metadata 上传至 IPFS 中...");
      const metadataResult = await addToIPFS(metadata);
      if (uploadingMetadataNotification) notification.remove(uploadingMetadataNotification);
      notification.success("Metadata 上传成功");

      const metadataCid = metadataResult.path || metadataResult.IpfsHash;
      mintingNotification = notification.loading("正在铸造 NFT...");
      await writeContractAsync({
        functionName: "mintItem",
        args: [connectedAddress, metadataCid],
      });
      if (mintingNotification) notification.remove(mintingNotification);
      notification.success("NFT 铸造成功!");
      resetForm();
    } catch (error) {
      if (uploadingImageNotification) notification.remove(uploadingImageNotification);
      if (uploadingMetadataNotification) notification.remove(uploadingMetadataNotification);
      if (mintingNotification) notification.remove(mintingNotification);
      console.error("Mint custom NFT error", error);
      const message = error instanceof Error ? error.message : "NFT 铸造失败";
      notification.error(message);
    } finally {
      setIsMinting(false);
    }
  };

  return (
    <div className="card bg-base-100 shadow-xl w-full flex-1">
      <div className="card-body">
        <h2 className="card-title">自选图片铸造 NFT</h2>
        <p className="text-sm text-base-content/70">上传任意图片，自动生成 IPFS Metadata 并完成 NFT 铸造。</p>
        <form className="flex flex-col gap-4 mt-4" onSubmit={handleMint}>
          <div className="form-control w-full">
            <label className="label">
              <span className="label-text">NFT 名称</span>
            </label>
            <div className="input input-bordered w-full flex items-center">
              <input
                type="text"
                placeholder="例如：My Awesome NFT"
                className="bg-transparent w-full"
                value={name}
                onChange={event => setName(event.target.value)}
                maxLength={80}
                disabled={isMinting}
              />
            </div>
          </div>
          <div className="form-control w-full">
            <label className="label">
              <span className="label-text">描述</span>
            </label>
            <div className="input input-bordered w-full flex items-center">
              <textarea
                placeholder="简单描述一下你的 NFT"
                className="bg-transparent w-full resize-none focus:outline-none"
                value={description}
                onChange={event => setDescription(event.target.value)}
                rows={1}
                maxLength={280}
                disabled={isMinting}
              />
            </div>
          </div>
          <label className="form-control w-full">
            <span className="label-text">选择图片（最大 10MB）</span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="file-input file-input-bordered w-full"
              onChange={handleFileChange}
              disabled={isMinting}
            />
            {formattedFileSize && <span className="label-text-alt">大小：{formattedFileSize}</span>}
          </label>
          {imagePreviewUrl && (
            <div className="relative w-full h-64 rounded-xl overflow-hidden border border-base-300 flex items-center justify-center bg-base-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imagePreviewUrl} alt="NFT 预览" className="max-h-full max-w-full object-contain" />
            </div>
          )}

          <button
            type="submit"
            className={`btn btn-secondary w-full ${isMinting ? "loading" : ""}`}
            disabled={!isConnected || isConnecting || isMinting}
          >
            {isConnected ? "上传并铸造" : "请先连接钱包"}
          </button>
        </form>
      </div>
    </div>
  );
};
