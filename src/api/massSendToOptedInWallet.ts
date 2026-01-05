import express, { Request, Response } from "express";
import { algoIndexerClient } from "../algorand/config";
import { massSend } from "../algorand/transactionHelpers/massSend";

const router = express.Router();

// Helper function to chunk an array
function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

router.post("/send", async (req: Request, res: Response) => {
  try {
    // Example request body: { "assetId": 12345, "amount": 10, "decimals": 0 }
    const { assetId, amount, decimals } = req.body;

    if (
      assetId === undefined ||
      amount === undefined ||
      decimals === undefined
    ) {
      return res.status(400).json({
        error: "Missing one or more required fields: assetId, amount, decimals",
      });
    }

    // -- 1. Collect ALL balances via pagination --
    let allBalances: any[] = [];
    let nextToken: string | undefined = undefined;
    let count = 0;

    while (true) {
      let query = algoIndexerClient.lookupAssetBalances(assetId);
      if (nextToken) {
        query = query.nextToken(nextToken);
      }

      // Make the request for the current page
      const assetBalances = await query.do();

      // Add the current batch
      allBalances.push(...assetBalances.balances);

      // Check if there's another page
      if (!assetBalances["next-token"]) {
        break;
      }
      nextToken = assetBalances["next-token"];
    }

    // -- 2. Filter addresses that have actually opted in --
    //  (In Algorand, "amount >= 0" for an asset means they've opted in.)
    const optedInWallets = allBalances
      .filter((bal: any) => bal.amount >= 1 * Math.pow(10, decimals))
      .map((bal: any) => bal.address);

    console.log(1 * Math.pow(10, decimals));
    console.log(`Found ${optedInWallets.length} opted-in wallets.`);

    // -- 3. Batch and send your airdrop/asset transfers --
    const BATCH_SIZE = 10; // or whatever size you prefer
    const addressBatches = chunkArray(optedInWallets, BATCH_SIZE);
    const results: any[] = [];

    for (const batch of addressBatches) {
      const batchPromises = batch.map(async (walletAddr) => {
        try {
          const txResult = await massSend(
            walletAddr,
            amount,
            assetId,
            decimals
          );
          count++;
          console.log(count);
          return {
            address: walletAddr,
            txId: txResult.txId,
            status: "success" as const,
          };
        } catch (err) {
          console.error(`Failed sending to ${walletAddr}:`, err);
          return {
            address: walletAddr,
            status: "failed" as const,
            error: (err as Error).message || "Unknown error",
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Optionally add a delay to avoid rate limits or congestion
      // await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    return res.status(200).json({
      message: "Mass send to opted-in wallets completed.",
      totalWallets: optedInWallets.length,
      results,
    });
  } catch (error) {
    console.error("Error in /send endpoint:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Internal server error";
    return res.status(500).json({ message: errorMessage });
  }
});

export default router;
