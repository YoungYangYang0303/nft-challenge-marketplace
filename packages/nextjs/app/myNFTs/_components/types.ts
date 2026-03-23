import { NFTMetaData } from "~~/utils/simpleNFT/nftsMetadata";

export interface Collectible extends Partial<NFTMetaData> {
  id: number;
  uri: string;
  owner?: string;
}

export interface Listing extends Collectible {
  price?: bigint;
  paused?: boolean;
}

export interface Offer {
  offerer: `0x${string}`;
  amount: bigint;
  expiration: bigint;
  active: boolean;
}
