use anchor_lang::prelude::*;

use crate::error::VeilProgramError;
use crate::events::ScheduleCancelled;
use crate::state::ScheduleStatus;
use crate::{ScheduleAccount, VeilConfig, VaultAccount};

#[derive(Accounts)]
pub struct CancelSchedule<'info> {
    #[account(mut)]
    pub employer: Signer<'info>,

    #[account(
        seeds = [b"veil_config"],
        bump
    )]
    pub config: Account<'info, VeilConfig>,

    #[account(
        mut,
        seeds = [b"vault", employer.key().as_ref()],
        bump = vault.bump,
        has_one = employer @ VeilProgramError::Unauthorized,
    )]
    pub vault: Account<'info, VaultAccount>,

    #[account(
        mut,
        has_one = employer @ VeilProgramError::Unauthorized,
        has_one = vault @ VeilProgramError::VaultMismatch,
    )]
    pub schedule: Account<'info, ScheduleAccount>,
}

impl<'info> CancelSchedule<'info> {
    pub fn cancel_schedule(&mut self) -> Result<()> {
        require!(!self.config.paused, VeilProgramError::Paused);
        require!(
            self.schedule.status != ScheduleStatus::Cancelled,
            VeilProgramError::ScheduleAlreadyCancelled
        );

        let returned_amount = self.schedule.reserved_amount;

        // Move funds back from reserved to available
        self.vault.reserved = self
            .vault
            .reserved
            .checked_sub(returned_amount)
            .ok_or(VeilProgramError::InsufficientFunds)?;
        self.vault.available = self
            .vault
            .available
            .checked_add(returned_amount)
            .ok_or(VeilProgramError::InsufficientFunds)?;

        // Mark schedule as cancelled
        self.schedule.status = ScheduleStatus::Cancelled;

        emit!(ScheduleCancelled {
            employer: self.employer.key(),
            schedule: self.schedule.key(),
            returned_amount,
        });

        Ok(())
    }
}
