use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct ScheduleAccount {
   pub employer: Pubkey,
   pub vault: Pubkey,
   pub status: ScheduleStatus,
   pub interval_secs: u64,
   pub next_execution: u64,
   pub reserved_amount: u64,
   pub er_job_id: [u8; 32],
   pub hash_recipients: [u8; 32],
   pub hash_amounts: [u8; 32],
   pub last_executed_batch: u64, // replay protection
   pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, InitSpace)]
pub enum ScheduleStatus {
    Active,
    Paused,
    Cancelled,
}
