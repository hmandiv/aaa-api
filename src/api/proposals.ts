// proposals.ts (Express API for Proposal System)
import express, { Request, Response } from "express";
import { db } from "../config/firebase";
import admin from "firebase-admin";
import { verifyOriginAndJWT } from "../helpers/verifyOriginandJWT";

const router = express.Router();

// Create Proposal
router.post("/create-proposal", async (req: Request, res: Response) => {
  const { userId, email, title, description, category } = req.body;

  if (!title || !description || !category) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  const isValid = verifyOriginAndJWT(req, email, userId);
  if (!isValid) {
    return res.status(403).json({ message: "Forbidden" });
  }

  try {
    const newProposal = {
      userId,
      title,
      description,
      category,
      votes: 0,
      voters: [],
      status: "Active",
      createdAt: admin.firestore.Timestamp.now(),
    };

    const docRef = await db.collection("proposals").add(newProposal);
    res.status(201).json({ message: "Proposal created", id: docRef.id });
  } catch (err) {
    console.error("Error creating proposal:", err);
    res.status(500).json({ message: "Failed to create proposal" });
  }
});

// Vote on Proposal
router.post("/vote-proposal", async (req: Request, res: Response) => {
  const { proposalId, userId, voteType } = req.body;

  if (!proposalId || !userId || !["up", "down"].includes(voteType)) {
    return res.status(400).json({ message: "Invalid data" });
  }

  try {
    const docRef = db.collection("proposals").doc(proposalId);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ message: "Proposal not found" });
    }

    const data = doc.data();
    if (data?.voters?.includes(userId)) {
      return res.status(400).json({ message: "Already voted" });
    }

    const updatedVotes = voteType === "up" ? data?.votes + 1 : data?.votes - 1;
    await docRef.update({
      votes: updatedVotes,
      voters: admin.firestore.FieldValue.arrayUnion(userId),
    });

    res.status(200).json({ message: "Vote recorded" });
  } catch (err) {
    console.error("Vote error:", err);
    res.status(500).json({ message: "Failed to vote" });
  }
});

// Fetch all active proposals
router.get("/get-proposals", async (_req: Request, res: Response) => {
  try {
    const snapshot = await db
      .collection("proposals")
      .where("status", "==", "Active")
      .orderBy("createdAt", "desc")
      .get();

    const proposals = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    res.status(200).json(proposals);
  } catch (err) {
    console.error("Fetch error:", err);
    res.status(500).json({ message: "Failed to fetch proposals" });
  }
});

export default router;
