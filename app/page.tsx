"use client";

import { useState } from "react";

type Language = "ja" | "en";

type Expression =
  | "normal"
  | "smile"
  | "surprised"
  | "blush"
  | "angry"
  | "sad"
  | "bad";

type Dialogue = {
  characterName: string;
  walletType: string;
  expression: Expression;
  imageFile?: string;
  affinity: number;
  line1: string;
  line2: string;
  line3: string;
};

const characterImages: Record<Expression, string> = {
  normal: "/characters/girl_normal.png",
  smile: "/characters/girl_smile.png",
  surprised: "/characters/girl_surprise.png",
  blush: "/characters/girl_smile.png",
  angry: "/characters/girl_angry.png",
  sad: "/characters/girl_sad.png",
  bad: "/characters/girl_bad.png",
};

const allowedImageFiles = [
  "girl_normal.png",
  "girl_smile.png",
  "girl_surprise.png",
  "girl_angry.png",
  "girl_sad.png",
  "girl_bad.png",
  "girl_back.png",
];

const uiText = {
  ja: {
    subtitle: "ときめき マントル",
    title: "Tokimeki Mantle",
    placeholder: "0x...",
    button: "どう？",
    loading: "お披露目中",
    defaultName: "エリーちゃん",
    defaultLine1: "ええっお財布を見せてくれるの",
    defaultLine2: "でもわたし、Mantleしか興味ないから...",
    saveButton: "このTokimekiをMantleチェーンに保存",
    addressLabel: "Paste Mantle Wallet Address",
    languageJa: "日本語",
    languageEn: "English",
    errorGeneric: "エラーが出ました",
    trapLine: "忙しいの！",
    contractNote:
      "次のステップで、このボタンからMantle上のsaveTokimekiResult()を呼びます。",
  },
  en: {
    subtitle: "Mantle Memorial",
    title: "Tokimeki Mantle",
    placeholder: "0x...",
    button: "Well?",
    loading: "Revealing...",
    defaultName: "Mantle-chan",
    defaultLine1: "Oh, you wanna show me your wallet?",
    defaultLine2: "But I'm only interested in Mantle...",
    saveButton: "Save this Tokimeki on Mantle Chain",
    addressLabel: "Paste Mantle Wallet Address",
    languageJa: "日本語",
    languageEn: "English",
    errorGeneric: "Something went wrong",
    trapLine: "I'm busy!",
    contractNote:
      "Next step: this button will call saveTokimekiResult() on Mantle.",
  },
};

function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

function getDialogueLines(dialogue: Dialogue): string[] {
  return [dialogue.line1, dialogue.line2, dialogue.line3].filter(
    (line) => line && line.trim() !== ""
  );
}

function isAllowedImageFile(fileName: string | undefined): boolean {
  if (!fileName) return false;
  return allowedImageFiles.includes(fileName);
}

