"use client";

import { useState } from "react";
import {
  AirdropMinter,
  BatchNFTMinter,
  ExcelBatchMinter,
  MintCustomNFTForm,
  MyHoldings,
  MyListings,
} from "./_components";
import type { NextPage } from "next";
import { useAccount } from "wagmi";
import { RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";
import { addToIPFS } from "~~/utils/simpleNFT/ipfs-fetch";
import nftsMetadata from "~~/utils/simpleNFT/nftsMetadata";

const MyNFTs: NextPage = () => {
  const { address: connectedAddress, isConnected, isConnecting } = useAccount();
  const [activeTab, setActiveTab] = useState<"holdings" | "listings">("holdings");

  const { writeContractAsync } = useScaffoldWriteContract({ contractName: "YourCollectible" });

  const { data: tokenIdCounter } = useScaffoldReadContract({
    contractName: "YourCollectible",
    functionName: "tokenIdCounter",
    watch: true,
  });

  const handleMintItem = async () => {
    // circle back to the zero item if we've reached the end of the array
    if (tokenIdCounter === undefined) return;

    if (!connectedAddress) {
      notification.error("请先连接钱包");
      return;
    }

    const tokenIdCounterNumber = Number(tokenIdCounter);
    const currentTokenMetaData = nftsMetadata[tokenIdCounterNumber % nftsMetadata.length];
    const notificationId = notification.loading("Uploading to IPFS");
    try {
      const uploadedItem = await addToIPFS(currentTokenMetaData);

      // First remove previous loading notification and then show success notification
      notification.remove(notificationId);
      notification.success("Metadata uploaded to IPFS");

      const cid = uploadedItem.path || uploadedItem.IpfsHash;
      await writeContractAsync({
        functionName: "mintItem",
        args: [connectedAddress, cid],
      });
    } catch (error) {
      notification.remove(notificationId);
      console.error(error);
    }
  };

  return (
    <>
      <div className="flex items-center flex-col pt-10">
        <div className="px-5">
          <h1 className="text-center mb-8">
            <span className="block text-5xl font-bold">My NFTs</span>
          </h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 px-5 w-full max-w-7xl mx-auto">
        {/* Column 1: Single Minting */}
        <div className="flex flex-col gap-6 w-full">
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h2 className="card-title text-xl">快速体验铸造</h2>
              <p className="text-base text-base-content/70">使用预置的示例 Metadata 铸造 NFT，方便快速验证链上流程。</p>
              <div className="mt-4 flex justify-center">
                {!isConnected || isConnecting ? (
                  <RainbowKitCustomConnectButton />
                ) : (
                  <button className="btn btn-secondary btn-lg w-full" onClick={handleMintItem}>
                    铸造示例 NFT
                  </button>
                )}
              </div>
            </div>
          </div>

          <MintCustomNFTForm />
        </div>

        {/* Column 2: Airdrop */}
        <div className="flex flex-col gap-6 w-full">
          <AirdropMinter />
        </div>

        {/* Column 3: Batch Minting */}
        <div className="flex flex-col gap-6 w-full">
          <BatchNFTMinter />
          <ExcelBatchMinter />
        </div>
      </div>

      <div className="tabs tabs-boxed justify-center mt-8">
        <a
          className={`tab tab-lg ${activeTab === "holdings" ? "tab-active" : ""}`}
          onClick={() => setActiveTab("holdings")}
        >
          我的持有
        </a>
        <a
          className={`tab tab-lg ${activeTab === "listings" ? "tab-active" : ""}`}
          onClick={() => setActiveTab("listings")}
        >
          我的挂单
        </a>
      </div>

      {activeTab === "holdings" && <MyHoldings />}
      {activeTab === "listings" && <MyListings />}
    </>
  );
};

export default MyNFTs;
