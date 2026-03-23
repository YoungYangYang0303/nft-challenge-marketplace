"use client";

import React from "react";
import type { NextPage } from "next";
import { formatEther } from "viem";
import { useDeployedContractInfo, useScaffoldReadContract } from "~~/hooks/scaffold-eth";

const CollectionPage: NextPage = () => {
  const { data: allListings, isLoading: listingsLoading } = useScaffoldReadContract({
    contractName: "NFTMarketplace",
    functionName: "getAllActiveListings",
    watch: true,
  });

  const { data: yourCollectibleInfo } = useDeployedContractInfo("YourCollectible");

  const { data: totalSupply } = useScaffoldReadContract({
    contractName: "YourCollectible",
    functionName: "totalSupply",
  });

  const collections = React.useMemo(() => {
    const grouped: Record<string, any[]> = {};

    // 确保 YourCollectible 始终存在于列表中，即使没有挂单
    if (yourCollectibleInfo) {
      grouped[yourCollectibleInfo.address] = [];
    }

    if (allListings && allListings.length > 0) {
      allListings.forEach((listing: any) => {
        const contractAddress = listing.nftContract;
        if (!grouped[contractAddress]) {
          grouped[contractAddress] = [];
        }
        grouped[contractAddress].push(listing);
      });
    }

    return grouped;
  }, [allListings, yourCollectibleInfo]);

  const getCollectionName = (address: string) => {
    if (yourCollectibleInfo && address.toLowerCase() === yourCollectibleInfo.address.toLowerCase()) {
      return "YourCollectible (YCB)";
    }
    return "Unknown Collection";
  };

  return (
    <div className="container mx-auto pt-10 px-4">
      <h1 className="text-4xl font-bold mb-8 text-center">NFT Collections</h1>
      <p className="text-center mb-8 text-gray-500">Explore available NFT collections on the marketplace.</p>

      {listingsLoading ? (
        <div className="flex justify-center">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      ) : Object.keys(collections).length === 0 ? (
        <div className="text-center py-10 bg-base-200 rounded-xl">
          <p className="text-2xl font-bold text-gray-500">No active listings found.</p>
          <p className="mt-2">Be the first to list an NFT!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {Object.entries(collections).map(([contractAddress, listings]) => {
            const hasListings = listings.length > 0;
            const floorPrice = hasListings
              ? listings.reduce((min: any, l: any) => (l.price < min ? l.price : min), listings[0].price)
              : 0n;

            const isYourCollectible =
              yourCollectibleInfo && contractAddress.toLowerCase() === yourCollectibleInfo.address.toLowerCase();
            const totalItems = isYourCollectible && totalSupply ? totalSupply.toString() : "N/A";

            return (
              <div
                key={contractAddress}
                className="card bg-base-100 shadow-xl border border-base-300 hover:shadow-2xl transition-all duration-200"
              >
                <div className="card-body">
                  <h2 className="card-title flex justify-between items-center">
                    {getCollectionName(contractAddress)}
                    <div className="badge badge-primary">{hasListings ? listings.length : 0} Listed</div>
                  </h2>
                  <p className="text-xs text-gray-500 font-mono truncate mb-4" title={contractAddress}>
                    {contractAddress}
                  </p>

                  <div className="stats stats-vertical lg:stats-horizontal shadow bg-base-200 w-full">
                    <div className="stat place-items-center p-2">
                      <div className="stat-title text-xs">Floor Price</div>
                      <div className="stat-value text-lg text-primary">
                        {hasListings ? `${formatEther(floorPrice)} ETH` : "N/A"}
                      </div>
                    </div>

                    <div className="stat place-items-center p-2">
                      <div className="stat-title text-xs">Total Supply</div>
                      <div className="stat-value text-lg">{totalItems}</div>
                    </div>
                  </div>

                  <div className="card-actions justify-end mt-4">
                    <button className="btn btn-sm btn-outline w-full">View Listings</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CollectionPage;
