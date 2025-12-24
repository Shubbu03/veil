use anchor_lang::prelude::*;

use crate::error::VeilProgramError;
use crate::events::ScheduleCreated;
use crate::state::ScheduleStatus;
use crate::{ScheduleAccount, VaultAccount, VeilConfig, ANCHOR_DISCRIMINATOR};

#[derive(Accounts)]
#[instruction(schedule_id: [u8; 32])]
pub struct CreateSchedule<'info> {
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
        init,
        payer = employer,
        space = ANCHOR_DISCRIMINATOR + ScheduleAccount::INIT_SPACE,
        seeds = [b"schedule", vault.key().as_ref(), schedule_id.as_ref()],
        bump
    )]
    pub schedule: Account<'info, ScheduleAccount>,

    pub system_program: Program<'info, System>,
}

impl<'info> CreateSchedule<'info> {
    pub fn create_schedule(
        &mut self,
        schedule_id: [u8; 32],
        interval_secs: u64,
        reserved_amount: u64,
        per_execution_amount: u64,
        merkle_root: [u8; 32],
        total_recipients: u16,
        er_job_id: [u8; 32],
    ) -> Result<()> {
        require!(!self.config.paused, VeilProgramError::Paused);
        require!(interval_secs > 0, VeilProgramError::InvalidScheduleId);
        require!(reserved_amount > 0, VeilProgramError::InsufficientFunds);
        require!(
            per_execution_amount > 0,
            VeilProgramError::InsufficientFunds
        );
        require!(total_recipients > 0, VeilProgramError::InvalidMaxRecipients);
        require!(
            reserved_amount <= self.vault.available,
            VeilProgramError::InsufficientFunds
        );
        require!(
            per_execution_amount <= reserved_amount,
            VeilProgramError::InsufficientFunds
        );

        let clock = Clock::get()?;
        let next_execution = clock.unix_timestamp as u64 + interval_secs;

        // Derive bump from seeds
        let vault_key = self.vault.key();
        let seeds = &[b"schedule", vault_key.as_ref(), schedule_id.as_ref()];
        let (schedule_pda, bump) =
            Pubkey::find_program_address(seeds, self.schedule.to_account_info().owner);
        require!(
            schedule_pda == self.schedule.key(),
            VeilProgramError::InvalidScheduleId
        );

        // Move funds from available to reserved
        self.vault.available = self
            .vault
            .available
            .checked_sub(reserved_amount)
            .ok_or(VeilProgramError::InsufficientFunds)?;
        self.vault.reserved = self
            .vault
            .reserved
            .checked_add(reserved_amount)
            .ok_or(VeilProgramError::InsufficientFunds)?;

        // Initialize schedule
        self.schedule.set_inner(ScheduleAccount {
            employer: self.employer.key(),
            vault: self.vault.key(),
            status: ScheduleStatus::Active,
            interval_secs,
            next_execution,
            reserved_amount,
            per_execution_amount,
            er_job_id,
            merkle_root,
            total_recipients,
            paid_count: 0,
            paid_bitmap: [0u8; 128],
            last_executed_batch: 0,
            bump,
        });

        emit!(ScheduleCreated {
            employer: self.employer.key(),
            vault: self.vault.key(),
            schedule: self.schedule.key(),
            reserved_amount,
            interval_secs,
            next_execution: next_execution as i64,
        });

        Ok(())
    }
}
