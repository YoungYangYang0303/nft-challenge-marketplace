"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";
import { addToIPFS } from "~~/utils/simpleNFT/ipfs-fetch";
import nftsMetadata from "~~/utils/simpleNFT/nftsMetadata";

export const BatchNFTMinter = () => {
  const { address: connectedAddress } = useAccount();
  const { writeContractAsync } = useScaffoldWriteContract({ contractName: "YourCollectible" });
  const [isMinting, setIsMinting] = useState(false);
  const [mintAmount, setMintAmount] = useState(3);

  const handleBatchMint = async () => {
    if (!connectedAddress) {
      notification.error("请先连接钱包");
      return;
    }
    if (mintAmount < 1 || mintAmount > 10) {
      notification.error("请输入 1 到 10 之间的数量");
      return;
    }
    setIsMinting(true);
    try {
      const uris: string[] = [];
      const notificationId = notification.loading(`正在准备 ${mintAmount} 个 NFT 的元数据...`);

      for (let i = 1; i <= mintAmount; i++) {
        // Use random example metadata
        const randomIndex = Math.floor(Math.random() * nftsMetadata.length);
        const exampleNFT = nftsMetadata[randomIndex];

        // Upload Metadata
        const metadata = {
          ...exampleNFT,
          name: `${exampleNFT.name} (Batch #${i})`,
          attributes: [
            ...(exampleNFT.attributes || []),
            { trait_type: "Batch", value: "True" },
            { trait_type: "Index", value: i },
          ],
        };
        const metadataResult = await addToIPFS(metadata);
        const metadataCid = metadataResult.path || metadataResult.IpfsHash;
        
        uris.push(metadataCid);
      }

      notification.remove(notificationId);
      
      // Batch Mint
      await writeContractAsync({
        functionName: "batchMintItem",
        args: [connectedAddress, uris],
      });
      
      notification.success("批量铸造成功！");
    } catch (e) {
      console.error(e);
      notification.error("批量铸造失败");
    } finally {
      setIsMinting(false);
    }
  };

  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body">
        <h2 className="card-title">批量铸造</h2>
        <p>自动生成并铸造指定数量的 NFT。</p>
        
        <div className="form-control mb-4">
          <label className="label">
            <span className="label-text">铸造数量 (1-10)</span>
          </label>
          <input
            type="number"
            min="1"
            max="10"
            value={mintAmount}
            onChange={(e) => setMintAmount(parseInt(e.target.value) || 0)}
            className="input input-bordered w-full"
          />
        </div>

        <button className="btn btn-primary" onClick={handleBatchMint} disabled={isMinting}>
          {isMinting ? <span className="loading loading-spinner"></span> : `开始批量铸造 (${mintAmount})`}
        </button>
      </div>
    </div>
  );
};
