import { PublicKey } from "@solana/web3.js";
import { createHash } from "crypto";

export interface Recipient {
    address: PublicKey;
    amount: bigint;
}

export interface MerkleProof {
    leafIndex: number;
    proof: Buffer[];
}

export function hashLeaf(recipient: PublicKey, amount: bigint): Buffer {
    const data = Buffer.alloc(40);
    data.set(recipient.toBuffer(), 0);
    data.writeBigUInt64LE(amount, 32);
    return createHash("sha256").update(data).digest();
}

function hashPair(left: Buffer, right: Buffer): Buffer {
    const data = Buffer.concat([left, right]);
    return createHash("sha256").update(data).digest();
}

export function buildMerkleTree(recipients: Recipient[]): {
    root: Buffer;
    proofs: MerkleProof[];
} {
    if (recipients.length === 0) {
        throw new Error("Cannot build tree with no recipients");
    }

    // Hash all leaves
    let leaves = recipients.map((r) => hashLeaf(r.address, r.amount));

    // Pad to power of 2
    const targetLen = nextPowerOf2(leaves.length);
    const zeroHash = Buffer.alloc(32);
    while (leaves.length < targetLen) {
        leaves.push(zeroHash);
    }

    // Track indices for proof generation
    const proofs: MerkleProof[] = recipients.map((_, i) => ({
        leafIndex: i,
        proof: [],
    }));

    let currentLevel = leaves;
    let indices = leaves.map((_, i) => i);

    // Build tree bottom-up
    while (currentLevel.length > 1) {
        const nextLevel: Buffer[] = [];

        for (let i = 0; i < currentLevel.length; i += 2) {
            const left = currentLevel[i];
            const right = currentLevel[i + 1];
            nextLevel.push(hashPair(left, right));

            // Add siblings to proofs
            for (let j = 0; j < proofs.length; j++) {
                if (indices[j] === i) {
                    proofs[j].proof.push(right);
                } else if (indices[j] === i + 1) {
                    proofs[j].proof.push(left);
                }
            }
        }

        indices = indices.map((idx) => Math.floor(idx / 2));
        currentLevel = nextLevel;
    }

    return { root: currentLevel[0], proofs };
}

export function verifyProof(
    leaf: Buffer,
    proof: Buffer[],
    leafIndex: number,
    root: Buffer
): boolean {
    let computed = leaf;
    let idx = leafIndex;

    for (const sibling of proof) {
        computed = idx % 2 === 0 ? hashPair(computed, sibling) : hashPair(sibling, computed);
        idx = Math.floor(idx / 2);
    }

    return computed.equals(root);
}

export function getProofForRecipient(
    recipients: Recipient[],
    recipientIndex: number
): MerkleProof | null {
    if (recipientIndex < 0 || recipientIndex >= recipients.length) {
        return null;
    }

    const { proofs } = buildMerkleTree(recipients);
    return proofs[recipientIndex] || null;
}

export function findRecipientIndex(
    recipients: Recipient[],
    address: PublicKey
): number {
    return recipients.findIndex((r) => r.address.equals(address));
}

function nextPowerOf2(n: number): number {
    let p = 1;
    while (p < n) p *= 2;
    return p;
}

