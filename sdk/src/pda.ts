import { PublicKey } from "@solana/web3.js";

export const PROGRAM_ID = new PublicKey(
    "6cibjMX1UwnqSxRkiSBp89NV5Z8Ws3M9i5kizxm8ZnTS"
);

export function getConfigPda(): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
        [Buffer.from("veil_config")],
        PROGRAM_ID
    );
}

export function getVaultPda(employer: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), employer.toBuffer()],
        PROGRAM_ID
    );
}

export function getVaultAtaPda(vault: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
        [Buffer.from("vault_ata"), vault.toBuffer()],
        PROGRAM_ID
    );
}

export function getSchedulePda(
    vault: PublicKey,
    scheduleId: number[]
): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
        [Buffer.from("schedule"), vault.toBuffer(), Buffer.from(scheduleId)],
        PROGRAM_ID
    );
}

