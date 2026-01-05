import express, { Request, Response } from "express";
import admin from "firebase-admin";
import { db } from "../config/firebase";
import { verifyOriginAndJWT } from "../helpers/verifyOriginandJWT";

const router = express.Router();

router.post("/search", async (req: Request, res: Response) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }

  try {
    // Step 1: Find the user ID by email
    const userSnapshot = await db
      .collection("users")
      .where("email", "==", email)
      .get();

    if (userSnapshot.empty) {
      return res.status(404).json({ message: "User not found" });
    }

    const userDoc = userSnapshot.docs[0];
    const userId = userDoc.id;
    const userData = userDoc.data();

    const result: any = {
      userId,
      userData,
      referrals: [],
    };

    // Step 2: Recursively fetch referral details for each level
    const fetchReferralDetails = async (referrals: any[]) => {
      const detailedReferrals: any[] = [];

      for (const referral of referrals) {
        let refId: string;
        let level: number;

        if (typeof referral === "string") {
          refId = referral;
          level = 1;
        } else {
          refId = referral.userId;
          level = referral.level || 1;
        }

        const refDoc = await db.collection("users").doc(refId).get();

        if (refDoc.exists) {
          detailedReferrals.push({
            userId: refId,
            level,
            ...refDoc.data(),
          });
        }
      }

      return detailedReferrals;
    };

    if (userData.referrals && Array.isArray(userData.referrals)) {
      result.referrals = await fetchReferralDetails(userData.referrals);
    }

    res.status(200).json(result);
  } catch (error) {
    console.error("Error fetching user team:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
