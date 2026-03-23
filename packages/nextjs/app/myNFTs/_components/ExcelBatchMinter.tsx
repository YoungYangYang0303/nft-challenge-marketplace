"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";
import { addToIPFS, uploadFileToIPFS } from "~~/utils/simpleNFT/ipfs-fetch";

export const ExcelBatchMinter = () => {
  const { address: connectedAddress } = useAccount();
  const { writeContractAsync } = useScaffoldWriteContract({ contractName: "YourCollectible" });
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [isMinting, setIsMinting] = useState(false);

  const handleDownloadTemplate = () => {
    const csvContent = "Name,Description,Filename\nExample NFT,This is an example description,example.png";
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "nft_mint_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleMint = async () => {
    if (!connectedAddress) {
      notification.error("请先连接钱包");
      return;
    }
    if (!csvFile || imageFiles.length === 0) {
      notification.error("请填写完整信息");
      return;
    }
    setIsMinting(true);
    try {
      const text = await csvFile.text();
      const rows = text.split("\n").map(row => row.trim()).filter(row => row);
      // Assume header: name,description,filename
      // Skip header if it looks like a header
      let dataRows = rows;
      if (rows.length > 0 && rows[0].toLowerCase().includes("name")) {
        dataRows = rows.slice(1);
      }

      const uris: string[] = [];
      const notificationId = notification.loading(`正在处理 ${dataRows.length} 个 NFT 的元数据...`);

      for (let i = 0; i < dataRows.length; i++) {
        const columns = dataRows[i].split(",");
        if (columns.length < 3) continue;
        
        const name = columns[0].trim();
        const description = columns[1].trim();
        const filename = columns[2].trim();

        // Find image
        let imageFile = null;
        for (let j = 0; j < imageFiles.length; j++) {
          if (imageFiles[j].name === filename) {
            imageFile = imageFiles[j];
            break;
          }
        }

        if (!imageFile) {
          console.warn(`Image ${filename} not found`);
          notification.warning(`未找到图片: ${filename}`);
          continue;
        }

        try {
          // Upload Image
          const uploadResult = await uploadFileToIPFS(imageFile);
          const imageCid = uploadResult.path || uploadResult.IpfsHash;

          // Upload Metadata
          const metadata = {
            name,
            description,
            image: `https://gateway.pinata.cloud/ipfs/${imageCid}`,
          };
          const metadataResult = await addToIPFS(metadata);
          const metadataCid = metadataResult.path || metadataResult.IpfsHash;
          
          uris.push(metadataCid);
        } catch (err) {
          console.error(err);
          notification.error(`${name} 元数据上传失败`);
        }
      }

      notification.remove(notificationId);

      if (uris.length > 0) {
        await writeContractAsync({
          functionName: "batchMintItem",
          args: [connectedAddress, uris],
        });
        notification.success(`Excel 批量铸造完成！成功: ${uris.length}`);
      } else {
        notification.error("未成功准备任何 NFT 数据，请检查 CSV 和图片文件名是否匹配。");
      }
    } catch (e) {
      console.error(e);
      notification.error("铸造过程发生错误");
    } finally {
      setIsMinting(false);
    }
  };

  return (
    <div className="card bg-base-100 shadow-xl flex-1">
      <div className="card-body">
        <div className="flex justify-between items-center mb-2">
          <h2 className="card-title">Excel/CSV 批量铸造</h2>
          <button className="btn btn-sm btn-outline" onClick={handleDownloadTemplate}>
            下载模板
          </button>
        </div>
        <p className="text-sm text-base-content/70">上传 CSV 文件和对应的图片文件。CSV 格式: Name,Description,Filename</p>
        <div className="form-control">
          <label className="label">
            <span className="label-text">上传 CSV</span>
          </label>
          <input 
            type="file" 
            accept=".csv" 
            className="file-input file-input-bordered w-full" 
            onChange={(e) => setCsvFile(e.target.files?.[0] || null)} 
          />
        </div>
        <div className="form-control">
          <label className="label">
            <span className="label-text">上传图片 (支持多次添加)</span>
            <span className="label-text-alt">
              {imageFiles.length > 0 ? `${imageFiles.length} 个文件已选择` : "未选择"}
              {imageFiles.length > 0 && (
                <button 
                  className="btn btn-xs btn-ghost text-error ml-2"
                  onClick={() => setImageFiles([])}
                >
                  清空
                </button>
              )}
            </span>
          </label>
          <input 
            type="file" 
            multiple={true}
            accept="image/*" 
            className="file-input file-input-bordered w-full" 
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                const newFiles = Array.from(e.target.files);
                setImageFiles(prev => [...prev, ...newFiles]);
                // Reset input value to allow selecting the same file again if needed
                e.target.value = "";
              }
            }} 
          />
        </div>
        <div className="card-actions justify-end mt-4">
          <button className="btn btn-primary" onClick={handleMint} disabled={isMinting}>
            {isMinting ? <span className="loading loading-spinner"></span> : "开始铸造"}
          </button>
        </div>
      </div>
    </div>
  );
};
