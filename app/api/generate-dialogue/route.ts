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

    // 今は仮データ。あとでMantleScan / Mantle RPCの実データに差し替える
    const walletSummary = {
      address,
      balanceMNT: 3.5,
      balanceUSD: 4.2,
      txCount: 42,
      activeRecently: true,
      defiUser: true,
      nftCount: 1,
    };

    // Surfクレジット節約用
    if (process.env.USE_MOCK_SURF === "true") {
      const mockDialogue: DialogueResult = isEnglish
        ? {
            characterName: "Mantle-chan",
            walletType: "Small but Diligent Wallet",
            expression: "bad",
            imageFile: "girl_bad.png",
            affinity: 28,
            line1: "Your balance is only about 4.2 dollars.",
            line2: "Did your wallet get a hole in it?",
            line3: "Still, 42 transactions is not bad.",
          }
        : {
            characterName: "Mantleちゃん",
            walletType: "穴あき財布の勤勉者",
            expression: "bad",
            imageFile: "girl_bad.png",
            affinity: 28,
            line1: "残高は約4.2ドルね。",
            line2: "財布に穴が空いちゃった？",
            line3: "でも42回も動いてるのは悪くないわ。",
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
            ? "SURF_API_KEY is missing in .env.local"
            : ".env.local に SURF_API_KEY がありません。",
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