import { encodeFunctionData } from "viem";

export type EthereumProvider = {
  request: (args: {
    method: string;
    params?: unknown[] | Record<string, unknown>[];
  }) => Promise<unknown>;
};

export const TOKIMEKI_CONTRACT_ADDRESS =
  "0x3a4b852f5B8476f2B62af9B0C56322E5D214Fd27";

export const MANTLE_CHAIN_ID_HEX = "0x1388"; // 5000

const tokimekiAbi = [
  {
    type: "function",
    name: "saveDialogue",
    stateMutability: "nonpayable",
    inputs: [
      { name: "line1", type: "string" },
      { name: "line2", type: "string" },
      { name: "line3", type: "string" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export function getWalletErrorCode(error: unknown): number | string | undefined {
  if (typeof error === "object" && error !== null && "code" in error) {
    return (error as { code?: number | string }).code;
  }

  return undefined;
}

export function isWrongChainError(error: unknown): boolean {
  return error instanceof Error && error.message === "WRONG_CHAIN";
}

export async function getConnectedAccount(
  ethereum: EthereumProvider
): Promise<string> {
  const existingAccounts = (await ethereum.request({
    method: "eth_accounts",
  })) as string[];

  if (existingAccounts[0]) {
    return existingAccounts[0];
  }

  const requestedAccounts = (await ethereum.request({
    method: "eth_requestAccounts",
  })) as string[];

  if (!requestedAccounts[0]) {
    throw new Error("NO_ACCOUNT");
  }

  return requestedAccounts[0];
}

export async function saveTokimekiDialogue(params: {
  ethereum: EthereumProvider;
  line1: string;
  line2: string;
  line3: string;
}): Promise<string> {
  const { ethereum, line1, line2, line3 } = params;

  const from = await getConnectedAccount(ethereum);

  const currentChainId = (await ethereum.request({
    method: "eth_chainId",
  })) as string;

  if (currentChainId.toLowerCase() !== MANTLE_CHAIN_ID_HEX.toLowerCase()) {
    throw new Error("WRONG_CHAIN");
  }

  const data = encodeFunctionData({
    abi: tokimekiAbi,
    functionName: "saveDialogue",
    args: [line1, line2, line3],
  });

  const txHash = (await ethereum.request({
    method: "eth_sendTransaction",
    params: [
      {
        from,
        to: TOKIMEKI_CONTRACT_ADDRESS,
        value: "0x0",
        data,
        chainId: MANTLE_CHAIN_ID_HEX,
        gas: "0x7A120",
      },
    ],
  })) as string;

  return txHash;
}