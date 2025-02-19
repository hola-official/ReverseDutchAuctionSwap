import { ethers, network } from "hardhat";
import chalk from "chalk";
import { deployContracts } from "./deploy";

async function main() {
  // Deploy contracts and get signers
  const [seller, buyer1, buyer2] = await ethers.getSigners();
  const { auction, tokenA, tokenB } = await deployContracts();

  console.log(
    chalk.blue("\n🚀 Starting Reverse Dutch Auction Interaction Script")
  );

  // Setup: Mint and approve tokens
  const setupTokens = async () => {
    console.log(chalk.yellow("\n📋 Setting up tokens..."));

    const amount = ethers.parseEther("1000");
    await tokenA.mint(seller.address, amount);
    await tokenB.mint(buyer1.address, amount);
    await tokenB.mint(buyer2.address, amount);

    await tokenA.connect(seller).approve(auction.target, amount);
    await tokenB.connect(buyer1).approve(auction.target, amount);
    await tokenB.connect(buyer2).approve(auction.target, amount);

    console.log("✅ Tokens minted and approved");

    // Log balances
    console.log("\nInitial balances:");
    console.log(
      `Seller TokenA: ${ethers.formatEther(
        await tokenA.balanceOf(seller.address)
      )}`
    );
    console.log(
      `Buyer1 TokenB: ${ethers.formatEther(
        await tokenB.balanceOf(buyer1.address)
      )}`
    );
  };

  // Create auction
  const createAuction = async () => {
    console.log(chalk.yellow("\n📋 Creating auction..."));

    const startPrice = ethers.parseEther("100");
    const duration = 3600; // 1 hour
    const tokenAmount = ethers.parseEther("10");
    const priceDecreaseRate = Number(startPrice) / duration;

    const tx = await auction
      .connect(seller)
      .createAuction(
        tokenA.target,
        tokenB.target,
        tokenAmount,
        startPrice,
        duration,
        BigInt(priceDecreaseRate)
      );
    await tx.wait();

    console.log("✅ Auction created");
    return 0; // First auction ID
  };

  // Monitor price changes
  const monitorPrice = async (auctionId: number) => {
    console.log(chalk.yellow("\n📋 Monitoring price changes..."));

    const initialPrice = await auction.getCurrentPrice(auctionId);
    console.log(`Initial price: ${ethers.formatEther(initialPrice)} TokenB`);

    // Check price after 15 minutes
    await network.provider.send("evm_increaseTime", [900]);
    await network.provider.send("evm_mine");
    const price15min = await auction.getCurrentPrice(auctionId);
    console.log(
      `Price after 15 minutes: ${ethers.formatEther(price15min)} TokenB`
    );

    // Check price after 30 minutes
    await network.provider.send("evm_increaseTime", [900]);
    await network.provider.send("evm_mine");
    const price30min = await auction.getCurrentPrice(auctionId);
    console.log(
      `Price after 30 minutes: ${ethers.formatEther(price30min)} TokenB`
    );
  };

  // View auction details
  const viewAuctionDetails = async (auctionId: number) => {
    console.log(chalk.yellow("\n📋 Viewing auction details..."));

    console.log(auctionId);
    const details = await auction.getAuction(auctionId);
    console.log({
      seller: details.seller,
      tokenToSell: details.tokenToSell,
      tokenToBuy: details.tokenToBuy,
      tokenAmount: ethers.formatEther(details.tokenAmount),
      startPrice: ethers.formatEther(details.startPrice),
      startTime: details.startTime.toString(),
      duration: details.duration.toString(),
      priceDecreaseRate: ethers.formatEther(details.priceDecreaseRate),
      active: details.active,
    });
  };

  // Execute auction
  const executeAuction = async (auctionId: number) => {
    console.log(chalk.yellow("\n📋 Executing auction..."));

    const currentPrice = await auction.getCurrentPrice(auctionId);
    console.log(`Current price: ${ethers.formatEther(currentPrice)} TokenB`);

    const tx = await auction.connect(buyer1).executeAuction(auctionId);
    await tx.wait();

    console.log("✅ Auction executed");

    // Log final balances
    console.log("\nFinal balances:");
    console.log(
      `Seller TokenB: ${ethers.formatEther(
        await tokenB.balanceOf(seller.address)
      )}`
    );
    console.log(
      `Buyer1 TokenA: ${ethers.formatEther(
        await tokenA.balanceOf(buyer1.address)
      )}`
    );
  };

  // Try to execute already completed auction (should fail)
  const tryDoubleExecution = async (auctionId: number) => {
    console.log(chalk.yellow("\n📋 Testing double execution prevention..."));

    try {
      await auction.connect(buyer2).executeAuction(auctionId);
    } catch (error) {
      console.log("✅ Double execution prevented successfully");
    }
  };

  // Create and cancel auction
  const testAuctionCancellation = async () => {
    console.log(chalk.yellow("\n📋 Testing auction cancellation..."));

    // Create new auction
    const startPrice = ethers.parseEther("50");
    const duration = 3600;
    const tokenAmount = ethers.parseEther("5");
    const priceDecreaseRate = Number(startPrice) / duration;

    const tx = await auction
      .connect(seller)
      .createAuction(
        tokenA.target,
        tokenB.target,
        tokenAmount,
        startPrice,
        duration,
        BigInt(priceDecreaseRate)
      );
    await tx.wait();
    const auctionId = 1; // Second auction

    // Cancel auction
    const cancelTx = await auction.connect(seller).cancelAuction(auctionId);
    await cancelTx.wait();

    console.log("✅ Auction cancelled");

    // Verify auction is inactive
    const details = await auction.getAuction(auctionId);
    console.log(`Auction active status: ${details.active}`);
  };

  // Run all interactions
  try {
    await setupTokens();
    const auctionId = await createAuction();
    console.log(auctionId);
    await viewAuctionDetails(auctionId);
    await monitorPrice(auctionId);
    await executeAuction(auctionId);
    await tryDoubleExecution(auctionId);
    await testAuctionCancellation();

    console.log(chalk.green("\n✨ All interactions completed successfully!"));
  } catch (error) {
    console.error(chalk.red("\n❌ Error during interaction:"), error);
  }
}

// Execute script
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
