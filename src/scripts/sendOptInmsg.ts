import { algodClient } from "../algorand/config";
import algosdk from "algosdk";
import dotenv from "dotenv";

dotenv.config({ path: "../../.env" });
// dotenv.config();

const AAA_ASA_ID = 2004387843; // Your AAA token ID

export async function sendOptInmsg() {
  try {
    const senderMnemonic = process.env.SENDER_MNEMONIC;
    if (!senderMnemonic) throw new Error("Sender mnemonic not configured");

    const senderAccount = algosdk.mnemonicToSecretKey(senderMnemonic);
    const senderAddress = senderAccount.addr;

    // Get transaction params
    const suggestedParams = await algodClient.getTransactionParams().do();

    // 0.01 AAA = 0.01 * 10^10
    const amount = 0.01 * 1e10;
    return { success: true };
  } catch (error) {
    console.error("Failed to send AAA:", error);
    return { success: false, error: (error as Error).message };
  }
}

(async () => {
  const receiver = "RECEIVER_ADDRESS";
  const result = await sendOptInmsg();
  console.log(result);
})();
