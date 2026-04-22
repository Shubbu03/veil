import { PublicKey } from "@solana/web3.js";

export const PROGRAM_ID = new PublicKey(
    "6cibjMX1UwnqSxRkiSBp89NV5Z8Ws3M9i5kizxm8ZnTS"
);
export const DELEGATION_PROGRAM_ID = new PublicKey(
    "DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh"
);
export const MAGIC_PROGRAM_ID = new PublicKey(
    "Magic11111111111111111111111111111111111111"
);
export const MAGIC_CONTEXT_ID = new PublicKey(
    "MagicContext1111111111111111111111111111111"
);

export function getConfigPda(): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
        [Buffer.from("veil_config")],
        PROGRAM_ID
    );
}

export function getVaultPda(
    employer: PublicKey,
    tokenMint: PublicKey
): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), employer.toBuffer(), tokenMint.toBuffer()],
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

export function getBufferPda(account: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
        [Buffer.from("buffer"), account.toBuffer()],
        PROGRAM_ID
    );
}

export function getDelegationRecordPda(account: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
        [Buffer.from("delegation"), account.toBuffer()],
        DELEGATION_PROGRAM_ID
    );
}

export function getDelegationMetadataPda(account: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
        [Buffer.from("delegation-metadata"), account.toBuffer()],
        DELEGATION_PROGRAM_ID
    );
}
