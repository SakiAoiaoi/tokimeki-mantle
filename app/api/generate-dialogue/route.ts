import { createPublicClient, formatEther, formatUnits, http } from "viem";
import { mantle } from "viem/chains";
import { createTokimekiPrompt, type Language } from "@/lib/tokimekiPrompt";

type Expression =
  | "normal"
  | "smile"
  | "surprised"
  | "blush"
  | "angry"
  | "sad"
  | "bad";

type DialogueResult = {
  characterName: string;
  walletType: string;
  expression: Expression;
  imageFile: string;
  affinity: number;
  line1: string;
  line2: string;
  line3: string;
};

type WalletSummary = {
  address: string;
  balanceMNT: number;
  balanceUSD: number;
  txCount: number;
  activeRecently: boolean;
  defiUser: boolean;
  nftCount: number;
};

const MANTLE_RPC_URL =
  process.env.MANTLE_RPC_URL || "https://rpc.mantle.xyz";

const USDC_ADDRESS = "0x09Bc4E0D864854c6aFB6eB9A9cdF58aC190D0dF9";

const erc20Abi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const publicClient = createPublicClient({
  chain: mantle,
  transport: http(MANTLE_RPC_URL),
});

function extractJson(text: string): string {
  const cleaned = text
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");

  if (start === -1 || end === -1) {
    throw new Error("No JSON object found in Surf AI response");
  }

  return cleaned.slice(start, end + 1);
}

function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

const allowedImageFiles = [
  "girl_normal.png",
  "girl_smile.png",
  "girl_surprise.png",
  "girl_angry.png",
  "girl_sad.png",
  "girl_bad.png",
] as const;

function safeImageFile(fileName: string | undefined): string {
  if (!fileName) return "girl_normal.png";

  return allowedImageFiles.includes(
    fileName as (typeof allowedImageFiles)[number]
  )
    ? fileName
    : "girl_normal.png";
}

async function getMntPriceUsd(): Promise<number> {
  try {
    const response = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=mantle&vs_currencies=usd",
      {
        next: {
          revalidate: 60,
        },
      }
    );

    if (!response.ok) {
      return 0.54;
    }

    const data = await response.json();
    const price = Number(data?.mantle?.usd);

    return Number.isFinite(price) && price > 0 ? price : 0.54;
  } catch {
    return 0.54;
  }
}

async function getMantleWalletSummary(address: string): Promise<WalletSummary> {
  const walletAddress = address as `0x${string}`;

  const [mntBalanceRaw, usdcBalanceRaw, txCount, mntPriceUsd] =
    await Promise.all([
      publicClient.getBalance({
        address: walletAddress,
      }),
      publicClient.readContract({
        address: USDC_ADDRESS,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [walletAddress],
      }),
      publicClient.getTransactionCount({
        address: walletAddress,
      }),
      getMntPriceUsd(),
    ]);

  const balanceMNT = Number(formatEther(mntBalanceRaw));
  const usdcBalance = Number(formatUnits(usdcBalanceRaw, 6));

  const mntValueUSD = balanceMNT * mntPriceUsd;
  const balanceUSD = mntValueUSD + usdcBalance;

  return {
    address,
    balanceMNT: Number(balanceMNT.toFixed(6)),
    balanceUSD: Number(balanceUSD.toFixed(2)),
    txCount,
    activeRecently: txCount > 0,
    defiUser: usdcBalance > 0 || txCount >= 5,
    nftCount: 0,
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const address = body.address as string | undefined;
    const language: Language = body.language === "en" ? "en" : "ja";
    const isEnglish = language === "en";

    if (!address) {
      return Response.json({ error: "address is required" }, { status: 400 });
    }

    if (!isValidAddress(address)) {
      return Response.json(
        {
          error: isEnglish
            ? "Mantle wallet address must start with 0x and be 42 characters long."
            : "Mantleウォレットアドレスは 0x から始まる42文字で入力してください。",
        },
        { status: 400 }
      );
    }

    const walletSummary = await getMantleWalletSummary(address);

    if (process.env.USE_MOCK_SURF === "true") {
      const mockDialogue: DialogueResult = isEnglish
        ? {
            characterName: "Mantle-chan",
            walletType: "Mantle Wallet",
            expression: "smile",
            imageFile: "girl_smile.png",
            affinity: 50,
            line1: `Your wallet has about $${walletSummary.balanceUSD}.`,
            line2: `I see ${walletSummary.txCount} transactions on Mantle.`,
            line3: "Do not think I am impressed that easily.",
          }
        : {
            characterName: "Mantleちゃん",
            walletType: "Mantleウォレット",
            expression: "smile",
            imageFile: "girl_smile.png",
            affinity: 50,
            line1: `残高は約${walletSummary.balanceUSD}ドルね。`,
            line2: `Mantleでの取引は${walletSummary.txCount}回見えるわ。`,
            line3: "それだけで感心すると思わないで。",
          };

      return Response.json({
        address,
        walletSummary,
        dialogue: mockDialogue,
        mock: true,
        language,
      });
    }

    if (!process.env.SURF_API_KEY) {
      return Response.json(
        {
          error: isEnglish
            ? "SURF_API_KEY is missing in Vercel Environment Variables."
            : "VercelのEnvironment Variablesに SURF_API_KEY がありません。",
        },
        { status: 500 }
      );
    }

    const prompt = createTokimekiPrompt(language, walletSummary);

    const surfResponse = await fetch(
      "https://api.asksurf.ai/gateway/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.SURF_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "surf-1.5 + instant",
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
        }),
      }
    );

    if (!surfResponse.ok) {
      const errorText = await surfResponse.text();

      return Response.json(
        {
          error: isEnglish
            ? "Surf AI request failed"
            : "Surf AIへのリクエストに失敗しました",
          detail: errorText,
        },
        { status: 500 }
      );
    }

    const data = await surfResponse.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return Response.json(
        {
          error: isEnglish
            ? "Surf AI response did not include content"
            : "Surf AIの返答にcontentがありませんでした",
        },
        { status: 500 }
      );
    }

    const jsonText = extractJson(content);
    const dialogue = JSON.parse(jsonText) as DialogueResult;

    dialogue.imageFile = safeImageFile(dialogue.imageFile);

    return Response.json({
      address,
      walletSummary,
      dialogue,
      mock: false,
      language,
    });
  } catch (error) {
    return Response.json(
      {
        error: "Something went wrong",
        detail: String(error),
      },
      { status: 500 }
    );
  }
}