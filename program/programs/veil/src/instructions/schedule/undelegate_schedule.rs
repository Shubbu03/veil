use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::cpi::undelegate_account;

use crate::error::VeilProgramError;
use crate::events::ScheduleUndelegated;
use crate::ScheduleAccount;
use crate::VeilConfig;

#[derive(Accounts)]
#[instruction(schedule_id: [u8; 32])]
pub struct UndelegateSchedule<'info> {
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

    /// CHECK: The schedule PDA to undelegate
    #[account(mut)]
    pub pda: AccountInfo<'info>,

    /// CHECK: Undelegate buffer PDA
    #[account(mut)]
    pub buffer: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

impl<'info> UndelegateSchedule<'info> {
    pub fn undelegate_schedule(&mut self, schedule_id: [u8; 32]) -> Result<()> {
        require!(!self.config.paused, VeilProgramError::Paused);
        require!(
            self.pda.key() == self.schedule.key(),
            VeilProgramError::InvalidScheduleId
        );

        // Prepare seeds for the schedule PDA
        let vault_key = self.schedule.vault;
        let bump = self.schedule.bump;
        let seeds = vec![
            b"schedule".to_vec(),
            vault_key.as_ref().to_vec(),
            schedule_id.to_vec(),
            vec![bump],
        ];

        undelegate_account(
            &self.pda.to_account_info(),
            &crate::ID,
            &self.buffer.to_account_info(),
            &self.payer.to_account_info(),
            &self.system_program.to_account_info(),
            seeds,
        )?;

        emit!(ScheduleUndelegated {
            schedule: self.schedule.key(),
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }
}
