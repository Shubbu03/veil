use anchor_lang::prelude::*;

#[event]
pub struct ConfigInitialized {
    pub governance: Pubkey,
    pub er_authority: Pubkey,
    pub allowed_mint: Pubkey,
    pub max_recipients: u16,
}

#[event]
pub struct ProgramPaused {
    pub governance: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct ProgramUnpaused {
    pub governance: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct ErAuthorityUpdated {
    pub governance: Pubkey,
    pub old_er_authority: Pubkey,
    pub new_er_authority: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct VaultInitialized {
    pub employer: Pubkey,
    pub vault: Pubkey,
    pub vault_ata: Pubkey,
    pub token_mint: Pubkey,
}

#[event]
pub struct VaultDeposited {
    pub vault: Pubkey,
    pub employer: Pubkey,
    pub amount: u64,
    pub available: u64,
}

#[event]
pub struct VaultWithdrawn {
    pub vault: Pubkey,
    pub employer: Pubkey,
    pub amount: u64,
    pub available: u64,
}

#[event]
pub struct VaultDelegated {
    pub vault: Pubkey,
    pub er_authority: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct VaultUndelegated {
    pub vault: Pubkey,
    pub er_authority: Pubkey,
    pub timestamp: i64,
}
