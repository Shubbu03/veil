#![allow(unexpected_cfgs, deprecated)]
pub mod constants;
pub mod error;
pub mod events;
pub mod instructions;
pub mod state;

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
    ) -> Result<()> {
        ctx.accounts
            .init_config(governance, er_authority, allowed_mint, max_recipients)
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

    pub fn create_schedule(ctx: Context<CreateSchedule>) -> Result<()> {
        ctx.accounts.create_scehdule()
    }
    pub fn cancel_schedule(ctx: Context<CancelSchedule>) -> Result<()> {
        ctx.accounts.cancel_schedule()
    }
    pub fn execute_settlement(ctx: Context<ExecuteSettlement>) -> Result<()> {
        ctx.accounts.execute_settlement()
    }
}
