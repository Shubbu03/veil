use anchor_lang::prelude::*;

use crate::error::VeilProgramError;
use crate::events::ScheduleUpdated;
use crate::state::ScheduleStatus;
use crate::{
    MAX_SCHEDULE_INTERVAL_SECS, MAX_SCHEDULE_RECIPIENTS, MIN_SCHEDULE_INTERVAL_SECS,
    ScheduleAccount, VaultAccount, VeilConfig,
};

#[derive(Accounts)]
pub struct UpdateSchedule<'info> {
    #[account(mut)]
    pub employer: Signer<'info>,

    #[account(
        seeds = [b"veil_config"],
        bump
    )]
    pub config: Account<'info, VeilConfig>,

    #[account(
        mut,
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

impl<'info> UpdateSchedule<'info> {
    pub fn update_schedule(
        &mut self,
        interval_secs: u64,
        reserved_amount: u64,
        per_execution_amount: u64,
        merkle_root: [u8; 32],
        total_recipients: u16,
    ) -> Result<()> {
        require!(!self.config.paused, VeilProgramError::Paused);
        require!(
            self.schedule.status == ScheduleStatus::Paused,
            VeilProgramError::ScheduleNotPaused
        );
        require!(
            self.schedule.paid_count == 0 && self.schedule.batch_start_time == 0,
            VeilProgramError::ScheduleBatchInProgress
        );
        require!(
            interval_secs >= MIN_SCHEDULE_INTERVAL_SECS
                && interval_secs <= MAX_SCHEDULE_INTERVAL_SECS,
            VeilProgramError::InvalidScheduleInterval
        );
        require!(reserved_amount > 0, VeilProgramError::InvalidReservedAmount);
        require!(
            per_execution_amount > 0,
            VeilProgramError::InvalidPerExecutionAmount
        );
        require!(total_recipients > 0, VeilProgramError::InvalidMaxRecipients);
        require!(
            total_recipients <= self.config.max_recipients,
            VeilProgramError::InvalidMaxRecipients
        );
        require!(
            total_recipients <= MAX_SCHEDULE_RECIPIENTS,
            VeilProgramError::InvalidMaxRecipients
        );
        require!(
            per_execution_amount <= reserved_amount,
            VeilProgramError::InvalidPerExecutionAmount
        );

        if reserved_amount > self.schedule.reserved_amount {
            let additional_reserve = reserved_amount
                .checked_sub(self.schedule.reserved_amount)
                .ok_or(VeilProgramError::InsufficientFunds)?;
            require!(
                additional_reserve <= self.vault.available,
                VeilProgramError::InsufficientFunds
            );

            self.vault.available = self
                .vault
                .available
                .checked_sub(additional_reserve)
                .ok_or(VeilProgramError::InsufficientFunds)?;
            self.vault.reserved = self
                .vault
                .reserved
                .checked_add(additional_reserve)
                .ok_or(VeilProgramError::InsufficientFunds)?;
        } else if reserved_amount < self.schedule.reserved_amount {
            let reserve_release = self
                .schedule
                .reserved_amount
                .checked_sub(reserved_amount)
                .ok_or(VeilProgramError::InsufficientFunds)?;

            self.vault.available = self
                .vault
                .available
                .checked_add(reserve_release)
                .ok_or(VeilProgramError::InsufficientFunds)?;
            self.vault.reserved = self
                .vault
                .reserved
                .checked_sub(reserve_release)
                .ok_or(VeilProgramError::InsufficientFunds)?;
        }

        let clock = Clock::get()?;
        let next_execution = clock.unix_timestamp as u64 + interval_secs;

        self.schedule.interval_secs = interval_secs;
        self.schedule.next_execution = next_execution;
        self.schedule.reserved_amount = reserved_amount;
        self.schedule.per_execution_amount = per_execution_amount;
        self.schedule.merkle_root = merkle_root;
        self.schedule.total_recipients = total_recipients;
        self.schedule.paid_count = 0;
        self.schedule.paid_bitmap = [0u8; 128];
        self.schedule.batch_start_time = 0;

        emit!(ScheduleUpdated {
            employer: self.employer.key(),
            schedule: self.schedule.key(),
            reserved_amount,
            per_execution_amount,
            interval_secs,
            next_execution: next_execution as i64,
            total_recipients,
            timestamp: clock.unix_timestamp,
        });

        Ok(())
    }
}
