#![allow(unexpected_cfgs, deprecated)]
pub mod constants;
pub mod error;
pub mod events;
pub mod instructions;
pub mod state;
pub mod utils;

use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::anchor::ephemeral;

pub use constants::*;
pub use error::*;
pub use events::*;
pub use instructions::*;
pub use state::*;

declare_id!("6fnyZCuDriRnak18b4mrg9y2Z3gy2P9QByqVYSauYWX8");

#[ephemeral]
#[program]
pub mod veil {

    use super::*;

    // admin ixs

    pub fn init_config(
        ctx: Context<InitConfig>,
        governance: Pubkey,
        er_authority: Pubkey,
        allowed_mint: Pubkey,
        max_recipients: u16,
        batch_timeout_secs: u64,
    ) -> Result<()> {
        ctx.accounts.init_config(
            governance,
            er_authority,
            allowed_mint,
            max_recipients,
            batch_timeout_secs,
        )
    }
    pub fn set_er_authority(ctx: Context<SetErAuthority>, new_er_authority: Pubkey) -> Result<()> {
        ctx.accounts.set_er_auth(new_er_authority)
    }
    pub fn pause(ctx: Context<Pause>) -> Result<()> {
        ctx.accounts.pause()
    }
    pub fn unpause(ctx: Context<Unpause>) -> Result<()> {
        ctx.accounts.unpause()
    }

    // vault ixs

    pub fn init_vault(ctx: Context<InitVault>) -> Result<()> {
        ctx.accounts.init_vault()
    }
    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        ctx.accounts.deposit_to_vault(amount)
    }
    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        ctx.accounts.withdraw_from_vault(amount)
    }
    pub fn delegate_vault(ctx: Context<DelegateVault>) -> Result<()> {
        ctx.accounts.delegate_vault()
    }
    pub fn undelegate_vault(ctx: Context<UndelegateVault>) -> Result<()> {
        ctx.accounts.undelegate_vault()
    }

    // scheduling ixs

    pub fn create_schedule(
        ctx: Context<CreateSchedule>,
        schedule_id: [u8; 32],
        interval_secs: u64,
        reserved_amount: u64,
        per_execution_amount: u64,
        merkle_root: [u8; 32],
        total_recipients: u16,
        er_job_id: [u8; 32],
    ) -> Result<()> {
        ctx.accounts.create_schedule(
            schedule_id,
            interval_secs,
            reserved_amount,
            per_execution_amount,
            merkle_root,
            total_recipients,
            er_job_id,
        )
    }

    pub fn cancel_schedule(ctx: Context<CancelSchedule>) -> Result<()> {
        ctx.accounts.cancel_schedule()
    }

    pub fn pause_schedule(ctx: Context<PauseSchedule>, pause: bool) -> Result<()> {
        ctx.accounts.pause_schedule(pause)
    }

    pub fn delegate_schedule(ctx: Context<DelegateSchedule>, schedule_id: [u8; 32]) -> Result<()> {
        ctx.accounts.delegate_schedule(schedule_id)
    }

    pub fn undelegate_schedule(
        ctx: Context<UndelegateSchedule>,
        schedule_id: [u8; 32],
    ) -> Result<()> {
        ctx.accounts.undelegate_schedule(schedule_id)
    }

    pub fn claim_payment(
        ctx: Context<ClaimPayment>,
        schedule_id: [u8; 32],
        recipient: Pubkey,
        amount: u64,
        leaf_index: u16,
        proof: Vec<[u8; 32]>,
    ) -> Result<()> {
        ctx.accounts
            .claim_payment(schedule_id, recipient, amount, leaf_index, proof)
    }

    // er ixs

    pub fn commit(ctx: Context<Commit>) -> Result<()> {
        ctx.accounts.commit()
    }
}