export default function Home() {
  const [language, setLanguage] = useState<Language>("ja");
  const [address, setAddress] = useState("");
  const [dialogue, setDialogue] = useState<Dialogue | null>(null);
  const [loading, setLoading] = useState(false);
  const [, setMock] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [isLeaving, setIsLeaving] = useState(false);

  const t = uiText[language];

  const currentCharacter = isLeaving
    ? "/characters/girl_back.png"
    : dialogue?.imageFile && isAllowedImageFile(dialogue.imageFile)
      ? `/characters/${dialogue.imageFile}`
      : dialogue?.expression && characterImages[dialogue.expression]
        ? characterImages[dialogue.expression]
        : "/characters/girl_normal.png";

  const dialogueLines = dialogue ? getDialogueLines(dialogue) : [];
  const leavingLines = [t.trapLine];

  async function generateDialogue() {
    setLoading(true);
    setDialogue(null);
    setError("");
    setMock(null);
    setSaveMessage("");
    setIsLeaving(false);

    if (!isValidAddress(address)) {
      setLoading(false);
      setError(
        language === "en"
          ? "Please enter a valid 0x wallet address."
          : "0xから始まるウォレットアドレスを入力してください。"
      );
      return;
    }

    try {
      const response = await fetch("/api/generate-dialogue", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ address, language }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || t.errorGeneric);
        return;
      }

      setDialogue(data.dialogue);
      setMock(data.mock);
    } catch (error) {
      console.error(error);
      setError(t.errorGeneric);
    } finally {
      setLoading(false);
    }
  }

  function handleLanguageChange(nextLanguage: Language) {
    setLanguage(nextLanguage);
    setDialogue(null);
    setError("");
    setSaveMessage("");
    setMock(null);
    setIsLeaving(false);
  }

  function trapButton() {
    setIsLeaving(true);
    setSaveMessage("");
    setError("");
  }

  function saveTokimekiPlaceholder() {
    setSaveMessage(t.contractNote);
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <section className="relative mx-auto min-h-screen w-full max-w-[1280px] overflow-hidden bg-black">
        <img
          src="/backgrounds/park.png"
          alt="park background"
          className="absolute inset-0 h-full w-full object-cover"
        />

        <div className="absolute inset-0 bg-black/5" />

        {!dialogue && !isLeaving && (
          <div className="absolute left-0 right-0 top-[190px] z-30 px-4 md:top-[230px] md:px-10">
            <div className="mx-auto max-w-3xl rounded-2xl border border-white/35 bg-black/25 px-4 py-3 shadow-xl backdrop-blur-md md:px-5 md:py-4">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] tracking-[0.3em] text-white/85 md:text-xs">
                    {t.subtitle}
                  </p>
                  <h1 className="text-2xl font-bold md:text-4xl">
                    {t.title}
                  </h1>
                </div>

                <div className="flex shrink-0 rounded-full bg-black/35 p-1 text-xs">
                  <button
                    type="button"
                    onClick={() => handleLanguageChange("ja")}
                    className={`rounded-full px-3 py-1 transition ${
                      language === "ja"
                        ? "bg-white text-black"
                        : "text-white/90 hover:bg-white/10"
                    }`}
                  >
                    {t.languageJa}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLanguageChange("en")}
                    className={`rounded-full px-3 py-1 transition ${
                      language === "en"
                        ? "bg-white text-black"
                        : "text-white/90 hover:bg-white/10"
                    }`}
                  >
                    {t.languageEn}
                  </button>
                </div>
              </div>

              <label className="mb-1 block text-center text-xs text-white/80 md:text-sm">
                {t.addressLabel}
              </label>

              <div className="mx-auto flex w-full max-w-[620px] items-center gap-2">
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value.trim())}
                  placeholder={t.placeholder}
                  className="min-w-0 flex-1 rounded-xl border border-white/30 bg-black/45 px-4 py-3 text-center text-sm text-white outline-none placeholder:text-white/50 focus:border-pink-200"
                />

                <button
                  type="button"
                  onClick={generateDialogue}
                  disabled={loading || !address}
                  className="shrink-0 rounded-xl bg-pink-300 px-4 py-3 text-sm font-bold text-black shadow-lg transition hover:bg-pink-200 disabled:cursor-not-allowed disabled:opacity-50 md:px-5"
                >
                  {loading ? t.loading : t.button}
                </button>
              </div>

              {error && (
                <p className="mt-2 rounded-lg bg-red-950/75 px-3 py-2 text-center text-sm text-red-100">
                  {error}
                </p>
              )}
            </div>
          </div>
        )}

        {dialogue && !isLeaving && (
          <div className="absolute right-5 top-5 z-50 flex gap-2">
            <button
              type="button"
              onClick={trapButton}
              className="rounded-full bg-black/55 px-4 py-2 text-xs font-bold text-white shadow-lg backdrop-blur transition hover:bg-black/75"
            >
              {language === "en" ? "Show another wallet" : "別の財布を見せる"}
            </button>
          </div>
        )}

        <img
          src={currentCharacter}
          alt="Mantle chan"
          className={`absolute left-1/2 z-10 -translate-x-1/2 object-contain drop-shadow-2xl ${
            isLeaving
              ? "bottom-[145px] h-[68vh] max-h-[760px] md:bottom-[115px] md:left-[52%] md:h-[82vh]"
              : "bottom-[175px] h-[58vh] max-h-[670px] md:bottom-[150px] md:left-[56%] md:h-[70vh]"
          }`}
        />

        <div className="absolute bottom-3 left-1/2 z-40 w-[97%] max-w-[1120px] -translate-x-1/2 md:bottom-6">
          <div className="relative">
            <img
              src="/ui/dialogue.png"
              alt="dialogue box"
              className="w-full select-none"
            />

            <div className="absolute left-[2%] top-[10%] flex h-[44px] w-[230px] items-center justify-center text-center text-sm font-bold text-slate-700 md:h-[56px] md:w-[280px] md:text-lg">
              <span className="truncate px-3">
                {dialogue?.characterName || t.defaultName}
              </span>
            </div>

            <div className="absolute left-[8%] right-[8%] top-[38%] text-[13px] leading-relaxed text-slate-800 md:text-[22px] md:leading-relaxed">
              {isLeaving ? (
                <div>
                  {leavingLines.map((line, index) => (
                    <p key={index}>
                      {index === 0 ? "「" : ""}
                      {line}
                      {index === leavingLines.length - 1 ? "」" : ""}
                    </p>
                  ))}
                </div>
              ) : !dialogue ? (
                <>
                  <p>{t.defaultLine1}</p>
                  <p>{t.defaultLine2}</p>
                </>
              ) : (
                <div>
                  {dialogueLines.map((line, index) => (
                    <p key={index}>
                      {index === 0 ? "「" : ""}
                      {line}
                      {index === dialogueLines.length - 1 ? "」" : ""}
                    </p>
                  ))}
                </div>
              )}
            </div>

            {dialogue && !isLeaving && (
              <div className="absolute bottom-[9%] right-[7%]">
                <button
                  type="button"
                  onClick={saveTokimekiPlaceholder}
                  className="rounded-full bg-pink-300 px-4 py-2 text-xs font-bold text-black shadow-lg transition hover:bg-pink-200 md:px-6 md:py-3 md:text-sm"
                >
                  {t.saveButton}
                </button>
              </div>
            )}
          </div>

          {saveMessage && (
            <p className="mx-auto mt-2 max-w-2xl rounded-xl bg-black/65 px-4 py-2 text-center text-xs text-white shadow-lg md:text-sm">
              {saveMessage}
            </p>
          )}
        </div>
      </section>
    </main>
  );
}