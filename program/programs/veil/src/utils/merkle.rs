use anchor_lang::prelude::*;
use anchor_lang::solana_program::hash::hash;

/// Hash a leaf node: hash(recipient_pubkey || amount)
pub fn hash_leaf(recipient: &Pubkey, amount: u64) -> [u8; 32] {
    let mut data = Vec::with_capacity(40);
    data.extend_from_slice(recipient.as_ref());
    data.extend_from_slice(&amount.to_le_bytes());
    hash(&data).to_bytes()
}

/// Verify a Merkle proof for a given leaf
pub fn verify_merkle_proof(leaf: [u8; 32], proof: &[[u8; 32]], index: u16, root: [u8; 32]) -> bool {
    let mut computed = leaf;
    let mut idx = index as usize;

    for sibling in proof {
        computed = if idx % 2 == 0 {
            hash_pair(&computed, sibling)
        } else {
            hash_pair(sibling, &computed)
        };
        idx /= 2;
    }

    computed == root
}

/// Hash a pair of nodes (left, right)
fn hash_pair(left: &[u8; 32], right: &[u8; 32]) -> [u8; 32] {
    let mut data = [0u8; 64];
    data[..32].copy_from_slice(left);
    data[32..].copy_from_slice(right);
    hash(&data).to_bytes()
}
