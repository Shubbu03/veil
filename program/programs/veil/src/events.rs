use anchor_lang::prelude::*;

#[event]
pub struct ConfigInitialized {
    pub governance: Pubkey,
    pub er_authority: Pubkey,
    pub allowed_mint: Pubkey,
    pub max_recipients: u16,
    pub batch_timeout_secs: u64,
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

#[event]
pub struct ScheduleCreated {
    pub employer: Pubkey,
    pub vault: Pubkey,
    pub schedule: Pubkey,
    pub reserved_amount: u64,
    pub interval_secs: u64,
    pub next_execution: i64,
}

#[event]
pub struct ScheduleCancelled {
    pub employer: Pubkey,
    pub schedule: Pubkey,
    pub returned_amount: u64,
}

#[event]
pub struct SchedulePaused {
    pub employer: Pubkey,
    pub schedule: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct ScheduleResumed {
    pub employer: Pubkey,
    pub schedule: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct ScheduleDelegated {
    pub schedule: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct ScheduleUndelegated {
    pub schedule: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct PaymentClaimed {
    pub schedule: Pubkey,
    pub recipient: Pubkey,
    pub amount: u64,
    pub leaf_index: u16,
    pub paid_count: u16,
}

#[event]
pub struct StateCommitted {
    pub account: Pubkey,
    pub timestamp: i64,
}
