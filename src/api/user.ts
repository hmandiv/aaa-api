import express, { Request, Response } from "express";
import admin from "firebase-admin";
import { db } from "../config/firebase";
import { verifyOriginAndJWT } from "../helpers/verifyOriginandJWT";
import { algoIndexerClient } from "../algorand/config"; // Use your indexer client

const router = express.Router();
const AAA_ASA_ID = 2004387843;

/**
 * POST /user-aaa-optin-status
 * Check if user has a wallet address setup in DB, and if opted into AAA token.
 */
router.post("/aaa-optin-status", async (req: Request, res: Response) => {
  const { userId, email } = req.body;

  const isValidRequest = verifyOriginAndJWT(req, email, userId);
  if (!isValidRequest) {
    return res.status(403).json({ message: "Forbidden" });
  }

  if (!userId) {
    return res.status(400).json({ message: "User ID is required" });
  }

  try {
    const userSnapshot = await db.collection("users").doc(userId).get();
    if (!userSnapshot.exists) {
      return res.status(404).json({ message: "User not found." });
    }

    const userData = userSnapshot.data();
    const walletAddress = userData?.walletAddress;

    if (!walletAddress) {
      return res.status(200).json({ optedIn: false });
    }

    const accountInfo = await algoIndexerClient
      .lookupAccountByID(walletAddress)
      .do();
    const optedIn = accountInfo.account.assets?.some(
      (asset: any) => asset["asset-id"] === AAA_ASA_ID
    );

    return res.status(200).json({ optedIn: optedIn === true });
  } catch (error) {
    console.error("Error checking opt-in status:", error);
    res.status(500).json({ message: "Internal server error." });
  }
});

/**
 * POST /userId and email
 * Get all user ids and email
 */
router.post(
  "/get-all-userid-and-email",
  async (req: Request, res: Response) => {
    try {
      const usersSnapshot = await db.collection("users").get();
      const usersData = usersSnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          userId: doc.id,
          email: data.email,
        };
      });

      return res.status(200).json(usersData);
    } catch (error) {
      console.error("Error checking opt-in status:", error);
      res.status(500).json({ message: "Internal server error." });
    }
  }
);

/**
 * POST /wallet-address
 * get all wallet addresses registered in the database
 *
 */
router.post(
  "/get-all-wallets-registered",
  async (req: Request, res: Response) => {
    try {
      const usersSnapshot = await db.collection("users").get();
      const usersData = usersSnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          walletAddress: data?.walletAddress,
        };
      });

      return res.status(200).json({
        count: usersData.filter((user) => user.walletAddress !== null).length,
        wallets: usersData.filter((user) => user.walletAddress !== null),
      });
    } catch (error) {
      console.error("Error checking opt-in status:", error);
      res.status(500).json({ message: "Internal server error." });
    }
  }
);

router.post("/get-all-wallets-optedin", async (req: Request, res: Response) => {
  try {
    const usersSnapshot = await db.collection("users").get();
    const allWallets = usersSnapshot.docs
      .map((doc) => doc.data()?.walletAddress)
      .filter((address) => !!address);

    const optedInWallets: string[] = [];

    for (const wallet of allWallets) {
      try {
        const accountInfo = await algoIndexerClient
          .lookupAccountAssets(wallet)
          .do();
        const hasOptedIn = accountInfo.assets.some(
          (asset: any) => asset["asset-id"] === AAA_ASA_ID
        );

        if (hasOptedIn) {
          optedInWallets.push(wallet);
        }
      } catch (err) {
        console.error(
          `Error checking wallet ${wallet}:`,
          (err as Error).message
        );
      }
    }

    return res.status(200).json({
      count: optedInWallets.length,
      optedInWallets,
    });
  } catch (error) {
    console.error("Error fetching opted-in wallet addresses:", error);
    res.status(500).json({ message: "Internal server error." });
  }
});

router.post("/get-daily-checkins", async (req: Request, res: Response) => {
  try {
    const usersSnapshot = await db.collection("users").get();
    const today = new Date().toDateString();

    let checkedInCount = 0;

    usersSnapshot.forEach((doc) => {
      const data = doc.data();
      const lastCheckInDate = data.lastCheckInDate;

      if (lastCheckInDate) {
        const checkInDate = new Date(lastCheckInDate).toDateString();
        if (checkInDate === today) {
          checkedInCount++;
        }
      }
    });

    return res.status(200).json({
      message: "Fetched daily check-ins.",
      date: today,
      count: checkedInCount,
    });
  } catch (error) {
    console.error("Error fetching daily check-ins:", error);
    res.status(500).json({ message: "Internal server error." });
  }
});

router.post("/get-total-checkins", async (req: Request, res: Response) => {
  try {
    const usersSnapshot = await db.collection("users").get();

    let totalCheckIns = 0;

    usersSnapshot.forEach((doc) => {
      const data = doc.data();
      const streak = data.checkInStreak || 0;

      if (data.lastCheckInDate) {
        // Add streak - 1 for previous check-ins + 1 for the most recent check-in
        totalCheckIns += streak;
      }
    });

    return res.status(200).json({
      message: "Fetched total all-time check-ins.",
      totalCheckIns,
    });
  } catch (error) {
    console.error("Error fetching total check-ins:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
});


export default router;
