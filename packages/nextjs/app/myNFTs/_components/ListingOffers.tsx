"use client";

import { useEffect, useState } from "react";
import { Offer } from "./types";
import { formatEther } from "viem";
import { useAccount } from "wagmi";
import { Address } from "~~/components/scaffold-eth";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";

export const ListingOffers = ({
  listingId,
  onAccept,
  isAccepting,
}: {
  listingId: bigint | null;
  onAccept: (offerIndex: number, offer: Offer) => void;
  isAccepting: boolean;
}) => {
  const { address: connectedAddress } = useAccount();

  const { data: offersData, isLoading } = useScaffoldReadContract({
    contractName: "NFTMarketplace",
    functionName: "getOffers",
    args: [listingId ?? undefined],
    watch: true,
  });

  if (isLoading || listingId === null) {
    return <div className="text-center">正在加载报价...</div>;
  }

  const offers = (offersData as Offer[] | undefined) ?? [];
  const activeOffers = offers.filter(offer => offer.active);

  if (activeOffers.length === 0) {
    return <div className="text-center text-sm text-gray-500 mt-2">暂无报价</div>;
  }

  return (
    <div className="mt-4">
      <h4 className="font-bold text-lg mb-2">收到的报价</h4>
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {activeOffers.map((offer, index) => (
          <div key={index} className="p-2 bg-base-200 rounded-lg flex justify-between items-center">
            <div>
              <div className="flex items-center gap-1">
                <span className="font-semibold">{formatEther(offer.amount)} ETH</span> from{" "}
                <Address address={offer.offerer} size="sm" />
              </div>
              <p className="text-xs text-gray-500">
                Expires: {new Date(Number(offer.expiration) * 1000).toLocaleString()}
              </p>
            </div>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => onAccept(index, offer)}
              disabled={isAccepting}
            >
              {isAccepting ? "处理中..." : "接受"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
