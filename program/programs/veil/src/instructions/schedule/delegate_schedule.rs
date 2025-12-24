use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::anchor::delegate;
use ephemeral_rollups_sdk::cpi::DelegateConfig;

use crate::error::VeilProgramError;
use crate::events::ScheduleDelegated;
use crate::state::ScheduleStatus;
use crate::{ScheduleAccount, VeilConfig};

#[delegate]
#[derive(Accounts)]
#[instruction(schedule_id: [u8; 32])]
pub struct DelegateSchedule<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        seeds = [b"veil_config"],
        bump
    )]
    pub config: Account<'info, VeilConfig>,

    #[account(
        mut,
        seeds = [b"schedule", schedule.vault.as_ref(), schedule_id.as_ref()],
        bump = schedule.bump,
    )]
    pub schedule: Account<'info, ScheduleAccount>,

    /// CHECK: The schedule PDA to delegate
    #[account(mut, del)]
    pub pda: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

impl<'info> DelegateSchedule<'info> {
    pub fn delegate_schedule(&mut self, schedule_id: [u8; 32]) -> Result<()> {
        require!(!self.config.paused, VeilProgramError::Paused);
        require!(
            self.schedule.status == ScheduleStatus::Active,
            VeilProgramError::ScheduleNotActive
        );
        require!(
            self.pda.key() == self.schedule.key(),
            VeilProgramError::InvalidScheduleId
        );

        // Derive seeds for the schedule PDA
        let vault_key = self.schedule.vault;
        let bump = self.schedule.bump;
        let seeds = &[b"schedule", vault_key.as_ref(), schedule_id.as_ref(), &[bump]];

        let delegate_config = DelegateConfig {
            validator: None,
            commit_frequency_ms: 0,
        };
        self.delegate_pda(&self.payer, seeds, delegate_config)?;

        emit!(ScheduleDelegated {
            schedule: self.schedule.key(),
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }
}

