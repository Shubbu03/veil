import { PublicKey } from "@solana/web3.js";

export const PROGRAM_ID = new PublicKey("6fnyZCuDriRnak18b4mrg9y2Z3gy2P9QByqVYSauYWX8");

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

export function getSchedulePda(vault: PublicKey, scheduleId: number[]): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
        [Buffer.from("schedule"), vault.toBuffer(), Buffer.from(scheduleId)],
        PROGRAM_ID
    );
}

