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
    pub per_execution_amount: u64, // Total amount paid per execution interval
    pub er_job_id: [u8; 32],
    pub merkle_root: [u8; 32],  // Merkle root of (recipient, amount) leaves
    pub total_recipients: u16,  // Total number of recipients in the tree
    pub paid_count: u16,        // Number of recipients paid in current batch
    pub paid_bitmap: [u8; 128], // Bitmap tracking paid recipients (1024 max, 1 bit per recipient)
    pub last_executed_batch: u64, // replay protection
    pub batch_start_time: u64,  // When current batch started (0 if not started)
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, InitSpace)]
pub enum ScheduleStatus {
    Active,
    Paused,
    Cancelled,
}
