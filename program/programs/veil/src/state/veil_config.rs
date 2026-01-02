use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct VeilConfig {
    pub er_authority: Pubkey, // ER signer
    pub governance: Pubkey,   // admin multisig
    pub paused: bool,         // emergency flag
    pub max_recipients: u16,
    pub allowed_mint: Pubkey,
    pub batch_timeout_secs: u64, // Global timeout for batch completion (seconds)
}
