import { ethers } from "hardhat";

 export async function deployContracts() {
  // Deploy Mock ERC20 tokens
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const tokenA = await MockERC20.deploy("Token A", "TKNA");
  const tokenB = await MockERC20.deploy("Token B", "TKNB");

  console.log("Token A deployed to:", tokenA.target);
  console.log("Token B deployed to:", tokenB.target);

  // Deploy Reverse Dutch Auction
  const ReverseDutchAuction = await ethers.getContractFactory(
    "ReverseDutchAuctionSwap"
  );
  const auction = await ReverseDutchAuction.deploy();

  console.log("ReverseDutchAuctionSwap deployed to:", auction.target);

  return { auction, tokenA, tokenB };
}
