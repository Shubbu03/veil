use anchor_lang::prelude::*;

use crate::error::VeilProgramError;
use crate::events::{SchedulePaused, ScheduleResumed};
use crate::state::ScheduleStatus;
use crate::{ScheduleAccount, VeilConfig};

#[derive(Accounts)]
pub struct PauseSchedule<'info> {
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
    pub schedule: Account<'info, ScheduleAccount>,
}

impl<'info> PauseSchedule<'info> {
    pub fn pause_schedule(&mut self, pause: bool) -> Result<()> {
        require!(!self.config.paused, VeilProgramError::Paused);

        let clock = Clock::get()?;
        let timestamp = clock.unix_timestamp;

        if pause {
            require!(
                self.schedule.status == ScheduleStatus::Active,
                VeilProgramError::ScheduleNotActive
            );
            self.schedule.status = ScheduleStatus::Paused;

            emit!(SchedulePaused {
                employer: self.employer.key(),
                schedule: self.schedule.key(),
                timestamp,
            });
        } else {
            require!(
                self.schedule.status == ScheduleStatus::Paused,
                VeilProgramError::ScheduleNotPaused
            );
            self.schedule.status = ScheduleStatus::Active;

            emit!(ScheduleResumed {
                employer: self.employer.key(),
                schedule: self.schedule.key(),
                timestamp,
            });
        }

        Ok(())
    }
}

